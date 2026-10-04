import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME = 'dark';

const ThemeContext = createContext(null);

/*
 * The inline script in index.html already wrote a valid data-theme attribute
 * before React mounts; we read it as the source of truth.
 */
function readInitialTheme() {
  try {
    const value = document.documentElement.getAttribute('data-theme');
    if (value === 'light' || value === 'dark') return value;
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(theme) {
  try {
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    /* noop — attribute write is best-effort */
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* noop — storage may be unavailable (private mode, etc.) */
  }
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Side effects live in the effect (idempotent ops), not in the updater —
  // safe under StrictMode double-invocation.
  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { ThemeProvider, ThemeContext, useTheme };
