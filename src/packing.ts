import type { EngineSettings } from './config';
import { applyBpsFloor } from './math';
import { volumeMm3 } from './weight';
import type { Box, Dimensions, Parcel, Product } from './types';

export type PackingStrategy = 'individual' | 'consolidated';

/** Item size once padding is added on every side. */
export function paddedDimensions(d: Dimensions, paddingMm: number): Dimensions {
  return {
    lengthMm: d.lengthMm + 2 * paddingMm,
    widthMm: d.widthMm + 2 * paddingMm,
    heightMm: d.heightMm + 2 * paddingMm,
  };
}

function sortedSides(d: Dimensions): [number, number, number] {
  const sides = [d.lengthMm, d.widthMm, d.heightMm].sort((a, b) => a - b);
  return [sides[0] ?? 0, sides[1] ?? 0, sides[2] ?? 0];
}

/**
 * True if `item` fits inside `container` in at least one of its 6 axis-aligned rotations.
 * Sorting both triples and comparing side by side is equivalent to trying all rotations.
 */
export function fitsInside(item: Dimensions, container: Dimensions): boolean {
  const [a1, a2, a3] = sortedSides(item);
  const [b1, b2, b3] = sortedSides(container);
  return a1 <= b1 && a2 <= b2 && a3 <= b3;
}

/** Smaller inner volume first; cheaper first on ties; id as last tie-break for determinism. */
function compareBoxes(a: Box, b: Box): number {
  return volumeMm3(a.inner) - volumeMm3(b.inner) || a.costCents - b.costCents || a.id.localeCompare(b.id);
}

function sackParcel(product: Product): Parcel {
  return {
    kind: 'sack',
    boxId: null,
    skus: [product.sku],
    contentWeightG: product.weightG,
    realWeightG: product.weightG,
    dimensions: product.dimensions,
    packagingCents: 0,
  };
}

function selfParcel(product: Product): Parcel {
  return { ...sackParcel(product), kind: 'self' };
}

function boxParcel(box: Box, items: readonly Product[]): Parcel {
  const contentWeightG = items.reduce((sum, p) => sum + p.weightG, 0);
  return {
    kind: 'box',
    boxId: box.id,
    skus: items.map((p) => p.sku),
    contentWeightG,
    realWeightG: contentWeightG + box.tareG,
    dimensions: box.outer,
    packagingCents: box.costCents,
  };
}

/** Boxes that can hold this single item, smallest first. */
function boxesFor(product: Product, boxes: readonly Box[], paddingMm: number): Box[] {
  const padded = paddedDimensions(product.dimensions, paddingMm);
  return boxes
    .filter((box) => fitsInside(padded, box.inner) && product.weightG <= box.maxPayloadG)
    .sort(compareBoxes);
}

/** Strategy A: every unit in the smallest box that holds it. */
export function packIndividually(units: readonly Product[], boxes: readonly Box[], settings: EngineSettings): Parcel[] {
  return units.map((product) => {
    if (product.packaging === 'sack') return sackParcel(product);
    const [smallest] = boxesFor(product, boxes, settings.paddingMm);
    return smallest === undefined ? selfParcel(product) : boxParcel(smallest, [product]);
  });
}

interface OpenBin {
  box: Box;
  items: Product[];
  usedVolume: number;
  weightG: number;
}

function capacity(box: Box, settings: EngineSettings): number {
  return applyBpsFloor(volumeMm3(box.inner), settings.consolidationFillBps);
}

function binAccepts(bin: Pick<OpenBin, 'usedVolume' | 'weightG'>, box: Box, product: Product, settings: EngineSettings): boolean {
  const padded = paddedDimensions(product.dimensions, settings.paddingMm);
  return (
    fitsInside(padded, box.inner) &&
    bin.usedVolume + volumeMm3(padded) <= capacity(box, settings) &&
    bin.weightG + product.weightG <= box.maxPayloadG
  );
}

/** After filling, move each bin to the smallest box that still satisfies every constraint. */
function downsize(bin: OpenBin, boxes: readonly Box[], settings: EngineSettings): Box {
  const sorted = [...boxes].sort(compareBoxes);
  for (const candidate of sorted) {
    let probe = { usedVolume: 0, weightG: 0 };
    const fitsAll = bin.items.every((product) => {
      if (!binAccepts(probe, candidate, product, settings)) return false;
      const padded = paddedDimensions(product.dimensions, settings.paddingMm);
      probe = { usedVolume: probe.usedVolume + volumeMm3(padded), weightG: probe.weightG + product.weightG };
      return true;
    });
    if (fitsAll) return candidate;
  }
  return bin.box;
}

/**
 * Strategy B: First-Fit Decreasing. Units are sorted by padded volume (largest first)
 * and placed into the first open box that accepts them; a new bin opens in the largest
 * box that fits the unit, and every bin is downsized at the end.
 *
 * Exact 3D bin packing is NP-hard. This is a volumetric heuristic for quoting: each item
 * must fit the box in some rotation, total padded volume stays under
 * `consolidationFillBps` of the inner volume, and weight stays under `maxPayloadG`.
 * It estimates cost; it is not a loading plan.
 */
export function packConsolidated(units: readonly Product[], boxes: readonly Box[], settings: EngineSettings): Parcel[] {
  const parcels: Parcel[] = [];
  const bins: OpenBin[] = [];

  const boxable = units
    .filter((product) => {
      if (product.packaging === 'sack') {
        parcels.push(sackParcel(product));
        return false;
      }
      return true;
    })
    .map((product) => ({ product, volume: volumeMm3(paddedDimensions(product.dimensions, settings.paddingMm)) }))
    .sort((a, b) => b.volume - a.volume || a.product.sku.localeCompare(b.product.sku));

  for (const { product, volume } of boxable) {
    const candidates = boxesFor(product, boxes, settings.paddingMm);
    const largest = candidates[candidates.length - 1];
    if (largest === undefined) {
      parcels.push(selfParcel(product));
      continue;
    }

    const bin = bins.find((b) => binAccepts(b, b.box, product, settings));
    if (bin === undefined) {
      bins.push({ box: largest, items: [product], usedVolume: volume, weightG: product.weightG });
    } else {
      bin.items.push(product);
      bin.usedVolume += volume;
      bin.weightG += product.weightG;
    }
  }

  for (const bin of bins) parcels.push(boxParcel(downsize(bin, boxes, settings), bin.items));
  return parcels;
}

export function pack(
  strategy: PackingStrategy,
  units: readonly Product[],
  boxes: readonly Box[],
  settings: EngineSettings,
): Parcel[] {
  return strategy === 'individual' ? packIndividually(units, boxes, settings) : packConsolidated(units, boxes, settings);
}
