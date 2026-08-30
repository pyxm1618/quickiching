import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// vitest.config.ts excludes *.integration.test.ts from `bun run test`, and the
// serial PostgreSQL runner names its suites explicitly. A new integration suite
// that nobody adds to that list is therefore never executed anywhere — it looks
// like coverage without being coverage. This gate closes that gap.
function integrationSuites(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...integrationSuites(path));
    else if (entry.name.endsWith(".integration.test.ts")) found.push(path);
  }
  return found;
}

describe("PostgreSQL serial integration runner", () => {
  it("runs every integration suite that exists in src", () => {
    const runner = readFileSync("scripts/test-postgres-serial.mjs", "utf8");
    const suites = integrationSuites("src").sort();

    expect(suites.length).toBeGreaterThan(0);
    const unlisted = suites.filter((suite) => !runner.includes(`"${suite}"`));
    expect(unlisted).toEqual([]);
  });
});
