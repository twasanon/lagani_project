package scraper

import (
	"encoding/json"
	"errors"
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
	merolaganiBaseURLValue  = getEnvScraper("MEROLAGANI_BASE_URL", "https://merolagani.com")
	merolaganiNewsURLValue  = merolaganiBaseURLValue + getEnvScraper("MEROLAGANI_NEWS_PATH", "/NewsList.aspx")
	merolaganiChartURLValue = merolaganiBaseURLValue + "/handlers/TechnicalChartHandler.ashx"

	// ErrMerolaganiNoData is returned when Merolagani API indicates no data is available for the query.
	ErrMerolaganiNoData = errors.New("merolagani: no data available for the given query")
)

const (
	maxMerolaganiItems = 15 // Fetch more items initially
	// Define a default user agent, similar to what a browser might send
	defaultUserAgentMerolagani = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
)

// MerolaganiChartResponse matches the raw JSON structure from Merolagani's chart API.
type MerolaganiChartResponse struct {
	T []int64   `json:"t"` // Timestamps
	O []float64 `json:"o"` // Open prices
	H []float64 `json:"h"` // High prices
	L []float64 `json:"l"` // Low prices
	C []float64 `json:"c"` // Close prices
	V []float64 `json:"v"` // Volumes
	S string    `json:"s"` // Status (e.g., "ok")
}

// ChartDataPoint is a generic struct to hold a single OHLCV data point.
type ChartDataPoint struct {
	Timestamp int64   `json:"timestamp"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
}

// MerolaganiScraper contains dependencies for scraping Merolagani.
type MerolaganiScraper struct {
	NewsRepo   *database.NewsRepository
	HTTPClient *http.Client
}

// NewMerolaganiScraper creates a new MerolaganiScraper.
func NewMerolaganiScraper(newsRepo *database.NewsRepository) *MerolaganiScraper {
	return &MerolaganiScraper{
		NewsRepo:   newsRepo,
		HTTPClient: &http.Client{Timeout: 20 * time.Second},
	}
}

// ScrapeNews fetches news from Merolagani and saves it to the database.
func (s *MerolaganiScraper) ScrapeNews() error {
	log.Println("Starting Merolagani news scrape...")

	req, err := http.NewRequest("GET", merolaganiNewsURLValue, nil)
	if err != nil {
		return fmt.Errorf("merolagani: failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", defaultUserAgent) // Use a common user agent

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("merolagani: failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("merolagani: request failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return fmt.Errorf("merolagani: failed to parse HTML: %w", err)
	}

	var newsItems []models.NewsItem
	merolaganiParsedURL, _ := url.Parse(merolaganiBaseURLValue)

	doc.Find("div.news-list div.media-news").Each(func(i int, sel *goquery.Selection) {
		if len(newsItems) >= maxMerolaganiItems {
			return // Stop processing if we have enough items
		}

		titleLink := sel.Find("h4.media-title a")
		title := strings.TrimSpace(titleLink.Text())
		relativeLink, _ := titleLink.Attr("href")
		imageTag := sel.Find("div.media-wrap img")
		relativeImageURL, _ := imageTag.Attr("src")
		// Clean up the date string
		dateStr := strings.TrimSpace(sel.Find("span.media-label").Text())
		dateStr = strings.Join(strings.Fields(dateStr), " ")

		absoluteLink := resolveURL(merolaganiParsedURL, relativeLink)         // Use shared helper
		absoluteImageURL := resolveURL(merolaganiParsedURL, relativeImageURL) // Use shared helper

		if title != "" && absoluteLink != "" {
			newsItems = append(newsItems, models.NewsItem{
				Source:   "merolagani", // Set source
				Title:    title,
				Link:     absoluteLink,
				ImageURL: absoluteImageURL,
				DateStr:  dateStr,
				// ScrapedAt will be set by the repository
			})
		} else {
			log.Printf("[WARN] Merolagani: Skipping item %d due to missing title/link", i)
		}
	})

	if len(newsItems) == 0 {
		log.Println("[WARN] Merolagani: No news items could be parsed. Structure might have changed.")
		// Return nil error, as it might not be a fatal error, just no news
		return nil
	}

	log.Printf("Merolagani: Parsed %d news items.", len(newsItems))

	// Save the parsed items to the database
	rowsAffected, err := s.NewsRepo.SaveNewsItems(newsItems)
	if err != nil {
		return fmt.Errorf("merolagani: failed to save news items to db: %w", err)
	}

	log.Printf("Merolagani: Successfully saved %d new news items to database.", rowsAffected)
	return nil
}

// FetchChartData fetches historical chart data for a given symbol from Merolagani.
func (s *MerolaganiScraper) FetchChartData(symbol string, resolution string, rangeStartDate int64, rangeEndDate int64, isAdjust bool) ([]ChartDataPoint, error) {
	log.Printf("Merolagani Scraper: Fetching chart data for Symbol %s, Resolution: %s, Start: %d, End: %d, Adjust: %t",
		symbol, resolution, rangeStartDate, rangeEndDate, isAdjust)

	isAdjustStr := "0"
	if isAdjust {
		isAdjustStr = "1"
	}

	// Construct the URL with query parameters
	reqURL, err := url.Parse(merolaganiChartURLValue)
	if err != nil {
		return nil, fmt.Errorf("merolagani: failed to parse chart base URL: %w", err)
	}
	queryParams := url.Values{}
	queryParams.Set("type", "get_advanced_chart")
	queryParams.Set("symbol", symbol)
	queryParams.Set("resolution", resolution)
	queryParams.Set("rangeStartDate", fmt.Sprintf("%d", rangeStartDate))
	queryParams.Set("rangeEndDate", fmt.Sprintf("%d", rangeEndDate))
	queryParams.Set("from", "") // Empty as per example
	queryParams.Set("isAdjust", isAdjustStr)
	queryParams.Set("currencyCode", "NPR")
	reqURL.RawQuery = queryParams.Encode()

	fullURL := reqURL.String()
	log.Printf("Merolagani Scraper: Requesting chart data from URL: %s", fullURL)

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("merolagani: failed to create chart data request for %s: %w", symbol, err)
	}

	// Set headers - Referer is important
	req.Header.Set("User-Agent", defaultUserAgentMerolagani)
	req.Header.Set("Referer", fmt.Sprintf("%s/CompanyDetail.aspx?symbol=%s", merolaganiBaseURLValue, symbol))
	req.Header.Set("Accept", "text/plain; charset=utf-8") // As seen in browser
	// Add other headers if needed, e.g. X-Requested-With, sec-ch-ua etc but start minimal

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("merolagani: failed to execute chart data request for %s: %w", symbol, err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("merolagani: failed to read chart data response body for %s: %w", symbol, err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("[ERROR] Merolagani Chart: Request for %s failed. Status: %d. Body: %s", symbol, resp.StatusCode, string(bodyBytes))
		return nil, fmt.Errorf("merolagani: chart data request for %s failed status %d: %s", symbol, resp.StatusCode, string(bodyBytes))
	}

	var chartResponse MerolaganiChartResponse
	if err := json.Unmarshal(bodyBytes, &chartResponse); err != nil {
		log.Printf("[ERROR] Merolagani Chart: Failed to decode JSON for %s. Body: %s", symbol, string(bodyBytes))
		return nil, fmt.Errorf("merolagani: failed to decode chart data JSON for %s: %w", symbol, err)
	}

	if chartResponse.S == "no_data" {
		log.Printf("[INFO] Merolagani Chart: API reported status 'no_data' for symbol %s. Full Response: %+v", symbol, chartResponse)
		return nil, fmt.Errorf("%w: symbol %s, api_status %s", ErrMerolaganiNoData, symbol, chartResponse.S)
	} else if chartResponse.S != "ok" {
		log.Printf("[ERROR] Merolagani Chart: API reported an error for %s. Status: %s. Full Response: %+v", symbol, chartResponse.S, chartResponse)
		return nil, fmt.Errorf("merolagani: chart API reported status '%s' for symbol %s", chartResponse.S, symbol)
	}

	// Ensure all arrays have the same length
	lenT := len(chartResponse.T)
	if lenT == 0 {
		log.Printf("[WARN] Merolagani Chart: No data points returned for %s (timestamps array is empty).", symbol)
		return []ChartDataPoint{}, nil // Return empty slice, not an error
	}
	if len(chartResponse.O) != lenT || len(chartResponse.H) != lenT || len(chartResponse.L) != lenT ||
		len(chartResponse.C) != lenT || len(chartResponse.V) != lenT {
		log.Printf("[ERROR] Merolagani Chart: Mismatch in array lengths for %s. T:%d, O:%d, H:%d, L:%d, C:%d, V:%d",
			symbol, lenT, len(chartResponse.O), len(chartResponse.H), len(chartResponse.L), len(chartResponse.C), len(chartResponse.V))
		return nil, fmt.Errorf("merolagani: chart data arrays have inconsistent lengths for %s", symbol)
	}

	// Convert to []ChartDataPoint
	dataPoints := make([]ChartDataPoint, lenT)
	for i := 0; i < lenT; i++ {
		dataPoints[i] = ChartDataPoint{
			Timestamp: chartResponse.T[i],
			Open:      chartResponse.O[i],
			High:      chartResponse.H[i],
			Low:       chartResponse.L[i],
			Close:     chartResponse.C[i],
			Volume:    chartResponse.V[i],
		}
	}

	log.Printf("Merolagani Scraper: Successfully fetched and processed %d chart data points for %s.", len(dataPoints), symbol)
	return dataPoints, nil
}
