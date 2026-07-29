import { render, screen } from "@testing-library/react";

import { PlannerNavigationCard } from "@/components/dashboard/PlannerNavigationCard";

describe("PlannerNavigationCard", () => {
  it("exposes compact, accessible links to the primary planning features", () => {
    render(<PlannerNavigationCard />);

    expect(screen.getByRole("navigation", { name: "Planner features" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analyse meal photo" })).toHaveAttribute(
      "href",
      "/meal#meal-photo-analysis",
    );
    expect(screen.getByRole("link", { name: "View today’s meal plan" })).toHaveAttribute(
      "href",
      "/planner#daily-meal-plan",
    );
    expect(screen.getByRole("link", { name: "View weekly meal plan" })).toHaveAttribute(
      "href",
      "/planner#weekly-meal-plan",
    );
    expect(screen.getByRole("link", { name: "View energy calculator" })).toHaveAttribute(
      "href",
      "/planner#energy-calculator",
    );
    expect(
      screen.getByRole("link", { name: "View office lunch optimizer" }),
    ).toHaveAttribute("href", "/planner#office-lunch-optimizer");
  });
});
