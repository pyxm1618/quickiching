type AnalyticsEnvironment = Record<string, string | undefined>;

export type AnalyticsConfig = {
  gaMeasurementId: string | null;
  clarityProjectId: string | null;
};

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const CLARITY_PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// Reviewed public browser identifiers for the canonical Quick I Ching production site.
// Production intentionally ignores any stale project-level public analytics overrides;
// local and Preview may still use explicit env values for isolated testing.
const PRODUCTION_GA_MEASUREMENT_ID = "G-NLFCDYQSJQ";
const PRODUCTION_CLARITY_PROJECT_ID = "xvz3gv8ics";

function readOptionalAnalyticsId(
  name: string,
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
  if (environment.VERCEL_ENV === "production") {
    return {
      gaMeasurementId: PRODUCTION_GA_MEASUREMENT_ID,
      clarityProjectId: PRODUCTION_CLARITY_PROJECT_ID,
    };
  }

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
