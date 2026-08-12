package database

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	// Needed for time.Now() if we were setting a scraped_at timestamp
	"lagani_api/internal/models"
)

// HistoricalPriceRepository handles database operations for historical prices.
type HistoricalPriceRepository struct {
	db *sql.DB
}

// NewHistoricalPriceRepository creates a new HistoricalPriceRepository.
func NewHistoricalPriceRepository(db *sql.DB) *HistoricalPriceRepository {
	return &HistoricalPriceRepository{db: db}
}

// SaveHistoricalPrices saves a batch of historical price data points for a specific security ID.
// It uses INSERT OR IGNORE to avoid duplicates based on the unique constraint (security_id, business_date).
func (r *HistoricalPriceRepository) SaveHistoricalPrices(securityID int, prices []models.HistoricalPriceData) error {
	if len(prices) == 0 {
		return nil // Nothing to save
	}

	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin historical price transaction: %w", err)
	}
	defer tx.Rollback() // Rollback if commit fails

	// Upsert because NEPSE can revise the latest trading day's values after an
	// initial intraday response has already been cached.
	sqlStr := `
		INSERT INTO historical_prices (
			security_id, business_date, open_price, high_price, low_price,
			close_price, previous_day_close_price, total_traded_quantity,
			last_traded_price, fifty_two_week_high, scraped_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(security_id, business_date) DO UPDATE SET
			open_price = excluded.open_price,
			high_price = excluded.high_price,
			low_price = excluded.low_price,
			close_price = excluded.close_price,
			previous_day_close_price = excluded.previous_day_close_price,
			total_traded_quantity = excluded.total_traded_quantity,
			last_traded_price = excluded.last_traded_price,
			fifty_two_week_high = excluded.fifty_two_week_high,
			scraped_at = excluded.scraped_at;
	`
	stmt, err := tx.Prepare(sqlStr)
	if err != nil {
		return fmt.Errorf("failed to prepare historical price insert statement: %w", err)
	}
	defer stmt.Close()

	now := time.Now().UTC()
	for _, price := range prices {
		price.BusinessDate = strings.TrimSpace(price.BusinessDate)
		if price.BusinessDate == "" {
			return fmt.Errorf("historical price for security ID %d has an empty business date", securityID)
		}
		if price.HighPrice < price.LowPrice || price.OpenPrice < 0 || price.ClosePrice < 0 || price.TotalTradedQuantity < 0 {
			return fmt.Errorf("historical price for security ID %d on %s contains invalid OHLCV values", securityID, price.BusinessDate)
		}
		_, err := stmt.Exec(
			securityID,
			price.BusinessDate,
			price.OpenPrice,
			price.HighPrice,
			price.LowPrice,
			price.ClosePrice,
			price.PreviousDayClosePrice,
			price.TotalTradedQuantity,
			price.LastTradedPrice,
			price.FiftyTwoWeekHigh,
			now,
		)
		if err != nil {
			return fmt.Errorf("failed to execute historical price insert for ID %d, Date %s: %w", securityID, price.BusinessDate, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit historical price transaction for ID %d: %w", securityID, err)
	}

	return nil
}

// GetHistoricalPricesBySecurityID retrieves all historical price data for a given security ID,
// ordered by business date descending.
func (r *HistoricalPriceRepository) GetHistoricalPricesBySecurityID(securityID int) ([]models.HistoricalPriceData, error) {
	query := `
		SELECT
			business_date, open_price, high_price, low_price, close_price,
			previous_day_close_price, total_traded_quantity, last_traded_price,
			fifty_two_week_high
		FROM historical_prices
		WHERE security_id = ?
		ORDER BY business_date DESC
	`
	rows, err := r.db.Query(query, securityID)
	if err != nil {
		return nil, fmt.Errorf("failed to query historical prices for ID %d: %w", securityID, err)
	}
	defer rows.Close()

	prices := make([]models.HistoricalPriceData, 0)
	for rows.Next() {
		var p models.HistoricalPriceData
		err := rows.Scan(
			&p.BusinessDate,
			&p.OpenPrice,
			&p.HighPrice,
			&p.LowPrice,
			&p.ClosePrice,
			&p.PreviousDayClosePrice,
			&p.TotalTradedQuantity,
			&p.LastTradedPrice,
			&p.FiftyTwoWeekHigh,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan historical price row for ID %d: %w", securityID, err)
		}
		prices = append(prices, p)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during historical price rows iteration for ID %d: %w", securityID, err)
	}

	return prices, nil
}
