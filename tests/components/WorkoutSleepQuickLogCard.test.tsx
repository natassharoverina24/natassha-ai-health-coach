import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkoutSleepQuickLogCard } from "@/components/coach/WorkoutSleepQuickLogCard";
import type { SleepEntry, WorkoutEntry } from "@/types/firestore";

function makeWorkout(overrides: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return {
    id: "w1",
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    userId: "u1",
    date: "2026-07-25",
    name: "Run",
    durationMin: 20,
    note: null,
    ...overrides,
  };
}

function makeSleep(overrides: Partial<SleepEntry> = {}): SleepEntry {
  return {
    id: "s1",
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    userId: "u1",
    date: "2026-07-25",
    hoursSlept: 7,
    note: null,
    ...overrides,
  };
}

describe("WorkoutSleepQuickLogCard", () => {
  it("renders both quick-log forms", () => {
    render(
      <WorkoutSleepQuickLogCard
        todaysWorkouts={[]}
        todaysSleep={null}
        onLogWorkout={jest.fn()}
        onLogSleep={jest.fn()}
      />,
    );
    expect(screen.getByText("Today's workout")).toBeInTheDocument();
    expect(screen.getByText("Last night's sleep")).toBeInTheDocument();
  });

  it("shows total minutes logged today when workouts exist", () => {
    render(
      <WorkoutSleepQuickLogCard
        todaysWorkouts={[makeWorkout({ durationMin: 20 }), makeWorkout({ id: "w2", durationMin: 15 })]}
        todaysSleep={null}
        onLogWorkout={jest.fn()}
        onLogSleep={jest.fn()}
      />,
    );
    expect(screen.getByText("35 min logged")).toBeInTheDocument();
  });

  it("shows already-logged sleep hours and offers to update", () => {
    render(
      <WorkoutSleepQuickLogCard
        todaysWorkouts={[]}
        todaysSleep={makeSleep({ hoursSlept: 6.5 })}
        onLogWorkout={jest.fn()}
        onLogSleep={jest.fn()}
      />,
    );
    expect(screen.getByText("6.5h logged")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });

  it("submits the workout name and duration", async () => {
    const onLogWorkout = jest.fn().mockResolvedValue(undefined);
    render(
      <WorkoutSleepQuickLogCard
        todaysWorkouts={[]}
        todaysSleep={null}
        onLogWorkout={onLogWorkout}
        onLogSleep={jest.fn()}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText("e.g. Brisk walk"), "Yoga");
    await userEvent.type(screen.getByPlaceholderText("min"), "25");
    await userEvent.click(screen.getByRole("button", { name: "Log workout" }));
    expect(onLogWorkout).toHaveBeenCalledWith("Yoga", 25);
  });

  it("does not submit the workout form with an empty name", async () => {
    const onLogWorkout = jest.fn();
    render(
      <WorkoutSleepQuickLogCard
        todaysWorkouts={[]}
        todaysSleep={null}
        onLogWorkout={onLogWorkout}
        onLogSleep={jest.fn()}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText("min"), "25");
    await userEvent.click(screen.getByRole("button", { name: "Log workout" }));
    expect(onLogWorkout).not.toHaveBeenCalled();
  });

  it("submits sleep hours", async () => {
    const onLogSleep = jest.fn().mockResolvedValue(undefined);
    render(
      <WorkoutSleepQuickLogCard
        todaysWorkouts={[]}
        todaysSleep={null}
        onLogWorkout={jest.fn()}
        onLogSleep={onLogSleep}
      />,
    );
    await userEvent.type(screen.getByLabelText("Hours slept"), "7.5");
    await userEvent.click(screen.getByRole("button", { name: "Log sleep" }));
    expect(onLogSleep).toHaveBeenCalledWith(7.5);
  });
});
