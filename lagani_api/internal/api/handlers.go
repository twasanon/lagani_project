package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"lagani_api/internal/database"
	"lagani_api/internal/scheduler"
	"lagani_api/internal/scraper"

	"github.com/go-chi/chi/v5"
)

// --- API Handler Dependencies ---

// Handlers holds references to the repositories, scrapers, and scheduler needed by the API handlers.
type Handlers struct {
	CompanyRepo         *database.CompanyRepository
	PriceRepo           *database.PriceRepository
	MoverRepo           *database.MoverRepository
	StatusRepo          *database.MarketStatusRepository
	NewsRepo            *database.NewsRepository
	HistoricalPriceRepo *database.HistoricalPriceRepository
	ChartRepo           *database.ChartRepository
	NepseScraper        *scraper.NepseScraper
	Scheduler           *scheduler.Scheduler
}

// NewHandlers creates a new Handlers struct.
func NewHandlers(
	companyRepo *database.CompanyRepository,
	priceRepo *database.PriceRepository,
	moverRepo *database.MoverRepository,
	statusRepo *database.MarketStatusRepository,
	newsRepo *database.NewsRepository,
	historicalPriceRepo *database.HistoricalPriceRepository,
	chartRepo *database.ChartRepository,
	nepseScraper *scraper.NepseScraper,
	scheduler *scheduler.Scheduler,
) *Handlers {
	return &Handlers{
		CompanyRepo:         companyRepo,
		PriceRepo:           priceRepo,
		MoverRepo:           moverRepo,
		StatusRepo:          statusRepo,
		NewsRepo:            newsRepo,
		HistoricalPriceRepo: historicalPriceRepo,
		ChartRepo:           chartRepo,
		NepseScraper:        nepseScraper,
		Scheduler:           scheduler,
	}
}

// --- Helper Function ---

// respondWithError sends a JSON error response.
func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}

// respondWithJSON sends a JSON response.
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[ERROR] Failed to marshal JSON response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error": "Internal Server Error"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

// --- API Handlers ---

// GetCompanies handles requests for /companies.
func (h *Handlers) GetCompanies(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /companies")
	companies, err := h.CompanyRepo.GetAllCompanies()
	if err != nil {
		log.Printf("[ERROR] API /companies: Failed to get companies from DB: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve company data")
		return
	}
	respondWithJSON(w, http.StatusOK, companies)
}

// GetPrices handles requests for /prices.
func (h *Handlers) GetPrices(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /prices")
	prices, err := h.PriceRepo.GetAllLatestPrices()
	if err != nil {
		log.Printf("[ERROR] API /prices: Failed to get prices from DB: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve price data")
		return
	}
	respondWithJSON(w, http.StatusOK, prices)
}

// GetMarketStatus handles requests for /market-status.
func (h *Handlers) GetMarketStatus(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /market-status")
	status, err := h.StatusRepo.GetLatestMarketStatus()
	if err != nil {
		log.Printf("[ERROR] API /market-status: Failed to get status from DB: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve market status")
		return
	}
	if status == nil { // Handle case where status hasn't been scraped yet
		log.Println("API /market-status: No status found in DB yet.")
		// Respond with a default or empty status? Sending 404 for now.
		respondWithError(w, http.StatusNotFound, "Market status not available yet")
		// Alternatively, send a default closed status:
		// respondWithJSON(w, http.StatusOK, models.MarketStatus{Status: "CLOSE"})
		return
	}
	respondWithJSON(w, http.StatusOK, status)
}

// GetTopGainers handles requests for /top-gainers.
func (h *Handlers) GetTopGainers(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /top-gainers")
	gainers, err := h.MoverRepo.GetLatestMoversByType("gainer")
	if err != nil {
		log.Printf("[ERROR] API /top-gainers: Failed to get gainers from DB: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve top gainers")
		return
	}
	respondWithJSON(w, http.StatusOK, gainers)
}

// GetTopLosers handles requests for /top-losers.
func (h *Handlers) GetTopLosers(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /top-losers")
	losers, err := h.MoverRepo.GetLatestMoversByType("loser")
	if err != nil {
		log.Printf("[ERROR] API /top-losers: Failed to get losers from DB: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve top losers")
		return
	}
	respondWithJSON(w, http.StatusOK, losers)
}

// GetNews handles requests for /news.
func (h *Handlers) GetNews(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /news")
	// Optional: Add query parameter for limit?
	limitStr := r.URL.Query().Get("limit")
	limit := 50 // Default limit
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	newsItems, err := h.NewsRepo.GetRecentNewsItems(limit)
	if err != nil {
		log.Printf("[ERROR] API /news: Failed to get news from DB: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve news items")
		return
	}
	respondWithJSON(w, http.StatusOK, newsItems)
}

// GetHistoricalPriceData handles requests for /historical-price/{securityId}
// Now fetches data from the HistoricalPriceRepository.
func (h *Handlers) GetHistoricalPriceData(w http.ResponseWriter, r *http.Request) {
	securityIDStr := chi.URLParam(r, "securityId")
	securityID, err := strconv.Atoi(securityIDStr)
	if err != nil {
		log.Printf("[ERROR] API /historical-price: Invalid security ID format '%s': %v", securityIDStr, err)
		respondWithError(w, http.StatusBadRequest, "Invalid security ID format")
		return
	}

	log.Printf("API: Received request for /historical-price/%d from DB", securityID)

	// Check if HistoricalPriceRepository is initialized
	if h.HistoricalPriceRepo == nil {
		log.Printf("[ERROR] API /historical-price: HistoricalPriceRepository is not initialized in handlers")
		respondWithError(w, http.StatusInternalServerError, "Internal server error: Data repository not available")
		return
	}

	// Fetch data from the repository
	historicalData, err := h.HistoricalPriceRepo.GetHistoricalPricesBySecurityID(securityID)
	if err != nil {
		// Log the detailed error from the repository
		log.Printf("[ERROR] API /historical-price/%d: Failed to fetch data from DB: %v", securityID, err)
		// Provide a slightly more generic error to the client
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve historical price data")
		return
	}

	// Handle case where no data is found for the ID
	if len(historicalData) == 0 {
		log.Printf("API /historical-price/%d: No historical data found in DB.", securityID)
		respondWithError(w, http.StatusNotFound, "No historical price data found for the given security ID")
		return
	}

	respondWithJSON(w, http.StatusOK, historicalData)
}

// TriggerHistoricalDataUpdate handles POST requests to /admin/update-historical-data
// It manually triggers the background job to scrape and save historical data for all companies.
func (h *Handlers) TriggerHistoricalDataUpdate(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /admin/update-historical-data")

	// Check if Scheduler is initialized
	if h.Scheduler == nil {
		log.Printf("[ERROR] API /admin/update-historical-data: Scheduler is not initialized in handlers")
		respondWithError(w, http.StatusInternalServerError, "Internal server error: Scheduler not available")
		return
	}

	// Run the job in a separate goroutine to avoid blocking the request
	go h.Scheduler.RunHistoricalDataJobNow()

	// Respond immediately
	respondWithJSON(w, http.StatusAccepted, map[string]string{"message": "Historical data update triggered successfully. Check server logs for progress."}) // 202 Accepted
}

// TriggerMerolaganiChartUpdate handles requests to manually trigger the Merolagani chart data update job.
func (h *Handlers) TriggerMerolaganiChartUpdate(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /admin/update-chart-data")

	if h.Scheduler == nil {
		log.Printf("[ERROR] API /admin/update-chart-data: Scheduler is not initialized in handlers")
		respondWithError(w, http.StatusInternalServerError, "Internal server error: Scheduler not available")
		return
	}

	go h.Scheduler.RunMerolaganiChartDataJobNow()

	respondWithJSON(w, http.StatusAccepted, map[string]string{"message": "Merolagani chart data update triggered successfully. Check server logs for progress."}) // 202 Accepted
}

// TriggerPriceUpdate handles POST requests to /admin/update-prices
// It manually triggers the price scraping job, forcing it to run even if the market is closed.
func (h *Handlers) TriggerPriceUpdate(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /admin/update-prices")

	if h.Scheduler == nil {
		log.Printf("[ERROR] API /admin/update-prices: Scheduler is not initialized in handlers")
		respondWithError(w, http.StatusInternalServerError, "Internal server error: Scheduler not available")
		return
	}

	// Run the job with force=true
	go h.Scheduler.RunPriceScrapeJobNow(true)

	respondWithJSON(w, http.StatusAccepted, map[string]string{"message": "Forced price update triggered successfully. Check server logs for progress."})
}

// TriggerAllPrimaryJobsUpdate handles requests to manually trigger all primary data scraping jobs.
func (h *Handlers) TriggerAllPrimaryJobsUpdate(w http.ResponseWriter, r *http.Request) {
	log.Println("API: Received request for /admin/update-all-data")

	if h.Scheduler == nil {
		log.Printf("[ERROR] API /admin/update-all-data: Scheduler is not initialized in handlers")
		respondWithError(w, http.StatusInternalServerError, "Internal server error: Scheduler not available")
		return
	}

	go h.Scheduler.RunAllPrimaryJobsNow()

	respondWithJSON(w, http.StatusAccepted, map[string]string{"message": "All primary data update jobs triggered successfully. Check server logs for progress."}) // 202 Accepted
}
