import { act, renderHook, waitFor } from "@testing-library/react";

import { useAuth } from "@/contexts/AuthContext";
import { useTodayCoachPlan } from "@/hooks/useTodayCoachPlan";
import { buildTodayCoachPlan } from "@/lib/coach-plan";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@/lib/coach-plan", () => ({
  buildTodayCoachPlan: jest.fn(),
}));

const plan = {
  generatedAt: "2026-07-29T08:00:00.000Z",
  date: "2026-07-29",
  status: "partial",
};

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user-1" } });
  (buildTodayCoachPlan as jest.Mock).mockReset().mockResolvedValue(plan);
});

describe("useTodayCoachPlan", () => {
  it("loads and refreshes a TodayCoachPlan", async () => {
    const { result } = renderHook(() => useTodayCoachPlan());

    await waitFor(() => expect(result.current.plan).toBe(plan));
    expect(buildTodayCoachPlan).toHaveBeenCalledWith("user-1");

    await act(async () => {
      await result.current.refresh();
    });
    expect(buildTodayCoachPlan).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });

  it("returns a friendly error without exposing raw Firebase details", async () => {
    (buildTodayCoachPlan as jest.Mock).mockRejectedValue(
      new Error("Firebase index https://console.firebase.google.com/private"),
    );
    const { result } = renderHook(() => useTodayCoachPlan());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(
      "Today's plan is temporarily unavailable. Please try again.",
    );
    expect(result.current.error).not.toMatch(/firebase|console|index/i);
  });
});
