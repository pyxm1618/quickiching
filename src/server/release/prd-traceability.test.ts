import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_IDS = [
  "CAST-001",
  "CAST-002",
  "CAST-003",
  "CAST-004",
  "AUTH-001",
  "AUTH-002",
  "AUTH-003",
  "RESULT-001",
  "RESULT-002",
  "READ-001-006",
  "SAFE-001-003",
  "PAY-001-004",
  "JOB-001",
  "QUALITY-001-002",
  "HIST-001",
  "PRIV-001-002",
] as const;
const GATE_IDS = Array.from({ length: 10 }, (_, index) => `G-${String(index + 1).padStart(2, "0")}`);

type TraceabilityManifest = {
  version: string;
  requirements: Array<{ id: string; evidence: string[] }>;
  releaseGates: Array<{
    id: string;
    status: "blocked_external" | "approved";
    control: string[];
    requiredEvidence: string;
    approvalEvidence?: string[];
  }>;
};

async function manifest(): Promise<TraceabilityManifest> {
  const text = await readFile(path.join(process.cwd(), "docs/prd-traceability.json"), "utf8");
  return JSON.parse(text) as TraceabilityManifest;
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(path.join(process.cwd(), relativePath));
    return true;
  } catch {
    return false;
  }
}

describe("PRD V2.1 traceability", () => {
  it("tracks every public acceptance requirement with existing executable evidence", async () => {
    const data = await manifest();
    expect(data.version).toBe("V2.1");
    expect(data.requirements.map((entry) => entry.id).sort()).toEqual([...REQUIRED_IDS].sort());
    for (const requirement of data.requirements) {
      expect(requirement.evidence.length, `${requirement.id} has no evidence`).toBeGreaterThan(0);
      for (const evidence of requirement.evidence) {
        expect(await exists(evidence), `${requirement.id} references missing ${evidence}`).toBe(true);
        expect(evidence.endsWith(".test.ts") || evidence.endsWith(".integration.test.ts"))
          .toBe(true);
      }
    }
  });

  it("tracks all ten external release blockers without representing them as code-complete", async () => {
    const data = await manifest();
    expect(data.releaseGates.map((gate) => gate.id).sort()).toEqual([...GATE_IDS].sort());
    for (const gate of data.releaseGates) {
      expect(gate.requiredEvidence.trim().length).toBeGreaterThan(10);
      expect(gate.control.length).toBeGreaterThan(0);
      for (const control of gate.control) {
        expect(await exists(control), `${gate.id} references missing control ${control}`).toBe(true);
      }
      if (gate.status === "approved") {
        expect(gate.approvalEvidence?.length ?? 0, `${gate.id} lacks approval evidence`).toBeGreaterThan(0);
        for (const approval of gate.approvalEvidence ?? []) {
          expect(await exists(approval), `${gate.id} references missing approval ${approval}`).toBe(true);
        }
      } else {
        expect(gate.status).toBe("blocked_external");
      }
    }
  });
});
