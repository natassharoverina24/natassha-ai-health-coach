import {
  buildSleepInsight,
  calculateSleepDuration,
  classifyWorkoutActivity,
  estimateWorkoutCalories,
} from "@/lib/activity-tracking";

describe("activity tracking helpers", () => {
  it("classifies supported workout names deterministically", () => {
    expect(classifyWorkoutActivity("Treadmill 30 menit")).toBe("treadmill");
    expect(classifyWorkoutActivity("Jalan pagi")).toBe("walking");
    expect(classifyWorkoutActivity("Custom class")).toBe("other");
  });

  it("estimates treadmill calories with the local MET formula", () => {
    expect(
      estimateWorkoutCalories({
        activityType: "treadmill",
        durationMin: 30,
        intensity: "moderate",
        weightKg: 60,
      }),
    ).toMatchObject({ status: "success", caloriesKcal: 189, met: 6 });
  });

  it("returns a transparent partial state without weight", () => {
    expect(
      estimateWorkoutCalories({
        activityType: "walking",
        durationMin: 30,
        intensity: "moderate",
        weightKg: null,
      }),
    ).toMatchObject({ status: "partial", reason: "missing-weight", caloriesKcal: null });
  });

  it("calculates an overnight sleep interval", () => {
    expect(calculateSleepDuration("23:30", "06:00")).toEqual({
      status: "success",
      durationMinutes: 390,
      hoursSlept: 6.5,
    });
  });

  it("keeps short-sleep support non-diagnostic", () => {
    const copy = buildSleepInsight(390).join(" ");
    expect(copy).toContain("6 jam 30 menit");
    expect(copy).not.toMatch(/insomnia|diagnosis|treatment|medical/i);
  });
});
