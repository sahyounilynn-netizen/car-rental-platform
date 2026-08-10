import { Navigate, Outlet } from "react-router";
import { useSession } from "@/features/auth/useSession";
import type { Role } from "@/types";

export function RoleRoute({ allow }: { allow: Role[] }) {
  const { session } = useSession();

  if (!session.user || !allow.includes(session.user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
