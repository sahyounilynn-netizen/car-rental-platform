import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  formatDate,
  formatMoney,
  getApiMessage,
} from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import type { Booking } from "@/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function canCancelBooking(
  booking: Booking,
) {
  return (
    booking.source === "ONLINE" &&
    (booking.status === "PENDING" ||
      booking.status === "CONFIRMED")
  );
}

export function MyBookingsPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const myBookingsQuery = useQuery({
    queryKey: [
      "my-bookings",
      session.user?.id,
    ],
    queryFn: () =>
      api.listMyBookings(session.token!),
    enabled: Boolean(
      session.token &&
        session.user?.role === "USER",
    ),
  });

  const cancelBookingMutation =
    useMutation({
      mutationFn: async (
        bookingId: string,
      ) =>
        api.cancelMyBooking(
          session.token!,
          bookingId,
        ),

      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: ["my-bookings"],
        });

        void queryClient.invalidateQueries({
          queryKey: ["cars"],
        });
      },
    });

  function cancelBooking(
    booking: Booking,
  ) {
    const confirmed = window.confirm(
      `Cancel your booking for ${booking.car.brand.name} ${booking.car.model}?`,
    );

    if (confirmed) {
      cancelBookingMutation.mutate(
        booking.id,
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          My bookings
        </CardTitle>

        <CardDescription>
          Current and past reservations created
          from your account.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {myBookingsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading bookings...
          </p>
        )}

        {myBookingsQuery.error && (
          <Alert variant="destructive">
            {getApiMessage(
              myBookingsQuery.error,
            )}
          </Alert>
        )}

        {cancelBookingMutation.isSuccess && (
          <Alert>
            Booking cancelled successfully.
          </Alert>
        )}

        {cancelBookingMutation.error && (
          <Alert variant="destructive">
            {getApiMessage(
              cancelBookingMutation.error,
            )}
          </Alert>
        )}

        {(myBookingsQuery.data?.items ??
          []).map((booking: Booking) => (
          <div
            key={booking.id}
            className="rounded-xl border border-border p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {booking.car.brand.name}{" "}
                  {booking.car.model}
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
              </div>

              <Badge variant="outline">
                {booking.status}
              </Badge>
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="text-muted-foreground">
                  {booking.car.shop.name}
                </p>

                <p>
                  {formatMoney(
                    booking.totalPrice,
                  )}
                </p>
              </div>

              {canCancelBooking(booking) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    cancelBookingMutation.isPending
                  }
                  onClick={() =>
                    cancelBooking(booking)
                  }
                >
                  {cancelBookingMutation.isPending
                    ? "Cancelling..."
                    : "Cancel booking"}
                </Button>
              )}
            </div>
          </div>
        ))}

        {!myBookingsQuery.isLoading &&
          !myBookingsQuery.error &&
          (myBookingsQuery.data?.items
            .length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              No bookings yet.
            </p>
          )}
      </CardContent>
    </Card>
  );
}