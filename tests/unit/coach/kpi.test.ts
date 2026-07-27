import { computeWeeklyKpi, DIMENSION_LABELS } from "@/lib/coach/kpi";
import type { WeeklyAdherence } from "@/lib/coach/types";

const ADHERENCE: WeeklyAdherence = {
  calories: 80,
  protein: 95,
  water: 60,
  workout: 20,
  sleep: 70,
  mealLogging: 90,
};

describe("computeWeeklyKpi", () => {
  it("picks the highest-adherence dimension as the best achievement", () => {
    const kpi = computeWeeklyKpi(ADHERENCE);
    expect(kpi.bestAchievement).toEqual({ dimension: "protein", label: "Protein", percent: 95 });
  });

  it("picks the lowest-adherence dimension as the biggest challenge", () => {
    const kpi = computeWeeklyKpi(ADHERENCE);
    expect(kpi.biggestChallenge).toEqual({ dimension: "workout", label: "Workout", percent: 20 });
  });

  it("sets improvement focus to exactly the same single dimension as the challenge", () => {
    const kpi = computeWeeklyKpi(ADHERENCE);
    expect(kpi.improvementFocus).toEqual(kpi.biggestChallenge);
  });

  it("provides a next-week goal string for the challenge dimension", () => {
    const kpi = computeWeeklyKpi(ADHERENCE);
    expect(kpi.nextWeekGoal).toMatch(/workout/i);
  });

  it("labels every dimension with a human-readable name", () => {
    expect(Object.keys(DIMENSION_LABELS).sort()).toEqual(
      ["calories", "mealLogging", "protein", "sleep", "water", "workout"].sort(),
    );
  });
});
