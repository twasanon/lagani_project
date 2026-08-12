package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
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
	appScheduler.Start() // Corrected to use Start()

	// 9. Configure and Start HTTP Server
	port := getEnv("PORT", "8080") // Use helper to read PORT or default to 8080

	httpServer := &http.Server{
		Addr:    ":" + port,
		Handler: router,
		// Add timeouts for production readiness
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("HTTP Server listening on port %s", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Failed to start HTTP server: %v", err)
		}
	}()

	// --- Graceful Shutdown ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	log.Println("Server started. Press Ctrl+C to shutdown.")

	// Block until a signal is received
	<-quit
	log.Println("Shutdown signal received.")

	// Stop the scheduler
	appScheduler.Stop() // Use appScheduler

	// Shutdown HTTP server gracefully
	log.Println("Shutting down HTTP server...")
	// Create a deadline context for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("[ERROR] HTTP server shutdown failed: %v", err)
	}

	log.Println("Server gracefully stopped.")
}
