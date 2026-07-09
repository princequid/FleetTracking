import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Preference is one of: "light" | "dark" | "system".
// "system" follows the OS setting live via prefers-color-scheme.
const STORAGE_KEY = "ft-admin-theme";
const ThemeContext = createContext(null);

function getSystemTheme() {
  return typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolvePreference(pref) {
  return pref === "system" ? getSystemTheme() : pref;
}

function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* localStorage unavailable — fall through */
  }
  return "system";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolvePreference(theme));

  // Push the resolved theme onto <html> so all CSS tokens flip.
  const apply = useCallback((pref) => {
    const resolved = resolvePreference(pref);
    const el = document.documentElement;
    el.setAttribute("data-theme", resolved);
    el.style.colorScheme = resolved;
    setResolvedTheme(resolved);
  }, []);

  // Apply on mount and whenever the preference changes; persist the choice.
  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore persistence failures */
    }
  }, [theme, apply]);

  // While on "system", react to OS theme changes in real time.
  useEffect(() => {
    if (theme !== "system" || !window.matchMedia) return undefined;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange); // Safari < 14
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [theme, apply]);

  const setTheme = useCallback((next) => {
    // Briefly enable a color cross-fade so the switch feels smooth, not abrupt.
    const el = document.documentElement;
    el.classList.add("theme-transition");
    window.setTimeout(() => el.classList.remove("theme-transition"), 320);
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
