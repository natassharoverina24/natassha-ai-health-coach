"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Scale, TrendingUp, UtensilsCrossed, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils/cn";

const PRIMARY = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/weight", label: "Weight", icon: Scale },
  { href: "/meal", label: "Meal", icon: UtensilsCrossed },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/settings", label: "More", icon: MoreHorizontal },
];

/** Fixed bottom tab bar for phones. A curated 5-item subset of NAV_ITEMS. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-pill px-2 py-2 shadow-[var(--shadow-float)] md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      {PRIMARY.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-pill px-3 py-1.5 text-[11px] font-medium transition-colors",
              active ? "text-rose-strong" : "text-ink-muted",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
