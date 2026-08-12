# Mobile audit report

Audit baseline: Expo SDK 57, React Native 0.86, React 19, TypeScript 6, and the current Go API contract. The audit covered static code, runtime data contracts, accounting logic, local persistence, dependency health, native configuration, and live phone-sized browser workflows against a locally running API populated from current sources.

## Repaired findings

### Critical and high impact

- Replaced the old client DTO assumptions with explicit current API types and runtime validation. The former code silently expected different field names for prices, movers, status, news, and chart data.
- Rebuilt the public SQLite cache schema and versioned its migration. The old schema mixed upstream and UI fields and could leave incompatible rows after upgrades.
- Made market snapshot replacement atomic and refused destructive replacement for empty company/price responses.
- Replaced manual-holding arithmetic with a chronological moving-average ledger. Oversells now fail and roll back; edits/deletes replay the ledger.
- Moved paper cash from AsyncStorage into SQLite and combined cash, history, and position changes in one transaction. This removes crash windows that could create cash without a trade or a trade without a position.
- Removed a web deadlock caused by synchronous Expo SQLite opening and changed web startup to asynchronous database opening.
- Removed a second `Alert`-based paper confirmation that never completed on Expo Web. The modal's explicit confirmation button now executes the atomic order directly.
- Replaced mock portfolio/chart data and stock chart placeholders with real backend data and native SVG charts.
- Removed remote CDN chart execution from WebViews.
- Updated background work from deprecated Background Fetch to Expo Background Task and refresh prices before comparisons.
- Corrected stale price/news refresh behavior and preserved cached data on network failures.

### Correctness and user experience

- Portfolio summaries now value derived current holdings instead of treating every historical BUY as still owned.
- Paper equity history now includes virtual cash as well as marked-to-market positions.
- Time-range controls actually filter paper history.
- Share quantities must be positive whole numbers; prices must be finite and positive.
- Missing OHLC fields render as `--` instead of `Rs. 0.00`.
- News dates and source names now match the backend response.
- News navigation validates HTTPS before opening and rejects non-HTTPS redirects.
- Search suggestion stacking on Expo Web was fixed so results remain clickable above subsequent inputs.
- Main icon-only controls received accessible roles and labels.
- Large paper balances were reorganized for a 390-pixel viewport rather than pushing Reset off-screen.
- Currency display was standardized to `Rs.` instead of the Indian rupee glyph.
- Fake user identity, fake ad content, inactive settings toggles, and misleading placeholder documentation were removed.

### Platform and dependencies

- Upgraded from Expo SDK 53-era dependencies to SDK 57-compatible versions.
- Adopted Expo Continuous Native Generation and removed stale checked-in iOS/Android projects containing the old anonymous application ID.
- Removed the excluded, unused desktop/AAPL paper-trading reference prototype so it cannot be confused with the NEPSE implementation or evade normal type checks.
- Set production bundle/application IDs to `com.lagani.app` pending owner confirmation.
- Removed unused or insecure packages, including the abandoned NEPSE client, WebAssembly helper, remote chart libraries, and deprecated background-fetch dependency.
- Added safe transitive overrides that eliminated critical npm audit findings without forcing an incompatible Expo downgrade.
- Added Vitest domain tests and repeatable typecheck/test/doctor scripts.

## Verification evidence

At the audited baseline:

- TypeScript compiles with no errors.
- 9 deterministic domain tests pass.
- Expo Doctor passes all checks.
- Android and iOS JavaScript exports are release gates.
- Live API integration displayed current market status, 277 prices, ten gainers, ten losers, company search, and current news.
- NABIL rendered a real 53-point one-year chart after the API chart-ingestion repair.
- Watchlist add and persistence worked across tabs.
- A paper BUY of 10 NABIL at Rs. 550 atomically changed cash from Rs. 1,000,000 to Rs. 994,500 and created the position; selling the same quantity restored cash and removed it.
- A manual BUY of 20 NABIL at Rs. 500 produced a Rs. 10,000 cost basis and Rs. 11,000 value at an LTP of Rs. 550. Selling 5 shares preserved the Rs. 500 average and changed the derived holding to 15 shares, Rs. 7,500 cost, and Rs. 8,250 value.

Exact commands and the repeatable manual matrix are in [TESTING.md](TESTING.md).

## Residual risks and operator decisions

These are not hidden code defects, but they block an honest statement that a store release is fully operational without founder/operator input:

1. **Signing and store ownership.** Apple/Google accounts, agreements, certificates, privacy forms, screenshots, and listing content are external to the repository.
2. **Application identity.** The founders must approve `com.lagani.app` before the first submission.
3. **Production API origin.** Release builds need a stable HTTPS API URL with CORS configured for the web origin if the Expo web build is published.
4. **Real-device background tests.** OS scheduling cannot be certified from Expo Web or a simulator. Test notifications after force-closing a preview build on representative Android and iOS versions.
5. **Data licensing and terms.** The founders must confirm that distribution and caching of NEPSE, Merolagani, and Nepalipaisa data and images complies with applicable terms and local law.
6. **No user account/cloud backup.** Personal data is local. Device loss or app deletion loses it; reinstall/restore behavior is not a synchronization guarantee.
7. **Accounting scope.** Fees, taxes, settlement, corporate actions, rights/bonus shares, and lot-specific tax basis are not modeled.
8. **Dependency advisory.** `npm audit --omit=dev` reports 14 high-severity dependency paths, all converging on Metro's `image-size` 1.2.1 asset parser and its ICNS/JXL/HEIF denial-of-service advisories. Metro processes trusted repository assets during bundling; it is not an app runtime path for remote market/news images. npm's proposed automated fix downgrades Expo incompatibly. A separate transitive UUID advisory was safely removed with a compatible override. Track a patched Expo/Metro release and update through Expo's compatibility tooling, not `npm audit fix --force`; do not accept untrusted build assets meanwhile.

## Release gate

A candidate is ready for internal preview only when all automated checks and native exports pass, the API readiness endpoint is healthy, the full manual smoke matrix passes against the release API, and no Critical/High code finding is open. A public store rollout additionally requires completion of every operator decision above and the staged rollout/rollback preparation in [DEPLOYMENT.md](DEPLOYMENT.md).
