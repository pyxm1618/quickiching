# PR #76 Unified Reading business closeout

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
