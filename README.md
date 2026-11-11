# Quick I Ching

Quick I Ching is a production **I Ching online** application with four casting methods, bilingual English / Simplified Chinese public reading content, free hexagram interpretation, and capability-gated account, credit, checkout, and Deep Reading features.

**Live website:** https://www.quickiching.com

## What Quick I Ching does

- Cast an I Ching reading with the Three-Coin, Yarrow Stalk, Mei Hua Yi Shu, or Manual Cast method.
- Show the complete six-line hexagram, primary hexagram, changing lines, and relating hexagram when moving lines exist.
- Provide an original free basic interpretation of the cast without sending the free reading to an AI provider.
- Publish guides plus a 64-hexagram reference library in English and Simplified Chinese.
- Provide account-backed My Readings, one-time Deep Reading credit packs, checkout, and personalized Deep Reading surfaces when their production capabilities are enabled.

## Public casting methods

1. `/` and `/methods/three-coin` — Three-Coin Method
2. `/methods/yarrow-stalks` — Yarrow Stalk Method
3. `/methods/mei-hua-yi-shu` — Mei Hua Yi Shu Gregorian current-time adaptation
4. `/methods/manual-cast` — deterministic Manual Cast

All four free methods use the same shared King Wen mapping and primary / relating hexagram computation.

The free interpretation explains the cast itself. It does not use the user's private situation as model input and does not require sign-in, payment, credits, a production database, or an AI request.

## Public knowledge and SEO surfaces

English public content includes:

- `/`
- four casting-method pages
- three I Ching guides
- `/hexagrams`
- 64 fixed hexagram detail pages

Simplified Chinese provides an equivalent public set under `/zh`.

The route registry currently exposes **73 English + 73 Simplified Chinese indexable URLs = 146 canonical indexable URLs**. Equivalent English / Chinese pages emit canonical and bidirectional `hreflang` metadata.

The canonical production host is:

`https://www.quickiching.com`

Homepage primary search intent:

`i ching online`

Legacy near-synonym routes use permanent redirects to the relevant canonical page rather than creating duplicate doorway pages.

Commercial, account, reading-result, and other private utility surfaces are excluded from the public SEO sitemap or marked non-indexable as appropriate.

## Reading and account surfaces

- Free reading results use the unified private result experience.
- `/my-readings` is the account-backed reading history surface and requires an authenticated user.
- Account, sign-in, pricing, purchase-return, and reading-management surfaces have English and Simplified Chinese counterparts where implemented.
- The former browser-only `/history` description is no longer the current account-history model.

## Deep Reading

Deep Reading is the paid, situation-aware interpretation product. It connects a frozen core question and user-supplied context to the exact cast and cited I Ching source material.

The current product contract is method-independent: Three-Coin, Yarrow Stalk, Mei Hua Yi Shu, and Manual Cast can enter the same Deep Reading flow when the reading has the required locked question, complete deterministic cast facts, persisted ownership, risk clearance, available credit, and enabled commercial capabilities.

Deep Reading generation is server-side and fail-closed. A successful reading consumes a reserved credit only after successful completion; failed or timed-out generation releases the reservation.

Production availability is controlled by server-side capability resolution. Repository implementation, UI presence, or a green readiness check does not by itself prove that a live commercial provider capability is enabled.

## Pricing and payments

Quick I Ching implements one-time Deep Reading credit packs and a formal pricing / purchase flow.

Checkout availability is capability-gated. When checkout is disabled or its required provider configuration is invalid, the product remains unavailable rather than falling back to an unsafe payment path.

Waffo is the approved payment integration for the current one-time credit-pack implementation. Provider payment state, amount, currency, entitlement grant, refund eligibility, and refund settlement remain server-authoritative.

Operational payment rules are documented in `docs/PAYMENT_CLOSEOUT_RUNBOOK.md`.

## Trust and safety

Public readings are framed as reflection rather than deterministic prediction and are not medical, legal, financial, or safety advice.

Risk checks and commercial eligibility are handled before paid generation. A blocked or insufficient-context Deep Reading must not create a generation job or consume a credit.

## Domain architecture

Shared pure casting logic lives under `src/domain/casting`, including:

- Three-Coin
- Yarrow Stalk
- Mei Hua Yi Shu
- shared hexagram computation
- King Wen mapping

Browser randomness is adapted through Web Crypto rather than `Math.random()`.

Original free interpretation content lives under `src/domain/interpretation`.

Casting-algorithm and content provenance are documented in:

- `docs/PUBLIC_SEO_V1_PROVENANCE.md`
- `docs/PUBLIC_READING_CLASSICAL_PROVENANCE.md`

## Stack

- Bun 1.3.14
- Next.js 15.5.25 App Router
- React 19.0.8
- TypeScript
- Tailwind CSS v4
- Vitest
- Better Auth 1.7.1
- Drizzle ORM 0.45.x + PostgreSQL
- AI SDK
- Waffo Pancake TS 0.19.1
- Vercel Workflow 4.8.5

## Deployment and capability model

Vercel is the production deployment target.

`vercel.json` enables Git deployments for `main` and `staging`, installs with Bun 1.3.14 using the frozen lockfile, builds with `bun run build`, and schedules `/api/internal/reconcile` daily.

Commercial production behavior is controlled by the server-side capability system in `src/server/capabilities.ts`.

Current commercial capabilities are:

- `auth`
- `checkout`
- `webhookIngestion`
- `paidDeepReading`
- `reconcile`

Missing, disabled, or invalid capability requirements fail closed.

## Local verification

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
bun run verify:classical-sources
bun run indexnow
```

`bun run indexnow` is dry-run first. Production submission should only be used under the repository's release and audit controls.

CI additionally selects and runs targeted database, reading, public SEO, account/info, payment, hexagram-detail, and performance gates based on the changed files.

## Sources of truth

- Product requirements: `docs/PRD.md`
- Technical design: `docs/技术设计文档.md`
- Localized public route registry: `src/i18n/routes.ts`
- Commercial capability resolution: `src/server/capabilities.ts`
- Payment operations: `docs/PAYMENT_CLOSEOUT_RUNBOOK.md`
- Public casting provenance: `docs/PUBLIC_SEO_V1_PROVENANCE.md`
- Classical reading provenance: `docs/PUBLIC_READING_CLASSICAL_PROVENANCE.md`
- Dependency versions and scripts: `package.json`
- Production deployment contract: `vercel.json`
- CI gates: `.github/workflows/ci.yml`

Executable configuration and current code control live runtime behavior. Product and technical documents define the intended contracts but do not override current capability resolution or deployment state.

## License

This repository does not currently grant an open-source license for the Quick I Ching application source code, first-party interpretation content, or first-party project assets.

Third-party libraries, classical source material, fonts, and other external assets remain subject to their respective licenses, provenance requirements, terms, and notices.
