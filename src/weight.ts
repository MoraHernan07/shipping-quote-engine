import { ceilDiv } from './math';
import type { Dimensions, Grams } from './types';

const GRAMS_PER_KG = 1000;

export function volumeMm3(d: Dimensions): number {
  return d.lengthMm * d.widthMm * d.heightMm;
}

/**
 * Volumetric ("dimensional") weight carriers charge for bulky, light parcels.
 * With a divisor in cm³/kg: kg = cm³ / divisor, and since 1 cm³ = 1000 mm³ and
 * 1 kg = 1000 g, grams = mm³ / divisor exactly. Rounded up.
 */
export function volumetricWeightG(d: Dimensions, volumetricDivisor: number): Grams {
  return ceilDiv(volumeMm3(d), volumetricDivisor);
}

/** Whole kilos the carrier bills: the greater of real and volumetric weight, rounded up, at least 1. */
export function billableKg(realWeightG: Grams, d: Dimensions, volumetricDivisor: number): number {
  const chargeableG = Math.max(realWeightG, volumetricWeightG(d, volumetricDivisor));
  return Math.max(1, ceilDiv(chargeableG, GRAMS_PER_KG));
}
