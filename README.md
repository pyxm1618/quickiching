# Quick I Ching — Multi-Method Divination Web App (MVP)

A production-shaped, **runnable MVP** of the I Ching (易经) divination product described in
`docs/PRD.md` (v2.1) and `docs/技术设计文档.md` (v2.1), built for the US English market.

> The MVP runs **fully offline** with deterministic, fail-closed stand-ins for every
> human-gated launch dependency (domain advisor sign-off, legal, payments merchant,
> licensed classic texts, AI provider). See **Launch Blockers** below — those are
> deliberately *not* faked.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (`strict`)
- **Tailwind CSS v4** (theme tokens for light/dark) + shadcn-style UI primitives
- **Domain-driven core** (pure, framework-free, fully unit-tested)
- **In-memory repository** with invariants enforced (single-process mutex)
- **Server Actions** for every mutation; Server Components for pages
- **Vitest** for domain and server-boundary regression tests

## What's implemented (faithful to PRD)

| Area | Status | Notes |
|------|--------|-------|
| Three casting methods | ✅ | Three-Coin (v1), Yarrow Stalk (v1, 49 stalks / 3 changes per line / conservation), Mei Hua current-time (Shao Yong + 12-branch hour + 子时 rollover) |
| Hexagram engine | ✅ | 64 King Wen hexagrams, primary + relating computation, changing lines (6/7/8/9) |
| Risk engine (§11.1) | ✅ | Emergency, professional-decision, and ambiguous high-risk paths; server-side regression tests |
| 72h same-question lock | ✅ | NFKC normalize + versioned HMAC fingerprint; duplicate stays invisible |
| Anonymous → login reveal | ✅ | Dev email sign-in + anonymous cookie; result data is withheld until bound and revealed |
| Free hexagram results | ✅ | Public result page (owner-only) |
| Paid AI deep readings | ✅ | Entitlement batch math (available+reserved+consumed+revoked = total), FIFO freeze/consume/release |
| Pricing / checkout | ✅ | $2.99 / $6.99 / $9.99; local simulated checkout and Waffo production adapter |
| Quality review | ✅ | One review per reading; submitted→approved/rejected |
| Deletion / privacy | ✅ | Revealed owner-only deletion + 30-day recovery window; AES-256-GCM encrypted question context |
| Marketing + SEO | ✅ | Home, method pages, pricing, how-to-ask, changing/relating hexagram explainers |
| Legal/help pages | ✅ | Privacy, Terms, Acceptable Use, Help |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (verified green)
npm test           # 36 domain tests (Vitest)
```

Env: copy `.env.example` → `.env.local`. The explicit `dev` / `simulated` / `memory` adapter
configuration is for local demonstration only. `APP_SECRET` is used for AES/HMAC and
`AI_ADAPTER_MODE=local` runs the deterministic offline generator. A production server rejects
these development adapters and placeholder secrets rather than presenting them as production services.

## Waffo Pancake payments

Production accepts only `PAYMENT_ADAPTER_MODE=waffo`. Set server-side `WAFFO_MERCHANT_ID`, `WAFFO_PRIVATE_KEY`, `WAFFO_ENVIRONMENT` (`test` or `prod`), `WAFFO_STORE_ID`, and `WAFFO_PRODUCT_ID_ONE`, `WAFFO_PRODUCT_ID_THREE`, and `WAFFO_PRODUCT_ID_FIVE`. The private key must never be a `NEXT_PUBLIC_*` value. Test and Production use distinct keys.

The only one-time products are one credit / USD 2.99, three credits / USD 6.99, and five credits / USD 9.99. Create and test them in Waffo Test before publishing Production products. Register separate Test and Production webhooks at `/api/webhooks/waffo`, subscribing only to `order.completed`, `refund.succeeded`, and `refund.failed`. Browser returns only poll local order state; only the verified webhook can grant credits. Automated chargeback synchronization remains blocked until Waffo publishes an official machine interface.

## Architecture

```
src/
  domain/            # pure, testable: casting algorithms, risk, entitlements, questions, readings
    casting/         # types, hexagrams/compute, three-coin, yarrow, mei-hua
    risk/            # engine.ts (§11.1)
    entitlements/    # pricing, batch invariants
    questions/       # normalize + fingerprint
  lib/               # crypto (AES-GCM, HMAC, signed cookies), action-result, auth/session, utils
  server/            # repository (in-memory + invariants), ai (local adapter), loaders
  app/               # routes + server actions (actions.ts)
  components/        # ui primitives, cast wizard, hexagram display, site chrome
```

Key invariants enforced in code (not just docs):
- Entitlement batch identity: `available + reserved + consumed + revoked = total`
- Casting lifecycle state machine (`canTransition` guard on every transition)
- Idempotent casting steps (same line/change key ⇒ same saved record)
- Result secrecy: result, preview, report, and question context require the revealed bound owner
- Terminal reservations: a reservation can be consumed, released, or expired exactly once

## Launch Blockers (D0 — human-gated, NOT implemented)

These require decisions/approvals outside code and are **scaffolded fail-closed**:

- **G-01** Domain advisor sign-off on interpretation content & risk rules
- **G-02** Licensed classic-text usage (King Wen / 十翼) — current names are placeholders pending licensing
- **G-03** Legal review of Privacy/Terms/Acceptable-Use for US market
- **G-04** Payments merchant approval (Waffo Production) + real webhook
- **G-05** AI provider contract + content-safety review for readings
- **G-06** Production auth (Better Auth) replacing dev email sign-in
- **G-07** Production DB (Drizzle + Neon PostgreSQL) replacing in-memory repository
- **G-08** Security audit / penetration test + CSP, rate limiting tuning
- **G-09** Accessibility (WCAG 2.1 AA) audit
- **G-10** Localization proofread of all US-English copy

Replace the `AI_ADAPTER_MODE` dispatch, `repo` (in-memory → Drizzle), and `devSignIn`
(session → Better Auth) to move to production. The domain core, algorithms, and invariants
are production-ready as-is.
