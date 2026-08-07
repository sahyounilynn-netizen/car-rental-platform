import { useQuery } from "@tanstack/react-query";

function useApiHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("API unreachable");
      return (await res.json()) as { status: string };
    },
    retry: false,
  });
}

function App() {
  const { data, isLoading, isError } = useApiHealth();

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">Car Rental Platform</h1>
      <p className="text-muted-foreground">
        Scaffolding phase — feature UI is built out phase by phase.
      </p>
      <p className="text-sm">
        API status: {isLoading ? "checking…" : isError ? "unreachable" : data?.status}
      </p>
    </div>
  );
}

export default App;
