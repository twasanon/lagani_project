import {
  ChartPoint,
  Company,
  MarketMover,
  MarketStatus,
  NewsArticle,
  PriceStat,
} from '../types/market';

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (value: unknown, field: string): string => {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  return value;
};

const finiteNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
};

const optionalString = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) return null;
  return stringValue(value, field);
};

const parseArray = <T>(
  value: unknown,
  label: string,
  parseItem: (item: unknown, index: number) => T,
): T[] => {
  if (!Array.isArray(value)) throw new Error(`${label} response must be an array`);
  return value.map(parseItem);
};

export const parseCompanies = (value: unknown): Company[] =>
  parseArray(value, 'companies', (item, index) => {
    if (!isRecord(item)) throw new Error(`companies[${index}] must be an object`);
    return {
      securityId: finiteNumber(item.securityId, `companies[${index}].securityId`),
      symbol: stringValue(item.symbol, `companies[${index}].symbol`).trim().toUpperCase(),
      name: stringValue(item.name, `companies[${index}].name`).trim(),
      updatedAt: stringValue(item.updatedAt, `companies[${index}].updatedAt`),
    };
  });

export const parsePrices = (value: unknown): PriceStat[] =>
  parseArray(value, 'prices', (item, index) => {
    if (!isRecord(item)) throw new Error(`prices[${index}] must be an object`);
    return {
      symbol: stringValue(item.symbol, `prices[${index}].symbol`).trim().toUpperCase(),
      securityName: stringValue(item.securityName, `prices[${index}].securityName`).trim(),
      openPrice: finiteNumber(item.openPrice, `prices[${index}].openPrice`),
      highPrice: finiteNumber(item.highPrice, `prices[${index}].highPrice`),
      lowPrice: finiteNumber(item.lowPrice, `prices[${index}].lowPrice`),
      lastTradedPrice: finiteNumber(item.lastTradedPrice, `prices[${index}].lastTradedPrice`),
      previousClose: finiteNumber(item.previousClose, `prices[${index}].previousClose`),
      change: finiteNumber(item.change, `prices[${index}].change`),
      percentChange: finiteNumber(item.percentChange, `prices[${index}].percentChange`),
      totalTradeVolume: finiteNumber(item.totalTradeVolume, `prices[${index}].totalTradeVolume`),
      updatedAt: stringValue(item.updatedAt, `prices[${index}].updatedAt`),
    };
  });

const parseMovers = (value: unknown, expectedType: MarketMover['type']): MarketMover[] =>
  parseArray(value, `${expectedType}s`, (item, index) => {
    if (!isRecord(item)) throw new Error(`${expectedType}s[${index}] must be an object`);
    const type = stringValue(item.type, `${expectedType}s[${index}].type`);
    if (type !== expectedType) throw new Error(`${expectedType}s[${index}].type must be ${expectedType}`);
    return {
      type,
      rank: finiteNumber(item.rank, `${expectedType}s[${index}].rank`),
      symbol: stringValue(item.symbol, `${expectedType}s[${index}].symbol`).trim().toUpperCase(),
      securityName: stringValue(item.securityName, `${expectedType}s[${index}].securityName`).trim(),
      ltp: finiteNumber(item.ltp, `${expectedType}s[${index}].ltp`),
      pointChange: finiteNumber(item.pointChange, `${expectedType}s[${index}].pointChange`),
      percentageChange: finiteNumber(item.percentageChange, `${expectedType}s[${index}].percentageChange`),
      updatedAt: stringValue(item.updatedAt, `${expectedType}s[${index}].updatedAt`),
    };
  });

export const parseGainers = (value: unknown): MarketMover[] => parseMovers(value, 'gainer');
export const parseLosers = (value: unknown): MarketMover[] => parseMovers(value, 'loser');

export const parseMarketStatus = (value: unknown): MarketStatus => {
  if (!isRecord(value)) throw new Error('market status response must be an object');
  return {
    status: stringValue(value.status, 'marketStatus.status').trim().toUpperCase(),
    asOf: optionalString(value.asOf, 'marketStatus.asOf'),
    updatedAt: stringValue(value.updatedAt, 'marketStatus.updatedAt'),
  };
};

export const parseNews = (value: unknown): NewsArticle[] =>
  parseArray(value, 'news', (item, index) => {
    if (!isRecord(item)) throw new Error(`news[${index}] must be an object`);
    return {
      id: item.id === undefined ? undefined : finiteNumber(item.id, `news[${index}].id`),
      source: stringValue(item.source, `news[${index}].source`).trim(),
      title: stringValue(item.title, `news[${index}].title`).trim(),
      link: stringValue(item.link, `news[${index}].link`).trim(),
      imageUrl: stringValue(item.imageUrl, `news[${index}].imageUrl`).trim(),
      dateStr: stringValue(item.dateStr, `news[${index}].dateStr`).trim(),
      publishedAt: optionalString(item.publishedAt, `news[${index}].publishedAt`),
      scrapedAt: stringValue(item.scrapedAt, `news[${index}].scrapedAt`),
    };
  });

export const parseChartPoints = (value: unknown): ChartPoint[] =>
  parseArray(value, 'chart', (item, index) => {
    if (!isRecord(item)) throw new Error(`chart[${index}] must be an object`);
    return {
      t: finiteNumber(item.t, `chart[${index}].t`),
      o: finiteNumber(item.o, `chart[${index}].o`),
      h: finiteNumber(item.h, `chart[${index}].h`),
      l: finiteNumber(item.l, `chart[${index}].l`),
      c: finiteNumber(item.c, `chart[${index}].c`),
      v: finiteNumber(item.v, `chart[${index}].v`),
    };
  });
