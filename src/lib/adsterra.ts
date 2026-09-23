export const ADSTERRA_RESULT_UNIT = {
  scriptOrigin: "https://pl30822164.effectivecpmnetwork.com",
  cspOrigin: "https://*.effectivecpmnetwork.com",
  scriptUrl: "https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js",
  containerId: "container-98a6d22e22a68bd3f38e4eedda19cd18",
  scriptElementId: "adsterra-result-native-loader",
} as const;

export function isAdsterraEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  const override = environment.NEXT_PUBLIC_ADSTERRA_ENABLED;
  if (override !== undefined && override.trim() !== "") {
    return override.trim().toLowerCase() === "true";
  }

  return environment.NODE_ENV === "production";
}

export function isAdsterraRuntimeHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "www.quickiching.com"
    || normalized === "quickiching.com"
    || normalized.endsWith(".vercel.app");
}
