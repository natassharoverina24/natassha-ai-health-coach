/**
 * Provider Registry
 * ---------------------------------------------------------------------------
 * The one place in the app that knows every available provider by name.
 * Everything else (the response layer, tests, future settings UI) asks
 * this registry for a provider rather than importing one directly — so
 * switching the default provider, or letting a user pick one, never means
 * touching more than this file.
 */
import { createClaudeProvider } from "./claudeProvider";
import { geminiProvider, gptProvider, localProvider } from "./stubProviders";
import type { AIProvider, AIProviderName } from "./types";

const DEFAULT_PROVIDER_NAME: AIProviderName = "claude";

export function getProvider(name: AIProviderName): AIProvider {
  switch (name) {
    case "claude":
      return createClaudeProvider();
    case "gpt":
      return gptProvider;
    case "gemini":
      return geminiProvider;
    case "local":
      return localProvider;
    default: {
      // Exhaustiveness check: if AIProviderName grows, this fails to compile.
      const exhaustive: never = name;
      throw new Error(`Unknown AI provider: ${String(exhaustive)}`);
    }
  }
}

export function getDefaultProvider(): AIProvider {
  return getProvider(DEFAULT_PROVIDER_NAME);
}
