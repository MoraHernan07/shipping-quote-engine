import { type EngineConfig, validateConfig } from './config';
import { QuoteError } from './errors';
import { pack, type PackingStrategy } from './packing';
import { type CarrierQuote, shopCarriers } from './rates';
import { splitByOrigin } from './split';
import { applySubsidy, type SubsidyBreakdown } from './subsidy';
import type { Cents, CartLine, Parcel, Product } from './types';
import { type Destination, resolveDestination } from './zones';

export interface StrategyOption {
  readonly strategy: PackingStrategy;
  readonly parcelCount: number;
  readonly totalCents: Cents;
}

export interface WarehouseShipmentQuote {
  readonly kind: 'warehouse';
  readonly origin: { readonly kind: 'warehouse'; readonly warehouseId: string };
  readonly strategy: PackingStrategy;
  readonly parcels: readonly Parcel[];
  readonly carrier: CarrierQuote;
  /** Second-cheapest carrier, kept as an operational fallback. */
  readonly runnerUp: CarrierQuote | null;
  readonly packagingCents: Cents;
  /** Packaging + labels + surcharges. */
  readonly shippingCostCents: Cents;
  readonly subsidy: SubsidyBreakdown;
  /** Every strategy that was priced, so the choice can be audited. */
  readonly options: readonly StrategyOption[];
}

export interface ManufacturerShipmentQuote {
  readonly kind: 'manufacturer';
  readonly origin: { readonly kind: 'manufacturer'; readonly manufacturerId: string };
  readonly shippingCostCents: Cents;
  readonly subsidy: SubsidyBreakdown;
}

export type ShipmentQuote = WarehouseShipmentQuote | ManufacturerShipmentQuote;

export interface Quote {
  readonly destination: Destination;
  readonly shipments: readonly ShipmentQuote[];
  readonly totals: {
    readonly productsCents: Cents;
    readonly shippingCostCents: Cents;
    readonly subsidyCents: Cents;
    readonly customerShippingCents: Cents;
  };
}

const STRATEGIES: readonly PackingStrategy[] = ['consolidated', 'individual'];

function quoteWarehouse(units: readonly Product[], destination: Destination, config: EngineConfig): WarehouseShipmentQuote {
  type Priced = { strategy: PackingStrategy; parcels: Parcel[]; carriers: CarrierQuote[]; packagingCents: Cents; totalCents: Cents };
  const priced: Priced[] = [];

  for (const strategy of STRATEGIES) {
    const parcels = pack(strategy, units, config.boxes, config.settings);
    const carriers = shopCarriers(parcels, destination.warehouseId, destination.zone, config);
    const [cheapest] = carriers;
    if (cheapest === undefined) continue;
    const packagingCents = parcels.reduce((sum, p) => sum + p.packagingCents, 0);
    priced.push({ strategy, parcels, carriers, packagingCents, totalCents: packagingCents + cheapest.totalCents });
  }

  // Cheapest total wins; on a tie, `consolidated` (listed first) wins because sort is stable.
  priced.sort((a, b) => a.totalCents - b.totalCents);
  const [best] = priced;
  const carrier = best?.carriers[0];
  if (best === undefined || carrier === undefined) {
    throw new QuoteError(
      'NO_CARRIER_AVAILABLE',
      `No carrier can deliver from ${destination.warehouseId} to zone ${destination.zone}`,
    );
  }

  return {
    kind: 'warehouse',
    origin: { kind: 'warehouse', warehouseId: destination.warehouseId },
    strategy: best.strategy,
    parcels: best.parcels,
    carrier,
    runnerUp: best.carriers[1] ?? null,
    packagingCents: best.packagingCents,
    shippingCostCents: best.totalCents,
    subsidy: applySubsidy(units, best.packagingCents, carrier.totalCents, config.settings),
    options: priced.map((p) => ({ strategy: p.strategy, parcelCount: p.parcels.length, totalCents: p.totalCents })),
  };
}

function quoteManufacturer(units: readonly Product[], manufacturerId: string, config: EngineConfig): ManufacturerShipmentQuote {
  const terms = config.manufacturers[manufacturerId];
  if (terms === undefined) {
    throw new QuoteError('UNKNOWN_MANUFACTURER', `Manufacturer "${manufacturerId}" is not configured`);
  }
  return {
    kind: 'manufacturer',
    origin: { kind: 'manufacturer', manufacturerId },
    shippingCostCents: terms.fixedShippingCents,
    subsidy: applySubsidy(units, 0, terms.fixedShippingCents, config.settings),
  };
}

/** Quotes a cart without validating the config. Prefer `createQuoteEngine`. */
export function quoteCart(cart: readonly CartLine[], postalCode: string, config: EngineConfig): Quote {
  const groups = splitByOrigin(cart);
  const destination = resolveDestination(postalCode, config);

  const shipments: ShipmentQuote[] = groups.map((group) =>
    group.origin.kind === 'warehouse'
      ? quoteWarehouse(group.units, destination, config)
      : quoteManufacturer(group.units, group.origin.manufacturerId, config),
  );

  const sum = (pick: (s: ShipmentQuote) => number): Cents => shipments.reduce((total, s) => total + pick(s), 0);
  return {
    destination,
    shipments,
    totals: {
      productsCents: cart.reduce((total, line) => total + line.product.priceCents * line.quantity, 0),
      shippingCostCents: sum((s) => s.shippingCostCents),
      subsidyCents: sum((s) => s.subsidy.subsidyCents),
      customerShippingCents: sum((s) => s.subsidy.customerShippingCents),
    },
  };
}

export interface QuoteEngine {
  readonly config: EngineConfig;
  quote(cart: readonly CartLine[], postalCode: string): Quote;
}

/**
 * Validates the config once and returns an engine bound to it.
 * @throws ConfigError listing every problem found in the config.
 */
export function createQuoteEngine(config: EngineConfig): QuoteEngine {
  validateConfig(config);
  return {
    config,
    quote: (cart, postalCode) => quoteCart(cart, postalCode, config),
  };
}
