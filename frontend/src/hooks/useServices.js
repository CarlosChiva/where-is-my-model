import { useState, useEffect } from 'react';
import { fetchServices } from '../services/serviceApi.js';

/**
 * useServices — Fetch the list of services for a specific GPU server.
 *
 * Arguments: pcId — MongoDB _id of the parent PC (triggers fetch when provided)
 * Returns: { data, loading, error, refetch }
 */
export default function useServices(pcId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function execFetch() {
    if (!pcId) return; // guard: skip if no PC context
    setLoading(true);
    setError(null);

    try {
      const result = await fetchServices(pcId);
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  /* Fetch when pcId is provided */
  useEffect(() => {
    if (pcId) {
      execFetch();
    }
  }, [pcId]);

  return { data, loading, error, refetch: execFetch };
}
