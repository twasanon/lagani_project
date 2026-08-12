import { describe, expect, it } from 'vitest';
import { findTriggeredPriceAlerts } from './priceAlerts';
import type { PriceAlert } from '../utils/database';

const alerts: PriceAlert[] = [
  { id: 1, symbol: 'NABIL', targetPrice: 500, condition: 'ABOVE', createdAt: '', isActive: true },
  { id: 2, symbol: 'NTC', targetPrice: 800, condition: 'BELOW', createdAt: '', isActive: true },
  { id: 3, symbol: 'MISSING', targetPrice: 1, condition: 'ABOVE', createdAt: '', isActive: true },
];

describe('findTriggeredPriceAlerts', () => {
  it('handles inclusive thresholds and skips unavailable prices', () => {
    const result = findTriggeredPriceAlerts(alerts, {
      NABIL: { lastTradedPrice: 500 },
      NTC: { lastTradedPrice: 799 },
    });
    expect(result.map((item) => item.alert.id)).toEqual([1, 2]);
  });

  it('does not trigger when values remain on the safe side', () => {
    expect(findTriggeredPriceAlerts(alerts, {
      NABIL: { lastTradedPrice: 499 },
      NTC: { lastTradedPrice: 801 },
    })).toEqual([]);
  });
});
