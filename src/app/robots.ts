import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account", "/checkout/", "/result/", "/signin", "/cast/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: "www.quickiching.com",
  };
}
