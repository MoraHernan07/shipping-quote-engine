const mxn = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol' });

/** Integer cents to a display string. The only place cents become decimals. */
export function money(cents: number): string {
  return mxn.format(cents / 100);
}

export function kilos(grams: number): string {
  return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1)} kg`;
}

export function size(d: { lengthMm: number; widthMm: number; heightMm: number }): string {
  return `${d.lengthMm / 10}×${d.widthMm / 10}×${d.heightMm / 10} cm`;
}

/** ["A", "A", "B"] → "A ×2, B" */
export function groupSkus(skus: readonly string[], label: (sku: string) => string): string {
  const counts = new Map<string, number>();
  for (const sku of skus) counts.set(sku, (counts.get(sku) ?? 0) + 1);
  return [...counts].map(([sku, n]) => (n > 1 ? `${label(sku)} ×${n}` : label(sku))).join(', ');
}
