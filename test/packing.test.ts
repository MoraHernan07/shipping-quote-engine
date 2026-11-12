import { fitsInside, pack, packConsolidated, packIndividually, paddedDimensions } from '../src';
import { boxById, boxes, dims, product, settings } from './helpers';

describe('fitsInside', () => {
  it('accepts any axis-aligned rotation', () => {
    expect(fitsInside(dims(10, 30, 20), dims(30, 20, 10))).toBe(true);
    expect(fitsInside(dims(31, 1, 1), dims(30, 30, 30))).toBe(false);
  });

  it('adds padding on both sides of every axis', () => {
    expect(paddedDimensions(dims(100, 50, 10), 30)).toEqual(dims(160, 110, 70));
  });
});

describe('packIndividually', () => {
  it('puts each unit in the smallest box that holds it once padded', () => {
    const exact = product({ sku: 'EXACT', dimensions: dims(140, 90, 40) }); // padded = S inner exactly
    const rotated = product({ sku: 'ROT', dimensions: dims(40, 140, 90) });
    const tooBigForS = product({ sku: 'BIG', dimensions: dims(141, 90, 40) });
    const parcels = packIndividually([exact, rotated, tooBigForS], boxes, settings);
    expect(parcels.map((p) => p.boxId)).toEqual(['S', 'S', 'M']);
    expect(parcels[0]).toMatchObject({
      kind: 'box',
      realWeightG: 500 + boxById('S').tareG,
      dimensions: boxById('S').outer,
      packagingCents: boxById('S').costCents,
    });
  });

  it('ships sacks as they are and oversized or overweight items in their own packaging', () => {
    const sack = product({ sku: 'SACK', packaging: 'sack', weightG: 20_000 });
    const huge = product({ sku: 'HUGE', dimensions: dims(600, 450, 400) });
    const heavy = product({ sku: 'HEAVY', weightG: 31_000 });
    const parcels = packIndividually([sack, huge, heavy], boxes, settings);
    expect(parcels.map((p) => [p.kind, p.boxId, p.packagingCents])).toEqual([
      ['sack', null, 0],
      ['self', null, 0],
      ['self', null, 0],
    ]);
    expect(parcels[1]?.dimensions).toEqual(dims(600, 450, 400));
  });
});

describe('packConsolidated', () => {
  const cube = (sku: string, weightG = 500) => product({ sku, weightG, dimensions: dims(100, 100, 100) });

  it('fills one box and then downsizes it to the smallest box that still fits', () => {
    // Padded cube = 160³ mm. L holds 9 under the 85% fill limit, M only 3.
    const nine = Array.from({ length: 9 }, (_, i) => cube(`C${i}`));
    const [parcel, ...rest] = packConsolidated(nine, boxes, settings);
    expect(rest).toHaveLength(0);
    expect(parcel).toMatchObject({ kind: 'box', boxId: 'L', contentWeightG: 4_500 });

    const ten = [...nine, cube('C9')];
    expect(packConsolidated(ten, boxes, settings).map((p) => p.boxId)).toEqual(['XL']);
  });

  it('opens a new box when the payload limit is reached', () => {
    const heavy = Array.from({ length: 4 }, (_, i) => cube(`H${i}`, 9_000));
    const parcels = packConsolidated(heavy, boxes, settings);
    expect(parcels.map((p) => [p.boxId, p.contentWeightG])).toEqual([
      ['M', 27_000],
      ['M', 9_000],
    ]);
  });

  it('keeps sacks and oversized items out of the boxes', () => {
    const parcels = packConsolidated(
      [cube('A'), product({ sku: 'SACK', packaging: 'sack' }), product({ sku: 'HUGE', dimensions: dims(900, 900, 900) })],
      boxes,
      settings,
    );
    expect(parcels.map((p) => p.kind).sort()).toEqual(['box', 'sack', 'self']);
  });
});

describe('pack', () => {
  it('dispatches to the requested strategy', () => {
    const units = [product({ sku: 'A' }), product({ sku: 'B' })];
    expect(pack('individual', units, boxes, settings)).toHaveLength(2);
    expect(pack('consolidated', units, boxes, settings)).toHaveLength(1);
  });
});
