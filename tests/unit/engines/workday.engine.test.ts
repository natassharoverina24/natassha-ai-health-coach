import { runWorkdayEngine } from "@/lib/engines/workday.engine";

const BASE = { leaveHomeTime: "06:30", arriveHomeTime: "19:00", lunchProvidedByOffice: true };

describe("runWorkdayEngine", () => {
  it("gives a morning-window nudge shortly before leaving for work", () => {
    const insights = runWorkdayEngine({ ...BASE, currentHour: 6, currentMinute: 0 });
    const morning = insights.find((i) => i.id === "workday.morning_window");
    expect(morning).toBeDefined();
    expect(morning?.data?.minutesUntilLeave).toBe(30);
  });

  it("does not give a morning nudge too far before leaving", () => {
    const insights = runWorkdayEngine({ ...BASE, currentHour: 4, currentMinute: 0 });
    expect(insights.some((i) => i.id === "workday.morning_window")).toBe(false);
  });

  it("gives office-hours lunch context while at work with office lunch enabled", () => {
    const insights = runWorkdayEngine({ ...BASE, currentHour: 12, currentMinute: 0 });
    expect(insights.some((i) => i.id === "workday.office_hours_lunch_context")).toBe(true);
  });

  it("does not give office lunch context when lunch isn't office-provided", () => {
    const insights = runWorkdayEngine({ ...BASE, lunchProvidedByOffice: false, currentHour: 12, currentMinute: 0 });
    expect(insights.some((i) => i.id === "workday.office_hours_lunch_context")).toBe(false);
  });

  it("gives an evening-window insight once home", () => {
    const insights = runWorkdayEngine({ ...BASE, currentHour: 20, currentMinute: 0 });
    expect(insights.some((i) => i.id === "workday.evening_window")).toBe(true);
  });

  it("does not give an evening insight during work hours", () => {
    const insights = runWorkdayEngine({ ...BASE, currentHour: 12, currentMinute: 0 });
    expect(insights.some((i) => i.id === "workday.evening_window")).toBe(false);
  });
});
