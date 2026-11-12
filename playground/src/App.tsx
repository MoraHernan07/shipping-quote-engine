import { useMemo, useState } from 'react';
import { createQuoteEngine, type CartLine, type Quote, QuoteError, type QuoteErrorCode } from '../../src';
import { exampleConfig } from '../../examples/example-config';
import { catalog, initialQuantities } from './catalog';
import { Cart } from './components/Cart';
import { Destination } from './components/Destination';
import { Shipment } from './components/Shipment';
import { Summary } from './components/Summary';

/** One engine for the whole page: the config is validated once, at load. */
const engine = createQuoteEngine(exampleConfig);

const MAX_PER_ITEM = 20;

type Result =
  | { readonly status: 'empty' }
  | { readonly status: 'ok'; readonly quote: Quote }
  | { readonly status: 'error'; readonly code: QuoteErrorCode; readonly message: string };

const friendlyErrors: Partial<Record<QuoteErrorCode, string>> = {
  INVALID_POSTAL_CODE: 'Postal codes in Mexico have five digits. Finish typing it or pick a city.',
  UNKNOWN_POSTAL_CODE: 'There is no automatic rate for this area yet. A real checkout would offer a manual quote here.',
  NO_CARRIER_AVAILABLE: 'No carrier can take this shipment to that area.',
};

function runQuote(cart: readonly CartLine[], postalCode: string): Result {
  if (cart.length === 0) return { status: 'empty' };
  try {
    return { status: 'ok', quote: engine.quote(cart, postalCode) };
  } catch (error) {
    if (error instanceof QuoteError) {
      return { status: 'error', code: error.code, message: friendlyErrors[error.code] ?? error.message };
    }
    throw error;
  }
}

export function App() {
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>(initialQuantities);
  const [postalCode, setPostalCode] = useState('44100');

  const cart = useMemo<CartLine[]>(
    () =>
      catalog.flatMap(({ product }) => {
        const quantity = quantities[product.sku] ?? 0;
        return quantity > 0 ? [{ product, quantity }] : [];
      }),
    [quantities],
  );

  // The quote is recomputed on every change: the engine is pure and fast, so no "Quote" button.
  const result = useMemo(() => runQuote(cart, postalCode), [cart, postalCode]);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function setQuantity(sku: string, quantity: number): void {
    setQuantities((prev) => ({ ...prev, [sku]: Math.max(0, Math.min(quantity, MAX_PER_ITEM)) }));
  }

  return (
    <div className="page">
      <header className="masthead">
        <p className="product">Shipping Quote Engine</p>
        <a className="source" href="https://github.com/MoraHernan07/shipping-quote-engine">
          Source on GitHub
        </a>
      </header>

      <main className="layout">
        <aside className="panel">
          <Destination postalCode={postalCode} onChange={setPostalCode} />
          <Cart quantities={quantities} onChange={setQuantity} max={MAX_PER_ITEM} />
        </aside>

        <div className="results">
          {result.status === 'empty' && (
            <p className="summary-line muted-line">Add an item to the cart to see what shipping costs.</p>
          )}
          {result.status === 'error' && (
            <div className="error" role="alert">
              <p className="summary-line">{result.message}</p>
              <p className="summary-sub">Engine error code: {result.code}</p>
            </div>
          )}
          {result.status === 'ok' && (
            <>
              <Summary quote={result.quote} itemCount={itemCount} />
              <div className="sheet">
                {result.quote.shipments.map((shipment) => (
                  <Shipment
                    key={shipment.kind === 'warehouse' ? 'warehouse' : shipment.origin.manufacturerId}
                    shipment={shipment}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        Every figure on this page is computed live by the same code the test suite verifies. Carriers, prices and
        products are made up for the demo.
      </footer>
    </div>
  );
}
