
import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/info-pages/legal-page-layout";

export const metadata: Metadata = {
  title: "Acceptable Use",
  description: "Boundaries for using Quick I Ching responsibly.",
  alternates: { canonical: "/acceptable-use" },
  robots: { index: false, follow: true },
};

export default function AcceptableUsePage() {
  return (
    <LegalPageLayout
      title="Acceptable Use"
      eyebrow="Trust"
      lead="Quick I Ching is built for reflection, not dependence or consequential certainty."
      sections={[]}
      intro={<>
        <ul>
          <li>Do not treat readings as medical, legal, financial, investment, emergency, or safety directives.</li>
          <li>Do not present a reading as proof that a future event must occur or that another person has committed an act, has a hidden motive, or has a health condition.</li>
          <li>Do not use repeated casting to manufacture anxiety, dependency, or pressure to continue consulting the tool.</li>
          <li>Do not attempt to compromise, overload, scrape at abusive scale, or bypass technical or safety controls.</li>
          <li>Do not submit or expose another person’s unnecessary private or confidential information.</li>
          <li>Do not use the service for harassment, coercion, fraud, discrimination, or other unlawful activity.</li>
        </ul>
        <p>If a real-world decision has serious consequences, use appropriate evidence and qualified professional support. An I Ching reading can remain a reflective framework without replacing those safeguards.</p>
      </>}
    />
  );
}
