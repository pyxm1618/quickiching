# Mobile Lighthouse 100 Design

## Goal
Raise Quick I Ching's mobile Lighthouse baseline by removing avoidable initial client JavaScript while preserving SSR SEO content, navigation accessibility, and all public casting behavior.

## Scope
1. Split the global header so the static shell and desktop navigation render on the server; isolate only interactive navigation behavior in a small client component.
2. Keep the homepage question form as the first interactive island, but defer `ThreeCoinTool` until the user actually continues or skips into casting.
3. Defer `PublicReadingResult` until a six-line reading is complete, so interpretation, history, personalized interpretation, and Turnstile code are absent from the initial casting bundle.
4. Preserve analytics behavior for this phase; third-party script tuning is a separate follow-up only if Lighthouse still cannot reach the target after first-party JS reduction.
5. Add architecture tests that fail if heavy client modules are pulled back into the initial path.

## Non-negotiable behavior
- Homepage title, description, H1, explanatory copy, FAQ, and internal SEO links remain server-rendered.
- The question-first flow behaves exactly as before: restore session, continue, skip, edit, and restart.
- Three-coin casting remains deterministic with respect to the existing browser-crypto algorithm and storage semantics.
- Result rendering, history save, personalized interpretation, and Turnstile remain behaviorally unchanged once reached.
- Desktop and mobile navigation remain keyboard accessible and localized.
- No change to canonical URLs, redirects, robots, schema, or public copy.

## Architecture
### Header
`SiteHeader` becomes a server component responsible for dictionary selection, brand, static desktop links, and layout. A focused client navigation island owns only stateful dropdown/drawer behavior. Server-rendered markup must contain all primary navigation links even before hydration.

### Homepage casting island
`QuestionFirst` remains client-side because it owns local session state. `ThreeCoinTool` is loaded through a client-only dynamic boundary only after `started === true`. The pre-cast question card therefore does not require the casting engine, audio, timers, result tree, or session modules.

### Result island
`ThreeCoinTool` dynamically loads `PublicReadingResult` only when `publicReading` exists. The loading state must not alter the authoritative reading or casting state. This removes interpretation and personalized-reading code from the initial three-coin chunk.

## Verification
- Vitest source-architecture tests lock the boundaries.
- Existing unit/integration tests must pass.
- `next build` must pass.
- Existing browser gate must pass on Vercel.
- Compare production bundle/build output and Lighthouse after deployment; no merge until functional gates are green.

## Risk controls
- Keep each boundary change independent and reversible.
- Do not combine analytics changes with first-party bundle changes in the same PR.
- If dynamic loading causes hydration or SSR regressions, revert that boundary rather than masking the issue with loading hacks.
