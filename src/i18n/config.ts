export const SITE_ORIGIN = "https://www.quickiching.com";

export type ContentLocale = "en" | "zh-Hans";
export type PublicLocaleSegment = "" | "zh";

export type LocaleDefinition = {
  contentLocale: ContentLocale;
  publicSegment: PublicLocaleSegment;
  htmlLang: "en" | "zh-Hans";
  hreflang: "en" | "zh-Hans";
};

export const ACTIVE_CONTENT_LOCALES = ["en", "zh-Hans"] as const satisfies readonly ContentLocale[];

const LOCALE_DEFINITIONS: Record<ContentLocale, LocaleDefinition> = {
  en: {
    contentLocale: "en",
    publicSegment: "",
    htmlLang: "en",
    hreflang: "en",
  },
  "zh-Hans": {
    contentLocale: "zh-Hans",
    publicSegment: "zh",
    htmlLang: "zh-Hans",
    hreflang: "zh-Hans",
  },
};

export function isContentLocale(value: string): value is ContentLocale {
  return (ACTIVE_CONTENT_LOCALES as readonly string[]).includes(value);
}

export function localeDefinition(locale: ContentLocale): LocaleDefinition {
  return LOCALE_DEFINITIONS[locale];
}

export function contentLocaleForPublicSegment(segment: string | undefined): ContentLocale | null {
  if (segment === undefined || segment === "") return "en";
  if (segment === "zh") return "zh-Hans";
  return null;
}

export function publicSegmentForLocale(locale: ContentLocale): PublicLocaleSegment {
  return localeDefinition(locale).publicSegment;
}
