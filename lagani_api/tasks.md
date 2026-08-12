# Lagani API Tasks

This document outlines the current development tasks and provides essential context for the Lagani Go API backend.

## Essential Context: Lagani Go API

1.  **Project Goal:** The Lagani Go API is a backend server that acts as an intermediary for the Lagani React Native mobile application. It scrapes financial data related to the Nepal Stock Market (NEPSE) from various sources, caches this data, processes/aggregates it where necessary, and provides a simplified REST API for the mobile app.

2.  **Tech Stack (Backend - Go API):**
    *   **Language:** Go
    *   **Web Framework/Router:** Chi (v5)
    *   **Database:** SQLite (file: `lagani_cache.db`) using the `mattn/go-sqlite3` driver.
    *   **Scheduling:** `robfig/cron/v3` for background data update tasks.
    *   **HTML Parsing:** `PuerkitoBio/goquery` for scraping web pages (e.g., news).
    *   **NEPSE Authentication:** `wasmerio/wasmer-go` for running a `.wasm` module (`css.wasm`) required for NEPSE API authentication.
    *   **Configuration:** Environment Variables, typically managed via a `.env` file locally.

3.  **Core Features Implemented (Backend - Go API):**
    *   **Data Scraping:**
        *   **NEPSE:** Company list, live price statistics, market status, top gainers/losers, historical daily price data.
        *   **Merolagani:** News articles, historical chart data (OHLCV).
        *   **Nepalipaisa:** News articles.
    *   **NEPSE Authentication:** Implemented the WASM-based token calculation for NEPSE API access.
    *   **Data Caching:** All scraped data is stored and retrieved from the local SQLite database (`lagani_cache.db`).
    *   **Automated Scheduling:**
        *   Regular updates for company lists, prices, market status, top movers.
        *   Periodic fetching of news from Merolagani and Nepalipaisa.
        *   Daily updates for NEPSE historical data.
        *   Daily fetching and aggregation of Merolagani chart data.
    *   **Chart Data Pipeline:**
        *   Fetches daily OHLCV data from Merolagani.
        *   Stores raw daily data in the `chart_data` table (timestamps are Unix seconds, UTC).
        *   Scheduler pre-aggregates daily data into `chart_data_weekly` and `chart_data_monthly` tables (timestamps represent start of week/month, UTC).
    *   **API Endpoints:**
        *   `GET /ping`: Health check.
        *   `GET /companies`: List of companies.
        *   `GET /prices`: Latest price snapshots.
        *   `GET /market-status`: Current NEPSE market status.
        *   `GET /top-gainers`, `GET /top-losers`: Top movers.
        *   `GET /news`: Recent news items (sourced from Merolagani & Nepalipaisa).
        *   `GET /historical-price/{securityId}`: NEPSE-sourced daily historical prices.
        *   `GET /charts/{symbol}`: Merolagani-sourced chart data with `range` and `resolution` parameters (auto-resolution default). Serves daily, weekly, or monthly data from pre-aggregated tables. Timestamps in response are Unix seconds, UTC.
        *   `POST /admin/update-historical-data`: Manual trigger for NEPSE historical data job.

4.  **Project Structure (`lagani_api/` directory):**
    *   `cmd/server/main.go`: Application entry point, dependency injection, server & scheduler startup.
    *   `internal/api/`: HTTP handlers (using Chi router) and routing logic.
    *   `internal/database/`: Database connection, schema migration (`MigrateSchema`), and repository implementations (e.g., `NewsRepository`, `ChartRepository`).
    *   `internal/models/`: Go structs defining data entities (e.g., `NewsItem`, `ChartDataPoint`).
    *   `internal/scraper/`: Logic for scraping data from NEPSE, Merolagani, and Nepalipaisa.
    *   `internal/scheduler/`: Background job definitions and cron scheduling.
    *   `css.wasm`: WebAssembly binary for NEPSE authentication.
    *   `lagani_cache.db`: The SQLite database file.
    *   `.env` / `.env.example`: For environment variable configuration.

5.  **Documentation (Backend - Go API):**
    *   `lagani_api/README.md`: Project overview, setup instructions, API endpoint list, and detailed information on chart data handling.
    *   `lagani_api/how_it_works.md`: An in-depth document explaining the server's architecture, data flows, component details, and key operational intricacies.

6.  **Recent Work (Backend - Go API):**
    *   Successfully implemented the comprehensive chart data feature, including Merolagani scraping, daily data storage, scheduler-based pre-aggregation to weekly/monthly tables, and the flexible `/charts/{symbol}` API endpoint.
    *   Updated `README.md` with details on the chart data functionality.
    *   Created the `how_it_works.md` document for a deeper understanding of the backend system.

## ✅ Completed Task: Price Update Fix

**Status: COMPLETED AND WORKING**

Successfully resolved the critical issue where price data was not being saved to the database when the NEPSE market was closed. The fix involved:

1. **Fixed Scheduler Logic:** Prevented clearing of price data when market is closed
2. **Fixed Scraper Logic:** Prevented clearing prices table when NEPSE API returns empty data  
3. **Fixed Slice Initialization Bug:** Corrected critical bug in price transformation that was causing foreign key constraint failures
4. **Added Manual Trigger:** Created `/admin/update-prices` endpoint for forced price updates

**Results:**
- ✅ 249 price records successfully saved to database
- ✅ API endpoints returning price data correctly
- ✅ Manual trigger working for price updates
- ✅ Last known prices preserved when market is closed

**Documentation:** See `PRICE_UPDATE_FIX.md` for detailed technical implementation.

---

## Current Task: Verify News Update Functionality

The next task is to ensure that the news fetching and updating mechanism is working correctly and reliably. This involves:

1.  **Review Scheduler Jobs:**
    *   Examine the cron schedules for `scrapeMerolaganiNews` and `scrapeNepalipaisaNews` in `internal/scheduler/scheduler.go`. Confirm they are set to run at appropriate intervals.
    *   Check the logic within these jobs to ensure they correctly call the respective scraper methods.
2.  **Verify Scraper Logic:**
    *   Review `internal/scraper/merolagani.go` and `internal/scraper/nepalipaisa.go`.
    *   Confirm that the parsing logic for news items (titles, links, dates, image URLs) is still aligned with the current website structures of Merolagani and Nepalipaisa. Website changes can break scrapers.
    *   Ensure proper error handling is in place if scraping fails or no news is found.
3.  **Check Database Interaction:**
    *   Confirm that new news items are being successfully saved to the `news_items` table in `lagani_cache.db` by the `NewsRepository`.
    *   Verify that the `UNIQUE` constraint on the `link` column is preventing duplicate entries.
4.  **Test API Endpoint:**
    *   Call the `GET /news` endpoint (with and without the `?limit=N` parameter) after scheduler jobs have run.
    *   Verify that the endpoint returns the latest news items from both sources, correctly formatted.
5.  **Monitor Logs:**
    *   Run the server and observe the logs for a period that covers a few scheduled news scrapes.
    *   Look for any errors related to news scraping, parsing, or database saving.
    *   Confirm successful completion messages for these jobs.

**Goal:** To be confident that the news feature is robustly and continuously providing fresh and accurate news to the client application. 