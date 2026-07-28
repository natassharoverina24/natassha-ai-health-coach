import {
  DEFAULT_GEMINI_MEAL_PHOTO_MODEL,
  POST,
} from "@/app/api/ai/meal-photo/route";
import { MAX_MEAL_IMAGE_BYTES } from "@/lib/ai/mealPhotoAnalysis";
import { resetMealPhotoRateLimitForTests } from "@/lib/ai/mealPhotoRateLimit";
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

function imageBlob(type = "image/jpeg", content = "private-image-bytes") {
  const blob = new Blob([content], { type });
  Object.defineProperty(blob, "arrayBuffer", {
    configurable: true,
    value: async () =>
      Uint8Array.from(content, (character) => character.charCodeAt(0)).buffer,
  });
  return blob;
}

function multipartRequest(
  entry: Blob | string | null,
  headers: Record<string, string> = {},
): Request {
  const normalizedHeaders = new Map(
    Object.entries({
      "content-type": "multipart/form-data; boundary=test",
      "content-length": "1024",
      ...headers,
    }).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    headers: {
      get: (name: string) => normalizedHeaders.get(name.toLowerCase()) ?? null,
    },
    formData: async () => ({
      get: (name: string) => (name === "image" ? entry : null),
    }),
  } as unknown as Request;
}

function providerSuccess(overrides: Record<string, unknown> = {}) {
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
                  items: [
                    {
                      name: "Visible food",
                      estimatedPortion: "about one plate",
                    },
                  ],
                  estimatedCalories: 430,
                  estimatedProteinG: 23,
                  confidence: "low",
                  assumptions: ["Serving depth is not visible."],
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

describe("POST /api/ai/meal-photo", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    resetMealPhotoRateLimitForTests();
    mockedAuthenticate.mockResolvedValue({
      status: "authenticated",
      uid: "owner-user",
    });
    process.env.GEMINI_API_KEY = "server-secret";
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
    jest.restoreAllMocks();
  });

  it("requires verified Firebase authentication before reading the image", async () => {
    mockedAuthenticate.mockResolvedValue({ status: "unauthenticated" });
    global.fetch = jest.fn();
    const request = multipartRequest(imageBlob());
    const formDataSpy = jest.spyOn(request, "formData");

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each(["image/jpeg", "image/png", "image/webp"])(
    "accepts supported %s input and returns uncertain structured output",
    async (type) => {
      global.fetch = jest.fn().mockResolvedValue(providerSuccess());

      const response = await POST(multipartRequest(imageBlob(type)));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.analysis).toEqual(
        expect.objectContaining({
          items: [
            { name: "Visible food", estimatedPortion: "about one plate" },
          ],
          estimatedCalories: 430,
          estimatedProteinG: 23,
          confidence: "low",
          uncertain: true,
          assumptions: ["Serving depth is not visible."],
        }),
      );
      expect(body.analysis).not.toHaveProperty("recommendation");
      expect(body.analysis).not.toHaveProperty("coachingDecision");
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MEAL_PHOTO_MODEL}:generateContent`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": "server-secret",
          },
        }),
      );
      expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toMatch(
        /anthropic/i,
      );
    },
  );

  it("fails safely when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    global.fetch = jest.fn();

    const response = await POST(multipartRequest(imageBlob()));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Meal-photo analysis is not configured.",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types and oversized requests", async () => {
    global.fetch = jest.fn();
    const unsupported = await POST(
      multipartRequest(imageBlob("application/pdf")),
    );
    expect(unsupported.status).toBe(415);

    const oversized = await POST(
      multipartRequest(imageBlob(), {
        "content-length": String(MAX_MEAL_IMAGE_BYTES + 1),
      }),
    );
    expect(oversized.status).toBe(413);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns the exact sanitized response for Gemini free-quota exhaustion", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation();
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: "provider-secret-private-image-bytes" },
      }),
    });

    const response = await POST(
      multipartRequest(imageBlob("image/jpeg", "private-image-bytes")),
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(429);
    expect(serialized).toBe(
      JSON.stringify({
        error:
          "Free photo-analysis quota is temporarily exhausted. Please try again later.",
      }),
    );
    expect(serialized).not.toContain("private-image-bytes");
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed or coaching/medical provider output", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "not-json" }] } }],
        }),
      })
      .mockResolvedValueOnce(
        providerSuccess({
          assumptions: ["You should take thyroid medication."],
        }),
      );

    const malformed = await POST(multipartRequest(imageBlob()));
    expect(malformed.status).toBe(502);
    const prohibited = await POST(multipartRequest(imageBlob()));
    expect(prohibited.status).toBe(502);
    expect(JSON.stringify(await prohibited.json())).not.toMatch(
      /thyroid|medication/i,
    );
  });

  it("rejects the sixth hourly request before calling Gemini", async () => {
    global.fetch = jest.fn().mockResolvedValue(providerSuccess());
    for (let requestNumber = 1; requestNumber <= 5; requestNumber += 1) {
      const response = await POST(multipartRequest(imageBlob()));
      expect(response.status).toBe(200);
    }

    const sixth = await POST(multipartRequest(imageBlob()));

    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({
      error: "Hourly photo-analysis limit reached. Please try again later.",
    });
    expect(global.fetch).toHaveBeenCalledTimes(5);
  });

  it("keeps independent hourly limits for different authenticated users", async () => {
    global.fetch = jest.fn().mockResolvedValue(providerSuccess());
    for (let requestNumber = 1; requestNumber <= 5; requestNumber += 1) {
      await POST(multipartRequest(imageBlob()));
    }
    mockedAuthenticate.mockResolvedValue({
      status: "authenticated",
      uid: "other-user",
    });

    const otherUserResponse = await POST(multipartRequest(imageBlob()));

    expect(otherUserResponse.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });

  it("uses the configured Gemini model without a paid-provider fallback", async () => {
    process.env.GEMINI_MODEL = "configured-free-model";
    global.fetch = jest.fn().mockResolvedValue(providerSuccess());

    await POST(multipartRequest(imageBlob()));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/configured-free-model:generateContent",
      expect.anything(),
    );
  });
});
