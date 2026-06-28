import en from "./generated/en.json";
import ja from "./generated/ja.json";
import ko from "./generated/ko.json";
import type { Dictionary, Locale } from "./types";

const dictionaries = {
  ko,
  ja,
  en,
} satisfies Record<Locale, Dictionary>;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.ko;
}
