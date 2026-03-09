import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AuthModal from "../../components/AuthModal.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";

export default function AdminAccessPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState("login");

  if (loading) return null;
  if (user?.role === "admin") return <Navigate to="/admin/dashboard" replace />;

  return (
    <AuthModal
      isOpen={true}
      mode={mode}
      forceRole="admin"
      onClose={() => navigate("/", { replace: true })}
      onToggleMode={() => setMode((prev) => (prev === "signup" ? "login" : "signup"))}
    />
  );
}

