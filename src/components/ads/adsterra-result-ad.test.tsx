import type { ScriptHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdsterraResultAd } from "./adsterra-result-ad";

vi.mock("next/script", () => ({
  default: ({ strategy, ...props }: ScriptHTMLAttributes<HTMLScriptElement> & { strategy?: string }) => (
    <script {...props} data-next-strategy={strategy} />
  ),
}));

const originalFlag = process.env.NEXT_PUBLIC_ADSTERRA_ENABLED;
const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_ADSTERRA_ENABLED;
  else process.env.NEXT_PUBLIC_ADSTERRA_ENABLED = originalFlag;
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

describe("AdsterraResultAd", () => {
  it("renders on a deployed environment", () => {
    delete process.env.NEXT_PUBLIC_ADSTERRA_ENABLED;
    process.env.VERCEL_ENV = "preview";
    const html = renderToStaticMarkup(<AdsterraResultAd />);

    expect(html).toContain('data-adsterra-result-slot="true"');
    expect(html).toContain("Advertisement");
    expect(html).toContain("container-98a6d22e22a68bd3f38e4eedda19cd18");
    expect(html).toContain("https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js");
    expect(html).toContain('data-next-strategy="lazyOnload"');
  });

  it("supports an explicit off switch", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_ADSTERRA_ENABLED = "false";
    expect(renderToStaticMarkup(<AdsterraResultAd />)).toBe("");
  });
});
