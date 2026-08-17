import { Navigate, Outlet } from "react-router";
import { useSession } from "@/features/auth/useSession";

export function ProtectedRoute() {
  const { session } = useSession();

  if (!session.user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
