import type { Metadata, MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

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

export function publicRobotsRoute(
  environment: IndexingEnvironment = process.env,
): MetadataRoute.Robots {
  if (isNonProductionVercelDeployment(environment)) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: "www.quickiching.com",
  };
}
