import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OfficeLunchQuickForm } from "@/components/forms/OfficeLunchQuickForm";

describe("OfficeLunchQuickForm", () => {
  it("renders every office lunch item as a selectable chip", () => {
    render(<OfficeLunchQuickForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
    for (const label of ["Rice", "Chicken", "Fish", "Egg", "Tempe", "Tofu", "Vegetables", "Soup", "Fruit", "Dessert", "Sweet Drink"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("disables saving until at least one item is selected", () => {
    render(<OfficeLunchQuickForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Save lunch" })).toBeDisabled();
  });

  it("estimates and shows combined nutrition once items are selected", async () => {
    render(<OfficeLunchQuickForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Rice" }));
    await userEvent.click(screen.getByRole("button", { name: "Chicken" }));
    // Rice (200 kcal) + Chicken (220 kcal) = 420
    expect(screen.getByLabelText("Calories")).toHaveValue(420);
    expect(screen.getByRole("button", { name: "Save lunch" })).not.toBeDisabled();
  });

  it("submits the joined item names and combined macros", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<OfficeLunchQuickForm onSubmit={onSubmit} onCancel={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Rice" }));
    await userEvent.click(screen.getByRole("button", { name: "Egg" }));
    await userEvent.click(screen.getByRole("button", { name: "Save lunch" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Rice, Egg", calories: 200 + 78 }),
    );
  });

  it("allows manually editing the estimated macros before saving", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<OfficeLunchQuickForm onSubmit={onSubmit} onCancel={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Rice" }));
    const caloriesInput = screen.getByLabelText("Calories");
    await userEvent.clear(caloriesInput);
    await userEvent.type(caloriesInput, "350");
    await userEvent.click(screen.getByRole("button", { name: "Save lunch" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ calories: 350 }));
  });
});
