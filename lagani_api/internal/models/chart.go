package models

// ChartDataPoint represents a single OHLCV data point for a chart.
// JSON tags (t, o, h, l, c, v) are chosen to be compact and commonly used
// by charting libraries, aligning with typical API responses for such data.
type ChartDataPoint struct {
	Timestamp int64   `json:"t"` // Unix timestamp (seconds), representing the start of the period (e.g., date for daily)
	Open      float64 `json:"o"`
	High      float64 `json:"h"`
	Low       float64 `json:"l"`
	Close     float64 `json:"c"`
	Volume    float64 `json:"v"`
}
