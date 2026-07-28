import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlanningToolsPanel } from "@/components/dashboard/PlanningToolsPanel";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import {
  generateDailyPlan,
  generateMealPlan,
  type PlannerUserContext,
} from "@/lib/planner";
import { DEFAULT_GOALS } from "@/lib/utils/constants";

const context: PlannerUserContext = {
  today: "2026-07-25",
  currentHour: 8,
  currentMinute: 0,
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: false,
  ...DEFAULT_GOALS,
};

const baseDecision: CoachDecision = {
  insights: [],
  suppressedEngineNames: [],
  generatedAt: "2026-07-25T08:00:00.000Z",
};

function makeInsight(
  id: string,
  recommendedAction = "Keep the retained action.",
): EngineInsight {
  return {
    id,
    engine: "adaptiveLearning",
    priority: "medium",
    urgency: "soon",
    tone: "neutral",
    summary: "A retained pattern is available.",
    reason: "The pattern was retained by the Decision Engine.",
    recommendedAction,
  };
}

function renderPanel(
  decision = baseDecision,
  plannerContext = context,
) {
  render(
    <PlanningToolsPanel
      decision={decision}
      context={plannerContext}
      dailyPlan={generateDailyPlan(decision, plannerContext)}
      mealPlan={generateMealPlan(decision, plannerContext)}
    />,
  );
}

describe("PlanningToolsPanel", () => {
  it("renders all completed planning integrations and their empty states", () => {
    renderPanel();

    for (const heading of [
      "Energy calculator",
      "Office lunch optimizer",
      "Weekly meal prep",
      "Emergency planner",
      "Adaptive adjustments",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }

    expect(
      screen.getByText(/approved production ingredient catalogue is not configured/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no retained adaptive adjustment applies today/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/select a current disruption/i),
    ).toBeInTheDocument();
  });

  it("collects accessible metric inputs and renders deterministic energy output", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText("Weight"), "60");
    await user.type(screen.getByLabelText("Height"), "165");
    await user.type(screen.getByLabelText("Age"), "30");
    await user.selectOptions(screen.getByLabelText("Sex"), "female");
    await user.selectOptions(screen.getByLabelText("Activity level"), "moderate");
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    expect(screen.getByText("1320 kcal")).toBeInTheDocument();
    expect(screen.getByText("2046 kcal")).toBeInTheDocument();
    expect(screen.getByText(/informational only/i)).toBeInTheDocument();
  });

  it("renders field-specific invalid energy input without medical content", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Calculate" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("weightKg must be positive");
    expect(alert).not.toHaveTextContent(/thyroid|medical|supplement|medication/i);
  });

  it("renders Office Lunch not-applicable and applicable results safely", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <PlanningToolsPanel
        decision={baseDecision}
        context={context}
        dailyPlan={generateDailyPlan(baseDecision, context)}
        mealPlan={generateMealPlan(baseDecision, context)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Optimize lunch" }));
    expect(
      screen.getByText(/lunch is not office-provided/i),
    ).toBeInTheDocument();

    unmount();
    const officeContext = { ...context, lunchProvidedByOffice: true };
    render(
      <PlanningToolsPanel
        decision={baseDecision}
        context={officeContext}
        dailyPlan={generateDailyPlan(baseDecision, officeContext)}
        mealPlan={generateMealPlan(baseDecision, officeContext)}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Optimize lunch" }));

    const optimizer = screen
      .getByRole("heading", { name: "Office lunch optimizer" })
      .closest("section")!;
    expect(within(optimizer).getAllByRole("listitem")).toHaveLength(11);
  });

  it("renders emergency success, invalid-input, and not-applicable states", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Generate fallback" }));
    expect(screen.getByText(/Lunch:/)).toBeInTheDocument();
    expect(screen.getByText(/Snack:/)).toBeInTheDocument();
    expect(screen.getByText(/Dinner:/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Time"));
    await user.click(screen.getByRole("button", { name: "Generate fallback" }));
    expect(screen.getByRole("alert")).toHaveTextContent("invalid clock");

    await user.selectOptions(screen.getByLabelText("Disruption"), "travel");
    for (const slot of ["Breakfast", "Snack", "Dinner"]) {
      await user.click(screen.getByRole("checkbox", { name: slot }));
    }
    await user.click(screen.getByRole("button", { name: "Generate fallback" }));
    expect(screen.getByText(/no safe fallback is applicable/i)).toBeInTheDocument();
  });

  it("renders only adjustments retained by the Decision Engine", () => {
    const decision: CoachDecision = {
      ...baseDecision,
      insights: [makeInsight("adaptive.low_hydration_pattern")],
    };
    renderPanel(decision);

    expect(screen.getByText(/earlier water reminder/i)).toBeInTheDocument();
    expect(
      screen.getByText(/adaptive\.low_hydration_pattern/i),
    ).toBeInTheDocument();
  });

  it("does not fabricate a shopping list or medical guidance", () => {
    renderPanel();

    expect(screen.queryByText(/shopping item:/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/no shopping list or batch-cooking quantities were generated/i),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /thyroid diet|supplement recommendation|medication advice/i,
    );
  });
});
