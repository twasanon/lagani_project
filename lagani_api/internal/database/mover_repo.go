package database

import (
	"database/sql"
	"fmt"
	"log"
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
	now := time.Now().UTC()
	log.Printf("Saving %d movers of type '%s' to database...", len(movers), moverType)

	tx, err := r.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction for movers: %w", err)
	}
	defer tx.Rollback()

	// --- Deletion Strategy ---
	// Option 1: Delete all previous movers of the same type before inserting new ones.
	// This is simple but might lose history if needed.
	// deleteQuery := `DELETE FROM movers WHERE type = ?;`
	// _, err = tx.Exec(deleteQuery, moverType)

	// Option 2: Delete movers of the same type older than the start of today (UTC).
	// Keeps history but assumes fetches happen daily.
	year, month, day := now.Date()
	startOfDay := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	deleteQuery := `DELETE FROM movers WHERE type = ? AND updated_at < ?;`
	_, err = tx.Exec(deleteQuery, moverType, startOfDay)

	if err != nil {
		return fmt.Errorf("failed to delete old movers (type: %s): %w", moverType, err)
	}
	log.Printf("Deleted old movers (type: %s) before %v", moverType, startOfDay)

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

	// Find the latest timestamp for the given type
	var latestTimestamp time.Time
	timestampQuery := `SELECT MAX(updated_at) FROM movers WHERE type = ?;`
	err := r.DB.QueryRow(timestampQuery, moverType).Scan(&latestTimestamp)
	if err != nil {
		if err == sql.ErrNoRows || latestTimestamp.IsZero() {
			log.Printf("No movers found for type '%s'.", moverType)
			return []models.Mover{}, nil // Return empty slice, not an error
		}
		return nil, fmt.Errorf("failed to find latest timestamp for movers (type: %s): %w", moverType, err)
	}

	log.Printf("Latest timestamp for type '%s' is %v", moverType, latestTimestamp)

	// Fetch all movers matching the type and the latest timestamp
	query := `
		SELECT id, type, rank, symbol, security_name, ltp, point_change, percent_change, updated_at
		FROM movers
		WHERE type = ? AND updated_at = ?
		ORDER BY rank;
	`

	rows, err := r.DB.Query(query, moverType, latestTimestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to query latest movers (type: %s): %w", moverType, err)
	}
	defer rows.Close()

	var movers []models.Mover
	for rows.Next() {
		var m models.Mover
		err := rows.Scan(
			&m.ID, &m.Type, &m.Rank, &m.Symbol, &m.SecurityName, &m.LTP, &m.PointChange, &m.PercentChange, &m.UpdatedAt,
		)
		if err != nil {
			log.Printf("Error scanning mover row: %v", err)
			continue
		}
		movers = append(movers, m)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during mover rows iteration (type: %s): %w", moverType, err)
	}

	log.Printf("Fetched %d latest movers of type '%s'.", len(movers), moverType)
	return movers, nil
}
