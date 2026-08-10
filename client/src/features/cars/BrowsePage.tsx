import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { CarFront, Heart, MessageSquare, Star } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatMoney, getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import { CAR_TYPES } from "@/features/cars/constants";
import type { Brand, Car } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CarFilters = {
  search: string;
  brandId: string;
  type: string;
  isBookableOnline: string;
};

export function BrowsePage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCarId = searchParams.get("car");
  const [carFilters, setCarFilters] = useState<CarFilters>({
    search: "",
    brandId: "",
    type: "",
    isBookableOnline: "",
  });
  const [bookingDraft, setBookingDraft] = useState({ startDate: "", endDate: "" });
  const [conversationDraft, setConversationDraft] = useState("");

  const brandsQuery = useQuery({
    queryKey: ["brands"],
    queryFn: async () => (await api.listCarBrands()).brands,
  });

  const carsQuery = useQuery({
    queryKey: ["cars", carFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (carFilters.search) params.set("search", carFilters.search);
      if (carFilters.brandId) params.set("brandId", carFilters.brandId);
      if (carFilters.type) params.set("type", carFilters.type);
      if (carFilters.isBookableOnline) params.set("isBookableOnline", carFilters.isBookableOnline);
      params.set("page", "1");
      params.set("limit", "12");
      return api.listCars(params);
    },
  });

  const favoritesQuery = useQuery({
    queryKey: ["favorites", session.user?.id],
    queryFn: async () => (await api.listFavorites(session.token!)).favorites,
    enabled: Boolean(session.token && session.user?.role === "USER"),
  });

  const conversationsQuery = useQuery({
    queryKey: ["conversations", session.user?.role, session.user?.id, session.user?.shop?.id],
    queryFn: async () => (await api.listConversations(session.token!, session.user!.role)).conversations,
    enabled: Boolean(session.token && session.user && session.user.role !== "SUPERADMIN"),
  });

  const favoriteMutation = useMutation({
    mutationFn: async (carId: string) => {
      const favoriteIds = new Set((favoritesQuery.data ?? []).map((favorite) => favorite.carId));
      if (favoriteIds.has(carId)) {
        await api.removeFavorite(session.token!, carId);
      } else {
        await api.addFavorite(session.token!, carId);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCarId) throw new Error("Choose a car first");
      return api.createBooking(session.token!, {
        carId: selectedCarId,
        startDate: `${bookingDraft.startDate}T10:00:00.000Z`,
        endDate: `${bookingDraft.endDate}T10:00:00.000Z`,
      });
    },
    onSuccess: () => {
      setBookingDraft({ startDate: "", endDate: "" });
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async (shopId: string) => {
      return api.createConversation(session.token!, {
        shopId,
        body: conversationDraft,
      });
    },
    onSuccess: () => {
      setConversationDraft("");
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const selectCar = useCallback(
    (carId: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("car", carId);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!selectedCarId && carsQuery.data?.items[0]?.id) {
      selectCar(carsQuery.data.items[0].id);
    }
  }, [carsQuery.data, selectedCarId, selectCar]);

  const selectedCar =
    carsQuery.data?.items.find((car) => car.id === selectedCarId) ??
    favoritesQuery.data?.find((favorite) => favorite.car.id === selectedCarId)?.car ??
    null;

  const favoriteIds = new Set((favoritesQuery.data ?? []).map((favorite) => favorite.carId));
  const canBook = session.user?.role === "USER";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Browse available cars</CardTitle>
            <CardDescription>Public browsing is open to everyone. Booking and messaging appear after login.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="Search by model"
                value={carFilters.search}
                onChange={(event) => setCarFilters({ ...carFilters, search: event.target.value })}
              />
              <Select
                value={carFilters.brandId}
                onChange={(event) => setCarFilters({ ...carFilters, brandId: event.target.value })}
              >
                <option value="">All brands</option>
                {(brandsQuery.data ?? []).map((brand: Brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </Select>
              <Select value={carFilters.type} onChange={(event) => setCarFilters({ ...carFilters, type: event.target.value })}>
                <option value="">All types</option>
                {CAR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <Select
                value={carFilters.isBookableOnline}
                onChange={(event) =>
                  setCarFilters({ ...carFilters, isBookableOnline: event.target.value })
                }
              >
                <option value="">All availability</option>
                <option value="true">Online bookable</option>
                <option value="false">Inquiry only</option>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(carsQuery.data?.items ?? []).map((car: Car) => (
                <button
                  key={car.id}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    selectedCarId === car.id ? "border-foreground bg-accent" : "border-border hover:bg-accent/50",
                  )}
                  onClick={() => selectCar(car.id)}
                >
                  <div className="mb-3 aspect-[4/3] overflow-hidden rounded-lg border bg-secondary">
                    {car.images[0]?.url ? (
                      <img src={car.images[0].url} alt={car.model} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {car.brand.name} {car.model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {car.type} • {car.year}
                      </p>
                    </div>
                    <Badge variant={car.isBookableOnline ? "default" : "outline"}>
                      {car.isBookableOnline ? "Book online" : "Inquiry"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{car.shop.name}</span>
                    <span className="font-medium">{formatMoney(car.pricePerDay)}/day</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedCar ? `${selectedCar.brand.name} ${selectedCar.model}` : "Choose a car"}</CardTitle>
            <CardDescription>
              {selectedCar
                ? `${selectedCar.shop.name} • ${selectedCar.type} • minimum ${selectedCar.minRentalDays} day rental`
                : "Select a car from the list to view details and actions."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedCar ? (
              <>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Price per day</span>
                    <span>{formatMoney(selectedCar.pricePerDay)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Extra fees</span>
                    <span>{selectedCar.extraFees ? formatMoney(selectedCar.extraFees) : "None"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Online booking</span>
                    <span>{selectedCar.isBookableOnline ? "Enabled" : "Unavailable"}</span>
                  </div>
                </div>

                {selectedCar.description && (
                  <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                    {selectedCar.description}
                  </div>
                )}

                {session.user?.role === "USER" && (
                  <div className="space-y-3">
                    <Button
                      variant={favoriteIds.has(selectedCar.id) ? "secondary" : "outline"}
                      className="w-full"
                      onClick={() => favoriteMutation.mutate(selectedCar.id)}
                      disabled={favoriteMutation.isPending}
                    >
                      <Heart className="mr-2 h-4 w-4" />
                      {favoriteIds.has(selectedCar.id) ? "Remove favorite" : "Save favorite"}
                    </Button>

                    {selectedCar.isBookableOnline && canBook && (
                      <div className="space-y-3 rounded-lg border border-border p-4">
                        <p className="text-sm font-medium">Create booking</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="startDate">Start date</Label>
                            <Input
                              id="startDate"
                              type="date"
                              value={bookingDraft.startDate}
                              onChange={(event) =>
                                setBookingDraft({ ...bookingDraft, startDate: event.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="endDate">End date</Label>
                            <Input
                              id="endDate"
                              type="date"
                              value={bookingDraft.endDate}
                              onChange={(event) =>
                                setBookingDraft({ ...bookingDraft, endDate: event.target.value })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => bookingMutation.mutate()}
                          disabled={bookingMutation.isPending || !bookingDraft.startDate || !bookingDraft.endDate}
                        >
                          Book this car
                        </Button>
                        {bookingMutation.error && (
                          <p className="text-sm text-destructive">{getApiMessage(bookingMutation.error)}</p>
                        )}
                      </div>
                    )}

                    <div className="space-y-3 rounded-lg border border-border p-4">
                      <p className="text-sm font-medium">Message the shop</p>
                      <Textarea
                        value={conversationDraft}
                        onChange={(event) => setConversationDraft(event.target.value)}
                        placeholder="Ask about pickup time, availability, or fees."
                      />
                      <Button
                        className="w-full"
                        onClick={() => createConversationMutation.mutate(selectedCar.shop.id)}
                        disabled={createConversationMutation.isPending || !conversationDraft.trim()}
                      >
                        Start conversation
                      </Button>
                      {createConversationMutation.error && (
                        <p className="text-sm text-destructive">{getApiMessage(createConversationMutation.error)}</p>
                      )}
                    </div>
                  </div>
                )}

                {!session.user && (
                  <p className="text-sm text-muted-foreground">
                    Log in to save favorites, place a booking, or contact this shop.
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                No car selected yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CarFront className="h-4 w-4" />
              Live inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{carsQuery.data?.meta.total ?? 0}</p>
            <p className="text-sm text-muted-foreground">Public cars currently returned by the API.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4" />
              Saved favorites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{favoritesQuery.data?.length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Visible once you log in as a user.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{conversationsQuery.data?.length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Shared inbox for renters and shop admins.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
