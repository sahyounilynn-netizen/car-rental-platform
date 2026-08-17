import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "transition-soft inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-semibold shadow-none outline-none ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)] focus-visible:ring-4 focus-visible:ring-[color:var(--ring)]",
        outline:
          "border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-4 focus-visible:ring-[color:var(--ring)]",
        secondary:
          "border border-blue-200 bg-secondary text-secondary-foreground hover:bg-blue-100 focus-visible:ring-4 focus-visible:ring-[color:var(--ring)]",
        ghost:
          "text-slate-600 hover:bg-accent hover:text-accent-foreground focus-visible:ring-4 focus-visible:ring-[color:var(--ring)]",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-4 focus-visible:ring-red-200",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 rounded-[9px] px-3 text-xs",
        lg: "h-11 rounded-[10px] px-6 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button };
