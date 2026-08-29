# Commercial V2 CP6 Repair Design

## Goal

Repair the CP5/CP6 commercial baseline so CP6 can pass code gates and then complete a real staging-only commercial acceptance run. Production remains a hard no-go.

## Source and branch boundary

- Authoritative source commit: `07a168d219e134dadffdd8c2ed3ca0e3bef0bc95` from `origin/codex/commercial-v2-cp6`.
- All implementation work occurs on `codex/commercial-v2-cp6-repair`, created directly from that SHA.
- Do not merge during this work.

## Database and migration boundary

- Existing migrations `drizzle/0000_*` through `drizzle/0010_*` are immutable.
- Any schema change must be forward-only in a new `0011_*` or later migration.
- CP6 migration integrity must validate the complete ordered migration sequence and content hashes, not timestamps alone.
- Staging migrations occur only after application and CI gates pass.

## P1 repair scope

1. Readiness must require all six Commercial V2 capabilities to be requested and enabled.
2. Readiness must require the complete 24-table `databaseSchema` persistence surface.
3. Readiness must verify the complete Drizzle migration sequence and hashes against the database migration log.
4. Middleware must permit only the exact `/api/account/delete` route when Auth is enabled; the generic `/api` deny-by-default boundary remains intact.
5. Account history and entitlement balance loaders must fail closed on PostgreSQL query errors when PostgreSQL mode is configured. In-memory fallback is permitted only when PostgreSQL mode is not configured.
6. Deep Reading reservations must inherit the selected entitlement batch expiration and have an initial lease expiration bounded by that batch expiration.
7. Before persisting a Deep Reading result and consuming a credit, finalization must re-check `lifecycle='revealed'`, `risk_status='allowed'`, and cryptographically verify the cast-result HMAC.
8. Refund-before-order processing must defer retries by advancing `available_at`, preventing one dispatcher loop from consuming all attempts. A dead-letter or otherwise unresolved early refund must block a later payment grant rather than allow credits to be issued silently.

## P2 repair scope

- AI generation and review calls must use real abort timeouts.
- Reconcile must enforce its budget around individual outbox work, not only between coarse phases.
- CP6 GitHub workflow must trigger for the repair path/PR base as required and include build plus integrity gates. Live staging/provider/browser gates are separate post-code gates and must not be faked in CI without the required authenticated environment.
- Public `/api/ready` must expose only coarse status; detailed dependency/table data stays server-internal.
- `/pricing` must present the Commercial V2 purchase entry only when checkout is actually enabled; Public V1 behavior remains safe when disabled.
- `git diff --check` must pass.

## Staging-only acceptance boundary

Only after layers 1 and 2 are green:

- Migrate and deploy the Vercel project `quickiching-staging` using its Production target. That project itself is the test environment.
- Never deploy or mutate the `ichingcoin` production project.
- Use only the staging database, Waffo Test products, staging test account(s), and test provider configuration.
- Validate login, checkout, Waffo webhook, credit grant, preview/AI, paid Deep Reading, credit consumption, workflow, refund, reconcile/cron, account surfaces, and finally account deletion using a dedicated disposable test account.
- No screenshots are required. Preserve HTTP statuses, structured results, before/after database state, and redacted provider event/order identifiers.

## Stop condition

Stop after repair code is committed, all code gates pass, `quickiching-staging` is migrated/deployed, the full commercial staging loop passes, and the Draft PR is updated. Do not merge and do not deploy production; await independent review.
