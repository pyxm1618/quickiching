import { readFile } from "node:fs/promises";
import {
  assertPublicV1ServerActions,
  collectServerActions,
  PUBLIC_V1_SERVER_ACTION_ALLOWLIST,
} from "../src/build/public-v1-manifest-gate";

const manifestPath = process.argv[2] ?? ".next/server/server-reference-manifest.json";

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
const actions = collectServerActions(manifest);
console.log(`[Public V1 Server Action Gate] manifest=${manifestPath} actions=${actions.length} allowlist=${PUBLIC_V1_SERVER_ACTION_ALLOWLIST.length}`);
for (const action of actions) console.log(`  ${action.key} [${action.id}]`);
assertPublicV1ServerActions(manifest);
console.log("[Public V1 Server Action Gate] PASS: no unapproved Server Actions are registered");
