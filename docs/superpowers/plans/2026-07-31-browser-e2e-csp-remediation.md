# Browser E2E CSP Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore client hydration in the development-mode Playwright job without weakening the production Content-Security-Policy.

**Architecture:** Keep one CSP builder in `next.config.mjs`, but make development-only allowances explicit. Production retains the existing source list; development adds only the capabilities required by the Next.js development runtime.

**Tech Stack:** Next.js 15.5, React 19, Playwright 1.62, GitHub Actions.

## Global Constraints

- PR #12 remains Draft and must not be merged or released.
- Production CSP must not gain `unsafe-eval`, `ws:`, or `wss:`.
- Existing production build, quality, database, payment, privacy, and release-gate checks remain blocking.

---

### Task 1: Preserve the failing browser regression

**Files:**
- Test: `e2e/public-and-account.spec.mjs`

**Interfaces:**
- Consumes: the `/cast/three_coin` and `/signin` client pages.
- Produces: browser evidence that controlled inputs hydrate and enable their submit buttons.

- [x] **Step 1: Run the existing Playwright test in development mode**

Run: `$PLAYWRIGHT_HOME/node_modules/.bin/playwright test --grep-invert 'built server action boundary'`

Expected before the fix: FAIL because both `Begin the ritual` and `Continue` remain disabled after Playwright fills controlled inputs.

- [x] **Step 2: Confirm the production-built boundary still works**

Run: `$PLAYWRIGHT_HOME/node_modules/.bin/playwright test --grep 'built server action boundary'`

Expected: PASS, isolating the defect to the development client runtime rather than browser installation or server actions generally.

### Task 2: Make CSP environment-aware

**Files:**
- Modify: `next.config.mjs`

**Interfaces:**
- Consumes: `process.env.NODE_ENV`.
- Produces: a production CSP unchanged from the current policy and a development CSP that permits Next.js development hydration/HMR.

- [ ] **Step 1: Add explicit source arrays**

Create development-aware `scriptSources` and `connectSources` arrays. Add `'unsafe-eval'` only when `NODE_ENV === 'development'`; add `ws:` and `wss:` only in development.

- [ ] **Step 2: Build the CSP from those arrays**

Replace the literal `script-src` and `connect-src` strings with joined values from the arrays. Do not alter other directives.

- [ ] **Step 3: Re-run the browser regression**

Run: `$PLAYWRIGHT_HOME/node_modules/.bin/playwright test --grep-invert 'built server action boundary'`

Expected after the fix: all four development browser tests pass.

### Task 3: Run release-preserving verification

**Files:**
- Verify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the updated branch head.
- Produces: a complete GitHub Actions result for both `quality` and `browser-e2e`.

- [ ] **Step 1: Run the quality gate**

Run: `bun run db:migrate && bun run lint && bun run typecheck && bun run test --reporter=dot && bun run build`

Expected: PASS.

- [ ] **Step 2: Run the complete GitHub Actions workflow**

Expected: `quality` and `browser-e2e` both conclude `success`.

- [ ] **Step 3: Confirm release state**

Verify PR #12 remains open, unmerged, and Draft. Do not change any external gate from `blocked_external` without archived evidence.