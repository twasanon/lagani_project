# Mobile follow-up backlog

The audited baseline is defined by [AUDIT.md](AUDIT.md). The items below are deliberate product or operational follow-ups, not silently unfinished versions of advertised features.

## Required before public store rollout

- [ ] Founders approve `com.lagani.app`, Expo organization, and store ownership.
- [ ] Production HTTPS API is deployed and configured in EAS.
- [ ] Market/news data distribution terms and attributions receive legal review.
- [ ] Privacy policy, support URL, store declarations, screenshots, and listing copy are approved.
- [ ] Full preview-build matrix passes on physical iOS and Android devices.
- [ ] Background alert behavior is observed on representative OS versions and documented as best-effort.
- [ ] Remaining Expo/Metro/RN npm advisories are reviewed against current upstream releases.

## Product decisions

- [ ] Decide whether personal portfolios need authenticated cloud backup/sync.
- [ ] Define a fee/tax/corporate-action model before calling the ledger tax-accurate.
- [ ] Decide whether fractional units are needed for funds or whether whole shares remain universal.
- [ ] Define telemetry and crash-reporting consent before adding an analytics SDK.
- [ ] Decide whether the Expo web client will ever be public or remain a development preview.

## Enhancements

- [ ] Add candlestick rendering using the already supplied OHLC chart contract.
- [ ] Add explicit stale-data timestamps throughout market screens.
- [ ] Add integration tests around the SQLite repository on native CI infrastructure.
- [ ] Add screenshot regression coverage for small phones and large accessibility text.
- [ ] Add localization only after English and Nepali terminology/content ownership is defined.
- [ ] Add onboarding for data delay, local-only storage, and paper-trading limitations.
