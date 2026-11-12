import {
  applySubsidy,
  gatewayFeeCents,
  isOversize,
  type Parcel,
  priceExVatCents,
  type RateEntry,
  shopCarriers,
  tierPrice,
  unitContributionCents,
  unitNetProfitCents,
} from '../src';
import { config, dims, product, settings } from './helpers';

const parcel = (overrides: Partial<Parcel> = {}): Parcel => ({
  kind: 'box',
  boxId: 'M',
  skus: ['X'],
  contentWeightG: 1_000,
  realWeightG: 1_300,
  dimensions: dims(310, 260, 210),
  packagingCents: 1_400,
  ...overrides,
});

describe('oversize rule', () => {
  it('flags a side above 1 m or a real weight above 70 kg', () => {
    expect(isOversize(parcel(), settings)).toBe(false);
    expect(isOversize(parcel({ dimensions: dims(1_001, 10, 10) }), settings)).toBe(true);
    expect(isOversize(parcel({ realWeightG: 70_001 }), settings)).toBe(true);
    expect(isOversize(parcel({ dimensions: dims(1_000, 10, 10), realWeightG: 70_000 }), settings)).toBe(false);
  });
});

describe('tierPrice', () => {
  const rates: RateEntry[] = [
    { carrierId: 'c', warehouseId: 'w', zone: 'z', maxKg: 5, priceCents: 500 },
    { carrierId: 'c', warehouseId: 'w', zone: 'z', maxKg: 1, priceCents: 100 },
    { carrierId: 'c', warehouseId: 'w', zone: 'z', maxKg: 10, priceCents: 900, extraKgCents: 50 },
    { carrierId: 'c', warehouseId: 'other', zone: 'z', maxKg: 1, priceCents: 1 },
  ];

  it('uses the smallest tier that covers the weight', () => {
    expect(tierPrice(rates, 'c', 'w', 'z', 1)).toBe(100);
    expect(tierPrice(rates, 'c', 'w', 'z', 2)).toBe(500);
    expect(tierPrice(rates, 'c', 'w', 'z', 10)).toBe(900);
  });

  it('charges extra kilos above the top tier when the carrier allows it', () => {
    expect(tierPrice(rates, 'c', 'w', 'z', 13)).toBe(900 + 3 * 50);
    expect(tierPrice(rates, 'c', 'other', 'z', 2)).toBeNull();
    expect(tierPrice(rates, 'c', 'w', 'nowhere', 1)).toBeNull();
  });
});

describe('shopCarriers', () => {
  it('returns eligible carriers cheapest first, with surcharges included', () => {
    const quotes = shopCarriers([parcel(), parcel({ dimensions: dims(1_100, 200, 200), realWeightG: 2_000 })], 'puebla', 'local', config);
    expect(quotes.map((q) => q.carrierId)).toEqual(['atlas', 'swift']);
    const [best] = quotes;
    expect(best?.surchargeCents).toBe(settings.oversize.surchargeCents);
    expect(best?.totalCents).toBe((best?.labelCents ?? 0) + settings.oversize.surchargeCents);
    expect(best?.parcels.map((p) => p.billableKg)).toEqual([4, 9]); // 3.39 kg and 8.8 kg volumetric
  });

  it('drops a carrier that cannot price every parcel', () => {
    // Atlas stops at 20 kg in the remote zone and has no per-kilo overflow.
    const quotes = shopCarriers([parcel({ realWeightG: 25_000 })], 'puebla', 'remote', config);
    expect(quotes.map((q) => q.carrierId)).toEqual(['swift']);
  });
});

describe('subsidy', () => {
  // $116.00 with 16% VAT = $100.00 before VAT. Fee 4.05% of $116.00 = $4.698 → 470 cents.
  const unit = product({ priceCents: 11_600, vatBps: 1_600, costCents: 5_000 });

  it('computes the real profit of a unit', () => {
    expect(priceExVatCents(unit)).toBe(10_000);
    expect(gatewayFeeCents(unit, settings)).toBe(470);
    expect(unitNetProfitCents(unit, settings)).toBe(10_000 - 5_000 - 470);
    expect(unitContributionCents(unit, settings)).toBe(2_718); // 60% of 4,530, floored
  });

  it('honors per-SKU overrides and ignores units that lose money', () => {
    expect(unitContributionCents({ ...unit, subsidyBps: 10_000 }, settings)).toBe(4_530);
    expect(unitContributionCents({ ...unit, costCents: 20_000 }, settings)).toBe(0);
  });

  it('pays packaging first, then the label, and charges the customer the rest', () => {
    // Pool 2,718: covers packaging 1,000 then 1,718 of a 5,000 label.
    expect(applySubsidy([unit], 1_000, 5_000, settings)).toEqual({
      poolCents: 2_718,
      subsidyCents: 2_718,
      packagingCoveredCents: 1_000,
      labelCoveredCents: 1_718,
      customerShippingCents: 3_282,
    });
    // Pool smaller than packaging: customer pays the uncovered packaging too.
    expect(applySubsidy([unit], 3_000, 5_000, settings).customerShippingCents).toBe(8_000 - 2_718);
    // Pool larger than the whole cost: shipping is free and the surplus is not spent.
    expect(applySubsidy([unit, unit], 1_000, 2_000, settings)).toMatchObject({
      poolCents: 5_436,
      subsidyCents: 3_000,
      customerShippingCents: 0,
    });
  });
});
