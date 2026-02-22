import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, registerUser, getCurrentUser, googleAuth } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function restoreSession() {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await getCurrentUser();
      setUser(me.user ?? me);
    } catch {
      localStorage.removeItem("token");
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

  async function login(email, password) {
    const data = await loginUser({ email, password });
    const newToken = data.token ?? data.accessToken;

    if (!newToken) throw new Error("No token returned from server");

    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(data.user ?? null);
    return data;
  }

  async function register(name, email, password, role) {
    const data = await registerUser({ name, email, password, role });
    const newToken = data.token ?? data.accessToken;

    if (newToken) {
      localStorage.setItem("token", newToken);
      setToken(newToken);
    }

    setUser(data.user ?? null);
    return data;
  }

  async function googleLogin(idToken) {
    const data = await googleAuth({ idToken });
    const newToken = data.token ?? data.accessToken;

    if (!newToken) throw new Error("No token returned from server");

    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(data.user ?? null);
    return data;
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, register, googleLogin, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}