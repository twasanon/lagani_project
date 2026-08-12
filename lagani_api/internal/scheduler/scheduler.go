package scheduler

import (
	"errors"
	"fmt"
	"log"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"lagani_api/internal/database" // Import database package
	"lagani_api/internal/models"
	"lagani_api/internal/scraper" // Import scraper package

	"github.com/robfig/cron/v3"
)

var nptLocation *time.Location

// Helper function
func getEnvScheduler(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func getEnvBoolScheduler(key string, fallback bool) bool {
	value, exists := os.LookupEnv(key)
	if !exists || strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(strings.TrimSpace(value))
	if err != nil {
		log.Printf("[WARN] Invalid boolean %s=%q; using %t", key, value, fallback)
		return fallback
	}
	return parsed
}

func init() {
	// Load Nepal time zone once on package initialization
	loc, err := time.LoadLocation("Asia/Kathmandu")
	if err != nil {
		log.Fatalf("[FATAL] Failed to load Asia/Kathmandu timezone: %v", err)
	}
	nptLocation = loc
	log.Println("Loaded Asia/Kathmandu (NPT) timezone.")
}

// Scheduler manages background scraping tasks.
type Scheduler struct {
	cronRunner          *cron.Cron
	nepseScraper        *scraper.NepseScraper
	merolaganiScraper   *scraper.MerolaganiScraper
	nepalipaisaScraper  *scraper.NepalipaisaScraper
	companyRepo         *database.CompanyRepository
	historicalPriceRepo *database.HistoricalPriceRepository
	chartRepo           *database.ChartRepository
	jobMu               sync.Mutex
	runningJobs         map[string]bool
	jobWG               sync.WaitGroup
}

// NewScheduler creates a new Scheduler instance.
func NewScheduler(
	nepse *scraper.NepseScraper,
	merolagani *scraper.MerolaganiScraper,
	nepalipaisa *scraper.NepalipaisaScraper,
	compRepo *database.CompanyRepository,
	histRepo *database.HistoricalPriceRepository,
	chartRepo *database.ChartRepository,
) *Scheduler {
	c := cron.New(
		cron.WithLocation(nptLocation),
		cron.WithSeconds(),
		cron.WithChain(
			cron.SkipIfStillRunning(cron.DefaultLogger),
			cron.Recover(cron.DefaultLogger),
		),
	)
	log.Printf("Cron scheduler initialized with timezone: %s", nptLocation.String())
	return &Scheduler{
		cronRunner:          c,
		nepseScraper:        nepse,
		merolaganiScraper:   merolagani,
		nepalipaisaScraper:  nepalipaisa,
		companyRepo:         compRepo,
		historicalPriceRepo: histRepo,
		chartRepo:           chartRepo,
		runningJobs:         make(map[string]bool),
	}
}

func (s *Scheduler) tryBeginJob(name string) bool {
	s.jobMu.Lock()
	defer s.jobMu.Unlock()
	if s.runningJobs[name] || s.runningJobs["all"] {
		return false
	}
	if name == "all" {
		for _, running := range s.runningJobs {
			if running {
				return false
			}
		}
	}
	s.runningJobs[name] = true
	return true
}

func (s *Scheduler) endJob(name string) {
	s.jobMu.Lock()
	delete(s.runningJobs, name)
	s.jobMu.Unlock()
}

func (s *Scheduler) runExclusive(name string, job func()) bool {
	if !s.tryBeginJob(name) {
		log.Printf("[Scheduler][Skip] Job %s is already running or a full refresh is active.", name)
		return false
	}
	defer s.endJob(name)
	job()
	return true
}

func (s *Scheduler) startExclusive(name string, job func()) bool {
	if !s.tryBeginJob(name) {
		return false
	}
	s.jobWG.Add(1)
	go func() {
		defer s.jobWG.Done()
		defer s.endJob(name)
		job()
	}()
	return true
}

// isMarketHoursNPT checks if the given time is within NEPSE market hours (Sun-Thu, 11:00 AM - 2:59 PM NPT).
// This function might not be needed if all jobs check market status from DB.
// func isMarketHoursNPT(t time.Time) bool { ... }

// Start registers and starts the scheduled jobs.
func (s *Scheduler) Start() error {
	log.Println("Starting scheduler...")

	// --- Define Job Functions Wrappers ---

	scrapeMarketStatus := func() {
		s.runExclusive("market-status", func() {
			log.Println("[Scheduler] Running job: ScrapeMarketStatus")
			if err := s.nepseScraper.ScrapeMarketStatus(); err != nil {
				log.Printf("[ERROR][Scheduler] Failed to scrape market status: %v", err)
			}
		})
	}

	scrapePrices := func() {
		s.runExclusive("prices", func() { s.runScrapePricesInternal("[Scheduler]", false) })
	}
	scrapeClosePrices := func() {
		s.runExclusive("prices", func() { s.runScrapePricesInternal("[Scheduler][Close Snapshot]", true) })
	}
	scrapeGainers := func() {
		s.runExclusive("gainers", func() { s.runScrapeGainersInternal("[Scheduler]", false) })
	}
	scrapeLosers := func() {
		s.runExclusive("losers", func() { s.runScrapeLosersInternal("[Scheduler]", false) })
	}
	scrapeCloseGainers := func() {
		s.runExclusive("gainers", func() { s.runScrapeGainersInternal("[Scheduler][Close Snapshot]", true) })
	}
	scrapeCloseLosers := func() {
		s.runExclusive("losers", func() { s.runScrapeLosersInternal("[Scheduler][Close Snapshot]", true) })
	}

	scrapeCompanies := func() {
		s.runExclusive("companies", func() {
			log.Println("[Scheduler] Running job: ScrapeCompanies")
			if err := s.nepseScraper.ScrapeCompanies(); err != nil {
				log.Printf("[ERROR][Scheduler] Failed to scrape companies: %v", err)
			}
		})
	}

	scrapeMerolaganiNews := func() {
		s.runExclusive("merolagani-news", func() {
			log.Println("[Scheduler] Running job: ScrapeMerolaganiNews")
			if err := s.merolaganiScraper.ScrapeNews(); err != nil {
				log.Printf("[ERROR][Scheduler] Failed to scrape Merolagani news: %v", err)
			}
		})
	}

	scrapeNepalipaisaNews := func() {
		s.runExclusive("nepalipaisa-news", func() {
			log.Println("[Scheduler] Running job: ScrapeNepalipaisaNews")
			if err := s.nepalipaisaScraper.ScrapeNews(); err != nil {
				log.Printf("[ERROR][Scheduler] Failed to scrape Nepalipaisa news: %v", err)
			}
		})
	}

	scrapeHistoricalData := func() {
		s.runExclusive("historical", func() { s.runScrapeHistoricalDataInternal("[Scheduler]") })
	}

	updateMerolaganiChartDataJob := func() {
		s.runExclusive("charts", func() { s.executeMerolaganiChartUpdate("[Scheduler]") })
	}

	// --- Register Jobs with Schedules (Times interpreted in Asia/Kathmandu) ---
	log.Println("Registering scheduled jobs...")

	jobs := []struct {
		name     string
		schedule string
		job      func()
	}{
		{"market status", getEnvScheduler("MARKET_STATUS_SCHEDULE", "0 */2 10-15 * * 0-4"), scrapeMarketStatus},
		{"prices", getEnvScheduler("PRICE_SCHEDULE", "15 */5 11-14 * * 0-4"), scrapePrices},
		{"top gainers", getEnvScheduler("GAINER_SCHEDULE", "30 */5 11-14 * * 0-4"), scrapeGainers},
		{"top losers", getEnvScheduler("LOSER_SCHEDULE", "45 */5 11-14 * * 0-4"), scrapeLosers},
		{"closing prices", getEnvScheduler("MARKET_CLOSE_PRICE_SCHEDULE", "0 5 15 * * 0-4"), scrapeClosePrices},
		{"closing gainers", getEnvScheduler("MARKET_CLOSE_GAINER_SCHEDULE", "0 6 15 * * 0-4"), scrapeCloseGainers},
		{"closing losers", getEnvScheduler("MARKET_CLOSE_LOSER_SCHEDULE", "0 7 15 * * 0-4"), scrapeCloseLosers},
		{"companies", getEnvScheduler("COMPANY_SCHEDULE", "0 0 2 * * *"), scrapeCompanies},
		{"Merolagani news", getEnvScheduler("NEWS_SCHEDULE", "0 0 6,18 * * *"), scrapeMerolaganiNews},
		{"Nepalipaisa news", getEnvScheduler("NEWS_SCHEDULE", "0 0 6,18 * * *"), scrapeNepalipaisaNews},
		{"historical prices", getEnvScheduler("HISTORICAL_PRICE_SCHEDULE", "0 0 18 * * *"), scrapeHistoricalData},
		{"Merolagani charts", getEnvScheduler("MEROLAGANI_CHART_SCHEDULE", "0 5 0 * * *"), updateMerolaganiChartDataJob},
	}
	for _, registration := range jobs {
		if _, err := s.cronRunner.AddFunc(registration.schedule, registration.job); err != nil {
			return fmt.Errorf("register %s schedule %q: %w", registration.name, registration.schedule, err)
		}
	}

	// --- Startup Jobs ---
	if getEnvBoolScheduler("STARTUP_JOBS_ENABLED", true) {
		s.jobWG.Add(1)
		go func() {
			defer s.jobWG.Done()
			log.Println("[Scheduler] Running initial startup jobs...")
			time.Sleep(2 * time.Second)

			scrapeCompanies()
			time.Sleep(1 * time.Second)
			scrapeMarketStatus()
			time.Sleep(1 * time.Second)

			// These already check market status internally
			s.runExclusive("prices", func() { s.runScrapePricesInternal("[Scheduler][Startup]", true) })
			time.Sleep(1 * time.Second)
			s.runExclusive("gainers", func() { s.runScrapeGainersInternal("[Scheduler][Startup]", true) })
			time.Sleep(1 * time.Second)
			s.runExclusive("losers", func() { s.runScrapeLosersInternal("[Scheduler][Startup]", true) })
			time.Sleep(1 * time.Second)

			scrapeMerolaganiNews()
			scrapeNepalipaisaNews()
			time.Sleep(1 * time.Second)

			// Conditionally run Merolagani chart data update on startup
			startupMarketStatus, dbErr := s.nepseScraper.StatusRepo.GetLatestMarketStatus()
			if dbErr != nil {
				log.Printf("[ERROR][Scheduler] Startup: Failed to get current market status for Merolagani chart job: %v. Skipping initial chart update.", dbErr)
			} else if startupMarketStatus != nil && startupMarketStatus.Status == "OPEN" {
				statusStr := "UNKNOWN"
				if startupMarketStatus != nil {
					statusStr = startupMarketStatus.Status
				}
				log.Printf("[Scheduler][Skip] Startup: Market is OPEN (Status: %s). Deferring the expensive chart backfill until the market is closed.", statusStr)
			} else {
				log.Println("[Scheduler] Startup: Market is closed or unknown. Running initial UpdateMerolaganiChartData job.")
				updateMerolaganiChartDataJob() // Calls s.executeMerolaganiChartUpdate
			}

			log.Println("[Scheduler] Initial startup jobs complete.")
		}()
	} else {
		log.Println("Scheduler startup jobs are disabled.")
	}

	s.cronRunner.Start()
	log.Println("Scheduler started.")
	return nil
}

// executeMerolaganiChartUpdate contains the actual logic for the Merolagani chart data job.
// logPrefix allows differentiation between scheduled and manually triggered runs.
func (s *Scheduler) executeMerolaganiChartUpdate(logPrefix string) {
	log.Printf("%s Running job: UpdateMerolaganiChartData", logPrefix)

	if s.companyRepo == nil || s.chartRepo == nil || s.merolaganiScraper == nil {
		log.Printf("[ERROR]%s UpdateMerolaganiChartData: Required repositories or scraper not initialized.", logPrefix)
		return
	}

	companies, err := s.companyRepo.GetAllCompanies()
	if err != nil {
		log.Printf("[ERROR]%s UpdateMerolaganiChartData: Failed to get companies: %v", logPrefix, err)
		return
	}

	if len(companies) == 0 {
		log.Printf("[INFO]%s UpdateMerolaganiChartData: No companies found in the database.", logPrefix)
		return
	}

	log.Printf("%s UpdateMerolaganiChartData: Found %d companies to process for daily data.", logPrefix, len(companies))

	var wg sync.WaitGroup
	var mu sync.Mutex
	jobErrors := make([]error, 0)
	noDataSymbols := make([]string, 0)
	successfullyUpdatedSymbols := make([]string, 0) // Track symbols with new/updated daily data

	var companiesSuccessfullyUpdatedDaily int32 = 0
	var companiesWithNoDataDaily int32 = 0
	var companiesWithOtherErrorsDaily int32 = 0

	const maxConcurrentChartFetches = 3
	sem := make(chan struct{}, maxConcurrentChartFetches)
	defer close(sem)

	for _, company := range companies {
		if company.Symbol == "" {
			log.Printf("[WARN]%s UpdateMerolaganiChartData: Skipping company with empty symbol for daily fetch.", logPrefix)
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(comp models.Company) {
			defer wg.Done()
			defer func() { <-sem }()
			symbol := comp.Symbol
			log.Printf("%s Daily Fetch: Checking Merolagani chart data for Symbol: %s", logPrefix, symbol)

			lastTimestamp, found, errDb := s.chartRepo.GetLatestChartTimestamp(symbol, "merolagani")
			if errDb != nil {
				log.Printf("[ERROR]%s Daily Fetch: Failed to get latest timestamp for %s: %v", logPrefix, symbol, errDb)
				mu.Lock()
				jobErrors = append(jobErrors, errDb)
				mu.Unlock()
				atomic.AddInt32(&companiesWithOtherErrorsDaily, 1)
				return
			}

			var startDate int64
			endDate := time.Now().Unix()

			if !found {
				startDate = time.Date(2000, 1, 1, 0, 0, 0, 0, nptLocation).Unix()
				log.Printf("%s Daily Fetch: No existing data for %s. Fetching full history since 2000-01-01.", logPrefix, symbol)
			} else {
				// Re-fetch an overlap so the latest candle and recent adjusted values
				// are corrected after NEPSE closes or a source revises its response.
				startDate = lastTimestamp - (14 * 24 * 60 * 60)
				log.Printf("%s Daily Fetch: Existing data for %s until %s. Refreshing from %s.", logPrefix, symbol, time.Unix(lastTimestamp, 0).In(nptLocation).Format("2006-01-02"), time.Unix(startDate, 0).In(nptLocation).Format("2006-01-02"))
			}

			dailyChartData, errScrape := s.merolaganiScraper.FetchChartData(symbol, "1D", startDate, endDate, true)
			if errScrape != nil {
				mu.Lock()
				if errors.Is(errScrape, scraper.ErrMerolaganiNoData) {
					log.Printf("[INFO]%s Daily Fetch: No chart data available from Merolagani for %s. Details: %v", logPrefix, symbol, errScrape)
					noDataSymbols = append(noDataSymbols, symbol)
					atomic.AddInt32(&companiesWithNoDataDaily, 1)
				} else {
					log.Printf("[ERROR]%s Daily Fetch: Failed to fetch chart data for %s: %v", logPrefix, symbol, errScrape)
					jobErrors = append(jobErrors, errScrape)
					atomic.AddInt32(&companiesWithOtherErrorsDaily, 1)
				}
				mu.Unlock()
				return
			}

			if len(dailyChartData) > 0 {
				modelChartPoints := make([]models.ChartDataPoint, len(dailyChartData))
				for i, sp := range dailyChartData {
					modelChartPoints[i] = models.ChartDataPoint{Timestamp: sp.Timestamp, Open: sp.Open, High: sp.High, Low: sp.Low, Close: sp.Close, Volume: sp.Volume}
				}

				affectedCount, errSave := s.chartRepo.SaveChartDataPoints(symbol, "merolagani", modelChartPoints)
				if errSave != nil {
					log.Printf("[ERROR]%s Daily Fetch: Failed to save chart data for %s: %v", logPrefix, symbol, errSave)
					mu.Lock()
					jobErrors = append(jobErrors, errSave)
					mu.Unlock()
					atomic.AddInt32(&companiesWithOtherErrorsDaily, 1)
				} else {
					log.Printf("%s Daily Fetch: Upserted %d chart points for %s.", logPrefix, affectedCount, symbol)
					if affectedCount > 0 {
						atomic.AddInt32(&companiesSuccessfullyUpdatedDaily, 1)
						mu.Lock()
						successfullyUpdatedSymbols = append(successfullyUpdatedSymbols, symbol)
						mu.Unlock()
					}
				}
			} else {
				log.Printf("%s Daily Fetch: No new chart data returned for %s for the period (API status was 'ok' but no points).", logPrefix, symbol)
				mu.Lock()
				noDataSymbols = append(noDataSymbols, symbol+" (empty data daily)")
				mu.Unlock()
				atomic.AddInt32(&companiesWithNoDataDaily, 1)
			}
		}(company)
		time.Sleep(200 * time.Millisecond)
	}
	wg.Wait()

	log.Printf("%s Daily Fetch Part Complete. Successfully updated: %d, No data: %d, Errors: %d. Symbols with updates: %d",
		logPrefix,
		atomic.LoadInt32(&companiesSuccessfullyUpdatedDaily),
		atomic.LoadInt32(&companiesWithNoDataDaily),
		atomic.LoadInt32(&companiesWithOtherErrorsDaily),
		len(successfullyUpdatedSymbols))

	// --- Start Aggregation Part ---
	log.Printf("%s Starting aggregation for %d symbols that had daily updates.", logPrefix, len(successfullyUpdatedSymbols))
	for _, symbol := range successfullyUpdatedSymbols {
		log.Printf("%s Aggregation: Processing symbol %s", logPrefix, symbol)

		// --- Weekly Aggregation ---
		latestWeeklyAggTs, weeklyFound, errDbW := s.chartRepo.GetLatestAggregatedTimestamp("chart_data_weekly", symbol, "merolagani")
		if errDbW != nil {
			log.Printf("[ERROR]%s Aggregation: Failed to get latest weekly agg timestamp for %s: %v", logPrefix, symbol, errDbW)
		} else {
			fetchDailyFromTsForWeekly := int64(0)
			if weeklyFound {
				fetchDailyFromTsForWeekly = latestWeeklyAggTs
			}
			log.Printf("%s Aggregation: Fetching daily data for %s for weekly aggregation from timestamp %d.", logPrefix, symbol, fetchDailyFromTsForWeekly)
			dailyDataForWeekly, fetchErrW := s.chartRepo.GetChartData(symbol, "merolagani", fetchDailyFromTsForWeekly, time.Now().Unix())
			if fetchErrW != nil {
				log.Printf("[ERROR]%s Aggregation: Failed to fetch daily data for weekly aggregation for %s: %v", logPrefix, symbol, fetchErrW)
			} else if len(dailyDataForWeekly) == 0 && fetchDailyFromTsForWeekly > 0 {
				log.Printf("[INFO]%s Aggregation: No new daily data found for %s since last weekly aggregation (ts %d). Skipping weekly.", logPrefix, symbol, fetchDailyFromTsForWeekly)
			} else if len(dailyDataForWeekly) == 0 {
				log.Printf("[INFO]%s Aggregation: No daily data at all found for %s for weekly aggregation. Skipping weekly.", logPrefix, symbol)
			} else {
				weeklyAggregatedData := aggregateToWeekly(dailyDataForWeekly)
				if len(weeklyAggregatedData) > 0 {
					_, saveErrW := s.chartRepo.SaveWeeklyChartPoints(symbol, "merolagani", weeklyAggregatedData)
					if saveErrW != nil {
						log.Printf("[ERROR]%s Aggregation: Failed to save weekly aggregated data for %s: %v", logPrefix, symbol, saveErrW)
					} else {
						log.Printf("[INFO]%s Aggregation: Successfully saved/updated %d weekly points for %s.", logPrefix, len(weeklyAggregatedData), symbol)
					}
				}
			}
		}

		// --- Monthly Aggregation ---
		latestMonthlyAggTs, monthlyFound, errDbM := s.chartRepo.GetLatestAggregatedTimestamp("chart_data_monthly", symbol, "merolagani")
		if errDbM != nil {
			log.Printf("[ERROR]%s Aggregation: Failed to get latest monthly agg timestamp for %s: %v", logPrefix, symbol, errDbM)
		} else {
			fetchDailyFromTsForMonthly := int64(0)
			if monthlyFound {
				fetchDailyFromTsForMonthly = latestMonthlyAggTs
			}
			log.Printf("%s Aggregation: Fetching daily data for %s for monthly aggregation from timestamp %d.", logPrefix, symbol, fetchDailyFromTsForMonthly)
			dailyDataForMonthly, fetchErrM := s.chartRepo.GetChartData(symbol, "merolagani", fetchDailyFromTsForMonthly, time.Now().Unix())
			if fetchErrM != nil {
				log.Printf("[ERROR]%s Aggregation: Failed to fetch daily data for monthly aggregation for %s: %v", logPrefix, symbol, fetchErrM)
			} else if len(dailyDataForMonthly) == 0 && fetchDailyFromTsForMonthly > 0 {
				log.Printf("[INFO]%s Aggregation: No new daily data found for %s since last monthly aggregation (ts %d). Skipping monthly.", logPrefix, symbol, fetchDailyFromTsForMonthly)
			} else if len(dailyDataForMonthly) == 0 {
				log.Printf("[INFO]%s Aggregation: No daily data at all found for %s for monthly aggregation. Skipping monthly.", logPrefix, symbol)
			} else {
				monthlyAggregatedData := aggregateToMonthly(dailyDataForMonthly)
				if len(monthlyAggregatedData) > 0 {
					_, saveErrM := s.chartRepo.SaveMonthlyChartPoints(symbol, "merolagani", monthlyAggregatedData)
					if saveErrM != nil {
						log.Printf("[ERROR]%s Aggregation: Failed to save monthly aggregated data for %s: %v", logPrefix, symbol, saveErrM)
					} else {
						log.Printf("[INFO]%s Aggregation: Successfully saved/updated %d monthly points for %s.", logPrefix, len(monthlyAggregatedData), symbol)
					}
				}
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	log.Printf("%s Aggregation Part Complete.", logPrefix)

	if atomic.LoadInt32(&companiesWithOtherErrorsDaily) > 0 && len(jobErrors) > 0 {
		log.Printf("[ERROR]%s UpdateMerolaganiChartData: %d other error(s) occurred during daily data fetch/save. First error: %v", logPrefix, atomic.LoadInt32(&companiesWithOtherErrorsDaily), jobErrors[0])
	}
	if atomic.LoadInt32(&companiesWithNoDataDaily) > 0 && len(noDataSymbols) > 0 {
		log.Printf("[INFO]%s UpdateMerolaganiChartData: %d symbol(s) reported no daily data from Merolagani. First few: %v", logPrefix, atomic.LoadInt32(&companiesWithNoDataDaily), firstN(noDataSymbols, 5))
	}
	log.Printf("%s Finished job: UpdateMerolaganiChartData. Daily updates successful for %d companies.", logPrefix, atomic.LoadInt32(&companiesSuccessfullyUpdatedDaily))
}

// RunHistoricalDataJobNow manually triggers the NEPSE historical data scraping and saving process.
func (s *Scheduler) RunHistoricalDataJobNow() bool {
	return s.startExclusive("historical", func() {
		log.Println("[Manual Trigger] Running job: ScrapeHistoricalData (NEPSE)")
		s.runScrapeHistoricalDataInternal("[Manual Trigger]")
		log.Println("[Manual Trigger] Finished job: ScrapeHistoricalData (NEPSE)")
	})
}

// RunMerolaganiChartDataJobNow manually triggers the Merolagani chart data scraping and aggregation.
func (s *Scheduler) RunMerolaganiChartDataJobNow() bool {
	return s.startExclusive("charts", func() {
		log.Println("[Manual Trigger] Running job: UpdateMerolaganiChartData")
		s.executeMerolaganiChartUpdate("[Manual Trigger]")
		log.Println("[Manual Trigger] Finished job: UpdateMerolaganiChartData")
	})
}

// RunPriceScrapeJobNow manually triggers the price scraping job.
// The 'force' parameter bypasses the market status check.
func (s *Scheduler) RunPriceScrapeJobNow(force bool) bool {
	return s.startExclusive("prices", func() {
		log.Println("[Manual Trigger] Running price scrape job now...")
		s.runScrapePricesInternal("[Manual Trigger]", force)
	})
}

// TriggerAllPrimaryJobsUpdate handles requests to manually trigger all primary data scraping jobs.
func (s *Scheduler) RunAllPrimaryJobsNow() bool {
	return s.startExclusive("all", func() {
		log.Println("[Manual Trigger] Running all primary data scraping jobs now...")

		log.Println("[Manual Trigger] Running: ScrapeCompanies")
		if err := s.nepseScraper.ScrapeCompanies(); err != nil {
			log.Printf("[ERROR][Manual Trigger] Failed to scrape companies: %v", err)
		}
		time.Sleep(1 * time.Second)

		log.Println("[Manual Trigger] Running: ScrapeMarketStatus")
		if err := s.nepseScraper.ScrapeMarketStatus(); err != nil {
			log.Printf("[ERROR][Manual Trigger] Failed to scrape market status: %v", err)
		}
		time.Sleep(1 * time.Second)

		log.Println("[Manual Trigger] Running: ScrapePrices")
		s.runScrapePricesInternal("[Manual Trigger]", true)
		time.Sleep(1 * time.Second)

		log.Println("[Manual Trigger] Running: ScrapeTopGainers")
		s.runScrapeGainersInternal("[Manual Trigger]", true)
		time.Sleep(1 * time.Second)

		log.Println("[Manual Trigger] Running: ScrapeTopLosers")
		s.runScrapeLosersInternal("[Manual Trigger]", true)
		time.Sleep(1 * time.Second)

		log.Println("[Manual Trigger] Running: ScrapeMerolaganiNews")
		if err := s.merolaganiScraper.ScrapeNews(); err != nil {
			log.Printf("[ERROR][Manual Trigger] Failed to scrape Merolagani news: %v", err)
		}
		time.Sleep(1 * time.Second)

		log.Println("[Manual Trigger] Running: ScrapeNepalipaisaNews")
		if err := s.nepalipaisaScraper.ScrapeNews(); err != nil {
			log.Printf("[ERROR][Manual Trigger] Failed to scrape Nepalipaisa news: %v", err)
		}
		time.Sleep(1 * time.Second)

		log.Println("[Manual Trigger] Running: ScrapeHistoricalData (NEPSE)")
		s.runScrapeHistoricalDataInternal("[Manual Trigger]")
		time.Sleep(1 * time.Second)

		log.Println("[Manual Trigger] Running: UpdateMerolaganiChartData")
		s.executeMerolaganiChartUpdate("[Manual Trigger]")

		log.Println("[Manual Trigger] All primary jobs trigger attempt complete.")
	})
}

// Internal helper for ScrapePrices to be callable by RunAllPrimaryJobsNow
// forceUpdate allows bypassing the market status check for manual triggers.
func (s *Scheduler) runScrapePricesInternal(logPrefix string, forceUpdate bool) {
	if !forceUpdate {
		currentStatus, err := s.nepseScraper.StatusRepo.GetLatestMarketStatus()
		if err != nil {
			log.Printf("[ERROR]%s ScrapePrices: Failed to get current market status: %v. Skipping job.", logPrefix, err)
			return
		}
		if currentStatus == nil || currentStatus.Status != "OPEN" {
			statusStr := "UNKNOWN"
			if currentStatus != nil {
				statusStr = currentStatus.Status
			}
			log.Printf("[%s][Skip] ScrapePrices: Market is not OPEN (Status: %s). Skipping job.", logPrefix, statusStr)
			// BUGFIX: Do not clear prices when market is closed. The prices table should
			// retain the last known values.
			// if err := s.nepseScraper.PriceRepo.ClearAllPrices(); err != nil {
			// 	log.Printf("[ERROR]%s Failed to clear prices while market is closed: %v", logPrefix, err)
			// }
			return
		}
	} else {
		log.Printf("%s ScrapePrices: Bypassing market status check due to forceUpdate flag.", logPrefix)
	}

	log.Printf("%s Running job: ScrapePrices", logPrefix)
	if err := s.nepseScraper.ScrapePrices(); err != nil {
		log.Printf("[ERROR]%s Failed to scrape prices: %v", logPrefix, err)
	}
}

// Internal helper for ScrapeTopGainers
func (s *Scheduler) runScrapeGainersInternal(logPrefix string, force bool) {
	if !force {
		marketStatus, err := s.nepseScraper.StatusRepo.GetLatestMarketStatus()
		if err != nil {
			log.Printf("[ERROR]%s Failed to get market status for gainer check: %v", logPrefix, err)
			return
		}
		if marketStatus == nil || marketStatus.Status != "OPEN" {
			log.Printf("%s[Skip] Market is not OPEN. Skipping gainer scrape.", logPrefix)
			return
		}
	}

	log.Printf("%s Proceeding with gainer scrape (force=%t).", logPrefix, force)
	if err := s.nepseScraper.ScrapeTopGainers(); err != nil {
		log.Printf("[ERROR]%s Failed to scrape top gainers: %v", logPrefix, err)
	}
}

// Internal helper for ScrapeTopLosers
func (s *Scheduler) runScrapeLosersInternal(logPrefix string, force bool) {
	if !force {
		marketStatus, err := s.nepseScraper.StatusRepo.GetLatestMarketStatus()
		if err != nil {
			log.Printf("[ERROR]%s Failed to get market status for loser check: %v", logPrefix, err)
			return
		}
		if marketStatus == nil || marketStatus.Status != "OPEN" {
			log.Printf("%s[Skip] Market is not OPEN. Skipping loser scrape.", logPrefix)
			return
		}
	}

	log.Printf("%s Proceeding with loser scrape (force=%t).", logPrefix, force)
	if err := s.nepseScraper.ScrapeTopLosers(); err != nil {
		log.Printf("[ERROR]%s Failed to scrape top losers: %v", logPrefix, err)
	}
}

// Internal helper for ScrapeHistoricalData (NEPSE)
func (s *Scheduler) runScrapeHistoricalDataInternal(logPrefix string) {
	log.Printf("%s Running job: ScrapeHistoricalData (NEPSE)", logPrefix)
	if s.companyRepo == nil || s.historicalPriceRepo == nil || s.nepseScraper == nil {
		log.Printf("[ERROR]%s ScrapeHistoricalData: Required repositories or scraper not initialized.", logPrefix)
		return
	}
	securityIDs, err := s.companyRepo.GetAllCompanySecurityIDs()
	if err != nil {
		log.Printf("[ERROR]%s ScrapeHistoricalData: Failed to get security IDs: %v", logPrefix, err)
		return
	}
	if len(securityIDs) == 0 {
		log.Printf("[%s][Skip] ScrapeHistoricalData: No security IDs found in the database yet.", logPrefix)
		return
	}
	log.Printf("%s ScrapeHistoricalData: Found %d security IDs to process.", logPrefix, len(securityIDs))
	var wg sync.WaitGroup
	fetchErrors := make(chan error, len(securityIDs))
	const maxConcurrentFetches = 5
	sem := make(chan struct{}, maxConcurrentFetches)
	defer close(sem)
	for _, securityID := range securityIDs {
		wg.Add(1)
		sem <- struct{}{}
		go func(id int) {
			defer wg.Done()
			defer func() { <-sem }()
			log.Printf("%s Fetching NEPSE historical data for Security ID: %d", logPrefix, id)
			historicalData, errFetch := s.nepseScraper.FetchHistoricalPriceData(id)
			if errFetch != nil {
				log.Printf("[ERROR]%s Failed to fetch NEPSE historical data for ID %d: %v", logPrefix, id, errFetch)
				fetchErrors <- errFetch
				return
			}
			if len(historicalData) > 0 {
				if errSave := s.historicalPriceRepo.SaveHistoricalPrices(id, historicalData); errSave != nil {
					log.Printf("[ERROR]%s Failed to save NEPSE historical data for ID %d: %v", logPrefix, id, errSave)
					fetchErrors <- errSave
				}
			} else {
				log.Printf("%s No NEPSE historical data returned for Security ID: %d", logPrefix, id)
			}
		}(securityID)
	}
	wg.Wait()
	close(fetchErrors)
	for errChan := range fetchErrors {
		if errChan != nil {
			log.Printf("[ERROR]%s At least one error occurred during historical data fetch: %v (see previous logs for all)", logPrefix, errChan)
			break
		}
	}
	log.Printf("%s Finished job: ScrapeHistoricalData (NEPSE)", logPrefix)
}

// Stop stops the scheduler gracefully.
func (s *Scheduler) Stop() {
	log.Println("Stopping scheduler...")
	if s.cronRunner != nil {
		ctx := s.cronRunner.Stop()
		select {
		case <-ctx.Done():
			log.Println("Scheduler stopped gracefully.")
		case <-time.After(5 * time.Second): // Timeout for graceful stop
			log.Println("Scheduler stop timed out.")
		}
	}
	manualJobsDone := make(chan struct{})
	go func() {
		s.jobWG.Wait()
		close(manualJobsDone)
	}()
	select {
	case <-manualJobsDone:
		log.Println("Manual scheduler jobs stopped gracefully.")
	case <-time.After(10 * time.Second):
		log.Println("Manual scheduler jobs are still running after shutdown timeout.")
	}
}

// Helper function to get the first N elements of a string slice
func firstN(slice []string, n int) []string {
	if len(slice) <= n {
		return slice
	}
	return slice[:n]
}

// --- Aggregation Logic (Moved from chart_repository.go or kept local if specific) ---
// These could be further refactored into a separate aggregation package or be part of ChartRepository

func aggregateToWeekly(dailyData []models.ChartDataPoint) []models.ChartDataPoint {
	if len(dailyData) == 0 {
		return nil
	}

	sort.Slice(dailyData, func(i, j int) bool {
		return dailyData[i].Timestamp < dailyData[j].Timestamp
	})

	weeklyAggregates := make(map[time.Time]models.ChartDataPoint)
	weeklyOrder := []time.Time{}

	for _, p := range dailyData {
		pt := time.Unix(p.Timestamp, 0).In(time.UTC)
		// NEPSE's trading week is Sunday-Thursday, so Sunday must start a new
		// candle. ISO/Monday grouping incorrectly merged Sunday with the prior
		// week's Monday-Thursday session.
		offset := int(pt.Weekday())
		weekStart := pt.AddDate(0, 0, -offset).Truncate(24 * time.Hour)

		if _, exists := weeklyAggregates[weekStart]; !exists {
			weeklyAggregates[weekStart] = models.ChartDataPoint{
				Timestamp: weekStart.Unix(),
				Open:      p.Open,
				High:      p.High,
				Low:       p.Low,
				Close:     p.Close,
				Volume:    p.Volume,
			}
			weeklyOrder = append(weeklyOrder, weekStart)
		} else {
			agg := weeklyAggregates[weekStart]
			if p.High > agg.High {
				agg.High = p.High
			}
			if p.Low < agg.Low {
				agg.Low = p.Low
			}
			agg.Close = p.Close    // Last close of the week
			agg.Volume += p.Volume // Sum of volumes
			weeklyAggregates[weekStart] = agg
		}
	}

	result := make([]models.ChartDataPoint, len(weeklyOrder))
	for i, weekStart := range weeklyOrder {
		result[i] = weeklyAggregates[weekStart]
	}
	return result
}

func aggregateToMonthly(dailyData []models.ChartDataPoint) []models.ChartDataPoint {
	if len(dailyData) == 0 {
		return nil
	}
	sort.Slice(dailyData, func(i, j int) bool {
		return dailyData[i].Timestamp < dailyData[j].Timestamp
	})

	monthlyAggregates := make(map[time.Time]models.ChartDataPoint)
	monthlyOrder := []time.Time{}

	for _, p := range dailyData {
		pt := time.Unix(p.Timestamp, 0).In(time.UTC)
		monthStart := time.Date(pt.Year(), pt.Month(), 1, 0, 0, 0, 0, time.UTC)

		if _, exists := monthlyAggregates[monthStart]; !exists {
			monthlyAggregates[monthStart] = models.ChartDataPoint{
				Timestamp: monthStart.Unix(),
				Open:      p.Open,
				High:      p.High,
				Low:       p.Low,
				Close:     p.Close,
				Volume:    p.Volume,
			}
			monthlyOrder = append(monthlyOrder, monthStart)
		} else {
			agg := monthlyAggregates[monthStart]
			if p.High > agg.High {
				agg.High = p.High
			}
			if p.Low < agg.Low {
				agg.Low = p.Low
			}
			agg.Close = p.Close
			agg.Volume += p.Volume
			monthlyAggregates[monthStart] = agg
		}
	}

	result := make([]models.ChartDataPoint, len(monthlyOrder))
	for i, monthStart := range monthlyOrder {
		result[i] = monthlyAggregates[monthStart]
	}
	return result
}
