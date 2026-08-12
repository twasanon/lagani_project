package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"lagani_api/internal/models"
)

// MarketStatusRepository defines methods for interacting with market_status data.
type MarketStatusRepository struct {
	DB *sql.DB
}

// NewMarketStatusRepository creates a new MarketStatusRepository.
func NewMarketStatusRepository(db *sql.DB) *MarketStatusRepository {
	return &MarketStatusRepository{DB: db}
}

// SaveMarketStatus inserts or updates the single market status row.
// It uses ON CONFLICT to perform an UPSERT operation.
func (r *MarketStatusRepository) SaveMarketStatus(status models.MarketStatus) error {
	log.Println("Saving market status to database...")
	query := `
	INSERT INTO market_status (id, status, as_of, updated_at)
	VALUES (1, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		status = excluded.status,
		as_of = excluded.as_of,
		updated_at = excluded.updated_at;
	`

	_, err := r.DB.Exec(query, status.Status, status.AsOf, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("failed to save market status: %w", err)
	}
	log.Println("Market status saved successfully.")
	return nil
}

// GetLatestMarketStatus retrieves the latest market status from the database.
func (r *MarketStatusRepository) GetLatestMarketStatus() (*models.MarketStatus, error) {
	log.Println("Fetching latest market status from database...")
	query := `SELECT status, as_of, updated_at FROM market_status WHERE id = 1;`

	var status models.MarketStatus
	var asOf sql.NullTime
	row := r.DB.QueryRow(query)

	err := row.Scan(&status.Status, &asOf, &status.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Println("No market status found in database.")
			// Return nil, nil to indicate not found without an error,
			// or return a specific error if needed by the caller.
			return nil, nil
		}
		return nil, fmt.Errorf("failed to scan market status: %w", err)
	}
	if asOf.Valid {
		value := asOf.Time.UTC()
		status.AsOf = &value
	}

	log.Printf("Market status fetched: %+v", status)
	status.ID = 1 // Explicitly set the ID
	return &status, nil
}
