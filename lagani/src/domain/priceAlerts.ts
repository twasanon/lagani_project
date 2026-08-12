import type { PriceAlert } from '../utils/database';
import type { PriceStat } from '../types/market';

export interface TriggeredPriceAlert {
  alert: PriceAlert;
  currentPrice: number;
}

export const findTriggeredPriceAlerts = (
  alerts: PriceAlert[],
  prices: Record<string, Pick<PriceStat, 'lastTradedPrice'>>,
): TriggeredPriceAlert[] =>
  alerts.flatMap((alert) => {
    const currentPrice = prices[alert.symbol]?.lastTradedPrice;
    if (!Number.isFinite(currentPrice)) return [];
    const triggered = alert.condition === 'ABOVE'
      ? currentPrice >= alert.targetPrice
      : currentPrice <= alert.targetPrice;
    return triggered ? [{ alert, currentPrice }] : [];
  });
