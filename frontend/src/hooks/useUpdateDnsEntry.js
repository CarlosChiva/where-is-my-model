import { useState } from 'react';
import { updateDnsEntry } from '../services/dnsApi.js';

/**
 * useUpdateDnsEntry — Mutation hook for editing a DNS zone record.
 *
 * Arguments: { onSuccess }
 * Returns: { loading, error, mutate }
 */
export default function useUpdateDnsEntry({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function mutate({ entryId, data }) {
    setLoading(true);
    setError(null);

    let result;
    try {
      result = await updateDnsEntry(entryId, data);
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
