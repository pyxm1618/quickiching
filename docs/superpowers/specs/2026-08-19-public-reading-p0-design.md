# Quick I Ching Public Reading P0 Design

**Date:** 2026-08-19

**Goal:** Extend the existing credential-free Public V1 product into one deterministic four-method reading system with optional private questions, 64 indexable hexagram entities, browser-only history, and a fail-closed personalized interpretation seam.

## Constraints

- Preserve the existing Three-Coin, Yarrow, and Mei Hua algorithms and their evidence/ordering.
- Casting remains deterministic from method inputs and Web Crypto where the method is random; AI never participates in casting.
- The canonical source of truth for every reading is the six bottom-up `LineValue` tuple.
- Public readings do not require authentication, a database, payment, or AI.
- Questions are optional, capped at 500 Unicode code points, never placed in URLs, metadata, JSON-LD, analytics, logs, or server history.
- Manual Cast uses the existing `buildHexagramResult` compute path for both input modes.
- Hexagram entities are 64 fixed slugs with six line sections each, not 384 or 4096 pages.
- Local History uses `localStorage`, explicit Save, maximum 50 records, and no shareable local-id route.
- Personalized interpretation is POST-only, schema-validated, no-store, rate/size/time bounded, and falls back to static reading on every provider or schema failure.
- `/api` remains closed except for the one personalized interpretation endpoint.
- No `/zh/`, no additional divination methods, no commercial activation, no remote fonts, and no unrelated cleanup.

## Architecture

### Domain

`src/domain/public-reading/` owns the public contract:

- `types.ts` defines `ReadingMethod`, `PublicReading`, method evidence unions, and the rich static result shape.
- `builder.ts` validates six line values, calls `buildHexagramResult`, attaches the method version and evidence, and computes a stable reading fingerprint from facts only.
- `manual.ts` converts Mode A line values and Mode B primary/moving-line input into the same six-line tuple.
- `knowledge.ts` is the single 64-hexagram knowledge source. It contains explicit fixed slugs, classical public-domain Chinese Judgment/Image text with source notes, and six original line interpretation records per hexagram.
- `static-reading.ts` adapts the existing interpretation catalog/basic interpretation into the common result sections without generating sentence fragments.

Existing casting algorithms remain under `src/domain/casting/`; no public component computes primary or relating hexagrams independently.

### UI

`src/components/public-reading/` gets a common `PublicReadingResult` renderer and `QuestionFirst` client component. Existing method-specific ritual components remain method-specific, but each method page passes its final facts through the common builder/result path. Manual Cast uses `ManualCastTool` and the same result renderer.

The question is held in client state and mirrored only to a short-lived browser session key for refresh recovery. The value is rendered with a masked analytics/session-replay attribute. It is never passed to Next metadata or URL generation.

### History

`src/lib/reading-history.ts` contains versioned, defensive localStorage serialization. It stores facts and optional question only after explicit Save. Restore rebuilds and validates the reading through `buildPublicReading`; stored derived numbers are display caches only.

### Personalized interpretation

`src/server/personalized-interpretation.ts` owns request validation, risk evaluation, fingerprint comparison, and the AI Gateway adapter call. The route is `src/app/api/personalized-interpretation/route.ts`, POST-only, with `dynamic = "force-dynamic"`, `Cache-Control: no-store`, request size/timeout guards, and no question logging. If production provider credentials or Turnstile are absent, the route returns a safe activation response and the client keeps the static result.

## SEO

- `INDEXABLE_PATHS` becomes exactly 73: home, four method pages, three guides, the hub, and 64 fixed entity paths.
- `/history/`, result/session routes, the API route, and error/private routes are noindex and absent from the sitemap.
- Each entity page uses `generateStaticParams`, fixed metadata, self-canonical, BreadcrumbList/WebPage JSON-LD only, and six `#line-N` sections.
- Result links are generated from the fixed knowledge slugs and only rendered after the corresponding entity route exists.

## Verification strategy

- Add domain tests before each new implementation: all eight coin combinations, 4096 primary/moving transformations, both manual modes over 4096 cases, question privacy/limits, history corruption/limits, personalized schema/fingerprint/fallback, and knowledge completeness.
- Extend browser gates for question/skip, all four methods, moving-line variants, Manual A/B, history CRUD, hub/entity routes, anchors, privacy, keyboard/overflow, and AI fail-closed behavior.
- Run `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`, `node --check` on gates, the full Vercel build gate, and verify the final sitemap count is 73.
