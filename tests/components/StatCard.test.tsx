import { render, screen } from "@testing-library/react";
import { Scale } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";

describe("StatCard", () => {
  it("renders label, value, and unit", () => {
    render(<StatCard label="Current weight" value="70.5" unit="kg" icon={<Scale size={18} />} />);
    expect(screen.getByText("Current weight")).toBeInTheDocument();
    expect(screen.getByText("70.5")).toBeInTheDocument();
    expect(screen.getByText("kg")).toBeInTheDocument();
  });

  it("shows a trend indicator when provided", () => {
    render(
      <StatCard
        label="Current weight"
        value="70.5"
        icon={<Scale size={18} />}
        trend={{ label: "-0.4 kg", direction: "down" }}
      />,
    );
    expect(screen.getByText(/-0.4 kg/)).toBeInTheDocument();
  });

  it("renders a progress bar when progressPercent is provided", () => {
    render(<StatCard label="Protein" value="80" icon={<Scale size={18} />} progressPercent={65} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "65");
  });
});
