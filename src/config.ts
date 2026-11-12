import { ConfigError } from './errors';
import { BPS_100_PERCENT, isNonNegativeInt, isPositiveInt } from './math';
import type { Box, Bps, Cents, Dimensions, Grams, Millimeters } from './types';

export interface ZoneEntry {
  readonly state: string;
  readonly zone: string;
}

/** One price tier: a parcel up to `maxKg` billable kilos costs `priceCents`. */
export interface RateEntry {
  readonly carrierId: string;
  readonly warehouseId: string;
  readonly zone: string;
  readonly maxKg: number;
  readonly priceCents: Cents;
  /**
   * Optional, read on the lane's highest tier only: price per kilo above `maxKg`.
   * Without it, parcels heavier than the top tier cannot ship with this carrier.
   */
  readonly extraKgCents?: Cents;
}

export interface OversizeRule {
  /** A parcel with any side above this is oversize. */
  readonly maxSideMm: Millimeters;
  /** A parcel heavier than this is oversize. */
  readonly maxWeightG: Grams;
  readonly surchargeCents: Cents;
}

export interface EngineSettings {
  /** Padding added on every side of an item before it goes into a box. */
  readonly paddingMm: Millimeters;
  /** Carrier volumetric divisor, in cm³ per kg (5000 is the industry standard). */
  readonly volumetricDivisor: number;
  /** Share of a box's inner volume that consolidation may fill. */
  readonly consolidationFillBps: Bps;
  readonly oversize: OversizeRule;
  /** Payment gateway fee charged on the product price. */
  readonly gatewayFeeBps: Bps;
  /** Default share of each unit's net profit that funds its shipping. */
  readonly subsidyBps: Bps;
}

export interface Routing {
  readonly defaultWarehouseId: string;
  readonly warehouseByState: Readonly<Record<string, string>>;
}

export interface ManufacturerTerms {
  /** Flat shipping fee the manufacturer charges per order. */
  readonly fixedShippingCents: Cents;
}

export interface EngineConfig {
  /** Keyed by the first two digits of the postal code. */
  readonly postalPrefixes: Readonly<Record<string, ZoneEntry>>;
  readonly routing: Routing;
  readonly boxes: readonly Box[];
  readonly rates: readonly RateEntry[];
  readonly manufacturers: Readonly<Record<string, ManufacturerTerms>>;
  readonly settings: EngineSettings;
}

function checkDimensions(d: Dimensions, path: string, issues: string[]): void {
  for (const [key, value] of Object.entries(d)) {
    if (!isPositiveInt(value as number)) issues.push(`${path}.${key} must be a positive integer (mm)`);
  }
}

function checkBps(value: number, path: string, issues: string[]): void {
  if (!isNonNegativeInt(value) || value > BPS_100_PERCENT) {
    issues.push(`${path} must be an integer between 0 and 10000 bps`);
  }
}

/** Collects every problem in the config instead of stopping at the first one. */
export function validateConfig(config: EngineConfig): void {
  const issues: string[] = [];
  const { settings } = config;

  for (const [prefix, entry] of Object.entries(config.postalPrefixes)) {
    if (!/^\d{2}$/.test(prefix)) issues.push(`postalPrefixes key "${prefix}" must be two digits`);
    if (entry.state === '' || entry.zone === '') issues.push(`postalPrefixes.${prefix} needs a state and a zone`);
  }

  if (config.routing.defaultWarehouseId === '') issues.push('routing.defaultWarehouseId is required');

  if (config.boxes.length === 0) issues.push('boxes must not be empty');
  const boxIds = new Set<string>();
  config.boxes.forEach((box, i) => {
    const path = `boxes[${i}]`;
    if (boxIds.has(box.id)) issues.push(`${path}.id "${box.id}" is duplicated`);
    boxIds.add(box.id);
    checkDimensions(box.inner, `${path}.inner`, issues);
    checkDimensions(box.outer, `${path}.outer`, issues);
    if (!isNonNegativeInt(box.tareG)) issues.push(`${path}.tareG must be a non-negative integer`);
    if (!isNonNegativeInt(box.costCents)) issues.push(`${path}.costCents must be a non-negative integer`);
    if (!isPositiveInt(box.maxPayloadG)) issues.push(`${path}.maxPayloadG must be a positive integer`);
  });

  const tiers = new Set<string>();
  config.rates.forEach((rate, i) => {
    const path = `rates[${i}]`;
    const key = `${rate.carrierId}|${rate.warehouseId}|${rate.zone}|${rate.maxKg}`;
    if (tiers.has(key)) issues.push(`${path} duplicates tier ${key}`);
    tiers.add(key);
    if (!isPositiveInt(rate.maxKg)) issues.push(`${path}.maxKg must be a positive integer`);
    if (!isNonNegativeInt(rate.priceCents)) issues.push(`${path}.priceCents must be a non-negative integer`);
    if (rate.extraKgCents !== undefined && !isNonNegativeInt(rate.extraKgCents)) {
      issues.push(`${path}.extraKgCents must be a non-negative integer`);
    }
  });

  for (const [id, terms] of Object.entries(config.manufacturers)) {
    if (!isNonNegativeInt(terms.fixedShippingCents)) {
      issues.push(`manufacturers.${id}.fixedShippingCents must be a non-negative integer`);
    }
  }

  if (!isNonNegativeInt(settings.paddingMm)) issues.push('settings.paddingMm must be a non-negative integer');
  if (!isPositiveInt(settings.volumetricDivisor)) issues.push('settings.volumetricDivisor must be a positive integer');
  if (!isPositiveInt(settings.consolidationFillBps) || settings.consolidationFillBps > BPS_100_PERCENT) {
    issues.push('settings.consolidationFillBps must be an integer between 1 and 10000 bps');
  }
  if (!isPositiveInt(settings.oversize.maxSideMm)) issues.push('settings.oversize.maxSideMm must be a positive integer');
  if (!isPositiveInt(settings.oversize.maxWeightG)) issues.push('settings.oversize.maxWeightG must be a positive integer');
  if (!isNonNegativeInt(settings.oversize.surchargeCents)) {
    issues.push('settings.oversize.surchargeCents must be a non-negative integer');
  }
  checkBps(settings.gatewayFeeBps, 'settings.gatewayFeeBps', issues);
  checkBps(settings.subsidyBps, 'settings.subsidyBps', issues);

  if (issues.length > 0) throw new ConfigError(issues);
}
