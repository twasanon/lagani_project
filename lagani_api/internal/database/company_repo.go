package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"lagani_api/internal/models"
)

// CompanyRepository handles database operations for companies.
type CompanyRepository struct {
	db *sql.DB
}

// NewCompanyRepository creates a new CompanyRepository.
func NewCompanyRepository(db *sql.DB) *CompanyRepository {
	return &CompanyRepository{db: db}
}

// SaveCompanies inserts or replaces company data in the database.
// It now includes the security_id.
func (r *CompanyRepository) SaveCompanies(companies []models.Company) error {
	if len(companies) == 0 {
		return nil // Nothing to save
	}

	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() // Rollback if commit fails

	// Use INSERT OR REPLACE to handle existing companies based on the PRIMARY KEY (symbol).
	// The security_id should ideally not change for a symbol, but REPLACE handles updates if needed.
	sqlStr := `INSERT OR REPLACE INTO companies (symbol, name, security_id, updated_at) VALUES (?, ?, ?, ?)`
	stmt, err := tx.Prepare(sqlStr)
	if err != nil {
		return fmt.Errorf("failed to prepare company insert statement: %w", err)
	}
	defer stmt.Close()

	now := time.Now()
	for _, company := range companies {
		_, err := stmt.Exec(company.Symbol, company.Name, company.SecurityID, now)
		if err != nil {
			// Log the specific company causing the error
			log.Printf("[ERROR] Failed to execute company insert for symbol %s (ID: %d): %v", company.Symbol, company.SecurityID, err)
			// Continue trying to insert others? Or fail the whole batch?
			// For now, fail the whole batch on first error.
			return fmt.Errorf("failed to execute company insert for symbol %s: %w", company.Symbol, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit company transaction: %w", err)
	}

	log.Printf("Successfully saved/updated %d companies.", len(companies))
	return nil
}

// GetAllCompanies retrieves all companies from the database.
func (r *CompanyRepository) GetAllCompanies() ([]models.Company, error) {
	query := `SELECT symbol, name, security_id, updated_at FROM companies ORDER BY symbol ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query companies: %w", err)
	}
	defer rows.Close()

	var companies []models.Company
	for rows.Next() {
		var c models.Company
		// Ensure SecurityID is scanned correctly
		if err := rows.Scan(&c.Symbol, &c.Name, &c.SecurityID, &c.UpdatedAt); err != nil {
			log.Printf("[ERROR] Failed to scan company row: %v", err)
			continue // Skip problematic rows
		}
		companies = append(companies, c)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during company rows iteration: %w", err)
	}

	return companies, nil
}

// GetAllCompanySecurityIDs retrieves all unique, non-null security IDs from the companies table.
func (r *CompanyRepository) GetAllCompanySecurityIDs() ([]int, error) {
	query := `SELECT DISTINCT security_id FROM companies WHERE security_id IS NOT NULL ORDER BY security_id ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query security IDs: %w", err)
	}
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			log.Printf("[ERROR] Failed to scan security ID row: %v", err)
			continue // Skip problematic rows
		}
		ids = append(ids, id)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during security ID rows iteration: %w", err)
	}

	return ids, nil
}

// GetCompanyBySymbol retrieves a single company by its symbol.
// Returns sql.ErrNoRows if not found.
func (r *CompanyRepository) GetCompanyBySymbol(symbol string) (*models.Company, error) {
	var c models.Company
	// The table schema for `companies` in `database.go` is:
	// symbol TEXT PRIMARY KEY, name TEXT NOT NULL, security_id INTEGER UNIQUE, updated_at DATETIME NOT NULL
	// `models.Company` struct has an `ID int` field `json:"-"`, not used as DB PK here.

	query := `SELECT symbol, name, security_id, updated_at FROM companies WHERE symbol = ?`
	row := r.db.QueryRow(query, symbol)
	err := row.Scan(&c.Symbol, &c.Name, &c.SecurityID, &c.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err // Return sql.ErrNoRows directly for handler to check
		}
		return nil, fmt.Errorf("GetCompanyBySymbol: failed to scan company for symbol %s: %w", symbol, err)
	}
	return &c, nil
}
