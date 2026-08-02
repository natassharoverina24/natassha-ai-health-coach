import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold",
  {
    variants: {
      tone: {
        rose: "bg-petal-soft text-rose-strong",
        taupe: "bg-taupe-soft text-rose-strong",
        amber: "bg-amber-soft text-amber",
        neutral: "bg-ink/5 text-ink-muted",
        success: "bg-success/15 text-success",
        danger: "bg-danger/15 text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
