import { afterEach, describe, expect, it, vi } from "vitest";
import { readingEntryToRestore, readReadingEntry, readingEntryKey, readingEntryReturnPath, readingEntryFromCallback, readingUserSignedIn } from "./reading-entry";

describe("reading entry continuation", () => {
  it.each(["free", "deep"] as const)("keeps %s scoped to the exact cast and preserves the current return URL", (choice) => {
    const entries = new Map([[readingEntryKey("cast-a"), choice]]);
    const storage = { getItem: (key: string) => entries.get(key) ?? null } as Storage;
    expect(readReadingEntry(storage, "cast-a")).toBe(choice);
    expect(readReadingEntry(storage, "cast-b")).toBeNull();
    expect(readingEntryReturnPath({ pathname: "/readings/three-coin/result", search: "?session=cast-a" }, choice, "cast-a")).toBe(`/readings/three-coin/result?session=cast-a#reading-${choice}`);
  });
  it("rejects unknown selections", () => {
    expect(readReadingEntry({ getItem: () => "invented" } as unknown as Storage, "cast-a")).toBeNull();
  });
});

 describe("reading authentication boundary", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([{ user: null }, { user: { id: "signed-in-user" } }])("accepts only an explicit auth response: %j", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    expect(await readingUserSignedIn()).toBe(payload.user !== null);
  });
  it.each([{}, { user: "unknown" }, { user: {} }])("fails explicitly for malformed auth: %j", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(readingUserSignedIn()).rejects.toThrow("READING_AUTH_RESPONSE_INVALID");
  });
  it("does not turn an unavailable auth service into an anonymous success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(readingUserSignedIn()).rejects.toThrow("READING_AUTH_CHECK_FAILED");
  });
});

describe("new-tab callback intent", () => {
  it.each(["free", "deep"] as const)("restores %s only for the matching cast ID", (choice) => {
    expect(readingEntryFromCallback({ search: "?session=cast-a", hash: `#reading-${choice}` }, "cast-a")).toBe(choice);
    expect(readingEntryFromCallback({ search: "?session=cast-b", hash: `#reading-${choice}` }, "cast-a")).toBeNull();
  });
  it("does not invent an entry from an unknown fragment", () => {
    expect(readingEntryFromCallback({ search: "?session=cast-a", hash: "#unknown" }, "cast-a")).toBeNull();
  });
});

describe("explicit return intent", () => {
  const storage = { getItem: () => "deep" } as unknown as Storage;
  it("allows View Free Reading to override a previously selected Deep entry", () => {
    expect(readingEntryToRestore(storage, { search: "?session=cast-a", hash: "#reading-free" }, "cast-a")).toBe("free");
  });
  it("rejects another cast's fragment and preserves this cast's own pending choice", () => {
    expect(readingEntryToRestore(storage, { search: "?session=cast-b", hash: "#reading-free" }, "cast-a")).toBe("deep");
  });
});
