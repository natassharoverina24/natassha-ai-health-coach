import {
  DEFAULT_GEMINI_MEAL_NUTRITION_MODEL,
  POST,
} from "@/app/api/ai/meal-nutrition/route";
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

function request(body: unknown): Request {
  return {
    json: async () => body,
    headers: new Headers({ Authorization: "Bearer token" }),
  } as Request;
}

function providerResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  servingGrams: 350,
                  calories: 320,
                  proteinG: 22,
                  carbsG: 35,
                  fatG: 10,
                  confidence: "low",
                  assumptions: ["One medium bowl was assumed."],
                  ...overrides,
                }),
              },
            ],
          },
        },
      ],
    }),
  };
}

describe("POST /api/ai/meal-nutrition", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    mockedAuthenticate.mockResolvedValue({
      status: "authenticated",
      uid: "user-1",
    });
    process.env.GEMINI_API_KEY = "server-secret";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  it("requires verified authentication before calling Gemini", async () => {
    mockedAuthenticate.mockResolvedValue({ status: "unauthenticated" });
    global.fetch = jest.fn();

    const response = await POST(request({ name: "Soto", quantity: "1 bowl" }));

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns validated uncertain macros from one Gemini request", async () => {
    global.fetch = jest.fn().mockResolvedValue(providerResponse());

    const response = await POST(request({ name: "Soto", quantity: "1 bowl" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent(DEFAULT_GEMINI_MEAL_NUTRITION_MODEL),
      ),
      expect.objectContaining({ method: "POST" }),
    );
    expect(body).toMatchObject({
      estimate: {
        source: "gemini-estimate",
        uncertain: true,
        servingGrams: 350,
        macros: {
          calories: 320,
          proteinG: 22,
          carbsG: 35,
          fatG: 10,
        },
      },
    });
  });

  it("rejects malformed all-zero provider nutrition", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      providerResponse({
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      }),
    );

    const response = await POST(request({ name: "Unknown", quantity: null }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Nutrition estimate unavailable",
    });
  });

  it("returns a friendly 429 without retrying or using another provider", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });

    const response = await POST(request({ name: "Unknown", quantity: null }));

    expect(response.status).toBe(429);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      error: "Nutrition estimate unavailable",
    });
  });
});
