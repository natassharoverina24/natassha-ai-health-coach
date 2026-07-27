import { render, screen } from "@testing-library/react";

import { HealthRings, HealthRingsLegend } from "@/components/charts/HealthRings";

describe("HealthRings", () => {
  it("renders an accessible label summarizing every ring", () => {
    render(
      <HealthRings
        rings={[
          { label: "Protein", value: 80, color: "#ff6b9d" },
          { label: "Water", value: 50, color: "#3fbfb0" },
        ]}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName("Protein 80 percent, Water 50 percent");
  });

  it("renders one circle pair (track + progress) per ring", () => {
    const { container } = render(
      <HealthRings rings={[{ label: "Protein", value: 80, color: "#ff6b9d" }]} />,
    );
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
  });
});

describe("HealthRingsLegend", () => {
  it("renders a rounded percentage per ring", () => {
    render(<HealthRingsLegend rings={[{ label: "Steps", value: 66.7, color: "#ffb648" }]} />);
    expect(screen.getByText("Steps")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
  });
});
