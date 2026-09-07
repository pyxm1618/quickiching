# Quick I Ching Payment Closeout Runbook

Status: payment-closeout branch contract. This document describes the Commercial V2 one-time credit-pack system only. It does not introduce subscriptions.

## Product truth

Quick I Ching sells one-time reading-credit packs:

- `one`: 1 credit, local catalog USD 2.99
- `three`: 3 credits, local catalog USD 6.99
- `five`: 5 credits, local catalog USD 9.99

The browser is never authoritative for product ID, amount, currency, payment status, entitlement grant, refund eligibility, or refund status. Before enabling a Waffo deployment, authenticated provider reads must confirm the configured provider product IDs and their amount/currency mapping for all three packs.

## Environment contract

`APP_ENV` is the deployment-stage authority at the provider boundary:

- `development`, `test`, `staging` require `WAFFO_ENVIRONMENT=test`
- `production` requires `WAFFO_ENVIRONMENT=prod`

When `NODE_ENV=production`, `APP_ENV` must be explicit. A mismatched Waffo environment fails closed. Test and production credentials/product mappings must remain isolated.

Required Waffo configuration is server-only: merchant ID, private key, store ID, selected-environment product IDs, and checkout URL encryption keys. Never place them in `NEXT_PUBLIC_*` values.

## Checkout and payment authority

Checkout uses a stable client transaction request ID stored per pack in `sessionStorage`. Retry, refresh, network timeout, rate limit, or HTTP 409 retains that request ID. It is cleared only after an authoritative checkout handoff or before authentication where no checkout could have been created.

The server owns product key -> quantity/amount/currency/provider-product mapping. Waffo checkout receives the internal payment order ID as the merchant order reference.

The return page never grants credits. Payment success comes only from:

1. a verified signed Waffo event; or
2. authenticated Waffo provider read used by missed-webhook recovery.

Both paths must strictly match environment, store, merchant order reference, buyer identity where supplied/required, provider order/payment identity, configured provider product ID, amount, currency, and one-time order relation.

## Webhook identity and replay

The signed Waffo payload `eventId` is the business-event dedupe identity. Delivery `id` is retained separately for delivery diagnostics.

Business uniqueness is `(provider, provider_environment, event_id)`. A duplicate event with the same canonical payload is a no-op. Reuse of the same business `eventId` with conflicting payload/type is fail-closed into a durable conflict and financial review.

Webhook verification uses the raw request body and the configured Waffo environment. Invalid signature, stale/future timestamp outside the locked SDK contract, wrong environment, wrong store, identity mismatch, or replay conflict never grants or revokes credits.

## Entitlement lifecycle

A successful paid order grants exactly the pack quantity once. Grant idempotency is protected by order identity, one entitlement batch per order, and the grant ledger business key.

A reading task follows:

`reserve -> generation -> success commit`

or

`reserve -> generation -> failure/timeout release`

Creating a task does not permanently consume a credit. Only a successfully finalized deep reading consumes one. Failed/timed-out work releases the reservation. Retry of the same task is idempotent and cannot double-consume.

## Missed-payment recovery

Reconcile runs authenticated Waffo payment reads before stale checkout cleanup. A provider-read success can settle the local one-time order and grant its entitlement without fabricating a webhook inbox row or event ID. `not_found`, pending, ambiguous, multiple, or contract-mismatched provider results do not grant credits and remain fail-closed/reviewable.

## Refund policy

User policy:

1. user applies within 7 days of paid time;
2. automatic screening records eligibility and credit-availability state;
3. a human operator makes the final approve/reject decision;
4. only an approved, still-safe intent may cross the provider-write fence;
5. target operational handling is within 3 business days.

A browser refund request only creates/returns a local `refund_intent`. It never calls Waffo refund creation.

A request with partially consumed, reserved, or otherwise unavailable source credits is `manual_exception`. Quick I Ching does not invent prorated refunds or deduct unrelated credits. Operator approval of a manual exception is blocked until an explicit policy decision exists outside this closeout.

## Provider refund write fence

`REFUND_OPERATOR_SECRET` is a separate server-only Bearer credential for internal refund operator endpoints. It must not reuse `CRON_SECRET` and must never be exposed to the browser.

Approval and provider dispatch are intentionally separate operations. Immediately before dispatch, the repository re-locks the payment order, refund intent, and source entitlement batch and re-checks that the original credits remain fully available.

Before the Waffo POST, local state is durably changed from:

`not_started / attempt=0`

to:

`dispatched / attempt=1`

Only the worker that wins this fence may call the provider. Concurrent workers and every later retry are read-only.

The stable local refund intent UUID is sent as `refundTicketMerchantExternalId` and in Quick I Ching refund metadata. A confirmed provider response stores Waffo's refund-ticket ID but is not treated as final settlement unless provider state is final.

If the provider call times out, resets, loses its response, or local persistence fails after the provider may have accepted the request, the intent becomes `ambiguous / reconciliation_required`. There is no automatic second refund POST.

## Refund reconciliation and settlement

Ambiguous/dispatched/confirmed intents are reconciled by authenticated provider READ under a claim/lease. Provider network I/O occurs outside the database transaction. Applying a result requires the current lease token; a stale worker cannot settle after losing the lease.

Provider-read correlation must prove the local refund intent, payment/order identity, environment/store, full amount/currency, provider ticket/refund identity, and merchant correlation. Zero, multiple, mismatched, or contradictory records fail closed.

Webhook settlement and provider-read settlement call the same refund settlement core. Replay order is safe in all directions:

- webhook first -> later provider read is no-op/reference enrichment only;
- provider read first -> late webhook is no-op;
- repeated provider reads are no-op;
- concurrent webhook/provider-read may have one winner, but only one revoke ledger entry is allowed.

A successful full refund revokes only the still-available source entitlement batch and marks the order refunded. If the source credits changed after dispatch, the system enters financial review instead of revoking unrelated balance or creating a negative balance.

Reconciliation attempts are capped. Exhaustion moves the order to financial review while leaving the provider write attempt count at exactly one.

## Legacy refund safety

Do not infer new refund-intent correlation from legacy external references. Do not manually bind an unproven provider ticket, fabricate a webhook, or mark success by hand. If authenticated provider reads cannot prove a unique correlation, leave the record fail-closed for manual financial review.

## Waffo Test guardrail

For payment closeout, use at most one new clean Waffo Test payment/refund sample for the real refund E2E. If the first approved Test refund dispatch produces an ambiguous outcome and authenticated provider reads show zero refund tickets/refunds, stop. Keep the local intent `reconciliation_required`, verify that only one refund POST occurred, and do not create additional payments/refund samples to work around the provider Test behavior.

## Release validation

Before Commercial V2 payment activation:

- run migration integrity, lint, typecheck, unit, production build, Drizzle check, and serial PostgreSQL integration;
- run browser validation for login, pricing, checkout handoff/return, account purchase display, refund application, and operator flow;
- authenticate-read all 1/3/5 Waffo product mappings;
- execute one clean Waffo Test checkout only after explicit operator/user confirmation at the final Waffo pay action;
- prove successful generation consumes one credit and controlled failure releases one reservation;
- execute the refund path application -> auto-screen -> manual approval, then obtain explicit confirmation immediately before the operation that would issue the Waffo Test refund;
- keep production financial actions read-only unless separately authorized;
- inspect the latest PR head and resolve applicable high-priority review findings before merge.
