import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPcs } from '../services/pcApi.js';

/**
 * usePcs — Fetch and manage the master list of GPU servers.
 *
 * Uses a monotonic fetch counter so that only the latest in-flight
 * request updates state.  Explicit refetches always win; stale or
 * concurrent inflight responses are silently discarded.
 *
 * Returns:
 *   data    — pcs array (empty while loading / on error)
 *   loading — boolean, true during in-flight fetch
 *   error   — string or null
 *   refetch — function to re-trigger the current fetch
 */
export default function usePcs() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCounter = useRef(0);

  const fetchPCs = useCallback(async () => {
    const currentCounter = ++fetchCounter.current;
    setLoading(true);
    try {
      const result = await fetchPcs();
      if (currentCounter !== fetchCounter.current) return; // stale — another fetch won
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data || []);
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

  /* Initial load on mount */
  useEffect(() => {
    fetchPCs();
  }, [fetchPCs]);

  return { data, loading, error, refetch: fetchPCs };
}
