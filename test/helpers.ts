import type { Box, Dimensions, Product } from '../src';
import { exampleConfig } from '../examples/example-config';

export const config = exampleConfig;
export const settings = exampleConfig.settings;
export const boxes = exampleConfig.boxes;

export const dims = (lengthMm: number, widthMm: number, heightMm: number): Dimensions => ({
  lengthMm,
  widthMm,
  heightMm,
});

export function product(overrides: Partial<Product> = {}): Product {
  return {
    sku: 'SKU-1',
    priceCents: 11_600,
    vatBps: 1_600,
    costCents: 5_000,
    weightG: 500,
    dimensions: dims(100, 100, 100),
    packaging: 'box',
    origin: { kind: 'warehouse' },
    ...overrides,
  };
}

export function boxById(id: string): Box {
  const found = boxes.find((b) => b.id === id);
  if (found === undefined) throw new Error(`No box ${id}`);
  return found;
}
