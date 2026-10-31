import type { Metadata } from "next";
import { ReadingPage } from "@/components/three-coin-result/reading-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {"title": "Your Free Reading", "description": "A private I Ching reading restored from the completed cast in this browser session.", "robots": {"index": false, "follow": true}, "openGraph": {"title": "Your Free Reading", "description": "A private I Ching reading restored from the completed cast in this browser session.", "type": "website", "siteName": "Quick I Ching"}};
export default function Page(props: {searchParams?: Promise<{session?:string}>}) {
  return <ReadingPage {...props} locale="en" pageMode="free" />;
}
