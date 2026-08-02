# Quick I Ching Legal Pages Design

Date: 2026-08-02
Status: Approved for implementation planning

## 1. Objective

Replace the current placeholder legal pages with production-ready English Terms of Service and Privacy Policy for Quick I Ching, suitable for a consumer-facing international launch and Waffo merchant review.

The pages must be accurate to the repository’s implemented product model, use stable public URLs, remain readable without login, and avoid claiming systems or practices that are not actually implemented.

Stable URLs:

- `https://quickiching.com/terms`
- `https://quickiching.com/privacy`

## 2. Confirmed Operator Details

- Brand: Quick I Ching
- Operator: Wang Yufei
- Operator type: individual operator
- Country/region: China
- Support email: `support@quickiching.com`
- Minimum user age: 18

The legal pages will use the natural English form `Wang Yufei`. Identity verification records may continue to use the passport-style representation supplied to Waffo.

## 3. Commercial Model

Quick I Ching is a reflection tool based on the I Ching. It provides a free casting experience and optional paid AI-assisted detailed readings.

The paid model is one-time purchase of reading credits, not a subscription.

Current product configuration:

- 1 credit: USD 2.99
- 3 credits: USD 6.99
- 5 credits: USD 9.99
- Credits expire 12 months after successful payment
- One successful detailed reading consumes one credit
- Failed or timed-out generation does not consume a credit

Pricing remains server-authoritative. The legal pages must not hard-code behavior that contradicts the product configuration or payment implementation.

## 4. Refund and Quality-Compensation Policy

The Terms will state:

- A completely unused credit purchase may be refunded if requested within 7 days of purchase.
- Once any credit from the purchase has been consumed, the voluntary 7-day refund policy no longer applies.
- Duplicate or incorrect charges will be reviewed and corrected as required.
- Failed generation does not consume a credit.
- A completed reading may be submitted for quality review within the implemented review window.
- When a quality claim is approved, the remedy is one replacement credit rather than an automatic cash refund.
- Mandatory consumer rights in the user’s place of habitual residence remain unaffected where they cannot lawfully be excluded.

The wording must not promise a response time, supplementation window, or review remedy that differs from the repository’s implemented workflow.

## 5. Governing Law and Disputes

The Terms will use the laws of the People’s Republic of China as the base governing law, without attempting to exclude mandatory consumer protections that apply in the user’s country or region.

The Terms will require a reasonable attempt to resolve disputes through `support@quickiching.com` before formal proceedings, but will not include:

- mandatory arbitration;
- class-action waiver;
- exclusive China-only court jurisdiction;
- waiver of non-excludable consumer rights.

## 6. Terms of Service Structure

The Terms page will include:

1. Acceptance of the Terms
2. Operator identity and contact details
3. Eligibility and 18+ age requirement
4. Description of the Service
5. AI-generated content disclosure
6. Reflection-only and no-professional-advice disclaimer
7. Accounts, authentication, and account security
8. Casting rules and repeat-question controls
9. Free features and paid detailed readings
10. One-time reading credits and no subscription
11. Prices, taxes, checkout, and payment processing
12. Waffo Pancake payment role
13. Credit validity and consumption
14. Failed generation and entitlement handling
15. Refund policy
16. Quality review and replacement-credit remedy
17. User-submitted content and privacy responsibilities
18. Acceptable use and prohibited conduct
19. Intellectual property
20. Service changes, suspension, and termination
21. Disclaimers
22. Limitation of liability subject to applicable law
23. Mandatory consumer rights
24. Governing law and informal dispute resolution
25. Changes to the Terms
26. Contact information

## 7. Privacy Policy Structure

The Privacy Policy will include:

1. Identity of the data controller
2. Scope of the policy
3. Categories of data collected
4. Questions, context, casts, hexagrams, and readings
5. Account and authentication data
6. Device, IP, security, abuse-prevention, and operational logs
7. Order, refund, dispute, and limited payment metadata
8. Statement that full payment-card details are not stored by Quick I Ching
9. Purposes and legal bases for processing
10. AI-assisted generation and model-provider processing
11. Waffo Pancake payment processing
12. Infrastructure and service providers, including Vercel, Neon, Resend, Google authentication, and Cloudflare where applicable
13. Google Analytics, only when enabled and only under the documented consent model
14. Microsoft Clarity as a possible future analytics provider, not described as active until actually enabled
15. Necessary cookies versus optional analytics cookies
16. Confirmation that rejecting analytics does not block core product use
17. International data transfers
18. Retention and deletion
19. User rights and regional privacy rights
20. No sale of personal information
21. Children and the 18+ rule
22. Security measures
23. Policy changes
24. Contact information

## 8. Cookie and Analytics Design

Core service access must not depend on acceptance of analytics cookies.

Categories:

- Necessary: authentication, session continuity, security, abuse prevention, checkout, and requested service delivery.
- Analytics: Google Analytics and, if later enabled, Microsoft Clarity.

Consent behavior to be implemented separately from the legal-page copy:

- Before consent, analytics scripts are not loaded.
- Rejecting analytics does not affect casting, login, purchase, report access, refunds, or account deletion.
- Accepting analytics permits the configured analytics tools to load.
- A persistent `Cookie Settings` control allows users to change their choice.
- Advertising and personalized-advertising cookies are not enabled in the MVP.

The Privacy Policy must match the actual deployment state. If Google Analytics is not enabled when the legal pages ship, the wording must describe it as a service that will be used only after consent once enabled. Microsoft Clarity must remain explicitly future-facing until activated.

## 9. Retention and Deletion

The policy will align with implemented behavior:

- Active account and retained readings: kept while the account remains active and the user has not deleted the relevant content.
- User-deleted readings: hidden immediately and permanently deleted after the implemented recovery window, currently up to 30 days.
- Account deletion: access is disabled promptly; associated content is deleted or irreversibly anonymized after the implemented 30-day cleanup window, subject to legally required records.
- Anonymous unrevealed casting state: retained for no longer than the implemented 24-hour window.
- Payment, refund, dispute, fraud-prevention, tax, and accounting records: retained only as reasonably required for legal, financial, and dispute-handling obligations.
- Security and operational logs: retained only for a reasonable period necessary to protect the service, investigate incidents, and prevent abuse.
- Google Analytics retention: the target configuration is 14 months once enabled.

No fixed retention period may be stated unless the application or provider configuration actually enforces it.

## 10. User Interface and Accessibility

Existing routes and visual language will be preserved.

Files expected to change:

- `src/app/terms/page.tsx`
- `src/app/privacy/page.tsx`
- `src/components/site-footer.tsx`

Requirements:

- Pages render without authentication.
- Headings are semantically structured.
- Long sections remain readable on mobile and desktop.
- Footer links to Terms and Privacy remain stable.
- Footer includes the support email.
- A `Cookie Settings` entry may be included only if the corresponding control exists; otherwise it must not be a dead link or non-functional control.
- Draft language and launch-gate placeholders are removed.

## 11. Verification

Implementation verification must include:

- confirm both routes render without login;
- confirm operator, country, support email, age, prices, credit validity, refund rules, and data-deletion statements match the repository;
- confirm Waffo Pancake is named consistently in both relevant sections;
- confirm no claim says Microsoft Clarity is active unless it is actually enabled;
- confirm no claim says analytics can be rejected while scripts still load before consent;
- run formatting, lint, typecheck, targeted tests, and production build where repository health permits;
- document any unrelated pre-existing failures rather than presenting them as caused by the legal-page changes.

## 12. Non-Goals

This work does not:

- provide formal legal advice or replace review by qualified counsel;
- register a foreign company;
- create region-specific legal notices for every US state or EU member state;
- implement Google Analytics or Microsoft Clarity itself unless separately approved;
- implement a complete consent-management platform as part of the legal-copy change;
- modify the payment provider integration beyond accurately describing it.
