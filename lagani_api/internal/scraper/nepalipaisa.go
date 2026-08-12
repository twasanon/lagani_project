package scraper

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"lagani_api/internal/database"
	"lagani_api/internal/models"

	"github.com/PuerkitoBio/goquery"
)

var (
	nepalipaisaBaseURLValue = getEnvScraper("NEPALIPAISA_BASE_URL", "https://www.nepalipaisa.com")
	nepalipaisaNewsURLValue = nepalipaisaBaseURLValue + getEnvScraper("NEPALIPAISA_NEWS_PATH", "/")
)

const (
	maxNepalipaisaItems = 15 // Fetch more items initially
	// detailFetchDelay     = 500 * time.Millisecond // Original delay if needed
)

// NepalipaisaScraper contains dependencies for scraping Nepalipaisa.
type NepalipaisaScraper struct {
	NewsRepo   *database.NewsRepository
	HTTPClient *http.Client
}

// NewNepalipaisaScraper creates a new NepalipaisaScraper.
func NewNepalipaisaScraper(newsRepo *database.NewsRepository) *NepalipaisaScraper {
	return &NepalipaisaScraper{
		NewsRepo:   newsRepo,
		HTTPClient: &http.Client{Timeout: 20 * time.Second},
	}
}

// ScrapeNews fetches news from Nepalipaisa and saves it to the database.
// Note: Currently, it doesn't attempt to fetch the date from detail pages
// due to the original implementation's issues and potential site changes.
func (s *NepalipaisaScraper) ScrapeNews() error {
	log.Println("Starting Nepalipaisa news scrape...")

	// Fetch the main news list page
	req, err := http.NewRequest("GET", nepalipaisaNewsURLValue, nil)
	if err != nil {
		return fmt.Errorf("nepalipaisa: failed to create list request: %w", err)
	}
	req.Header.Set("User-Agent", defaultUserAgent)

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("nepalipaisa: failed to execute list request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("nepalipaisa: list request failed status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return fmt.Errorf("nepalipaisa: failed to parse list HTML: %w", err)
	}

	var newsItems []models.NewsItem
	nepalipaisaParsedURL, _ := url.Parse(nepalipaisaBaseURLValue)

	log.Println("Parsing Nepalipaisa news list...")
	doc.Find("div#div-bnews div.bnews-main").Each(func(i int, sel *goquery.Selection) {
		if len(newsItems) >= maxNepalipaisaItems {
			return
		}

		titleLink := sel.Find("div.bnews-title h1 a")
		title := strings.TrimSpace(titleLink.Text())
		relativeLink, _ := titleLink.Attr("href")

		// Handle potential image variations
		imageTag := sel.Find("div.bnews-img img")
		if imageTag.Length() == 0 {
			imageTag = sel.Find("div.bnews-img a img")
		}
		imageURL, _ := imageTag.Attr("src")

		absoluteLink := resolveURL(nepalipaisaParsedURL, relativeLink)

		if title != "" && absoluteLink != "" {
			newsItems = append(newsItems, models.NewsItem{
				Source:   "nepalipaisa", // Set source
				Title:    title,
				Link:     absoluteLink,
				ImageURL: imageURL,
				DateStr:  "", // Date not reliably available from list or detail
				// ScrapedAt will be set by the repository
			})
		} else {
			log.Printf("[WARN] Nepalipaisa List: Skipping item %d due to missing title/link", i)
		}
	})

	if len(newsItems) == 0 {
		log.Println("[WARN] Nepalipaisa: No news items could be parsed from list. Structure might have changed.")
		return nil
	}

	log.Printf("Nepalipaisa: Parsed %d news items from list.", len(newsItems))

	// Save the parsed items to the database
	rowsAffected, err := s.NewsRepo.SaveNewsItems(newsItems)
	if err != nil {
		return fmt.Errorf("nepalipaisa: failed to save news items to db: %w", err)
	}

	log.Printf("Nepalipaisa: Successfully saved %d new news items to database.", rowsAffected)
	return nil
}
