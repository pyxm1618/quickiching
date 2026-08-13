type AnalyticsEnvironment = Pick<
  NodeJS.ProcessEnv,
  "NEXT_PUBLIC_GA_MEASUREMENT_ID" | "NEXT_PUBLIC_CLARITY_PROJECT_ID"
>;

export type AnalyticsConfig = {
  gaMeasurementId: string | null;
  clarityProjectId: string | null;
};

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const CLARITY_PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function readOptionalAnalyticsId(
  name: keyof AnalyticsEnvironment,
  rawValue: string | undefined,
  pattern: RegExp,
): string | null {
  const value = rawValue?.trim();
  if (!value) return null;
  if (!pattern.test(value)) {
    throw new Error(`${name} has an invalid format`);
  }
  return value;
}

export function getAnalyticsConfig(
  environment: AnalyticsEnvironment = process.env,
): AnalyticsConfig {
  return {
    gaMeasurementId: readOptionalAnalyticsId(
      "NEXT_PUBLIC_GA_MEASUREMENT_ID",
      environment.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      GA_MEASUREMENT_ID_PATTERN,
    ),
    clarityProjectId: readOptionalAnalyticsId(
      "NEXT_PUBLIC_CLARITY_PROJECT_ID",
      environment.NEXT_PUBLIC_CLARITY_PROJECT_ID,
      CLARITY_PROJECT_ID_PATTERN,
    ),
  };
}
