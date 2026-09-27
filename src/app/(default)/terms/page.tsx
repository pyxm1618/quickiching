import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using Quick I Ching casting methods, accounts, reading credits, and Deep Reading.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Terms of Service</h1>
      <p className="mt-4 text-sm text-[var(--ink-3)]">Last updated: September 27, 2026</p>

      <h2 className="mt-10 font-display text-2xl font-medium">What the service provides</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching provides four browser-accessible I Ching casting methods—Three Coin, Yarrow Stalk, one documented Mei Hua Yi Shu current-time convention, and Manual Cast—with complete free interpretations of the cast itself. Free readings never call AI. Deep Reading is available only when shown on Pricing, requires sign-in, supports Three-Coin casts only, and relates the exact cast and its actual changing lines and relating hexagram when present to a clear core question fixed before the first toss, context supplied by the user, and cited Quick I Ching source material.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Deep Reading credits and refunds</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The Pricing page displays current pack prices and credit validity; payment runs through Waffo checkout. Review the provider’s checkout terms before paying and contact support@quickiching.com with payment or refund questions. A valid Deep Reading request needs enough user context and must pass the high-risk review; blocked requests do not start generation or reserve a credit. One credit is reserved when generation starts and is consumed only after successful delivery. If generation, review, or delivery fails after reservation, the reservation is released. Free readings do not send questions or cast information to an AI provider.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Reflection, not deterministic prediction or professional advice</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The site is for cultural exploration and personal reflection. A reading does not establish facts, guarantee future outcomes, diagnose a condition, determine legal rights, or provide medical, legal, financial, investment, tax, emergency, or safety advice. You remain responsible for decisions and should use qualified professionals and real-world evidence where appropriate.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Casting integrity and repeated readings</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Generated coin lines and completed yarrow changes cannot be manually edited inside a reading. You may clear the whole browser-session reading and start over, but repeated casting simply to obtain a preferred answer is discouraged because it undermines the reflective purpose of the tool.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Methods and interpretation limits</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">I Ching and Mei Hua practices have historical transmission and interpretive variation. Quick I Ching documents the specific computational conventions used by the site and does not claim that one web implementation is the only orthodox practice. Free interpretation text is general rather than personalized to a user’s private circumstances.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Acceptable use</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Do not use the service unlawfully, attempt to compromise its security or availability, present a reading as guaranteed professional advice, or use it to manufacture anxiety, dependency, harassment, or consequential claims about another person. Additional boundaries appear in our <Link href="/acceptable-use" className="font-semibold text-[var(--jade)] hover:underline">Acceptable Use</Link> page.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Intellectual property</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Quick I Ching does not claim ownership of the historical I Ching tradition or public-domain classical material. The site’s original software, interface, branding, and original explanatory and interpretation text remain protected to the extent applicable.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Availability and changes</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">The service may change, be maintained, or become temporarily unavailable. We do not guarantee uninterrupted operation or a particular interpretive outcome.</p>

      <h2 className="mt-10 font-display text-2xl font-medium">Contact and mandatory rights</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Questions may be sent to support@quickiching.com. Nothing in these terms is intended to remove mandatory consumer rights that cannot lawfully be excluded.</p>

      <p className="mt-10 border-t border-[var(--line)] pt-6 text-sm leading-7 text-[var(--ink-2)]">See the <Link href="/privacy" className="font-semibold text-[var(--jade)] hover:underline">Privacy Policy</Link> for data handling details.</p>
    </article>
  );
}
