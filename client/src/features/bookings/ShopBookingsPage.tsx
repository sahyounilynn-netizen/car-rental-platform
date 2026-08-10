import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ShopBookingsPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const shopBookingsQuery = useQuery({
    queryKey: ["shop-bookings", session.user?.shop?.id],
    queryFn: () => api.listShopBookings(session.token!),
    enabled: Boolean(session.token && session.user?.role === "ADMIN"),
  });

  const updateBookingStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) =>
      api.updateBookingStatus(session.token!, bookingId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shop-bookings"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop bookings</CardTitle>
        <CardDescription>Review current requests and update their status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(shopBookingsQuery.data?.items ?? []).map((booking) => (
          <div key={booking.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {booking.car.brand.name} {booking.car.model}
                </p>
                <p className="text-sm text-muted-foreground">
                  {booking.renterUser?.name ?? booking.walkInRenterName ?? "Walk-in renter"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(booking.startDate)} to {formatDate(booking.endDate)}
                </p>
              </div>
              <div className="flex gap-2">
                {["CONFIRMED", "ACTIVE", "COMPLETED", "CANCELLED"].map((status) => (
                  <Button
                    key={status}
                    variant={booking.status === status ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => updateBookingStatusMutation.mutate({ bookingId: booking.id, status })}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
