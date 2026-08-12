package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"lagani_api/internal/database"
	"lagani_api/internal/models"
)

type apiTestHarness struct {
	router    http.Handler
	companies *database.CompanyRepository
	charts    *database.ChartRepository
}

func newAPITestHarness(t *testing.T, adminKey string) apiTestHarness {
	t.Helper()
	t.Setenv("DB_FILE", filepath.Join(t.TempDir(), "api.db"))
	db, err := database.ConnectDB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := database.MigrateSchema(db); err != nil {
		t.Fatal(err)
	}
	companies := database.NewCompanyRepository(db)
	prices := database.NewPriceRepository(db)
	movers := database.NewMoverRepository(db)
	statuses := database.NewMarketStatusRepository(db)
	news := database.NewNewsRepository(db)
	historical := database.NewHistoricalPriceRepository(db)
	charts := database.NewChartRepository(db)
	handlers := NewHandlers(companies, prices, movers, statuses, news, historical, charts, nil, nil)
	router := SetupRouterWithConfig(handlers, RouterConfig{
		AllowedOrigins: []string{"https://lagani.example"},
		AdminAPIKey:    adminKey,
	})
	return apiTestHarness{router: router, companies: companies, charts: charts}
}

func performRequest(handler http.Handler, method, target string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	for name, value := range headers {
		req.Header.Set(name, value)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, req)
	return response
}

func TestHealthReadinessAndEmptyCollections(t *testing.T) {
	harness := newAPITestHarness(t, "secret")
	for _, target := range []string{"/healthz", "/readyz"} {
		response := performRequest(harness.router, http.MethodGet, target, nil)
		if response.Code != http.StatusOK {
			t.Errorf("GET %s status = %d, body=%s", target, response.Code, response.Body.String())
		}
	}
	for _, target := range []string{"/companies", "/prices", "/top-gainers", "/top-losers", "/news"} {
		response := performRequest(harness.router, http.MethodGet, target, nil)
		if response.Code != http.StatusOK {
			t.Errorf("GET %s status = %d, body=%s", target, response.Code, response.Body.String())
			continue
		}
		var values []json.RawMessage
		if err := json.Unmarshal(response.Body.Bytes(), &values); err != nil {
			t.Errorf("GET %s did not return a JSON array: %v (body=%s)", target, err, response.Body.String())
		}
	}
}

func TestNewsLimitValidation(t *testing.T) {
	harness := newAPITestHarness(t, "secret")
	for _, target := range []string{"/news?limit=0", "/news?limit=101", "/news?limit=nope"} {
		response := performRequest(harness.router, http.MethodGet, target, nil)
		if response.Code != http.StatusBadRequest {
			t.Errorf("GET %s status = %d, want 400", target, response.Code)
		}
	}
}

func TestAdminRoutesRequireConfiguredKey(t *testing.T) {
	harness := newAPITestHarness(t, "secret")
	response := performRequest(harness.router, http.MethodPost, "/admin/update-prices", nil)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("missing key status = %d, want 401", response.Code)
	}
	response = performRequest(harness.router, http.MethodPost, "/admin/update-prices", map[string]string{"X-Admin-Key": "wrong"})
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("wrong key status = %d, want 401", response.Code)
	}
	response = performRequest(harness.router, http.MethodPost, "/admin/update-prices", map[string]string{"Authorization": "Bearer secret"})
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("valid key status = %d, want handler's 500 with nil scheduler", response.Code)
	}

	disabled := newAPITestHarness(t, "")
	response = performRequest(disabled.router, http.MethodPost, "/admin/update-prices", map[string]string{"X-Admin-Key": "anything"})
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("disabled admin status = %d, want 503", response.Code)
	}
}

func TestChartValidationAndResponseMetadata(t *testing.T) {
	harness := newAPITestHarness(t, "secret")
	if err := harness.companies.SaveCompanies([]models.Company{{Symbol: "NABIL", Name: "Nabil Bank", SecurityID: 131}}); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Add(-24 * time.Hour).Truncate(24 * time.Hour)
	point := models.ChartDataPoint{Timestamp: now.Unix(), Open: 500, High: 510, Low: 495, Close: 505, Volume: 1000}
	if _, err := harness.charts.SaveChartDataPoints("NABIL", "merolagani", []models.ChartDataPoint{point}); err != nil {
		t.Fatal(err)
	}

	response := performRequest(harness.router, http.MethodGet, "/charts/nabil?range=1m&resolution=d", nil)
	if response.Code != http.StatusOK {
		t.Fatalf("chart status = %d, body=%s", response.Code, response.Body.String())
	}
	if got := response.Header().Get("X-Chart-Resolution"); got != "D" {
		t.Errorf("X-Chart-Resolution = %q", got)
	}
	var points []models.ChartDataPoint
	if err := json.Unmarshal(response.Body.Bytes(), &points); err != nil || len(points) != 1 {
		t.Fatalf("chart points = %#v, error=%v", points, err)
	}

	for _, target := range []string{
		"/charts/NABIL?range=invalid",
		"/charts/NABIL?range=1m&resolution=X",
		"/charts/bad-symbol?range=1m",
	} {
		response := performRequest(harness.router, http.MethodGet, target, nil)
		if response.Code != http.StatusBadRequest {
			t.Errorf("GET %s status = %d, want 400", target, response.Code)
		}
	}
}

func TestCORSUsesConfiguredOrigin(t *testing.T) {
	harness := newAPITestHarness(t, "secret")
	response := performRequest(harness.router, http.MethodGet, "/healthz", map[string]string{"Origin": "https://lagani.example"})
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "https://lagani.example" {
		t.Fatalf("Access-Control-Allow-Origin = %q", got)
	}
	if got := response.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Fatalf("public CORS unexpectedly allows credentials: %q", got)
	}

	disallowed := performRequest(harness.router, http.MethodGet, "/healthz", map[string]string{"Origin": "https://attacker.example"})
	if got := disallowed.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("disallowed origin received Access-Control-Allow-Origin = %q", got)
	}
}
