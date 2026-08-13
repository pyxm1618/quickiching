type AnalyticsEnvironment = Partial<
  Record<
    | "NEXT_PUBLIC_GA_MEASUREMENT_ID"
    | "NEXT_PUBLIC_CLARITY_PROJECT_ID"
    | "VERCEL_ENV",
    string | undefined
  >
>;

export type AnalyticsConfig = {
  gaMeasurementId: string | null;
  clarityProjectId: string | null;
};

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const CLARITY_PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// These are public browser identifiers, not secrets. Production defaults let the
// canonical Vercel deployment activate analytics without relying on project-level
// env configuration. Env vars remain explicit overrides. Preview/local stay off.
const PRODUCTION_GA_MEASUREMENT_ID = "G-NLFCDYQSJQ";
const PRODUCTION_CLARITY_PROJECT_ID = "xvz3gv8ics";

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
  const useProductionDefaults = environment.VERCEL_ENV === "production";

  return {
    gaMeasurementId: readOptionalAnalyticsId(
      "NEXT_PUBLIC_GA_MEASUREMENT_ID",
      environment.NEXT_PUBLIC_GA_MEASUREMENT_ID ??
        (useProductionDefaults ? PRODUCTION_GA_MEASUREMENT_ID : undefined),
      GA_MEASUREMENT_ID_PATTERN,
    ),
    clarityProjectId: readOptionalAnalyticsId(
      "NEXT_PUBLIC_CLARITY_PROJECT_ID",
      environment.NEXT_PUBLIC_CLARITY_PROJECT_ID ??
        (useProductionDefaults ? PRODUCTION_CLARITY_PROJECT_ID : undefined),
      CLARITY_PROJECT_ID_PATTERN,
    ),
  };
}
