package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3" // SQLite driver
)

// Helper function (could be moved to a shared utils package)
func getEnvDB(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// ConnectDB initializes and returns a connection to the SQLite database.
// It creates the database file if it doesn't exist.
func ConnectDB() (*sql.DB, error) {
	// Ensure the directory for the database exists (optional, useful if storing in a sub-directory)
	dbDir := "." // Store in the current directory (lagani_api)

	dbFileName := getEnvDB("DB_FILE", "lagani_cache.db") // Use env var or default

	err := os.MkdirAll(dbDir, 0755)
	if err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	dbPath := filepath.Join(dbDir, dbFileName)
	log.Printf("Connecting to database: %s", dbPath)

	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on") // Enable foreign keys if needed later
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Ping the database to verify the connection
	if err = db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Database connection established.")
	return db, nil
}

// MigrateSchema creates the necessary tables in the database if they don't already exist.
func MigrateSchema(db *sql.DB) error {
	log.Println("Running database schema migrations...")

	// Enable foreign keys if not enabled by default (good practice for SQLite)
	_, err := db.Exec("PRAGMA foreign_keys = ON;")
	if err != nil {
		return fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// Create companies table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS companies (
		symbol TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		security_id INTEGER UNIQUE, -- For NEPSE specific ID, can be NULL if not applicable
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create companies table: %w", err)
	}
	log.Println("Companies table ensured.")

	// Create market_status table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS market_status (
		id INTEGER PRIMARY KEY CHECK (id = 1), -- Enforce singleton row
		status TEXT NOT NULL,
		as_of DATETIME, -- Added for the NEPSE API 'asOf' field
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP 
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create market_status table: %w", err)
	}
	log.Println("Market status table ensured.")

	// Create prices table (for latest price data, one entry per symbol)
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS prices (
		symbol TEXT PRIMARY KEY,
		security_name TEXT,
		open_price REAL,
		high_price REAL,
		low_price REAL,
		last_traded_price REAL,
		previous_close REAL,
		change REAL,
		percent_change REAL,
		total_trade_volume INTEGER, -- Storing as INTEGER to align with models.Price.TotalTradeVol (int64)
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create prices table: %w", err)
	}
	log.Println("Prices table ensured.")

	// Create price_snapshots table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS price_snapshots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		company_symbol TEXT NOT NULL,
		ltp REAL,
		point_change REAL,
		percentage_change REAL,
		open_price REAL,
		high_price REAL,
		low_price REAL,
		previous_close REAL,
		volume_traded TEXT, -- Using TEXT to store as string "1,234.00"
		value_traded TEXT,  -- Using TEXT to store as string "1,234,567.00"
		turnover INTEGER,
		last_traded_on DATETIME, -- From NEPSE source if available
		scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (company_symbol, scraped_at), -- Ensure uniqueness for a given scrape time
		FOREIGN KEY (company_symbol) REFERENCES companies(symbol) ON DELETE CASCADE
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create price_snapshots table: %w", err)
	}
	log.Println("Price snapshots table ensured.")

	// Create news_items table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS news_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		source TEXT NOT NULL, -- 'merolagani', 'nepalipaisa', etc.
		title TEXT NOT NULL,
		link TEXT NOT NULL UNIQUE, -- Ensure news links are unique
		image_url TEXT,
		date_str TEXT, -- Date as parsed from the site
		published_at DATETIME, -- Parsed and standardized datetime if possible
		scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create news_items table: %w", err)
	}
	log.Println("News items table ensured.")

	// Create historical_prices table (NEPSE specific)
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS historical_prices (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		security_id INTEGER NOT NULL,
		date DATETIME NOT NULL, -- Date of the historical data point
		open REAL NOT NULL,
		high REAL NOT NULL,
		low REAL NOT NULL,
		close REAL NOT NULL,
		volume BIGINT NOT NULL,
		previous_close REAL,
		difference_rs REAL,
		percent_difference REAL,
		range REAL,
		turnover_value REAL,
		no_of_transactions INTEGER,
		scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (security_id, date)
		-- Note: No direct FK to companies.security_id to allow flexibility, handled by app logic
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create historical_prices table: %w", err)
	}
	log.Println("Historical prices table ensured.")

	// Create chart_data table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS chart_data (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		company_symbol TEXT NOT NULL,
		timestamp INTEGER NOT NULL, -- Unix timestamp (seconds) for the data point date
		open REAL NOT NULL,
		high REAL NOT NULL,
		low REAL NOT NULL,
		close REAL NOT NULL,
		volume REAL NOT NULL,
		source TEXT NOT NULL, -- e.g., 'merolagani', 'nepse'
		scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (company_symbol, source, timestamp),
		FOREIGN KEY (company_symbol) REFERENCES companies(symbol) ON DELETE CASCADE
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create chart_data table: %w", err)
	}
	log.Println("Chart data table ensured.")

	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_chart_data_symbol_source_ts ON chart_data(company_symbol, source, timestamp DESC);`)
	if err != nil {
		return fmt.Errorf("failed to create index on chart_data: %w", err)
	}
	log.Println("Index on chart_data ensured.")

	// Create chart_data_weekly table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS chart_data_weekly (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		company_symbol TEXT NOT NULL,
		timestamp INTEGER NOT NULL, -- Unix timestamp (seconds) for the start of the week (Monday 00:00:00 UTC)
		open REAL NOT NULL,
		high REAL NOT NULL,
		low REAL NOT NULL,
		close REAL NOT NULL,
		volume REAL NOT NULL,
		source TEXT NOT NULL,
		aggregated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (company_symbol, source, timestamp),
		FOREIGN KEY (company_symbol) REFERENCES companies(symbol) ON DELETE CASCADE
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create chart_data_weekly table: %w", err)
	}
	log.Println("Weekly chart data table ensured.")

	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_chart_data_weekly_symbol_source_ts ON chart_data_weekly(company_symbol, source, timestamp DESC);`)
	if err != nil {
		return fmt.Errorf("failed to create index on chart_data_weekly: %w", err)
	}
	log.Println("Index on chart_data_weekly ensured.")

	// Create chart_data_monthly table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS chart_data_monthly (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		company_symbol TEXT NOT NULL,
		timestamp INTEGER NOT NULL, -- Unix timestamp (seconds) for the start of the month (1st day 00:00:00 UTC)
		open REAL NOT NULL,
		high REAL NOT NULL,
		low REAL NOT NULL,
		close REAL NOT NULL,
		volume REAL NOT NULL,
		source TEXT NOT NULL,
		aggregated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (company_symbol, source, timestamp),
		FOREIGN KEY (company_symbol) REFERENCES companies(symbol) ON DELETE CASCADE
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create chart_data_monthly table: %w", err)
	}
	log.Println("Monthly chart data table ensured.")

	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_chart_data_monthly_symbol_source_ts ON chart_data_monthly(company_symbol, source, timestamp DESC);`)
	if err != nil {
		return fmt.Errorf("failed to create index on chart_data_monthly: %w", err)
	}
	log.Println("Index on chart_data_monthly ensured.")

	log.Println("Database migration completed successfully.")
	return nil
}
