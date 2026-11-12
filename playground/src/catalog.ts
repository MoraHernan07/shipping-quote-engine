import { products } from '../../examples/example-config';
import type { Product } from '../../src';

export interface CatalogItem {
  readonly product: Product;
  readonly name: string;
  /** Only set when it explains a behavior worth noticing. */
  readonly note: string;
}

/** The demo catalog: the same sample products the tests use, with display names. */
export const catalog: readonly CatalogItem[] = [
  { product: products.catToy, name: 'Cat toy', note: '' },
  { product: products.scratcher, name: 'Scratcher', note: '' },
  { product: products.litterSack, name: 'Litter sack 10 kg', note: 'Ships as a sack, VAT exempt' },
  { product: products.catTree, name: 'Cat tree 1.2 m', note: 'Too big for any box' },
  { product: products.dogBed, name: 'Dog bed', note: 'Dropshipped by Acme Pets' },
];

export const destinations = [
  { label: 'Puebla', postalCode: '72000' },
  { label: 'Mexico City', postalCode: '03100' },
  { label: 'Guadalajara', postalCode: '44100' },
  { label: 'Monterrey', postalCode: '64000' },
  { label: 'Cancún', postalCode: '77500' },
  { label: 'La Paz', postalCode: '23000' },
] as const;

/** The cart the page opens with: shows consolidation, a sack and a dropshipped item at once. */
export const initialQuantities: Readonly<Record<string, number>> = {
  [products.catToy.sku]: 3,
  [products.scratcher.sku]: 1,
  [products.litterSack.sku]: 1,
  [products.dogBed.sku]: 1,
};

export function nameOf(sku: string): string {
  return catalog.find((item) => item.product.sku === sku)?.name ?? sku;
}
