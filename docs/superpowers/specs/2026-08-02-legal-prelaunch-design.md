# Legal Prelaunch Design

## Objective

Publish a small, independently deployable Quick I Ching public surface from `main` without merging the full production candidate or requiring database, authentication, AI, payment, or workflow credentials.

## Architecture

The root page, pricing page, site header, site footer, and a browser-only three-coin preview are static/client-only. The three legal pages are copied exactly from PR #15 by blob, not by merging its branch. Middleware redirects account, casting backend, checkout, and sensitive API entry points before their route handlers execute.

## Public routes

- `/` — product description, service status, and local six-line coin preview.
- `/pricing` — exact planned 1/3/5-credit prices with disabled checkout.
- `/privacy`, `/terms`, `/acceptable-use` — public legal pages.

## Safety boundaries

- No Waffo, Better Auth, AI Gateway, PostgreSQL, or Workflow initialization from the global layout or public pages.
- No fake payment credential or simulated production checkout.
- No user question, coin result, or identifier is sent or persisted by the browser-only preview.
- Support contact is `support@quickiching.com` everywhere.

## Deployment gate

Vercel must run `bun install --frozen-lockfile` followed by `bun run build`. Merge is allowed only after the preview deployment builds successfully and the four required public URLs return HTTP 200 without authentication.
