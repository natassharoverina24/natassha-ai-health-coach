import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuickWaterForm } from "@/components/forms/QuickWaterForm";

describe("QuickWaterForm", () => {
  it("defaults the amount to 250ml", () => {
    render(<QuickWaterForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByLabelText("Amount")).toHaveValue(250);
  });

  it("submits the edited amount", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<QuickWaterForm onSubmit={onSubmit} onCancel={jest.fn()} />);
    const input = screen.getByLabelText("Amount");
    await userEvent.clear(input);
    await userEvent.type(input, "600");
    await userEvent.click(screen.getByRole("button", { name: "Log water" }));
    expect(onSubmit).toHaveBeenCalledWith(600);
  });

  it("rejects a zero or negative amount", async () => {
    const onSubmit = jest.fn();
    render(<QuickWaterForm onSubmit={onSubmit} onCancel={jest.fn()} />);
    const input = screen.getByLabelText("Amount");
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    await userEvent.click(screen.getByRole("button", { name: "Log water" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/enter an amount greater than zero/i)).toBeInTheDocument();
  });
});
