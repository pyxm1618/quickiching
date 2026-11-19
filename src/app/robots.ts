import type { MetadataRoute } from "next";
import { publicRobotsRoute } from "@/lib/indexing-policy";

export default function robots(): MetadataRoute.Robots {
  return publicRobotsRoute();
}
