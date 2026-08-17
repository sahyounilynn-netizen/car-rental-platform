import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatMoney, getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import type { Booking } from "@/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";

function canCancelBooking(booking: Booking) {
  return booking.source === "ONLINE" && (booking.status === "PENDING" || booking.status === "CONFIRMED");
}

export function MyBookingsPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const myBookingsQuery = useQuery({
    queryKey: ["my-bookings", session.user?.id],
    queryFn: () => api.listMyBookings(session.token!),
    enabled: Boolean(session.token && session.user?.role === "USER"),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => api.cancelMyBooking(session.token!, bookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["cars"] });
    },
  });

  function cancelBooking(booking: Booking) {
    const confirmed = window.confirm(`Cancel your booking for ${booking.car.brand.name} ${booking.car.model}?`);
    if (confirmed) {
      cancelBookingMutation.mutate(booking.id);
    }
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Bookings"
        title="My bookings"
        description="Review current and past reservations created from your customer account."
      />

      <Card>
        <CardHeader>
          <CardTitle>Reservation history</CardTitle>
          <CardDescription>Track dates, totals, and booking status for every rental request.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {myBookingsQuery.isLoading ? (
            <div className="empty-state">
              <CalendarDays className="mb-3 h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading bookings...</p>
            </div>
          ) : null}

          {myBookingsQuery.error ? <Alert variant="destructive">{getApiMessage(myBookingsQuery.error)}</Alert> : null}

          {cancelBookingMutation.isSuccess ? <Alert>Booking cancelled successfully.</Alert> : null}

          {cancelBookingMutation.error ? (
            <Alert variant="destructive">{getApiMessage(cancelBookingMutation.error)}</Alert>
          ) : null}

          {(myBookingsQuery.data?.items ?? []).map((booking) => (
            <div key={booking.id} className="panel-soft rounded-2xl p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                      {booking.car.brand.name} {booking.car.model}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(booking.startDate)} to {formatDate(booking.endDate)}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="surface-muted min-w-0 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Shop</p>
                    <p className="text-wrap-safe mt-1 font-medium text-foreground">{booking.car.shop.name}</p>
                  </div>
                    <div className="surface-muted rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total</p>
                      <p className="mt-1 font-medium text-foreground">{formatMoney(booking.totalPrice)}</p>
                    </div>
                    <div className="surface-muted rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Source</p>
                      <p className="mt-1 font-medium text-foreground">{booking.source}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <StatusBadge status={booking.status} />
                  {canCancelBooking(booking) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={cancelBookingMutation.isPending}
                      onClick={() => cancelBooking(booking)}
                    >
                      {cancelBookingMutation.isPending ? "Cancelling..." : "Cancel booking"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {!myBookingsQuery.isLoading && !myBookingsQuery.error && (myBookingsQuery.data?.items.length ?? 0) === 0 ? (
            <div className="empty-state">
              <CalendarDays className="mb-3 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">No bookings yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Your reservations will appear here once you create one.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
