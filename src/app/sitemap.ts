import type { MetadataRoute } from "next";
import { absoluteUrl, INDEXABLE_PATHS } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PATHS.map((path) => ({ url: absoluteUrl(path) }));
}
