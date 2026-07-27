import {
  buildSchedule,
  extractSummary,
  findWhyMotivationText,
  toHHmm,
  toMinutes,
} from "@/lib/planner/plannerHelpers";
import type { EngineInsight } from "@/lib/engines/types";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

describe("toMinutes", () => {
  it("converts HH:mm to minutes since midnight", () => {
    expect(toMinutes("06:30")).toBe(390);
    expect(toMinutes("19:00")).toBe(1140);
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("handles a missing minute part", () => {
    expect(toMinutes("12:")).toBe(720);
  });
});

describe("toHHmm", () => {
  it("converts minutes since midnight to HH:mm", () => {
    expect(toHHmm(390)).toBe("06:30");
    expect(toHHmm(1140)).toBe("19:00");
    expect(toHHmm(0)).toBe("00:00");
    expect(toHHmm(1439)).toBe("23:59");
  });

  it("clamps negative values to 00:00", () => {
    expect(toHHmm(-30)).toBe("00:00");
  });

  it("clamps values beyond 23:59 to 23:59", () => {
    expect(toHHmm(1500)).toBe("23:59");
  });
});

// ---------------------------------------------------------------------------
// Schedule placement
// ---------------------------------------------------------------------------

describe("buildSchedule", () => {
  const schedule = buildSchedule("06:30", "19:00");

  it("places breakfast 30 minutes before leaving home", () => {
    expect(schedule.breakfast.time).toBe("06:00");
    expect(schedule.breakfast.label).toBe("Breakfast");
  });

  it("places lunch at noon", () => {
    expect(schedule.lunch.time).toBe("12:00");
  });

  it("places snack at 15:00 to keep meal gaps under 5 hours", () => {
    expect(schedule.snack.time).toBe("15:00");
  });

  it("places dinner 60 minutes after arriving home", () => {
    expect(schedule.dinner.time).toBe("20:00");
  });

  it("places workout 90 minutes after arriving home", () => {
    expect(schedule.workout.time).toBe("20:30");
  });

  it("places a water reminder at 13:00", () => {
    expect(schedule.waterReminder.time).toBe("13:00");
    expect(schedule.waterReminder.label).toBe("Water reminder");
  });

  it("adapts to a different commute window", () => {
    const early = buildSchedule("05:30", "17:00");
    expect(early.breakfast.time).toBe("05:00");
    expect(early.dinner.time).toBe("18:00");
    expect(early.workout.time).toBe("18:30");
  });
});

// ---------------------------------------------------------------------------
// Insight extraction
// ---------------------------------------------------------------------------

function insight(overrides: Partial<EngineInsight>): EngineInsight {
  return {
    id: "test.insight",
    engine: "behavior",
    priority: "medium",
    urgency: "soon",
    tone: "neutral",
    summary: "Something happened.",
    reason: "Because of reasons.",
    recommendedAction: "Do a thing.",
    ...overrides,
  };
}

describe("extractSummary", () => {
  it("sets topPriority and biggestRisk to the first insight on a normal day", () => {
    const insights = [
      insight({ id: "a", summary: "Protein low", recommendedAction: "Eat chicken" }),
      insight({ id: "b", summary: "No workout", recommendedAction: "Walk 30 min" }),
    ];
    const result = extractSummary(insights, null);
    expect(result.topPriority?.id).toBe("a");
    expect(result.biggestRisk?.id).toBe("a");
    expect(result.biggestRisk?.summary).toBe("Protein low");
    expect(result.biggestRisk?.recommendedAction).toBe("Eat chicken");
  });

  it("sets biggestRisk to null when the top insight is celebratory (a good day, no risk)", () => {
    const insights = [insight({ id: "a", tone: "celebratory", summary: "3-day streak!" })];
    const result = extractSummary(insights, null);
    expect(result.topPriority?.id).toBe("a");
    expect(result.biggestRisk).toBeNull();
  });

  it("picks the highest-ranked celebratory insight as today's win", () => {
    const insights = [
      insight({ id: "a", tone: "firm", summary: "Something urgent" }),
      insight({ id: "b", tone: "celebratory", summary: "3-day streak!" }),
    ];
    const result = extractSummary(insights, null);
    expect(result.todaysWin?.id).toBe("b");
    expect(result.todaysWin?.summary).toBe("3-day streak!");
  });

  it("sets todaysWin to null when no insight is celebratory", () => {
    const insights = [insight({ id: "a", tone: "neutral" })];
    const result = extractSummary(insights, null);
    expect(result.todaysWin).toBeNull();
  });

  it("passes through the WHY motivation text as encouragement", () => {
    const result = extractSummary([], "Run a 5k with my sister");
    expect(result.encouragement).toBe("Run a 5k with my sister");
  });

  it("sets encouragement to null when no motivation is available", () => {
    const result = extractSummary([], null);
    expect(result.encouragement).toBeNull();
  });

  it("returns all-null summary when there are no insights at all", () => {
    const result = extractSummary([], null);
    expect(result.topPriority).toBeNull();
    expect(result.biggestRisk).toBeNull();
    expect(result.todaysWin).toBeNull();
    expect(result.encouragement).toBeNull();
  });
});

describe("findWhyMotivationText", () => {
  it("returns the motivation text from the WHY Engine's insight", () => {
    const insights = [
      insight({
        id: "why.surface_motivation",
        engine: "why",
        data: { motivationId: "m1", motivationText: "Feel confident again" },
      }),
    ];
    expect(findWhyMotivationText(insights)).toBe("Feel confident again");
  });

  it("returns null when the WHY Engine did not fire", () => {
    const insights = [insight({ id: "behavior.consistency_reinforcement" })];
    expect(findWhyMotivationText(insights)).toBeNull();
  });

  it("returns null when the WHY insight exists but has no data", () => {
    const insights = [insight({ id: "why.surface_motivation", engine: "why" })];
    expect(findWhyMotivationText(insights)).toBeNull();
  });

  it("returns null when motivationText is not a string", () => {
    const insights = [
      insight({
        id: "why.surface_motivation",
        engine: "why",
        data: { motivationId: "m1", motivationText: 42 },
      }),
    ];
    expect(findWhyMotivationText(insights)).toBeNull();
  });
});
