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
import { Buffer } from "node:buffer";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverAuth";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_MAX_TOKENS = 300;
const MAX_REQUEST_BYTES = 32_768;
const MAX_SYSTEM_CHARACTERS = 12_000;
const MAX_MESSAGE_CHARACTERS = 8_000;
const MAX_MESSAGES = 20;
const MAX_RESPONSE_TOKENS = 1_000;

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
    candidate.system.trim().length > 0 &&
    candidate.system.length <= MAX_SYSTEM_CHARACTERS &&
    Array.isArray(candidate.messages) &&
    candidate.messages.length > 0 &&
    candidate.messages.length <= MAX_MESSAGES &&
    candidate.messages.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0 &&
        m.content.length <= MAX_MESSAGE_CHARACTERS,
    ) &&
    (candidate.maxTokens === undefined ||
      (Number.isInteger(candidate.maxTokens) &&
        Number(candidate.maxTokens) > 0 &&
        Number(candidate.maxTokens) <= MAX_RESPONSE_TOKENS))
  );
}

export async function POST(request: Request) {
  const authentication = await authenticateFirebaseRequest(request);
  if (authentication.status === "unauthenticated") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (authentication.status === "configuration-error") {
    return NextResponse.json(
      { error: "Firebase authentication is not configured on the server." },
      { status: 503 },
    );
  }
  if (authentication.status === "verification-unavailable") {
    return NextResponse.json(
      { error: "Authentication verification is temporarily unavailable." },
      { status: 503 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
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
      return NextResponse.json(
        { error: `AI provider request failed (${anthropicResponse.status}).` },
        { status: 502 },
      );
    }

    const data = await anthropicResponse.json();
    const text = extractText(data);

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "AI provider request could not be completed." },
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
