import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

export default function LocalizedUnpublishedPage() {
  notFound();
}
