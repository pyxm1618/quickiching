const REDACTED_KEYS = new Set([
  "context",
  "question",
  "prompt",
  "candidate",
  "rawBody",
  "raw",
  "token",
  "nonce",
  "email",
  "authorization",
  "cookie",
  "secret",
]);

function sanitize(value: unknown, key = ""): unknown {
  if (REDACTED_KEYS.has(key)) return "[REDACTED]";
  if (value instanceof Error) return { name: value.name, code: value.message.split(":", 1)[0].slice(0, 100) };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey)]));
  }
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

export type LogLevel = "info" | "warn" | "error";

export function structuredLog(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitize(fields) as Record<string, unknown>,
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}
