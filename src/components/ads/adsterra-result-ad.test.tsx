import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdsterraResultAd } from "./adsterra-result-ad";

vi.mock("next/script", () => ({
  default: ({ strategy, ...props }: React.ScriptHTMLAttributes<HTMLScriptElement> & { strategy?: string }) => (
    <script {...props} data-next-strategy={strategy} />
  ),
}));

const originalFlag = process.env.NEXT_PUBLIC_ADSTERRA_ENABLED;

afterEach(() => {
  if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_ADSTERRA_ENABLED;
  else process.env.NEXT_PUBLIC_ADSTERRA_ENABLED = originalFlag;
});

describe("AdsterraResultAd", () => {
  it("renders nothing while advertising is disabled", () => {
    process.env.NEXT_PUBLIC_ADSTERRA_ENABLED = "false";
    expect(renderToStaticMarkup(<AdsterraResultAd />)).toBe("");
  });

  it("renders exactly the reviewed slot and deferred loader when enabled", () => {
    process.env.NEXT_PUBLIC_ADSTERRA_ENABLED = "true";
    const html = renderToStaticMarkup(<AdsterraResultAd />);

    expect(html).toContain('data-adsterra-result-slot="true"');
    expect(html).toContain("Advertisement");
    expect(html).toContain('id="container-98a6d22e22a68bd3f38e4eedda19cd18"');
    expect(html).toContain('id="adsterra-result-native-loader"');
    expect(html).toContain('src="https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js"');
    expect(html).toContain('data-cfasync="false"');
    expect(html).toContain('data-next-strategy="lazyOnload"');
  });
});
