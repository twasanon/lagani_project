# Lagani API: Architecture and Data Flows

This document explains the backend at implementation depth. It is intended for maintainers debugging source changes, cache behavior, scheduler timing, or a client/API mismatch.

## 1. System boundary

Lagani API is an anti-corruption and cache layer between Lagani clients and three external Nepal finance sources. Clients never need to implement NEPSE token calculation, scrape HTML, or understand source-specific response shapes.

The service has five internal layers:

1. `cmd/server` creates concrete dependencies and controls process lifecycle.
2. `internal/scraper` translates external HTTP contracts into domain models.
3. `internal/scheduler` decides when and how ingestion jobs run.
4. `internal/database` owns SQLite schema and persistence.
5. `internal/api` validates client input and serves cached models.

Dependencies point inward from transport and source adapters toward models. The API does not scrape on a public GET request; it reads the cache. This keeps client latency predictable and prevents user traffic from amplifying calls to upstream providers.

## 2. Process lifecycle

`cmd/server/main.go` starts in this order:

1. Resolve `DB_FILE`, create its parent directory, open SQLite, and ping it.
2. Run idempotent schema creation and legacy historical-table repair.
3. Construct repositories.
4. Construct source clients. NEPSE eagerly verifies that `css.wasm` can be loaded and instantiated; a missing module is recorded and causes authenticated work to fail clearly.
5. Construct the scheduler and HTTP handlers.
6. Register cron jobs unless `SCHEDULER_ENABLED=false`.
7. Start HTTP with header, read, write, and idle timeouts.
8. Wait for SIGINT/SIGTERM or an unexpected HTTP listener error.
9. Stop accepting HTTP requests, stop cron, wait a bounded time for manual/startup jobs, then close SQLite.

`STARTUP_JOBS_ENABLED=false` suppresses the initial source refresh without disabling cron. This is useful in tests and controlled deployments.

## 3. SQLite cache

### 3.1 Connection policy

The DSN enables:

- foreign keys
- WAL journal mode
- 5-second busy timeout
- normal synchronous mode

The Go pool is limited to one connection. SQLite only has one writer; serialization prevents multiple scheduler goroutines from repeatedly racing for a write lock. WAL still helps readers in other processes, but the supported deployment is one service replica.

### 3.2 Tables and ownership

| Table | Owner | Retention semantics |
| --- | --- | --- |
| `companies` | NEPSE company job | One active row per symbol. |
| `prices` | NEPSE price job | Latest row per symbol; retained while market is closed. |
| `market_status` | NEPSE status job | Singleton row. |
| `movers` | NEPSE gainer/loser jobs | Latest complete snapshot for each type. |
| `news_items` | Merolagani/Nepalipaisa jobs | Unique by article link; mutable metadata refreshed. |
| `historical_prices` | NEPSE graph job | One row per security ID and business date. |
| `chart_data` | Merolagani chart job | Daily source-of-truth OHLCV by symbol/source/time. |
| `chart_data_weekly` | chart aggregation | Sunday-start weekly OHLCV. |
| `chart_data_monthly` | chart aggregation | Calendar-month OHLCV. |

`price_snapshots` is retained only for compatibility with early databases and is not used by current endpoints.

### 3.3 Company upsert invariant

`companies.symbol` is the parent key for prices and chart rows. The company repository must use an UPSERT that updates the existing row. SQLite `INSERT OR REPLACE` is prohibited here because it performs a delete followed by an insert. The delete triggers `ON DELETE CASCADE`, erasing the dependent cache.

### 3.4 Historical schema repair

An early migration created `date/open/high/...`, while its repository queried `business_date/open_price/high_price/...`. On startup, the migration inspects `PRAGMA table_info(historical_prices)`:

- canonical schema: no action
- recognized legacy schema: rename, create canonical table, copy mapped data, drop legacy table, commit
- unknown schema: stop startup rather than guessing

The repair is transactional.

## 4. NEPSE integration

### 4.1 Authentication

Authenticated calls follow this sequence:

1. GET `/api/authenticate/prove`.
2. Read `accessToken` and five numeric salts.
3. Execute `cdx`, `rdx`, `bdx`, `ndx`, and `mdx` from `css.wasm`.
4. Validate the returned token character indexes.
5. Remove the indexed characters from the proof access token.
6. Send `Authorization: Salter <calculated-token>`.

The token is cached for 45 seconds behind a mutex. A GET that receives `401` or `403` clears the cache and retries authentication once. Tokens and authorization headers are never written to logs.

All source clients use bounded HTTP timeouts and bounded response-body reads.

### 4.2 Company data

The company response is filtered to status `A`, normalized, validated, and upserted. `security_id` is NEPSE's numeric identifier and is distinct from the trading symbol used by clients.

The service currently leaves a formerly active company in the cache if it disappears from one response. This favors continuity over destructive synchronization. A future delisting model should add explicit active/inactive state rather than deleting history.

### 4.3 Market status and Nepal time

NEPSE returns an `asOf` local timestamp without an offset. It must be parsed with `time.ParseInLocation(..., Asia/Kathmandu)`, then converted to UTC. Calling `time.Parse` followed by `.In(...)` is wrong because it treats the original wall clock as UTC.

The normalized status is used to avoid unnecessary intraday jobs outside an open session. Startup and closing-snapshot paths can force a refresh so a new deployment does not have an empty cache just because it starts after market close.

### 4.4 Prices

NEPSE's daily trade-stat response is normalized into one latest `prices` row per symbol. Change is calculated as `lastTradedPrice - previousClose`; the upstream percentage is retained. Empty source data does not clear the table.

The default scheduler updates every five minutes while the market is expected to be active and runs a forced closing snapshot at 15:05 NPT.

### 4.5 Top movers

Although the configured NEPSE URLs request `all=true`, Lagani deliberately keeps the first ten gainers and losers. Each snapshot is transactionally replaced, so repeated intraday runs cannot mix ranks from different fetches or grow the table indefinitely.

### 4.6 Historical graph challenge

The graph endpoint is a POST to `/api/nots/market/graphdata/{securityId}`. An empty `{}` body produces an upstream null-pointer error. The official web client calculates a required body ID:

```text
requestID = dummyData[marketStatusID] + marketStatusID + (2 × dayOfMonthInNepal)
body      = {"id": requestID}
```

Lagani mirrors the official client's static `dummyData` table, fetches/caches the current market-status ID, checks table bounds, uses the Nepal calendar day, and sends the calculated body. The integration test uses security ID 131 as a canary. If NEPSE updates its client challenge, this path should fail loudly and the official bundle must be re-audited.

The response currently covers approximately one trading year. Rows are upserted because the latest business day can be revised after an intraday response.

## 5. Merolagani integration

### 5.1 News

The news list remains server-rendered HTML. Goquery selects:

```text
div.news-list div.media-news
```

Each item extracts the title link, image, and `media-label`. Publication strings such as `Aug 12, 2026 03:18 PM` are parsed in Asia/Kathmandu and stored in UTC. Parsing zero valid items is an error, not a successful empty scrape; this makes layout changes visible in logs and live tests.

### 5.2 Daily chart data

The technical-chart request includes:

- `type=get_advanced_chart`
- uppercase symbol
- `resolution=1D`
- Unix start/end seconds
- `isAdjust=1`
- `currencyCode=NPR`
- Merolagani company-detail `Referer`

Merolagani's adjusted series is not internally clean for every historic candle. Corporate-action adjustment and per-field rounding can place `high` below `open`/`close` or `low` above them; some old fund rows also contain non-positive sentinel prices. The scraper expands high/low just enough to bound open/close, drops rows with unusable timestamps/prices/volume, and logs both counts. The repository remains strict so another ingestion path cannot persist negative, non-finite, or inconsistent OHLCV. A bad provider row therefore cannot discard the rest of a valid symbol history.

The response is parallel arrays `t/o/h/l/c/v` with status `s`. The scraper rejects unknown status, inconsistent array lengths, invalid request parameters, and oversized bodies. `no_data` has a sentinel error so the scheduler can distinguish normal source absence from failures.

## 6. Chart cache and aggregation

### 6.1 Incremental refresh

For a new symbol, the job requests history from 2000-01-01. For an existing symbol, it intentionally overlaps the prior 14 days rather than starting exactly one day after the latest row. The repository UPSERT corrects:

- the current/most recent session after close
- late source revisions
- recent adjusted values

Each point is validated before a transaction begins: finite and non-negative values, positive timestamp, `high` at or above open/close/low, and `low` at or below open/close/high.

At most three Merolagani chart fetches run concurrently, with launch staggering.

### 6.2 Weekly aggregation

NEPSE trades Sunday-Thursday. A weekly candle begins Sunday 00:00 UTC for deterministic storage. Using ISO Monday weeks would incorrectly merge Sunday—the first Nepal trading session—with the previous week's Monday-Thursday sessions.

For each Sunday-start group:

- open: first daily open
- high: maximum daily high
- low: minimum daily low
- close: last daily close
- volume: sum of daily volume

### 6.3 Monthly aggregation

Monthly candles begin on day 1 at 00:00 UTC and use the same first-open, max-high, min-low, last-close, summed-volume rules.

### 6.4 Partial-period correction

Aggregation fetches daily data from the latest stored aggregate timestamp, not after it. This recomputes the current week/month when another daily candle arrives. Aggregate repositories use UPSERT so the partial candle is replaced atomically.

## 7. Nepalipaisa integration

Nepalipaisa's homepage now contains empty containers populated by JavaScript. The old selectors (`div#div-bnews div.bnews-main`) therefore return zero items even though the page appears populated in a browser.

The current job calls:

```text
GET /api/GetNewsByCategory?categoryId=0&subCategoryId=0
```

It reads `newsId`, `newsTitle`, `publishedOn`, `newsDateFormatted`, and `imageUrl`; constructs `/news-detail/{newsId}`; interprets the offset-less publication time as NPT; and stores UTC. At most 15 items are processed per run.

## 8. Scheduler correctness

Cron is configured with:

- Asia/Kathmandu location
- seconds field
- panic recovery
- skip-if-still-running per cron entry

An additional named-job gate covers cron, startup, and HTTP admin triggers. Two runs of the same job cannot overlap. A full refresh starts only when no named job is active, and while it runs all other jobs are rejected. Admin handlers return `409` when work conflicts instead of launching duplicate backfills.

Startup behavior:

1. Companies
2. Market status
3. Forced prices and movers, even if closed
4. Both news sources
5. Chart refresh only when market is closed or status is unknown

The heavy NEPSE historical backfill is not automatic at startup. It runs at 18:00 NPT or through an authenticated admin trigger.

## 9. HTTP layer

Middleware order supplies request IDs, real-IP handling, request logs, panic recovery, a 15-second handler timeout, security headers, heartbeat, and CORS.

Public GET handlers:

- validate path and query inputs
- read repositories only
- return stable JSON arrays and errors
- add endpoint-appropriate cache headers
- never expose upstream authentication

`/readyz` uses a two-second context to ping SQLite. `/healthz` only confirms process liveness. Browser CORS is allowlist-based and does not permit credentialed requests; native mobile traffic does not require CORS, and the marketing website has no API dependency.

Admin routes require a constant-time API-key comparison. With no configured key they are disabled (`503`), not unauthenticated.

## 10. Chart API selection

The handler validates a known symbol, computes a UTC range, and selects resolution:

```text
duration <= 90 days       -> D
90 days < duration <= 2y  -> W
duration > 2y             -> M
```

Explicit invalid resolutions return `400`. Weekly query starts are moved backward to Sunday, and monthly starts to day 1, so a candle overlapping the requested boundary is not accidentally excluded. `1d` queries a holiday-safe 30-day window and returns only its final candle.

## 11. Failure behavior

- Upstream request failure: log the job error and keep the previous cache.
- Empty price response: keep previous prices.
- Zero parsed news items: report an error because selectors/contracts may have changed.
- Duplicate news link: refresh metadata while retaining original scrape time.
- Invalid batch data: fail the transaction; do not silently commit partial financial data.
- Unknown historical schema: stop startup.
- Invalid cron: stop scheduler startup.
- Duplicate manual job: return `409`.
- Missing admin secret: return `503` for admin routes.

## 12. Verification strategy

The deterministic suite covers:

- schema and legacy migration
- company refresh preserving child rows
- price/historical/chart/mover repository behavior
- Sunday-start and monthly OHLCV aggregation
- scraper parsing through mock HTTP servers
- graph challenge math
- API validation, health, CORS, headers, empty arrays, and admin auth
- job exclusion and invalid cron handling

The `integration` build tag covers real upstream contracts. CI runs unit/race/vet/build and a container build without depending on external source availability. A production canary should run live tests separately and alert on failure.
