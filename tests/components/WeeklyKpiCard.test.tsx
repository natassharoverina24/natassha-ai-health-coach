import { render, screen } from "@testing-library/react";

import { WeeklyKpiCard } from "@/components/coach/WeeklyKpiCard";
import type { KpiSummary } from "@/lib/coach/types";

describe("WeeklyKpiCard", () => {
  it("shows a placeholder message when there is no data yet", () => {
    const kpi: KpiSummary = {
      bestAchievement: null,
      biggestChallenge: null,
      improvementFocus: null,
      nextWeekGoal: null,
    };
    render(<WeeklyKpiCard kpi={kpi} />);
    expect(screen.getByText(/weekly highlights will show up here/i)).toBeInTheDocument();
  });

  it("displays best achievement, biggest challenge, improvement focus, and next week goal", () => {
    const kpi: KpiSummary = {
      bestAchievement: { dimension: "protein", label: "Protein", percent: 95 },
      biggestChallenge: { dimension: "workout", label: "Workout", percent: 20 },
      improvementFocus: { dimension: "workout", label: "Workout", percent: 20 },
      nextWeekGoal: "Log a workout on at least 4 days next week.",
    };
    render(<WeeklyKpiCard kpi={kpi} />);
    expect(screen.getByText("Best achievement")).toBeInTheDocument();
    expect(screen.getByText(/Protein — 95% adherence/)).toBeInTheDocument();
    expect(screen.getByText("Biggest challenge")).toBeInTheDocument();
    expect(screen.getByText(/Workout — 20% adherence/)).toBeInTheDocument();
    expect(screen.getByText("Improvement focus")).toBeInTheDocument();
    expect(screen.getByText("Next week goal")).toBeInTheDocument();
    expect(screen.getByText("Log a workout on at least 4 days next week.")).toBeInTheDocument();
  });

  it("only shows a single improvement focus value, matching the biggest challenge dimension", () => {
    const kpi: KpiSummary = {
      bestAchievement: { dimension: "protein", label: "Protein", percent: 95 },
      biggestChallenge: { dimension: "workout", label: "Workout", percent: 20 },
      improvementFocus: { dimension: "workout", label: "Workout", percent: 20 },
      nextWeekGoal: "Log a workout on at least 4 days next week.",
    };
    render(<WeeklyKpiCard kpi={kpi} />);
    // "Workout" appears in both the challenge value and the focus value — exactly two occurrences, not a list.
    expect(screen.getAllByText(/Workout/)).toHaveLength(2);
  });
});
