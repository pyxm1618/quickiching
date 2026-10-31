# Unified Reading business handoff — PR #76

> Final status update: the user subsequently supplied the authenticated staging account; real generation/reviewer/evidence/persistence/credit-consume acceptance now PASS. Earlier Deferred/BLOCKED entries below are historical. See [real Provider E2E acceptance](2026-10-31-reading-real-provider-e2e.md). Final Visual remains pending.

Starting Head: `483ba7db5f51a72de8eec2b0037105c45ad28941`.
Branch: `integration/quickiching-ui-redesign`; no main merge, second PR, deployment, database migration, dependency, environment requirement, Header/Footer or global CSS change.
Final Head is reported in the delivery message (a commit cannot embed its own hash).

Engineering implementation: complete. Full **BUSINESS / API / DATA FLOW READY acceptance remains deferred** until a real Provider generation and semantic reviewer run succeeds. The existing staging configuration returned HTTP 401 Authentication Fails. No real model output, semantic reviewer success, production credit consumption, or production account acceptance is claimed. This is not FINAL VISUAL COMPLETE.

## Unique runtime data flows

Free: Three Coin / Yarrow / Mei Hua completed cast → `completed-public-reading` handoff → `/readings/result?session=id` → existing authenticated save/reveal gate → the same `POST /api/readings` → owner-scoped shared `ReadingPage` loader → existing `PublicReadingResult` → `buildStaticReading` with existing interpretation/classical knowledge. Method is metadata. No free AI endpoint or second knowledge store.

Free presents top CTA → concise Overall → Primary → actual changing lines → Relating/Still → semantic Transition → bottom CTA. Short meaning is the first sentence of existing authoritative prose; full prose stays in the knowledge store and `/hexagrams/[slug]`. Overall names the current pattern, actual moving positions and direction. Transition uses existing transition/stability knowledge and the relating theme. Save/history and localization remain. Manual and browser-only historical alternate-method casts lacking source evidence retain Free and explicitly explain unavailable Deep saving.

Deep: dedicated `/readings/deep?session=id` → same owner-scoped loader/client, with no embedded Free report → existing `/api/readings/:castingId/deep` → locked database question + sealed normalized facts + authoritative knowledge + locale → existing reservation/job/workflow infrastructure → one v3 provider schema → evidence and reviewer gate → atomic result persistence and credit consume; failure/timeout releases reservation. No business enrichment, questionnaire, draft storage, scene or interpretation-goal input to the model. Deep initiation is an explicit button on the dedicated page; the Free CTA navigates there. Question is immutable. Cast Basis and full hexagram / Free links are deterministic.

Canonical pages exist in English and `/zh`. Both legacy `/readings/three-coin/result` URLs redirect to the canonical Free page. All four canonical page wrappers use one `ReadingPage` loader and one result client (its old internal filename is retained to avoid unnecessary churn). New-cast actions clear only the selected method's source session plus common completed handoff and return to that method.

## Deep API

`POST /api/readings/:castingId/deep`: authenticated, same origin, bounded body. Empty body / `{}` defaults to English; optional `{ "locale": "en" | "zh-Hans" }` only. Unknown keys, including contextNotes/options/constraints/concerns/interpretationGoal/question/facts, fail strict validation with 422. No trusted cast or question facts come from this request. Repeated calls reuse the job/completed result. New jobs return 202; completed results 200. Existing auth/ownership/risk/credits/rate-limit gates remain; legacy unfinished snapshots return 409 `LEGACY_DEEP_READING_READ_ONLY` and cannot generate.

`GET /api/readings/:castingId/deep`: owner-only, no-store status/result read, returning `not_started | queued | running | completed | failed | timed_out`, with applicable output, encrypted-snapshot-derived readable snapshot, errorCode and authoritative availableCredits. It does not initiate generation. Malformed completed output renders an explicit error; it cannot become an endless generation spinner. Polling remains non-overlapping and cancels on unmount.

## Sole newly generated report

```ts
{
  schemaVersion: "deep-reading-v3",
  readingVariant: "standard" | "still_hexagram" | "multiple_moving" | "all_lines_moving",
  directAnswer: string,
  whyThisReading: string,
  whatMattersMost: string[], // 1–3
  whatToDoNext: string[], // 1–3
  uncertaintyAndBoundaries: string,
  interpretiveBasisReferences: { evidenceId: string }[],
  disclaimer: string
}
```

Question and Cast Basis are never model-generated. Prompts forbid invented tenure, employer circumstances, skills, offers, motives or other circumstances not in the locked question. Reviewer must pass schema, safety, fact consistency, question relevance, noInventedUserFacts, evidence grounding, interpretive coherence, actionability, uncertainty and language consistency. A false or missing gate blocks completion. To avoid rewriting storage, `noInventedUserFacts` is explicitly persisted in the existing `context_fidelity_pass` database column under reviewer-v3; the old enrichment-fidelity semantics are retired.

## Legacy read-only

Snapshot read/decrypt/hash supports historical context-v1 and new context-v2; only context-v2 can enter a new generation. Historical deep-reading-v2 and commercial-reading-v1 reports have strict read parsers and read-only rendering. No new v1/v2 report is produced. Existing unfinished v1 queued/running jobs are failed and their reserved credit released before any retry could call the new provider with old context. Existing completed reports remain readable, with legacy content preserved.

## Acceptance coverage ledger

Original requested sections = 21 = 19 pass + 2 deferred + 0 confirmed reject + 0 unreviewed. Deferred does not mean rejected.

| Section | Status | Evidence / remaining condition |
|---|---|---|
| 1 Sole Reading system | PASS | One public result, one shared page loader/client, one generation endpoint/provider path; legacy URL redirects |
| 2 Unified casting handoff | PASS | Three method tools use the common completed-reading handoff and save API |
| 3 Free structure | PASS | 3 methods × still/single/multiple/all component matrix; links and two CTA |
| 4 Retire encyclopedia main path | PASS | Runtime component omits Judgment/Image/source/position hint/support/caution/reflection/multiple synthesis blocks |
| 5 Free data | PASS | Same static knowledge; derived shortMeaning/overallReading/transition; no AI call |
| 6 Question-centered Deep | PASS | Separate page, locked question and deterministic basis |
| 7 Context enrichment retired | PASS | Form, draft storage and request validation removed from active client |
| 8 Existing API revised | PASS | Strict locale-only POST; GET remains read/status; route tests |
| 9 Three methods | PASS | Real temporary PostgreSQL snapshots/reservations and normalized method save tests |
| 10 New AI input | PASS | Provider/reviewer payloads omit enrichment, scene, goal; server snapshot derives question/facts/knowledge |
| 11 No invented real circumstances | DEFERRED | Prompt + fail-closed noInventedUserFacts gate tested; real semantic negative controls blocked by Provider 401 |
| 12 Four content layers | PASS | Rendered browser component test checks all four and no embedded Free page |
| 13 v3 report schema | PASS | Strict active schema; array bounds and evidence validation tests |
| 14 Frozen IA interpretation | PASS | No duplicated situation/opportunities/challenges/summary contract fields |
| 15 Prompt | PASS | Question/cast/knowledge/locale only; explicit no invented facts and safety/evidence rules |
| 16 Reviewer | PASS | New gates integrated; false noInventedUserFacts cannot finalize/consume; semantic quality tracked in section11 |
| 17 Old data | PASS | Legacy parser/rendering, snapshot crypto/hash and unfinished legacy release tests |
| 18 Commercial infrastructure | PASS | 25 real PostgreSQL integration files; reservation/consume/failure release/timeout/risk/integrity/ownership retained |
| 19 Design boundary | PASS | Existing styles reused as skeleton; no final art/background/motion/Header/Footer/global CSS work |
| 20 Full acceptance | DEFERRED | Engineering and simulated browser evidence obtained; real Provider/reviewer and production account acceptance not verified |
| 21 Git/report | PASS | Same PR branch; no main merge or second PR; exact changed files listed below |

## Retirement ledger

Original targets = 6 = 6 confirmed retire + 0 preserve-as-active + 0 deferred + 0 unknown. Positive evidence is the corresponding explicit user requirement and replacement runtime path.

| Target | Decision and evidence |
|---|---|
| PublicReadingResult encyclopedia blocks | Retired in place; sections3–5; same knowledge retained for details |
| Context questionnaire and session drafts | Deleted from active client; sections7–8 |
| v2 new generation and context fidelity gate | Retired; v3 schema and noInvented gate are exclusive; sections13,15–17 |
| Three-Coin-only Deep guard/history filter | Removed; all-method normalized facts and owner-scoped history tests; sections2,9,20 |
| RitualResultCard | Deleted; no remaining source imports/calls, replaced by concise existing public result; section1 |
| ChineseReadingResultView | Deleted; no remaining source imports/calls, same localized public result serves every method; section1 |

Counts reconciled after implementation. Underlying knowledge, historical reports, unrelated method sessions and commercial data were not deleted.

## Verification and evidence boundaries

- Unit suite: `bun run test`, 144 files / 967 tests passed, exit0.
- Real temporary PostgreSQL: `bun run test:postgres:serial`, 25 files / 160 tests, exit0; temporary database cleaned by existing runner. Includes ownership/deletion fences, HMAC/snapshot integrity, all three methods, reservation, atomic consume, provider/reviewer failure release, timeout, expired jobs and legacy queued/running retirement.
- `bun run typecheck`, `bun run lint`, `bun run build`, `git diff --check`: passed. Lint retains two existing unrelated no-img-element warnings in hexagrams-experience.tsx.
- `bun scripts/reading-business-browser.mjs`: actual React components in installed Chrome; explicitly simulated GET/POST/Provider results. Tests all three methods, two Free CTA, no questionnaires, locale-only POST, four v3 sections, Free link and malformed-result error.
- With `READING_TEST_BASE_URL` pointing to a local production Next server, that script also tests actual English/Chinese canonical empty routes, legacy redirect, no textareas and zero page errors. It does not establish a real authenticated commercial browser flow. The existing development CSP blocks Next's development unsafe-eval runtime; production build was used without changing CSP.
- Existing staging Provider request: HTTP401; live generation, semantic negative controls and actual model fact fidelity are NOT VERIFIED. No fake report or fallback was persisted as live evidence.
- Independent static review found malformed-completed-output spinner and method restart defects; fixed and covered by browser/reset tests. Reviewer quota prevented the final independent rereview; final rereview was performed locally by the implementing agent. No independent final approval is claimed.

## Pure visual work still waiting for the formal design

Final background/decorations, art, motion, exact card arrangements, typography/spacing fidelity, responsive pixel matching and screenshot/overlay closeout remain pending. The two provided references are IA only. Historical visual capture scripts/selectors are not a final-design acceptance baseline for this new skeleton.

## Changed files

- `docs/reports/2026-10-31-reading-business.md`
- `docs/superpowers/plans/2026-10-31-reading-business.md`
- `scripts/fixtures/reading-business-entry.tsx`
- `scripts/reading-business-browser.mjs`
- `scripts/run-semantic-eval.ts`
- `src/app/(default)/readings/deep/page.tsx`
- `src/app/(default)/readings/result/page.tsx`
- `src/app/(default)/readings/three-coin/result/page.tsx`
- `src/app/(localized)/zh/readings/deep/page.tsx`
- `src/app/(localized)/zh/readings/result/page.tsx`
- `src/app/(localized)/zh/readings/three-coin/result/page.tsx`
- `src/app/api/readings/[castingId]/deep/route.test.ts`
- `src/app/api/readings/[castingId]/deep/route.ts`
- `src/app/api/readings/route.test.ts`
- `src/app/api/readings/route.ts`
- `src/components/account/my-readings-page.test.tsx`
- `src/components/account/my-readings-page.tsx`
- `src/components/public-reading/mei-hua-tool.tsx`
- `src/components/public-reading/public-reading-result-concise.test.tsx`
- `src/components/public-reading/public-reading-result-kicker.test.ts`
- `src/components/public-reading/public-reading-result.tsx`
- `src/components/public-reading/ritual-result-card.tsx`
- `src/components/public-reading/three-coin-tool.tsx`
- `src/components/public-reading/yarrow-tool.tsx`
- `src/components/three-coin-result/chinese-reading-result-view.tsx`
- `src/components/three-coin-result/commercial-reading-report-view.tsx`
- `src/components/three-coin-result/reading-page.tsx`
- `src/components/three-coin-result/three-coin-result-client.test.tsx`
- `src/components/three-coin-result/three-coin-result-client.tsx`
- `src/components/three-coin-result/unified-reading.test.tsx`
- `src/domain/generation/deep-reading-contract.test.ts`
- `src/domain/generation/deep-reading-contract.ts`
- `src/domain/public-reading/free-presenter.test.ts`
- `src/domain/public-reading/static-reading.ts`
- `src/final-engineering-closeout.test.ts`
- `src/lib/completed-public-reading.test.ts`
- `src/lib/completed-public-reading.ts`
- `src/lib/seo.ts`
- `src/server/cp5-remediation.integration.test.ts`
- `src/server/cp6-repair.integration.test.ts`
- `src/server/db/readings-postgres-idempotency.integration.test.ts`
- `src/server/generation/ai-sdk-provider.test.ts`
- `src/server/generation/ai-sdk-provider.ts`
- `src/server/generation/deep-reading-knowledge.test.ts`
- `src/server/generation/deep-reading-service.integration.test.ts`
- `src/server/generation/deep-reading-service.ts`
- `src/server/generation/types.ts`
- `src/server/loaders.test.ts`
- `src/server/loaders.ts`
- `src/server/workflows/deep-reading-steps.ts`
- `src/server/workflows/deep-reading-workflow.test.ts`
