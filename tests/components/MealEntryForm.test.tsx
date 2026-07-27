import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MealEntryForm } from "@/components/forms/MealEntryForm";

describe("MealEntryForm", () => {
  it("requires a food name before submitting", async () => {
    const onSubmit = jest.fn();
    render(<MealEntryForm onSubmit={onSubmit} onCancel={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Save meal" }));
    // The food name field is HTML5-required, so the browser blocks the
    // submit event entirely before our own validation logic ever runs.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits quantity and fiber alongside the other macros", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MealEntryForm onSubmit={onSubmit} onCancel={jest.fn()} />);
    await userEvent.type(screen.getByLabelText("Food name"), "Tempe goreng");
    await userEvent.type(screen.getByLabelText("Quantity (optional)"), "2 pieces");
    await userEvent.type(screen.getByLabelText("Fiber"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Save meal" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Tempe goreng", quantity: "2 pieces", fiberG: 4 }),
    );
  });

  it("pre-fills fields from initialValues for editing, with a custom submit label", () => {
    render(
      <MealEntryForm
        initialValues={{ name: "Fried rice", quantity: "1 plate", calories: 350 }}
        submitLabel="Save changes"
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByLabelText("Food name")).toHaveValue("Fried rice");
    expect(screen.getByLabelText("Quantity (optional)")).toHaveValue("1 plate");
    expect(screen.getByLabelText("Calories")).toHaveValue(350);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = jest.fn();
    render(<MealEntryForm onSubmit={jest.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
