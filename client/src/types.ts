export type Role =
  | "SUPERADMIN"
  | "ADMIN"
  | "USER";

export type UserStatus =
  | "ACTIVE"
  | "SUSPENDED";

export type ShopStatus =
  | "ACTIVE"
  | "SUSPENDED";

export interface Shop {
  id: string;
  name: string;
  status: ShopStatus;
  logoUrl?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  status?: UserStatus;
  shop?: Shop | null;
}

export interface AdminSummary {
  users: number;
  admins: number;
  shops: number;
  cars: number;
  bookings: number;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Exclude<Role, "SUPERADMIN">;
  status: UserStatus;
  createdAt: string;
  shop: Pick<
    Shop,
    "id" | "name" | "status"
  > | null;
}

export interface AdminShopRecord {
  id: string;
  name: string;
  status: ShopStatus;
  address?: string | null;
  phone?: string | null;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
  };
  carCount: number;
  bookingCount: number;
}

export interface AuditLogActor {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<
    string,
    unknown
  > | null;
  createdAt: string;
  actor: AuditLogActor;
}

export interface Brand {
  id: string;
  name: string;
}

export interface CarImage {
  id: string;
  url: string;
  position: number;
  createdAt: string;
}

export interface Car {
  id: string;
  shopId: string;
  brandId: string;
  type: string;
  model: string;
  year: number;
  pricePerDay: number;
  minRentalDays: number;
  extraFees: number | null;
  description?: string | null;
  isBookableOnline: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  brand: Brand;
  images: CarImage[];
  shop: Shop;
}

export interface Favorite {
  userId: string;
  carId: string;
  createdAt: string;
  car: Car;
}

export interface Booking {
  id: string;
  carId: string;
  shopId: string;
  renterUserId?: string | null;
  walkInRenterName?: string | null;
  walkInRenterPhone?: string | null;
  walkInRenterLicenseNumber?:
    | string
    | null;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: string;
  source: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  car: Car;
  renterUser?: Pick<
    User,
    "id" | "name" | "email" | "phone"
  > | null;
  createdBy: Pick<
    User,
    "id" | "name" | "email" | "role"
  >;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  sender: Pick<
    User,
    "id" | "name" | "email" | "role"
  >;
}

export interface Conversation {
  id: string;
  userId: string;
  shopId: string;
  createdAt: string;
  updatedAt: string;
  user: Pick<
    User,
    "id" | "name" | "email" | "phone"
  >;
  shop: Shop;
  messages: Message[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiFieldError {
  field?: string;
  message: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}