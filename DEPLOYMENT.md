# Lagani deployment runbook

Deploy in dependency order: **API → signed mobile candidate → public website → limited rollout**. The website can technically deploy independently, but public copy/store links should describe the exact mobile/API release being shipped.

## 1. Ownership checklist

Assign named owners before infrastructure work:

| Area | Owner must control |
| --- | --- |
| API/platform | cloud account, DNS/TLS, persistent volume, backups, logs, alerts, rollback |
| Data ingestion | source permissions, schedules, failure canaries, source-change response |
| Security | admin secret lifecycle, access review, incident contact, dependency response |
| Mobile | Apple/Google accounts, signing credentials, bundle IDs, EAS project, device matrix |
| Legal/privacy | entity identity, public policies, store disclosures, source attribution |
| Support | monitored mailbox, response SLA, user/data issue escalation |

Do not share the API admin secret among founders through source control or chat history. Use a secret manager and audited access.

## 2. Production values

### API runtime secrets/configuration

At minimum:

```dotenv
PORT=8080
DB_FILE=/data/lagani_cache.db
ADMIN_API_KEY=<at-least-32-random-bytes>
SCHEDULER_ENABLED=true
STARTUP_JOBS_ENABLED=false
```

Set `CORS_ALLOWED_ORIGINS` only if a browser-based Expo client is published. Native iOS/Android do not need it and the marketing site does not call the API. Pin reviewed source URLs and Kathmandu schedules from `lagani_api/.env.example` if platform configuration needs explicit values.

### Mobile build value

```dotenv
EXPO_PUBLIC_API_URL=https://api.your-domain.example
```

This is public and must never contain an admin key. It is embedded into each signed build.

### Website build values

```dotenv
NEXT_PUBLIC_SITE_URL=https://your-domain.example
NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/...
NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=...
NEXT_PUBLIC_SUPPORT_EMAIL=support@your-domain.example
```

Omit a store URL until that listing is public. The site safely renders “Coming soon.” All website values are public and require a rebuild when changed.

## 3. Private local/staging stack

The root Compose file is a convenience for the API and marketing website:

```bash
cp .env.example .env
docker compose config --quiet
docker compose up --build --detach
```

Defaults disable the scheduler and startup ingestion. Verify:

```bash
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/readyz
curl --fail http://127.0.0.1:3000/
curl --fail http://127.0.0.1:3000/privacy
curl --fail http://127.0.0.1:3000/terms
```

To populate intentionally, set a strong local admin key, restart the API with that value, and trigger `/admin/update-all-data`. Long chart/historical backfills are separate admin jobs and should be observed in logs. Never expose a local admin port to the public internet.

The Compose volume `lagani_api_data` is persistent. Removing it deletes the local cache; it does not contain mobile portfolios.

## 4. Deploy the API

Use the component runbook in [`lagani_api/DEPLOYMENT.md`](./lagani_api/DEPLOYMENT.md). Required topology:

- Linux AMD64 container host while the current Wasmer dependency remains;
- one API replica and one mounted persistent volume;
- TLS/reverse proxy or managed ingress;
- secret-manager `ADMIN_API_KEY`;
- no public direct access to the volume;
- scheduler enabled only on this one leader;
- automated snapshots/backups plus a tested restore;
- liveness `/healthz` and readiness `/readyz`;
- metrics/log alerting for 5xx, latency, source failures, job duration, and data age; and
- rate/cache policy that does not cache admin/health responses.

### Initial ingestion sequence

Use an empty or restored database with `STARTUP_JOBS_ENABLED=false` so launch is observable:

1. start the API and verify health/readiness;
2. trigger the primary company/status/price/mover/news job;
3. wait for it to finish and validate row counts/timestamps;
4. trigger historical data and observe per-symbol failures;
5. trigger chart data and observe per-symbol failures/invalid-row warnings;
6. verify weekly/monthly aggregates and representative liquid/fund symbols;
7. enable the production scheduler and restart once;
8. confirm registered Kathmandu schedules and no duplicate job; and
9. take the first known-good database backup.

Representative checks:

```bash
api_origin=https://api.your-domain.example

curl --fail "$api_origin/companies"
curl --fail "$api_origin/prices"
curl --fail "$api_origin/market-status"
curl --fail "$api_origin/top-gainers"
curl --fail "$api_origin/top-losers"
curl --fail "$api_origin/news?limit=10"
curl --fail "$api_origin/charts/NABIL?range=1y"
curl --fail "$api_origin/charts/NMB50?range=5y"
```

Do not approve based only on HTTP 200. Check nonempty plausible data, symbol joins, positive/consistent OHLC, source/update times, Sunday weekly buckets, mover direction/rank, and closed-market retention.

## 5. Build and validate mobile

Follow [`lagani/DEPLOYMENT.md`](./lagani/DEPLOYMENT.md). Use EAS environment-scoped `EXPO_PUBLIC_API_URL`, not a developer `.env` copied into CI.

Release flow:

1. verify production API from the intended device network;
2. run `npm ci && npm run verify`;
3. generate preview Android/iOS builds;
4. install on supported physical devices;
5. test a clean install, upgrade from the prior schema/build, offline start, stale cache, API failure, market open/closed, timezones, and low/background permission states;
6. exercise a full portfolio and paper buy/sell/reset cycle with known arithmetic;
7. verify news destinations, alert permission denial/acceptance, and background delivery limitations;
8. review platform privacy manifests/forms against the actual local/API behavior;
9. create production artifacts without changing code/config after validation; and
10. retain the tested build identifiers for rollback/support.

The remaining Metro `image-size` advisory is build-time and all input assets must remain trusted/version-controlled. Track a compatible Expo patch and rerun Doctor, unit tests, and both platform exports after adopting it.

## 6. Deploy the website

Follow [`lagani_website/DEPLOYMENT.md`](./lagani_website/DEPLOYMENT.md). Deploy a preview with the canonical domain/contact and only verified public store URLs. Have legal/privacy text approved before promotion.

At the final origin confirm canonical/OG/sitemap URLs, security headers through the CDN, store destinations, support mailbox, privacy/terms, phone/desktop/WebKit layout, keyboard focus, unknown-route 404, and operation while the API is offline.

Refresh screenshots from the signed mobile candidate. Treat screenshot market numbers as examples and never as a current quote.

## 7. Limited rollout

Start with internal or closed beta users. Define success/error thresholds before inviting them:

- API request success and p95 latency;
- last successful ingest age by dataset;
- source job failure rate and duration;
- crash-free mobile sessions/build install success (if a reviewed crash provider is later added);
- reports of wrong prices, charts, calculations, or missed alerts;
- support response ownership; and
- backup/restore rehearsal status.

Do not silently add analytics to obtain these metrics. API/platform metrics can be collected operationally; any mobile analytics/crash provider changes privacy architecture and requires review.

## 8. Rollback

### API application rollback

Retain immutable container digests. If a new binary fails but schema remains compatible, deploy the last known-good image against the same volume. Verify readiness and data before re-enabling schedules.

### API data rollback

Stop scheduler and writes first. Snapshot the broken volume for investigation, restore a known-good backup to a new volume, start one API instance with jobs disabled, verify counts/foreign keys/sample endpoints, then enable jobs. Never restore while a writer is active.

### Mobile rollback

App stores do not provide instant binary rollback to every installed device. Keep the API backward-compatible with the prior public mobile version. If a release is harmful, stop rollout, submit a fixed build, communicate clearly, and avoid API contract removal that strands installed clients.

### Website rollback

Promote the previous immutable host deployment. Reverify store links/legal pages/canonical URL. A store-link correction requires a rebuilt artifact because public variables are embedded at build time.

## 9. Go-live gate

- [ ] All deterministic root/component suites pass from clean locked dependencies.
- [ ] Live source canary passes and has an alert owner.
- [ ] Source use/attribution/redistribution has written approval or documented basis.
- [ ] One production API replica uses encrypted durable storage and tested backups.
- [ ] Strong admin secret is stored/rotated through a secret manager.
- [ ] TLS, readiness/liveness, monitoring, logs, retention, and rollback are verified.
- [ ] Representative NEPSE data is plausible across open/closed/holiday and fund/equity symbols.
- [ ] Signed Android/iOS builds pass physical-device, upgrade, offline, notification, and arithmetic tests.
- [ ] Store disclosures and qualified legal review are complete.
- [ ] Website canonical domain, legal owner/contact, store links, screenshots, headers, and WebKit QA pass.
- [ ] Prior API/mobile/site artifacts and a compatible database backup are retained.
- [ ] Founders explicitly approve the residual advisory and product limitations for the limited rollout.
