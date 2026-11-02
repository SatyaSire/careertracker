import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TrendingUp } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, loadPrefs } = useAuth();
  const processed = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;
    if (!sessionId) { navigate("/login"); return; }

    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sessionId });
        setUser(data);
        await loadPrefs();
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { state: { user: data } });
      } catch (e) {
        setError(e?.response?.data?.detail || "Sign-in failed. Please try again.");
        setTimeout(() => navigate("/login"), 2500);
      }
    })();
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 rounded-xl bg-primary grid place-items-center mx-auto animate-pulse">
          <TrendingUp className="h-7 w-7 text-white" />
        </div>
        {error ? (
          <p className="text-sm text-destructive max-w-xs">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
