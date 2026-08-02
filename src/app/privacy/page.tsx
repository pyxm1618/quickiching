import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Quick I Ching collects, uses, shares, retains, and protects personal information.",
  alternates: { canonical: "/privacy" },
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

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--bronze)]">
        Legal
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">Last updated: August 2, 2026</p>

      <p className={BODY}>
        This Privacy Policy explains how Wang Yufei, an individual operator based in China and doing
        business as Quick I Ching (&quot;Quick I Ching,&quot; &quot;we,&quot; &quot;us,&quot; or
        &quot;our&quot;), collects, uses, shares, retains, and protects personal information when you use
        quickiching.com and its related services (the &quot;Service&quot;).
      </p>
      <p className={BODY}>
        This Policy should be read with our <Link className="underline underline-offset-4" href="/terms">Terms of Service</Link>.
        The Service is intended only for people who are at least 18 years old.
      </p>

      <Section title="1. Data controller and contact">
        <p className={BODY}>
          Wang Yufei is the data controller for personal information processed to operate Quick I
          Ching, except where a third-party provider acts as an independent controller for its own
          services. Privacy and data-rights requests may be sent to support@quickiching.com.
        </p>
      </Section>

      <Section title="2. Information we collect">
        <h3 className="mt-6 font-semibold">Account and authentication information</h3>
        <ul className={LIST}>
          <li>email address, internal user identifier, account status, and account timestamps;</li>
          <li>authentication provider and limited profile information returned when you choose Google sign-in;</li>
          <li>magic-link verification records, session identifiers, and security information needed to sign you in and protect the account.</li>
        </ul>
        <p className={BODY}>
          Quick I Ching does not ask you to create a conventional account password when you use magic
          links or supported third-party sign-in.
        </p>

        <h3 className="mt-6 font-semibold">Questions, castings, and readings</h3>
        <ul className={LIST}>
          <li>the life area, interpretation goal, question, and context you choose to submit;</li>
          <li>casting method, coin or method steps, line values, hexagrams, changing lines, timestamps, and lifecycle status;</li>
          <li>free previews, paid detailed readings, model and prompt-version metadata, automated validation results, and report status;</li>
          <li>history, deletion, restoration, and account-association records needed to provide the requested features.</li>
        </ul>
        <p className={BODY}>
          Questions may contain sensitive personal context. Submit only information that is necessary
          for your request, and do not include another person&apos;s confidential information without a
          lawful basis.
        </p>

        <h3 className="mt-6 font-semibold">Purchases and entitlement information</h3>
        <ul className={LIST}>
          <li>product, credit quantity, price, currency, order and transaction identifiers, payment status, timestamps, and credit balance;</li>
          <li>refund, dispute, chargeback, webhook, reconciliation, and fraud-prevention records;</li>
          <li>limited billing information returned by the payment provider, such as country or payment-method type, where available.</li>
        </ul>
        <p className={BODY}>
          Quick I Ching does not receive or store your complete payment-card number, card security code,
          or full payment credentials. Card and checkout data are processed by Waffo Pancake and its
          payment partners.
        </p>

        <h3 className="mt-6 font-semibold">Support and quality-review information</h3>
        <ul className={LIST}>
          <li>support emails, feedback, refund requests, transaction references, and correspondence;</li>
          <li>quality-review reasons, supplements, review status, and any replacement credit granted.</li>
        </ul>

        <h3 className="mt-6 font-semibold">Technical, security, and usage information</h3>
        <ul className={LIST}>
          <li>IP address, browser and device information, time zone, language, referring page, request timestamps, and application logs;</li>
          <li>session, anti-abuse, rate-limit, integrity, authentication, and fraud-prevention signals;</li>
          <li>Cloudflare Turnstile results and related technical data used to distinguish legitimate requests from automated abuse;</li>
          <li>page and feature usage information when optional analytics has been accepted and the relevant analytics tool is enabled.</li>
        </ul>
      </Section>

      <Section title="3. Why we use information">
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="bg-[var(--paper-raised)] text-[var(--ink)]">
              <tr>
                <th className="border-b border-[var(--line)] px-4 py-3 font-semibold">Purpose</th>
                <th className="border-b border-[var(--line)] px-4 py-3 font-semibold">Typical legal basis</th>
              </tr>
            </thead>
            <tbody className="text-[var(--muted)]">
              <tr><td className="border-b border-[var(--line)] px-4 py-3">Create accounts, perform castings, generate and save readings, and manage credits</td><td className="border-b border-[var(--line)] px-4 py-3">Performance of our contract and steps you request</td></tr>
              <tr><td className="border-b border-[var(--line)] px-4 py-3">Process payments, refunds, disputes, receipts, and tax obligations</td><td className="border-b border-[var(--line)] px-4 py-3">Contract and legal obligations</td></tr>
              <tr><td className="border-b border-[var(--line)] px-4 py-3">Secure accounts, prevent abuse and fraud, validate results, and investigate incidents</td><td className="border-b border-[var(--line)] px-4 py-3">Legitimate interests and legal obligations</td></tr>
              <tr><td className="border-b border-[var(--line)] px-4 py-3">Respond to support, deletion, refund, and quality-review requests</td><td className="border-b border-[var(--line)] px-4 py-3">Contract, legitimate interests, and legal obligations</td></tr>
              <tr><td className="px-4 py-3">Run optional product analytics</td><td className="px-4 py-3">Consent where required</td></tr>
            </tbody>
          </table>
        </div>
        <p className={BODY}>
          Legal bases vary by location. Where consent is the basis, you may withdraw it without
          affecting processing that occurred before withdrawal. We do not use analytics consent as a
          condition for accessing the core Service.
        </p>
      </Section>

      <Section title="4. AI-assisted generation">
        <p className={BODY}>
          To generate a preview or detailed reading, we may send the question, relevant context, casting
          result, and structured instructions to AI model infrastructure, including Vercel AI Gateway
          and configured model providers such as OpenAI. We also process generated text through
          validation and review steps intended to enforce format, safety, and hexagram-reference rules.
        </p>
        <p className={BODY}>
          We do not intentionally use your private question content to train our own general-purpose AI
          models, and we do not authorize service providers to use it for unrelated advertising. AI
          providers process information under their applicable service and data-protection terms. Avoid
          submitting government identifiers, financial account credentials, medical records, or other
          information that is not necessary for a reflective reading.
        </p>
      </Section>

      <Section title="5. Service providers and disclosures">
        <p className={BODY}>
          We disclose information only as reasonably necessary for the Service, for a transaction or
          request you initiate, to protect rights and security, or to comply with law. Categories of
          recipients may include:
        </p>
        <ul className={LIST}>
          <li><strong className="text-[var(--ink)]">Waffo Pancake:</strong> Merchant of Record, checkout, payment, tax, receipt, refund, and payment-dispute processing. Waffo Pancake receives payment and billing information directly; full card data is not stored on Quick I Ching servers.</li>
          <li><strong className="text-[var(--ink)]">Vercel:</strong> application hosting, deployment, workflow, AI Gateway, and related infrastructure.</li>
          <li><strong className="text-[var(--ink)]">Neon and database infrastructure:</strong> managed PostgreSQL storage and database operations.</li>
          <li><strong className="text-[var(--ink)]">Resend:</strong> delivery of sign-in links and essential service email.</li>
          <li><strong className="text-[var(--ink)]">Google:</strong> Google account authentication when selected by the user, and Google Analytics only under the optional analytics rules below when enabled.</li>
          <li><strong className="text-[var(--ink)]">Microsoft:</strong> Microsoft Clarity for consented heatmaps, session recordings, and usability analysis under the optional analytics rules below.</li>
          <li><strong className="text-[var(--ink)]">Cloudflare:</strong> DNS, network protection, Turnstile, and abuse-prevention services where configured.</li>
          <li><strong className="text-[var(--ink)]">AI model providers:</strong> generation and automated review of requested reading content.</li>
          <li><strong className="text-[var(--ink)]">Professional advisers and authorities:</strong> where reasonably necessary for legal, accounting, security, fraud, dispute, or regulatory purposes.</li>
        </ul>
        <p className={BODY}>
          We may also transfer information in connection with a merger, financing, acquisition, sale,
          or reorganization, subject to appropriate notice and continued protection. We do not disclose
          your question text to unrelated advertisers.
        </p>
      </Section>

      <Section title="6. Cookies and optional analytics">
        <p className={BODY}>
          Necessary storage and similar technologies support authentication, session continuity,
          security, fraud prevention, checkout, load balancing, and delivery of features you request.
          These technologies are required for the relevant function and cannot always be disabled while
          that function is in use.
        </p>
        <p className={BODY}>
          Analytics is optional. Google Analytics and Microsoft Clarity load only after the required
          analytics consent has been obtained under the site&apos;s consent controls. Before consent, or
          after analytics is rejected or withdrawn, the basic implementation does not load either
          analytics tag for that visitor.
        </p>
        <p className={BODY}>
          When accepted, Google Analytics measures page and feature usage. Microsoft Clarity may create
          heatmaps and session recordings to help identify usability problems. Clarity&apos;s project is
          configured not to set cookies by default; the site sends analytics-storage consent only after
          acceptance, while advertising storage remains denied.
        </p>
        <p className={BODY}>
          We apply explicit Clarity masking to question context, sign-in and account information,
          casting results, generated previews and readings, and order status. Masked content is not
          intended to be uploaded to Clarity. These controls supplement, rather than replace, the rule
          that private question text, email, reading content, authentication secrets, and payment details
          must not be sent as analytics events.
        </p>
        <p className={BODY}>
          Rejecting or withdrawing analytics does not prevent you from casting, signing in, purchasing
          credits, viewing reports, requesting refunds, exercising privacy rights, or deleting your
          account. We do not currently use advertising cookies or personalized-advertising profiles.
        </p>
      </Section>

      <Section title="7. No sale of personal information">
        <p className={BODY}>
          We do not sell your personal information. We also do not share personal information for
          cross-context behavioural advertising as those terms are defined by applicable US state
          privacy laws. Service-provider processing for hosting, security, payment, authentication,
          email, requested AI generation, and consented analytics is not a sale by Quick I Ching.
        </p>
      </Section>

      <Section title="8. International data transfers">
        <p className={BODY}>
          Quick I Ching is operated from China and uses providers that may process information in the
          United States, Singapore, Europe, and other countries. Those countries may have privacy laws
          different from the laws where you live. Where required, we use provider agreements and other
          lawful safeguards that may include standard contractual clauses, transfer assessments,
          contractual confidentiality, security controls, or an applicable adequacy mechanism.
        </p>
      </Section>

      <Section title="9. Retention, deletion, and anonymisation">
        <p className={BODY}>
          We keep information only for as long as reasonably necessary for the purposes described in
          this Policy, including the following operational periods:
        </p>
        <ul className={LIST}>
          <li><strong className="text-[var(--ink)]">Anonymous unrevealed casting state:</strong> no longer than the applicable completion or reveal window, currently up to 24 hours, after which it expires unless law or security needs require limited records.</li>
          <li><strong className="text-[var(--ink)]">Active account and retained readings:</strong> while the account remains active and until you delete the relevant reading or account, subject to operational and legal needs.</li>
          <li><strong className="text-[var(--ink)]">A reading you delete:</strong> hidden from normal account access promptly and scheduled for permanent deletion after a recovery window of up to 30 days. Restoration may be available only during that window.</li>
          <li><strong className="text-[var(--ink)]">Account deletion:</strong> active sessions and authentication access are removed promptly, the account email is pseudonymised, unused credits are revoked, and associated question, casting, reading, and product-event content is scheduled for deletion or irreversible anonymisation after up to 30 days.</li>
          <li><strong className="text-[var(--ink)]">Payments and compliance:</strong> limited order, ledger, refund, dispute, fraud, tax, accounting, and audit records may be retained after account deletion for the period required or reasonably necessary to satisfy legal obligations, prove transactions, prevent abuse, and resolve disputes. Unnecessary question text is not retained in those financial records.</li>
          <li><strong className="text-[var(--ink)]">Security and operational logs:</strong> retained for a reasonable period proportionate to incident investigation, integrity, fraud prevention, reliability, and legal needs.</li>
          <li><strong className="text-[var(--ink)]">Analytics:</strong> retained according to the configured provider settings and your consent status. We will not state a fixed provider retention period unless that configuration is actually enforced.</li>
        </ul>
        <p className={BODY}>
          Deletion from active systems may not immediately remove encrypted backups. Backup data is
          isolated from normal use and is deleted or overwritten under the applicable backup lifecycle,
          unless preservation is legally required.
        </p>
      </Section>

      <Section title="10. Your privacy rights">
        <p className={BODY}>
          Depending on where you live, you may have rights to request access, correction, deletion,
          restriction, objection, portability, or a copy of personal information; to withdraw consent;
          and to appeal or complain to a competent privacy or consumer-protection authority. These rights
          can be subject to identity verification, legal exceptions, technical limits, and the rights of
          others.
        </p>
        <p className={BODY}>
          Account and individual-reading deletion controls may be available directly in the Service. For
          other requests, email support@quickiching.com from your account address and describe the right
          you wish to exercise. We will respond within the period required by applicable law and will not
          discriminate against you for exercising a protected privacy right.
        </p>
      </Section>

      <Section title="11. Security">
        <p className={BODY}>
          We use measures designed to protect information, including HTTPS, access controls, protected
          production secrets, hashing or pseudonymisation for selected identifiers, encryption for
          sensitive question content and generation snapshots, integrity checks, rate limits, and audit
          records. No online system is completely secure. You are responsible for protecting access to
          your email account, sign-in links, and devices.
        </p>
      </Section>

      <Section title="12. Children">
        <p className={BODY}>
          The Service is not intended for anyone under 18, and we do not knowingly collect personal
          information from a person under 18. If you believe a minor has provided information, contact
          support@quickiching.com so that we can investigate and take appropriate deletion steps.
        </p>
      </Section>

      <Section title="13. Third-party links and independent services">
        <p className={BODY}>
          The Service may link to or integrate with third-party services. Their own terms and privacy
          notices govern information they collect as independent controllers. Review those notices
          before providing information directly to them.
        </p>
      </Section>

      <Section title="14. Changes to this Policy">
        <p className={BODY}>
          We may update this Policy to reflect changes in the Service, providers, data practices, or law.
          We will update the date above and, for material changes affecting existing users, provide
          reasonable advance notice through the Service or registered email, normally at least 15 days
          before the change takes effect unless urgent legal or security action requires a shorter
          period. Where consent is required for a new purpose, we will request it before that processing.
        </p>
      </Section>

      <Section title="15. Contact us">
        <div className={`${BODY} rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5`}>
          <p><strong className="text-[var(--ink)]">Data controller:</strong> Wang Yufei</p>
          <p><strong className="text-[var(--ink)]">Country/region:</strong> China</p>
          <p>
            <strong className="text-[var(--ink)]">Privacy and support email:</strong>{" "}
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
