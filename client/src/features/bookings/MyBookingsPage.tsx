import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import type { Booking } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MyBookingsPage() {
  const { session } = useSession();

  const myBookingsQuery = useQuery({
    queryKey: ["my-bookings", session.user?.id],
    queryFn: () => api.listMyBookings(session.token!),
    enabled: Boolean(session.token && session.user?.role === "USER"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>My bookings</CardTitle>
        <CardDescription>Current and past reservations created from your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(myBookingsQuery.data?.items ?? []).map((booking: Booking) => (
          <div key={booking.id} className="rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {booking.car.brand.name} {booking.car.model}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(booking.startDate)} to {formatDate(booking.endDate)}
                </p>
              </div>
              <Badge variant="outline">{booking.status}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{booking.car.shop.name}</span>
              <span>{formatMoney(booking.totalPrice)}</span>
            </div>
          </div>
        ))}
        {!myBookingsQuery.data?.items.length && (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
