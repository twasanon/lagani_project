import * as SQLite from 'expo-sqlite';
import { ApiMarketStatus, ApiPriceStat, ApiTopItem } from '../api/nepseScraper'; // Assuming this path is correct

// --- DB Connection ---
let db: SQLite.SQLiteDatabase;

// Use openDatabaseSync for synchronous opening during initialization.
function openDatabaseSync(): SQLite.SQLiteDatabase {
  if (!db) {
    console.log("[DB] Opening database synchronously...");
    db = SQLite.openDatabaseSync('lagani.db');
    console.log("[DB] Database opened.");
  }
  return db;
}

// Call this early in your app initialization, potentially synchronously.
export function initializeDatabaseSync(): void {
  openDatabaseSync();
}

// Gets the already opened DB instance.
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    // This should ideally not happen if initializeDatabaseSync is called first.
    console.warn("[DB] Database was not initialized synchronously. Opening now...");
    db = SQLite.openDatabaseSync('lagani.db'); // Fallback to sync open
  }
  return db;
}


// --- Type Definitions ---

// Basic company info stored in the Companies table
export interface CompanyItem {
  id: number; // NEPSE Security ID acts as the primary key
  symbol: string;
  name: string;
}

// Watchlist item structure, potentially enriched with price data
export interface WatchlistItem {
  id: number; // Matches the CompanyItem ID
  symbol: string;
  name: string;
  lastPrice?: number | null;
  changePercent?: number | null;
}

// Interface for the prices table (matches ApiPriceStat)
export interface PriceStatItem extends ApiPriceStat {}

// Interface for the top lists table (matches ApiTopItem)
export interface TopListItem extends ApiTopItem {}

// Interface for the market status table (matches ApiMarketStatus)
export interface MarketStatusItem extends ApiMarketStatus {}

// --- Portfolio --- NEW
export interface PortfolioTransaction {
  id?: number; // Auto-incrementing primary key
  symbol: string;
  type: 'BUY' | 'SELL'; // Transaction type
  quantity: number;
  price: number; // Price per share at the time of transaction
  timestamp: string; // ISO 8601 timestamp
}

export interface PortfolioHolding {
  symbol: string; // Primary key
  quantity: number; // Total quantity owned
  averagePurchasePrice: number; // Weighted average purchase price
  companyName?: string; // Optional: Denormalized for easier display
}

// --- Paper Trading --- NEW
export type OrderType = 'BUY' | 'SELL'; // Re-exporting or defining centrally if needed

export interface PaperTradingTransaction {
  id?: number; // Auto-incrementing primary key
  symbol: string;
  orderType: OrderType; // Transaction type ('BUY' or 'SELL')
  quantity: number;
  executedPrice: number; // Price per share at the time of execution
  timestamp: string; // ISO 8601 timestamp
}

export interface PaperTradingHolding {
  symbol: string; // Primary key
  quantity: number; // Total quantity owned in paper portfolio
  averageCost: number; // Weighted average cost for paper trades
  companyName?: string; // Optional: Denormalized for easier display
}

// --- Price Alert --- NEW
export interface PriceAlert {
  id?: number; // Auto-incrementing primary key
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW'; // Price target condition
  createdAt: string; // ISO 8601 timestamp when created
  isActive: boolean; // Flag to check if the alert should be monitored
}

// --- NEW: Paper Portfolio History ---
export interface PaperPortfolioHistoryPoint {
  id?: number;
  timestamp: string; // ISO 8601 timestamp
  totalValue: number; // Calculated total value at that time
}

// --- NEW: News Item ---
export interface NewsItem {
  id?: number; // Use link or a hash as potential primary key if needed, or auto-increment
  title: string;
  link: string; // This could be the primary key if always unique
  imageUrl: string;
  date: string; // Storing as text for simplicity
}

// --- Database Schema Initialization (Async) ---
export const initDatabaseSchema = async (): Promise<void> => {
    const db = await getDb();
    console.log("[DB] Initializing/verifying database schema...");
    try {
        await db.execAsync(`
          PRAGMA journal_mode = WAL;

          CREATE TABLE IF NOT EXISTS Companies (
            id INTEGER PRIMARY KEY NOT NULL, -- Using NEPSE Security ID
            symbol TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS Watchlist (
            id INTEGER PRIMARY KEY NOT NULL, -- Foreign key referencing Companies(id)
            symbol TEXT UNIQUE NOT NULL, -- Store symbol for convenience
            name TEXT NOT NULL, -- Store name for convenience
            FOREIGN KEY (id) REFERENCES Companies(id) ON DELETE CASCADE
          );

          CREATE TABLE IF NOT EXISTS PortfolioTransactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')), -- Enforce type
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP -- Record transaction time
          );

          CREATE TABLE IF NOT EXISTS PortfolioHoldings (
            symbol TEXT PRIMARY KEY NOT NULL, -- Stock symbol
            quantity REAL NOT NULL DEFAULT 0,
            averagePurchasePrice REAL NOT NULL DEFAULT 0,
            companyName TEXT -- Store company name denormalized for convenience
            -- No foreign key to Companies, allowing manual entry perhaps? Or add later.
          );

          CREATE TABLE IF NOT EXISTS Prices (
            securityId INTEGER PRIMARY KEY NOT NULL, -- Matches ApiPriceStat key
            symbol TEXT UNIQUE NOT NULL,
            securityName TEXT,
            indexId INTEGER,
            totalTradeQuantity INTEGER,
            lastTradedPrice REAL,
            percentageChange REAL,
            previousClose REAL
            -- No explicit foreign key to Companies to allow price data even if company info missing
          );

          CREATE TABLE IF NOT EXISTS TopGainers (
            securityId INTEGER PRIMARY KEY NOT NULL, -- Matches ApiTopItem key
            symbol TEXT UNIQUE NOT NULL,
            securityName TEXT,
            ltp REAL,
            pointChange REAL,
            percentageChange REAL
          );

          CREATE TABLE IF NOT EXISTS TopLosers (
            securityId INTEGER PRIMARY KEY NOT NULL, -- Matches ApiTopItem key
            symbol TEXT UNIQUE NOT NULL,
            securityName TEXT,
            ltp REAL,
            pointChange REAL,
            percentageChange REAL
          );

          CREATE TABLE IF NOT EXISTS MarketStatus (
            id INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK (id = 1), -- Singleton table
            isOpen TEXT,
            asOf TEXT
          );

          -- NEW: Table for Price Alerts
          CREATE TABLE IF NOT EXISTS PriceAlerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            targetPrice REAL NOT NULL,
            condition TEXT NOT NULL CHECK(condition IN ('ABOVE', 'BELOW')),
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            isActive INTEGER NOT NULL DEFAULT 1 -- 1 for true, 0 for false
          );

          -- Indexes for faster lookups
          CREATE INDEX IF NOT EXISTS idx_companies_symbol ON Companies (symbol);
          CREATE INDEX IF NOT EXISTS idx_watchlist_symbol ON Watchlist (symbol);
          CREATE INDEX IF NOT EXISTS idx_prices_symbol ON Prices (symbol);
          CREATE INDEX IF NOT EXISTS idx_topgainers_symbol ON TopGainers (symbol);
          CREATE INDEX IF NOT EXISTS idx_toplosers_symbol ON TopLosers (symbol);
          CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON PortfolioTransactions (symbol);
          -- NEW: Indexes for Price Alerts
          CREATE INDEX IF NOT EXISTS idx_pricealerts_symbol ON PriceAlerts (symbol);
          CREATE INDEX IF NOT EXISTS idx_pricealerts_active ON PriceAlerts (isActive);

          -- NEW: Tables for Paper Trading
          CREATE TABLE IF NOT EXISTS PaperTradingTransactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            orderType TEXT NOT NULL CHECK(orderType IN ('BUY', 'SELL')),
            quantity REAL NOT NULL,
            executedPrice REAL NOT NULL,
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS PaperTradingPortfolio (
            symbol TEXT PRIMARY KEY NOT NULL,
            quantity REAL NOT NULL DEFAULT 0,
            averageCost REAL NOT NULL DEFAULT 0,
            companyName TEXT -- Optional: Store company name denormalized
          );

          -- NEW: Table for Portfolio History Tracking
          CREATE TABLE IF NOT EXISTS PaperPortfolioHistory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            totalValue REAL NOT NULL
          );

          -- NEW: Indexes for Paper Trading
          CREATE INDEX IF NOT EXISTS idx_papertransactions_symbol ON PaperTradingTransactions (symbol);
          CREATE INDEX IF NOT EXISTS idx_paperportfolio_symbol ON PaperTradingPortfolio (symbol);
          -- NEW: Index for portfolio history timestamp
          CREATE INDEX IF NOT EXISTS idx_paperhistory_timestamp ON PaperPortfolioHistory (timestamp);

          -- NEW: Table for News Items
          CREATE TABLE IF NOT EXISTS NewsItems (\
            id INTEGER PRIMARY KEY AUTOINCREMENT,\
            title TEXT NOT NULL,\
            link TEXT UNIQUE NOT NULL,\
            imageUrl TEXT,\
            date TEXT\
          );\

          -- NEW: Index for News Items link (if used frequently for lookups)\
          CREATE INDEX IF NOT EXISTS idx_newsitems_link ON NewsItems (link);\
        `);
        console.log("[DB] Database schema initialized/verified successfully.");
    } catch (error) {
         console.error("[DB] Error initializing database schema: ", error);
         throw error;
    }
};

// --- CRUD Operations ---

// == Companies (Master List from API) ==
export const addOrUpdateCompany = async (company: CompanyItem): Promise<void> => {
    const db = await getDb();
    try {
        await db.runAsync(
            'INSERT INTO Companies (id, symbol, name) VALUES (?, ?, ?) ON CONFLICT(symbol) DO UPDATE SET id=excluded.id, name=excluded.name;',
            [company.id, company.symbol, company.name]
        );
    } catch (error) {
        console.error(`[DB] Error adding/updating company ${company.symbol}: `, error);
        throw error;
    }
};

export const bulkAddOrUpdateCompanies = async (companies: CompanyItem[]): Promise<void> => {
    const db = await getDb();
    if (!companies || companies.length === 0) {
        console.log("[DB] No companies provided for bulk update.");
        return;
    }
    try {
        await db.withTransactionAsync(async () => {
            const statement = await db.prepareAsync(
                'INSERT INTO Companies (id, symbol, name) VALUES (?, ?, ?) ON CONFLICT(symbol) DO UPDATE SET id=excluded.id, name=excluded.name;'
            );
            try {
                for (const company of companies) {
                    await statement.executeAsync([Number(company.id), company.symbol, company.name]);
                }
                console.log(`[DB] Bulk updated ${companies.length} companies.`);
            } finally {
                await statement.finalizeAsync();
            }
        });
    } catch (error) {
        console.error("[DB] Error bulk updating companies: ", error);
        throw error;
    }
};

export const getAllCompanies = async (): Promise<CompanyItem[]> => {
    const db = await getDb();
    try {
        return await db.getAllAsync<CompanyItem>('SELECT id, symbol, name FROM Companies ORDER BY symbol ASC;');
    } catch (error) {
        console.error("[DB] Error fetching all companies: ", error);
        throw error;
    }
};

export const getCompanyBySymbol = async (symbol: string): Promise<CompanyItem | null> => {
    const db = await getDb();
    try {
        const row = await db.getFirstAsync<CompanyItem>('SELECT id, symbol, name FROM Companies WHERE symbol = ?;', [symbol]);
        return row ?? null;
    } catch (error) {
        console.error(`[DB] Error fetching company by symbol ${symbol}: `, error);
        throw error;
    }
};

// NEW: Function to search companies by symbol or name
export const searchCompanies = async (query: string, limit: number = 10): Promise<CompanyItem[]> => {
  if (!query || query.trim().length === 0) {
    return [];
  }
  const db = await getDb();
  const searchTerm = `%${query.trim().toUpperCase()}%`; // Use uppercase for case-insensitive like
  try {
    const results = await db.getAllAsync<CompanyItem>(
      `SELECT id, symbol, name 
       FROM Companies 
       WHERE UPPER(symbol) LIKE ? OR UPPER(name) LIKE ? 
       ORDER BY symbol 
       LIMIT ?`, 
      [searchTerm, searchTerm, limit]
    );
    console.log(`[DB] Searched companies for "${query}", found ${results.length}`);
    return results;
  } catch (error) {
    console.error(`[DB] Error searching companies for "${query}":`, error);
    throw error; // Re-throw or handle as needed
  }
};

// == Watchlist ==
export const addStockToWatchlist = async (item: CompanyItem): Promise<void> => {
     const db = await getDb();
    try {
        await db.runAsync('INSERT OR IGNORE INTO Watchlist (id, symbol, name) VALUES (?, ?, ?);', [item.id, item.symbol, item.name]);
        console.log(`[DB] Stock ${item.symbol} added to watchlist (if not exists).`);
    } catch (error) {
        console.error(`[DB] Error adding stock ${item.symbol} to watchlist: `, error);
        throw error;
    }
};

export const removeStockFromWatchlist = async (symbol: string): Promise<void> => {
    const db = await getDb();
    try {
        const result = await db.runAsync('DELETE FROM Watchlist WHERE symbol = ?;', [symbol]);
        if (result.changes > 0) console.log(`[DB] Stock ${symbol} removed from watchlist.`);
    } catch (error) {
        console.error(`[DB] Error removing stock ${symbol} from watchlist: `, error);
        throw error;
    }
};

export const getWatchlistStocks = async (): Promise<WatchlistItem[]> => {
     const db = await getDb();
    try {
        const query = `
            SELECT w.id, w.symbol, w.name, p.lastTradedPrice, p.percentageChange
            FROM Watchlist w LEFT JOIN Prices p ON w.symbol = p.symbol
            ORDER BY w.symbol ASC;
        `;
        const allRows = await db.getAllAsync<any>(query);
        return allRows.map((item) => ({
            id: item.id,
            symbol: item.symbol,
            name: item.name,
            lastPrice: item.lastTradedPrice,
            changePercent: item.percentageChange,
        }));
    } catch (error) {
        console.error("[DB] Error fetching watchlist stocks: ", error);
        throw error;
    }
};

export const isWatchlisted = async (symbol: string): Promise<boolean> => {
  const db = await getDb();
  try {
      const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM Watchlist WHERE symbol = ? LIMIT 1;', [symbol]);
      return row !== null;
  } catch (error) {
      console.error(`[DB] Error checking if ${symbol} is watchlisted: `, error);
      throw error;
  }
};


// == Prices ==
export const addOrUpdatePrices = async (prices: PriceStatItem[]): Promise<void> => {
    const db = await getDb();
    if (!prices || prices.length === 0) {
        console.log("[DB] No prices provided for update.");
        return;
    }
    try {
        await db.withTransactionAsync(async () => {
            // 1. Clear existing data INSIDE the transaction
            await db.runAsync('DELETE FROM Prices;');
            console.log("[DB] Cleared existing Prices data within transaction.");

            // 2. Prepare insert statement
            const statement = await db.prepareAsync(
                 `INSERT INTO Prices (securityId, symbol, securityName, indexId, totalTradeQuantity, lastTradedPrice, percentageChange, previousClose)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
                  ON CONFLICT(securityId) DO UPDATE SET 
                    symbol=excluded.symbol, 
                    securityName=excluded.securityName,
                    indexId=excluded.indexId,
                    totalTradeQuantity=excluded.totalTradeQuantity,
                    lastTradedPrice=excluded.lastTradedPrice,
                    percentageChange=excluded.percentageChange,
                    previousClose=excluded.previousClose;`
            );
            // 3. Execute inserts
            try {
                for (const price of prices) {
                    // Ensure values are not undefined, default to null if necessary
                    await statement.executeAsync([
                        price.securityId,
                        price.symbol,
                        price.securityName ?? null,
                        price.indexId ?? null,
                        price.totalTradeQuantity ?? null,
                        price.lastTradedPrice ?? null,
                        price.percentageChange ?? null,
                        price.previousClose ?? null
                    ]);
                }
                console.log(`[DB] Bulk inserted/updated ${prices.length} prices within transaction.`);
            } finally {
                 // 4. Finalize statement
                await statement.finalizeAsync();
            }
        });
    } catch (error) {
        console.error("[DB] Error bulk updating prices transaction: ", error);
        throw error;
    }
};

export const getAllPrices = async (): Promise<PriceStatItem[]> => {
    const db = await getDb();
    try {
        return await db.getAllAsync<PriceStatItem>('SELECT * FROM Prices;');
    } catch (error) {
        console.error("[DB] Error fetching all prices: ", error);
        throw error;
    }
};

export const getPriceBySymbol = async (symbol: string): Promise<PriceStatItem | null> => {
    const db = await getDb();
    try {
        const query = `
            SELECT securityId, symbol, securityName, indexId, totalTradeQuantity,
                   lastTradedPrice, percentageChange, previousClose
            FROM Prices
            WHERE symbol = ?;
        `;
        const row = await db.getFirstAsync<PriceStatItem>(query, [symbol]);
        return row ?? null;
    } catch (error) {
        console.error(`[DB] Error fetching price for symbol ${symbol}: `, error);
        throw error;
    }
};


// == Top Gainers ==
export const setTopGainers = async (gainers: TopListItem[]): Promise<void> => {
    const db = await getDb();
    try {
        // Delete existing gainers BEFORE starting the transaction
        await db.runAsync('DELETE FROM TopGainers;');
        console.log("[DB] Cleared existing TopGainers data.");

        if (!gainers || gainers.length === 0) {
            console.log("[DB] No gainers data provided or empty array; table cleared.");
            return; // Exit if no gainers to insert
        }

        // Start transaction only for inserts
        await db.withTransactionAsync(async () => {
            const statement = await db.prepareAsync('INSERT INTO TopGainers (securityId, symbol, securityName, ltp, pointChange, percentageChange) VALUES (?, ?, ?, ?, ?, ?);');
             try {
                for (const g of gainers) {
                     await statement.executeAsync([Number(g.securityId), g.symbol, g.securityName, g.ltp, g.pointChange, g.percentageChange]);
                }
                 console.log(`[DB] Bulk inserted ${gainers.length} top gainers.`);
            } finally {
                await statement.finalizeAsync();
            }
        });
    } catch (error) {
        console.error("[DB] Error setting top gainers: ", error);
        throw error;
    }
};

export const getTopGainers = async (): Promise<TopListItem[]> => {
    const db = await getDb();
    try {
        return await db.getAllAsync<TopListItem>('SELECT * FROM TopGainers ORDER BY percentageChange DESC;');
    } catch (error) {
        console.error("[DB] Error fetching top gainers: ", error);
        throw error;
    }
};


// == Top Losers ==
export const setTopLosers = async (losers: TopListItem[]): Promise<void> => {
    const db = await getDb();
    try {
        // Delete existing losers BEFORE starting the transaction
        await db.runAsync('DELETE FROM TopLosers;');
        console.log("[DB] Cleared existing TopLosers data.");

         if (!losers || losers.length === 0) {
            console.log("[DB] No losers data provided or empty array; table cleared.");
            return; // Exit if no losers to insert
        }

        // Start transaction only for inserts
        await db.withTransactionAsync(async () => {
            const statement = await db.prepareAsync('INSERT INTO TopLosers (securityId, symbol, securityName, ltp, pointChange, percentageChange) VALUES (?, ?, ?, ?, ?, ?);');
            try {
                for (const l of losers) {
                     await statement.executeAsync([Number(l.securityId), l.symbol, l.securityName, l.ltp, l.pointChange, l.percentageChange]);
                }
                 console.log(`[DB] Bulk inserted ${losers.length} top losers.`);
            } finally {
                await statement.finalizeAsync();
            }
        });
    } catch (error) {
        console.error("[DB] Error setting top losers: ", error);
        throw error;
    }
};

export const getTopLosers = async (): Promise<TopListItem[]> => {
     const db = await getDb();
    try {
        return await db.getAllAsync<TopListItem>('SELECT * FROM TopLosers ORDER BY percentageChange ASC;');
    } catch (error) {
        console.error("[DB] Error fetching top losers: ", error);
        throw error;
    }
};


// == Market Status ==
export const setMarketStatus = async (status: MarketStatusItem): Promise<void> => {
    const db = await getDb();
    if (!status) {
        console.warn("[DB] Attempted to set market status with null/undefined data.");
        return;
    }
    try {
        await db.runAsync(
            'INSERT INTO MarketStatus (id, isOpen, asOf) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET isOpen=excluded.isOpen, asOf=excluded.asOf;',
            [status.isOpen ?? null, status.asOf ?? null]
        );
    } catch (error) {
        console.error("[DB] Error setting market status: ", error);
        throw error;
    }
};

export const getMarketStatus = async (): Promise<MarketStatusItem | null> => {
    const db = await getDb();
    try {
        return await db.getFirstAsync<MarketStatusItem>('SELECT isOpen, asOf FROM MarketStatus WHERE id = 1;');
    } catch (error) {
        console.error("[DB] Error fetching market status: ", error);
        throw error;
    }
};

// --- Portfolio CRUD Operations --- NEW

// Add a transaction and update holdings atomically
export const addPortfolioTransactionAndUpdateHolding = async (transaction: Omit<PortfolioTransaction, 'id' | 'timestamp'>): Promise<void> => {
    const db = await getDb();
    const { symbol, type, quantity, price } = transaction;

    if (quantity <= 0 || price <= 0) {
        throw new Error("Transaction quantity and price must be positive.");
    }

    try {
        await db.withTransactionAsync(async () => {
            // 1. Insert the transaction
            const txInsertResult = await db.runAsync(
                'INSERT INTO PortfolioTransactions (symbol, type, quantity, price) VALUES (?, ?, ?, ?);',
                [symbol, type, quantity, price]
            );
            const transactionId = txInsertResult.lastInsertRowId;
            console.log(`[DB] Added PortfolioTransaction ID: ${transactionId} for ${symbol}`);

            // 2. Get current holding (if exists)
            const currentHolding = await db.getFirstAsync<PortfolioHolding>(
                'SELECT symbol, quantity, averagePurchasePrice, companyName FROM PortfolioHoldings WHERE symbol = ?;',
                [symbol]
            );

            let newQuantity = 0;
            let newAveragePrice = 0;
            let companyName = currentHolding?.companyName; // Keep existing name if holding exists

            if (type === 'BUY') {
                if (currentHolding) {
                    // Update existing holding
                    const currentTotalValue = currentHolding.quantity * currentHolding.averagePurchasePrice;
                    const transactionValue = quantity * price;
                    newQuantity = currentHolding.quantity + quantity;
                    newAveragePrice = (currentTotalValue + transactionValue) / newQuantity;
                } else {
                    // First time buying this stock
                    newQuantity = quantity;
                    newAveragePrice = price;
                    // Attempt to fetch company name if not already stored
                    const company = await getCompanyBySymbol(symbol);
                    companyName = company?.name;
                }
            } else { // type === 'SELL' (Handle potential errors)
                if (!currentHolding || currentHolding.quantity < quantity) {
                    throw new Error(`Cannot sell ${quantity} shares of ${symbol}: Only own ${currentHolding?.quantity ?? 0}.`);
                }
                newQuantity = currentHolding.quantity - quantity;
                // Average purchase price doesn't change on sell
                newAveragePrice = currentHolding.averagePurchasePrice;
                // If quantity becomes 0, average price should ideally reset or be ignored
                if (newQuantity === 0) {
                    newAveragePrice = 0; // Reset average price if sold out
                }
            }

            // Ensure companyName is null if undefined before DB operation
            const dbCompanyName = companyName ?? null;

            // 3. Insert or Update the PortfolioHoldings table
            if (newQuantity > 0) {
                await db.runAsync(
                    `INSERT INTO PortfolioHoldings (symbol, quantity, averagePurchasePrice, companyName)
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT(symbol) DO UPDATE SET
                       quantity = excluded.quantity,
                       averagePurchasePrice = excluded.averagePurchasePrice,
                       companyName = COALESCE(excluded.companyName, companyName); -- Update name only if new one provided`,
                    [symbol, newQuantity, newAveragePrice, dbCompanyName]
                );
                 console.log(`[DB] Updated PortfolioHolding for ${symbol}: Qty=${newQuantity}, AvgPrice=${newAveragePrice.toFixed(2)}`);
            } else {
                // If quantity is 0 or less after selling, remove the holding
                await db.runAsync('DELETE FROM PortfolioHoldings WHERE symbol = ?;', [symbol]);
                console.log(`[DB] Removed PortfolioHolding for ${symbol} as quantity reached zero.`);
            }
        });
    } catch (error) {
        console.error(`[DB] Error adding transaction or updating holding for ${symbol}: `, error);
        throw error; // Re-throw to signal failure
    }
};

// Get all current portfolio holdings
export const getPortfolioHoldings = async (): Promise<PortfolioHolding[]> => {
    const db = await getDb();
    try {
        // Fetch holdings, potentially join with Companies if needed later, but keep simple for now
        return await db.getAllAsync<PortfolioHolding>(
            'SELECT symbol, quantity, averagePurchasePrice, companyName FROM PortfolioHoldings WHERE quantity > 0 ORDER BY symbol ASC;'
        );
    } catch (error) {
        console.error("[DB] Error fetching portfolio holdings: ", error);
        throw error;
    }
};

// Get a specific portfolio holding by symbol
export const getPortfolioHoldingBySymbol = async (symbol: string): Promise<PortfolioHolding | null> => {
    const db = await getDb();
    try {
        return await db.getFirstAsync<PortfolioHolding>(
            'SELECT symbol, quantity, averagePurchasePrice, companyName FROM PortfolioHoldings WHERE symbol = ?;',
            [symbol]
        );
    } catch (error) {
        console.error(`[DB] Error fetching portfolio holding for symbol ${symbol}: `, error);
        throw error;
    }
};

// Get all transactions for a specific symbol
export const getTransactionsBySymbol = async (symbol: string): Promise<PortfolioTransaction[]> => {
    const db = await getDb();
    try {
        return await db.getAllAsync<PortfolioTransaction>(
            'SELECT id, symbol, type, quantity, price, timestamp FROM PortfolioTransactions WHERE symbol = ? ORDER BY timestamp DESC;',
            [symbol]
        );
    } catch (error) {
        console.error(`[DB] Error fetching transactions for symbol ${symbol}: `, error);
        throw error;
    }
};

// Recalculate and update a holding based on all its transactions
// This should be called after deleting a transaction
const recalculateHolding = async (symbol: string, db: SQLite.SQLiteDatabase): Promise<void> => {
    console.log(`[DB] Recalculating holding for ${symbol}...`);
    // Get all remaining transactions, oldest first for correct calculation
    const transactions = await db.getAllAsync<PortfolioTransaction>(
        'SELECT type, quantity, price FROM PortfolioTransactions WHERE symbol = ? ORDER BY timestamp ASC;',
        [symbol]
    );

    let currentQuantity = 0;
    let totalCost = 0;
    let totalBuyQuantity = 0;

    for (const tx of transactions) {
        if (tx.type === 'BUY') {
            currentQuantity += tx.quantity;
            totalCost += tx.quantity * tx.price;
            totalBuyQuantity += tx.quantity;
        } else { // SELL
            // Reduce quantity. Cost basis isn't directly affected by sell price in avg calculation.
            currentQuantity -= tx.quantity;
        }
        // Prevent quantity from going below zero in calculation, though DB constraints should handle this
        currentQuantity = Math.max(0, currentQuantity);
    }

    const newAveragePrice = totalBuyQuantity > 0 ? totalCost / totalBuyQuantity : 0;
    const newQuantity = currentQuantity;

    // Fetch company name if we already have it stored
    const existingHolding = await db.getFirstAsync<{ companyName: string | null }>(
         'SELECT companyName FROM PortfolioHoldings WHERE symbol = ?;',
         [symbol]
    );
    const companyName = existingHolding?.companyName ?? null;

    // Update or delete the holding
    if (newQuantity > 0) {
         await db.runAsync(
            `INSERT INTO PortfolioHoldings (symbol, quantity, averagePurchasePrice, companyName)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(symbol) DO UPDATE SET
               quantity = excluded.quantity,
               averagePurchasePrice = excluded.averagePurchasePrice,
               -- Keep existing name if recalculation happens without fetching it again
               companyName = COALESCE(companyName, excluded.companyName);`,
            [symbol, newQuantity, newAveragePrice, companyName]
        );
        console.log(`[DB] Recalculated holding for ${symbol}: Qty=${newQuantity}, AvgPrice=${newAveragePrice.toFixed(2)}`);
    } else {
        await db.runAsync('DELETE FROM PortfolioHoldings WHERE symbol = ?;', [symbol]);
        console.log(`[DB] Deleted holding for ${symbol} during recalculation as quantity reached zero.`);
    }
};

// Delete a specific transaction and trigger recalculation
export const deletePortfolioTransaction = async (transactionId: number): Promise<void> => {
    const db = await getDb();
    let symbol: string | null = null;

    try {
         await db.withTransactionAsync(async () => {
             // 1. Get the symbol before deleting (to know which holding to recalculate)
             const transaction = await db.getFirstAsync<{ symbol: string }>(
                 'SELECT symbol FROM PortfolioTransactions WHERE id = ?;',
                 [transactionId]
             );
             if (!transaction) {
                 throw new Error(`Transaction with ID ${transactionId} not found.`);
             }
             symbol = transaction.symbol;

             // 2. Delete the transaction
             const result = await db.runAsync('DELETE FROM PortfolioTransactions WHERE id = ?;', [transactionId]);
             if (result.changes === 0) {
                 // Should not happen if transaction was found, but good safety check
                 throw new Error(`Failed to delete transaction ID ${transactionId}. Maybe it was already deleted?`);
             }
             console.log(`[DB] Deleted PortfolioTransaction ID: ${transactionId} for symbol ${symbol}`);

             // 3. Recalculate the holding for that symbol
             await recalculateHolding(symbol, db);
        });
        console.log(`[DB] Successfully deleted transaction ${transactionId} and recalculated holding for ${symbol}.`);
    } catch (error) {
        console.error(`[DB] Error deleting transaction ${transactionId} (Symbol: ${symbol ?? 'unknown'}): `, error);
        throw error; // Re-throw to signal failure
    }
};

// Renamed: Get ALL transactions for symbols currently in PortfolioHoldings
export const getAllTransactionsForHeldSymbols = async (): Promise<PortfolioTransaction[]> => {
    const db = await getDb();
    try {
        // Fetch symbols that have a holding (quantity > 0)
        const holdings = await db.getAllAsync<PortfolioHolding>(
            'SELECT symbol FROM PortfolioHoldings WHERE quantity > 0'
        );
        const symbols = holdings.map(h => h.symbol);

        if (symbols.length === 0) {
            return []; // No holdings, so no transactions to show
        }

        // Create placeholders for the IN clause
        const placeholders = symbols.map(() => '?').join(',');
        
        // Fetch all transactions (BUY and SELL) for those symbols
        return await db.getAllAsync<PortfolioTransaction>(
            `SELECT id, symbol, type, quantity, price, timestamp 
             FROM PortfolioTransactions 
             WHERE symbol IN (${placeholders}) 
             ORDER BY symbol ASC, timestamp ASC;`, 
            symbols // Pass symbols as arguments
        );
    } catch (error) {
        console.error("[DB] Error fetching all transactions for held symbols: ", error);
        throw error;
    }
};

// Function to fetch current prices for multiple symbols (useful for portfolio valuation)
export const getPricesBySymbols = async (symbols: string[]): Promise<Record<string, PriceStatItem>> => {
    const db = await getDb();
    if (!symbols || symbols.length === 0) {
        return {};
    }
    try {
        const placeholders = symbols.map(() => '?').join(',');
        const query = `
            SELECT securityId, symbol, securityName, indexId, totalTradeQuantity,
                   lastTradedPrice, percentageChange, previousClose
            FROM Prices
            WHERE symbol IN (${placeholders});
        `;
        const rows = await db.getAllAsync<PriceStatItem>(query, symbols);

        // Convert array to a Record (object map) for easy lookup by symbol
        const priceMap: Record<string, PriceStatItem> = {};
        rows.forEach(row => {
            priceMap[row.symbol] = row;
        });
        return priceMap;
    } catch (error) {
        console.error(`[DB] Error fetching prices for symbols ${symbols.join(', ')}: `, error);
        throw error;
    }
};

// Function to update a specific transaction and recalculate holding
export const updatePortfolioTransaction = async (transactionId: number, newQuantity: number, newPrice: number): Promise<void> => {
    const db = await getDb();
    console.log(`[DB] Attempting to update transaction ID: ${transactionId} to Qty: ${newQuantity}, Price: ${newPrice}`);
    
    // Validate inputs
    if (transactionId == null || newQuantity == null || newPrice == null || newQuantity <= 0 || newPrice < 0) {
        const errorMsg = "[DB] Invalid input for updating transaction.";
        console.error(errorMsg, { transactionId, newQuantity, newPrice });
        throw new Error(errorMsg);
    }

    try {
        // Find the transaction to get the symbol
        const transaction = await db.getFirstAsync<PortfolioTransaction>(
            'SELECT symbol FROM PortfolioTransactions WHERE id = ?', 
            [transactionId]
        );

        if (!transaction) {
            throw new Error(`[DB] Transaction with ID ${transactionId} not found for update.`);
        }
        const symbol = transaction.symbol;

        await db.withTransactionAsync(async () => {
             // 1. Update the specific transaction
            await db.runAsync(
                'UPDATE PortfolioTransactions SET quantity = ?, price = ? WHERE id = ?',
                [newQuantity, newPrice, transactionId]
            );
            console.log(`[DB] Updated transaction ID: ${transactionId} in PortfolioTransactions table.`);

            // 2. Recalculate the holding for the affected symbol
            await recalculateHolding(symbol, db); // Pass the db instance to reuse the transaction
            console.log(`[DB] Recalculated holding for symbol: ${symbol} after transaction update.`);
        });

    } catch (error) {
        console.error(`[DB] Error updating transaction ID ${transactionId}:`, error);
        throw error; // Re-throw the error after logging
    }
};

// == Price Alerts == NEW

/**
 * Adds a new price alert to the database.
 */
export const addPriceAlert = async (alertData: Omit<PriceAlert, 'id' | 'createdAt' | 'isActive'>): Promise<void> => {
    const db = await getDb();
    try {
        await db.runAsync(
            'INSERT INTO PriceAlerts (symbol, targetPrice, condition, isActive) VALUES (?, ?, ?, 1);', // Default to active
            [alertData.symbol, alertData.targetPrice, alertData.condition]
        );
        console.log(`[DB] Price alert added for ${alertData.symbol} at ${alertData.targetPrice} (${alertData.condition}).`);
    } catch (error) {
        console.error(`[DB] Error adding price alert for ${alertData.symbol}: `, error);
        throw error;
    }
};

/**
 * Fetches all currently active price alerts.
 */
export const getActivePriceAlerts = async (): Promise<PriceAlert[]> => {
    const db = await getDb();
    try {
        const results = await db.getAllAsync<any>('SELECT id, symbol, targetPrice, condition, createdAt, isActive FROM PriceAlerts WHERE isActive = 1;');
        // Convert isActive from 0/1 to boolean
        return results.map(row => ({ ...row, isActive: row.isActive === 1 }));
    } catch (error) {
        console.error("[DB] Error fetching active price alerts: ", error);
        throw error;
    }
};

/**
 * Deactivates a specific price alert by its ID.
 */
export const deactivatePriceAlert = async (id: number): Promise<void> => {
  const db = await getDb();
  try {
    await db.runAsync('UPDATE PriceAlerts SET isActive = 0 WHERE id = ?;', [id]);
    console.log(`[DB_Alerts] Deactivated price alert with ID: ${id}`);
  } catch (error) {
    console.error(`[DB_Alerts] Error deactivating price alert ${id}: `, error);
    throw error;
  }
};

/**
 * Permanently deletes a specific price alert by its ID.
 */
export const deletePriceAlert = async (id: number): Promise<void> => {
    const db = await getDb();
    try {
        await db.runAsync('DELETE FROM PriceAlerts WHERE id = ?;', [id]);
        console.log(`[DB_Alerts] Deleted price alert with ID: ${id}`);
    } catch (error) {
        console.error(`[DB_Alerts] Error deleting price alert ${id}: `, error);
        throw error;
    }
};

// == Paper Trading == NEW

// Function to record a paper trade transaction
export const recordPaperTrade = async (
  symbol: string,
  orderType: OrderType,
  quantity: number,
  executedPrice: number
): Promise<void> => {
  const db = await getDb();
  const upperSymbol = symbol.toUpperCase();
  try {
    await db.runAsync(
      'INSERT INTO PaperTradingTransactions (symbol, orderType, quantity, executedPrice) VALUES (?, ?, ?, ?);',
      [upperSymbol, orderType, quantity, executedPrice]
    );
    console.log(`[DB_Paper] Recorded ${orderType} trade for ${quantity} ${upperSymbol} @ ${executedPrice}`);
  } catch (error) {
    console.error(`[DB_Paper] Error recording paper trade for ${upperSymbol}: `, error);
    throw error;
  }
};

// Function to fetch all paper trading transaction history, newest first
export const getPaperTradingHistory = async (): Promise<PaperTradingTransaction[]> => {
  const db = await getDb();
  try {
    const results = await db.getAllAsync<PaperTradingTransaction>(
      'SELECT id, symbol, orderType, quantity, executedPrice, timestamp FROM PaperTradingTransactions ORDER BY timestamp DESC;'
    );
    return results;
  } catch (error) {
    console.error("[DB_Paper] Error fetching paper trading history: ", error);
    throw error; // Re-throw the error for handling upstream
  }
};


// Function to get a specific paper portfolio item by symbol
export const getPaperPortfolioItem = async (symbol: string): Promise<PaperTradingHolding | null> => {
  const db = await getDb();
  const upperSymbol = symbol.toUpperCase();
  try {
    const row = await db.getFirstAsync<PaperTradingHolding>(
      'SELECT symbol, quantity, averageCost, companyName FROM PaperTradingPortfolio WHERE symbol = ?;',
      [upperSymbol]
    );
    return row ?? null;
  } catch (error) {
    console.error(`[DB_Paper] Error fetching paper portfolio item for ${upperSymbol}: `, error);
    throw error;
  }
};


// Function to add or update a paper portfolio item after a trade
// This handles both BUY and SELL orders to update the quantity and average cost.
export const addOrUpdatePaperPortfolioItem = async (
    symbol: string,
    tradeQuantity: number, // Positive for BUY, use positive value for SELL quantity here
    tradePrice: number,
    orderType: OrderType
): Promise<void> => {
    const db = await getDb();
    const upperSymbol = symbol.toUpperCase();

    try {
        await db.withTransactionAsync(async () => {
            const existingHolding = await db.getFirstAsync<PaperTradingHolding>(
                'SELECT quantity, averageCost FROM PaperTradingPortfolio WHERE symbol = ?;',
                [upperSymbol]
            );

            let newQuantity = 0;
            let newAverageCost = 0;

            if (orderType === 'BUY') {
                if (existingHolding) {
                    const currentTotalValue = existingHolding.quantity * existingHolding.averageCost;
                    const tradeValue = tradeQuantity * tradePrice;
                    newQuantity = existingHolding.quantity + tradeQuantity;
                    newAverageCost = (currentTotalValue + tradeValue) / newQuantity;
                } else {
                    // First time buying this stock
                    newQuantity = tradeQuantity;
                    newAverageCost = tradePrice;
                }
            } else { // SELL
                if (!existingHolding || existingHolding.quantity < tradeQuantity) {
                     console.error(`[DB_Paper] Attempted to sell more ${upperSymbol} than held. Held: ${existingHolding?.quantity}, Tried to sell: ${tradeQuantity}`);
                     // Throwing an error here might be better depending on how executeTrade handles it
                     throw new Error(`Insufficient paper holdings for ${upperSymbol} to sell ${tradeQuantity}`);
                }
                newQuantity = existingHolding.quantity - tradeQuantity;
                // Average cost remains the same when selling
                newAverageCost = existingHolding.averageCost;

                // If quantity becomes zero (or negligible due to float issues), keep avgCost or remove row
                 if (newQuantity < 0.0001) {
                     newQuantity = 0;
                     newAverageCost = 0; // Reset avg cost if selling all
                 }

            }

             // Fetch company name if inserting for the first time
            let companyName: string | undefined | null = existingHolding?.companyName;
            if (!existingHolding) {
                const companyInfo = await db.getFirstAsync<{ name: string }>(
                    'SELECT name FROM Companies WHERE symbol = ?;',
                    [upperSymbol]
                );
                companyName = companyInfo?.name;
            }


            if (newQuantity > 0) {
                 // Insert or update the holding
                await db.runAsync(
                    `INSERT INTO PaperTradingPortfolio (symbol, quantity, averageCost, companyName)
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT(symbol) DO UPDATE SET
                       quantity = excluded.quantity,
                       averageCost = excluded.averageCost;`,
                    [upperSymbol, newQuantity, newAverageCost, companyName ?? null] // Pass null instead of undefined
                );
                 console.log(`[DB_Paper] Updated paper portfolio for ${upperSymbol}. New Qty: ${newQuantity}, New AvgCost: ${newAverageCost}`);
            } else {
                 // If quantity is zero, remove the holding from the portfolio
                 await db.runAsync('DELETE FROM PaperTradingPortfolio WHERE symbol = ?;', [upperSymbol]);
                 console.log(`[DB_Paper] Removed ${upperSymbol} from paper portfolio as quantity reached zero.`);
            }
        });
    } catch (error) {
        console.error(`[DB_Paper] Error updating paper portfolio for ${upperSymbol}: `, error);
        throw error;
    }
};

// Function to fetch all paper trading holdings
export const getPaperTradingPortfolio = async (): Promise<PaperTradingHolding[]> => {
    const db = await getDb();
    try {
        const holdings = await db.getAllAsync<PaperTradingHolding>(`
            SELECT
                ptf.symbol,
                ptf.quantity,
                ptf.averageCost,
                COALESCE(ptf.companyName, c.name) as companyName -- Fallback to Companies table if name missing
            FROM PaperTradingPortfolio ptf
            LEFT JOIN Companies c ON ptf.symbol = c.symbol
            WHERE ptf.quantity > 0
            ORDER BY ptf.symbol ASC;
        `);
        return holdings;
    } catch (error) {
        console.error("[DB_Paper] Error fetching paper trading portfolio: ", error);
        throw error;
    }
};


// Helper function (similar to one used in PaperTradingScreen, adjust if needed)
// Might be deprecated if addOrUpdatePaperPortfolioItem covers all cases
export const updatePortfolioItemQuantity = async (symbol: string, quantityChange: number): Promise<void> => {
  const db = await getDb();
  const upperSymbol = symbol.toUpperCase();
  console.warn("[DB_Paper] updatePortfolioItemQuantity is likely deprecated. Use addOrUpdatePaperPortfolioItem instead.");
  // This function is potentially problematic as it doesn't handle average cost correctly on its own.
  // Prefer using addOrUpdatePaperPortfolioItem which handles BUY/SELL logic including average cost.
  try {
    await db.runAsync(
      'UPDATE PaperTradingPortfolio SET quantity = quantity + ? WHERE symbol = ?;',
      [quantityChange, upperSymbol]
    );
     // Add logic to delete if quantity <= 0
     await db.runAsync('DELETE FROM PaperTradingPortfolio WHERE symbol = ? AND quantity <= 0;', [upperSymbol]);
    console.log(`[DB_Paper] Updated quantity for ${upperSymbol} by ${quantityChange}. Use addOrUpdatePaperPortfolioItem for full logic.`);
  } catch (error) {
    console.error(`[DB_Paper] Error updating quantity for ${upperSymbol}: `, error);
    throw error;
  }
};

// == Paper Trading Reset == NEW
export const resetPaperTradingData = async (): Promise<void> => {
    const db = await getDb();
    console.warn("[DB_Paper] Resetting all paper trading data!");
    try {
        await db.withTransactionAsync(async () => {
            await db.runAsync('DELETE FROM PaperTradingTransactions;');
            await db.runAsync('DELETE FROM PaperTradingPortfolio;');
            await db.runAsync('DELETE FROM PaperPortfolioHistory;'); // <-- Also clear history
            console.log("[DB_Paper] Cleared PaperTradingTransactions, PaperTradingPortfolio, and PaperPortfolioHistory tables.");
        });
    } catch (error) {
        console.error("[DB_Paper] Error resetting paper trading data: ", error);
        throw error;
    }
};

// --- NEW: Record Current Portfolio Value ---
export const recordPaperPortfolioValue = async (): Promise<void> => {
    const db = await getDb();
    try {
        // 1. Get current holdings
        const holdings = await getPaperTradingPortfolio(); // Reuse existing function
        if (holdings.length === 0) {
            console.log("[DB_Paper_History] No paper holdings, skipping value recording.");
            return;
        }

        // 2. Get current prices for these holdings
        const symbols = holdings.map(h => h.symbol);
        const currentPrices = await getPricesBySymbols(symbols); // Reuse existing function

        // 3. Calculate total value
        let totalValue = 0;
        for (const holding of holdings) {
            const price = currentPrices[holding.symbol]?.lastTradedPrice;
            if (price !== null && price !== undefined) { // Ensure price is valid
                totalValue += holding.quantity * price;
            }
            // If price is missing for a holding, its value won't be added. Consider logging?
        }

        // 4. Record the value
        await db.runAsync(
            'INSERT INTO PaperPortfolioHistory (totalValue) VALUES (?);',
            [totalValue]
        );
        console.log(`[DB_Paper_History] Recorded total paper portfolio value: ${totalValue.toFixed(2)}`);

    } catch (error) {
        console.error("[DB_Paper_History] Error recording paper portfolio value: ", error);
        // Don't re-throw, failure to record history shouldn't block other operations typically
    }
};

// --- NEW: Get Portfolio History Data ---
// Fetches the last N points for the chart
export const getPaperPortfolioHistory = async (limit: number = 30): Promise<PaperPortfolioHistoryPoint[]> => {
    const db = await getDb();
    try {
        const results = await db.getAllAsync<PaperPortfolioHistoryPoint>('SELECT * FROM PaperPortfolioHistory ORDER BY timestamp DESC LIMIT ?', [limit]);
        return results;
    } catch (error) {
        console.error(`[DB] Error getting paper portfolio history: ${error}`);
        return [];
    }
};


// --- NEW: News Items CRUD ---

/**
 * Saves news items to the database, replacing existing ones.
 * Uses the news link as a unique identifier to avoid duplicates on re-fetch.
 */
export const saveNewsItems = async (newsItems: NewsItem[]): Promise<void> => {
    const db = await getDb();
    try {
        await db.withTransactionAsync(async () => {
            // Clear existing news first to only keep the latest batch
            await db.runAsync('DELETE FROM NewsItems;');

            // Prepare statement for insertion
            const statement = await db.prepareAsync(
                'INSERT OR REPLACE INTO NewsItems (title, link, imageUrl, date) VALUES (?, ?, ?, ?)'
            );
            try {
                for (const item of newsItems) {
                    await statement.executeAsync([
                        item.title,
                        item.link,
                        item.imageUrl,
                        item.date
                    ]);
                }
                console.log(`[DB] Successfully inserted/replaced ${newsItems.length} news items.`);
            } finally {
                await statement.finalizeAsync();
            }
        });
    } catch (error) {
        console.error(`[DB] Error saving news items: ${error}`);
        throw error; // Re-throw to signal the issue
    }
};

/**
 * Retrieves all saved news items, ordered by ID (approximates fetch order).
 */
export const getNewsItems = async (): Promise<NewsItem[]> => {
    const db = await getDb();
    try {
        // Order by ID DESC to get newest first based on insertion order
        const results = await db.getAllAsync<NewsItem>('SELECT * FROM NewsItems ORDER BY id DESC;');
        return results;
    } catch (error) {
        console.error(`[DB] Error getting news items: ${error}`);
        return []; // Return empty array on error
    }
};


// Helper function ...
// ... updatePortfolioItemQuantity ...

// Note: No separate export block is needed when using `export const` for each function. 