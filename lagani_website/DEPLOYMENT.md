# Website deployment runbook

This runbook covers a managed Next.js deployment and the included OCI container. The website has no runtime API/database dependency, but its canonical origin, legal contact, and store links are embedded at build time.

## 1. Required release inputs

Obtain and verify these values before the production build:

```dotenv
NEXT_PUBLIC_SITE_URL=https://your-final-domain.example
NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/...
NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=...
NEXT_PUBLIC_SUPPORT_EMAIL=support@your-final-domain.example
```

Rules:

- `NEXT_PUBLIC_SITE_URL` must be the exact public HTTPS origin, with no path.
- Store URLs must point directly to the published Lagani listings. Do not use an internal console/test-flight URL or `#`.
- It is valid to omit one or both store URLs until those listings are public. The page will say “Coming soon.”
- The support mailbox must be monitored and have an owner/response process.
- These are public values. Never put API admin keys, signing credentials, database details, or other secrets in `NEXT_PUBLIC_*` variables.
- A variable change requires rebuilding, not merely restarting the old artifact.

## 2. Release verification

From a clean checkout:

```bash
cd lagani_website
npm ci
npm run verify
npm audit --omit=dev
```

Then test the release-state branch with the real public variables:

```bash
NEXT_PUBLIC_SITE_URL=https://your-final-domain.example \
NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/... \
NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=... \
NEXT_PUBLIC_SUPPORT_EMAIL=support@your-final-domain.example \
npm run verify
```

`npm run smoke` checks generated HTML and fails if a configured store URL was not embedded. Review the output manually too: automated checks cannot prove that a syntactically valid URL belongs to Lagani.

## 3. Managed Next.js host

Recommended sequence for Vercel or a comparable managed host:

1. Import the root Git repository.
2. Set the project root to `lagani_website`.
3. Select Node.js 22.
4. Use `npm ci` as install command and `npm run build` as build command; CI should already have run `npm run verify`.
5. Add the four production variables to the production environment and suitable non-production values to preview/staging.
6. Deploy to a provider preview URL first.
7. Verify preview behavior and headers.
8. Attach the final domain and enforce redirect from all alternate hostnames to the canonical hostname.
9. Enforce HTTP-to-HTTPS redirect and HSTS at the edge.
10. Rebuild with `NEXT_PUBLIC_SITE_URL` equal to the final origin, then promote.

Do not use the preview hostname as production `NEXT_PUBLIC_SITE_URL`; that would produce incorrect canonical tags and sitemap URLs.

## 4. Container deployment

Build with public values as Docker build arguments:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-final-domain.example \
  --build-arg NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/... \
  --build-arg NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=... \
  --build-arg NEXT_PUBLIC_SUPPORT_EMAIL=support@your-final-domain.example \
  --tag lagani-website:2026-08-12 .
```

Run locally:

```bash
docker run --rm --publish 3000:3000 lagani-website:2026-08-12
```

The multi-stage image:

- builds with Node 22 Alpine;
- runs the full verification suite during the image build;
- installs production packages only in the runtime layer;
- runs as an unprivileged `nextjs` user;
- listens on port 3000; and
- contains the generated Next.js build and local public assets.

The public build args appear in the generated site by design. Do not pass secrets as build args.

## 5. Edge and runtime configuration

The application emits CSP, frame, MIME, referrer, permissions, and opener headers. The hosting layer should add:

- TLS certificates with automated renewal;
- permanent HTTP-to-HTTPS redirects;
- `Strict-Transport-Security` only after HTTPS and subdomain consequences are understood;
- compression and immutable caching for hashed `/_next/static/*` assets;
- reasonable request and error logging with a documented retention period;
- uptime/error monitoring for `/`; and
- protection against accidental exposure of preview deployments if preview content is private.

Do not overwrite the application's security headers without comparing the resulting values. If the provider injects a second CSP, browsers enforce both policies, which can produce unexpected blocking.

## 6. Post-deployment smoke test

Replace the origin below and run:

```bash
origin=https://your-final-domain.example

curl --fail --silent --show-error "$origin/" >/dev/null
curl --fail --silent --show-error "$origin/privacy" >/dev/null
curl --fail --silent --show-error "$origin/terms" >/dev/null
curl --fail --silent --show-error "$origin/robots.txt"
curl --fail --silent --show-error "$origin/sitemap.xml"
curl --silent --show-error --head "$origin/"
```

Confirm:

- home, privacy, terms, robots, and sitemap return 200;
- an unknown route returns 404;
- canonical and Open Graph URLs use the final origin;
- each configured store link opens the exact public listing in a new tab;
- each unconfigured store displays “Coming soon” and is not clickable;
- the support link targets the monitored mailbox;
- CSP and the other security headers are present;
- no browser console error appears;
- all images load on phone and desktop widths;
- keyboard focus and the skip link work; and
- the site is usable while the Lagani API is unavailable.

Also inspect sharing previews on the target platforms. This release uses summary metadata and the logo/favicon; add a purpose-built social image in a future reviewed change if desired.

## 7. Rollout and rollback

Use an immutable artifact or provider deployment identifier. Keep at least the last known-good production build available.

Recommended rollout:

1. deploy to preview/staging;
2. complete automated and human smoke checks;
3. promote the exact tested artifact;
4. monitor 4xx/5xx rate, latency, CSP violations if reported, and store-link reports;
5. do not rebuild during promotion unless variables must change.

Rollback immediately if the page fails, a store link points to the wrong product, canonical URLs are wrong, legal pages are missing, assets fail broadly, or CSP prevents rendering. Restore the last known-good deployment, verify `/`, `/privacy`, and `/terms`, then correct the candidate in a new build.

## 8. Dependency and content maintenance

- Dependabot or a scheduled equivalent should propose lockfile updates.
- Run the full suite and both audit commands for every dependency update.
- Do not use `npm audit fix --force` blindly; review framework-major migrations and rerun browser checks.
- Refresh product screenshots for material UI changes.
- Re-review legal content whenever app/API data behavior or service providers change.
- Reconfirm store links and support mailbox ownership at every major release.
- Treat claims about market freshness, execution, alerts, and returns as safety-sensitive copy.
