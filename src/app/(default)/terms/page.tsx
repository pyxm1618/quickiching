
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, type LegalSection } from "@/components/info-pages/legal-page-layout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using Quick I Ching casting methods, accounts, reading credits, and Deep Reading.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

const SECTIONS: readonly LegalSection[] = [
  { title: "What the service provides", body: <p>Quick I Ching provides four browser-accessible I Ching casting methods—Three Coin, Yarrow Stalk, one documented Mei Hua Yi Shu current-time convention, and Manual Cast—with complete free interpretations of the cast itself. Free readings never call AI. Deep Reading is available only when shown on Pricing, requires sign-in, supports Three-Coin, Yarrow Stalk, and Mei Hua Yi Shu casts, and relates the exact cast and its actual changing lines and relating hexagram when present to a clear core question fixed before the first toss, context supplied by the user, and cited Quick I Ching source material.</p> },
  { title: "Deep Reading credits and refunds", body: <p>The Pricing page displays current pack prices and credit validity; payment runs through Waffo checkout. Review the provider’s checkout terms before paying and contact <a href="mailto:support@quickiching.com">support@quickiching.com</a> with payment or refund questions. A valid Deep Reading request needs enough user context and must pass the high-risk review; blocked requests do not start generation or reserve a credit. One credit is reserved when generation starts and is consumed only after successful delivery. If generation, review, or delivery fails after reservation, the reservation is released. Free readings do not send questions or cast information to an AI provider.</p> },
  { title: "Reflection, not deterministic prediction or professional advice", body: <p>The site is for cultural exploration and personal reflection. A reading does not establish facts, guarantee future outcomes, diagnose a condition, determine legal rights, or provide medical, legal, financial, investment, tax, emergency, or safety advice. You remain responsible for decisions and should use qualified professionals and real-world evidence where appropriate.</p> },
  { title: "Casting integrity and repeated readings", body: <p>Generated coin lines and completed yarrow changes cannot be manually edited inside a reading. You may clear the whole browser-session reading and start over, but repeated casting simply to obtain a preferred answer is discouraged because it undermines the reflective purpose of the tool.</p> },
  { title: "Methods and interpretation limits", body: <p>I Ching and Mei Hua practices have historical transmission and interpretive variation. Quick I Ching documents the specific computational conventions used by the site and does not claim that one web implementation is the only orthodox practice. Free interpretation text is general rather than personalized to a user’s private circumstances.</p> },
  { title: "Acceptable use", body: <p>Do not use the service unlawfully, attempt to compromise its security or availability, present a reading as guaranteed professional advice, or use it to manufacture anxiety, dependency, harassment, or consequential claims about another person. Additional boundaries appear in our <Link href="/acceptable-use">Acceptable Use</Link> page.</p> },
  { title: "Intellectual property", body: <p>Quick I Ching does not claim ownership of the historical I Ching tradition or public-domain classical material. The site’s original software, interface, branding, and original explanatory and interpretation text remain protected to the extent applicable.</p> },
  { title: "Availability and changes", body: <p>The service may change, be maintained, or become temporarily unavailable. We do not guarantee uninterrupted operation or a particular interpretive outcome.</p> },
  { title: "Contact and mandatory rights", body: <p>Questions may be sent to <a href="mailto:support@quickiching.com">support@quickiching.com</a>. Nothing in these terms is intended to remove mandatory consumer rights that cannot lawfully be excluded.</p> },
];

export default function TermsPage() {
  return <LegalPageLayout title="Terms of Service" updated="Last updated: September 27, 2026" sections={SECTIONS} footer={<p>See the <Link href="/privacy">Privacy Policy</Link> for data handling details.</p>} />;
}
