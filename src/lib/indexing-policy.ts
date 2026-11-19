import type { Metadata } from "next";

type IndexingEnvironment = Record<string, string | undefined>;

export function isNonProductionVercelDeployment(
  environment: IndexingEnvironment = process.env,
): boolean {
  const branch = environment.VERCEL_GIT_COMMIT_REF?.trim();
  if (branch === "staging") return true;
  return environment.VERCEL === "1" && environment.VERCEL_ENV !== "production";
}

export function publicRobotsMetadata(
  environment: IndexingEnvironment = process.env,
): NonNullable<Metadata["robots"]> {
  return isNonProductionVercelDeployment(environment)
    ? { index: false, follow: false }
    : { index: true, follow: true };
}
