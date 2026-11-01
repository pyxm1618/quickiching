import type { Metadata } from "next";
import { MyReadingsPage } from "@/components/account/my-readings-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Readings", robots: { index: false, follow: false } };
export default function Page() { return <MyReadingsPage />; }
