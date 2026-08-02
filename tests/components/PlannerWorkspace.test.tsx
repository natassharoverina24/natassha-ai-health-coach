import { render, screen, within } from "@testing-library/react";

import { PlannerWorkspace } from "@/components/dashboard/PlannerWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildCoachDecision,
  buildPlannerUserContext,
} from "@/lib/ai/contextBuilder";
import type { CoachDecision } from "@/lib/engines/decisionEngine";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@/lib/ai/contextBuilder", () => ({
  buildCoachDecision: jest.fn(),
  buildPlannerUserContext: jest.fn(),
}));

const decision: CoachDecision = {
  insights: [],
  suppressedEngineNames: [],
  generatedAt: "2026-07-25T08:00:00.000Z",
};

const context = {
  today: "2026-07-25",
  currentHour: 8,
  currentMinute: 0,
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: false,
  calorieGoal: 1400,
  proteinGoalG: 110,
  waterGoalMl: 2000,
  workoutGoalMinPerDay: 30,
  stepsGoal: 8000,
  sleepGoalHours: 7,
};

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user-1" } });
  (buildCoachDecision as jest.Mock).mockReset().mockResolvedValue(decision);
  (buildPlannerUserContext as jest.Mock).mockReset().mockResolvedValue(context);
});

describe("PlannerWorkspace", () => {
  it("renders six schedule entries, exactly four daily meals, and seven weekly days", async () => {
    render(<PlannerWorkspace />);

    expect(
      await screen.findByRole("heading", { name: "Today's plan" }),
    ).toBeInTheDocument();
    const dailyPlan = screen.getByRole("heading", { name: "Today's plan" }).closest("section")!;
    expect(withinSection(dailyPlan, "Schedule").querySelectorAll("li")).toHaveLength(6);
    expect(withinSection(dailyPlan, "Meals").querySelectorAll("li")).toHaveLength(4);

    const week = screen.getByRole("list", { name: "Seven-day meal plan" });
    expect(week.children).toHaveLength(7);
    expect(within(week).getAllByText(/^sarapan$/i)).toHaveLength(7);
    expect(within(week).getAllByText(/^makan siang$/i)).toHaveLength(7);
    expect(within(week).getAllByText(/^snack$/i)).toHaveLength(7);
    expect(within(week).getAllByText(/^makan malam$/i)).toHaveLength(7);
    expect(
      screen.getAllByText(/daftar belanja dibuat dari meal plan mingguanmu/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Protein" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Peluang batch cooking" })).toBeInTheDocument();
  });

  it("uses a sanitized isolated error state when planner context cannot load", async () => {
    (buildCoachDecision as jest.Mock).mockRejectedValue(
      new Error("Firebase index https://console.firebase.google.com/private"),
    );
    render(<PlannerWorkspace />);

    expect(
      await screen.findByRole("heading", { name: "Planner data unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/no plan was invented/i);
    expect(document.body).not.toHaveTextContent(/firebase|console\.firebase/i);
    expect(screen.getByRole("button", { name: "Retry planner" })).toBeInTheDocument();
  });
});

function withinSection(container: HTMLElement, heading: string): HTMLElement {
  const element = Array.from(container.querySelectorAll("h3")).find(
    (candidate) => candidate.textContent === heading,
  )?.parentElement;
  if (!element) throw new Error(`Missing ${heading} section.`);
  return element;
}
