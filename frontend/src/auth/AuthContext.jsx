import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, registerUser, getCurrentUser } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await getCurrentUser();
      setUser(me.user ?? me); // supports either {user: {...}} or just {...}
    } catch (e) {
      // token invalid/expired -> log out
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function login(email, password) {
    const data = await loginUser({ email, password });
    const newToken = data.token;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(data.user ?? null);
    return data;
  }

  async function register(name, email, password) {
    const data = await registerUser({ name, email, password });
    const newToken = data.token;
    if (newToken) {
      localStorage.setItem("token", newToken);
      setToken(newToken);
    }
    setUser(data.user ?? null);
    return data;
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}