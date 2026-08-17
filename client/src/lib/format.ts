import { ApiError } from "@/lib/api";

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function toBookingDate(value: string) {
  return `${value}T10:00:00.000Z`;
}

export function getApiMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return "Unable to reach the server. Start the backend and database, then try again.";
    }
    if ([502, 503, 504].includes(error.status)) {
      return "The backend is unavailable right now. Start the API and database, then try again.";
    }
    return error.fieldErrors?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong";
}
