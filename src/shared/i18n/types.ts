import type { RichTextProperties, RichTextSegment } from "@/shared/rich-text/types";

export const LOCALES = ["ko", "ja", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE =
  (import.meta.env.PUBLIC_DEFAULT_LOCALE as Locale | undefined) ?? "ko";

export interface Dictionary {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    ariaLabel: string;
    homeAriaLabel: string;
    githubLabel: string;
    githubLabelRichText?: RichTextSegment[];
    githubAriaLabel: string;
    menuOpenLabel: string;
    menuCloseLabel: string;
    localeAriaLabel: string;
    links: {
      about: string;
      aboutRichText?: RichTextSegment[];
      skills: string;
      skillsRichText?: RichTextSegment[];
      projects: string;
      projectsRichText?: RichTextSegment[];
      contact: string;
      contactRichText?: RichTextSegment[];
    };
  };
  hero: RichTextProperties<
    "titleLine1" | "titleLine2" | "titleSuffix" | "primaryCta" | "secondaryCta"
  > & {
    titleLine1: string;
    titleLine2: string;
    titleSuffix: string;
    primaryCta: string;
    secondaryCta: string;
    scrollAriaLabel: string;
  };
  sections: {
    about: SectionText;
    skills: SectionText;
    projects: SectionText &
      RichTextProperties<"helper"> & {
        helper: string;
      };
    contact: SectionText &
      RichTextProperties<"description"> & {
        description: string;
      };
  };
  footer: RichTextProperties<"copyright"> & {
    copyright: string;
  };
}

interface SectionText extends RichTextProperties<"eyebrow" | "title"> {
  eyebrow: string;
  title: string;
}
