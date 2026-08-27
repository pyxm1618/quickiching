function parsedOrigin(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function allowedOrigins(request: Request, env: Record<string, string | undefined>): Set<string> {
  const origins = new Set<string>();
  const requestOrigin = parsedOrigin(request.url);
  if (requestOrigin) origins.add(requestOrigin);
  for (const candidate of [env.APP_BASE_URL, env.BETTER_AUTH_URL]) {
    const origin = parsedOrigin(candidate);
    if (origin) origins.add(origin);
  }
  return origins;
}

export function isStrictSameOriginRequest(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() !== "same-origin") return false;

  const origin = parsedOrigin(request.headers.get("origin"));
  const referer = parsedOrigin(request.headers.get("referer"));
  if (!origin || !referer) return false;

  const allowed = allowedOrigins(request, env);
  return allowed.has(origin) && allowed.has(referer);
}
