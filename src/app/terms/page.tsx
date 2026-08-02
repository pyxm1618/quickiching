import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing access to and use of Quick I Ching.",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
};

const BODY = "mt-3 text-[15px] leading-7 text-[var(--muted)]";
const LIST = "mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7 text-[var(--muted)]";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bronze)]">
        Legal
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">Last updated: August 2, 2026</p>

      <p className={BODY}>
        These Terms of Service (&quot;Terms&quot;) form an agreement between you and Wang Yufei, an
        individual operator based in China and doing business as Quick I Ching (&quot;Quick I Ching,&quot;
        &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). They govern your access to and use of
        quickiching.com, its accounts, casting tools, interpretations, reports, purchases, and related
        services (collectively, the &quot;Service&quot;).
      </p>
      <p className={BODY}>
        By using the Service, creating an account, or purchasing reading credits, you confirm that you
        have read and accepted these Terms and our <Link className="underline underline-offset-4" href="/privacy">Privacy Policy</Link>.
        Do not use the Service if you do not agree.
      </p>

      <Section title="1. Eligibility">
        <p className={BODY}>
          You must be at least 18 years old and legally capable of entering into a binding agreement.
          You may not use the Service where doing so would violate applicable law or a binding
          restriction that applies to you.
        </p>
      </Section>

      <Section title="2. What Quick I Ching provides">
        <p className={BODY}>
          Quick I Ching is an online cultural and personal-reflection tool based on the I Ching. The
          Service may let you select a topic and interpretation goal, enter context, complete a casting,
          view a primary hexagram, changing lines and a relating hexagram, receive a free basic
          interpretation, and use a reading credit for a more detailed report.
        </p>
        <p className={BODY}>
          Detailed reports and some other text are AI-generated and then checked through automated
          validation processes. AI output can be incomplete, inaccurate, inconsistent, or unsuitable
          for a particular situation. We do not guarantee that a reading is correct, predictive, or
          applicable to you.
        </p>
      </Section>

      <Section title="3. Reflection only; no professional advice">
        <p className={BODY}>
          The Service is designed for cultural exploration and personal reflection. It does not provide
          medical, mental-health, legal, financial, investment, tax, emergency, or other professional
          advice. It does not diagnose conditions, determine legal rights, recommend specific financial
          transactions, guarantee outcomes, or make decisions for you.
        </p>
        <p className={BODY}>
          You remain responsible for your decisions and actions. For matters involving health, safety,
          law, money, or other significant consequences, consult an appropriately qualified professional.
          In an emergency, contact the relevant local emergency service rather than relying on Quick I
          Ching.
        </p>
      </Section>

      <Section title="4. Accounts and authentication">
        <ul className={LIST}>
          <li>You must provide an email address that you are authorized to use and keep it accessible.</li>
          <li>You are responsible for activity performed through your account and for protecting sign-in links, sessions, and connected sign-in accounts.</li>
          <li>You must notify us promptly at support@quickiching.com if you believe your account has been accessed without authorization.</li>
          <li>You may not sell, transfer, share, or create accounts for deceptive or abusive purposes.</li>
        </ul>
      </Section>

      <Section title="5. Questions, castings, and safety controls">
        <p className={BODY}>
          Each casting is intended to address one primary question or situation. Once a casting begins,
          portions of the question and casting record may become fixed to protect result integrity. The
          Service may limit repeated castings on substantially the same question, expire unfinished
          castings, or return an earlier result during an applicable repeat-question window.
        </p>
        <p className={BODY}>
          We may block or limit interpretations involving emergencies, self-harm, medical treatment,
          legal action, specific investments, or other high-risk decisions. A blocked interpretation is
          not a professional assessment and does not mean that a situation is safe. Safety, anti-abuse,
          availability, and release controls may change as the Service develops.
        </p>
      </Section>

      <Section title="6. User content">
        <p className={BODY}>
          You retain any rights you have in the questions, context, feedback, and other material you
          submit. You grant us a limited, non-exclusive right to host, protect, process, reproduce, and
          transmit that material only as reasonably necessary to operate, secure, support, and improve
          the Service and to comply with law.
        </p>
        <p className={BODY}>
          You must have the right to submit your content. Do not submit another person&apos;s confidential
          information, unnecessary sensitive information, unlawful content, or material that infringes
          intellectual-property, privacy, publicity, or other rights. Review our <Link className="underline underline-offset-4" href="/acceptable-use">Acceptable Use Policy</Link> for additional restrictions.
        </p>
      </Section>

      <Section title="7. Free features and reading credits">
        <p className={BODY}>
          Basic casting features may be available without charge. Paid detailed readings use reading
          credits. A credit purchase is a one-time transaction and is not a subscription. Quick I Ching
          does not automatically renew a credit pack or charge an automatic top-up unless a separate
          feature is clearly offered and you expressly authorize it in the future.
        </p>
        <p className={BODY}>
          Current listed packs are USD 2.99 for one credit, USD 6.99 for three credits, and USD 9.99 for
          five credits. The <Link className="underline underline-offset-4" href="/pricing">pricing page</Link> and checkout show the current price before purchase. The amount displayed and accepted at checkout controls for that transaction, including any applicable tax.
        </p>
        <ul className={LIST}>
          <li>Purchased credits are valid for 12 months from successful payment unless checkout clearly states a different legally permitted period.</li>
          <li>One credit is reserved when a paid detailed reading starts and is consumed only after the completed report passes required checks and is saved successfully.</li>
          <li>If generation fails, is blocked, is cancelled before delivery, or times out under the Service rules, the reserved credit is released or otherwise restored unless it has expired.</li>
          <li>Credits have no cash value, cannot be transferred between users, and cannot be resold.</li>
          <li>If you delete your account, unused credits are revoked as part of deletion and are not separately refundable unless these Terms or applicable law require otherwise.</li>
        </ul>
      </Section>

      <Section title="8. Checkout, payment, and taxes">
        <p className={BODY}>
          Purchases processed through Waffo Pancake use Waffo Pancake as the Merchant of Record and
          legal seller for the payment transaction. Waffo Pancake processes checkout and payment,
          calculates and collects applicable transaction taxes, issues payment records or receipts, and
          supports payment-related refunds and disputes as applicable. Its checkout terms and privacy
          notice also apply to information it processes.
        </p>
        <p className={BODY}>
          By completing checkout, you authorize the one-time charge shown there. You must provide
          accurate billing information and use a payment method that you are authorized to use. Quick I
          Ching does not receive or store your complete payment-card number.
        </p>
      </Section>

      <Section title="9. Refunds and billing corrections">
        <p className={BODY}>
          Because credits provide access to immediately delivered digital services, purchases are
          generally non-refundable after use. Our voluntary refund policy is:
        </p>
        <ul className={LIST}>
          <li>A completely unused credit purchase may be refunded if you request it within 7 days after purchase.</li>
          <li>Once any credit from that purchase has been consumed, the voluntary 7-day refund policy no longer applies to that purchase.</li>
          <li>Duplicate charges and confirmed billing errors are eligible for correction or refund.</li>
          <li>A failed or timed-out report generation should not consume a credit; the remedy is restoration or release of the credit rather than a cash refund.</li>
          <li>Nothing in this policy limits withdrawal, refund, repair, replacement, or other rights that cannot lawfully be excluded in your place of habitual residence.</li>
        </ul>
        <p className={BODY}>
          To request a refund or report a billing error, email support@quickiching.com from your account
          email and include the transaction or order identifier. We may request information reasonably
          necessary to verify the account and transaction. Eligible refunds are returned through the
          original payment method and remain subject to payment-network processing time.
        </p>
      </Section>

      <Section title="10. Quality review and replacement credits">
        <p className={BODY}>
          You may submit one quality-review request for a completed detailed reading within 7 days of
          delivery. You may provide one supplement within the available supplement window. A review may
          be approved where, for example, the report fails to use the submitted context, cites the wrong
          hexagram or changing lines, omits or truncates required sections, contains severe repetition or
          language defects, or reaches materially conflicting conclusions without explaining the
          conditions.
        </p>
        <p className={BODY}>
          Subjective dissatisfaction, disagreement with the interpretation, or a claim that a reading
          was not accurate does not by itself establish a quality defect. When a quality request is
          approved, the standard remedy is one replacement credit, not an automatic cash refund. This
          remedy does not limit rights that applicable law makes mandatory.
        </p>
      </Section>

      <Section title="11. Acceptable use">
        <p className={BODY}>You may not:</p>
        <ul className={LIST}>
          <li>use the Service for unlawful, fraudulent, harmful, abusive, or rights-infringing activity;</li>
          <li>present a reading as professional advice, a guaranteed prediction, or evidence of a factual outcome;</li>
          <li>attempt to bypass payments, credit rules, rate limits, safety controls, authentication, result integrity, or access controls;</li>
          <li>scrape, automate, reverse engineer, disrupt, probe, overload, or introduce malicious code into the Service except where law expressly permits;</li>
          <li>submit content designed to exploit, manipulate, or extract protected system instructions, security information, or another user&apos;s data;</li>
          <li>use the Service to harass, threaten, discriminate against, or make consequential decisions about another person without a lawful basis.</li>
        </ul>
      </Section>

      <Section title="12. Intellectual property">
        <p className={BODY}>
          The Service, software, interface, branding, original text, data structures, and related
          materials are owned by us or our licensors and are protected by applicable intellectual-
          property laws. The I Ching and historical public-domain materials are not claimed as our
          exclusive property. Subject to these Terms, we grant you a limited, personal, non-exclusive,
          non-transferable, revocable right to use the Service and your delivered reports for lawful
          personal purposes.
        </p>
      </Section>

      <Section title="13. Availability, changes, and third-party services">
        <p className={BODY}>
          We may maintain, modify, replace, suspend, or discontinue features. We do not promise that the
          Service will always be available, error-free, or compatible with every device. Availability
          may depend on infrastructure, authentication, email, payment, fraud-prevention, analytics, and
          AI providers outside our direct control. We will not materially reduce already purchased
          rights without providing an appropriate remedy where required by law.
        </p>
      </Section>

      <Section title="14. Suspension and termination">
        <p className={BODY}>
          We may restrict or suspend access where reasonably necessary to protect users or the Service,
          investigate abuse or fraud, comply with law or provider requirements, or enforce these Terms.
          We may terminate accounts for serious or repeated violations. You may request account deletion
          through the available account controls. Deletion consequences, including revocation of unused
          credits and retention of legally required transaction records, are described here and in the
          Privacy Policy.
        </p>
      </Section>

      <Section title="15. Disclaimers">
        <p className={BODY}>
          To the maximum extent permitted by law, the Service is provided on an &quot;as is&quot; and &quot;as
          available&quot; basis. We disclaim implied warranties of merchantability, fitness for a particular
          purpose, non-infringement, accuracy, and uninterrupted availability. We do not warrant any
          prediction, interpretation, recommendation, third-party service, or outcome. Some
          jurisdictions do not allow particular disclaimers, so those exclusions apply only to the
          extent lawful.
        </p>
      </Section>

      <Section title="16. Limitation of liability">
        <p className={BODY}>
          To the maximum extent permitted by law, Wang Yufei and Quick I Ching will not be liable for
          indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of
          profits, opportunity, goodwill, data, or business arising from the Service. Where liability
          cannot be excluded, our aggregate liability relating to the Service will not exceed the greater
          of the amount you paid to Quick I Ching during the 12 months before the event giving rise to
          the claim or USD 50.
        </p>
        <p className={BODY}>
          This section does not exclude or limit liability for fraud, wilful misconduct, death or
          personal injury caused by negligence, breach of mandatory consumer guarantees, or any other
          liability that cannot lawfully be excluded or limited.
        </p>
      </Section>

      <Section title="17. Mandatory consumer rights">
        <p className={BODY}>
          These Terms do not deprive you of mandatory consumer-protection rights available under the law
          of the country or region in which you habitually reside where those rights cannot be limited or
          excluded by contract. Where a provision conflicts with such a mandatory right, that provision
          applies only to the maximum extent permitted and the remaining Terms continue to apply.
        </p>
      </Section>

      <Section title="18. Governing law and disputes">
        <p className={BODY}>
          These Terms are governed by the laws of the People&apos;s Republic of China, without regard to
          conflict-of-law principles. This choice does not remove non-excludable rights or lawful forums
          available to consumers in their place of habitual residence.
        </p>
        <p className={BODY}>
          Before starting formal proceedings, please contact support@quickiching.com and make a
          reasonable attempt to resolve the dispute informally. Nothing in these Terms requires mandatory
          arbitration, waives a right that cannot lawfully be waived, or prevents a claim before a court
          or consumer-protection authority with lawful jurisdiction.
        </p>
      </Section>

      <Section title="19. Changes to these Terms">
        <p className={BODY}>
          We may update these Terms to reflect changes in the Service, providers, law, or risk controls.
          We will update the date above and, for a material change affecting existing users, provide
          reasonable advance notice through the Service or the registered email address, normally at
          least 14 days before the change takes effect unless urgent legal, security, fraud-prevention,
          or provider action requires a shorter period. Changes do not retroactively alter a completed
          transaction unless required by law.
        </p>
      </Section>

      <Section title="20. Contact">
        <div className={`${BODY} rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5`}>
          <p><strong className="text-[var(--ink)]">Operator:</strong> Wang Yufei</p>
          <p><strong className="text-[var(--ink)]">Country/region:</strong> China</p>
          <p>
            <strong className="text-[var(--ink)]">Support:</strong>{" "}
            <a className="underline underline-offset-4" href="mailto:support@quickiching.com">
              support@quickiching.com
            </a>
          </p>
          <p><strong className="text-[var(--ink)]">Website:</strong> https://quickiching.com</p>
        </div>
      </Section>
    </article>
  );
}
