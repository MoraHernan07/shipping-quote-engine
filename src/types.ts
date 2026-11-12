/** Integer amount in the smallest currency unit (for MXN, centavos). Never a float. */
export type Cents = number;

/** Integer weight in grams. */
export type Grams = number;

/** Integer length in millimeters. */
export type Millimeters = number;

/** Basis points: 10_000 bps = 100%, 1 bps = 0.01%. */
export type Bps = number;

export interface Dimensions {
  readonly lengthMm: Millimeters;
  readonly widthMm: Millimeters;
  readonly heightMm: Millimeters;
}

/** `box` items are packed into catalog boxes; `sack` items (feed, litter) ship on their own. */
export type Packaging = 'box' | 'sack';

/** Where a product physically ships from. */
export type Origin =
  | { readonly kind: 'warehouse' }
  | { readonly kind: 'manufacturer'; readonly manufacturerId: string };

export interface Product {
  readonly sku: string;
  /** Public price, VAT included. */
  readonly priceCents: Cents;
  /** VAT rate applied to the price (1600 = 16%, 0 = exempt). */
  readonly vatBps: Bps;
  /** Unit cost to the business, VAT excluded. */
  readonly costCents: Cents;
  readonly weightG: Grams;
  readonly dimensions: Dimensions;
  readonly packaging: Packaging;
  readonly origin: Origin;
  /** Per-SKU override of the share of profit that funds shipping. */
  readonly subsidyBps?: Bps;
}

export interface CartLine {
  readonly product: Product;
  readonly quantity: number;
}

export interface Box {
  readonly id: string;
  /** Usable space inside the box. */
  readonly inner: Dimensions;
  /** Size the carrier measures. */
  readonly outer: Dimensions;
  readonly tareG: Grams;
  readonly costCents: Cents;
  readonly maxPayloadG: Grams;
}

/**
 * One physical package handed to a carrier.
 * `box`: a catalog box. `sack`: a sack item shipped as is. `self`: an item too large
 * for every catalog box, shipped in its own packaging.
 */
export interface Parcel {
  readonly kind: 'box' | 'sack' | 'self';
  readonly boxId: string | null;
  readonly skus: readonly string[];
  readonly contentWeightG: Grams;
  readonly realWeightG: Grams;
  readonly dimensions: Dimensions;
  readonly packagingCents: Cents;
}
