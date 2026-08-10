import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import type { Favorite } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FavoritesPage() {
  const { session } = useSession();
  const navigate = useNavigate();

  const favoritesQuery = useQuery({
    queryKey: ["favorites", session.user?.id],
    queryFn: async () => (await api.listFavorites(session.token!)).favorites,
    enabled: Boolean(session.token && session.user?.role === "USER"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved favorites</CardTitle>
        <CardDescription>Quick access to the cars you want to compare later.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(favoritesQuery.data ?? []).map((favorite: Favorite) => (
          <div key={favorite.carId} className="rounded-xl border border-border p-4">
            <p className="font-medium">
              {favorite.car.brand.name} {favorite.car.model}
            </p>
            <p className="text-sm text-muted-foreground">{favorite.car.shop.name}</p>
            <p className="mt-3 text-sm">{formatMoney(favorite.car.pricePerDay)}/day</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/?car=${favorite.car.id}`)}>
                View
              </Button>
              <Button size="sm" onClick={() => navigate("/")}>
                Open in browse
              </Button>
            </div>
          </div>
        ))}
        {!favoritesQuery.data?.length && (
          <p className="text-sm text-muted-foreground">You have not saved any cars yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
