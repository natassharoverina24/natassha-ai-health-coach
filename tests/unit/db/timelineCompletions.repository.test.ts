jest.mock("@/lib/db/baseRepository", () => ({
  createRepository: jest.fn(() => {
    const repository = {
      collectionName: "timeline_completions",
      get: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
    };
    return repository;
  }),
}));

import { createRepository } from "@/lib/db/baseRepository";
import {
  timelineCompletionDocumentId,
  timelineCompletionsRepository,
} from "@/lib/db/timelineCompletions.repository";

const repositoryMock = (createRepository as jest.Mock).mock.results[0]
  .value as {
  get: jest.Mock;
  create: jest.Mock;
  list: jest.Mock;
};

const completion = {
  userId: "user-1",
  date: "2026-07-29",
  itemId: "2026-07-29:sleepPreparation",
  completedAt: "2026-07-29T21:00:00.000Z",
};

beforeEach(() => {
  repositoryMock.get.mockReset();
  repositoryMock.create.mockReset();
  repositoryMock.list.mockReset();
});

describe("timelineCompletionsRepository", () => {
  it("uses a deterministic document ID", () => {
    expect(
      timelineCompletionDocumentId(
        completion.userId,
        completion.date,
        completion.itemId,
      ),
    ).toBe(
      "user-1__2026-07-29__2026-07-29%3AsleepPreparation",
    );
  });

  it("persists a manual completion once and avoids a duplicate write", async () => {
    const id = timelineCompletionDocumentId(
      completion.userId,
      completion.date,
      completion.itemId,
    );
    repositoryMock.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id, ...completion });
    repositoryMock.create.mockResolvedValue(id);

    await expect(
      timelineCompletionsRepository.markCompleted(completion),
    ).resolves.toBe(id);
    await expect(
      timelineCompletionsRepository.markCompleted(completion),
    ).resolves.toBe(id);

    expect(repositoryMock.create).toHaveBeenCalledTimes(1);
    expect(repositoryMock.create).toHaveBeenCalledWith(completion, id);
  });
});
