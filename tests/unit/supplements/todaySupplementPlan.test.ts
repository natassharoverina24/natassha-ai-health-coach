import {
  buildTodaySupplementPlan,
  getSupplementReminderCopy,
  updateSupplementStatus,
} from "@/lib/supplements";
import type {
  SupplementDefinition,
  SupplementLog,
} from "@/types/firestore";

function supplement(
  overrides: Partial<SupplementDefinition> = {},
): SupplementDefinition {
  return {
    id: "supplement-1",
    userId: "user-1",
    name: "Saved supplement",
    dosage: null,
    frequency: "daily",
    timesOfDay: ["08:00"],
    active: true,
    provenance: "user_confirmed",
    userConfirmed: true,
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

function log(overrides: Partial<SupplementLog> = {}): SupplementLog {
  return {
    id: "log-1",
    userId: "user-1",
    supplementId: "supplement-1",
    date: "2026-08-02",
    taken: false,
    takenAt: null,
    status: "planned",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("today supplement plan", () => {
  it("shows reminders only for active user-confirmed supplements", () => {
    const result = buildTodaySupplementPlan(
      [
        supplement(),
        supplement({ id: "local", provenance: "local_rule", userConfirmed: false }),
        supplement({ id: "inactive", active: false }),
      ],
      [],
      "2026-08-02",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      supplementId: "supplement-1",
      status: "planned",
      provenance: "user_confirmed",
      doseText: null,
    });
    expect(result[0].reminder).toMatch(/berdasarkan supplement yang kamu simpan/i);
  });

  it("returns no reminder when no saved supplement exists", () => {
    expect(buildTodaySupplementPlan([], [], "2026-08-02")).toEqual([]);
    expect(
      buildTodaySupplementPlan(
        [supplement({ provenance: "local_rule", userConfirmed: false })],
        [],
        "2026-08-02",
      ),
    ).toEqual([]);
  });

  it.each(["taken", "skipped", "remind-later"] as const)(
    "derives the %s state and supportive copy",
    (status) => {
      const result = buildTodaySupplementPlan(
        [supplement()],
        [log({ status, taken: status === "taken" })],
        "2026-08-02",
      );
      expect(result[0].status).toBe(status);
      expect(result[0].reminder).toBe(getSupplementReminderCopy(status));
    },
  );

  it("keeps skipped wording non-judgmental and remind-later in-app only", () => {
    expect(getSupplementReminderCopy("skipped")).toMatch(/nggak apa-apa/i);
    expect(getSupplementReminderCopy("remind-later")).toMatch(/membuka halaman/i);
    expect(
      `${getSupplementReminderCopy("skipped")} ${getSupplementReminderCopy("remind-later")}`,
    ).not.toMatch(/gagal|salah|push notification|obat|resep/i);
  });

  it("never creates a supplement or dosage recommendation", () => {
    const result = buildTodaySupplementPlan(
      [
        supplement({ name: "Migraine routine", dosage: null }),
        supplement({ id: "thyroid-routine", name: "Thyroid saved routine", dosage: null }),
        supplement({ id: "pms-routine", name: "PMS saved routine", dosage: null }),
      ],
      [],
      "2026-08-02",
    );
    expect(result.every((item) => item.doseText === null)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /cure|prevent|treat|diagnos|prescri|recommended dose|thyroid treatment|pms treatment/i,
    );
  });

  it("respects weekday/custom schedules without mutating inputs", () => {
    const definitions = [
      supplement({ id: "weekday", frequency: "weekdays" }),
      supplement({ id: "custom", frequency: "custom", daysOfWeek: [0] }),
    ];
    const before = JSON.parse(JSON.stringify(definitions));
    const sunday = buildTodaySupplementPlan(definitions, [], "2026-08-02");

    expect(sunday.map((item) => item.supplementId)).toEqual(["custom"]);
    expect(definitions).toEqual(before);
  });

  it("updates status deterministically without mutating the plan", () => {
    const original = buildTodaySupplementPlan([supplement()], [], "2026-08-02");
    const updated = updateSupplementStatus(original, "supplement-1", "taken");

    expect(updated[0].status).toBe("taken");
    expect(original[0].status).toBe("planned");
    expect(updateSupplementStatus(original, "supplement-1", "taken")).toEqual(updated);
  });
});
