# Quick I Ching

Quick I Ching is an online I Ching platform with multiple casting methods. The repository contains both the **credential-free Public SEO V1** and preserved code/design work for a later **Commercial V2**.

## Current launch stage: Public SEO V1

The first Google + Bing indexing release is intentionally independent of production auth, database, AI, and payment credentials.

### SEO position

- Homepage primary keyword / intent: **`i ching online`**
- Homepage default tool: **Three-Coin Method**
- Canonical production origin: **`https://www.quickiching.com`**
- One primary intent = one canonical URL; near-synonym doorway pages are redirected rather than duplicated.

### Public V1 casting methods

1. `/` and `/methods/three-coin` — Three-Coin Method
2. `/methods/yarrow-stalks` — Yarrow Stalk Method
3. `/methods/mei-hua-yi-shu` — Mei Hua Yi Shu current-time casting

All three free flows end with:

- complete six-line hexagram;
- primary hexagram number/name;
- changing-line positions;
- relating hexagram when moving lines exist;
- original free basic interpretation;
- reflection / non-deterministic / non-professional-advice boundary.

No sign-in, payment, credit, database, or production AI call is required for the free flow.

### Public knowledge pages

- `/guides/how-to-ask-the-i-ching`
- `/guides/changing-lines`
- `/guides/primary-relating-hexagrams`
- `/hexagrams` — 64 Hexagrams hub (no mass-generated thin detail pages in V1)

### Technical SEO

- `www.quickiching.com` is the canonical host.
- Legacy intent URLs use permanent redirects to their relevant canonical pages.
- Obsolete account/checkout routes do not soft-redirect to the homepage.
- `/sitemap.xml` lists only canonical indexable Public V1 pages.
- `/robots.txt` references the production sitemap.
- IndexNow is implemented as a dry-run-first CLI; **do not use `--submit` before independent final audit approval**.

```bash
bun run indexnow
```

## Commercial V2 — preserved future scope

The existing repository also contains earlier commercial architecture and domain work. It is not deleted, but it is not a dependency of the Public SEO V1 indexing launch.

Commercial V2 may later activate:

- personalized AI deep readings based on user context and goals;
- production authentication;
- persistent database/history;
- payment and credits;
- commercial quality/review/refund workflows.

The product boundary is deliberate:

- **Free Public V1:** explains the cast and hexagram structure itself.
- **Future paid deep reading:** may personalize interpretation using the user's specific situation and goal.

Do not infer from the older PRD that Google/Bing indexing must wait for Commercial V2.

## Domain architecture

Shared pure domain logic lives under `src/domain/casting`:

- `three-coin/algorithm.ts`
- `yarrow/algorithm.ts`
- `mei-hua/algorithm.ts`
- `hexagrams/compute.ts`
- `hexagrams/king-wen.ts`

Browser-only randomness is adapted through `src/lib/browser-random.ts` using Web Crypto. Public UI components call the shared domain functions rather than maintaining separate casting formulas.

Original free interpretation content lives in `src/domain/interpretation/basic.ts`.

Algorithm/content provenance and the exact Yarrow + Mei Hua conventions are documented in `docs/PUBLIC_SEO_V1_PROVENANCE.md`.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Vitest
- Bun workflow (`bun.lock` + frozen install on Vercel)

## Local quality commands

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
bun run indexnow        # dry-run only
```

The older Commercial V2 design remains in `docs/PRD.md` and `docs/技术设计文档.md`; both documents must be read together with their Public SEO V1 stage override at the top.
