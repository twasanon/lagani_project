# Task: Implement Stock Chart on StockDetailScreen

**Project:** Lagani - React Native Finance App

**Current Goal:** Implement a stock chart on the `StockDetailScreen.tsx` to visualize historical price data for a selected company.

**Essential Context (Frontend - React Native App):**

*   **Screen to Modify:** `app/screens/StockDetailScreen.tsx`
*   **Purpose:** Display historical price trends (OHLCV) for the stock being viewed.
*   **Charting Library:** Consider using `react-native-gifted-charts` (already a dependency) or `lightweight-charts` (currently used via `react-native-webview` for other charts, but evaluate direct integration if feasible for better performance/UX).
*   **Data Source (Backend API):** The Go backend API (`lagani_api`) provides the necessary data via the `GET /charts/{symbol}` endpoint.
*   **Styling:** Adhere to the existing theming approach using NativeWind and the centralized color palette in `src/theme/colors.ts`.

**Backend API Endpoint Details for Chart Data:**

*   **Endpoint:** `GET /charts/{symbol}`
    *   Replace `{symbol}` with the actual stock symbol (e.g., "AKJCL").
*   **Key Query Parameters to Use:**
    *   `range`: Defines the time window for the data.
        *   **Recommendation for StockDetailScreen:** Start with a default range like `"1y"` (one year). Consider making this configurable by the user later (e.g., with buttons for 1m, 6m, 1y, YTD, All).
    *   `resolution`: Defines the granularity of data points.
        *   **Recommendation for StockDetailScreen:**
            *   For initial implementation, you can either let the backend's automatic resolution logic handle this based on the chosen `range` (e.g., a "1y" range will likely default to "W" - Weekly).
            *   Or, you can explicitly request a resolution, e.g., `&resolution=D` for daily data if the chosen `range` is short enough (e.g., "1m", "3m"), or `&resolution=W` for longer ranges like "1y".
            *   The backend defaults are: `range` <= 90 days -> 'D'; 90 days < `range` <= 2 years -> 'W'; `range` > 2 years -> 'M'.
*   **Data Format (API Response):** The endpoint returns a JSON array of data points. Each point is an object:
    ```json
    [
      {
        "t": 1672531200, // Unix timestamp (seconds, UTC) - Represents the start of the period
        "o": 150.0,      // Open price
        "h": 155.0,      // High price
        "l": 148.0,      // Low price
        "c": 152.5,      // Close price
        "v": 123450.0    // Volume
      },
      // ... more data points
    ]
    ```
*   **Timestamp Handling:**
    *   The `t` value is a **Unix timestamp in seconds, UTC**.
    *   Your charting library will likely require this to be converted to milliseconds (`timestamp * 1000`) and then possibly to a `Date` object, or it might handle Unix timestamps directly. Ensure the chart displays dates correctly based on the user's local timezone or consistently in UTC. The data itself is anchored to UTC moments.

**Frontend Implementation Steps:**

1.  **API Integration (`src/api/nepseScraper.ts` or a new chart-specific API file):**
    *   Create a new function (e.g., `fetchStockChartData(symbol: string, range: string, resolution?: string)`).
    *   This function should call the backend endpoint: `GET /charts/{symbol}?range={range}&resolution={resolution}`.
    *   Handle the API response, including potential errors.

2.  **Data Fetching in `StockDetailScreen.tsx`:**
    *   When the screen mounts or the symbol changes, call the new API function to fetch chart data.
    *   Use a default `range` (e.g., "1y"). You can decide whether to specify a `resolution` or let the backend auto-select.
    *   Manage loading and error states while fetching data.

3.  **Data Transformation (if needed):**
    *   The API returns timestamps in seconds. Convert them to milliseconds (`timestamp * 1000`) if your chosen charting library requires it.
    *   Format the data into the structure expected by the charting library (e.g., some libraries want `{ time: ..., open: ..., high: ..., low: ..., close: ... }` or `{ x: ..., y: ... }` for line charts, or specific candlestick formats).

4.  **Chart Rendering (`StockDetailScreen.tsx`):**
    *   Integrate your chosen charting library (`react-native-gifted-charts` or an alternative).
    *   Pass the fetched and transformed historical price data to the chart component.
    *   Configure the chart type (candlestick is highly recommended for OHLCV data, or a line chart for close prices if simpler initially).
    *   Style the chart to match the app's theme (`src/theme/colors.ts`).
    *   Ensure appropriate axis formatting (dates on the x-axis, prices on the y-axis).
    *   Implement basic interactivity if supported by the library (e.g., tooltips showing OHLCV for a selected point).

5.  **UI/UX Considerations:**
    *   Display a loading indicator while the chart data is being fetched.
    *   Show an appropriate message if no chart data is available or if an error occurs.
    *   **(Future Enhancement)** Add UI elements (e.g., buttons, a segmented control) to allow the user to select different time ranges (1m, 6m, 1Y, YTD, All) and possibly resolutions, which would then re-fetch the data with new parameters.

**Key Focus for this Task:**

*   Successfully fetch historical data from the `GET /charts/{symbol}` backend endpoint.
*   Correctly process the timestamps and OHLCV data.
*   Render a basic, correctly formatted chart (candlestick or line) on the `StockDetailScreen.tsx`.
*   Ensure the chart is visually consistent with the app's theme. 