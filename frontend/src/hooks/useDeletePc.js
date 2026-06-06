import { useState } from 'react';
import { deletePc } from '../services/pcApi.js';

/**
 * useDeletePc — Mutation hook for deleting a GPU server.
 *
 * Arguments: { onSuccess }
 * Returns: { loading, error, mutate }
 */
export default function useDeletePc({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function mutate(pcId) {
    setLoading(true);
    setError(null);

    let result;
    try {
      result = await deletePc(pcId);
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

  return { loading, error, mutate };
}
