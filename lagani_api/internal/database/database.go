package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

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
	dbFileName := strings.TrimSpace(getEnvDB("DB_FILE", "lagani_cache.db"))
	if dbFileName == "" {
		return nil, fmt.Errorf("DB_FILE cannot be empty")
	}

	dbPath, err := filepath.Abs(filepath.Clean(dbFileName))
	if err != nil {
		return nil, fmt.Errorf("failed to resolve database path: %w", err)
	}
	dbDir := filepath.Dir(dbPath)
	err = os.MkdirAll(dbDir, 0750)
	if err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	log.Printf("Connecting to database: %s", dbPath)

	dsn := (&url.URL{
		Scheme: "file",
		Path:   dbPath,
		RawQuery: url.Values{
			"_busy_timeout": {"5000"},
			"_foreign_keys": {"on"},
			"_journal_mode": {"WAL"},
			"_synchronous":  {"NORMAL"},
		}.Encode(),
	}).String()
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}
	// SQLite permits one writer at a time. A single pooled connection prevents
	// concurrent scheduler jobs from producing intermittent "database is locked"
	// failures while WAL still allows other processes to read the database.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err = db.PingContext(ctx); err != nil {
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

	// Create historical_prices table (NEPSE graph-data response).
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS historical_prices (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		security_id INTEGER NOT NULL,
		business_date TEXT NOT NULL,
		open_price REAL NOT NULL,
		high_price REAL NOT NULL,
		low_price REAL NOT NULL,
		close_price REAL NOT NULL,
		previous_day_close_price REAL NOT NULL DEFAULT 0,
		total_traded_quantity INTEGER NOT NULL DEFAULT 0,
		last_traded_price REAL NOT NULL DEFAULT 0,
		fifty_two_week_high REAL NOT NULL DEFAULT 0,
		scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (security_id, business_date)
		-- Note: No direct FK to companies.security_id to allow flexibility, handled by app logic
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create historical_prices table: %w", err)
	}
	log.Println("Historical prices table ensured.")

	// Create movers table (latest gainers/losers snapshots).
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS movers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		type TEXT NOT NULL CHECK (type IN ('gainer', 'loser')),
		rank INTEGER NOT NULL CHECK (rank > 0),
		symbol TEXT NOT NULL,
		security_name TEXT,
		ltp REAL NOT NULL,
		point_change REAL NOT NULL,
		percent_change REAL NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
	);
	`)
	if err != nil {
		return fmt.Errorf("failed to create movers table: %w", err)
	}
	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_movers_type_updated_rank ON movers(type, updated_at DESC, rank ASC);`)
	if err != nil {
		return fmt.Errorf("failed to create movers index: %w", err)
	}
	log.Println("Movers table ensured.")

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
		timestamp INTEGER NOT NULL, -- Unix timestamp (seconds) for the start of the NEPSE week (Sunday 00:00:00 UTC)
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

	if err := migrateLegacyHistoricalPrices(db); err != nil {
		return err
	}

	log.Println("Database migration completed successfully.")
	return nil
}

// migrateLegacyHistoricalPrices repairs the schema shipped by early Lagani
// builds. That schema used date/open/high/... while the repository has always
// queried business_date/open_price/high_price/.... Without this migration the
// service compiled but every historical-price operation failed at runtime.
func migrateLegacyHistoricalPrices(db *sql.DB) error {
	rows, err := db.Query(`PRAGMA table_info(historical_prices);`)
	if err != nil {
		return fmt.Errorf("failed to inspect historical_prices schema: %w", err)
	}

	columns := make(map[string]bool)
	for rows.Next() {
		var cid, notNull, pk int
		var name, columnType string
		var defaultValue interface{}
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			return fmt.Errorf("failed to scan historical_prices schema: %w", err)
		}
		columns[name] = true
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("failed to iterate historical_prices schema: %w", err)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("failed to close historical_prices schema rows: %w", err)
	}
	if columns["business_date"] {
		return nil
	}
	if !columns["date"] {
		return fmt.Errorf("historical_prices has an unsupported schema")
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin historical_prices migration: %w", err)
	}
	defer tx.Rollback()

	statements := []string{
		`ALTER TABLE historical_prices RENAME TO historical_prices_legacy;`,
		`CREATE TABLE historical_prices (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			security_id INTEGER NOT NULL,
			business_date TEXT NOT NULL,
			open_price REAL NOT NULL,
			high_price REAL NOT NULL,
			low_price REAL NOT NULL,
			close_price REAL NOT NULL,
			previous_day_close_price REAL NOT NULL DEFAULT 0,
			total_traded_quantity INTEGER NOT NULL DEFAULT 0,
			last_traded_price REAL NOT NULL DEFAULT 0,
			fifty_two_week_high REAL NOT NULL DEFAULT 0,
			scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (security_id, business_date)
		);`,
		`INSERT OR IGNORE INTO historical_prices (
			security_id, business_date, open_price, high_price, low_price,
			close_price, previous_day_close_price, total_traded_quantity,
			last_traded_price, fifty_two_week_high, scraped_at
		)
		SELECT security_id, CAST(date AS TEXT), open, high, low, close,
			COALESCE(previous_close, 0), CAST(COALESCE(volume, 0) AS INTEGER),
			close, 0, scraped_at
		FROM historical_prices_legacy;`,
		`DROP TABLE historical_prices_legacy;`,
	}
	for _, statement := range statements {
		if _, err := tx.Exec(statement); err != nil {
			return fmt.Errorf("failed to migrate historical_prices schema: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit historical_prices migration: %w", err)
	}
	log.Println("Migrated legacy historical_prices schema.")
	return nil
}
