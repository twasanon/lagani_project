# UPDATES.md — Post-Audit Remediation Log

**Date:** 2026-08-23 · **Source audit:** `Project_Audit_Hub/reports/lagani/`

## Fixed

### LAGANI-001 (HIGH) — Mobile CI red since 2026-08-12 → **GREEN**

Root cause was *not* a stale lockfile but an **npm version skew**:

1. `lagani/package.json` pins an override `uuid@<11.1.1 → 11.1.1` (neutralizing
   `xcode@3.0.1`'s vulnerable `uuid@^7.0.3` dep). npm 11 records override-resolved
   trees fine; **npm 10 (the Node 22 CI runner) cannot reconcile them** and fails
   `npm ci` with `Missing: uuid@7.0.3 from lock file`.
2. **Commit `d47ba79`** — bumped `lagani-mobile.yml` from `node-version: 22` to `24`
   so CI runs npm 11 (verified locally: `npm ci --dry-run` exit 0).
   This surfaced a second, latent failure.
3. **Commit `8c23953`** — `npm run verify` then failed on 7 Expo SDK packages behind
   their expected SDK-57 patches (`expo ~57.0.15`, `expo-image`, `expo-notifications`,
   `expo-splash-screen`, `expo-task-manager`, `expo-background-task`,
   `@expo/metro-runtime`). Applied via `npx expo install --fix`; adds the
   `expo-image` config plugin to `app.json`. `expo-doctor`: **21/21 checks pass**.
4. **Verified:** "Lagani mobile" workflow → ✅ success on commit `8c23953`
   (website & API workflows unaffected and still green).

## Deferred (documented, intentionally not done)

| Finding | Why deferred | Suggested approach |
|---|---|---|
| LAGANI-002/003 — unmaintained `wasmer-go` v1.0.4 + opaque committed `css.wasm` on the price-ingestion path | Architectural decision; swapping WASM runtimes risks breaking ingestion | Evaluate `wazero` (pure-Go, no cgo) or pin + monitor upstream; document what `css.wasm` computes |
| LAGANI-004 — empty-DB silent serving / no data-freshness signal | Needs product input on where freshness belongs (health endpoint vs UI badge) | Expose `max(scraped_at)` per table on `/health`; render "data as of X" in clients |

## Left untouched (pre-existing)

- Uncommitted `lagani_api/go.mod` modification and `.DS_Store` churn — present before
  remediation began; presumed your in-flight work. Not staged or reverted.
