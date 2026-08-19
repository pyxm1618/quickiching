# Public Reading P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement the original Quick I Ching Phase 0–6 requirements in the existing app without changing protected casting semantics or activating commercial services.

**Architecture:** Add a typed public-reading domain layer around the existing compute engine, then route all four methods through a shared rich result renderer. Add fixed knowledge-backed hexagram pages, browser-only history, optional question state, and a fail-closed personalized interpretation route. Keep the existing commercial modules inactive and leave publishing out of scope.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict mode, Vitest, Web Crypto, Zod, existing Tailwind/CSS, Puppeteer/Lighthouse gates.

**Spec:** `docs/superpowers/specs/2026-08-19-public-reading-p0-design.md` and the user-provided original requirements attachment.

## Global Constraints

- Preserve Three-Coin, Yarrow, Mei Hua algorithms, bottom-up line order, and Web Crypto behavior.
- Do not use `any`, `Math.random()` in casting, client-supplied hexagram numbers, or AI for casting.
- Question max is 500 Unicode code points and is never sent to URL, metadata, JSON-LD, analytics, logs, or server history.
- No 384/4096 pages, `/zh/`, account/database history, payments, new divination methods, or unrelated refactors.
- Public sitemap must finish at exactly 73 URLs.

---

### Task 1: Lock the domain contract and algorithm coverage

**Files:**
- Create: `src/domain/public-reading/types.ts`, `builder.ts`, `manual.ts`, `static-reading.ts`, `fingerprint.ts`
- Modify: `src/domain/casting/types.ts`
- Test: `src/domain/public-reading/*.test.ts`, `src/domain/casting/algorithms.test.ts`

- [ ] Write failing tests for four method IDs, evidence unions, 500-code-point question validation, all 4096 compute transformations, and Manual Mode A/B equivalence.
- [ ] Run the focused tests and confirm they fail for missing contracts/cases.
- [ ] Implement typed `PublicReading`, method evidence, builder, fingerprint, and Manual conversion through `buildHexagramResult`.
- [ ] Add the full 4096 transformation test and keep existing algorithm tests unchanged.
- [ ] Run focused domain tests and then the full Vitest suite.

### Task 2: Build one rich result and Question-first flow

**Files:**
- Create: `src/components/public-reading/question-first.tsx`, `public-reading-result.tsx`, `manual-cast-tool.tsx`, `reading-actions.tsx`
- Modify: `src/components/public-reading/reading-result.tsx`, existing method tools/pages, `src/app/page.tsx`
- Test: `src/components/public-reading/*.test.tsx` where feasible, domain privacy tests

- [ ] Write failing tests for result sections, no-relating behavior, optional question/skip, refresh recovery, and changing a question without recasting.
- [ ] Run focused tests and confirm red state.
- [ ] Implement the common result renderer and session-scoped question state with masked DOM attributes.
- [ ] Adapt Three-Coin, Yarrow, and Mei Hua completion flows to the common builder while preserving their ritual controls.
- [ ] Add `/methods/manual-cast/` with Mode A and Mode B, validation, no random calls, optional question, and common result.
- [ ] Run method/result focused tests and typecheck.

### Task 3: Add classical 64-entity knowledge and SEO routes

**Files:**
- Create/modify: `src/domain/public-reading/knowledge.ts`, `src/app/hexagrams/[slug]/page.tsx`, `src/app/hexagrams/page.tsx`, `src/lib/seo.ts`, `src/app/sitemap.ts`
- Test: `src/domain/public-reading/knowledge.test.ts`, `src/lib/seo.test.ts`

- [ ] Write failing completeness tests for exactly 64 fixed slugs, 384 line records, non-empty source metadata, unique metadata, and the expected 73 paths.
- [ ] Run focused tests and confirm red state.
- [ ] Add the fixed knowledge records with public-domain Judgment/Image Chinese text and source/version notes, plus original English practical interpretation.
- [ ] Add static entity pages, six anchors, previous/next links, breadcrumbs, and hub links.
- [ ] Update result links to known entity slugs and update sitemap/indexation helpers.
- [ ] Run knowledge/SEO tests and build to verify `generateStaticParams` output.

### Task 4: Implement local History

**Files:**
- Create: `src/lib/reading-history.ts`, `src/components/public-reading/history-controls.tsx`, `src/components/public-reading/history-list.tsx`, `src/app/history/page.tsx`
- Modify: `src/components/public-reading/public-reading-result.tsx`, `src/app/robots.ts`, `src/lib/seo.ts`
- Test: `src/lib/reading-history.test.ts`

- [ ] Write failing tests for explicit save, max 50, rename/delete, corruption, old schema, quota failure, and rebuilding facts from line values.
- [ ] Run focused tests and confirm red state.
- [ ] Implement defensive localStorage persistence using `crypto.randomUUID()`, no server calls, and no `/readings/[local-id]` route.
- [ ] Add noindex/follow history UI with refresh recovery and clear browser-only disclosure.
- [ ] Run history tests and browser smoke checks.

### Task 5: Add fail-closed Personalized Interpretation

**Files:**
- Create: `src/domain/personalized-interpretation.ts`, `src/server/personalized-interpretation.ts`, `src/app/api/personalized-interpretation/route.ts`, `src/components/public-reading/personalized-interpretation.tsx`
- Modify: `src/server/ai/index.ts`, `src/server/config.ts`, `src/middleware.ts`, `.env.example`
- Test: `src/domain/personalized-interpretation.test.ts`, `src/server/personalized-interpretation.test.ts`, route tests

- [ ] Write failing tests for request schema, fingerprint match, prompt-injection boundaries, high-risk blocking, invalid AI output, timeout, no-store response, and static fallback.
- [ ] Run focused tests and confirm red state.
- [ ] Implement schema-validated request/response with only verified reading facts and a provider abstraction; keep credentials server-only.
- [ ] Add exact POST route, body limit, timeout, `Cache-Control: no-store`, no question echo/logging, and default fail-closed activation.
- [ ] Add client opt-in button only when a question exists; never auto-call after Skip.
- [ ] Run focused server/client tests and confirm `/api` remains closed except this endpoint.

### Task 6: Expand gates, privacy, performance, and documentation

**Files:**
- Modify: `scripts/browser-gate.mjs`, `scripts/on-page-seo-browser-gate.mjs`, `scripts/vercel-build.mjs`, `src/lib/analytics.ts`, legal/help copy, `README.md`, `docs/PRD.md`
- Test: gate syntax and final full suite

- [ ] Write or update gate assertions for all required flows, private question boundaries, anchors, 73 sitemap URLs, keyboard/overflow, and AI fail-closed.
- [ ] Run `node --check` for all gates and verify red assertions against the old implementation where applicable.
- [ ] Implement gate coverage and privacy masking without sending question text to analytics/session replay.
- [ ] Update homepage and legal copy to the actual four-method Ask → Cast → Understand → Reflect → Return system.
- [ ] Run `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`, and the full `node scripts/vercel-build.mjs`.
- [ ] Inspect `git diff`, ensure no `any` or casting `Math.random()`, and report any provider activation blocker honestly.

### Task 7: Final review and local handoff

- [ ] Re-read the original requirements and check every acceptance condition against code and command output.
- [ ] Run `git status --short --branch`, `git diff --check`, and capture exact local branch/remote state.
- [ ] Do not push, deploy, merge, or create another PR; hand off local changes and any existing PR state separately.
