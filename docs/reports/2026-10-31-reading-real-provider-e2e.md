# PR #76 real staging Deep Reading acceptance — PASS

Date: 2026-10-31 (Asia/Shanghai).
Original business-closeout Starting Head: `3f02bf3fd901e5ec9eec58008db158bfd5f768e5`.
Resumed verification Starting Head: `1322b160b6c71f70b659538acd692e488fb8423e`.
Deployed runtime code: `572f76d58f77e7409a45780707593c4d0fb85ca3`.
Deployment: `dpl_EA43nfHZnf2B8eDK7h3yjp4QhnnG`, READY, independently resolved through `staging.quickiching.com`.
Project: `quickiching-staging`; its Vercel Production scope is the separate staging environment. The main production site was not changed.

## Final verdict

**BUSINESS / API / DATA FLOW READY: PASS for the requested real staging acceptance run.**

The user supplied a logged-in staging account and explicitly authorized consumption of one credit. This supersedes the earlier access blocker. The run used the normal casting UI, normal Free-to-Deep navigation, the existing authenticated POST/GET APIs, real deployed AI provider/reviewer, and the unchanged reservation/job/consume system. No fixture, mock provider, hardcoded report, new endpoint, test entitlement grant, new fallback, secret overwrite, or database write outside the normal app flow was used.

Final Visual remains NOT COMPLETE. This is business verification, not visual approval, payment-provider acceptance or refund acceptance.

## Observed real run

| Observation | Result | Evidence class |
|---|---|---|
| Method | `mei_hua_current_time` | Actual UI and saved server facts |
| Locked question | `Should I change to a new job?` | User-specified generic test question; entered before casting and recovered unchanged from encrypted server snapshot |
| Primary | 2 — The Receptive / 坤 | Actual Free, Deep Cast Basis and GET snapshot |
| Actual changing lines | position2, value6 | Actual deterministic facts; no other moving line |
| Relating | 7 — The Army / 师 | Actual deterministic facts and page |
| Line values bottom-up | `[8,6,8,8,8,8]` | Actual GET snapshot |
| Risk | allowed, risk-v3 | Actual encrypted snapshot read |
| Additional enrichment | absent | Actual snapshot has no context property; UI presented no questionnaire |
| Deep generation submission | one UI generation-button click | No second /deep POST was deliberately submitted; subsequent operations were reads/navigation |
| POST status | Accepted; new-job contract returns202 | Derived from the deployed new-job branch and observed automatic completed-result polling; the raw POST response body/status was not retained |
| Reservation | created and consumed | Proven by the mandatory reservation/lease check and atomic finalizer committed alongside the actual persisted result; raw reservation ID/row was not exported |
| Job / workflow | completed | Persisted result GET plus atomic finalizer completing generation_jobs and workflow_runs |
| Provider | real configured DeepSeek-compatible chat route | Live environment SDK URL, deployed OpenAI-compatible adapter, no fallback/mocked production path, actual generated/persisted response |
| Real reviewer | PASS; noInventedUserFacts=true required | Completion is impossible unless the real reviewer passes all mandatory flags; workflow and finalizer each enforce reviewDecisionPassed. Raw review row is not exported by GET |
| New schema | deep-reading-v3 | Actual output passed the original readingReportSchema locally |
| Evidence | PASS, five references, zero invalid IDs | Actual output revalidated by the original validateDeepReadingEvidence against its saved authoritative bundle/facts |
| Persist | PASS | Owner-scoped GET completed output, page reload and History revisit recover the same output |
| Credits | 7 before → 6 after | Account/Deep UI before; authoritative GET availableCredits after and after repeat read |
| Read recovery | PASS; output unchanged, balance remains6 | Deep reload → My Readings → same Free → same Deep, with no generation button on completed report |
| Four layers | Direct Answer / Why / What Matters Most / What To Do Next | All observed in rendered page; both arrays contain3 items |

The exact raw upstream HTTP status, native model IDs, POST response job/reservation identifiers and raw reviewer/ledger rows were not captured. They must not be fabricated. Upstream generation and review succeeded through the real SDK, so the former authentication blocker did not recur in this run. These transport/row-export limitations do not substitute synthetic data for the observed successful finalization. Reviewer/reservation/consume conclusions above explicitly identify their code-backed inference rather than claiming a direct SQL export.

## Real output semantic review

- Direct Answer addresses whether to change jobs conditionally; it does not prescribe an inevitable outcome or unconditional yes/no.
- Why integrates primary2, the actual second changing line and relating7. It does not invent other changing lines.
- What Matters Most and What To Do Next each contain3 focused items tied to roles, boundaries, dependable support and preparation.
- No assertion of years of employment, employer disrespect, an existing offer, salary increase, promised promotion, particular skills, or past work history was found.
- References to a possible role/offer are generic conditional decision criteria, not claims that an actual offer exists. Over-accommodation is discussed as the cast's symbolic caution, not established user biography.
- Boundaries explicitly state that the report does not know the user's current job, offers/options, finances, obligations, health or motives. The response is reflective/conditional and retains professional-risk boundaries.
- Real noInventedUserFacts PASS is established by the enforced reviewer gate in the actual completed persistence path. The implementing agent additionally read the actual report; this manual reading is not represented as another independent AI reviewer run.

## Exact evidence references

- `primary.line.2.classical`
- `primary.line.2.meaning`
- `primary.line.2.dynamic`
- `primary.challenge`
- `relating.core_meaning`

Every reference resolves to the saved bundle. Primary references are hexagram2; line references are position2; relating reference is hexagram7. No cross-hexagram or inactive-line citation was accepted.

Schema-parsed actual report SHA256: `ea82597047aa0c1f843287b6fc54f180c54ed1e227b5aec7f8da9a7d8c8227ea`.
Full actual GET payload is retained only in gitignored local `scratch/reading-live-e2e/completed-get.json`, mode0600. It is not committed. Public handoff records omit account email, auth cookies/tokens, secrets and unrelated reading/purchase history. The test cast identifier is withheld from this public record; the live result remains available in the authorized account's History.

## Provider401 resolution

The prior local401 came from sending the literal redacted `[SENSITIVE]` value as a provider key; the evaluator also forced DeepSeek defaults. The cleanup commit made evaluation configuration faithful and rejects unusable redaction markers before networking. No production-provider-layer rewrite, supplier/model replacement or fallback was necessary.

The existing deployed staging credential worked once the user supplied a real authenticated account for the normal runtime flow. No secret was read back, replaced or rotated. Exact effective model strings remain unexported because their Vercel env entries are sensitive. `AI_SDK_GATEWAY_BASE_URL` and `AI_GATEWAY_BASE_URL` were both verified as `https://api.deepseek.com/v1`; the active adapter uses OpenAI-compatible chat with `Authorization: Bearer <configured key>`. The nominal legacy provider label does not make this call a Vercel Gateway request.

Raw upstream HTTP code: NOT CAPTURED; successful real generation/reviewer/finalization observed. No fake HTTP200 is reported. The proposed previous build-time auth probe did not run and is not used as evidence.

## Verification and scope

- Original unchanged domain schema/evidence validator executed against the saved REAL response: PASS, zero invalid references.
- Fresh focused regression after this real run: 5 files /43 tests PASS (contract, provider, workflow, route and evaluator config).
- Same runtime-code full suite earlier in this closeout: 145 files /970 tests PASS; real temporary PostgreSQL25 files/160 tests PASS, including Provider/reviewer/timeout failure release.
- Same runtime code: typecheck, lint, build and git diff --check PASS; lint retains two unrelated existing image warnings. Staging build also passed.
- This resumed step changes acceptance documentation only. No algorithms, 72-hour rule, Free/v3 IA, Auth, History structure, Payment, schema/migrations, Header/Footer/global CSS or final visuals changed.
- Acceptance screenshot excludes the account header/email and documents real content only. It is not visual fidelity evidence.
- Original three closeout tasks now reconcile: total3 = pass3 + deferred0 + reject0 + unreviewed0. The previously deferred real success test is now passed.
- The runtime retirement audit remains total5 = retired1 + preserved4 + deferred0 + unreviewed0. Historical read-only code stays intact; no second active Reading flow was introduced.

The exact final documentation Head is read back into PR #76 and the delivery message after commit. No main merge or second PR is involved.
