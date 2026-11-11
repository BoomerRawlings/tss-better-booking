# Agent guide

## Scope

Build an independently configured TSS Better Booking instance. Read README.md, docs/AGENT_SETUP.md, docs/DEPLOYMENT.md, docs/VALIDATION.md, and SECURITY.md before changing authentication or booking behavior.

## Defaults and boundaries

- The checked-in example is a no-network demo. Keep real credentials, names, contact information, account identifiers, deployment details, and course plans out of commits.
- Use ignored config.local.json for instance settings. Generated configuration and dist are ignored. Remember that displayed profiles and courses become public on a deployed website.
- Never copy another deployment's browser session, cookies, tokens, private datasets, or Git history.
- Start in probe-only mode with direct submission off and no trusted routes. Each exact route requires its own read-only validation evidence.
- A human completes university login and Duo. Do not request passwords, store credentials, record login sessions, or print signed viewer URLs.
- Do not enroll or drop a class to test the system. A read-only comparison does not require dropping existing enrollment.
- Do not automatically repeat an uncertain enrollment submission. Confirm its outcome first.
- Do not weaken origin checks, request interception, ownership isolation, route matching, warning review, or quota enforcement to make a test pass.
- The profile filter organizes courses; it never selects or authenticates a student account.
- Do not claim resilience to live congestion based on fixture results or public health timing.

## Working sequence

1. Read any .codex/STATE.md and validate it against the actual files.
2. Run npm ci, npm test, and npm run build before customization.
3. Gather only missing configuration, course/term choices, and host preferences. Use aliases by default.
4. Implement in local configuration, then preview desktop/mobile and reduced motion.
5. Deploy in probe mode on the owner's hosting account and configured origin.
6. Validate authentication ownership, logout/expiry, and exact native/direct payload equivalence read-only.
7. Record only non-sensitive evidence. Enable only proven routes after the owner requests live booking.
8. Check repository contents and history, generated public artifacts, and deployment limits before publication.

Keep .codex/STATE.md concise and free of credentials, personal data, raw logs, machine paths, signed URLs, and private configuration. Record checks performed and their limits. Preserve unrelated work. Do not create a public deployment merely to satisfy a local preview request.
