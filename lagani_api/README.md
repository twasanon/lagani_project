# Lagani API Backend

This directory contains the Go backend server for the Lagani React Native application.

## Role

- Acts as an intermediary between the mobile app and external data sources (NEPSE API, Merolagani, Nepalipaisa).
- Handles NEPSE API authentication (including WASM token calculation).
- Scrapes required data (company list, prices, market status, top movers, news, historical daily prices).
- Caches scraped data in a local SQLite database (`lagani_cache.db`) for performance and resilience.
- Provides simplified REST API endpoints for the mobile app to consume cached data.
- Runs background tasks (using `gocron`) to periodically update the cached data.

## Tech Stack

- **Language:** Go
- **Web Framework/Router:** Chi (v5)
- **Database:** SQLite (using `mattn/go-sqlite3` driver)
- **Scheduling:** `robfig/cron/v3`
- **HTML Parsing:** `PuerkitoBio/goquery`
- **NEPSE Auth:** `wasmerio/wasmer-go` (for running WASM)
- **Configuration:** Environment Variables (optionally via `.env` file)

## Project Structure

```
lagani_api/
├── cmd/server/main.go    # Application entry point, DI, server/scheduler start
├── internal/             # Internal packages
│   ├── api/              # HTTP handlers and router setup
│   ├── database/         # DB connection, migration, repositories (SQL logic)
│   ├── models/           # Core data structures (structs)
│   ├── scraper/          # Data scraping logic (NEPSE, Merolagani, etc.)
│   └── scheduler/        # Background task scheduling (cron jobs)
├── go.mod                # Go module definition
├── go.sum                # Dependency checksums
├── lagani_cache.db       # SQLite database file (created on first run)
├── css.wasm              # WASM binary required for NEPSE authentication
├── .env.example          # Example environment variables file (Copy to .env)
├── .gitignore
└── README.md             # This file
```

## Setup & Running

1.  **Prerequisites:**
    *   Go (version specified in `go.mod`)
    *   Ensure `css.wasm` file is present in this directory.

2.  **Install Dependencies:**
    ```bash
    go mod tidy
    ```

3.  **Configuration (.env File - Optional but Recommended):**
    *   Copy `.env.example` to `.env`.
    *   Review and adjust the values in `.env` if needed (defaults are provided).
    *   Key variables include `PORT`, `DB_FILE`, `WASM_FILE`, various scraper URLs, and cron `SCHEDULE` strings.

4.  **Running the Server:**
    *   **Without `.env` (uses defaults):**
        ```bash
        go run cmd/server/main.go
        ```
    *   **With `.env` (using `godotenv` tool):**
        *   Install tool: `go install github.com/joho/godotenv/cmd/godotenv@latest`
        *   Run: `godotenv -f .env go run cmd/server/main.go`
    *   **With `.env` (manual export):**
        ```bash
        export $(grep -v '^#' .env | xargs)
        go run cmd/server/main.go
        ```

5.  **Server Status:**
    *   The server will log startup information, including the port it's listening on (default 8080).
    *   It will run initial scrapes and then start the scheduled background tasks.
    *   API endpoints will be available (e.g., `http://localhost:8080/companies`).
    *   Press `Ctrl+C` for graceful shutdown.

## Configuration Variables (.env)

See `.env.example` for a list of configurable environment variables and their default values. These control the server port, database file location, WASM file location, external API URLs, and cron job schedules.

## API Endpoints

- `GET /ping`: Health check.
- `GET /companies`: Returns list of active companies.
- `GET /prices`: Returns latest price statistics for all companies.
- `GET /market-status`: Returns current NEPSE market status.
- `GET /top-gainers`: Returns latest list of top gaining stocks.
- `GET /top-losers`: Returns latest list of top losing stocks.
- `GET /news`: Returns recent news items (optional `?limit=N` parameter).
- `GET /historical-price/{securityId}`: Returns cached historical daily price data for a specific company (sourced from NEPSE).
- `GET /charts/{symbol}`: Returns historical chart data (OHLCV) for a specific company symbol.
    - **Source:** Merolagani
    - **Query Parameters:**
        - `range`: Specifies the time window for the data. Supported values: `1d`, `1w`, `1m`, `ytd`, `1y`, `all`. Defaults to `1y` if not provided.
        - `resolution`: Specifies the granularity of data points. Supported values: `D` (Daily), `W` (Weekly), `M` (Monthly).
            - If not provided, resolution is automatically selected based on the `range`:
                - `range` <= 90 days: Defaults to 'D'.
                - `range` > 90 days and <= 2 years: Defaults to 'W'.
                - `range` > 2 years: Defaults to 'M'.
            - Invalid `resolution` values also default to 'D'.
- `POST /admin/update-historical-data`: Manually triggers a background job to fetch and update historical price data for all known companies.
- `POST /admin/update-prices`: Manually triggers a forced price update job that bypasses market status checks.
- `POST /admin/update-chart-data`: Manually triggers the Merolagani chart data update job.
- `POST /admin/update-all-data`: Manually triggers all primary data scraping jobs.

## Caching & Scheduling

- The server caches data fetched from external sources in the `lagani_cache.db` SQLite database.
- Background cron jobs (defined in `internal/scheduler/`) automatically run at configured intervals (see `.env` `*_SCHEDULE` variables) to:
    - Update the company list.
    - Update current price statistics.
    - Update market status.
    - Update top movers.
    - Scrape and update news items from configured sources.
    - Scrape and update historical daily price data (from NEPSE for `/historical-price`).
    - Scrape and update daily chart data from Merolagani, and pre-aggregate it into weekly and monthly views for the `/charts` endpoint.
- This ensures the mobile app primarily interacts with the local cache, improving performance and reducing reliance on external APIs.

## Chart Data Handling: Nuances and Intricacies

The `/charts/{symbol}` endpoint and its underlying data pipeline have several important characteristics:

### 1. Data Source & Primary Storage

- **Source:** Historical OHLCV (Open, High, Low, Close, Volume) data is primarily sourced from **Merolagani**.
- **`chart_data` Table:**
    - Raw daily data fetched from Merolagani is stored in the `chart_data` table.
    - Each data point's `timestamp` field stores a **Unix timestamp in seconds (UTC)**, representing the start of the trading day (typically 00:00:00 UTC for that date).
    - This table serves as the source of truth for all finer-grained data and for aggregations.
    - Data is inserted with `ON CONFLICT DO NOTHING` to prevent duplicates based on `(company_symbol, source, timestamp)`.

### 2. Pre-Aggregated Data for Performance

To optimize API response times for common longer-range views, daily data is pre-aggregated by the scheduler:

- **`chart_data_weekly` Table:**
    - Stores weekly aggregated OHLCV data.
    - `timestamp` is a Unix timestamp (seconds, UTC) representing the start of the week (Monday, 00:00:00 UTC).
    - Aggregation logic:
        - `open`: The `open` of the first daily point in the week.
        - `high`: The maximum `high` of all daily points in the week.
        - `low`: The minimum `low` of all daily points in the week.
        - `close`: The `close` of the last daily point in the week.
        - `volume`: The sum of `volume` of all daily points in the week.
- **`chart_data_monthly` Table:**
    - Stores monthly aggregated OHLCV data.
    - `timestamp` is a Unix timestamp (seconds, UTC) representing the start of the month (1st day, 00:00:00 UTC).
    - Aggregation logic is similar to weekly, but applied over a calendar month.
- **Upsert Logic:** Aggregated data is saved using an "upsert" mechanism (`INSERT ... ON CONFLICT DO UPDATE`). If a record for a given symbol, source, and timestamp already exists, it's updated; otherwise, a new record is inserted.

### 3. Scheduler's Role (`updateMerolaganiChartDataJob`)

This background job is crucial for maintaining the chart data:

- **Daily Data Fetching:**
    - For each company, it checks the latest timestamp in the `chart_data` table.
    - It then fetches new daily data from Merolagani incrementally (from the last known timestamp or from a very early date like Jan 1, 2000, for initial population).
    - Fetched daily data is saved into the `chart_data` table.
- **Optimized Range-Based Re-aggregation:**
    - After new daily data is saved for a set of symbols, the job identifies which symbols had updates.
    - For these updated symbols, it determines the affected time range for re-aggregation into `chart_data_weekly` and `chart_data_monthly`. This is typically from the start of the week/month of the oldest new daily point.
    - It fetches the necessary daily data from `chart_data` for this range.
    - Local aggregation functions (`aggregateToWeekly`, `aggregateToMonthly`) process this daily data.
    - The resulting aggregated points are then saved (upserted) into `chart_data_weekly` and `chart_data_monthly`. This avoids recalculating entire aggregated tables on every run, improving efficiency.
- **Scheduling:** The job runs daily and also on application startup to ensure data freshness.

### 4. API Endpoint Behavior (`GET /charts/{symbol}`)

- **`range` Parameter:** Defines the overall time window for the chart (e.g., "1m" for one month, "1y" for one year). Default is "1y".
    - `1d`: Last 7 calendar days (to provide some context around a single "day" view).
    - `1w`: Last 7 calendar days.
    - `1m`: Last 1 month.
    - `ytd`: Year to date.
    - `1y`: Last 1 year.
    - `all`: From earliest available data (Jan 1, 2000, as a practical lower bound) to now.
- **`resolution` Parameter:** Defines the granularity of the data points (candles) returned.
    - `D`: Daily data.
    - `W`: Weekly data.
    - `M`: Monthly data.
- **Automatic Resolution Logic:**
    - If the `resolution` query parameter is **not** provided by the client, the API automatically selects an optimal resolution based on the requested `range`'s duration:
        - Duration <= 90 days: Resolution defaults to `D`.
        - Duration > 90 days and <= 2 years: Resolution defaults to `W`.
        - Duration > 2 years: Resolution defaults to `M`.
    - If an invalid `resolution` is provided (e.g., "X"), it defaults to `D`.
- **Data Fetching:** Based on the final `resolution` (explicitly provided or automatically determined), the API queries the corresponding database table:
    - `D` -> `chart_data`
    - `W` -> `chart_data_weekly`
    - `M` -> `chart_data_monthly`
- **Timestamps in Response:** All timestamps (`t`) in the JSON response are Unix timestamps in seconds (UTC), consistent with the database storage.

## Current Status

- The backend is refactored into structured packages.
- Core functionalities (scraping, caching, scheduling, API endpoints for market data, news) are implemented.
- **Key Feature:** Comprehensive chart data functionality via `GET /charts/{symbol}` is implemented, sourcing data from Merolagani, with pre-aggregation into daily, weekly, and monthly views for optimized performance. The system uses Unix timestamps (seconds, UTC) throughout the chart data pipeline.
- **Price Data Fix:** Successfully resolved issues with price data not being saved when market is closed. The system now properly fetches and stores last known prices from NEPSE API even outside market hours.
- **Manual Triggers:** Added admin endpoints for manually triggering data updates, including forced price updates that bypass market status checks.
- **Database Status:** Currently serving 249 price records for active stocks out of 364 total companies.
- The `/historical-price/{securityId}` endpoint (NEPSE sourced) remains for other historical data needs. 