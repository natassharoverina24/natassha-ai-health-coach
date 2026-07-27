import { runBehaviorEngine } from "@/lib/engines/behavior.engine";
import type { DailyCoachScore } from "@/lib/coach/types";

function score(date: string, overall: number): DailyCoachScore {
  return {
    date,
    dimensions: { calories: overall, protein: overall, water: overall, workout: overall, sleep: overall, mealLogging: overall },
    overall,
  };
}

describe("runBehaviorEngine — reminders / self monitoring", () => {
  it("does not remind before 2pm", () => {
    const insights = runBehaviorEngine({ dailyScores: [], hasLoggedToday: false, currentHour: 10 });
    expect(insights.find((i) => i.id === "behavior.self_monitoring_reminder")).toBeUndefined();
  });

  it("reminds gently in the afternoon if nothing is logged", () => {
    const insights = runBehaviorEngine({ dailyScores: [], hasLoggedToday: false, currentHour: 15 });
    const reminder = insights.find((i) => i.id === "behavior.self_monitoring_reminder");
    expect(reminder).toBeDefined();
    expect(reminder?.urgency).toBe("soon");
  });

  it("escalates urgency in the evening", () => {
    const insights = runBehaviorEngine({ dailyScores: [], hasLoggedToday: false, currentHour: 21 });
    const reminder = insights.find((i) => i.id === "behavior.self_monitoring_reminder");
    expect(reminder?.priority).toBe("high");
    expect(reminder?.urgency).toBe("now");
  });

  it("never reminds once something has been logged today", () => {
    const insights = runBehaviorEngine({ dailyScores: [], hasLoggedToday: true, currentHour: 21 });
    expect(insights.find((i) => i.id === "behavior.self_monitoring_reminder")).toBeUndefined();
  });
});

describe("runBehaviorEngine — consistency", () => {
  it("celebrates a 3+ day streak of scores at or above 70", () => {
    const scores = [score("d1", 75), score("d2", 80), score("d3", 90)];
    const insights = runBehaviorEngine({ dailyScores: scores, hasLoggedToday: true, currentHour: 10 });
    const consistency = insights.find((i) => i.id === "behavior.consistency_reinforcement");
    expect(consistency).toBeDefined();
    expect(consistency?.tone).toBe("celebratory");
    expect(consistency?.data?.streakDays).toBe(3);
  });

  it("does not celebrate a streak shorter than 3 days", () => {
    const scores = [score("d1", 30), score("d2", 80), score("d3", 90)];
    const insights = runBehaviorEngine({ dailyScores: scores, hasLoggedToday: true, currentHour: 10 });
    expect(insights.find((i) => i.id === "behavior.consistency_reinforcement")).toBeUndefined();
  });
});

describe("runBehaviorEngine — streak recovery", () => {
  it("encourages recovery when a real streak breaks", () => {
    const scores = [score("d1", 75), score("d2", 80), score("d3", 90), score("d4", 40)];
    const insights = runBehaviorEngine({ dailyScores: scores, hasLoggedToday: true, currentHour: 10 });
    const recovery = insights.find((i) => i.id === "behavior.streak_recovery");
    expect(recovery).toBeDefined();
    expect(recovery?.tone).toBe("encouraging");
    expect(recovery?.data?.brokenStreakDays).toBe(3);
  });

  it("does not fire streak recovery if there was no real streak to break", () => {
    const scores = [score("d1", 30), score("d2", 80), score("d3", 40)];
    const insights = runBehaviorEngine({ dailyScores: scores, hasLoggedToday: true, currentHour: 10 });
    expect(insights.find((i) => i.id === "behavior.streak_recovery")).toBeUndefined();
  });
});

describe("runBehaviorEngine — accountability", () => {
  it("flags a sustained multi-day decline", () => {
    const scores = [score("d1", 90), score("d2", 70), score("d3", 60), score("d4", 50)];
    const insights = runBehaviorEngine({ dailyScores: scores, hasLoggedToday: true, currentHour: 10 });
    const nudge = insights.find((i) => i.id === "behavior.accountability_nudge");
    expect(nudge).toBeDefined();
    expect(nudge?.tone).toBe("firm");
  });

  it("does not flag a small decline", () => {
    const scores = [score("d1", 90), score("d2", 88), score("d3", 87), score("d4", 85)];
    const insights = runBehaviorEngine({ dailyScores: scores, hasLoggedToday: true, currentHour: 10 });
    expect(insights.find((i) => i.id === "behavior.accountability_nudge")).toBeUndefined();
  });

  it("does not flag a non-monotonic dip", () => {
    const scores = [score("d1", 60), score("d2", 90), score("d3", 50), score("d4", 85)];
    const insights = runBehaviorEngine({ dailyScores: scores, hasLoggedToday: true, currentHour: 10 });
    expect(insights.find((i) => i.id === "behavior.accountability_nudge")).toBeUndefined();
  });
});

describe("runBehaviorEngine — no data", () => {
  it("returns only the reminder (if any) when there's no score history", () => {
    const insights = runBehaviorEngine({ dailyScores: [], hasLoggedToday: true, currentHour: 10 });
    expect(insights).toEqual([]);
  });
});
