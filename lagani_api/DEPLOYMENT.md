# Lagani API Deployment Runbook

This runbook deploys the current SQLite architecture safely. It is platform-neutral because no hosting provider has been selected.

## 1. Supported topology

Run one container replica with:

- one writable persistent volume mounted at `/data`
- `DB_FILE=/data/lagani_cache.db`
- scheduler enabled on that replica
- inbound HTTPS terminated by the platform/load balancer
- outbound HTTPS access to NEPSE, Merolagani, and Nepalipaisa

Do not run two scheduler-enabled replicas against separate SQLite files: each will have a divergent cache and duplicate upstream traffic. Do not mount a typical network filesystem under SQLite unless the provider explicitly supports SQLite locking and WAL semantics.

If a second API replica is required, migrate the repository layer to a shared transactional database and add leader election or an external job runner before scaling.

## 2. Build

From `lagani_api`:

```bash
docker build --pull --platform linux/amd64 \
  -t registry.example/lagani-api:<git-sha> .
docker push registry.example/lagani-api:<git-sha>
```

The image:

- builds with Go 1.23 and CGO
- contains the SQLite/Wasmer-linked server and `libwasmer.so`
- installs CA certificates and timezone data
- copies `css.wasm` to `/app/css.wasm`
- runs as non-root UID/GID 10001
- writes cache data under `/data`

The current image target is Linux/AMD64. This is intentional: the pinned `wasmer-go` v1.0.4 package leaves its Linux ARM64 linker directive disabled. On ARM development machines, keep `--platform linux/amd64` on both `docker build` and `docker run`. Choose an AMD64 production runtime until that dependency is upgraded or replaced and ARM64 is verified separately.

Pin deployments to an immutable digest or Git SHA. Do not deploy `latest` as the rollback reference.

## 3. Required production environment

```text
PORT=8080
DB_FILE=/data/lagani_cache.db
WASM_FILE=/app/css.wasm
ADMIN_API_KEY=<random secret, at least 32 bytes>
CORS_ALLOWED_ORIGINS=https://app.lagani.example
SCHEDULER_ENABLED=true
STARTUP_JOBS_ENABLED=true
```

Use the platform secret manager for `ADMIN_API_KEY`; never commit it, log it, or embed it in a client application.

`CORS_ALLOWED_ORIGINS` is required only for browser clients such as a separately published Expo web build. Native iOS/Android traffic is not governed by browser CORS, and the static marketing website does not call the API. Do not add origins preemptively.

Generate a value with an approved secrets tool. For example, on a trusted operator machine:

```bash
openssl rand -base64 48
```

Review every remaining setting in `.env.example`. Override source URLs only through controlled deployment configuration.

## 4. Network and HTTP configuration

- Publicly expose read endpoints through HTTPS.
- Restrict `/admin/*` at the edge by IP/VPN/service identity in addition to the application key when the platform supports it.
- Do not cache `/healthz`, `/readyz`, or admin responses.
- A CDN may honor public endpoint `Cache-Control`, but confirm that `Vary: Origin` and CORS behavior remain correct.
- Set an upstream proxy timeout above 15 seconds; public handlers themselves use a 15-second middleware timeout.
- Preserve client/request IDs in centralized logs.

## 5. Health probes

Liveness:

```text
GET /healthz
expected: 200 {"status":"ok"}
```

Readiness:

```text
GET /readyz
expected: 200 {"status":"ready"}
```

Suggested probe policy:

- liveness interval: 30 seconds
- readiness interval: 10 seconds
- timeout: 3 seconds
- failure threshold: 3
- initial delay: 5-15 seconds

Do not use `/companies` as a health check; source/cache population is a data-quality condition, not process liveness.

## 6. First staging deployment

### Phase A: process and storage

1. Deploy with `SCHEDULER_ENABLED=false` and `STARTUP_JOBS_ENABLED=false`.
2. Verify `/healthz` and `/readyz`.
3. Restart the container and confirm the same database file persists.
4. Confirm the runtime user can write `/data` and read `/app/css.wasm`.

### Phase B: live source canary

Run from the same egress network used by production:

```bash
go test -tags=integration ./internal/scraper -run '^TestLive' -v
```

If any live test fails, investigate network policy, source drift, DNS/TLS, rate limits, or authentication before enabling the scheduler.

### Phase C: initial data

Enable scheduler/startup jobs after market close. Startup populates companies, status, last-known prices, top movers, news, and Merolagani charts. Watch logs and source traffic.

After companies exist, trigger NEPSE historical data separately:

```bash
curl -X POST \
  -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  https://api.lagani.example/admin/update-historical-data
```

The endpoint returns `202` when accepted and `409` if a conflicting job is active.

### Phase D: data verification

Check all of the following:

```bash
curl https://api.lagani.example/companies
curl https://api.lagani.example/prices
curl https://api.lagani.example/market-status
curl https://api.lagani.example/top-gainers
curl https://api.lagani.example/top-losers
curl 'https://api.lagani.example/news?limit=5'
curl 'https://api.lagani.example/charts/NABIL?range=1m&resolution=D'
curl https://api.lagani.example/historical-price/131
```

Verify non-empty responses, plausible Nepal dates, UTC `asOf` conversion, ten-or-fewer movers, ascending chart timestamps, and `X-Chart-Resolution`.

## 7. Normal release procedure

1. Confirm CI unit/race/vet/build/container jobs pass.
2. Run the live source suite.
3. Create an online database backup.
4. Deploy the immutable image to staging.
5. Run health/readiness and endpoint probes.
6. Deploy to production outside NEPSE market hours when possible.
7. Confirm the scheduler registered every job without a cron error.
8. Monitor error rate, job logs, data age, and storage for at least one complete schedule cycle.

Schema migration runs on process startup. The current migration is backward-compatible with the recognized early historical layout, but a backup is still required before every release that changes persistence.

## 8. Backup and restore

SQLite WAL means copying only `lagani_cache.db` during writes can omit committed WAL data or create an inconsistent backup.

Preferred options, in order:

1. Platform volume snapshot with documented SQLite consistency.
2. SQLite online backup API/command against the live database.
3. Briefly stop the application, copy the database plus relevant WAL/SHM state, then restart.

Minimum policy recommendation for staging:

- daily backup after the historical job
- retain 7 daily and 4 weekly copies
- encrypt at rest
- perform a restore drill before launch

Restore drill:

1. Deploy API-only with scheduler disabled.
2. Restore into a new volume.
3. Start and verify `/readyz`.
4. Query row counts and representative endpoints.
5. Run `PRAGMA integrity_check` through an approved SQLite operator tool.
6. Enable scheduler only after data verification.

## 9. Monitoring and alerts

At minimum collect container logs and alert on these patterns/conditions:

- process restart loop or readiness failure
- `WASM initialization failed`
- NEPSE `401`, `403`, or graph request challenge failure
- source `5xx`, timeouts, or JSON/HTML parse failures
- `no news items could be parsed`
- zero active companies or prices after startup
- failed database migration, commit, or integrity check
- chart/historical job duration beyond its normal window
- repeated job-conflict `409`s
- volume more than 80% full
- live integration canary failure

Add data-age metrics when a monitoring stack is chosen. Useful gauges are latest `updated_at/scraped_at` per table, company/price count, news count by source, last chart timestamp, and last successful job completion.

## 10. Incident playbooks

### NEPSE authentication fails

1. Preserve the existing cache; do not clear tables.
2. Run only the NEPSE historical live canary and inspect sanitized errors.
3. Fetch the current official web bundle and compare proof/token/challenge behavior.
4. Verify `css.wasm` checksum/source and deployment path.
5. Disable scheduler temporarily if repeated retries risk upstream blocking.
6. Keep public reads online with last-known data and communicate staleness.

### News source changes

1. Identify which live news test failed.
2. For Merolagani, inspect server-rendered selectors and date format.
3. For Nepalipaisa, inspect `/js/site/home.js` and its current JSON route/fields.
4. Add a captured mock response regression test before changing parser code.
5. Deploy and backfill news; link uniqueness prevents duplicates.

### Database corruption or disk failure

1. Stop the service to prevent further writes.
2. Preserve the failed volume for diagnosis.
3. Restore the latest verified backup into a new volume.
4. Start scheduler-disabled and run readiness/integrity/data probes.
5. Re-enable ingestion and backfill missing source windows.

### Source rate limiting

1. Disable scheduler or increase schedules; do not add aggressive retries.
2. Keep API reads serving the cache.
3. Confirm whether multiple replicas or operators triggered duplicate jobs.
4. Coordinate permitted limits with the source owner.
5. Re-enable jobs gradually after the limit window.

## 11. Rollback

Application rollback:

1. Disable scheduler/admin ingress during diagnosis.
2. Deploy the previous immutable image.
3. Keep the current database if the prior version understands its schema.
4. If schema compatibility is uncertain, restore the pre-release backup to a new volume.
5. Verify readiness and representative endpoints before restoring traffic.

Never delete the current database during rollback. Preserve it for forward recovery and incident analysis.

## 12. Scaling beyond this runbook

Before multiple replicas:

- migrate SQLite to PostgreSQL or another managed transactional database
- version migrations explicitly
- pass contexts through repositories/source jobs
- move schedules to a leader-elected worker or managed job system
- persist job runs/statuses
- add distributed rate limiting and observability
- load test read endpoints and backfill contention

That change is an architecture project, not a replica-count configuration toggle.
