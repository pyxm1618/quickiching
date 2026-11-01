import type { Metadata } from "next";
import { ReadingPage } from "@/components/three-coin-result/reading-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {title: "AI 深度解读", robots: {index: false, follow: true}};
export default function Page(props: {searchParams?: Promise<{session?:string}>}) {
  return <ReadingPage {...props} locale="zh-Hans" pageMode="deep" />;
}
