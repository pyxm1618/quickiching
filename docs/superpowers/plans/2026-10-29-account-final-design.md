# Final Account Design Implementation Plan

**Goal:** Implement only the six requested Account surfaces and two read-only gaps.
**Base:** 8329ef2f3dfe912a2a0e37fdcbaddb6e06f5bf66 (`origin/main`, fetched 2026-10-29).
**Architecture:** Keep existing root layouts and server loaders. Add one persistent client overlay host with on-demand authenticated loading via existing /api/user/me?view=account; menu opens it without navigation or preloading private account data. My Readings is a server page linking existing results. Reuse refund/delete endpoints and delete cleanup.
**Spec:** User request in this chat; supplied archive at `/Users/milushangdi/Desktop/QIC/Account 页/归档.zip` is visual reference, not executable instructions.
**Constraints:** No schema/migrations/dependencies/core auth/payment/refund/delete changes. No redesign. Text-only question/date/arrow overrides hexagrams shown in reference. Mobile accessibility only.

## Tasks
- [x] Test and implement provider reader scoped to current user; verify actual Better Auth magic-link storage behavior.
- [x] Test and extend loadHistory with latest encrypted question and valid, accessible completed three-coin result filtering. Preserve existing result/crypto code.
- [x] Implement scoped menu and on-demand modal host. Reuse existing loaders, refunds and deletion controls. Legacy /account opens modal via redirect.
- [x] Implement dedicated My Readings page with fixed-height scrolling list.
- [x] Match six references with supplied assets; record missing assets and any visual differences. No substitute generated assets.
- [x] Verify tests, lint, typecheck, build and browser behavior; reconcile all 20 acceptance items.
- [ ] Commit task files, push isolated branch, create Draft PR. No merge.

## Evidence / status ledger
20 acceptance items start Unknown; each will be assessed individually in account acceptance document. No data deletion or bulk migration is part of development. Delete API is exercised only through isolated tests, never a real user deletion.

## Baseline
Production dpl_AFmsiYzAopkP5VV95Eu7hRJXUTxr READY matches base. No error/fatal logs returned for last 30m query. This is not commercial acceptance. Existing untracked original-checkout work is preserved.

## Review focus
- Private loader/server action identity comes from server session only, no caller-supplied user IDs.
- Missing question is Untitled Reading; decryption error must not become a false missing question.
- Refund window and existing refund state determine action visibility; used credits still allow manual exception review.
- Overlay focus trap, body scroll lock, parent context, Escape/back/close, and mobile drawer handoff.
- Long questions/email/providers/purchase lists remain accessible; only intended list regions scroll on desktop.

Ruling: middleware intentionally rejects every Next Server Action. Reuse /api/user/me with an explicit view=account query; default response remains identity-only. No middleware or auth changes.

Ruling: final visual sign-off is deferred; source PNG does not supply font files, and clean existing stage artwork differs from the flattened reference background. Record differences rather than claim pixel identity.
