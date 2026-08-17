import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/features/auth/useSession";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AppShell() {
  const { session, clearSession } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const workspaceTitle =
    session.user?.role === "SUPERADMIN"
      ? "Oversee the full platform, accounts, and shops"
      : session.user?.role === "ADMIN"
      ? "Manage your fleet, bookings, and customer messages"
      : "Browse cars, track bookings, and message rental shops";

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (session.token) {
        await api.logout(session.token);
      }
    },
    onSettled: () => {
      clearSession();
      queryClient.clear();
      navigate("/auth");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Car Rental Platform</p>
            <h1 className="text-xl font-semibold">{workspaceTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{session.user?.name}</p>
              <p className="text-xs text-muted-foreground">
                {session.user?.role === "ADMIN" && session.user.shop
                  ? `${session.user.shop.name} admin`
                  : session.user?.role === "SUPERADMIN"
                    ? "Platform SuperAdmin"
                    : session.user?.email}
              </p>
            </div>
            <Button variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Navigation</CardTitle>
              <CardDescription>
                {session.user?.role === "SUPERADMIN"
                  ? "Use the dashboard to monitor the platform and manage tenant access."
                  : "Use the sections below to browse cars and manage your account."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Sidebar />
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
