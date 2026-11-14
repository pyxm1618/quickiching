# Quick I Ching Navigation / Surface Authority

Status: AUTHORITATIVE PLANNING SPEC — READY FOR INDEPENDENT AUTHORITY RE-AUDIT  
Repository: pyxm1618/quickiching  
Authority baseline: f28c4476144c0a2f0f801a89977101e1283189a4  
Authority scope: Page / Flow / Overlay / Navigation ownership and navigation-state preservation  
Implementation status: planning only; this document does not itself change runtime behavior

> This file is the single authoritative Navigation / Surface Authority for Quick I Ching.
> Existing visual-design notes, component-specific navigation notes, tests, and current runtime behavior are evidence of the current implementation, not competing navigation authority.
> Developer work must change implementation to conform to this file; this file must not be weakened to preserve an accidental current implementation.

## 1. Purpose

Quick I Ching currently has several valid navigation presentations, but the repository does not have one contract that decides which navigation capabilities a surface owns and which capabilities belong to the global shell. That absence has allowed route-level and page-level code to hide, duplicate, or reinterpret navigation.

This authority establishes one decision chain:

Surface Contract
→ Navigation Shell Authority
→ Route and Flow State declare the required contract
→ Components render the authorized capabilities

The forbidden decision chain is:

pathname
→ page-specific header choice
→ page CSS or DOM manipulation decides what survives

This is not a visual-header redesign. It is an ownership and semantics contract.

## 2. Scope

This authority governs:

- all user-enterable English and Simplified Chinese page surfaces;
- route-level pages, detail pages, task flows, flow steps, flow results, account pages, and recovery pages;
- transient overlays including panels, modals, popovers, dropdowns, and menus;
- global Home, Primary Navigation, Locale, Account, Back, Exit, and Close semantics;
- responsive preservation of navigation capabilities;
- semantic locale switching and preservation of flow-critical route state;
- authentication return navigation;
- pricing and payment return navigation;
- Three Coin product-entry authority;
- browser-history semantics at the navigation boundary;
- legal local navigation owned by a page or flow.

This authority does not own:

- casting algorithms;
- reading-session persistence, lock duration, resume policy, or anti-recast rules;
- authentication-provider security or callback validation implementation;
- payment entitlement, reconciliation, refund, or credit logic;
- visual art direction;
- SEO copy other than navigation/entry information architecture.

Where navigation depends on one of those systems, this document defines the navigation contract and explicitly leaves the underlying data/session implementation to its own authority.

## 3. Terminology

**Surface Contract**  
The semantic contract for a visible user surface or visible flow state. A route is one input to the contract; it is not the contract itself.

**Navigation Shell Authority**  
The single global owner that renders or suppresses global navigation capabilities according to the selected Surface Contract. It may later be implemented by one or more components, but pages do not own that decision.

**Global Home**  
The brand-level Home capability. English target is / and Chinese target is /zh.

**Primary Navigation**  
Site-level discovery controls such as Hexagrams, Other Methods, and Info. Primary Navigation is different from Home, Locale, Account, and local flow navigation.

**Semantic Parent**  
The meaningful parent surface in the information architecture or flow, not necessarily the previous browser-history entry.

**Step Back**  
A local action to the previous flow step or semantic parent. It is never Home by definition.

**Exit**  
An explicit action that leaves a task flow or reading flow. Exit may target Home, but its semantic role remains Exit and it must not masquerade as the brand Home control.

**Close**  
Dismisses a transient overlay and reveals the exact underlying surface. Close is not Back, Exit, or Home.

**Flow-critical state**  
State required to restore the same semantic transaction or reading, such as a reading/cast session identifier, validated callback target, or commercial return context.

**Page Override**  
Any page-level code that directly hides, duplicates, repositions semantically, or otherwise takes control of Global Home, Locale, Account, Primary Navigation, or the shell itself.

## 4. Surface Taxonomy

The following types are authoritative.

| Surface Type | Definition | Examples |
| --- | --- | --- |
| Root | Canonical product root and site Home surface. It may also host in-page flow states. | /, /zh landing |
| Page | Standalone informational or utility page with normal site context. | Guides, Help, legal pages |
| Detail | A content detail whose semantic parent is another page. | Generic content detail |
| SEO Detail | Search-indexable detail with a clear semantic parent and legal local navigation. | Hexagram detail; Three Coin method detail after migration |
| Task Flow | A full-page multi-step task with local progression. | Yarrow, Mei Hua, Manual Cast |
| Flow Step | One step inside a task or reading flow. It may share a pathname with other steps. | Three Coin confirm/casting; Result Choice |
| Flow Result | A session-bound result belonging to a completed flow. | Free Reading; Deep Reading |
| Account Page | A full-page authenticated or account-related surface. | My Readings |
| Transient Overlay — Panel | Temporary shell-owned panel over the current page. | Other Methods; Info |
| Transient Overlay — Modal | Temporary dialog over the current page. | Account; Settings |
| Transient Overlay — Popover | Temporary anchored local surface. | Manual Cast hexagram picker |
| Transient Overlay — Dropdown / Menu | Temporary menu opened from a shell or local control. | User account menu |
| In-page Flow State | A state transition that changes semantic step without creating a new route. | Three Coin landing → confirm → ritual; Mei Hua steps |
| Recovery Page | A system recovery surface when the normal route cannot render. | 404/global not-found |
| Redirect Adapter | A non-canonical route whose only job is to resolve to the real surface. | /account → Home + Account modal adapter |

A Page, Detail, Task Flow, Flow Step, or Flow Result is never an Overlay. Only a Transient Overlay may intentionally leave and expose the underlying page as its visible context.

## 5. Navigation Modes

Navigation Mode is selected by the Surface Contract. It is not selected by pathname alone.

| Mode | Required global capabilities | Primary Nav | Typical use |
| --- | --- | --- | --- |
| Home | Brand/Home, Locale, Account when auth capability-enabled | PER SURFACE | Root landing |
| Content | Brand/Home, Locale, Account when auth capability-enabled | PER SURFACE | Guides, legal, detail, My Readings, direct Pricing |
| Flow | Brand/Home, Locale, Account when auth capability-enabled; local Back/Exit/Next as defined by the flow | PER SURFACE; normally NO | Casting, auth detours, Result Choice, Free/Deep results, reading-context Pricing |
| Immersive | Brand/Home, Locale, Account when auth capability-enabled in a visually minimal shell | PER SURFACE; normally NO | Hexagrams Hub |
| Overlay | Inherits the underlying surface shell; overlay owns only its authorized local controls and Close | INHERIT | Panels, modal, dropdown, popover |
| Recovery | A minimal local recovery shell when the normal global shell is not available | NO | global 404 |
| Adapter | No rendered shell; redirects/replaces to the canonical surface | NO | /account adapter |

A visual composition may be immersive without becoming navigation-less. Immersive means visual minimization, not loss of required navigation capability.

Primary Navigation is not inherited from Navigation Mode. Every Surface Contract must declare its own Primary Nav value in Matrix A. Account/Auth navigation is conditional on the existing server-side authentication capability gate; see Section 6.6.

## 6. Global Invariants

### 6.1 Brand / Logo

Quick I Ching brand and logo always mean Home.

- English Home target: /
- Simplified Chinese Home target: /zh

Brand/Logo must never mean Back, Close, Previous Step, Cancel, or Exit.

There must be only one Global Home owner on an ordinary rendered surface: the Navigation Shell.

### 6.2 Back

Back may only mean:

- semantic parent; or
- previous flow step.

Examples:

- Hexagram Detail → Hexagrams Hub.
- Mei Hua confirmation → previous Mei Hua step.
- Result page local parent navigation → Result Choice with the same session, if exposed.

Back must not be relabeled Home.

### 6.3 Close

Close belongs only to transient overlays:

- Panel;
- Modal;
- Popover;
- Dropdown / Menu.

A full Page, Detail, Task Flow, Flow Step, or Flow Result must not use Close as a substitute for Back or Exit.

### 6.4 Overlay

Only transient overlays may preserve and visibly expose the exact underlying page context.

Ordinary pages and flows must render as their own surfaces. They must not simulate an overlay by hiding the shell or leaving an unrelated prior page composition visible behind them.

### 6.5 Primary Navigation

Primary Navigation is a capability, not a requirement implied by Navigation Mode.

- Every Surface Contract must explicitly declare Primary Nav YES or NO in Matrix A.
- Content mode does not automatically expose Primary Navigation.
- S09 Guides, S10 Help, and S11 Legal explicitly use Primary Nav NO; their dedicated information-page direction remains valid.
- S04 Hexagram Detail, S05 Three Coin SEO Method Detail, S15 Direct Pricing, and S19 My Readings explicitly use Primary Nav YES.
- Flow and Immersive surfaces remain Primary Nav NO unless a future independently audited Surface Contract explicitly changes that row.
- Removing Primary Navigation does not remove Home or Locale, and does not remove Account when the auth capability gate is enabled.

### 6.6 Account / Auth Capability Gate

The existing server-side authentication capability gate is upstream authority for whether Account/Auth navigation exists.

- isAuthCapabilityEnabled() remains the capability gate; Navigation implementation must not bypass, weaken, or duplicate that gate.
- When auth capability is enabled, a Surface Contract that says Account when capability-enabled requires the shell's authorized Account / Sign In capability.
- When auth capability is disabled, Account / Sign In navigation does not render and Account Modal does not render.
- Absence of Account / Sign In while auth capability is disabled is not a Navigation Authority violation.
- Responsive invariants compare the same capability-gate state: a capability that is enabled must not disappear merely because the viewport changes.
- This authority does not turn authentication on, change the feature gate, or make gated account surfaces reachable when the capability is disabled.

### 6.7 Page Override

Default: FORBIDDEN.

Pages and feature components must not:

- query body > header and hide it;
- set header display directly;
- use body:has(page) selectors to hide or semantically remove global navigation;
- duplicate a shell-owned Locale control;
- duplicate Global Home;
- duplicate Account navigation;
- decide by themselves to hide Global Brand or Primary Navigation;
- create a second navigation authority in feature CSS.

A surface requests a Navigation Mode from the central shell authority. The shell owns the result.

### 6.8 No invented hub routes

This authority does not create /methods or /info pages.

Other Methods remains a Primary Navigation Panel.  
Info remains a Primary Navigation Panel.

## 7. Route / Surface Inventory

The authoritative App Router at the baseline contains 44 page route patterns: 22 English and 22 Chinese counterparts.

English route patterns:

- /
- /hexagrams
- /hexagrams/[slug]
- /methods/three-coin
- /methods/yarrow-stalks
- /methods/mei-hua-yi-shu
- /methods/manual-cast
- /guides/how-to-ask-the-i-ching
- /guides/changing-lines
- /guides/primary-relating-hexagrams
- /help
- /privacy
- /terms
- /acceptable-use
- /readings/choice
- /readings/result
- /readings/deep
- /pricing
- /signin
- /signup
- /my-readings
- /account

Chinese route patterns are the exact /zh counterparts of all 22 routes above.

The dynamic /hexagrams/[slug] route represents 64 English + 64 Chinese static detail pages.

System-visible surfaces also include:

- localized/default not-found boundaries;
- global not-found;
- route error boundary;
- global fatal error boundary;
- loading boundary.

The error/loading boundaries are not independently addressable routes. They must inherit the intended route shell whenever the framework can preserve it; global fatal/not-found recovery may use Recovery mode because the normal shell is unavailable.

## 8. Route / Surface Authority Matrix

The matrix is split into two linked tables for readability. The Surface ID is the key. Together the two tables contain all mandatory authority fields.

### 8.1 Matrix A — ownership and navigation capabilities

| ID | Surface / Route | Surface Type | Navigation Mode | Shell Owner | Home Owner | Home Target | Semantic Parent | Step Back | Exit | Close | Primary Nav | Page Override |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | / and /zh — landing | Root | Home | Global Navigation Shell | Shell Brand | / or /zh | none | none | n/a | n/a | YES | FORBIDDEN |
| S02 | / and /zh — Three Coin question-confirm / casting states | In-page Flow State / Flow Step | Flow | Global Navigation Shell | Shell Brand | / or /zh | S01 | previous Three Coin step while reversible | explicit local Exit → localized S01 Root landing (/ or /zh); observable result must be the landing surface, not immediate restoration into active casting; persistence mechanics remain delegated to Reading Session / Resume Authority | n/a | NO | FORBIDDEN |
| S03 | /hexagrams and /zh/hexagrams | Page | Immersive | Global Navigation Shell in Immersive mode | Shell Brand | / or /zh | site root | none required | n/a | n/a | NO | FORBIDDEN |
| S04 | /hexagrams/[slug] and /zh/hexagrams/[slug] | SEO Detail | Content | Global Navigation Shell | Shell Brand | / or /zh | S03 | Back to 64 Hexagrams | n/a | n/a | YES | FORBIDDEN |
| S05 | /methods/three-coin and /zh/methods/three-coin | SEO Detail | Content | Global Navigation Shell | Shell Brand | / or /zh | S01 canonical Three Coin product entry | semantic parent is S01; CTA starts canonical flow there | n/a | n/a | YES | FORBIDDEN |
| S06 | /methods/yarrow-stalks and /zh/methods/yarrow-stalks | Task Flow | Flow | Global Navigation Shell | Shell Brand | / or /zh | Other Methods panel | previous reversible Yarrow step | explicit local Exit → localized Home: EN /; ZH /zh | n/a | NO | FORBIDDEN |
| S07 | /methods/mei-hua-yi-shu and /zh/methods/mei-hua-yi-shu | Task Flow | Flow | Global Navigation Shell | Shell Brand | / or /zh | Other Methods panel | previous reversible Mei Hua step | explicit local Exit → localized Home: EN /; ZH /zh; if SceneBook remains, it is this local Flow Exit only, never a second Global Home owner | n/a | NO | FORBIDDEN |
| S08 | /methods/manual-cast and /zh/methods/manual-cast | Task Flow | Flow | Global Navigation Shell | Shell Brand | / or /zh | Other Methods panel | previous reversible Manual step | explicit local Exit → localized Home: EN /; ZH /zh | n/a | NO | FORBIDDEN |
| S09 | three guide pairs | Page | Content | Global Navigation Shell | Shell Brand | / or /zh | Info panel | none required; Browser Back is not the product Step Back contract | n/a | n/a | NO | FORBIDDEN |
| S10 | /help and /zh/help | Page | Content | Global Navigation Shell | Shell Brand | / or /zh | Info panel | none required | n/a | n/a | NO | FORBIDDEN |
| S11 | /privacy, /terms, /acceptable-use and /zh counterparts | Page | Content | Global Navigation Shell | Shell Brand | / or /zh | Info panel | none required | n/a | n/a | NO | FORBIDDEN |
| S12 | /readings/choice?session=… and /zh counterpart | Flow Step | Flow | Global Navigation Shell | Shell Brand | / or /zh | completed cast handoff | no Back into terminal/mutable completed-casting UI; semantic parent is the sealed completed cast, represented by session state | explicit local Exit Reading to Home | n/a | NO | FORBIDDEN |
| S13 | /readings/result?session=… and /zh counterpart | Flow Result | Flow | Global Navigation Shell | Shell Brand | / or /zh | S12 with same session | Back to Reading Choice with same session if exposed | explicit local Exit Reading to Home; New Reading is separate local flow action | n/a | NO | FORBIDDEN |
| S14 | /readings/deep?session=… and /zh counterpart | Flow Result | Flow | Global Navigation Shell | Shell Brand | / or /zh | S12 with same session | Back to Reading Choice with same session if exposed | explicit local Exit Reading to Home; Free Reading is local sibling navigation | n/a | NO | FORBIDDEN |
| S15 | /pricing and /zh/pricing with no valid returnUrl | Page | Content | Global Navigation Shell | Shell Brand | / or /zh | site root | none required | localized Home fallback | n/a | YES | FORBIDDEN |
| S16 | /pricing and /zh/pricing with valid reading returnUrl or payment-return context | Flow Step | Flow | Global Navigation Shell | Shell Brand | / or /zh | validated semantic returnUrl | Return to validated returnUrl | semantic return to original reading context; if context is absent/invalid, localized Pricing fallback then Home | n/a | NO | FORBIDDEN |
| S17 | /signin and /zh/signin with callbackURL | Flow Step | Flow | Global Navigation Shell | Shell Brand | / or /zh | validated callback semantic surface; otherwise Home | Back/Cancel may return to validated callback target | Exit auth to Home without claiming callback completion | n/a | NO | FORBIDDEN |
| S18 | /signup and /zh/signup with callbackURL | Flow Step | Flow | Global Navigation Shell | Shell Brand | / or /zh | validated callback semantic surface; otherwise Home | Back/Cancel may return to validated callback target | Exit auth to Home | n/a | NO | FORBIDDEN |
| S19 | /my-readings and /zh/my-readings | Account Page | Content | Global Navigation Shell | Shell Brand | / or /zh | Account menu | none required | n/a | n/a | YES | FORBIDDEN |
| S20 | /account and /zh/account | Redirect Adapter | Adapter | Redirect Adapter only | none on adapter | resolves to / or /zh | Account modal surface | n/a | redirect to canonical underlying page + overlay | n/a | NO | FORBIDDEN |
| S21 | 404 / not-found | Recovery Page | Recovery | Recovery surface when normal shell is unavailable | Recovery Home control | / or /zh according to requested locale | none | none | n/a | n/a | NO | FORBIDDEN |

### 8.2 Matrix B — locale, state, entry, history, responsive, and local navigation

| ID | Locale Target | State Preservation | Entry Contract | History Semantics | Responsive Invariant | Local Navigation |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | / ↔ /zh | no transactional query copying; active Three Coin state is handled by S02 | Brand, direct URL, canonical Three Coin product entry | ordinary page entry uses push/direct load | Home, Primary Nav, Locale, and Account when capability-enabled remain available on desktop/mobile; presentation may collapse | root content actions |
| S02 | same root in other locale, rehydrating the same active Three Coin session/state | active question/cast identity and all irreversible cast facts; locale switch must never reset or recast | S01 only | in-page steps do not create route history by default; local Back owns reversible step changes; completion handoff uses replace semantics into S12; explicit Exit must resolve observably to S01 landing even though S01 and S02 share the same route | Home, Locale, Account when capability-enabled, and local Back/Exit capability must remain; Primary Nav remains absent | Three Coin Back, Next/Cast, Edit only while reversible, Exit to observable S01 landing; no duplicated global Home/Locale/Account |
| S03 | /hexagrams ↔ /zh/hexagrams | stable semantic selection may be local-only; no arbitrary analytics query preservation | Primary Nav, internal links, search/direct URL | ordinary page push | visible Home, Locale, and Account when capability-enabled must exist in both desktop and mobile immersive presentations | wheel/grid interactions only; no duplicate global controls |
| S04 | exact same hexagram slug in other locale | preserve stable semantic fragment such as a line anchor only when an equivalent anchor exists; do not copy arbitrary transient state | Hexagrams Hub, reading links, internal links, search/direct URL | ordinary detail push; prev/next and parent links push | Home, Locale, Primary Nav YES, and Account when capability-enabled are invariant | Previous Hexagram, Next Hexagram, Back to 64 Hexagrams, in-page line anchors |
| S05 | method detail counterpart | no flow session because this surface must not run the full ritual | search/direct URL and internal explanatory links; CTA starts S01 | ordinary content push; CTA push to canonical root | Home, Locale, Primary Nav YES, and Account when capability-enabled are invariant | method-content links and CTA to S01 only |
| S06 | Yarrow counterpart with same active session rehydrated | question, session identity, completed changes/lines, irreversible method facts | Other Methods panel, search/direct URL, internal links | in-page flow state locally managed; completed handoff to S12 uses replace | Home/Locale/Account when capability-enabled plus local Back/Exit are invariant; Exit target is localized Home | restart/back while authorized, cast progression; no global duplication |
| S07 | Mei Hua counterpart with same active session rehydrated | question, chosen number, confirmed timestamp/timezone, cast/session identity | Other Methods panel, search/direct URL, internal links | in-page steps locally managed; completed handoff to S12 uses replace | Home/Locale/Account when capability-enabled plus local Back/Exit are invariant; Exit target is localized Home | Edit Question, Change Number, previous step, SceneBook as local Exit to localized Home only |
| S08 | Manual counterpart with same active session/draft rehydrated | question, mode, line values/selected hexagram, moving lines, session identity | Other Methods panel, search/direct URL, internal links | in-page steps locally managed; completed handoff to S12 uses replace; restoration adapters may replace | desktop/mobile must keep identical Home/Locale/Account when capability-enabled and local Exit capability; Exit target is localized Home | mode tabs, picker, change lines, question editing while reversible, Continue/Back |
| S09 | exact guide counterpart | stable semantic anchor may map if equivalent | Info panel, internal links, search/direct URL | ordinary push; Browser Back may exist as browser behavior but is not the product navigation contract | Home, Locale, and Account when capability-enabled are invariant; Primary Nav remains NO | related-guide local navigation is allowed; no product Step Back is required |
| S10 | /help ↔ /zh/help | none required | Info panel, internal links, direct URL | ordinary push | Home, Locale, and Account when capability-enabled are invariant; Primary Nav remains NO | help links/support links |
| S11 | exact legal counterpart | stable section anchor may map if equivalent | Info panel, signup legal links, internal/direct URL | ordinary push | Home, Locale, and Account when capability-enabled are invariant; Primary Nav remains NO | table-of-contents anchors |
| S12 | same choice route in other locale with identical session | session is mandatory flow-critical state; do not copy analytics or stale overlay state | completed casting handoff; valid deep link with session; never Primary Navigation | sealed casting handoff into S12 is replace/non-reentry; S12 → S13/S14 is push; Browser Back from S12 must not resurrect a completed casting screen as an active flow | Home/Locale/Account when capability-enabled + local Exit and reading choices must be available identically; only layout may change | Free Reading, Deep Reading, explicit Exit; no Close |
| S13 | same result route in other locale with identical session | session; auth callback must preserve full semantic return; pricing/deep transitions preserve session | S12, My Readings, valid direct/session link, auth return | S12 → S13 push; sibling/result-parent navigation push; New Reading exits cleared result flow without allowing stale result to become active again | same Home/Locale/Account when capability-enabled, parent/Exit/New Reading capability | New Reading, Deep Reading, Hexagram detail links, optional Back to Choice, Exit |
| S14 | same deep route in other locale with identical session | session; auth callback; pricing returnUrl; payment-return context when applicable | S12/S13, My Readings or valid session link, auth/pricing return | S12/S13 → S14 push; auth/payment completion returns by redirect/replace to same semantic S14; sibling Free link push | same Home/Locale/Account when capability-enabled, parent/Exit/Free capability | Free Reading, Back to Choice if exposed, Exit, deep-generation actions |
| S15 | /pricing ↔ /zh/pricing | do not invent a reading return; do not preserve test-only preview or analytics state | direct URL, global/commercial links | ordinary push | Home, Locale, Primary Nav YES, and Account when capability-enabled are invariant | pack selection and localized Home fallback |
| S16 | pricing counterpart while preserving validated returnUrl and necessary fresh payment recovery identity | validated returnUrl including nested reading session; fresh payment order/recovery context needed to complete the same transaction | Reading flow, auth-commercial flow, payment provider return | enter detour with push; semantic Return and successful payment completion return to original reading context with replace/redirect semantics; invalid/expired context normalizes to localized Pricing | same Home/Locale/Account when capability-enabled + semantic Return capability; Primary Nav absent | purchase actions, Check Again, Return to Reading, Finish Pricing |
| S17 | signin counterpart preserving callbackURL as a nested full internal route | callbackURL including pathname + flow-critical query and semantic hash; auth error context as needed; never external unsafe targets | Account control when auth capability-enabled, gated reading flow, commercial flow, direct URL | enter auth detour with push; successful auth redirects/replaces to validated callback; mode switch stays inside auth without losing callback | same Home/Locale and auth-capability-gated Account/Sign In shell behavior, plus Cancel/Back capability; Primary Nav absent | Sign in/Sign up mode switch, provider/email actions, Cancel/Back; legal links where applicable |
| S18 | signup counterpart preserving callbackURL | same rules as S17 | Account control or Sign In reciprocal link when auth capability-enabled, gated flow, direct URL | same auth detour semantics as S17 | same as S17 | reciprocal Sign In, provider/email actions, legal links, Cancel/Back |
| S19 | /my-readings ↔ /zh/my-readings | no reading session until a row is opened; auth detour must preserve /my-readings | Account menu when auth capability-enabled, direct URL, auth return | ordinary push; unauthenticated redirect to signin with callback; row → S13 push | Home, Locale, Primary Nav YES, and Account when capability-enabled are invariant when the gated surface is available | saved-reading rows to S13 |
| S20 | /account ↔ /zh/account adapter; resolved underlying locale is preserved | requested account overlay intent only; do not persist stale overlay state across unrelated navigation | direct/legacy account URL | redirect/replace to localized Home plus Account overlay adapter; adapter must not remain as a fake page in browser history | n/a: adapter does not own responsive UI | none |
| S21 | locale determined from requested unmatched path | no arbitrary route state preservation; recovery only | unmatched URL | recovery entry is terminal for the missing URL; Home/Hexagrams links are ordinary navigation | Home and recovery actions remain available on all viewport sizes | Return Home and Explore Hexagrams are authorized recovery navigation |

## 9. Overlay Authority

Transient overlays are separate Surface Contracts and never become replacement page shells.

| Overlay | Type | Owner | Close semantics | History semantics | Allowed local navigation | Global duplication |
| --- | --- | --- | --- | --- | --- | --- |
| Other Methods | Panel | Global Navigation Shell | Close returns to exact underlying surface | no route history entry | links to Yarrow, Mei Hua, Manual Cast | FORBIDDEN |
| Info | Panel | Global Navigation Shell | Close returns to exact underlying surface | no route history entry | guide/help/legal links and support actions | FORBIDDEN |
| User account control | Dropdown / Menu | Global Navigation Shell when auth capability-enabled | Escape, outside click, selection | no route history entry | My Readings, Account modal, Settings modal | FORBIDDEN |
| Account | Modal | Account overlay owner under the global shell when auth capability-enabled | Close restores exact underlying page and focus | no route history entry after canonical adapter resolution | account purchase/refund views | FORBIDDEN |
| Settings | Modal | Account overlay owner under the global shell when auth capability-enabled | Close restores exact underlying page and focus | no route history entry | settings/privacy/account actions | FORBIDDEN |
| Manual hexagram picker | Popover / local listbox | Manual Cast local flow | Close restores Manual Cast step | no route history entry | choose hexagram only | FORBIDDEN |

Overlay state is normally transient and must not be blindly copied during locale switching. A locale change may close an overlay while preserving the underlying semantic page/flow state. The /account adapter is the explicit exception that converts a deep-link intent into the canonical underlying page plus overlay and then canonicalizes history. Account-related overlays and their shell entry controls exist only when the existing auth capability gate is enabled; navigation must never force them to render when it is disabled.

## 10. Locale Navigation Contract

Locale control has locale semantics only.

Rules:

1. A locale switch keeps the same semantic Surface Contract whenever an equivalent surface exists.
2. Any clickable locale label describes its destination locale. An active/current locale indicator must not secretly navigate Home.
3. The current locale control must never double as Global Home.
4. Locale navigation must preserve an allowlisted set of flow-critical state required to restore the same transaction.
5. Locale navigation must not blindly copy all query parameters or hashes.
6. If an in-page flow cannot preserve its irreversible state across locales, the locale switch must not be exposed for that flow until preservation is implemented. It must never reset or recast as a side effect.

Flow-critical examples that must be preserved when relevant:

- session on /readings/choice, /readings/result, and /readings/deep;
- a stable casting/reading identity needed to resume the same in-page flow;
- callbackURL on /signin and /signup, including the nested flow-critical state in that callback;
- returnUrl on reading-context /pricing;
- fresh order/payment recovery identity when needed to complete the same checkout return;
- a stable semantic fragment such as a hexagram line anchor when the target locale has an equivalent anchor.

State that must not be mechanically copied:

- utm_source and other acquisition/analytics parameters;
- test-only preview parameters;
- expired payment context;
- stale panel/modal/dropdown state;
- arbitrary transient UI state;
- a hash that has no equivalent semantic target.

The current route registry may remain an implementation input, but the authority is semantic-surface mapping plus per-surface state preservation. “Add every transactional pathname to a registry” is not a sufficient implementation.

## 11. Authentication Return Contract

Authentication is a navigation detour, not a new destination that may discard the original user intent.

The callback contract is:

original semantic surface + flow-critical state
→ Sign In / Sign Up
→ authentication provider
→ validated same-origin callback
→ exact semantic surface + required state

Requirements:

- a shell Sign In/Sign Up link must capture the full return-critical internal route, not pathname alone;
- for /readings/result?session=ABC the callback must retain session=ABC;
- for /readings/deep?session=ABC the callback must retain the same deep-reading intent;
- nested commercial return context must remain intact when auth is inserted before Pricing;
- Sign In ↔ Sign Up switching must preserve callbackURL;
- callback targets remain same-origin and must continue to pass the existing security validator;
- analytics-only parameters are not required return state;
- successful auth must not strand the user on the auth surface when a valid callback exists.

## 12. Commercial Return Contract

Pricing has two Surface Contracts on the same route.

### Direct Pricing

When no valid returnUrl exists, /pricing is a normal Content surface.

- no Reading return is invented;
- localized Home is the fallback destination;
- Primary Navigation is explicitly YES for S15; this is a Surface Contract decision, not a consequence of Content mode.

### Reading-context Pricing

When a valid returnUrl exists, Pricing is a Flow Step.

- returnUrl defines the semantic parent and Return target;
- the visible Return action must use the validated returnUrl;
- a reading return such as /readings/deep?session=ABC must retain session=ABC;
- checkout return recovery may additionally use fresh stored order context;
- payment success or explicit Return to Reading returns to the original semantic context;
- invalid or expired return context normalizes to localized direct Pricing rather than guessing.

Copy and target must agree. A control that says Return to Free Reading/Reading must not route Home when a valid reading return exists.

## 13. Three Coin Entry Authority

### 13.1 Implementation fact

At the authority baseline:

- / and /zh render ThreeCoinRitual + ThreeCoinTool.
- /methods/three-coin and /zh/methods/three-coin render ThreeCoinRitualClient.
- ThreeCoinRitualClient reuses the same ThreeCoinRitual and ThreeCoinTool implementation.

Therefore the current problem is not old/new or duplicate Three Coin implementation. It is duplicate active product entry / information architecture.

### 13.2 Authoritative decision: Option A

Option A is selected and frozen.

- / and /zh are the canonical and authoritative Three Coin product entry.
- /methods/three-coin and /zh/methods/three-coin are SEO Method Detail surfaces.
- The method detail retains method explanation, SEO content, related guides, and a CTA to / or /zh.
- The method detail must not directly start the complete Three Coin ritual.
- No second authoritative Three Coin product entry may be created.

Rationale:

- the Root already owns the primary product entry;
- one active entry avoids ambiguous restart/Home/flow semantics;
- the SEO detail remains independently indexable and useful;
- shared implementation is good engineering but does not justify two product-entry surfaces;
- Other Methods remains the place for alternative methods; Three Coin remains the default root method.

### 13.3 New Reading rule

A New Reading action returns to the canonical entry for the chosen method.

- Three Coin → / or /zh.
- Yarrow → localized Yarrow route.
- Mei Hua → localized Mei Hua route.
- Manual → localized Manual route.

This rule is navigation authority only. Clearing or preserving a sealed/unfinished session is controlled by Reading Session / Resume Authority.

### 13.4 Explicit Three Coin Exit observable result

While S02 Three Coin flow state is active, an explicit Exit has one navigation outcome:

- English → S01 Root landing at /.
- Chinese → S01 Root landing at /zh.
- The user must observably see the Root landing surface after Exit.
- The same-route landing must not immediately restore the user into the active casting state as the result of that Exit.

This freezes the user-observable navigation result only. Whether the unfinished session is cleared, retained for later resume, archived, or represented by another persistence mechanism remains owned by Reading Session / Resume Authority.

## 14. Responsive Navigation Contract

Responsive behavior may change presentation, not semantics.

Invariant capabilities must remain equivalent across desktop and mobile for a given Surface Contract.

Allowed examples:

- Desktop: Brand + visible Primary Navigation controls.
- Mobile: Brand + compact menu that exposes the same authorized Primary Navigation.
- Desktop Flow: Brand + Locale + Account when auth capability-enabled + local Exit.
- Mobile Flow: compact visual equivalents of the same capabilities under the same auth capability-gate state.

Forbidden examples:

- Desktop has Home, Mobile has no Home.
- Desktop can Exit a Flow, Mobile cannot.
- Desktop Result Choice has no global navigation while Mobile has a full global shell.
- Mobile hides Brand to make artwork fit.
- A desktop route exposes Locale but mobile omits it.
- a responsive breakpoint changes a control’s target or semantic role.

A visual collision is solved by responsive presentation or a different authorized shell layout, never by removing required navigation capability in feature CSS.

## 15. Local Navigation Contract

Local navigation is legal and expected when it belongs to the surface.

Examples explicitly authorized:

- Hexagram Previous / Next.
- Back to 64 Hexagrams.
- Three Coin previous step.
- Yarrow restart/back while the step remains reversible.
- Mei Hua previous step, Change Number, Edit Question.
- Manual Cast mode/picker/step controls.
- Account modal internal navigation when auth capability-enabled.
- Reading → New Reading.
- Deep Reading → Free Reading.
- Reading Result → Hexagram Detail.
- Flow Exit controls.

Local navigation must not reimplement:

- Global Home;
- Locale;
- Account;
- Primary Navigation.

The explicit exception is Recovery mode when the normal global shell does not exist; its local Home action is the authorized recovery Home owner for that system surface.

## 16. History Semantics

Navigation authority owns history semantics at surface boundaries. Reading Session / Resume Authority owns what data is restored.

### 16.1 Ordinary pages and details

Normal Page/Detail navigation uses push semantics.

For S09 Guides, product navigation does not require a Step Back control. Home remains available and related-guide local navigation is allowed. Browser Back may still function as browser behavior, but it is not the Guide product Navigation Contract.

Examples:

- Home → Hexagrams.
- Hexagrams → Hexagram Detail.
- Content → Guide.
- My Readings → saved Free Reading.

### 16.2 In-page flow states

Three Coin, Yarrow, Mei Hua, and Manual in-page steps do not create URL history entries by default.

- local Back controls reversible step state;
- browser Back remains route-level navigation unless a future explicitly audited flow-history contract is introduced;
- irreversible cast facts must not be regenerated by navigation.

### 16.3 Completed casting handoff

Once a cast is sealed and the user is handed to Result Choice:

- the handoff uses replace/non-reentry semantics;
- Browser Back from Result Choice must not restore a terminal casting screen as an active cast step;
- the sealed cast is represented by its reading/session identity, not by keeping a mutable terminal UI in history.

This requirement is intentionally separate from resume/storage implementation.

### 16.4 Result Choice and result siblings

- Result Choice → Free Reading / Deep Reading uses push.
- Free ↔ Deep sibling navigation uses push.
- a Back-to-Choice control, if exposed, targets the same session.
- New Reading exits the current result flow and must not allow an already-cleared result to become active again through browser history.

### 16.5 Overlays

Panels, modal, dropdowns, and local popovers do not create page history entries.

The /account adapter is a redirect/deep-link adapter and uses redirect/replace semantics to reach the canonical underlying page + Account overlay.

### 16.6 Auth

Entering auth is a detour. Successful auth returns by redirect/replace to the validated callback semantic surface. Auth mode switching does not lose callback state.

### 16.7 Pricing and payment return

Entering reading-context Pricing is a detour. Semantic Return and successful payment completion return to the validated original reading context with redirect/replace semantics, preventing a return loop through the same detour.

Direct Pricing remains ordinary page navigation.

## 17. Forbidden Page Overrides

The following patterns are architectural violations unless this authority is explicitly amended after independent review:

- document.querySelector("body > header") followed by direct style mutation;
- header.style.display = "none";
- page CSS such as body:has(.feature-page) .scene-navigation { display: none; };
- feature CSS hiding .scene-brand, .scene-scrolls, or .scene-utility to change navigation semantics;
- page-owned copies of Global Locale or Account controls when Account is capability-enabled;
- page-owned Global Home controls on ordinary surfaces;
- a route-specific component deciding shell capability by viewport;
- current-locale links that point Home;
- a locale switch that falls back to Home when an equivalent transactional surface exists;
- a full-page flow represented as a modal/overlay only because the prior page remains visible;
- introducing /methods or /info solely to make navigation architecture look symmetrical.

## 18. Known Current Violations

The following violations were independently re-verified against the baseline code. They describe current implementation defects relative to this authority; they are not normative behavior.

**V01 — SiteHeader authority is pathname-coarse.**  
Evidence: src/components/site-header.tsx selects InfoPageHeader for a fixed info-path list and SceneNavigation for everything else. Flow state and Surface Contract are not inputs.

**V02 — Hexagrams Hub directly hides shell-owned DOM.**  
Evidence: src/app/(default)/hexagrams/hexagrams-experience.tsx queries body > header/footer and mutates display; it also changes body/main presentation directly.

**V03 — Hexagrams Hub duplicates shell controls while lacking a visible Home capability.**  
Evidence: HexagramsExperience owns its own locale and UserNavControl chrome after hiding the SiteHeader. Its Home link is screen-reader-hidden, aria-hidden, and non-focusable, so it is not a user navigation capability.

**V04 — Hexagrams Hub language label and target have opposite semantics.**  
Evidence: the visible English control says EN while linking to /zh/hexagrams; the Chinese control says 中文 while linking to /hexagrams. A locale action must identify the destination locale or be a non-navigation current-locale indicator.

**V05 — Manual Cast has responsive semantic drift.**  
Evidence: src/components/public-reading/manual-cast.css hides .scene-scrolls and .scene-brand at max-width 800px while desktop retains them.

**V06 — Mei Hua currently has two Home owners.**  
Evidence: the global SceneNavigation brand links Home, while SceneBook in src/components/public-reading/mei-hua-number-flow.tsx also links to / or /zh and is labelled as a return to Quick I Ching. Under this authority SceneBook may remain only as a local Flow Exit, not a second Global Home.

**V07 — Result Choice has desktop/mobile navigation drift.**  
Evidence: src/components/reading-result/result-choice.module.css hides .scene-navigation only at min-width 801px and intentionally retains it on mobile. The ready Result Choice itself exposes only Deep Reading and Free Reading and has no local Exit.

**V08 — Transactional locale switching falls back to Home rather than preserving semantic surface/state.**  
Evidence: src/i18n/routes.ts does not register readings choice/result/deep, pricing, signin/signup, my-readings, or account; SceneNavigation uses route lookup and falls back to the locale root for unknown paths.

**V09 — SceneNavigation current-locale controls implicitly act as Home.**  
Evidence: src/components/scene-navigation.tsx renders EN linking to / in English and 中文 linking to /zh in Chinese even while the user is on a non-root surface. Locale and Home semantics are conflated.

**V10 — Global auth entry drops return-critical query/hash state.**  
Evidence: src/components/auth/user-nav-control.tsx builds callbackURL from usePathname() only. A reading URL such as /readings/result?session=ABC therefore loses session when auth begins from the global account control.

**V11 — Pricing visible Return ignores validated returnUrl.**  
Evidence: PricingExperience receives returnUrl and passes it into purchase flow, but its ordinary bottom Return link always targets localized Home. The visible return semantics and target can diverge.

**V12 — /methods/three-coin is currently a second active Three Coin product-entry surface.**  
Evidence: both Root and /methods/three-coin run the same shared ThreeCoinRitual/ThreeCoinTool implementation. This is not implementation duplication; it violates the frozen single-entry IA decision in Section 13.

**V13 — Three Coin New Reading currently routes to /methods/three-coin.**  
Evidence: clearCompletedReadingForRestart in src/lib/completed-public-reading.ts builds /methods/three-coin for Three Coin. Under this authority Three Coin New Reading returns to the canonical Root entry.

**V14 — completed-cast handoff history semantics are inconsistent with the frozen non-reentry contract.**  
Evidence: ThreeCoinTool, YarrowTool, MeiHuaNumberFlow, and direct Manual completion use router.push to /readings/choice; Manual restoration already uses replace in one path. The authority requires one non-reentry handoff contract.

No production code is changed by this planning commit.

## 19. Migration Boundary

A future Developer AI must implement this authority without redefining it.

Expected implementation work includes, but is not limited to:

1. introduce a central Surface Contract / Navigation Mode selection mechanism that can consume route plus flow state;
2. make the global shell render Home/Locale and each Surface Contract's explicit Primary Nav setting, plus Account only when the existing auth capability gate is enabled;
3. remove page-level DOM/CSS shell overrides;
4. migrate Hexagrams Hub to Immersive mode while retaining visible Home/Locale and Account when capability-enabled;
5. make locale controls semantic and state-preserving;
6. normalize Flow-mode responsive capabilities;
7. authorize Mei Hua SceneBook only as local Exit or remove it if the implementation cannot preserve a distinct Exit semantic;
8. add Result Choice / Reading Flow parent and Exit affordances required by the matrix;
9. preserve full auth return-critical state;
10. use Pricing returnUrl for semantic Return;
11. convert /methods/three-coin to SEO Method Detail + CTA to canonical Root;
12. align Three Coin New Reading with Root;
13. implement sealed-cast handoff non-reentry history semantics;
14. add/adjust tests to prove this authority.

The Developer AI must not use this migration as permission to alter:

- casting/session lock logic;
- paid-reading entitlement rules;
- payment reconciliation;
- SEO content beyond the minimum IA change required by Three Coin Option A;
- unrelated page design;
- unrelated routing.

Navigation Authority and Reading Session / Resume Authority remain separate. If a navigation change needs a session behavior decision not defined here, that is a separate authority issue rather than a reason to guess.

## 20. Acceptance Criteria

Implementation conforming to this authority is acceptable only when all of the following are mechanically demonstrable:

- every user-enterable route/flow resolves to one Surface Contract and one Navigation Mode;
- route + flow state, not pathname alone, can select a contract;
- no ordinary page directly hides or duplicates shell-owned navigation;
- Brand/Home always targets / or /zh and never means Back/Close/Exit;
- Back only targets semantic parent or previous flow step;
- Close appears only on transient overlays;
- desktop/mobile retain the same required navigation capabilities and targets under the same auth capability-gate state;
- Account / Sign In is required only when the existing auth capability gate is enabled; when disabled, its absence is not a violation and implementation must not bypass or weaken the gate;
- Primary Nav is determined per Surface Contract, not inherited from Content mode; specifically S09 Guides, S10 Help, and S11 Legal are NO while S04 Hexagram Detail, S05 Three Coin SEO Detail, S15 Direct Pricing, and S19 My Readings are YES;
- Hexagrams Hub remains immersive while exposing Home/Locale and Account when capability-enabled through the shell;
- Hexagrams locale actions have correct destination semantics;
- Manual Cast no longer loses Home or other required shell capability on mobile;
- Mei Hua has one Global Home owner; any SceneBook control is local Exit only;
- Result Choice has one responsive Flow contract and an explicit authorized exit path;
- Free and Deep are Flow Result surfaces, not generic content pages;
- locale switching preserves semantic surface plus allowlisted flow-critical state;
- global auth callbacks preserve return-critical query/hash state;
- Pricing uses validated returnUrl for semantic Return and has a deterministic fallback when absent;
- / and /zh are the only authoritative Three Coin product entry;
- /methods/three-coin is content + CTA, not a second full ritual;
- Three Coin New Reading returns to Root;
- explicit Three Coin Exit results in the user seeing S01 Root landing and does not immediately restore the same active casting state;
- Yarrow Exit, Mei Hua Exit/SceneBook Exit, and Manual Exit each target localized Home deterministically: EN /; ZH /zh;
- Guides require no product Step Back; related-guide local navigation is allowed and Browser Back is not the product navigation contract;
- completed casting handoff cannot Browser-Back into an active terminal casting state;
- overlays preserve underlying page context and own only authorized Close/local navigation;
- no /methods or /info hub route is introduced;
- navigation tests cover Surface Mode, responsive invariants, locale state, auth return, pricing return, Three Coin entry, and history boundaries.

## 21. Authority Freeze Gate

| Question | Result | Authority answer |
| --- | --- | --- |
| Q1. Are all major user-enterable surfaces in the Matrix? | PASS | All 44 page route patterns are covered by family or exact surface rows, plus 404; in-page flow states and overlays are explicitly covered. |
| Q2. Do two surfaces simultaneously claim Global Home? | PASS | No. Ordinary surfaces use Shell Brand as the sole Global Home owner; Mei Hua SceneBook is local Exit only; Recovery owns Home only when the normal shell is unavailable. |
| Q3. Is any page allowed to directly hide Global Shell? | PASS | No. Page Override is FORBIDDEN for every route surface. |
| Q4. Can desktop/mobile differ in required capability? | PASS | No. Responsive changes presentation only. |
| Q5. Are locale semantic surface and flow-critical state defined? | PASS | Yes, with per-surface state preservation and an allowlist/denylist contract. |
| Q6. Is auth callback preservation defined? | PASS | Yes. Full return-critical internal route state is required, subject to same-origin validation. |
| Q7. Are Pricing return semantics defined? | PASS | Yes. Valid returnUrl wins; no valid return uses localized direct-Pricing/Home fallback. |
| Q8. Is Three Coin canonical entry explicit? | PASS | Yes: / and /zh only. |
| Q9. Is /methods/three-coin product role explicit? | PASS | Yes: Option A, SEO Method Detail + CTA to Root, no full ritual. |
| Q10. Are Page / Detail / Flow / Overlay definitions non-conflicting? | PASS | Yes. Overlay is transient-only; Flow and Page contracts are separate. |
| Q11. Are Local Navigation and Global Shell Authority separated? | PASS | Yes. Authorized local controls are enumerated; global duplication is forbidden. |
| Q12. Are Browser History semantics and the session-authority boundary explicit? | PASS | Yes. Page push, overlay no-history, adapter replace, auth/commercial detours, and sealed-cast non-reentry are defined; data restoration remains outside this authority. |
| Q13. Is the existing Auth Capability Gate preserved? | PASS | Yes. Account / Sign In is shell-required only when isAuthCapabilityEnabled() is enabled; disabled absence is explicitly non-violating, and implementation may not bypass or weaken the gate. |
| Q14. Is Primary Nav deterministic per Surface Contract? | PASS | Yes. Matrix A explicitly declares every surface; Content no longer implies YES. Guides/Help/Legal are NO; Hexagram Detail, Three Coin SEO Detail, Direct Pricing, and My Readings are YES. |
| Q15. Is the observable result of Three Coin Exit deterministic? | PASS | Yes. Exit from S02 must leave the user visibly on localized S01 Root landing and must not immediately restore the active casting state; persistence mechanics remain outside this authority. |
| Q16. Are method-flow Exit targets deterministic? | PASS | Yes. Yarrow, Mei Hua (including SceneBook if retained), and Manual Exit all target localized Home: EN /; ZH /zh. Guide Step Back is none required and does not depend on Browser Back. |

Authority Freeze Gate: PASS.

Unresolved Authority Questions: 0.
