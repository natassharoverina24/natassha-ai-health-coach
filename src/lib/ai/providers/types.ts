/**
 * AI Provider Abstraction
 * ---------------------------------------------------------------------------
 * The single seam between this app and any LLM. Nothing outside
 * `src/lib/ai/providers` ever imports a provider SDK, calls a provider's
 * API directly, or checks "if provider === claude" — code depends only on
 * this interface, so adding GPT/Gemini/a local model later means adding a
 * new file here, not touching the response layer, the engines, or any UI.
 *
 * A provider's only responsibility is turning a request into text. It
 * receives already-decided structured facts (see src/lib/engines) and must
 * not be asked to decide anything — see src/lib/ai/responseLayer.ts for the
 * prompt this gets built from.
 */

export interface AIProviderMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIProviderRequest {
  /** System/instruction prompt — sets tone and hard constraints, never business logic. */
  system: string;
  messages: AIProviderMessage[];
  /** Token ceiling for the reply — kept small by design (see responseLayer.ts). */
  maxTokens?: number;
}

export interface AIProviderResponse {
  text: string;
  providerName: AIProviderName;
}

export type AIProviderName = "claude" | "gpt" | "gemini" | "local";

export interface AIProvider {
  readonly name: AIProviderName;
  /** Whether this provider is currently usable (e.g. has credentials configured). */
  isConfigured(): boolean;
  send(request: AIProviderRequest): Promise<AIProviderResponse>;
}
