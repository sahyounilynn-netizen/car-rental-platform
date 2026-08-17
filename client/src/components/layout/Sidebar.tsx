import { NavLink } from "react-router";
import { CalendarDays, CarFront, Heart, LayoutDashboard, MessageSquare, Search, Shield, Store, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/features/auth/useSession";

type NavItem = {
  to: string;
  end?: boolean;
  label: string;
  icon: typeof Search;
};

export function Sidebar() {
  const { session } = useSession();

  const items: NavItem[] = [
    { to: "/", end: true, label: "Browse cars", icon: Search },
    ...(session.user?.role === "SUPERADMIN"
      ? [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }]
      : []),
    ...(session.user?.role === "USER"
      ? [
          { to: "/favorites", label: "Favorites", icon: Heart },
          { to: "/bookings", label: "My bookings", icon: CalendarDays },
          { to: "/conversations", label: "Messages", icon: MessageSquare },
        ]
      : []),
    ...(session.user?.role === "ADMIN"
      ? [
          { to: "/inventory", label: "Inventory", icon: CarFront },
          { to: "/shop-bookings", label: "Shop bookings", icon: Shield },
          { to: "/conversations", label: "Inbox", icon: MessageSquare },
          { to: "/shop-profile", label: "Shop profile", icon: Store },
        ]
      : []),
    ...(session.user ? [{ to: "/profile", label: "Profile", icon: UserRound }] : []),
  ];

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        );
      })}
    </div>
  );
}
