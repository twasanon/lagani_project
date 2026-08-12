# Lagani API: How It Works

This document provides a detailed explanation of the Lagani API backend server, its architecture, data flows, components, and key operational nuances. It's intended for developers working on or integrating with the server.

## 1. Overall Architecture

The Lagani API server is designed as a Go application that acts as an intermediary and data processor between client applications (like the Lagani mobile app) and various external financial data sources from Nepal's stock market.

Its core responsibilities include:
- **Scraping Data:** Periodically fetching data from sources like NEPSE (Nepal Stock Exchange), Merolagani, and Nepalipaisa.
- **Authentication:** Handling specific authentication requirements, notably the WASM-based token calculation for certain NEPSE API endpoints.
- **Data Caching:** Storing scraped data in a local SQLite database (`lagani_cache.db`) for quick retrieval, performance improvement, and resilience against external API downtimes.
- **Data Processing & Aggregation:** Transforming raw data into more useful formats, such as pre-aggregating daily chart data into weekly and monthly views.
- **Providing a REST API:** Exposing simplified and consistent API endpoints for client applications to consume the cached and processed data.
- **Background Scheduling:** Running automated tasks (cron jobs) to keep the cached data up-to-date.

The main components are:
- **Main Application (`cmd/server/main.go`):** The entry point that initializes and wires up all dependencies, starts the HTTP server, and manages the scheduler.
- **API Layer (`internal/api/`):** Handles incoming HTTP requests, routes them to appropriate handlers, processes requests, and sends responses. Uses the `chi` router.
- **Database Layer (`internal/database/`):** Manages the SQLite database connection, schema migrations, and provides repositories for data access logic (CRUD operations).
- **Models (`internal/models/`):** Defines the core Go structs representing the data entities (e.g., Company, PriceSnapshot, NewsItem, ChartDataPoint).
- **Scraper Layer (`internal/scraper/`):** Contains the logic specific to fetching and parsing data from each external source.
- **Scheduler Layer (`internal/scheduler/`):** Manages background tasks using `robfig/cron/v3`, ensuring data is regularly updated.

## 2. Data Flow

A typical data flow in the system is as follows:

1.  **Scheduled Task Trigger:** The Scheduler (`internal/scheduler/`) triggers a predefined job (e.g., `updateMerolaganiChartDataJob`).
2.  **Scraping:** The relevant Scraper (`internal/scraper/`, e.g., `MerolaganiScraper`) is invoked.
    *   It makes HTTP requests to the external data source (e.g., Merolagani's chart API).
    *   For NEPSE, this might involve a WASM-based authentication step to get a valid token.
    *   It parses the response (JSON, HTML, etc.).
3.  **Data Storage:** The Scraper (or the Scheduler job orchestrating it) uses a Database Repository (`internal/database/`, e.g., `ChartRepository`) to save the parsed data into the appropriate SQLite table(s).
    *   For chart data, daily data is saved to `chart_data`.
    *   The scheduler then reads this daily data and saves aggregated weekly/monthly data to `chart_data_weekly` and `chart_data_monthly`.
4.  **Client Request:** A client application sends an HTTP request to one of the API endpoints (e.g., `GET /charts/AKJCL?range=1y`).
5.  **API Handling:** The API Layer (`internal/api/`) receives the request.
    *   The `chi` router directs it to the correct handler function (e.g., `GetSymbolChartData`).
    *   The handler parses parameters, performs validation, and determines what data is needed (e.g., weekly data for AKJCL for the last year).
6.  **Data Retrieval from Cache:** The handler uses the appropriate Database Repository (e.g., `ChartRepository`) to fetch the requested data from the SQLite database.
7.  **Response:** The handler formats the data (typically as JSON) and sends it back to the client.

## 3. Core Components in Detail

### 3.1. Main Application (`cmd/server/main.go`)

-   **Initialization:** Sets up logging, reads environment variables for configuration.
-   **Dependency Injection:**
    -   Establishes the database connection (`database.ConnectDB()`).
    -   Runs schema migrations (`database.MigrateSchema()`) to ensure tables are created/updated.
    -   Initializes all repositories, passing them the DB connection.
    -   Initializes all scrapers, passing them relevant repositories if they need to directly save data (though often data is returned to a scheduler job which then uses a repo).
    -   Initializes the scheduler, providing it with scrapers and repositories.
    -   Initializes API handlers, giving them access to repositories and sometimes scrapers or the scheduler (e.g., for manually triggering jobs).
-   **Router Setup:** Calls `api.SetupRouter()` to configure all API routes and middleware.
-   **Service Startup:**
    -   Starts the scheduler's cron jobs in a background goroutine.
    -   Starts the HTTP server to listen for API requests.
-   **Graceful Shutdown:** Listens for interrupt signals (Ctrl+C) to shut down the scheduler and HTTP server cleanly.

### 3.2. API Layer (`internal/api/`)

-   **Router (`router.go`):**
    -   Uses `go-chi/chi/v5` for routing.
    -   Applies middleware: Logger, Recoverer (for panics), RealIP, RequestID, Heartbeat (`/ping`), and CORS.
    -   Defines all public API routes and maps them to handler methods in `Handlers`.
-   **Handlers (`handlers.go`, `chart_handlers.go`, etc.):**
    -   The `Handlers` struct holds dependencies like repositories, making them available to handler methods.
    -   Each handler method corresponds to an API endpoint.
    -   Responsibilities:
        -   Parsing request parameters (URL params, query params, request body).
        -   Validating input.
        -   Calling appropriate repository methods to fetch or save data.
        -   Formatting responses (usually JSON, using helper functions like `respondWithJSON` and `respondWithError`).
-   **CORS Configuration:** Allows cross-origin requests, typically from `localhost` during development and `exp://*` for Expo Go.

### 3.3. Database Layer (`internal/database/`)

-   **Connection (`database.go`):**
    -   `ConnectDB()`: Connects to the SQLite database file specified by the `DB_FILE` environment variable (defaults to `lagani_cache.db`).
    -   Ensures the database directory exists.
-   **Schema Migration (`database.go`):**
    -   `MigrateSchema()`: Creates all necessary tables if they don't exist (`CREATE TABLE IF NOT EXISTS ...`).
    -   Defines table structures, including columns, primary keys, foreign keys, unique constraints, and indexes.
    -   Key tables include: `companies`, `market_status`, `price_snapshots`, `news_items`, `historical_prices` (for NEPSE data), `chart_data` (daily Merolagani chart data), `chart_data_weekly`, and `chart_data_monthly`.
-   **Repositories (e.g., `company_repository.go`, `chart_repository.go`):**
    -   Follow the repository pattern, abstracting data access logic.
    -   Each repository is responsible for operations on a specific domain entity or table group.
    -   Methods typically perform SQL queries (SELECT, INSERT, UPDATE, DELETE) using the `sql.DB` connection.
    -   Handle transactions where necessary for atomic operations.
    -   Log database operations and errors.

### 3.4. Models (`internal/models/`)

-   Defines Go structs that represent the data structures used throughout the application.
-   Examples:
    -   `Company`: Information about a listed company.
    -   `PriceSnapshot`: Detailed price statistics for a company at a point in time.
    -   `NewsItem`: A news article.
    -   `HistoricalPriceData`: For NEPSE-sourced historical data.
    -   `ChartDataPoint`: A single OHLCV (Open, High, Low, Close, Volume) data point with a timestamp, used for chart data responses and internally. JSON tags (`t`, `o`, `h`, `l`, `c`, `v`) are compact for API responses.
-   These structs are used for:
    -   Unmarshalling API responses from external sources.
    -   Storing data in and retrieving data from the database.
    -   Formatting API responses from this server to clients.

### 3.5. Scraper Layer (`internal/scraper/`)

Contains modules for fetching data from specific external sources.

-   **`NepseScraper (`nepse.go`)`:**
    -   Handles interactions with the NEPSE API (`nepalstock.com.np`).
    -   **Authentication (`css.wasm`):** Implements the complex authentication flow required by NEPSE.
        -   It fetches "proof" data from NEPSE.
        -   Uses a WebAssembly (`.wasm`) module (`css.wasm` file) executed via `wasmer-go` to calculate a "salter token" based on the proof data.
        -   This token is then used as a Bearer token in `Authorization` headers for subsequent NEPSE API calls.
        -   The token is cached for a short duration (`tokenCacheDuration`) to avoid re-authentication on every request.
    -   Fetches: Company list, daily price statistics, top gainers/losers, market status, and historical daily price data (used by `/historical-price/{securityId}`).
    -   The `FetchGraphData` method exists but is **not currently used** by the main application flow, as chart data is sourced from Merolagani.
-   **`MerolaganiScraper (`merolagani.go`)`:**
    -   Handles interactions with Merolagani (`merolagani.com`).
    -   Fetches:
        -   News articles (by parsing HTML from `NewsList.aspx`).
        -   **Chart Data:** This is the primary source for the `/charts/{symbol}` endpoint. It calls the `/handlers/TechnicalChartHandler.ashx` endpoint with parameters like symbol, resolution, and date range. Parses a specific JSON structure (`MerolaganiChartResponse`).
    -   Uses a standard `User-Agent` and importantly, a `Referer` header when fetching chart data.
    -   Handles a specific `s: "no_data"` status from the Merolagani chart API as a non-fatal error (`ErrMerolaganiNoData`).
-   **`NepalipaisaScraper (`nepalipaisa.go`)`:**
    -   Handles interactions with Nepalipaisa (`nepalipaisa.com`).
    -   Currently fetches news articles.

### 3.6. Scheduler Layer (`internal/scheduler/`)

-   Manages background jobs using `robfig/cron/v3`.
-   Jobs are defined as functions within `scheduler.go`.
-   **Timezone:** Uses "Asia/Kathmandu" (NPT) for scheduling, especially for jobs that should run during NEPSE market hours.
-   **Key Jobs:**
    -   **Market Data Updates (NEPSE):**
        -   `ScrapeMarketStatus`, `ScrapePrices`, `ScrapeTopGainers`, `ScrapeTopLosers`: Run frequently during NEPSE market hours (Sunday-Thursday, 11:00 AM - 3:00 PM NPT).
    -   **Company List Update (NEPSE):** `ScrapeCompanies` runs daily.
    -   **News Updates (Merolagani, Nepalipaisa):** `ScrapeMerolaganiNews`, `ScrapeNepalipaisaNews` run periodically (e.g., every few hours).
    -   **NEPSE Historical Data Update:** `ScrapeHistoricalData` runs daily to update data for the `/historical-price/{securityId}` endpoint.
    -   **Merolagani Chart Data Update & Aggregation (`updateMerolaganiChartDataJob`):**
        -   Runs daily and on application startup.
        -   **Fetches Daily Data:** For each company, it checks the latest timestamp in `chart_data` and fetches newer daily OHLCV data from Merolagani.
        -   **Stores Daily Data:** Saves these new points to the `chart_data` table (source of truth for daily resolution).
        -   **Aggregates Data:** For symbols with new daily data, it re-calculates weekly and monthly aggregates:
            -   Determines the start date for re-aggregation based on the oldest new daily point.
            -   Fetches all necessary daily data for the affected period from `chart_data`.
            -   Calls local functions (`aggregateToWeekly`, `aggregateToMonthly`) to perform the OHLCV aggregation.
            -   Saves (upserts) the results into `chart_data_weekly` and `chart_data_monthly`.
            -   This range-based re-aggregation is more efficient than recalculating aggregates for all history.

## 4. API Endpoint Deep Dive

All timestamps in API responses, especially for chart data, are **Unix timestamps in seconds (UTC)**.

-   **`GET /ping`**
    -   **Purpose:** Health check.
    -   **Handler:** Handled by `chi/middleware.Heartbeat`.
    -   **Response:** `200 OK` with a small payload if the server is running.

-   **`GET /companies`**
    -   **Purpose:** Returns a list of all actively traded companies.
    -   **Handler:** `api.GetCompanies`
    -   **Data Source:** `companies` table in the SQLite database.
    -   **Logic:** Calls `CompanyRepository.GetAllCompanies()`.

-   **`GET /prices`**
    -   **Purpose:** Returns the latest price statistics for all companies.
    -   **Handler:** `api.GetPrices`
    -   **Data Source:** `price_snapshots` table. The scheduler job `scrapePrices` updates this table.
    -   **Logic:** Calls `PriceRepository.GetLatestPrices()` (or similar).

-   **`GET /market-status`**
    -   **Purpose:** Returns the current NEPSE market status (e.g., "OPEN", "CLOSED").
    -   **Handler:** `api.GetMarketStatus`
    -   **Data Source:** `market_status` table (singleton row).
    -   **Logic:** Calls `MarketStatusRepository.GetMarketStatus()`.

-   **`GET /top-gainers`**
    -   **Purpose:** Returns a list of the day's top-gaining stocks.
    -   **Handler:** `api.GetTopGainers`
    -   **Data Source:** `top_movers` table, filtered for type 'gainer'.
    -   **Logic:** Calls `MoverRepository.GetTopMovers("gainer")`.

-   **`GET /top-losers`**
    -   **Purpose:** Returns a list of the day's top-losing stocks.
    -   **Handler:** `api.GetTopLosers`
    -   **Data Source:** `top_movers` table, filtered for type 'loser'.
    -   **Logic:** Calls `MoverRepository.GetTopMovers("loser")`.

-   **`GET /news`**
    -   **Purpose:** Returns recent news items from Merolagani and Nepalipaisa.
    -   **Handler:** `api.GetNews`
    -   **Data Source:** `news_items` table.
    -   **Parameters:** Optional `?limit=N` query parameter to limit the number of news items.
    -   **Logic:** Calls `NewsRepository.GetRecentNews(limit)`.

-   **`GET /historical-price/{securityId:[0-9]+}`**
    -   **Purpose:** Returns cached historical daily price data for a specific company, sourced from NEPSE.
    -   **Handler:** `api.GetHistoricalPriceData`
    -   **Data Source:** `historical_prices` table.
    -   **Parameters:** `securityId` (NEPSE's numeric ID for the company) as a path parameter.
    -   **Logic:** Calls `HistoricalPriceRepository.GetHistoricalPricesBySecurityID(securityID)`.

-   **`GET /charts/{symbol}`**
    -   **Purpose:** Returns historical chart data (OHLCV) for a specific company symbol, sourced from Merolagani.
    -   **Handler:** `api.GetSymbolChartData`
    -   **Data Source:** `chart_data`, `chart_data_weekly`, or `chart_data_monthly` tables, depending on the determined resolution.
    -   **Parameters:**
        -   `symbol`: Company trading symbol (e.g., "AKJCL") as a path parameter.
        -   `range` (query, optional): Time window (e.g., "1d", "1m", "1y", "all"). Defaults to "1y".
        -   `resolution` (query, optional): Data granularity ("D", "W", "M"). Auto-selected if not provided.
    -   **Logic:**
        1.  Validates `symbol` and `rangeParam`.
        2.  Determines `startDate` and `endDate` based on `rangeParam`.
        3.  If `resolutionParam` is empty, it's auto-selected based on the duration between `startDate` and `endDate`:
            -   Duration <= 90 days: `resolutionParam = "D"`.
            -   Duration > 90 days and <= 2 years: `resolutionParam = "W"`.
            -   Duration > 2 years: `resolutionParam = "M"`.
        4.  If `resolutionParam` is provided but invalid, it defaults to "D".
        5.  Calls the appropriate `ChartRepository` method based on `resolutionParam`:
            -   "D": `ChartRepo.GetChartData(...)` (from `chart_data` table).
            -   "W": `ChartRepo.GetWeeklyChartData(...)` (from `chart_data_weekly` table).
            -   "M": `ChartRepo.GetMonthlyChartData(...)` (from `chart_data_monthly` table).
        6.  Returns data as an array of `models.ChartDataPoint` structs.

-   **`POST /admin/update-historical-data`**
    -   **Purpose:** Manually triggers the background job to fetch and update NEPSE historical price data for all known companies.
    -   **Handler:** `api.TriggerHistoricalDataUpdate`
    -   **Logic:** Calls `Scheduler.RunHistoricalDataJobNow()` which executes the `scrapeHistoricalData` job immediately in a goroutine.

## 5. Key Concepts and Intricacies

-   **Caching Strategy:**
    -   SQLite (`lagani_cache.db`) is used as a local cache to reduce dependency on external APIs, improve response times for clients, and provide data even if external sources are temporarily unavailable.
    -   Most data served by the API comes directly from this cache.
    -   Scheduler jobs are responsible for keeping this cache populated and up-to-date.

-   **NEPSE Authentication (`css.wasm`):**
    -   The NEPSE API requires a dynamic token for authentication.
    -   The server implements this by:
        1.  Fetching initial "salt" values from NEPSE's `/api/authenticate/prove` endpoint.
        2.  Using these salts as input to functions within a WebAssembly module (`css.wasm`).
        3.  The WASM module (run using `wasmer-go`) calculates the required `accessToken`.
        4.  This token is included in the `Authorization: Bearer <token>` header for subsequent requests to protected NEPSE endpoints.
    -   This is primarily relevant for NEPSE-sourced data like company lists, daily prices, and data for `/historical-price/{securityId}`.

-   **Chart Data Pipeline (Merolagani):**
    -   **Source:** Merolagani's `TechnicalChartHandler.ashx`.
    -   **Daily Data as Source of Truth:** The `chart_data` table stores daily OHLCV data as fetched. Timestamps are Unix seconds (UTC) for the start of the day.
    -   **Pre-Aggregation:** To serve common chart views (weekly, monthly) efficiently, the scheduler pre-aggregates data from `chart_data` into `chart_data_weekly` and `chart_data_monthly`.
        -   Weekly timestamps are for Monday 00:00:00 UTC.
        -   Monthly timestamps are for the 1st of the month 00:00:00 UTC.
    -   **API Resolution Logic:** The `GET /charts/{symbol}` endpoint intelligently selects which table to query based on the requested `range` and `resolution` (or defaults if `resolution` is not provided), ensuring optimal performance.
    -   **Timestamps:** All timestamps throughout this pipeline (database storage, API request/response) are Unix timestamps in seconds, UTC.

-   **Timezone Handling (NPT):**
    -   The scheduler is configured to use "Asia/Kathmandu" (NPT) timezone.
    -   This is critical for jobs that need to run specifically during NEPSE market hours (e.g., scraping live prices, market status). `isMarketHoursNPT()` helper function checks this.

-   **Configuration (`.env` file):**
    -   Server port, database file name, WASM file location, external API URLs, and cron job schedules are configurable via environment variables.
    -   An `.env.example` file is provided, and a `.env` file can be used locally for easy configuration (loaded by `godotenv` if running with it, or manually exported).

-   **Error Handling:**
    -   Repositories and scrapers return errors to their callers (handlers or scheduler jobs).
    -   Handlers use helper functions (`respondWithError`) to send appropriate HTTP status codes and JSON error messages to clients.
    -   Extensive logging is used throughout the application to track operations and errors.
    -   Specific errors like `scraper.ErrMerolaganiNoData` are handled gracefully (e.g., logged as INFO in the scheduler instead of ERROR if it just means no new data for a symbol).

## 6. Setup & Running

Refer to the `README.md` for detailed setup and running instructions. Key steps involve:
1.  Ensuring Go is installed.
2.  Having the `css.wasm` file in the root directory.
3.  Running `go mod tidy` to install dependencies.
4.  (Optional but Recommended) Creating a `.env` file from `.env.example` for configuration.
5.  Running the server using `go run cmd/server/main.go` (or with `godotenv`).

This document should provide a solid understanding of how the Lagani API server is built and operates. 