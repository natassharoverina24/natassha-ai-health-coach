import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MealDetailModal } from "@/components/meal/MealDetailModal";
import type { MealPhotoAnalysis } from "@/lib/ai/mealPhotoAnalysis";
import type { MealEntry } from "@/types/firestore";

function makeMeal(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: "meal-1",
    createdAt: "2026-07-25T08:32:00.000Z",
    updatedAt: "2026-07-25T08:32:00.000Z",
    userId: "user-1",
    date: "2026-07-25",
    type: "breakfast",
    name: "Nasi goreng",
    quantity: "1 plate",
    isOfficeLunch: false,
    macros: { calories: 450, proteinG: 18, carbsG: 60, fatG: 12, fiberG: 4 },
    photoIds: [],
    score: null,
    note: "Extra spicy",
    ...overrides,
  };
}

const noop = () => Promise.resolve();
const analysis: MealPhotoAnalysis = {
  items: [{ name: "Meal", estimatedPortion: "one plate" }],
  estimatedCalories: 100,
  estimatedProteinG: 10,
  confidence: "low",
  uncertain: true,
  assumptions: [],
  estimatedAt: "2026-07-25T00:00:00.000Z",
};

describe("MealDetailModal", () => {
  it("renders nothing when meal is null", () => {
    render(
      <MealDetailModal
        meal={null}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onAnalyzePhoto={async () => analysis}
        onConfirmPhotoEstimate={noop}
      />,
    );
    expect(screen.queryByText("Nasi goreng")).not.toBeInTheDocument();
  });

  it("displays name, quantity, all five macros, and notes", () => {
    const meal = makeMeal();
    render(
      <MealDetailModal
        meal={meal}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onAnalyzePhoto={async () => analysis}
        onConfirmPhotoEstimate={noop}
      />,
    );
    expect(screen.getAllByText("Nasi goreng").length).toBeGreaterThan(0);
    expect(screen.getByText("1 plate")).toBeInTheDocument();
    expect(screen.getByText("450 kcal")).toBeInTheDocument();
    expect(screen.getByText("18 g")).toBeInTheDocument();
    expect(screen.getByText("60 g")).toBeInTheDocument();
    expect(screen.getByText("12 g")).toBeInTheDocument();
    expect(screen.getByText("4 g")).toBeInTheDocument();
    expect(screen.getByText("Extra spicy")).toBeInTheDocument();
  });

  it("shows the office lunch badge only when applicable", () => {
    const { rerender } = render(
      <MealDetailModal
        meal={makeMeal({ isOfficeLunch: false })}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onAnalyzePhoto={async () => analysis}
        onConfirmPhotoEstimate={noop}
      />,
    );
    expect(screen.queryByText("Office lunch")).not.toBeInTheDocument();

    rerender(
      <MealDetailModal
        meal={makeMeal({ isOfficeLunch: true })}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onAnalyzePhoto={async () => analysis}
        onConfirmPhotoEstimate={noop}
      />,
    );
    expect(screen.getByText("Office lunch")).toBeInTheDocument();
  });

  it("calls onEdit with the meal when Edit is clicked", async () => {
    const onEdit = jest.fn();
    const meal = makeMeal();
    render(
      <MealDetailModal
        meal={meal}
        onClose={jest.fn()}
        onEdit={onEdit}
        onDelete={jest.fn()}
        onAnalyzePhoto={async () => analysis}
        onConfirmPhotoEstimate={noop}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(meal);
  });

  it("calls onDelete and onClose when Delete is clicked", async () => {
    const onDelete = jest.fn();
    const onClose = jest.fn();
    const meal = makeMeal();
    render(
      <MealDetailModal
        meal={meal}
        onClose={onClose}
        onEdit={jest.fn()}
        onDelete={onDelete}
        onAnalyzePhoto={async () => analysis}
        onConfirmPhotoEstimate={noop}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(meal.id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
