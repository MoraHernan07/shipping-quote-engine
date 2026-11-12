import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 380;

/** Ease-out cubic: fast start, gentle landing. */
const ease = (t: number): number => 1 - (1 - t) ** 3;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tweens a number toward `target` with requestAnimationFrame, so figures glide to
 * their new value instead of jumping. Only the displayed value animates; the real
 * value is always `target`. Integer in, integer out (cents stay cents).
 */
export function useAnimatedNumber(target: number): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target || prefersReducedMotion()) {
      fromRef.current = target;
      setShown(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const value = Math.round(from + (target - from) * ease(t));
      fromRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return shown;
}
