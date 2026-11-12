import { createQuoteEngine, quoteCart, QuoteError, type WarehouseShipmentQuote } from '../src';
import { products } from '../examples/example-config';
import { config, product } from './helpers';

const engine = createQuoteEngine(config);

function warehouseShipment(shipments: readonly { kind: string }[]): WarehouseShipmentQuote {
  const found = shipments.find((s) => s.kind === 'warehouse');
  if (found === undefined) throw new Error('no warehouse shipment');
  return found as WarehouseShipmentQuote;
}

describe('quote', () => {
  it('quotes a mixed cart end to end', () => {
    const result = engine.quote(
      [
        { product: products.catToy, quantity: 3 },
        { product: products.scratcher, quantity: 1 },
        { product: products.litterSack, quantity: 1 },
        { product: products.dogBed, quantity: 1 },
      ],
      '44100',
    );

    expect(result.destination).toMatchObject({ state: 'Jalisco', zone: 'national', warehouseId: 'puebla' });
    expect(result.shipments.map((s) => s.kind)).toEqual(['warehouse', 'manufacturer']);

    const own = warehouseShipment(result.shipments);
    expect(own.strategy).toBe('consolidated');
    expect(own.parcels.map((p) => [p.kind, p.boxId])).toEqual([
      ['sack', null],
      ['box', 'L'],
    ]);
    expect(own.carrier.carrierId).toBe('swift');
    expect(own.runnerUp?.carrierId).toBe('atlas');
    expect(own.shippingCostCents).toBe(Math.min(...own.options.map((o) => o.totalCents)));

    expect(result.totals).toEqual({
      productsCents: 3 * 14_900 + 49_900 + 32_900 + 89_900,
      shippingCostCents: 76_500,
      subsidyCents: 42_169,
      customerShippingCents: 34_331,
    });
  });

  it('adds the oversize surcharge and per-kilo overflow for bulky items', () => {
    const own = warehouseShipment(engine.quote([{ product: products.catTree, quantity: 1 }], '03100').shipments);
    expect(own.origin.warehouseId).toBe('cdmx');
    expect(own.parcels[0]?.kind).toBe('self');
    expect(own.carrier).toMatchObject({ carrierId: 'swift', surchargeCents: 45_000 });
    expect(own.carrier.parcels[0]?.billableKg).toBe(60);
    expect(own.runnerUp).toBeNull();
  });

  it('charges manufacturers their flat fee, funded by their own products', () => {
    const result = engine.quote([{ product: products.dogBed, quantity: 1 }], '72000');
    expect(result.shipments).toHaveLength(1);
    expect(result.shipments[0]).toMatchObject({ kind: 'manufacturer', shippingCostCents: 9_900 });
    expect(result.totals.customerShippingCents).toBe(0);
  });

  it('fails with a typed error when a manufacturer or a carrier lane is missing', () => {
    const unknown = product({ origin: { kind: 'manufacturer', manufacturerId: 'ghost' } });
    expect(() => engine.quote([{ product: unknown, quantity: 1 }], '72000')).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_MANUFACTURER' }) as Error,
    );

    const noLanes = { ...config, rates: [] };
    expect(() => quoteCart([{ product: product(), quantity: 1 }], '72000', noLanes)).toThrow(QuoteError);
  });
});
