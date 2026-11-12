import type { EngineSettings } from './config';
import { applyBpsCeil, applyBpsFloor, BPS_100_PERCENT, divRoundHalfUp } from './math';
import type { Cents, Product } from './types';

export interface SubsidyBreakdown {
  /** Money the products in this shipment set aside for shipping. */
  readonly poolCents: Cents;
  /** Part of the pool actually spent (never more than the shipping cost). */
  readonly subsidyCents: Cents;
  /** Of the subsidy, how much paid for packaging (covered first). */
  readonly packagingCoveredCents: Cents;
  /** Of the subsidy, how much paid for the carrier label and surcharges. */
  readonly labelCoveredCents: Cents;
  /** What the customer is charged for shipping. */
  readonly customerShippingCents: Cents;
}

/** Price without VAT, rounded half up. */
export function priceExVatCents(product: Product): Cents {
  return divRoundHalfUp(product.priceCents * BPS_100_PERCENT, BPS_100_PERCENT + product.vatBps);
}

/** Gateway fee on the VAT-inclusive price, rounded up so the cost is never underestimated. */
export function gatewayFeeCents(product: Product, settings: EngineSettings): Cents {
  return applyBpsCeil(product.priceCents, settings.gatewayFeeBps);
}

/** Real profit of one unit: price without VAT − cost − gateway fee. Can be negative. */
export function unitNetProfitCents(product: Product, settings: EngineSettings): number {
  return priceExVatCents(product) - product.costCents - gatewayFeeCents(product, settings);
}

/** Share of a unit's profit that goes to the shipping pool. Units that lose money contribute 0. */
export function unitContributionCents(product: Product, settings: EngineSettings): Cents {
  const profit = unitNetProfitCents(product, settings);
  if (profit <= 0) return 0;
  return applyBpsFloor(profit, product.subsidyBps ?? settings.subsidyBps);
}

/**
 * Margin-protected shipping subsidy. Each unit funds the pool with a share of its own
 * profit; the pool pays packaging first, then the label; the customer pays the rest.
 *
 * Guarantee: subsidy ≤ pool ≤ the positive profits of the shipment, so free or
 * discounted shipping can never turn a profitable shipment into a loss.
 */
export function applySubsidy(
  units: readonly Product[],
  packagingCents: Cents,
  carrierCents: Cents,
  settings: EngineSettings,
): SubsidyBreakdown {
  const poolCents = units.reduce((sum, p) => sum + unitContributionCents(p, settings), 0);
  const packagingCoveredCents = Math.min(poolCents, packagingCents);
  const labelCoveredCents = Math.min(poolCents - packagingCoveredCents, carrierCents);
  const subsidyCents = packagingCoveredCents + labelCoveredCents;
  return {
    poolCents,
    subsidyCents,
    packagingCoveredCents,
    labelCoveredCents,
    customerShippingCents: packagingCents + carrierCents - subsidyCents,
  };
}
