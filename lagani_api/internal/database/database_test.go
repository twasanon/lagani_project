package database

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"lagani_api/internal/models"

	_ "github.com/mattn/go-sqlite3"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "nested", "lagani.db")
	t.Setenv("DB_FILE", dbPath)
	db, err := ConnectDB()
	if err != nil {
		t.Fatalf("ConnectDB() error = %v", err)
	}
	t.Cleanup(func() { db.Close() })
	if err := MigrateSchema(db); err != nil {
		t.Fatalf("MigrateSchema() error = %v", err)
	}
	return db
}

func TestMigrateSchemaCreatesRuntimeTables(t *testing.T) {
	db := openTestDB(t)

	for _, table := range []string{"companies", "prices", "movers", "historical_prices", "chart_data", "chart_data_weekly", "chart_data_monthly"} {
		var name string
		if err := db.QueryRow(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, table).Scan(&name); err != nil {
			t.Errorf("expected table %q: %v", table, err)
		}
	}

	requiredHistoricalColumns := map[string]bool{
		"business_date":            false,
		"open_price":               false,
		"previous_day_close_price": false,
		"total_traded_quantity":    false,
		"last_traded_price":        false,
		"fifty_two_week_high":      false,
	}
	rows, err := db.Query(`PRAGMA table_info(historical_prices)`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var cid, notNull, pk int
		var name, kind string
		var defaultValue interface{}
		if err := rows.Scan(&cid, &name, &kind, &notNull, &defaultValue, &pk); err != nil {
			t.Fatal(err)
		}
		if _, ok := requiredHistoricalColumns[name]; ok {
			requiredHistoricalColumns[name] = true
		}
	}
	rows.Close()
	for column, found := range requiredHistoricalColumns {
		if !found {
			t.Errorf("historical_prices missing column %q", column)
		}
	}
}

func TestCompanyRefreshPreservesDependentCacheRows(t *testing.T) {
	db := openTestDB(t)
	companyRepo := NewCompanyRepository(db)
	priceRepo := NewPriceRepository(db)
	chartRepo := NewChartRepository(db)

	if err := companyRepo.SaveCompanies([]models.Company{{Symbol: "NABIL", Name: "Nabil Bank", SecurityID: 131}}); err != nil {
		t.Fatal(err)
	}
	if err := priceRepo.SavePrices([]models.Price{{
		Symbol: "NABIL", SecurityName: "Nabil Bank", OpenPrice: 500, HighPrice: 510,
		LowPrice: 495, LastTradedPrice: 505, PreviousClose: 500, Change: 5,
		PercentChange: 1, TotalTradeVol: 1000,
	}}); err != nil {
		t.Fatal(err)
	}
	point := models.ChartDataPoint{Timestamp: 1_700_000_000, Open: 500, High: 510, Low: 495, Close: 505, Volume: 1000}
	if _, err := chartRepo.SaveChartDataPoints("NABIL", "merolagani", []models.ChartDataPoint{point}); err != nil {
		t.Fatal(err)
	}

	if err := companyRepo.SaveCompanies([]models.Company{{Symbol: "nabil", Name: "Nabil Bank Limited", SecurityID: 131}}); err != nil {
		t.Fatal(err)
	}

	queries := map[string]string{
		"prices":     `SELECT COUNT(*) FROM prices WHERE symbol = 'NABIL'`,
		"chart_data": `SELECT COUNT(*) FROM chart_data WHERE company_symbol = 'NABIL'`,
	}
	for table, query := range queries {
		var count int
		if err := db.QueryRow(query).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Errorf("%s row count = %d, want 1", table, count)
		}
	}
}

func TestHistoricalPricesRoundTripAndUpdate(t *testing.T) {
	db := openTestDB(t)
	repo := NewHistoricalPriceRepository(db)
	point := models.HistoricalPriceData{
		BusinessDate: "2026-08-11", OpenPrice: 500, HighPrice: 510, LowPrice: 495,
		ClosePrice: 505, PreviousDayClosePrice: 499, TotalTradedQuantity: 1000,
		LastTradedPrice: 505, FiftyTwoWeekHigh: 600,
	}
	if err := repo.SaveHistoricalPrices(131, []models.HistoricalPriceData{point}); err != nil {
		t.Fatal(err)
	}
	point.ClosePrice = 506
	point.LastTradedPrice = 506
	if err := repo.SaveHistoricalPrices(131, []models.HistoricalPriceData{point}); err != nil {
		t.Fatal(err)
	}
	got, err := repo.GetHistoricalPricesBySecurityID(131)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ClosePrice != 506 {
		t.Fatalf("historical prices = %#v, want one updated point", got)
	}
}

func TestMoverSnapshotIsReplacedAtomically(t *testing.T) {
	db := openTestDB(t)
	companyRepo := NewCompanyRepository(db)
	if err := companyRepo.SaveCompanies([]models.Company{
		{Symbol: "AAA", Name: "Alpha", SecurityID: 1},
		{Symbol: "BBB", Name: "Beta", SecurityID: 2},
	}); err != nil {
		t.Fatal(err)
	}
	repo := NewMoverRepository(db)
	if err := repo.SaveMovers([]models.Mover{
		{Type: "gainer", Symbol: "AAA", SecurityName: "Alpha", LTP: 10, PointChange: 1, PercentChange: 10},
		{Type: "gainer", Symbol: "BBB", SecurityName: "Beta", LTP: 20, PointChange: 1, PercentChange: 5},
	}); err != nil {
		t.Fatal(err)
	}
	time.Sleep(time.Millisecond)
	if err := repo.SaveMovers([]models.Mover{
		{Type: "gainer", Symbol: "BBB", SecurityName: "Beta", LTP: 21, PointChange: 2, PercentChange: 10},
	}); err != nil {
		t.Fatal(err)
	}
	got, err := repo.GetLatestMoversByType("gainer")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Symbol != "BBB" || got[0].Rank != 1 {
		t.Fatalf("movers = %#v, want latest BBB snapshot", got)
	}
}

func TestLegacyHistoricalSchemaIsMigrated(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "legacy.db")
	legacy, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	_, err = legacy.Exec(`
		CREATE TABLE historical_prices (
			id INTEGER PRIMARY KEY AUTOINCREMENT, security_id INTEGER NOT NULL,
			date DATETIME NOT NULL, open REAL NOT NULL, high REAL NOT NULL,
			low REAL NOT NULL, close REAL NOT NULL, volume BIGINT NOT NULL,
			previous_close REAL, difference_rs REAL, percent_difference REAL,
			range REAL, turnover_value REAL, no_of_transactions INTEGER,
			scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (security_id, date)
		);
		INSERT INTO historical_prices (security_id, date, open, high, low, close, volume, previous_close)
		VALUES (131, '2026-08-11', 500, 510, 495, 505, 1000, 499);
	`)
	if err != nil {
		t.Fatal(err)
	}
	legacy.Close()

	t.Setenv("DB_FILE", dbPath)
	db, err := ConnectDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := MigrateSchema(db); err != nil {
		t.Fatal(err)
	}
	got, err := NewHistoricalPriceRepository(db).GetHistoricalPricesBySecurityID(131)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].BusinessDate != "2026-08-11" || got[0].ClosePrice != 505 {
		t.Fatalf("migrated historical data = %#v", got)
	}
}
