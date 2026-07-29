import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MealPhotoSection } from "@/components/meal/MealPhotoSection";
import type { MealPhotoAnalysis } from "@/lib/ai/mealPhotoAnalysis";

const analysis: MealPhotoAnalysis = {
  items: [{ name: "Visible meal", estimatedPortion: "about one plate" }],
  estimatedCalories: 420,
  estimatedProteinG: 24,
  confidence: "low",
  uncertain: true,
  assumptions: ["Serving depth is not visible."],
  estimatedAt: "2026-07-28T01:00:00.000Z",
};

describe("MealPhotoSection", () => {
  const createObjectURL = jest.fn(() => "blob:local-preview");
  const revokeObjectURL = jest.fn();

  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders camera and supported-image upload controls", () => {
    render(
      <MealPhotoSection
        onAnalyzeFile={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /take photo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /choose image/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a meal image")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
    expect(screen.getByText(/image is analyzed temporarily/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /upload food photos only.*do not include faces, documents, addresses/i,
      ),
    ).toBeInTheDocument();
  });

  it("rejects an unsupported MIME type before analysis", async () => {
    const onAnalyzeFile = jest.fn();
    render(
      <MealPhotoSection
        onAnalyzeFile={onAnalyzeFile}
        onConfirm={jest.fn()}
      />,
    );
    const file = new File(["not-image"], "meal.gif", { type: "image/gif" });

    await userEvent.upload(screen.getByLabelText("Choose a meal image"), file, {
      applyAccept: false,
    });

    expect(screen.getByText(/choose a JPEG, PNG, or WebP/i)).toBeInTheDocument();
    expect(onAnalyzeFile).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("renders uncertain editable estimates and persists only after confirmation", async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(
      <MealPhotoSection
        onAnalyzeFile={jest.fn().mockResolvedValue(analysis)}
        onConfirm={onConfirm}
      />,
    );
    const file = new File(["image"], "meal.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("Choose a meal image"), file);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Analyse Photo" }),
    );

    expect(
      await screen.findByText(/low confidence.*uncertain/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Food name")).toHaveValue("Visible meal");
    expect(screen.getByLabelText("Estimated portion")).toHaveValue(
      "about one plate",
    );
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText("Food name"));
    await userEvent.type(screen.getByLabelText("Food name"), "Corrected meal");
    await userEvent.clear(screen.getByLabelText("Estimated portion"));
    await userEvent.type(screen.getByLabelText("Estimated portion"), "2 bowls");
    await userEvent.clear(screen.getByLabelText("Estimated calories"));
    await userEvent.type(screen.getByLabelText("Estimated calories"), "510");
    await userEvent.clear(screen.getByLabelText("Estimated protein"));
    await userEvent.type(screen.getByLabelText("Estimated protein"), "31");
    await userEvent.click(
      screen.getByRole("button", { name: /confirm and update meal/i }),
    );

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        foodName: "Corrected meal",
        portion: "2 bowls",
        calories: 510,
        proteinG: 31,
        source: "photo-estimate",
        userConfirmed: true,
        estimatedAt: analysis.estimatedAt,
      }),
    );
    expect(
      screen.getByText(/confirmed estimates saved.*image was not stored/i),
    ).toBeInTheDocument();
  });

  it("revokes temporary object URLs when replaced and on unmount", async () => {
    const onAnalyzeFile = jest.fn().mockResolvedValue(analysis);
    const { unmount } = render(
      <MealPhotoSection
        onAnalyzeFile={onAnalyzeFile}
        onConfirm={jest.fn()}
      />,
    );
    const input = screen.getByLabelText("Choose a meal image");
    await userEvent.upload(
      input,
      new File(["one"], "one.jpg", { type: "image/jpeg" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Analyse Photo" }),
    );
    await screen.findByText(/low confidence/i);
    await userEvent.upload(
      input,
      new File(["two"], "two.png", { type: "image/png" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Analyse Photo" }),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("shows a sanitized provider failure without persisting anything", async () => {
    const onConfirm = jest.fn();
    render(
      <MealPhotoSection
        onAnalyzeFile={jest
          .fn()
          .mockRejectedValue(new Error("Meal-photo analysis provider failed."))}
        onConfirm={onConfirm}
      />,
    );
    await userEvent.upload(
      screen.getByLabelText("Choose a meal image"),
      new File(["private-image-bytes"], "meal.webp", { type: "image/webp" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Analyse Photo" }),
    );
    expect(
      await screen.findByText("Meal-photo analysis provider failed."),
    ).toBeInTheDocument();
    expect(screen.queryByText("private-image-bytes")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
