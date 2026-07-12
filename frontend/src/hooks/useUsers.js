import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchUsers } from '../services/userApi.js';

/**
 * useUsers — Fetch and manage the list of application users.
 *
 * Uses a monotonic fetch counter so that only the latest in-flight
 * request updates state.  Explicit refetches always win; stale or
 * concurrent inflight responses are silently discarded.
 *
 * Returns:
 *   data    — users array (empty while loading / on error)
 *   loading — boolean, true during in-flight fetch
 *   error   — string or null
 *   refetch — function to re-trigger the current fetch
 */
export default function useUsers() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCounter = useRef(0);

  const fetchUsersList = useCallback(async () => {
    const currentCounter = ++fetchCounter.current;
    setLoading(true);
    try {
      const result = await fetchUsers();
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
    fetchUsersList();
  }, [fetchUsersList]);

  return { data, loading, error, refetch: fetchUsersList };
}
