# English hexagram detail UI — 2026-10-29

Draft implementation. Engineering checks pass; visual parity with the approved design does **not** pass. Do not label this pixel-complete or ready for acceptance.

Base: `8329ef2f3dfe912a2a0e37fdcbaddb6e06f5bf66` (`origin/main`). Branch: `codex/hexagram-detail-ui`.

## Inputs and scope

The user confirmed `reference.png` as the final English knowledge-detail design. Its source is `/Users/milushangdi/Desktop/QIC/单卦详情页/乾卦：至刚创生的易经指南.png`. The final PASS ZIP supplied 13 images; each deployed asset is byte-identical to its archive member (`assets.json`). Asset ledger: original 13 = pass 13 + deferred 0 + reject 0 + unknown 0. No rejected versions, generated images, screenshot backgrounds or baked text are used.

The existing route and exported `HexagramDetailPageView` remain. Only English presentation, its scoped stylesheet, static assets, frontend tests and QA evidence change. Chinese HTML was compared against the base for all 64 routes and is identical. Domain/content files, API, schema, services, algorithms, reading flows, auth and payment remain untouched. Metadata values remain unchanged; the English visible H1 now binds the actual English entity name as in the design.

The English scroll supplies its own section and sequence navigation; the shared site header/footer are hidden only while this English detail article is present. The existing analytics consent banner remains functional. Capture browser declined through its actual button; no analytics code or consent behavior was changed.

## Verification

- `bun run build` — PASS, production static generation completed.
- `bun run lint` — PASS.
- `bun run typecheck` — PASS.
- `bun run test` — PASS, 130 files / 860 tests.
- `bun run seo:registry` — PASS, 128 entries, original source hashes preserved.
- Existing SEO production browser gate — PASS, 128 pages plus language/keyboard/hub/mobile checks.
- Existing quality audit — PASS, 128/128. English reading-intent modules, keyword display slots and direct-home link were superseded by the user's fixed design; these are explicitly non-applicable, not fabricated passes. Chinese assertions remain.
- Independent read-only review — no actionable code findings; visual fidelity remains unapproved.

Local tools: Bun 1.4.2, Node 26.7.0, Chrome 156.0.8078.48. CI uses repository-pinned Node 22/Bun 1.3.14; local results do not establish remote CI status.

## Actual browser coverage

`qa-results.json` records 25 checks against a production server: 1024×900, 1440×1000, 390×844, 320×812 and 801×900, each on hexagrams 1, 3, 5, 62 and 64. These are real Chrome CSS viewports at DPR 1, not physical mobile devices.

Each run checks real title/identity, six bars, full untruncated modern-meaning text against the catalog, hidden unavailable case/relation sections, no horizontal scrolling, no clipped text, sequence boundaries, cap aspect ratios, cap/middle/bottom adjacency and actual vertical repetition. Navigation was clicked through Previous, Next and Back to 64 Hexagrams. All 13 HTTP-served image bodies matched their source hashes. No page errors were recorded. Chinese header styling stays visible on the Chinese route.

Actual catalog names verified: The Creative (1), Difficulty at the Beginning (3), Waiting (5), Small Exceeding (62), Before Completion (64). The user-requested `Preponderance of the Small` was separately inserted into temporary browser DOM at 1024/390/320px as a **layout stress test only**. It fits without horizontal overflow or clipping. The catalog was not renamed; the stress screenshot is explicitly named `test-only-long-name-320.png`.

Desktop structural QA: PASS. Mobile structural/readability QA: PASS. Desktop/mobile visual fidelity to the approved composition: **NOT PASS**.

Manual screenshot review covered top/bottom rolls, repeat borders, parchment, branch positions, long headings and long six-line text, hidden-section continuity, footer links, absence of obvious white/color edge halos and text occlusion. A first-round overlap between the top roll and number badge was corrected by moving the content start below the real roll ornament. Mobile branches were constrained to the page edge to avoid the local navigation. The screenshot inspection does not establish physical-device rendering or cross-browser parity.

## Measured differences and remaining inputs

At 1024px, the reference has height 1536px; the live Qian page is about 3020px because its real authored content is substantially longer. The text is neither truncated nor rewritten. Measured anchors are in `geometry.md`; the screenshot comparison uses the same 1024px width and DPR 1, without vertically rescaling the candidate.

- Hero starts about 47.6px below the reference; this reserves space for the approved roll's larger ornament. Hero Taiji art and the lantern/scene backdrop visible in the reference are absent from the supplied asset set. They have not been redrawn, generated or screenshot-cropped.
- Meaning section is about 429.6px taller. Only four available semantic fields are displayed; dedicated Key Energy/Suitable Situations data is unavailable. The current long `coreMeaning` differs from the short design example.
- Classical section is about 71.4px shorter. It has real source links but no unavailable English rendering or dedicated Judgment/Image modern interpretation. Editorial modern meaning is never relabeled as a classical translation.
- Six Lines is about 1230.2px taller than the short reference example. Modern meaning and caution remain complete. English-rendering and Stage/State columns are absent, rather than showing placeholders or using unrelated fields.
- Cases and relationships are omitted because their real data contracts are absent. Their missing source data also changes page rhythm and bottom artwork context. See `coverage.json`: original 7 sections = pass 2 + deferred 5 + reject 0 + unknown 0. Deferred means data-dependent portions are incomplete, not rejected.
- Navigation starts about 1423.9px later than in the reference and is about 29.2px taller. It contains only the three permitted sequence/index items. No trailing menu button from the reference was added because the explicit user instruction limits navigation to those items.
- The section panel corner filigree and dense scene decoration in the reference are not present as separate approved assets. The current borders and standard UI icons are code; ornamental art was not invented. The reference does not provide a font specification. The serif rendering uses Times New Roman, confirmed in Chrome's rendered-font inspection, without introducing font dependencies; exact original typeface identity is unverified.
- Mobile stacks the form and meaning/classical columns, and stacks the six-line cells with their labels. This is a responsive adaptation; no separate mobile design was supplied. The landscape is hidden at narrow widths to avoid covering text.

**Still waiting for a data PR:** yes — English renderings, distinct Judgment/Image modern interpretations, Stage/State, actual cases and actual hexagram relations (and the missing short semantic fields). The frontend consumes the current contract only; no speculative new production fields or content generation were introduced.

Reproduce local browser checks with the production server at port 3217:

```sh
bun run build
bun run start --port 3217
# In another terminal, using the repository's existing ephemeral browser audit tooling:
bun scripts/hexagram-detail-ui-browser.mjs
HEXAGRAM_SEO_BROWSER_BASE_URL=http://localhost:3217 bun scripts/hexagram-seo-browser-gate.mjs
HEXAGRAM_SEO_AUDIT_BASE_URL=http://localhost:3217 bun scripts/hexagram-seo-quality-audit.mjs
```

Complete local screenshots and raw logs are preserved under `outputs/hexagram-detail/` (ignored). The three committed viewport screenshots are genuine browser captures; the long-name image is the test-only case described above. Geometry and screenshot overlays diagnose differences; they are not a similarity percentage or a visual PASS.
