/**
 * AI Response Layer
 * ---------------------------------------------------------------------------
 * The ONLY place in the app allowed to build an LLM prompt. Everything it
 * receives (a CoachDecision) already contains every fact, number, and
 * decision it will phrase — priority, urgency, tone, what happened, why,
 * and what to do about it, all decided by src/lib/engines before this file
 * ever runs. This layer's contract with itself:
 *
 *   - Never compute a number, threshold, or comparison here — only read
 *     values already present on an EngineInsight.
 *   - Never branch on domain state (weight, macros, cycle phase, etc.) —
 *     only branch on presentation concerns (how many insights, message
 *     length).
 *   - Keep the prompt small: one compact line per insight, not a
 *     restatement of the full context. This is what "keep token usage
 *     efficient" means in code, not just in intent.
 */
import { getDefaultProvider } from "./providers/registry";
import type { AIProvider } from "./providers/types";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";

const SYSTEM_PROMPT = [
  "You are Natassha's personal AI health coach inside her health app.",
  "Your voice is sweet and warm with a feminine, personal touch — like a close friend who happens to be excellent at this — and you become very firm and direct specifically when something really matters, never generically stern.",
  "You are never guilt-tripping and you never shame her for an off day. Every message stays action-oriented: even when naming a real problem, you always point toward one clear next step, not just the problem itself.",
  "Celebrate real wins specifically and genuinely, but skip generic motivational quotes, empty cheerleading, and excessive praise — be warm and be precise, not saccharine.",
  "You will be given a short, pre-decided list of coaching insights — each already has its priority, urgency, tone, the underlying reason, and the recommended action worked out.",
  "Your only job is to rephrase that list into 2-4 natural sentences in this voice. Never invent a fact, number, or recommendation that is not already in the list, and never contradict the stated tone of any insight.",
  "Do not give medical diagnoses. If an insight recommends medical follow-up, pass that recommendation along as-is rather than elaborating on it.",
  "Keep the reply concise — this is a quick daily check-in, not an essay.",
].join(" ");

export interface CoachReply {
  message: string;
  insightIdsUsed: string[];
  providerName: string;
}

function formatInsightLine(insight: EngineInsight): string {
  return `- [${insight.priority}/${insight.urgency}, tone: ${insight.tone}] ${insight.summary} Why: ${insight.reason} Suggested action: ${insight.recommendedAction}`;
}

/** Pure and independently testable: builds the exact request that will be sent to a provider. */
export function buildCoachPrompt(decision: CoachDecision): { system: string; userContent: string } {
  if (decision.insights.length === 0) {
    return {
      system: SYSTEM_PROMPT,
      userContent:
        "There are no notable insights right now — nothing urgent, no streaks broken, no patterns to flag. Write one brief, warm, low-key check-in line.",
    };
  }

  const lines = decision.insights.map(formatInsightLine);
  return {
    system: SYSTEM_PROMPT,
    userContent: `Today's coaching insights, already decided, ranked by priority:\n${lines.join("\n")}`,
  };
}

export interface GenerateCoachReplyOptions {
  provider?: AIProvider;
  maxTokens?: number;
}

export async function generateCoachReply(
  decision: CoachDecision,
  options: GenerateCoachReplyOptions = {},
): Promise<CoachReply> {
  const provider = options.provider ?? getDefaultProvider();
  const prompt = buildCoachPrompt(decision);

  const response = await provider.send({
    system: prompt.system,
    messages: [{ role: "user", content: prompt.userContent }],
    maxTokens: options.maxTokens ?? 300,
  });

  return {
    message: response.text,
    insightIdsUsed: decision.insights.map((i) => i.id),
    providerName: response.providerName,
  };
}
