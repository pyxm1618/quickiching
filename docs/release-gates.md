# V2.1 Public Release Gates

This file records release-state evidence. It does not authorize release by itself.

## Rules

- Code-testable requirements must remain green in CI.
- External approvals G-01 through G-10 remain `blocked_external` until an accountable reviewer supplies dated evidence.
- Each approved gate must include non-empty `approvalEvidence` in `docs/prd-traceability.json`; environment variables alone never authorize release.
- `src/server/release/release-gates.ts` blocks public production startup while any gate lacks approved evidence.
- Yarrow and Mei Hua remain disabled unless both the archived gate evidence and the exact current ruleset version are present.
- Vercel Preview may be used for controlled real-provider smoke tests, but it is not authorization for a public production release.
- Public deployment remains prohibited while any G gate is blocked or production credentials, scheduler capacity, and smoke tests are incomplete.

## Current external blockers

| Gate | State | Required evidence |
| --- | --- | --- |
| G-01 | blocked_external | Two-person 64-hexagram mapping approval and approved checksum |
| G-02 | blocked_external | English classic source, license, attribution and takedown approval |
| G-03 | blocked_external | Domain approval for `yarrow-v1` steps, probability and golden sample |
| G-04 | blocked_external | Domain approval for `mei-hua-v1` calendar, leap month, zi hour, timezone and body/use rules |
| G-05 | blocked_external | Interpretation goldens for still, single, multiple and all-moving variants |
| G-06 | blocked_external | English AI quality, safety and cost evaluation |
| G-07 | blocked_external | Creem merchant and production product approval |
| G-08 | blocked_external | US legal review of terms, privacy, refunds, expiry and disclaimers |
| G-09 | blocked_external | Professional approval of emergency copy and regional resources |
| G-10 | blocked_external | Support mailbox, review staffing, three-business-day SLA, alerting and incident process |

## Production configuration gates

- `YARROW_RULESET_APPROVED_VERSION=yarrow-v1` may be set only after G-03 approval evidence is archived and the manifest gate is changed to `approved`.
- `MEI_HUA_RULESET_APPROVED_VERSION=mei-hua-v1` may be set only after G-04 approval evidence is archived and the manifest gate is changed to `approved`.
- Payment, authentication, email, Turnstile, AI Gateway, database and cron credentials must be operator-owned production values.
- `CRON_SECRET` must contain at least 32 characters and is validated when the Node.js runtime starts.
- Database migrations must run before application deployment; the runtime account does not perform DDL.

## Scheduler capacity gate

`vercel.json` intentionally schedules `/api/internal/generation/reconcile` every minute. That cadence supports generation outbox dispatch, five-minute job timeout reconciliation, expired rate-limit cleanup, and due account-content purging.

The currently connected Vercel Hobby plan rejects this schedule because it permits only daily Cron Jobs. This is an external infrastructure blocker. Do not change the schedule to daily merely to make deployment pass; use a Vercel plan that supports the required cadence or an approved external scheduler, then execute authenticated production smoke tests and archive their evidence.
