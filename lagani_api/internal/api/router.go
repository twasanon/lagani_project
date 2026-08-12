package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// SetupRouter creates a new Chi router, registers routes, and applies middleware.
func SetupRouter(h *Handlers) *chi.Mux {
	r := chi.NewRouter()

	// Apply middleware
	r.Use(middleware.Logger)             // Log requests
	r.Use(middleware.Recoverer)          // Recover from panics
	r.Use(middleware.RealIP)             // Get real IP if behind proxy
	r.Use(middleware.RequestID)          // Add request ID to context
	r.Use(middleware.Heartbeat("/ping")) // Simple health check endpoint

	// Setup CORS - Allow requests from typical development origins
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:*", "exp://*"}, // Adjust as needed
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not ignored by any major browsers
	})
	r.Use(c.Handler)

	// Define API routes and map them to handlers
	r.Get("/companies", h.GetCompanies)
	r.Get("/prices", h.GetPrices)
	r.Get("/market-status", h.GetMarketStatus)
	r.Get("/top-gainers", h.GetTopGainers)
	r.Get("/top-losers", h.GetTopLosers)
	r.Get("/news", h.GetNews)

	// New endpoint for historical price data (NEPSE)
	r.Get("/historical-price/{securityId:[0-9]+}", h.GetHistoricalPriceData)

	// New endpoint for chart data (Merolagani)
	r.Get("/charts/{symbol}", h.GetSymbolChartData)

	// Mount admin-specific routes
	r.Route("/admin", func(r chi.Router) {
		r.Post("/update-historical-data", h.TriggerHistoricalDataUpdate)
		r.Post("/update-chart-data", h.TriggerMerolaganiChartUpdate)
		r.Post("/update-prices", h.TriggerPriceUpdate) // Corrected placement
		r.Post("/update-all-data", h.TriggerAllPrimaryJobsUpdate)
	})

	return r
}
