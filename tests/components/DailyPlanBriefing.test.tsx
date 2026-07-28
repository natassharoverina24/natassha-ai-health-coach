import { render, screen, within } from "@testing-library/react";

import { DailyPlanBriefing } from "@/components/dashboard/DailyPlanBriefing";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateDailyPlan,
  generateMealPlan,
  type PlannerUserContext,
} from "@/lib/planner";
import { DEFAULT_GOALS } from "@/lib/utils/constants";

const decision: CoachDecision = {
  insights: [],
  suppressedEngineNames: [],
  generatedAt: "2026-07-25T08:00:00.000Z",
};

const context: PlannerUserContext = {
  today: "2026-07-25",
  currentHour: 8,
  currentMinute: 0,
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: false,
  ...DEFAULT_GOALS,
};

function renderBriefing() {
  render(
    <DailyPlanBriefing
      dailyPlan={generateDailyPlan(decision, context)}
      mealPlan={generateMealPlan(decision, context)}
    />,
  );
}

describe("DailyPlanBriefing", () => {
  it("renders every stored daily target and schedule slot", () => {
    renderBriefing();

    expect(screen.getByRole("heading", { name: "Today's plan" })).toBeInTheDocument();
    expect(screen.getByText("1400 kcal")).toBeInTheDocument();
    expect(screen.getByText("110 g")).toBeInTheDocument();
    expect(screen.getByText("2000 ml")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("8.000")).toBeInTheDocument();
    expect(screen.getByText("7 h")).toBeInTheDocument();

    for (const label of [
      "Breakfast",
      "Lunch",
      "Snack",
      "Dinner",
      "Workout",
      "Water reminder",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("renders all four approved meal recommendations", () => {
    renderBriefing();
    const mealsSection = screen.getByRole("heading", { name: "Meals" }).parentElement!;

    for (const slot of ["Breakfast", "Lunch", "Snack", "Dinner"]) {
      expect(within(mealsSection).getByText(slot)).toBeInTheDocument();
    }
    expect(
      within(mealsSection).getAllByLabelText(
        /kilocalories and \d+ grams protein$/,
      ),
    ).toHaveLength(4);
  });

  it("shows existing planner reasons without generating new recommendations", () => {
    const mealPlan = generateMealPlan(decision, context);
    renderBriefing();

    for (const recommendation of Object.values(mealPlan)) {
      expect(screen.getByText(recommendation.reason)).toBeInTheDocument();
    }
  });
});
