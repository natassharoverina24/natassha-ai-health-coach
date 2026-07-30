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

  it("adds confirmed Rice and Soto macros and updates the total after editing Soto", () => {
    const rice = makeMeal({
      id: "rice",
      name: "Rice",
      macros: {
        calories: 200,
        proteinG: 4,
        carbsG: 44,
        fatG: 0.4,
        fiberG: 0.6,
      },
    });
    const soto = makeMeal({
      id: "soto",
      name: "Soto",
      macros: {
        calories: 320,
        proteinG: 22,
        carbsG: 35,
        fatG: 10,
        fiberG: null,
      },
    });
    const props = {
      type: "lunch" as const,
      label: "Lunch",
      onAddFood: jest.fn(),
      onView: jest.fn(),
      onEdit: jest.fn(),
      onDelete: jest.fn(),
    };
    const { rerender } = render(
      <MealTypeSection {...props} items={[rice, soto]} />,
    );

    expect(screen.getByText(/520 kcal/)).toBeInTheDocument();

    rerender(
      <MealTypeSection
        {...props}
        items={[
          rice,
          {
            ...soto,
            macros: { ...soto.macros, calories: 350, proteinG: 24 },
          },
        ]}
      />,
    );
    expect(screen.getByText(/550 kcal/)).toBeInTheDocument();
  });

  it("excludes unresolved all-zero legacy items from the meal total", () => {
    render(
      <MealTypeSection
        type="lunch"
        label="Lunch"
        items={[
          makeMeal({
            id: "rice",
            name: "Rice",
            macros: {
              calories: 200,
              proteinG: 4,
              carbsG: 44,
              fatG: 0.4,
              fiberG: 0.6,
            },
          }),
          makeMeal({
            id: "soto",
            name: "Soto",
            macros: {
              calories: 0,
              proteinG: 0,
              carbsG: 0,
              fatG: 0,
              fiberG: null,
            },
          }),
        ]}
        onAddFood={jest.fn()}
        onView={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getAllByText(/200 kcal/).length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText("Nutrition unresolved · excluded from total"),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 item needs confirmed nutrition/i)).toBeInTheDocument();
  });
});
