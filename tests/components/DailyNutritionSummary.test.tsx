import { render, screen } from "@testing-library/react";

import { DailyNutritionSummary } from "@/components/meal/DailyNutritionSummary";

describe("DailyNutritionSummary", () => {
  it("displays totals for every tracked macro", () => {
    render(
      <DailyNutritionSummary
        totals={{ calories: 900, proteinG: 60, carbsG: 80, fatG: 25, fiberG: 12 }}
        calorieGoal={1400}
        proteinGoalG={110}
      />,
    );
    expect(screen.getByText("900 kcal")).toBeInTheDocument();
    expect(screen.getByText("60 g")).toBeInTheDocument();
    expect(screen.getByText("80 g")).toBeInTheDocument();
    expect(screen.getByText("25 g")).toBeInTheDocument();
    expect(screen.getByText("12 g")).toBeInTheDocument();
  });

  it("computes remaining calories and protein against goals", () => {
    render(
      <DailyNutritionSummary
        totals={{ calories: 900, proteinG: 60, carbsG: 80, fatG: 25, fiberG: 12 }}
        calorieGoal={1400}
        proteinGoalG={110}
      />,
    );
    expect(screen.getByText("500 kcal")).toBeInTheDocument(); // remaining calories
    expect(screen.getByText("50 g")).toBeInTheDocument(); // remaining protein
  });

  it("never shows negative remaining values when goals are exceeded", () => {
    render(
      <DailyNutritionSummary
        totals={{ calories: 2000, proteinG: 200, carbsG: 80, fatG: 25, fiberG: 12 }}
        calorieGoal={1400}
        proteinGoalG={110}
      />,
    );
    expect(screen.getByText("Remaining calories").nextElementSibling).toHaveTextContent("0 kcal");
    expect(screen.getByText("Remaining protein").nextElementSibling).toHaveTextContent("0 g");
  });
});
