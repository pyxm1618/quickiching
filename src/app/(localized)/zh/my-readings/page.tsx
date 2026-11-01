import type { Metadata } from "next";
import { MyReadingsPage } from "@/components/account/my-readings-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的解读", robots: { index: false, follow: false } };
export default function Page() { return <MyReadingsPage zh />; }
