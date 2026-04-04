import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, registerUser, getCurrentUser, googleAuth } from "../services/authService";
import { updateProfile } from "../services/profileService";
import { useTheme } from "./ThemeContext";

const AuthContext = createContext(null);
const TOKEN_KEY = "token";
const LAST_ACTIVE_KEY = "last_active_at";
const PRE_AUTH_THEME_KEY = "ds_theme_pre_auth";
const SESSION_MAX_AWAY_MS = 3 * 60 * 60 * 1000; // 3 hours away from the site

function readStoredToken() {
  const localToken = localStorage.getItem(TOKEN_KEY);
  if (localToken) return localToken;

  // Backward compatibility for older builds that used sessionStorage.
  const legacySessionToken = sessionStorage.getItem(TOKEN_KEY);
  if (legacySessionToken) {
    localStorage.setItem(TOKEN_KEY, legacySessionToken);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  return legacySessionToken;
}

function persistToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  sessionStorage.removeItem(TOKEN_KEY);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

function isSessionExpiredByAwayTime() {
  const lastActiveRaw = localStorage.getItem(LAST_ACTIVE_KEY);
  const lastActive = lastActiveRaw ? Number(lastActiveRaw) : NaN;
  if (!Number.isFinite(lastActive)) return true; // no activity -> force login
  return Date.now() - lastActive > SESSION_MAX_AWAY_MS;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { applyThemeFromDB, theme } = useTheme();

  function hasPreAuthTheme() {
    return localStorage.getItem(PRE_AUTH_THEME_KEY) === "1";
  }

  function clearPreAuthTheme() {
    localStorage.removeItem(PRE_AUTH_THEME_KEY);
  }

  async function restoreSession() {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    if (isSessionExpiredByAwayTime()) {
      clearToken();
      setToken(null);
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await getCurrentUser();
      const userData = me.user ?? me;
      setUser(userData);
      if (hasPreAuthTheme()) {
        try { await updateProfile({ themePreference: theme }); } catch { /* silent */ }
        clearPreAuthTheme();
      } else if (userData.themePreference) {
        applyThemeFromDB(userData.themePreference);
      }
    } catch {
      clearToken();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    restoreSession();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const markActive = () => {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    };

    const handleFocus = () => {
      // If user returns after being away too long, log them out.
      if (isSessionExpiredByAwayTime()) {
        clearToken();
        setToken(null);
        setUser(null);
        return;
      }
      markActive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markActive();
      } else {
        handleFocus();
      }
    };

    const handleActivity = () => {
      if (document.visibilityState !== "visible") return;
      markActive();
    };

    // Initial activity mark
    markActive();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [token]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== TOKEN_KEY) return;
      const nextToken = readStoredToken();
      setToken((prev) => (prev === nextToken ? prev : nextToken));
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  async function login(email, password) {
    const data = await loginUser({ email, password });
    const newToken = data.token ?? data.accessToken;

    if (!newToken) throw new Error("No token returned from server");

    persistToken(newToken);
    setToken(newToken);
    setUser(data.user ?? null);
    if (hasPreAuthTheme()) {
      try { await updateProfile({ themePreference: theme }); } catch { /* silent */ }
      clearPreAuthTheme();
    } else if (data.user?.themePreference) {
      applyThemeFromDB(data.user.themePreference);
    }
    return data;
  }

  async function register(name, email, password, role, location = {}) {
    const data = await registerUser({
      name,
      email,
      password,
      role,
      latitude: location.latitude,
      longitude: location.longitude,
      phone: location.phone,
      adminSignupKey: location.adminSignupKey,
    });
    const newToken = data.token ?? data.accessToken;

    if (newToken) {
      persistToken(newToken);
      setToken(newToken);
    }

    setUser(data.user ?? null);
    return data;
  }

  async function googleLogin(idToken, role) {
    const data = await googleAuth({ idToken, role });
    const newToken = data.token ?? data.accessToken;

    if (!newToken) throw new Error("No token returned from server");

    persistToken(newToken);
    setToken(newToken);
    setUser(data.user ?? null);
    if (hasPreAuthTheme()) {
      try { await updateProfile({ themePreference: theme }); } catch { /* silent */ }
      clearPreAuthTheme();
    } else if (data.user?.themePreference) {
      applyThemeFromDB(data.user.themePreference);
    }
    return data;
  }

  function logout() {
    clearToken();
    setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    try {
      const me = await getCurrentUser();
      const userData = me.user ?? me;
      setUser(userData);
    } catch (err) {
      console.warn("[AuthContext] refreshUser failed:", err?.message);
      // user stays as-is; not a critical failure
    }
  }

  const value = useMemo(
    () => ({ user, loading, login, register, googleLogin, logout, refreshUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
