import { describe, expect, it } from "vitest";
import { isStrictSameOriginRequest } from "./origin-guard";

function request(headers: Record<string, string>, url = "https://www.quickiching.com/api/checkout") {
  return new Request(url, { method: "POST", headers });
}

const validHeaders = {
  origin: "https://www.quickiching.com",
  referer: "https://www.quickiching.com/account",
  "sec-fetch-site": "same-origin",
};

describe("isStrictSameOriginRequest", () => {
  it("accepts a complete same-origin browser request", () => {
    expect(isStrictSameOriginRequest(request(validHeaders), {})).toBe(true);
  });

  it.each([
    ["origin"],
    ["referer"],
    ["sec-fetch-site"],
  ])("rejects a request missing %s", (missing) => {
    const headers = { ...validHeaders } as Record<string, string>;
    delete headers[missing];
    expect(isStrictSameOriginRequest(request(headers), {})).toBe(false);
  });

  it("rejects same-site and cross-site fetch metadata", () => {
    expect(isStrictSameOriginRequest(request({ ...validHeaders, "sec-fetch-site": "same-site" }), {})).toBe(false);
    expect(isStrictSameOriginRequest(request({ ...validHeaders, "sec-fetch-site": "cross-site" }), {})).toBe(false);
  });

  it("rejects a mismatched Origin or Referer", () => {
    expect(isStrictSameOriginRequest(request({ ...validHeaders, origin: "https://attacker.example" }), {})).toBe(false);
    expect(isStrictSameOriginRequest(request({ ...validHeaders, referer: "https://attacker.example/path" }), {})).toBe(false);
  });

  it("accepts an explicitly configured canonical origin when the runtime URL differs", () => {
    const req = request(validHeaders, "https://quickiching-staging.vercel.app/api/checkout");
    expect(isStrictSameOriginRequest(req, { APP_BASE_URL: "https://www.quickiching.com" })).toBe(true);
  });

  it("rejects malformed URL headers", () => {
    expect(isStrictSameOriginRequest(request({ ...validHeaders, origin: "not-a-url" }), {})).toBe(false);
    expect(isStrictSameOriginRequest(request({ ...validHeaders, referer: "::::" }), {})).toBe(false);
  });
});
