import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16) / 255,
  );
  const linear = channels.map((value) =>
    value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(left: string, right: string): number {
  const values = [relativeLuminance(left), relativeLuminance(right)].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("Romantic Blush visual system", () => {
  it("centralizes the approved warm palette and removes teal tokens", () => {
    const css = source("src/app/globals.css");
    for (const color of [
      "#e8e1d1",
      "#d8b69f",
      "#c38380",
      "#9c7164",
      "#4b342c",
      "#f7f2ee",
      "#fff9f6",
    ]) {
      expect(css.toLowerCase()).toContain(color);
    }
    expect(css).not.toMatch(/--color-(?:teal|green)|#3fbfb0|#4fd6c6/i);
  });

  it("keeps core dashboard, planner, shopping, and supplement UI free of decorative green or teal classes", () => {
    const core = [
      "src/components/today/TodayDashboard.tsx",
      "src/components/today/TodayQuickActionHub.tsx",
      "src/components/dashboard/PlanningToolsPanel.tsx",
      "src/components/dashboard/WeeklyMealPlanExperience.tsx",
      "src/components/shopping/AutoShoppingList.tsx",
      "src/components/supplements/TodaySupplementPlan.tsx",
    ]
      .map(source)
      .join("\n");
    expect(core).not.toMatch(/(?:bg|text|border|from|to)-(?:green|teal|emerald|cyan|lime)/i);
  });

  it("uses warm accessible controls and taupe progress styling", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <ProgressBar value={50} tone="taupe" label="Water" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass(
      "bg-rose-strong",
      "text-white",
    );
    expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass(
      "bg-petal",
      "text-ink",
    );
    expect(screen.getByRole("progressbar", { name: "Water" }).firstChild).toHaveClass(
      "bg-taupe",
    );
    expect(contrast("#8A5C55", "#FFF9F6")).toBeGreaterThanOrEqual(4.5);
  });
});
