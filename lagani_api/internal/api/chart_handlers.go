package api

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"lagani_api/internal/models" // Assuming models.ChartDataPoint is here

	"github.com/go-chi/chi/v5"
)

// GetSymbolChartData handles requests for chart data for a specific symbol.
func (h *Handlers) GetSymbolChartData(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if symbol == "" {
		respondWithError(w, http.StatusBadRequest, "Symbol is required")
		return
	}
	symbol = strings.ToUpper(symbol)

	// Check if company exists (optional, but good for validation)
	_, err := h.CompanyRepo.GetCompanyBySymbol(symbol) // Assumes this method exists
	if err != nil {
		// Handle sql.ErrNoRows specifically for a 404
		log.Printf("[API] /charts/%s: Company not found in DB: %v", symbol, err)
		respondWithError(w, http.StatusNotFound, fmt.Sprintf("Company with symbol %s not found", symbol))
		return
	}

	rangeParam := strings.ToLower(r.URL.Query().Get("range"))
	if rangeParam == "" {
		rangeParam = "1y" // Default range
	}
	resolutionParam := strings.ToUpper(r.URL.Query().Get("resolution"))
	// if resolutionParam == "" {
	// 	resolutionParam = "D" // Default to Daily
	// }

	log.Printf("[API] Received request for /charts/%s?range=%s&resolution=%s", symbol, rangeParam, resolutionParam)

	now := time.Now()
	var startDate, endDate time.Time

	switch rangeParam {
	case "1d":
		startDate = now.AddDate(0, 0, -7) // Keep it as last 7 calendar days for a 'trading day' view
		endDate = now
	case "1w": // Covers 7d
		startDate = now.AddDate(0, 0, -7)
		endDate = now
	case "1m":
		startDate = now.AddDate(0, -1, 0)
		endDate = now
	case "ytd":
		startDate = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		endDate = now
	case "1y":
		startDate = now.AddDate(-1, 0, 0)
		endDate = now
	case "all":
		startDate = time.Date(2000, 1, 1, 0, 0, 0, 0, now.Location()) // A very early date
		endDate = now
	default:
		log.Printf("[API] /charts/%s: Invalid range parameter '%s'. Supported ranges: 1d, 1w, 1m, ytd, 1y, all.", symbol, rangeParam)
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Invalid range parameter '%s'. Supported ranges: 1d, 1w, 1m, ytd, 1y, all.", rangeParam))
		return
	}

	// Automatic resolution selection if not provided
	if resolutionParam == "" {
		duration := endDate.Sub(startDate)
		if duration <= 90*24*time.Hour { // Up to ~3 months
			resolutionParam = "D"
			log.Printf("[API] /charts/%s: No resolution provided. Range '%s' (<= 90 days), defaulting to Daily ('D').", symbol, rangeParam)
		} else if duration <= 2*365*24*time.Hour { // Up to ~2 years
			resolutionParam = "W"
			log.Printf("[API] /charts/%s: No resolution provided. Range '%s' (> 90 days, <= 2 years), defaulting to Weekly ('W').", symbol, rangeParam)
		} else { // More than 2 years
			resolutionParam = "M"
			log.Printf("[API] /charts/%s: No resolution provided. Range '%s' (> 2 years), defaulting to Monthly ('M').", symbol, rangeParam)
		}
	} else {
		// If resolution *is* provided, validate it or default.
		switch resolutionParam {
		case "D", "W", "M":
			// Valid, do nothing
			log.Printf("[API] /charts/%s: Client provided resolution '%s'.", symbol, resolutionParam)
		default:
			log.Printf("[API] /charts/%s: Client provided invalid resolution '%s'. Defaulting to Daily ('D').", symbol, resolutionParam)
			resolutionParam = "D"
		}
	}

	// Ensure ChartRepo is available
	if h.ChartRepo == nil {
		log.Printf("[ERROR] API /charts/%s: ChartRepository not initialized in Handlers", symbol)
		respondWithError(w, http.StatusInternalServerError, "Chart service not available")
		return
	}

	var finalChartData []models.ChartDataPoint
	var fetchErr error

	switch resolutionParam {
	case "D":
		finalChartData, fetchErr = h.ChartRepo.GetChartData(symbol, "merolagani", startDate.Unix(), endDate.Unix())
	case "W":
		finalChartData, fetchErr = h.ChartRepo.GetWeeklyChartData(symbol, "merolagani", startDate.Unix(), endDate.Unix())
	case "M":
		finalChartData, fetchErr = h.ChartRepo.GetMonthlyChartData(symbol, "merolagani", startDate.Unix(), endDate.Unix())
	}

	if fetchErr != nil {
		log.Printf("[ERROR] API /charts/%s: Failed to get chart data from DB (Res: %s): %v", symbol, resolutionParam, fetchErr)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve chart data")
		return
	}

	if len(finalChartData) == 0 {
		log.Printf("[API] /charts/%s: No chart data found for the specified range (Res: %s).", symbol, resolutionParam)
		respondWithJSON(w, http.StatusOK, []models.ChartDataPoint{}) // Empty array
		return
	}

	respondWithJSON(w, http.StatusOK, finalChartData)
}

// NOTE: aggregateToWeekly, getStartOfWeek, maxHigh, minLow, sumVolume, and aggregateToMonthly functions
// have been MOVED to internal/scheduler/scheduler.go as the aggregation is now handled by the scheduler.
