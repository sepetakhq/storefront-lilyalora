import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchDeployedEntry, isStale, runningEntry } from './buildVersion.js';

/** Two refocuses inside this window collapse into one check. */
const MIN_INTERVAL_MS = 60_000;

/**
 * Notices that a tab is running an older build than the server is serving.
 *
 * The problem this solves is a tab left open across a deploy — the backoffice
 * especially, which merchants park all day. Such a tab never re-requests
 * index.html, so it keeps running the old bundle indefinitely, missing every
 * feature shipped since and 404ing on any lazy chunk it has not already
 * loaded (the deploy is one binary with the assets embedded, so the previous
 * build's files stop existing).
 *
 * Checks on tab refocus rather than on a timer: it is the cheap moment (no
 * background traffic at all) and the useful one, since it is exactly when the
 * merchant is about to act on what they see.
 *
 * ponytail: flaps during a rolling deploy — with two replicas serving
 * different builds, a check can see the new one while the reload lands on the
 * old. Self-correcting within the rollout, and the banner is dismissible.
 * Fixing it properly needs a sticky build id at the ingress, which is not
 * worth it for a window measured in seconds.
 */
export function useBuildUpdate() {
  // The running build cannot change for the life of the page, so it is read
  // once. A lazy initialiser rather than an effect: the value is wanted before
  // the first paint, and reading it is a single querySelector.
  const [running] = useState(runningEntry);
  const [deployed, setDeployed] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const busy = useRef(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    // Nothing to compare against — dev, or a binary carrying the placeholder
    // index.html. Stay inert rather than guess.
    if (!running) return undefined;

    let cancelled = false;
    const check = async () => {
      // visibilitychange fires on the way out as well as the way in.
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      // Alt-tabbing is constant. One check a minute still catches a deploy
      // long before it matters, and keeps a parked tab from talking to the
      // server hundreds of times a day.
      if (busy.current || now - lastCheck.current < MIN_INTERVAL_MS) return;
      busy.current = true;
      lastCheck.current = now;
      try {
        const entry = await fetchDeployedEntry();
        // A failed check leaves a previously seen update standing: once we
        // know a new build exists, a later network blip is no reason to take
        // the banner away again.
        if (!cancelled && entry) setDeployed(entry);
      } finally {
        busy.current = false;
      }
    };

    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', check);
    };
  }, [running]);

  return {
    updateReady: isStale(running, deployed) && deployed !== dismissed,
    // The dismissed build is remembered rather than a boolean: whatever ships
    // after this one has a different hash, and must be allowed to ask again.
    dismiss: useCallback(() => setDismissed(deployed), [deployed]),
  };
}
