import { INDEXABLE_INVENTORY, SITE_ORIGIN, absoluteUrl, isIndexablePath } from "@/lib/seo";

export const INDEXNOW_KEY = "0458fb9ef2ef723618b52f6861b3b2f7";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY_LOCATION = `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;

function normalizeCanonicalIndexNowUrl(input: string): string {
  const url = input.startsWith("/") ? new URL(input, `${SITE_ORIGIN}/`) : new URL(input);
  if (url.protocol !== "https:" || url.host !== "www.quickiching.com") {
    throw new Error(`INDEXNOW_NON_CANONICAL_HOST: ${input}`);
  }
  if (url.search) {
    throw new Error(`INDEXNOW_QUERY_URL_FORBIDDEN: ${input}`);
  }
  url.hash = "";
  return url.toString();
}

export function normalizeIndexNowLiveUrl(input: string): string {
  const normalized = normalizeCanonicalIndexNowUrl(input);
  const url = new URL(normalized);
  if (!isIndexablePath(url.pathname)) {
    throw new Error(`INDEXNOW_NON_INDEXABLE_PATH: ${url.pathname}`);
  }
  return normalized;
}

export function normalizeIndexNowDeletedUrl(input: string): string {
  return normalizeCanonicalIndexNowUrl(input);
}

export function defaultIndexNowUrls(): string[] {
  return INDEXABLE_INVENTORY.map(absoluteUrl);
}

export function uniqueLiveIndexNowUrls(inputs: readonly string[]): string[] {
  return [...new Set(inputs.map(normalizeIndexNowLiveUrl))];
}

export function uniqueDeletedIndexNowUrls(inputs: readonly string[]): string[] {
  return [...new Set(inputs.map(normalizeIndexNowDeletedUrl))];
}

export function buildIndexNowPayload(urlList: readonly string[]) {
  const normalized = [...new Set(urlList.map(normalizeCanonicalIndexNowUrl))];
  return {
    host: "www.quickiching.com",
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: normalized,
  } as const;
}
