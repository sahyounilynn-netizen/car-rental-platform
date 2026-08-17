import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-green-200 bg-[var(--success-bg)] text-[var(--success-text)]",
  AVAILABLE: "border-green-200 bg-[var(--success-bg)] text-[var(--success-text)]",
  CONFIRMED: "border-blue-200 bg-[var(--info-bg)] text-[var(--info-text)]",
  PENDING: "border-amber-200 bg-[var(--warning-bg)] text-[var(--warning-text)]",
  COMPLETED: "border-slate-200 bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
  CANCELLED: "border-red-200 bg-[var(--error-bg)] text-[var(--error-text)]",
  SUSPENDED: "border-red-200 bg-[var(--error-bg)] text-[var(--error-text)]",
  MAINTENANCE: "border-amber-200 bg-[var(--warning-bg)] text-[var(--warning-text)]",
  RENTED: "border-blue-200 bg-[var(--info-bg)] text-[var(--info-text)]",
  INACTIVE: "border-slate-200 bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
  USER: "border-slate-200 bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
  ADMIN: "border-slate-200 bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
  SUPERADMIN: "border-slate-200 bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
  SHOP: "border-slate-200 bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
  CAR: "border-slate-200 bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
  BOOKING: "border-slate-200 bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
};

export function StatusBadge({ status }: { status: string | ReactNode }) {
  const label = String(status);
  return <Badge className={STATUS_STYLES[label] ?? "border-slate-200 bg-slate-100 text-slate-700"}>{status}</Badge>;
}
