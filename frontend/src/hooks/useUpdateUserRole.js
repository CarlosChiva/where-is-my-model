import { useState } from 'react';
import { updateUserRole } from '../services/userApi.js';

/**
 * useUpdateUserRole — Mutation hook for changing a user's role.
 *
 * Arguments: { onSuccess }
 * Returns: { loading, error, mutate, clearError }
 */
export default function useUpdateUserRole({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function mutate(userId, role) {
    setLoading(true);
    setError(null);

    let result;
    try {
      result = await updateUserRole(userId, role);
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
