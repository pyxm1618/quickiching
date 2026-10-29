import { EDITORIAL_EN_01_16 } from "./editorial-en-renderings-01-16";
import { EDITORIAL_EN_17_32 } from "./editorial-en-renderings-17-32";
import { EDITORIAL_EN_33_48 } from "./editorial-en-renderings-33-48";
import { EDITORIAL_EN_49_64 } from "./editorial-en-renderings-49-64";

export type EditorialEnglishRenderingRecord = {
  judgment: string;
  image: string;
  lines: readonly [string, string, string, string, string, string];
  useLine?: string;
};

/**
 * Quick I Ching editorial English renderings.
 * These are not a historical or commercial translation. Each item is bound
 * at load time to the repository's fixed Chinese source text and revision.
 */
export const EDITORIAL_EN_RENDERINGS = {
  ...EDITORIAL_EN_01_16,
  ...EDITORIAL_EN_17_32,
  ...EDITORIAL_EN_33_48,
  ...EDITORIAL_EN_49_64,
} as const satisfies Readonly<Record<number, EditorialEnglishRenderingRecord>>;
