# Deploy your own instance

The template uses one Cloudflare Worker for static assets and `/booking/api/*`, Browser Run for isolated interactive sign-in, and Durable Objects for session ownership and quotas. It does not need a separate proxy domain, bookmark, or extension.

## Local preview

```sh
npm ci
npm test
npm run build
npm run preview
```

The example is a static preview with no API traffic. A local Astro preview does not prove hosted UCSD login. Full hosted-browser authentication requires the configured HTTPS origin and actual provider bindings.

## Prepare a probe deployment

1. Copy `config.example.json` to ignored `config.local.json`.
2. Choose your own Worker hostname or custom domain and set exact `site.origin`. For the default Worker name, a Workers subdomain can use `https://tss-better-booking.<your-subdomain>.workers.dev`. Verify that this is your actual available hostname.
3. Set `site.demo` to `false`, keep `service.probeOnly: true`, `service.directBookingEnabled: false`, and `trustedRoutes: []`.
4. Configure the exact current UCSD Duo tenant origin from an authorized login flow, and your course/term metadata. Do not broaden the authentication guard to a wildcard.
5. Review usage limits and your provider's plan. Authenticate Wrangler using `npx wrangler login`; complete its authorization yourself.
6. Run `npm test`, `npm run build`, and `npm run check`. Inspect `wrangler.example.json`: it is the tracked, nonpersonal template from which local config is generated. Change its neutral Worker name if your instance needs a different one; do not insert account credentials.
7. Run a build-only deployment check:

```sh
npx wrangler deploy --dry-run --config wrangler.local.jsonc --outdir .wrangler/dry-run
```

8. When the origin and account are correct, publish:

```sh
npm run deploy
```

Deployment rejects demo/sample-origin/sample-Duo configuration. The generated config keeps API and assets on the same origin. Verify the returned hostname before opening it; an incorrect APP_ORIGIN causes mutation requests to fail closed. A custom domain needs your own domain routing configuration in the neutral Wrangler template or dashboard. Do not change nameservers merely to deploy this app.

## Validate before enabling Book

Visit `/booking/api/health` and confirm probe mode/direct submission off. Open `/booking/api/test`, complete your own UCSD/Duo login, and follow [read-only validation](VALIDATION.md). The test page contains no enrollment controls. Test two separate browser profiles, logout, expiry, and exact package comparisons.

Only after the owner requests live operation and each route is proven: add exact proof records, set `probeOnly` to `false` and `directBookingEnabled` to `true`, run checks again, and redeploy. Do not deploy while someone is signing in or booking. The first real enrollment should be the user's intended action, not an agent-generated test.

## Limits and cost

The default probe reserves one 15-minute session at a time, with a 90-minute monthly reservation cap. Production supports at most eight simultaneous sessions, 15 minutes each, and 600 reserved minutes/month. Lower configured values are allowed. Reservations include startup and login and are not refunded on early closure. These are application limits, not a billing guarantee or an account-wide spending cap.

Cloudflare's [Browser Run pricing](https://developers.cloudflare.com/browser-run/pricing/) describes browser-time and concurrency charges; check current plan limits before deploying. [Live View](https://developers.cloudflare.com/browser-run/features/live-view/) provides the interactive hosted sign-in. [Worker static-asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) documents same-origin asset/API handling.

## Maintenance

- Keep local configuration, generated files, `.wrangler`, `.dev.vars`, and secrets out of Git.
- Do not enable logging of auth bodies, signed viewer URLs, cookies, tokens, account names, or warnings.
- Revalidate the adapter after upstream changes. An existing proof for one package does not prove a new package.
- Keep direct submission off during diagnostics. A timed-out Save may have succeeded; inspect enrollment before considering another attempt.
- Optional GitHub CI is provided in `ci/verify.yml`. Copy it to `.github/workflows/verify.yml` with workflow-write permission to enable it. It tests the neutral template; your live configuration needs its own local checks and hosted read-only validation.
