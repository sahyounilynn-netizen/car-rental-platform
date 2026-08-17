import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("w-full rounded-xl border px-4 py-3 text-sm leading-6 shadow-none", {
  variants: {
    variant: {
      default: "border-border bg-card text-foreground",
      destructive: "border-red-200 bg-[var(--error-bg)] text-[var(--error-text)]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant, className }))} {...props} />
  ),
);
Alert.displayName = "Alert";

export { Alert };
