import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DashboardPage from "@/app/(app)/dashboard/page";
import { TodayDashboard } from "@/components/today";
import { useAuth } from "@/contexts/AuthContext";
import { useTodayCoachPlan } from "@/hooks";
import type { TodayCoachPlan } from "@/lib/coach-plan";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { timelineCompletionsRepository } from "@/lib/db/timelineCompletions.repository";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateDailyPlan,
  generateMealPlan,
  type PlannerUserContext,
} from "@/lib/planner";
import { reconcileTimelineStatus } from "@/lib/coach-plan/reconcileTimelineStatus";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@/hooks", () => ({
  useTodayCoachPlan: jest.fn(),
}));
jest.mock("@/lib/db/waterLogs.repository", () => ({
  waterLogsRepository: { create: jest.fn() },
}));
jest.mock("@/lib/db/timelineCompletions.repository", () => ({
  timelineCompletionsRepository: { markCompleted: jest.fn() },
}));

const decision: CoachDecision = {
  insights: [
    {
      id: "nutrition.protein_first",
      engine: "nutrition",
      priority: "high",
      urgency: "soon",
      tone: "encouraging",
      summary: "Use the retained protein focus.",
      reason: "This is an existing retained insight.",
      recommendedAction: "Follow the retained protein-first action.",
    },
  ],
  suppressedEngineNames: [],
  generatedAt: "2026-07-29T08:00:00.000Z",
};

const context: PlannerUserContext = {
  today: "2026-07-29",
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

function makePlan(status: TodayCoachPlan["status"] = "ready"): TodayCoachPlan {
  const daily = generateDailyPlan(decision, context);
  const mealPlan = generateMealPlan(decision, context);
  const tracedMeals = Object.fromEntries(
    Object.entries(mealPlan).map(([slot, meal]) => [
      slot,
      { ...meal, sourceIds: [`planner.meal.${slot}`] },
    ]),
  ) as TodayCoachPlan["meals"];
  const timeline = reconcileTimelineStatus({
    date: context.today,
    currentDate: context.today,
    dailyPlan: daily,
    meals: tracedMeals,
    evidence: {
      mealLogs: [],
      waterLogs: [],
      workoutLogs: [],
      manualCompletions: [],
    },
  });

  return {
    generatedAt: decision.generatedAt,
    date: context.today,
    status,
    greeting: {
      value: "Good morning from TodayCoachPlan.",
      sourceIds: ["coach-plan.static-greeting"],
    },
    briefing: {
      retainedInsights: decision.insights,
      encouragement: {
        value: "Remember the retained motivation.",
        sourceIds: ["why.motivation"],
      },
      sourceIds: [decision.insights[0].id],
    },
    focus: {
      value: daily.summary.topPriority!,
      sourceIds: [decision.insights[0].id],
    },
    biggestRisk: {
      value: daily.summary.biggestRisk!,
      sourceIds: [decision.insights[0].id],
    },
    todaysWin: {
      value: {
        id: "behavior.consistency_reinforcement",
        summary: "A retained win is available.",
        recommendedAction: "Keep the retained routine.",
      },
      sourceIds: ["behavior.consistency_reinforcement"],
    },
    timeline,
    meals: tracedMeals,
    metrics: {
      value: daily.targets,
      sourceIds: ["planner.daily.targets"],
    },
    officeLunch: null,
    emergencyAdjustment: null,
    adaptiveAdjustments: {
      value: {
        status: "not-applicable",
        reason: "no-retained-adaptive-insight",
      },
      sourceIds: ["planner.adaptive-adjustments"],
    },
    weeklyContext: null,
    dataAvailability: {
      decision: "available",
      dailyPlan: "available",
      mealPlan: "available",
      officeLunch: "unavailable",
      emergencyAdjustment: "unavailable",
      adaptiveAdjustments: "not-applicable",
      weeklyContext: "unavailable",
      timelineStatus: {
        mealLogs: "available",
        waterLogs: "available",
        workoutLogs: "available",
        manualCompletions: "available",
      },
      sources: {
        profile: { status: "available" },
        settings: { status: "available" },
        currentDateTime: { status: "available" },
        weights: { status: "available" },
        meals: { status: "available" },
        water: { status: "available" },
        workouts: { status: "available" },
        sleep: { status: "available" },
        cycles: { status: "available" },
        motivations: { status: "available" },
        timelineCompletions: { status: "available" },
      },
      cache: { status: "empty" },
    },
    warnings:
      status === "partial"
        ? [
            {
              code: "office-lunch-budget-unavailable",
              message: "Office lunch guidance is waiting for budget data.",
              sourceIds: ["planner.office-lunch"],
            },
            {
              code: "weekly-planning-input-unavailable",
              message: "Weekly planning is waiting for approved input.",
              sourceIds: ["planner.weekly-meal-prep"],
            },
          ]
        : [],
  };
}

const refresh = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user-1" } });
  (useTodayCoachPlan as jest.Mock).mockReturnValue({
    plan: makePlan(),
    loading: false,
    refreshing: false,
    error: null,
    refresh,
  });
  (waterLogsRepository.create as jest.Mock).mockReset().mockResolvedValue({
    id: "water-1",
  });
  (timelineCompletionsRepository.markCompleted as jest.Mock)
    .mockReset()
    .mockResolvedValue("completion-1");
  refresh.mockClear();
});

describe("Today dashboard", () => {
  it("loads the dashboard route from one TodayCoachPlan and renders all core sections", () => {
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: "Good morning from TodayCoachPlan." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Coach briefing" })).toBeInTheDocument();
    expect(
      screen.getAllByText("Use the retained protein focus."),
    ).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Today’s Focus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Biggest Risk" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today’s Win" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meal summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today’s metrics" })).toBeInTheDocument();
    expect(screen.getByText("Remember the retained motivation.")).toBeInTheDocument();
    expect(screen.getAllByText(/g protein$/)).toHaveLength(4);
  });

  it("keeps the complete core plan visible for partial status", () => {
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan: makePlan("partial"),
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });

    render(<TodayDashboard />);

    expect(screen.getByText(/today’s core plan is ready/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meal summary" })).toBeInTheDocument();
  });

  it("logs water and reflects the update without exposing technical errors", async () => {
    const user = userEvent.setup();
    const initialPlan = makePlan();
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan: initialPlan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });
    const { rerender } = render(<TodayDashboard />);
    const waterAction = initialPlan.timeline.find(
      (item) => item.kind === "waterReminder",
    )!.action;

    await user.click(screen.getByRole("button", { name: "Add 250 ml water" }));

    await waitFor(() =>
      expect(waterLogsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          date: "2026-07-29",
          amountMl: 250,
          loggedAt: expect.any(String),
        }),
      ),
    );
    expect(screen.getByText("Logged from quick actions: 250 ml.")).toBeInTheDocument();
    expect(screen.getByText(/water added with quick log this session: 250 ml/i)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);

    const refreshedPlan = makePlan();
    refreshedPlan.timeline = reconcileTimelineStatus({
      date: context.today,
      currentDate: context.today,
      dailyPlan: generateDailyPlan(decision, context),
      meals: refreshedPlan.meals,
      evidence: {
        mealLogs: [],
        waterLogs: [{ id: "water-1" }],
        workoutLogs: [],
        manualCompletions: [],
      },
    });
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan: refreshedPlan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });
    rerender(<TodayDashboard />);
    const hydrationItem = screen.getByText(waterAction).closest("li");
    expect(hydrationItem).not.toBeNull();
    expect(
      within(hydrationItem!).getByLabelText("Status: completed"),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/firebase|stack trace|index url/i);
  });

  it("persists completion only for a manual non-log timeline item", async () => {
    const user = userEvent.setup();
    const plan = makePlan();
    plan.timeline = [
      {
        ...plan.timeline[0],
        id: `${plan.date}:sleepPreparation`,
        kind: "sleepPreparation",
        action: "Prepare for sleep",
        reason: "Uses an existing scheduled time.",
        completionSource: "manual",
        manualCompletionAllowed: true,
      },
      ...plan.timeline.slice(1),
    ];
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });
    render(<TodayDashboard />);

    await user.click(screen.getByRole("button", { name: "Mark complete" }));

    expect(
      timelineCompletionsRepository.markCompleted,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        date: plan.date,
        itemId: `${plan.date}:sleepPreparation`,
        completedAt: expect.any(String),
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows a friendly water error without refreshing or exposing technical details", async () => {
    (waterLogsRepository.create as jest.Mock).mockRejectedValue(
      new Error("Firebase index https://console.firebase.google.com/private"),
    );
    const user = userEvent.setup();
    render(<TodayDashboard />);

    await user.click(screen.getByRole("button", { name: "Add 500 ml water" }));

    expect(
      await screen.findByText("Water could not be logged. Please try again."),
    ).toBeInTheDocument();
    expect(waterLogsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        date: "2026-07-29",
        amountMl: 500,
        loggedAt: expect.any(String),
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent(/firebase|console|index url/i);
  });
});
