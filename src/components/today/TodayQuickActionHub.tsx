import Link from "next/link";
import {
  Apple,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Eye,
  Pill,
  ShoppingBasket,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";

const ACTIONS = [
  { label: "Input makan", href: "/meal", icon: Apple },
  { label: "Office Lunch", href: "/planner#office-lunch-optimizer", icon: UtensilsCrossed },
  { label: "Meal Plan", href: "/planner#daily-meal-plan", icon: CalendarDays },
  { label: "Progress", href: "/progress", icon: ChartNoAxesColumnIncreasing },
  { label: "Belanja", href: "/shopping", icon: ShoppingBasket },
  { label: "Supplements", href: "/supplements", icon: Pill },
  { label: "Plan berubah?", href: "#plans-changed", icon: TriangleAlert },
  { label: "Yang aku notice", href: "#things-i-noticed", icon: Eye },
] as const;

export function TodayQuickActionHub() {
  return (
    <GlassCard padding="sm">
      <nav aria-label="Aksi cepat hari ini">
        <h2 className="text-base font-semibold text-ink">Mau ngapain dulu?</h2>
        <p className="mt-1 text-xs text-ink-muted">Pilih yang kamu butuhkan sekarang 💗</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACTIONS.map(({ label, href, icon: Icon }) => (
            <li key={label}>
              <Link
                href={href}
                className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-control border border-rose-strong/15 bg-petal-soft/65 px-2 py-3 text-center text-sm font-semibold text-ink transition hover:border-rose-strong/35 hover:bg-petal-soft"
              >
                <Icon size={20} className="text-rose-strong" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </GlassCard>
  );
}
