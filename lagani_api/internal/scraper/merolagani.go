package scraper

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"lagani_api/internal/database"
	"lagani_api/internal/models"

	"github.com/PuerkitoBio/goquery"
)

// ErrMerolaganiNoData is returned when Merolagani API indicates no data is available for the query.
var ErrMerolaganiNoData = errors.New("merolagani: no data available for the given query")

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
	BaseURL    string
	NewsURL    string
	ChartURL   string
}

// NewMerolaganiScraper creates a new MerolaganiScraper.
func NewMerolaganiScraper(newsRepo *database.NewsRepository) *MerolaganiScraper {
	baseURL := strings.TrimRight(getEnvScraper("MEROLAGANI_BASE_URL", "https://merolagani.com"), "/")
	return &MerolaganiScraper{
		NewsRepo:   newsRepo,
		HTTPClient: &http.Client{Timeout: 20 * time.Second},
		BaseURL:    baseURL,
		NewsURL:    baseURL + getEnvScraper("MEROLAGANI_NEWS_PATH", "/NewsList.aspx"),
		ChartURL:   baseURL + getEnvScraper("MEROLAGANI_CHART_PATH", "/handlers/TechnicalChartHandler.ashx"),
	}
}

// ScrapeNews fetches news from Merolagani and saves it to the database.
func (s *MerolaganiScraper) ScrapeNews() error {
	log.Println("Starting Merolagani news scrape...")

	req, err := http.NewRequest("GET", s.NewsURL, nil)
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
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("merolagani: request failed with status %d: %s", resp.StatusCode, truncateForError(bodyBytes))
	}

	doc, err := goquery.NewDocumentFromReader(io.LimitReader(resp.Body, 5<<20))
	if err != nil {
		return fmt.Errorf("merolagani: failed to parse HTML: %w", err)
	}

	var newsItems []models.NewsItem
	merolaganiParsedURL, err := url.Parse(s.BaseURL)
	if err != nil {
		return fmt.Errorf("merolagani: invalid base URL: %w", err)
	}

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
				Source:      "merolagani", // Set source
				Title:       title,
				Link:        absoluteLink,
				ImageURL:    absoluteImageURL,
				DateStr:     dateStr,
				PublishedAt: parseMerolaganiPublishedAt(dateStr),
				// ScrapedAt will be set by the repository
			})
		} else {
			log.Printf("[WARN] Merolagani: Skipping item %d due to missing title/link", i)
		}
	})

	if len(newsItems) == 0 {
		return fmt.Errorf("merolagani: no news items could be parsed; page structure may have changed")
	}

	log.Printf("Merolagani: Parsed %d news items.", len(newsItems))

	// Save the parsed items to the database
	rowsAffected, err := s.NewsRepo.SaveNewsItems(newsItems)
	if err != nil {
		return fmt.Errorf("merolagani: failed to save news items to db: %w", err)
	}

	log.Printf("Merolagani: Successfully upserted %d news items.", rowsAffected)
	return nil
}

// FetchChartData fetches historical chart data for a given symbol from Merolagani.
func (s *MerolaganiScraper) FetchChartData(symbol string, resolution string, rangeStartDate int64, rangeEndDate int64, isAdjust bool) ([]ChartDataPoint, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	resolution = strings.ToUpper(strings.TrimSpace(resolution))
	if symbol == "" || (resolution != "1D" && resolution != "1W" && resolution != "1M") || rangeStartDate <= 0 || rangeEndDate <= rangeStartDate {
		return nil, fmt.Errorf("merolagani: invalid chart symbol, resolution, or date range")
	}
	log.Printf("Merolagani Scraper: Fetching chart data for Symbol %s, Resolution: %s, Start: %d, End: %d, Adjust: %t",
		symbol, resolution, rangeStartDate, rangeEndDate, isAdjust)

	isAdjustStr := "0"
	if isAdjust {
		isAdjustStr = "1"
	}

	// Construct the URL with query parameters
	reqURL, err := url.Parse(s.ChartURL)
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
	req.Header.Set("Referer", fmt.Sprintf("%s/CompanyDetail.aspx?symbol=%s", s.BaseURL, symbol))
	req.Header.Set("Accept", "text/plain; charset=utf-8") // As seen in browser
	// Add other headers if needed, e.g. X-Requested-With, sec-ch-ua etc but start minimal

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("merolagani: failed to execute chart data request for %s: %w", symbol, err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		return nil, fmt.Errorf("merolagani: failed to read chart data response body for %s: %w", symbol, err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("merolagani: chart data request for %s failed status %d: %s", symbol, resp.StatusCode, truncateForError(bodyBytes))
	}

	var chartResponse MerolaganiChartResponse
	if err := json.Unmarshal(bodyBytes, &chartResponse); err != nil {
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
	dataPoints := make([]ChartDataPoint, 0, lenT)
	normalizedCandles := 0
	skippedCandles := 0
	for i := 0; i < lenT; i++ {
		if !isUsableMerolaganiCandle(
			chartResponse.T[i],
			chartResponse.O[i],
			chartResponse.H[i],
			chartResponse.L[i],
			chartResponse.C[i],
			chartResponse.V[i],
		) {
			skippedCandles++
			continue
		}
		open, high, low, close := normalizeMerolaganiOHLC(
			chartResponse.O[i],
			chartResponse.H[i],
			chartResponse.L[i],
			chartResponse.C[i],
		)
		if high != chartResponse.H[i] || low != chartResponse.L[i] {
			normalizedCandles++
		}
		dataPoints = append(dataPoints, ChartDataPoint{
			Timestamp: chartResponse.T[i],
			Open:      open,
			High:      high,
			Low:       low,
			Close:     close,
			Volume:    chartResponse.V[i],
		})
	}
	if skippedCandles > 0 {
		log.Printf("[WARN] Merolagani Chart: Skipped %d candle(s) with non-positive/non-finite prices, invalid timestamps, or negative volume for %s.", skippedCandles, symbol)
	}
	if normalizedCandles > 0 {
		log.Printf("[WARN] Merolagani Chart: Normalized %d adjusted candle(s) with inconsistent high/low bounds for %s.", normalizedCandles, symbol)
	}

	log.Printf("Merolagani Scraper: Successfully fetched and processed %d chart data points for %s.", len(dataPoints), symbol)
	return dataPoints, nil
}

func isUsableMerolaganiCandle(timestamp int64, open, high, low, close, volume float64) bool {
	if timestamp <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0 {
		return false
	}
	for _, value := range []float64{open, high, low, close, volume} {
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return false
		}
	}
	return true
}

// normalizeMerolaganiOHLC repairs a documented property of the provider's
// adjusted series: corporate-action adjustments and per-field rounding can
// leave high below open/close or low above open/close. Expanding the bounds is
// lossless for the quoted open and close and prevents one historical anomaly
// from discarding an otherwise valid multi-year series.
func normalizeMerolaganiOHLC(open, high, low, close float64) (float64, float64, float64, float64) {
	if open > high {
		high = open
	}
	if close > high {
		high = close
	}
	if open < low {
		low = open
	}
	if close < low {
		low = close
	}
	return open, high, low, close
}

func parseMerolaganiPublishedAt(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	npt, err := time.LoadLocation("Asia/Kathmandu")
	if err != nil {
		return nil
	}
	parsed, err := time.ParseInLocation("Jan 2, 2006 03:04 PM", value, npt)
	if err != nil {
		return nil
	}
	utc := parsed.UTC()
	return &utc
}
