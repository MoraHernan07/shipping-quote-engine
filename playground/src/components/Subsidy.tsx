import type { SubsidyBreakdown } from '../../../src';
import { money } from '../format';

interface Props {
  readonly subsidy: SubsidyBreakdown;
  readonly shippingCostCents: number;
  /** 0 for dropshipped orders: the manufacturer packs. */
  readonly packagingCents: number;
  /** The explanation is shown once per page, under the warehouse shipment. */
  readonly showNote?: boolean;
}

/** Share of the shipping cost, as a CSS width. */
function share(part: number, whole: number): string {
  return whole === 0 ? '0%' : `${(part / whole) * 100}%`;
}

export function Subsidy({ subsidy: s, shippingCostCents: cost, packagingCents, showNote = true }: Props) {
  const storePays = s.packagingCoveredCents + s.labelCoveredCents;
  return (
    <div className="who-pays">
      <h3>Who pays for shipping</h3>
      <div className="split" role="img" aria-label={`Store pays ${money(storePays)}, customer pays ${money(s.customerShippingCents)}`}>
        <span className="split-store" style={{ width: share(storePays, cost) }} />
        <span className="split-customer" style={{ width: share(s.customerShippingCents, cost) }} />
      </div>
      <dl className="split-legend">
        <div>
          <dt>Store</dt>
          <dd>
            {money(storePays)}
            {packagingCents > 0 && s.packagingCoveredCents > 0 && (
              <span className="split-detail">box {money(s.packagingCoveredCents)}, label {money(s.labelCoveredCents)}</span>
            )}
          </dd>
        </div>
        <div className="is-customer">
          <dt>Customer</dt>
          <dd>{money(s.customerShippingCents)}</dd>
        </div>
      </dl>
      {showNote && (
        <p className="note">
          These products set aside {money(s.poolCents)} of their own profit for shipping. The store never spends more
          than that, so free shipping can&apos;t turn a profitable order into a loss.
        </p>
      )}
    </div>
  );
}
