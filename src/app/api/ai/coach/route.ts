/**
 * POST /api/ai/coach
 * ---------------------------------------------------------------------------
 * Server-side proxy to the Anthropic Messages API. This is the ONLY place
 * ANTHROPIC_API_KEY is read — the Claude provider (src/lib/ai/providers/claudeProvider.ts)
 * calls this route instead of Anthropic directly, so the key never reaches
 * the browser. The request body is already the exact shape the AI Response
 * Layer built (system + messages) — this route does no prompt construction
 * and no business logic, only forwards the request and unwraps the reply.
 */
import { NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_MAX_TOKENS = 300;

interface CoachRequestBody {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}

function isValidBody(body: unknown): body is CoachRequestBody {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.system === "string" &&
    Array.isArray(candidate.messages) &&
    candidate.messages.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "Request body must include `system` (string) and `messages` (array)." },
      { status: 400 },
    );
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  try {
    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: body.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: body.system,
        messages: body.messages,
      }),
    });

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text();
      return NextResponse.json(
        { error: `Anthropic API request failed (${anthropicResponse.status}): ${errorBody}` },
        { status: 502 },
      );
    }

    const data = await anthropicResponse.json();
    const text = extractText(data);

    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error calling Anthropic API." },
      { status: 502 },
    );
  }
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

function extractText(data: unknown): string {
  if (!data || typeof data !== "object" || !("content" in data)) return "";
  const content = (data as { content: unknown }).content;
  if (!Array.isArray(content)) return "";
  return (content as AnthropicContentBlock[])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}
