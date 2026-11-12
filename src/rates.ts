import type { EngineConfig, EngineSettings, RateEntry } from './config';
import { billableKg } from './weight';
import type { Cents, Parcel } from './types';

export interface ParcelRate {
  readonly billableKg: number;
  readonly priceCents: Cents;
  readonly surchargeCents: Cents;
}

export interface CarrierQuote {
  readonly carrierId: string;
  /** Sum of label prices for every parcel. */
  readonly labelCents: Cents;
  /** Sum of oversize surcharges. */
  readonly surchargeCents: Cents;
  readonly totalCents: Cents;
  /** Same order as the parcels passed in. */
  readonly parcels: readonly ParcelRate[];
}

/** Any side above the limit, or real weight above the limit, makes a parcel oversize. */
export function isOversize(parcel: Parcel, settings: EngineSettings): boolean {
  const { lengthMm, widthMm, heightMm } = parcel.dimensions;
  const { maxSideMm, maxWeightG } = settings.oversize;
  return Math.max(lengthMm, widthMm, heightMm) > maxSideMm || parcel.realWeightG > maxWeightG;
}

/**
 * Price of the smallest tier that covers `kg`. Above the lane's highest tier, the
 * top tier's `extraKgCents` is charged per extra kilo. Returns null when the carrier
 * cannot take the parcel on this lane.
 */
export function tierPrice(
  rates: readonly RateEntry[],
  carrierId: string,
  warehouseId: string,
  zone: string,
  kg: number,
): Cents | null {
  let covering: RateEntry | null = null;
  let top: RateEntry | null = null;
  for (const rate of rates) {
    if (rate.carrierId !== carrierId || rate.warehouseId !== warehouseId || rate.zone !== zone) continue;
    if (top === null || rate.maxKg > top.maxKg) top = rate;
    if (rate.maxKg >= kg && (covering === null || rate.maxKg < covering.maxKg)) covering = rate;
  }
  if (covering !== null) return covering.priceCents;
  if (top?.extraKgCents === undefined) return null;
  return top.priceCents + (kg - top.maxKg) * top.extraKgCents;
}

/**
 * Rate shopping: prices the whole shipment with every carrier that serves the lane
 * and returns the eligible ones, cheapest first. A carrier is eligible only if it can
 * price every parcel. All parcels of a shipment travel with the same carrier.
 */
export function shopCarriers(
  parcels: readonly Parcel[],
  warehouseId: string,
  zone: string,
  config: Pick<EngineConfig, 'rates' | 'settings'>,
): CarrierQuote[] {
  const { rates, settings } = config;
  const carrierIds = [...new Set(rates.map((r) => r.carrierId))].sort();
  const quotes: CarrierQuote[] = [];

  for (const carrierId of carrierIds) {
    const parcelRates: ParcelRate[] = [];
    for (const parcel of parcels) {
      const kg = billableKg(parcel.realWeightG, parcel.dimensions, settings.volumetricDivisor);
      const priceCents = tierPrice(rates, carrierId, warehouseId, zone, kg);
      if (priceCents === null) break;
      const surchargeCents = isOversize(parcel, settings) ? settings.oversize.surchargeCents : 0;
      parcelRates.push({ billableKg: kg, priceCents, surchargeCents });
    }
    if (parcelRates.length !== parcels.length) continue;

    const labelCents = parcelRates.reduce((sum, r) => sum + r.priceCents, 0);
    const surchargeCents = parcelRates.reduce((sum, r) => sum + r.surchargeCents, 0);
    quotes.push({ carrierId, labelCents, surchargeCents, totalCents: labelCents + surchargeCents, parcels: parcelRates });
  }

  return quotes.sort((a, b) => a.totalCents - b.totalCents || a.carrierId.localeCompare(b.carrierId));
}
