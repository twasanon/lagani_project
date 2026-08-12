package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"lagani_api/internal/models"
)

// MoverRepository defines methods for interacting with top gainers/losers data.
type MoverRepository struct {
	DB *sql.DB
}

// NewMoverRepository creates a new MoverRepository.
func NewMoverRepository(db *sql.DB) *MoverRepository {
	return &MoverRepository{DB: db}
}

// SaveMovers saves a list of movers (either gainers or losers) for a specific fetch time.
// It first deletes the previous movers of the same type for the same day (or maybe just older ones?)
// before inserting the new ones within a transaction.
func (r *MoverRepository) SaveMovers(movers []models.Mover) error {
	if len(movers) == 0 {
		log.Println("No movers provided to save.")
		return nil
	}

	// Assuming all movers in the slice are of the same type and fetched at roughly the same time.
	moverType := movers[0].Type
	if moverType != "gainer" && moverType != "loser" {
		return fmt.Errorf("invalid mover type %q", moverType)
	}
	now := time.Now().UTC()
	log.Printf("Saving %d movers of type '%s' to database...", len(movers), moverType)

	tx, err := r.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction for movers: %w", err)
	}
	defer tx.Rollback()

	// This table is a latest-value cache, not an audit log. Replace the complete
	// snapshot atomically so repeated intraday runs cannot accumulate stale rows.
	deleteQuery := `DELETE FROM movers WHERE type = ?;`
	_, err = tx.Exec(deleteQuery, moverType)

	if err != nil {
		return fmt.Errorf("failed to delete old movers (type: %s): %w", moverType, err)
	}

	// Prepare the INSERT statement
	stmt, err := tx.Prepare(`
		INSERT INTO movers (type, rank, symbol, security_name, ltp, point_change, percent_change, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?);
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare mover insert statement: %w", err)
	}
	defer stmt.Close()

	rankCounter := 1 // Ensure rank is sequential as inserted
	for _, mover := range movers {
		mover.Symbol = strings.ToUpper(strings.TrimSpace(mover.Symbol))
		if mover.Type != moverType || mover.Symbol == "" {
			return fmt.Errorf("invalid or mixed mover record for type %q and symbol %q", mover.Type, mover.Symbol)
		}
		_, err := stmt.Exec(
			moverType, // Use the determined type
			rankCounter,
			mover.Symbol,
			mover.SecurityName,
			mover.LTP,
			mover.PointChange,
			mover.PercentChange,
			now, // Use the current timestamp for all items in this batch
		)
		if err != nil {
			log.Printf("Error executing insert for mover %s: %v", mover.Symbol, err)
			return fmt.Errorf("failed to execute insert for mover %s: %w", mover.Symbol, err)
		}
		rankCounter++
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit mover transaction: %w", err)
	}

	log.Printf("Successfully saved %d movers of type '%s'.", len(movers), moverType)
	return nil
}

// GetLatestMoversByType retrieves the most recent list of movers for a given type ("gainer" or "loser").
func (r *MoverRepository) GetLatestMoversByType(moverType string) ([]models.Mover, error) {
	log.Printf("Fetching latest movers of type '%s' from database...", moverType)

	if moverType != "gainer" && moverType != "loser" {
		return nil, fmt.Errorf("invalid mover type %q", moverType)
	}

	// Fetch all movers matching the type and the latest timestamp
	query := `
		SELECT id, type, rank, symbol, security_name, ltp, point_change, percent_change, updated_at
		FROM movers
		WHERE type = ?
		  AND updated_at = (SELECT MAX(updated_at) FROM movers WHERE type = ?)
		ORDER BY rank;
	`

	rows, err := r.DB.Query(query, moverType, moverType)
	if err != nil {
		return nil, fmt.Errorf("failed to query latest movers (type: %s): %w", moverType, err)
	}
	defer rows.Close()

	movers := make([]models.Mover, 0)
	for rows.Next() {
		var m models.Mover
		err := rows.Scan(
			&m.ID, &m.Type, &m.Rank, &m.Symbol, &m.SecurityName, &m.LTP, &m.PointChange, &m.PercentChange, &m.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan mover row: %w", err)
		}
		movers = append(movers, m)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during mover rows iteration (type: %s): %w", moverType, err)
	}

	log.Printf("Fetched %d latest movers of type '%s'.", len(movers), moverType)
	return movers, nil
}
