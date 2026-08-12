package database

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"lagani_api/internal/models"
)

// ChartRepository handles database operations for chart data.
type ChartRepository struct {
	db *sql.DB
}

// NewChartRepository creates a new ChartRepository.
func NewChartRepository(db *sql.DB) *ChartRepository {
	return &ChartRepository{db: db}
}

// SaveChartDataPoints saves a batch of chart data points for a specific company symbol and source.
// It upserts by (company_symbol, source, timestamp), allowing the latest candle
// and adjusted recent values to be corrected by subsequent source responses.
// Returns the number of rows inserted or updated.
func (r *ChartRepository) SaveChartDataPoints(companySymbol string, source string, points []models.ChartDataPoint) (int64, error) {
	if len(points) == 0 {
		return 0, nil
	}

	companySymbol = strings.ToUpper(strings.TrimSpace(companySymbol))
	source = strings.ToLower(strings.TrimSpace(source))
	if companySymbol == "" || source == "" {
		return 0, fmt.Errorf("SaveChartDataPoints: company symbol and source are required")
	}
	for _, point := range points {
		if err := validateChartPoint(point); err != nil {
			return 0, fmt.Errorf("SaveChartDataPoints: invalid point for %s: %w", companySymbol, err)
		}
	}

	tx, err := r.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("SaveChartDataPoints: failed to begin transaction: %w", err)
	}
	defer tx.Rollback() // Rollback if commit fails or not explicitly committed

	sqlStr := `
		INSERT INTO chart_data (company_symbol, source, timestamp, open, high, low, close, volume, scraped_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (company_symbol, source, timestamp) DO UPDATE SET
			open = excluded.open,
			high = excluded.high,
			low = excluded.low,
			close = excluded.close,
			volume = excluded.volume,
			scraped_at = excluded.scraped_at;
	`
	stmt, err := tx.Prepare(sqlStr)
	if err != nil {
		return 0, fmt.Errorf("SaveChartDataPoints: failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	var insertedCount int64
	now := time.Now().UTC() // Store time in UTC

	for _, p := range points {
		res, err := stmt.Exec(
			companySymbol,
			source,
			p.Timestamp,
			p.Open,
			p.High,
			p.Low,
			p.Close,
			p.Volume,
			now,
		)
		if err != nil {
			return 0, fmt.Errorf("SaveChartDataPoints: failed to upsert symbol %s at %d: %w", companySymbol, p.Timestamp, err)
		}
		rowsAffected, _ := res.RowsAffected() // Check if a row was actually inserted
		insertedCount += rowsAffected
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("SaveChartDataPoints: failed to commit transaction: %w", err)
	}

	log.Printf("SaveChartDataPoints: Upserted %d points for %s from %s.", insertedCount, companySymbol, source)
	return insertedCount, nil
}

// GetChartData retrieves chart data points for a given company symbol, source, and date range.
// Timestamps are expected to be Unix seconds.
func (r *ChartRepository) GetChartData(companySymbol string, source string, startDateTimestamp int64, endDateTimestamp int64) ([]models.ChartDataPoint, error) {
	companySymbol = strings.ToUpper(strings.TrimSpace(companySymbol))
	source = strings.ToLower(strings.TrimSpace(source))
	if companySymbol == "" || source == "" || startDateTimestamp > endDateTimestamp {
		return nil, fmt.Errorf("GetChartData: invalid symbol, source, or timestamp range")
	}
	query := `
		SELECT timestamp, open, high, low, close, volume
		FROM chart_data
		WHERE company_symbol = ? AND source = ? AND timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC;
	`
	rows, err := r.db.Query(query, companySymbol, source, startDateTimestamp, endDateTimestamp)
	if err != nil {
		return nil, fmt.Errorf("GetChartData: failed to query chart data for %s (%s): %w", companySymbol, source, err)
	}
	defer rows.Close()

	points := make([]models.ChartDataPoint, 0)
	for rows.Next() {
		var p models.ChartDataPoint
		if err := rows.Scan(&p.Timestamp, &p.Open, &p.High, &p.Low, &p.Close, &p.Volume); err != nil {
			return nil, fmt.Errorf("GetChartData: failed to scan row for %s: %w", companySymbol, err)
		}
		points = append(points, p)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("GetChartData: error during chart data rows iteration for %s: %w", companySymbol, err)
	}

	log.Printf("GetChartData: Fetched %d points for %s from %s between %d and %d.", len(points), companySymbol, source, startDateTimestamp, endDateTimestamp)
	return points, nil
}

// GetLatestChartTimestamp retrieves the timestamp of the most recent data point for a given company symbol and source.
// Returns the timestamp (Unix seconds), a boolean indicating if a record was found, and an error if one occurred.
func (r *ChartRepository) GetLatestChartTimestamp(companySymbol string, source string) (timestamp int64, found bool, err error) {
	companySymbol = strings.ToUpper(strings.TrimSpace(companySymbol))
	source = strings.ToLower(strings.TrimSpace(source))
	if companySymbol == "" || source == "" {
		return 0, false, fmt.Errorf("GetLatestChartTimestamp: company symbol and source are required")
	}
	query := `
		SELECT MAX(timestamp)
		FROM chart_data
		WHERE company_symbol = ? AND source = ?;
	`
	var nullableTimestamp sql.NullInt64
	err = r.db.QueryRow(query, companySymbol, source).Scan(&nullableTimestamp)

	if err != nil {
		if err == sql.ErrNoRows {
			// This is not an application error; it simply means no data exists yet.
			log.Printf("GetLatestChartTimestamp: No existing chart data found for %s from %s.", companySymbol, source)
			return 0, false, nil
		}
		// An actual error occurred during the query or scan.
		return 0, false, fmt.Errorf("GetLatestChartTimestamp: failed to query max timestamp for %s (%s): %w", companySymbol, source, err)
	}

	if nullableTimestamp.Valid {
		log.Printf("GetLatestChartTimestamp: Latest timestamp for %s from %s is %d.", companySymbol, source, nullableTimestamp.Int64)
		return nullableTimestamp.Int64, true, nil
	} else {
		// No rows matched, which is similar to sql.ErrNoRows but handled by NullInt64.Valid.
		log.Printf("GetLatestChartTimestamp: No existing chart data (null max) for %s from %s.", companySymbol, source)
		return 0, false, nil
	}
}

// SaveWeeklyChartPoints saves a batch of weekly aggregated chart data points.
// It uses INSERT ... ON CONFLICT DO UPDATE to update existing weekly candles.
func (r *ChartRepository) SaveWeeklyChartPoints(companySymbol string, source string, points []models.ChartDataPoint) (int64, error) {
	return r.saveAggregatedChartPoints("chart_data_weekly", companySymbol, source, points)
}

// SaveMonthlyChartPoints saves a batch of monthly aggregated chart data points.
// It uses INSERT ... ON CONFLICT DO UPDATE to update existing monthly candles.
func (r *ChartRepository) SaveMonthlyChartPoints(companySymbol string, source string, points []models.ChartDataPoint) (int64, error) {
	return r.saveAggregatedChartPoints("chart_data_monthly", companySymbol, source, points)
}

// saveAggregatedChartPoints is a helper function to save aggregated data to a specified table.
func (r *ChartRepository) saveAggregatedChartPoints(tableName string, companySymbol string, source string, points []models.ChartDataPoint) (int64, error) {
	if len(points) == 0 {
		return 0, nil
	}

	if err := validateAggregateTable(tableName); err != nil {
		return 0, err
	}
	companySymbol = strings.ToUpper(strings.TrimSpace(companySymbol))
	source = strings.ToLower(strings.TrimSpace(source))
	if companySymbol == "" || source == "" {
		return 0, fmt.Errorf("saveAggregatedChartPoints: company symbol and source are required")
	}
	for _, point := range points {
		if err := validateChartPoint(point); err != nil {
			return 0, fmt.Errorf("saveAggregatedChartPoints: invalid point for %s: %w", companySymbol, err)
		}
	}

	tx, err := r.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("saveAggregatedChartPoints (%s): failed to begin transaction: %w", tableName, err)
	}
	defer tx.Rollback()

	// Note: aggregated_at is updated by DEFAULT CURRENT_TIMESTAMP or by the SET clause on conflict.
	sqlStr := fmt.Sprintf(`
		INSERT INTO %s (company_symbol, source, timestamp, open, high, low, close, volume, aggregated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (company_symbol, source, timestamp) DO UPDATE SET
			open = excluded.open,
			high = excluded.high,
			low = excluded.low,
			close = excluded.close,
			volume = excluded.volume,
			aggregated_at = excluded.aggregated_at;
	`, tableName)

	stmt, err := tx.Prepare(sqlStr)
	if err != nil {
		return 0, fmt.Errorf("saveAggregatedChartPoints (%s): failed to prepare statement: %w", tableName, err)
	}
	defer stmt.Close()

	var updatedOrInsertedCount int64
	now := time.Now().UTC()

	for _, p := range points {
		res, err := stmt.Exec(
			companySymbol,
			source,
			p.Timestamp,
			p.Open,
			p.High,
			p.Low,
			p.Close,
			p.Volume,
			now, // For initial insert's aggregated_at, though conflict update will override with CURRENT_TIMESTAMP
		)
		if err != nil {
			return 0, fmt.Errorf("saveAggregatedChartPoints (%s): failed to upsert symbol %s at %d: %w", tableName, companySymbol, p.Timestamp, err)
		}
		rowsAffected, _ := res.RowsAffected()
		updatedOrInsertedCount += rowsAffected // In SQLite, UPSERT typically reports 1 for insert or update
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("saveAggregatedChartPoints (%s): failed to commit transaction: %w", tableName, err)
	}

	log.Printf("saveAggregatedChartPoints (%s): Processed %d points for %s from %s, %d rows affected (inserted/updated).", tableName, len(points), companySymbol, source, updatedOrInsertedCount)
	return updatedOrInsertedCount, nil
}

// GetWeeklyChartData retrieves weekly chart data points.
func (r *ChartRepository) GetWeeklyChartData(companySymbol string, source string, startDateTimestamp int64, endDateTimestamp int64) ([]models.ChartDataPoint, error) {
	return r.getAggregatedChartData("chart_data_weekly", companySymbol, source, startDateTimestamp, endDateTimestamp)
}

// GetMonthlyChartData retrieves monthly chart data points.
func (r *ChartRepository) GetMonthlyChartData(companySymbol string, source string, startDateTimestamp int64, endDateTimestamp int64) ([]models.ChartDataPoint, error) {
	return r.getAggregatedChartData("chart_data_monthly", companySymbol, source, startDateTimestamp, endDateTimestamp)
}

// getAggregatedChartData is a helper to fetch data from a specified aggregated table.
func (r *ChartRepository) getAggregatedChartData(tableName string, companySymbol string, source string, startDateTimestamp int64, endDateTimestamp int64) ([]models.ChartDataPoint, error) {
	if err := validateAggregateTable(tableName); err != nil {
		return nil, err
	}
	companySymbol = strings.ToUpper(strings.TrimSpace(companySymbol))
	source = strings.ToLower(strings.TrimSpace(source))
	if companySymbol == "" || source == "" || startDateTimestamp > endDateTimestamp {
		return nil, fmt.Errorf("getAggregatedChartData: invalid symbol, source, or timestamp range")
	}
	query := fmt.Sprintf(`
		SELECT timestamp, open, high, low, close, volume
		FROM %s
		WHERE company_symbol = ? AND source = ? AND timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC;
	`, tableName)

	rows, err := r.db.Query(query, companySymbol, source, startDateTimestamp, endDateTimestamp)
	if err != nil {
		return nil, fmt.Errorf("getAggregatedChartData (%s): failed to query chart data for %s (%s): %w", tableName, companySymbol, source, err)
	}
	defer rows.Close()

	points := make([]models.ChartDataPoint, 0)
	for rows.Next() {
		var p models.ChartDataPoint
		if err := rows.Scan(&p.Timestamp, &p.Open, &p.High, &p.Low, &p.Close, &p.Volume); err != nil {
			return nil, fmt.Errorf("getAggregatedChartData (%s): failed to scan row for %s: %w", tableName, companySymbol, err)
		}
		points = append(points, p)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("getAggregatedChartData (%s): error during chart data rows iteration for %s: %w", tableName, companySymbol, err)
	}

	log.Printf("getAggregatedChartData (%s): Fetched %d points for %s from %s between %d and %d.", tableName, len(points), companySymbol, source, startDateTimestamp, endDateTimestamp)
	return points, nil
}

// GetLatestAggregatedTimestamp retrieves the timestamp of the most recent aggregated data point from a specific table.
func (r *ChartRepository) GetLatestAggregatedTimestamp(tableName string, companySymbol string, source string) (timestamp int64, found bool, err error) {
	if err := validateAggregateTable(tableName); err != nil {
		return 0, false, err
	}
	companySymbol = strings.ToUpper(strings.TrimSpace(companySymbol))
	source = strings.ToLower(strings.TrimSpace(source))
	if companySymbol == "" || source == "" {
		return 0, false, fmt.Errorf("GetLatestAggregatedTimestamp: company symbol and source are required")
	}
	query := fmt.Sprintf(`
		SELECT MAX(timestamp)
		FROM %s
		WHERE company_symbol = ? AND source = ?;
	`, tableName)
	var nullableTimestamp sql.NullInt64
	err = r.db.QueryRow(query, companySymbol, source).Scan(&nullableTimestamp)

	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("GetLatestAggregatedTimestamp (%s): No existing data found for %s from %s.", tableName, companySymbol, source)
			return 0, false, nil
		}
		return 0, false, fmt.Errorf("GetLatestAggregatedTimestamp (%s): failed to query max timestamp for %s (%s): %w", tableName, companySymbol, source, err)
	}

	if nullableTimestamp.Valid {
		log.Printf("GetLatestAggregatedTimestamp (%s): Latest timestamp for %s from %s is %d.", tableName, companySymbol, source, nullableTimestamp.Int64)
		return nullableTimestamp.Int64, true, nil
	} else {
		log.Printf("GetLatestAggregatedTimestamp (%s): No existing data (null max) for %s from %s.", tableName, companySymbol, source)
		return 0, false, nil
	}
}

func validateAggregateTable(tableName string) error {
	switch tableName {
	case "chart_data_weekly", "chart_data_monthly":
		return nil
	default:
		return fmt.Errorf("unsupported aggregate table %q", tableName)
	}
}

func validateChartPoint(point models.ChartDataPoint) error {
	values := []float64{point.Open, point.High, point.Low, point.Close, point.Volume}
	for _, value := range values {
		if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
			return fmt.Errorf("contains a negative or non-finite value")
		}
	}
	if point.Timestamp <= 0 {
		return fmt.Errorf("timestamp must be positive")
	}
	if point.High < point.Low || point.High < point.Open || point.High < point.Close || point.Low > point.Open || point.Low > point.Close {
		return fmt.Errorf("OHLC values are inconsistent")
	}
	return nil
}
