import Link from "next/link";
import {
  Calculator,
  CalendarDays,
  Camera,
  Soup,
  UtensilsCrossed,
} from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";

const ACTIONS = [
  {
    href: "/meal#meal-photo-analysis",
    label: "Analyse meal photo",
    icon: Camera,
  },
  {
    href: "/planner#daily-meal-plan",
    label: "View today’s meal plan",
    icon: UtensilsCrossed,
  },
  {
    href: "/planner#weekly-meal-plan",
    label: "View weekly meal plan",
    icon: CalendarDays,
  },
  {
    href: "/planner#energy-calculator",
    label: "View energy calculator",
    icon: Calculator,
  },
  {
    href: "/planner#office-lunch-optimizer",
    label: "View office lunch optimizer",
    icon: Soup,
  },
] as const;

export function PlannerNavigationCard() {
  return (
    <GlassCard>
      <section aria-labelledby="planner-navigation-heading">
        <h2 id="planner-navigation-heading" className="text-base font-semibold text-ink">
          Plans and tools
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Open deterministic plans and structured tools directly.
        </p>
        <nav
          aria-label="Planner features"
          className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-12 items-center gap-2 rounded-control bg-taupe-soft px-3 py-2 text-sm font-semibold text-ink hover:bg-petal-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
            >
              <Icon size={17} className="shrink-0 text-rose-strong" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </section>
    </GlassCard>
  );
}
