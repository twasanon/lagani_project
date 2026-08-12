import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import the environment variable
import { API_BASE_URL } from '@env';

// --- Log the API_BASE_URL for clarity during startup ---
console.log(`[nepseScraper] Configured API_BASE_URL: ${API_BASE_URL}`);
// --- End Log ---

import { addOrUpdateCompany, getCompanyBySymbol, addOrUpdatePrices, setTopGainers, setTopLosers, setMarketStatus, saveNewsItems } from '../utils/database'; // Import DB functions
// Removed: import { parseTokenResponse } from '../utils/TokenUtils';

// --- Constants ---
// Use the environment variable instead of hardcoding
// const LOCAL_API_BASE_URL = 'http://localhost:8080'; 
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const COMPANY_LAST_REFRESH_KEY = 'company_last_refresh';
const USER_AGENT = 'LaganiApp/1.0 (React Native)'; // Simpler user agent for our own API

// --- Interfaces for Go API Responses ---

// Matches Go API /companies response item
export interface ApiCompany {
    id: number;
    symbol: string;
    name: string;
}

// Matches Go API /prices response item
export interface ApiPriceStat {
    securityId: number; // Assuming it converts from json.Number
    securityName: string;
    symbol: string;
    indexId: number;
    totalTradeQuantity: number;
    lastTradedPrice: number;
    percentageChange: number;
    previousClose: number;
}

// Matches Go API /top-gainers & /top-losers response item
export interface ApiTopItem {
    symbol: string;
    ltp: number;
    pointChange: number;
    percentageChange: number;
    securityId: number;
    securityName: string;
}

// Matches Go API /market-status response
export interface ApiMarketStatus {
    isOpen: string; 
    asOf: string;  
}

// NEW: Interface for the actual raw response from /market-status endpoint
interface ActualApiMarketStatusResponse {
    status: string; // e.g., "CLOSE" or "OPEN"
    asOf: {
        Time: string; // ISO 8601 timestamp string
        Valid: boolean;
    };
    updatedAt?: string; // Optional, seems to be present in your log
}

// NEW: Matches Go API /news response item
export interface ApiNewsItem {
    title: string;
    link: string;
    imageUrl: string;
    date: string;
}

// NEW: Matches Go API /charts/{symbol} response item
export interface ApiChartDataPoint {
    t: number; // Unix timestamp (seconds, UTC)
    o: number; // Open price
    h: number; // High price
    l: number; // Low price
    c: number; // Close price
    v: number; // Volume
}

// --- Caching (App level - last refresh time) ---
let lastCompanyListFetchTime: number | null = null;
// We might add similar logic for prices/etc. later if needed, 
// but the Go API handles its own caching.

// --- API Fetch Functions ---

/**
 * Fetches the list of active companies from the local Go API.
 */
export const fetchCompanies = async (): Promise<ApiCompany[]> => {
    // Use API_BASE_URL here
    const url = `${API_BASE_URL}/companies`;
    console.log(`[fetchCompanies] Fetching from: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        console.log(`[fetchCompanies] Response status: ${response.status}`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorBody}`);
        }
        let data: ApiCompany[] | null = await response.json();
        if (data === null) {
            console.warn('[fetchCompanies] Received null response, defaulting to empty array.');
            data = [];
        }
        console.log(`[fetchCompanies] Successfully fetched ${data.length} companies.`);
        return data;
    } catch (error: any) {
        console.error("[fetchCompanies] Error:", error.message);
        throw error; // Re-throw for calling function to handle
    }
};

/**
 * Fetches the latest price stats from the local Go API.
 */
export const fetchPrices = async (): Promise<ApiPriceStat[]> => {
    // Use API_BASE_URL here
    const url = `${API_BASE_URL}/prices`;
    console.log(`[fetchPrices] Fetching from: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        console.log(`[fetchPrices] Response status: ${response.status}`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorBody}`);
        }
        let data: ApiPriceStat[] | null = await response.json();
        if (data === null) {
            console.warn('[fetchPrices] Received null response, defaulting to empty array.');
            data = [];
        }
        console.log(`[fetchPrices] Successfully fetched ${data.length} price stats.`);
        return data;
    } catch (error: any) {
        console.error("[fetchPrices] Error:", error.message);
        throw error;
    }
};

/**
 * Fetches the top gainers from the local Go API.
 */
export const fetchTopGainers = async (): Promise<ApiTopItem[]> => {
    // Use API_BASE_URL here
    const url = `${API_BASE_URL}/top-gainers`;
    console.log(`[fetchTopGainers] Fetching from: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        console.log(`[fetchTopGainers] Response status: ${response.status}`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorBody}`);
        }
        let data: ApiTopItem[] | null = await response.json();
        if (data === null) {
            console.warn('[fetchTopGainers] Received null response, defaulting to empty array.');
            data = [];
        }
        console.log(`[fetchTopGainers] Successfully fetched ${data.length} top gainers.`);
        return data;
    } catch (error: any) {
        console.error("[fetchTopGainers] Error:", error.message);
        throw error;
    }
};

/**
 * Fetches the top losers from the local Go API.
 */
export const fetchTopLosers = async (): Promise<ApiTopItem[]> => {
    // Use API_BASE_URL here
    const url = `${API_BASE_URL}/top-losers`;
    console.log(`[fetchTopLosers] Fetching from: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        console.log(`[fetchTopLosers] Response status: ${response.status}`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorBody}`);
        }
        let data: ApiTopItem[] | null = await response.json();
        if (data === null) {
            console.warn('[fetchTopLosers] Received null response, defaulting to empty array.');
            data = [];
        }
        console.log(`[fetchTopLosers] Successfully fetched ${data.length} top losers.`);
        return data;
    } catch (error: any) {
        console.error("[fetchTopLosers] Error:", error.message);
        throw error;
    }
};

/**
 * Fetches the market status from the local Go API.
 */
export const fetchMarketStatus = async (): Promise<ApiMarketStatus> => {
    // Use API_BASE_URL here
    const url = `${API_BASE_URL}/market-status`;
    console.log(`[fetchMarketStatus] Fetching from: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        console.log(`[fetchMarketStatus] Response status: ${response.status}`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorBody}`);
        }
        
        // Parse with the actual response structure
        const rawData: ActualApiMarketStatusResponse | null = await response.json();

        // Validate the structure of rawData
        if (rawData === null || 
            typeof rawData.status !== 'string' || 
            typeof rawData.asOf !== 'object' || 
            rawData.asOf === null || // ensure asOf object is not null
            typeof rawData.asOf.Time !== 'string' || 
            typeof rawData.asOf.Valid !== 'boolean'
           ) {
            console.error('[fetchMarketStatus] Received null, malformed, or incomplete market status data from API:', rawData);
            throw new Error('Invalid market status data received from API.');
        }

        // Transform rawData to the expected ApiMarketStatus format
        const transformedData: ApiMarketStatus = {
            isOpen: rawData.status,  // Map 'status' to 'isOpen'
            asOf: rawData.asOf.Time // Extract the Time string
        };

        console.log(`[fetchMarketStatus] Successfully fetched and transformed market status. isOpen: ${transformedData.isOpen}, asOf: ${transformedData.asOf}`);
        return transformedData;
    } catch (error: any) {
        console.error("[fetchMarketStatus] Error:", error.message);
        throw error;
    }
};

// NEW: Function to fetch news from the Go API
/**
 * Fetches the latest news items from the local Go API.
 */
export const fetchNews = async (): Promise<ApiNewsItem[]> => {
    const url = `${API_BASE_URL}/news`;
    console.log(`[fetchNews] Fetching from: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        console.log(`[fetchNews] Response status: ${response.status}`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorBody}`);
        }
        let data: ApiNewsItem[] | null = await response.json();
        if (data === null) {
            console.warn('[fetchNews] Received null response, defaulting to empty array.');
            data = [];
        }
        console.log(`[fetchNews] Successfully fetched ${data.length} news items.`);
        return data;
    } catch (error: any) {
        console.error("[fetchNews] Error:", error.message);
        throw error;
    }
};

// NEW: Function to fetch stock chart data from the Go API
/**
 * Fetches historical stock data for a given symbol, range, and optional resolution.
 * @param symbol The stock symbol (e.g., "AKJCL").
 * @param range The time range for the data (e.g., "1m", "6m", "1y", "ytd", "all").
 * @param resolution Optional. The data resolution (e.g., "D", "W", "M"). Backend defaults if not provided.
 */
export const fetchStockChartData = async (
    symbol: string,
    range: string,
    resolution?: string
): Promise<ApiChartDataPoint[]> => {
    let url = `${API_BASE_URL}/charts/${symbol}?range=${range}`;
    if (resolution) {
        url += `&resolution=${resolution}`;
    }
    console.log(`[fetchStockChartData] Fetching from: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });
        console.log(`[fetchStockChartData] Response status: ${response.status}`);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[fetchStockChartData] HTTP Error ${response.status} for ${symbol}: ${errorBody}`);
            throw new Error(`HTTP Error ${response.status}: ${errorBody}`);
        }
        let data: ApiChartDataPoint[] | null = await response.json();
        if (data === null) {
            console.warn(`[fetchStockChartData] Received null response for ${symbol}, defaulting to empty array.`);
            data = [];
        }
        console.log(`[fetchStockChartData] Successfully fetched ${data.length} chart data points for ${symbol}.`);
        return data;
    } catch (error: any) {
        console.error(`[fetchStockChartData] Error fetching chart data for ${symbol}:`, error.message);
        // It's often good to return an empty array or throw a custom error
        // depending on how the calling UI wants to handle this.
        // For now, re-throwing.
        throw error;
    }
};

// --- Data Refresh Logic (App Level) ---

/**
 * Fetches all data types from the local API and updates the database.
 * Intended to be called periodically (e.g., every 30 minutes).
 */
export const refreshAllData = async () => {
    console.log("[refreshAllData] Starting data refresh cycle...");
    try {
        // Fetch Companies
        const companies = await fetchCompanies();
        for (const company of companies) {
            // Adapt ApiCompany to the format addOrUpdateCompany expects if needed
            // Assuming addOrUpdateCompany now takes { id, symbol, name }
            await addOrUpdateCompany({
                 id: company.id, 
                 symbol: company.symbol,
                 name: company.name,
                 // Remove fields no longer relevant here
                 // lastPrice: null, 
                 // changePercent: null,
                 // detailUrl: '' 
             });
        }
        console.log(`[refreshAllData] Updated ${companies.length} companies in DB.`);

        // Fetch Prices
        const prices = await fetchPrices();
        // Assuming addOrUpdatePrices expects ApiPriceStat[] or similar
        await addOrUpdatePrices(prices); 
        console.log(`[refreshAllData] Updated ${prices.length} prices in DB.`);

        // Fetch Top Gainers
        const gainers = await fetchTopGainers();
        // Assuming setTopGainers replaces the entire list
        await setTopGainers(gainers); 
        console.log(`[refreshAllData] Set ${gainers.length} top gainers in DB.`);

        // Fetch Top Losers
        const losers = await fetchTopLosers();
        // Assuming setTopLosers replaces the entire list
        await setTopLosers(losers); 
        console.log(`[refreshAllData] Set ${losers.length} top losers in DB.`);

        // Fetch Market Status
        const status = await fetchMarketStatus();
        // Assuming setMarketStatus takes the ApiMarketStatus object
        await setMarketStatus(status);
        console.log(`[refreshAllData] Set market status in DB: ${status.isOpen}`);

        // NEW: Fetch and save News
        const news = await fetchNews();
        // Assuming saveNewsItems expects ApiNewsItem[] or similar structure
        // The interface defined in database.ts doesn't have an id from the API
        // but saveNewsItems uses AUTOINCREMENT, so the mapping is fine.
        await saveNewsItems(news); 
        console.log(`[refreshAllData] Saved ${news.length} news items in DB.`);

        // Update last refresh time in AsyncStorage
        const now = Date.now();
        await AsyncStorage.setItem(COMPANY_LAST_REFRESH_KEY, now.toString());
        console.log("[refreshAllData] Data refresh cycle completed successfully.");

    } catch (error: any) {
        console.error("[refreshAllData] Error during data refresh cycle:", error.message);
        Alert.alert("Data Update Failed", "Could not update market data. Please check your connection or the backend API.");
    }
};

/**
 * Checks if data needs refreshing based on the REFRESH_INTERVAL_MS.
 * Calls refreshAllData if needed.
 */
export const refreshDataIfNeeded = async () => {
    try {
        const lastRefreshStr = await AsyncStorage.getItem(COMPANY_LAST_REFRESH_KEY);
        const lastRefreshTime = lastRefreshStr ? parseInt(lastRefreshStr, 10) : 0;
        const now = Date.now();

        if (now - lastRefreshTime > REFRESH_INTERVAL_MS) {
            console.log("[refreshDataIfNeeded] Refresh interval elapsed. Refreshing all data...");
            await refreshAllData();
        } else {
            console.log(`[refreshDataIfNeeded] No refresh needed. Last refresh was ${Math.round((now - lastRefreshTime) / 60000)} minutes ago.`);
        }
    } catch (error: any) {
        console.error("[refreshDataIfNeeded] Error checking refresh status:", error.message);
        // Decide if we should trigger a refresh anyway on error?
        // Maybe trigger if lastRefreshStr is null/invalid?
    }
};

// Removed: scrapeCompanyDetailBySymbol
// Removed: getToken
// Removed: scrapeAllCompanies (replaced by fetchCompanies and refresh logic)
