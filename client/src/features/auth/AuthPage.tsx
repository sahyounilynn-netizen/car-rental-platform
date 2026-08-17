import { Navigate } from "react-router";
import { CarFront, ShieldCheck, Users } from "lucide-react";
import { AuthPanel } from "@/features/auth/AuthPanel";
import { useSession } from "@/features/auth/useSession";

export function AuthPage() {
  const { session } = useSession();

  if (session.user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-[1280px] gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1.1fr)_460px] lg:items-center lg:px-8">
        <section className="flex flex-col justify-center space-y-8">
          <div className="space-y-4">
            <p className="page-intro-eyebrow">Car Rental Platform</p>
            <h1 className="max-w-2xl text-[1.8rem] font-bold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[2rem] lg:text-[2.25rem]">
              Trusted workspace access for customers, shop teams, and platform admins
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-muted-foreground sm:text-base">
              Sign in to manage bookings, monitor availability, respond to customers, and keep rental operations organized from one polished dashboard.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="panel-soft rounded-2xl p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-[15px] font-semibold text-foreground">Customer accounts</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Track bookings, save favorites, and contact rental shops.</p>
            </div>
            <div className="panel-soft rounded-2xl p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <CarFront className="h-5 w-5" />
              </div>
              <p className="text-[15px] font-semibold text-foreground">Shop admins</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Manage live inventory, booking requests, and customer messages.</p>
            </div>
            <div className="panel-soft rounded-2xl p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-[15px] font-semibold text-foreground">Single workspace</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Everything opens after authentication, with no public dashboard shown first.</p>
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
