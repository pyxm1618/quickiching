# V2.1 Public Release Gates

This file records release-state evidence. It does not authorize release by itself.

## Rules

- Code-testable requirements must remain green in CI.
- External approvals G-01 through G-10 remain `blocked_external` until an accountable reviewer supplies dated evidence.
- A release gate cannot be changed to approved by changing configuration alone.
- Yarrow and Mei Hua remain disabled in production unless their approved ruleset environment variable exactly matches the current algorithm version.
- Public deployment remains prohibited while any G gate is blocked or production credentials and smoke tests are incomplete.

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

- `YARROW_RULESET_APPROVED_VERSION=yarrow-v1` may be set only after G-03 approval is archived.
- `MEI_HUA_RULESET_APPROVED_VERSION=mei-hua-v1` may be set only after G-04 approval is archived.
- Payment, authentication, email, Turnstile, AI Gateway, database and cron credentials must be operator-owned production values.
- Database migrations must run before application deployment; the runtime account does not perform DDL.
