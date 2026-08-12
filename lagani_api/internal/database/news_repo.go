package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"lagani_api/internal/models"
)

// NewsRepository defines methods for interacting with news_items data.
type NewsRepository struct {
	DB *sql.DB
}

// NewNewsRepository creates a new NewsRepository.
func NewNewsRepository(db *sql.DB) *NewsRepository {
	return &NewsRepository{DB: db}
}

// SaveNewsItems inserts multiple news items, ignoring duplicates based on the link.
func (r *NewsRepository) SaveNewsItems(items []models.NewsItem) (int64, error) {
	if len(items) == 0 {
		log.Println("No news items provided to save.")
		return 0, nil
	}
	log.Printf("Attempting to save %d news items to database...", len(items))

	tx, err := r.DB.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction for news items: %w", err)
	}
	defer tx.Rollback()

	// Prepare the INSERT statement with ON CONFLICT DO NOTHING
	stmt, err := tx.Prepare(`
		INSERT INTO news_items (source, title, link, image_url, date_str, scraped_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(link) DO NOTHING;
	`)
	if err != nil {
		return 0, fmt.Errorf("failed to prepare news item insert statement: %w", err)
	}
	defer stmt.Close()

	now := time.Now().UTC()
	rowsAffected := int64(0)

	for _, item := range items {
		result, err := stmt.Exec(
			item.Source,
			item.Title,
			item.Link,
			item.ImageURL,
			item.DateStr,
			now,
		)
		if err != nil {
			// Log error but continue processing other items
			log.Printf("Error executing insert for news item '%s': %v", item.Title, err)
			continue // Or return error to fail the batch?
		}
		count, _ := result.RowsAffected()
		rowsAffected += count
	}

	if err = tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit news item transaction: %w", err)
	}

	log.Printf("Successfully saved %d new news items (%d duplicates ignored).", rowsAffected, int64(len(items))-rowsAffected)
	return rowsAffected, nil
}

// GetRecentNewsItems retrieves the most recent news items, limited by the specified count.
func (r *NewsRepository) GetRecentNewsItems(limit int) ([]models.NewsItem, error) {
	log.Printf("Fetching latest %d news items from database...", limit)

	if limit <= 0 {
		limit = 50 // Default limit
	}

	query := `
		SELECT id, source, title, link, image_url, date_str, scraped_at
		FROM news_items
		ORDER BY scraped_at DESC
		LIMIT ?;
	`

	rows, err := r.DB.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent news items: %w", err)
	}
	defer rows.Close()

	var newsItems []models.NewsItem
	for rows.Next() {
		var item models.NewsItem
		err := rows.Scan(
			&item.ID, &item.Source, &item.Title, &item.Link, &item.ImageURL, &item.DateStr, &item.ScrapedAt,
		)
		if err != nil {
			log.Printf("Error scanning news item row: %v", err)
			continue
		}
		newsItems = append(newsItems, item)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during news item rows iteration: %w", err)
	}

	log.Printf("Fetched %d recent news items.", len(newsItems))
	return newsItems, nil
}
