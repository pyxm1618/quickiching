# PR #76 Unified Reading business closeout

> Final status update: the user subsequently supplied the authenticated staging account; real generation/reviewer/evidence/persistence/credit-consume acceptance now PASS. Earlier Deferred/BLOCKED entries below are historical. See [real Provider E2E acceptance](2026-10-31-reading-real-provider-e2e.md). Final Visual remains pending.

Starting Head: 3f02bf3fd901e5ec9eec58008db158bfd5f768e5.

## Coverage ledger (before edits)

Task total=3: pass=0, deferred=0, confirmed reject=0, unreviewed=3.

Runtime audit target total=5: confirmed retire=1, preserve=4, deferred=0, unreviewed=0.

| Target | Decision | Positive evidence |
|---|---|---|
| Deep route UNSUPPORTED_CAST_METHOD branch | Retire | No active Deep service/worker throws this code; normalized facts accept three supported methods |
| Casting-service three_coin guard | Preserve | It validates the coin casting operation itself; not a Deep eligibility check |
| Historical v1/v2 parser/renderer and snapshot union | Preserve | Explicit historical read-only compatibility, not new generation |
| context_fidelity_pass DB column and Drizzle name | Preserve | Existing storage column records noInventedUserFacts under reviewer-v3; schema cannot change |
| Missing-knowledge provider/reviewer checks | Preserve | Active validation of authoritative knowledge/locked question, not enrichment requirements |

## Provider investigation ledger

- Prior local evaluator source: /Users/milushangdi/Projects/quickiching/.env.staging.tmp.
- Its AI_GATEWAY_API_KEY, model names and DATABASE_URL are literal [SENSITIVE] placeholders, not usable secret values.
- Existing evaluator also force-overrides endpoint/model/token limits to DeepSeek defaults; this is not faithful observation of the deployed environment.
- Therefore prior HTTP401 is established for a local request using a redacted placeholder; it does not establish invalid deployed credentials.
- Verified staging project: quickiching-staging / prj_iKtw9xKmIlEfe44gEocgLr2QDLfE / team_z1b9TTQtbNkr43dzs5JVJPnQ.
- Verified staging alias deployment before work: dpl_8oCCFRTaekqKzmi4ZfCY47Pn8Enk, READY, target=production, SHA05435e9faa8ae406d337bca2a4caf55f49d4469c.
- Production here is the Vercel environment scope of the separate staging project, not www.quickiching.com.
- Read live Vercel non-secret config via individual environment API: AI_ADAPTER_MODE=ai-sdk; both base URLs=https://api.deepseek.com/v1.
- AI_GATEWAY_API_KEY, AI_MODEL_DEEP_READING, AI_MODEL_OUTPUT_REVIEW are sensitive entries in production scope. Vercel returns no value and decrypted=false for them. No replacement value is inferred.
- Active adapter selects OpenAI-compatible chat for this endpoint: https://api.deepseek.com/v1/chat/completions. Installed OpenAI SDK sets Authorization: Bearer <configured key>. Gateway name on metadata alone does not route this call through Vercel AI Gateway.
- Current recent runtime log read found no matching Deep logs; older 24h query is outside Hobby retention, not evidence of no errors.
- Real E2E: pending usable authenticated staging account/credit and exact candidate deployment. No mock result may close this gate.

## Changes and verification

- Deleted only the impossible active route UNSUPPORTED_CAST_METHOD mapping. No new method restriction, active enrichment error, or v1/v2 generation switch exists in the unified service/worker/provider/client path.
- Historical schemas/renderers/snapshot reads, casting-operation guards and DB columns were preserved.
- Corrected semantic evaluator: no forced provider/model/limit overrides; redacted or missing key/model values fail before outbound calls; importing the evaluator has no execution side effect; failure logs omit SDK request/secret/private-body objects.
- Added functional environment-loader regression tests using disposable local temp fixtures. 23 focused tests passed; full145 files/970 tests passed; PostgreSQL25 files/160 tests passed; lint zero errors/two existing unrelated no-img warnings; production build passed; git diff --check passed.
- Running typecheck alongside build caused generated .next/types file competition. This was an execution-order issue, not a product code issue; typecheck is rerun independently after build.
- Planned staging-only diagnostic: use the candidate Git SHA and the staging project's existing Production-scope secrets for an authenticated read-only /models call during deployment build. Report only endpoint, HTTP status, secret-presence flags and model match. No secret value is printed or changed. This is not a report-generation/E2E PASS.

## Final observed staging state

- Candidate code commit: 572f76d58f77e7409a45780707593c4d0fb85ca3.
- Deployment: dpl_EA43nfHZnf2B8eDK7h3yjp4QhnnG, READY, verified again through the staging.quickiching.com alias, same exact code SHA.
- Repository vercel.json takes precedence over the deployment-only proposed build command: logs show bun run build and zero QIC_PROVIDER_AUTH_HTTP events. The proposed read-only auth probe DID NOT RUN. No Provider HTTP result is inferred from successful deployment.
- Existing staging COMMERCIAL_V2_AUTH_ENABLED and COMMERCIAL_V2_PAID_DEEP_READING_ENABLED are both true in the correct Production scope; unchanged.
- Staging readiness returns HTTP200/ready; this is configuration/readiness evidence only, not Provider evidence.
- No new endpoint, Auth bypass, fallback Provider, model replacement, fake report, secret rotation/export, schema or migration was introduced.
- No authenticated staging account with verified available credits was obtained for this task. A user-input request is pending. No real /deep generation POST was sent and no report/job/reservation was created by this acceptance run.

## Root cause and exact blocker

The reproducible previous HTTP401 was caused by using the literal redacted placeholder [SENSITIVE] as AI_GATEWAY_API_KEY in a LOCAL evaluation request to DeepSeek. The evaluation script also substituted endpoint/model defaults rather than preserving supplied configuration. This is a local validation-input/tooling defect, corrected in this patch. It is NOT proof that the deployed staging key is expired, missing, or wrong.

For a local evaluation, AI_GATEWAY_API_KEY must be a usable credential for the configured DeepSeek-compatible endpoint, and the two AI_MODEL_* values must be actual provider-native model IDs. Redacted export markers are not valid values. For the live staging project, the required scope is quickiching-staging / Vercel Production, not the main production site's environment or Preview scope. The sensitive variables exist in the correct scope, but the connector returns no value/decrypted=false. Consequently their actual contents, age/validity and exact model-name match remain unverified; there is no evidence justifying replacement or a supplier change.

Current acceptance is **BLOCKED BY STAGING PROVIDER AUTH / authenticated E2E access**, meaning no usable real credential execution/account path was available to complete the requested test. This label does not assert that the deployed Provider itself returned 401 in this turn. Final real Provider HTTP status: **NOT OBSERVED**. Historical local placeholder request: HTTP401. Fixed evaluator now rejects that placeholder before networking with SEMANTIC_EVAL_SECRET_UNAVAILABLE: AI_GATEWAY_API_KEY.

## Real E2E ledger — no synthetic completion

| Required observation | This run |
|---|---|
| casting method | NOT RUN |
| locked question | NOT CREATED; intended semantic case is the user-specified job-change question |
| primary / changing lines / relating | NOT CREATED |
| POST /deep status | NOT SENT with an authenticated staging session |
| reservation created | NOT VERIFIED |
| generation job status | NOT CREATED by this run |
| real Provider HTTP / generated result | NOT OBSERVED |
| real reviewer / noInventedUserFacts | NOT RUN |
| report schema from real generation | NOT GENERATED; active code contract remains deep-reading-v3 |
| evidence resolution from real report | NOT RUN |
| persist / consume | NOT RUN |
| credit before / after | UNKNOWN / UNKNOWN |
| GET /deep completed output / page display | NOT RUN |

BUSINESS / API / DATA FLOW READY remains **Deferred**, not PASS. Provider failure/reviewer failure/timeout release regressions pass in the real temporary PostgreSQL suite, but those tests do not replace the missing real success run.

## Final tests and coverage reconciliation

- Relevant route/provider/environment-loader tests: 23 PASS.
- Full unit suite: 145 files / 970 tests PASS.
- PostgreSQL serial integration: 25 files / 160 tests PASS.
- Typecheck: PASS when rerun after build. The first concurrent attempt raced generated .next/types and is not counted as a product failure or a pass.
- Lint: zero errors, two existing unrelated no-img-element warnings.
- Production build: PASS locally and on the exact staging code deployment.
- git diff --check: PASS.
- No UI, algorithms, 72-hour lock, Auth, History structure, Payment, database schema/migration, Header/Footer/global CSS, art or motion files changed.
- Final task ledger: original3 = pass2 (active residue cleanup and PR status correction) + deferred1 (real Provider/reviewer/evidence/credit E2E) + confirmed reject0 + unreviewed0.
- Runtime audit ledger after edits: original5 = confirmed retire1 + preserve4 + deferred0 + unreviewed0. No unreviewed item was deleted.

## Changed files

- src/app/api/readings/[castingId]/deep/route.ts — one unreachable active error mapping removed.
- scripts/run-semantic-eval.ts — faithful environment loading, fail-fast placeholders, safe error metadata and import guard.
- src/server/generation/semantic-eval-config.test.ts — regression coverage for config preservation and placeholder rejection.
- docs/reports/2026-10-31-reading-business-closeout.md — this evidence/coverage/blocker record.

PR #76 retains its earlier UI redesign and performance material, with prior-head results labeled historical. Its current status states one Unified Reading flow, all three methods, no active enrichment, v3-only new generation, legacy read-only, Final Visual pending, and Real Provider E2E unverified. The final documentation commit's exact Head is read back into the PR description and delivery message; the runtime code deployed to staging is the identical 572f76d code above.
