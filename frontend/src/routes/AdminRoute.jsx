import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  if (user.role !== "admin") {
    if (user.role === "owner") return <Navigate to="/owner/profile" replace />;
    return <Navigate to="/user/profile" replace />;
  }

  return children;
}

