/** @typedef {Record<string, string | undefined>} VercelDeploymentEnvironment */

export const CANONICAL_PRODUCTION_VERCEL_PROJECT_ID = "prj_pCpeoAys2GOqKZvkbLugYjpJWZBS";

/** @param {VercelDeploymentEnvironment} [environment] */
export function isCanonicalProductionVercelDeployment(environment = process.env) {
  return environment.VERCEL === "1"
    && environment.VERCEL_ENV === "production"
    && environment.VERCEL_PROJECT_ID === CANONICAL_PRODUCTION_VERCEL_PROJECT_ID;
}

/** @param {Record<string, string | undefined>} [environment] */
/** @param {VercelDeploymentEnvironment} environment */
export function isNonCanonicalVercelDeployment(environment = process.env) {
  return environment.VERCEL === "1"
    && !isCanonicalProductionVercelDeployment(environment);
}
