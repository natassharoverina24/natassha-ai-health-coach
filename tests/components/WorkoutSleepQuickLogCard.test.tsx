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
    name: "Treadmill",
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

const baseProps = {
  todaysWorkouts: [] as WorkoutEntry[],
  todaysSleep: null as SleepEntry | null,
  userWeightKg: 60,
  onLogWorkout: jest.fn().mockResolvedValue(undefined),
  onLogSleep: jest.fn().mockResolvedValue(undefined),
};

describe("WorkoutSleepQuickLogCard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders workout and sleep as separate progress sections", () => {
    const { container } = render(<WorkoutSleepQuickLogCard {...baseProps} />);
    expect(screen.getByRole("heading", { name: "Progress workout" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Progress tidur" })).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("grid", "lg:grid-cols-2");
  });

  it("accepts treadmill duration and generates a transparent calorie estimate", async () => {
    const user = userEvent.setup();
    const onLogWorkout = jest.fn().mockResolvedValue(undefined);
    render(<WorkoutSleepQuickLogCard {...baseProps} onLogWorkout={onLogWorkout} />);

    await user.type(screen.getByLabelText("Durasi"), "30");
    expect(screen.getByLabelText("Kalori olahraga")).toHaveValue(189);
    expect(screen.getByText(/Kalori olahraga ini estimasi ya/)).toBeInTheDocument();
    expect(screen.getByText(/MET 6, durasi 30 menit, dan berat 60 kg/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Simpan workout" }));

    expect(onLogWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Treadmill",
        activityType: "treadmill",
        durationMin: 30,
        caloriesBurnedKcal: 189,
        calorieEstimate: expect.objectContaining({
          method: "met-local",
          userConfirmed: true,
          wasEdited: false,
        }),
      }),
    );
  });

  it("lets the user override the estimated workout calories", async () => {
    const user = userEvent.setup();
    const onLogWorkout = jest.fn().mockResolvedValue(undefined);
    render(<WorkoutSleepQuickLogCard {...baseProps} onLogWorkout={onLogWorkout} />);
    await user.type(screen.getByLabelText("Durasi"), "30");
    await user.clear(screen.getByLabelText("Kalori olahraga"));
    await user.type(screen.getByLabelText("Kalori olahraga"), "215");
    await user.click(screen.getByRole("button", { name: "Simpan workout" }));
    expect(onLogWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        caloriesBurnedKcal: 215,
        calorieEstimate: expect.objectContaining({ wasEdited: true }),
      }),
    );
  });

  it("shows a partial estimate when weight is missing and accepts manual calories", async () => {
    const user = userEvent.setup();
    const onLogWorkout = jest.fn().mockResolvedValue(undefined);
    render(
      <WorkoutSleepQuickLogCard
        {...baseProps}
        userWeightKg={null}
        onLogWorkout={onLogWorkout}
      />,
    );
    await user.type(screen.getByLabelText("Durasi"), "30");
    expect(screen.getByText(/Berat badan belum tersedia/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simpan workout" })).toBeDisabled();
    await user.type(screen.getByLabelText("Kalori olahraga"), "180");
    await user.click(screen.getByRole("button", { name: "Simpan workout" }));
    expect(onLogWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ caloriesBurnedKcal: 180 }),
    );
  });

  it("calculates overnight sleep and submits structured times", async () => {
    const user = userEvent.setup();
    const onLogSleep = jest.fn().mockResolvedValue(undefined);
    render(<WorkoutSleepQuickLogCard {...baseProps} onLogSleep={onLogSleep} />);
    await user.type(screen.getByLabelText("Jam tidur"), "23:30");
    await user.type(screen.getByLabelText("Jam bangun"), "06:00");
    expect(screen.getByText("Tidurmu sekitar 6 jam 30 menit.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Simpan tidur" }));
    expect(onLogSleep).toHaveBeenCalledWith({
      sleepAt: "23:30",
      wakeAt: "06:00",
      hoursSlept: 6.5,
      quality: null,
    });
  });

  it("shows existing progress without diagnostic or medical copy", () => {
    render(
      <WorkoutSleepQuickLogCard
        {...baseProps}
        todaysWorkouts={[makeWorkout({ durationMin: 20 }), makeWorkout({ id: "w2", durationMin: 15 })]}
        todaysSleep={makeSleep({ hoursSlept: 6.5 })}
      />,
    );
    expect(screen.getByText("35 menit")).toBeInTheDocument();
    expect(screen.getByText("6.5 jam")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/diagnosis|insomnia|treatment|medical/i);
  });
});
