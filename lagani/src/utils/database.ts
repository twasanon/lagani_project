import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { calculatePosition, assertValidPrice, assertValidShareQuantity } from '../domain/portfolio';
import {
  Company,
  MarketMover,
  MarketSnapshot,
  MarketStatus,
  NewsArticle,
  PriceStat,
} from '../types/market';

const DATABASE_NAME = 'lagani.db';
const CACHE_SCHEMA_VERSION = 2;
export const DEFAULT_PAPER_TRADING_BALANCE = 1_000_000;

let db: SQLite.SQLiteDatabase | undefined;
let dbPromise: Promise<SQLite.SQLiteDatabase> | undefined;
let writeQueue: Promise<unknown> = Promise.resolve();

export interface CompanyItem extends Company {
  /** Compatibility alias used by existing UI components. */
  id: number;
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  name: string;
  lastPrice: number | null;
  changePercent: number | null;
}

export interface PriceStatItem extends PriceStat {
  /** Compatibility alias; use percentChange in new code. */
  percentageChange: number;
  /** Compatibility alias; use totalTradeVolume in new code. */
  totalTradeQuantity: number;
}

export interface TopListItem extends MarketMover {}

export interface MarketStatusItem extends MarketStatus {
  /** Compatibility alias; use status in new code. */
  isOpen: string;
}

export interface PortfolioTransaction {
  id?: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  averagePurchasePrice: number;
  companyName?: string | null;
}

export type OrderType = 'BUY' | 'SELL';

export interface PaperTradingTransaction {
  id?: number;
  symbol: string;
  orderType: OrderType;
  quantity: number;
  executedPrice: number;
  timestamp: string;
}

export interface PaperTradingHolding {
  symbol: string;
  quantity: number;
  averageCost: number;
  companyName?: string | null;
}

export interface PaperTradeResult {
  balance: number;
  holding: PaperTradingHolding | null;
}

export interface PriceAlert {
  id?: number;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  createdAt: string;
  isActive: boolean;
}

export interface PaperPortfolioHistoryPoint {
  id?: number;
  timestamp: string;
  /** Cash plus marked-to-market positions. */
  totalValue: number;
}

export interface NewsItem extends NewsArticle {
  /** Compatibility alias used by the existing card. */
  date: string;
}

export function initializeDatabaseSync(): void {
  if (Platform.OS !== 'web' && !db) db = SQLite.openDatabaseSync(DATABASE_NAME);
}

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  db = await dbPromise;
  return db;
};

const withWriteTransaction = async <T>(
  task: (database: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> => {
  const database = await getDb();
  const operation = writeQueue.then(async () => {
    let result!: T;
    await database.withTransactionAsync(async () => {
      result = await task(database);
    });
    return result;
  });
  writeQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
};

const tableExists = async (database: SQLite.SQLiteDatabase, name: string): Promise<boolean> => {
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?;",
    [name],
  );
  return (row?.count ?? 0) > 0;
};

const createCacheTables = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS Companies (
      securityId INTEGER PRIMARY KEY NOT NULL,
      symbol TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Watchlist (
      symbol TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Prices (
      symbol TEXT PRIMARY KEY NOT NULL,
      securityName TEXT NOT NULL,
      openPrice REAL NOT NULL,
      highPrice REAL NOT NULL,
      lowPrice REAL NOT NULL,
      lastTradedPrice REAL NOT NULL,
      previousClose REAL NOT NULL,
      change REAL NOT NULL,
      percentChange REAL NOT NULL,
      totalTradeVolume REAL NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS TopGainers (
      rank INTEGER PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type = 'gainer'),
      symbol TEXT UNIQUE NOT NULL,
      securityName TEXT NOT NULL,
      ltp REAL NOT NULL,
      pointChange REAL NOT NULL,
      percentageChange REAL NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS TopLosers (
      rank INTEGER PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type = 'loser'),
      symbol TEXT UNIQUE NOT NULL,
      securityName TEXT NOT NULL,
      ltp REAL NOT NULL,
      pointChange REAL NOT NULL,
      percentageChange REAL NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS MarketStatus (
      id INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK(id = 1),
      status TEXT NOT NULL,
      asOf TEXT,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS NewsItems (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT UNIQUE NOT NULL,
      imageUrl TEXT NOT NULL,
      dateStr TEXT NOT NULL,
      publishedAt TEXT,
      scrapedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_companies_symbol ON Companies(symbol);
    CREATE INDEX IF NOT EXISTS idx_prices_updated_at ON Prices(updatedAt);
    CREATE INDEX IF NOT EXISTS idx_news_published_at ON NewsItems(publishedAt DESC);
  `);
};

const migrateCacheSchema = async (database: SQLite.SQLiteDatabase): Promise<void> => {
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  if ((versionRow?.user_version ?? 0) >= CACHE_SCHEMA_VERSION) {
    await createCacheTables(database);
    return;
  }

  const previousWatchlist = (await tableExists(database, 'Watchlist'))
    ? await database.getAllAsync<{ symbol: string; name: string }>(
        'SELECT symbol, name FROM Watchlist WHERE symbol IS NOT NULL AND name IS NOT NULL;',
      )
    : [];

  await withWriteTransaction(async (transaction) => {
    await transaction.execAsync(`
      DROP TABLE IF EXISTS Watchlist;
      DROP TABLE IF EXISTS Companies;
      DROP TABLE IF EXISTS Prices;
      DROP TABLE IF EXISTS TopGainers;
      DROP TABLE IF EXISTS TopLosers;
      DROP TABLE IF EXISTS MarketStatus;
      DROP TABLE IF EXISTS NewsItems;
    `);
    await createCacheTables(transaction);
    for (const item of previousWatchlist) {
      await transaction.runAsync(
        'INSERT OR IGNORE INTO Watchlist(symbol, name) VALUES (?, ?);',
        [item.symbol.trim().toUpperCase(), item.name],
      );
    }
    await transaction.execAsync(`PRAGMA user_version = ${CACHE_SCHEMA_VERSION};`);
  });
};

export const initDatabaseSchema = async (): Promise<void> => {
  const database = await getDb();
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS PortfolioTransactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS PortfolioHoldings (
      symbol TEXT PRIMARY KEY NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      averagePurchasePrice REAL NOT NULL DEFAULT 0,
      companyName TEXT
    );
    CREATE TABLE IF NOT EXISTS PriceAlerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      targetPrice REAL NOT NULL,
      condition TEXT NOT NULL CHECK(condition IN ('ABOVE', 'BELOW')),
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      isActive INTEGER NOT NULL DEFAULT 1
    );
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
      companyName TEXT
    );
    CREATE TABLE IF NOT EXISTS PaperTradingAccount (
      id INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK(id = 1),
      balance REAL NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS PaperPortfolioHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      totalValue REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_symbol_time ON PortfolioTransactions(symbol, timestamp, id);
    CREATE INDEX IF NOT EXISTS idx_pricealerts_active ON PriceAlerts(isActive, symbol);
    CREATE INDEX IF NOT EXISTS idx_papertransactions_symbol_time ON PaperTradingTransactions(symbol, timestamp, id);
    CREATE INDEX IF NOT EXISTS idx_paperhistory_timestamp ON PaperPortfolioHistory(timestamp, id);
  `);
  await database.runAsync(
    'INSERT OR IGNORE INTO PaperTradingAccount(id, balance) VALUES (1, ?);',
    [DEFAULT_PAPER_TRADING_BALANCE],
  );
  await migrateCacheSchema(database);
};

const normalizeSymbol = (symbol: string): string => {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) throw new Error('A stock symbol is required.');
  return normalized;
};

const insertCompanies = async (database: SQLite.SQLiteDatabase, companies: Company[]): Promise<void> => {
  const statement = await database.prepareAsync(`
    INSERT INTO Companies(securityId, symbol, name, updatedAt) VALUES (?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      securityId = excluded.securityId,
      name = excluded.name,
      updatedAt = excluded.updatedAt;
  `);
  try {
    for (const item of companies) {
      await statement.executeAsync([item.securityId, item.symbol, item.name, item.updatedAt]);
    }
  } finally {
    await statement.finalizeAsync();
  }
};

const insertPrices = async (database: SQLite.SQLiteDatabase, prices: PriceStat[]): Promise<void> => {
  const statement = await database.prepareAsync(`
    INSERT INTO Prices(
      symbol, securityName, openPrice, highPrice, lowPrice, lastTradedPrice,
      previousClose, change, percentChange, totalTradeVolume, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  try {
    for (const item of prices) {
      await statement.executeAsync([
        item.symbol,
        item.securityName,
        item.openPrice,
        item.highPrice,
        item.lowPrice,
        item.lastTradedPrice,
        item.previousClose,
        item.change,
        item.percentChange,
        item.totalTradeVolume,
        item.updatedAt,
      ]);
    }
  } finally {
    await statement.finalizeAsync();
  }
};

const insertMovers = async (
  database: SQLite.SQLiteDatabase,
  table: 'TopGainers' | 'TopLosers',
  movers: MarketMover[],
): Promise<void> => {
  const statement = await database.prepareAsync(`
    INSERT INTO ${table}(rank, type, symbol, securityName, ltp, pointChange, percentageChange, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `);
  try {
    for (const item of movers) {
      await statement.executeAsync([
        item.rank,
        item.type,
        item.symbol,
        item.securityName,
        item.ltp,
        item.pointChange,
        item.percentageChange,
        item.updatedAt,
      ]);
    }
  } finally {
    await statement.finalizeAsync();
  }
};

const insertNews = async (database: SQLite.SQLiteDatabase, items: NewsArticle[]): Promise<void> => {
  const statement = await database.prepareAsync(`
    INSERT INTO NewsItems(id, source, title, link, imageUrl, dateStr, publishedAt, scrapedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `);
  try {
    for (const item of items) {
      await statement.executeAsync([
        item.id ?? null,
        item.source,
        item.title,
        item.link,
        item.imageUrl,
        item.dateStr,
        item.publishedAt ?? null,
        item.scrapedAt,
      ]);
    }
  } finally {
    await statement.finalizeAsync();
  }
};

export const replaceMarketSnapshot = async (snapshot: MarketSnapshot): Promise<void> => {
  if (snapshot.companies.length === 0 || snapshot.prices.length === 0) {
    throw new Error('Refusing to replace the market cache with an incomplete snapshot.');
  }
  await withWriteTransaction(async (database) => {
    await database.execAsync(`
      DELETE FROM Companies;
      DELETE FROM Prices;
      DELETE FROM TopGainers;
      DELETE FROM TopLosers;
      DELETE FROM MarketStatus;
      DELETE FROM NewsItems;
    `);
    await insertCompanies(database, snapshot.companies);
    await insertPrices(database, snapshot.prices);
    await insertMovers(database, 'TopGainers', snapshot.gainers);
    await insertMovers(database, 'TopLosers', snapshot.losers);
    await database.runAsync(
      'INSERT INTO MarketStatus(id, status, asOf, updatedAt) VALUES (1, ?, ?, ?);',
      [snapshot.marketStatus.status, snapshot.marketStatus.asOf, snapshot.marketStatus.updatedAt],
    );
    await insertNews(database, snapshot.news);
  });
};

export const addOrUpdateCompany = async (company: Company | CompanyItem): Promise<void> => {
  await withWriteTransaction(async (database) => insertCompanies(database, [company]));
};

export const bulkAddOrUpdateCompanies = async (companies: Array<Company | CompanyItem>): Promise<void> => {
  if (companies.length === 0) return;
  await withWriteTransaction(async (database) => insertCompanies(database, companies));
};

const COMPANY_SELECT = 'securityId, securityId AS id, symbol, name, updatedAt';

export const getAllCompanies = async (): Promise<CompanyItem[]> =>
  (await getDb()).getAllAsync<CompanyItem>(`SELECT ${COMPANY_SELECT} FROM Companies ORDER BY symbol;`);

export const getCompanyBySymbol = async (symbol: string): Promise<CompanyItem | null> =>
  (await getDb()).getFirstAsync<CompanyItem>(
    `SELECT ${COMPANY_SELECT} FROM Companies WHERE symbol = ?;`,
    [normalizeSymbol(symbol)],
  );

export const searchCompanies = async (query: string, limit = 10): Promise<CompanyItem[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const search = `%${trimmed.toUpperCase()}%`;
  return (await getDb()).getAllAsync<CompanyItem>(
    `SELECT ${COMPANY_SELECT} FROM Companies
     WHERE UPPER(symbol) LIKE ? OR UPPER(name) LIKE ?
     ORDER BY CASE WHEN UPPER(symbol) = ? THEN 0 ELSE 1 END, symbol
     LIMIT ?;`,
    [search, search, trimmed.toUpperCase(), safeLimit],
  );
};

export const addStockToWatchlist = async (item: Company | CompanyItem): Promise<void> => {
  await withWriteTransaction(async (database) => {
    await database.runAsync(
      `INSERT INTO Watchlist(symbol, name) VALUES (?, ?)
       ON CONFLICT(symbol) DO UPDATE SET name = excluded.name;`,
      [normalizeSymbol(item.symbol), item.name],
    );
  });
};

export const removeStockFromWatchlist = async (symbol: string): Promise<void> => {
  await withWriteTransaction(async (database) => {
    await database.runAsync('DELETE FROM Watchlist WHERE symbol = ?;', [normalizeSymbol(symbol)]);
  });
};

export const getWatchlistStocks = async (): Promise<WatchlistItem[]> =>
  (await getDb()).getAllAsync<WatchlistItem>(`
    SELECT COALESCE(c.securityId, 0) AS id, w.symbol, w.name,
           p.lastTradedPrice AS lastPrice, p.percentChange AS changePercent
    FROM Watchlist w
    LEFT JOIN Companies c ON c.symbol = w.symbol
    LEFT JOIN Prices p ON p.symbol = w.symbol
    ORDER BY w.symbol;
  `);

export const isWatchlisted = async (symbol: string): Promise<boolean> => {
  const row = await (await getDb()).getFirstAsync<{ found: number }>(
    'SELECT 1 AS found FROM Watchlist WHERE symbol = ? LIMIT 1;',
    [normalizeSymbol(symbol)],
  );
  return Boolean(row);
};

const PRICE_SELECT = `
  symbol, securityName, openPrice, highPrice, lowPrice, lastTradedPrice,
  previousClose, change, percentChange, percentChange AS percentageChange,
  totalTradeVolume, totalTradeVolume AS totalTradeQuantity, updatedAt
`;

export const addOrUpdatePrices = async (prices: PriceStat[]): Promise<void> => {
  if (prices.length === 0) throw new Error('Refusing to clear the price cache with an empty response.');
  await withWriteTransaction(async (database) => {
    await database.runAsync('DELETE FROM Prices;');
    await insertPrices(database, prices);
  });
};

export const getAllPrices = async (): Promise<PriceStatItem[]> =>
  (await getDb()).getAllAsync<PriceStatItem>(`SELECT ${PRICE_SELECT} FROM Prices ORDER BY symbol;`);

export const getPriceBySymbol = async (symbol: string): Promise<PriceStatItem | null> =>
  (await getDb()).getFirstAsync<PriceStatItem>(
    `SELECT ${PRICE_SELECT} FROM Prices WHERE symbol = ?;`,
    [normalizeSymbol(symbol)],
  );

export const getPricesBySymbols = async (symbols: string[]): Promise<Record<string, PriceStatItem>> => {
  const unique = [...new Set(symbols.map(normalizeSymbol))];
  if (unique.length === 0) return {};
  const placeholders = unique.map(() => '?').join(',');
  const rows = await (await getDb()).getAllAsync<PriceStatItem>(
    `SELECT ${PRICE_SELECT} FROM Prices WHERE symbol IN (${placeholders});`,
    unique,
  );
  return Object.fromEntries(rows.map((row) => [row.symbol, row]));
};

const replaceMovers = async (table: 'TopGainers' | 'TopLosers', movers: MarketMover[]): Promise<void> => {
  await withWriteTransaction(async (database) => {
    await database.runAsync(`DELETE FROM ${table};`);
    await insertMovers(database, table, movers);
  });
};

export const setTopGainers = async (gainers: MarketMover[]): Promise<void> => replaceMovers('TopGainers', gainers);
export const setTopLosers = async (losers: MarketMover[]): Promise<void> => replaceMovers('TopLosers', losers);

export const getTopGainers = async (): Promise<TopListItem[]> =>
  (await getDb()).getAllAsync<TopListItem>('SELECT * FROM TopGainers ORDER BY rank;');
export const getTopLosers = async (): Promise<TopListItem[]> =>
  (await getDb()).getAllAsync<TopListItem>('SELECT * FROM TopLosers ORDER BY rank;');

export const setMarketStatus = async (status: MarketStatus): Promise<void> => {
  await withWriteTransaction(async (database) => {
    await database.runAsync(
      `INSERT INTO MarketStatus(id, status, asOf, updatedAt) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, asOf = excluded.asOf, updatedAt = excluded.updatedAt;`,
      [status.status, status.asOf, status.updatedAt],
    );
  });
};

export const getMarketStatus = async (): Promise<MarketStatusItem | null> =>
  (await getDb()).getFirstAsync<MarketStatusItem>(
    'SELECT status, status AS isOpen, asOf, updatedAt FROM MarketStatus WHERE id = 1;',
  );

const recalculateHolding = async (symbol: string, database: SQLite.SQLiteDatabase): Promise<void> => {
  const transactions = await database.getAllAsync<PortfolioTransaction>(
    `SELECT id, symbol, type, quantity, price, timestamp FROM PortfolioTransactions
     WHERE symbol = ? ORDER BY timestamp, id;`,
    [symbol],
  );
  const position = calculatePosition(transactions);
  if (position.quantity === 0) {
    await database.runAsync('DELETE FROM PortfolioHoldings WHERE symbol = ?;', [symbol]);
    return;
  }
  const company = await database.getFirstAsync<{ name: string }>(
    'SELECT name FROM Companies WHERE symbol = ?;',
    [symbol],
  );
  await database.runAsync(
    `INSERT INTO PortfolioHoldings(symbol, quantity, averagePurchasePrice, companyName)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(symbol) DO UPDATE SET
       quantity = excluded.quantity,
       averagePurchasePrice = excluded.averagePurchasePrice,
       companyName = COALESCE(excluded.companyName, PortfolioHoldings.companyName);`,
    [symbol, position.quantity, position.averagePrice, company?.name ?? null],
  );
};

export const addPortfolioTransactionAndUpdateHolding = async (
  transaction: Omit<PortfolioTransaction, 'id' | 'timestamp'>,
): Promise<void> => {
  const symbol = normalizeSymbol(transaction.symbol);
  assertValidShareQuantity(transaction.quantity);
  assertValidPrice(transaction.price);
  if (transaction.type !== 'BUY' && transaction.type !== 'SELL') throw new Error('Invalid transaction type.');

  await withWriteTransaction(async (database) => {
    await database.runAsync(
      'INSERT INTO PortfolioTransactions(symbol, type, quantity, price) VALUES (?, ?, ?, ?);',
      [symbol, transaction.type, transaction.quantity, transaction.price],
    );
    await recalculateHolding(symbol, database);
  });
};

export const getPortfolioHoldings = async (): Promise<PortfolioHolding[]> =>
  (await getDb()).getAllAsync<PortfolioHolding>(`
    SELECT h.symbol, h.quantity, h.averagePurchasePrice,
           COALESCE(h.companyName, c.name) AS companyName
    FROM PortfolioHoldings h LEFT JOIN Companies c ON c.symbol = h.symbol
    WHERE h.quantity > 0 ORDER BY h.symbol;
  `);

export const getPortfolioHoldingBySymbol = async (symbol: string): Promise<PortfolioHolding | null> =>
  (await getDb()).getFirstAsync<PortfolioHolding>(`
    SELECT h.symbol, h.quantity, h.averagePurchasePrice,
           COALESCE(h.companyName, c.name) AS companyName
    FROM PortfolioHoldings h LEFT JOIN Companies c ON c.symbol = h.symbol
    WHERE h.symbol = ? AND h.quantity > 0;
  `, [normalizeSymbol(symbol)]);

export const getTransactionsBySymbol = async (symbol: string): Promise<PortfolioTransaction[]> =>
  (await getDb()).getAllAsync<PortfolioTransaction>(`
    SELECT id, symbol, type, quantity, price, timestamp FROM PortfolioTransactions
    WHERE symbol = ? ORDER BY timestamp DESC, id DESC;
  `, [normalizeSymbol(symbol)]);

export const getAllTransactionsForHeldSymbols = async (): Promise<PortfolioTransaction[]> =>
  (await getDb()).getAllAsync<PortfolioTransaction>(`
    SELECT t.id, t.symbol, t.type, t.quantity, t.price, t.timestamp
    FROM PortfolioTransactions t
    INNER JOIN PortfolioHoldings h ON h.symbol = t.symbol AND h.quantity > 0
    ORDER BY t.symbol, t.timestamp, t.id;
  `);

export const deletePortfolioTransaction = async (transactionId: number): Promise<void> => {
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) throw new Error('Invalid transaction ID.');
  await withWriteTransaction(async (database) => {
    const row = await database.getFirstAsync<{ symbol: string }>(
      'SELECT symbol FROM PortfolioTransactions WHERE id = ?;',
      [transactionId],
    );
    if (!row) throw new Error('Transaction not found.');
    await database.runAsync('DELETE FROM PortfolioTransactions WHERE id = ?;', [transactionId]);
    await recalculateHolding(row.symbol, database);
  });
};

export const updatePortfolioTransaction = async (
  transactionId: number,
  newQuantity: number,
  newPrice: number,
): Promise<void> => {
  if (!Number.isSafeInteger(transactionId) || transactionId <= 0) throw new Error('Invalid transaction ID.');
  assertValidShareQuantity(newQuantity);
  assertValidPrice(newPrice);
  await withWriteTransaction(async (database) => {
    const row = await database.getFirstAsync<{ symbol: string }>(
      'SELECT symbol FROM PortfolioTransactions WHERE id = ?;',
      [transactionId],
    );
    if (!row) throw new Error('Transaction not found.');
    await database.runAsync(
      'UPDATE PortfolioTransactions SET quantity = ?, price = ? WHERE id = ?;',
      [newQuantity, newPrice, transactionId],
    );
    await recalculateHolding(row.symbol, database);
  });
};

export const addPriceAlert = async (
  alert: Omit<PriceAlert, 'id' | 'createdAt' | 'isActive'>,
): Promise<void> => {
  const symbol = normalizeSymbol(alert.symbol);
  assertValidPrice(alert.targetPrice);
  if (alert.condition !== 'ABOVE' && alert.condition !== 'BELOW') throw new Error('Invalid alert condition.');
  await withWriteTransaction(async (database) => {
    await database.runAsync(
      'INSERT INTO PriceAlerts(symbol, targetPrice, condition, isActive) VALUES (?, ?, ?, 1);',
      [symbol, alert.targetPrice, alert.condition],
    );
  });
};

export const getActivePriceAlerts = async (): Promise<PriceAlert[]> => {
  const rows = await (await getDb()).getAllAsync<Omit<PriceAlert, 'isActive'> & { isActive: number }>(
    'SELECT id, symbol, targetPrice, condition, createdAt, isActive FROM PriceAlerts WHERE isActive = 1 ORDER BY createdAt DESC, id DESC;',
  );
  return rows.map((row) => ({ ...row, isActive: row.isActive === 1 }));
};

export const deactivatePriceAlert = async (id: number): Promise<void> => {
  await withWriteTransaction(async (database) => {
    await database.runAsync('UPDATE PriceAlerts SET isActive = 0 WHERE id = ?;', [id]);
  });
};

export const deletePriceAlert = async (id: number): Promise<void> => {
  await withWriteTransaction(async (database) => {
    await database.runAsync('DELETE FROM PriceAlerts WHERE id = ?;', [id]);
  });
};

export const getPaperTradingBalance = async (): Promise<number> => {
  const row = await (await getDb()).getFirstAsync<{ balance: number }>(
    'SELECT balance FROM PaperTradingAccount WHERE id = 1;',
  );
  if (!row || !Number.isFinite(row.balance)) throw new Error('Paper trading account is not initialized.');
  return row.balance;
};

export const setPaperTradingBalance = async (balance: number): Promise<void> => {
  if (!Number.isFinite(balance) || balance < 0) throw new Error('Paper trading balance must be non-negative.');
  await withWriteTransaction(async (database) => {
    await database.runAsync(
      `INSERT INTO PaperTradingAccount(id, balance, updatedAt) VALUES (1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET balance = excluded.balance, updatedAt = CURRENT_TIMESTAMP;`,
      [balance],
    );
  });
};

export const executePaperTrade = async (
  symbolInput: string,
  orderType: OrderType,
  quantity: number,
  executedPrice: number,
): Promise<PaperTradeResult> => {
  const symbol = normalizeSymbol(symbolInput);
  assertValidShareQuantity(quantity);
  assertValidPrice(executedPrice);
  if (orderType !== 'BUY' && orderType !== 'SELL') throw new Error('Invalid paper order type.');

  return withWriteTransaction(async (database) => {
    const account = await database.getFirstAsync<{ balance: number }>(
      'SELECT balance FROM PaperTradingAccount WHERE id = 1;',
    );
    if (!account) throw new Error('Paper trading account is not initialized.');
    const existing = await database.getFirstAsync<PaperTradingHolding>(
      'SELECT symbol, quantity, averageCost, companyName FROM PaperTradingPortfolio WHERE symbol = ?;',
      [symbol],
    );
    const total = quantity * executedPrice;
    let newBalance = account.balance;
    let newQuantity: number;
    let newAverageCost: number;

    if (orderType === 'BUY') {
      if (total > account.balance + 1e-8) throw new Error('Insufficient virtual cash for this order.');
      newBalance -= total;
      newQuantity = (existing?.quantity ?? 0) + quantity;
      const priorCost = (existing?.quantity ?? 0) * (existing?.averageCost ?? 0);
      newAverageCost = (priorCost + total) / newQuantity;
    } else {
      if (!existing || quantity > existing.quantity + 1e-8) {
        throw new Error(`Insufficient ${symbol} shares for this paper sale.`);
      }
      newBalance += total;
      newQuantity = existing.quantity - quantity;
      newAverageCost = newQuantity > 0 ? existing.averageCost : 0;
    }

    const company = await database.getFirstAsync<{ name: string }>(
      'SELECT name FROM Companies WHERE symbol = ?;',
      [symbol],
    );
    await database.runAsync(
      'UPDATE PaperTradingAccount SET balance = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = 1;',
      [newBalance],
    );
    await database.runAsync(
      'INSERT INTO PaperTradingTransactions(symbol, orderType, quantity, executedPrice) VALUES (?, ?, ?, ?);',
      [symbol, orderType, quantity, executedPrice],
    );

    if (newQuantity === 0) {
      await database.runAsync('DELETE FROM PaperTradingPortfolio WHERE symbol = ?;', [symbol]);
      return { balance: newBalance, holding: null };
    }

    await database.runAsync(
      `INSERT INTO PaperTradingPortfolio(symbol, quantity, averageCost, companyName) VALUES (?, ?, ?, ?)
       ON CONFLICT(symbol) DO UPDATE SET
         quantity = excluded.quantity,
         averageCost = excluded.averageCost,
         companyName = COALESCE(excluded.companyName, PaperTradingPortfolio.companyName);`,
      [symbol, newQuantity, newAverageCost, company?.name ?? existing?.companyName ?? null],
    );
    return {
      balance: newBalance,
      holding: { symbol, quantity: newQuantity, averageCost: newAverageCost, companyName: company?.name ?? existing?.companyName },
    };
  });
};

export const getPaperTradingHistory = async (): Promise<PaperTradingTransaction[]> =>
  (await getDb()).getAllAsync<PaperTradingTransaction>(`
    SELECT id, symbol, orderType, quantity, executedPrice, timestamp
    FROM PaperTradingTransactions ORDER BY timestamp DESC, id DESC;
  `);

export const getPaperPortfolioItem = async (symbol: string): Promise<PaperTradingHolding | null> =>
  (await getDb()).getFirstAsync<PaperTradingHolding>(
    'SELECT symbol, quantity, averageCost, companyName FROM PaperTradingPortfolio WHERE symbol = ?;',
    [normalizeSymbol(symbol)],
  );

export const getPaperTradingPortfolio = async (): Promise<PaperTradingHolding[]> =>
  (await getDb()).getAllAsync<PaperTradingHolding>(`
    SELECT p.symbol, p.quantity, p.averageCost, COALESCE(p.companyName, c.name) AS companyName
    FROM PaperTradingPortfolio p LEFT JOIN Companies c ON c.symbol = p.symbol
    WHERE p.quantity > 0 ORDER BY p.symbol;
  `);

export const resetPaperTradingData = async (): Promise<void> => {
  await withWriteTransaction(async (database) => {
    await database.execAsync(`
      DELETE FROM PaperTradingTransactions;
      DELETE FROM PaperTradingPortfolio;
      DELETE FROM PaperPortfolioHistory;
    `);
    await database.runAsync(
      'UPDATE PaperTradingAccount SET balance = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = 1;',
      [DEFAULT_PAPER_TRADING_BALANCE],
    );
  });
};

export const recordPaperPortfolioValue = async (): Promise<number> => {
  const [cash, holdings] = await Promise.all([getPaperTradingBalance(), getPaperTradingPortfolio()]);
  const prices = await getPricesBySymbols(holdings.map((item) => item.symbol));
  let equity = cash;
  for (const holding of holdings) {
    const price = prices[holding.symbol]?.lastTradedPrice;
    if (!Number.isFinite(price)) throw new Error(`Current price is unavailable for ${holding.symbol}.`);
    equity += holding.quantity * price;
  }
  await withWriteTransaction(async (database) => {
    await database.runAsync('INSERT INTO PaperPortfolioHistory(totalValue) VALUES (?);', [equity]);
  });
  return equity;
};

export const getPaperPortfolioHistory = async (limit = 90): Promise<PaperPortfolioHistoryPoint[]> => {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  return (await getDb()).getAllAsync<PaperPortfolioHistoryPoint>(`
    SELECT id, timestamp, totalValue FROM (
      SELECT id, timestamp, totalValue FROM PaperPortfolioHistory
      ORDER BY timestamp DESC, id DESC LIMIT ?
    ) ORDER BY timestamp, id;
  `, [safeLimit]);
};

export const saveNewsItems = async (newsItems: NewsArticle[]): Promise<void> => {
  await withWriteTransaction(async (database) => {
    await database.runAsync('DELETE FROM NewsItems;');
    await insertNews(database, newsItems);
  });
};

export const getNewsItems = async (): Promise<NewsItem[]> =>
  (await getDb()).getAllAsync<NewsItem>(`
    SELECT id, source, title, link, imageUrl, dateStr, dateStr AS date,
           publishedAt, scrapedAt
    FROM NewsItems
    ORDER BY COALESCE(publishedAt, scrapedAt) DESC, id DESC;
  `);

export const resetAllUserData = async (): Promise<void> => {
  await withWriteTransaction(async (database) => {
    await database.execAsync(`
      DELETE FROM Watchlist;
      DELETE FROM PortfolioTransactions;
      DELETE FROM PortfolioHoldings;
      DELETE FROM PriceAlerts;
      DELETE FROM PaperTradingTransactions;
      DELETE FROM PaperTradingPortfolio;
      DELETE FROM PaperPortfolioHistory;
    `);
    await database.runAsync(
      'UPDATE PaperTradingAccount SET balance = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = 1;',
      [DEFAULT_PAPER_TRADING_BALANCE],
    );
  });
};
