import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Heart } from "lucide-react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import type { Favorite } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";

export function FavoritesPage() {
  const { session } = useSession();
  const navigate = useNavigate();

  const favoritesQuery = useQuery({
    queryKey: ["favorites", session.user?.id],
    queryFn: async () => (await api.listFavorites(session.token!)).favorites,
    enabled: Boolean(session.token && session.user?.role === "USER"),
  });

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Saved"
        title="Favorites"
        description="Quick access to the cars you want to compare or revisit later."
      />
      <Card>
        <CardHeader>
          <CardTitle>Saved cars</CardTitle>
          <CardDescription>Your shortlist stays here so you can jump back into browsing whenever you need.</CardDescription>
        </CardHeader>
        <CardContent className="content-card-grid">
          {(favoritesQuery.data ?? []).map((favorite: Favorite) => (
            <div key={favorite.carId} className="content-card panel-soft rounded-2xl p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Heart className="h-5 w-5" />
              </div>
              <p className="text-wrap-safe text-lg font-semibold tracking-[-0.02em] text-foreground">
                {favorite.car.brand.name} {favorite.car.model}
              </p>
              <p className="text-wrap-safe mt-1 text-sm text-muted-foreground">{favorite.car.shop.name}</p>
              <p className="mt-4 text-sm font-semibold text-foreground">{formatMoney(favorite.car.pricePerDay)}/day</p>
              <div className="mt-5 flex flex-wrap gap-2">
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
            <div className="empty-state md:col-span-2 xl:col-span-3">
              <Heart className="mb-3 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">No favorites yet</p>
              <p className="mt-1 text-sm text-muted-foreground">You have not saved any cars yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
