import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();   // ✅ get user from AuthProvider
  const location = useLocation();

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}
