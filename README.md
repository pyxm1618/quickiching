# Quick I Ching

Quick I Ching is an online I Ching platform with multiple casting methods. The repository contains the **credential-free Public SEO V1** and a separate, deployment-gated **paid Deep Reading** product.

## Current launch stage: Public SEO V1

The first Google + Bing indexing release is intentionally independent of production auth, database, AI, and payment credentials.

### SEO position

- Homepage primary keyword / intent: **`i ching online`**
- Homepage default tool: **Three-Coin Method**
- Canonical production origin: **`https://www.quickiching.com`**
- One primary intent = one canonical URL; near-synonym doorway pages are redirected rather than duplicated.

### Public V1 casting methods

1. `/` and `/methods/three-coin` — Three-Coin Method
2. `/methods/yarrow-stalks` — Yarrow Stalk Method
3. `/methods/mei-hua-yi-shu` — Mei Hua Yi Shu current-time casting
4. `/methods/manual-cast` — deterministic Manual Cast

All four free flows end with:

- complete six-line hexagram;
- primary hexagram number/name;
- changing-line positions;
- relating hexagram when moving lines exist;
- original free basic interpretation;
- reflection / non-deterministic / non-professional-advice boundary.

Completed readings can be saved explicitly to browser-only `/history/`; no account or cloud sync is involved in the free flow. Free interpretation explains the cast itself and never calls AI. Paid Deep Reading is a separate, server-gated Three-Coin product that relates a frozen core question and user-supplied context to the exact cast and cited I Ching material.

No sign-in, payment, credit, database, or production AI call is required for the free flow. Production Deep Reading, checkout, and account availability remain deployment-controlled and require live acceptance evidence.

### Public knowledge pages

- `/guides/how-to-ask-the-i-ching`
- `/guides/changing-lines`
- `/guides/primary-relating-hexagrams`
- `/hexagrams` — 64 Hexagrams hub
- `/hexagrams/[fixed-slug]` — 64 fixed entity pages with six line anchors

### Simplified Chinese public coverage

- `/zh` — 中文首页
- `/zh/methods/*` — 4 个公开起卦方法页
- `/zh/guides/*` — 3 个公开指南页
- `/zh/hexagrams` — 中文六十四卦目录
- `/zh/hexagrams/[fixed-slug]` — 64 个中文卦象详情页
- `src/i18n/routes.ts` 是公开本地化路由的事实源；当前共有 73 个英文与 73 个简体中文可索引 URL，共 146 个，等价页面提供 canonical 与双向 `hreflang`。

### Technical SEO

- `www.quickiching.com` is the canonical host.
- Legacy intent URLs use permanent redirects to their relevant canonical pages.
- Obsolete account/checkout routes do not soft-redirect to the homepage.
- `/sitemap.xml` lists only canonical indexable Public V1 pages.
- `/robots.txt` references the production sitemap.
- The sitemap inventory contains 146 canonical indexable URLs: 73 English and 73 Simplified Chinese; equivalent pages emit canonical and bidirectional `hreflang` metadata.
- IndexNow is implemented as a dry-run-first CLI; **do not use `--submit` before independent final audit approval**.

```bash
bun run indexnow
```

## Deep Reading product boundary

Public SEO V1 remains independent of commercial credentials and does not require a paid account to cast, read, or save a reading locally. The separate Three-Coin Deep Reading product is server-gated by the current deployment capabilities and account entitlement.

- **Free:** complete general interpretation of the cast. Free flows never call AI or send the question to an AI provider.
- **Paid Deep Reading:** connects the frozen question, user-supplied situation, exact Three-Coin cast, and cited I Ching source material. It requires sufficient context, a passing risk check, sign-in, and an available credit.

After all six lines are safely saved, the browser opens the unified result page directly. That page shows the free cast interpretation and places the situation-based Deep Reading experience before the longer free details. Yarrow, Mei Hua, and Manual Cast remain fully available as free methods; Deep Reading currently supports Three-Coin only.

Whether paid generation, checkout, and production account flows are enabled still depends on deployment configuration and live provider acceptance. Repository implementation and a green readiness endpoint do not prove production availability.

## Domain architecture

Shared pure domain logic lives under `src/domain/casting`:

- `three-coin/algorithm.ts`
- `yarrow/algorithm.ts`
- `mei-hua/algorithm.ts`
- `hexagrams/compute.ts`
- `hexagrams/king-wen.ts`

Browser-only randomness is adapted through `src/lib/browser-random.ts` using Web Crypto. Public UI components call the shared domain functions rather than maintaining separate casting formulas.

Original free interpretation content lives in `src/domain/interpretation/basic.ts`.

Algorithm/content provenance and the exact Yarrow + Mei Hua conventions are documented in `docs/PUBLIC_SEO_V1_PROVENANCE.md`.

## Stack

- Bun 1.3.14
- Next.js 15.5.25 App Router
- React 19.0.8
- TypeScript
- Tailwind CSS v4
- Vitest
- Better Auth 1.7.1 for deployment-gated production auth
- Drizzle ORM 0.45.x + PostgreSQL for deployment-gated commercial persistence
- Waffo Pancake TS 0.19.1 for deployment-gated one-time credit-pack payments

## Deployment and commercial capability contract

Vercel is the production deployment target. `vercel.json` enables Git deployments for `main` and `staging`, installs with Bun 1.3.14 using the frozen lockfile, builds with `bun run build`, and schedules `/api/internal/reconcile` daily.

Commercial V2 is controlled only by server-side capability resolution. The current capability set is `auth`, `checkout`, `webhookIngestion`, `paidDeepReading`, and `reconcile`. Missing/false capability flags remain disabled, invalid configuration fails closed, and implementation presence alone does not prove that a production capability is live.

## Local quality commands

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
bun run verify:classical-sources  # fixed Wikisource oldid check; requires network
bun run indexnow        # dry-run only
```

The paid Deep Reading implementation remains deployment-gated. See `docs/PRD.md` and `docs/技术设计文档.md` for its product and service contracts.
