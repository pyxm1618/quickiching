export const PUBLIC_READING_SESSION_SCHEMA_VERSION = 1 as const;

export type PublicReadingSession<T = unknown> = {
  schemaVersion: typeof PUBLIC_READING_SESSION_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  started: boolean;
  question?: string;
  data?: T;
};

type RawSession = PublicReadingSession<unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function makeReadingId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  } catch {
    // The monotonic fallback keeps the identity unique in runtimes without Web Crypto.
  }
  makeReadingId.counter += 1;
  return `public-reading-${Date.now().toString(36)}-${makeReadingId.counter.toString(36)}`;
}
makeReadingId.counter = 0;

function browserStorage(): Storage {
  if (typeof window === "undefined" || !window.sessionStorage) throw new Error("PUBLIC_READING_SESSION_UNAVAILABLE");
  return window.sessionStorage;
}

type IdentifiedRecord = Record<string, unknown> & { id: string; createdAt: string };

function validIdentity(value: unknown): value is IdentifiedRecord {
  return isRecord(value)
    && typeof value.id === "string"
    && value.id.trim().length > 0
    && typeof value.createdAt === "string"
    && !Number.isNaN(Date.parse(value.createdAt));
}

function parseRaw(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function asEnvelope(value: unknown): RawSession | null {
  if (!isRecord(value) || value.schemaVersion !== PUBLIC_READING_SESSION_SCHEMA_VERSION || !validIdentity(value)) return null;
  return {
    schemaVersion: PUBLIC_READING_SESSION_SCHEMA_VERSION,
    id: value.id,
    createdAt: value.createdAt,
    started: value.started === true,
    ...(typeof value.question === "string" && value.question ? { question: value.question } : {}),
    ...("data" in value ? { data: value.data } : {}),
  };
}

function legacyEnvelope(value: unknown): RawSession | null {
  if (value === null) return null;
  const identity = validIdentity(value) ? value : null;
  return {
    schemaVersion: PUBLIC_READING_SESSION_SCHEMA_VERSION,
    id: identity?.id ?? makeReadingId(),
    createdAt: identity?.createdAt ?? new Date().toISOString(),
    // Legacy casting data was stored separately from the old question-first keys.
    // Keep it behind the question gate until the user explicitly continues.
    started: false,
    ...(isRecord(value) && typeof value.question === "string" && value.question ? { question: value.question } : {}),
    data: value,
  };
}

function readRawSession(key: string): { raw: unknown; envelope: RawSession | null } {
  const raw = browserStorage().getItem(key);
  const parsed = parseRaw(raw);
  return { raw: parsed, envelope: asEnvelope(parsed) ?? legacyEnvelope(parsed) };
}

export function readPublicReadingSession<T>(
  key: string,
  parseData: (value: unknown) => T | null,
): PublicReadingSession<T> | null {
  try {
    const { envelope } = readRawSession(key);
    if (!envelope) return null;
    if (!("data" in envelope)) return envelope as PublicReadingSession<T>;
    const data = parseData(envelope.data);
    return data === null ? null : { ...envelope, data };
  } catch (error) {
    if (error instanceof Error && error.message === "PUBLIC_READING_SESSION_UNAVAILABLE") throw error;
    throw new Error("PUBLIC_READING_SESSION_READ_FAILED");
  }
}

export function readPublicReadingSessionState(
  key: string,
  legacyKeys: readonly string[] = [],
): { started: boolean; question?: string } {
  try {
    const current = readRawSession(key).envelope;
    let legacyStarted = false;
    let legacyQuestion: string | undefined;
    for (const legacyKey of legacyKeys) {
      const started = browserStorage().getItem(`${legacyKey}:started`) === "true";
      const question = browserStorage().getItem(`${legacyKey}:question`) ?? undefined;
      legacyStarted ||= started;
      legacyQuestion ||= question;
    }
    if (current) return { started: current.started || legacyStarted, ...(current.question ?? legacyQuestion ? { question: current.question ?? legacyQuestion } : {}) };
    if (legacyStarted || legacyQuestion) return { started: legacyStarted, ...(legacyQuestion ? { question: legacyQuestion } : {}) };
  } catch {
    // Question-first remains usable in memory when session recovery is unavailable.
  }
  return { started: false };
}

export function writePublicReadingSession<T>(key: string, data: T): PublicReadingSession<T> {
  try {
    const current = readRawSession(key).envelope;
    const next: PublicReadingSession<T> = {
      schemaVersion: PUBLIC_READING_SESSION_SCHEMA_VERSION,
      id: current?.id ?? makeReadingId(),
      createdAt: current?.createdAt ?? new Date().toISOString(),
      started: true,
      ...(current?.question ? { question: current.question } : {}),
      data,
    };
    browserStorage().setItem(key, JSON.stringify(next));
    return next;
  } catch (error) {
    if (error instanceof Error && error.message === "PUBLIC_READING_SESSION_UNAVAILABLE") throw error;
    throw new Error("PUBLIC_READING_SESSION_WRITE_FAILED");
  }
}

export function patchPublicReadingSession(
  key: string,
  patch: { started: boolean; question?: string },
  legacyKeys: readonly string[] = [],
): void {
  try {
    const current = readRawSession(key).envelope;
    if (!patch.started) {
      browserStorage().removeItem(key);
      for (const legacyKey of legacyKeys) {
        browserStorage().removeItem(`${legacyKey}:started`);
        browserStorage().removeItem(`${legacyKey}:question`);
      }
      return;
    }

    let legacyQuestion: string | undefined;
    if (!current) {
      for (const legacyKey of legacyKeys) {
        const candidate = browserStorage().getItem(`${legacyKey}:question`)?.trim();
        if (candidate) {
          legacyQuestion = candidate;
          break;
        }
      }
    }
    const next: RawSession = {
      schemaVersion: PUBLIC_READING_SESSION_SCHEMA_VERSION,
      id: current?.id ?? makeReadingId(),
      createdAt: current?.createdAt ?? new Date().toISOString(),
      started: true,
      ...(patch.question ?? legacyQuestion ? { question: patch.question ?? legacyQuestion } : {}),
      ...(current && "data" in current ? { data: current.data } : {}),
    };
    browserStorage().setItem(key, JSON.stringify(next));
    for (const legacyKey of legacyKeys) {
      browserStorage().removeItem(`${legacyKey}:started`);
      browserStorage().removeItem(`${legacyKey}:question`);
    }
  } catch {
    // The public flow remains usable in memory when session recovery is unavailable.
  }
}

export function clearPublicReadingSession(key: string): void {
  try {
    browserStorage().removeItem(key);
  } catch (error) {
    if (error instanceof Error && error.message === "PUBLIC_READING_SESSION_UNAVAILABLE") throw error;
    throw new Error("PUBLIC_READING_SESSION_CLEAR_FAILED");
  }
}

export function restartPublicReadingSession(key: string): PublicReadingSession {
  try {
    const current = readRawSession(key).envelope;
    const now = Date.now();
    const previousTime = current ? Date.parse(current.createdAt) : Number.NaN;
    const createdAt = new Date(Number.isFinite(previousTime) && previousTime >= now ? previousTime + 1 : now).toISOString();
    const next: PublicReadingSession = {
      schemaVersion: PUBLIC_READING_SESSION_SCHEMA_VERSION,
      id: makeReadingId(),
      createdAt,
      started: true,
      ...(current?.question ? { question: current.question } : {}),
    };
    browserStorage().setItem(key, JSON.stringify(next));
    return next;
  } catch (error) {
    if (error instanceof Error && error.message === "PUBLIC_READING_SESSION_UNAVAILABLE") throw error;
    throw new Error("PUBLIC_READING_SESSION_RESTART_FAILED");
  }
}
