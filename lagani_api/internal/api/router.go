package api

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type RouterConfig struct {
	AllowedOrigins []string
	AdminAPIKey    string
}

func routerConfigFromEnv() RouterConfig {
	originsValue := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	origins := []string{"http://localhost:*", "exp://*"}
	if originsValue != "" {
		origins = nil
		for _, origin := range strings.Split(originsValue, ",") {
			if origin = strings.TrimSpace(origin); origin != "" {
				origins = append(origins, origin)
			}
		}
	}
	return RouterConfig{AllowedOrigins: origins, AdminAPIKey: strings.TrimSpace(os.Getenv("ADMIN_API_KEY"))}
}

// SetupRouter creates a new Chi router, registers routes, and applies middleware.
func SetupRouter(h *Handlers) *chi.Mux {
	return SetupRouterWithConfig(h, routerConfigFromEnv())
}

func SetupRouterWithConfig(h *Handlers, config RouterConfig) *chi.Mux {
	r := chi.NewRouter()

	// Apply middleware
	r.Use(middleware.RequestID) // Add request ID to context
	r.Use(middleware.RealIP)    // Get real IP if behind proxy
	r.Use(middleware.Logger)    // Log requests
	r.Use(middleware.Recoverer) // Recover from panics
	r.Use(middleware.Timeout(15 * time.Second))
	r.Use(securityHeaders)
	r.Use(middleware.Heartbeat("/ping")) // Simple health check endpoint

	// CORS exists only for an explicitly published web client. Native mobile
	// requests do not use browser CORS, and no public route relies on cookies.
	c := cors.New(cors.Options{
		AllowedOrigins:   config.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Admin-Key"},
		ExposedHeaders:   []string{"X-Chart-Resolution", "X-Data-Source"},
		AllowCredentials: false,
		MaxAge:           300, // Maximum value not ignored by any major browsers
	})
	r.Use(c.Handler)
	r.Get("/healthz", h.GetHealth)
	r.Get("/readyz", h.GetReadiness)

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
		r.Use(adminAuth(config.AdminAPIKey))
		r.Post("/update-historical-data", h.TriggerHistoricalDataUpdate)
		r.Post("/update-chart-data", h.TriggerMerolaganiChartUpdate)
		r.Post("/update-prices", h.TriggerPriceUpdate) // Corrected placement
		r.Post("/update-all-data", h.TriggerAllPrimaryJobsUpdate)
	})

	return r
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func adminAuth(expectedKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if expectedKey == "" {
				respondWithError(w, http.StatusServiceUnavailable, "Admin API is disabled")
				return
			}
			providedKey := strings.TrimSpace(r.Header.Get("X-Admin-Key"))
			if providedKey == "" {
				if value := strings.TrimSpace(r.Header.Get("Authorization")); strings.HasPrefix(value, "Bearer ") {
					providedKey = strings.TrimSpace(strings.TrimPrefix(value, "Bearer "))
				}
			}
			if len(providedKey) != len(expectedKey) || subtle.ConstantTimeCompare([]byte(providedKey), []byte(expectedKey)) != 1 {
				respondWithError(w, http.StatusUnauthorized, "Unauthorized")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
