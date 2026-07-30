# V2.1 Release Runbook

## 1. Merge and migration order

1. Merge the stacked PRs in order: #1, #2, #3, #4, #8, #10.
2. Deploy a migration-capable release using the production `DATABASE_URL`.
3. Confirm `_app_migrations` contains `0000_v2_1`, `0001_auth_payments`, and `0002_jobs_release`.
4. Do not enable production adapter modes until the migration is complete.

## 2. Required production configuration

Validate all variables documented in `.env.example`. Production must use:

- `AI_ADAPTER_MODE=ai-sdk`
- `AUTH_ADAPTER_MODE=better-auth`
- `PAYMENT_ADAPTER_MODE=creem`
- `DATABASE_ADAPTER_MODE=postgres`
- `WORKFLOW_ADAPTER_MODE=vercel`
- HTTPS values for `APP_BASE_URL`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL`
- a 32+ character `BETTER_AUTH_SECRET`
- purpose-separated versioned key sets
- `CRON_SECRET` configured for Vercel Cron

Never expose server-only keys through `NEXT_PUBLIC_*` variables.

## 3. Key rotation

1. Add the new key version to the relevant readable key set.
2. Keep the existing cluster-wide write version unchanged.
3. For question fingerprints, wait at least the full 72-hour duplicate-lock window before switching the write version.
4. Deploy the new write version atomically across all application instances.
5. Keep the previous version readable until all encrypted/signed data that may reference it has expired or been migrated.
6. Verify `/api/ready` after every key/config deployment.

## 4. External provider setup

### Better Auth

- Register the production callback URL under `/api/auth/callback/google`.
- Confirm Google OAuth and Magic Link both create an `auth_users` row and an idempotent mirrored application `users` row.
- Confirm Magic Links expire after 10 minutes and fail on replay.

### Resend

- Verify the sender domain and `EMAIL_FROM` address.
- Send a production Magic Link and confirm no token appears in logs, analytics, or error reporting.

### Creem

- Configure product IDs for one, three, and five credits.
- Configure the webhook endpoint `/api/webhooks/creem`.
- Confirm the webhook secret matches `CREEM_WEBHOOK_SECRET`.
- Run one real test checkout and replay the same webhook; exactly one entitlement batch and one grant ledger entry must exist.

### Cloudflare Turnstile

- Configure the site key and secret for the production host.
- Confirm failed provider responses fail closed.

### Vercel Workflow and Cron

- Confirm Workflow is enabled for the project.
- Confirm the cron for `/api/internal/generation/reconcile` runs every minute with the configured `CRON_SECRET`.
- Confirm Outbox rows become dispatched and generation jobs progress through queued, running, and completed/failed states.

## 5. Pre-release verification

Required automated checks:

- `bun install --frozen-lockfile`
- `bun run lint`
- `bun run typecheck`
- `bun run test` with PostgreSQL 16
- `bun run build` without production credentials

Required manual checks in a production-like environment:

1. Complete and reload each casting method.
2. Verify anonymous users cannot read line values or results before reveal.
3. Reveal by Magic Link in a different browser and verify only the authenticated browser receives access.
4. Attempt the same normalized question twice inside 72 hours and verify the original casting wins.
5. Generate Preview and Deep Reading, refresh during execution, and verify state resumes from PostgreSQL.
6. Force an AI timeout and verify the reservation is released or revoked according to expiry.
7. Submit a quality review, supplement once, and verify terminal decision/compensation behavior.
8. Delete and restore a casting inside the recovery window; verify purge after the deadline.
9. Confirm logs contain IDs, epochs, statuses, latency, and provider request IDs but no question text, email, token, prompt, cookie, or secret.

## 6. Health and monitoring

- `/api/health` must return HTTP 200 without database access.
- `/api/ready` must return HTTP 200 only when PostgreSQL is reachable and migration `0002_jobs_release` is applied.
- Alert on readiness failures, webhook processing failures, generation timeout rate, late-result rejection rate, and entitlement identity violations.

## 7. Rollback

1. Stop new generation dispatch by disabling the reconciliation cron.
2. Keep PostgreSQL available; do not roll back destructive migrations.
3. Roll application code back to the previous verified deployment.
4. Leave new schema objects in place; all migrations are forward-compatible additions.
5. Reconcile running/queued jobs and reservations before re-enabling dispatch.
6. If a provider integration is failing, disable only that adapter at the deployment level and keep `/api/ready` failing until the production configuration is coherent.
