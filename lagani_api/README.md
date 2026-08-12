# Lagani API

Lagani API is the market-data service for the Lagani Nepal investing app. It normalizes data from NEPSE, Merolagani, and Nepalipaisa into a stable REST API backed by a local SQLite cache. The cache decouples the mobile app and website from upstream outages, authentication changes, and HTML/API response differences.

This service is designed to run as **one stateful replica** while it uses SQLite. Read [DEPLOYMENT.md](DEPLOYMENT.md) before publishing it.

## Current audit status

The August 2026 backend audit repaired the runtime schema, NEPSE historical request, Nepalipaisa ingestion, weekly aggregation, scheduler overlap, and public admin-route issues. Unit, HTTP, repository, race, live-source, and process smoke tests now cover the critical paths. The evidence and remaining operational risks are recorded in [AUDIT.md](AUDIT.md).

## Responsibilities

- Authenticate against NEPSE using its proof response and `css.wasm` token transformation.
- Cache active companies, latest prices, market status, top ten gainers/losers, historical prices, and news.
- Cache Merolagani daily OHLCV and pre-aggregate it into NEPSE-aligned weekly and monthly candles.
- Return consistent JSON to the Expo app and website.
- Keep cached data fresh through Asia/Kathmandu cron schedules.
- Preserve usable last-known values when a source or market is unavailable.

## Architecture

```text
NEPSE ───────────────┐
Merolagani ──────────┼─> scraper layer ─> scheduler ─> SQLite cache
Nepalipaisa JSON API ┘                                  │
                                                       v
Expo app / website <──────────── Chi REST API <─────────┘
```

The detailed component and data-flow description is in [how_it_works.md](how_it_works.md).

## Technology

- Go 1.23
- Chi 5 HTTP router and middleware
- SQLite through `mattn/go-sqlite3` (CGO is required)
- `robfig/cron/v3` with seconds and Asia/Kathmandu timezone
- Goquery for Merolagani HTML parsing
- Wasmer Go for NEPSE's WebAssembly token calculation

## Repository layout

```text
lagani_api/
├── cmd/server/                 production entry point
├── cmd/chart_test/             manual Merolagani diagnostic
├── cmd/test_hist_endpoint/     manual NEPSE diagnostic
├── internal/api/               router, middleware, handlers
├── internal/database/          schema and repositories
├── internal/models/            public/domain data structures
├── internal/scheduler/         cron orchestration and aggregation
├── internal/scraper/           NEPSE, Merolagani, Nepalipaisa clients
├── css.wasm                    NEPSE token transformation module
├── Dockerfile                  production container
├── Makefile                    local verification commands
├── AUDIT.md                    findings, fixes, and remaining risks
├── DEPLOYMENT.md               production runbook
└── how_it_works.md             detailed architecture
```

## Local setup

Prerequisites:

- Go 1.23.x with a working C compiler because the SQLite driver and Wasmer use CGO.
- `css.wasm` present at the configured `WASM_FILE` path.
- Network access to the three upstream sources for live ingestion.

Copy the environment template and export it with your preferred environment manager:

```bash
cp .env.example .env
```

The Go process intentionally reads the process environment; it does not silently load `.env`. One option is the `godotenv` command:

```bash
go install github.com/joho/godotenv/cmd/godotenv@latest
godotenv -f .env go run ./cmd/server
```

For a fast API-only local run without upstream startup work:

```bash
SCHEDULER_ENABLED=false DB_FILE=./data/dev.db go run ./cmd/server
```

Then check:

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```

## Configuration

All values are optional unless production guidance says otherwise. Defaults are shown in `.env.example` and in code.

### Server and security

| Variable | Meaning |
| --- | --- |
| `PORT` | HTTP port, default `8080`. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated web-client origins. Localhost and Expo origins are the development default. Set only the exact deployed Expo web origin if that client is published; native iOS/Android and the static marketing site do not need CORS access. |
| `ADMIN_API_KEY` | Secret accepted through `X-Admin-Key` or `Authorization: Bearer`. If empty, every `/admin/*` route returns `503`; it is never publicly open. |
| `DB_FILE` | SQLite path. Parent directories are created with restricted permissions. Use a persistent-volume path in production. |
| `WASM_FILE` | Path to `css.wasm`. |
| `SCHEDULER_ENABLED` | Enables cron registration. Disable on API-only/non-leader processes. |
| `STARTUP_JOBS_ENABLED` | Enables initial company, status, price, mover, news, and closed-market chart refresh. |

### Source URLs

All source base URLs and relevant paths can be overridden. This is primarily for upstream migrations and controlled tests. Important settings include:

- `NEPSE_BASE_URL`, `NEPSE_PROVE_PATH`, `NEPSE_COMPANY_LIST_PATH`
- `NEPSE_DAILY_STATS_PATH`, `NEPSE_MARKET_STATUS_PATH`
- `NEPSE_TOP_GAINERS_PATH`, `NEPSE_TOP_LOSERS_PATH`
- `NEPSE_HISTORICAL_PRICE_PATH_FORMAT`
- `MEROLAGANI_BASE_URL`, `MEROLAGANI_NEWS_PATH`, `MEROLAGANI_CHART_PATH`
- `NEPALIPAISA_BASE_URL`, `NEPALIPAISA_NEWS_API_PATH`

### Scheduler

Cron expressions contain six fields, including seconds, and are interpreted in `Asia/Kathmandu`. Defaults reflect NEPSE's Sunday-Thursday week and stagger requests to avoid bursts:

| Job | Default behavior |
| --- | --- |
| Market status | Every 2 minutes, 10:00-15:59 NPT, Sunday-Thursday. |
| Prices | Every 5 minutes, 11:00-14:59 NPT, staggered at second 15. |
| Gainers / losers | Every 5 minutes during market hours, staggered at seconds 30 and 45. |
| Closing snapshots | Forced price, gainer, and loser refreshes at 15:05-15:07 NPT. |
| Companies | Daily at 02:00 NPT. |
| News | Daily at 06:00 and 18:00 NPT. |
| NEPSE historical prices | Daily at 18:00 NPT. |
| Merolagani chart data | Daily at 00:05 NPT. |

Invalid cron expressions stop scheduler startup rather than leaving a partly scheduled service.

## Public API

All JSON timestamps are RFC 3339 UTC strings except chart timestamps, which are Unix seconds UTC.

### Operational endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/ping` | Minimal Chi heartbeat. |
| `GET` | `/healthz` | Process liveness; returns `{"status":"ok"}`. |
| `GET` | `/readyz` | Verifies the SQLite connection before returning ready. |

### Market endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/companies` | Active companies ordered by symbol. |
| `GET` | `/prices` | Latest cached price per symbol. Last-known values remain available outside market hours. |
| `GET` | `/market-status` | Latest NEPSE status and source `asOf` time normalized to UTC. Returns `404` until first ingestion. |
| `GET` | `/top-gainers` | Latest top ten gainers. |
| `GET` | `/top-losers` | Latest top ten losers. |
| `GET` | `/news?limit=50` | Merged news ordered by publication time. `limit` must be 1-100. |
| `GET` | `/historical-price/{securityId}` | NEPSE graph history for a positive numeric security ID. |
| `GET` | `/charts/{symbol}` | Merolagani OHLCV for a known company symbol. |

Empty collection endpoints return `[]`, not `null`. Errors use this stable form:

```json
{"error":"Human-readable message"}
```

### Chart query contract

`GET /charts/NABIL?range=1y&resolution=W`

Supported ranges:

- `1d`: the latest available candle, found with a 30-calendar-day holiday-safe lookup
- `1w`, `1m`, `3m`, `6m`, `ytd`, `1y`, `5y`, `all`

Supported resolutions:

- `D`: daily
- `W`: NEPSE week, starting Sunday
- `M`: calendar month

If resolution is omitted:

- up to 90 days uses daily
- over 90 days through 2 years uses weekly
- over 2 years uses monthly

Invalid values return `400`; the API does not silently substitute a different resolution. Responses include `X-Chart-Resolution` and `X-Data-Source` headers.

Chart point format:

```json
{"t":1786406400,"o":550.0,"h":556.0,"l":549.0,"c":551.0,"v":26088.0}
```

## Admin API

Admin routes enqueue exclusive background work and return `202`. A duplicate or conflicting refresh returns `409`, preventing accidental concurrent full backfills.

```bash
curl -X POST \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  http://localhost:8080/admin/update-prices
```

Routes:

- `POST /admin/update-prices`
- `POST /admin/update-historical-data`
- `POST /admin/update-chart-data`
- `POST /admin/update-all-data`

Never place `ADMIN_API_KEY` in the Expo app or website bundle.

## Database behavior

SQLite runs with foreign keys, WAL, a 5-second busy timeout, normal synchronous mode, and one in-process pooled connection. This avoids intermittent writer-lock failures from concurrent scheduler jobs.

Core tables:

- `companies`
- `prices`
- `market_status`
- `movers`
- `news_items`
- `historical_prices`
- `chart_data`
- `chart_data_weekly`
- `chart_data_monthly`

Company updates use `ON CONFLICT DO UPDATE`. Do not change this to `INSERT OR REPLACE`: SQLite `REPLACE` deletes the old parent row and would cascade-delete prices and chart history.

The startup migration also recognizes the incompatible early `historical_prices` layout and moves its data into the canonical schema transactionally.

## Verification

Fast deterministic suite:

```bash
make test
make vet
make test-race
```

Live upstream contract suite:

```bash
make test-live
```

Live tests contact all production sources and should run as a scheduled canary, not on every pull request. They currently verify both news sources, Merolagani NABIL and long-range NMB50 chart windows (including positive/consistent candle invariants), the NEPSE historical challenge body, and core NEPSE company/status/price/mover responses.

## Deployment

Build the production container:

```bash
docker build --platform linux/amd64 -t lagani-api .
```

The image runs as a non-root user, expects persistent SQLite storage at `/data`, and exposes port 8080. It is currently Linux/AMD64-only because the pinned `wasmer-go` release does not enable its bundled Linux ARM64 linker path. Use `--platform linux/amd64` on both build and run when the host is ARM-based. See [DEPLOYMENT.md](DEPLOYMENT.md) for required secrets, health checks, backup/restore, first backfill, monitoring, and rollback.

## Known operational constraints

- NEPSE and Merolagani contracts are not stable public APIs. The live contract suite is the early-warning mechanism.
- The NEPSE graph challenge contains a static table mirrored from the official web client. A client-bundle change can require a code update.
- SQLite means one stateful writer replica. Move to PostgreSQL before horizontal API scaling.
- Source availability and permission/terms must be reviewed before commercial production use.
- Financial data is informational; clients should display source time and appropriate disclaimers rather than implying exchange-certified real-time data.
