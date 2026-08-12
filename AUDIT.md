# Consolidated Lagani audit

**Audit period:** August 12, 2026  
**Scope:** Go market-data API, Expo application, Next.js public website, data/logic correctness, security, test coverage, CI, container/runtime configuration, documentation, and cross-project deployment  
**Current assessment:** code and artifacts are staging-ready; public production launch remains conditionally blocked by explicit external gates

## Executive summary

The initial repository contained a promising functional prototype but had correctness and operational risks that would have been dangerous in a financial-context product. The API used stale/incorrect source assumptions, could lose related cache rows through SQLite replacement behavior, had weak scheduling/auth/deployment controls, and did not adequately validate historical/chart anomalies. The app mixed legacy API assumptions with fragile local transaction logic and navigation/UI defects. The website contained dead links, invalid interactive HTML, overstated real-time claims, a critically vulnerable framework version, and no legal/deployment path.

Those code-level blockers were repaired and tested. The system now has explicit source adapters, runtime validation, transactionally correct portfolio/paper ledgers, live NEPSE-specific regression coverage, a truthful static website, fail-closed administration, component CI, reproducible containers/bundles, and detailed operating documentation.

This report does not claim that scraped third-party market data is authoritative or licensed, that local simulations predict execution, or that passing tests completes legal/store/operations work.

## Highest-impact repairs

### API and NEPSE logic

- Reimplemented current NEPSE authentication/prove and graph request behavior.
- Replaced a broken Nepalipaisa HTML assumption with the current JSON news path.
- Corrected company UPSERT behavior so refreshes cannot cascade-delete price/chart history.
- Made SQLite migrations transactional and compatible with the early historical table layout.
- Serialized the SQLite pool, enabled WAL/foreign keys/busy timeout, and gated concurrent long jobs.
- Added protected admin triggers that fail closed without a secret, input validation, readiness, graceful shutdown, configurable source URLs/schedules, Kathmandu timezone, and single-leader controls.
- Corrected Sunday-based NEPSE weekly aggregation, chart range overlap, monthly alignment, mover snapshot replacement, empty-array behavior, and cache/freshness headers.
- Derived a missing previous close from valid LTP/percentage data rather than exposing impossible zero/change combinations.
- Repaired adjusted OHLC bounds while rejecting nonpositive/nonfinite price rows, invalid timestamps, and negative volume.
- Added extensive repository, scheduler, scraper, handler, race, container, and live-source coverage.

### Mobile data and financial logic

- Replaced duplicate/legacy network layers with one validated API adapter and strict runtime DTO parsers.
- Added a versioned SQLite schema and serialized transaction mechanism.
- Made paper buy/sell cash, position, and history changes atomic.
- Implemented moving-average portfolio cost basis with proportional basis reduction on sells.
- Made a full market refresh commit atomically rather than mixing partially refreshed datasets.
- Added request timeouts, refresh deduplication/throttling, persisted freshness time, and correct empty/error behavior.
- Repaired charts, stock details, news dates/sources, watchlists, alerts, portfolio/paper layouts, navigation, modals, accessibility, and Expo web database startup.
- Migrated to Expo SDK 57/CNG with final bundle identifiers, EAS profiles, Android/iOS export checks, CI, and detailed documentation.

### Website, claims, and public surface

- Upgraded from critically vulnerable Next.js 15.3.0 to 16.3.0; removed unused UI/animation dependency surface.
- Replaced fake/static ticker implications and “real-time data” claims with latest-available, source/freshness-aware language.
- Replaced `#` links and nested anchor/button markup with verified links or non-interactive release states.
- Added real privacy/terms pages, canonical metadata, sitemap, robots, responsive semantic layout, product screenshots, and accessibility behavior.
- Added CSP and security headers, full static smoke assertions, zero-vulnerability dependency tree, component CI, and an unprivileged production container.

### Repository operations

- Preserved one root Git history and added component-path CI workflows.
- Added root architecture, contract, audit, test, and ordered deployment documentation.
- Added safe-by-default Compose topology and root verification targets.
- Defined ownership/freshness boundaries so personal portfolio data cannot silently drift into the backend.

## Final verification evidence

| Area | Evidence | Result |
| --- | --- | --- |
| API deterministic | `go test ./...` | Pass |
| API static analysis | `go vet ./...` | Pass |
| API concurrency | `go test -race ./...` | Pass; macOS linker emitted only known Wasmer/CGO symbol-table warnings |
| API live charts | integration-tag NABIL + NMB50 | Pass; 225 and 1,289 usable points respectively |
| API prior live full-source pass | NEPSE core, historical, charts, two news sources | Pass; 411 companies and 277 active price rows observed during audit |
| API container | Linux AMD64 build, non-root start, health/readiness/admin-disabled smoke | Pass |
| Mobile type/tests | strict TypeScript + Vitest | Pass; 9/9 tests |
| Mobile config | Expo Doctor | Pass; 20/20 checks |
| Mobile bundles | Expo Android + iOS exports | Pass; Hermes bundles generated |
| Mobile workflow | live phone-sized browser validation against populated API | Pass for home/detail/chart/watchlist/news/paper/portfolio/settings/help |
| Website deterministic | lint + typecheck + build + generated HTML smoke | Pass; six static routes including metadata/legal |
| Website security | full and production npm audits | Pass; zero known vulnerabilities at audit time |
| Website container | non-root runtime, all routes, 404, sitemap, headers | Pass |
| Website UI | 1440 × 1000 and 390 × 844 Chromium | Pass; no overflow or console warnings/errors |
| Compose definition | environment interpolation/config validation | Pass |
| Git whitespace | `git diff --check` | Pass |

Live provider results are point-in-time compatibility evidence, not a guarantee that an upstream website/API will remain unchanged.

## Residual risks and launch gates

### P0 before public production

1. **Data-source rights and continuity.** Confirm permitted commercial use, attribution, redistribution, caching, and request rates for NEPSE, Merolagani, Nepalipaisa, and linked news assets. Identify an owner and fallback for source changes.
2. **Qualified legal review.** Review entity identification, Nepal financial/consumer law, privacy, terms, disclaimers, age/jurisdiction, app-store disclosures, and liability text.
3. **Production infrastructure.** Provision HTTPS API, persistent encrypted volume, automated tested backups, monitoring, log retention, alerting, incident ownership, and a secret-manager admin key.
4. **Real devices and stores.** Test signed builds on supported physical iOS/Android devices, notifications/background behavior, offline/stale data, upgrades, store privacy forms, and final listing ownership.
5. **Canonical public identity.** Supply production domains, monitored support/privacy mailbox, legal owner, and correct published store links.

### P1 before or immediately after limited beta

6. **Expo/Metro advisory.** `npm audit --omit=dev` reports 14 high paths, all through Metro's build-time `image-size` parser for ICNS/JXL/HEIF denial of service. Builds currently accept only trusted repository assets; track and adopt the first compatible patched Expo/Metro chain. Do not force npm's incompatible downgrade.
7. **API architecture ceiling.** Keep exactly one scheduler/writer replica with one durable SQLite volume. A second independent replica would diverge and duplicate ingestion.
8. **ARM64 API container.** The current Wasmer-Go packaged library path is Linux AMD64. Choose AMD64 hosting or replace/test the auth runtime for ARM64.
9. **Source canaries.** Run live integration tests on a schedule with notification on failure and dashboards for last successful ingest per dataset.
10. **Screenshot truth.** Replace website product images with captures from the exact signed release and ensure sample figures cannot be mistaken for current market data.

### Accepted product limitations requiring clear communication

- Prices/status/news can be delayed, stale, incomplete, adjusted, or unavailable.
- Paper trades omit order-book execution, taxes, fees, settlement, liquidity, and corporate-action detail.
- Local notifications/background tasks are best effort and cannot be used as stop-loss/risk controls.
- Local-only portfolio records do not automatically sync or restore across devices unless device backup behavior happens to include them.
- The app is not a broker or authoritative accounting/tax record.

## Release readiness by component

| Component | Code/build readiness | Production condition |
| --- | --- | --- |
| API | Ready for staging and a controlled single-replica deployment | Needs secrets, durable volume/backups, source permission, monitoring, TLS, live canary |
| Mobile | Ready for preview/internal signed builds | Needs production API URL, physical-device/background tests, signing/store/legal work, advisory tracking |
| Website | Ready for staging/production infrastructure | Needs final domain/contact/store URLs, legal review, release screenshots, production-domain QA |
| Whole system | Contracts and safe deployment order documented | Needs founders to close the external gates above and complete a limited rollout |

## Recommendation

Proceed to a private staging environment and internal/closed beta, not an unmonitored public launch. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) in order: deploy and populate the API, validate the mobile release against it, publish the reviewed website/legal surface, then perform a limited rollout with rollback artifacts and active monitoring.
