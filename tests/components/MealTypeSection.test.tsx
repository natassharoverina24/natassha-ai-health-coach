import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MealTypeSection } from "@/components/meal/MealTypeSection";
import type { MealEntry } from "@/types/firestore";

function makeMeal(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: "meal-1",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    userId: "user-1",
    date: "2026-07-25",
    type: "lunch",
    name: "Grilled chicken",
    quantity: "1 plate",
    isOfficeLunch: false,
    macros: { calories: 400, proteinG: 30, carbsG: 20, fatG: 10, fiberG: 3 },
    photoIds: [],
    score: null,
    note: null,
    ...overrides,
  };
}

describe("MealTypeSection", () => {
  it("shows an empty state when there are no items", () => {
    render(
      <MealTypeSection
        type="breakfast"
        label="Breakfast"
        items={[]}
        onAddFood={jest.fn()}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText(/nothing logged for breakfast yet/i)).toBeInTheDocument();
  });

  it("renders each food item with its quantity and macros", () => {
    render(
      <MealTypeSection
        type="lunch"
        label="Lunch"
        items={[makeMeal()]}
        onAddFood={jest.fn()}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText("Grilled chicken")).toBeInTheDocument();
    expect(screen.getByText("· 1 plate")).toBeInTheDocument();
  });

  it("shows the office lunch badge for office-lunch entries", () => {
    render(
      <MealTypeSection
        type="lunch"
        label="Lunch"
        items={[makeMeal({ isOfficeLunch: true })]}
        onAddFood={jest.fn()}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText("Office lunch")).toBeInTheDocument();
  });

  it("does not expose legacy persisted-photo metadata", () => {
    render(
      <MealTypeSection
        type="lunch"
        label="Lunch"
        items={[makeMeal({ photoIds: ["p1", "p2"] })]}
        onAddFood={jest.fn()}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("calls onView when the row is clicked", async () => {
    const onView = jest.fn();
    const meal = makeMeal();
    render(
      <MealTypeSection
        type="lunch"
        label="Lunch"
        items={[meal]}
        onAddFood={jest.fn()}
        onView={onView}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(`View ${meal.name}`));
    expect(onView).toHaveBeenCalledWith(meal);
  });

  it("calls onEdit when the edit button is clicked", async () => {
    const onEdit = jest.fn();
    const meal = makeMeal();
    render(
      <MealTypeSection
        type="lunch"
        label="Lunch"
        items={[meal]}
        onAddFood={jest.fn()}
        onView={jest.fn()}
        onEdit={onEdit}
        onDelete={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(`Edit ${meal.name}`));
    expect(onEdit).toHaveBeenCalledWith(meal);
  });

  it("calls onDelete with the item id when the delete button is clicked", async () => {
    const onDelete = jest.fn();
    const meal = makeMeal();
    render(
      <MealTypeSection
        type="lunch"
        label="Lunch"
        items={[meal]}
        onAddFood={jest.fn()}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByLabelText(`Delete ${meal.name}`));
    expect(onDelete).toHaveBeenCalledWith(meal.id);
  });

  it("only shows the office lunch quick-add button for the lunch section when the handler is provided", () => {
    const { rerender } = render(
      <MealTypeSection
        type="lunch"
        label="Lunch"
        items={[]}
        onAddFood={jest.fn()}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.queryByText("Office lunch")).not.toBeInTheDocument();

    rerender(
      <MealTypeSection
        type="lunch"
        label="Lunch"
        items={[]}
        onAddFood={jest.fn()}
        onAddOfficeLunch={jest.fn()}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText("Office lunch")).toBeInTheDocument();
  });
});
