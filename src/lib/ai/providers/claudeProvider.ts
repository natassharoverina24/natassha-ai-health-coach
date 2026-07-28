/**
 * Claude Provider
 * ---------------------------------------------------------------------------
 * Implements AIProvider by calling this app's own server-side API route
 * (src/app/api/ai/coach/route.ts), which holds the actual Anthropic API
 * key. The browser never sees the key — same pattern as every other
 * server-only secret in this app (Firebase's service-account-style config
 * doesn't apply here since Firebase is client-safe by design, but the
 * principle is the same: secrets stay server-side).
 *
 * `isConfigured()` can't know server-side env state from the browser, so it
 * optimistically returns true; a misconfigured server key surfaces as a
 * clear error from `send()` instead, the same graceful-degradation pattern
 * used for Firebase (see src/lib/firebase/config.ts).
 */
import type { AIProvider, AIProviderRequest, AIProviderResponse } from "./types";

export interface ClaudeProviderOptions {
  apiRoute?: string;
  getIdToken?: () => Promise<string | null>;
}

async function getDefaultIdToken(): Promise<string | null> {
  const { getCurrentUserIdToken } = await import("@/lib/firebase/auth");
  return getCurrentUserIdToken();
}

export function createClaudeProvider(options: ClaudeProviderOptions = {}): AIProvider {
  const apiRoute = options.apiRoute ?? "/api/ai/coach";
  const getIdToken = options.getIdToken ?? getDefaultIdToken;

  return {
    name: "claude",

    isConfigured() {
      return true;
    },

    async send(request: AIProviderRequest): Promise<AIProviderResponse> {
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error("Sign in is required before contacting the AI coach.");
      }
      const response = await fetch(apiRoute, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          (body && typeof body === "object" && "error" in body && String(body.error)) ||
          `Claude provider request failed (${response.status})`;
        throw new Error(message);
      }

      const data = (await response.json()) as { text: string };
      return { text: data.text, providerName: "claude" };
    },
  };
}
