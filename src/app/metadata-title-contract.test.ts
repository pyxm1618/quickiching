import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function filesUnder(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("metadata title branding contract", () => {
  it("lets the root template add Quick I Ching exactly once for ordinary child titles", () => {
    const offenders: string[] = [];
    for (const path of filesUnder("src/app").filter((file) => /(?:page|layout)\.tsx$/u.test(file))) {
      const source = readFileSync(path, "utf8");
      for (const [index, line] of source.split("\n").entries()) {
        if (!/\btitle\s*:/u.test(line)) continue;
        if (/\babsolute\s*:/u.test(line)) continue;
        if (/\btemplate\s*:/u.test(line)) continue;
        if (/\|\s*Quick I Ching/u.test(line)) offenders.push(`${path}:${index + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
