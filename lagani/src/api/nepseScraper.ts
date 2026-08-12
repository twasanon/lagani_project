import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseChartPoints,
  parseCompanies,
  parseGainers,
  parseLosers,
  parseMarketStatus,
  parseNews,
  parsePrices,
} from '../domain/marketData';
import { replaceMarketSnapshot, saveNewsItems, addOrUpdatePrices } from '../utils/database';
import {
  ChartPoint,
  Company,
  MarketMover,
  MarketSnapshot,
  MarketStatus,
  NewsArticle,
  PriceStat,
} from '../types/market';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const LAST_REFRESH_KEY = '@Lagani:marketData:lastRefresh';
const REQUEST_TIMEOUT_MS = 15_000;

export type ApiCompany = Company;
export type ApiPriceStat = PriceStat;
export type ApiTopItem = MarketMover;
export type ApiMarketStatus = MarketStatus;
export type ApiNewsItem = NewsArticle;
export type ApiChartDataPoint = ChartPoint;

let activeFullRefresh: Promise<MarketSnapshot> | null = null;
let activePriceRefresh: Promise<PriceStat[]> | null = null;

const getApiBaseUrl = (): string => {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!configured) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured. Copy .env.example to .env and set the API URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid http(s) URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL must use http or https.');
  }
  return configured;
};

const fetchJson = async (path: string): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${getApiBaseUrl()}${path}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`Lagani API ${response.status} at ${path}${body ? `: ${body}` : ''}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Lagani API timed out after ${REQUEST_TIMEOUT_MS / 1000}s at ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchCompanies = async (): Promise<Company[]> => parseCompanies(await fetchJson('/companies'));
export const fetchPrices = async (): Promise<PriceStat[]> => parsePrices(await fetchJson('/prices'));
export const fetchTopGainers = async (): Promise<MarketMover[]> => parseGainers(await fetchJson('/top-gainers'));
export const fetchTopLosers = async (): Promise<MarketMover[]> => parseLosers(await fetchJson('/top-losers'));
export const fetchMarketStatus = async (): Promise<MarketStatus> => parseMarketStatus(await fetchJson('/market-status'));
export const fetchNews = async (): Promise<NewsArticle[]> => parseNews(await fetchJson('/news'));

export const fetchStockChartData = async (
  symbol: string,
  range: string,
  resolution?: string,
): Promise<ChartPoint[]> => {
  const encodedSymbol = encodeURIComponent(symbol.trim().toUpperCase());
  const params = new URLSearchParams({ range });
  if (resolution) params.set('resolution', resolution);
  return parseChartPoints(await fetchJson(`/charts/${encodedSymbol}?${params.toString()}`));
};

const fetchMarketSnapshot = async (): Promise<MarketSnapshot> => {
  const [companies, prices, gainers, losers, marketStatus, news] = await Promise.all([
    fetchCompanies(),
    fetchPrices(),
    fetchTopGainers(),
    fetchTopLosers(),
    fetchMarketStatus(),
    fetchNews(),
  ]);
  return { companies, prices, gainers, losers, marketStatus, news };
};

export const refreshAllData = async (): Promise<MarketSnapshot> => {
  if (activeFullRefresh) return activeFullRefresh;
  activeFullRefresh = (async () => {
    const snapshot = await fetchMarketSnapshot();
    await replaceMarketSnapshot(snapshot);
    await AsyncStorage.setItem(LAST_REFRESH_KEY, Date.now().toString());
    return snapshot;
  })();

  try {
    return await activeFullRefresh;
  } finally {
    activeFullRefresh = null;
  }
};

export const syncPrices = async (): Promise<PriceStat[]> => {
  if (activePriceRefresh) return activePriceRefresh;
  activePriceRefresh = (async () => {
    const prices = await fetchPrices();
    await addOrUpdatePrices(prices);
    return prices;
  })();
  try {
    return await activePriceRefresh;
  } finally {
    activePriceRefresh = null;
  }
};

export const syncNews = async (): Promise<NewsArticle[]> => {
  const news = await fetchNews();
  await saveNewsItems(news);
  return news;
};

export const refreshDataIfNeeded = async (force = false): Promise<boolean> => {
  const stored = await AsyncStorage.getItem(LAST_REFRESH_KEY);
  const lastRefresh = stored ? Number.parseInt(stored, 10) : 0;
  const isStale = !Number.isFinite(lastRefresh) || Date.now() - lastRefresh >= REFRESH_INTERVAL_MS;
  if (!force && !isStale) return false;
  await refreshAllData();
  return true;
};

export const getLastMarketRefreshTime = async (): Promise<number | null> => {
  const stored = await AsyncStorage.getItem(LAST_REFRESH_KEY);
  if (!stored) return null;
  const parsed = Number.parseInt(stored, 10);
  return Number.isFinite(parsed) ? parsed : null;
};
