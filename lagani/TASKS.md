# Lagani Project Tasks

This file tracks the current development focus and potential future tasks for the Lagani app.

## Current Task

- [ ] **Implement Stock Detail Chart (`StockDetailScreen.tsx`)**
    - [ ] **Backend:** Ensure the `lagani_api` backend provides a stable endpoint for fetching historical price data (e.g., daily data for 1 year) for a given security ID or symbol. (Likely `/historical-price/:securityId` is available).
    - [ ] **Frontend API Layer (`src/api/`):** Create a function to call the backend endpoint for historical data.
    - [ ] **UI (`app/screens/StockDetailScreen.tsx`):**
        - [ ] Integrate a suitable charting library (consider `react-native-gifted-charts` or `lightweight-charts` via WebView).
        - [ ] Fetch historical data for the current stock symbol when the screen loads.
        - [ ] Display the fetched data in the chart, replacing the current placeholder.
        - [ ] Add controls for changing the time range (e.g., 1D, 1W, 1M, 1Y, All) if the library supports it easily.
        - [ ] Handle loading and error states for the chart data.

## Backlog / Future Ideas

- [ ] Implement real portfolio chart on `HomeScreen`.
- [ ] Implement detailed Portfolio P/L calculation and display on `PortfolioScreen`.
- [ ] Fetch and display real Key Stats on `StockDetailScreen`.
- [ ] Enhance Search UI/functionality (e.g., better result presentation, history).
- [ ] Implement user settings on `SettingsScreen` (e.g., theme preference, notification settings).
- [ ] Add automated tests (Frontend & Backend).
- [ ] Improve error handling and user feedback across the app.
- [ ] Investigate and fix potential background fetch reliability issues for price alerts in standalone builds.
- [ ] Explore options to get dates for Nepalipaisa news items (if possible).
- [ ] Consider adding company logos or other visual enhancements.
- [ ] Add onboarding/first-time user experience. 