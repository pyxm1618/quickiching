import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RETIRED_RUNTIME_MARKERS = [
  "legacyStorageKeys",
  "legacyEnvelope",
  "allowLegacyEnvelope",
  "legacyKeys",
  "quickiching:question:",
  "QUESTION_LOCKED",
  "LEGACY_DEEP_READING_READ_ONLY",
  "legacyReadOnly",
  "deep-reading-context-v1",
  "legacyDeepReadingReportSchema",
  "LEGACY_MEI_HUA_METHOD_VERSION",
  "LEGACY_MEI_HUA_READ_ONLY",
  "mei_hua_current_time",
  "legacyFingerprint",
] as const;

const RUNTIME_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".css"]);

async function sourceFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...await sourceFiles(absolute));
      continue;
    }
    if (!RUNTIME_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (/\.(?:test|spec|integration\.test)\.[^.]+$/u.test(entry.name)) continue;
    result.push(absolute);
  }
  return result;
}

describe("post-PR81 runtime legacy decommission", () => {
  it("keeps retired browser, deep-reading, Mei Hua, and fingerprint compatibility out of runtime and scripts", async () => {
    const files = [
      ...await sourceFiles(path.join(process.cwd(), "src")),
      ...await sourceFiles(path.join(process.cwd(), "scripts")),
    ];
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, "utf8");
      for (const marker of RETIRED_RUNTIME_MARKERS) {
        if (content.includes(marker)) violations.push(`${path.relative(process.cwd(), file)}: ${marker}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps question_locks out of application runtime; migration history remains the only schema record", async () => {
    const files = await sourceFiles(path.join(process.cwd(), "src"));
    const violations: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (content.includes("question_locks")) violations.push(path.relative(process.cwd(), file));
    }
    expect(violations).toEqual([]);
  });
});
