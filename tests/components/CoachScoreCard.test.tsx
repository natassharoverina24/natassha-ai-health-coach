import { render, screen } from "@testing-library/react";

import { CoachScoreCard } from "@/components/coach/CoachScoreCard";
import type { CoachScoreSummary } from "@/lib/coach/types";

function makeSummary(overrides: Partial<CoachScoreSummary> = {}): CoachScoreSummary {
  return {
    currentScore: 82,
    weeklyAverage: 75,
    previousWeeklyAverage: 65,
    trend: "up",
    dailyScores: [],
    ...overrides,
  };
}

describe("CoachScoreCard", () => {
  it("displays the current score and weekly average", () => {
    render(<CoachScoreCard summary={makeSummary()} />);
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("shows a dash when there is no current score yet", () => {
    render(<CoachScoreCard summary={makeSummary({ currentScore: null })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows an upward trend label", () => {
    render(<CoachScoreCard summary={makeSummary({ trend: "up" })} />);
    expect(screen.getByText("Trending up")).toBeInTheDocument();
  });

  it("shows a downward trend label", () => {
    render(<CoachScoreCard summary={makeSummary({ trend: "down" })} />);
    expect(screen.getByText("Trending down")).toBeInTheDocument();
  });

  it("shows a flat trend label", () => {
    render(<CoachScoreCard summary={makeSummary({ trend: "flat" })} />);
    expect(screen.getByText("Holding steady")).toBeInTheDocument();
  });

  it("shows the previous week's average for context", () => {
    render(<CoachScoreCard summary={makeSummary({ previousWeeklyAverage: 65 })} />);
    expect(screen.getByText(/previous week 65/i)).toBeInTheDocument();
  });
});
