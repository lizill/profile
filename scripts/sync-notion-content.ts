import { Client } from "@notionhq/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES = ["ko", "ja", "en"] as const;
const REQUIRED_ENV_KEYS = ["NOTION_TOKEN", "NOTION_SITE_TEXT_DATABASE_ID", "NOTION_CONTENT_DATABASE_ID"] as const;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i18nDir = path.join(rootDir, "src/shared/i18n/generated");
const contentDir = path.join(rootDir, "src/shared/content/generated");
const DICTIONARY_REQUIRED_PATHS = [
  "meta.title",
  "meta.description",
  "nav.ariaLabel",
  "nav.homeAriaLabel",
  "nav.githubLabel",
  "nav.githubAriaLabel",
  "nav.menuOpenLabel",
  "nav.menuCloseLabel",
  "nav.localeAriaLabel",
  "nav.links.about",
  "nav.links.skills",
  "nav.links.projects",
  "nav.links.contact",
  "hero.titleLine1",
  "hero.titleLine2",
  "hero.titleSuffix",
  "hero.primaryCta",
  "hero.secondaryCta",
  "hero.scrollAriaLabel",
  "sections.about.eyebrow",
  "sections.about.title",
  "sections.skills.eyebrow",
  "sections.skills.title",
  "sections.projects.eyebrow",
  "sections.projects.title",
  "sections.projects.helper",
  "sections.contact.eyebrow",
  "sections.contact.title",
  "sections.contact.description",
  "footer.copyright",
] as const;
const HOME_CONTENT_REQUIRED_PATHS = [
  "profile.romanName",
  "profile.displayName",
  "profile.role",
  "profile.company",
  "profile.careerStartDate",
  "profile.careerYearUnit",
  "profile.summaryBeforeCareer",
  "profile.summaryAfterCareer",
  "profile.aboutText",
  "profile.experienceLabel",
  "profile.teamLabel",
  "profile.phaseLabel",
  "profile.email",
  "profile.githubUrl",
  "profile.githubDisplay",
] as const;

type Locale = (typeof LOCALES)[number];
type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];
type JsonRecord = Record<string, unknown>;

interface NotionPage {
  properties: Record<string, NotionProperty>;
  last_edited_time?: string;
}

type NotionProperty = Record<string, any>;

interface TextRow {
  key: string;
  locale: Locale;
  text: string;
  richText: RichTextSegment[];
  description: string;
  updatedAt: string;
}

interface ContentRow {
  type: string;
  slug: string;
  locale: Locale;
  title: string;
  titleRichText: RichTextSegment[];
  description: string;
  descriptionRichText: RichTextSegment[];
  tags: string[];
  order: number;
  published: boolean;
}

interface TextValue {
  text: string;
  richText: RichTextSegment[];
}

interface RichTextAnnotations {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: string;
}

interface RichTextSegment {
  text: string;
  href?: string;
  annotations?: RichTextAnnotations;
}

async function main(): Promise<void> {
  const env = readRequiredEnv();
  const notion = new Client({ auth: env.NOTION_TOKEN });

  const textRows = await fetchTextRows(notion, env.NOTION_SITE_TEXT_DATABASE_ID);
  await writeDictionaries(textRows);
  console.log(`Synced ${textRows.length} SiteText rows.`);

  const contentRows = await fetchContentRows(notion, env.NOTION_CONTENT_DATABASE_ID);
  await writeContent(contentRows);
  console.log(`Synced ${contentRows.length} ContentItem rows.`);
}

async function fetchTextRows(notion: Client, databaseId: string): Promise<TextRow[]> {
  const pages = await queryDatabase(notion, databaseId);

  return pages.flatMap((page) => {
    const key = readText(page, ["key", "Key"]);
    const locale = normalizeLocale(readText(page, ["locale", "Locale"]));
    const textValue = readTextValue(page, ["text", "Text"]);

    if (!key || !locale) {
      return [];
    }

    return [
      {
        key,
        locale,
        text: textValue.text,
        richText: textValue.richText,
        description: readText(page, ["description", "Description"]),
        updatedAt: readText(page, ["updatedAt", "UpdatedAt", "Updated At"]) || page.last_edited_time || "",
      },
    ];
  });
}

async function fetchContentRows(notion: Client, databaseId: string): Promise<ContentRow[]> {
  const pages = await queryDatabase(notion, databaseId);

  return pages.flatMap((page) => {
    const locale = normalizeLocale(readText(page, ["locale", "Locale"]));
    const titleValue = readTextValue(page, ["title", "Title", "name", "Name"]);
    const descriptionValue = readTextValue(page, ["description", "Description"]);
    const type = readText(page, ["type", "Type"]);
    const slug = readText(page, ["slug", "Slug"]);
    const published = readCheckbox(page, ["published", "Published"]);

    if (!locale || !titleValue.text || !type || !slug || published === false) {
      return [];
    }

    return [
      {
        type: type.toLowerCase(),
        slug,
        locale,
        title: titleValue.text,
        titleRichText: titleValue.richText,
        description: descriptionValue.text,
        descriptionRichText: descriptionValue.richText,
        tags: readMultiSelect(page, ["tags", "Tags"]),
        order: readNumber(page, ["order", "Order"]) ?? 999,
        published: true,
      },
    ];
  });
}

async function queryDatabase(notion: Client, databaseId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  const dataSourceId = await resolveDataSourceId(notion, databaseId);
  let startCursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: startCursor,
      page_size: 100,
    });

    pages.push(...(response.results as unknown[]).filter(isNotionPage));
    startCursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (startCursor);

  return pages;
}

async function resolveDataSourceId(notion: Client, databaseId: string): Promise<string> {
  try {
    const database = await notion.databases.retrieve({ database_id: databaseId });
    const dataSources = (database as { data_sources?: { id?: string }[] }).data_sources;
    return dataSources?.[0]?.id ?? databaseId;
  } catch {
    return databaseId;
  }
}

async function writeDictionaries(rows: TextRow[]): Promise<void> {
  await mkdir(i18nDir, { recursive: true });
  const dictionaries = createLocaleRecords();

  rows.forEach((row) => {
    setByPath(dictionaries[row.locale], row.key, row.text);
    setRichTextByPath(dictionaries[row.locale], row.key, row.richText);
  });

  validateGeneratedRecords("i18n dictionary", dictionaries, DICTIONARY_REQUIRED_PATHS);
  await writeLocaleFiles(i18nDir, dictionaries);
}

async function writeContent(rows: ContentRow[]): Promise<void> {
  await mkdir(contentDir, { recursive: true });
  const content = createLocaleRecords();

  for (const locale of LOCALES) {
    const localeRows = rows.filter((row) => row.locale === locale);
    content[locale].profile = {};
    const skills = localeRows
      .filter((row) => row.type === "skill")
      .sort((a, b) => a.order - b.order)
      .map((row) => {
        const skill: JsonRecord = {
          name: row.title,
          badge: row.tags[0] ?? row.title.slice(0, 3).toUpperCase(),
          badgeClass: skillBadgeClass(row.title),
          description: row.description,
        };

        setOptionalRichText(skill, "name", row.titleRichText);
        setOptionalRichText(skill, "description", row.descriptionRichText);

        return skill;
      });
    const projects = localeRows
      .filter((row) => row.type === "project")
      .sort((a, b) => a.order - b.order)
      .map((row, index) => {
        const project: JsonRecord = {
          slug: row.slug,
          title: row.title,
          description: row.description,
          tags: row.tags,
          order: row.order,
          accentClass: projectAccentClass(index),
        };

        setOptionalRichText(project, "title", row.titleRichText);
        setOptionalRichText(project, "description", row.descriptionRichText);

        return project;
      });

    content[locale].skills = skills;
    content[locale].projects = projects;
    content[locale].contacts = buildContacts(localeRows);

    applyProfileRows(content[locale], localeRows);
  }

  validateGeneratedRecords("home content", content, HOME_CONTENT_REQUIRED_PATHS);
  validateHomeContentCollections(content);
  await writeLocaleFiles(contentDir, content);
}

function applyProfileRows(target: JsonRecord, rows: ContentRow[]): void {
  const profile = ensureRecord(target, "profile");

  rows
    .filter((row) => row.type === "profile")
    .forEach((row) => {
      if (row.slug === "about") {
        assignTextValue(profile, "aboutText", getDescriptionOrTitle(row));
      }

      if (row.slug === "role") {
        assignTextValue(profile, "role", getTitleValue(row));
      }

      if (row.slug === "company") {
        assignTextValue(profile, "company", getTitleValue(row));
      }

      if (row.slug === "team") {
        assignTextValue(profile, "teamLabel", getTitleValue(row));
      }

      if (row.slug === "phases") {
        profile.phases = readListValue(row);
      }

      if (!["about", "role", "company", "team", "phases"].includes(row.slug)) {
        assignTextValue(profile, toCamelCase(row.slug), getDescriptionOrTitle(row));
      }
    });
}

async function writeLocaleFiles(directory: string, records: Record<Locale, JsonRecord>): Promise<void> {
  await Promise.all(
    LOCALES.map((locale) =>
      writeFile(path.join(directory, `${locale}.json`), `${JSON.stringify(records[locale], null, 2)}\n`),
    ),
  );
}

function readRequiredEnv(): Record<RequiredEnvKey, string> {
  const entries = REQUIRED_ENV_KEYS.map((key) => [key, process.env[key]?.trim() ?? ""] as const);
  const missingKeys = entries.filter(([, value]) => !value).map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables for Notion content sync: ${missingKeys.join(", ")}`);
  }

  return Object.fromEntries(entries) as Record<RequiredEnvKey, string>;
}

function createLocaleRecords(): Record<Locale, JsonRecord> {
  return Object.fromEntries(LOCALES.map((locale) => [locale, {}])) as Record<Locale, JsonRecord>;
}

function buildContacts(rows: ContentRow[]): JsonRecord[] {
  return rows
    .filter((row) => row.type === "contact")
    .sort((a, b) => a.order - b.order)
    .map((row) => {
      const href = resolveContactHref(row);
      const contact: JsonRecord = {
        label: row.title,
        value: row.description || href.replace(/^mailto:/, "").replace(/^https?:\/\//, ""),
        href,
        ariaLabel: row.tags[1] ?? row.title,
        external: isExternalHref(href),
      };

      setOptionalRichText(contact, "label", row.titleRichText);

      if (row.description) {
        setOptionalRichText(contact, "value", row.descriptionRichText);
      }

      return contact;
    });
}

function resolveContactHref(row: ContentRow): string {
  const candidate = row.tags.find(isLinkValue) ?? row.description;

  if (candidate.startsWith("mailto:") || candidate.startsWith("http://") || candidate.startsWith("https://")) {
    return candidate;
  }

  if (candidate.includes("@")) {
    return `mailto:${candidate}`;
  }

  return candidate || row.slug;
}

function readListValue(row: ContentRow): string[] {
  if (row.tags.length > 0) {
    return row.tags;
  }

  return (row.description || row.title)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureRecord(target: JsonRecord, key: string): JsonRecord {
  if (!isRecord(target[key])) {
    target[key] = {};
  }

  return target[key] as JsonRecord;
}

function validateGeneratedRecords(
  label: string,
  records: Record<Locale, JsonRecord>,
  requiredPaths: readonly string[],
): void {
  const missingPaths = LOCALES.flatMap((locale) =>
    requiredPaths
      .filter((requiredPath) => typeof getByPath(records[locale], requiredPath) !== "string")
      .map((requiredPath) => `${locale}.${requiredPath}`),
  );

  if (missingPaths.length > 0) {
    throw new Error(`Generated ${label} is incomplete. Missing string fields: ${missingPaths.join(", ")}`);
  }
}

function validateHomeContentCollections(records: Record<Locale, JsonRecord>): void {
  const missingCollections = LOCALES.flatMap((locale) => {
    const record = records[locale];
    const missing = ["skills", "projects", "contacts", "profile.phases"].filter(
      (requiredPath) => !Array.isArray(getByPath(record, requiredPath)),
    );

    return missing.map((requiredPath) => `${locale}.${requiredPath}`);
  });

  if (missingCollections.length > 0) {
    throw new Error(`Generated home content is incomplete. Missing array fields: ${missingCollections.join(", ")}`);
  }
}

function getByPath(target: JsonRecord, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[part];
  }, target);
}

function setByPath(target: JsonRecord, key: string, value: unknown): void {
  const parts = key.split(".").filter(Boolean);
  let current: JsonRecord = target;

  parts.slice(0, -1).forEach((part) => {
    const next = current[part];

    if (!isRecord(next)) {
      current[part] = {};
    }

    current = current[part] as JsonRecord;
  });

  const last = parts.at(-1);

  if (last) {
    current[last] = value;
  }
}

function readText(page: NotionPage, names: string[]): string {
  return readTextValue(page, names).text;
}

function readTextValue(page: NotionPage, names: string[]): TextValue {
  const property = findProperty(page, names);

  if (!property) {
    return createPlainTextValue("");
  }

  switch (property.type) {
    case "title":
      return readRichText(property.title);
    case "rich_text":
      return readRichText(property.rich_text);
    case "select":
      return createPlainTextValue(property.select?.name ?? "");
    case "status":
      return createPlainTextValue(property.status?.name ?? "");
    case "url":
      return createPlainTextValue(property.url ?? "");
    case "email":
      return createPlainTextValue(property.email ?? "");
    case "phone_number":
      return createPlainTextValue(property.phone_number ?? "");
    case "date":
      return createPlainTextValue(property.date?.start ?? "");
    case "number":
      return createPlainTextValue(typeof property.number === "number" ? String(property.number) : "");
    default:
      return createPlainTextValue("");
  }
}

function readRichText(value: unknown): TextValue {
  if (!Array.isArray(value)) {
    return createPlainTextValue("");
  }

  const richText = value.flatMap((item) => {
    if (!isRecord(item) || typeof item.plain_text !== "string" || item.plain_text.length === 0) {
      return [];
    }

    const segment: RichTextSegment = {
      text: item.plain_text,
    };

    if (typeof item.href === "string" && item.href) {
      segment.href = item.href;
    }

    const annotations = normalizeRichTextAnnotations(item.annotations);

    if (hasRichTextAnnotations(annotations)) {
      segment.annotations = annotations;
    }

    return [segment];
  });

  return {
    text: richText.map((item) => item.text).join(""),
    richText,
  };
}

function createPlainTextValue(text: string): TextValue {
  return {
    text,
    richText: text ? [{ text }] : [],
  };
}

function normalizeRichTextAnnotations(value: unknown): RichTextAnnotations {
  if (!isRecord(value)) {
    return {};
  }

  return {
    bold: value.bold === true ? true : undefined,
    italic: value.italic === true ? true : undefined,
    strikethrough: value.strikethrough === true ? true : undefined,
    underline: value.underline === true ? true : undefined,
    code: value.code === true ? true : undefined,
    color: typeof value.color === "string" && value.color !== "default" ? value.color : undefined,
  };
}

function hasRichTextAnnotations(annotations: RichTextAnnotations): boolean {
  return Boolean(
    annotations.bold ||
      annotations.italic ||
      annotations.strikethrough ||
      annotations.underline ||
      annotations.code ||
      annotations.color,
  );
}

function hasRichTextFeatures(richText: RichTextSegment[]): boolean {
  return richText.some((segment) => Boolean(segment.href || hasRichTextAnnotations(segment.annotations ?? {})));
}

function setRichTextByPath(target: JsonRecord, key: string, richText: RichTextSegment[]): void {
  if (!hasRichTextFeatures(richText)) {
    return;
  }

  setByPath(target, getRichTextPath(key), richText);
}

function setOptionalRichText(target: JsonRecord, key: string, richText: RichTextSegment[]): void {
  if (!hasRichTextFeatures(richText)) {
    return;
  }

  target[`${key}RichText`] = richText;
}

function getRichTextPath(key: string): string {
  const parts = key.split(".").filter(Boolean);
  const last = parts.pop();

  return [...parts, `${last ?? key}RichText`].join(".");
}

function assignTextValue(target: JsonRecord, key: string, value: TextValue): void {
  target[key] = value.text;
  setOptionalRichText(target, key, value.richText);
}

function getTitleValue(row: ContentRow): TextValue {
  return {
    text: row.title,
    richText: row.titleRichText,
  };
}

function getDescriptionOrTitle(row: ContentRow): TextValue {
  if (row.description) {
    return {
      text: row.description,
      richText: row.descriptionRichText,
    };
  }

  return getTitleValue(row);
}

function readNumber(page: NotionPage, names: string[]): number | undefined {
  const property = findProperty(page, names);

  if (!property) {
    return undefined;
  }

  if (property.type === "number" && typeof property.number === "number") {
    return property.number;
  }

  const parsed = Number(readText(page, names));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCheckbox(page: NotionPage, names: string[]): boolean | undefined {
  const property = findProperty(page, names);

  if (!property || property.type !== "checkbox") {
    return undefined;
  }

  return Boolean(property.checkbox);
}

function readMultiSelect(page: NotionPage, names: string[]): string[] {
  const property = findProperty(page, names);

  if (!property) {
    return [];
  }

  if (property.type === "multi_select" && Array.isArray(property.multi_select)) {
    return property.multi_select.map((item) => item.name).filter(Boolean);
  }

  const text = readText(page, names);
  return text
    ? text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function findProperty(page: NotionPage, names: string[]): NotionProperty | undefined {
  const entries = Object.entries(page.properties);

  for (const name of names) {
    const exact = page.properties[name];

    if (exact) {
      return exact;
    }

    const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());

    if (match) {
      return match[1];
    }
  }

  return undefined;
}

function normalizeLocale(value: string): Locale | undefined {
  return LOCALES.includes(value as Locale) ? (value as Locale) : undefined;
}

function projectAccentClass(index: number): string {
  const accents = [
    "from-brand-600 to-violet-700",
    "from-amber-400 to-pink-400",
    "from-sky-400 to-indigo-600",
  ];

  return accents[index % accents.length];
}

function skillBadgeClass(name: string): string {
  const normalizedName = name.toLowerCase();

  if (normalizedName === "next.js") {
    return "bg-zinc-950";
  }

  if (normalizedName === "typescript") {
    return "bg-blue-600";
  }

  if (normalizedName === "tailwind css") {
    return "bg-cyan-600";
  }

  if (normalizedName === "feature-sliced design") {
    return "bg-violet-600";
  }

  return "bg-brand-600";
}

function isLinkValue(value: string): boolean {
  return value.startsWith("mailto:") || value.startsWith("http://") || value.startsWith("https://");
}

function isExternalHref(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function toCamelCase(value: string): string {
  return value.replace(/[-_ ]+([a-zA-Z0-9])/g, (_, character: string) => character.toUpperCase());
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNotionPage(value: unknown): value is NotionPage {
  return isRecord(value) && isRecord(value.properties);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
