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

The default `vercel.json` is intentionally Preview-safe and does not provision Cron Jobs. Vercel invokes Cron Jobs only for production deployments, while plan validation can still reject a Preview deployment that contains an unsupported production schedule.

`vercel.production.json` is the only repository configuration that provisions `/api/internal/generation/reconcile`, with the required `* * * * *` schedule. That cadence supports generation outbox dispatch, five-minute job timeout reconciliation, expired rate-limit cleanup, and due account-content purging.

The currently connected Vercel Hobby plan cannot accept the required one-minute schedule. This remains an external infrastructure blocker. Do not change the production schedule to daily merely to make deployment pass. Upgrade to a plan that supports the required cadence or use an approved external scheduler.

A production deployment must be performed through the reviewed release process with `vercel deploy --prod --local-config vercel.production.json`. A normal Git integration deployment that reads only `vercel.json` is not an approved production release path because it would omit the required scheduler. After provisioning, execute authenticated scheduler and provider smoke tests and archive their evidence.
