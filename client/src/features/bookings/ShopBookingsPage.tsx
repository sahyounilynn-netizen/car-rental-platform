import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import {
  formatDate,
  getApiMessage,
} from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const walkInBookingSchema = z
  .object({
    carId: z
      .string()
      .trim()
      .min(1, "Select a car"),
    walkInRenterName: z
      .string()
      .trim()
      .min(2, "Renter name is required")
      .max(100),
    walkInRenterPhone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number"),
    walkInRenterLicenseNumber: z
      .string()
      .trim()
      .min(4, "License number is required")
      .max(100),
    startDate: z
      .string()
      .min(1, "Start date is required"),
    endDate: z
      .string()
      .min(1, "End date is required"),
  })
  .superRefine((values, ctx) => {
    if (
      values.startDate &&
      values.endDate &&
      values.endDate <= values.startDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message:
          "End date must be after the start date",
      });
    }
  });

type WalkInBookingFormValues = z.infer<
  typeof walkInBookingSchema
>;

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(date.getDate()).padStart(
    2,
    "0",
  );

  return `${year}-${month}-${day}`;
}

function getInitialWalkInValues(): WalkInBookingFormValues {
  const today = new Date();
  const tomorrow = new Date(today);

  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    carId: "",
    walkInRenterName: "",
    walkInRenterPhone: "",
    walkInRenterLicenseNumber: "",
    startDate: toDateInputValue(today),
    endDate: toDateInputValue(tomorrow),
  };
}

const BOOKING_STATUSES = [
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
] as const;

export function ShopBookingsPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const walkInForm =
    useForm<WalkInBookingFormValues>({
      resolver: zodResolver(
        walkInBookingSchema,
      ),
      defaultValues: getInitialWalkInValues(),
    });

  const shopBookingsQuery = useQuery({
    queryKey: [
      "shop-bookings",
      session.user?.shop?.id,
    ],
    queryFn: () =>
      api.listShopBookings(session.token!),
    enabled: Boolean(
      session.token &&
        session.user?.role === "ADMIN",
    ),
  });

  const shopCarsQuery = useQuery({
    queryKey: [
      "walk-in-cars",
      session.user?.shop?.id,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        shopId: session.user!.shop!.id,
        page: "1",
        limit: "50",
      });

      return api.listCars(params);
    },
    enabled: Boolean(
      session.token &&
        session.user?.role === "ADMIN" &&
        session.user.shop?.id,
    ),
  });

  const createWalkInMutation = useMutation({
    mutationFn: async (
      values: WalkInBookingFormValues,
    ) =>
      api.createWalkInBooking(
        session.token!,
        {
          carId: values.carId,
          walkInRenterName:
            values.walkInRenterName,
          walkInRenterPhone:
            values.walkInRenterPhone,
          walkInRenterLicenseNumber:
            values.walkInRenterLicenseNumber,
          startDate: values.startDate,
          endDate: values.endDate,
        },
      ),

    onSuccess: () => {
      walkInForm.reset(
        getInitialWalkInValues(),
      );

      void queryClient.invalidateQueries({
        queryKey: ["shop-bookings"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["inventory"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["cars"],
      });
    },
  });

  const updateBookingStatusMutation =
    useMutation({
      mutationFn: async ({
        bookingId,
        status,
      }: {
        bookingId: string;
        status: string;
      }) =>
        api.updateBookingStatus(
          session.token!,
          bookingId,
          status,
        ),

      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: ["shop-bookings"],
        });

        void queryClient.invalidateQueries({
          queryKey: ["inventory"],
        });

        void queryClient.invalidateQueries({
          queryKey: ["cars"],
        });
      },
    });

  function submitWalkInBooking(
    values: WalkInBookingFormValues,
  ) {
    createWalkInMutation.mutate(values);
  }

  const minimumDate = toDateInputValue(
    new Date(),
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>
            Create walk-in booking
          </CardTitle>

          <CardDescription>
            Record a booking made directly at
            your shop.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="space-y-3"
            noValidate
            onSubmit={walkInForm.handleSubmit(
              submitWalkInBooking,
            )}
          >
            <div className="space-y-1">
              <Select
                aria-label="Car"
                {...walkInForm.register("carId")}
              >
                <option value="">
                  Select a car
                </option>

                {(shopCarsQuery.data?.items ??
                  []).map((car) => (
                  <option
                    key={car.id}
                    value={car.id}
                  >
                    {car.brand.name}{" "}
                    {car.model} ({car.year})
                  </option>
                ))}
              </Select>

              {walkInForm.formState.errors
                .carId && (
                <p className="text-sm text-destructive">
                  {
                    walkInForm.formState.errors
                      .carId.message
                  }
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                placeholder="Renter name"
                {...walkInForm.register(
                  "walkInRenterName",
                )}
              />

              {walkInForm.formState.errors
                .walkInRenterName && (
                <p className="text-sm text-destructive">
                  {
                    walkInForm.formState.errors
                      .walkInRenterName.message
                  }
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                type="tel"
                placeholder="Phone, for example +961..."
                {...walkInForm.register(
                  "walkInRenterPhone",
                )}
              />

              {walkInForm.formState.errors
                .walkInRenterPhone && (
                <p className="text-sm text-destructive">
                  {
                    walkInForm.formState.errors
                      .walkInRenterPhone.message
                  }
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                placeholder="License number"
                {...walkInForm.register(
                  "walkInRenterLicenseNumber",
                )}
              />

              {walkInForm.formState.errors
                .walkInRenterLicenseNumber && (
                <p className="text-sm text-destructive">
                  {
                    walkInForm.formState.errors
                      .walkInRenterLicenseNumber
                      .message
                  }
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Start date
                </label>

                <Input
                  type="date"
                  min={minimumDate}
                  {...walkInForm.register(
                    "startDate",
                  )}
                />

                {walkInForm.formState.errors
                  .startDate && (
                  <p className="text-sm text-destructive">
                    {
                      walkInForm.formState.errors
                        .startDate.message
                    }
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  End date
                </label>

                <Input
                  type="date"
                  min={minimumDate}
                  {...walkInForm.register(
                    "endDate",
                  )}
                />

                {walkInForm.formState.errors
                  .endDate && (
                  <p className="text-sm text-destructive">
                    {
                      walkInForm.formState.errors
                        .endDate.message
                    }
                  </p>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              type="submit"
              disabled={
                createWalkInMutation.isPending
              }
            >
              {createWalkInMutation.isPending
                ? "Creating..."
                : "Create walk-in booking"}
            </Button>

            {createWalkInMutation.isSuccess && (
              <Alert>
                Walk-in booking created
                successfully.
              </Alert>
            )}

            {createWalkInMutation.error && (
              <Alert variant="destructive">
                {getApiMessage(
                  createWalkInMutation.error,
                )}
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Shop bookings
          </CardTitle>

          <CardDescription>
            Review online and walk-in bookings
            and update their status.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {shopBookingsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading bookings...
            </p>
          )}

          {shopBookingsQuery.error && (
            <Alert variant="destructive">
              {getApiMessage(
                shopBookingsQuery.error,
              )}
            </Alert>
          )}

          {!shopBookingsQuery.isLoading &&
            !shopBookingsQuery.error &&
            (shopBookingsQuery.data?.items
              .length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                Your shop does not have any
                bookings yet.
              </p>
            )}

          {(shopBookingsQuery.data?.items ??
            []).map((booking) => (
            <div
              key={booking.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {booking.car.brand.name}{" "}
                    {booking.car.model}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {booking.renterUser?.name ??
                      booking.walkInRenterName ??
                      "Walk-in renter"}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {formatDate(
                      booking.startDate,
                    )}{" "}
                    to{" "}
                    {formatDate(
                      booking.endDate,
                    )}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {booking.source === "WALK_IN"
                      ? "Walk-in"
                      : "Online"}{" "}
                    • Current status:{" "}
                    {booking.status}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {BOOKING_STATUSES.map(
                    (status) => (
                      <Button
                        key={status}
                        variant={
                          booking.status ===
                          status
                            ? "secondary"
                            : "outline"
                        }
                        size="sm"
                        disabled={
                          updateBookingStatusMutation.isPending ||
                          booking.status === status
                        }
                        onClick={() =>
                          updateBookingStatusMutation.mutate(
                            {
                              bookingId:
                                booking.id,
                              status,
                            },
                          )
                        }
                      >
                        {status}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            </div>
          ))}

          {updateBookingStatusMutation.error && (
            <Alert variant="destructive">
              {getApiMessage(
                updateBookingStatusMutation.error,
              )}
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}