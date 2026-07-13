import { useState } from 'react';
import { deleteUser } from '../services/userApi.js';

/**
 * useDeleteUser — Mutation hook for deleting a user account.
 *
 * Arguments: { onSuccess }
 * Returns: { loading, error, mutate }
 */
export default function useDeleteUser({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function mutate(userId) {
    setLoading(true);
    setError(null);

    let result;
    try {
      result = await deleteUser(userId);
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
