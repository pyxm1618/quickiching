type BuildEnvironment = Record<string, string | undefined>;

export type VercelBuildStep = "db:migrate" | "build";

const STAGING_BASE_URL = "https://staging.quickiching.com";

export function resolveVercelBuildPlan(
  env: BuildEnvironment = process.env,
): VercelBuildStep[] {
  if (env.QUICKICHING_DEPLOYMENT_TIER !== "staging") {
    return ["build"];
  }

  if (env.APP_BASE_URL !== STAGING_BASE_URL) {
    throw new Error(
      `STAGING_MIGRATION_TARGET_REJECTED: APP_BASE_URL must be ${STAGING_BASE_URL}`,
    );
  }

  return ["db:migrate", "build"];
}
