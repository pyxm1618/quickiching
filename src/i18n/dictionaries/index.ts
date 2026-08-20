import type { ContentLocale } from "../config";
import { EN_UI_DICTIONARY } from "./en";
import { ZH_HANS_UI_DICTIONARY } from "./zh-Hans";
import type { UiDictionary } from "./types";

export { EN_UI_DICTIONARY } from "./en";
export { ZH_HANS_UI_DICTIONARY } from "./zh-Hans";
export type { UiDictionary } from "./types";

export function getDictionary(locale: ContentLocale): UiDictionary {
  return locale === "zh-Hans" ? ZH_HANS_UI_DICTIONARY : EN_UI_DICTIONARY;
}
