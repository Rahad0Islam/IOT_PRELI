/**
 * AnimatedNumber — counter animation for the power meter.
 */
import { useEffect, useState } from 'react';

export default function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const start = shown;
    const delta = value - start;
    const duration = 600;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setShown(Math.round(start + delta * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{shown.toLocaleString()}</>;
}
