jest.mock("@/lib/db/baseRepository", () => ({
  createRepository: jest.fn(() => ({
    collectionName: "active_disruptions",
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  })),
}));

import { createRepository } from "@/lib/db/baseRepository";
import {
  activeDisruptionDocumentId,
  activeDisruptionsRepository,
  type ActiveDisruptionInput,
  validateActiveDisruptionInput,
} from "@/lib/db/activeDisruptions.repository";

const repositoryMock = (createRepository as jest.Mock).mock.results[0]
  .value as {
  get: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

const base = {
  userId: "user-1",
  date: "2026-07-29",
  startedAt: "2026-07-29T08:00:00.000Z",
};

const validInputs: ActiveDisruptionInput[] = [
  { ...base, type: "working-late", expectedEndAt: "21:00" },
  { ...base, type: "migraine" },
  { ...base, type: "feeling-unwell" },
  { ...base, type: "pms" },
  { ...base, type: "travelling", affectedSlot: "lunch" },
  {
    ...base,
    type: "event-or-reception",
    affectedMealSlot: "dinner",
  },
  { ...base, type: "missed-workout" },
  {
    ...base,
    type: "skipped-meal",
    skippedMealSlot: "breakfast",
    skippedAt: "08:00",
  },
];

beforeEach(() => {
  repositoryMock.get.mockReset();
  repositoryMock.create.mockReset();
  repositoryMock.update.mockReset();
});

describe("activeDisruptionsRepository", () => {
  it.each(validInputs)("accepts the $type owner contract", (input) => {
    expect(validateActiveDisruptionInput(input)).toBe(true);
  });

  it.each([
    { ...base, type: "working-late" },
    { ...base, type: "travelling" },
    { ...base, type: "event-or-reception" },
    { ...base, type: "skipped-meal", skippedMealSlot: "lunch" },
  ])("rejects incomplete $type input", (input) => {
    expect(validateActiveDisruptionInput(input)).toBe(false);
  });

  it("rejects an unsupported disruption type before writing", async () => {
    await expect(
      activeDisruptionsRepository.setActive({
        ...base,
        type: "unsupported",
      } as never),
    ).rejects.toThrow("invalid-active-disruption");
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });

  it("writes idempotently to one user-and-date document", async () => {
    const input = validInputs[1];
    const id = activeDisruptionDocumentId(input.userId, input.date);
    repositoryMock.create.mockResolvedValue(id);

    await activeDisruptionsRepository.setActive(input);
    await activeDisruptionsRepository.setActive(input);

    expect(repositoryMock.create).toHaveBeenCalledTimes(2);
    expect(repositoryMock.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "user-1",
        date: "2026-07-29",
        status: "active",
      }),
      id,
    );
    expect(repositoryMock.create).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      id,
    );
  });

  it("clears the same-day record and does not carry it to another date", async () => {
    const active = {
      id: "user-1__2026-07-29",
      ...base,
      type: "migraine",
      status: "active",
    };
    repositoryMock.get
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(null);

    await activeDisruptionsRepository.clear(
      "user-1",
      "2026-07-29",
      "2026-07-29T09:00:00.000Z",
    );
    await expect(
      activeDisruptionsRepository.getActiveForUserByDate(
        "user-1",
        "2026-07-30",
      ),
    ).resolves.toBeNull();

    expect(repositoryMock.update).toHaveBeenCalledWith(
      "user-1__2026-07-29",
      {
        status: "cleared",
        clearedAt: "2026-07-29T09:00:00.000Z",
      },
    );
    expect(repositoryMock.get).toHaveBeenLastCalledWith(
      "user-1__2026-07-30",
    );
  });
});
