import { Navigate } from "react-router";
import { AuthPanel } from "@/features/auth/AuthPanel";
import { useSession } from "@/features/auth/useSession";

export function AuthPage() {
  const { session } = useSession();

  if (session.user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-center">
        <section className="flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Car Rental Platform</p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Sign in before entering the rental workspace
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Access bookings, saved cars, inventory, and conversations from one account.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">Customer accounts</p>
              <p className="mt-2 text-sm text-muted-foreground">Track bookings, save favorites, and contact rental shops.</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">Shop admins</p>
              <p className="mt-2 text-sm text-muted-foreground">Manage live inventory, booking requests, and customer messages.</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">Single workspace</p>
              <p className="mt-2 text-sm text-muted-foreground">Everything opens after authentication, with no public dashboard shown first.</p>
            </div>
          </div>
        </section>

        <section className="w-full">
          <AuthPanel />
        </section>
      </div>
    </div>
  );
}
