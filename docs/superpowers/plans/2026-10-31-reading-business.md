# Unified Reading Business Implementation Plan

Goal: evolve PR #76 in place into one method-independent Free / AI Deep Reading system. User's 21-section request is the binding specification. No main merge, second endpoint, second active report contract, new knowledge store, commercial-system rewrite, or visual closeout.

Starting head: 483ba7db5f51a72de8eec2b0037105c45ad28941.

## Task 1: Deep contract and generation pipeline
Change domain/generation/deep-reading-contract.ts, server/generation/{deep-reading-service,types,ai-sdk-provider,deep-reading-snapshot}, server/workflows/deep-reading-steps.ts and existing deep route plus their tests. New POST accepts only optional locale en/zh-Hans; derives locked question, normalized facts and knowledge on server. New snapshots omit enrichment and accept all supported methods. New reports are deep-reading-v3: directAnswer, whyThisReading, whatMattersMost (1-3), whatToDoNext (1-3), boundaries, evidence references, disclaimer and variant. Preserve decrypt/hash compatibility for read-only old snapshots/reports. Never generate old contracts or reuse old context for generation. Reviewer requires noInventedUserFacts and question-only fidelity. Preserve risk, ownership, reservation/consume/release, timeout, integrity and evidence gates. Add failing contract/provider/route tests before implementation; update integration scenarios for all methods and lifecycle failures.

## Task 2: Free presenter and component
Evolve existing PublicReadingResult using buildStaticReading and existing interpretation bundles. Add lightweight derived view model only if useful. Order: top deep CTA, overall, primary, actual changing lines, relating/still, transition, bottom CTA. Concise knowledge; remove old encyclopedia modules from runtime component. Preserve history save and localization. No CSS redesign. Test all methods, moving variants, links, same component and absence of retired modules.

## Task 3: Unified result navigation and independent deep page
Evolve existing result client/page loading, remove context draft/forms/validation entirely. Method metadata comes from persisted cast; local method tools persist through one normalized API and enter common result/free/deep routes. Deep page renders frozen question, deterministic cast basis, Free link and v3 four-section content. Historical v2/v1 render read-only. Preserve login/credits/history/risk/loading/error flows. Add focused client/route tests.

## Task 4: Verification and retirement audit
Run targeted tests, full unit suite, typecheck, lint, build and diff check as available. Inspect all formal entry points for three-coin restrictions, enrichment and old generation. Review final diff, fix findings, record exact evidence and limitations. Commit coherent final changes on existing branch; no merge/deploy.

## Coverage ledger
Original total: 4 implementation areas. pass=0; deferred=0; confirmed retire=0; unreviewed=4.
Item-level retirement decisions: PublicReadingResult encyclopedia sections replaced by concise presenter (user sections 3-5); context questionnaire/drafts/request contract retired (sections 7-8); v2 new generation retired but historical parser retained (13,17); three-coin generation gate retired (9). No other code is approved for deletion.

## Final progress
Task1 backend: implemented; 160 real PostgreSQL tests pass.
Task2 Free presenter: implemented; sole component, concise derived knowledge, all-method/variant matrix.
Task3 unified pages: implemented; canonical routes and shared loader/client, method-aware restart, locale-only request, explicit invalid/legacy states.
Task4 verification: engineering checks pass; real Provider semantic acceptance deferred on 401. Full coverage ledger is in docs/reports/2026-10-31-reading-business.md.
Original implementation areas=4; pass=3; deferred=1 (real Provider verification); confirmed reject=0; unreviewed=0. No unknown items were deleted.
