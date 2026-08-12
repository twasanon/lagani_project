# Mobile deployment runbook

## 1. One-time owner decisions

Before linking an Expo project or creating store records, the founders must approve:

- Expo organization and project owner.
- iOS bundle identifier and Android application ID (`com.lagani.app` currently).
- App Store Connect and Google Play developer accounts.
- Privacy-policy and support URLs.
- Whether local portfolio data may participate in OS device backups.
- Legal wording for market-data attribution, delays, educational scope, and third-party news.

Changing the bundle/application ID after publication creates a separate application. Do not treat the current value as final merely because it builds.

## 2. Prepare the production API

Deploy `../lagani_api` first. Confirm:

```sh
curl --fail https://api.example.com/healthz
curl --fail https://api.example.com/readyz
curl --fail https://api.example.com/prices
curl --fail 'https://api.example.com/charts/NABIL?range=1y'
```

The API must use a trusted HTTPS certificate. Never embed `ADMIN_API_KEY` in the app. Confirm current prices, movers, status, news, and at least one liquid-symbol chart before building.

## 3. Verify source and lockfile

```sh
npm ci
npm run verify
rm -rf dist
npx expo export --platform android --output-dir dist/android
npx expo export --platform ios --output-dir dist/ios
```

Do not use `npm audit fix --force`; it can replace the selected Expo SDK with an incompatible version. As of the August 12, 2026 audit, the remaining 14 high-severity paths all converge on Metro's build-time `image-size` parser. Only trusted repository assets may enter the build until Expo ships a compatible patched Metro chain. Review advisories and migrate with Expo's compatibility tooling.

## 4. Configure EAS

Install and authenticate the CLI without adding it to the app bundle:

```sh
npm install --global eas-cli
eas login
eas init
```

`eas init` adds the Expo project ID to app configuration. Commit that linkage after verifying the organization. The repository's `eas.json` provides `preview` and `production` profiles.

Set the public API URL in EAS for both profiles. It is public bundle configuration, not a secret:

```sh
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://preview-api.example.com
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.example.com
```

Use the current EAS environment commands shown by `eas env --help` if the CLI changes syntax.

## 5. Build preview binaries

```sh
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

Install on at least one current and one older supported physical device per platform. Execute [TESTING.md](TESTING.md), including notification permission denial/approval, app backgrounding, cold launch, offline cache, and malformed/empty API behavior in a controlled environment.

## 6. Production builds

Update the user-visible version in `app.json` according to the release policy. Production build numbers use EAS remote auto-increment.

```sh
eas build --profile production --platform android
eas build --profile production --platform ios
```

Record the git commit, EAS build IDs, API release/version, test devices, and test date in the release ticket. Never rebuild a supposedly identical release from an uncommitted or dirty worktree.

## 7. Store submission

After store applications, agreements, and credentials are ready:

```sh
eas submit --profile production --platform android --latest
eas submit --profile production --platform ios --latest
```

Complete store declarations accurately:

- financial functionality is informational/simulated, not brokerage;
- data stored on-device includes portfolio/watchlist activity;
- the app retrieves third-party market/news content;
- notifications support user-created price alerts;
- provide an accessible privacy policy and deletion explanation;
- disclose data delay and lack of NEPSE affiliation.

## 8. Staged rollout and monitoring

Start with internal testing, then a small staged production percentage. During the observation window monitor:

- API `/healthz` and `/readyz`;
- current price and chart freshness;
- API latency/error rates and scraper failures;
- crash-free sessions and startup failures;
- user reports of cache, portfolio migration, news navigation, and alerts.

The app currently has no Sentry/PostHog integration. Store consoles and API-side observability are therefore the minimum operational sources until an explicit telemetry/privacy design is approved.

## 9. Rollback

- **Bad API data or outage:** pause rollout, repair/rollback the API, and preserve the prior cache. Do not point production clients at an unvalidated emergency origin.
- **Bad mobile binary:** halt staged rollout. Android can roll back to a retained artifact through the Play workflow; iOS normally requires an expedited corrected build. Keep the previous tested build metadata.
- **Schema regression:** do not ship a build that downgrades or destructively rewrites personal tables. Publish a forward-only migration and test it using a copy of a populated prior-version database.
- **Compromised public configuration:** rotate server-side credentials even though none should be in the client; publish a new binary if the embedded public API origin must change.

## 10. Expo web preview

Expo SQLite Web uses a worker and may require cross-origin isolation depending on the browser. For local preview, run Expo on port 8082 and the included proxy on 8083:

```sh
EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo start --web --port 8082
npm run web:preview-proxy
```

The proxy adds `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. If the Expo web build is deployed, configure equivalent headers at the real host and add its origin to the API CORS allowlist. The separately maintained `../website` remains the intended public marketing/product website unless the founders explicitly choose to publish the Expo web client.
