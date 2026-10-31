export type ReadingEntryChoice = "free" | "deep";
export const readingEntryKey = (castId: string) => `quickiching:reading-entry:${castId}`;

export function readReadingEntry(storage: Storage, castId: string): ReadingEntryChoice | null {
  const value = storage.getItem(readingEntryKey(castId));
  return value === "free" || value === "deep" ? value : null;
}

export function readingEntryReturnPath(location: Pick<Location, "pathname" | "search">, choice: ReadingEntryChoice, castId: string): string {
  const params = new URLSearchParams(location.search);
  params.set("session", castId);
  return `${location.pathname}?${params}#reading-${choice}`;
}

export function readingEntryFromCallback(location: Pick<Location, "search" | "hash">, castId: string): ReadingEntryChoice | null {
  if (new URLSearchParams(location.search).get("session") !== castId) return null;
  return location.hash === "#reading-free" ? "free" : location.hash === "#reading-deep" ? "deep" : null;
}

export function readingEntryToRestore(storage: Storage, location: Pick<Location, "search" | "hash">, castId: string): ReadingEntryChoice | null {
  return readingEntryFromCallback(location, castId) ?? readReadingEntry(storage, castId);
}

export async function readingUserSignedIn(): Promise<boolean> {
  const response = await fetch("/api/user/me", { cache: "no-store" });
  if (!response.ok) throw new Error("READING_AUTH_CHECK_FAILED");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("user" in payload)) throw new Error("READING_AUTH_RESPONSE_INVALID");
  if (payload.user === null) return false;
  if (payload.user && typeof payload.user === "object" && "id" in payload.user && typeof payload.user.id === "string" && payload.user.id.trim()) return true;
  throw new Error("READING_AUTH_RESPONSE_INVALID");
}
