# Lagani user guide

## Home

Home shows the latest cached NEPSE market status, top gainers and losers, your manual portfolio summary, and a watchlist preview. Pull down to request a fresh validated snapshot from the Lagani API.

Use Search to find a company by symbol or name. Use the bell to view active price alerts. Add Stock opens the Portfolio tab; News opens the news feed.

## Stock details

Open a stock from search, movers, watchlist, portfolio, or paper trading. The screen shows the latest price and change, a selectable historical line chart, and available daily statistics. A `--` means the source did not provide that field; it is not a zero price.

Use the heart to add or remove the stock from your local watchlist. Set Alert creates a local ABOVE or BELOW target. Sell is available only when the symbol exists in the manual portfolio.

## Manual portfolio

Tap + on Portfolio, select a company from search results, and enter a positive whole-share quantity and price. A sale cannot exceed the quantity held at that point in the transaction history.

Holdings use moving-average cost. The summary shows remaining cost basis, value at the cached latest price, and unrealized P/L. Tap a holding or its edit icon to inspect transactions. Editing or deleting an older transaction recalculates the full holding and is rejected if it would make a later sale invalid.

This ledger does not calculate brokerage, taxes, fees, settlement, or corporate actions.

## Paper trading

The paper account starts with Rs. 1,000,000 virtual cash. Tap +, choose BUY or SELL, enter a valid NEPSE symbol and whole-share quantity, then tap the explicit Confirm Order button. Orders use the cached current market price.

Cash, position, and history are updated together. Portfolio Value excludes cash; the charted paper equity includes cash plus current position value. Use Portfolio and History to switch views, and the range buttons to filter recorded equity history.

## Watchlist

Add a stock with the heart on Stock Details or the + control on Watchlist. Tap a row to open details. The trash control removes only that symbol from the watchlist.

## News

News comes from the backend's Merolagani and Nepalipaisa cache. A card shows the source and source-provided publication date when available. Opening an article is restricted to HTTPS links.

## Price alerts

Choose a target above or below the current price. In a signed Android or iOS build, Lagani asks the operating system to run a background check no more frequently than the configured minimum. The OS chooses the actual time, so notifications can be delayed or skipped. Web and Expo Go are not proof of native background behavior.

## Settings and resets

Settings can force a market refresh, open or reset the paper account, show help, and reset all personal local data. The full reset removes the watchlist, manual transactions, alerts, and paper activity but keeps the public market cache. Reset operations cannot be undone.

Lagani is an educational tracking and simulation tool, not investment advice or a broker, and is not affiliated with NEPSE.
