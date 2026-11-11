# Read-only validation before submission

This template intentionally ships without trusted live routes. The current UCSD integration must be validated against the actual native implementation in each deployment. A route URL or a matching course title alone is insufficient.

## Resolve a course option

Use authorized current catalog data to identify the exact module, package, academic year, and session. Group required lecture/discussion/lab events into one selectable package. Confirm dates, times, instructors, and locations from available authoritative data; leave unknown details unconfirmed rather than guessing.

Configure these values locally, with direct booking off. The displayed term is not an identifier: confirm the actual year/session values supplied by TSS. Do not infer them from the calendar year alone.

## Establish an owned session

Deploy with probe-only enabled, then open `/booking/api/test`. A human completes UCSD/Duo inside the hosted browser. Do not capture credentials, signed viewer URLs, cookies, authentication bodies, or screenshots of account records.

Check successful protected-service access and CSRF availability, independent visitors, expiration, and provider closure on logout. If login fails, diagnose the exact handoff read-only; do not weaken guards or repeat human sign-in without a new hypothesis.

## Compare the exact package

The test page runs bounded read-only checks against configured options. Its `verify-direct` operation loads the native detail view for comparison only; ordinary direct Book does not navigate that view.

Require all of the following for each route:

- The native page is the configured exact module/package/year/session.
- Authenticated authoritative reads return the expected identities and a valid token.
- The native handler uses the supported standard booking path.
- Independently reconstructed payload fields and selected events match native preparation, with no differences.
- Unsupported or ambiguous choices are understood and remain disabled.

The comparison may examine an already-enrolled course without changing enrollment. Its eligibility result is separate from payload equivalence. **Do not drop a course to make comparison possible.** Neither native save/drop handler is invoked during proof.

Record a local sanitized summary: exact public course identifiers, time of validation, comparison booleans, field names with differences, and supported native branch. Do not retain payload values that identify a student, account records, or raw session traces. A proof record should not be published merely because it exists locally.

## Release gate

Add a matching `trustedRoutes` record only after the comparison actually passes. Keep unproven routes disabled. The configuration's evidence field is a human/operator assertion; it cannot itself prove compatibility.

On owner authorization, switch to production/direct mode, test configuration and build again, and deploy with no active sessions. Live enrollment still performs fresh context checks and `CheckRegistration`; warnings require explicit review before one `SaveChanges`. Follow-up reads establish booked/waitlisted state. Uncertain results remain unconfirmed and are never automatically resubmitted.

No local test, successful payload comparison, or public HTTP benchmark proves that a future booking will succeed during congestion. TSS eligibility, capacity, authentication, and network conditions remain authoritative.
