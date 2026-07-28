import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import {
  generateEmergencyPlan,
  type EmergencyDisruption,
  type EmergencyPlanResult,
} from "@/lib/planner/emergencyPlanner";
import { MEAL_TEMPLATES } from "@/lib/planner/mealTemplates";
import type { PlannerUserContext } from "@/lib/planner/plannerTypes";
import { DEFAULT_GOALS } from "@/lib/utils/constants";

function insight(id: string, engine: EngineInsight["engine"]): EngineInsight {
  return {
    id,
    engine,
    priority: "high",
    urgency: "soon",
    tone: "neutral",
    summary: "Retained test insight.",
    reason: "The deterministic engine retained this insight.",
    recommendedAction: "Apply the retained rule.",
  };
}

function decision(insights: EngineInsight[] = []): CoachDecision {
  return {
    insights,
    suppressedEngineNames: [],
    generatedAt: "2026-07-25T06:00:00.000Z",
  };
}

function context(
  overrides: Partial<PlannerUserContext> = {},
): PlannerUserContext {
  return {
    today: "2026-07-25",
    currentHour: 15,
    currentMinute: 0,
    leaveHomeTime: "06:30",
    arriveHomeTime: "19:00",
    lunchProvidedByOffice: false,
    calorieGoal: DEFAULT_GOALS.calorieGoal,
    proteinGoalG: DEFAULT_GOALS.proteinGoalG,
    waterGoalMl: DEFAULT_GOALS.waterGoalMl,
    workoutGoalMinPerDay: DEFAULT_GOALS.workoutGoalMinPerDay,
    stepsGoal: DEFAULT_GOALS.stepsGoal,
    sleepGoalHours: DEFAULT_GOALS.sleepGoalHours,
    ...overrides,
  };
}

function success(result: EmergencyPlanResult) {
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error("Expected Emergency Planner success.");
  }
  return result;
}

describe("generateEmergencyPlan", () => {
  it("handles missed breakfast without skipping or doubling later meals", () => {
    const result = success(
      generateEmergencyPlan(
        decision(),
        context(),
        { type: "missed-breakfast", occurredAt: "09:30" },
      ),
    );

    expect(result.actions.map(({ slot }) => slot)).toEqual([
      "lunch",
      "snack",
      "dinner",
    ]);
    expect(result.actions.slice(0, 2).map((action) => action.kind === "approved-template" && action.purpose))
      .toEqual(["substantive-meal", "substantive-meal"]);
  });

  it("handles late dinner by retaining a substantive snack and dinner", () => {
    const result = success(
      generateEmergencyPlan(
        decision(),
        context(),
        { type: "late-dinner", expectedDinnerAt: "22:00" },
      ),
    );

    expect(result.actions.map(({ slot }) => slot)).toEqual(["snack", "dinner"]);
    expect(result.actions[0]).toMatchObject({
      kind: "approved-template",
      purpose: "substantive-meal",
    });
  });

  it("uses approved quick-prep templates for overtime", () => {
    const result = success(
      generateEmergencyPlan(
        decision([insight("nutrition.protein_first", "nutrition")]),
        context(),
        { type: "overtime", expectedEndAt: "21:00" },
      ),
    );

    expect(result.actions.map(({ slot }) => slot)).toEqual(["snack", "dinner"]);
    for (const action of result.actions) {
      expect(action.kind).toBe("approved-template");
      if (action.kind === "approved-template") {
        expect(action.purpose).toBe("quick-prep-fallback");
        expect(action.recommendation.template.tags).toContain("quick-prep");
      }
    }
    expect(result.actions[0]).toMatchObject({
      recommendation: { template: { tags: expect.arrayContaining(["high-protein"]) } },
    });
  });

  it("uses quick-prep approved templates for deduplicated travel slots", () => {
    const result = success(
      generateEmergencyPlan(
        decision(),
        context(),
        {
          type: "travel",
          affectedSlots: ["breakfast", "breakfast", "snack"],
        },
      ),
    );

    expect(result.actions).toHaveLength(4);
    for (const slot of ["breakfast", "snack"] as const) {
      const action = result.actions.find((candidate) => candidate.slot === slot);
      expect(action).toMatchObject({
        kind: "approved-template",
        purpose: "quick-prep-fallback",
      });
    }
  });

  it.each([
    "restaurant",
    "mall-trip",
    "birthday",
    "wedding",
  ] as const)("handles %s with meal-shape guidance and no external menu invention", (type) => {
    const result = success(
      generateEmergencyPlan(
        decision(),
        context(),
        { type, mealSlot: "dinner" },
      ),
    );
    const eventAction = result.actions.find((action) => action.slot === "dinner");

    expect(eventAction).toEqual({
      kind: "meal-shape",
      slot: "dinner",
      components: ["protein", "staple-or-carbohydrate", "vegetables"],
      reason:
        type === "birthday" || type === "wedding"
          ? `Keep normal eating around the ${type} and use the approved meal shape for dinner without compensating.`
          : "Keep dinner and use the approved meal shape without estimating external nutrition.",
    });
    expect(eventAction).not.toHaveProperty("template");
    expect(eventAction).not.toHaveProperty("calories");
    expect(eventAction).not.toHaveProperty("proteinG");
  });

  it("is deterministic", () => {
    const disruption: EmergencyDisruption = {
      type: "travel",
      affectedSlots: ["breakfast", "snack"],
    };
    const first = generateEmergencyPlan(decision(), context(), disruption);
    const second = generateEmergencyPlan(decision(), context(), disruption);

    expect(second).toEqual(first);
  });

  it.each([
    [{ type: "missed-breakfast", occurredAt: "9:30" }, "occurredAt"],
    [{ type: "late-dinner", expectedDinnerAt: "24:00" }, "expectedDinnerAt"],
    [{ type: "overtime", expectedEndAt: "20:60" }, "expectedEndAt"],
  ] as const)("rejects invalid clock input", (disruption, field) => {
    expect(
      generateEmergencyPlan(
        decision(),
        context(),
        disruption as EmergencyDisruption,
      ),
    ).toEqual({
      status: "invalid-input",
      errors: [{ code: "invalid-clock", field }],
    });
  });

  it("rejects empty travel slots", () => {
    expect(
      generateEmergencyPlan(
        decision(),
        context(),
        { type: "travel", affectedSlots: [] },
      ),
    ).toEqual({
      status: "invalid-input",
      errors: [{ code: "empty-affected-slots", field: "affectedSlots" }],
    });
  });

  it("returns not-applicable for impossible travel slot combinations", () => {
    const disruption = {
      type: "travel",
      affectedSlots: ["lunch", "dinner"],
    } as EmergencyDisruption;

    expect(generateEmergencyPlan(decision(), context(), disruption)).toEqual({
      status: "not-applicable",
      reason: "no-eligible-quick-prep-template",
    });
  });

  it("returns not-applicable when Migraine safety leaves no valid quick-prep dinner", () => {
    const result = generateEmergencyPlan(
      decision([insight("migraine.active_symptom_care", "migraine")]),
      context(),
      { type: "overtime", expectedEndAt: "21:00" },
    );

    expect(result).toEqual({
      status: "not-applicable",
      reason: "no-eligible-quick-prep-template",
    });
  });

  it("keeps Migraine above convenience and preserves substantive eating", () => {
    const retained = decision([
      insight("migraine.active_symptom_care", "migraine"),
      insight("menstrual.pms_hunger_support", "menstrual"),
      insight("nutrition.protein_first", "nutrition"),
    ]);
    const result = success(
      generateEmergencyPlan(
        retained,
        context(),
        { type: "missed-breakfast", occurredAt: "10:00" },
      ),
    );

    for (const action of result.actions) {
      expect(action.kind).toBe("approved-template");
      if (action.kind === "approved-template") {
        expect(action.recommendation.template.tags).toContain("migraine-safe");
        expect(action.recommendation.reason).toMatch(/^Migraine-safe choice/);
      }
    }
    expect(result.actions.slice(0, 2)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: "substantive-meal" }),
      ]),
    );
  });

  it("preserves PMS and protein-first ranking when no higher priority rule conflicts", () => {
    const pms = success(
      generateEmergencyPlan(
        decision([insight("menstrual.pms_hunger_support", "menstrual")]),
        context(),
        { type: "late-dinner", expectedDinnerAt: "22:30" },
      ),
    );
    const protein = success(
      generateEmergencyPlan(
        decision([insight("nutrition.protein_first", "nutrition")]),
        context(),
        { type: "late-dinner", expectedDinnerAt: "22:30" },
      ),
    );

    const pmsSnack = pms.actions[0];
    const proteinSnack = protein.actions[0];
    expect(pmsSnack.kind).toBe("approved-template");
    if (pmsSnack.kind === "approved-template") {
      const tags = pmsSnack.recommendation.template.tags;
      expect(
        tags.includes("pms-friendly") || tags.includes("fiber-forward"),
      ).toBe(true);
    }
    expect(proteinSnack).toMatchObject({
      recommendation: {
        template: { tags: expect.arrayContaining(["high-protein"]) },
      },
    });
  });

  it("keeps Thyroid neutral", () => {
    const disruption: EmergencyDisruption = {
      type: "missed-breakfast",
      occurredAt: "09:00",
    };
    const ordinary = generateEmergencyPlan(decision(), context(), disruption);
    const thyroid = generateEmergencyPlan(
      decision([insight("thyroid.deficit_too_aggressive", "thyroid")]),
      context(),
      disruption,
    );

    expect(thyroid).toEqual(ordinary);
    expect(JSON.stringify(thyroid)).not.toMatch(
      /thyroid|diet|supplement|medication|medical/i,
    );
  });

  it("never emits meal-skipping, compensation, invented targets, medical content, or GoFood behavior", () => {
    const disruptions: EmergencyDisruption[] = [
      { type: "missed-breakfast", occurredAt: "09:00" },
      { type: "late-dinner", expectedDinnerAt: "22:00" },
      { type: "overtime", expectedEndAt: "21:00" },
      { type: "restaurant", mealSlot: "lunch" },
      { type: "mall-trip", mealSlot: "dinner" },
      { type: "travel", affectedSlots: ["breakfast"] },
      { type: "birthday", mealSlot: "lunch" },
      { type: "wedding", mealSlot: "dinner" },
    ];

    for (const disruption of disruptions) {
      const output = JSON.stringify(
        generateEmergencyPlan(decision(), context(), disruption),
      );
      expect(output).not.toMatch(
        /skip|save calories|calorie target|protein target|double portion|gofood|diagnos|treat|supplement|medication/i,
      );
    }
  });

  it("does not mutate decision, context, disruption, or approved templates", () => {
    const retained = decision([
      insight("menstrual.pms_hunger_support", "menstrual"),
    ]);
    const userContext = context();
    const disruption: EmergencyDisruption = {
      type: "travel",
      affectedSlots: ["breakfast", "breakfast", "snack"],
    };
    const snapshots = {
      decision: JSON.parse(JSON.stringify(retained)),
      context: JSON.parse(JSON.stringify(userContext)),
      disruption: JSON.parse(JSON.stringify(disruption)),
      templates: JSON.parse(JSON.stringify(MEAL_TEMPLATES)),
    };

    generateEmergencyPlan(retained, userContext, disruption);

    expect(retained).toEqual(snapshots.decision);
    expect(userContext).toEqual(snapshots.context);
    expect(disruption).toEqual(snapshots.disruption);
    expect(MEAL_TEMPLATES).toEqual(snapshots.templates);
  });

  it("returns not-applicable for an unsupported runtime disruption", () => {
    expect(
      generateEmergencyPlan(
        decision(),
        context(),
        { type: "gofood" } as unknown as EmergencyDisruption,
      ),
    ).toEqual({
      status: "not-applicable",
      reason: "unsupported-disruption",
    });
  });
});
