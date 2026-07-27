import { render, screen } from "@testing-library/react";

import { ProgressBar } from "@/components/ui/ProgressBar";

describe("ProgressBar", () => {
  it("reflects the given value via aria-valuenow", () => {
    render(<ProgressBar value={42} label="Protein progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
  });

  it("clamps values above 100", () => {
    render(<ProgressBar value={150} label="Overfilled" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("clamps negative values to zero", () => {
    render(<ProgressBar value={-20} label="Empty" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
