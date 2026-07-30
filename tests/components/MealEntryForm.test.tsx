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
    await userEvent.type(screen.getByLabelText("Calories"), "300");
    await userEvent.type(screen.getByLabelText("Protein"), "18");
    await userEvent.type(screen.getByLabelText("Carbs"), "24");
    await userEvent.type(screen.getByLabelText("Fat"), "12");
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

  it("shows an AI estimate, allows edits, and saves only after confirmation", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onEstimate = jest.fn().mockResolvedValue({
      status: "ready",
      estimate: {
        source: "gemini-estimate",
        servingGrams: 350,
        macros: {
          calories: 320,
          proteinG: 22,
          carbsG: 35,
          fatG: 10,
        },
        assumptions: ["One medium bowl was assumed."],
        confidence: "low",
        uncertain: true,
        estimatedAt: "2026-07-30T08:00:00.000Z",
      },
    });
    render(
      <MealEntryForm
        defaultType="lunch"
        submitLabel="Save food"
        onEstimate={onEstimate}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Food name"), "Soto");
    await user.type(screen.getByLabelText("Quantity (optional)"), "1 mangkok");
    await user.click(screen.getByRole("button", { name: "Estimate nutrition" }));

    expect(onEstimate).toHaveBeenCalledWith({
      name: "Soto",
      quantity: "1 mangkok",
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Calories")).toHaveValue(320);
    expect(screen.getByText("One medium bowl was assumed.")).toBeInTheDocument();
    expect(screen.getByText(/AI estimate: low confidence · uncertain/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Calories"));
    await user.type(screen.getByLabelText("Calories"), "350");
    await user.click(
      screen.getByRole("button", { name: "Confirm and save food" }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Soto",
        quantity: "1 mangkok",
        calories: 350,
        proteinG: 22,
        carbsG: 35,
        fatG: 10,
        nutritionConfirmation: expect.objectContaining({
          status: "confirmed",
          source: "gemini-estimate",
          userConfirmed: true,
          servingGrams: 350,
        }),
      }),
    );
  });

  it("opens manual entry when estimation is unavailable and never saves blanks as zero", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <MealEntryForm
        onEstimate={jest.fn().mockResolvedValue({
          status: "unavailable",
          message: "Nutrition estimate unavailable",
        })}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Food name"), "Unknown food");
    await user.click(screen.getByRole("button", { name: "Estimate nutrition" }));

    expect(
      screen.getByText("Nutrition estimate unavailable"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Confirm and save meal" }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/confirm calories, protein, carbs, and fat/i),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Calories"), "280");
    await user.type(screen.getByLabelText("Protein"), "12");
    await user.type(screen.getByLabelText("Carbs"), "30");
    await user.type(screen.getByLabelText("Fat"), "9");
    await user.click(
      screen.getByRole("button", { name: "Confirm and save meal" }),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        calories: 280,
        proteinG: 12,
        carbsG: 30,
        fatG: 9,
        nutritionConfirmation: expect.objectContaining({
          source: "manual-entry",
          userConfirmed: true,
        }),
      }),
    );
  });

  it("reuses one idempotent document id when a save is retried", async () => {
    const user = userEvent.setup();
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error("private Firebase detail"))
      .mockResolvedValueOnce(undefined);
    render(<MealEntryForm onSubmit={onSubmit} onCancel={jest.fn()} />);
    await user.type(screen.getByLabelText("Food name"), "Confirmed food");
    await user.type(screen.getByLabelText("Calories"), "250");
    await user.type(screen.getByLabelText("Protein"), "12");
    await user.type(screen.getByLabelText("Carbs"), "30");
    await user.type(screen.getByLabelText("Fat"), "8");

    await user.click(screen.getByRole("button", { name: "Save meal" }));
    expect(
      await screen.findByText("Failed to save meal. Please try again."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save meal" }));

    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[0][0].clientRequestId).toBe(
      onSubmit.mock.calls[1][0].clientRequestId,
    );
    expect(onSubmit.mock.calls[0][0].clientRequestId).toMatch(
      /^manual-meal-/,
    );
    expect(document.body).not.toHaveTextContent(/firebase|private/i);
  });
});
