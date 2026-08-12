package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"lagani_api/internal/scraper" // Adjust if your module path is different
)

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds | log.Lshortfile)
	log.Println("Starting Chart Data Endpoint Test (Merolagani)...")

	// --- Configuration ---
	symbol := "AKJCL" // Default symbol
	if len(os.Args) > 1 {
		symbol = os.Args[1]
	}

	// Parameters from the example URL provided by the user
	// https://merolagani.com/handlers/TechnicalChartHandler.ashx?type=get_advanced_chart&symbol=AKJCL&resolution=1D&rangeStartDate=1713280046&rangeEndDate=1747408107&from=&isAdjust=1&currencyCode=NPR
	resolution := "1D"
	rangeStartDate := int64(1713280046) // Example: Approx April 16, 2024
	rangeEndDate := int64(1747408107)   // Example: Approx May 16, 2025 (covers about a year)
	isAdjust := true

	// Optional: Allow overriding date ranges via more arguments if desired
	// For now, using fixed example values for simplicity.

	fmt.Printf("Testing Merolagani Chart Data endpoint with Symbol: %s\n", symbol)
	fmt.Printf("Resolution: %s, StartDate: %d, EndDate: %d, Adjust: %t\n", resolution, rangeStartDate, rangeEndDate, isAdjust)

	// --- Setup Merolagani Scraper ---
	// We don't need a real NewsRepo for this specific test, so pass nil.
	merolaganiScraper := scraper.NewMerolaganiScraper(nil)

	// Optionally, customize HTTP client settings if needed
	// merolaganiScraper.HTTPClient = &http.Client{
	// Timeout: 30 * time.Second,
	// }

	// --- Call the FetchChartData Function ---
	log.Printf("Attempting to fetch chart data for symbol %s...\n", symbol)
	startTime := time.Now()

	chartData, err := merolaganiScraper.FetchChartData(symbol, resolution, rangeStartDate, rangeEndDate, isAdjust)

	elapsedTime := time.Since(startTime)
	log.Printf("Request to fetch chart data took: %v\n", elapsedTime)

	// --- Print Results ---
	if err != nil {
		log.Fatalf("\n--- CHART DATA TEST FAILED ---\nError fetching chart data for symbol %s: %v\n", symbol, err)
		return
	}

	fmt.Printf("\n--- CHART DATA TEST SUCCESSFUL ---\nSuccessfully fetched %d chart data points for symbol %s.\n", len(chartData), symbol)

	if len(chartData) > 0 {
		fmt.Println("\nFirst few data points (up to 5):")
		for i, dataPoint := range chartData {
			if i >= 5 {
				break
			}
			// Convert timestamp to readable date for logging
			ts := time.Unix(dataPoint.Timestamp, 0).Format("2006-01-02")
			fmt.Printf("Data point %d: Date: %s, O: %.2f, H: %.2f, L: %.2f, C: %.2f, V: %.0f\n",
				i+1, ts, dataPoint.Open, dataPoint.High, dataPoint.Low, dataPoint.Close, dataPoint.Volume)

			// Optionally, print full JSON for one or two points if needed for detailed check
			// jsonData, _ := json.MarshalIndent(dataPoint, "  ", "  ")
			// fmt.Printf("  %s\n\n", string(jsonData))
		}

		if len(chartData) > 5 {
			lastDataPoint := chartData[len(chartData)-1]
			ts := time.Unix(lastDataPoint.Timestamp, 0).Format("2006-01-02")
			fmt.Printf("\nLast data point (%d): Date: %s, O: %.2f, H: %.2f, L: %.2f, C: %.2f, V: %.0f\n",
				len(chartData), ts, lastDataPoint.Open, lastDataPoint.High, lastDataPoint.Low, lastDataPoint.Close, lastDataPoint.Volume)
		}
	} else {
		fmt.Println("No chart data points were returned for this symbol.")
	}
}
