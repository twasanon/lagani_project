# Lagani - Nepal Finance App Tutorial

This tutorial guides you through the main features of the Lagani app.

## 1. Overview

Lagani helps you track your Nepal stock market investments, monitor market trends, stay updated with news, set price alerts, and practice trading with a virtual portfolio.

## 2. Main Sections (Bottom Tabs)

The app is organized into several main sections accessible via the bottom tabs:

*   **Home:** Your dashboard showing market status, top movers, portfolio summary, and quick access via header icons to search (🔍) and view/manage active price alerts (🔔).
*   **Portfolio:** Detailed view of your real stock holdings and transactions.
*   **Paper:** A virtual trading simulator to practice buying and selling stocks.
*   **Watchlist:** A list of stocks you want to monitor closely.
*   **News:** Recent financial news headlines (fetched via the backend).
*   **Settings:** App settings and options (currently basic).

## 3. Key Features & How to Use Them

### 3.1. Home Screen

*   **Market Status:** See if the NEPSE market is currently Open or Closed.
*   **Top Gainers/Losers:** Quickly view the day's top-performing and worst-performing stocks.
*   **Portfolio Summary:** A snapshot of your total investment, current value, and overall profit/loss (based on manually entered transactions).
*   **Header Actions:**
    *   **Search (Magnifying Glass Icon 🔍):** Tap to reveal the search bar. Type a symbol or name, tap a result to view its `Stock Detail Screen`.
    *   **Price Alerts (Bell Icon 🔔):** Tap to open the `Price Alerts Modal`. View active alerts and tap the trash icon (🗑️) to delete one.
*   **Quick Action Buttons:**
    *   **+ Add:** Tap to navigate to the Portfolio tab to record a new BUY/SELL transaction.
    *   **News:** Tap to navigate to the News tab.

### 3.2. Viewing Stock Details

*   You can access the `Stock Detail Screen` for any stock by tapping it from search results, top movers, Watchlist, Portfolio, or Paper Trading.
*   This screen shows detailed price information, basic stats (*note: some stats might be placeholders*), and a chart (*note: chart is currently a placeholder*).
*   **Actions (Header Icons):**
    *   **Watchlist (Star Icon ⭐/★):** Tap to add/remove the stock from your Watchlist.
    *   **Set Alert (Bell Icon 🔔):** Tap to open the `Set Price Alert Modal` (see section 3.6).
*   **Navigation Note:** When you navigate to the `Stock Detail Screen` from the `Home` screen (or elements originating from Home like search results or top movers), the bottom tabs remain visible due to the nested navigation structure. Accessing from Portfolio or Watchlist might behave differently based on the root navigation.

### 3.3. Managing Your Portfolio

*   Go to the **Portfolio** tab.
*   **Adding Transactions:** Use the "+ Add" button on the Home screen (which navigates here) or potentially a dedicated button on this screen in the future.
    *   Select BUY or SELL.
    *   Enter the Stock Symbol, Quantity, and Price per share.
    *   Tap "Add Transaction".
*   **Viewing Holdings:** Your holdings are grouped by stock symbol. You see the total quantity and average buy price. (*Current value/P&L display is pending*).
*   **Viewing/Managing Individual Lots:** Tap on a stock symbol to expand it. Here you can see individual transactions and use the Sell (redirects to Sell Modal), Edit (✏️), or Delete (🗑️) icons for that specific lot.
*   **History:** Tap the "Transaction History" button to view all past transactions.

### 3.4. Paper Trading

*   Go to the **Paper** tab.
*   **Virtual Balance & Reset:** Manage your virtual funds.
*   **Placing Orders:** Enter Symbol and Quantity, tap Buy/Sell.
*   **Viewing Paper Portfolio:** See virtual holdings.
*   **Portfolio Chart:** Visualize paper portfolio performance.
*   **Transaction History:** View simulated trades.

### 3.5. Using the Watchlist

*   Go to the **Watchlist** tab.
*   **Adding/Removing Stocks:** Use the star icon (⭐/★) on the `Stock Detail Screen`.
*   **Viewing:** See current price and change for watched stocks.

### 3.6. Setting Price Alerts

*   Navigate to the `Stock Detail Screen` for the desired stock.
*   Tap the **Set Alert** bell icon (🔔) in the header.
*   In the modal, enter the target price and choose the condition (Above/Below).
*   Tap "Set Alert".
*   **Notifications:** The app checks locally stored prices against your alerts periodically in the background and sends a notification if a condition is met.
*   **Managing Alerts:** Use the **View Alerts** bell icon (🔔) on the `Home` screen header to open the modal where you can view and delete active alerts.

### 3.7. Reading News

*   Go to the **News** tab.
*   Displays recent headlines fetched from the backend cache (sourced from Merolagani & Nepalipaisa).
*   Each item shows headline, source, image (using `expo-image`), and date (*Note: Dates may be missing for some sources*).
*   **Read Full Article:** Tap a news card to open a modal with the article in a `WebView`.

## 4. Settings

*   Go to the **Settings** tab.
*   Provides basic options and the button to reset Paper Trading data.

---

Enjoy using Lagani! 