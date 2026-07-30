import { act, renderHook, waitFor } from "@testing-library/react";

import { useAuth } from "@/contexts/AuthContext";
import { useTodayCoachPlan } from "@/hooks/useTodayCoachPlan";
import { buildTodayCoachPlan } from "@/lib/coach-plan";
import {
  readTodayCoachPlanCache,
  writeTodayCoachPlanCache,
} from "@/lib/coach-plan";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@/lib/coach-plan", () => ({
  buildTodayCoachPlan: jest.fn(),
  readTodayCoachPlanCache: jest.fn(),
  writeTodayCoachPlanCache: jest.fn(),
}));

const plan = {
  generatedAt: "2026-07-29T08:00:00.000Z",
  date: "2026-07-29",
  status: "partial",
};

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user-1" } });
  (buildTodayCoachPlan as jest.Mock).mockReset().mockResolvedValue(plan);
  (readTodayCoachPlanCache as jest.Mock).mockReset().mockReturnValue(null);
  (writeTodayCoachPlanCache as jest.Mock).mockReset();
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

  it("keeps the last visible plan when refresh fails", async () => {
    const { result } = renderHook(() => useTodayCoachPlan());
    await waitFor(() => expect(result.current.plan).toBe(plan));

    (buildTodayCoachPlan as jest.Mock).mockRejectedValueOnce(
      new Error("network detail"),
    );
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.plan).toBe(plan);
    expect(result.current.error).toBe(
      "Today's plan is temporarily unavailable. Please try again.",
    );
  });

  it("shows a same-day cached plan when the live request is unavailable", async () => {
    const cachedPlan = { ...plan, status: "partial", cached: true };
    (readTodayCoachPlanCache as jest.Mock).mockReturnValue(cachedPlan);
    (buildTodayCoachPlan as jest.Mock).mockRejectedValue(
      new Error("private Firebase detail"),
    );

    const { result } = renderHook(() => useTodayCoachPlan());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plan).toBe(cachedPlan);
    expect(result.current.error).not.toMatch(/firebase/i);
    expect(writeTodayCoachPlanCache).not.toHaveBeenCalled();
  });
});
