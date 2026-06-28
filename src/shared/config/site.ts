import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/shared/i18n/types";

export const LOCALE_LABELS: Record<Locale, string> = {
  ko: "KO",
  ja: "JA",
  en: "EN",
};

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function withBasePath(path = "/"): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath === "/") {
    return `${base || ""}/`;
  }

  return `${base || ""}${normalizedPath}`;
}

export function getLocalePath(locale: Locale): string {
  return withBasePath(`/${locale}/`);
}

export function getDefaultPath(): string {
  return DEFAULT_LOCALE === "ko" ? withBasePath("/") : getLocalePath(DEFAULT_LOCALE);
}
