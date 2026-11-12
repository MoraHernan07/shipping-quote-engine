import type { Bps } from './types';

const BPS_DENOMINATOR = 10_000;

/** True for integers in [0, 2^53). */
export function isNonNegativeInt(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/** True for integers in [1, 2^53). */
export function isPositiveInt(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function assertDivisionInputs(numerator: number, denominator: number): void {
  if (!isNonNegativeInt(numerator) || !isPositiveInt(denominator)) {
    throw new RangeError(`Expected non-negative integer / positive integer, got ${numerator} / ${denominator}`);
  }
}

/** Exact floor(numerator / denominator) using integer arithmetic only. */
export function floorDiv(numerator: number, denominator: number): number {
  assertDivisionInputs(numerator, denominator);
  return (numerator - (numerator % denominator)) / denominator;
}

/** Exact ceil(numerator / denominator). */
export function ceilDiv(numerator: number, denominator: number): number {
  const floor = floorDiv(numerator, denominator);
  return numerator % denominator === 0 ? floor : floor + 1;
}

/** numerator / denominator rounded half up. */
export function divRoundHalfUp(numerator: number, denominator: number): number {
  assertDivisionInputs(numerator, denominator);
  return floorDiv(2 * numerator + denominator, 2 * denominator);
}

/** amount * bps / 10_000, rounded down. Use when the business gives value away. */
export function applyBpsFloor(amount: number, bps: Bps): number {
  return floorDiv(amount * bps, BPS_DENOMINATOR);
}

/** amount * bps / 10_000, rounded up. Use for costs, so they are never underestimated. */
export function applyBpsCeil(amount: number, bps: Bps): number {
  return ceilDiv(amount * bps, BPS_DENOMINATOR);
}

export const BPS_100_PERCENT = BPS_DENOMINATOR;
