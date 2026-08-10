import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/routing/ProtectedRoute";
import { RoleRoute } from "@/components/routing/RoleRoute";
import { BrowsePage } from "@/features/cars/BrowsePage";
import { FavoritesPage } from "@/features/favorites/FavoritesPage";
import { MyBookingsPage } from "@/features/bookings/MyBookingsPage";
import { ShopBookingsPage } from "@/features/bookings/ShopBookingsPage";
import { ConversationsPage } from "@/features/conversations/ConversationsPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { ProfilePage } from "@/features/profile/ProfilePage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<BrowsePage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allow={["USER"]} />}>
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/bookings" element={<MyBookingsPage />} />
          </Route>

          <Route element={<RoleRoute allow={["ADMIN"]} />}>
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/shop-bookings" element={<ShopBookingsPage />} />
          </Route>

          <Route element={<RoleRoute allow={["USER", "ADMIN"]} />}>
            <Route path="/conversations" element={<ConversationsPage />} />
            <Route path="/conversations/:conversationId" element={<ConversationsPage />} />
          </Route>

          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
