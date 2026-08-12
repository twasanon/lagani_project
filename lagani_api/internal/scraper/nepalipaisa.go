package scraper

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"lagani_api/internal/database"
	"lagani_api/internal/models"
)

const (
	maxNepalipaisaItems = 15 // Fetch more items initially
	// detailFetchDelay     = 500 * time.Millisecond // Original delay if needed
)

// NepalipaisaScraper contains dependencies for scraping Nepalipaisa.
type NepalipaisaScraper struct {
	NewsRepo   *database.NewsRepository
	HTTPClient *http.Client
	BaseURL    string
	NewsAPIURL string
}

type nepalipaisaNewsResponse struct {
	StatusCode int                      `json:"statusCode"`
	Message    string                   `json:"message"`
	Result     []nepalipaisaNewsAPIItem `json:"result"`
}

type nepalipaisaNewsAPIItem struct {
	NewsID            int    `json:"newsId"`
	NewsTitle         string `json:"newsTitle"`
	NewsDateFormatted string `json:"newsDateFormatted"`
	PublishedOn       string `json:"publishedOn"`
	ImageURL          string `json:"imageUrl"`
}

// NewNepalipaisaScraper creates a new NepalipaisaScraper.
func NewNepalipaisaScraper(newsRepo *database.NewsRepository) *NepalipaisaScraper {
	baseURL := strings.TrimRight(getEnvScraper("NEPALIPAISA_BASE_URL", "https://www.nepalipaisa.com"), "/")
	apiPath := getEnvScraper("NEPALIPAISA_NEWS_API_PATH", "/api/GetNewsByCategory")
	return &NepalipaisaScraper{
		NewsRepo:   newsRepo,
		HTTPClient: &http.Client{Timeout: 20 * time.Second},
		BaseURL:    baseURL,
		NewsAPIURL: baseURL + apiPath,
	}
}

// ScrapeNews fetches news from Nepalipaisa and saves it to the database.
// Note: Currently, it doesn't attempt to fetch the date from detail pages
// due to the original implementation's issues and potential site changes.
func (s *NepalipaisaScraper) ScrapeNews() error {
	log.Println("Starting Nepalipaisa news scrape...")

	reqURL, err := url.Parse(s.NewsAPIURL)
	if err != nil {
		return fmt.Errorf("nepalipaisa: invalid news API URL: %w", err)
	}
	query := reqURL.Query()
	query.Set("categoryId", "0")
	query.Set("subCategoryId", "0")
	reqURL.RawQuery = query.Encode()

	req, err := http.NewRequest("GET", reqURL.String(), nil)
	if err != nil {
		return fmt.Errorf("nepalipaisa: failed to create news API request: %w", err)
	}
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("nepalipaisa: failed to execute news API request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("nepalipaisa: news API request failed status %d: %s", resp.StatusCode, truncateForError(bodyBytes))
	}

	var apiResponse nepalipaisaNewsResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 5<<20)).Decode(&apiResponse); err != nil {
		return fmt.Errorf("nepalipaisa: failed to decode news API response: %w", err)
	}
	if apiResponse.StatusCode != http.StatusOK {
		return fmt.Errorf("nepalipaisa: news API returned status %d: %s", apiResponse.StatusCode, apiResponse.Message)
	}

	newsItems := make([]models.NewsItem, 0, min(len(apiResponse.Result), maxNepalipaisaItems))
	for _, item := range apiResponse.Result {
		if len(newsItems) >= maxNepalipaisaItems {
			break
		}
		title := strings.TrimSpace(item.NewsTitle)
		if item.NewsID <= 0 || title == "" {
			continue
		}
		newsItems = append(newsItems, models.NewsItem{
			Source:      "nepalipaisa",
			Title:       title,
			Link:        fmt.Sprintf("%s/news-detail/%d", s.BaseURL, item.NewsID),
			ImageURL:    strings.TrimSpace(item.ImageURL),
			DateStr:     strings.TrimSpace(item.NewsDateFormatted),
			PublishedAt: parseNepalipaisaPublishedAt(item.PublishedOn),
		})
	}

	if len(newsItems) == 0 {
		return fmt.Errorf("nepalipaisa: news API returned no valid news items")
	}

	log.Printf("Nepalipaisa: Parsed %d news items from API.", len(newsItems))

	// Save the parsed items to the database
	rowsAffected, err := s.NewsRepo.SaveNewsItems(newsItems)
	if err != nil {
		return fmt.Errorf("nepalipaisa: failed to save news items to db: %w", err)
	}

	log.Printf("Nepalipaisa: Successfully upserted %d news items.", rowsAffected)
	return nil
}

func parseNepalipaisaPublishedAt(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" || strings.HasPrefix(value, "0001-01-01") {
		return nil
	}
	npt, err := time.LoadLocation("Asia/Kathmandu")
	if err != nil {
		return nil
	}
	parsed, err := time.ParseInLocation("2006-01-02T15:04:05.999999999", value, npt)
	if err != nil {
		return nil
	}
	utc := parsed.UTC()
	return &utc
}
