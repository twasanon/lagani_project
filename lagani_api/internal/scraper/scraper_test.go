package scraper

import (
	"database/sql"
	"math"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"lagani_api/internal/database"
)

func openNewsRepo(t *testing.T) (*database.NewsRepository, *sql.DB) {
	t.Helper()
	t.Setenv("DB_FILE", filepath.Join(t.TempDir(), "news.db"))
	db, err := database.ConnectDB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := database.MigrateSchema(db); err != nil {
		t.Fatal(err)
	}
	return database.NewNewsRepository(db), db
}

func TestMerolaganiScrapeNews(t *testing.T) {
	repo, _ := openNewsRepo(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/news" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<div class="news-list"><div class="media-news">
			<div class="media-wrap"><img src="/image.jpg"></div>
			<h4 class="media-title"><a href="/NewsDetail.aspx?newsID=1"> Market update </a></h4>
			<span class="media-label">Aug 12, 2026 03:18 PM</span>
		</div></div>`))
	}))
	defer server.Close()

	scraper := &MerolaganiScraper{
		NewsRepo: repo, HTTPClient: server.Client(), BaseURL: server.URL,
		NewsURL: server.URL + "/news", ChartURL: server.URL + "/chart",
	}
	if err := scraper.ScrapeNews(); err != nil {
		t.Fatal(err)
	}
	items, err := repo.GetRecentNewsItems(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Title != "Market update" || items[0].Link != server.URL+"/NewsDetail.aspx?newsID=1" {
		t.Fatalf("news items = %#v", items)
	}
	if items[0].PublishedAt == nil || items[0].PublishedAt.Format(time.RFC3339) != "2026-08-12T09:33:00Z" {
		t.Fatalf("publishedAt = %v", items[0].PublishedAt)
	}
}

func TestMerolaganiFetchChartData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("symbol"); got != "NABIL" {
			t.Errorf("symbol query = %q", got)
		}
		if got := r.Header.Get("Referer"); got == "" {
			t.Error("missing Referer header")
		}
		w.Header().Set("Content-Type", "application/json")
		// Adjusted provider data can contain high/low values that do not quite
		// bound open and close. The scraper normalizes those bounds.
		_, _ = w.Write([]byte(`{"t":[1699999900,1700000000],"o":[-0.1,500],"h":[0.1,504],"l":[-0.2,501],"c":[-0.1,505],"v":[50,1000],"s":"ok"}`))
	}))
	defer server.Close()

	scraper := &MerolaganiScraper{HTTPClient: server.Client(), BaseURL: server.URL, ChartURL: server.URL}
	points, err := scraper.FetchChartData("nabil", "1d", 1_699_999_000, 1_700_001_000, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != 1 || points[0].Close != 505 || points[0].High != 505 || points[0].Low != 500 {
		t.Fatalf("points = %#v", points)
	}
}

func TestNepalipaisaScrapeNewsUsesJSONAPI(t *testing.T) {
	repo, _ := openNewsRepo(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("categoryId") != "0" || r.URL.Query().Get("subCategoryId") != "0" {
			t.Errorf("unexpected query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"statusCode":200,"message":"Success","result":[{
				"newsId":93440,"newsTitle":" NEPSE closes higher ",
				"newsDateFormatted":"12 August 2026, Wednesday",
				"publishedOn":"2026-08-12T15:22:57.873",
				"imageUrl":"https://images.example/news.png"
			}]
		}`))
	}))
	defer server.Close()

	scraper := &NepalipaisaScraper{
		NewsRepo: repo, HTTPClient: server.Client(), BaseURL: server.URL,
		NewsAPIURL: server.URL + "/api/GetNewsByCategory",
	}
	if err := scraper.ScrapeNews(); err != nil {
		t.Fatal(err)
	}
	items, err := repo.GetRecentNewsItems(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Link != server.URL+"/news-detail/93440" || items[0].ImageURL != "https://images.example/news.png" {
		t.Fatalf("news items = %#v", items)
	}
	if items[0].PublishedAt == nil || items[0].PublishedAt.Format(time.RFC3339Nano) != "2026-08-12T09:37:57.873Z" {
		t.Fatalf("publishedAt = %v", items[0].PublishedAt)
	}
}

func TestNepseGraphRequestID(t *testing.T) {
	now := time.Date(2026, time.August, 12, 0, 0, 0, 0, time.UTC)
	got, err := nepseGraphRequestID(1, now)
	if err != nil {
		t.Fatal(err)
	}
	if got != 142 { // dummyData[1] (117) + id (1) + 2 * Nepal day (12)
		t.Fatalf("request ID = %d, want 142", got)
	}
}

func TestNormalizeDailyChange(t *testing.T) {
	tests := []struct {
		name                                          string
		last, previous, percent, wantPrev, wantChange float64
	}{
		{name: "uses exchange previous close", last: 510, previous: 500, percent: 2, wantPrev: 500, wantChange: 10},
		{name: "derives omitted previous close", last: 345, percent: 15, wantPrev: 300, wantChange: 45},
		{name: "unchanged price", last: 500, percent: 0, wantPrev: 500, wantChange: 0},
		{name: "invalid price", last: 0, percent: 5, wantPrev: 0, wantChange: 0},
		{name: "invalid minus one hundred percent", last: 10, percent: -100, wantPrev: 0, wantChange: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPrev, gotChange := normalizeDailyChange(tt.last, tt.previous, tt.percent)
			if math.Abs(gotPrev-tt.wantPrev) > 0.000001 || math.Abs(gotChange-tt.wantChange) > 0.000001 {
				t.Fatalf("normalizeDailyChange() = (%v, %v), want (%v, %v)", gotPrev, gotChange, tt.wantPrev, tt.wantChange)
			}
		})
	}
}
