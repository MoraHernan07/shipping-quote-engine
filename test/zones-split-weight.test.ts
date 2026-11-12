import {
  billableKg,
  MAX_QUANTITY_PER_LINE,
  QuoteError,
  resolveDestination,
  splitByOrigin,
  volumetricWeightG,
} from '../src';
import { config, dims, product } from './helpers';

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof QuoteError) return error.code;
    throw error;
  }
  return undefined;
}

describe('resolveDestination', () => {
  it('routes Mexico City to its own warehouse and the rest to the default one', () => {
    expect(resolveDestination('03100', config)).toEqual({
      postalCode: '03100',
      state: 'Ciudad de México',
      zone: 'metro',
      warehouseId: 'cdmx',
    });
    expect(resolveDestination('72000', config).warehouseId).toBe('puebla');
    expect(resolveDestination('52000', config).warehouseId).toBe('puebla'); // Estado de México
  });

  it('rejects malformed and unknown postal codes', () => {
    expect(errorCode(() => resolveDestination('7200', config))).toBe('INVALID_POSTAL_CODE');
    expect(errorCode(() => resolveDestination('72a00', config))).toBe('INVALID_POSTAL_CODE');
    expect(errorCode(() => resolveDestination('99000', config))).toBe('UNKNOWN_POSTAL_CODE');
  });
});

describe('splitByOrigin', () => {
  const own = product({ sku: 'OWN' });
  const fromB = product({ sku: 'B', origin: { kind: 'manufacturer', manufacturerId: 'b-co' } });
  const fromA = product({ sku: 'A', origin: { kind: 'manufacturer', manufacturerId: 'a-co' } });

  it('expands quantities and groups warehouse first, then manufacturers by id', () => {
    const groups = splitByOrigin([
      { product: fromB, quantity: 1 },
      { product: own, quantity: 2 },
      { product: fromA, quantity: 1 },
    ]);
    expect(groups.map((g) => g.origin)).toEqual([
      { kind: 'warehouse' },
      { kind: 'manufacturer', manufacturerId: 'a-co' },
      { kind: 'manufacturer', manufacturerId: 'b-co' },
    ]);
    expect(groups[0]?.units.map((p) => p.sku)).toEqual(['OWN', 'OWN']);
  });

  it('omits the warehouse group when everything is dropshipped', () => {
    expect(splitByOrigin([{ product: fromA, quantity: 1 }]).map((g) => g.origin.kind)).toEqual(['manufacturer']);
  });

  it('rejects empty carts, bad quantities and bad products', () => {
    expect(errorCode(() => splitByOrigin([]))).toBe('EMPTY_CART');
    for (const quantity of [0, 1.5, MAX_QUANTITY_PER_LINE + 1]) {
      expect(errorCode(() => splitByOrigin([{ product: own, quantity }]))).toBe('INVALID_QUANTITY');
    }
    for (const bad of [
      product({ sku: '' }),
      product({ weightG: 0 }),
      product({ priceCents: -1 }),
      product({ vatBps: 10_001 }),
      product({ dimensions: dims(10, 0, 10) }),
      product({ subsidyBps: 20_000 }),
    ]) {
      expect(errorCode(() => splitByOrigin([{ product: bad, quantity: 1 }]))).toBe('INVALID_PRODUCT');
    }
  });
});

describe('billable weight', () => {
  it('computes volumetric grams as mm³ / divisor, rounded up', () => {
    // 400 × 300 × 200 mm = 24,000 cm³ → 24,000 / 5000 = 4.8 kg
    expect(volumetricWeightG(dims(400, 300, 200), 5_000)).toBe(4_800);
    expect(volumetricWeightG(dims(1, 1, 1), 5_000)).toBe(1);
  });

  it('bills the greater of real and volumetric weight, in whole kilos', () => {
    expect(billableKg(2_000, dims(400, 300, 200), 5_000)).toBe(5); // volumetric 4.8 kg wins
    expect(billableKg(7_001, dims(400, 300, 200), 5_000)).toBe(8); // real 7.001 kg wins
    expect(billableKg(10, dims(10, 10, 10), 5_000)).toBe(1); // never below 1 kg
  });
});
