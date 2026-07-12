import useUsers from '../hooks/useUsers.js';
import useUpdateUserRole from '../hooks/useUpdateUserRole.js';

export default function AdminPanel() {
  const { data: users, loading, error: fetchError, refetch } = useUsers();
  const { loading: updating, error: updateError, mutate, clearError } = useUpdateUserRole({ onSuccess: refetch });

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

  /* ── Toggle handler — flips 'admin' <-> 'user' ── */
  const handleToggle = (userId, currentRole) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    mutate(userId, nextRole);
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
                <th className="text-left text-xs font-mono uppercase tracking-wide text-text-muted px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId} className="border-b border-border last:border-b-0 hover:bg-bg-hover transition-colors">
                  {/* Username */}
                  <td className="px-6 py-4 text-text-primary font-mono">{user.username}</td>

                  {/* Role badge — green pill for admin, muted pill for user */}
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-gpu-green/20 text-gpu-green'
                        : 'bg-bg-hover text-text-muted'
                    }`}>
                      {user.role}
                    </span>
                  </td>

                  {/* Toggle button */}
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleToggle(user.userId, user.role)}
                      disabled={updating}
                      className={`text-sm font-medium px-3.5 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        user.role === 'admin'
                          ? 'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30'
                          : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/30'
                      }`}
                    >
                      {user.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
