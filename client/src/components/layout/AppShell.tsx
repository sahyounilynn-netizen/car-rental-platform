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
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="page-shell flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between lg:py-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Car Rental Platform</p>
            <h1 className="max-w-3xl text-[1.65rem] font-bold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[1.85rem] lg:text-[2rem]">
              {workspaceTitle}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:text-right">
              <p className="text-sm font-semibold text-foreground">{session.user?.name}</p>
              <p className="max-w-[240px] break-words text-xs text-muted-foreground sm:max-w-[280px]">
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

      <div className="page-shell grid items-start gap-6 pt-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          <Card className="overflow-hidden border-slate-800 bg-[color:var(--sidebar)] text-[color:var(--sidebar-foreground)] shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
            <CardHeader>
              <CardTitle className="text-base text-white">Navigation</CardTitle>
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

        <main className="min-w-0 space-y-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
