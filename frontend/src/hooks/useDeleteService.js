import { useState } from 'react';
import { deleteService } from '../services/serviceApi.js';

/**
 * useDeleteService — Mutation hook for removing a service from a GPU server.
 *
 * Arguments: { onSuccess }
 * Returns: { loading, error, mutate }
 */
export default function useDeleteService({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function mutate({ pcId, index }) {
    setLoading(true);
    setError(null);

    let result;
    try {
      result = await deleteService(pcId, index);
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
