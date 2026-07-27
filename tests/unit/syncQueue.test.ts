import {
  drainQueue,
  enqueueOperation,
  isRetryExhausted,
  listPendingOperations,
  markAttempt,
  removeOperation,
} from "@/lib/offline/syncQueue";

beforeEach(() => {
  window.localStorage.clear();
});

describe("syncQueue", () => {
  it("enqueues an operation and lists it back", () => {
    const op = enqueueOperation("upload-meal-photo", { mealId: "m1" });
    const pending = listPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(op.id);
    expect(pending[0].type).toBe("upload-meal-photo");
    expect(pending[0].attempts).toBe(0);
  });

  it("removes an operation by id", () => {
    const op = enqueueOperation("generate-report", {});
    removeOperation(op.id);
    expect(listPendingOperations()).toHaveLength(0);
  });

  it("increments attempts on markAttempt", () => {
    const op = enqueueOperation("upload-meal-photo", {});
    markAttempt(op.id);
    const updated = markAttempt(op.id);
    expect(updated?.attempts).toBe(2);
  });

  it("flags retry as exhausted past the max attempt threshold", () => {
    const op = enqueueOperation("upload-meal-photo", {});
    let updated = op;
    for (let i = 0; i < 5; i += 1) {
      updated = markAttempt(op.id)!;
    }
    expect(isRetryExhausted(updated)).toBe(true);
  });

  it("drainQueue removes an operation once its handler succeeds", async () => {
    enqueueOperation("upload-meal-photo", { mealId: "m1" });
    await drainQueue({
      "upload-meal-photo": async () => {
        /* succeeds */
      },
    });
    expect(listPendingOperations()).toHaveLength(0);
  });

  it("drainQueue keeps retrying a failing operation until attempts are exhausted", async () => {
    enqueueOperation("upload-meal-photo", { mealId: "m1" });
    const handler = jest.fn().mockRejectedValue(new Error("network down"));

    for (let i = 0; i < 5; i += 1) {
      await drainQueue({ "upload-meal-photo": handler });
    }

    expect(handler).toHaveBeenCalledTimes(5);
    expect(listPendingOperations()).toHaveLength(0);
  });

  it("leaves operations with no matching handler untouched", async () => {
    enqueueOperation("generate-report", {});
    await drainQueue({});
    expect(listPendingOperations()).toHaveLength(1);
  });
});
