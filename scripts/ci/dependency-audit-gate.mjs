import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function parseAuditAdvisories(output) {
  const advisories = [];
  const pattern = /\b(high|critical):\s+(.+?)\s+-\s+https:\/\/github\.com\/advisories\/(GHSA-[A-Za-z0-9-]+)/gi;
  for (const match of output.matchAll(pattern)) {
    advisories.push({
      severity: match[1].toLowerCase(),
      summary: match[2].trim(),
      id: match[3],
    });
  }
  return [...new Map(advisories.map((item) => [item.id, item])).values()];
}

export function evaluateAuditAgainstBaseline(observed, baseline) {
  const baselineIds = new Set(baseline.uniqueAdvisories.map((item) => item.id));
  const observedIds = new Set(observed.map((item) => item.id));
  return {
    newAdvisories: observed.filter((item) => !baselineIds.has(item.id)),
    resolvedAdvisories: baseline.uniqueAdvisories.filter((item) => !observedIds.has(item.id)),
    knownAdvisories: observed.filter((item) => baselineIds.has(item.id)),
  };
}

function main() {
  const baseline = JSON.parse(readFileSync(new URL("../../config/security-audit-baseline.json", import.meta.url), "utf8"));
  const result = spawnSync("bun", ["audit", "--audit-level=high"], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (output.trim()) process.stdout.write(output.endsWith("\n") ? output : output + "\n");

  const observed = parseAuditAdvisories(output);
  if (result.status !== 0 && observed.length === 0) {
    throw new Error(`DEPENDENCY_AUDIT_EXECUTION_FAILED:${result.status ?? "unknown"}`);
  }

  const evaluation = evaluateAuditAgainstBaseline(observed, baseline);
  console.log(JSON.stringify({
    observedUniqueHighCritical: observed.length,
    knownBaselineDebt: evaluation.knownAdvisories.length,
    resolvedSinceBaseline: evaluation.resolvedAdvisories.map((item) => item.id),
    newHighCritical: evaluation.newAdvisories.map((item) => item.id),
  }));

  if (evaluation.newAdvisories.length > 0) {
    throw new Error(`NEW_HIGH_CRITICAL_DEPENDENCY_ADVISORIES:${evaluation.newAdvisories.map((item) => item.id).join(",")}`);
  }
  if (evaluation.knownAdvisories.length > 0) {
    console.warn(`KNOWN_SECURITY_BASELINE_DEBT:${evaluation.knownAdvisories.length} unique high/critical advisories remain; remediate in a dedicated security PR`);
  }
  console.log("Dependency security regression gate PASS: no new high/critical advisory IDs.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
