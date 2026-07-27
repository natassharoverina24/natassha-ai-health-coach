/**
 * Placeholder Providers
 * ---------------------------------------------------------------------------
 * GPT, Gemini, and a local model are named in the spec as future providers.
 * These implement the same AIProvider interface today so the registry and
 * every caller are already written against the full provider set — wiring
 * up a real one later is purely additive (implement `send`, nothing else
 * in the app changes).
 */
import type { AIProvider, AIProviderName } from "./types";

function createUnimplementedProvider(name: AIProviderName): AIProvider {
  return {
    name,
    isConfigured() {
      return false;
    },
    async send() {
      throw new Error(`The "${name}" provider is not implemented yet.`);
    },
  };
}

export const gptProvider = createUnimplementedProvider("gpt");
export const geminiProvider = createUnimplementedProvider("gemini");
export const localProvider = createUnimplementedProvider("local");
