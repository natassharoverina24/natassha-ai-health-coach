import { cn } from "@/lib/utils/cn";

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("inline-block animate-spin rounded-full border-2 border-rose/30 border-t-rose", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
