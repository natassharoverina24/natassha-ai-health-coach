import {
  DEFAULT_GEMINI_MEAL_NUTRITION_MODEL,
  DEFAULT_GROQ_MEAL_NUTRITION_MODEL,
  DEFAULT_OPENROUTER_MEAL_NUTRITION_MODEL,
  POST,
  resetNutritionProviderRateLimitsForTests,
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

const validNutrition = {
  grams: 350,
  calories: 320,
  proteinG: 22,
  carbsG: 35,
  fatG: 10,
  fiberG: 2,
  confidence: "low",
  assumptions: ["One medium bowl was assumed."],
};

function geminiResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              { text: JSON.stringify({ ...validNutrition, ...overrides }) },
            ],
          },
        },
      ],
    }),
  };
}

function openAiResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({ ...validNutrition, ...overrides }),
          },
        },
      ],
    }),
  };
}

function failedResponse(status: number) {
  return { ok: false, status, json: async () => ({ private: "hidden" }) };
}

describe("POST /api/ai/meal-nutrition", () => {
  const originalFetch = global.fetch;
  const originalEnvironment = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  };

  beforeEach(() => {
    mockedAuthenticate.mockResolvedValue({
      status: "authenticated",
      uid: "user-1",
    });
    process.env.GEMINI_API_KEY = "gemini-server-secret";
    delete process.env.GEMINI_MODEL;
    process.env.GROQ_API_KEY = "groq-server-secret";
    process.env.OPENROUTER_API_KEY = "openrouter-server-secret";
    resetNutritionProviderRateLimitsForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.restoreAllMocks();
  });

  it("requires verified authentication before calling a provider", async () => {
    mockedAuthenticate.mockResolvedValue({ status: "unauthenticated" });
    global.fetch = jest.fn();

    const response = await POST(request({ name: "Soto", quantity: "1 bowl" }));

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("stops after a successful Gemini estimate", async () => {
    global.fetch = jest.fn().mockResolvedValue(geminiResponse());

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
        provider: "gemini",
        model: DEFAULT_GEMINI_MEAL_NUTRITION_MODEL,
        metadata: {
          source: "gemini",
          providerLabel: "Estimated with Gemini",
          model: DEFAULT_GEMINI_MEAL_NUTRITION_MODEL,
          estimatedAt: expect.any(String),
          confidence: "low",
        },
        uncertain: true,
        servingGrams: 350,
        macros: {
          calories: 320,
          proteinG: 22,
          carbsG: 35,
          fatG: 10,
          fiberG: 2,
        },
      },
    });
  });

  it("falls back from Gemini 429 to Groq", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(failedResponse(429))
      .mockResolvedValueOnce(openAiResponse());

    const response = await POST(request({ name: "Soto", quantity: null }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining(DEFAULT_GROQ_MEAL_NUTRITION_MODEL),
      }),
    );
    expect(body.estimate).toMatchObject({
      source: "groq-estimate",
      provider: "groq",
      metadata: {
        source: "groq",
        providerLabel: "Estimated with Groq",
      },
    });
  });

  it("falls back from invalid Gemini output to Groq", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(geminiResponse({ calories: 0 }))
      .mockResolvedValueOnce(openAiResponse());

    const response = await POST(request({ name: "Soto", quantity: null }));

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(await response.json()).toMatchObject({
      estimate: { source: "groq-estimate" },
    });
  });

  it("uses only the OpenRouter free router after Gemini and Groq fail", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(failedResponse(500))
      .mockResolvedValueOnce(failedResponse(500))
      .mockResolvedValueOnce(openAiResponse());

    const response = await POST(request({ name: "Soto", quantity: null }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining(
          DEFAULT_OPENROUTER_MEAL_NUTRITION_MODEL,
        ),
      }),
    );
    expect(body.estimate).toMatchObject({
      source: "openrouter-estimate",
      model: "openrouter/free",
      metadata: {
        source: "openrouter",
        providerLabel: "Estimated with OpenRouter Free",
      },
    });
  });

  it("returns the manual-entry state when every provider fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(failedResponse(429))
      .mockResolvedValueOnce(failedResponse(500))
      .mockResolvedValueOnce(failedResponse(429));

    const response = await POST(request({ name: "Unknown", quantity: null }));

    expect(response.status).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(await response.json()).toEqual({
      error: "Nutrition estimate unavailable",
    });
  });

  it("rejects invalid user input without calling any provider", async () => {
    global.fetch = jest.fn();

    const response = await POST(request({ name: "", quantity: null }));

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("validates provider output before returning it", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(geminiResponse({ fiberG: -1 }));

    const response = await POST(request({ name: "Unknown", quantity: null }));

    expect(response.status).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("sends only food fields and never user identity or provider secrets", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    global.fetch = jest.fn().mockResolvedValue(geminiResponse());

    await POST(
      request({
        name: "Soto",
        quantity: "1 bowl",
        portion: "350g",
        email: "private@example.com",
        healthHistory: "private",
      }),
    );

    const providerCall = (global.fetch as jest.Mock).mock.calls[0];
    const requestBody = String(providerCall[1]?.body);
    expect(requestBody).toContain("Soto");
    expect(requestBody).toContain("1 bowl");
    expect(requestBody).toContain("350g");
    expect(requestBody).not.toMatch(
      /user-1|private@example|healthHistory|server-secret/i,
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("guards each provider with a process-local hourly limit", async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    global.fetch = jest.fn().mockResolvedValue(geminiResponse());

    for (let index = 0; index < 10; index += 1) {
      const response = await POST(
        request({ name: `Food ${index}`, quantity: null }),
      );
      expect(response.status).toBe(200);
    }
    const blocked = await POST(
      request({ name: "Food blocked", quantity: null }),
    );

    expect(blocked.status).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(10);
  });
});
