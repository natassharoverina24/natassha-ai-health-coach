import { getDefaultProvider, getProvider } from "@/lib/ai/providers/registry";

describe("getProvider", () => {
  it("returns a claude provider for 'claude'", () => {
    expect(getProvider("claude").name).toBe("claude");
  });

  it("returns the matching stub provider for gpt/gemini/local", () => {
    expect(getProvider("gpt").name).toBe("gpt");
    expect(getProvider("gemini").name).toBe("gemini");
    expect(getProvider("local").name).toBe("local");
  });
});

describe("getDefaultProvider", () => {
  it("defaults to claude", () => {
    expect(getDefaultProvider().name).toBe("claude");
  });
});
