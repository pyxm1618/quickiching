export const CANONICAL_PRODUCTION_VERCEL_PROJECT_ID = "prj_pCpeoAys2GOqKZvkbLugYjpJWZBS";

export function isCanonicalProductionVercelDeployment(environment = process.env) {
  return environment.VERCEL === "1"
    && environment.VERCEL_ENV === "production"
    && environment.VERCEL_PROJECT_ID === CANONICAL_PRODUCTION_VERCEL_PROJECT_ID;
}

export function isNonCanonicalVercelDeployment(environment = process.env) {
  return environment.VERCEL === "1"
    && !isCanonicalProductionVercelDeployment(environment);
}
