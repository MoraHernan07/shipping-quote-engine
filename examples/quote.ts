import { createQuoteEngine, type Quote } from '../src';
import { exampleConfig, products } from './example-config';

const mxn = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

function print(quote: Quote): void {
  const { destination: d, totals } = quote;
  console.log(`\nDestination ${d.postalCode} · ${d.state} · zone "${d.zone}" · ships from ${d.warehouseId}\n`);

  for (const s of quote.shipments) {
    if (s.kind === 'manufacturer') {
      console.log(`Manufacturer ${s.origin.manufacturerId}: flat fee ${mxn(s.shippingCostCents)}`);
    } else {
      console.log(`Warehouse ${s.origin.warehouseId}: strategy "${s.strategy}", ${s.parcels.length} parcel(s)`);
      s.parcels.forEach((p, i) => {
        const rate = s.carrier.parcels[i];
        const kg = rate === undefined ? '?' : `${rate.billableKg} kg billable`;
        console.log(`  - ${p.kind}${p.boxId === null ? '' : ` ${p.boxId}`} [${p.skus.join(', ')}] ${kg}`);
      });
      console.log(`  carrier ${s.carrier.carrierId} ${mxn(s.carrier.totalCents)}` +
        (s.runnerUp === null ? '' : ` (runner-up ${s.runnerUp.carrierId} ${mxn(s.runnerUp.totalCents)})`));
      console.log(`  options: ${s.options.map((o) => `${o.strategy} ${mxn(o.totalCents)}`).join(' | ')}`);
    }
    console.log(`  subsidy pool ${mxn(s.subsidy.poolCents)}, used ${mxn(s.subsidy.subsidyCents)}, ` +
      `customer pays ${mxn(s.subsidy.customerShippingCents)}\n`);
  }

  console.log(`Products ${mxn(totals.productsCents)} · shipping cost ${mxn(totals.shippingCostCents)} · ` +
    `subsidy ${mxn(totals.subsidyCents)} · customer shipping ${mxn(totals.customerShippingCents)}\n`);
}

const engine = createQuoteEngine(exampleConfig);

print(engine.quote(
  [
    { product: products.catToy, quantity: 3 },
    { product: products.scratcher, quantity: 1 },
    { product: products.litterSack, quantity: 1 },
    { product: products.dogBed, quantity: 1 },
  ],
  '44100', // Guadalajara
));

print(engine.quote([{ product: products.catTree, quantity: 1 }], '03100')); // Mexico City
