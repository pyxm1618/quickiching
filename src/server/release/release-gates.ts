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

export function assertPublicReleaseApproved(env: ReleaseEnvironment = process.env): void {
  if (env.NODE_ENV !== "production") return;

  // Vercel Preview remains available for real-provider smoke tests. Only the
  // production environment, or a non-Vercel production runtime, is a public
  // release and therefore subject to the complete external gate set.
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") return;

  const blocked = blockedExternalReleaseGateIds();
  if (blocked.length > 0) {
    throw new Error(`PUBLIC_RELEASE_BLOCKED: ${blocked.join(",")}`);
  }
}
