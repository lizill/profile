import type { RichTextProperties } from "@/shared/rich-text/types";

export interface Profile
  extends RichTextProperties<
    | "romanName"
    | "displayName"
    | "role"
    | "company"
    | "careerYearUnit"
    | "summaryBeforeCareer"
    | "summaryAfterCareer"
    | "aboutText"
    | "experienceLabel"
    | "teamLabel"
    | "phaseLabel"
    | "email"
    | "githubUrl"
    | "githubDisplay"
  > {
  romanName: string;
  displayName: string;
  role: string;
  company: string;
  careerStartDate: string;
  careerYearUnit: string;
  summaryBeforeCareer: string;
  summaryAfterCareer: string;
  aboutText: string;
  experienceLabel: string;
  teamLabel: string;
  phaseLabel: string;
  phases: string[];
  email: string;
  githubUrl: string;
  githubDisplay: string;
}
