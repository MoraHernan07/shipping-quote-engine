import type { Quote } from '../../../src';
import { destinations } from '../catalog';
import { Money } from './Money';

/** Name the place the way the user picked it: the city chip if it matches, otherwise the state. */
function placeName(postalCode: string, state: string): string {
  return destinations.find((d) => d.postalCode === postalCode)?.label ?? state;
}

const WAREHOUSES: Record<string, string> = { puebla: 'Puebla', cdmx: 'Mexico City' };

/** The answer, written as one sentence: what shipping costs and who pays for it. */
export function Summary({ quote, itemCount }: { readonly quote: Quote; readonly itemCount: number }) {
  const { totals: t, destination } = quote;
  const place = placeName(destination.postalCode, destination.state);
  const free = t.customerShippingCents === 0;

  return (
    <section className="summary" aria-live="polite">
      <p className="summary-line">
        Shipping {itemCount} {itemCount === 1 ? 'item' : 'items'} to {place} costs{' '}
        <Money cents={t.shippingCostCents} />. The store covers <Money cents={t.subsidyCents} />
        {free ? (
          <>, so shipping is free for the customer.</>
        ) : (
          <>
            , so the customer pays <Money cents={t.customerShippingCents} className="key" />.
          </>
        )}
      </p>
      <p className="summary-sub">
        Order total <Money cents={t.productsCents + t.customerShippingCents} />, including{' '}
        <Money cents={t.productsCents} /> in products.
      </p>
      <p className="summary-sub">
        {place} is in the {destination.zone} rate zone and ships from{' '}
        {WAREHOUSES[destination.warehouseId] ?? destination.warehouseId}. Carriers price by zone, not by city, so
        places in the same zone cost the same.
      </p>
    </section>
  );
}
