import { POST, resetWeeklyMealIdeaRateLimitsForTests } from "@/app/api/ai/weekly-meal-ideas/route";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverAuth";

jest.mock("next/server", () => ({ NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) } }));
jest.mock("@/lib/firebase/serverAuth", () => ({ authenticateFirebaseRequest: jest.fn() }));

const authenticate = authenticateFirebaseRequest as jest.MockedFunction<typeof authenticateFirebaseRequest>;
const request = () => ({ headers: new Headers({ Authorization: "Bearer token" }), json: async () => ({ slot: "lunch", currentMealName: "Ayam nasi sayur", likedFoodIds: [], dislikedFoodIds: [], quickMealsPreferred: true }) }) as Request;
const idea = { name: "Ikan nasi lalapan", roles: ["protein", "carb", "vegetable-fiber"], ingredientIds: ["fish", "white-rice", "lalapan"], availability: "common", preparation: "quick", reason: "Bahannya mudah dicari di Indonesia.", searchKeywords: "ikan nasi lalapan simple" };
const gemini = (content: unknown = idea) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(content) }] } }] }) });
const compatible = () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(idea) } }] }) });

describe("POST /api/ai/weekly-meal-ideas", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    authenticate.mockResolvedValue({ status: "authenticated", uid: "u1" });
    process.env.GEMINI_API_KEY = "gemini-secret";
    process.env.GROQ_API_KEY = "groq-secret";
    process.env.OPENROUTER_API_KEY = "openrouter-secret";
    resetWeeklyMealIdeaRateLimitsForTests();
  });
  afterEach(() => { global.fetch = originalFetch; delete process.env.GEMINI_API_KEY; delete process.env.GROQ_API_KEY; delete process.env.OPENROUTER_API_KEY; jest.restoreAllMocks(); });

  it("requires authentication and never exposes a provider secret", async () => {
    authenticate.mockResolvedValue({ status: "unauthenticated" });
    global.fetch = jest.fn();
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns Gemini success after one provider request", async () => {
    global.fetch = jest.fn().mockResolvedValue(gemini());
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ status: "success", idea: { provider: "gemini", nutritionStatus: "needs-confirmation" } });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back from Gemini quota and invalid output to the next free provider", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce(compatible());
    expect(await (await POST(request())).json()).toMatchObject({ status: "success", idea: { provider: "groq" } });
    global.fetch = jest.fn().mockResolvedValueOnce(gemini({ ...idea, calories: 400 })).mockResolvedValueOnce(compatible());
    expect(await (await POST(request())).json()).toMatchObject({ status: "success", idea: { provider: "groq" } });
  });

  it("works without keys and rate-limits to local fallback", async () => {
    delete process.env.GEMINI_API_KEY; delete process.env.GROQ_API_KEY; delete process.env.OPENROUTER_API_KEY;
    global.fetch = jest.fn();
    expect(await (await POST(request())).json()).toEqual({ status: "local-fallback" });
    expect(global.fetch).not.toHaveBeenCalled();
    process.env.GEMINI_API_KEY = "gemini-secret";
    global.fetch = jest.fn().mockResolvedValue(gemini());
    for (let index = 0; index < 4; index += 1) await POST(request());
    const limited = await POST(request());
    expect(await limited.json()).toEqual({ status: "local-fallback" });
  });
});
