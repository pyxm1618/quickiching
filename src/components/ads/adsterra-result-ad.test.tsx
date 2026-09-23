import React, { type ScriptHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdsterraResultAd } from "./adsterra-result-ad";

vi.mock("next/script", () => ({
  default: ({ strategy, ...props }: ScriptHTMLAttributes<HTMLScriptElement> & { strategy?: string }) => (
    <script {...props} data-next-strategy={strategy} />
  ),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AdsterraResultAd", () => {
  it("renders on a deployed environment", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSTERRA_ENABLED", "");
    vi.stubEnv("NODE_ENV", "production");
    const html = renderToStaticMarkup(<AdsterraResultAd />);

    expect(html).toContain('data-adsterra-result-slot="true"');
    expect(html).toContain("Advertisement");
    expect(html).toContain("container-98a6d22e22a68bd3f38e4eedda19cd18");
    expect(html).toContain("https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js");
    expect(html).toContain('data-next-strategy="lazyOnload"');
  });

  it("supports an explicit off switch", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADSTERRA_ENABLED", "false");
    expect(renderToStaticMarkup(<AdsterraResultAd />)).toBe("");
  });
});
