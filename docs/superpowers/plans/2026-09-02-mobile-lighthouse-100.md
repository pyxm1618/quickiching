# Mobile Lighthouse 100 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce avoidable initial mobile JavaScript and main-thread work while preserving SSR SEO content and all casting/navigation behavior.

**Architecture:** Keep the page and global shell server-first. Isolate navigation state into a small client island, load the three-coin engine only after question-first entry, and load the result tree only after six lines are complete.

**Tech Stack:** Next.js 15 App Router, React 19, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-02-mobile-lighthouse-100-design.md`

## Global Constraints
- Preserve all public copy, metadata, canonical URLs, redirects, robots, schema, and SEO links.
- Preserve question-first storage semantics and all three-coin casting/storage behavior.
- Preserve keyboard accessibility for desktop menus and mobile drawer.
- Do not change GA/Clarity behavior in this PR.
- Every production change must first be represented by a failing test.

---

### Task 1: Lock performance architecture with failing tests

**Files:**
- Create: `src/app/performance-architecture.test.ts`
- Read: `src/components/site-header.tsx`
- Read: `src/components/public-reading/question-first.tsx`
- Read: `src/components/public-reading/three-coin-tool.tsx`

**Interfaces:**
- Produces source-level invariants used by later tasks.

- [ ] **Step 1: Write a failing Vitest suite** asserting: `site-header.tsx` is not a client component; the homepage question flow references a dedicated lazy three-coin boundary rather than importing `ThreeCoinTool` directly; `three-coin-tool.tsx` does not statically import `PublicReadingResult`.
- [ ] **Step 2: Run `bun run test src/app/performance-architecture.test.ts`** and verify failure is caused by the current architecture.
- [ ] **Step 3: Commit only the failing test** with `test(perf): lock server-first loading boundaries`.

### Task 2: Split the global header boundary

**Files:**
- Modify: `src/components/site-header.tsx`
- Create: `src/components/site-header-client.tsx`
- Test: `src/app/performance-architecture.test.ts`

**Interfaces:**
- `SiteHeader({ locale })` remains the public server component API.
- `SiteHeaderClient` receives only serialized navigation labels/paths needed for interactive menus.

- [ ] **Step 1: Implement the minimal server/client split** so `site-header.tsx` has no `"use client"`, no hooks, and still server-renders brand and primary nav links.
- [ ] **Step 2: Move drawer/dropdown state, portal, focus management, pathname-specific interactive behavior, and Lucide interactive icons into `site-header-client.tsx` without changing labels or destinations.
- [ ] **Step 3: Run the focused architecture test** and confirm the header assertion is green.
- [ ] **Step 4: Run existing navigation/app-router tests** and fix only regressions introduced by the split.
- [ ] **Step 5: Commit** `perf: isolate header client navigation`.

### Task 3: Defer the three-coin engine until casting starts

**Files:**
- Modify: `src/components/public-reading/question-first.tsx`
- Create: `src/components/public-reading/lazy-three-coin-tool.tsx`
- Modify: `src/app/(default)/page.tsx`
- Test: `src/app/performance-architecture.test.ts`

**Interfaces:**
- `LazyThreeCoinTool` exposes the same props currently used by the homepage: `{ compactIntro?: boolean }`.
- `QuestionFirst` remains authoritative for `started`, question persistence, continue, skip, and restart.

- [ ] **Step 1: Implement a focused client dynamic boundary** using `next/dynamic` for `ThreeCoinTool` with a stable lightweight loading placeholder.
- [ ] **Step 2: Replace the homepage's direct `ThreeCoinTool` reference with `LazyThreeCoinTool`; preserve existing `QuestionFirst` nesting and storage keys.
- [ ] **Step 3: Run the focused architecture test** and confirm the question/casting assertion is green.
- [ ] **Step 4: Run question-first and three-coin tests** and fix only loading-boundary regressions.
- [ ] **Step 5: Commit** `perf: lazy load homepage casting engine`.

### Task 4: Defer the result tree until six lines exist

**Files:**
- Modify: `src/components/public-reading/three-coin-tool.tsx`
- Create: `src/components/public-reading/lazy-public-reading-result.tsx`
- Test: `src/app/performance-architecture.test.ts`

**Interfaces:**
- `LazyPublicReadingResult` accepts the exact `PublicReadingResult` prop contract and forwards it unchanged after dynamic loading.

- [ ] **Step 1: Add the lazy result boundary** around `PublicReadingResult`.
- [ ] **Step 2: Replace the static result import in `three-coin-tool.tsx` and render the lazy boundary only when `publicReading` is non-null.
- [ ] **Step 3: Run the focused architecture test** and confirm all assertions are green.
- [ ] **Step 4: Run three-coin/result/history tests** and fix only regressions caused by the boundary.
- [ ] **Step 5: Commit** `perf: defer reading result bundle`.

### Task 5: Full verification and deployment evidence

**Files:**
- No intended production edits unless verification exposes a regression.

**Interfaces:**
- Consumes all prior tasks.

- [ ] **Step 1: Run `bun run test`**; require zero failures.
- [ ] **Step 2: Run `bun run typecheck` and `bun run lint`**; require zero failures.
- [ ] **Step 3: Run the repository build/deployment gate** and require `next build` plus existing browser/HTTP gates to pass.
- [ ] **Step 4: Inspect Vercel build output for route/static generation regressions and compare bundle evidence where available.
- [ ] **Step 5: Open a PR with the exact changed boundaries, verification evidence, remaining Lighthouse risks, and explicit note that analytics tuning is intentionally excluded.
