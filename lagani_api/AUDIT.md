# Lagani API Audit

Audit date: 2026-08-12  
Scope: `lagani_api` architecture, NEPSE/Merolagani/Nepalipaisa ingestion, cache schema, scheduler, HTTP contract, security, tests, and deployment packaging.

## Executive assessment

The original service had a clear high-level idea—source adapters feeding a local cache—but was not deployable with confidence. It compiled because no test exercised SQLite or upstream contracts, while multiple production paths failed only at runtime. The most severe problems were an incompatible historical schema, a completely missing movers table, cascade deletion during company refresh, a broken NEPSE graph POST body, an obsolete Nepalipaisa HTML selector, publicly callable resource-heavy admin routes, and Monday-based weekly candles in a Sunday-start market.

Those known blockers are repaired and protected by automated tests. The API is now a deployment candidate **for a single-replica, persistent-volume environment** after production secrets, CORS origin, monitoring, backup, and source-permission decisions are completed. It is not yet an appropriate horizontally scaled architecture because SQLite and an in-process scheduler intentionally assume one writer.

The final live chart regression additionally covers the NMB50 adjusted series: the importer returned 1,289 usable points while rejecting 69 nonpositive provider candles and normalizing five valid-but-inconsistent OHLC bounds. This prevents one corrupt historical row from discarding an otherwise useful fund series.

## Verification performed

### Static and deterministic

- `go test ./...`
- `go vet ./...`
- `go test -race ./...`
- HTTP tests through `httptest`
- SQLite repository and legacy-migration tests
- Mock upstream parser/contract tests
- Scheduler aggregation and job-exclusion tests
- Clean-process server smoke test with scheduler disabled
- Health, readiness, empty JSON collection, cache/security header, and unauthorized admin probes

### Live source contracts

`go test -tags=integration ./internal/scraper -run '^TestLive' -v` verified:

- Merolagani news: 8 valid items parsed in the sampled run
- Nepalipaisa JSON news: 5 valid items parsed
- Merolagani NABIL chart: 23 daily points for the sampled one-month range
- NEPSE NABIL historical canary (security ID 131): 223 points
- NEPSE active companies: 411
- NEPSE latest prices: 277
- NEPSE market status timestamp conversion: 15:00 NPT became 09:15 UTC
- NEPSE gainer/loser responses and database foreign keys

Counts are evidence from that run, not permanent product expectations.

## Findings and dispositions

| Severity | Finding | Impact | Disposition |
| --- | --- | --- | --- |
| Critical | `historical_prices` migration created `date/open/...`, repository queried `business_date/open_price/...`. | Every historical save/read failed at runtime. | Canonical schema added; recognized legacy layout migrates transactionally; regression tests added. |
| Critical | No `movers` table existed. | Gainer/loser jobs always failed on a real database. | Table, constraints, index, repository tests, and live test added. |
| Critical | Company refresh used SQLite `INSERT OR REPLACE`. | Each refresh could delete dependent prices and all chart history through cascades. | Changed to UPSERT; preservation regression test added. |
| Critical | NEPSE graph POST sent `{}`. | Upstream returned HTTP 500 / null-pointer; historical data never updated. | Mirrored official request-ID challenge, sent `{"id":...}`, added canary and challenge test. |
| Critical | `/admin/*` had no authentication. | Anyone could start costly all-company source jobs and exhaust service/upstream capacity. | Constant-time API-key middleware; disabled when no key; auth tests added. |
| High | Nepalipaisa switched to JavaScript-populated JSON; old homepage selector matched nothing. | News silently stayed stale while jobs logged success. | Uses current JSON endpoint; zero valid items is now an error; live/mock tests added. |
| High | Weekly candles started Monday. | NEPSE Sunday session was merged into the prior trading week, corrupting weekly OHLCV. | Sunday-start grouping and boundary alignment; explicit Nepal-week test added. |
| High | Daily chart rows used `DO NOTHING` and fetched only after latest timestamp. | Final/latest candle and revised adjusted data never corrected. | 14-day overlap plus UPSERT; OHLCV validation and tests added. |
| High | Merolagani adjusted candles sometimes put high/low inside open/close, and some fund history contains non-positive sentinel prices. | One anomalous candle caused the repository to reject an entire multi-year symbol series; major charts such as NABIL could remain empty. | The source adapter expands adjusted high/low bounds, skips unusable sentinel candles, logs counts, and keeps strict database validation. Live backfill improved from 92 to 376 successful symbols, with NABIL serving 53 one-year points. |
| High | NEPSE daily stats sometimes omit `previousClose` while still providing `percentageChange`. | The API exposed the full LTP as the point change (for example Rs. 345 instead of Rs. 45). | Recover the approximate previous close from the percentage relation and test provided, omitted, unchanged, and invalid cases. |
| High | Source row errors were often logged and skipped inside a transaction. | Partial financial batches could commit while callers saw success. | Invalid/scanning/upsert errors fail batches and roll back. |
| High | Manual, cron, and startup jobs could overlap. | Duplicate full backfills, SQLite lock contention, and source request bursts. | Named exclusivity gate, `409` responses, cron skip/recovery, shutdown wait, tests. |
| High | Fresh deployment after market close skipped prices/movers, leaving empty client screens. | API appeared healthy but lacked core market data until next open session. | Startup forces last-known price/mover refresh; closing snapshots added. |
| High | Chart startup ran only when the market was open. | Expensive upstream backfill happened at the worst time and was skipped during safe closed hours. | Logic inverted: startup chart backfill runs only closed/unknown. |
| High | Market time parsed as UTC and then converted to NPT. | Stored instant was shifted by 5:45. | `ParseInLocation(Asia/Kathmandu)` then UTC; live time assertion. |
| High | SQLite opened with unrestricted connection pooling under concurrent jobs. | Intermittent `database is locked` failures. | WAL, busy timeout, foreign keys, one pooled connection. |
| Medium | News ordered by scrape time and never stored `published_at`. | Feed order could differ from publication chronology. | Parse/store UTC publication time; order by publication with scrape fallback. |
| Medium | Nepalipaisa relative image paths were not consistently resolved. | Broken client images. | Current API-provided absolute `imageUrl` is stored. |
| Medium | Top mover endpoints stored every item returned by `all=true`. | `/top-gainers` and `/top-losers` contradicted their top-ten contract and returned large lists. | Limit to first ten before persistence. |
| Medium | Invalid chart resolution silently became daily. | Client mistakes produced plausible but wrong chart density. | Invalid range/resolution returns `400`; response exposes selected resolution. |
| Medium | `1d` and `1w` both returned seven calendar days. | Range label did not match response semantics. | `1d` now returns the latest available candle through a 30-day holiday-safe search. |
| Medium | `GET /news` accepted unbounded/invalid limits. | Avoidable memory/read amplification. | Strict integer range 1-100. |
| Medium | Empty slices encoded as `null`. | Client code needed inconsistent null handling. | Repositories initialize empty collections; API tests assert arrays. |
| Medium | No readiness endpoint or production security headers. | Weak orchestration health and browser hardening. | `/healthz`, `/readyz`, cache headers, nosniff/frame/referrer headers. |
| Medium | Invalid cron strings only logged while service continued partly scheduled. | Operators could believe ingestion was healthy when jobs were missing. | Scheduler startup returns an error and process fails fast. |
| Medium | HTTP listener failure called `log.Fatal` from a goroutine. | Deferred cleanup was bypassed. | Listener reports through a channel into normal shutdown. |
| Medium | No reproducible container/CI verification; the first runtime image omitted `libwasmer.so`. | Deployment behavior depended on a developer machine and the built container could not start. | Non-root Linux/AMD64 image now bundles the shared library, is smoke-tested, and has scoped GitHub Actions verification. |
| Low | Documentation referred to `price_snapshots` while live code served `prices`, claimed stale record counts, and described old source behavior. | Maintainers made decisions using false architecture information. | README and architecture docs replaced; runbook and audit added. |

## Architecture decisions made

### Keep SQLite for this phase

SQLite is reasonable for a single stateful service while Lagani is early and read volume is moderate. WAL and serialized access make current behavior reliable. This decision deliberately trades horizontal scaling for operational simplicity.

Migration trigger to PostgreSQL:

- more than one API replica is required
- scheduler and serving processes need independent scaling
- write latency/backfills block client reads unacceptably
- managed backup/point-in-time recovery becomes a requirement
- user-specific server-side data is added to this database

### Keep ingestion asynchronous from public reads

Public GETs should not fall through to upstream providers. Cache misses remain empty/404 until ingestion succeeds. This avoids coupling user traffic to fragile source authentication and respects upstream capacity.

### Treat source changes as monitored operational events

NEPSE/Merolagani contracts are not stable enough for unit tests alone. The live integration suite is intentionally separate from pull-request CI and should run on a schedule from the deployment network.

## Remaining risks and required owner decisions

These are not hidden code defects; they are production decisions or upstream constraints that cannot be solved solely in the repository.

### 1. Source authorization and terms

An owner must confirm that production scraping/API use, caching, redistribution, branding, and refresh frequency are permitted by NEPSE, Merolagani, and Nepalipaisa. Implement rate/attribution changes required by that review.

### 2. Data classification and product disclaimer

The data is source-derived and may be delayed, adjusted, corrected, or unavailable. The app and site should display source/as-of information and an informational-data disclaimer. Do not market this cache as exchange-certified real-time data without authorization.

### 3. Static NEPSE challenge table

The graph request mirrors a static array in NEPSE's official bundle. The live canary detects drift, but an upstream bundle update may still require code work. Alert on canary failure before users report missing charts.

### 4. Single replica and persistent disk

Run exactly one scheduler-enabled API replica and attach durable storage at the configured database path. Ephemeral filesystems will lose the cache on every deployment.

### 5. Backup and recovery objectives

Choose RPO/RTO. At minimum, use SQLite's online backup mechanism or a storage snapshot that captures WAL consistently. Copying only the main `.db` file during writes is not a reliable backup plan.

### 6. Observability

Current logs are human-readable. Before high-traffic launch, add hosted log collection and alerts for:

- readiness failures
- live-contract canary failures
- repeated source HTTP/auth errors
- data age beyond expected schedule
- zero companies/prices after startup
- disk capacity and database growth
- job duration and overlap rejections

Metrics/tracing were not added because the deployment platform has not been selected.

### 7. Initial historical/chart population

The first Merolagani chart population is source-heavy. Run it after market close and monitor it. Trigger the NEPSE historical job separately after companies exist. Avoid combining first backfills with an app launch traffic spike.

### 8. Data retention

News and historical/chart tables currently retain data indefinitely. Define retention and database-size thresholds after observing real growth. Do not prune daily chart data if weekly/monthly rebuild remains dependent on it.

## Deployment gate

The API may proceed to a controlled staging deployment only when all boxes are complete:

- [ ] Strong `ADMIN_API_KEY` stored in the platform secret manager
- [ ] Exact production `CORS_ALLOWED_ORIGINS` only if an Expo/browser client is published
- [ ] Persistent `DB_FILE` volume
- [ ] One replica / one scheduler leader
- [ ] `css.wasm` present and readable
- [ ] `/healthz` and `/readyz` configured
- [ ] Backup and restore exercised
- [ ] Live integration tests pass from deployment network
- [ ] Initial companies, status, prices, news, charts, and historical backfill verified
- [ ] Source-use/redistribution review completed
- [ ] Client disclaimer and as-of display reviewed
- [ ] Alert destination and on-call owner selected

Until the whole root project is audited, this backend readiness does not imply the Expo app or marketing website is deployment-ready.
