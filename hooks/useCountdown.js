import { useEffect, useRef, useState } from 'react';

import { serverNow } from '../api/client.js';

/**
 * Time remaining until an absolute instant, corrected for a wrong device clock.
 *
 * This replaces the prototype's single global one-second tick, which
 * re-rendered the whole tree to keep client-side prices fresh. Pricing is
 * server-side now, so the only remaining job is countdowns — and each one
 * belongs inside the component that displays it, so a tick repaints one span
 * instead of every product card on the page.
 *
 * @param {string|number|null} target  RFC3339 instant from the API
 * @param {{onExpire?: () => void}} [options]
 */
export function useCountdown(target, { onExpire } = {}) {
  const targetMs = useRef(0);
  targetMs.current = target ? Date.parse(target) : 0;

  const [remaining, setRemaining] = useState(() => remainingFrom(targetMs.current));

  // Kept in a ref so a caller passing an inline arrow does not restart the
  // timer on every render.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!targetMs.current) {
      setRemaining(0);
      return undefined;
    }

    let timer;
    let fired = false;

    const tick = () => {
      const ms = remainingFrom(targetMs.current);
      setRemaining(ms);

      if (ms <= 0) {
        if (!fired) {
          fired = true;
          onExpireRef.current?.();
        }
        return;
      }

      // Chained to the next boundary the display actually crosses rather than
      // a fixed interval, so the number never drifts or skips. The cadence
      // relaxes when nobody is watching individual seconds — a 30-minute draft
      // countdown does not need 1800 renders.
      const step = ms > 10 * 60_000 ? 30_000 : ms > 60_000 ? 10_000 : 1_000;
      timer = setTimeout(tick, Math.min(ms % step || step, ms));
    };

    tick();
    return () => clearTimeout(timer);
  }, [target]);

  return {
    ms: remaining,
    expired: remaining <= 0,
    // A missing target means "no deadline", which is not the same as expired.
    active: Boolean(targetMs.current) && remaining > 0,
  };
}

function remainingFrom(ms) {
  if (!ms || Number.isNaN(ms)) return 0;
  return Math.max(0, ms - serverNow());
}
