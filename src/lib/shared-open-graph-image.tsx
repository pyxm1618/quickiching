import { ImageResponse } from "next/og";
import { SITE_ORIGIN } from "@/i18n/config";

export const SHARED_OG_SIZE = { width: 1200, height: 630 } as const;

export function sharedOpenGraphImageMetadata(locale: "en" | "zh-Hans") {
  return {
    url: new URL(`/og-image?locale=${locale}`, SITE_ORIGIN).toString(),
    width: SHARED_OG_SIZE.width,
    height: SHARED_OG_SIZE.height,
    type: "image/png",
    alt: locale === "zh-Hans" ? "Quick I Ching 易经在线" : "Quick I Ching — I Ching Online",
  };
}

export function quickIChingOpenGraphImage(locale: "en" | "zh-Hans"): ImageResponse {
  const zh = locale === "zh-Hans";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 88px",
          background: "linear-gradient(135deg, #17100b 0%, #2b1a0c 55%, #120d09 100%)",
          color: "#f7e4b0",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", opacity: 0.82 }}>
          QUICK I CHING
        </div>
        <div style={{ marginTop: 34, fontSize: zh ? 78 : 70, lineHeight: 1.08, maxWidth: 980 }}>
          {zh ? "易经在线 · 起卦与六十四卦解读" : "I Ching Online · Cast, Reflect, Understand"}
        </div>
        <div style={{ marginTop: 30, fontSize: 30, lineHeight: 1.35, color: "#d6bc84" }}>
          {zh ? "三枚铜钱 · 蓍草 · 梅花易数 · 手动起卦" : "Three-Coin · Yarrow Stalk · Mei Hua Yi Shu · Manual Cast"}
        </div>
      </div>
    ),
    SHARED_OG_SIZE,
  );
}
