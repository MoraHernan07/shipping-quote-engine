import { ConfigError, createQuoteEngine, type EngineConfig, validateConfig } from '../src';
import { config, dims } from './helpers';

function issuesOf(broken: EngineConfig): readonly string[] {
  try {
    validateConfig(broken);
  } catch (error) {
    if (error instanceof ConfigError) return error.issues;
    throw error;
  }
  return [];
}

describe('validateConfig', () => {
  it('accepts the example config', () => {
    expect(() => { validateConfig(config); }).not.toThrow();
    expect(() => createQuoteEngine(config)).not.toThrow();
  });

  it('collects every problem instead of stopping at the first', () => {
    const [firstBox] = config.boxes;
    if (firstBox === undefined) throw new Error('fixture has no boxes');
    const broken: EngineConfig = {
      ...config,
      postalPrefixes: { '7': { state: '', zone: 'local' } },
      routing: { defaultWarehouseId: '', warehouseByState: {} },
      boxes: [firstBox, { ...firstBox, inner: dims(0, 10, 10), tareG: -1, costCents: 1.5, maxPayloadG: 0 }],
      rates: [
        { carrierId: 'a', warehouseId: 'w', zone: 'z', maxKg: 0, priceCents: -5, extraKgCents: -1 },
        { carrierId: 'a', warehouseId: 'w', zone: 'z', maxKg: 0, priceCents: 1 },
      ],
      manufacturers: { bad: { fixedShippingCents: -1 } },
      settings: {
        paddingMm: -1,
        volumetricDivisor: 0,
        consolidationFillBps: 0,
        oversize: { maxSideMm: 0, maxWeightG: 0, surchargeCents: -1 },
        gatewayFeeBps: 10_001,
        subsidyBps: -1,
      },
    };

    const issues = issuesOf(broken);
    expect(issues.length).toBe(22);
    expect(issues).toEqual(
      expect.arrayContaining([
        'postalPrefixes key "7" must be two digits',
        'boxes[1].id "S" is duplicated',
        'rates[1] duplicates tier a|w|z|0',
        'settings.gatewayFeeBps must be an integer between 0 and 10000 bps',
      ]),
    );
  });

  it('rejects an empty box catalog', () => {
    expect(issuesOf({ ...config, boxes: [] })).toEqual(['boxes must not be empty']);
  });

  it('fails fast when the engine is created with a bad config', () => {
    expect(() => createQuoteEngine({ ...config, boxes: [] })).toThrow(ConfigError);
  });
});
