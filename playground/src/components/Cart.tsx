import { catalog } from '../catalog';
import { kilos, money, size } from '../format';

interface Props {
  readonly quantities: Readonly<Record<string, number>>;
  readonly onChange: (sku: string, quantity: number) => void;
  readonly max: number;
}

export function Cart({ quantities, onChange, max }: Props) {
  return (
    <section className="panel-section">
      <h2>Cart</h2>
      <ul className="cart">
        {catalog.map(({ product, name, note }) => {
          const quantity = quantities[product.sku] ?? 0;
          return (
            <li key={product.sku} className={quantity > 0 ? 'cart-row' : 'cart-row is-empty'}>
              <div className="cart-info">
                <span className="cart-name">{name}</span>
                <span className="cart-meta">
                  {money(product.priceCents)}, {kilos(product.weightG)}, {size(product.dimensions)}
                </span>
                {note !== '' && <span className="cart-note">{note}</span>}
              </div>
              <div className="stepper">
                <button
                  type="button"
                  aria-label={`Remove one ${name}`}
                  disabled={quantity === 0}
                  onClick={() => {
                    onChange(product.sku, quantity - 1);
                  }}
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
                    <path d="M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
                <span className="stepper-value num">{quantity}</span>
                <button
                  type="button"
                  aria-label={`Add one ${name}`}
                  disabled={quantity >= max}
                  onClick={() => {
                    onChange(product.sku, quantity + 1);
                  }}
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
                    <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
