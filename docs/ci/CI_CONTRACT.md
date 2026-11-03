# Quick I Ching CI Contract

## 1. Architecture

All ordinary pull requests to `main` use `.github/workflows/ci.yml`.

Stable jobs:
- `CI / Core` — diff hygiene, CI self-tests, migration integrity, lint, typecheck, unit, build, Drizzle metadata.
- `CI / Database` — ephemeral PostgreSQL and the current forward migration/integration suite when database-affecting paths change.
- `CI / Product` — path-selected Reading, Public/SEO, Account/Info, and Payment gates.
- `CI / Performance` — stable asset budgets plus targeted Lighthouse only for affected pages.
- `CI / Required` — fails if any required job fails; unrelated domains may no-op but still publish a stable context.

`push -> main`, manual dispatch, and pull requests whose head is `integration`/`integration/*` or `release`/`release/*` force FULL mode to catch integration and release-composition failures.

## 2. Required checks

Target long-lived ruleset contexts:
- `CI / Core`
- `CI / Database`
- `CI / Product`
- `CI / Performance`
- `CI / Required`

Historical CP5/CP6/Group3/Ritual/Public SEO contexts are transitional only. Do not remove them from the ruleset until the new contexts have run successfully on a real PR and the owner has switched the ruleset.

Production-database state is not a PR requirement. Production migration/readiness actions belong to explicit OPS/RELEASE workflows.

## 3. Domain trigger matrix

| Change | Core | Database | Reading | Public/SEO | Account/Info | Payment | Performance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DB/API/server persistence | always | yes | impact-based | impact-based | impact-based | impact-based | usually no |
| Three-Coin/Reading | always | if persistence | yes | if public routing/SEO | if shared account/history | no | yes |
| Info/guides | always | no | no | yes | yes | no | yes |
| Account/My Readings | always | if persistence | no | if public route shared | yes | no | yes |
| Payment/refund/reconcile | always | yes | no | no | no | yes | client-only |
| package/lock/config/workflow/global CSS/shared layout/core routing/shared Reading architecture/DB schema/migrations/Auth core | always | FULL | FULL | FULL | FULL | FULL | FULL |

The executable source of truth is `scripts/ci/select-gates.mjs`; `scripts/ci/select-gates.test.mjs` proves the required trigger cases.

## 4. Product contract ownership

CI protects approved product rules, not whatever the current implementation happens to do.

When a product rule changes:
1. update the corresponding unit/browser contract in the same product PR;
2. update this CI mapping only if ownership/triggering changes;
3. never retain an obsolete assertion merely to keep a historical workflow green.

Known contract gap at this CI reset: a restored completed Three-Coin cast must continue to the completed Reading/auth-save gate, but current product code still requires a newly armed completion navigation. The corrected CI contract is intentionally allowed to expose this as a product failure; this CI PR must not repair the product behavior.

Database contract:
- historical migrations and their hashes are immutable;
- the current schema/readiness contract follows the latest migration manifest, not a permanently named historical migration;
- PRs prove migrations on ephemeral PostgreSQL;
- Production DB inspection/apply belongs to release/ops only.

## 5. Performance source

`config/performance-gates.json` is the machine-readable authority for:
- Lighthouse / Chromium / Puppeteer versions;
- page and device targets;
- hard thresholds;
- regression tolerance;
- warmup and sample policy.

`scripts/performance-budget.mjs` and `scripts/ci/lighthouse-gate.mjs` consume this source. Do not lower thresholds to make CI pass.

Screenshot artifacts are manual visual evidence only. A generated screenshot is not a Pixel/Visual PASS.

## 6. Ops workflows

The existing staging migration, staging diagnostics, emergency cleanup, staging environment preflight, and Production schema/environment audit workflows are operational/release tools, not ordinary PR CI. Keep them outside required PR contexts. Their historical CP6/payment names may remain only during the ruleset transition; when renamed, preserve explicit manual dispatch and safety locks.

## 7. Adding future tests

Do not add one workflow per feature or PR. Put a new test into the owning Domain Gate unless it creates a genuinely long-lived new domain.

Before merging a product-contract change, answer:
- Which approved rule does this test protect?
- Which domain owns it?
- Which paths must trigger it?
- Does a shared/core change require FULL mode?
- Is this automated functional evidence, performance evidence, or manual visual evidence?

Never use `test.skip`, `.only`, `continue-on-error`, or reduced thresholds to manufacture a green required gate.

Dependency security uses `config/security-audit-baseline.json` as a regression baseline for pre-existing high/critical advisory IDs. Existing debt remains visible in every Payment/Full audit, newly introduced advisory IDs fail the gate, and baseline additions require explicit security review.

## 8. Legacy workflow transition inventory

| Workflow | Classification | Transition |
| --- | --- | --- |
| `cp5-commercial-v2.yml` | CONSOLIDATED | Historical phase gate; retire after ruleset cutover. |
| `cp6-commercial-v2.yml` | CONSOLIDATED | Transitional only because the active ruleset still requires its old contexts; retire after cutover. |
| `group3-account-info-visual-qa.yml` | CONSOLIDATED | Browser/responsive evidence now belongs to Product; screenshots remain manual evidence only. |
| `payment-closeout-security.yml` | CONSOLIDATED | Dependency/secret checks now belong to the Payment domain. |
| `public-seo-v1.yml` | CONSOLIDATED | Transitional old required browser/Lighthouse context; retire after ruleset cutover. |
| `ritual-closeout-visual-qa.yml` | CONSOLIDATED | Reading/browser/performance coverage now belongs to stable domain gates. |
| `cp6-staging-emergency-cleanup.yml` | OPS-ONLY | Manual dispatch only. |
| `cp6-staging-migrate.yml` | OPS-ONLY | Manual dispatch only. |
| `cp6-staging-preflight.yml` | OPS-ONLY | Manual dispatch only. |
| `cp6-staging-runtime-diagnostics.yml` | OPS-ONLY | Manual dispatch only. |
| `payment-closeout-production-env-audit.yml` | OPS-ONLY | Explicit Production release/inspection workflow; never a PR required gate. |
| `payment-closeout-staging-preflight.yml` | OPS-ONLY | Manual dispatch only. |

No legacy workflow is deleted before the ruleset cutover. The safe order is: run new and old contexts in parallel, validate the new contexts, switch the ruleset, then remove the consolidated legacy workflows.
