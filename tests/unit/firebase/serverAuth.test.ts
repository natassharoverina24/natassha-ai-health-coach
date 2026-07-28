import { authenticateFirebaseRequest } from "@/lib/firebase/serverAuth";

function requestWithAuthorization(value?: string): Request {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? value ?? null : null,
    },
  } as unknown as Request;
}

describe("authenticateFirebaseRequest", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY = originalApiKey;
    }
    jest.restoreAllMocks();
  });

  it("rejects a request without a bearer token without making a network call", async () => {
    global.fetch = jest.fn();

    await expect(authenticateFirebaseRequest(requestWithAuthorization())).resolves.toEqual({
      status: "unauthenticated",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fails safely when server Firebase configuration is absent", async () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    await expect(
      authenticateFirebaseRequest(
        requestWithAuthorization("Bearer firebase-token"),
      ),
    ).resolves.toEqual({ status: "configuration-error" });
  });

  it("returns only the uid confirmed by Firebase", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "public-api-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ users: [{ localId: "verified-user" }] }),
    }) as unknown as typeof fetch;

    await expect(
      authenticateFirebaseRequest(
        requestWithAuthorization("Bearer firebase-token"),
      ),
    ).resolves.toEqual({
      status: "authenticated",
      uid: "verified-user",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("accounts:lookup?key=public-api-key"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ idToken: "firebase-token" }),
      }),
    );
  });

  it("does not expose Firebase verification errors", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "public-api-key";
    global.fetch = jest.fn().mockRejectedValue(new Error("sensitive upstream detail"));

    await expect(
      authenticateFirebaseRequest(
        requestWithAuthorization("Bearer firebase-token"),
      ),
    ).resolves.toEqual({ status: "verification-unavailable" });
  });
});
