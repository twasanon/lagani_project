package api

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"lagani_api/internal/models" // Assuming models.ChartDataPoint is here

	"github.com/go-chi/chi/v5"
)

var stockSymbolPattern = regexp.MustCompile(`^[A-Z0-9]{1,16}$`)

// GetSymbolChartData handles requests for chart data for a specific symbol.
func (h *Handlers) GetSymbolChartData(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=300, stale-if-error=86400")
	symbol := strings.ToUpper(strings.TrimSpace(chi.URLParam(r, "symbol")))
	if !stockSymbolPattern.MatchString(symbol) {
		respondWithError(w, http.StatusBadRequest, "Symbol must contain 1-16 letters or digits")
		return
	}

	// Check if company exists (optional, but good for validation)
	_, err := h.CompanyRepo.GetCompanyBySymbol(symbol) // Assumes this method exists
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, fmt.Sprintf("Company with symbol %s not found", symbol))
		} else {
			log.Printf("[ERROR] /charts/%s: Failed to query company: %v", symbol, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to validate company")
		}
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

	now := time.Now().UTC()
	var startDate, endDate time.Time

	switch rangeParam {
	case "1d":
		// "1d" means the latest available trading candle. A 30-day lookup
		// safely crosses weekends and extended NEPSE holiday closures.
		startDate = now.AddDate(0, 0, -30)
		endDate = now
	case "1w": // Covers 7d
		startDate = now.AddDate(0, 0, -7)
		endDate = now
	case "1m":
		startDate = now.AddDate(0, -1, 0)
		endDate = now
	case "3m":
		startDate = now.AddDate(0, -3, 0)
		endDate = now
	case "6m":
		startDate = now.AddDate(0, -6, 0)
		endDate = now
	case "ytd":
		startDate = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		endDate = now
	case "1y":
		startDate = now.AddDate(-1, 0, 0)
		endDate = now
	case "5y":
		startDate = now.AddDate(-5, 0, 0)
		endDate = now
	case "all":
		startDate = time.Date(2000, 1, 1, 0, 0, 0, 0, now.Location()) // A very early date
		endDate = now
	default:
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Invalid range parameter '%s'. Supported ranges: 1d, 1w, 1m, 3m, 6m, ytd, 1y, 5y, all.", rangeParam))
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
		// If resolution is provided, reject mistakes rather than silently
		// returning a different data shape than the client requested.
		switch resolutionParam {
		case "D", "W", "M":
			// Valid, do nothing
			log.Printf("[API] /charts/%s: Client provided resolution '%s'.", symbol, resolutionParam)
		default:
			respondWithError(w, http.StatusBadRequest, "resolution must be one of D, W, or M")
			return
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
	queryStartDate := startDate
	if resolutionParam == "W" {
		// NEPSE trades Sunday-Thursday; align weekly cache lookups to Sunday.
		offset := int(queryStartDate.Weekday())
		queryStartDate = queryStartDate.AddDate(0, 0, -offset).Truncate(24 * time.Hour)
	} else if resolutionParam == "M" {
		queryStartDate = time.Date(queryStartDate.Year(), queryStartDate.Month(), 1, 0, 0, 0, 0, time.UTC)
	}

	switch resolutionParam {
	case "D":
		finalChartData, fetchErr = h.ChartRepo.GetChartData(symbol, "merolagani", queryStartDate.Unix(), endDate.Unix())
	case "W":
		finalChartData, fetchErr = h.ChartRepo.GetWeeklyChartData(symbol, "merolagani", queryStartDate.Unix(), endDate.Unix())
	case "M":
		finalChartData, fetchErr = h.ChartRepo.GetMonthlyChartData(symbol, "merolagani", queryStartDate.Unix(), endDate.Unix())
	}

	if fetchErr != nil {
		log.Printf("[ERROR] API /charts/%s: Failed to get chart data from DB (Res: %s): %v", symbol, resolutionParam, fetchErr)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve chart data")
		return
	}
	w.Header().Set("X-Chart-Resolution", resolutionParam)
	w.Header().Set("X-Data-Source", "merolagani")

	if len(finalChartData) == 0 {
		log.Printf("[API] /charts/%s: No chart data found for the specified range (Res: %s).", symbol, resolutionParam)
		respondWithJSON(w, http.StatusOK, []models.ChartDataPoint{}) // Empty array
		return
	}
	if rangeParam == "1d" && len(finalChartData) > 1 {
		finalChartData = finalChartData[len(finalChartData)-1:]
	}

	respondWithJSON(w, http.StatusOK, finalChartData)
}

// NOTE: aggregateToWeekly, getStartOfWeek, maxHigh, minLow, sumVolume, and aggregateToMonthly functions
// have been MOVED to internal/scheduler/scheduler.go as the aggregation is now handled by the scheduler.
