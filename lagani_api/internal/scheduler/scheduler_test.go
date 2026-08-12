package scheduler

import (
	"testing"
	"time"

	"lagani_api/internal/models"
)

func chartPoint(date string, open, high, low, close, volume float64) models.ChartDataPoint {
	parsed, err := time.Parse("2006-01-02", date)
	if err != nil {
		panic(err)
	}
	return models.ChartDataPoint{Timestamp: parsed.Unix(), Open: open, High: high, Low: low, Close: close, Volume: volume}
}

func TestAggregateToWeeklyUsesNEPSETradingWeek(t *testing.T) {
	daily := []models.ChartDataPoint{
		chartPoint("2026-01-08", 100, 110, 95, 105, 1000),  // Thursday
		chartPoint("2026-01-11", 106, 112, 101, 111, 2000), // Sunday: new NEPSE week
		chartPoint("2026-01-12", 111, 115, 108, 109, 3000), // Monday
	}
	got := aggregateToWeekly(daily)
	if len(got) != 2 {
		t.Fatalf("weekly candle count = %d, want 2: %#v", len(got), got)
	}
	if date := time.Unix(got[0].Timestamp, 0).UTC().Format("2006-01-02"); date != "2026-01-04" {
		t.Errorf("first week starts %s, want Sunday 2026-01-04", date)
	}
	if date := time.Unix(got[1].Timestamp, 0).UTC().Format("2006-01-02"); date != "2026-01-11" {
		t.Errorf("second week starts %s, want Sunday 2026-01-11", date)
	}
	if got[1].Open != 106 || got[1].High != 115 || got[1].Low != 101 || got[1].Close != 109 || got[1].Volume != 5000 {
		t.Errorf("second weekly OHLCV = %#v", got[1])
	}
}

func TestAggregateToMonthlyOHLCV(t *testing.T) {
	daily := []models.ChartDataPoint{
		chartPoint("2026-01-02", 100, 110, 95, 105, 1000),
		chartPoint("2026-01-30", 106, 115, 90, 112, 2000),
		chartPoint("2026-02-01", 120, 125, 119, 124, 3000),
	}
	got := aggregateToMonthly(daily)
	if len(got) != 2 {
		t.Fatalf("monthly candle count = %d, want 2", len(got))
	}
	if got[0].Open != 100 || got[0].High != 115 || got[0].Low != 90 || got[0].Close != 112 || got[0].Volume != 3000 {
		t.Errorf("January OHLCV = %#v", got[0])
	}
}

func TestExclusiveJobsRejectOverlap(t *testing.T) {
	s := NewScheduler(nil, nil, nil, nil, nil, nil)
	started := make(chan struct{})
	release := make(chan struct{})
	if ok := s.startExclusive("charts", func() {
		close(started)
		<-release
	}); !ok {
		t.Fatal("first chart job did not start")
	}
	<-started
	if s.startExclusive("charts", func() {}) {
		t.Error("overlapping chart job unexpectedly started")
	}
	if s.startExclusive("all", func() {}) {
		t.Error("full refresh unexpectedly started while chart job was active")
	}
	close(release)
	s.jobWG.Wait()
}

func TestStartRejectsInvalidCronConfiguration(t *testing.T) {
	t.Setenv("MARKET_STATUS_SCHEDULE", "not-a-cron")
	t.Setenv("STARTUP_JOBS_ENABLED", "false")
	s := NewScheduler(nil, nil, nil, nil, nil, nil)
	if err := s.Start(); err == nil {
		t.Fatal("Start() error = nil, want invalid schedule error")
	}
}
