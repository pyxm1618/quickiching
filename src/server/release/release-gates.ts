import traceability from "../../../docs/prd-traceability.json";

export type ReleaseGateRecord = {
  id: string;
  status: string;
  approvalEvidence?: readonly string[];
};

type ReleaseEnvironment = Record<string, string | undefined>;

const releaseGates = traceability.releaseGates as ReleaseGateRecord[];

export function isReleaseGateRecordApproved(gate: ReleaseGateRecord): boolean {
  return gate.status === "approved"
    && Array.isArray(gate.approvalEvidence)
    && gate.approvalEvidence.length > 0
    && gate.approvalEvidence.every(
      (evidencePath) => typeof evidencePath === "string" && evidencePath.trim().length > 0,
    );
}

export function isExternalReleaseGateApproved(id: string): boolean {
  const gate = releaseGates.find((candidate) => candidate.id === id);
  return gate ? isReleaseGateRecordApproved(gate) : false;
}

export function blockedExternalReleaseGateIds(): string[] {
  return releaseGates
    .filter((gate) => !isReleaseGateRecordApproved(gate))
    .map((gate) => gate.id);
}

function isVercelPreview(env: ReleaseEnvironment): boolean {
  return env.VERCEL === "1" && env.VERCEL_ENV === "preview";
}

function isDedicatedStaging(env: ReleaseEnvironment): boolean {
  return env.VERCEL === "1"
    && env.QUICKICHING_DEPLOYMENT_TIER === "staging"
    && env.APP_BASE_URL === "https://staging.quickiching.com";
}

export function assertPublicReleaseApproved(env: ReleaseEnvironment = process.env): void {
  if (env.NODE_ENV !== "production") return;

  // Vercel Preview remains available for real-provider smoke tests. A
  // non-Vercel production process cannot bypass the external gates merely by
  // setting VERCEL_ENV=preview.
  if (isVercelPreview(env) || isDedicatedStaging(env)) return;

  const blocked = blockedExternalReleaseGateIds();
  if (blocked.length > 0) {
    throw new Error(`PUBLIC_RELEASE_BLOCKED: ${blocked.join(",")}`);
  }
}
