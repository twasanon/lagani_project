import { describe, expect, it } from 'vitest';
import { parseCompanies, parseMarketStatus, parsePrices } from './marketData';

describe('Lagani API response validation', () => {
  it('parses the current company and price contracts', () => {
    expect(parseCompanies([{
      securityId: 131,
      symbol: 'nabil',
      name: 'Nabil Bank Limited',
      updatedAt: '2026-08-12T09:00:00Z',
    }])[0].symbol).toBe('NABIL');

    expect(parsePrices([{
      symbol: 'NABIL',
      securityName: 'Nabil Bank Limited',
      openPrice: 500,
      highPrice: 510,
      lowPrice: 495,
      lastTradedPrice: 505,
      previousClose: 500,
      change: 5,
      percentChange: 1,
      totalTradeVolume: 1234,
      updatedAt: '2026-08-12T09:00:00Z',
    }])[0]).toMatchObject({ symbol: 'NABIL', percentChange: 1, totalTradeVolume: 1234 });
  });

  it('accepts a nullable market as-of time', () => {
    expect(parseMarketStatus({
      status: 'close',
      asOf: null,
      updatedAt: '2026-08-12T09:00:00Z',
    })).toEqual({ status: 'CLOSE', asOf: null, updatedAt: '2026-08-12T09:00:00Z' });
  });

  it('fails closed when required financial fields are missing', () => {
    expect(() => parsePrices([{ symbol: 'NABIL' }])).toThrow(/securityName/);
  });
});
