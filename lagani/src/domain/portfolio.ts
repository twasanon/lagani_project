export type LedgerSide = 'BUY' | 'SELL';

export interface LedgerEntry {
  type: LedgerSide;
  quantity: number;
  price: number;
}

export interface Position {
  quantity: number;
  costBasis: number;
  averagePrice: number;
}

const EPSILON = 1e-8;

export const assertValidShareQuantity = (quantity: number): void => {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number of shares.');
  }
};

export const assertValidPrice = (price: number): void => {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Price must be a positive number.');
  }
};

export const calculatePosition = (entries: LedgerEntry[]): Position => {
  let quantity = 0;
  let costBasis = 0;

  for (const entry of entries) {
    assertValidShareQuantity(entry.quantity);
    assertValidPrice(entry.price);

    if (entry.type === 'BUY') {
      quantity += entry.quantity;
      costBasis += entry.quantity * entry.price;
      continue;
    }

    if (entry.type !== 'SELL') throw new Error(`Unsupported ledger entry type: ${String(entry.type)}`);
    if (entry.quantity - quantity > EPSILON) {
      throw new Error(`Sell quantity ${entry.quantity} exceeds the ${quantity} shares held at that point in the ledger.`);
    }

    const averagePrice = quantity > 0 ? costBasis / quantity : 0;
    quantity -= entry.quantity;
    costBasis -= entry.quantity * averagePrice;
    if (Math.abs(quantity) < EPSILON) {
      quantity = 0;
      costBasis = 0;
    }
  }

  return {
    quantity,
    costBasis,
    averagePrice: quantity > 0 ? costBasis / quantity : 0,
  };
};
