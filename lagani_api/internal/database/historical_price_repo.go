package database

import (
	"database/sql"
	"fmt"
	"log"

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

	// Use INSERT OR IGNORE to skip rows that would violate the unique constraint.
	sqlStr := `
		INSERT OR IGNORE INTO historical_prices (
			security_id, business_date, open_price, high_price, low_price,
			close_price, previous_day_close_price, total_traded_quantity,
			last_traded_price, fifty_two_week_high
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	stmt, err := tx.Prepare(sqlStr)
	if err != nil {
		return fmt.Errorf("failed to prepare historical price insert statement: %w", err)
	}
	defer stmt.Close()

	rowsAffected := 0
	for _, price := range prices {
		res, err := stmt.Exec(
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
		)
		if err != nil {
			// Log the specific price data causing the error
			log.Printf("[ERROR] Failed to execute historical price insert for ID %d, Date %s: %v", securityID, price.BusinessDate, err)
			// Continue trying to insert others? Or fail the whole batch?
			// For now, fail the whole batch on first error.
			return fmt.Errorf("failed to execute historical price insert for ID %d, Date %s: %w", securityID, price.BusinessDate, err)
		}
		// Check how many rows were actually inserted (will be 0 if ignored)
		if count, err := res.RowsAffected(); err == nil {
			rowsAffected += int(count)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit historical price transaction for ID %d: %w", securityID, err)
	}

	log.Printf("Historical Prices for ID %d: Processed %d data points, inserted %d new rows.", securityID, len(prices), rowsAffected)
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

	var prices []models.HistoricalPriceData
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
			log.Printf("[ERROR] Failed to scan historical price row for ID %d: %v", securityID, err)
			continue // Skip problematic rows
		}
		prices = append(prices, p)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during historical price rows iteration for ID %d: %w", securityID, err)
	}

	return prices, nil
}
