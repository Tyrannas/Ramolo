import { useEffect, useRef } from 'react';

// Keeps the screen awake during a session. Silently no-ops where unsupported.
type WakeLockSentinelLike = { release: () => Promise<void> };

export function useWakeLock(active: boolean) {
  const sentinel = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };

    async function request() {
      if (!active || !nav.wakeLock) return;
      try {
        const s = await nav.wakeLock.request('screen');
        if (cancelled) {
          await s.release().catch(() => {});
        } else {
          sentinel.current = s;
        }
      } catch {
        /* denied or unavailable — ignore */
      }
    }

    request();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active && !sentinel.current) request();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel.current?.release().catch(() => {});
      sentinel.current = null;
    };
  }, [active]);
}
