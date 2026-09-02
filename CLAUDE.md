# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is bun 1.3.14 (`bun install --frozen-lockfile`).

```bash
bun run lint          # eslint .
bun run typecheck     # tsc --noEmit
bun run test          # vitest run (unit only)
bun run build         # next build
bun run dev
```

Single test / filtered test:

```bash
bunx vitest run src/lib/seo.test.ts
bunx vitest run src/lib/seo.test.ts -t "canonical"
bun run test:watch
```

**Integration tests are excluded from `bun run test`.** `vitest.config.ts` drops `**/*.integration.test.ts` unless `VITEST_INTEGRATION` is set. Run them with:

```bash
bun run test:postgres:serial   # scripts/test-postgres-serial.mjs
```

That script requires `initdb`/`pg_ctl`/`createdb` on PATH; it creates a throwaway PostgreSQL cluster in a temp dir, provisions two databases, and runs the integration suites serially.

Database:

```bash
bun run db:migrate     # drizzle-kit migrate
bunx drizzle-kit check # migration metadata check (what CI runs)
```

`drizzle.config.ts`: schema `src/server/db/schema.ts`, output `drizzle/`. Migrations use `MIGRATION_DATABASE_URL` (unpooled); runtime uses `DATABASE_URL`.

Gate scripts:

```bash
bun run seo:registry seo:quality seo:browser  # hexagram SEO gates
bun run gate:navigation
bun run verify:classical-sources              # fixed Wikisource oldid check; needs network
bun run indexnow                              # DRY RUN ONLY
node scripts/vercel-build.mjs                 # full release gate
```

`scripts/vercel-build.mjs` is the complete launch gate used by Vercel and by `.github/workflows/public-seo-v1.yml`: lint → typecheck → test → indexnow dry-run → build → server-action gate → boots the production server on 127.0.0.1:3000 → real-Chromium SEO/browser gates → Lighthouse, asserting accessibility ≥ 90, SEO ≥ 90, CLS ≤ 0.10 on home and guide pages. The CP5/CP6 workflows run the lint/typecheck/test/drizzle set plus the serial PostgreSQL suite.

## Architecture

### Two product lines in one repo

**Public SEO V1** (shipped) is credential-free: four casting methods, 64 hexagram entity pages, guides, browser-only `/history`. No account, database, payment, or production AI call is required.

**Commercial V2** (preserved, closed by default) holds auth, checkout, credits, AI preview/deep reading, reconciliation. The stage override at the top of `README.md` supersedes `docs/PRD.md` and `docs/技术设计文档.md`; do not infer from the old PRD that indexing waits on V2. `src/legacy/commercial/` is retained-but-unwired older code.

### Capability gating is the central mechanism

`src/server/capabilities.ts` defines six capabilities — `auth`, `aiPreview`, `checkout`, `webhookIngestion`, `paidDeepReading`, `reconcile`. Each declares its `COMMERCIAL_V2_*` flag, its dependencies on other capabilities, and its required env vars with format validation (`postgresUrl`, `httpsUrl`, `versionedKey`, `secret`, …). Everything is **off by default and fails closed**: the per-area wrappers (`src/server/auth/capability.ts`, `src/server/payments/capability.ts`, `src/server/generation/capability.ts`, `src/server/generation/deep-reading-capability.ts`, `src/server/reconcile/capability.ts`) return null/false when resolution throws.

`src/middleware.ts` enforces this at the edge: `/signin`, `/account`, `/api/checkout`, `/api/webhooks/waffo`, `/api/internal/reconcile`, and the `/api/readings/<uuid>/(preview|deep)` routes return 410/404 while their capability is closed; `/checkout` is Gone and `/result`, `/cast` are Not Found; any request carrying a `next-action` header is 404.

New commercial behavior must go through a capability definition — never read a `COMMERCIAL_V2_*` env var directly at the call site, and never grant authority from a `NEXT_PUBLIC_*` value.

### Adapter modes

`src/server/config.ts` resolves `AUTH_ADAPTER_MODE`, `PAYMENT_ADAPTER_MODE`, `DATABASE_ADAPTER_MODE`, `AI_ADAPTER_MODE`, `WORKFLOW_ADAPTER_MODE` into a `RuntimeConfig`. Local defaults are `dev` / `simulated` / `memory` / `local` / `local`. In production an unactivated area resolves to `disabled` — it deliberately never falls back to the local adapter. See `.env.example` for the full variable inventory, including the six rotating key sets (`SESSION_SIGNING_KEYS`, `QUESTION_*`, `RESULT_INTEGRITY_KEYS`, `ANONYMOUS_OWNER_KEYS`, `PAYMENT_CHECKOUT_URL_KEYS`, format `version:key,version:key`).

### Domain layer

Pure casting logic lives in `src/domain/casting/`: `three-coin/algorithm.ts`, `yarrow/algorithm.ts`, `mei-hua/algorithm.ts`, `hexagrams/compute.ts`, `hexagrams/king-wen.ts`. UI components call these rather than reimplementing formulas; browser randomness goes through `src/lib/browser-random.ts` (Web Crypto). Free interpretation copy is `src/domain/interpretation/basic.ts`; public-reading composition, classical line sourcing, and history live in `src/domain/public-reading/`. Provenance for algorithms and classical text is documented in `docs/PUBLIC_SEO_V1_PROVENANCE.md` and `docs/PUBLIC_READING_CLASSICAL_PROVENANCE.md`.

### Server layer

Focused ports live in `src/server/repositories/` (with a memory implementation). `src/server/repository.ts` is only a compatibility façade for older Actions/loaders; its `MemoryStore` is pinned to `globalThis` so it survives dev HMR. New services depend on the focused ports.

Each commercial area follows the same triple: `capability.ts` (is it on?), `composition.ts` (wire adapters), `postgres-repository.ts` (persistence) — see `src/server/payments/`, `src/server/generation/`, `src/server/reconcile/`. `src/server/readiness/readiness-service.ts` backs `/api/ready` and fails closed when the database is unconfigured or capabilities are disabled.

### Routing and i18n

`src/app/(default)/` is English; `src/app/(localized)/zh/` is Simplified Chinese and intentionally covers only the published Chinese entry points — English pages are not disguised as localized ones, and a language switch without an equivalent page returns to the Chinese homepage. Dictionaries are in `src/i18n/dictionaries/`, route/canonical/hreflang logic in `src/i18n/routes.ts` and `src/lib/seo.ts`. The 64-hexagram content and its SEO quality assertions are in `src/content/hexagrams/`.

### Conventions

- Tests are co-located with sources (`*.test.ts`, `*.integration.test.ts`); alias `@` → `src`.
- Canonical host is `https://www.quickiching.com`. One primary intent = one canonical URL; legacy intent URLs use permanent redirects, never soft-redirects to the homepage.
- `bun run indexnow` must stay dry-run; production submission (`--submit`) requires independent final audit approval.
