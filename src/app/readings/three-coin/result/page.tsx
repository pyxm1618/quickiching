import type { Metadata } from "next";
import { ThreeCoinResultClient } from "@/components/three-coin-result/three-coin-result-client";

export const metadata: Metadata = {
  title: "Your Three-Coin Reading",
  description: "A private Three-Coin I Ching reading restored from the completed cast in this browser session.",
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Your Three-Coin Reading",
    description: "A private Three-Coin I Ching reading restored from the completed cast in this browser session.",
    type: "website",
    siteName: "Quick I Ching",
  },
};

export default function ThreeCoinResultPage() {
  return (
    <div data-realm="chamber">
      <ThreeCoinResultClient />
    </div>
  );
}
