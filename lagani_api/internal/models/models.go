package models

import (
	"time"
)

// Company represents a stock listed on NEPSE.
type Company struct {
	ID         int       `json:"-"`          // Internal DB ID (optional if symbol is PK)
	Symbol     string    `json:"symbol"`     // Stock Symbol (Primary Key)
	Name       string    `json:"name"`       // Full Company Name
	SecurityID int       `json:"securityId"` // NEPSE Security ID (Added)
	UpdatedAt  time.Time `json:"updatedAt"`  // Timestamp of the last update from source
}

// Price represents the latest price statistics for a company.
type Price struct {
	Symbol          string    `json:"symbol"`       // Stock Symbol (Primary Key)
	SecurityName    string    `json:"securityName"` // Name associated with the price stat
	OpenPrice       float64   `json:"openPrice"`
	HighPrice       float64   `json:"highPrice"`
	LowPrice        float64   `json:"lowPrice"`
	LastTradedPrice float64   `json:"lastTradedPrice"`
	PreviousClose   float64   `json:"previousClose"`
	Change          float64   `json:"change"` // LTP - PreviousClose
	PercentChange   float64   `json:"percentChange"`
	TotalTradeVol   int64     `json:"totalTradeVolume"`
	UpdatedAt       time.Time `json:"updatedAt"` // Timestamp of the last update from source
}

// Mover represents a top gainer or loser for the day.
type Mover struct {
	ID            int       `json:"-"`    // Internal DB ID
	Type          string    `json:"type"` // "gainer" or "loser"
	Rank          int       `json:"rank"` // Rank within the type (1-10)
	Symbol        string    `json:"symbol"`
	SecurityName  string    `json:"securityName"`
	LTP           float64   `json:"ltp"`
	PointChange   float64   `json:"pointChange"`
	PercentChange float64   `json:"percentageChange"`
	UpdatedAt     time.Time `json:"updatedAt"` // Timestamp when this mover list was fetched
}

// MarketStatus represents the current NEPSE market status.
// This will likely be stored as a single row in the DB.
type MarketStatus struct {
	ID        int        `json:"-"`         // Fixed ID (e.g., 1) for single-row table
	Status    string     `json:"status"`    // e.g., "OPEN", "CLOSE", "PRE_OPEN_CLOSE"
	AsOf      *time.Time `json:"asOf"`      // Timestamp from NEPSE, normalized to UTC
	UpdatedAt time.Time  `json:"updatedAt"` // Timestamp when the status was fetched
}

// NewsItem represents a single news article.
type NewsItem struct {
	ID          int        `json:"id"`                    // Internal DB ID
	Source      string     `json:"source"`                // e.g., "merolagani", "nepalipaisa"
	Title       string     `json:"title"`                 // News headline
	Link        string     `json:"link"`                  // URL to the full article
	ImageURL    string     `json:"imageUrl"`              // URL of the associated image
	DateStr     string     `json:"dateStr"`               // Date string as scraped (might be empty)
	PublishedAt *time.Time `json:"publishedAt,omitempty"` // Parsed and standardized datetime
	ScrapedAt   time.Time  `json:"scrapedAt"`             // Timestamp when the item was scraped
}

// HistoricalPriceData represents a single day's price data from NEPSE graph endpoint.
// Note: Fields match the NEPSE API response structure.
type HistoricalPriceData struct {
	BusinessDate          string  `json:"businessDate"`
	OpenPrice             float64 `json:"openPrice"`
	HighPrice             float64 `json:"highPrice"`
	LowPrice              float64 `json:"lowPrice"`
	ClosePrice            float64 `json:"closePrice"`
	PreviousDayClosePrice float64 `json:"previousDayClosePrice"`
	TotalTradedQuantity   int64   `json:"totalTradedQuantity"`
	LastTradedPrice       float64 `json:"lastTradedPrice"`
	FiftyTwoWeekHigh      float64 `json:"fiftyTwoWeekHigh"`
	// Add other fields if needed, e.g., fiftyTwoWeekLow
}
