import { useState } from 'react';
import { updatePc } from '../services/pcApi.js';

/**
 * useUpdatePc — Mutation hook for updating an existing GPU server.
 *
 * Arguments: { onSuccess }
 * Returns: { loading, error, mutate }
 */
export default function useUpdatePc({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function mutate({ id, data }) {
    setLoading(true);
    setError(null);

    let result;
    try {
      result = await updatePc(id, data);
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
