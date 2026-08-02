# Quick I Ching Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Terms and Privacy pages with production-ready English legal pages aligned with Quick I Ching’s implemented credit, payment, AI, safety, deletion, and international-consumer model.

**Architecture:** Keep the legal pages as server-rendered Next.js App Router pages at stable public routes. Add a focused Vitest compliance test that reads the legal-page source and guards the critical operator, payment, refund, AI, analytics, deletion, and consumer-rights statements against accidental removal. Update the existing footer only with the verified support address; do not add a non-functional Cookie Settings control.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Vitest 3.

## Global Constraints

- Stable routes remain exactly `/terms` and `/privacy`.
- Operator is `Wang Yufei`, an individual operator in China.
- Support email is `support@quickiching.com`.
- Minimum age is 18.
- Paid products are one-time reading-credit purchases, not subscriptions.
- Current prices are USD 2.99 for 1 credit, USD 6.99 for 3 credits, and USD 9.99 for 5 credits.
- Credits expire 12 months after successful payment.
- Failed or timed-out generation must not consume a credit.
- A completely unused purchase may be refunded within 7 days; after any credit from that purchase is consumed, the voluntary 7-day refund no longer applies.
- Approved quality claims grant one replacement credit rather than an automatic cash refund.
- Waffo Pancake must be identified as the payment processor / merchant-of-record service used for checkout, taxes, receipts, refunds, and payment disputes as applicable.
- The governing-law clause uses the laws of the People’s Republic of China while preserving non-excludable rights in the user’s habitual residence.
- No mandatory arbitration, class-action waiver, or exclusive China-only jurisdiction clause.
- Google Analytics is optional analytics and must be described as loading only after consent when enabled.
- Microsoft Clarity is future-facing until actually enabled.
- Rejecting analytics must not block casting, authentication, purchase, report access, refunds, or account deletion.
- Draft labels, launch-gate placeholders, and claims not supported by the implementation must be removed.
- Do not add a Cookie Settings footer control until the corresponding consent UI exists.

---

### Task 1: Add legal-copy compliance tests

**Files:**
- Create: `src/app/legal-pages.test.ts`
- Test: `src/app/legal-pages.test.ts`

**Interfaces:**
- Consumes: UTF-8 source files `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, and `src/components/site-footer.tsx`.
- Produces: a Vitest regression gate for required legal copy and removal of draft language.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const terms = source("src/app/terms/page.tsx");
const privacy = source("src/app/privacy/page.tsx");
const footer = source("src/components/site-footer.tsx");

describe("public legal pages", () => {
  it("publishes the verified operator and support details", () => {
    for (const page of [terms, privacy]) {
      expect(page).toContain("Wang Yufei");
      expect(page).toContain("China");
      expect(page).toContain("support@quickiching.com");
    }
    expect(footer).toContain("support@quickiching.com");
  });

  it("states the implemented credit, payment, refund, and AI model", () => {
    expect(terms).toContain("Waffo Pancake");
    expect(terms).toContain("12 months");
    expect(terms).toContain("7 days");
    expect(terms).toContain("replacement credit");
    expect(terms).toContain("not a subscription");
    expect(terms).toContain("AI-generated");
  });

  it("states privacy, analytics-consent, and deletion boundaries", () => {
    expect(privacy).toContain("Waffo Pancake");
    expect(privacy).toContain("Google Analytics");
    expect(privacy).toContain("Microsoft Clarity");
    expect(privacy).toContain("optional analytics");
    expect(privacy).toContain("30 days");
    expect(privacy).toContain("24 hours");
    expect(privacy).toContain("do not sell");
  });

  it("removes launch-review placeholders", () => {
    expect(terms).not.toMatch(/draft|G-08 pending/i);
    expect(privacy).not.toMatch(/draft|launch review/i);
  });
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `bun run test -- src/app/legal-pages.test.ts`

Expected: FAIL because the existing placeholder pages do not contain the verified operator, Waffo, analytics-consent, and full refund/deletion copy.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/app/legal-pages.test.ts
git commit -m "test: define legal page compliance requirements"
```

---

### Task 2: Replace the Terms of Service page

**Files:**
- Modify: `src/app/terms/page.tsx`
- Test: `src/app/legal-pages.test.ts`

**Interfaces:**
- Consumes: approved legal-page design and current product constants from `src/domain/entitlements/pricing.ts`.
- Produces: a public `/terms` page with stable metadata and complete international consumer terms.

- [ ] **Step 1: Replace placeholder metadata and article copy**

Implement a semantic article with:

- title `Terms of Service`;
- last-updated date `August 2, 2026`;
- operator identity and support email;
- 18+ eligibility;
- service and AI disclosure;
- reflection-only / no professional advice boundary;
- accounts and security;
- casting and repeat-question restrictions;
- free features and one-time paid credits;
- current price disclosure and the statement that checkout pricing controls if a displayed price has been updated;
- Waffo Pancake checkout/payment role;
- 12-month expiry and successful-delivery consumption rule;
- 7-day completely-unused purchase refund policy;
- duplicate/incorrect charge handling;
- quality review and one replacement-credit remedy;
- user-content responsibilities;
- acceptable use;
- intellectual property;
- suspension and termination;
- service availability, disclaimers, and proportionate liability limits;
- mandatory consumer rights;
- PRC governing law with no exclusive forum restriction;
- informal support-first dispute process;
- material-change notice language;
- contact details.

Use existing CSS variables and readable Tailwind spacing. Keep the page server-rendered and dependency-free.

- [ ] **Step 2: Run the targeted test**

Run: `bun run test -- src/app/legal-pages.test.ts`

Expected: Terms-related assertions PASS; privacy-related assertions still FAIL.

- [ ] **Step 3: Commit Terms implementation**

```bash
git add src/app/terms/page.tsx
git commit -m "feat: publish complete terms of service"
```

---

### Task 3: Replace the Privacy Policy page

**Files:**
- Modify: `src/app/privacy/page.tsx`
- Test: `src/app/legal-pages.test.ts`

**Interfaces:**
- Consumes: approved retention, analytics-consent, payment, AI, authentication, and deletion design.
- Produces: a public `/privacy` page describing actual and conditional data processing without claiming Microsoft Clarity is currently active.

- [ ] **Step 1: Replace placeholder metadata and article copy**

Implement a semantic article with:

- title `Privacy Policy`;
- last-updated date `August 2, 2026`;
- data-controller identity and support address;
- scope and 18+ rule;
- categories of account, question, cast, reading, transaction, device, security, support, and cookie data;
- purposes and legal bases, including service delivery, contract, legitimate interests, consent, and legal obligations where applicable;
- AI-assisted processing disclosure and instruction not to submit unnecessary third-party or highly sensitive data;
- processor/service-provider disclosure for Waffo Pancake, Vercel, Neon, Better Auth / Google authentication, Resend, Cloudflare, and configured AI model infrastructure;
- explicit statement that Quick I Ching does not store full payment-card details;
- necessary-cookie versus optional-analytics-cookie explanation;
- Google Analytics conditional-use wording: only when enabled and after the required consent;
- Microsoft Clarity future-use wording: it may be added under the same optional analytics choice and the policy will be updated before activation;
- statement that rejecting analytics does not prevent core use;
- no sale of personal information and no advertising-cookie use in the MVP;
- international data-transfer safeguards;
- retention: active account/readings, 24-hour anonymous unrevealed state, immediate hiding plus up-to-30-day deletion/anonymisation window, and legally necessary payment/security records;
- user access, correction, deletion, objection, restriction, portability, consent withdrawal, and local-authority complaint rights as applicable;
- security caveat;
- material-change notice and contact details.

Avoid claiming a fixed analytics retention period until the provider configuration actually enforces it.

- [ ] **Step 2: Run the targeted test and verify it passes**

Run: `bun run test -- src/app/legal-pages.test.ts`

Expected: PASS.

- [ ] **Step 3: Commit Privacy implementation**

```bash
git add src/app/privacy/page.tsx
git commit -m "feat: publish complete privacy policy"
```

---

### Task 4: Add the verified support contact to the footer

**Files:**
- Modify: `src/components/site-footer.tsx`
- Test: `src/app/legal-pages.test.ts`

**Interfaces:**
- Consumes: verified support address `support@quickiching.com`.
- Produces: a public `mailto:` support contact next to the existing legal-page links.

- [ ] **Step 1: Add a support link without adding a dead Cookie Settings control**

Add this item to the Legal list:

```tsx
<li>
  <a href="mailto:support@quickiching.com" className={LINK}>
    Support
  </a>
</li>
```

Keep the current Privacy, Terms, Acceptable Use, and Help links. Do not create a Cookie Settings link until the consent component exists.

- [ ] **Step 2: Run the targeted test**

Run: `bun run test -- src/app/legal-pages.test.ts`

Expected: PASS.

- [ ] **Step 3: Commit footer contact**

```bash
git add src/components/site-footer.tsx
git commit -m "feat: expose verified support contact"
```

---

### Task 5: Verify the complete change

**Files:**
- Verify: `src/app/terms/page.tsx`
- Verify: `src/app/privacy/page.tsx`
- Verify: `src/components/site-footer.tsx`
- Verify: `src/app/legal-pages.test.ts`

**Interfaces:**
- Consumes: completed legal-page implementation.
- Produces: evidence that the legal-page work passes its own regression gate and does not introduce lint or type errors.

- [ ] **Step 1: Run the focused test**

Run: `bun run test -- src/app/legal-pages.test.ts`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `bun run lint`

Expected: PASS, or document an unrelated pre-existing failure with file and error details.

- [ ] **Step 3: Run TypeScript typecheck**

Run: `bun run typecheck`

Expected: the legal-page files and test introduce no errors. If the known Creem/Waffo migration errors remain, record them as pre-existing and unrelated.

- [ ] **Step 4: Run production build when repository health permits**

Run: `bun run build`

Expected: PASS if typecheck/build reaches the legal routes; otherwise document the same unrelated payment-migration blocker without claiming full build success.

- [ ] **Step 5: Review the public URLs after deployment**

Verify anonymously:

- `https://quickiching.com/terms`
- `https://quickiching.com/privacy`

Confirm they do not redirect to login, show draft language, or contain dead links.

- [ ] **Step 6: Final commit if verification requires minor fixes**

```bash
git add src/app/terms/page.tsx src/app/privacy/page.tsx src/components/site-footer.tsx src/app/legal-pages.test.ts
git commit -m "fix: finalize public legal pages"
```
