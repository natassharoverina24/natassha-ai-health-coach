import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MealDetailModal } from "@/components/meal/MealDetailModal";
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

describe("MealDetailModal", () => {
  it("renders nothing when meal is null", () => {
    render(
      <MealDetailModal
        meal={null}
        photos={[]}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onUploadPhoto={noop}
        onDeletePhoto={noop}
        uploadingPhoto={false}
        photoUploadError={null}
        deletingPhotoId={null}
      />,
    );
    expect(screen.queryByText("Nasi goreng")).not.toBeInTheDocument();
  });

  it("displays name, quantity, all five macros, and notes", () => {
    const meal = makeMeal();
    render(
      <MealDetailModal
        meal={meal}
        photos={[]}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onUploadPhoto={noop}
        onDeletePhoto={noop}
        uploadingPhoto={false}
        photoUploadError={null}
        deletingPhotoId={null}
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
        photos={[]}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onUploadPhoto={noop}
        onDeletePhoto={noop}
        uploadingPhoto={false}
        photoUploadError={null}
        deletingPhotoId={null}
      />,
    );
    expect(screen.queryByText("Office lunch")).not.toBeInTheDocument();

    rerender(
      <MealDetailModal
        meal={makeMeal({ isOfficeLunch: true })}
        photos={[]}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onUploadPhoto={noop}
        onDeletePhoto={noop}
        uploadingPhoto={false}
        photoUploadError={null}
        deletingPhotoId={null}
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
        photos={[]}
        onClose={jest.fn()}
        onEdit={onEdit}
        onDelete={jest.fn()}
        onUploadPhoto={noop}
        onDeletePhoto={noop}
        uploadingPhoto={false}
        photoUploadError={null}
        deletingPhotoId={null}
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
        photos={[]}
        onClose={onClose}
        onEdit={jest.fn()}
        onDelete={onDelete}
        onUploadPhoto={noop}
        onDeletePhoto={noop}
        uploadingPhoto={false}
        photoUploadError={null}
        deletingPhotoId={null}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(meal.id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
