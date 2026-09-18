import { useCallback, useEffect, useRef, useState } from 'react';

const REFRESH_MS = 30_000;

/**
 * Polls /api/snapshot and exposes a countdown so the header can show
 * when the next pull lands. Keeps the previous payload visible while a
 * refresh is in flight — the dashboard never flashes empty.
 */
export function useSnapshot() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [secondsToRefresh, setSeconds] = useState(REFRESH_MS / 1000);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/snapshot');
      if (!res.ok) throw new Error(`Snapshot failed with HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setSeconds(REFRESH_MS / 1000);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer.current);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s <= 1 ? REFRESH_MS / 1000 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  return { data, error, loading, secondsToRefresh, refresh: load };
}

/** Live IST clock, ticking once a second. */
export function useIstClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now);
}
