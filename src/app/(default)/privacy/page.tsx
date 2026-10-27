import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Quick I Ching handles browser data, account data, analytics, advertising, technical logs, and support messages.",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-sm text-[var(--ink-3)]">Last updated: October 27, 2026</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Public reading data</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The public Three-Coin, Yarrow Stalk, Mei Hua Yi Shu, and Manual Cast tools do not require an account or payment. Casting progress, an optional question, and fixed method facts may be stored in your browser’s <code>sessionStorage</code> so the current reading can survive a page refresh. If you choose Save reading, the browser-only History shelf copies that reading, including its question, to <code>localStorage</code>; it is not account history or cloud sync.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Account and paid-reading data</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">When commercial account features are enabled and you sign in, Quick I Ching stores the account, casting state, entitlement and payment state needed to provide those features. Payment processing is handled securely by our third-party payment partner Waffo; Quick I Ching does not store raw payment card details. If a question is attached to an account reading, its text is stored server-side in encrypted form with versioned encryption keys. Paid deep-reading output, order records, and refund processing states are stored server-side to fulfill reading delivery, maintain credit balances, process eligible refunds, and prevent duplicate charging.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Hosting and technical logs</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Like most websites, hosting and network providers may process ordinary request information such as IP address, browser information, requested URL, timestamp, and security or reliability logs. These records may be used to deliver the site, prevent abuse, diagnose failures, and meet legal obligations.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Privacy choices, analytics, and session insights</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">On eligible public pages, Quick I Ching uses Google Privacy &amp; Messaging as the consent layer for Google consent-mode signals. Google Analytics 4 is used for aggregate traffic measurement and Microsoft Clarity for interaction and session-level experience only when the consent signal for analytics storage is granted. If analytics consent is declined or later withdrawn, Quick I Ching disables those providers, removes their site scripts, and attempts to clear their common analytics cookies. Analytics is not enabled on account, browser-history, sign-in, sign-up, checkout, or private reading-result surfaces.</p>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">You can reopen the consent controls at any time using <strong>Privacy &amp; cookie settings</strong> in the site footer. Where a European regulations message is active, Google’s Privacy &amp; Messaging consent management platform is used for the applicable EEA, UK, and Switzerland consent flow and related consent-mode signals.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Google publisher and advertising technologies</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching has a Google publisher identifier and an <code>ads.txt</code> record. On eligible public pages, the Google publisher tag may load to support publisher verification, privacy messaging, and approved advertising features. The tag is not loaded on account, browser-history, sign-in, sign-up, checkout, or private reading-result surfaces. The presence of the publisher tag does not by itself mean that a commercial ad is displayed on every eligible page.</p>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">If Google advertising is enabled, third-party vendors including Google may place or read cookies, use web beacons, process IP addresses, or use other identifiers as a consequence of ad serving. These technologies may be used to serve and measure ads, limit repeated ads, report performance, prevent fraud and abuse, and, where permitted by the user’s choices and applicable law, personalize advertising. Google and its partners may use advertising cookies based on visits to this and other sites.</p>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">For more information, see <a href="https://policies.google.com/technologies/partner-sites" rel="noreferrer" className="font-semibold text-[var(--jade)] hover:underline">how Google uses data on partner sites</a>. You can also review Google’s <a href="https://adssettings.google.com/" rel="noreferrer" className="font-semibold text-[var(--jade)] hover:underline">Ads Settings</a>. Site-level consent choices remain available through the <strong>Privacy &amp; cookie settings</strong> control described above.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Question privacy and Deep Reading</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">A question is optional for a free cast, length-limited, masked for session replay, and kept out of URLs, metadata, structured data, analytics events, and application logs. Free readings never send a question or cast to an AI provider. Deep Reading requires a signed-in account, a clear question frozen before the first toss, enough context, an available credit, and a passing high-risk review. For an eligible request, the frozen question and submitted context are encrypted in an immutable account snapshot. To generate a report, the service decrypts those fields and sends them with the exact cast facts and cited Quick I Ching source material to the configured generation and review providers. A successfully delivered report is saved in account history. A credit is reserved when generation starts and consumed only after delivery; a failure after reservation releases it. Providers may process or retain requests under their applicable controls and privacy terms. Do not enter unnecessary sensitive personal, health, legal, or financial information. This paid processing occurs only when Deep Reading is enabled and you submit an eligible request.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Deletion and retained records</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Signed-in users can request permanent account deletion from My Account. The deletion transaction cancels active generation, releases reserved reading credits, removes stored encrypted question text and generated reading content, removes authentication sessions and connected sign-in accounts, and anonymizes the profile. Payment, entitlement, security, and audit records may be retained where needed for accounting, fraud prevention, dispute handling, or legal obligations; retained records are separated from the deleted profile where the data model permits.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Support messages</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">If you email support@quickiching.com, the information in your message is processed as needed to respond to the request and maintain appropriate support, security, and legal records. Do not send unnecessary sensitive information.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Your controls</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Use the tool’s <strong>New reading</strong> control to clear current browser session state. Use <strong>Privacy &amp; cookie settings</strong> in the footer to review or change consent choices. You can also clear site data in your browser, and signed-in users can delete their account from My Account. Privacy questions or rights requests may be sent to support@quickiching.com.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Children and changes</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching is not directed to children. We may update this policy when the product, providers, or legal requirements change; the date above will be revised when material text changes.</p>

      <p className="mt-10 border-t border-[var(--line)] pt-6 text-sm leading-7 text-[var(--ink-2)]">See also the <Link href="/terms" className="font-semibold text-[var(--jade)] hover:underline">Terms of Service</Link> and <Link href="/acceptable-use" className="font-semibold text-[var(--jade)] hover:underline">Acceptable Use</Link>.</p>
    </article>
  );
}
