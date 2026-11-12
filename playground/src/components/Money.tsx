import { money } from '../format';
import { useAnimatedNumber } from '../useAnimatedNumber';

/** A money amount that glides to its new value when it changes. */
export function Money({ cents, className }: { readonly cents: number; readonly className?: string }) {
  const shown = useAnimatedNumber(cents);
  return <span className={className === undefined ? 'num' : `num ${className}`}>{money(shown)}</span>;
}
