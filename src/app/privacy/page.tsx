import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Quick I Ching handles browser data, analytics, technical logs, and support messages.",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-sm text-[var(--ink-3)]">Last updated: August 19, 2026</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Public reading data</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The public Three-Coin, Yarrow Stalk, Mei Hua Yi Shu, and Manual Cast tools do not require an account, payment, database record, or activated AI provider. Casting progress and fixed method facts may be stored in your browser’s <code>sessionStorage</code> so the current reading can survive a page refresh. A separate <code>localStorage</code>-only History shelf is written only after you explicitly choose Save; it is not an account history or cloud sync.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Hosting and technical logs</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Like most websites, hosting and network providers may process ordinary request information such as IP address, browser information, requested URL, timestamp, and security or reliability logs. These records may be used to deliver the site, prevent abuse, diagnose failures, and meet legal obligations.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Analytics and session insights</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching uses Google Analytics 4 to understand traffic sources, page views, and aggregate site usage, and Microsoft Clarity to understand interactions such as clicks, scrolling, heatmaps, and session-level experience. The site initializes analytics and advertising storage as denied by default; where supported, these services may operate in a limited cookieless mode unless a valid consent signal allows additional storage. Provider processing is also subject to Google’s and Microsoft’s applicable privacy terms.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Question privacy and optional interpretation</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Questions are optional, capped, masked for session replay, and kept out of URLs, metadata, structured data, analytics events, and application logs. If personalized interpretation is activated, explicitly clicking its button sends the full question and verified reading facts through Vercel AI Gateway to the configured downstream model provider. Those providers may process or retain the request under their configured controls and privacy terms, so do not enter sensitive personal, health, legal, or financial information. The endpoint is not cached; when any provider or safety control is unavailable, it fails closed and the static result remains available. Saved questions remain only in this browser when you explicitly save a reading.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Support messages</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">If you email support@quickiching.com, the information in your message is processed as needed to respond to the request and maintain appropriate support, security, and legal records. Do not send unnecessary sensitive information.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Your controls</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Use the tool’s <strong>New reading</strong> control to clear its current session state, or clear site data in your browser. Privacy questions or rights requests may be sent to support@quickiching.com.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Children and changes</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching is not directed to children. We may update this policy when the product, providers, or legal requirements change; the date above will be revised when material text changes.</p>

      <p className="mt-10 border-t border-[var(--line)] pt-6 text-sm leading-7 text-[var(--ink-2)]">See also the <Link href="/terms" className="font-semibold text-[var(--jade)] hover:underline">Terms of Service</Link> and <Link href="/acceptable-use" className="font-semibold text-[var(--jade)] hover:underline">Acceptable Use</Link>.</p>
    </article>
  );
}
