import { createContext, useContext, useState, useEffect, useRef } from 'react';

import { login as apiLogin, register as apiRegister, getMe, logout as apiLogout } from '../services/authApi';

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derived — simple boolean expression during render (Vercel rule 5.1).
  const isAuthenticated = Boolean(user);

  // Guard against StrictMode double-mount and circular re-fetches.
  const hasCheckedAuthRef = useRef(false);

  // Stable ref so the event listener closure always sees the latest setters.
  const onSessionEndedRef = useRef(null);
  onSessionEndedRef.current = () => {
    setUser(null);
    setIsLoading(false);
  };

  useEffect(() => {
    const handler = () => {
      onSessionEndedRef.current?.();
    };
    window.addEventListener('auth:session-ended', handler);
    return () => window.removeEventListener('auth:session-ended', handler);
  }, []); // Mount-only — ref keeps the callback current.

  const loadUser = async () => {
    if (hasCheckedAuthRef.current) return;
    hasCheckedAuthRef.current = true;

    // Check auth via /me — cookie is sent automatically with credentials: 'include'
    const result = await getMe();
    if (result.error) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setUser(result.data);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadUser();
  }, []); // Mount only.

  /* ------------------------------------------------------------------ */
  /* Public actions                                                      */
  /* ------------------------------------------------------------------ */

  const login = async (username, password) => {
    const result = await apiLogin(username, password);
    if (result.error) return result;

    setUser(result.data.user);
    setIsLoading(false);
    return result;
  };

  const register = async (username, password) => {
    const result = await apiRegister(username, password);
    if (result.error) return result;

    /* First registration sets a cookie and returns user data immediately. */
    if (result.data?.user) {
      setUser(result.data.user);
      setIsLoading(false);
      return result;
    }

    /* Subsequent registrations create a 'pending' account — no session. */
    return { ...result, pending: true };
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  /* Forced logout from the auth:session-ended event (bypasses server call). */
  const forceLogout = () => {
    setUser(null);
    setIsLoading(false);
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, register, logout, forceLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthProvider, AuthContext, useAuth };
