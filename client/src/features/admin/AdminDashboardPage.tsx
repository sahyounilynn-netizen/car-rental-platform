import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, CalendarRange, CarFront, ScrollText, ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import type { AdminShopRecord, AdminUserRecord, ShopStatus, UserStatus } from "@/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageIntro } from "@/components/ui/page-intro";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

type UserFilters = {
  search: string;
  role: "" | "USER" | "ADMIN";
  status: "" | UserStatus;
};

type ShopFilters = {
  search: string;
  status: "" | ShopStatus;
};

type AuditFilters = {
  search: string;
  action: string;
  targetType: string;
};

function buildListParams(filters: Record<string, string>, page: number, limit: number) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params;
}

function nextStatus(currentStatus: UserStatus | ShopStatus): UserStatus | ShopStatus {
  return currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return "No additional details";
  return Object.entries(metadata)
    .map(([key, value]) => {
      const label = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
      return `${label}: ${String(value)}`;
    })
    .join(" • ");
}

export function AdminDashboardPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [userFilters, setUserFilters] = useState<UserFilters>({ search: "", role: "", status: "" });
  const [shopFilters, setShopFilters] = useState<ShopFilters>({ search: "", status: "" });
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({ search: "", action: "", targetType: "" });

  const summaryQuery = useQuery({
    queryKey: ["admin", "summary"],
    queryFn: async () => (await api.getAdminSummary(session.token!)).summary,
    enabled: Boolean(session.token && session.user?.role === "SUPERADMIN"),
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", userFilters],
    queryFn: async () =>
      api.listAdminUsers(
        session.token!,
        buildListParams(
          {
            search: userFilters.search.trim(),
            role: userFilters.role,
            status: userFilters.status,
          },
          1,
          20,
        ),
      ),
    enabled: Boolean(session.token && session.user?.role === "SUPERADMIN"),
  });

  const shopsQuery = useQuery({
    queryKey: ["admin", "shops", shopFilters],
    queryFn: async () =>
      api.listAdminShops(
        session.token!,
        buildListParams(
          {
            search: shopFilters.search.trim(),
            status: shopFilters.status,
          },
          1,
          20,
        ),
      ),
    enabled: Boolean(session.token && session.user?.role === "SUPERADMIN"),
  });

  const auditLogsQuery = useQuery({
    queryKey: ["admin", "audit-logs", auditFilters],
    queryFn: async () =>
      api.listAdminAuditLogs(
        session.token!,
        buildListParams(
          {
            search: auditFilters.search.trim(),
            action: auditFilters.action,
            targetType: auditFilters.targetType,
          },
          1,
          20,
        ),
      ),
    enabled: Boolean(session.token && session.user?.role === "SUPERADMIN"),
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: UserStatus }) =>
      api.updateAdminUserStatus(session.token!, userId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "summary"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] }),
      ]);
    },
  });

  const updateShopStatusMutation = useMutation({
    mutationFn: async ({ shopId, status }: { shopId: string; status: ShopStatus }) =>
      api.updateAdminShopStatus(session.token!, shopId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "summary"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "shops"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["cars"] }),
      ]);
    },
  });

  function confirmStatusChange(label: string, status: UserStatus | ShopStatus) {
    return window.confirm(`Are you sure you want to set ${label} to ${status}?`);
  }

  function handleUserStatusChange(user: AdminUserRecord) {
    const status = nextStatus(user.status) as UserStatus;
    if (!confirmStatusChange(user.email, status)) return;
    updateUserStatusMutation.mutate({ userId: user.id, status });
  }

  function handleShopStatusChange(shop: AdminShopRecord) {
    const status = nextStatus(shop.status) as ShopStatus;
    if (!confirmStatusChange(shop.name, status)) return;
    updateShopStatusMutation.mutate({ shopId: shop.id, status });
  }

  if (!session.user || session.user.role !== "SUPERADMIN") {
    return null;
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Platform"
        title="SuperAdmin dashboard"
        description="Monitor platform-wide totals, manage account and shop status, and review sensitive audit activity."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Users", value: summaryQuery.data?.users ?? 0, icon: Users },
          { label: "Shop admins", value: summaryQuery.data?.admins ?? 0, icon: ShieldCheck },
          { label: "Shops", value: summaryQuery.data?.shops ?? 0, icon: Building2 },
          { label: "Cars", value: summaryQuery.data?.cars ?? 0, icon: CarFront },
          { label: "Bookings", value: summaryQuery.data?.bookings ?? 0, icon: CalendarRange },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {summaryQuery.isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading platform summary</CardTitle>
          </CardHeader>
        </Card>
      ) : null}

      {summaryQuery.error ? <Alert variant="destructive">{getApiMessage(summaryQuery.error)}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Search and manage customer and shop admin accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Search by name or email"
              value={userFilters.search}
              onChange={(event) => setUserFilters((current) => ({ ...current, search: event.target.value }))}
            />
            <Select
              value={userFilters.role}
              onChange={(event) => setUserFilters((current) => ({ ...current, role: event.target.value as UserFilters["role"] }))}
            >
              <option value="">All roles</option>
              <option value="USER">Users</option>
              <option value="ADMIN">Shop admins</option>
            </Select>
            <Select
              value={userFilters.status}
              onChange={(event) => setUserFilters((current) => ({ ...current, status: event.target.value as UserFilters["status"] }))}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
          </div>

          {usersQuery.error ? <Alert variant="destructive">{getApiMessage(usersQuery.error)}</Alert> : null}

          {usersQuery.isLoading ? (
            <div className="empty-state">Loading users...</div>
          ) : usersQuery.data?.items.length ? (
            <div className="space-y-3">
              {usersQuery.data.items.map((user) => (
                <div key={user.id} className="panel-soft rounded-2xl p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{user.name}</p>
                        <StatusBadge status={user.role} />
                        <StatusBadge status={user.status} />
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="text-wrap-safe">{user.email}</p>
                        <p>Created {formatDate(user.createdAt)}</p>
                        <p>{user.phone || "No phone number"}</p>
                        <p>{user.shop ? `Shop: ${user.shop.name}` : "No shop assigned"}</p>
                      </div>
                    </div>

                    <Button
                      variant={user.status === "ACTIVE" ? "destructive" : "default"}
                      disabled={updateUserStatusMutation.isPending}
                      onClick={() => handleUserStatusChange(user)}
                    >
                      {user.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No users matched your filters.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shops</CardTitle>
          <CardDescription>Review tenant status, ownership, and activity counts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Search by shop or owner"
              value={shopFilters.search}
              onChange={(event) => setShopFilters((current) => ({ ...current, search: event.target.value }))}
            />
            <Select
              value={shopFilters.status}
              onChange={(event) => setShopFilters((current) => ({ ...current, status: event.target.value as ShopFilters["status"] }))}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </Select>
          </div>

          {shopsQuery.error ? <Alert variant="destructive">{getApiMessage(shopsQuery.error)}</Alert> : null}
          {updateUserStatusMutation.error || updateShopStatusMutation.error ? (
            <Alert variant="destructive">{getApiMessage(updateUserStatusMutation.error ?? updateShopStatusMutation.error)}</Alert>
          ) : null}

          {shopsQuery.isLoading ? (
            <div className="empty-state">Loading shops...</div>
          ) : shopsQuery.data?.items.length ? (
            <div className="space-y-3">
              {shopsQuery.data.items.map((shop) => (
                <div key={shop.id} className="panel-soft rounded-2xl p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{shop.name}</p>
                        <StatusBadge status={shop.status} />
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="text-wrap-safe">Owner: {shop.owner.name} ({shop.owner.email})</p>
                        <p>Created {formatDate(shop.createdAt)}</p>
                        <p>{shop.address || "No address provided"}</p>
                        <p>{shop.phone || "No phone number"}</p>
                        <p>{shop.carCount} cars • {shop.bookingCount} bookings</p>
                      </div>
                    </div>

                    <Button
                      variant={shop.status === "ACTIVE" ? "destructive" : "default"}
                      disabled={updateShopStatusMutation.isPending}
                      onClick={() => handleShopStatusChange(shop)}
                    >
                      {shop.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No shops matched your filters.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Audit logs
          </CardTitle>
          <CardDescription>Review sensitive actions performed across the platform.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Search logs or actors"
              value={auditFilters.search}
              onChange={(event) => setAuditFilters((current) => ({ ...current, search: event.target.value }))}
            />
            <Select
              value={auditFilters.action}
              onChange={(event) => setAuditFilters((current) => ({ ...current, action: event.target.value }))}
            >
              <option value="">All actions</option>
              <option value="USER_STATUS_UPDATED">User status updated</option>
              <option value="SHOP_STATUS_UPDATED">Shop status updated</option>
              <option value="CAR_CREATED">Car created</option>
              <option value="CAR_UPDATED">Car updated</option>
              <option value="CAR_ARCHIVED">Car archived</option>
              <option value="BOOKING_STATUS_UPDATED">Booking status updated</option>
              <option value="BOOKING_CANCELLED">Booking cancelled</option>
            </Select>
            <Select
              value={auditFilters.targetType}
              onChange={(event) => setAuditFilters((current) => ({ ...current, targetType: event.target.value }))}
            >
              <option value="">All target types</option>
              <option value="USER">Users</option>
              <option value="SHOP">Shops</option>
              <option value="CAR">Cars</option>
              <option value="BOOKING">Bookings</option>
            </Select>
          </div>

          {auditLogsQuery.error ? <Alert variant="destructive">{getApiMessage(auditLogsQuery.error)}</Alert> : null}

          {auditLogsQuery.isLoading ? (
            <div className="empty-state">Loading audit logs...</div>
          ) : auditLogsQuery.data?.items.length ? (
            <div className="space-y-3">
              {auditLogsQuery.data.items.map((log) => (
                <div key={log.id} className="panel-soft rounded-2xl p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{formatAction(log.action)}</p>
                        <StatusBadge status={log.targetType} />
                        <StatusBadge status={log.actor.role} />
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="text-wrap-safe">Actor: {log.actor.name} ({log.actor.email})</p>
                        <p>Target ID: {log.targetId}</p>
                        <p>{formatMetadata(log.metadata)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No audit logs matched your filters.</div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-accent/30 p-4 text-sm text-muted-foreground">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Suspended shops are removed from normal car discovery and online booking availability because public car queries filter to active shops.
      </div>
    </div>
  );
}
