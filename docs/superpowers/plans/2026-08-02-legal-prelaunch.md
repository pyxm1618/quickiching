# Legal Prelaunch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a credential-free public Quick I Ching surface with legal pages, public pricing, monitored support contact, and disabled production-only entry points.

**Architecture:** Replace the global dynamic authentication header with static site chrome, add a browser-only coin preview, reuse the three legal-page blobs from PR #15, and redirect sensitive routes through middleware. Vercel uses frozen Bun installation and the repository build script.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Vercel.

## Global Constraints

- Base all work on current `main`.
- Do not merge PR #12 or PR #15.
- Do not initialize Waffo, Better Auth, AI Gateway, PostgreSQL, or Workflow.
- Do not use fake production credentials.
- Public legal URLs must load without authentication.
- Publish planned prices at `/pricing`; checkout remains disabled.

---

### Task 1: Static public shell

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/site-header.tsx`
- Modify: `src/components/site-footer.tsx`

- [x] Remove global authentication lookup.
- [x] Apply Quick I Ching metadata and branding.
- [x] Expose legal and support links.

### Task 2: Live credential-free preview

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/prelaunch-coin-cast.tsx`
- Modify: `src/app/pricing/page.tsx`

- [x] Publish a truthful product description and service status.
- [x] Add a browser-only six-line coin-casting preview.
- [x] Publish exact planned prices with checkout disabled.

### Task 3: Legal pages and route isolation

**Files:**
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/terms/page.tsx`
- Create: `src/app/acceptable-use/page.tsx`
- Create: `src/middleware.ts`

- [x] Copy legal pages from PR #15 without merging its branch.
- [x] Redirect sign-in, account, backend casting, checkout, and sensitive API routes.

### Task 4: Deployment configuration and verification

**Files:**
- Create: `vercel.json`
- Modify: `package.json`

- [x] Force `bun install --frozen-lockfile`.
- [x] Force `bun run build`.
- [ ] Confirm Vercel preview build succeeds.
- [ ] Confirm `/`, `/privacy`, `/terms`, `/acceptable-use`, and `/pricing` are public.
- [ ] Merge to `main` only after all preview checks pass.
