import { describe, expect, it } from 'vitest';
import { calculatePosition } from './portfolio';

describe('calculatePosition', () => {
  it('uses a moving-average cost basis across buys and partial sells', () => {
    expect(calculatePosition([
      { type: 'BUY', quantity: 10, price: 100 },
      { type: 'BUY', quantity: 10, price: 200 },
      { type: 'SELL', quantity: 5, price: 250 },
      { type: 'BUY', quantity: 5, price: 300 },
    ])).toEqual({
      quantity: 20,
      costBasis: 3750,
      averagePrice: 187.5,
    });
  });

  it('resets cost basis after the position is fully sold', () => {
    expect(calculatePosition([
      { type: 'BUY', quantity: 10, price: 100 },
      { type: 'SELL', quantity: 10, price: 150 },
      { type: 'BUY', quantity: 2, price: 300 },
    ])).toEqual({ quantity: 2, costBasis: 600, averagePrice: 300 });
  });

  it('rejects a historically impossible sale', () => {
    expect(() => calculatePosition([
      { type: 'SELL', quantity: 1, price: 100 },
      { type: 'BUY', quantity: 2, price: 100 },
    ])).toThrow(/exceeds/);
  });

  it('rejects fractional share quantities', () => {
    expect(() => calculatePosition([{ type: 'BUY', quantity: 1.5, price: 100 }])).toThrow(/whole number/);
  });
});
