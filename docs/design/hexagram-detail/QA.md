# PR #70 — integrated English knowledge detail QA

Engineering implementation: PASS locally. Production material sources: COMPLETE (15 approved originals). Visual acceptance: **NOT PASS**. Remote CI at `f426b2a`: FAIL on mobile LCP (86,757 ms). The delivery follow-up passes the complete local Lighthouse gate; read PR #70 current-head checks for the subsequent remote result. Local success is not remote CI success. **No merge is authorized.**

Branch: `codex/hexagram-detail-ui`. Original UI base: `8329ef2f3dfe912a2a0e37fdcbaddb6e06f5bf66`. Data PR #69 was merged from `origin/main` (`de30a7a`) into this same branch. This is a continuation of PR #70, not a second page or PR.

## Production materials and scope

The approved design remains `reference.png`. The original final PASS ZIP supplies 13 images. The user then supplied `/Users/milushangdi/Desktop/灯影水庭夜色朦胧.png` (1024×1536 RGB) and `/Users/milushangdi/Desktop/墨金太极乾坤图_透明边缘清理_2048.png` (2048×2048 RGBA). They are copied byte-identically as `background/lantern-scene.png` and `decorations/hero-taiji.png`. The Taiji has actual alpha, four fully transparent corners, and was inspected on parchment. No generated art, screenshot crops, baked page text or replacement assets were introduced.

`assets.json` and `visual-materials-readiness.json` reconcile **15 = pass 15 + deferred 0 + reject 0 + unknown 0**. All 15 HTTP-served originals match their SHA-256 values. Source approval and successful asset delivery do not establish pixel parity. Runtime now uses 37 traced AVIF/WebP delivery derivatives; all original PNGs remain unchanged. See `DELIVERY.md` and `delivery-assets.json`.

The existing English view/route is reused. Chinese markup and behavior are preserved. Domain, API, database, schema, services, casting, reading flows, auth, payment, dependencies, build configuration and metadata values were not edited by this UI integration. Domain changes in the ancestry come from the separately merged PR #69; `git diff origin/main -- src/domain src/app src/server package.json bun.lock` is empty.

The English detail supplies its own section/sequence navigation. Site header/footer and the previous site's star overlay are hidden only on this English detail composition. Consent behavior remains unchanged; captures decline through its actual button. The new scene is a fixed, aspect-preserving viewport background, not a vertically stretched full-page image. Scroll sides still use actual top + vertically repeating middle + bottom pieces, with intrinsic cap aspect ratios.

## Data bindings and optional states

`integrated-data-coverage.json` records the actual consumed data: 64 Judgment renderings, 64 Image renderings, 384 line renderings, 2 use-line cases (hexagrams 1 and 2), 120 supplied structural relations across 64 hexagrams, and **0 Stage/State entries**.

- Judgment/Image each use their own `rendering.editorialRendering` and `modernInterpretation.text`; they do not borrow `coreMeaning` or one another's interpretation.
- English text is labelled **English Rendering / Translation** and attributed to the supplied **Quick I Ching editorial rendering**. It is never labelled Classical Line Text or presented as an ancient English original.
- Six lines bind by position, preserving full rendering, modern meaning and caution. Their visual order follows the reference (Sixth to First), and stable `#line-1`…`#line-6` anchors remain.
- Missing detail data safely hides its rendering slots; the previous real modern meaning/caution remains available. Stage/State stays hidden when empty. Its conditional rendering has a clearly labelled test-only fixture, never production content.
- Actual use-line cases and structural relations render only when supplied. Unchanging cases, Key Energy and Suitable Situations are not invented from unrelated fields.
- Related figures use each related entity's actual trigram data. The UI does not generate relationships or interpretation content.
- Auxiliary navigation remains exactly Previous, Back to 64 Hexagrams, Next, with disabled sequence boundaries and no reading/purchase CTA.

`coverage.json` reconciles all seven component responsibilities: 7 pass, 0 deferred/reject/unknown. That measures binding/optional-state handling; it does not approve visual fidelity or imply missing semantic fields were supplied.

## Verification evidence

- Production `bun run build`, lint and typecheck: PASS.
- Full unit suite: **131 files / 869 tests PASS**. One earlier run hit an existing pricing timer assertion; that unrelated test passed in isolation and the full suite then passed. The failed log was preserved; no pricing/payment code or test was changed.
- Detail component suite: 12/12 PASS, including all 128 localized source-link bindings, new data bindings, safe missing detail and empty optional modules.
- Updated full P0 production browser gate: PASS. Its obsolete wording assertion was replaced by the new knowledge contract; canonical/anchors, Judgment/Image sources, all six individually labelled source links and exact fixed URL/revision checks remain.
- Negative DOM audits: deleting line 3's source link and changing its `oldid` to `1` each correctly FAIL the gate even though the total link count remains sufficient. See `P0-CONTRACT-FOLLOWUP.md`.
- Existing production SEO browser and quality checks: PASS, 128/128 pages. Metadata, languages, source-noise rules, inbound links and Chinese checks remain. English line headings are checked for six real, non-empty line headings rather than obsolete keyword repetition.
- Delivery follow-up: all 37 HTTP-served derivatives match their manifest hashes, sizes and approved source hashes; all lazy ornaments load/decode when visited. Visible repeat pixels and all alpha values are exactly preserved by lossless WebP.
- Complete original P0 Lighthouse gate: PASS, including the real `/hexagrams/24-return` mobile target at **LCP 3,670 ms, performance 89, accessibility 96, SEO 100, CLS 0**. No threshold or Lighthouse script was changed.
- Final production Chrome checks: **30 cases** across 1024×900, 1440×1000, 390×844, 320×812, 801×900, each on hexagrams **1, 2, 3, 5, 62, 64**. DPR 1; these are actual CSS viewports, not physical devices.
- Each case verifies identity, six current bars, actual optional sections, full line rendering/meaning/caution against supplied data, Judgment/Image field-specific binding, stages, no horizontal overflow or clipped text, real sequence links, cap aspect ratios, cap adjacency and vertical middle repetition. Real Previous/Next/Back clicks pass; no page errors; Chinese styling stays isolated.
- `Preponderance of the Small` is a separate temporary DOM layout test at 1024/390/320px. The real #62 name remains `Small Exceeding`. It was not written to the catalog or used as a production fallback.
- Independent read-only review found no actionable code issues and independently passed the 12 component tests. It did not approve pixel fidelity.

Raw logs/screenshots remain under `outputs/hexagram-detail/`. Baseline evidence at `e1bd74c` is retained in Git and in the original local output folders. `integrated-qa-results.json`, `integrated-geometry.md` and the committed viewport screenshots describe this integration. Local tools: Bun 1.4.2 / Node 26.7.0 / Chrome 156; CI runs the repository-pinned versions.

## Pixel QA and the height rule

**Never treat 3020px vs 1536px, or the integrated page's larger height, as a UI defect by itself.** Preserve all actual text at readable sizes. Do not delete paragraphs, shrink text, clamp content or force fixed heights to equal the short example. Judge the visual system, component proportions/styles, local spacing rhythm, material placement, contrast and continuity. Content-driven section growth and downstream Y offsets are diagnostics, not defect counts.

The 1024px comparison uses the original reference scale without vertically rescaling either image. `integrated-geometry.md` records nine selected regions. The final calibration restored the 900px paper width, aligned the form's X/width, corrected the badge's extra offset and brought the cases/relations split within about 2px of the selected reference bounds. These are geometry checks, not a similarity percentage.

**Visible differences remain, so pixel acceptance is NOT PASS:**

- Hero starts about 47.6px lower than the reference; the supplied top roll's intrinsic ornament geometry is taller. Caps are preserved rather than stretched or cut to disguise the difference. The badge/form have correspondingly lower Y positions.
- The form is shorter because the reference's lower descriptive/polarity copy is not a supplied dedicated data field. No text was fabricated to fill it.
- Some fine panel-border treatments, branch scale/placement and roll/ornament outlines still differ from the reference. The approved assets are used as-is; no new ornamental art was invented.
- The reference does not supply a font specification. Chrome confirms Times New Roman is actually rendered, but exact identity with the source artwork's typeface remains unverified.
- The meaning section has four available semantic fields, rather than the six short fields shown in the reference. Stage/State and an unchanging-case card have no real supplied content. Safe omissions and full long paragraphs legitimately change the layout's content density.
- Mobile stacks the form, semantic panels and line cells while preserving labels, source links and text. No approved mobile image was supplied, so its adaptation is checked for readability/continuity rather than asserted as a pixel match to a nonexistent mobile baseline.

The delivery follow-up retains identical document width and height in all 30 cases versus the prior integrated report. Actual 1024px/390px top and bottom viewport captures were inspected for new visible encoding blocks, rectangular alpha edges and missing lazy ornaments; no new obvious defects were found. Lossy delivery is not claimed to be pixel-identical to source PNGs.

Desktop structural/interaction QA: PASS. Mobile structural/readability QA: PASS. Full desktop/mobile visual acceptance: **NOT PASS**. Materials are now complete and PR #69 is integrated, but neither fact authorizes merging or removes these recorded visual differences.
