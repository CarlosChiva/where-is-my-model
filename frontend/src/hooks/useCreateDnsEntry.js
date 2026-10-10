import { useState } from 'react';
import { createDnsEntry } from '../services/dnsApi.js';

/**
 * useCreateDnsEntry — Mutation hook for adding a DNS zone record.
 *
 * Arguments: { onSuccess }
 * Returns: { loading, error, mutate }
 */
export default function useCreateDnsEntry({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function mutate(data) {
    setLoading(true);
    setError(null);

    let result;
    try {
      result = await createDnsEntry(data);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
      }
    } catch (err) {
      result = null;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }

    if (result && !result.error && onSuccess) {
      onSuccess();
    }

    return result ?? { data: null, error };
  }

  return { loading, error, mutate, clearError: () => setError(null) };
}
