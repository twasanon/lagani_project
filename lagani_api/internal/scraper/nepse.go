package scraper

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"lagani_api/internal/database"
	"lagani_api/internal/models"

	"github.com/wasmerio/wasmer-go/wasmer"
)

// Helper function (could be moved to a shared utils package)
func getEnvScraper(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// Constants related to NEPSE scraping
// Read URLs from environment variables
var (
	nepseBaseURLValue    = getEnvScraper("NEPSE_BASE_URL", "https://nepalstock.com.np")
	proveURLValue        = nepseBaseURLValue + getEnvScraper("NEPSE_PROVE_PATH", "/api/authenticate/prove")
	companyListURLValue  = nepseBaseURLValue + getEnvScraper("NEPSE_COMPANY_LIST_PATH", "/api/nots/company/list")
	dailyStatsURLValue   = nepseBaseURLValue + getEnvScraper("NEPSE_DAILY_STATS_PATH", "/api/nots/securityDailyTradeStat/58")
	topGainersURLValue   = nepseBaseURLValue + getEnvScraper("NEPSE_TOP_GAINERS_PATH", "/api/nots/top-ten/top-gainer?all=true")
	topLosersURLValue    = nepseBaseURLValue + getEnvScraper("NEPSE_TOP_LOSERS_PATH", "/api/nots/top-ten/top-loser?all=true")
	marketStatusURLValue = nepseBaseURLValue + getEnvScraper("NEPSE_MARKET_STATUS_PATH", "/api/nots/nepse-data/market-open")
	// Add new URL for graph data
	graphDataURLFormat = nepseBaseURLValue + getEnvScraper("NEPSE_GRAPH_DATA_PATH_FORMAT", "/api/nots/market/graphdata/%d")
)

const (
	// Constants that are less likely to change or not URLs
	nepseRequestDelay  = 1 * time.Second
	tokenCacheDuration = 45 * time.Second
	maxTopMovers       = 10
)

// --- Structs specific to NEPSE API responses ---

// ProveResponse stores the raw response from the /prove endpoint.
type ProveResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	Salt1        int64  `json:"salt1"`
	Salt2        int64  `json:"salt2"`
	Salt3        int64  `json:"salt3"`
	Salt4        int64  `json:"salt4"`
	Salt5        int64  `json:"salt5"`
	ServerTime   int64  `json:"serverTime"`
}

// NepseCompanyListItem matches the structure of items in the NEPSE company list API.
type NepseCompanyListItem struct {
	ID           int    `json:"id"`
	CompanyName  string `json:"companyName"`
	Symbol       string `json:"symbol"`
	SecurityName string `json:"securityName"`
	Status       string `json:"status"`
}

// NepseDailyTradeStat matches the structure from the NEPSE daily stats API.
type NepseDailyTradeStat struct {
	SecurityID         json.Number `json:"securityId"`
	SecurityName       string      `json:"securityName"`
	Symbol             string      `json:"symbol"`
	IndexID            int         `json:"indexId"`
	OpenPrice          float64     `json:"openPrice"` // Added missing fields
	HighPrice          float64     `json:"highPrice"`
	LowPrice           float64     `json:"lowPrice"`
	TotalTradeQuantity int64       `json:"totalTradeQuantity"`
	LastTradedPrice    float64     `json:"lastTradedPrice"`
	PercentageChange   float64     `json:"percentageChange"`
	PreviousClose      float64     `json:"previousClose"`
	FiftyTwoWeekHigh   float64     `json:"fiftyTwoWeekHigh"` // Added
	FiftyTwoWeekLow    float64     `json:"fiftyTwoWeekLow"`  // Added
}

// NepseTopGainerLoser matches the structure from the NEPSE top gainers/losers API.
type NepseTopGainerLoser struct {
	Symbol           string  `json:"symbol"`
	LTP              float64 `json:"ltp"`
	PointChange      float64 `json:"pointChange"`
	PercentageChange float64 `json:"percentageChange"`
	SecurityID       int64   `json:"securityId"`
	SecurityName     string  `json:"securityName"`
}

// NepseMarketStatus matches the structure from the NEPSE market status API.
type NepseMarketStatus struct {
	ID     int    `json:"id"`
	IsOpen string `json:"isOpen"`
	AsOf   string `json:"asOf"`
}

// NepseGraphDataPoint matches the structure of items in the NEPSE graph data API response.
type NepseGraphDataPoint struct {
	BusinessDate          string  `json:"businessDate"`
	OpenPrice             float64 `json:"openPrice"`
	HighPrice             float64 `json:"highPrice"`
	LowPrice              float64 `json:"lowPrice"`
	PreviousDayClosePrice float64 `json:"previousDayClosePrice"`
	ClosePrice            float64 `json:"closePrice"`
	LastTradedPrice       float64 `json:"lastTradedPrice"`
	TotalTradedQuantity   int64   `json:"totalTradedQuantity"`
	FiftyTwoWeekHigh      float64 `json:"fiftyTwoWeekHigh"`
	// FiftyTwoWeekLow is present in other structs, but not explicitly in user's graph data preview.
	// Add it if needed, otherwise, it will be ignored during unmarshalling if not present in API response.
	// FiftyTwoWeekLow float64 `json:"fiftyTwoWeekLow"`
}

// --- NepseScraper ---

// NepseScraper holds dependencies and state for scraping NEPSE.
type NepseScraper struct {
	CompanyRepo *database.CompanyRepository
	PriceRepo   *database.PriceRepository
	MoverRepo   *database.MoverRepository
	StatusRepo  *database.MarketStatusRepository
	HTTPClient  *http.Client

	// WASM related fields (initialized once)
	wasmFilePath string // Store the path read from env
	wasmEngine   *wasmer.Engine
	wasmStore    *wasmer.Store
	wasmModule   *wasmer.Module
	wasmInstance *wasmer.Instance
	initWasmErr  error
	initWasmOnce sync.Once

	// Token state
	currentToken       string
	currentTokenExpiry time.Time
	tokenMutex         sync.Mutex // Use a simple mutex for token updates

	marketStatusMutex     sync.Mutex
	currentMarketStatusID int
}

// The NEPSE web client uses this server-provided market-status ID as an index
// into a static challenge table when creating graph endpoint request bodies.
// This table mirrors the current official client bundle. Bounds checks and a
// live integration test make upstream changes fail loudly instead of silently
// returning HTTP 500 responses.
var nepseDummyData = [...]int{
	147, 117, 239, 143, 157, 312, 161, 612, 512, 804,
	411, 527, 170, 511, 421, 667, 764, 621, 301, 106,
	133, 793, 411, 511, 312, 423, 344, 346, 653, 758,
	342, 222, 236, 811, 711, 611, 122, 447, 128, 199,
	183, 135, 489, 703, 800, 745, 152, 863, 134, 211,
	142, 564, 375, 793, 212, 153, 138, 153, 648, 611,
	151, 649, 318, 143, 117, 756, 119, 141, 717, 113,
	112, 146, 162, 660, 693, 261, 362, 354, 251, 641,
	157, 178, 631, 192, 734, 445, 192, 883, 187, 122,
	591, 731, 852, 384, 565, 596, 451, 772, 624, 691,
}

// NewNepseScraper creates a new NepseScraper.
func NewNepseScraper(
	companyRepo *database.CompanyRepository,
	priceRepo *database.PriceRepository,
	moverRepo *database.MoverRepository,
	statusRepo *database.MarketStatusRepository,
) *NepseScraper {
	wasmPath := getEnvScraper("WASM_FILE", "./css.wasm") // Read env var or default
	s := &NepseScraper{
		CompanyRepo:  companyRepo,
		PriceRepo:    priceRepo,
		MoverRepo:    moverRepo,
		StatusRepo:   statusRepo,
		HTTPClient:   &http.Client{Timeout: 20 * time.Second},
		wasmFilePath: wasmPath, // Store the path
	}
	// Initialize WASM eagerly but handle potential error later
	s.initializeWasm()
	return s
}

// --- WASM Initialization (scoped to NepseScraper) ---
func (s *NepseScraper) initializeWasm() {
	s.initWasmOnce.Do(func() {
		log.Println("NEPSE Scraper: Initializing WASM environment...")
		wasmBytes, err := os.ReadFile(s.wasmFilePath) // Use stored path
		if err != nil {
			s.initWasmErr = fmt.Errorf("failed to read WASM file %s: %w", s.wasmFilePath, err)
			log.Printf("[ERROR] NEPSE WASM: %v", s.initWasmErr)
			return
		}

		s.wasmEngine = wasmer.NewEngine()
		s.wasmStore = wasmer.NewStore(s.wasmEngine)
		s.wasmModule, err = wasmer.NewModule(s.wasmStore, wasmBytes)
		if err != nil {
			s.initWasmErr = fmt.Errorf("failed to compile WASM module: %w", err)
			log.Printf("[ERROR] NEPSE WASM: %v", s.initWasmErr)
			return
		}

		importObject := wasmer.NewImportObject()
		s.wasmInstance, err = wasmer.NewInstance(s.wasmModule, importObject)
		if err != nil {
			s.initWasmErr = fmt.Errorf("failed to instantiate WASM module: %w", err)
			log.Printf("[ERROR] NEPSE WASM: %v", s.initWasmErr)
			return
		}
		log.Println("NEPSE Scraper: WASM Initialized Successfully")
	})
}

// --- Token Management (scoped to NepseScraper) ---
func (s *NepseScraper) fetchProveData() (*ProveResponse, error) {
	log.Println("NEPSE Scraper: Waiting before fetching proof data...")
	time.Sleep(nepseRequestDelay)
	log.Println("NEPSE Scraper: Fetching proof data...")
	req, err := http.NewRequest("GET", proveURLValue, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create prove request: %w", err)
	}
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("User-Agent", defaultUserAgent)

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute prove request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("prove request failed status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var proveResp ProveResponse
	if err := json.NewDecoder(resp.Body).Decode(&proveResp); err != nil {
		return nil, fmt.Errorf("failed to decode prove response JSON: %w", err)
	}

	log.Println("NEPSE Scraper: Successfully fetched proof data")
	return &proveResp, nil
}

func (s *NepseScraper) calculateSalterToken(prove *ProveResponse) (string, error) {
	log.Println("NEPSE Scraper: Calculating Salter token using WASM...")
	// Ensure WASM is initialized
	s.initializeWasm()
	if s.initWasmErr != nil {
		return "", fmt.Errorf("WASM initialization failed: %w", s.initWasmErr)
	}
	if s.wasmInstance == nil {
		return "", errors.New("WASM instance is nil after initialization attempt")
	}

	// Get WASM functions
	cdx, err := s.wasmInstance.Exports.GetFunction("cdx")
	if err != nil {
		return "", fmt.Errorf("wasm get cdx failed: %w", err)
	}
	rdx, err := s.wasmInstance.Exports.GetFunction("rdx")
	if err != nil {
		return "", fmt.Errorf("wasm get rdx failed: %w", err)
	}
	bdx, err := s.wasmInstance.Exports.GetFunction("bdx")
	if err != nil {
		return "", fmt.Errorf("wasm get bdx failed: %w", err)
	}
	ndx, err := s.wasmInstance.Exports.GetFunction("ndx")
	if err != nil {
		return "", fmt.Errorf("wasm get ndx failed: %w", err)
	}
	mdx, err := s.wasmInstance.Exports.GetFunction("mdx")
	if err != nil {
		return "", fmt.Errorf("wasm get mdx failed: %w", err)
	}

	salt1_32 := int32(prove.Salt1)
	salt2_32 := int32(prove.Salt2)
	salt3_32 := int32(prove.Salt3)
	salt4_32 := int32(prove.Salt4)
	salt5_32 := int32(prove.Salt5)

	// Call WASM functions
	nVal, err := cdx(salt1_32, salt2_32, salt3_32, salt4_32, salt5_32)
	if err != nil {
		return "", fmt.Errorf("wasm cdx call failed: %w", err)
	}
	lVal, err := rdx(salt1_32, salt2_32, salt4_32, salt3_32, salt5_32)
	if err != nil {
		return "", fmt.Errorf("wasm rdx call failed: %w", err)
	}
	oVal, err := bdx(salt1_32, salt2_32, salt4_32, salt3_32, salt5_32)
	if err != nil {
		return "", fmt.Errorf("wasm bdx call failed: %w", err)
	}
	pVal, err := ndx(salt1_32, salt2_32, salt4_32, salt3_32, salt5_32)
	if err != nil {
		return "", fmt.Errorf("wasm ndx call failed: %w", err)
	}
	qVal, err := mdx(salt1_32, salt2_32, salt4_32, salt3_32, salt5_32)
	if err != nil {
		return "", fmt.Errorf("wasm mdx call failed: %w", err)
	}

	n := int(nVal.(int32))
	l := int(lVal.(int32))
	o := int(oVal.(int32))
	p := int(pVal.(int32))
	q := int(qVal.(int32))

	accessToken := prove.AccessToken
	var builder strings.Builder
	if n < 0 || l <= n || o <= l || p <= o || q <= p || q >= len(accessToken) {
		return "", fmt.Errorf("invalid indices calculated by WASM: n=%d, l=%d, o=%d, p=%d, q=%d, len=%d", n, l, o, p, q, len(accessToken))
	}

	builder.WriteString(accessToken[0:n])
	builder.WriteString(accessToken[n+1 : l])
	builder.WriteString(accessToken[l+1 : o])
	builder.WriteString(accessToken[o+1 : p])
	builder.WriteString(accessToken[p+1 : q])
	builder.WriteString(accessToken[q+1:])

	parsedToken := builder.String()
	log.Printf("NEPSE Scraper: Calculated Salter token (len: %d)", len(parsedToken))
	return parsedToken, nil
}

// getValidToken returns a valid Salter token, fetching/recalculating if necessary.
func (s *NepseScraper) getValidToken() (string, error) {
	s.tokenMutex.Lock()
	defer s.tokenMutex.Unlock()

	if time.Now().Before(s.currentTokenExpiry) {
		log.Println("NEPSE Scraper: Using cached Salter token")
		return s.currentToken, nil
	}

	log.Println("NEPSE Scraper: Token cache expired or invalid, fetching new proof...")
	proveData, err := s.fetchProveData()
	if err != nil {
		return "", fmt.Errorf("failed to get prove data: %w", err)
	}

	newToken, err := s.calculateSalterToken(proveData)
	if err != nil {
		return "", fmt.Errorf("failed to calculate token: %w", err)
	}

	// Update token state within the scraper instance
	s.currentToken = newToken
	s.currentTokenExpiry = time.Now().Add(tokenCacheDuration)
	log.Println("NEPSE Scraper: Token cache updated")

	return newToken, nil
}

func (s *NepseScraper) getMarketStatusID() (int, error) {
	s.marketStatusMutex.Lock()
	defer s.marketStatusMutex.Unlock()
	if s.currentMarketStatusID > 0 {
		return s.currentMarketStatusID, nil
	}

	var status NepseMarketStatus
	if err := s.fetchNepseDataAuth(marketStatusURLValue, &status); err != nil {
		return 0, fmt.Errorf("failed to fetch market status challenge ID: %w", err)
	}
	if status.ID <= 0 || status.ID >= len(nepseDummyData) {
		return 0, fmt.Errorf("NEPSE returned unsupported market status ID %d", status.ID)
	}
	s.currentMarketStatusID = status.ID
	return status.ID, nil
}

func nepseGraphRequestID(marketStatusID int, now time.Time) (int, error) {
	if marketStatusID <= 0 || marketStatusID >= len(nepseDummyData) {
		return 0, fmt.Errorf("market status ID %d is outside the NEPSE challenge table", marketStatusID)
	}
	npt, err := time.LoadLocation("Asia/Kathmandu")
	if err != nil {
		return 0, fmt.Errorf("failed to load Asia/Kathmandu timezone: %w", err)
	}
	day := now.In(npt).Day()
	return nepseDummyData[marketStatusID] + marketStatusID + 2*day, nil
}

// --- Generic Fetch Function (Auth Required) ---
func (s *NepseScraper) fetchNepseDataAuth(url string, target interface{}) error {
	for attempt := 0; attempt < 2; attempt++ {
		salterToken, err := s.getValidToken()
		if err != nil {
			return fmt.Errorf("fetchNepseDataAuth: failed to get valid token: %w", err)
		}

		time.Sleep(nepseRequestDelay)
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return fmt.Errorf("fetchNepseDataAuth: failed to create request for %s: %w", url, err)
		}
		req.Header.Set("Authorization", "Salter "+salterToken)
		req.Header.Set("Accept", "application/json, text/plain, */*")
		req.Header.Set("User-Agent", defaultUserAgent)
		req.Header.Set("Referer", nepseBaseURLValue)

		resp, err := s.HTTPClient.Do(req)
		if err != nil {
			return fmt.Errorf("fetchNepseDataAuth: failed to execute request for %s: %w", url, err)
		}
		bodyBytes, readErr := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
		resp.Body.Close()
		if readErr != nil {
			return fmt.Errorf("fetchNepseDataAuth: failed to read response body for %s: %w", url, readErr)
		}

		if (resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden) && attempt == 0 {
			s.tokenMutex.Lock()
			s.currentToken = ""
			s.currentTokenExpiry = time.Time{}
			s.tokenMutex.Unlock()
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("fetchNepseDataAuth: request to %s failed status %d: %s", url, resp.StatusCode, truncateForError(bodyBytes))
		}

		if err := json.Unmarshal(bodyBytes, target); err != nil {
			return fmt.Errorf("fetchNepseDataAuth: failed to decode JSON for %s: %w", url, err)
		}
		return nil
	}
	return fmt.Errorf("fetchNepseDataAuth: authentication retry exhausted for %s", url)
}

// --- Scrape Methods ---

// ScrapeCompanies fetches the company list from NEPSE and saves it to the database.
func (s *NepseScraper) ScrapeCompanies() error {
	log.Println("NEPSE Scraper: Starting company scrape...")
	var nepseCompanies []NepseCompanyListItem

	if err := s.fetchNepseDataAuth(companyListURLValue, &nepseCompanies); err != nil {
		return fmt.Errorf("nepse: failed to fetch company list: %w", err)
	}

	// Transform to models.Company
	activeCompanies := make([]models.Company, 0, len(nepseCompanies))
	for _, nc := range nepseCompanies {
		if nc.Status == "A" { // Only save active companies
			activeCompanies = append(activeCompanies, models.Company{
				SecurityID: nc.ID, // Use the ID field from Nepse response as SecurityID
				Symbol:     strings.TrimSpace(nc.Symbol),
				Name:       strings.TrimSpace(nc.SecurityName),
				// UpdatedAt will be set by the repository
			})
		}
	}

	if len(activeCompanies) == 0 {
		log.Println("[WARN] NEPSE Scraper: No active companies found in the fetched list.")
		return nil // Not necessarily an error
	}

	log.Printf("NEPSE Scraper: Fetched %d active companies.", len(activeCompanies))

	// Save to DB
	if err := s.CompanyRepo.SaveCompanies(activeCompanies); err != nil {
		return fmt.Errorf("nepse: failed to save companies: %w", err)
	}

	log.Println("NEPSE Scraper: Successfully scraped and saved companies.")
	return nil
}

// ScrapePrices fetches daily price stats from NEPSE and saves them to the database.
func (s *NepseScraper) ScrapePrices() error {
	log.Println("NEPSE Scraper: Starting price scrape...")
	var nepseStats []NepseDailyTradeStat

	if err := s.fetchNepseDataAuth(dailyStatsURLValue, &nepseStats); err != nil {
		return fmt.Errorf("nepse: failed to fetch price stats: %w", err)
	}

	if len(nepseStats) == 0 {
		log.Println("NEPSE Scraper: No daily trade stats found (market may be closed or no data available). Price list will not be updated.")
		// BUGFIX: Do not clear the prices table. Let the old prices remain.
		// if err := s.PriceRepo.ClearAllPrices(); err != nil {
		// 	return fmt.Errorf("failed to clear prices table: %w", err)
		// }
		return nil // Return gracefully without error
	}

	// Transform to models.Price
	prices := make([]models.Price, 0, len(nepseStats))
	for _, ns := range nepseStats {
		previousClose, change := normalizeDailyChange(ns.LastTradedPrice, ns.PreviousClose, ns.PercentageChange)
		prices = append(prices, models.Price{
			Symbol:          strings.TrimSpace(ns.Symbol),
			SecurityName:    strings.TrimSpace(ns.SecurityName),
			OpenPrice:       ns.OpenPrice,
			HighPrice:       ns.HighPrice,
			LowPrice:        ns.LowPrice,
			LastTradedPrice: ns.LastTradedPrice,
			PreviousClose:   previousClose,
			Change:          change,
			PercentChange:   ns.PercentageChange,
			TotalTradeVol:   ns.TotalTradeQuantity,
			// UpdatedAt will be set by the repository
		})
	}

	if len(prices) == 0 {
		log.Println("[WARN] NEPSE Scraper: No price stats found in the fetched list.")
		return nil
	}

	log.Printf("NEPSE Scraper: Fetched %d price stats.", len(prices))

	// Save to DB
	if err := s.PriceRepo.SavePrices(prices); err != nil {
		return fmt.Errorf("nepse: failed to save prices: %w", err)
	}

	log.Println("NEPSE Scraper: Successfully scraped and saved prices.")
	return nil
}

// normalizeDailyChange fills a gap in the current NEPSE daily-stat response.
// That response sometimes supplies percentageChange but leaves previousClose at
// zero. Treating zero as a real close makes the entire LTP appear to be today's
// gain. When possible, recover the previous close from the percentage relation:
//
//	LTP = previousClose * (1 + percentageChange/100)
//
// The exchange rounds percentageChange, so the recovered price is approximate,
// but it is materially more accurate than exposing a fabricated full-price move.
func normalizeDailyChange(lastTradedPrice, previousClose, percentageChange float64) (float64, float64) {
	if previousClose > 0 {
		return previousClose, lastTradedPrice - previousClose
	}
	if lastTradedPrice <= 0 || percentageChange <= -100 {
		return 0, 0
	}

	previousClose = lastTradedPrice / (1 + percentageChange/100)
	return previousClose, lastTradedPrice - previousClose
}

// ScrapeMarketStatus fetches the market status from NEPSE and saves it.
func (s *NepseScraper) ScrapeMarketStatus() error {
	log.Println("NEPSE Scraper: Starting market status scrape...")
	var nepseStatus NepseMarketStatus // Target struct for JSON response

	if err := s.fetchNepseDataAuth(marketStatusURLValue, &nepseStatus); err != nil {
		// Special handling for market status: if fetch fails, maybe try to preserve old status?
		// For now, just return the error.
		return fmt.Errorf("nepse: failed to fetch market status: %w", err)
	}

	// Parse the 'AsOf' timestamp string
	var asOfTime *time.Time
	// NEPSE returns time like "2025-05-15T15:00:00" which is local time without offset.
	// We parse it as such, and then assume it's NPT ("Asia/Kathmandu") and convert to UTC for storage.
	const nepseTimeLayout = "2006-01-02T15:04:05"
	if nptLocation, loadErr := time.LoadLocation("Asia/Kathmandu"); loadErr != nil {
		log.Printf("[WARN] NEPSE Scraper: Could not load Asia/Kathmandu timezone: %v", loadErr)
	} else if parsedLocalTime, err := time.ParseInLocation(nepseTimeLayout, nepseStatus.AsOf, nptLocation); err == nil {
		// Assume the parsed time is in Nepal's timezone (NPT)
		utcTime := parsedLocalTime.UTC()
		asOfTime = &utcTime
	} else {
		log.Printf("[WARN] NEPSE Scraper: Could not parse market status 'AsOf' timestamp '%s' with layout '%s': %v", nepseStatus.AsOf, nepseTimeLayout, err)
		// Keep asOfTime as invalid (NULL in DB)
	}

	// Transform to models.MarketStatus
	status := models.MarketStatus{
		Status: strings.ToUpper(strings.ReplaceAll(nepseStatus.IsOpen, " ", "_")),
		AsOf:   asOfTime,
		// UpdatedAt will be set by the repository
	}

	if nepseStatus.ID > 0 {
		s.marketStatusMutex.Lock()
		s.currentMarketStatusID = nepseStatus.ID
		s.marketStatusMutex.Unlock()
	}
	log.Printf("NEPSE Scraper: Fetched market status: %s (AsOf: %v)", status.Status, status.AsOf)

	// Save to DB
	if err := s.StatusRepo.SaveMarketStatus(status); err != nil {
		return fmt.Errorf("nepse: failed to save market status: %w", err)
	}

	log.Println("NEPSE Scraper: Successfully scraped and saved market status.")
	return nil
}

// ScrapeTopGainers fetches top gainers from NEPSE and saves them.
func (s *NepseScraper) ScrapeTopGainers() error {
	log.Println("NEPSE Scraper: Starting top gainers scrape...")
	var nepseMovers []NepseTopGainerLoser

	if err := s.fetchNepseDataAuth(topGainersURLValue, &nepseMovers); err != nil {
		return fmt.Errorf("nepse: failed to fetch top gainers: %w", err)
	}

	// Transform to models.Mover
	movers := make([]models.Mover, 0, len(nepseMovers))
	for i, nm := range nepseMovers {
		if i >= maxTopMovers {
			break
		}
		movers = append(movers, models.Mover{
			Type:          "gainer",
			Rank:          i + 1, // Rank based on order from API
			Symbol:        strings.TrimSpace(nm.Symbol),
			SecurityName:  strings.TrimSpace(nm.SecurityName),
			LTP:           nm.LTP,
			PointChange:   nm.PointChange,
			PercentChange: nm.PercentageChange,
			// UpdatedAt will be set by the repository
		})
	}

	if len(movers) == 0 {
		log.Println("[WARN] NEPSE Scraper: No top gainers found in the fetched list.")
		return nil
	}

	log.Printf("NEPSE Scraper: Fetched %d top gainers.", len(movers))

	// Save to DB
	if err := s.MoverRepo.SaveMovers(movers); err != nil {
		return fmt.Errorf("nepse: failed to save top gainers: %w", err)
	}

	log.Println("NEPSE Scraper: Successfully scraped and saved top gainers.")
	return nil
}

// ScrapeTopLosers fetches top losers from NEPSE and saves them.
func (s *NepseScraper) ScrapeTopLosers() error {
	log.Println("NEPSE Scraper: Starting top losers scrape...")
	var nepseMovers []NepseTopGainerLoser

	if err := s.fetchNepseDataAuth(topLosersURLValue, &nepseMovers); err != nil {
		return fmt.Errorf("nepse: failed to fetch top losers: %w", err)
	}

	// Transform to models.Mover
	movers := make([]models.Mover, 0, len(nepseMovers))
	for i, nm := range nepseMovers {
		if i >= maxTopMovers {
			break
		}
		movers = append(movers, models.Mover{
			Type:          "loser",
			Rank:          i + 1,
			Symbol:        strings.TrimSpace(nm.Symbol),
			SecurityName:  strings.TrimSpace(nm.SecurityName),
			LTP:           nm.LTP,
			PointChange:   nm.PointChange,
			PercentChange: nm.PercentageChange,
			// UpdatedAt will be set by the repository
		})
	}

	if len(movers) == 0 {
		log.Println("[WARN] NEPSE Scraper: No top losers found in the fetched list.")
		return nil
	}

	log.Printf("NEPSE Scraper: Fetched %d top losers.", len(movers))

	// Save to DB
	if err := s.MoverRepo.SaveMovers(movers); err != nil {
		return fmt.Errorf("nepse: failed to save top losers: %w", err)
	}

	log.Println("NEPSE Scraper: Successfully scraped and saved top losers.")
	return nil
}

// FetchHistoricalPriceData retrieves the historical graph data for a specific security ID from NEPSE.
func (s *NepseScraper) FetchHistoricalPriceData(securityID int) ([]models.HistoricalPriceData, error) {
	log.Printf("NEPSE Scraper: Fetching historical price data for security ID: %d", securityID)
	if securityID <= 0 {
		return nil, fmt.Errorf("security ID must be positive")
	}

	// Get the URL format from environment variables
	historicalPricePathFormat := getEnvScraper("NEPSE_HISTORICAL_PRICE_PATH_FORMAT", "/api/nots/market/graphdata/%d") // Default provided
	specificPath := fmt.Sprintf(historicalPricePathFormat, securityID)
	url := nepseBaseURLValue + specificPath

	// Get a valid authentication token
	token, err := s.getValidToken()
	if err != nil {
		return nil, fmt.Errorf("failed to get valid token for historical data: %w", err)
	}

	marketStatusID, err := s.getMarketStatusID()
	if err != nil {
		return nil, err
	}
	requestID, err := nepseGraphRequestID(marketStatusID, time.Now())
	if err != nil {
		return nil, err
	}
	body, err := json.Marshal(map[string]int{"id": requestID})
	if err != nil {
		return nil, fmt.Errorf("failed to encode historical data request body: %w", err)
	}
	time.Sleep(nepseRequestDelay)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create historical data request: %w", err)
	}

	// Set necessary headers
	req.Header.Set("Authorization", "Salter "+token)
	req.Header.Set("Content-Type", "application/json") // Added back Content-Type for JSON body
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("Referer", nepseBaseURLValue)
	req.Header.Set("Accept", "application/json, text/plain, */*")

	// Execute the request
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute historical data request for ID %d: %w", securityID, err)
	}
	defer resp.Body.Close()

	// Read body for potential error messages or successful response
	bodyBytes, readErr := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if readErr != nil {
		log.Printf("[WARN] Failed to read response body for historical data ID %d: %v", securityID, readErr)
		// Continue processing based on status code anyway
	}

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("historical data request for ID %d failed with status %d: %s", securityID, resp.StatusCode, truncateForError(bodyBytes))
	}

	// Decode the JSON response using the already read body bytes
	var historicalData []models.HistoricalPriceData
	if err := json.Unmarshal(bodyBytes, &historicalData); err != nil {
		return nil, fmt.Errorf("failed to decode historical data JSON for ID %d: %w", securityID, err)
	}

	log.Printf("NEPSE Scraper: Successfully fetched %d historical data points for security ID: %d", len(historicalData), securityID)
	return historicalData, nil
}

// FetchGraphData fetches graph data (OHLCV) for a given security ID from NEPSE.
// This endpoint typically requires a POST request.
func (s *NepseScraper) FetchGraphData(securityID int) ([]NepseGraphDataPoint, error) {
	historicalData, err := s.FetchHistoricalPriceData(securityID)
	if err != nil {
		return nil, err
	}
	graphData := make([]NepseGraphDataPoint, 0, len(historicalData))
	for _, point := range historicalData {
		graphData = append(graphData, NepseGraphDataPoint{
			BusinessDate:          point.BusinessDate,
			OpenPrice:             point.OpenPrice,
			HighPrice:             point.HighPrice,
			LowPrice:              point.LowPrice,
			PreviousDayClosePrice: point.PreviousDayClosePrice,
			ClosePrice:            point.ClosePrice,
			LastTradedPrice:       point.LastTradedPrice,
			TotalTradedQuantity:   point.TotalTradedQuantity,
			FiftyTwoWeekHigh:      point.FiftyTwoWeekHigh,
		})
	}
	return graphData, nil
}
