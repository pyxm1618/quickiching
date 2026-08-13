# Adsterra Result-Page Ad Slot — Design

Date: 2026-08-13

## Goal

Prepare exactly one Adsterra ad slot for Quick I Ching without enabling advertising in production yet.

The integration must be reviewable and testable in an isolated branch/Preview, but the canonical production site must remain ad-free until a later explicit launch decision.

## Locked scope

- One ad unit only.
- Only the Three-Coin V2 result experience is in scope.
- Do not place ads on the homepage, casting flows, method landing pages, guides, or the 64-hexagram hub.
- Do not merge or production-deploy this work as part of this task.
- Do not change casting/domain logic, interpretation content, SEO metadata, indexing behavior, analytics IDs, or current consent defaults.

## Supplied Adsterra unit

Provider script:

```html
<script async="async" data-cfasync="false" src="https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js"></script>
<div id="container-98a6d22e22a68bd3f38e4eedda19cd18"></div>
```

Canonical identifiers for this integration:

- Script host: `pl30822164.effectivecpmnetwork.com`
- Unit path: `/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js`
- Container ID: `container-98a6d22e22a68bd3f38e4eedda19cd18`

These values are treated as public browser-side identifiers, not secrets.

## Placement decision

Place the single ad slot **after the `Bottom Line` synthesis section and before the `Questions to Sit With` / `What to Watch` reflection section** in the Three-Coin V2 result page.

Rationale:

1. The user receives the complete core reading before encountering advertising.
2. The ad does not interrupt Primary Hexagram, Changing Lines, Relating Hexagram, or the main synthesis.
3. The page still contains useful reflection content below the slot, so the position has materially better viewability than a footer-only placement.
4. The result route is already `noindex, follow`, so the first advertising experiment does not alter the primary `i ching online` SEO landing page.

Rejected placements:

- Inside Primary / Changing Lines: too disruptive to the core reading flow.
- At the very bottom before `Start a New Reading`: lowest UX risk but weak expected viewability.

## Architecture

### `AdsterraResultAd`

Create a dedicated, narrowly scoped component for this unit. It owns only:

- the visible `Advertisement` disclosure;
- the stable outer ad shell;
- the exact Adsterra container ID;
- deferred loading of the supplied `invoke.js` script;
- duplicate-load protection for this unit.

`ReadingResultView` only decides where the component is placed. Provider-specific script mechanics must not be embedded directly throughout the result-page component.

### Configuration boundary

Add a single explicit public feature flag:

```text
NEXT_PUBLIC_ADSTERRA_ENABLED=false
```

Activation semantics are strict:

- Missing value => disabled.
- Any value other than a string whose `trim().toLowerCase()` result is exactly `true` => disabled.
- Only a value whose `trim().toLowerCase()` result is exactly `true` => enabled.

When disabled, the application must render **no Adsterra slot, no provider container, no provider script, and make no Adsterra network request**.

The repository example configuration must remain disabled by default.

The implementation must not hard-code a production auto-enable based on `VERCEL_ENV`; production must remain off until someone explicitly changes the launch configuration in a future task.

### Script loading

When the feature flag is enabled, load the supplied external script after the result UI is available, using a non-critical/deferred loading strategy rather than putting the provider in the initial render-critical path.

Preserve the supplied provider requirements, including the exact script URL and `data-cfasync="false"`. The loading mechanism may be framework-managed rather than parser-blocking, but it must retain asynchronous/non-critical behavior.

The component must not create more than one provider script element for the same unit during normal App Router rendering, re-rendering, or React Strict Mode behavior.

### Layout stability

The ad unit is third-party content and may resize after injection. The wrapper must reserve a stable minimum area when enabled, with responsive bounds that do not overflow 320px mobile layouts.

The exact reserve height cannot be considered production-approved from the snippet alone. A future enablement task must inspect the real rendered unit in Preview at desktop and 320/375/390px widths. If the provider cannot render within a stable reserved region without unacceptable CLS, the production launch must be blocked until corrected.

When the flag is disabled, no empty ad whitespace should be visible.

## CSP and security

The current site has an explicit Content-Security-Policy. The branch must add only the minimum provider origin(s) demonstrably required for the supplied entry script and observed Preview runtime dependencies.

Initial known requirement:

- `script-src`: `https://pl30822164.effectivecpmnetwork.com`

Do not add wildcard `*` allowances.

Do not guess additional third-party domains solely to make the widget work. If Preview execution reveals additional script, image, frame, or connect origins, record each observed origin and add the narrowest necessary directive before any future launch.

Because the PR will remain unmerged, production CSP remains unchanged during this task.

## Privacy and consent boundary

This task prepares technical integration only. It does not constitute approval to start behavioral advertising or to send production visitor data to Adsterra.

Before production enablement, perform a separate launch review covering at least:

- Adsterra cookie/storage behavior actually observed in Preview;
- regional consent/CMP requirements for the site's audience;
- Privacy Policy disclosure changes required by the actual behavior;
- whether the ad format can open popunders, redirects, or other experiences inconsistent with the intended product UX.

Until that review is complete, `NEXT_PUBLIC_ADSTERRA_ENABLED` remains false in production.

## Testing and acceptance criteria

### Disabled-state requirements

Default builds and normal CI must prove:

- no `effectivecpmnetwork.com` script is present in rendered result HTML/DOM;
- the Adsterra container ID is absent;
- no empty advertisement shell is visible;
- existing Three-Coin V2 result behavior remains unchanged;
- homepage SEO, canonical, robots, sitemap, method pages, guides, analytics integration, and current Lighthouse gates remain unchanged by the dormant feature.

### Enabled test-mode requirements

A targeted test/build with `NEXT_PUBLIC_ADSTERRA_ENABLED=true` must prove:

- exactly one advertisement disclosure/slot is rendered in the locked position;
- the exact container ID is present once;
- the exact supplied `invoke.js` URL is used;
- the provider script retains `data-cfasync="false"` and asynchronous/non-critical loading semantics;
- the unit does not render on homepage, method pages, guides, or the hexagram hub;
- 320/375/390px layouts do not horizontally overflow.

Where CI cannot safely call the live advertising network, structural tests should validate the enabled markup/script configuration while live provider behavior is reserved for a manually controlled Preview acceptance pass.

## Rollout

This task ends with a **Draft PR only**.

Do not:

- mark it Ready for Review unless explicitly requested later;
- merge it;
- set the production feature flag to true;
- production-deploy the ad integration;
- change Google/Bing/IndexNow submission state.

A later ad-launch task must rebase/check against the then-current `main`, inspect real Preview behavior, resolve CSP/runtime dependencies, complete privacy/consent review, compare performance/CLS against the ad-free baseline, and receive explicit user approval before production enablement.

## Non-goals

- Multiple ad placements.
- Homepage monetization.
- Ads inside casting interactions.
- Sticky, interstitial, popup, popunder, or auto-redirect ad formats.
- Revenue optimization or A/B testing.
- A general multi-network ad platform abstraction.
- Consent-management-platform implementation in this PR.
