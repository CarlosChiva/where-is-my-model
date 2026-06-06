import { useState } from 'react';
import { updateService } from '../services/serviceApi.js';

/**
 * useUpdateService — Mutation hook for editing a service on a GPU server.
 *
 * Arguments: { onSuccess }
 * Returns: { loading, error, mutate }
 */
export default function useUpdateService({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function mutate({ pcId, index, data }) {
    setLoading(true);
    setError(null);

    let result;
    try {
      result = await updateService(pcId, index, data);
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
