import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("page-intro", className)}>
      <div className="space-y-2">
        {eyebrow ? <p className="page-intro-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-intro-title text-balance">{title}</h1>
        {description ? <p className="page-intro-description">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
