# Build an instance with an agent

Give the agent this repository and the following brief. Use a local checkout or a new private repository for your own configuration work.

> Build my own TSS Better Booking deployment. Read AGENTS.md and all setup/security documents first. Verify the clean template with npm ci, npm test, and npm run build. Ask only for missing hosting details, profile aliases, courses, and terms. Keep that configuration in ignored config.local.json. Preview the site, then deploy in probe-only mode on my own Cloudflare account. I will complete UCSD/Duo authentication myself. Validate ownership, expiry, logout, and exact course-package payload equivalence without enrollment writes. Do not book or drop classes for testing. Show the evidence and remaining limits; keep submission disabled until I request it. Publish only sanitized code, never local configuration, screenshots of sign-in, tokens, or logs.

## What the agent needs

- Terminal and repository access, Node.js/npm, and a browser for local UI checks.
- Access to your Cloudflare account through its normal authorization flow. Do not paste API credentials into chat or commit them.
- Your intended HTTPS origin, profile aliases, requested course codes, and academic year/term.
- Authorized read-only access to current TSS course data and native behavior. The example identifiers are deliberately fictional.
- Human participation for UCSD/Duo and any explicit enrollment decision.

The agent can extract public course details, group linked meetings into exact packages, implement configuration, run tests, and deploy. It cannot infer a valid account session from a profile name or guarantee that a course will be available.

## Completion criteria

1. Demo builds from a clean install; local tests pass with any skipped browser fixtures clearly reported.
2. Your profiles/options render at desktop and narrow mobile widths without horizontal overflow. Reduced motion works.
3. Only intended public aliases and course details appear in generated assets. No secrets or private configuration enter Git history.
4. The hosted health endpoint reports probe mode. Authentication occurs in a separate owned browser; a second visitor cannot use the first visitor's session.
5. Logout and expiry close the provider session. Temporary outages do not silently authorize a write.
6. Each enabled route has a matching read-only comparison for exact module, package, year, and term. Unsupported native branches remain disabled.
7. Warnings pause for explicit review. Unknown results cannot trigger an automatic repeat.
8. The owner knows the session/concurrency/reservation limits and explicitly requests live operation before the submission flags are changed.

Revalidate after a TSS implementation change or a new exact package. Retain only sanitized summaries; a raw browser capture is not a safe evidence artifact.
