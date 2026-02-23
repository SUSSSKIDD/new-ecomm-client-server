import { useEffect, useRef } from 'react';

/**
 * Declarative polling hook.
 * @param {() => Promise<boolean>} fetchFn  Async function that returns true if active orders exist (should keep polling).
 * @param {number} interval  Polling interval in ms.
 * @param {boolean} enabled  Whether polling is active.
 */
export function usePolling(fetchFn, interval, enabled = true) {
  const savedFn = useRef(fetchFn);
  savedFn.current = fetchFn;

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    let timeoutId = null;

    const poll = async () => {
      if (!isMounted) return;
      try {
        const shouldContinue = await savedFn.current();
        if (isMounted && shouldContinue) {
          timeoutId = setTimeout(poll, interval);
        }
      } catch {
        // Retry on error
        if (isMounted) {
          timeoutId = setTimeout(poll, interval);
        }
      }
    };

    poll();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [interval, enabled]);
}
