import { INDEXABLE_PATHS, SITE_ORIGIN, absoluteUrl, isPrivateOrCommercialPath } from "../src/lib/seo";

const INDEXNOW_KEY = "0458fb9ef2ef723618b52f6861b3b2f7";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const KEY_LOCATION = `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;

function valuesAfter(flag: string, args: string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) values.push(args[index + 1]);
  }
  return values;
}

function normalizeUrl(input: string): string {
  const url = input.startsWith("/") ? new URL(input, `${SITE_ORIGIN}/`) : new URL(input);
  if (url.protocol !== "https:" || url.host !== "www.quickiching.com") {
    throw new Error(`INDEXNOW_NON_CANONICAL_HOST: ${input}`);
  }
  if (isPrivateOrCommercialPath(url.pathname)) throw new Error(`INDEXNOW_PRIVATE_PATH: ${url.pathname}`);
  url.hash = "";
  return url.toString();
}

async function main() {
  const args = process.argv.slice(2);
  const submit = args.includes("--submit");
  const explicit = [...valuesAfter("--url", args), ...valuesAfter("--deleted", args)];
  const urls = explicit.length > 0 ? explicit.map(normalizeUrl) : INDEXABLE_PATHS.map(absoluteUrl);
  const uniqueUrls = [...new Set(urls)];

  console.log(`[IndexNow] mode=${submit ? "SUBMIT" : "DRY_RUN"}`);
  console.log(`[IndexNow] endpoint=${INDEXNOW_ENDPOINT}`);
  console.log(`[IndexNow] keyLocation=${KEY_LOCATION}`);
  console.log(`[IndexNow] urls=${uniqueUrls.length}`);
  for (const url of uniqueUrls) console.log(`  ${url}`);

  if (!submit) {
    console.log("[IndexNow] No network request sent. Pass --submit only after the independent final audit.");
    return;
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: "www.quickiching.com",
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList: uniqueUrls,
    }),
  });

  console.log(`[IndexNow] response=${response.status} ${response.statusText}`);
  if (!response.ok && response.status !== 202) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
