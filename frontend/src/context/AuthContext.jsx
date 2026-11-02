import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState({ currency: "INR", theme: "dark" });

  const loadPrefs = useCallback(async () => {
    try {
      const { data } = await api.get("/preferences");
      setPrefs(data);
    } catch { /* ignore */ }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      await loadPrefs();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [loadPrefs]);

  useEffect(() => {
    // If returning from OAuth callback, let AuthCallback establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, prefs, setPrefs, loadPrefs, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
