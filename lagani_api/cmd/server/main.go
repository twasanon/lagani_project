package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"lagani_api/internal/api"
	"lagani_api/internal/database"
	"lagani_api/internal/scheduler"
	"lagani_api/internal/scraper"
)

// Helper function to get environment variable or default
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	value, exists := os.LookupEnv(key)
	if !exists || strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(strings.TrimSpace(value))
	if err != nil {
		log.Fatalf("[FATAL] %s must be a boolean, got %q", key, value)
	}
	return parsed
}

func main() {
	log.Println("Starting Lagani API Server...")

	// --- Dependency Injection ---

	// 1. Database Connection
	db, err := database.ConnectDB()
	if err != nil {
		log.Fatalf("[FATAL] Failed to connect to database: %v", err)
	}
	defer db.Close()

	// 2. Database Migrations
	if err := database.MigrateSchema(db); err != nil {
		log.Fatalf("[FATAL] Failed to run database migrations: %v", err)
	}

	// 3. Initialize Repositories
	log.Println("Initializing repositories...")
	companyRepo := database.NewCompanyRepository(db)
	priceRepo := database.NewPriceRepository(db)
	moverRepo := database.NewMoverRepository(db)
	statusRepo := database.NewMarketStatusRepository(db)
	newsRepo := database.NewNewsRepository(db)
	historicalPriceRepo := database.NewHistoricalPriceRepository(db)
	chartRepo := database.NewChartRepository(db)

	// 4. Initialize Scrapers
	log.Println("Initializing scrapers...")
	nepseScraper := scraper.NewNepseScraper(companyRepo, priceRepo, moverRepo, statusRepo)
	merolaganiScraper := scraper.NewMerolaganiScraper(newsRepo)
	nepalipaisaScraper := scraper.NewNepalipaisaScraper(newsRepo)

	// 5. Initialize Scheduler
	log.Println("Initializing scheduler...")
	appScheduler := scheduler.NewScheduler(
		nepseScraper,
		merolaganiScraper,
		nepalipaisaScraper,
		companyRepo,
		historicalPriceRepo,
		chartRepo,
	)

	// 6. Initialize API Handlers
	log.Println("Initializing API handlers...")
	apiHandlers := api.NewHandlers(
		companyRepo,
		priceRepo,
		moverRepo,
		statusRepo,
		newsRepo,
		historicalPriceRepo,
		chartRepo,
		nepseScraper,
		appScheduler,
	)

	// 7. Setup Router
	log.Println("Setting up API router...")
	router := api.SetupRouter(apiHandlers)

	// --- Start Services ---

	// 8. Start Scheduler jobs (in background as cronRunner.Start() is non-blocking)
	if getEnvBool("SCHEDULER_ENABLED", true) {
		if err := appScheduler.Start(); err != nil {
			log.Fatalf("[FATAL] Failed to start scheduler: %v", err)
		}
	} else {
		log.Println("Scheduler disabled by SCHEDULER_ENABLED=false.")
	}

	// 9. Configure and Start HTTP Server
	port := getEnv("PORT", "8080") // Use helper to read PORT or default to 8080

	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		// Add timeouts for production readiness
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   15 * time.Second,
		IdleTimeout:    120 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	// Start server in a goroutine
	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("HTTP Server listening on port %s", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErrors <- err
		}
	}()

	// --- Graceful Shutdown ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	log.Println("Server started. Press Ctrl+C to shutdown.")

	select {
	case <-quit:
		log.Println("Shutdown signal received.")
	case err := <-serverErrors:
		log.Printf("[ERROR] HTTP server stopped unexpectedly: %v", err)
	}

	// Shutdown HTTP server gracefully
	log.Println("Shutting down HTTP server...")
	// Create a deadline context for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("[ERROR] HTTP server shutdown failed: %v", err)
	}

	// Once new HTTP-triggered jobs can no longer start, stop cron and wait for
	// scheduler work to finish within its bounded shutdown window.
	appScheduler.Stop()

	log.Println("Server gracefully stopped.")
}
