import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { lightTheme, darkTheme } from '../constants/theme';

const STORAGE_KEY = 'ft_theme_mode';

// mode: 'system' (follow the OS) | 'light' | 'dark'
// theme: the active palette object (same shape as the legacy `C`)
// resolved: 'light' | 'dark' after applying the system setting
const ThemeContext = createContext({
  theme: lightTheme,
  mode: 'system',
  resolved: 'light',
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const system = useColorScheme();            // 'light' | 'dark' | null
  const [mode, setModeState] = useState('system'); // default: follow the phone

  // Restore a saved preference (if the user picked one) on first mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (alive && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setModeState(saved);
        }
      } catch { /* keep default */ }
    })();
    return () => { alive = false; };
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  }, []);

  const resolved = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const theme = resolved === 'dark' ? darkTheme : lightTheme;

  const value = useMemo(
    () => ({ theme, mode, resolved, setMode }),
    [theme, mode, resolved, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      {/* Status-bar icons flip with the theme so they never vanish into the background. */}
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

// Drop-in replacement for the old import: `const C = useTheme();`
export function useTheme() {
  return useContext(ThemeContext).theme;
}

// For the settings toggle: current mode, resolved scheme, and a setter.
export function useThemeMode() {
  const { mode, resolved, setMode } = useContext(ThemeContext);
  return { mode, resolved, setMode };
}

export default ThemeProvider;
