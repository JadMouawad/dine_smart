import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, registerUser, getCurrentUser, googleAuth } from "../services/authService";
import { useTheme } from "./ThemeContext";

const AuthContext = createContext(null);
const TOKEN_KEY = "token";

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
  sessionStorage.removeItem(TOKEN_KEY);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { applyThemeFromDB } = useTheme();

  async function restoreSession() {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await getCurrentUser();
      const userData = me.user ?? me;
      setUser(userData);
      if (userData.themePreference) applyThemeFromDB(userData.themePreference);
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
    if (data.user?.themePreference) applyThemeFromDB(data.user.themePreference);
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
    if (data.user?.themePreference) applyThemeFromDB(data.user.themePreference);
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
