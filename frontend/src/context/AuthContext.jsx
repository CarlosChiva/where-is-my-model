import { createContext, useContext, useState, useEffect, useRef } from 'react';

import { login as apiLogin, register as apiRegister, getMe } from '../services/authApi';

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derived — simple boolean expression during render (Vercel rule 5.1).
  const isAuthenticated = Boolean(user);

  // Guard against StrictMode double-mount and circular re-fetches.
  const hasCheckedAuthRef = useRef(false);

  const loadUser = async () => {
    if (hasCheckedAuthRef.current) return;
    hasCheckedAuthRef.current = true;

    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    const result = await getMe();
    if (result.error) {
      // Token is stale or revoked — silent logout.
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
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

    const { token: newToken, user: newUser } = result.data;
    localStorage.setItem('token', newToken);
    setUser(newUser);
    setToken(newToken);
    setIsLoading(false);
    return result;
  };

  const register = async (username, password) => {
    const result = await apiRegister(username, password);
    if (result.error) return result;

    /* First registration returns a token and logs the user in immediately.*/
    if (result.data?.token) {
      const newToken = result.data.token;
      localStorage.setItem('token', newToken);
      setUser(result.data.user);
      setToken(newToken);
      setIsLoading(false);
      return result;
    }

    /* Subsequent registrations create a 'pending' account — no token. */
    return { ...result, pending: true };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, login, register, logout }}>
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
