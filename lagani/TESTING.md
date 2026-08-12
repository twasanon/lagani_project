# Mobile testing guide

## Automated gate

```sh
npm ci
npm run verify
npx expo export --platform android --output-dir dist/android
npx expo export --platform ios --output-dir dist/ios
```

`npm run verify` must pass TypeScript, all Vitest suites, and all Expo Doctor checks. Tests currently cover:

- strict parsing of API company, price, mover, status, news, and chart DTOs;
- rejection of malformed records;
- moving-average BUY/SELL accounting;
- oversell and invalid numeric input rejection;
- ABOVE/BELOW alert triggering and missing-price behavior.

## Live integration setup

Use a disposable API database or a safe development API. Populate companies, prices, movers, news, and charts before the app pass. Set `EXPO_PUBLIC_API_URL`, launch the app, and verify the API requests return HTTP 200.

For a physical device, the API URL must be reachable from the device. `localhost` on the phone is the phone itself.

## Manual feature matrix

| Area | Test | Expected result |
| --- | --- | --- |
| First launch | Launch with API available and no device DB | Schema initializes; snapshot is cached; Home renders without fabricated values. |
| Offline cache | Relaunch after disconnecting network | Existing market cache and all personal data remain visible; refresh error is recoverable. |
| Empty first launch | Launch with API unavailable and no cache | App starts with explicit empty/error states; no mock market values appear. |
| Refresh | Pull Home to refresh | A fresh complete snapshot replaces the public cache; spinner ends on success/failure. |
| Search | Search exact and partial symbol/name | Results are ordered sensibly and navigate to the selected company. |
| Stock detail | Open NABIL and switch ranges | Real chart or explicit empty state renders; missing OHLC displays `--`. |
| Watchlist | Add on detail, open Watchlist, remove | State persists across tabs and relaunch; nested remove does not open detail. |
| Portfolio BUY | Add 20 shares at Rs. 500 with market at Rs. 550 | Quantity 20, cost Rs. 10,000, value Rs. 11,000, unrealized P/L Rs. 1,000. |
| Portfolio SELL | Sell 5 of that holding | Quantity 15, average Rs. 500, cost Rs. 7,500, value Rs. 8,250. |
| Portfolio guard | Attempt sell 16 after the prior step | Error appears and transaction/holding remain unchanged. |
| Edit/delete | Edit or delete earlier BUY so later SELL becomes invalid | Mutation is rejected and rolled back; valid edits replay the holding. |
| Paper BUY | Buy 10 shares at a cached Rs. 550 | Cash decreases by Rs. 5,500; holding and history appear together. |
| Paper SELL | Sell the same 10 shares | Cash restores; holding disappears; history retains both trades. |
| Paper guards | Try fractional, zero, excessive, or unaffordable order | Action is rejected without any cash/position/history partial write. |
| Paper chart | Focus, refresh, and trade | Equity snapshots include cash plus positions and ranges filter data. |
| News | Refresh and open an article | Source/date display; only HTTPS navigation opens. |
| Alerts | Create ABOVE and BELOW alerts | Invalid side of current price is rejected; valid alert persists. |
| Background alert | Cross a target in a standalone build | On a later OS-scheduled run, prices refresh, notification fires, alert deactivates. |
| Permission denial | Deny notifications | Alert creation explains that permission is required; app remains usable. |
| Reset paper | Confirm reset | Only paper cash/positions/history reset; manual portfolio/watchlist remain. |
| Reset personal | Confirm full local reset | Watchlist, manual portfolio, alerts, and paper data clear; public cache remains. |
| Accessibility | Navigate with VoiceOver/TalkBack | Search, add, remove, back, watchlist, article, and reset controls have meaningful names. |
| Small phone | Use a 390×844-equivalent viewport/device | Currency, cards, tabs, modal suggestions, and reset controls do not clip. |

## Platform-specific checks

### iOS

- Notification permission allowed and denied.
- Background processing in a signed standalone build; do not infer it from Expo Go.
- Cold start after OS termination.
- Dynamic Type at larger accessibility sizes.
- News WebView close and back behavior.

### Android

- Android 13+ notification runtime permission.
- Background task behavior under battery optimization and after force stop.
- Back button closes modals/details in the correct order.
- Small and large display/font scaling.
- Upgrade from the prior production database, if one exists.

### Web development preview

- Serve through `npm run web:preview-proxy` when testing SQLite worker behavior.
- Confirm COOP/COEP response headers.
- Verify paper trade confirmation, suggestion stacking, and async database startup.
- Reset the browser database between destructive test scenarios when isolation matters.

## Failure triage

1. Check browser/device console for the first error, not cascading render messages.
2. Verify `EXPO_PUBLIC_API_URL` and API `/readyz` from the target device network.
3. Inspect the exact public endpoint and compare it with `src/types/market.ts`.
4. If only one device DB fails, reproduce using an upgrade copy before deleting data.
5. If a chart is empty, check the backend chart endpoint and `X-Chart-Resolution` header before changing UI code.
6. For background alerts, distinguish task registration, OS execution, network refresh, permission, and notification scheduling.

