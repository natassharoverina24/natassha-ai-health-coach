import {
  loadDataSource,
  sourceCanInformDecisions,
  toSafeDataErrorCode,
} from "@/lib/coach-plan/availability";

describe("coach-plan data availability", () => {
  it("distinguishes available, empty, unavailable, and stale data", async () => {
    const available = await loadDataSource(async () => [1], [], {
      isEmpty: (items) => items.length === 0,
    });
    const empty = await loadDataSource(async () => [], [], {
      isEmpty: (items) => items.length === 0,
    });
    const unavailable = await loadDataSource(
      async () => {
        throw Object.assign(new Error("private URL"), {
          code: "permission-denied",
        });
      },
      [],
      { isEmpty: (items) => items.length === 0 },
    );
    const stale = await loadDataSource(
      async () => [{ updatedAt: "2026-07-28T00:00:00.000Z" }],
      [],
      {
        isEmpty: (items) => items.length === 0,
        updatedAt: (items) => items[0]?.updatedAt,
        staleAfterMs: 60_000,
        now: new Date("2026-07-29T00:00:00.000Z"),
      },
    );

    expect(available.status).toBe("available");
    expect(empty.status).toBe("empty");
    expect(unavailable).toEqual({
      status: "unavailable",
      data: [],
      errorCode: "permission",
    });
    expect(stale.status).toBe("stale");
    expect(sourceCanInformDecisions(available)).toBe(true);
    expect(sourceCanInformDecisions(empty)).toBe(true);
    expect(sourceCanInformDecisions(unavailable)).toBe(false);
    expect(sourceCanInformDecisions(stale)).toBe(false);
  });

  it("maps technical failures to safe error codes only", () => {
    expect(
      toSafeDataErrorCode({
        code: "failed-precondition",
        message: "Create the index at https://console.firebase.google.com/x",
      }),
    ).toBe("index-building");
    expect(toSafeDataErrorCode(new Error("client is offline"))).toBe("offline");
    expect(toSafeDataErrorCode(new Error("secret stack"))).toBe("unknown");
  });
});
