import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router";
import { CarFront, Heart, MessageSquare, Star } from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatMoney, getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import { CAR_TYPES } from "@/features/cars/constants";
import type { Brand, Car } from "@/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageIntro } from "@/components/ui/page-intro";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";

type CarFilters = {
  search: string;
  brandId: string;
  type: string;
  isBookableOnline: string;
};

const bookingFormSchema = z
  .object({
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be after startDate",
      });
    }
  });

type BookingFormValues = z.infer<typeof bookingFormSchema>;

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
  const [conversationDraft, setConversationDraft] = useState("");
  const [failedImageIds, setFailedImageIds] = useState<Record<string, true>>({});
  const [selectedImageFailed, setSelectedImageFailed] = useState(false);
  const bookingForm = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { startDate: "", endDate: "" },
  });

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
    mutationFn: async (values: BookingFormValues) => {
      if (!selectedCarId) throw new Error("Choose a car first");
      return api.createBooking(session.token!, {
        carId: selectedCarId,
        startDate: `${values.startDate}T10:00:00.000Z`,
        endDate: `${values.endDate}T10:00:00.000Z`,
      });
    },
    onSuccess: () => {
      bookingForm.reset({ startDate: "", endDate: "" });
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });

  function onSubmitBooking(values: BookingFormValues) {
    bookingMutation.mutate(values);
  }

  const createConversationMutation = useMutation({
    mutationFn: async (shopId: string) =>
      api.createConversation(session.token!, {
        shopId,
        body: conversationDraft,
      }),
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

  useEffect(() => {
    setSelectedImageFailed(false);
  }, [selectedCarId]);

  const selectedCar =
    carsQuery.data?.items.find((car) => car.id === selectedCarId) ??
    favoritesQuery.data?.find((favorite) => favorite.car.id === selectedCarId)?.car ??
    null;

  const favoriteIds = new Set((favoritesQuery.data ?? []).map((favorite) => favorite.carId));
  const canBook = session.user?.role === "USER";

  function hasUsableImage(car: Car) {
    return Boolean(car.images[0]?.url) && !failedImageIds[car.id];
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Marketplace"
        title="Browse available cars"
        description="Explore active rental inventory, compare pricing, and open booking or messaging actions when your account allows it."
      />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Available inventory</CardTitle>
            <CardDescription>Public browsing is open to everyone. Booking and messaging appear after login.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                placeholder="Search by model"
                value={carFilters.search}
                onChange={(event) => setCarFilters({ ...carFilters, search: event.target.value })}
              />
              <Select value={carFilters.brandId} onChange={(event) => setCarFilters({ ...carFilters, brandId: event.target.value })}>
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
                onChange={(event) => setCarFilters({ ...carFilters, isBookableOnline: event.target.value })}
              >
                <option value="">All availability</option>
                <option value="true">Online bookable</option>
                <option value="false">Inquiry only</option>
              </Select>
            </div>

            <div className="grid auto-rows-fr gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {(carsQuery.data?.items ?? []).map((car: Car) => (
                <button
                  key={car.id}
                  className={cn(
                    "transition-soft min-w-0 overflow-hidden rounded-2xl border bg-card text-left",
                    selectedCarId === car.id
                      ? "border-blue-200 ring-2 ring-blue-100"
                      : "border-border hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_18px_rgba(15,23,42,0.06)]",
                  )}
                  onClick={() => selectCar(car.id)}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    {hasUsableImage(car) ? (
                      <img
                        src={car.images[0]!.url}
                        alt={`${car.brand.name} ${car.model}`}
                        className="h-full w-full object-cover"
                        onError={() => {
                          setFailedImageIds((current) => ({ ...current, [car.id]: true }));
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-100 px-4 text-sm text-muted-foreground">
                        No image available
                      </div>
                    )}
                  </div>
                  <div className="flex h-full flex-col space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-semibold leading-6 tracking-[-0.02em] text-foreground">
                          {car.brand.name} {car.model}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {car.type} • {car.year}
                        </p>
                      </div>
                      <StatusBadge status={car.isBookableOnline ? "CONFIRMED" : "INACTIVE"} />
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 break-words text-muted-foreground">{car.shop.name}</span>
                      <span className="shrink-0 font-semibold text-foreground">{formatMoney(car.pricePerDay)}/day</span>
                    </div>
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
                <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                  {selectedCar.images[0]?.url && !selectedImageFailed ? (
                    <img
                      src={selectedCar.images[0].url}
                      alt={`${selectedCar.brand.name} ${selectedCar.model}`}
                      className="h-full w-full object-cover"
                      onError={() => setSelectedImageFailed(true)}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-100 px-4 text-sm text-muted-foreground">
                      No image available
                    </div>
                  )}
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="surface-muted rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Price per day</p>
                    <p className="mt-1 font-semibold text-foreground">{formatMoney(selectedCar.pricePerDay)}</p>
                  </div>
                  <div className="surface-muted rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Extra fees</p>
                    <p className="mt-1 font-semibold text-foreground">
                      {selectedCar.extraFees ? formatMoney(selectedCar.extraFees) : "None"}
                    </p>
                  </div>
                  <div className="surface-muted rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Availability</p>
                    <div className="mt-1">
                      <StatusBadge status={selectedCar.status} />
                    </div>
                  </div>
                  <div className="surface-muted rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Online booking</p>
                    <p className="mt-1 font-semibold text-foreground">
                      {selectedCar.isBookableOnline ? "Enabled" : "Unavailable"}
                    </p>
                  </div>
                </div>

                {selectedCar.description ? (
                  <div className="surface-muted rounded-2xl p-4 text-sm leading-6 text-slate-700">{selectedCar.description}</div>
                ) : null}

                {session.user?.role === "USER" ? (
                  <div className="space-y-4">
                    <Button
                      variant={favoriteIds.has(selectedCar.id) ? "secondary" : "outline"}
                      className="w-full"
                      onClick={() => favoriteMutation.mutate(selectedCar.id)}
                      disabled={favoriteMutation.isPending}
                    >
                      <Heart className="mr-2 h-4 w-4" />
                      {favoriteIds.has(selectedCar.id) ? "Remove favorite" : "Save favorite"}
                    </Button>

                    {selectedCar.isBookableOnline && canBook ? (
                      <div className="surface-muted space-y-4 rounded-2xl p-4">
                        <p className="text-sm font-semibold text-foreground">Create booking</p>
                        <form onSubmit={bookingForm.handleSubmit(onSubmitBooking)} className="space-y-3" noValidate>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="startDate">Start date</Label>
                              <Input id="startDate" type="date" {...bookingForm.register("startDate")} />
                              {bookingForm.formState.errors.startDate ? (
                                <p className="text-sm text-destructive">{bookingForm.formState.errors.startDate.message}</p>
                              ) : null}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="endDate">End date</Label>
                              <Input id="endDate" type="date" {...bookingForm.register("endDate")} />
                              {bookingForm.formState.errors.endDate ? (
                                <p className="text-sm text-destructive">{bookingForm.formState.errors.endDate.message}</p>
                              ) : null}
                            </div>
                          </div>
                          <Button className="w-full" type="submit" disabled={bookingMutation.isPending}>
                            Book this car
                          </Button>
                          {bookingMutation.error ? <Alert variant="destructive">{getApiMessage(bookingMutation.error)}</Alert> : null}
                        </form>
                      </div>
                    ) : null}

                    <div className="surface-muted space-y-4 rounded-2xl p-4">
                      <p className="text-sm font-semibold text-foreground">Message the shop</p>
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
                      {createConversationMutation.error ? (
                        <Alert variant="destructive">{getApiMessage(createConversationMutation.error)}</Alert>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {!session.user ? (
                  <div className="surface-muted rounded-2xl p-4 text-sm text-muted-foreground">
                    Log in to save favorites, place a booking, or contact this shop.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-state">
                <CarFront className="mb-3 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">No car selected</p>
                <p className="mt-1 text-sm text-muted-foreground">Choose a car from the list to view details and actions.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <CarFront className="h-4 w-4" />
              </span>
              Live inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{carsQuery.data?.meta.total ?? 0}</p>
            <p className="text-sm text-muted-foreground">Public cars currently returned by the API.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Star className="h-4 w-4" />
              </span>
              Saved favorites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{favoritesQuery.data?.length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Visible once you log in as a user.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <MessageSquare className="h-4 w-4" />
              </span>
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{conversationsQuery.data?.length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Private conversation threads between customers and rental shops.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
