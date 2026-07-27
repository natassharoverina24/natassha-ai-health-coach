import { runMaintenanceEngine } from "@/lib/engines/maintenance.engine";

describe("runMaintenanceEngine — maintenance mode", () => {
  it("switches to maintenance mode when near goal with a flat trend", () => {
    const insights = runMaintenanceEngine({
      currentWeightKg: 53.5,
      goalWeightKg: 53,
      latestWeeklyChangeKg: 0.1,
      recentWeeklyChangesKg: [0.1, -0.1, 0.1],
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe("maintenance.maintenance_mode");
    expect(insights[0].tone).toBe("celebratory");
  });

  it("does not enter maintenance mode when far from goal", () => {
    const insights = runMaintenanceEngine({
      currentWeightKg: 65,
      goalWeightKg: 53,
      latestWeeklyChangeKg: 0.1,
      recentWeeklyChangesKg: [0.1],
    });
    expect(insights.some((i) => i.id === "maintenance.maintenance_mode")).toBe(false);
  });
});

describe("runMaintenanceEngine — weekly trend analysis", () => {
  it("reports a loss trend", () => {
    const insights = runMaintenanceEngine({
      currentWeightKg: 65,
      goalWeightKg: 53,
      latestWeeklyChangeKg: -0.6,
      recentWeeklyChangesKg: [-0.6],
    });
    const trend = insights.find((i) => i.id === "maintenance.weekly_trend");
    expect(trend?.summary).toMatch(/down 0\.6 kg/i);
  });

  it("reports a gain trend", () => {
    const insights = runMaintenanceEngine({
      currentWeightKg: 65,
      goalWeightKg: 53,
      latestWeeklyChangeKg: 0.5,
      recentWeeklyChangesKg: [0.5],
    });
    const trend = insights.find((i) => i.id === "maintenance.weekly_trend");
    expect(trend?.summary).toMatch(/up 0\.5 kg/i);
  });

  it("omits the trend insight when there's no weekly data yet", () => {
    const insights = runMaintenanceEngine({
      currentWeightKg: 65,
      goalWeightKg: 53,
      latestWeeklyChangeKg: null,
      recentWeeklyChangesKg: [],
    });
    expect(insights.some((i) => i.id === "maintenance.weekly_trend")).toBe(false);
  });
});

describe("runMaintenanceEngine — regain detection / extended care", () => {
  it("gives a gentle watch-note after one up week", () => {
    const insights = runMaintenanceEngine({
      currentWeightKg: 65,
      goalWeightKg: 53,
      latestWeeklyChangeKg: 0.5,
      recentWeeklyChangesKg: [-0.3, 0.5],
    });
    expect(insights.some((i) => i.id === "maintenance.regain_watch")).toBe(true);
    expect(insights.some((i) => i.id === "maintenance.extended_care")).toBe(false);
  });

  it("escalates to extended care after two-plus consecutive up weeks", () => {
    const insights = runMaintenanceEngine({
      currentWeightKg: 65,
      goalWeightKg: 53,
      latestWeeklyChangeKg: 0.4,
      recentWeeklyChangesKg: [0.5, 0.4],
    });
    const extended = insights.find((i) => i.id === "maintenance.extended_care");
    expect(extended).toBeDefined();
    expect(extended?.priority).toBe("high");
    expect(extended?.data?.consecutiveRegainWeeks).toBe(2);
  });

  it("does not flag regain when the trend is a loss", () => {
    const insights = runMaintenanceEngine({
      currentWeightKg: 65,
      goalWeightKg: 53,
      latestWeeklyChangeKg: -0.4,
      recentWeeklyChangesKg: [-0.5, -0.4],
    });
    expect(insights.some((i) => i.id === "maintenance.regain_watch")).toBe(false);
    expect(insights.some((i) => i.id === "maintenance.extended_care")).toBe(false);
  });
});
