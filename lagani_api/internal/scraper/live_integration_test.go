//go:build integration

package scraper

import (
	"testing"
	"time"

	"lagani_api/internal/database"
)

func TestLiveNewsSources(t *testing.T) {
	repo, _ := openNewsRepo(t)
	merolagani := NewMerolaganiScraper(repo)
	if err := merolagani.ScrapeNews(); err != nil {
		t.Fatalf("Merolagani live scrape: %v", err)
	}
	nepalipaisa := NewNepalipaisaScraper(repo)
	if err := nepalipaisa.ScrapeNews(); err != nil {
		t.Fatalf("Nepalipaisa live scrape: %v", err)
	}
	items, err := repo.GetRecentNewsItems(100)
	if err != nil {
		t.Fatal(err)
	}
	sources := make(map[string]int)
	for _, item := range items {
		sources[item.Source]++
	}
	if sources["merolagani"] == 0 || sources["nepalipaisa"] == 0 {
		t.Fatalf("live news source counts = %#v", sources)
	}
}

func TestLiveMerolaganiChart(t *testing.T) {
	scraper := NewMerolaganiScraper(nil)
	tests := []struct {
		symbol string
		years  int
	}{
		{symbol: "NABIL", years: 1},
		// NMB50's older adjusted series has historically included invalid
		// negative candles. Keep it in the live contract test so those provider
		// anomalies cannot make the whole symbol unusable again.
		{symbol: "NMB50", years: 10},
	}
	for _, test := range tests {
		t.Run(test.symbol, func(t *testing.T) {
			end := time.Now().Unix()
			start := time.Now().AddDate(-test.years, 0, 0).Unix()
			points, err := scraper.FetchChartData(test.symbol, "1D", start, end, true)
			if err != nil {
				t.Fatal(err)
			}
			if len(points) == 0 {
				t.Fatalf("Merolagani returned no usable %s chart data", test.symbol)
			}
			for index, point := range points {
				if !isUsableMerolaganiCandle(point.Timestamp, point.Open, point.High, point.Low, point.Close, point.Volume) {
					t.Fatalf("invalid %s point at %d: %#v", test.symbol, index, point)
				}
				if point.High < point.Open || point.High < point.Close || point.Low > point.Open || point.Low > point.Close {
					t.Fatalf("inconsistent %s OHLC bounds at %d: %#v", test.symbol, index, point)
				}
			}
		})
	}
}

func TestLiveNEPSEHistoricalPrices(t *testing.T) {
	t.Setenv("WASM_FILE", "../../css.wasm")
	scraper := NewNepseScraper(nil, nil, nil, nil)
	points, err := scraper.FetchHistoricalPriceData(131)
	if err != nil {
		t.Fatal(err)
	}
	if len(points) == 0 {
		t.Fatal("NEPSE returned no historical prices for security 131")
	}
}

func TestLiveNEPSECoreMarketData(t *testing.T) {
	_, db := openNewsRepo(t)
	t.Setenv("WASM_FILE", "../../css.wasm")
	companies := database.NewCompanyRepository(db)
	prices := database.NewPriceRepository(db)
	movers := database.NewMoverRepository(db)
	statuses := database.NewMarketStatusRepository(db)
	scraper := NewNepseScraper(companies, prices, movers, statuses)

	if err := scraper.ScrapeCompanies(); err != nil {
		t.Fatalf("companies: %v", err)
	}
	if err := scraper.ScrapeMarketStatus(); err != nil {
		t.Fatalf("market status: %v", err)
	}
	if err := scraper.ScrapePrices(); err != nil {
		t.Fatalf("prices: %v", err)
	}
	if err := scraper.ScrapeTopGainers(); err != nil {
		t.Fatalf("top gainers: %v", err)
	}
	if err := scraper.ScrapeTopLosers(); err != nil {
		t.Fatalf("top losers: %v", err)
	}

	companyRows, err := companies.GetAllCompanies()
	if err != nil || len(companyRows) < 100 {
		t.Fatalf("company count = %d, error=%v", len(companyRows), err)
	}
	priceRows, err := prices.GetAllLatestPrices()
	if err != nil || len(priceRows) < 100 {
		t.Fatalf("price count = %d, error=%v", len(priceRows), err)
	}
	status, err := statuses.GetLatestMarketStatus()
	if err != nil || status == nil || status.Status == "" {
		t.Fatalf("market status = %#v, error=%v", status, err)
	}
	for _, moverType := range []string{"gainer", "loser"} {
		rows, err := movers.GetLatestMoversByType(moverType)
		if err != nil || len(rows) == 0 || len(rows) > maxTopMovers {
			t.Fatalf("%s count = %d, error=%v", moverType, len(rows), err)
		}
		for index, row := range rows {
			if row.Type != moverType || row.Rank != index+1 || row.Symbol == "" {
				t.Fatalf("invalid %s row at rank %d: %#v", moverType, index+1, row)
			}
		}
	}
}
