# Configuration

Copy `config.example.json` to `config.local.json` using your editor or platform's file-copy command. The local file is ignored. Run `npm run configure` after editing, or use `npm run build`, which configures automatically.

The generator rejects unknown fields and malformed identifiers. It produces `src/generated/public-config.mjs`, server-only generated modules, and `wrangler.local.jsonc`. Do not hand-edit generated files: the next configure/build replaces them.

| Field | Meaning |
| --- | --- |
| `site.title`, `site.term` | Public heading and term label |
| `site.origin` | Exact HTTPS origin, no path or trailing slash; must match the deployed browser URL |
| `site.demo` | `true` disables frontend API activity; set `false` for an actual probe deployment |
| `auth.duoOrigin` | Exact authorized Duo tenant origin observed in the current UCSD login flow; never use a wildcard |
| `service.probeOnly` | `true` prevents enrollment writes |
| `service.directBookingEnabled` | Defaults `false`; requires production mode and proven exact routes |
| `service.maxBrowserSessions` | Concurrent browser cap; probe mode permits one, production at most eight |
| `service.maxSessionMinutes` | Absolute session window, including login; at most 15 minutes |
| `service.monthlyBrowserMinutes` | Full-window reservations per UTC month; probe maximum 150, production maximum 600 |
| `people` | Public display profiles; use aliases by default |
| `catalogLookups` | Optional configured course codes for bounded read-only catalog checks |
| `trustedRoutes` | Exact routes approved after independent read-only validation; empty by default |

Each profile has a unique slug `id`, a display `name`, optional `major`, and `courses`. A profile only groups course choices; it cannot choose another person's authenticated account. Different visitors must sign in separately.

Each course has `code`, `title`, full `category`, and `options`. Each option has a `label`, exact string `moduleId`, `packageId`, `year`, and `session`, plus `instructors` and `meetings` arrays. The generator derives the TSS route; do not accept arbitrary URLs from a visitor.

Meeting fields are `kind`, `days`, `date`, `startDate`, `endDate`, `startTime`, `endTime`, and `location`. Preserve linked lecture/discussion/lab requirements in the option label and meetings. Include timezone in time labels when needed. Do not count every catalog row as a separate selectable package.

The example term/identifiers and course data are illustrative, not real offerings. Never grant them trust or turn them into a live enrollment test.

## Exact proof records

After following [validation](VALIDATION.md), add one `trustedRoutes` record for each proven package:

```json
{
  "courseCode": "EXAMPLE-101",
  "moduleId": "900001",
  "packageId": "910001",
  "year": "2099",
  "session": "1",
  "evidence": "Local sanitized comparison record for this exact package"
}
```

This example demonstrates the shape only. A nonempty evidence string is an operator attestation, not an automated proof: the operator/agent must actually perform the comparison. The generator checks exact catalog identity; it does not establish live eligibility or trust on its own.

## Privacy

All profile/course display data is compiled into public HTML. Local-file exclusion protects the repository, not the deployed webpage. Use aliases and publish only participant-approved details. The example includes no real students or enrolled/requested course lists. Keep browser/session data, email addresses, student IDs, raw evidence, and credentials out of configuration entirely.
