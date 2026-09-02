# Mobile Lighthouse 100 Design

## Goal
Raise Quick I Ching's mobile Lighthouse baseline by removing avoidable initial client JavaScript while preserving SSR SEO content, navigation accessibility, and all public casting behavior.

## Scope
1. Keep the audited global header behavior unchanged until it can be split without losing its explicit keyboard/focus contract.
2. Keep the homepage question form as the first interactive island, but defer `ThreeCoinTool` until the user actually continues or skips into casting.
3. Defer `PublicReadingResult` until a six-line reading is complete, so interpretation, history, personalized interpretation, and Turnstile code are absent from the initial casting bundle.
4. Preserve analytics behavior for the first-party split phase; measure GA/Clarity separately if first-party reductions are insufficient.
5. Add architecture tests that prevent heavy casting modules from returning to the initial homepage route.

## Non-negotiable behavior
- Homepage title, description, H1, explanatory copy, FAQ, and internal SEO links remain server-rendered.
- The question-first flow behaves exactly as before: restore session, continue, skip, edit, and restart.
- Three-coin casting remains deterministic with respect to the existing browser-crypto algorithm and storage semantics.
- Result rendering, history save, personalized interpretation, and Turnstile remain behaviorally unchanged once reached.
- Navigation keeps the existing audited interaction contract: desktop ArrowUp/ArrowDown looping, Escape focus return, click-outside dismissal; mobile dialog focus trap, scroll lock, backdrop dismissal, Escape behavior, and localized language switching.
- No change to canonical URLs, redirects, robots, schema, or public copy.

## Architecture
### Header
The first native-`details` server-header spike was rejected after inspecting `scripts/navigation-audit-gate.mjs`: it would remove interaction behavior the repository explicitly treats as a launch requirement. The production header remains in place for the first measurement. Any later header optimization must preserve the existing selectors/semantics or update them only alongside equivalent behavior, preferably by keeping a very small hydrated trigger and dynamically loading the desktop menu/mobile drawer implementation on interaction.

### Homepage casting island
`QuestionFirst` remains client-side because it owns local session state. `ThreeCoinTool` is loaded through a dynamic boundary only after `started === true`. The pre-cast question card therefore does not require the casting engine, audio, timers, result tree, or three-coin session modules.

### Result island
`ThreeCoinTool` may dynamically load `PublicReadingResult` only when `publicReading` exists. This is a second-stage optimization and must be implemented only after the homepage split is measured and verified, because the existing result component is large and behaviorally important.

## Verification
- Vitest source-architecture tests lock the homepage boundary and SSR SEO body.
- Existing unit/integration tests must pass.
- `next build` must pass.
- Existing browser, navigation, multilingual, three-coin, result, and SEO gates must pass.
- Existing Lighthouse output is used for measurement, not as proof of a perfect score: the current repository threshold only blocks severe regressions.
- Compare the branch metrics with production before further optimization; no merge until functional gates are green.

## Risk controls
- Keep each boundary change independent and reversible.
- Never trade a launch-gated accessibility/navigation behavior for Lighthouse points.
- Do not combine analytics scheduling changes with first-party bundle changes before measuring the latter.
- If dynamic loading causes hydration or SSR regressions, revert that boundary rather than masking the issue with loading hacks.
