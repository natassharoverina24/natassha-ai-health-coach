"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileBarChart,
  LayoutDashboard,
  Pill,
  Scale,
  Settings as SettingsIcon,
  ShoppingCart,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";

import { NAV_ITEMS, APP_NAME } from "@/lib/utils/constants";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard,
  Scale,
  UtensilsCrossed,
  TrendingUp,
  ShoppingCart,
  Pill,
  FileBarChart,
  Settings: SettingsIcon,
};

/** Persistent left rail on tablet/desktop. Hidden below the `md` breakpoint in favor of BottomNav. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 rounded-r-card p-5 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose text-white font-bold">
          N
        </span>
        <span className="text-sm font-bold leading-tight text-ink">{APP_NAME}</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-rose text-white shadow-[0_10px_24px_-10px_rgba(255,107,157,0.6)]"
                  : "text-ink-muted hover:bg-ink/5 hover:text-ink",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
