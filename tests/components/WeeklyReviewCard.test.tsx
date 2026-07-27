import { render, screen } from "@testing-library/react";

import { WeeklyReviewCard } from "@/components/coach/WeeklyReviewCard";
import type { WeeklyReview } from "@/lib/coach/types";

function makeReview(overrides: Partial<WeeklyReview> = {}): WeeklyReview {
  return {
    weightChangeKg: -1.2,
    waistChangeCm: -2,
    adherence: { calories: 80, protein: 90, water: 60, workout: 40, sleep: 70, mealLogging: 100 },
    ...overrides,
  };
}

describe("WeeklyReviewCard", () => {
  it("displays weight and waist change", () => {
    render(<WeeklyReviewCard review={makeReview()} />);
    expect(screen.getByText("-1.2 kg")).toBeInTheDocument();
    expect(screen.getByText("-2.0 cm")).toBeInTheDocument();
  });

  it("shows a dash when weight or waist change is unavailable", () => {
    render(<WeeklyReviewCard review={makeReview({ weightChangeKg: null, waistChangeCm: null })} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("displays all six adherence percentages", () => {
    render(<WeeklyReviewCard review={makeReview()} />);
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("labels each adherence row by dimension", () => {
    render(<WeeklyReviewCard review={makeReview()} />);
    expect(screen.getByText("Calories adherence")).toBeInTheDocument();
    expect(screen.getByText("Protein adherence")).toBeInTheDocument();
    expect(screen.getByText("Water adherence")).toBeInTheDocument();
    expect(screen.getByText("Workout adherence")).toBeInTheDocument();
    expect(screen.getByText("Sleep adherence")).toBeInTheDocument();
    expect(screen.getByText("Meal logging adherence")).toBeInTheDocument();
  });
});
