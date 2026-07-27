import { geminiProvider, gptProvider, localProvider } from "@/lib/ai/providers/stubProviders";

describe("stub providers", () => {
  it.each([
    ["gpt", gptProvider],
    ["gemini", geminiProvider],
    ["local", localProvider],
  ])("%s reports itself as not configured", (_name, provider) => {
    expect(provider.isConfigured()).toBe(false);
  });

  it.each([
    ["gpt", gptProvider],
    ["gemini", geminiProvider],
    ["local", localProvider],
  ])("%s rejects with a clear not-implemented error", async (name, provider) => {
    await expect(provider.send({ system: "s", messages: [] })).rejects.toThrow(
      new RegExp(`${name}.*not implemented`, "i"),
    );
  });

  it("each stub provider's name matches its export", () => {
    expect(gptProvider.name).toBe("gpt");
    expect(geminiProvider.name).toBe("gemini");
    expect(localProvider.name).toBe("local");
  });
});
