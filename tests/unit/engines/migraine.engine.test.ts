import { runMigraineEngine } from "@/lib/engines/migraine.engine";

describe("runMigraineEngine", () => {
  it("returns nothing with no recent symptom logs", () => {
    const insights = runMigraineEngine({ today: "2026-07-25", recentSymptomLogs: [], todaysMealGapHours: 2 });
    expect(insights).toEqual([]);
  });

  it("returns nothing when symptoms don't mention migraine/headache", () => {
    const insights = runMigraineEngine({
      today: "2026-07-25",
      recentSymptomLogs: [{ date: "2026-07-24", symptoms: ["cramps", "fatigue"] }],
      todaysMealGapHours: 2,
    });
    expect(insights).toEqual([]);
  });

  it("flags active symptom care for a recently logged migraine and suppresses the exercise engine", () => {
    const insights = runMigraineEngine({
      today: "2026-07-25",
      recentSymptomLogs: [{ date: "2026-07-24", symptoms: ["migraine"] }],
      todaysMealGapHours: 2,
    });
    const active = insights.find((i) => i.id === "migraine.active_symptom_care");
    expect(active).toBeDefined();
    expect(active?.suppresses).toContain("exercise");
  });

  it("matches case-insensitively and matches 'headache' too", () => {
    const insights = runMigraineEngine({
      today: "2026-07-25",
      recentSymptomLogs: [{ date: "2026-07-25", symptoms: ["Severe Headache"] }],
      todaysMealGapHours: 2,
    });
    expect(insights.some((i) => i.id === "migraine.active_symptom_care")).toBe(true);
  });

  it("ignores a migraine logged too long ago", () => {
    const insights = runMigraineEngine({
      today: "2026-07-25",
      recentSymptomLogs: [{ date: "2026-07-10", symptoms: ["migraine"] }],
      todaysMealGapHours: 2,
    });
    expect(insights).toEqual([]);
  });

  it("adds a meal-gap correlation insight when today's gap is also long", () => {
    const insights = runMigraineEngine({
      today: "2026-07-25",
      recentSymptomLogs: [{ date: "2026-07-24", symptoms: ["migraine"] }],
      todaysMealGapHours: 6,
    });
    expect(insights.some((i) => i.id === "migraine.meal_gap_correlation")).toBe(true);
  });

  it("does not add the meal-gap correlation when today's gap is short", () => {
    const insights = runMigraineEngine({
      today: "2026-07-25",
      recentSymptomLogs: [{ date: "2026-07-24", symptoms: ["migraine"] }],
      todaysMealGapHours: 3,
    });
    expect(insights.some((i) => i.id === "migraine.meal_gap_correlation")).toBe(false);
  });
});
