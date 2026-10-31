import type { Metadata } from "next";
import { ReadingPage } from "@/components/three-coin-result/reading-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {"title": "免费解卦", "description": "从本次已完成的起卦恢复的私密易经解读。", "robots": {"index": false, "follow": true}, "openGraph": {"title": "免费解卦", "description": "从本次已完成的起卦恢复的私密易经解读。", "type": "website", "siteName": "Quick I Ching"}};
export default function Page(props: {searchParams?: Promise<{session?:string}>}) {
  return <ReadingPage {...props} locale="zh-Hans" pageMode="free" />;
}
