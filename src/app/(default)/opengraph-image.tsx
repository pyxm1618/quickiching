import { quickIChingOpenGraphImage, SHARED_OG_SIZE } from "@/lib/shared-open-graph-image";

export const alt = "Quick I Ching — I Ching Online";
export const size = SHARED_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return quickIChingOpenGraphImage("en");
}
