import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

/**
 * The app's signature surface: a frosted-glass, rounded card used for
 * every dashboard stat, list row container, and panel. Keep visual variance
 * (padding, radius) here so pages never hand-roll their own card look.
 */
export function GlassCard({
  className,
  padding = "md",
  interactive = false,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass rounded-card shadow-[var(--shadow-card)]",
        paddingMap[padding],
        interactive &&
          "cursor-pointer transition-transform duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
