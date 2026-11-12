import type { Metadata } from "next";
import { ResultChoicePage } from "@/components/reading-result/result-choice-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "选择解读方式",
  description: "为这次已经完成的 Quick I Ching 起卦选择免费解卦或深度解读。",
  robots: { index: false, follow: true },
};

export default function Page(props: { searchParams?: Promise<{ session?: string }> }) {
  return <ResultChoicePage {...props} locale="zh-Hans" />;
}
