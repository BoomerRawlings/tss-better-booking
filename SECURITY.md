# Security model

This is an unofficial self-hosted enrollment interface, not an identity provider. A deployed host and its Cloudflare account operator are trusted: they control the hosted browser and application code. Host only for consenting people who understand that trust relationship.

## Boundaries

- Each visitor owns a separate short-lived managed browser through an opaque Secure, HttpOnly, SameSite=Strict cookie and an isolated Durable Object.
- Frontend profile names do not establish account identity. Enrollment uses the account authenticated inside that visitor's browser.
- API mutations require the configured same origin, an application CSRF token, and a fresh request ID. This application token is distinct from TSS's own CSRF token.
- TSS cookies and its CSRF token stay in the controlled session. They are not sent to the static frontend or stored in a credential database.
- The network guard permits narrowly scoped authentication traffic, bounded read requests, and an explicit enrollment job. Drop, unrelated writes, and arbitrary destinations are blocked.
- Read-only native comparison does not call a save or drop handler. Per-route proof and deployment flags separately gate submission.
- Warnings require explicit review. Confirmation revalidates context. Unknown writes are never automatically retried.
- Browser recording is disabled. Avoid screenshots during login, raw network traces, browser-state exports, and analytics on session endpoints.

## Operational limits

Session time includes login. A new browser reserves its full configured duration against the application's monthly allowance; early logout or startup failure does not refund the reservation. Limits are application controls, not a guarantee about provider billing or account-wide usage.

Redeployment can interrupt active sessions. Avoid deploying while people are authenticating or booking. Browser loss, TSS outages, SSO changes, quota exhaustion, and provider failures can still stop the workflow. A failed response after submission can leave an unknown outcome.

The request guard governs the app-controlled browser. It cannot protect against a malicious host operator with separate provider or CDP access. No claim is made that this prototype is suitable as a public multi-tenant commercial enrollment service without a separate review.

## Public/private data

config.local.json and generated files are ignored by Git. Their displayed profile/course contents still become public static assets after deployment. Prefer aliases; do not publish contact information, student identifiers, enrollment records, screenshots, signed Live View URLs, cookies, auth responses, or logs.

Account names and native warning text are transient and should be visible only in the visitor's owned session. Do not add them to logs, telemetry, URL parameters, persistent browser storage, or shared caches.

## Reporting an issue

Use GitHub private vulnerability reporting when enabled. Do not include credentials, account records, raw traffic, signed viewer links, or private configuration in public issues. If no private reporting channel is available, open only a minimal request for a private contact channel without exploit details or personal data.
