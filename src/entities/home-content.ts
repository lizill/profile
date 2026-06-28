import type { Profile } from "./profile/types";
import type { Project } from "./project/types";
import type { Skill } from "./skill/types";
import type { RichTextProperties } from "@/shared/rich-text/types";

export interface ContactItem extends RichTextProperties<"label" | "value"> {
  label: string;
  value: string;
  href: string;
  ariaLabel: string;
  external: boolean;
}

export interface HomeContent {
  profile: Profile;
  skills: Skill[];
  projects: Project[];
  contacts: ContactItem[];
}
