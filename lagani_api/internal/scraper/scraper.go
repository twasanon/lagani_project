package scraper

import (
	"log"
	"net/url"
)

// TODO: Define a common Scraper interface if needed.
// type Scraper interface {
// 	 Scrape() error
// }

// Constants shared across scrapers
const (
	defaultUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

// resolveURL helps resolve relative URLs against a base URL.
func resolveURL(baseURL *url.URL, relativeURL string) string {
	if baseURL == nil || relativeURL == "" {
		return relativeURL
	}
	refURL, err := baseURL.Parse(relativeURL)
	if err != nil {
		log.Printf("[WARN] Failed to parse relative URL '%s' against base '%s': %v", relativeURL, baseURL.String(), err)
		return relativeURL // Return original on parse error
	}
	return refURL.String()
}
