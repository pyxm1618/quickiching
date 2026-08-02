# GA4 Basic Consent Design

## Goal

Add Google Analytics 4 to Quick I Ching without loading Google tags or sending data before a visitor explicitly accepts optional analytics.

## Policy fit

The existing Privacy Policy states that Google Analytics is optional, loads only after analytics consent, does not condition access to the core service, and stops when consent is rejected or withdrawn. That is consistent with Google Basic Consent Mode: Google tags remain fully blocked before consent and no data, including consent status, is sent to Google when consent is denied.

This is a privacy-conservative product choice for Quick I Ching because question text and reading content can contain sensitive personal context. It is not a substitute for jurisdiction-specific legal advice.

## Architecture

### Consent storage

- Store the visitor choice in a first-party cookie named `qic_analytics_consent`.
- Accepted values are `granted` and `denied`.
- Use `Path=/`, `SameSite=Lax`, a 180-day lifetime, and `Secure` on HTTPS.
- An absent or invalid value means no decision has been made.

### Tag loading

- GA4 is active only in a production build with a valid `NEXT_PUBLIC_GA_MEASUREMENT_ID` matching `G-[A-Z0-9]+`.
- Do not render or request `googletagmanager.com` before consent is `granted`.
- On grant, initialize Consent Mode v2 with analytics storage granted and all advertising consent states denied.
- Disable Google Signals and advertising-personalization signals in the GA4 configuration.
- Rely on GA4 Enhanced Measurement for initial and History API page views; do not add duplicate manual page-view tracking.

### Withdrawal

- The footer exposes a persistent `Cookie settings` control.
- A visitor can change a prior decision at any time.
- Withdrawing consent sends a denied consent update when GA is present, removes first-party cookies whose names begin with `_ga`, persists `denied`, and reloads the page so the Google tag is absent from the new document.

### Event safety

- Provide a single `trackAnalyticsEvent` function.
- It is a no-op until GA has loaded after consent.
- Event names must use GA-compatible lowercase snake case.
- Parameters are restricted to an explicit allowlist.
- String parameter values must be short machine tokens, not free-form text.
- The interface must not accept question text, context, email, reading/report content, authentication secrets, or payment details.

## UI

- Show a fixed English consent panel only when GA is configured and the visitor has no stored choice.
- Explain that Analytics is optional and that sensitive question, email, reading, and payment content is not sent.
- Provide visible `Reject analytics` and `Accept analytics` actions without requiring an extra settings screen.
- Link to the Privacy Policy.
- When opened from the footer after a decision, show the current choice and a `Close` action.

## Files

- `src/lib/analytics-consent.ts`: pure consent parsing, serialization, ID validation, and cookie-deletion helpers.
- `src/lib/analytics-consent.test.ts`: node-environment unit tests for the pure policy boundary.
- `src/lib/analytics.ts`: safe analytics event interface.
- `src/components/analytics/google-analytics.tsx`: consent-aware Google tag loader.
- `src/components/analytics/analytics-consent.tsx`: consent state, panel, grant, rejection, withdrawal, and cookie cleanup.
- `src/components/analytics/cookie-settings-button.tsx`: footer control that opens the consent panel.
- `src/app/layout.tsx`: mount the consent controller globally.
- `src/components/site-footer.tsx`: expose Cookie settings.
- `.env.example`: document `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

## Verification

- Unit tests cover valid and invalid consent cookies, cookie serialization, measurement-ID validation, GA-cookie discovery, safe event-parameter filtering, and rejection of free-form or forbidden parameters.
- Lint, TypeScript, focused tests, full tests, and production build are required. Pre-existing unrelated failures must be reported separately rather than attributed to this feature.
- Browser verification must confirm no Google request before consent, GA requests after acceptance, persistence across navigation, and no GA request after withdrawal and reload.
