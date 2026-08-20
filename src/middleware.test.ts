import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function makeRequest(path: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(`https://www.quickiching.com${path}`, init);
}

describe("Public V1 middleware boundaries", () => {
  it("rejects Next-Action requests with a noindex 404 before route handling", () => {
    const response = middleware(makeRequest("/methods/three-coin", {
      method: "POST",
      headers: { "Next-Action": "legacy-action-id" },
    }));

    expect(response.status).toBe(404);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("leaves ordinary public page GET requests alone", () => {
    expect(middleware(makeRequest("/methods/three-coin")).status).toBe(200);
  });

  it("leaves the personalized interpretation API available to its route", () => {
    expect(middleware(makeRequest("/api/personalized-interpretation", { method: "POST" })).status).toBe(200);
  });
});
