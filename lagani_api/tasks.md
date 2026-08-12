# Lagani API Work Tracker

This file tracks backend work after the August 2026 audit. Detailed evidence belongs in `AUDIT.md`; operational instructions belong in `DEPLOYMENT.md`.

## Completed in the backend audit

- [x] Reconcile all SQLite tables with repository queries.
- [x] Add and test legacy historical-schema repair.
- [x] Prevent company refresh from cascade-deleting cached market data.
- [x] Restore NEPSE historical graph requests using the current challenge body.
- [x] Fix Nepal-local `asOf` parsing and UTC normalization.
- [x] Replace obsolete Nepalipaisa homepage scraping with its current JSON feed.
- [x] Verify current Merolagani news and chart contracts.
- [x] Correct weekly chart aggregation for the Sunday-Thursday NEPSE week.
- [x] Refresh recent chart candles through overlap and UPSERT.
- [x] Limit movers to top ten and replace snapshots atomically.
- [x] Preserve last-known prices when the market/source is closed.
- [x] Force startup and closing snapshots so a cold deployment has market data.
- [x] Prevent overlapping cron/startup/admin jobs.
- [x] Authenticate/disable admin routes safely.
- [x] Add strict query validation, health/readiness, cache and security headers.
- [x] Add repository, API, scraper, scheduler, race, and live integration tests.
- [x] Add Docker packaging and API-scoped CI.
- [x] Replace stale backend architecture and deployment documentation.

## Required before production launch

- [ ] Complete the deployment gate in `AUDIT.md`.
- [ ] Select hosting, secrets, persistent storage, logs, metrics, and alert ownership.
- [ ] Confirm source-use, caching, redistribution, attribution, and refresh permissions.
- [ ] Run a staging backup/restore drill.
- [ ] Run initial closed-market chart and historical backfills and record normal duration/size.
- [ ] Schedule the `integration` live-source suite as an external canary.
- [ ] Verify Expo app and website against the hardened API contract.

## Post-launch / scale triggers

- [ ] Add explicit migration versions before the next non-trivial schema change.
- [ ] Add persisted job-run/status records and metrics.
- [ ] Define news/chart retention after observing database growth.
- [ ] Migrate to PostgreSQL and an external/leader worker before multiple replicas.
- [ ] Add source-aware exponential backoff if providers publish supported retry rules.

## Client-integration notes

- Chart range options now include `1d`, `1w`, `1m`, `3m`, `6m`, `ytd`, `1y`, `5y`, and `all`.
- Explicit chart resolution must be `D`, `W`, or `M`; invalid values return `400`.
- `1d` returns one latest available candle.
- Weekly candles start Sunday.
- Empty collections are always `[]`.
- News `limit` must be 1-100.
- Admin keys must never ship in a client bundle.
