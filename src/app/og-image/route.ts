import { quickIChingOpenGraphImage } from "@/lib/shared-open-graph-image";

export function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "zh-Hans" ? "zh-Hans" : "en";
  return quickIChingOpenGraphImage(locale);
}
