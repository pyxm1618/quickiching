import type { Metadata } from "next";
import { QuickIChingNotFound } from "@/components/not-found/quick-iching-not-found";

export const metadata: Metadata = {
  title: { absolute: "页面不存在 | Quick I Ching" },
  description: "你请求的中文 Quick I Ching 页面不存在。",
  robots: { index: false, follow: false },
  openGraph: {
    title: "页面不存在 | Quick I Ching",
    description: "你请求的中文 Quick I Ching 页面不存在。",
    type: "website",
    siteName: "Quick I Ching",
    locale: "zh_CN",
  },
};

export default function LocalizedNotFound() {
  return <QuickIChingNotFound locale="zh" />;
}
