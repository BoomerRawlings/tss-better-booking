# Deployed reference baseline

This is the recorded baseline of the deployed reference before template extraction. It is retained unchanged as historical evidence; it is not a claim that this template has been deployed or benchmarked against real enrollment. Fresh template measurements are separate, using the commands below.

HTTP measured 2026-11-11T22:13:36.473Z; synthetic run began 2026-11-11T22:16:09.780Z. Unchanged code; no login, real enrollment action, or load test.

## Public HTTP

Five sequential requests per target. Times are milliseconds from Node fetch start; response-header arrival is not server-only time. Body bytes are decoded. Network/CDN state and connection reuse were uncontrolled. All HTML/script/style samples matched the supplied local build byte-for-byte; asset references also matched.

| Target | Bytes | Headers min / median / max (ms) | Body complete min / median / max (ms) | Build bytes match |
| --- | ---: | ---: | ---: | --- |
| page | 56800 | 52.35 / 59.59 / 291.55 | 53.41 / 62.50 / 299.33 | true |
| health | 87 | 30.34 / 59.12 / 98.02 | 31.29 / 59.92 / 99.84 | Not applicable |
| script1 | 3697 | 36.84 / 41.64 / 76.37 | 37.22 / 42.48 / 77.57 | true |
| script2 | 16880 | 19.61 / 42.38 / 66.26 | 20.63 / 43.36 / 67.36 | true |
| style1 | 15920 | 34.26 / 41.24 / 75.78 | 34.92 / 42.11 / 77.48 | true |
| style2 | 20013 | 37.58 / 54.46 / 68.57 | 38.74 / 55.13 / 69.40 | true |

60 public requests issued; 30 retained samples. Initial HTTP samples were not saved before a local synthetic-fixture constructor error; one complete sampling pass was repeated. No institutional endpoint contacted by this HTTP measurement. Health availability does not establish browser/session/enrollment readiness.

## Synthetic request structure

Unmodified auth + direct adapter, every fetch intercepted in memory. One fresh authentication GET precedes Book, matching the service gate; confirmation rereads authoritative data. Three repeats at each uniform simulated per-request delay: 0, 25, and 100 ms. No DOM reads or navigation; no requests on repeated operation identifier. One synthetic Save at most.

| Fixture | GET | POST | Peak concurrent requests across delays | Terminal result | Median elapsed at 0 / 25 / 100 ms delay (ms) |
| --- | ---: | ---: | ---: | --- | ---: |
| full_flags_single_component | 11 | 2 | 4 | booked | 5.15 / 228.24 / 780.05 |
| optional_tabs_hidden | 9 | 2 | 3 | booked | 9.13 / 203.42 / 673.18 |
| header_has_template | 11 | 2 | 4 | booked | 14.94 / 233.13 / 783.00 |
| three_components | 11 | 2 | 4 | booked | 12.90 / 234.06 / 782.62 |
| check_warning_confirmed | 19 | 2 | 4 | booked | 15.53 / 343.01 / 1108.91 |
| eligibility_stop | 4 | 0 | 3 | eligibility_unavailable | 15.27 / 80.16 / 235.81 |
| save_rejected | 9 | 2 | 4 | booking_error | 14.26 / 200.17 / 672.47 |
| save_reply_lost | 9 | 2 | 4 | submission_uncertain | 15.12 / 204.74 / 673.29 |

Each fixture and full sanitized trace is in [the recorded JSON](benchmarks/deployed-reference.json). These are simulations, not measured live booking times. The standard fixture requests settings, protected service metadata/CSRF, header, events, group, package, exams, template, CheckRegistration, SaveChanges, then header/events outcome verification. Header-provided template still triggers a template read when that flag is enabled. Warning confirmation repeats preparation; it never repeats Check or Save.

## Validation and environment

230/230 Worker tests passed; 0 failed; 0 skipped. Reported duration 6897.47 ms. Includes actual isolated Chromium guard/SSO tests with synthetic loopback services. Node v24.18.0, win32/arm64, Chromium 157.0.8103.39.

## Limits

- No live login or enrollment benchmark. No real Book, Drop, account access, or private course selection performed.
- No rush-load, concurrency-load, availability, capacity, or end-to-end user latency claim.
- Small single-client samples; min/median/max are descriptive, not percentile estimates or guarantees.
- Synthetic delays and response shapes demonstrate dependency ordering only; they do not predict institutional server performance.
- Synthetic times include Node timer scheduling and a 2 ms requested status-poll interval; especially at zero injected delay, they are not isolated adapter CPU timings.
- The synthetic adapter selects one existing allowlist identity internally; all course/route/account identifiers are omitted from the report.
- Public HTML, linked script and stylesheet bytes match the supplied local build; health confirms only endpoint availability. Private Worker source identity is not established by public byte comparison.

## Run a fresh template benchmark

With Node 24 and dependencies installed:

```sh
npm run benchmark
```

This defaults to **zero network traffic**. It runs eight synthetic cases at 0, 25, and 100 ms injected fetch delay, three repetitions each. The current adapter template is generated in memory with the fictional example catalog, exactly as `configure` substitutes catalog data. It never replaces local configuration/generated files, changes the deployed allowlist, or dispatches a real request. The current authentication function runs against the same in-memory fixture.

Results go to ignored `.benchmark/run.json`; the historical report above is never overwritten. `npm run benchmark -- --quick true` runs one zero-delay pass for harness validation, not a full timing sample. Node scheduling and the requested 2 ms status-poll interval affect results, especially with zero injected delay.

To sample your own public deployment, first build its matching local frontend, then explicitly supply both URLs:

```sh
npm run build
npm run benchmark -- --page-url https://booking.example.org/booking/ --health-url https://booking.example.org/booking/api/health
```

Replace those sample URLs with your deployment. Environment variables `BENCHMARK_PAGE_URL` and `BENCHMARK_HEALTH_URL` are equivalent. The script rejects institutional login/enrollment hosts, session API page targets, credentials, queries, fragments, and cross-origin assets. It sends five sequential requests per public page, health, linked script, and stylesheet; 200 ms spacing, 20-second timeout. HTML and assets must byte-match the local build. Health bodies are discarded; report labels contain no URLs. HTTP samples checkpoint to ignored `.benchmark/public-http.json`.

Use `--output-dir` only for a separate scratch directory; never replace this recorded reference evidence. `--dist-dir` and `--page-file` optionally select a different matching frontend build. Test results are independent: run `npm test`, enabling the documented isolated Chromium fixtures when available. No local benchmark or fixture result establishes that your hosted UCSD/Duo flow works.
