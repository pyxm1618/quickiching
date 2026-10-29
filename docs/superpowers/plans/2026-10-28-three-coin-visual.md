# Three-Coin Visual Implementation Plan

> For agentic workers: use superpowers:executing-plans inline. The existing approved requirements and design package define the design; no redesign is authorized.

Goal: Implement Phase 3–5 on main@8329ef2 using plain Three.js and the formal production assets, preserving the Phase 1/2 business pipeline.

Architecture: QuestionFirst and ThreeCoinTool retain their business state. A client-only scene consumes immutable faces and visual-only timing/seed. Ritual CSS owns UI. The existing result client retains auth/persistence ownership. No API/domain/DB changes.

- [x] Fetch main, isolated branch, fully read business/technical/design sources, validate 13 PNGs, launch real browser/WebGL/screenshot. Baseline: 860 tests pass.
- [ ] Add tested deterministic poses with exact authoritative final orientations, shared geometry/materials, effects, cleanup/fallback.
- [ ] ref-01 Home: production background, live typography/form, Three.js hero; capture and inspect side-by-side/overlay/difference, freeze remaining findings as NOT PASS for Pass 1, then advance.
- [ ] ref-02 Question: preserve logical input, approved transition, capture/compare/refine.
- [ ] ref-03 Casting: authoritative input, trajectories/rotations/effects/timing, capture/compare/refine.
- [ ] ref-04 Settled: authoritative labels/line semantics, capture/compare/refine.
- [ ] ref-05 Progress: existing steps bottom-up, reset/record motion, capture/compare/refine.
- [ ] ref-06 Gate: existing auth/save boundary, same room, capture/compare/refine.
- [ ] ref-07 Result: production blank card, existing dynamic result, capture/compare/refine.
- [ ] Browser motion, reduced motion/fallback, EN/ZH business regression, complete CI, diff review, Draft PR.

QA environment: real installed Chrome 155.0.8059.85 through local Puppeteer, macOS / Apple M4 Metal ANGLE WebGL2, 1672x941 CSS px, zoom 1, DPR 1. Tabbit was excluded because canonical viewport/DPR did not remain fixed. Pinned Node 22.23.2 / Bun 1.3.14 are now installed and used for build/CI.

2026-10-28 user clarification: background area is independently validated against bg-stage-master-clean.png. Concept background differences are an intentional deviation only for that area. Foreground tolerances are not broadened.

2026-10-29 owner instruction supersedes sequential PASS gating: Pass 1 must implement and capture all seven states with concrete findings (PASS/NOT PASS), then Pass 2 closes each strictly. Home iteration-22 is frozen NOT PASS. Core files have one writer; performance remains a separate blocker.

2026-10-29: profiling checkpoint 3911d3555c6bce582b4a9f5030421e4c0e943687 committed/pushed with fresh build, 879 unit tests and 16 browser cases PASS. Continued core work immediately. Pass 1 seven-state real screenshot/diff coverage is now complete (7 NOT PASS, 0 unreviewed), recorded in PASS_1_DIFF_INVENTORY.md. Pass 2 started at Home iteration-23, still NOT PASS. No visual readiness or full CI PASS is claimed.
