import { POST } from "@/app/api/ai/coach/route";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverAuth";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/firebase/serverAuth", () => ({
  authenticateFirebaseRequest: jest.fn(),
}));

const mockedAuthenticate =
  authenticateFirebaseRequest as jest.MockedFunction<
    typeof authenticateFirebaseRequest
  >;

function coachRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    headers: {
      get: (name: string) => normalizedHeaders.get(name.toLowerCase()) ?? null,
    },
    text: async () => body,
  } as unknown as Request;
}

const validBody = JSON.stringify({
  system: "Rewrite the retained decision.",
  messages: [{ role: "user", content: "Explain the plan." }],
  maxTokens: 300,
});

describe("POST /api/ai/coach", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    mockedAuthenticate.mockResolvedValue({
      status: "authenticated",
      uid: "verified-user",
    });
    process.env.ANTHROPIC_API_KEY = "server-secret";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    jest.clearAllMocks();
  });

  it("rejects unauthenticated requests before calling the provider", async () => {
    mockedAuthenticate.mockResolvedValue({ status: "unauthenticated" });
    global.fetch = jest.fn();

    const response = await POST(coachRequest(validBody));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns a clear safe failure when the optional Anthropic key is absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await POST(coachRequest(validBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "ANTHROPIC_API_KEY is not configured on the server.",
    });
  });

  it("rejects invalid and oversized request bodies", async () => {
    const invalid = await POST(coachRequest(JSON.stringify({ messages: [] })));
    expect(invalid.status).toBe(400);

    const oversized = await POST(
      coachRequest(validBody, { "content-length": "32769" }),
    );
    expect(oversized.status).toBe(413);
  });

  it("never relays an upstream provider response body", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "upstream-secret-detail",
    }) as unknown as typeof fetch;

    const response = await POST(coachRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "AI provider request failed (429)." });
    expect(JSON.stringify(body)).not.toContain("upstream-secret-detail");
  });

  it("returns only extracted text for a successful authenticated request", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Retained decision rewritten." }],
      }),
    }) as unknown as typeof fetch;

    const response = await POST(coachRequest(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      text: "Retained decision rewritten.",
    });
  });
});
