import { estimateCyclePhase, runMenstrualEngine } from "@/lib/engines/menstrual.engine";

describe("estimateCyclePhase", () => {
  it("classifies the menstrual phase (days 0-4)", () => {
    expect(estimateCyclePhase(0)).toBe("menstrual");
    expect(estimateCyclePhase(4)).toBe("menstrual");
  });

  it("classifies the follicular phase (days 5-12)", () => {
    expect(estimateCyclePhase(5)).toBe("follicular");
    expect(estimateCyclePhase(12)).toBe("follicular");
  });

  it("classifies the ovulation phase (days 13-15)", () => {
    expect(estimateCyclePhase(13)).toBe("ovulation");
    expect(estimateCyclePhase(15)).toBe("ovulation");
  });

  it("classifies the luteal phase (days 16-27)", () => {
    expect(estimateCyclePhase(16)).toBe("luteal");
    expect(estimateCyclePhase(27)).toBe("luteal");
  });

  it("wraps around after 28 days back to menstrual", () => {
    expect(estimateCyclePhase(28)).toBe("menstrual");
  });

  it("returns null for a negative day count", () => {
    expect(estimateCyclePhase(-1)).toBeNull();
  });

  it("returns null once the cycle estimate is too stale to trust", () => {
    expect(estimateCyclePhase(41)).toBeNull();
  });
});

describe("runMenstrualEngine", () => {
  it("returns nothing when there's no cycle data", () => {
    expect(runMenstrualEngine({ latestCycleStartDate: null, today: "2026-07-25" })).toEqual([]);
  });

  it("returns nothing when the cycle estimate is stale", () => {
    const insights = runMenstrualEngine({ latestCycleStartDate: "2026-05-01", today: "2026-07-25" });
    expect(insights).toEqual([]);
  });

  it("gives flexible-intensity guidance during the menstrual phase", () => {
    const insights = runMenstrualEngine({ latestCycleStartDate: "2026-07-24", today: "2026-07-25" });
    expect(insights.some((i) => i.id === "menstrual.flexible_intensity")).toBe(true);
  });

  it("gives PMS hunger support and water-retention awareness during the luteal phase", () => {
    // day 20 of the cycle -> luteal
    const insights = runMenstrualEngine({ latestCycleStartDate: "2026-07-05", today: "2026-07-25" });
    expect(insights.some((i) => i.id === "menstrual.pms_hunger_support")).toBe(true);
    expect(insights.some((i) => i.id === "menstrual.water_retention_awareness")).toBe(true);
  });

  it("gives an energy-forward insight during the follicular/ovulation window", () => {
    // day 8 of the cycle -> follicular
    const insights = runMenstrualEngine({ latestCycleStartDate: "2026-07-17", today: "2026-07-25" });
    expect(insights.some((i) => i.id === "menstrual.phase_aware_energy")).toBe(true);
  });
});
