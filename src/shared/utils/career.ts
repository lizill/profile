import type { Locale } from "@/shared/i18n/types";

export function getCareerYear(startDate: string, now = new Date()): number {
  const start = new Date(startDate);
  let years = now.getFullYear() - start.getFullYear();

  if (now.getMonth() < start.getMonth()) {
    years -= 1;
  }

  return Math.max(1, years + 1);
}

export function formatCareerYear(year: number, locale: Locale): string {
  if (locale !== "en") {
    return String(year);
  }

  const mod10 = year % 10;
  const mod100 = year % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${year}st`;
  }

  if (mod10 === 2 && mod100 !== 12) {
    return `${year}nd`;
  }

  if (mod10 === 3 && mod100 !== 13) {
    return `${year}rd`;
  }

  return `${year}th`;
}
