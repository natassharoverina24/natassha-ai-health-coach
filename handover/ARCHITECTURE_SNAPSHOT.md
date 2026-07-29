# ARCHITECTURE SNAPSHOT

The complete architecture of the Natassha AI Health Coach as it exists after Phase 6B.

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        UI LAYER                              │
│  Next.js App Router pages (src/app/)                         │
│  React components (src/components/)                          │
│  Contexts (Auth, Theme), Hooks (Firestore subscriptions)     │
└──────────────────────────┬──────────────────────────────────┘
                           │ calls on Dashboard mount
┌──────────────────────────▼──────────────────────────────────┐
│                    CONTEXT BUILDER                            │
│  src/lib/ai/contextBuilder.ts                                │
│  buildCoachDecision(userId) → CoachDecision                  │
│  The ONE impure file: reads 9 Firestore collections          │
│  via 15 repositories, shapes engine inputs                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ passes shaped data to
┌──────────────────────────▼──────────────────────────────────┐
│                  10 DETERMINISTIC ENGINES                     │
│  src/lib/engines/*.engine.ts                                 │
│  Pure functions: plain data in → EngineInsight[] out          │
│  31 unique insight IDs across 10 domains                     │
│  Each engine owns its domain exclusively                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ EngineInsight[]
┌──────────────────────────▼──────────────────────────────────┐
│                    DECISION ENGINE                            │
│  src/lib/engines/decisionEngine.ts                           │
│  runDecisionEngine(allInsights) → CoachDecision              │
│  1. Conflict resolution (suppresses mechanism)               │
│  2. Ranking (priority → urgency)                             │
│  3. Capping (max 5 insights)                                 │
└──────────┬───────────────────────────────────┬──────────────┘
           │ CoachDecision                     │ CoachDecision
┌──────────▼──────────┐             ┌──────────▼──────────────┐
│   PLANNING LAYER    │             │    RESPONSE LAYER        │
│  src/lib/planner/   │             │  src/lib/ai/             │
│                     │             │  responseLayer.ts        │
│  dailyPlanner.ts    │             │                          │
│  → DailyPlan        │             │  buildCoachPrompt()      │
│                     │             │  generateCoachReply()    │
│  mealPlanner.ts     │             │  → CoachReply            │
│  → MealPlan         │             │                          │
│                     │             │  (only builds prompts,   │
│  [future: 5 more    │             │   never decides)         │
│   planners]         │             └──────────┬──────────────┘
└─────────────────────┘                        │
                                    ┌──────────▼──────────────┐
                                    │   PROVIDER REGISTRY      │
                                    │  src/lib/ai/providers/   │
                                    │  AIProvider interface     │
                                    │  ClaudeProvider (real)    │
                                    │  GPT/Gemini/Local (stubs)│
                                    └──────────┬──────────────┘
                                               │ fetch()
                                    ┌──────────▼──────────────┐
                                    │   SERVER ROUTE           │
                                    │  /api/ai/coach           │
                                    │  ANTHROPIC_API_KEY       │
                                    │  (server-only)           │
                                    └──────────┬──────────────┘
                                               │
                                    ┌──────────▼──────────────┐
                                    │  ANTHROPIC MESSAGES API  │
                                    └─────────────────────────┘
```

---

## Planner Architecture

```
src/lib/planner/
├── plannerTypes.ts      Types: PlannerUserContext, DailyPlan, MealPlan, etc.
├── plannerHelpers.ts    Time conversion, schedule placement, insight extraction
├── dailyPlanner.ts      generateDailyPlan(decision, context) → DailyPlan
├── mealTemplates.ts     18 MealTemplate definitions with macros and tags
├── mealPlanner.ts       generateMealPlan(decision, context) → MealPlan
└── index.ts             Barrel export

Inputs (both functions):
  CoachDecision ──┐
                  ├──→ Pure function ──→ Structured output
  PlannerUserContext ─┘

Both functions are independent. Not yet composed.
Future planner work extends this directory without introducing delivery-specific planners.
```

---

## Repository Layer

15 repositories under `src/lib/db/`, all extending `createRepository<T>()`:

| Repository | Collection | Key custom methods |
|---|---|---|
| users | users | `getByUid()` |
| settings | settings | `getForUser()`, `subscribeForUser()`, `createOrUpdate()` |
| weights | weights | `subscribeForUser()`, `listForUser()` |
| waists | waists | `subscribeForUser()` |
| meals | meals | `subscribeForUser()`, `subscribeForUserByDate()`, `listForUserRange()` |
| mealPhotos | meal_photos | `listForMeal()`, `subscribeForMeal()` |
| waterLogs | water_logs | `subscribeForUserByDate()`, `listForUser()`, `listForUserDateRange()` |
| workouts | workouts | `subscribeForUser()`, `listForUser()`, `listForUserByDate()` |
| sleepLogs | sleep_logs | `subscribeForUser()`, `listForUser()`, `listForUserByDate()` |
| motivations | motivations | `listActiveForUser()`, `subscribeActiveForUser()`, `markReferenced()` |
| cycles | cycles | `listForUser()` |
| supplements | supplements | — |
| shopping | shopping | — (supports `addedFrom: "ai-suggestion"`) |
| reports | reports | — |
| aiLogs | ai_logs | — |

---

## Context Builder (`src/lib/ai/contextBuilder.ts`)

The one file that bridges repositories and engines:

1. Fetches: users, settings, weights, meals, waterLogs, workouts, sleepLogs, cycles, motivations
2. Computes 28-day `DailyLogInputs` via `buildDailyLogInputs()`
3. Computes `DailyCoachScore[]` via `computeDailyCoachScores()`
4. Shapes each engine's specific typed input
5. Runs all 10 `run*Engine()` functions
6. Collects all `EngineInsight[]`
7. Runs `runDecisionEngine()` → `CoachDecision`

---

## Decision Engine (`src/lib/engines/decisionEngine.ts`)

**Input:** `EngineInsight[]` from all engines
**Output:** `CoachDecision { insights, suppressedEngineNames, generatedAt }`

**Algorithm:**
1. Collect all `suppresses` declarations
2. Drop insights whose engine is suppressed by *another* insight (never self-suppression)
3. Sort survivors by `comparePriority()` (priority rank, then urgency rank)
4. Cap to `maxInsights` (default 5)

**Active suppression rules:**
- `migraine.active_symptom_care` suppresses engine `"exercise"`
- `thyroid.deficit_too_aggressive` suppresses engine `"nutrition"`

---

## Response Layer (`src/lib/ai/responseLayer.ts`)

- `buildCoachPrompt(decision)` → `{ system, userContent }` — one line per insight: `[priority/urgency, tone] summary Why: reason Suggested action: action`
- System prompt encodes the confirmed persona: sweet, feminine, firm when it matters, never guilt-tripping, always action-oriented
- `generateCoachReply(decision, options?)` → calls a provider → `CoachReply { message, insightIdsUsed, providerName }`

---

## Provider Abstraction (`src/lib/ai/providers/`)

```typescript
interface AIProvider {
  readonly name: AIProviderName;  // "claude" | "gpt" | "gemini" | "local"
  isConfigured(): boolean;
  send(request: AIProviderRequest): Promise<AIProviderResponse>;
}
```

- `ClaudeProvider` — fetches `/api/ai/coach` (the server route holds the API key)
- `gptProvider`, `geminiProvider`, `localProvider` — stubs, `isConfigured()` → false
- `getDefaultProvider()` → Claude
