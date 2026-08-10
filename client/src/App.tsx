import { LoaderCircle } from "lucide-react";
import { AppRoutes } from "@/app/routes";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { useSession } from "@/features/auth/useSession";

function AppContent() {
  const { session } = useSession();

  if (!session.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Restoring session
        </div>
      </div>
    );
  }

  return <AppRoutes />;
}

function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}

export default App;
