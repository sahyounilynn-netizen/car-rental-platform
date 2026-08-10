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
    return error.fieldErrors?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong";
}
