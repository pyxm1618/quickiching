export const ADSTERRA_RESULT_UNIT = {
  scriptOrigin: "https://pl30822164.effectivecpmnetwork.com",
  scriptUrl: "https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js",
  containerId: "container-98a6d22e22a68bd3f38e4eedda19cd18",
  scriptElementId: "adsterra-result-native-loader",
} as const;

export function isAdsterraEnabledValue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
