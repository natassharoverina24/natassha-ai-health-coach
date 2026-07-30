import { buildAdaptiveInsights } from "@/lib/adaptive-learning";
import type {
  ActiveDisruption,
  MealEntry,
  MealType,
  WaterLogEntry,
} from "@/types/firestore";

const referenceDate = "2026-07-30";
const dates = [
  "2026-07-24",
  "2026-07-25",
  "2026-07-26",
  "2026-07-27",
  "2026-07-28",
  "2026-07-29",
  "2026-07-30",
];

function meal(date: string, type: MealType, proteinG = 10): MealEntry {
  return {
    id: `${date}-${type}`,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    userId: "user-1",
    date,
    type,
    name: `${type} fixture`,
    quantity: "1 serving",
    isOfficeLunch: false,
    macros: {
      calories: 200,
      proteinG,
      carbsG: 20,
      fatG: 5,
      fiberG: 2,
    },
    photoIds: [],
    score: null,
    note: null,
  };
}

function water(date: string, amountMl = 500): WaterLogEntry {
  return {
    id: `water-${date}`,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    userId: "user-1",
    date,
    amountMl,
    loggedAt: `${date}T08:00:00.000Z`,
  };
}

function disruption(date: string): ActiveDisruption {
  return {
    id: `user-1__${date}`,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    userId: "user-1",
    date,
    type: "migraine",
    startedAt: `${date}T08:00:00.000Z`,
    status: "cleared",
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    referenceDate,
    proteinGoalG: 100,
    waterGoalMl: 2000,
    workoutGoalMinPerDay: 30,
    meals: [] as MealEntry[],
    waterLogs: [] as WaterLogEntry[],
    workouts: [],
    disruptions: [] as ActiveDisruption[],
    ...overrides,
  };
}

describe("transparent adaptive insight detection", () => {
  it("detects repeated missing breakfast only from well-logged days", () => {
    const meals = dates.flatMap((date) =>
      (["lunch", "snack", "dinner"] as MealType[]).map((type) =>
        meal(date, type),
      ),
    );

    const insights = buildAdaptiveInsights(input({ meals }));

    expect(insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "breakfast-not-logged",
          evidence: expect.objectContaining({ count: 7, observedDays: 7 }),
          status: "suggested",
        }),
      ]),
    );
  });

  it("returns no insight when evidence is insufficient", () => {
    const meals = dates.slice(0, 6).flatMap((date) =>
      (["lunch", "snack", "dinner"] as MealType[]).map((type) =>
        meal(date, type),
      ),
    );

    expect(buildAdaptiveInsights(input({ meals }))).toEqual([]);
  });

  it("limits output to three deterministic insights", () => {
    const meals = dates.flatMap((date) =>
      (["breakfast", "lunch", "snack", "dinner"] as MealType[]).map(
        (type) => meal(date, type, 5),
      ),
    );
    const result = buildAdaptiveInsights(
      input({
        meals,
        waterLogs: dates.map((date) => water(date)),
        disruptions: dates.slice(0, 3).map(disruption),
      }),
    );

    expect(result).toHaveLength(3);
    expect(result.map((insight) => insight.type)).toEqual([
      "workout-not-logged",
      "low-protein",
      "low-water",
    ]);
  });

  it("phrases migraine disruption as planning support, not diagnosis", () => {
    const insights = buildAdaptiveInsights(
      input({ disruptions: dates.slice(0, 3).map(disruption) }),
    );
    const migraine = insights.find(
      (insight) => insight.type === "migraine-disruption",
    );

    expect(migraine?.explanation).toContain("not a diagnosis");
    expect(JSON.stringify(migraine)).not.toMatch(
      /treatment|medication|thyroid restriction/i,
    );
  });

  it("does not mutate input or apply a coaching adjustment", () => {
    const source = input({ waterLogs: dates.map((date) => water(date)) });
    const snapshot = JSON.parse(JSON.stringify(source));

    const insights = buildAdaptiveInsights(source);

    expect(source).toEqual(snapshot);
    expect(insights.every((item) => item.suggestion.applied === false)).toBe(
      true,
    );
    expect(JSON.stringify(insights)).not.toContain("retainedInsights");
  });
});
