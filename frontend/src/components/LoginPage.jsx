import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register, isLoading } = useAuth();

  /*
   * No redirect effect needed. App.jsx manages the authenticated guard: when a
   * successful login flips isAuthenticated to true, the <App> guard rerenders
   * and automatically transitions from <LoginPage /> back to the dashboard.
   */

  /* ── Local state ────────────────────────────────────────────── */
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);

  /* ── Validation ─────────────────────────────────────────────── */
  const validate = () => {
    const errors = {};
    if (!username.trim()) errors.username = 'Username is required.';
    if (!password)       errors.password = 'Password is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ── Submit handler ─────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    const action = mode === 'login' ? login : register;
    const result = await action(username.trim(), password);

    if (result.error) {
      setApiError(result.error);
    }
    /* On success: isLoading flips, isAuthenticated flips, redirect fires in useEffect */
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      {/* ── Card ─────────────────────────────────────────────── */}
      <div className="w-full max-w-md bg-bg-card rounded-lg shadow-card border border-border p-6 lg:p-8">

        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Where Is My Model
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Manage your GPU infrastructure with confidence.
          </p>
        </div>

        {/* ── Tabs ───────────────────────────────────────────── */}
        <div className="flex rounded-md overflow-hidden mb-6 border border-border">
          {['login', 'register'].map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mode === tab}
              onClick={() => { setMode(tab); setApiError(null); setFieldErrors({}); }}
              className={`flex-1 text-sm font-medium py-2 transition-colors ${
                mode === tab
                  ? 'bg-accent text-bg-primary'
                  : 'bg-bg-input text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        {/* ── Form ───────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="mb-4">
            <label
              className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2"
              htmlFor="username"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your-username"
              aria-invalid={!!fieldErrors.username}
              className={`w-full bg-bg-input border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted ${
                fieldErrors.username
                  ? 'border-danger focus:border-danger'
                  : 'border-border focus:border-accent'
              }`}
            />
            {fieldErrors.username && (
              <p className="mt-1 text-sm text-danger">{fieldErrors.username}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-6">
            <label
              className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2"
              htmlFor="password"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              aria-invalid={!!fieldErrors.password}
              className={`w-full bg-bg-input border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted ${
                fieldErrors.password
                  ? 'border-danger focus:border-danger'
                  : 'border-border focus:border-accent'
              }`}
            />
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-danger">{fieldErrors.password}</p>
            )}
          </div>

          {/* API Error */}
          {apiError && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-md">
              <p className="text-sm text-danger">{apiError}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent text-bg-primary font-semibold px-4 py-2.5 rounded-md shadow-btn-primary hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {isLoading
              ? (mode === 'login' ? 'Iniciando...' : 'Registrando...')
              : (mode === 'login' ? 'Iniciar sesión' : 'Registrarse')}
          </button>
        </form>
      </div>
    </div>
  );
}
