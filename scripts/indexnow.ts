import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY_LOCATION,
  buildIndexNowPayload,
  defaultIndexNowUrls,
  uniqueDeletedIndexNowUrls,
  uniqueLiveIndexNowUrls,
} from "../src/lib/indexnow";

function valuesAfter(flag: string, args: string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) values.push(args[index + 1]);
  }
  return values;
}

async function main() {
  const args = process.argv.slice(2);
  const submit = args.includes("--submit");
  const explicitLive = valuesAfter("--url", args);
  const explicitDeleted = valuesAfter("--deleted", args);
  const hasExplicit = explicitLive.length > 0 || explicitDeleted.length > 0;

  const liveUrls = hasExplicit ? uniqueLiveIndexNowUrls(explicitLive) : defaultIndexNowUrls();
  const deletedUrls = uniqueDeletedIndexNowUrls(explicitDeleted);
  const payload = buildIndexNowPayload([...liveUrls, ...deletedUrls]);

  console.log(`[IndexNow] mode=${submit ? "SUBMIT" : "DRY_RUN"}`);
  console.log(`[IndexNow] endpoint=${INDEXNOW_ENDPOINT}`);
  console.log(`[IndexNow] keyLocation=${INDEXNOW_KEY_LOCATION}`);
  console.log(`[IndexNow] live=${liveUrls.length} deleted=${deletedUrls.length} total=${payload.urlList.length}`);
  for (const url of payload.urlList) console.log(`  ${url}`);

  if (!submit) {
    console.log("[IndexNow] No network request sent. Pass --submit only after the independent final audit.");
    return;
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  console.log(`[IndexNow] response=${response.status} ${response.statusText}`);
  if (!response.ok && response.status !== 202) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
