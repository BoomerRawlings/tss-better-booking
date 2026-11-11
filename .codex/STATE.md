# Project state

- Mode: new project. Objective: reusable, independent TSS booking template and agent-guided deployment.
- Status: release verified; publication in progress. Example profiles only; no real course selections, account data, deployment identity, or imported Git history.
- Defaults: no-network demo, probe-only service, direct submission off, no trusted routes. Live configuration and generated files ignored. Profile display data becomes public if deployed.
- Architecture: static Astro frontend + same-origin Worker API, isolated Browser Run sessions, Durable Object ownership/quotas, exact route allowlist, direct registration check/save with warning review and outcome verification.
- Verified: 276 local tests, zero skips including isolated Chromium fixtures; build and Worker dry-run passed. Demo frontend performs no API calls. Direct-off API/controller gate and per-term write validation covered. Independent privacy review passed.
- Historical baseline: docs/BENCHMARK.md separates bounded public HTTP timings from intercepted synthetic adapter timings. No live enrollment or rush-load benchmark. Reproduction script uses fictional fixtures by default and does not alter local configuration.
- Release checks: fresh npm install on Astro7.4.11, npm audit0 vulnerabilities,276 tests/zero skips, build/output verifier, syntax and Worker dry-run passed. Synthetic test catalog absent from deployment bundle. Desktop/320px filtering/disclosures and no-network demo verified; CSP requires external executable scripts.
- CI is opt-in: ci/verify.yml is an inactive template. Move into .github/workflows with workflow-write permission to enable it. Local release verification is complete; hosted CI has not run.
- Future setup: read AGENTS.md and docs/AGENT_SETUP.md. Human sign-in and hosted read-only exact-route validation required for each deployment. Do not book/drop for testing or automatically retry unknown submissions.
