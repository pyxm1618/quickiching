import type { MetadataRoute } from "next";
import { sitemapUrlInventory } from "@/i18n/helpers";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapUrlInventory().map((url) => ({ url }));
}
