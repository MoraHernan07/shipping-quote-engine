import { destinations } from '../catalog';

interface Props {
  readonly postalCode: string;
  readonly onChange: (postalCode: string) => void;
}

export function Destination({ postalCode, onChange }: Props) {
  return (
    <section className="panel-section">
      <h2>Ship to</h2>
      <div className="cities" role="group" aria-label="Choose a city">
        {destinations.map((d) => (
          <button
            key={d.postalCode}
            type="button"
            aria-pressed={d.postalCode === postalCode}
            className="city"
            onClick={() => {
              onChange(d.postalCode);
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>or type a postal code</span>
        <input
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          value={postalCode}
          onChange={(event) => {
            onChange(event.target.value.replace(/\D/g, ''));
          }}
        />
      </label>
    </section>
  );
}
