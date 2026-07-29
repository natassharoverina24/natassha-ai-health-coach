import { DEFAULT_GOALS, DEFAULT_USER_PROFILE, NAV_ITEMS } from "@/lib/utils/constants";

describe("NAV_ITEMS", () => {
  it("includes all nine required pages", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(hrefs).toEqual([
      "/dashboard",
      "/weight",
      "/meal",
      "/planner",
      "/progress",
      "/shopping",
      "/supplements",
      "/reports",
      "/settings",
    ]);
  });

  it("gives every item a non-empty label and icon", () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_GOALS", () => {
  it("has sane positive defaults", () => {
    expect(DEFAULT_GOALS.waterGoalMl).toBeGreaterThan(0);
    expect(DEFAULT_GOALS.stepsGoal).toBeGreaterThan(0);
    expect(DEFAULT_GOALS.proteinGoalG).toBeGreaterThan(0);
    expect(DEFAULT_GOALS.calorieGoal).toBeGreaterThan(0);
  });
});

describe("DEFAULT_USER_PROFILE", () => {
  it("matches the profile supplied in the project brief", () => {
    expect(DEFAULT_USER_PROFILE.heightCm).toBe(155);
    expect(DEFAULT_USER_PROFILE.startWeightKg).toBe(71);
    expect(DEFAULT_USER_PROFILE.goalWeightKg).toBe(53);
    expect(DEFAULT_USER_PROFILE.country).toBe("Indonesia");
    expect(DEFAULT_USER_PROFILE.leaveHomeTime).toBe("06:30");
    expect(DEFAULT_USER_PROFILE.arriveHomeTime).toBe("19:00");
    expect(DEFAULT_USER_PROFILE.lunchProvidedByOffice).toBe(true);
  });
});
