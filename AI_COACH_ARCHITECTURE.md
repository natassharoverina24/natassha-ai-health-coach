# AI Coach Architecture

Documentation only — no code in this file, nothing here changes app behavior.
Companion to [`ARCHITECTURE.md`](./ARCHITECTURE.md), which covers the rest of
the app; this document is scoped to the AI Coach layer built in Phase 3.

## 1. Folder structure (AI-related modules only)

```
src/
├── app/
│   └── api/
│       └── ai/
│           └── coach/
│               └── route.ts              Server-side Anthropic proxy
│
└── lib/
    ├── ai/
    │   ├── contextBuilder.ts             Fetches data, runs all engines, returns a CoachDecision
    │   ├── responseLayer.ts              Turns a CoachDecision into an LLM prompt + reply
    │   ├── index.ts                      Barrel: contextBuilder + responseLayer + providers
    │   └── providers/
    │       ├── types.ts                  AIProvider interface — the provider-agnostic contract
    │       ├── claudeProvider.ts         Real provider — calls the API route above
    │       ├── stubProviders.ts          GPT / Gemini / Local placeholders (same interface)
    │       ├── registry.ts               Name → provider lookup, picks the default
    │       └── index.ts                  Barrel for the providers/ folder
    │
    ├── engines/
    │   ├── types.ts                      EngineInsight contract + priority/urgency ranking
    │   ├── behavior.engine.ts
    │   ├── nutrition.engine.ts
    │   ├── exercise.engine.ts
    │   ├── maintenance.engine.ts
    │   ├── why.engine.ts
    │   ├── migraine.engine.ts
    │   ├── menstrual.engine.ts
    │   ├── thyroid.engine.ts
    │   ├── workday.engine.ts
    │   ├── adaptiveLearning.engine.ts
    │   ├── decisionEngine.ts             Aggregates every engine's output into one CoachDecision
    │   └── index.ts                      Barrel for all of the above
    │
    └── coach/                            (Phase 2C, reused by the AI layer — not AI-specific itself)
        ├── scoring.ts                    Daily Coach Score + dimension scores
        ├── aggregateDailyInputs.ts       Raw logs → DailyLogInputs
        ├── energyEstimate.ts             Maintenance-calorie estimate (added in Phase 3, for Thyroid Engine)
        ├── weeklyChanges.ts              Trailing weekly deltas (added in Phase 3, for Maintenance Engine)
        ├── dateRanges.ts                 Date-window helpers
        └── types.ts                      DailyLogInputs, DailyGoals, DailyCoachScore, etc.
```

## 2. Responsibility of each file

### `src/app/api/ai/coach/route.ts`
The only file in the app that reads `ANTHROPIC_API_KEY`. Accepts `{ system, messages, maxTokens }`, forwards it verbatim to `https://api.anthropic.com/v1/messages`, unwraps the response into `{ text }`. No prompt construction, no business logic — pure proxy. Returns `503` if the key isn't configured, `400` for a malformed request, `502` if Anthropic's API call fails.

### `src/lib/ai/contextBuilder.ts`
The one impure file in the pipeline. `buildCoachDecision(userId)`:
1. Fetches profile, settings, and 28 days of weights/meals/water/workouts/sleep/cycles/motivations via the repository layer.
2. Shapes that data into each engine's specific input type (e.g. `MealTimestamp[]` for Nutrition, `HistoricalDayRecord[]` for Adaptive Learning).
3. Calls all 10 `run*Engine()` functions.
4. Passes the combined `EngineInsight[]` to `runDecisionEngine()` and returns the result.

Also exports `buildAICoachContext(userId)`, a lighter-weight helper that returns just `{ profile, goals, generatedAt }` without running the engines, for callers that only need static context.

### `src/lib/ai/responseLayer.ts`
The only file allowed to build an LLM prompt.
- `buildCoachPrompt(decision)` — pure function, turns a `CoachDecision` into `{ system, userContent }`. One line per insight (`[priority/urgency, tone: x] summary Why: reason Suggested action: action`). Never computes a number or fact not already on the insight.
- `generateCoachReply(decision, options)` — calls a provider (default from the registry) with the built prompt, returns `{ message, insightIdsUsed, providerName }`.

### `src/lib/ai/providers/types.ts`
Defines `AIProvider` (`name`, `isConfigured()`, `send(request)`) and `AIProviderRequest`/`AIProviderResponse`. This interface is the seam — nothing outside `providers/` imports a provider SDK or checks a provider's identity.

### `src/lib/ai/providers/claudeProvider.ts`
`createClaudeProvider({ apiRoute })` — implements `AIProvider` by `fetch`-ing the Next.js API route above (default `/api/ai/coach`). Runs client-side; never sees the API key.

### `src/lib/ai/providers/stubProviders.ts`
`gptProvider`, `geminiProvider`, `localProvider` — same `AIProvider` interface, `isConfigured()` returns `false`, `send()` rejects with a clear "not implemented yet" error. Exist so the registry and every caller are already written against the full provider set named in the spec.

### `src/lib/ai/providers/registry.ts`
`getProvider(name)` and `getDefaultProvider()` (→ `"claude"`). The only place that maps a provider name string to an implementation.

### `src/lib/engines/types.ts`
`EngineInsight` — the contract every engine emits: `id`, `engine`, `priority`, `urgency`, `tone`, `summary` (what), `reason` (why), `recommendedAction` (what to do), optional `data` (numbers the response layer may cite) and `suppresses` (other engines this insight overrides). Also `comparePriority()`, used by the Decision Engine's sort.

### `src/lib/engines/*.engine.ts` (10 files)
Each exports one `run*Engine(input): EngineInsight[]` — a pure function, plain data in, decided insights out. See section 5 for what each one owns.

### `src/lib/engines/decisionEngine.ts`
`runDecisionEngine(allInsights, options)`:
1. Collects every `suppresses` declaration across all insights.
2. Drops any insight whose engine is suppressed by another insight (never by its own).
3. Sorts survivors by `comparePriority` (priority, then urgency).
4. Caps to `maxInsights` (default 5) — the concrete mechanism behind "keep token usage efficient."

Returns `CoachDecision { insights, suppressedEngineNames, generatedAt }`.

## 3. Data flow: UI → API → Decision Engine → Response Layer → Provider

No UI currently calls this pipeline (Phase 3 was backend-only, nothing is wired into a page yet). The flow below is what a future caller — a page, a button, a scheduled job — would trigger:

```
 (future) UI action
        │
        ▼
 contextBuilder.buildCoachDecision(userId)
        │  fetches via src/lib/db repositories:
        │  users, settings, weights, meals, water_logs,
        │  workouts, sleep_logs, cycles, motivations
        ▼
 10× run*Engine(shapedInput)  ──▶  EngineInsight[]
        │
        ▼
 decisionEngine.runDecisionEngine(insights)
        │  suppress → rank → cap
        ▼
 CoachDecision { insights, suppressedEngineNames, generatedAt }
        │
        ▼
 responseLayer.generateCoachReply(decision)
        │  buildCoachPrompt(decision) → { system, userContent }
        ▼
 provider.send({ system, messages: [...], maxTokens })
        │  (AIProvider interface — provider-agnostic call site)
        ▼
 providers/registry → ClaudeProvider (default)
        │  fetch("/api/ai/coach", { system, messages, maxTokens })
        ▼
 app/api/ai/coach/route.ts   (server, browser stops here)
        │  reads ANTHROPIC_API_KEY
        ▼
 https://api.anthropic.com/v1/messages
        │
        ▼
 route.ts unwraps → { text }
        │
        ▼
 ClaudeProvider returns { text, providerName: "claude" }
        │
        ▼
 responseLayer returns CoachReply { message, insightIdsUsed, providerName }
        │
        ▼
 (future) UI renders `message`
```

Key property: everything left of `responseLayer` is pure/deterministic and fully unit-tested without a network call. Everything right of `provider.send(...)` is the only part that touches the network, and it carries no decision-making — it only phrases what's already been decided.

## 4. Firestore collections used by the AI layer

All read via the existing repository layer (`src/lib/db`); the AI layer never queries Firestore directly.

| Collection | Repository | Used for |
|---|---|---|
| `users` | `usersRepository` | Profile: goal/start weight, height, sex, date of birth, commute times, office-lunch flag — feeds Maintenance, Thyroid, Workday, Nutrition engines |
| `settings` | `settingsRepository` | Calorie/protein/water/workout/sleep goals — feeds every engine that scores adherence |
| `weights` | `weightsRepository` | Current weight, trailing weekly changes — feeds Maintenance Engine |
| `meals` | `mealsRepository` | Calories/protein/type/timestamp per meal — feeds Nutrition, Behavior (via Coach Score), Migraine (meal-gap), Adaptive Learning (dessert/late-night detection) |
| `water_logs` | `waterLogsRepository` | Daily water intake — feeds Behavior (via Coach Score), Adaptive Learning (hydration pattern) |
| `workouts` | `workoutsRepository` | Workout minutes/names per day — feeds Exercise, Adaptive Learning (skipped-day pattern) |
| `sleep_logs` | `sleepLogsRepository` | Hours slept per day — feeds Behavior (via Coach Score), Adaptive Learning (stress-eating proxy) |
| `cycles` | `cyclesRepository` | Cycle start dates + free-text `symptoms` — feeds Menstrual Engine (phase estimate) and doubles as the only symptom log for Migraine and Thyroid engines |
| `motivations` | `motivationsRepository` | Long-term "why" statements + `lastReferencedAt` — feeds WHY Engine exclusively. **New in Phase 3** |

`ai_logs` exists in the schema (Phase 1) as an append-only conversation log but nothing in the current pipeline writes to it yet — no caller persists a `CoachReply` anywhere, since no UI invokes this pipeline yet.

## 5. Which engine is responsible for each coaching decision

| Decision area | Engine | File |
|---|---|---|
| Nothing logged today, needs a nudge | Behavior | `behavior.engine.ts` |
| Consecutive good/bad days, streak broken or building | Behavior | `behavior.engine.ts` |
| Sustained multi-day score decline | Behavior | `behavior.engine.ts` |
| Protein below target | Nutrition | `nutrition.engine.ts` |
| Meals too spaced out / not logged yet | Nutrition | `nutrition.engine.ts` |
| Office lunch not logged | Nutrition | `nutrition.engine.ts` |
| No workout today / days since last workout | Exercise | `exercise.engine.ts` |
| Walking vs HIIT suggestion | Exercise | `exercise.engine.ts` |
| Weekly weight trend narrative | Maintenance | `maintenance.engine.ts` |
| Regain detection / extended care escalation | Maintenance | `maintenance.engine.ts` |
| Switching to maintenance-mode messaging | Maintenance | `maintenance.engine.ts` |
| Which long-term motivation to reference, and when | WHY | `why.engine.ts` |
| Migraine-aware activity/meal guidance | Migraine | `migraine.engine.ts` |
| Migraine ↔ meal-gap correlation | Migraine | `migraine.engine.ts` |
| Cycle-phase estimate and phase-specific tone | Menstrual | `menstrual.engine.ts` |
| PMS hunger support, water-retention framing | Menstrual | `menstrual.engine.ts` |
| Blocking an overly aggressive calorie deficit | Thyroid Awareness | `thyroid.engine.ts` |
| Flagging thyroid-adjacent symptoms → doctor referral | Thyroid Awareness | `thyroid.engine.ts` |
| Morning/workday/evening timing of suggestions | Workday | `workday.engine.ts` |
| Office-lunch-context suppression during work hours | Workday | `workday.engine.ts` |
| Weekend-dessert, late-night, skipped-workout-day, low-hydration, stress-eating patterns | Adaptive Learning | `adaptiveLearning.engine.ts` |
| Ranking, conflict suppression, capping insight count | Decision Engine | `decisionEngine.ts` |
| Wording/tone of the final message | *(none — LLM only)* | `responseLayer.ts` + provider |

No engine decides what another engine also decides — each `EngineInsight.id` is unique to exactly one engine and one rule, which is what makes the "which engine owns this" question always have a single answer.
