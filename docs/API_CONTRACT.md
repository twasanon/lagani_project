# Lagani public API contract

This document is the integration contract between `lagani_api` and the current Expo app. It supplements handler tests and mobile runtime parser tests. The public marketing website does not consume this API.

## 1. Transport and compatibility

- Production transport is HTTPS.
- Base URL has no trailing endpoint path; the app appends root routes such as `/prices`.
- Responses are UTF-8 JSON except `/ping`.
- Collection routes return `[]`, never `null`.
- Errors use `{"error":"Human-readable message"}` with an appropriate 4xx/5xx status.
- Ordinary timestamps are RFC 3339 UTC strings. Chart `t` is Unix seconds UTC.
- Symbols are canonical uppercase ASCII letters/digits, one to sixteen characters on chart paths.
- Additive object fields are backward-compatible because the app ignores unknown fields.
- Removing/renaming a required field or changing its type is breaking and must follow the staged release process in the root architecture/testing docs.
- Public GETs can be cached according to `Cache-Control`; clients must not infer that a 200 response is exchange-live.

The mobile adapter applies a 15-second request timeout and validates every required field at runtime before committing a full market snapshot.

## 2. Operational routes

### `GET /healthz`

Liveness only:

```json
{"status":"ok"}
```

It does not prove that SQLite, upstream sources, or cached data are ready.

### `GET /readyz`

Pings SQLite:

```json
{"status":"ready"}
```

It does not prove that initial ingestion has populated all datasets. Deployment health must separately monitor data age and counts.

### `GET /ping`

Minimal framework heartbeat, primarily for diagnostics.

## 3. Market snapshot routes

The mobile full refresh requests companies, prices, gainers, losers, status, and news concurrently. It commits the resulting snapshot only after every response parses successfully. One failing dataset must not create a half-new local snapshot.

### `GET /companies`

```json
[
  {
    "symbol": "NABIL",
    "name": "Nabil Bank Limited",
    "securityId": 131,
    "updatedAt": "2026-08-12T09:15:00Z"
  }
]
```

| Field | Type | Meaning |
| --- | --- | --- |
| `symbol` | string | Canonical NEPSE symbol; mobile normalizes uppercase |
| `name` | string | Display name from the source |
| `securityId` | finite number/integer | Positive NEPSE identifier used by historical graph data |
| `updatedAt` | RFC 3339 string | When this row was last ingested |

### `GET /prices`

```json
[
  {
    "symbol": "NABIL",
    "securityName": "Nabil Bank Limited",
    "openPrice": 548.0,
    "highPrice": 556.0,
    "lowPrice": 547.0,
    "lastTradedPrice": 550.0,
    "previousClose": 545.0,
    "change": 5.0,
    "percentChange": 0.9174,
    "totalTradeVolume": 26088,
    "updatedAt": "2026-08-12T09:15:00Z"
  }
]
```

All numeric fields must be finite. For a normal active price row, OHLC/LTP/previous close are expected positive and volume nonnegative. `change` means `lastTradedPrice - previousClose`; rounding can prevent exact binary equality with the percentage field.

When NEPSE omits previous close but provides a usable LTP and percentage, the API derives:

```text
previousClose = lastTradedPrice / (1 + percentChange / 100)
change        = lastTradedPrice - previousClose
```

The app must not treat `updatedAt` as a guarantee that the trade itself happened at that exact moment; it is ingestion freshness.

### `GET /market-status`

```json
{
  "status": "CLOSE",
  "asOf": "2026-08-12T09:15:00Z",
  "updatedAt": "2026-08-12T09:15:03Z"
}
```

`asOf` can be `null` when the source does not provide a parseable time. `updatedAt` is required. Before the first successful status ingestion, the route returns 404 rather than inventing a closed/open state. Clients normalize status uppercase and should display unknown nonempty future values conservatively.

### `GET /top-gainers` and `GET /top-losers`

```json
[
  {
    "type": "gainer",
    "rank": 1,
    "symbol": "EXAMPLE",
    "securityName": "Example Limited",
    "ltp": 345.0,
    "pointChange": 45.0,
    "percentageChange": 15.0,
    "updatedAt": "2026-08-12T09:15:00Z"
  }
]
```

`type` is exactly `gainer` or `loser` for its route. Rank begins at one and the snapshot contains at most ten rows. The API replaces each latest snapshot atomically enough that old ranked rows do not remain. Clients must use `percentageChange` here; `/prices` uses `percentChange`—the distinction is historical but part of the current contract.

### `GET /news?limit=50`

`limit` defaults to 50 and must be an integer from 1 through 100.

```json
[
  {
    "id": 123,
    "source": "nepalipaisa",
    "title": "Market headline",
    "link": "https://www.nepalipaisa.com/news-detail/123",
    "imageUrl": "https://example.invalid/image.jpg",
    "dateStr": "12 August 2026, Wednesday",
    "publishedAt": "2026-08-12T09:37:57.873Z",
    "scrapedAt": "2026-08-12T09:40:00Z"
  }
]
```

`id` can be absent in parser fixtures but the API normally returns it. `publishedAt` can be absent/null if source text cannot be standardized; `dateStr` preserves source display text and `scrapedAt` is required. Links/images point to third parties and are not controlled or endorsed by Lagani. UI should show attribution and handle missing/broken images.

## 4. Chart routes

### `GET /charts/{symbol}`

Query parameters:

| Parameter | Values | Default |
| --- | --- | --- |
| `range` | `1d`, `1w`, `1m`, `3m`, `6m`, `ytd`, `1y`, `5y`, `all` | `1y` |
| `resolution` | `D`, `W`, `M` (case normalized) | D ≤90 days, W through 2 years, M beyond |

Response headers include `X-Chart-Resolution` and `X-Data-Source: merolagani`.

```json
[
  {"t":1786406400,"o":550.0,"h":556.0,"l":549.0,"c":551.0,"v":26088.0}
]
```

Contract invariants:

- points are chronological;
- timestamps are positive Unix seconds;
- OHLC are finite and positive;
- `high >= max(open, close)` and `low <= min(open, close)`;
- volume is finite and nonnegative;
- daily data is source-adjusted and validated;
- weekly buckets start Sunday; monthly buckets start on day one;
- `range=1d` returns the latest available trading candle, not necessarily today's calendar date; and
- no data is 200 with `[]`, while an unknown company is 404.

Provider rows with invalid timestamps, nonpositive/nonfinite OHLC, or negative/nonfinite volume are not stored. Adjusted rows with valid open/close but inconsistent high/low are normalized by expanding the bounds.

### `GET /historical-price/{securityId}`

Returns NEPSE graph records for a positive numeric ID. This route is not currently used by the primary mobile chart path but is kept as a normalized public dataset.

```json
[
  {
    "businessDate": "2026-08-12",
    "openPrice": 548.0,
    "highPrice": 556.0,
    "lowPrice": 547.0,
    "closePrice": 550.0,
    "previousDayClosePrice": 545.0,
    "totalTradedQuantity": 26088,
    "lastTradedPrice": 550.0,
    "fiftyTwoWeekHigh": 620.0
  }
]
```

An unknown/no-history ID is 404. Invalid/nonpositive path input is 400.

## 5. Admin contract

Admin endpoints are for operators only:

- `POST /admin/update-prices`
- `POST /admin/update-historical-data`
- `POST /admin/update-chart-data`
- `POST /admin/update-all-data`

Authorization is `X-Admin-Key: <secret>` or `Authorization: Bearer <secret>`. The key must never be compiled into a client. No configured key returns 503; missing/wrong key returns 401. Accepted work returns 202 with a message. Conflicting work returns 409. The response means “queued/started,” not “ingestion succeeded”; operators must inspect job completion/freshness.

## 6. Cache and freshness behavior

Indicative response policies:

| Dataset | Public max age | Stale-if-error intent |
| --- | --- | --- |
| companies | 5 minutes | 1 hour |
| prices/status | 15 seconds | 5 minutes |
| movers | 30 seconds | 5 minutes |
| news | 2 minutes | 1 hour |
| historical | 15 minutes | 1 day |
| charts | 5 minutes | 1 day |

Edge caches may serve within those directives. The mobile app separately stores the last successful snapshot and records its local refresh time. UI freshness must use available source/API timestamps plus market status; it must not label a cache hit as live.

## 7. Failure contract

- Timeout/network/5xx: mobile keeps prior local data and surfaces refresh failure; it does not clear the cache.
- Invalid JSON/field: parser rejects the affected full refresh; no partial snapshot commit.
- Empty collection: valid initial/no-data state, rendered honestly.
- Status 404 before ingestion: unavailable/unknown state, not forced `CLOSE`.
- Chart empty: show “no chart data” rather than a flat fabricated series.
- News broken destination/image: degrade the card/image; do not rewrite to an unverified destination.

## 8. Contract change checklist

For every change, update Go JSON tags/handlers and tests, this document, mobile TypeScript types/runtime parsers and fixtures, cache migration if stored shape changes, UI states, and API/mobile release ordering. Add fields before using them and retain the old field until installed public versions no longer depend on it.
