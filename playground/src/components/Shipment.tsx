import type { Parcel, ShipmentQuote, WarehouseShipmentQuote } from '../../../src';
import { nameOf } from '../catalog';
import { groupSkus, money } from '../format';
import { Money } from './Money';
import { Subsidy } from './Subsidy';

const WAREHOUSES: Record<string, string> = { puebla: 'Puebla', cdmx: 'Mexico City' };
const MANUFACTURERS: Record<string, string> = { 'acme-pets': 'Acme Pets' };
const titleCase = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

/** Drawing scale for the parcel front view: pixels per millimeter, and a cap for huge items. */
const PX_PER_MM = 0.22;
const MAX_PX = 210;

function parcelLabel(parcel: Parcel): string {
  if (parcel.kind === 'box') return `Box ${parcel.boxId ?? ''}`;
  if (parcel.kind === 'sack') return 'Sack';
  return 'Own packaging';
}

/** Each parcel drawn to scale (front view: length × height), with its numbers underneath. */
function shapeSize(parcel: Parcel): { width: number; height: number } {
  return {
    width: Math.min(MAX_PX, Math.round(parcel.dimensions.lengthMm * PX_PER_MM)),
    height: Math.min(MAX_PX * 0.6, Math.round(parcel.dimensions.heightMm * PX_PER_MM)),
  };
}

function Parcels({ shipment }: { readonly shipment: WarehouseShipmentQuote }) {
  // Every parcel stands on the same floor: the stage is as tall as the tallest parcel.
  const stage = Math.max(...shipment.parcels.map((p) => shapeSize(p).height));
  return (
    <ul className="parcels">
      {shipment.parcels.map((parcel, i) => {
        const rate = shipment.carrier.parcels[i];
        const { width, height } = shapeSize(parcel);
        return (
          <li key={i} className="parcel">
            <div className="parcel-stage" style={{ height: stage }}>
              <div className={`parcel-shape parcel-${parcel.kind}`} style={{ width, height }} />
            </div>
            <p className="parcel-name">{parcelLabel(parcel)}</p>
            <p className="parcel-contents">{groupSkus(parcel.skus, nameOf)}</p>
            {rate !== undefined && (
              <p className="parcel-numbers">
                {rate.billableKg} kg billable, {money(rate.priceCents)}
                {rate.surchargeCents > 0 && <span className="flag">+{money(rate.surchargeCents)} oversize</span>}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Both packing strategies the engine priced, as bars scaled to the most expensive. */
function Strategies({ shipment }: { readonly shipment: WarehouseShipmentQuote }) {
  const max = Math.max(...shipment.options.map((o) => o.totalCents));
  return (
    <ul className="strategies">
      {shipment.options.map((option) => {
        const chosen = option.strategy === shipment.strategy;
        const parcels = `${option.parcelCount} ${option.parcelCount === 1 ? 'parcel' : 'parcels'}`;
        return (
          <li key={option.strategy} className={chosen ? 'strategy is-chosen' : 'strategy'}>
            <span className="strategy-name">
              {option.strategy === 'consolidated' ? 'Shared boxes' : 'One box per item'}
              <span className="strategy-meta">{parcels}</span>
            </span>
            <span className="strategy-track">
              <span style={{ transform: `scaleX(${option.totalCents / max})` }} />
            </span>
            <Money cents={option.totalCents} className="strategy-cost" />
          </li>
        );
      })}
    </ul>
  );
}

export function Shipment({ shipment }: { readonly shipment: ShipmentQuote }) {
  if (shipment.kind === 'manufacturer') {
    const maker = MANUFACTURERS[shipment.origin.manufacturerId] ?? shipment.origin.manufacturerId;
    return (
      <section className="block">
        <h2>Shipped by {maker}</h2>
        <p className="lede">
          The manufacturer packs and ships it for a flat {money(shipment.shippingCostCents)}.
        </p>
        <Subsidy
          subsidy={shipment.subsidy}
          shippingCostCents={shipment.shippingCostCents}
          packagingCents={0}
          showNote={false}
        />
      </section>
    );
  }

  const { carrier, runnerUp } = shipment;
  const warehouse = WAREHOUSES[shipment.origin.warehouseId] ?? shipment.origin.warehouseId;
  return (
    <section className="block">
      <h2>From our {warehouse} warehouse</h2>
      <Parcels shipment={shipment} />

      <h3>How to pack it</h3>
      <Strategies shipment={shipment} />

      <h3>Who delivers</h3>
      <p className="lede">
        <strong>{titleCase(carrier.carrierId)}</strong> is cheapest at {money(carrier.totalCents)}.{' '}
        {runnerUp === null
          ? 'No other carrier can take this shipment.'
          : `${titleCase(runnerUp.carrierId)} stays as the fallback at ${money(runnerUp.totalCents)}.`}
      </p>

      <Subsidy
        subsidy={shipment.subsidy}
        shippingCostCents={shipment.shippingCostCents}
        packagingCents={shipment.packagingCents}
      />
    </section>
  );
}
