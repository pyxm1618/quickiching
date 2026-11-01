// Installs/removes a localhost-only visual fixture for Account surfaces.
// The generated route is never committed and is removed after capture.
import { mkdir, readFile, writeFile, unlink, rmdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const dir = resolve("src/app/(default)/group3-visual-qa-local");
const pageTarget = resolve(dir, "page.tsx");
const clientTarget = resolve(dir, "fixture-client.tsx");

const pageSource = `import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Group3FixtureClient } from "./fixture-client";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function Group3VisualQaPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.GROUP3_VISUAL_QA !== "1" || (await headers()).get("host") !== "127.0.0.1:3036") notFound();
  return <Group3FixtureClient view={(await searchParams).view ?? "account"} />;
}
`;

const clientSource = `"use client";

import React from "react";
import { UserNavControl } from "@/components/auth/user-nav-control";
import { AccountHeading } from "@/components/account/account-heading";
import { AccountScrollRegion } from "@/components/account/account-scroll-region";
import { PurchaseView, type AccountModalData } from "@/components/account/purchase-view";
import { SettingsView } from "@/components/account/settings-view";
import type { AccountPurchase } from "@/server/account/purchase-loader";
import "@/components/account/account.css";

const purchases: AccountPurchase[] = [
  { id: "qa-order-1", productKey: "three", quantity: 3, amountMinor: 999, currency: "USD", status: "paid", paidAt: new Date("2026-10-30T12:00:00Z"), createdAt: new Date("2026-10-30T12:00:00Z"), refund: null },
  { id: "qa-order-2", productKey: "one", quantity: 1, amountMinor: 399, currency: "USD", status: "paid", paidAt: new Date("2026-10-20T12:00:00Z"), createdAt: new Date("2026-10-20T12:00:00Z"), refund: null },
  { id: "qa-order-3", productKey: "three", quantity: 3, amountMinor: 999, currency: "USD", status: "paid", paidAt: new Date("2026-10-02T12:00:00Z"), createdAt: new Date("2026-10-02T12:00:00Z"), refund: null },
  { id: "qa-order-4", productKey: "one", quantity: 1, amountMinor: 399, currency: "USD", status: "paid", paidAt: new Date("2026-09-15T12:00:00Z"), createdAt: new Date("2026-09-15T12:00:00Z"), refund: null },
];

const account: AccountModalData = {
  email: "jane@example.com",
  balance: { available: 3, expiringSoon: 0 },
  purchases,
  signInMethods: ["Google"],
};

const readingRows = [
  ["Should I change jobs this year?", "Oct 28, 2026"],
  ["A new opportunity is coming. Should I take it?", "Oct 26, 2026"],
  ["How can I improve my relationship with my family?", "Oct 23, 2026"],
  ["Is this a good time to start my own business?", "Oct 20, 2026"],
  ["How should I handle this current challenge?", "Oct 16, 2026"],
  ["Where should I focus my energy now?", "Oct 12, 2026"],
] as const;

function Scene({ children }: { children: React.ReactNode }) {
  return <main style={{ minHeight: "100dvh", background: "url('/performance/stageDesktop.e37364561615e31f.webp') center/cover fixed", position: "relative" }}>
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.52)", backdropFilter: "blur(4px)" }} />
    {children}
  </main>;
}

function Frame({ surface, children }: { surface: "account" | "settings"; children: React.ReactNode }) {
  const title = surface === "account" ? "My Account" : "Settings";
  const subtitle = surface === "account" ? "Manage your account and reading credits." : "Manage your privacy and account controls.";
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <Scene><dialog ref={ref} className="qic-account-dialog" data-account-surface={surface}>
    <div className="qic-account-frame">
      <button className="qic-account-close" aria-label="Close">×</button>
      <AccountHeading title={title} subtitle={subtitle} />
      <div className="qic-account-body">{children}</div>
    </div>
  </dialog></Scene>;
}

export function Group3FixtureClient({ view }: { view: string }) {
  if (view === "user-menu") return <main style={{ minHeight: "100dvh", background: "url('/performance/stageDesktop.e37364561615e31f.webp') center/cover", position: "relative" }}>
    <div style={{ position: "absolute", top: 74, right: 72 }}>
      <UserNavControl initialUser={{ id: "qa-user", email: "jane@example.com" }} initialOpen appearance="standard" />
    </div>
  </main>;

  if (view === "my-readings") return <div className="qic-my-readings-page">
    <AccountHeading title="My Readings" subtitle="Return to your past readings and reflections." />
    <section className="qic-my-readings-frame" aria-label="My Readings">
      <AccountScrollRegion className="qic-my-readings-region" scrollClassName="qic-my-readings-scroll" ariaLabel="Readings list">
        <ol>{readingRows.map(([question,date],index)=><li key={question}>
          <a className="qic-account-paper qic-my-reading" href={"#reading-"+index}>
            <span><strong>{question}</strong><time>{date}</time></span><span aria-hidden="true" className="qic-reading-arrow">›</span>
          </a>
        </li>)}</ol>
      </AccountScrollRegion>
    </section>
  </div>;

  if (view === "settings") return <Frame surface="settings"><SettingsView deleting={false} onDeleteView={()=>{}} zh={false} onClose={()=>{}} /></Frame>;
  if (view === "delete") return <Frame surface="settings"><SettingsView deleting onDeleteView={()=>{}} zh={false} onClose={()=>{}} /></Frame>;
  if (view === "refund") return <Frame surface="account"><PurchaseView account={account} selectedPurchase={purchases[0]} onSelectPurchase={()=>{}} zh={false} onClose={()=>{}} /></Frame>;
  return <Frame surface="account"><PurchaseView account={account} selectedPurchase={null} onSelectPurchase={()=>{}} zh={false} onClose={()=>{}} /></Frame>;
}
`;

async function current(path) {
  try { return await readFile(path, "utf8"); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

const mode = process.argv[2];
if (mode === "install") {
  const existingPage = await current(pageTarget);
  const existingClient = await current(clientTarget);
  if ((existingPage !== null && existingPage !== pageSource) || (existingClient !== null && existingClient !== clientSource)) {
    throw new Error("GROUP3_QA_ROUTE_ALREADY_EXISTS");
  }
  await mkdir(dirname(pageTarget), { recursive: true });
  await writeFile(pageTarget, pageSource);
  await writeFile(clientTarget, clientSource);
  console.log("Installed temporary Group 3 visual QA route.");
} else if (mode === "remove") {
  for (const [target, expected] of [[clientTarget, clientSource], [pageTarget, pageSource]]) {
    const existing = await current(target);
    if (existing !== null) {
      if (existing !== expected) throw new Error("GROUP3_QA_ROUTE_MODIFIED");
      await unlink(target);
    }
  }
  try { await rmdir(dir); } catch (error) { if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") throw error; }
  console.log("Temporary Group 3 visual QA route absent.");
} else {
  throw new Error("Choose install or remove");
}
