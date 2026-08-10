import { INDEXABLE_PATHS, SITE_ORIGIN, absoluteUrl, isPrivateOrCommercialPath } from "@/lib/seo";

export const INDEXNOW_KEY = "0458fb9ef2ef723618b52f6861b3b2f7";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY_LOCATION = `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;

export function normalizeIndexNowUrl(input: string): string {
  const url = input.startsWith("/") ? new URL(input, `${SITE_ORIGIN}/`) : new URL(input);
  if (url.protocol !== "https:" || url.host !== "www.quickiching.com") {
    throw new Error(`INDEXNOW_NON_CANONICAL_HOST: ${input}`);
  }
  if (isPrivateOrCommercialPath(url.pathname)) {
    throw new Error(`INDEXNOW_PRIVATE_PATH: ${url.pathname}`);
  }
  url.hash = "";
  return url.toString();
}

export function defaultIndexNowUrls(): string[] {
  return INDEXABLE_PATHS.map(absoluteUrl);
}

export function uniqueIndexNowUrls(inputs: readonly string[]): string[] {
  return [...new Set(inputs.map(normalizeIndexNowUrl))];
}

export function buildIndexNowPayload(urlList: readonly string[]) {
  const normalized = uniqueIndexNowUrls(urlList);
  return {
    host: "www.quickiching.com",
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: normalized,
  } as const;
}
