# Navigation, language switch, and footer audit

Updated: 2026-08-22

This report records the local verification evidence for the navigation and
language-switching release. It covers the English and Simplified Chinese
headers, mobile drawer, language menu, footer, paired hexagram hubs, and the
production build gate. Local browser screenshots remain in the intentionally
untracked `outputs/navigation-audit/` directory.

## Delivered

- English desktop navigation uses Methods and Guides menus plus direct links to
  64 Hexagrams and History.
- Chinese desktop navigation exposes only 梅花易数 and 易经卦库.
- Mobile and tablet navigation use a body-level modal drawer with a full-screen
  backdrop, scroll lock, focus trap, breakpoint cleanup, and focus restoration.
- Language menus use unique IDs, explicit menu semantics, equivalent-route
  targets, safe Chinese-home fallback labels, and explicit Tab/Shift+Tab focus
  handoff out of an open menu.
- English and Chinese hub pages publish reciprocal `hreflang` metadata.
- Header and footer each expose the visible `Quick I Ching` brand exactly once.
- The navigation gate is part of both the package scripts and the Vercel build
  gate.

## Verification evidence

The following commands were run against the latest local source state:

| Check | Result |
| --- | --- |
| `npm test` | 51 test files, 310 tests passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed, 163 static pages generated |
| `node --check scripts/navigation-audit-gate.mjs` | Passed |
| `node --check scripts/multilingual-browser-gate.mjs` | Passed |
| `git diff --check` | Passed |
| Navigation browser gate before final commit | Five viewports and drawer/dropdown checks passed |
| Multilingual browser gate before final commit | Passed |
| Hexagram SEO browser gate before final commit | 128/128 detail DOM and sampled switches passed |
| SEO quality gate before final commit | 128/128 pages passed, 0 failures |
| Logo browser gate before final commit | Passed |

The final production deployment and live canary remain separate external-state
checks. They must be reported from the deployed URL, not inferred from this
local evidence.
