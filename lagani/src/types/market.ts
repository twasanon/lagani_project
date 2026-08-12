export type MoverType = 'gainer' | 'loser';

export interface Company {
  securityId: number;
  symbol: string;
  name: string;
  updatedAt: string;
}

export interface PriceStat {
  symbol: string;
  securityName: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  lastTradedPrice: number;
  previousClose: number;
  change: number;
  percentChange: number;
  totalTradeVolume: number;
  updatedAt: string;
}

export interface MarketMover {
  type: MoverType;
  rank: number;
  symbol: string;
  securityName: string;
  ltp: number;
  pointChange: number;
  percentageChange: number;
  updatedAt: string;
}

export interface MarketStatus {
  status: string;
  asOf: string | null;
  updatedAt: string;
}

export interface NewsArticle {
  id?: number;
  source: string;
  title: string;
  link: string;
  imageUrl: string;
  dateStr: string;
  publishedAt?: string | null;
  scrapedAt: string;
}

export interface ChartPoint {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface MarketSnapshot {
  companies: Company[];
  prices: PriceStat[];
  gainers: MarketMover[];
  losers: MarketMover[];
  marketStatus: MarketStatus;
  news: NewsArticle[];
}
