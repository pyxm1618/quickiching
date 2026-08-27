import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("Health Route (/api/health)", () => {
  it("returns 200 with status ok and cache-control no-store", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");

    const json = await response.json();
    expect(json).toEqual({ status: "ok" });
  });

  it("does not leak environment variables or secrets", async () => {
    const response = await GET();
    const json = await response.json();
    const text = JSON.stringify(json);

    expect(text).not.toContain("DATABASE_URL");
    expect(text).not.toContain("BETTER_AUTH_SECRET");
    expect(text).not.toContain("AI_GATEWAY_API_KEY");
    expect(text).not.toContain("WAFFO_PRIVATE_KEY");
    expect(text).not.toContain("RESEND_API_KEY");
  });
});
