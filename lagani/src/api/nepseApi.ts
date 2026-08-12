import { nepseClient } from "nepse-api-helper";
import { Alert } from 'react-native';

// --- Keep our defined Types --- 
export interface Security {
    symbol: string;
    securityName: string;
}

export interface SecurityDetail {
    symbol: string;
    securityName: string;
    lastUpdatedPrice: number;
    previousClose: number;
    percentageChange: number;
    dayHighPrice: number;
    dayLowPrice: number;
    totalTradedVolume: number;
    marketCapitalization?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
}

export interface MarketStatus {
    isOpen: boolean;
}

let isInitialized = false;

// --- Initialization --- 
/**
 * Initializes the nepseClient. Must be called once before using other API functions.
 * Handles potential SSL issues in development (NOTE: This is NOT recommended for production).
 */
const initializeNepseClient = async (): Promise<boolean> => {
    if (isInitialized) return true;
    try {
        // --- DEVELOPMENT ONLY --- 
        // Attempt to bypass SSL issues if in development mode
        // THIS IS INSECURE and should NOT be used in production builds.
        // React Native doesn't directly support NODE_TLS_REJECT_UNAUTHORIZED.
        // Proper solution involves ensuring the server has a valid certificate
        // or configuring trust for self-signed certificates if applicable.
        if (__DEV__) {
            console.warn(
                'Bypassing SSL verification for nepse-api-helper in DEV mode. DO NOT DO THIS IN PRODUCTION.'
            );
            try { // @ts-ignore
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
            } catch (e) { console.error("Could not set NODE_TLS_REJECT_UNAUTHORIZED"); }
        }
        // --- END DEVELOPMENT ONLY --- 

        console.log("Initializing NEPSE API Client...");
        await nepseClient.initialize();
        console.log("NEPSE API Client Initialized Successfully.");
        isInitialized = true;
        return true;
    } catch (error) {
        console.error("Failed to initialize NEPSE API Client:", error);
        Alert.alert("API Error", "Could not initialize connection to NEPSE API.");
        if (error instanceof Error && error.message.includes('SSL')) {
             Alert.alert("SSL Error", "An SSL error occurred. Check console warnings.");
        }
        isInitialized = false;
        return false;
    }
};

// --- API Function Wrappers --- 

/**
 * Fetches the list of all securities.
 */
const fetchSecurities = async (): Promise<Security[]> => {
    if (!isInitialized) throw new Error("NEPSE Client not initialized.");
    try {
        // Let type be inferred (or use any[])
        const securities = await nepseClient.getSecurities(); 
        if (!Array.isArray(securities)) {
            console.error("API Error: getSecurities did not return an array", securities);
            return []; // Return empty array on unexpected type
        }
        // Map assuming structure { symbol: string, securityName: string }
        return securities.map((s: any) => ({ // Use any if type inference is problematic
            symbol: s.symbol,
            securityName: s.securityName,
        }));
    } catch (error) {
        console.error("Failed to fetch securities:", error);
        throw error; 
    }
};

/**
 * Fetches detailed information for a specific security symbol.
 */
const fetchSecurityDetail = async (symbol: string): Promise<SecurityDetail | null> => {
    if (!isInitialized) throw new Error("NEPSE Client not initialized.");
    try {
        // Let type be inferred (or use any)
        const detail = await nepseClient.getSecurityDetail(symbol.toUpperCase());
        
        // --- TEMPORARY LOGGING --- 
        // Log the raw detail to understand its structure
        console.log(`Raw detail received for ${symbol}:`, JSON.stringify(detail, null, 2)); 
        // --- END TEMPORARY LOGGING --- 

        if (detail) {
           // Mapping logic is commented out until we know the correct structure
           /* 
           return {
                symbol: detail.symbol,
                securityName: detail.securityName || `${symbol} Name`, 
                lastUpdatedPrice: detail.lastUpdatedPrice ?? detail.closePrice ?? 0, 
                previousClose: detail.previousClosePrice ?? detail.previousClose ?? 0, 
                percentageChange: detail.percentageChange ?? detail.percentChange ?? 0, 
                dayHighPrice: detail.highPrice ?? detail.dayHighPrice ?? 0, 
                dayLowPrice: detail.lowPrice ?? detail.dayLowPrice ?? 0, 
                totalTradedVolume: detail.totalTradedVolume ?? detail.volume ?? 0, 
                marketCapitalization: detail.marketCapitalization,
                fiftyTwoWeekHigh: detail.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: detail.fiftyTwoWeekLow,
             };
           */
          // Return null for now until mapping is fixed
          return null; 
        } 
        return null;
    } catch (error) {
        console.error(`Failed to fetch security detail for ${symbol}:`, error);
        return null; 
    }
};

/**
 * Fetches the current market status (open/closed).
 */
const fetchMarketStatus = async (): Promise<MarketStatus | null> => {
    if (!isInitialized) throw new Error("NEPSE Client not initialized.");
    try {
        // Let type be inferred (or use any)
        const status = await nepseClient.getMarketStatus(); 
        if (status) {
            // Map inferred type (or any) to our MarketStatus type
            return {
                isOpen: typeof status.isOpen === 'string' && status.isOpen.toUpperCase() === 'OPEN' 
            };
        } 
        return null;
    } catch (error) {
        console.error("Failed to fetch market status:", error);
        return null; 
    }
};

export {
    initializeNepseClient,
    fetchSecurities,
    fetchSecurityDetail,
    fetchMarketStatus,
}; 