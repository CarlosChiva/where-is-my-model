import { useState } from 'react';
import useUsers from '../hooks/useUsers.js';
import useUpdateUserRole from '../hooks/useUpdateUserRole.js';
import useDeleteUser from '../hooks/useDeleteUser.js';
import DeleteConfirmModal from './Modals/DeleteConfirmModal.jsx';

export default function AdminPanel() {
  const { data: users, loading, error: fetchError, refetch } = useUsers();
  const { loading: updating, error: updateError, mutate, clearError } = useUpdateUserRole({ onSuccess: refetch });
  const { loading: deleting, error: deleteError, mutate: deleteUser, clearError: clearDeleteError } = useDeleteUser({ onSuccess: refetch });

  /* ── Confirm dialog target state ── */
  const [deleteTarget, setDeleteTarget] = useState(null); // { userId, username } | null

  /* ── Guard: show spinner while initial data fetch resolves ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  /* ── Guard: fetch error with retry button ── */
  if (fetchError) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="w-full max-w-md p-6 bg-bg-card rounded-lg shadow-card border border-border">
          <h1 className="text-xl font-bold text-text-primary mb-4">User Management</h1>
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-md">
            <p className="text-sm text-danger">{fetchError}</p>
          </div>
          <button
            type="button"
            onClick={refetch}
            className="w-full bg-accent text-bg-primary font-semibold px-4 py-2.5 rounded-md shadow-btn-primary hover:bg-accent-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Role select handler — dispatches any of the three roles ── */
  const handleRoleChange = (userId, newRole) => {
    mutate(userId, newRole);
  };

  /* ── Delete confirm / cancel handlers ── */
  const confirmDelete = async () => {
    const result = await deleteUser(deleteTarget.userId);
    if (!result?.error) {
      setDeleteTarget(null); // auto-close on success
    }
    clearDeleteError();
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    clearDeleteError();
  };

  return (
    <div className="w-full">
      <h1 className="text-xl font-bold text-text-primary mb-4">User Management</h1>

      {/* Mutation error banner with dismiss button */}
      {updateError && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-md flex items-center justify-between">
          <p className="text-sm text-danger">{updateError}</p>
          <button
            type="button"
            onClick={clearError}
            className="ml-3 text-text-muted hover:text-text-secondary transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Responsive table container */}
      <div className="overflow-x-auto bg-bg-card rounded-lg shadow-card border border-border">
        {users.length === 0 ? (
          /* ── Empty state ── */
          <div className="text-center py-12 text-text-secondary">
            <p className="text-lg">No users found</p>
          </div>
        ) : (
          /* ── Users table ── */
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-mono uppercase tracking-wide text-text-muted px-6 py-3">Username</th>
                <th className="text-left text-xs font-mono uppercase tracking-wide text-text-muted px-6 py-3">Role</th>
                <th className="text-left text-xs font-mono uppercase tracking-wide text-text-muted px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId} className="border-b border-border last:border-b-0 hover:bg-bg-hover transition-colors">
                  {/* Username */}
                  <td className="px-6 py-4 text-text-primary font-mono">{user.username}</td>

                  {/* Role badge — green for admin, yellow for pending, muted for user */}
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-gpu-green/20 text-gpu-green'
                        : user.role === 'pending'
                          ? 'bg-gpu-yellow/20 text-gpu-yellow'
                          : 'bg-bg-hover text-text-muted'
                    }`}>
                      {user.role}
                    </span>
                  </td>

                  {/* Role select + Delete button */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.userId, e.target.value)}
                        disabled={updating || deleting}
                        className={`text-sm rounded-md border transition-colors px-2.5 py-1.5 ${
                          updating ? 'bg-bg-input text-text-muted border-border cursor-not-allowed'
                          : 'bg-bg-input text-text-primary border-border focus:border-accent focus:outline-none'
                        }`}
                      >
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                        <option value="pending">Pending</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ userId: user.userId, username: user.username })}
                        disabled={updating || deleting}
                        className="p-1.5 text-text-muted hover:text-danger transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Delete ${user.username}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.496 3.16c.342.052.682.107 1.022.166m-4.595 8.745v.005" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Delete confirmation dialog ─────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={deleteTarget !== null}
          message={`Delete user "${deleteTarget.username}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          loading={deleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
