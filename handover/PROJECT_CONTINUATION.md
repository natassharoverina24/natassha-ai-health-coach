# PROJECT CONTINUATION

Primary handover document for continuing the Natassha AI Health Coach project.
**Location:** `/home/claude/natassha-health/`

---

## Current Architecture

```
Firestore (17 collections)
  ↓ read via 15 repositories (src/lib/db/)
Context Builder (src/lib/ai/contextBuilder.ts)
  ↓ shapes data into typed engine inputs
10 Engines (src/lib/engines/*.engine.ts)
  ↓ EngineInsight[] (pure functions)
Decision Engine (src/lib/engines/decisionEngine.ts)
  ↓ suppress → rank → cap at 5 → CoachDecision
Planning Layer (src/lib/planner/)
  ├─ dailyPlanner.ts → DailyPlan
  └─ mealPlanner.ts → MealPlan
  ↓ (both consume CoachDecision + PlannerUserContext)
Response Layer (src/lib/ai/responseLayer.ts)
  ↓ builds LLM prompt from CoachDecision
Provider Registry → ClaudeProvider
  ↓ fetch("/api/ai/coach")
Server Route (src/app/api/ai/coach/route.ts)
  ↓ ANTHROPIC_API_KEY (server-only)
Anthropic Messages API → natural language
```

---

## Planning Layer Implementation

### Daily Planner (`src/lib/planner/dailyPlanner.ts`)

**Function:** `generateDailyPlan(decision: CoachDecision, context: PlannerUserContext): DailyPlan`

**Input:** `CoachDecision` (ranked insights) + `PlannerUserContext` (goals, routine, commute times)

**Output `DailyPlan`:**
```
{
  targets: { calories, proteinG, waterMl, workoutMin, steps, sleepHours }
  schedule: { breakfast, lunch, snack, dinner, workout, waterReminder }  // each { label, time }
  summary: { topPriority, biggestRisk, todaysWin, encouragement }        // each InsightSummary | null
  generatedAt: string
}
```

**Schedule placement logic** (in `plannerHelpers.ts` → `buildSchedule()`):
- Breakfast = leaveHomeTime − 30 min
- Lunch = 12:00
- Snack = 15:00
- Dinner = arriveHomeTime + 60 min
- Workout = arriveHomeTime + 90 min
- Water reminder = 13:00

**Summary extraction** (in `plannerHelpers.ts` → `extractSummary()`):
- Top priority = `insights[0]`
- Biggest risk = `insights[0]` unless its tone is `"celebratory"` (then null)
- Today's win = first insight with tone `"celebratory"` (or null)
- Encouragement = `findWhyMotivationText()` reads `why.surface_motivation` insight's `data.motivationText`

### Meal Planner (`src/lib/planner/mealPlanner.ts`)

**Function:** `generateMealPlan(decision: CoachDecision, context: PlannerUserContext): MealPlan`

**Output `MealPlan`:**
```
{
  breakfast: MealRecommendation  // { slot, template: MealTemplate, reason: string }
  lunch: MealRecommendation
  snack: MealRecommendation
  dinner: MealRecommendation
}
```

**Key internal functions:**
- `detectActiveConstraints(insights)` → `ActiveConstraints { thyroidDeficitActive, migraineActive, pmsActive, proteinPriority }`
- `distributeTargets(calorieGoal, proteinGoalG, lunchProvidedByOffice)` → `Record<MealSlot, SlotBudget>`
- `selectForSlot(slot, budget, constraints, excludeIds)` → `MealRecommendation` (scores all candidates, picks highest)

**Scoring formula per template:**
- Thyroid active + calories > budget × 1.15 → score = −1000 (disqualified)
- Missing any required tag → score = −1000
- Calorie overshoot: −(diff × 1.5)
- Calorie undershoot: −(|diff| × 0.5)
- Protein surplus: +(min(diff, 10) × 2)
- Protein deficit: −(|diff| × 1.5)
- Each preferred tag match: +15

### Meal Templates (`src/lib/planner/mealTemplates.ts`)

18 templates, each with: `id`, `name`, `serving`, `calories`, `proteinG`, `carbsG`, `fatG`, `fiberG`, `slots: MealSlot[]`, `tags: MealTag[]`

**8 MealTag values:** `high-protein`, `quick-prep`, `fiber-forward`, `pms-friendly`, `migraine-safe`, `light`, `spicy-option`, `budget-friendly`

**Template distribution:** 5 breakfast, 8 lunch/dinner (shared), 5 snack

### Planner Types (`src/lib/planner/plannerTypes.ts`)

```typescript
interface PlannerUserContext {
  today: string; currentHour: number; currentMinute: number;
  leaveHomeTime: string; arriveHomeTime: string; lunchProvidedByOffice: boolean;
  calorieGoal: number; proteinGoalG: number; waterGoalMl: number;
  workoutGoalMinPerDay: number; stepsGoal: number; sleepGoalHours: number;
}
```

---

## Insight IDs the Planning Layer Reads

The Meal Planner currently reads 4 insight IDs from `CoachDecision`:

| Insight ID | Engine | Constraint Priority | Effect |
|---|---|---|---|
| `thyroid.deficit_too_aggressive` | Thyroid | 1 (highest) | Disqualify templates exceeding budget by >15% |
| `migraine.active_symptom_care` | Migraine | 2 | Require `migraine-safe` tag on all templates |
| `menstrual.pms_hunger_support` | Menstrual | 3 | Prefer `pms-friendly` / `fiber-forward` tags |
| `nutrition.protein_first` | Nutrition | 4 | Prefer `high-protein` tag |

Future planners (Office Lunch Optimizer and Adaptive Planner) will need to read additional insight IDs from the same CoachDecision — all 31 IDs are listed in `IMPLEMENTATION_STATE.md`.

---

## Constraint Priority Ordering (AI_PLANNING_SPEC.md §3.3)

| Priority | Constraint | Source |
|---|---|---|
| 1 (highest) | Safety guardrails | Thyroid Engine |
| 2 | Migraine requirements | Migraine Engine |
| 3 | Menstrual / PMS adjustments | Menstrual Engine |
| 4 | Daily nutrition targets | Stored goals |
| 5 (lowest) | Practical constraints | Time, budget, GoFood, office lunch |

---

## Data Flow

```
contextBuilder.buildCoachDecision(userId)
  → fetches 9 collections (users, settings, weights, meals, waterLogs,
    workouts, sleepLogs, cycles, motivations)
  → runs all 10 engines with shaped inputs
  → runDecisionEngine() → CoachDecision

generateDailyPlan(CoachDecision, PlannerUserContext) → DailyPlan
generateMealPlan(CoachDecision, PlannerUserContext) → MealPlan
  (both are independent pure functions, not yet composed)

generateCoachReply(CoachDecision) → LLM call → CoachReply
  (only called on explicit "Ask Coach" button press)
```

---

## Dependencies for Future Planners

| Module | Depends on |
|---|---|
| Office Lunch Optimizer (6C) | `CoachDecision`, `PlannerUserContext`, `detectActiveConstraints()` from mealPlanner, `OFFICE_LUNCH_ITEMS` from nutritionEstimates |
| Weekly Meal Prep (6E) | `generateMealPlan()`, `MEAL_TEMPLATES`, `shopping` collection's `addedFrom: "ai-suggestion"` |
| Emergency Planner (6F) | `generateDailyPlan()`, `generateMealPlan()`, `PlannerUserContext.currentHour` |
| Adaptive Planner (6G) | 5 `adaptive.*` insight IDs from CoachDecision, existing `MealPlan`/`DailyPlan` |

---

## Current Test Counts

| Category | Suites | Tests |
|---|---|---|
| UI components | 20 | ~100 |
| Coach business logic | 8 | ~65 |
| Engine tests | 11 | ~100 |
| AI layer tests | 4 | ~20 |
| Planner tests | 4 | 60 |
| Utility tests | 5 | ~50 |
| **Total** | **52** | **394** |

---

## Remaining Work (implementation order)

1. **Phase 6C — Office Lunch Optimizer** → `src/lib/planner/officeLunchOptimizer.ts`
2. **Phase 6D — Energy Calculator only**
3. **Phase 6E — Weekly Meal Prep** → `src/lib/planner/weeklyMealPrep.ts`
4. **Phase 6F — Emergency Planner** → `src/lib/planner/emergencyPlanner.ts`
5. **Phase 6G — Adaptive Planner** → `src/lib/planner/adaptivePlanner.ts`
6. **Phase 7 — Dashboard / UI Integration** — compose DailyPlan + MealPlan, surface on Dashboard

**GoFood scope decision:** The GoFood Planner is cancelled and out of scope.
Meals purchased through GoFood are logged through the existing meal logging
flow with existing estimates, photos, and manual corrections. Do not remove
or redesign existing meal logging, and do not implement GoFood-specific code.

---

## Coding Conventions

- **Pure functions** for all planner/engine/coach logic — no React, no Firestore, no side effects
- **One barrel `index.ts`** per folder, re-export everything
- **Tests** mirror source structure: `tests/unit/planner/`, `tests/unit/engines/`, etc.
- **Naming:** `generate*()` for planner functions, `run*Engine()` for engines, `compute*()` for coach scoring
- **Types:** interfaces for data shapes, `type` for unions/aliases
- **Imports:** `@/` path alias throughout
- **No `any`**, no `eslint-disable`, zero warnings policy

---

## Verification Checklist (must pass before any phase is complete)

1. `npx tsc --noEmit` — zero errors
2. `npx eslint . --max-warnings=0` — zero errors, zero warnings
3. `npx jest --coverage=false` — all tests pass, zero regressions
4. `npm run build` — production build succeeds

---

## Exact Next Implementation Target

**Phase 6C: Office Lunch Optimizer**

Create `src/lib/planner/officeLunchOptimizer.ts`:
- Consumes `CoachDecision`, `PlannerUserContext`, and a remaining calorie/protein budget
- For each of the 11 items in `OFFICE_LUNCH_ITEMS` (from `src/lib/utils/nutritionEstimates.ts`), produces one of: Eat / Reduce / Skip / Add
- Each recommendation includes a one-sentence reason
- Follows constraint priority ordering from §3.3
- Reuses `detectActiveConstraints()` from `mealPlanner.ts`
- Add tests in `tests/unit/planner/officeLunchOptimizer.test.ts`
- Export from `src/lib/planner/index.ts`
