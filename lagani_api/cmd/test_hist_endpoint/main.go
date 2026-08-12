package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	// Adjust the import path based on your project structure
	"lagani_api/internal/scraper"
)

// Basic helper to get env var or default
func getEnvTest(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds | log.Lshortfile)
	log.Println("Starting NEPSE Historical Data Endpoint Test...")

	// --- Configuration ---
	// Ensure .env is loaded or variables are exported before running!
	// Example: godotenv -f ../../.env go run main.go <security_id>

	// Get Security ID from command-line argument
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run main.go <security_id>")
		fmt.Println("Example: go run main.go 131")
		return
	}
	securityIDStr := os.Args[1]
	securityID, err := strconv.Atoi(securityIDStr)
	if err != nil {
		log.Fatalf("Invalid Security ID provided: %s. Error: %v", securityIDStr, err)
	}

	fmt.Printf("Testing with Security ID: %d\n", securityID)

	// --- Setup Minimal Scraper ---
	// We don't need real DB repos for this test, so pass nil
	nepseScraper := scraper.NewNepseScraper(nil, nil, nil, nil)

	// Set a more aggressive timeout to prevent hanging
	nepseScraper.HTTPClient = &http.Client{
		Timeout: 45 * time.Second,
		Transport: &http.Transport{
			DisableKeepAlives: true,
			IdleConnTimeout:   30 * time.Second,
		},
	}

	// --- Call the Fetch Function ---
	log.Printf("Attempting to fetch historical data for ID %d...\n", securityID)
	startTime := time.Now()

	historicalData, err := nepseScraper.FetchHistoricalPriceData(securityID)

	elapsedTime := time.Since(startTime)
	log.Printf("Request took: %v\n", elapsedTime)

	// --- Print Results ---
	if err != nil {
		log.Fatalf("\n--- TEST FAILED ---\nError fetching historical data for ID %d: %v\n", securityID, err)
		return
	}

	fmt.Printf("\n--- TEST SUCCESSFUL ---\nSuccessfully fetched %d historical data points for ID %d.\n", len(historicalData), securityID)

	if len(historicalData) > 0 {
		fmt.Println("\nFirst few data points:")
		for i, data := range historicalData {
			if i >= 5 { // Print only the first 5
				break
			}
			// Format the data nicely
			jsonData, _ := json.MarshalIndent(data, "  ", "  ")
			fmt.Printf("Data point %d:\n  %s\n\n", i+1, string(jsonData))
		}

		// Also print last data point to see the range
		if len(historicalData) > 5 {
			lastData := historicalData[len(historicalData)-1]
			jsonData, _ := json.MarshalIndent(lastData, "  ", "  ")
			fmt.Printf("Last data point (%d):\n  %s\n", len(historicalData), string(jsonData))
		}
	} else {
		fmt.Println("No data points returned.")
	}
}
