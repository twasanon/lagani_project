# Whole-system testing strategy

## 1. Test layers

Lagani needs more than one kind of test because compile-time correctness cannot prove provider compatibility, and live data cannot prove deterministic financial arithmetic.

| Layer | Purpose | Frequency |
| --- | --- | --- |
| Deterministic unit/repository/handler | Logic, schema, validation, transactions, routes | Every change/PR |
| Static analysis/race | Type/lint/vet/concurrency defects | Every change/PR |
| Production builds/containers | Real bundler/compiler/runtime packaging | Every change/PR or release |
| Live upstream contract | Detect NEPSE/news/chart source drift | Scheduled canary + release |
| Cross-component contract | Confirm API JSON matches mobile runtime parsers | API/mobile contract changes + release |
| Real device/browser | Permissions, layout, persistence, native/runtime behavior | Preview and production candidate |
| Operational rehearsal | Backups, restore, monitoring, rollback | Before launch and periodically |

## 2. Deterministic root suite

After `npm ci` in both JavaScript components:

```bash
make verify
```

Equivalent commands:

```bash
cd lagani_api
go test -race ./...
go vet ./...

cd ../lagani
npm run verify

cd ../lagani_website
npm run verify
```

Also run:

```bash
git diff --check
docker compose --env-file .env.example config --quiet
```

Component details live in `lagani/TESTING.md`, `lagani_website/TESTING.md`, and the API README/how-it-works/audit files.

## 3. Build artifacts

### API

```bash
cd lagani_api
docker build --platform linux/amd64 -t lagani-api:test .
```

Run with a disposable volume, jobs disabled, and no admin key. Assert `/healthz` and `/readyz` return 200 and an admin POST returns 503. Then run as non-root and verify graceful shutdown.

### Mobile

```bash
cd lagani
android_out=$(mktemp -d)
ios_out=$(mktemp -d)
npx expo export --platform android --output-dir "$android_out"
npx expo export --platform ios --output-dir "$ios_out"
```

Exports prove bundling, not installation, permissions, or notification delivery. EAS preview builds on physical devices are still required.

### Website

```bash
cd lagani_website
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://lagani.example -t lagani-website:test .
```

Run the container and assert home/privacy/terms/robots/sitemap, security headers, and a 404. The runtime user must be `nextjs`.

## 4. Live source canary

```bash
cd lagani_api
make test-live
```

The integration build tag contacts real providers. It must verify:

- both Merolagani and Nepalipaisa news produce parseable, attributed items;
- NEPSE authentication and graph challenge still return historical data;
- company count and price count remain above conservative sanity floors;
- market status is nonempty;
- gainers/losers are ranked, typed, nonempty, and at most ten;
- NABIL adjusted chart data remains usable; and
- NMB50's older adjusted anomalies are skipped/normalized without losing the entire series.

Canary failure is a production warning, not permission to weaken validation. Capture response status/shape safely, update fixtures and source adapter deliberately, then rerun deterministic and live suites.

## 5. Cross-component API contract

The contract is specified in [docs/API_CONTRACT.md](./docs/API_CONTRACT.md). For any DTO/route change:

1. add/update a Go handler/model/repository serialization test;
2. copy representative JSON—including null/empty/error cases—into the mobile parser test;
3. test missing, wrong-type, nonfinite, mixed-case symbol, and stale timestamp behavior;
4. deploy additive API fields first (clients ignore them);
5. release updated mobile parsing/usage;
6. keep old required fields until supported store versions no longer need them; and
7. verify a production-like API with the signed app candidate.

Contract acceptance matrix:

| Endpoint | Minimum acceptance |
| --- | --- |
| `/companies` | array, positive `securityId`, uppercase nonempty symbol/name, RFC 3339 update |
| `/prices` | finite prices/change/volume, symbol join, plausible positive LTP for active rows, consistent previous/change |
| `/market-status` | known/nonempty normalized status, nullable source `asOf`, update timestamp |
| movers | exact `gainer`/`loser` type, ranks 1..N, correct sign/direction, N ≤ 10 |
| `/news` | nonempty safe HTTP(S) link for real rows, source/title, parsed or raw date, scrape time |
| `/charts/{symbol}` | ascending Unix seconds, finite positive OHLC, high/low bounds, nonnegative volume |

## 6. NEPSE scenario matrix

Test with production-like data across:

- market open, pre-open, close, weekend, and Nepal holiday;
- source status timestamp missing vs present;
- one source temporarily unavailable while last-known data exists;
- first empty database before ingestion;
- active equity, commercial bank, hydropower, mutual fund (including NMB50), and delisted/inactive symbol behavior;
- omitted previous close with positive, zero, and negative percentage change;
- adjusted chart bounds, negative provider rows, duplicate timestamps, and aggregation at Sunday/month boundaries;
- 1d lookup across an extended holiday; and
- Kathmandu/UTC day boundary and device timezone outside Nepal.

Reject NaN/infinity, negative volume, nonpositive OHLC, impossible ranges, unknown symbols, invalid security IDs, invalid limits, and unsupported resolutions.

## 7. Mobile acceptance matrix

Use a clean install and an upgraded install. Test with a populated API, API unavailable, and stale local cache.

Required flows:

- home shows status/freshness, search, gainers, and losers without fake loading data;
- company selection joins the current price and charts use correct range/resolution/empty states;
- watchlist add/remove persists across restart;
- news attribution/dates/links render safely;
- manual portfolio buy, additional buy, partial sell, full sell, edit/delete, and history produce exact quantity/cost/P&L;
- paper buy rejects insufficient cash, sell rejects insufficient quantity, success updates cash/position/history once, and reset is atomic;
- concurrent/double taps cannot duplicate a ledger mutation;
- alert permission accept/deny, target crossing, restart, background limitation, and duplicate notification behavior are understandable;
- all screens work at supported small phone sizes, large text, keyboard/modal states, and offline restart; and
- reset/destructive actions require clear confirmation and affect only the intended local data.

The audit's phone-sized browser pass covered the core workflows, but signed physical device tests remain the release authority for SQLite, native charts, notifications, and background tasks.

## 8. Website acceptance matrix

Test at 1440 × 1000, 390 × 844, 320-pixel width, keyboard-only, and Safari/WebKit. Check all four store URL combinations, invalid URL fail-closed behavior, legal routes, final canonical origin, support mailbox, security headers after CDN, no horizontal overflow/console errors, local images, sitemap/robots, sharing previews, and unknown-route 404.

The site must remain fully useful with the API offline and must never display hard-coded current quotes or unqualified “real-time” claims.

## 9. Operational tests

Before launch:

1. restore an API backup to a new volume and run foreign-key/count/sample checks;
2. stop the API during a scheduled job and verify graceful recovery/no corrupt partial snapshot;
3. simulate source timeout/invalid JSON and verify last-known cache remains;
4. trigger duplicate admin jobs and verify 409;
5. rotate the admin key and verify old authorization immediately fails;
6. rollback API and website immutable artifacts;
7. confirm the previous mobile version still works against the current API; and
8. exercise incident notification and named owner response.

## 10. Release evidence record

Record for each candidate:

- Git commit and dirty-state policy;
- API/mobile/site artifact digests or build IDs;
- database schema version and backup identifier;
- production configuration version without secret values;
- deterministic/live/device/browser results and timestamps;
- known advisory report and accepted exceptions;
- legal/source approvals;
- sign-off owners; and
- rollback artifacts and tested instructions.
