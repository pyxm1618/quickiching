export function safeCallbackPath(value: string | null | undefined, fallback = "/account"): string {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  try {
    const base = new URL("https://app.invalid");
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith("/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
