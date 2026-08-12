# Lagani - Nepal Finance App

 Lagani is a mobile app built with React Native (using Expo) for tracking investments and paper trading in the Nepal Stock Market (NEPSE).

## Features

- **Market Data:** View NEPSE status (Open/Closed), top gainers, and top losers on Home screen.
- **Search:** Search for stocks by symbol or name directly from the Home screen header.
- **Watchlist:** Monitor stocks of interest with current price data.
- **Detailed Portfolio Tracking:**
    - Manually record BUY and SELL transactions.
    - View portfolio holdings grouped by stock symbol.
    - See individual purchase/sell lots listed chronologically under each stock.
    - View current market value and profit/loss for individual BUY lots.
    - Edit the quantity and price of previously entered transactions to correct mistakes.
    - Delete individual transaction records (lots).
    - View overall portfolio summary (Total Value, Investment, Overall P/L).
- **Price Alerts:**
    - Set price targets (above/below) for specific stocks via the Stock Detail screen.
    - Receive native notifications when price targets are met (via background checks).
    - View and delete active alerts via the bell icon (🔔) modal accessible from the Home screen header.
- **Market News:** Fetches and displays recent news headlines from Merolagani and Nepalipaisa (via backend cache). Tap an item to view the full article in a web view modal.
- **Stock Detail View:** View price details, basic stats, and manage watchlist/alerts. Accessible via nested stack navigation within the Home tab, preserving bottom navigation.
- **Paper Trading:**
    - Simulate stock trading with a virtual balance.
    - Place Market BUY/SELL orders based on real market prices.
    - View paper portfolio holdings (quantity, average cost, current value, P/L).
    - Track overall portfolio performance with a value chart.
    - View transaction history.
    - Reset virtual balance and clear all paper trading data.
- **Help Section:** Access a detailed tutorial from the Settings screen, presented in an accordion format based on `TUTORIAL.md`.

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS for React Native) with a centralized theme (`src/theme/colors.ts`)
- **Navigation**: React Navigation v6 (Root Stack containing Bottom Tabs, nested Home Stack using `CompositeNavigationProp` for type safety)
- **Local Data Storage**: expo-sqlite
- **Image Handling**: `expo-image` (for improved caching and placeholders in News cards)
- **Notifications & Background Tasks**:
    - `expo-notifications`
    - `expo-device`
    - `expo-task-manager`
    - `expo-background-fetch`
- **Charting**: `lightweight-charts` (via `react-native-webview`) for Home/Portfolio charts, `react-native-gifted-charts` (dependency available).
- **UI Feedback**: `react-native-toast-message`
- **API Server (Backend)**: Go (`lagani_api` folder) - Refactored with structured packages, SQLite caching, background scraping, and environment variable configuration.

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn
- Expo CLI
- Go environment (for running the local backend API)
    - Go dependencies are listed in `lagani_api/go.mod`. Run `go mod tidy` in that directory.

### Installation

1.  **Backend API (`lagani_api`)**:
    *   See `lagani_api/README.md` for detailed setup and running instructions.
    *   Ensure the backend server is running before starting the frontend app.

2.  **Frontend App (`lagani`)**:
    *   Clone the repository (if you haven't already).
    *   Navigate to the root `lagani` project directory.
    *   Install dependencies: `npm install` or `yarn install`
    *   Ensure your `.env` file correctly points to your running backend API (e.g., `API_BASE_URL=http://localhost:8080`). The port should match the `PORT` used by the backend (default 8080).
    *   Start the development server: `npx expo start --clear`.
    *   Run on your device (using Expo Go app) or emulator/simulator.

## Project Structure

```
lagani/
├── app/                  # React Native frontend code
│   ├── components/
│   ├── screens/
│   └── navigation/
├── src/                  # Frontend core logic, utils, theme
│   ├── api/
│   ├── utils/
│   └── theme/
├── assets/               # Frontend global assets
├── lagani_api/           # Go backend API source code (See lagani_api/README.md)
│   ├── cmd/server/       # Main server entry point
│   ├── internal/         # Backend core packages (api, db, scraper, scheduler)
│   ├── go.mod
│   ├── lagani_cache.db   # SQLite cache (created on run)
│   └── css.wasm          # Asset for NEPSE auth
└── ...                   # Other frontend config files (package.json, etc.)
```

## Theming

- **Color Palette:** Defined centrally in `src/theme/colors.ts`.
- **Tailwind Integration:** Colors are imported into `tailwind.config.js` and made available as utility classes (e.g., `bg-primary`, `text-textSecondary`, `border-border`).
- **Usage:** Components and screens primarily use these theme-based utility classes instead of hardcoded colors or default Tailwind colors.

## Backend API (`lagani_api`)

- **Role:** Acts as an intermediary between the mobile app and external sources (NEPSE API, Merolagani, Nepalipaisa). Handles authentication (NEPSE), data fetching/scraping, caching data in SQLite, and providing simplified endpoints for the app.
- **Location:** `lagani_api/` directory within the main project.
- **Structure:** Refactored into layered packages (`cmd`, `internal/api`, `internal/database`, `internal/models`, `internal/scraper`, `internal/scheduler`).
- **Entry Point:** `cmd/server/main.go`
- **Caching:** Uses `lagani_cache.db` (SQLite) to store scraped data. Background tasks update this cache periodically based on configured schedules (considering market hours for relevant data).
- **Configuration:** Uses environment variables (optionally loaded from `lagani_api/.env`) for port, db file, URLs, schedules etc.
- **Endpoints Used by App:** `/companies`, `/prices`, `/market-status`, `/top-gainers`, `/top-losers`, `/news`.
- **See `lagani_api/README.md` for more details.**

## Completed Frontend Integrations & Functionality

*   **Backend Communication (`src/api/nepseScraper.ts`):**
    *   Fetches data exclusively from the local Go backend API.
*   **Data Refresh Logic (`src/api/nepseScraper.ts` & Screens):**
    *   Frontend initiates data fetches on screen focus or via pull-to-refresh.
    *   Backend provides cached data, updated periodically by its own scheduler.
*   **Local Database (`src/utils/database.ts`):**
    *   Manages user-specific data: `Watchlist`, `PortfolioHoldings`, `PortfolioTransactions`, `PriceAlerts`, `PaperTrading*` tables.
    *   Manages *display* copies of market/news data fetched from backend API cache: `Companies`, `Prices`, `MarketStatus`, `TopGainers`, `TopLosers`, `NewsItems`.
*   **App Initialization (`App.tsx`):**
    *   Initializes local DB connection and schema.
    *   Renders the `RootNavigator`.
    *   Defines and registers the background task for *checking* local `PriceAlerts` against locally stored `Prices`.
*   **Navigation (`app/navigation/`):**
    *   Refactored using `RootNavigator` (Stack), `AppNavigator` (Tabs), and `HomeStackNavigator` (Nested Stack).
    *   Ensures bottom tabs persist when navigating from Home to Stock Detail.
    *   Uses `CompositeNavigationProp` for type-safe navigation between nested navigators.
    *   Includes navigation to the Help screen from Settings.
*   **HomeScreen (`app/screens/HomeScreen.tsx`):**
    *   Displays Market Status, Top Gainers/Losers from local DB (refreshed from API).
    *   Header search functionality.
    *   Portfolio summary.
    *   Header icons: News button navigates to News tab, Bell icon opens `PriceAlertsModal`.
*   **StockDetailScreen (`app/screens/StockDetailScreen.tsx`):**
    *   Displays detailed stock info.
    *   Allows watchlist add/remove and setting price alerts (saved to local DB).
    *   Part of the nested `HomeStackNavigator`.
*   **NewsScreen (`app/screens/NewsScreen.tsx`):**
    *   Fetches news from local DB (refreshed from backend API cache).
    *   Displays news items using `NewsCard` component with `expo-image`.
    *   Allows viewing full article in a `WebView` modal.
*   **SettingsScreen (`app/screens/SettingsScreen.tsx`):**
    *   Provides options like Reset Paper Trading.
    *   Includes navigation link to the Help screen.
*   **HelpScreen (`app/screens/HelpScreen.tsx`):**
    *   Displays tutorial content from `TUTORIAL.md` in an accordion format.
*   **Modals (`app/components/`):**
    *   `PriceAlertsModal`: Displays active price alerts from local DB, allows deletion.
    *   Other modals (`AddToWatchlistModal`, `AddStockHoldingModal`, `SellStockModal`, etc.) function correctly.
*   **Linter/Type Errors Resolved:** Fixed navigation type errors, `SellStockModal` prop name mismatch, and text rendering warnings.

## Current Status & Known Issues

*   **Backend:** Refactored and functional.
*   **Frontend Core Features:** Market data display, Watchlist, Portfolio (manual entry), Price Alerts (setting/notification check), News display, Paper Trading simulation are implemented.
*   **Known Issues:**
    *   Portfolio chart on `HomeScreen` uses mock data.
    *   StockDetailScreen chart is a placeholder.
    *   StockDetailScreen key stats are placeholders (requires fetching additional data point from API/DB if available).
    *   Search results UI on `HomeScreen` is basic.
    *   Background fetch reliability for *price alert checks* needs testing in standalone builds.
    *   Nepalipaisa news items lack dates due to backend scraping limitations.
    *   Portfolio P/L calculation on `PortfolioScreen` might need review/implementation.

## Next Steps / Future Enhancements

*   Implement real charts (Home, StockDetail, Paper Trading).
*   Implement Portfolio P/L calculation.
*   Fetch and display real Key Stats on `StockDetailScreen`.
*   Enhance Search UI/functionality.
*   Implement user settings on `SettingsScreen`.
*   Add automated tests (Frontend & Backend).

## Key Screens

1. **Home**: Dashboard (portfolio overview, movers, watchlist preview, search, news/alert access)
2. **Portfolio**: Detailed view of tracked investments
3. **Paper Trading**: Virtual trading simulation
4. **Watchlist**: List of stocks being monitored
5. **News**: Market/stock news feed
6. **Stock Detail**: Comprehensive view of a specific stock (nested under Home)
7. **Settings**: User preferences and app configuration (includes link to Help)
8. **Help**: Detailed app tutorial (accordion format)

## Disclaimers

This app is designed for portfolio tracking and educational purposes only. No real money is used for buying or selling through this app. All market data is delayed by at least 15 minutes and is not intended for trading purposes. News content is scraped from third-party sources and accuracy is not guaranteed.

## License

This project is licensed under the MIT License. # lagani
