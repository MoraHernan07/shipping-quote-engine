/**
 * Property-based tests: instead of a few hand-picked examples, fast-check generates
 * hundreds of random carts and checks rules that must hold for every one of them.
 * When a rule breaks, fast-check shrinks the input to the smallest failing cart.
 */
import fc from 'fast-check';
import {
  billableKg,
  type CartLine,
  createQuoteEngine,
  fitsInside,
  pack,
  paddedDimensions,
  type PackingStrategy,
  type Product,
  unitNetProfitCents,
  volumetricWeightG,
} from '../src';
import { boxes, config, settings } from './helpers';

const RUNS = { numRuns: 400 };
const engine = createQuoteEngine(config);
const postalCodes = Object.keys(config.postalPrefixes).map((prefix) => `${prefix}100`);

const productArb: fc.Arbitrary<Product> = fc
  .record({
    sku: fc.stringMatching(/^[A-Z]{3}-\d{3}$/),
    priceCents: fc.integer({ min: 100, max: 500_000 }),
    costShareBps: fc.integer({ min: 0, max: 12_000 }), // cost from 0% to 120% of price: some units lose money
    vatBps: fc.constantFrom(0, 1_600),
    weightG: fc.integer({ min: 1, max: 40_000 }),
    lengthMm: fc.integer({ min: 10, max: 1_300 }),
    widthMm: fc.integer({ min: 10, max: 800 }),
    heightMm: fc.integer({ min: 10, max: 800 }),
    packaging: fc.constantFrom('box' as const, 'box' as const, 'sack' as const),
    subsidyBps: fc.option(fc.integer({ min: 0, max: 10_000 }), { nil: undefined }),
  })
  .map(({ costShareBps, lengthMm, widthMm, heightMm, subsidyBps, ...rest }) => {
    const base = {
      ...rest,
      costCents: Math.floor((rest.priceCents * costShareBps) / 10_000),
      dimensions: { lengthMm, widthMm, heightMm },
      origin: { kind: 'warehouse' as const },
    };
    return subsidyBps === undefined ? base : { ...base, subsidyBps };
  });

const unitsArb = fc.array(productArb, { minLength: 1, maxLength: 12 });
const cartArb: fc.Arbitrary<CartLine[]> = fc.array(
  fc.record({ product: productArb, quantity: fc.integer({ min: 1, max: 4 }) }),
  { minLength: 1, maxLength: 5 },
);
const strategyArb = fc.constantFrom<PackingStrategy>('individual', 'consolidated');

function expandUnits(cart: readonly CartLine[]): Product[] {
  return cart.flatMap(({ product, quantity }) => Array.from({ length: quantity }, () => product));
}

describe('packing invariants', () => {
  it('every unit lands in exactly one parcel', () => {
    fc.assert(
      fc.property(unitsArb, strategyArb, (units, strategy) => {
        const packed = pack(strategy, units, boxes, settings).flatMap((p) => p.skus).sort();
        expect(packed).toEqual(units.map((u) => u.sku).sort());
      }),
      RUNS,
    );
  });

  it('no box exceeds its payload, and every boxed item fits its box once padded', () => {
    fc.assert(
      fc.property(unitsArb, strategyArb, (units, strategy) => {
        const bySku = new Map(units.map((u) => [u.sku, u]));
        for (const parcel of pack(strategy, units, boxes, settings)) {
          if (parcel.kind !== 'box') continue;
          const box = boxes.find((b) => b.id === parcel.boxId);
          expect(box).toBeDefined();
          if (box === undefined) return;
          expect(parcel.contentWeightG).toBeLessThanOrEqual(box.maxPayloadG);
          expect(parcel.realWeightG).toBe(parcel.contentWeightG + box.tareG);
          for (const sku of parcel.skus) {
            const item = bySku.get(sku);
            if (item === undefined) throw new Error(`unknown sku ${sku}`);
            expect(fitsInside(paddedDimensions(item.dimensions, settings.paddingMm), box.inner)).toBe(true);
          }
        }
      }),
      RUNS,
    );
  });

  it('consolidation never needs more parcels than packing one unit per box', () => {
    fc.assert(
      fc.property(unitsArb, (units) => {
        const consolidated = pack('consolidated', units, boxes, settings).length;
        const individual = pack('individual', units, boxes, settings).length;
        expect(consolidated).toBeLessThanOrEqual(individual);
      }),
      RUNS,
    );
  });
});

describe('weight invariants', () => {
  it('billable kilos are never below the real or the volumetric weight', () => {
    fc.assert(
      fc.property(productArb, (p) => {
        const kg = billableKg(p.weightG, p.dimensions, settings.volumetricDivisor);
        expect(kg * 1000).toBeGreaterThanOrEqual(p.weightG);
        expect(kg * 1000).toBeGreaterThanOrEqual(volumetricWeightG(p.dimensions, settings.volumetricDivisor));
        expect(Number.isInteger(kg) && kg >= 1).toBe(true);
      }),
      RUNS,
    );
  });
});

describe('quote invariants', () => {
  it('shipping subsidies never turn a profitable cart into a loss', () => {
    fc.assert(
      fc.property(cartArb, fc.constantFrom(...postalCodes), (cart, postalCode) => {
        const units = expandUnits(cart);
        const quote = engine.quote(cart, postalCode);
        const positiveProfit = units.reduce((sum, u) => sum + Math.max(0, unitNetProfitCents(u, settings)), 0);

        // The business never spends more on shipping than the profit it set aside.
        expect(quote.totals.subsidyCents).toBeLessThanOrEqual(positiveProfit);

        // If no unit loses money, the order stays profitable after paying for shipping.
        if (units.every((u) => unitNetProfitCents(u, settings) >= 0)) {
          const totalProfit = units.reduce((sum, u) => sum + unitNetProfitCents(u, settings), 0);
          expect(totalProfit - quote.totals.subsidyCents).toBeGreaterThanOrEqual(0);
        }
      }),
      RUNS,
    );
  });

  it('every shipment balances: subsidy within the pool and the cost, customer pays the rest', () => {
    fc.assert(
      fc.property(cartArb, fc.constantFrom(...postalCodes), (cart, postalCode) => {
        for (const s of engine.quote(cart, postalCode).shipments) {
          const { poolCents, subsidyCents, customerShippingCents } = s.subsidy;
          expect(subsidyCents).toBeGreaterThanOrEqual(0);
          expect(subsidyCents).toBeLessThanOrEqual(poolCents);
          expect(subsidyCents).toBeLessThanOrEqual(s.shippingCostCents);
          expect(customerShippingCents).toBe(s.shippingCostCents - subsidyCents);
        }
      }),
      RUNS,
    );
  });

  it('picks the cheapest strategy and totals add up across shipments', () => {
    fc.assert(
      fc.property(cartArb, fc.constantFrom(...postalCodes), (cart, postalCode) => {
        const quote = engine.quote(cart, postalCode);
        for (const s of quote.shipments) {
          if (s.kind !== 'warehouse') continue;
          expect(s.shippingCostCents).toBe(Math.min(...s.options.map((o) => o.totalCents)));
          if (s.runnerUp !== null) expect(s.runnerUp.totalCents).toBeGreaterThanOrEqual(s.carrier.totalCents);
        }
        const sum = (pick: (s: (typeof quote.shipments)[number]) => number) =>
          quote.shipments.reduce((total, s) => total + pick(s), 0);
        expect(quote.totals.shippingCostCents).toBe(sum((s) => s.shippingCostCents));
        expect(quote.totals.customerShippingCents).toBe(sum((s) => s.subsidy.customerShippingCents));
      }),
      RUNS,
    );
  });

  it('is deterministic: the same cart always gets the same quote', () => {
    fc.assert(
      fc.property(cartArb, fc.constantFrom(...postalCodes), (cart, postalCode) => {
        expect(engine.quote(cart, postalCode)).toEqual(engine.quote(cart, postalCode));
      }),
      { numRuns: 100 },
    );
  });
});
