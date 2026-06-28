import type { RichTextProperties } from "@/shared/rich-text/types";

export interface Project extends RichTextProperties<"title" | "description"> {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  order: number;
  accentClass: string;
}
