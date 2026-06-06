import { useState } from 'react';
import { createService } from '../services/serviceApi.js';

/**
 * useCreateService — Mutation hook for adding a service to a GPU server.
 *
 * Arguments: { onSuccess }
 * Returns: { loading, error, mutate }
 */
export default function useCreateService({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function mutate({ pcId, data }) {
    setLoading(true);
    setError(null);

    let result;
    try {
      result = await createService(pcId, data);
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
