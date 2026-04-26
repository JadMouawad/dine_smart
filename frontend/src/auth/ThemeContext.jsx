import { createContext, useContext, useEffect, useState } from "react";
import { updateProfile } from "../services/profileService";

const ThemeContext = createContext(null);
const STORAGE_KEY = "ds_theme";
const PRE_AUTH_THEME_KEY = "ds_theme_pre_auth";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || "light";
    // Set synchronously so the attribute is on <html> before the first paint
    document.documentElement.setAttribute("data-theme", stored);
    return stored;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  async function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    // Persist to DB if the user is logged in
    if (localStorage.getItem("token")) {
      try { await updateProfile({ themePreference: next }); } catch { /* silent */ }
      localStorage.removeItem(PRE_AUTH_THEME_KEY);
    } else {
      localStorage.setItem(PRE_AUTH_THEME_KEY, "1");
    }
  }

  // Called by AuthContext after login/session-restore to apply the DB preference
  function applyThemeFromDB(themePreference) {
    if (themePreference === "dark" || themePreference === "light") {
      setTheme(themePreference);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, applyThemeFromDB }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
