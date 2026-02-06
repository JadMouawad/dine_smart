import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null; // later: spinner

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}