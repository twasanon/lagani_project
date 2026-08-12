package database

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"lagani_api/internal/models"

	_ "github.com/mattn/go-sqlite3" // Ensure driver is imported
)

// PriceRepository defines methods for interacting with price data.
type PriceRepository struct {
	DB *sql.DB
}

// NewPriceRepository creates a new PriceRepository.
func NewPriceRepository(db *sql.DB) *PriceRepository {
	return &PriceRepository{DB: db}
}

// SavePrices inserts or updates multiple price records in the database within a transaction.
func (r *PriceRepository) SavePrices(prices []models.Price) error {
	if len(prices) == 0 {
		log.Println("No prices provided to save.")
		return nil
	}
	log.Printf("Saving %d price records to database...", len(prices))

	tx, err := r.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction for prices: %w", err)
	}
	defer tx.Rollback() // Rollback if anything fails

	// Prepare the UPSERT statement for prices
	stmt, err := tx.Prepare(`
		INSERT INTO prices (
			symbol, security_name, open_price, high_price, low_price,
			last_traded_price, previous_close, change, percent_change,
			total_trade_volume, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(symbol) DO UPDATE SET
			security_name = excluded.security_name,
			open_price = excluded.open_price,
			high_price = excluded.high_price,
			low_price = excluded.low_price,
			last_traded_price = excluded.last_traded_price,
			previous_close = excluded.previous_close,
			change = excluded.change,
			percent_change = excluded.percent_change,
			total_trade_volume = excluded.total_trade_volume,
			updated_at = excluded.updated_at;
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare price upsert statement: %w", err)
	}
	defer stmt.Close()

	now := time.Now().UTC()
	for _, price := range prices {
		price.Symbol = strings.ToUpper(strings.TrimSpace(price.Symbol))
		price.SecurityName = strings.TrimSpace(price.SecurityName)
		if price.Symbol == "" || price.HighPrice < price.LowPrice || price.OpenPrice < 0 || price.LastTradedPrice < 0 || price.TotalTradeVol < 0 ||
			math.IsNaN(price.LastTradedPrice) || math.IsInf(price.LastTradedPrice, 0) {
			return fmt.Errorf("invalid price record for symbol %q", price.Symbol)
		}
		_, err := stmt.Exec(
			price.Symbol, price.SecurityName, price.OpenPrice, price.HighPrice, price.LowPrice,
			price.LastTradedPrice, price.PreviousClose, price.Change, price.PercentChange,
			price.TotalTradeVol, now,
		)
		if err != nil {
			log.Printf("Error executing upsert for price %s: %v", price.Symbol, err)
			return fmt.Errorf("failed to execute upsert for price %s: %w", price.Symbol, err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit price transaction: %w", err)
	}

	log.Printf("Successfully saved %d price records.", len(prices))
	return nil
}

// GetAllLatestPrices retrieves all price records from the database.
func (r *PriceRepository) GetAllLatestPrices() ([]models.Price, error) {
	log.Println("Fetching all latest prices from database...")
	query := `
		SELECT symbol, security_name, open_price, high_price, low_price,
		       last_traded_price, previous_close, change, percent_change,
		       total_trade_volume, updated_at
		FROM prices
		ORDER BY symbol;
	`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query all prices: %w", err)
	}
	defer rows.Close()

	prices := make([]models.Price, 0)
	for rows.Next() {
		var p models.Price
		err := rows.Scan(
			&p.Symbol, &p.SecurityName, &p.OpenPrice, &p.HighPrice, &p.LowPrice,
			&p.LastTradedPrice, &p.PreviousClose, &p.Change, &p.PercentChange,
			&p.TotalTradeVol, &p.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan price row: %w", err)
		}
		prices = append(prices, p)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during price rows iteration: %w", err)
	}

	log.Printf("Fetched %d price records.", len(prices))
	return prices, nil
}

// GetPricesBySymbols retrieves the latest price data for a specific list of symbols.
func (r *PriceRepository) GetPricesBySymbols(symbols []string) (map[string]models.Price, error) {
	if len(symbols) == 0 {
		return make(map[string]models.Price), nil
	}
	log.Printf("Fetching prices for %d symbols from database...", len(symbols))

	// Create placeholders for the IN clause: ?, ?, ?
	placeholders := strings.Repeat("?,", len(symbols)-1) + "?"
	query := fmt.Sprintf(`
		SELECT symbol, security_name, open_price, high_price, low_price,
		       last_traded_price, previous_close, change, percent_change,
		       total_trade_volume, updated_at
		FROM prices
		WHERE symbol IN (%s);
	`, placeholders)

	// Convert symbols to []interface{} for Query
	args := make([]interface{}, len(symbols))
	for i, s := range symbols {
		args[i] = strings.ToUpper(strings.TrimSpace(s))
	}

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query prices by symbols: %w", err)
	}
	defer rows.Close()

	pricesMap := make(map[string]models.Price)
	for rows.Next() {
		var p models.Price
		err := rows.Scan(
			&p.Symbol, &p.SecurityName, &p.OpenPrice, &p.HighPrice, &p.LowPrice,
			&p.LastTradedPrice, &p.PreviousClose, &p.Change, &p.PercentChange,
			&p.TotalTradeVol, &p.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan price row by symbol: %w", err)
		}
		pricesMap[p.Symbol] = p
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during price rows iteration by symbols: %w", err)
	}

	log.Printf("Fetched prices for %d requested symbols.", len(pricesMap))
	return pricesMap, nil
}
