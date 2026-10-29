# Account UI acceptance — 2026-10-29

Branch: `codex/account-final-design`.
Initial base: `8329ef2f3dfe912a2a0e37fdcbaddb6e06f5bf66`.
Final rebased base: `de30a7a7a973aee1fdefcf69584332fc9645934e` (`origin/main`, refreshed during implementation).

## Coverage ledger

Original total **20 = 17 PASS + 3 DEFERRED + 0 REJECTED + 0 UNKNOWN**.
PASS below means the stated engineering condition was checked. It does not assert a production account session, real payment/refund, launch readiness, or user visual approval.

| ID | Requirement | State | Evidence / next action |
|---|---|---|---|
| 1 | Menu has only My Readings / My Account / Settings | PASS | Static tests and browser menu item equality; desktop and mobile drawer. |
| 2 | My Readings matches final reference | DEFERRED | Live screenshot attached. Fixed six-row viewport, question/date/arrow and hover treatment implemented. See visual differences below; final visual approval remains open. |
| 3 | My Readings uses real Question + Date | PASS | PostgreSQL latest-version integration uses actual production crypto. Browser reads encrypted fixture questions through real loader. Missing version -> Untitled Reading; crypto failure propagates. |
| 4 | One detail entrance per row | PASS | One Link per record; browser follows existing result URL and sees the question. |
| 5 | My Account matches final reference | DEFERRED | Live screenshot attached; single centered 828×800 CSS modal, decoration extraction and matching fixed regions. Exact typography/ornament differences remain below. |
| 6 | Email from actual user | PASS | Server session identity, authenticated existing API transport; arbitrary caller user ID ignored. Local browser identity independently read back. |
| 7 | Sign-in method from actual Auth data | PASS | Read-only accounts.provider_id scoped by server user; verified Magic Link/no-account-row representation handled. All associated providers retained. Active-session provider is not stored and cannot be proven by this field. |
| 8 | Credits from entitlement balance | PASS | Existing loadEntitlementBalance unchanged; isolated PostgreSQL has 3 fixture credits and browser displays 3. This is not payment evidence. |
| 9 | Official transparent coins | PASS | Byte-identical supplied antique-coins-clean.png; SHA256 manifest. |
| 10 | Purchase History from actual orders | PASS | Existing loadAccountPurchases unchanged; local real payment_orders fixtures displayed. Existing limit 25 retained. No invented production orders. |
| 11 | Existing /api/refunds | PASS | Existing POST implementation unchanged; frontend request observed at same endpoint. Browser 404 failure path displayed without assuming refund. Existing PostgreSQL refund regression suite passes; browser successful refund submission is NOT VERIFIED. |
| 12 | Refund is inner Account view | PASS | Same dialog count, same bounding box, same header and close; Back returns to primary view. Empty/whitespace reason disabled, gray-gold button. |
| 13 | Settings matches final reference | DEFERRED | Live screenshot attached; same frame, requested three sections and restrained danger semantics. Final visual approval remains open. |
| 14 | Delete is inner Settings view | PASS | Same native dialog and bounds; Settings title and subtitle persist; Back and close verified. |
| 15 | Existing delete endpoint | PASS | Real isolated POST /api/account/delete returned 200; profile erased, 0 sessions, 0 Auth accounts, 0 questions, 17 tombstoned fixture castings, 16 retained fixture orders read back. No live user deletion. |
| 16 | Exact DELETE required | PASS | Browser rejects empty, lowercase and leading/trailing spaces; enables only exact DELETE. |
| 17 | No nested Modal | PASS | Native dialog count equals 1 across primary and secondary views. |
| 18 | No unrelated product changes | PASS | Branch diff inspection and independent read-only code review. Main's hexagram knowledge changes are inherited base commits, not this patch. |
| 19 | No database migration | PASS | No drizzle/schema change, no new migration. Existing migrations ran only against disposable local test databases. |
| 20 | Build / lint / tests | PASS | Commands and counts below. |

## Data / transport decisions

- `src/server/account/sign-in-method-loader.ts` selects only `provider_id` and `email_verified` for the authenticated user. It never selects OAuth tokens. Better Auth 1.7.1 Magic Link creates a verified user and session without an accounts row, confirmed by installed implementation and isolated actual Magic Link fixture login. A verified user with no linked provider is rendered as Email (Magic Link); unknown/unverified identity stays Unknown. Existing associated provider rows are deduplicated without discarding unrecognized provider IDs.
- Sign-in method describes associated methods, **not the provider used by a specific session**. A Google-linked user who later uses Magic Link still has a Google account row; current session provider is not recoverable from these existing columns. No schema or Auth flow was changed to invent that evidence.
- `loadHistory` reads the latest `question_versions` by descending version number and passes the encrypted columns to existing `decryptQuestionForGeneration`. PostgreSQL reads only owned, undeleted, revealed Three-Coin sessions with a cast result; invalid six-line facts are excluded. The memory path uses existing result-access rules. The old 50-row history cap is removed because this view has internal scrolling with no pagination.
- The existing middleware rejects all Server Actions. Its rule is untouched. The existing `/api/user/me` gains only `?view=account`, authenticated with no-store/401/503 behavior. Normal Header requests remain identity-only. Existing balance and purchase loaders are invoked only on opening My Account.
- Purchase loader's existing 25-record cap, refund policy, entitlement logic, delete repository, Auth options and payment integrations are unchanged.
- Old `/account` and `/zh/account` links redirect to the existing home page with an open-modal intent; normal menu modal interactions preserve their current page and scroll context.

## Visual evidence and remaining differences

User-approved scope: crop only decoration-only regions from the final PNGs; no whole design screenshot or rasterized title/label/value appears in product UI. `asset-provenance.json` records source archive hash, crop rectangles, transforms and output hashes. All headings, labels, buttons, tables, forms, states and interactions are live components. Ordinary icons use the existing lucide dependency.

Desktop evidence uses Chrome at **1536×1024, DPR 1**; responsive checks use **390×844, DPR 1**. The My Readings reference is **1668×943**, so its entire-image geometry is not directly interchangeable with that desktop capture. Background pages remain the existing site context.

Remaining differences, **not certified pixel-identical**:

1. The archive contains no original font files or explicit font specification. Title text uses local Snell Roundhand / Apple Chancery; body uses Times New Roman / Songti. Glyphs, kerning and gold treatment differ from the flattened artwork, and script fallback can differ on other operating systems. Original licensed font assets/specification are needed for exact typography; no font dependency or global font system was changed.
2. Borders/clouds/paper/mountains are extracted decoration plus scoped CSS. A single frozen PNG cannot supply all independently layered ornament/glow details. Texture seams and border stretching remain visible in some large panels. No AI replacement artwork was introduced.
3. The supplied official transparent coins are used unchanged; their clean appearance differs from the glow composited into the flattened reference. They do not cover the credit label or primary action.
4. Existing site Header/footer/cookie-consent UI remain unchanged. My Readings reuses the existing clean approved ritual stage background; it is not the exact flattened room composition in the My Readings PNG. Replacing the site's unrelated shell is outside this patch.
5. The reference My Readings includes hexagrams and names. Those are deliberately omitted because the user's explicit text limits each record to Question, Date, arrow.
6. Missing/loading/error/empty data use plain text and existing form behavior. Mobile is accessible within the existing responsive base, without claiming a new approved mobile design.

Screenshots: [User Menu](screenshots/user-menu-desktop.png), [My Readings](screenshots/my-readings-desktop.png), [My Account](screenshots/account-desktop.png), [Refund](screenshots/refund-disabled-desktop.png), [Settings](screenshots/settings-desktop.png), [Delete](screenshots/delete-disabled-desktop.png), [Account mobile](screenshots/account-mobile.png), [Delete mobile](screenshots/settings-delete-mobile.png).

## Verification

- Baseline before edits: 130 unit-test files / 860 tests PASS.
- Final `bun run lint`: PASS.
- Final `bun run typecheck`: PASS.
- Final `bun run test`: **135 files / 889 tests PASS** after rebasing onto latest main.
- Final `PATH=/opt/homebrew/opt/postgresql@16/bin:$PATH bun run test:postgres:serial`: **25 files / 154 tests PASS**, including new encrypted-question/provider regression suite.
- Final `bun run build`: **PASS** (Next 15 production build, including TypeScript and static generation).
- `git diff --check`: PASS.
- Local browser: menu equality, actual encrypted Question/Date, untitled fallback, single detail navigation, fixed header while scrolling, visible scrollbar drag, equal-sized inner views, reason gating, exact DELETE gating, native-dialog focus loop, Escape/back/close/context, old URLs, mobile drawer handoff and body lock. No uncaught page errors. Browser scripts and JSON readbacks are attached for review.
- Browser dev inspection used `bypass_csp=True` because the existing production CSP blocks Next development eval. Repository CSP was not modified. Production-bundle CSP behavior and production account session are NOT VERIFIED here.
- Refund successful browser submission is NOT VERIFIED; real local failed submission feedback was checked. Backend refund business tests passed without provider payment/refund dispatch.
- Real local delete used one positively identified disposable fixture account. Before/after target ledger reconciled 1 approved / 1 executed, no unknown targets. No production user, provider account or financial transaction was modified.

No migration. No core Auth / Payment / Refund / Delete logic change. No dependency changes. No merge.
