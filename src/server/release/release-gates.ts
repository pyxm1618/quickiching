import traceability from "../../../docs/prd-traceability.json";

type ReleaseGateRecord = {
  id: string;
  status: string;
  approvalEvidence?: string;
};

type ReleaseEnvironment = Record<string, string | undefined>;

const releaseGates = traceability.releaseGates as ReleaseGateRecord[];

export function isExternalReleaseGateApproved(id: string): boolean {
  const gate = releaseGates.find((candidate) => candidate.id === id);
  return gate?.status === "approved" && Boolean(gate.approvalEvidence?.trim());
}

export function blockedExternalReleaseGateIds(): string[] {
  return releaseGates
    .filter((gate) => !isExternalReleaseGateApproved(gate.id))
    .map((gate) => gate.id);
}

function isVercelPreview(env: ReleaseEnvironment): boolean {
  return env.VERCEL === "1" && env.VERCEL_ENV === "preview";
}

export function assertPublicReleaseApproved(env: ReleaseEnvironment = process.env): void {
  if (env.NODE_ENV !== "production") return;

  // Vercel Preview remains available for real-provider smoke tests. A
  // non-Vercel production process cannot bypass the external gates merely by
  // setting VERCEL_ENV=preview.
  if (isVercelPreview(env)) return;

  const blocked = blockedExternalReleaseGateIds();
  if (blocked.length > 0) {
    throw new Error(`PUBLIC_RELEASE_BLOCKED: ${blocked.join(",")}`);
  }
}
