import en from "./generated/en.json";
import ja from "./generated/ja.json";
import ko from "./generated/ko.json";
import type { HomeContent } from "@/entities/home-content";
import type { Locale } from "@/shared/i18n/types";

const homeContent = {
  ko,
  ja,
  en,
} satisfies Record<Locale, HomeContent>;

export function getHomeContent(locale: Locale): HomeContent {
  return homeContent[locale] ?? homeContent.ko;
}
