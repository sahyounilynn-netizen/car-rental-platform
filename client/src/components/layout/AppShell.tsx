import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/features/auth/useSession";
import { AuthPanel } from "@/features/auth/AuthPanel";
import { Sidebar } from "@/components/layout/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AppShell() {
  const { session, clearSession } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (session.token) {
        await api.logout(session.token);
      }
    },
    onSettled: () => {
      clearSession();
      queryClient.clear();
      navigate("/");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Car Rental Platform</p>
            <h1 className="text-xl font-semibold">Simple booking, favorites, and shop management</h1>
          </div>
          <div className="flex items-center gap-3">
            {session.user ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.user.role === "ADMIN" && session.user.shop
                      ? `${session.user.shop.name} admin`
                      : session.user.email}
                  </p>
                </div>
                <Button variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <Badge variant="outline">Guest</Badge>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace</CardTitle>
              <CardDescription>Minimal shadcn-style interface with direct access to the live API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Sidebar />
            </CardContent>
          </Card>

          {!session.user && <AuthPanel />}
        </aside>

        <main className="space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
