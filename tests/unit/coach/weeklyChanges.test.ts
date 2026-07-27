import { chunkDatesIntoWeeks, computeTrailingWeeklyChangesKg } from "@/lib/coach/weeklyChanges";

describe("chunkDatesIntoWeeks", () => {
  it("splits 14 dates into two 7-day chunks", () => {
    const dates = Array.from({ length: 14 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
    const chunks = chunkDatesIntoWeeks(dates);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(7);
    expect(chunks[1]).toHaveLength(7);
    expect(chunks[0][0]).toBe("2026-07-01");
    expect(chunks[1][6]).toBe("2026-07-14");
  });

  it("drops a trailing partial week", () => {
    const dates = Array.from({ length: 10 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
    const chunks = chunkDatesIntoWeeks(dates);
    expect(chunks).toHaveLength(1);
  });

  it("returns an empty array for fewer than 7 dates", () => {
    expect(chunkDatesIntoWeeks(["2026-07-01", "2026-07-02"])).toEqual([]);
  });
});

describe("computeTrailingWeeklyChangesKg", () => {
  it("computes the net change within each week window", () => {
    const entries = [
      { date: "2026-07-01", weightKg: 71 },
      { date: "2026-07-07", weightKg: 70.2 },
      { date: "2026-07-08", weightKg: 70.2 },
      { date: "2026-07-14", weightKg: 69.5 },
    ];
    const windows = [
      ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07"],
      ["2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14"],
    ];
    const changes = computeTrailingWeeklyChangesKg(entries, windows);
    expect(changes[0]).toBeCloseTo(-0.8);
    expect(changes[1]).toBeCloseTo(-0.7);
  });

  it("returns null for a week with fewer than two entries", () => {
    const entries = [{ date: "2026-07-03", weightKg: 71 }];
    const windows = [["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07"]];
    expect(computeTrailingWeeklyChangesKg(entries, windows)).toEqual([null]);
  });
});
