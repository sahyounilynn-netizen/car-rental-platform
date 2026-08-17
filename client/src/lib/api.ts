import type {
  AdminShopRecord,
  AdminSummary,
  AdminUserRecord,
  ApiFieldError,
  AuditLogRecord,
  AuthResponse,
  Booking,
  Brand,
  Car,
  Conversation,
  Favorite,
  PaginatedResponse,
  Shop,
  ShopStatus,
  User,
  UserStatus,
} from "@/types";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ??
  "/api";

export class ApiError extends Error {
  status: number;
  fieldErrors?: ApiFieldError[];

  constructor(
    message: string,
    status: number,
    fieldErrors?: ApiFieldError[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData =
    init.body instanceof FormData;

  if (
    init.body &&
    !isFormData &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`,
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE}${path}`,
      {
        ...init,
        headers,
        credentials: "include",
      },
    );
  } catch {
    throw new ApiError(
      "Unable to reach the server. Make sure the API is running and try again.",
      0,
    );
  }

  const contentType =
    response.headers.get("content-type") ??
    "";

  const payload = contentType.includes(
    "application/json",
  )
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `Request failed with status ${response.status}`;

    throw new ApiError(
      message,
      response.status,
      payload?.error?.fieldErrors,
    );
  }

  return payload as T;
}

export const api = {
  login: (input: {
    email: string;
    password: string;
  }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  signup: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    asShop?: boolean;
    shopName?: string;
  }) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  refresh: () =>
    request<AuthResponse>("/auth/refresh", {
      method: "POST",
    }),

  me: (token: string) =>
    request<{ user: User }>(
      "/auth/me",
      {
        method: "GET",
      },
      token,
    ),

  logout: (token: string) =>
    request<void>(
      "/auth/logout",
      {
        method: "POST",
      },
      token,
    ),

  listBrands: () =>
    request<{ brands: Brand[] }>("/cars"),

  listCarBrands: () =>
    request<{ brands: Brand[] }>(
      "/cars/brands",
    ),

  listCars: (query: URLSearchParams) =>
    request<PaginatedResponse<Car>>(
      `/cars?${query.toString()}`,
    ),

  getCar: (carId: string) =>
    request<{ car: Car }>(
      `/cars/${carId}`,
    ),

  listFavorites: (token: string) =>
    request<{ favorites: Favorite[] }>(
      "/favorites",
      {},
      token,
    ),

  addFavorite: (
    token: string,
    carId: string,
  ) =>
    request<{ favorite: Favorite }>(
      `/favorites/${carId}`,
      {
        method: "POST",
      },
      token,
    ),

  removeFavorite: (
    token: string,
    carId: string,
  ) =>
    request<void>(
      `/favorites/${carId}`,
      {
        method: "DELETE",
      },
      token,
    ),

  createBooking: (
    token: string,
    input: {
      carId: string;
      startDate: string;
      endDate: string;
    },
  ) =>
    request<{ booking: Booking }>(
      "/bookings",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      token,
    ),

  createWalkInBooking: (
    token: string,
    input: {
      carId: string;
      walkInRenterName: string;
      walkInRenterPhone: string;
      walkInRenterLicenseNumber: string;
      startDate: string;
      endDate: string;
    },
  ) =>
    request<{ booking: Booking }>(
      "/bookings/walk-in",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      token,
    ),

  listMyBookings: (token: string) =>
    request<PaginatedResponse<Booking>>(
      "/bookings/me",
      {},
      token,
    ),

  cancelMyBooking: (
    token: string,
    bookingId: string,
  ) =>
    request<{ booking: Booking }>(
      `/bookings/me/${bookingId}/cancel`,
      {
        method: "PATCH",
      },
      token,
    ),

  listShopBookings: (token: string) =>
    request<PaginatedResponse<Booking>>(
      "/bookings/shop",
      {},
      token,
    ),

  updateBookingStatus: (
    token: string,
    bookingId: string,
    status: string,
  ) =>
    request<{ booking: Booking }>(
      `/bookings/${bookingId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
        }),
      },
      token,
    ),

  listConversations: (
    token: string,
    role: User["role"],
  ) =>
    request<{
      conversations: Conversation[];
    }>(
      role === "ADMIN"
        ? "/conversations/shop"
        : "/conversations/me",
      {},
      token,
    ),

  getConversation: (
    token: string,
    conversationId: string,
  ) =>
    request<{ conversation: Conversation }>(
      `/conversations/${conversationId}`,
      {},
      token,
    ),

  createConversation: (
    token: string,
    input: {
      shopId: string;
      body: string;
    },
  ) =>
    request<{ conversation: Conversation }>(
      "/conversations",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      token,
    ),

  sendMessage: (
    token: string,
    conversationId: string,
    body: string,
  ) =>
    request<{
      message:
        Conversation["messages"][number];
    }>(
      `/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          body,
        }),
      },
      token,
    ),

  markConversationRead: (
    token: string,
    conversationId: string,
  ) =>
    request<void>(
      `/conversations/${conversationId}/read`,
      {
        method: "PATCH",
      },
      token,
    ),

  updateProfile: (
    token: string,
    input: {
      name?: string;
      phone?: string;
    },
  ) =>
    request<{ user: User }>(
      "/users/me",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
      token,
    ),

  createCar: (
    token: string,
    input: {
      brandId: string;
      type: string;
      model: string;
      year: number;
      pricePerDay: number;
      minRentalDays?: number;
      extraFees?: number;
      description?: string;
      isBookableOnline?: boolean;
      imageUrls?: string[];
    },
  ) =>
    request<{ car: Car }>(
      "/cars",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      token,
    ),

  updateCar: (
    token: string,
    carId: string,
    input: {
      brandId?: string;
      type?: string;
      model?: string;
      year?: number;
      pricePerDay?: number;
      minRentalDays?: number;
      extraFees?: number | null;
      description?: string | null;
      isBookableOnline?: boolean;
      status?: string;
      imageUrls?: string[];
    },
  ) =>
    request<{ car: Car }>(
      `/cars/${carId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
      token,
    ),

  archiveCar: (
    token: string,
    carId: string,
  ) =>
    request<void>(
      `/cars/${carId}`,
      {
        method: "DELETE",
      },
      token,
    ),

  getMyShop: (token: string) =>
    request<{ shop: Shop }>(
      "/shops/me",
      {},
      token,
    ),

  updateMyShop: (
    token: string,
    input: {
      name?: string;
      description?: string | null;
      address?: string | null;
      phone?: string | null;
      logoUrl?: string | null;
    },
  ) =>
    request<{ shop: Shop }>(
      "/shops/me",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
      token,
    ),

  getAdminSummary: (token: string) =>
    request<{ summary: AdminSummary }>(
      "/admin/summary",
      {},
      token,
    ),

  listAdminUsers: (
    token: string,
    query: URLSearchParams,
  ) =>
    request<
      PaginatedResponse<AdminUserRecord>
    >(
      `/admin/users?${query.toString()}`,
      {},
      token,
    ),

  listAdminShops: (
    token: string,
    query: URLSearchParams,
  ) =>
    request<
      PaginatedResponse<AdminShopRecord>
    >(
      `/admin/shops?${query.toString()}`,
      {},
      token,
    ),

  listAdminAuditLogs: (
    token: string,
    query: URLSearchParams,
  ) =>
    request<
      PaginatedResponse<AuditLogRecord>
    >(
      `/admin/audit-logs?${query.toString()}`,
      {},
      token,
    ),

  updateAdminUserStatus: (
    token: string,
    userId: string,
    status: UserStatus,
  ) =>
    request<{ user: AdminUserRecord }>(
      `/admin/users/${userId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
        }),
      },
      token,
    ),

  updateAdminShopStatus: (
    token: string,
    shopId: string,
    status: ShopStatus,
  ) =>
    request<{ shop: AdminShopRecord }>(
      `/admin/shops/${shopId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
        }),
      },
      token,
    ),
};