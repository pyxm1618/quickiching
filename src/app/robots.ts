import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { isNonProductionVercelDeployment } from "@/lib/indexing-policy";

export default function robots(): MetadataRoute.Robots {
  if (isNonProductionVercelDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
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
