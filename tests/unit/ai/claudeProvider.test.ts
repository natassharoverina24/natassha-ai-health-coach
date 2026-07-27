import { createClaudeProvider } from "@/lib/ai/providers/claudeProvider";

describe("createClaudeProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("is named 'claude' and reports itself as configured", () => {
    const provider = createClaudeProvider();
    expect(provider.name).toBe("claude");
    expect(provider.isConfigured()).toBe(true);
  });

  it("POSTs the request to the default API route and returns the text", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "Great job today!" }),
    }) as unknown as typeof fetch;

    const provider = createClaudeProvider();
    const result = await provider.send({ system: "sys", messages: [{ role: "user", content: "hi" }] });

    expect(result).toEqual({ text: "Great job today!", providerName: "claude" });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai/coach",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("uses a custom API route when provided", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "ok" }) }) as unknown as typeof fetch;
    const provider = createClaudeProvider({ apiRoute: "/custom/route" });
    await provider.send({ system: "sys", messages: [] });
    expect(global.fetch).toHaveBeenCalledWith("/custom/route", expect.anything());
  });

  it("throws with the server's error message on a non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "ANTHROPIC_API_KEY is not configured on the server." }),
    }) as unknown as typeof fetch;

    const provider = createClaudeProvider();
    await expect(provider.send({ system: "sys", messages: [] })).rejects.toThrow(
      "ANTHROPIC_API_KEY is not configured on the server.",
    );
  });

  it("falls back to a generic error message when the error body isn't JSON", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    }) as unknown as typeof fetch;

    const provider = createClaudeProvider();
    await expect(provider.send({ system: "sys", messages: [] })).rejects.toThrow(
      "Claude provider request failed (500)",
    );
  });
});
