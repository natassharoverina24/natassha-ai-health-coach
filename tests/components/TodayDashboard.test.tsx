import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DashboardPage from "@/app/(app)/dashboard/page";
import { TodayDashboard } from "@/components/today";
import { useAuth } from "@/contexts/AuthContext";
import { useTodayCoachPlan } from "@/hooks";
import type { TodayCoachPlan } from "@/lib/coach-plan";
import { buildMealGuidance } from "@/lib/coach-plan/buildMealGuidance";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { timelineCompletionsRepository } from "@/lib/db/timelineCompletions.repository";
import { activeDisruptionsRepository } from "@/lib/db/activeDisruptions.repository";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateDailyPlan,
  generateMealPlan,
  generateOfficeLunchPlan,
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
jest.mock("@/lib/db/activeDisruptions.repository", () => ({
  activeDisruptionsRepository: {
    setActive: jest.fn(),
    clear: jest.fn(),
  },
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
  const tracedMeals = buildMealGuidance({
    decision,
    context,
    dailyPlan: daily,
    mealPlan,
    mealLogs: [],
    officeLunchPlan: null,
  });
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
      coachScore: {
        value: 0,
        unit: "/100",
        status: "ready",
        sourceIds: ["coach.daily-score"],
      },
      calories: {
        value: 0,
        unit: "kcal",
        status: "ready",
        target: daily.targets.calories,
        remaining: daily.targets.calories,
        progressPercent: 0,
        sourceIds: ["repository.meals"],
      },
      protein: {
        value: 0,
        unit: "g",
        status: "empty",
        target: daily.targets.proteinG,
        remaining: daily.targets.proteinG,
        progressPercent: 0,
        sourceIds: ["repository.meals"],
      },
      water: {
        value: 250,
        unit: "ml",
        status: "ready",
        target: daily.targets.waterMl,
        remaining: daily.targets.waterMl - 250,
        progressPercent: 13,
        sourceIds: ["repository.water"],
      },
      sleep: {
        value: null,
        unit: "h",
        status: "empty",
        target: daily.targets.sleepHours,
        remaining: null,
        progressPercent: null,
        sourceIds: ["repository.sleep"],
      },
      workout: {
        value: null,
        unit: "min",
        status: "unavailable",
        target: daily.targets.workoutMin,
        remaining: null,
        progressPercent: null,
        sourceIds: ["repository.workouts"],
      },
      calorieSummary: {
        status: "ready",
        caloriesEaten: { value: 700, unit: "kcal", status: "ready", sourceIds: ["repository.meals"] },
        workoutCaloriesBurned: { value: 200, unit: "kcal", status: "estimated", sourceIds: ["repository.workouts"] },
        netCalories: { value: 500, unit: "kcal", status: "ready", sourceIds: ["repository.meals", "repository.workouts"] },
        remainingCalories: { value: 900, unit: "kcal", status: "ready", sourceIds: ["planner.daily.targets.calories"] },
        targetCaloriesKcal: 1400,
        workoutEntryCount: 1,
        unresolvedWorkoutCount: 0,
        formula: "net = eaten - workout; remaining = target - net",
        sourceIds: ["repository.meals", "repository.workouts"],
      },
      body: {
        weightKg: {
          value: 65,
          unit: "kg",
          status: "ready",
          sourceIds: ["repository.weights"],
        },
        waistCm: {
          value: 75,
          unit: "cm",
          status: "ready",
          sourceIds: ["repository.waists"],
        },
        bmrKcal: {
          value: 1340,
          unit: "kcal",
          status: "estimated",
          sourceIds: ["coach.energy-calculator"],
        },
        tdeeKcal: {
          value: 1843,
          unit: "kcal",
          status: "estimated",
          sourceIds: ["coach.energy-calculator"],
        },
        deficitKcal: {
          value: 443,
          unit: "kcal",
          status: "estimated",
          sourceIds: ["coach.energy-calculator"],
        },
        trend: {
          metric: "weightKg",
          direction: "down",
          change: -0.5,
          unit: "kg",
          sourceIds: ["repository.weights"],
        },
      },
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
    adaptiveInsights: [],
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
        waists: { status: "available" },
        meals: { status: "available" },
        water: { status: "available" },
        workouts: { status: "available" },
        sleep: { status: "available" },
        cycles: { status: "available" },
        motivations: { status: "available" },
        timelineCompletions: { status: "available" },
        activeDisruption: { status: "empty" },
        adaptiveLearningHistory: { status: "empty" },
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
  window.localStorage.clear();
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
  (activeDisruptionsRepository.setActive as jest.Mock)
    .mockReset()
    .mockResolvedValue("user-1__2026-07-29");
  (activeDisruptionsRepository.clear as jest.Mock)
    .mockReset()
    .mockResolvedValue(undefined);
  refresh.mockClear();
});

describe("Today dashboard", () => {
  it("loads the Indonesian Today dashboard and renders all core sections", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: "Good morning from TodayCoachPlan." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Plan hari ini sudah siap 💗")).toBeInTheDocument();
    const briefing = screen.getByRole("heading", { name: "Ringkasan coach" }).closest("section");
    expect(briefing).not.toBeNull();
    expect(
      within(briefing!).queryByText("Follow the retained protein-first action."),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lihat ringkasan" }));
    expect(
      screen.getAllByText("Use the retained protein focus."),
    ).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Fokus hari ini" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Yang perlu dijaga" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kemenangan hari ini" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jadwal hari ini" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Panduan makan" })).toBeInTheDocument();
    const calorieSummary = screen.getByRole("heading", { name: "Ringkasan kalori hari ini" }).closest("section");
    expect(calorieSummary).not.toBeNull();
    expect(within(calorieSummary!).getByText("Kalori masuk")).toBeInTheDocument();
    expect(within(calorieSummary!).getByText("Kalori olahraga")).toBeInTheDocument();
    expect(within(calorieSummary!).getByText("Net kalori")).toBeInTheDocument();
    expect(within(calorieSummary!).getByText("Sisa kalori")).toBeInTheDocument();
    expect(within(calorieSummary!).getByText("700 kcal")).toBeInTheDocument();
    expect(within(calorieSummary!).getByText("200 kcal")).toBeInTheDocument();
    expect(within(calorieSummary!).getByText("500 kcal")).toBeInTheDocument();
    expect(within(calorieSummary!).getByText("900 kcal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ringkasan kesehatan" })).toBeInTheDocument();
    expect(screen.getByText("Progress utama hari ini")).toBeInTheDocument();
    expect(screen.getByText("Tubuh & energi")).toBeInTheDocument();
    expect(screen.getByText("0 /100")).toBeInTheDocument();
    expect(screen.getAllByText("estimasi")).toHaveLength(3);
    expect(screen.getByText("Remember the retained motivation.")).toBeInTheDocument();
    expect(screen.getAllByText(/Sisa setelah/)).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Ganti menu" })).toHaveLength(4);
  });

  it("shows a friendly partial calorie state while keeping available values", () => {
    const plan = makePlan();
    plan.metrics.calorieSummary = {
      ...plan.metrics.calorieSummary,
      status: "partial",
      workoutCaloriesBurned: {
        value: null,
        unit: "kcal",
        status: "empty",
        sourceIds: ["repository.workouts"],
      },
      netCalories: {
        value: 700,
        unit: "kcal",
        status: "ready",
        sourceIds: ["repository.meals", "repository.workouts"],
      },
      remainingCalories: {
        value: null,
        unit: "kcal",
        status: "empty",
        sourceIds: ["planner.daily.targets.calories"],
      },
      targetCaloriesKcal: null,
      workoutEntryCount: 0,
      unresolvedWorkoutCount: 0,
    };
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });

    render(<TodayDashboard />);
    const summary = screen.getByRole("heading", { name: "Ringkasan kalori hari ini" }).closest("section");
    expect(within(summary!).getAllByText("700 kcal")).toHaveLength(2);
    expect(within(summary!).getByText("0 kcal")).toBeInTheDocument();
    expect(within(summary!).getByText("—")).toBeInTheDocument();
    expect(within(summary!).getByText("Target kalori belum diset.")).toBeInTheDocument();
    expect(summary).not.toHaveTextContent(/Data sebagian|belum bisa dihitung|Infinity|NaN|undefined|null/);
  });

  it("shows a friendly meal action instead of an empty calorie grid", () => {
    const plan = makePlan();
    plan.metrics.calorieSummary = {
      ...plan.metrics.calorieSummary,
      status: "partial",
      caloriesEaten: {
        value: null,
        unit: "kcal",
        status: "empty",
        sourceIds: ["repository.meals"],
      },
      netCalories: {
        value: null,
        unit: "kcal",
        status: "empty",
        sourceIds: ["repository.meals", "repository.workouts"],
      },
      remainingCalories: {
        value: null,
        unit: "kcal",
        status: "empty",
        sourceIds: ["planner.daily.targets.calories"],
      },
      workoutCaloriesBurned: {
        value: null,
        unit: "kcal",
        status: "empty",
        sourceIds: ["repository.workouts"],
      },
      workoutEntryCount: 0,
    };
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });

    render(<TodayDashboard />);
    const summary = screen.getByRole("heading", { name: "Ringkasan kalori hari ini" }).closest("section");
    expect(within(summary!).getByText("Belum ada makanan yang dicatat. Yuk input makan pertamamu 💗")).toBeInTheDocument();
    expect(within(summary!).getByRole("link", { name: "Input makan" })).toHaveAttribute("href", "/meal");
    expect(within(summary!).queryByText("Kalori masuk")).not.toBeInTheDocument();
    expect(summary).not.toHaveTextContent(/Data sebagian|Infinity|NaN|undefined|null/);
  });

  it("renders a mobile-first action hub with eight working destinations", () => {
    render(<TodayDashboard />);

    const hub = screen.getByRole("navigation", { name: "Aksi cepat hari ini" });
    expect(within(hub).getAllByRole("link")).toHaveLength(8);
    expect(within(hub).getByRole("link", { name: "Input makan" })).toHaveAttribute("href", "/meal");
    expect(within(hub).getByRole("link", { name: "Office Lunch" })).toHaveAttribute(
      "href",
      "/planner#office-lunch-optimizer",
    );
    expect(within(hub).getByRole("link", { name: "Belanja" })).toHaveAttribute("href", "/shopping");
    expect(within(hub).getByRole("link", { name: "Plan berubah?" })).toHaveAttribute("href", "#plans-changed");
    expect(hub.querySelector("ul")).toHaveClass("grid-cols-2", "sm:grid-cols-4");
  });

  it("replaces raw Infinity workout copy with supportive Indonesian wording", async () => {
    const plan = makePlan();
    plan.briefing.retainedInsights = [
      ...plan.briefing.retainedInsights,
      {
        ...plan.briefing.retainedInsights[0],
        id: "workout-gap",
        summary: "Infinity days since the last workout.",
      },
    ];
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });
    const user = userEvent.setup();
    render(<TodayDashboard />);
    await user.click(screen.getByRole("button", { name: "Lihat ringkasan" }));

    expect(screen.getByText("Belum ada workout yang tercatat.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Infinity/);
    expect(document.body.innerHTML).not.toMatch(/(?:bg|text|to|from)-(?:green|teal)/);
  });

  it("opens practical alternatives and previews a selected approved replacement", async () => {
    const user = userEvent.setup();
    const plan = makePlan();
    const alternative = plan.meals.breakfast.alternatives[0];
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });

    render(<TodayDashboard />);
    const breakfastCard = screen.getByText(/^sarapan ·/i).closest("li");
    expect(breakfastCard).not.toBeNull();
    await user.click(within(breakfastCard!).getByRole("button", { name: "Ganti menu" }));

    expect(
      within(breakfastCard!).getByText(/pilih yang paling gampang kamu dapetin/i),
    ).toBeInTheDocument();
    await user.click(
      within(breakfastCard!).getByRole("button", {
        name: `Pilih ${alternative.name} untuk breakfast`,
      }),
    );
    expect(within(breakfastCard!).getByText("Menu pengganti dipilih 💗")).toBeInTheDocument();
    expect(
      within(breakfastCard!).getByText(
        "Cek porsinya dulu ya, supaya target kalori/protein hari ini bisa dihitung lebih pas.",
      ),
    ).toBeInTheDocument();
    expect(within(breakfastCard!).getAllByText(alternative.name)).toHaveLength(2);
    expect(within(breakfastCard!).getByRole("link", { name: /konfirmasi.*meal log/i })).toHaveAttribute(
      "href",
      "/meal",
    );
    expect(window.localStorage.getItem("natassha-meal-replacements-v1")).toContain(
      alternative.templateId,
    );
  });

  it("uses friendly portion-check copy for unapproved practical nutrition", async () => {
    const user = userEvent.setup();
    const plan = makePlan();
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });

    render(<TodayDashboard />);
    const breakfastCard = screen.getByText(/^sarapan ·/i).closest("li");
    await user.click(within(breakfastCard!).getByRole("button", { name: "Ganti menu" }));
    expect(within(breakfastCard!).getAllByText(/Cek porsi/).length).toBeGreaterThan(0);
    expect(within(breakfastCard!).queryByText(/Perlu konfirmasi/)).not.toBeInTheDocument();
  });

  it("shows a friendly manual fallback when approved meal alternatives are empty", async () => {
    const user = userEvent.setup();
    const plan = makePlan();
    plan.meals.breakfast.alternatives = [];
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });

    render(<TodayDashboard />);
    const breakfastCard = screen.getByText(/^sarapan ·/i).closest("li");
    await user.click(within(breakfastCard!).getByRole("button", { name: "Ganti menu" }));
    expect(
      within(breakfastCard!).getByText(/belum ada opsi ganti yang cocok/i),
    ).toBeInTheDocument();
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

    expect(screen.getByText(/plan intinya sudah siap/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jadwal hari ini" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Panduan makan" })).toBeInTheDocument();
  });

  it("renders Office Lunch guidance inside the lunch recommendation", () => {
    const plan = makePlan();
    const officeLunchPlan = generateOfficeLunchPlan(
      decision,
      { ...context, lunchProvidedByOffice: true },
      { calories: 700, proteinG: 50 },
    );
    plan.meals.lunch.officeLunchAdjustment = {
      plan: officeLunchPlan,
      sourceIds: ["planner.office-lunch"],
    };
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });

    render(<TodayDashboard />);

    expect(screen.getByText("Penyesuaian makan siang kantor")).toBeInTheDocument();
    expect(screen.getByText(/Eat: Rice/)).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Tambah 250 ml air" }));

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
    expect(screen.getByText("Sudah dicatat dari aksi cepat: 250 ml.")).toBeInTheDocument();
    expect(screen.getByText(/air yang ditambahkan sesi ini: 250 ml/i)).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Tandai selesai" }));

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

    await user.click(screen.getByRole("button", { name: "Tambah 500 ml air" }));

    expect(
      await screen.findByText("Airnya belum berhasil dicatat. Coba lagi ya."),
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

  it("requires disruption-specific fields before saving", async () => {
    const user = userEvent.setup();
    render(<TodayDashboard />);

    await user.selectOptions(
      screen.getByLabelText("What changed?"),
      "working-late",
    );
    expect(
      screen.getByRole("button", { name: "Adjust today's plan" }),
    ).toBeDisabled();
    expect(activeDisruptionsRepository.setActive).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Expected finish time"), "21:00");
    await user.click(
      screen.getByRole("button", { name: "Adjust today's plan" }),
    );

    await waitFor(() =>
      expect(activeDisruptionsRepository.setActive).toHaveBeenCalledWith({
        userId: "user-1",
        date: "2026-07-29",
        startedAt: expect.any(String),
        type: "working-late",
        expectedEndAt: "21:00",
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("saves feeling-unwell without irrelevant optional fields", async () => {
    const user = userEvent.setup();
    render(<TodayDashboard />);

    await user.selectOptions(
      screen.getByLabelText("What changed?"),
      "feeling-unwell",
    );
    await user.click(
      screen.getByRole("button", { name: "Adjust today's plan" }),
    );

    await waitFor(() =>
      expect(activeDisruptionsRepository.setActive).toHaveBeenCalledWith({
        userId: "user-1",
        date: "2026-07-29",
        startedAt: expect.any(String),
        type: "feeling-unwell",
      }),
    );
    const submitted =
      (activeDisruptionsRepository.setActive as jest.Mock).mock.calls[0][0];
    expect(Object.keys(submitted).sort()).toEqual(
      ["date", "startedAt", "type", "userId"].sort(),
    );
  });

  it("gives every Emergency Mode field a unique id and name", async () => {
    const user = userEvent.setup();
    render(<TodayDashboard />);
    const disruptionType = screen.getByLabelText("What changed?");
    expect(disruptionType).toHaveAttribute("id", "emergency-disruption-type");
    expect(disruptionType).toHaveAttribute(
      "name",
      "emergencyDisruptionType",
    );

    await user.selectOptions(disruptionType, "working-late");
    expect(screen.getByLabelText("Expected finish time")).toHaveAttribute(
      "id",
      "emergency-expected-end-at",
    );
    expect(screen.getByLabelText("Expected finish time"))
      .toHaveAttribute("name", "emergencyExpectedEndAt");

    await user.selectOptions(disruptionType, "travelling");
    expect(screen.getByLabelText("Affected slot")).toHaveAttribute(
      "id",
      "emergency-affected-slot",
    );
    expect(screen.getByLabelText("Affected slot"))
      .toHaveAttribute("name", "emergencyAffectedSlot");

    await user.selectOptions(disruptionType, "event-or-reception");
    expect(screen.getByLabelText("Affected meal")).toHaveAttribute(
      "id",
      "emergency-affected-meal-slot",
    );
    expect(screen.getByLabelText("Affected meal"))
      .toHaveAttribute("name", "emergencyAffectedMealSlot");

    await user.selectOptions(disruptionType, "skipped-meal");
    expect(screen.getByLabelText("Skipped meal")).toHaveAttribute(
      "id",
      "emergency-skipped-meal-slot",
    );
    expect(screen.getByLabelText("Skipped meal"))
      .toHaveAttribute("name", "emergencySkippedMealSlot");
    expect(screen.getByLabelText("Time skipped")).toHaveAttribute(
      "id",
      "emergency-skipped-at",
    );
    expect(screen.getByLabelText("Time skipped"))
      .toHaveAttribute("name", "emergencySkippedAt");

    const fields = [
      disruptionType,
      screen.getByLabelText("Skipped meal"),
      screen.getByLabelText("Time skipped"),
    ];
    expect(new Set(fields.map((field) => field.id)).size).toBe(fields.length);
  });

  it("renders a non-blaming adjustment and clears it for the same date", async () => {
    const plan = makePlan();
    plan.emergencyAdjustment = {
      value: {
        type: "migraine",
        message: "We'll adjust the plan gently based on what you selected.",
        changedTimelineItemIds: [`${plan.date}:lunch`],
        preservedTargets: ["calories", "protein"],
        removedActions: ["Keep planned lunch"],
        replacementActions: ["Keep the existing meal simple and practical"],
        sourceIds: ["active-disruption:user-1__2026-07-29"],
      },
      sourceIds: ["active-disruption:user-1__2026-07-29"],
    };
    (useTodayCoachPlan as jest.Mock).mockReturnValue({
      plan,
      loading: false,
      refreshing: false,
      error: null,
      refresh,
    });
    const user = userEvent.setup();
    render(<TodayDashboard />);

    expect(
      screen.getByText("Nggak perlu merasa bersalah. Plan hari ini sudah disesuaikan 💗"),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/migraine detected|diagnos/i);
    await user.click(screen.getByRole("button", { name: "Undo adjustment" }));

    expect(activeDisruptionsRepository.clear).toHaveBeenCalledWith(
      "user-1",
      "2026-07-29",
      expect.any(String),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("hides raw repository errors when emergency mode save fails", async () => {
    (activeDisruptionsRepository.setActive as jest.Mock).mockRejectedValue(
      new Error("Firebase index https://console.firebase.google.com/private"),
    );
    const user = userEvent.setup();
    render(<TodayDashboard />);

    await user.selectOptions(
      screen.getByLabelText("What changed?"),
      "feeling-unwell",
    );
    await user.click(
      screen.getByRole("button", { name: "Adjust today's plan" }),
    );

    expect(
      await screen.findByText(
        "Penyesuaian hari ini belum berhasil disimpan. Coba lagi ya.",
      ),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/firebase|console|index url/i);
  });
});
