import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadHistory } from "@/server/loaders";
import { AccountScrollRegion } from "./account-scroll-region";
import { AccountHeading } from "./account-heading";
import "./account.css";

export async function MyReadingsPage({ zh = false }: { zh?: boolean }) {
  const prefix = zh ? "/zh" : "";
  const user = await getCurrentUser();
  if (!user) redirect(`${prefix}/signin?callbackURL=${encodeURIComponent(`${prefix}/my-readings`)}`);
  const readings = await loadHistory(user, zh ? "zh-Hans" : "en");
  return <div className="qic-my-readings-page">
    <AccountHeading title={zh ? "我的解读" : "My Readings"} subtitle={zh ? "回顾过往的解读与思考。" : "Return to your past readings and reflections."} />
    <section className="qic-my-readings-frame" aria-label={zh ? "我的解读" : "My Readings"}>
      <AccountScrollRegion className="qic-my-readings-region" scrollClassName="qic-my-readings-scroll" ariaLabel={zh ? "解读列表" : "Readings list"}>
        {readings.length === 0 ? <p className="qic-account-paper qic-no-readings">{zh ? "还没有账户起卦记录。" : "No readings yet."}</p> : <ol>{readings.map(reading => <li key={reading.id}>
          <Link className="qic-account-paper qic-my-reading" prefetch={false} href={`${prefix}/readings/result?session=${encodeURIComponent(reading.id)}`}>
            <span><strong data-clarity-mask="true" data-private-question="true">{reading.question?.trim() || (zh ? "未命名解读" : "Untitled Reading")}</strong><time dateTime={reading.createdAt.toISOString()}>{reading.createdAt.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" })}</time></span><span aria-hidden="true" className="qic-reading-arrow">›</span>
          </Link>
        </li>)}</ol>}
      </AccountScrollRegion>
    </section>
  </div>;
}
