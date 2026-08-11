# Quick I Ching Brand Logo Asset Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only Quick I Ching's current brand mark and favicon assets with a faithful transparent extraction of the approved upper ink-circle + I Ching symbol, while preserving the current `main` UI, behavior, routes, copy, and SEO.

**Architecture:** Keep the source artwork as a raster asset because its ink texture and fly-white brush detail are not suitable for forced vector tracing. Introduce one focused `BrandMark` presentation component for Header/Footer; keep the generic semantic `SealMark` untouched. Let Next.js App Router serve the new favicon/icon assets without introducing new PWA, structured-data, or social-image architecture.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, PNG/ICO raster assets, existing Public SEO V1 browser/Lighthouse gate.

## Global Constraints

- Logo visual source of truth: the provided image's upper ink-circle + I Ching mark only.
- Do not include the image's `Quick I Ching` lettering, tagline, red seal, paper background, or any other source-image text.
- Do not redesign or reinterpret the mark.
- Preserve title, description, H1, canonical, robots, sitemap, routes, URLs, FAQ, SEO copy, internal links, business logic, casting methods, animations, colors, typography, and layout.
- Keep visible HTML `Quick I Ching` brand text in Header and Footer.
- Do not merge the resulting Draft PR.

---

### Task 1: Audit Current Brand Asset Usage

**Files:**
- Inspect: `src/app/icon.svg`
- Inspect: `src/app/layout.tsx`
- Inspect: `src/components/site-header.tsx`
- Inspect: `src/components/site-footer.tsx`
- Inspect: `src/components/hex/seal-mark.tsx`
- Inspect: public assets, manifest/PWA/social/structured-data standard paths

- [x] Confirm Header and Footer use the legacy circular `易` `SealMark` as the brand mark.
- [x] Confirm `src/app/icon.svg` is the old gold/brown coin/hexagram icon.
- [x] Confirm no current manifest/PWA, Apple icon, explicit social logo image, or structured-data logo reference requires replacement.
- [x] Confirm the generic `SealMark` can remain unchanged while brand-only usage moves to a dedicated component.

### Task 2: Produce Faithful Raster Assets

**Files:**
- Create: `public/quick-i-ching-logo-mark.png`
- Create: `public/favicon-16x16.png`
- Create: `public/favicon-32x32.png`
- Create: `public/favicon-48x48.png`
- Create: `src/app/favicon.ico`
- Create: `src/app/icon.png`
- Remove: `src/app/icon.svg`

- [x] Crop only the approved upper mark from the source image.
- [x] Remove paper/background into transparency while preserving ink density, fly-white texture, brush irregularity, circle proportion, and central hexagram geometry.
- [x] Export a compact 160×160 transparent production mark, providing at least 3.6× pixel density at the component's largest 44px CSS presentation.
- [x] Produce dedicated 16/32/48px favicon derivatives with increased mark occupancy for small-size legibility.
- [x] Package 16/32/48px favicon sizes into `favicon.ico`.

### Task 3: Replace Brand Presentation Only

**Files:**
- Create: `src/components/brand-mark.tsx`
- Modify: `src/components/site-header.tsx`
- Modify: `src/components/site-footer.tsx`

- [x] Add `BrandMark` with explicit intrinsic dimensions and `Quick I Ching logo` alt text.
- [x] Preserve the old 32px Header/Footer mark footprint.
- [x] Use the same source geometry/alpha with presentation-only monochrome inversion on the dark Concept A surface; do not introduce a recolored logo asset.
- [x] Replace only Header/Footer brand instances; leave `SealMark` intact for non-brand semantic use.
- [x] Preserve visible HTML `Quick I Ching` text and all navigation/copy/layout classes.

### Task 4: Verify Diff, SEO, Build, Browser, and Favicon

**Files:**
- No production files beyond Tasks 2–3 unless an existing test requires a logo-only adjustment.

- [x] Verify `main...agent/replace-brand-logo` contains only logo/icon/presentation changes.
- [ ] Run `bun install --frozen-lockfile` through the repository's formal PR gate.
- [ ] Run `bun run lint`.
- [ ] Run `bun run typecheck`.
- [ ] Run `bun run test`.
- [ ] Run `bun run build`.
- [ ] Run the existing complete Public SEO V1 Chromium/Lighthouse gate.
- [ ] Verify desktop/mobile Header/Footer presentation through the browser gate and asset-level favicon QA.
- [ ] Verify title, description, H1, canonical, robots, sitemap, routes, and internal links remain unchanged.

### Task 5: Publish as Draft PR Only

**Files:**
- No additional production files.

- [ ] Create a Draft PR from `agent/replace-brand-logo` to `main`.
- [ ] Record exact assets, sizes, references replaced, SEO preservation, verification evidence, files changed, and non-logo diff audit in the PR body.
- [ ] Leave the PR unmerged.
