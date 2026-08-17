import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
        <textarea
        className={cn(
          "transition-soft flex min-h-28 w-full rounded-[10px] border border-input bg-card px-3.5 py-3 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
