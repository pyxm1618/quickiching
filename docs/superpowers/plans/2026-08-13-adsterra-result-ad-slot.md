# Adsterra Result-Page Ad Slot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare one dormant Adsterra native ad slot on the Three-Coin V2 result page, positioned after `Bottom Line` and before reflection content, without enabling advertising in production.

**Architecture:** Keep provider mechanics inside a dedicated client component and keep activation inside one explicit public feature flag. A small pure configuration module owns the canonical Adsterra identifiers and flag parsing; the result view only places the component. CSP gains the Adsterra script origin only when the same feature flag is enabled, so disabled builds remain network- and policy-equivalent to the current ad-free site.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, Puppeteer browser gates, Vercel/GitHub Actions.

## Global Constraints

- Exactly one Adsterra unit.
- Placement: after `Bottom Line`, before `Questions to Sit With` / `What to Watch`.
- Script URL: `https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js`.
- Container ID: `container-98a6d22e22a68bd3f38e4eedda19cd18`.
- Feature flag: `NEXT_PUBLIC_ADSTERRA_ENABLED`; missing/false means disabled, normalized `true` means enabled.
- Disabled means no slot DOM, no container, no provider script, and no Adsterra network request.
- Do not place ads on homepage, casting flows, method pages, guides, or `/hexagrams`.
- Do not change SEO metadata/indexability, casting/domain logic, interpretation content, GA4/Clarity identifiers, or consent defaults.
- Do not add wildcard CSP allowances.
- End state is a Draft PR only; do not merge or production deploy.

---

## File structure

- Create `src/lib/adsterra.ts`: canonical unit identifiers and strict feature-flag parser.
- Create `src/lib/adsterra.test.ts`: unit coverage for flag semantics and exact provider identifiers.
- Create `src/components/ads/adsterra-result-ad.tsx`: single-result-slot presentation and deferred/duplicate-safe provider loader.
- Modify `src/components/three-coin-result/reading-result-view.tsx`: place one `<AdsterraResultAd />` after `Bottom Line`.
- Modify `.env.example`: document `NEXT_PUBLIC_ADSTERRA_ENABLED=false`.
- Modify `next.config.mjs`: expose a pure CSP builder and conditionally add only the supplied Adsterra script origin when enabled.
- Modify `next.config.test.mjs`: prove disabled CSP is unchanged and enabled CSP adds only the known origin.
- Modify `scripts/three-coin-v2-browser-gate.mjs`: prove the default CI build exposes no Adsterra DOM or provider requests.

---

### Task 1: Lock configuration semantics with tests

**Files:**
- Create: `src/lib/adsterra.test.ts`
- Create: `src/lib/adsterra.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `ADSTERRA_RESULT_UNIT`, `isAdsterraEnabledValue(value: string | undefined): boolean`.
- `ADSTERRA_RESULT_UNIT` contains `scriptUrl`, `scriptOrigin`, `containerId`, and `scriptElementId`.

- [ ] **Step 1: Write failing configuration tests**

```ts
import { describe, expect, it } from "vitest";
import { ADSTERRA_RESULT_UNIT, isAdsterraEnabledValue } from "./adsterra";

describe("Adsterra result ad configuration", () => {
  it("stays disabled unless the normalized flag is exactly true", () => {
    expect(isAdsterraEnabledValue(undefined)).toBe(false);
    expect(isAdsterraEnabledValue("")).toBe(false);
    expect(isAdsterraEnabledValue("false")).toBe(false);
    expect(isAdsterraEnabledValue("1")).toBe(false);
    expect(isAdsterraEnabledValue(" true ")).toBe(true);
    expect(isAdsterraEnabledValue("TRUE")).toBe(true);
  });

  it("pins the reviewed single Adsterra unit", () => {
    expect(ADSTERRA_RESULT_UNIT).toEqual({
      scriptOrigin: "https://pl30822164.effectivecpmnetwork.com",
      scriptUrl: "https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js",
      containerId: "container-98a6d22e22a68bd3f38e4eedda19cd18",
      scriptElementId: "adsterra-result-native-loader",
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `bunx vitest run src/lib/adsterra.test.ts`

Expected: FAIL because `src/lib/adsterra.ts` does not exist.

- [ ] **Step 3: Implement the minimal configuration module**

```ts
export const ADSTERRA_RESULT_UNIT = {
  scriptOrigin: "https://pl30822164.effectivecpmnetwork.com",
  scriptUrl: "https://pl30822164.effectivecpmnetwork.com/98a6d22e22a68bd3f38e4eedda19cd18/invoke.js",
  containerId: "container-98a6d22e22a68bd3f38e4eedda19cd18",
  scriptElementId: "adsterra-result-native-loader",
} as const;

export function isAdsterraEnabledValue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
```

- [ ] **Step 4: Document the disabled-by-default flag**

Append to `.env.example`:

```text
# Adsterra result-page native unit. Keep false until a separate ad-launch review approves production enablement.
NEXT_PUBLIC_ADSTERRA_ENABLED=false
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `bunx vitest run src/lib/adsterra.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/adsterra.ts src/lib/adsterra.test.ts .env.example
git commit -m "test: lock dormant Adsterra configuration"
```

---

### Task 2: Add the isolated dormant result-slot component

**Files:**
- Create: `src/components/ads/adsterra-result-ad.tsx`
- Modify: `src/components/three-coin-result/reading-result-view.tsx`

**Interfaces:**
- Consumes: `ADSTERRA_RESULT_UNIT`, `isAdsterraEnabledValue` from `@/lib/adsterra`.
- Produces: `AdsterraResultAd(): JSX.Element | null`.

- [ ] **Step 1: Create the client component with an explicit disabled fast path**

Implementation requirements:

```tsx
"use client";

import { useEffect } from "react";
import { ADSTERRA_RESULT_UNIT, isAdsterraEnabledValue } from "@/lib/adsterra";

const ENABLED = isAdsterraEnabledValue(process.env.NEXT_PUBLIC_ADSTERRA_ENABLED);

export function AdsterraResultAd() {
  useEffect(() => {
    if (!ENABLED) return;

    const container = document.getElementById(ADSTERRA_RESULT_UNIT.containerId);
    if (!container) return;
    if (document.getElementById(ADSTERRA_RESULT_UNIT.scriptElementId)) return;

    let idleId: number | null = null;
    let timeoutId: number | null = null;
    let script: HTMLScriptElement | null = null;

    const inject = () => {
      if (document.getElementById(ADSTERRA_RESULT_UNIT.scriptElementId)) return;
      script = document.createElement("script");
      script.id = ADSTERRA_RESULT_UNIT.scriptElementId;
      script.async = true;
      script.dataset.cfasync = "false";
      script.src = ADSTERRA_RESULT_UNIT.scriptUrl;
      container.parentElement?.insertBefore(script, container);
    };

    const schedule = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(inject, { timeout: 2000 });
      } else {
        timeoutId = window.setTimeout(inject, 0);
      }
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      window.removeEventListener("load", schedule);
      if (idleId !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      script?.remove();
    };
  }, []);

  if (!ENABLED) return null;

  return (
    <aside
      className="mt-8 min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-black/10 px-3 py-4 sm:px-5"
      aria-label="Advertisement"
      data-adsterra-result-slot
    >
      <p className="mb-3 text-center font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-3)]">Advertisement</p>
      <div className="mx-auto min-h-[250px] w-full max-w-[970px] overflow-hidden" id={ADSTERRA_RESULT_UNIT.containerId} />
    </aside>
  );
}
```

If the DOM typings used by this repository do not expose `requestIdleCallback`, declare a narrow local type/helper rather than adding a dependency.

- [ ] **Step 2: Place exactly one component at the locked semantic break**

In `reading-result-view.tsx`, import `AdsterraResultAd` and render it immediately after the `Bottom Line` section and before the reflection two-column grid:

```tsx
      <section className={`${styles.bottomLine} ...`}>
        ...
      </section>

      <AdsterraResultAd />

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
```

- [ ] **Step 3: Run typecheck and lint for the component boundary**

Run:

```bash
bun run typecheck
bun run lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ads/adsterra-result-ad.tsx src/components/three-coin-result/reading-result-view.tsx
git commit -m "feat: prepare dormant Adsterra result slot"
```

---

### Task 3: Keep CSP closed while the feature is disabled

**Files:**
- Modify: `next.config.mjs`
- Modify: `next.config.test.mjs`

**Interfaces:**
- Produces: `buildContentSecurityPolicy(environment = process.env): string`.
- The default `headers()` path calls the builder; no other header behavior changes.

- [ ] **Step 1: Add failing CSP tests**

Add tests that assert:

```js
expect(buildContentSecurityPolicy({})).not.toContain("effectivecpmnetwork.com");
expect(buildContentSecurityPolicy({ NEXT_PUBLIC_ADSTERRA_ENABLED: "false" })).not.toContain("effectivecpmnetwork.com");
expect(buildContentSecurityPolicy({ NEXT_PUBLIC_ADSTERRA_ENABLED: "true" }))
  .toContain("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.clarity.ms https://pl30822164.effectivecpmnetwork.com");
```

Also retain the existing GA4/Clarity assertions.

- [ ] **Step 2: Run the focused config test and verify RED**

Run: `bunx vitest run next.config.test.mjs`

Expected: FAIL because `buildContentSecurityPolicy` is not exported and enabled CSP is unsupported.

- [ ] **Step 3: Extract the pure CSP builder and conditionally append the one known origin**

`next.config.mjs` should build `script-src` from the existing sources, append `https://pl30822164.effectivecpmnetwork.com` only when `NEXT_PUBLIC_ADSTERRA_ENABLED` normalizes to `true`, and leave every other directive unchanged.

- [ ] **Step 4: Run the focused config test and verify GREEN**

Run: `bunx vitest run next.config.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs next.config.test.mjs
git commit -m "security: gate Adsterra CSP origin behind feature flag"
```

---

### Task 4: Prove dormant builds stay ad-free in the browser gate

**Files:**
- Modify: `scripts/three-coin-v2-browser-gate.mjs`

**Interfaces:**
- Existing CI/default build remains `NEXT_PUBLIC_ADSTERRA_ENABLED` unset/false.
- The gate must fail if the dormant integration leaks DOM or network activity.

- [ ] **Step 1: Add disabled-state assertions to seeded result verification**

After the result loads, collect:

```js
const adState = await page.evaluate(() => ({
  slotCount: document.querySelectorAll("[data-adsterra-result-slot]").length,
  containerCount: document.querySelectorAll("#container-98a6d22e22a68bd3f38e4eedda19cd18").length,
  scriptCount: [...document.scripts].filter((script) => script.src.includes("effectivecpmnetwork.com")).length,
}));
assert.deepEqual(adState, { slotCount: 0, containerCount: 0, scriptCount: 0 });
```

Attach a request listener before navigation and assert that no request URL includes `effectivecpmnetwork.com`.

- [ ] **Step 2: Preserve existing mobile overflow and deterministic reading checks**

No existing result text, refresh/back/forward, storage fail-fast, noindex, or viewport assertions may be weakened.

- [ ] **Step 3: Run the result browser gate locally when Chrome is available**

Run against a production build/server using the repository's existing gate harness. Expected: all existing Three-Coin V2 gates plus dormant-Adsterra assertions PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/three-coin-v2-browser-gate.mjs
git commit -m "test: prove dormant Adsterra integration is inert"
```

---

### Task 5: Full verification and Draft PR

**Files:**
- No new product scope.
- Review all files changed on `adsterra-native-slot-v1` relative to `main`.

- [ ] **Step 1: Run fast verification**

```bash
bun run lint
bun run typecheck
bun run test
```

Expected: PASS.

- [ ] **Step 2: Run production build and existing launch gates**

Run the same build/browser/Lighthouse gate used by GitHub Actions. Confirm homepage SEO/canonical/robots remain unchanged and the Three-Coin result gate passes with no Adsterra request in the default build.

- [ ] **Step 3: Review diff for scope**

Confirm:

- exactly one placement;
- no homepage/method/guide/hexagram ad component;
- no production default enablement;
- no wildcard CSP;
- no changes to GA4/Clarity IDs or consent behavior;
- no SEO/indexability changes;
- no casting/interpretation changes.

- [ ] **Step 4: Create a Draft PR**

Title: `Ads: prepare dormant Adsterra result-page slot`

PR body must explicitly state:

- `NEXT_PUBLIC_ADSTERRA_ENABLED` defaults off;
- production remains ad-free;
- placement is after `Bottom Line` and before reflection;
- only the supplied Adsterra unit is wired;
- live provider/CSP/privacy/CLS behavior requires a separate Preview launch review before enablement;
- do not merge or production deploy as part of this task.

- [ ] **Step 5: Leave the PR Draft/open/unmerged**

Do not mark Ready, merge, alter production Vercel configuration, or submit Google/Bing/IndexNow.
