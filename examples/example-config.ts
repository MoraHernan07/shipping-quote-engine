/**
 * Sample configuration for demos and tests. Carriers, prices, boxes and products
 * are invented; they only mimic the shape of a real Mexican e-commerce operation.
 */
import type { EngineConfig, RateEntry, ZoneEntry } from '../src';
import type { Product } from '../src';

type Zone = 'local' | 'metro' | 'central' | 'national' | 'remote';

function prefixes(state: string, zone: Zone, ...codes: number[]): Record<string, ZoneEntry> {
  return Object.fromEntries(codes.map((code) => [String(code).padStart(2, '0'), { state, zone }]));
}

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Lane pricing: a base price for the first kilo plus a price per extra kilo. */
const LANES: Record<string, Record<Zone, { base: number; perKg: number }>> = {
  atlas: {
    local: { base: 9_900, perKg: 1_100 },
    metro: { base: 11_900, perKg: 1_300 },
    central: { base: 13_900, perKg: 1_600 },
    national: { base: 16_900, perKg: 2_000 },
    remote: { base: 22_900, perKg: 2_800 },
  },
  swift: {
    local: { base: 12_900, perKg: 700 },
    metro: { base: 13_900, perKg: 900 },
    central: { base: 15_900, perKg: 1_100 },
    national: { base: 18_900, perKg: 1_400 },
    remote: { base: 25_900, perKg: 1_900 },
  },
};

function buildRates(): RateEntry[] {
  const rates: RateEntry[] = [];
  for (const [carrierId, zones] of Object.entries(LANES)) {
    for (const warehouseId of ['puebla', 'cdmx']) {
      for (const [zone, lane] of Object.entries(zones)) {
        // Atlas does not take remote-zone parcels above 20 kg, nor anything above its top tier.
        // Swift prices heavy freight above 30 kg per extra kilo.
        const maxTier = carrierId === 'atlas' && zone === 'remote' ? 20 : 30;
        for (let kg = 1; kg <= maxTier; kg++) {
          const priceCents = lane.base + lane.perKg * (kg - 1);
          const isTop = kg === maxTier;
          rates.push(
            carrierId === 'swift' && isTop
              ? { carrierId, warehouseId, zone, maxKg: kg, priceCents, extraKgCents: lane.perKg }
              : { carrierId, warehouseId, zone, maxKg: kg, priceCents },
          );
        }
      }
    }
  }
  return rates;
}

function box(id: string, l: number, w: number, h: number, tareG: number, costCents: number) {
  return {
    id,
    inner: { lengthMm: l, widthMm: w, heightMm: h },
    outer: { lengthMm: l + 10, widthMm: w + 10, heightMm: h + 10 },
    tareG,
    costCents,
    maxPayloadG: 30_000,
  };
}

export const exampleConfig: EngineConfig = {
  postalPrefixes: {
    ...prefixes('Puebla', 'local', 72, 73, 74, 75),
    ...prefixes('Tlaxcala', 'local', 90),
    ...prefixes('Ciudad de México', 'metro', ...range(1, 16)),
    ...prefixes('Estado de México', 'metro', ...range(50, 57)),
    ...prefixes('Querétaro', 'central', 76),
    ...prefixes('Hidalgo', 'central', 42, 43),
    ...prefixes('Guanajuato', 'central', 36, 37, 38),
    ...prefixes('Jalisco', 'national', ...range(44, 49)),
    ...prefixes('Nuevo León', 'national', ...range(64, 67)),
    ...prefixes('Yucatán', 'national', 97),
    ...prefixes('Baja California', 'remote', 21, 22),
    ...prefixes('Baja California Sur', 'remote', 23),
    ...prefixes('Quintana Roo', 'remote', 77),
    ...prefixes('Chiapas', 'remote', 29, 30),
  },
  routing: {
    defaultWarehouseId: 'puebla',
    warehouseByState: { 'Ciudad de México': 'cdmx' },
  },
  boxes: [
    box('S', 200, 150, 100, 150, 800),
    box('M', 300, 250, 200, 300, 1_400),
    box('L', 450, 350, 300, 500, 2_200),
    box('XL', 600, 450, 400, 800, 3_500),
  ],
  rates: buildRates(),
  manufacturers: {
    'acme-pets': { fixedShippingCents: 9_900 },
  },
  settings: {
    paddingMm: 30,
    volumetricDivisor: 5_000,
    consolidationFillBps: 8_500,
    oversize: { maxSideMm: 1_000, maxWeightG: 70_000, surchargeCents: 45_000 },
    gatewayFeeBps: 405,
    subsidyBps: 6_000,
  },
};

const dims = (lengthMm: number, widthMm: number, heightMm: number) => ({ lengthMm, widthMm, heightMm });

export const products = {
  catToy: {
    sku: 'TOY-001',
    priceCents: 14_900,
    vatBps: 1_600,
    costCents: 5_000,
    weightG: 120,
    dimensions: dims(120, 80, 60),
    packaging: 'box',
    origin: { kind: 'warehouse' },
  },
  scratcher: {
    sku: 'SCR-010',
    priceCents: 49_900,
    vatBps: 1_600,
    costCents: 21_000,
    weightG: 2_400,
    dimensions: dims(380, 250, 120),
    packaging: 'box',
    origin: { kind: 'warehouse' },
  },
  litterSack: {
    sku: 'LIT-020',
    priceCents: 32_900,
    vatBps: 0,
    costCents: 19_500,
    weightG: 10_000,
    dimensions: dims(500, 350, 120),
    packaging: 'sack',
    origin: { kind: 'warehouse' },
  },
  catTree: {
    sku: 'TRE-100',
    priceCents: 289_900,
    vatBps: 1_600,
    costCents: 140_000,
    weightG: 18_000,
    dimensions: dims(1_200, 500, 500),
    packaging: 'box',
    origin: { kind: 'warehouse' },
  },
  dogBed: {
    sku: 'BED-300',
    priceCents: 89_900,
    vatBps: 1_600,
    costCents: 52_000,
    weightG: 3_000,
    dimensions: dims(800, 600, 200),
    packaging: 'box',
    origin: { kind: 'manufacturer', manufacturerId: 'acme-pets' },
  },
} satisfies Record<string, Product>;
