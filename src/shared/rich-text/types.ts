export interface RichTextAnnotations {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: string;
}

export interface RichTextSegment {
  text: string;
  href?: string;
  annotations?: RichTextAnnotations;
}

export type RichTextValue = string | RichTextSegment[] | null | undefined;

export type RichTextProperties<Keys extends string> = {
  [Key in `${Keys}RichText`]?: RichTextSegment[];
};
