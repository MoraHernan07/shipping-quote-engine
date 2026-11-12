import type { EngineConfig } from './config';
import { QuoteError } from './errors';

export interface Destination {
  readonly postalCode: string;
  readonly state: string;
  readonly zone: string;
  /** Warehouse that serves this destination. */
  readonly warehouseId: string;
}

/**
 * Maps a 5-digit Mexican postal code to its state, rate zone and serving warehouse.
 * Only the first two digits are needed: they identify the state.
 *
 * @throws QuoteError INVALID_POSTAL_CODE if the code is not five digits.
 * @throws QuoteError UNKNOWN_POSTAL_CODE if the prefix is not in the table.
 */
export function resolveDestination(postalCode: string, config: EngineConfig): Destination {
  if (!/^\d{5}$/.test(postalCode)) {
    throw new QuoteError('INVALID_POSTAL_CODE', `Postal code must be five digits, got "${postalCode}"`);
  }

  const entry = config.postalPrefixes[postalCode.slice(0, 2)];
  if (entry === undefined) {
    throw new QuoteError('UNKNOWN_POSTAL_CODE', `No zone configured for postal code ${postalCode}`);
  }

  const warehouseId = config.routing.warehouseByState[entry.state] ?? config.routing.defaultWarehouseId;
  return { postalCode, state: entry.state, zone: entry.zone, warehouseId };
}
