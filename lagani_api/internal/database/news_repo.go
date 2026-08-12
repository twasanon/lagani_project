package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
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

// SaveNewsItems inserts or refreshes multiple news items, keyed by link.
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

	// Refresh mutable metadata for articles already seen. The original scraped_at
	// is retained so duplicates cannot jump to the top of the feed.
	stmt, err := tx.Prepare(`
		INSERT INTO news_items (source, title, link, image_url, date_str, published_at, scraped_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(link) DO UPDATE SET
			source = excluded.source,
			title = excluded.title,
			image_url = excluded.image_url,
			date_str = excluded.date_str,
			published_at = COALESCE(excluded.published_at, news_items.published_at);
	`)
	if err != nil {
		return 0, fmt.Errorf("failed to prepare news item insert statement: %w", err)
	}
	defer stmt.Close()

	now := time.Now().UTC()
	rowsAffected := int64(0)

	for _, item := range items {
		item.Source = strings.ToLower(strings.TrimSpace(item.Source))
		item.Title = strings.TrimSpace(item.Title)
		item.Link = strings.TrimSpace(item.Link)
		if item.Source == "" || item.Title == "" || item.Link == "" {
			return 0, fmt.Errorf("invalid news item with source=%q title=%q link=%q", item.Source, item.Title, item.Link)
		}
		result, err := stmt.Exec(
			item.Source,
			item.Title,
			item.Link,
			item.ImageURL,
			item.DateStr,
			item.PublishedAt,
			now,
		)
		if err != nil {
			return 0, fmt.Errorf("failed to upsert news item %q: %w", item.Title, err)
		}
		count, _ := result.RowsAffected()
		rowsAffected += count
	}

	if err = tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit news item transaction: %w", err)
	}

	log.Printf("Successfully upserted %d news items.", rowsAffected)
	return rowsAffected, nil
}

// GetRecentNewsItems retrieves the most recent news items, limited by the specified count.
func (r *NewsRepository) GetRecentNewsItems(limit int) ([]models.NewsItem, error) {
	log.Printf("Fetching latest %d news items from database...", limit)

	if limit <= 0 {
		limit = 50 // Default limit
	}

	query := `
		SELECT id, source, title, link, image_url, date_str, published_at, scraped_at
		FROM news_items
		ORDER BY COALESCE(published_at, scraped_at) DESC, id DESC
		LIMIT ?;
	`

	rows, err := r.DB.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent news items: %w", err)
	}
	defer rows.Close()

	newsItems := make([]models.NewsItem, 0)
	for rows.Next() {
		var item models.NewsItem
		var publishedAt sql.NullTime
		err := rows.Scan(
			&item.ID, &item.Source, &item.Title, &item.Link, &item.ImageURL, &item.DateStr, &publishedAt, &item.ScrapedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan news item row: %w", err)
		}
		if publishedAt.Valid {
			value := publishedAt.Time.UTC()
			item.PublishedAt = &value
		}
		newsItems = append(newsItems, item)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during news item rows iteration: %w", err)
	}

	log.Printf("Fetched %d recent news items.", len(newsItems))
	return newsItems, nil
}
