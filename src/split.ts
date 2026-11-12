import { QuoteError } from './errors';
import { BPS_100_PERCENT, isNonNegativeInt, isPositiveInt } from './math';
import type { CartLine, Origin, Product } from './types';

/** Upper bound per cart line; protects the packer from absurd inputs. */
export const MAX_QUANTITY_PER_LINE = 500;

export interface ShipmentGroup {
  readonly origin: Origin;
  /** One entry per physical unit (a line with quantity 3 adds the product three times). */
  readonly units: readonly Product[];
}

function validateProduct(product: Product): void {
  const { sku, dimensions: d } = product;
  const valid =
    sku !== '' &&
    isNonNegativeInt(product.priceCents) &&
    isNonNegativeInt(product.costCents) &&
    isNonNegativeInt(product.vatBps) &&
    product.vatBps <= BPS_100_PERCENT &&
    isPositiveInt(product.weightG) &&
    isPositiveInt(d.lengthMm) &&
    isPositiveInt(d.widthMm) &&
    isPositiveInt(d.heightMm) &&
    (product.subsidyBps === undefined ||
      (isNonNegativeInt(product.subsidyBps) && product.subsidyBps <= BPS_100_PERCENT));
  if (!valid) throw new QuoteError('INVALID_PRODUCT', `Product "${sku}" has invalid fields`);
}

/**
 * Splits a cart into one group per origin: the own warehouse, plus one group per
 * manufacturer that ships directly (dropshipping). Each group becomes its own shipment.
 * Output order is deterministic: warehouse first, then manufacturers by id.
 */
export function splitByOrigin(cart: readonly CartLine[]): ShipmentGroup[] {
  if (cart.length === 0) throw new QuoteError('EMPTY_CART', 'Cart is empty');

  const warehouseUnits: Product[] = [];
  const byManufacturer = new Map<string, Product[]>();

  for (const { product, quantity } of cart) {
    if (!isPositiveInt(quantity) || quantity > MAX_QUANTITY_PER_LINE) {
      throw new QuoteError('INVALID_QUANTITY', `Quantity for "${product.sku}" must be 1..${MAX_QUANTITY_PER_LINE}`);
    }
    validateProduct(product);

    let bucket = warehouseUnits;
    if (product.origin.kind === 'manufacturer') {
      const id = product.origin.manufacturerId;
      bucket = byManufacturer.get(id) ?? [];
      byManufacturer.set(id, bucket);
    }
    for (let i = 0; i < quantity; i++) bucket.push(product);
  }

  const groups: ShipmentGroup[] = [];
  if (warehouseUnits.length > 0) groups.push({ origin: { kind: 'warehouse' }, units: warehouseUnits });
  for (const id of [...byManufacturer.keys()].sort()) {
    groups.push({ origin: { kind: 'manufacturer', manufacturerId: id }, units: byManufacturer.get(id) ?? [] });
  }
  return groups;
}
