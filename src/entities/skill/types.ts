import type { RichTextProperties } from "@/shared/rich-text/types";

export interface Skill extends RichTextProperties<"name" | "description"> {
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
}
