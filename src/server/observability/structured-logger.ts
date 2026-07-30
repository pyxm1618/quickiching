const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "context",
  "email",
  "password",
  "prompt",
  "question",
  "secret",
  "token",
  "url",
]);

function redact(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEYS.has(key.toLowerCase())) return "[REDACTED]";
  if (value instanceof Error) {
    return { name: value.name, message: "[REDACTED]" };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redact(childValue, childKey),
      ]),
    );
  }
  return value;
}

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSink = (entry: Record<string, unknown>) => void;

export function createStructuredLogger(input: {
  sink?: LogSink;
  environment: string;
  clock?: { now(): Date };
}) {
  const sink = input.sink ?? ((entry) => console.log(JSON.stringify(entry)));
  const clock = input.clock ?? { now: () => new Date() };

  function write(level: LogLevel, event: string, context: Record<string, unknown> = {}): void {
    sink({
      level,
      event,
      environment: input.environment,
      timestamp: clock.now().toISOString(),
      ...redact(context) as Record<string, unknown>,
    });
  }

  return {
    debug: (event: string, context?: Record<string, unknown>) => write("debug", event, context),
    info: (event: string, context?: Record<string, unknown>) => write("info", event, context),
    warn: (event: string, context?: Record<string, unknown>) => write("warn", event, context),
    error: (event: string, context?: Record<string, unknown>) => write("error", event, context),
  };
}
