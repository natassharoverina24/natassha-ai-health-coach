import { addDaysToISODate, getLastNDates, getRollingWeekWindows } from "@/lib/coach/dateRanges";

describe("addDaysToISODate", () => {
  it("adds positive days within the same month", () => {
    expect(addDaysToISODate("2026-07-20", 5)).toBe("2026-07-25");
  });

  it("subtracts days across a month boundary", () => {
    expect(addDaysToISODate("2026-07-03", -5)).toBe("2026-06-28");
  });

  it("handles a year boundary", () => {
    expect(addDaysToISODate("2026-01-02", -5)).toBe("2025-12-28");
  });

  it("is a no-op for delta zero", () => {
    expect(addDaysToISODate("2026-07-25", 0)).toBe("2026-07-25");
  });
});

describe("getLastNDates", () => {
  it("returns n dates ending at (and including) the given date, oldest first", () => {
    const dates = getLastNDates(3, "2026-07-25");
    expect(dates).toEqual(["2026-07-23", "2026-07-24", "2026-07-25"]);
  });

  it("returns a single-element array for n=1", () => {
    expect(getLastNDates(1, "2026-07-25")).toEqual(["2026-07-25"]);
  });
});

describe("getRollingWeekWindows", () => {
  it("splits the last 14 days into a previous and current 7-day window", () => {
    const { current, previous } = getRollingWeekWindows("2026-07-25");
    expect(current).toHaveLength(7);
    expect(previous).toHaveLength(7);
    expect(current[current.length - 1]).toBe("2026-07-25");
    expect(current[0]).toBe("2026-07-19");
    expect(previous[previous.length - 1]).toBe("2026-07-18");
    expect(previous[0]).toBe("2026-07-12");
  });
});
