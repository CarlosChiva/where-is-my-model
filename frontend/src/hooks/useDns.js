import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchDns } from '../services/dnsApi.js';

/**
 * useDns — Fetch and manage the DNS zone card (single object, not a list).
 *
 * Uses a monotonic fetch counter so that only the latest in-flight
 * request updates state.  Explicit refetches always win; stale or
 * concurrent inflight responses are silently discarded.
 *
 * Returns:
 *   data    — the DNS card object, or null while loading / on error
 *   loading — boolean, true during in-flight fetch
 *   error   — string or null
 *   refetch — function to re-trigger the current fetch
 */
export default function useDns() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCounter = useRef(0);

  const fetchDnsData = useCallback(async () => {
    const currentCounter = ++fetchCounter.current;
    setLoading(true);
    try {
      const result = await fetchDns();
      if (currentCounter !== fetchCounter.current) return; // stale — another fetch won
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      if (currentCounter !== fetchCounter.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (currentCounter === fetchCounter.current) {
        setLoading(false);
      }
    }
  }, []);

  /* Initial load on mount — only if token is already present, to avoid 401 race */
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      fetchDnsData();
    }
  }, [fetchDnsData]);

  return { data, loading, error, refetch: fetchDnsData };
}
