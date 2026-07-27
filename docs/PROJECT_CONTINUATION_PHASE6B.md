# PROJECT CONTINUATION — After Phase 6B

**Project:** Natassha AI Health Coach
**Location:** `/home/claude/natassha-health/`
**Stack:** Next.js 16 · TypeScript · Tailwind CSS v4 · Firebase (Auth / Firestore / Storage / Messaging) · React 19 · PWA
**Last verified:** 394 tests passing, zero ESLint warnings, zero TypeScript errors, production build succeeds.

---

## 1. Current Status

### Completed phases (all frozen)

| Phase | Description | Status |
|---|---|---|
| 1 | Foundation (architecture, design system, Firestore, auth, PWA) | FROZEN |
| 2A | Meal Tracking (meal CRUD, office lunch, water tracker, quick log) | FROZEN |
| 2B | Meal History & Photos (date browsing, camera/gallery upload, detail modal) | FROZEN |
| 2C | Weekly Progress & Coach Dashboard (Coach Score, weekly review, KPIs, milestones) | FROZEN |
| 3 | Adaptive AI Coach Core (10 engines, decision engine, provider abstraction, response layer, context builder, API route) | FROZEN |
| 4A | AI Coach UI (AICoachCard on Dashboard, ask-coach button) | FROZEN |
| 4B | Daily Coaching Experience (auto-load CoachDecision on mount, Coach Score badge) | FROZEN |
| 5 | Personal Coach Polish (persona voice, risk/win/action framing, de-duplication, greeting) | FROZEN |
| 6A | Daily Planner Core (targets, schedule, summary extraction) | FROZEN |
| 6B | Meal Planner (template library, constraint-priority scoring, meal recommendations) | FROZEN |

### Frozen documents (must not be redesigned)

- `docs/AI_COACH_SPEC.md` — all coaching business rules and thresholds
- `docs/AI_PLANNING_SPEC.md` — Planning Layer specification (12 sections)
- `docs/USER_PROFILE.md` — Natassha's permanent profile (12 sections)
- `AI_COACH_ARCHITECTURE.md` — technical architecture of the AI Coach pipeline
- `ARCHITECTURE.md` — full application architecture

---

## 2. What Has Actually Been Implemented

### Phase 1 — Foundation

**New files:** ~60 source files establishing the project skeleton.

- 17 Firestore collections typed in `src/types/firestore.ts` with `COLLECTIONS` constant: `users`, `weights`, `waists`, `meals`, `meal_photos`, `supplements`, `supplement_logs`, `water_logs`, `workouts`, `sleep_logs`, `motivations`, `shopping`, `reports`, `cycles`, `settings`, `ai_logs`
- Generic repository pattern: `src/lib/db/baseRepository.ts` → one repository file per collection (15 repos total under `src/lib/db/`)
- Firebase layer: `src/lib/firebase/` (config with offline persistence, auth with Google sign-in, firestore CRUD, storage upload/delete, messaging)
- Design system: Soft Pink / Apple Health / glassmorphism theme in `src/app/globals.css`, light + dark mode
- Reusable UI components: `src/components/ui/` (Button, GlassCard, Badge, Input, Modal, Skeleton, Avatar, ProgressBar, Spinner, EmptyState)
- Layout components: `src/components/layout/` (Sidebar, BottomNav, TopBar, AppShell, PageHeader)
- Dashboard components: `src/components/dashboard/` (StatCard, GreetingHeader, WeeklyProgressCard, HealthRingsCard)
- Charts: `src/components/charts/` (HealthRings SVG, TrendLineChart via recharts)
- 8 app pages under `src/app/(app)/`: dashboard, weight, meal, progress, shopping, supplements, reports, settings
- Auth page: `src/app/(auth)/login/page.tsx`
- Auth context, Theme context, custom hooks (`useFirestoreCollection`, `useFirestoreDoc`, `useOnlineStatus`, `useMediaQuery`, `useStable`)
- PWA: `manifest.json`, `sw.js`, icon generation script
- Security: `firestore.rules`, `storage.rules`, `firestore.indexes.json`
- Constants: `src/lib/utils/constants.ts` (DEFAULT_GOALS, NAV_ITEMS, DEFAULT_USER_PROFILE)
- Utilities: `src/lib/utils/format.ts`, `src/lib/utils/cn.ts`, `src/lib/utils/nutritionEstimates.ts`, `src/lib/utils/syncQueue.ts`

**Design decision:** Firebase config uses placeholder values when env vars are absent — the app builds and runs (with degraded Firebase features) without requiring real credentials. Same pattern used for `ANTHROPIC_API_KEY`.

### Phase 2A — Meal Tracking

**New/modified files:**
- `src/app/(app)/meal/page.tsx` — full meal page with Breakfast/Lunch/Dinner/Snack sections
- `src/components/forms/MealEntryForm.tsx` — add/edit form with all macro fields including fiber
- `src/components/forms/OfficeLunchQuickForm.tsx` — 11 Indonesian office-lunch items, combined nutrition, editable before save
- `src/components/meal/DailyNutritionSummary.tsx` — daily macro totals vs goals
- `src/components/meal/WaterTrackerCard.tsx` — quick-add buttons (250/500/750/1000ml), progress bar
- `src/components/meal/QuickLogFab.tsx` — floating action button with 8 quick-log items
- `src/lib/utils/nutritionEstimates.ts` — `OFFICE_LUNCH_ITEMS` (11 items), `QUICK_LOG_FOODS`, `sumMacros()`, `WATER_QUICK_AMOUNTS_ML`
- `src/lib/db/waterLogs.repository.ts` — water logging repository

### Phase 2B — Meal History & Photos

**New/modified files:**
- `src/components/meal/MealPhotoSection.tsx` — camera capture + gallery upload via two `<input type="file">` elements (one with `capture="environment"` for mobile camera, one plain for gallery/desktop)
- `src/components/meal/MealDetailModal.tsx` — full detail view: photo, food name, all 5 macros, notes, time, edit/delete actions
- `src/components/meal/MealTypeSection.tsx` — **modified**: added `onView` prop, clickable row body, photo-count indicator badge
- `src/app/(app)/meal/page.tsx` — **modified**: date picker for history browsing, photo upload/delete orchestration (Storage + Firestore), MealDetailModal wiring
- `src/lib/db/mealPhotos.repository.ts` — **modified**: added `subscribeForMeal()` live subscription
- `next.config.ts` — **modified**: added `firebasestorage.googleapis.com` to `images.remotePatterns`
- `src/lib/utils/format.ts` — **modified**: added `formatTimeLabel()` (ISO → "8:32 AM")

### Phase 2C — Weekly Progress & Coach Dashboard

**New files:**
- `src/lib/db/workouts.repository.ts` — workout logging repository
- `src/lib/db/sleepLogs.repository.ts` — sleep logging repository
- `src/lib/coach/` — entire folder (9 files):
  - `types.ts` — `DailyLogInputs`, `DailyGoals`, `DailyCoachScore`, `DimensionScores`, `WeeklyAdherence`, `WeeklyReview`, `CoachScoreSummary`, `KpiSummary`, `KpiHighlight`, `Milestone`
  - `scoring.ts` — `computeDailyDimensionScores()`, `computeOverallScore()`, `computeDailyCoachScore()`, `computeDailyCoachScores()`, `computeWeeklyAdherence()`, `computeWeeklyAverageScore()`, `computeTrend()`
  - `aggregateDailyInputs.ts` — `buildDailyLogInputs(dates, sources)` — raw logs → `DailyLogInputs[]`
  - `kpi.ts` — `computeWeeklyKpi(adherence)`, `DIMENSION_LABELS`
  - `milestones.ts` — `computeWeightMilestones()`, `computeStreakMilestones()`, `computeWorkoutMilestones()`, `computeMilestones()`
  - `summary.ts` — `computeWeeklyReview()`, `computeCoachScoreSummary()`
  - `dateRanges.ts` — `addDaysToISODate()`, `getLastNDates()`, `getRollingWeekWindows()`
  - `energyEstimate.ts` — `estimateMaintenanceCalories()`, `ageFromDateOfBirth()` (added Phase 3, used by Thyroid Engine)
  - `weeklyChanges.ts` — `chunkDatesIntoWeeks()`, `computeTrailingWeeklyChangesKg()` (added Phase 3, used by Maintenance Engine)
- `src/components/coach/` — 5 components: `WeeklyReviewCard`, `CoachScoreCard`, `WeeklyKpiCard`, `MilestonesList`, `WorkoutSleepQuickLogCard`
- `src/app/(app)/progress/page.tsx` — **modified**: added Coach Score, Weekly Review, KPI, Coach Score trend chart, Milestones sections
- `src/app/(app)/settings/page.tsx` — **modified**: added `workoutGoalMinPerDay` and `sleepGoalHours` fields

**Important types added to `src/types/firestore.ts`:** `WorkoutEntry`, `SleepEntry` — plus `workoutGoalMinPerDay` and `sleepGoalHours` fields on `UserSettings`.

**Coach Score formula (6 dimensions, equal weight):**
- Calories: closeness to goal (both over and under penalized)
- Protein/Water/Workout/Sleep: at-least-goal (surplus never penalized)
- Meal logging: proportion of 3 core meals (B/L/D) logged (snacks don't count)

### Phase 3 — Adaptive AI Coach Core

**New files — Engines (`src/lib/engines/`, 12 files):**

| File | Public function | Insight IDs produced |
|---|---|---|
| `types.ts` | `EngineInsight` interface, `comparePriority()` | — |
| `behavior.engine.ts` | `runBehaviorEngine(input)` | `behavior.self_monitoring_reminder`, `behavior.consistency_reinforcement`, `behavior.streak_recovery`, `behavior.accountability_nudge` |
| `nutrition.engine.ts` | `runNutritionEngine(input)`, `largestGapHours(timestamps)` | `nutrition.protein_first`, `nutrition.meal_gap_too_long`, `nutrition.no_meals_logged_yet`, `nutrition.office_lunch_reminder` |
| `exercise.engine.ts` | `runExerciseEngine(input)` | `exercise.adherence_risk`, `exercise.minimum_action` |
| `maintenance.engine.ts` | `runMaintenanceEngine(input)` | `maintenance.maintenance_mode`, `maintenance.weekly_trend`, `maintenance.regain_watch`, `maintenance.extended_care` |
| `why.engine.ts` | `runWhyEngine(input)` | `why.surface_motivation` |
| `migraine.engine.ts` | `runMigraineEngine(input)` | `migraine.active_symptom_care`, `migraine.meal_gap_correlation` |
| `menstrual.engine.ts` | `runMenstrualEngine(input)`, `estimateCyclePhase(days)` | `menstrual.flexible_intensity`, `menstrual.phase_aware_energy`, `menstrual.pms_hunger_support`, `menstrual.water_retention_awareness` |
| `thyroid.engine.ts` | `runThyroidEngine(input)` | `thyroid.deficit_too_aggressive`, `thyroid.symptom_follow_up` |
| `workday.engine.ts` | `runWorkdayEngine(input)` | `workday.morning_window`, `workday.office_hours_lunch_context`, `workday.evening_window` |
| `adaptiveLearning.engine.ts` | `runAdaptiveLearningEngine(input)`, `buildHistoricalDayRecords(dates, sources)` | `adaptive.weekend_dessert_pattern`, `adaptive.late_night_hunger_pattern`, `adaptive.skipped_workout_day_pattern`, `adaptive.low_hydration_pattern`, `adaptive.stress_eating_pattern` |
| `decisionEngine.ts` | `runDecisionEngine(allInsights, options)` → `CoachDecision` | — (orchestration only) |

**`CoachDecision` type** (the single most important type in the project):
```
{ insights: EngineInsight[], suppressedEngineNames: EngineName[], generatedAt: string }
```

**`EngineInsight` fields:** `id`, `engine`, `priority` (critical/high/medium/low), `urgency` (now/soon/none), `tone` (encouraging/neutral/firm/celebratory/gentle/concerned), `summary`, `reason`, `recommendedAction`, optional `data` (Record), optional `suppresses` (EngineName[]).

**Decision Engine behavior:** collects `suppresses` declarations → drops insights whose engine is suppressed by *another* insight → sorts by priority then urgency → caps at 5 (`DEFAULT_MAX_INSIGHTS`).

**Conflict resolution (two active overrides):**
- Migraine (`migraine.active_symptom_care`) suppresses Exercise engine
- Thyroid (`thyroid.deficit_too_aggressive`) suppresses Nutrition engine

**New files — AI Layer (`src/lib/ai/`, 7 files):**

| File | Public API |
|---|---|
| `providers/types.ts` | `AIProvider` interface: `name`, `isConfigured()`, `send(request)` → `AIProviderResponse` |
| `providers/claudeProvider.ts` | `createClaudeProvider(options?)` — calls `/api/ai/coach` server route |
| `providers/stubProviders.ts` | `gptProvider`, `geminiProvider`, `localProvider` — all `isConfigured()` → false |
| `providers/registry.ts` | `getProvider(name)`, `getDefaultProvider()` → Claude |
| `responseLayer.ts` | `buildCoachPrompt(decision)`, `generateCoachReply(decision, options?)` → `CoachReply` |
| `contextBuilder.ts` | `buildCoachDecision(userId)` → `CoachDecision`, `buildAICoachContext(userId)` → `AICoachContext` |

**`contextBuilder.ts`** is the one impure file: it calls all 15 repositories, shapes data into engine inputs, runs all 10 engines, runs the Decision Engine, returns `CoachDecision`.

**New file — Server route:** `src/app/api/ai/coach/route.ts` — POST handler, reads `ANTHROPIC_API_KEY`, proxies to `https://api.anthropic.com/v1/messages`, returns `{ text }`. Returns 503 if key is unset.

**System prompt** (in `responseLayer.ts`): instructs the LLM to be "sweet and warm with a feminine, personal touch," "firm specifically when something matters," "never guilt-tripping," "always action-oriented." Explicitly prohibits inventing facts/numbers/recommendations not in the insight list.

**New data:** `motivations` collection + `motivationsRepository` for the WHY Engine.

### Phase 4A — AI Coach UI

**New file:** `src/components/dashboard/AICoachCard.tsx` — button-press-to-ask-coach card on Dashboard.
**Modified:** `src/app/(app)/dashboard/page.tsx` — added AICoachCard.

### Phase 4B — Daily Coaching Experience

**Modified:** `src/components/dashboard/AICoachCard.tsx` — auto-loads `CoachDecision` on mount (no button press). Today's Coach Score computed via existing `buildDailyLogInputs` + `computeDailyCoachScore`. "Ask Coach" repositioned as "Ask Coach for more" — reuses already-loaded decision, only fires LLM on explicit request. One load per session via `useRef` guard.

### Phase 5 — Personal Coach Polish

**Modified files:**
- `src/lib/ai/responseLayer.ts` — system prompt rewritten for confirmed persona voice
- `src/components/dashboard/AICoachCard.tsx` — restructured around three questions via `splitBriefing()`:
  - "Biggest risk today" — top insight (unless celebratory)
  - "Today's win" — highest-ranked celebratory insight (or fallback text)
  - "Also today" — remaining insights (de-duplicated from risk/win), capped at 3
- `src/app/(app)/dashboard/page.tsx` — removed redundant `GreetingHeader` (AICoachCard is now the sole greeting/briefing), added "Your numbers" section heading
- `src/components/coach/CoachScoreCard.tsx` — "Trending down" color changed from danger-red to amber

**Design decision:** `splitBriefing()` lives inside the React component, not in the planner layer, because it existed before the planner did and was a pure presentation concern at the time. The planner's `extractSummary()` (Phase 6A) later formalized the same logic as a reusable pure function.

### Phase 6A — Daily Planner Core

**New files (`src/lib/planner/`):**

| File | Public API |
|---|---|
| `plannerTypes.ts` | `PlannerUserContext`, `DailyTargets`, `ScheduleSlot`, `DailySchedule`, `InsightSummary`, `DailySummary`, `DailyPlan` |
| `plannerHelpers.ts` | `toMinutes(hhmm)`, `toHHmm(minutes)`, `makeSlot(label, time)`, `buildSchedule(leave, arrive)`, `extractSummary(insights, whyText)`, `findWhyMotivationText(insights)` |
| `dailyPlanner.ts` | `generateDailyPlan(decision, context)` → `DailyPlan` |
| `index.ts` | Barrel |

**`PlannerUserContext`** (the planner's input alongside `CoachDecision`):
```typescript
{
  today: string; currentHour: number; currentMinute: number;
  leaveHomeTime: string; arriveHomeTime: string; lunchProvidedByOffice: boolean;
  calorieGoal: number; proteinGoalG: number; waterGoalMl: number;
  workoutGoalMinPerDay: number; stepsGoal: number; sleepGoalHours: number;
}
```

**Schedule placement:** Breakfast = leave - 30min. Lunch = 12:00. Snack = 15:00. Dinner = arrive + 60min. Workout = arrive + 90min. Water = 13:00.

**Design decision:** Dinner time is a reasonable default (arrive + 60min), not a confirmed fact — `USER_PROFILE.md` §3 marks dinner as "not yet confirmed."

### Phase 6B — Meal Planner

**New files:**

| File | Public API |
|---|---|
| `mealTemplates.ts` | `MealSlot`, `MealTag`, `MealTemplate`, `MEAL_TEMPLATES` (18 templates) |
| `mealPlanner.ts` | `MealRecommendation`, `MealPlan`, `ActiveConstraints`, `SlotBudget`, `detectActiveConstraints(insights)`, `distributeTargets(cal, pro, office)`, `generateMealPlan(decision, context)` |

**18 meal templates:** 5 breakfast, 8 lunch/dinner (shared), 5 snack. Each has defined macros (calories, proteinG, carbsG, fatG, fiberG), valid slots, and constraint tags.

**8 MealTag values:** `high-protein`, `quick-prep`, `fiber-forward`, `pms-friendly`, `migraine-safe`, `light`, `spicy-option`, `budget-friendly`.

**4 CoachDecision insight IDs the Meal Planner reacts to:**
- `thyroid.deficit_too_aggressive` → Priority 1: disqualify templates exceeding budget by >15%
- `migraine.active_symptom_care` → Priority 2: require `migraine-safe` tag on all templates
- `menstrual.pms_hunger_support` → Priority 3: prefer `pms-friendly` / `fiber-forward` tags
- `nutrition.protein_first` → Priority 4: prefer `high-protein` tag

**Macro distribution (§3.5):** Office day = 20/35/10/35. Non-office = 25/30/10/35. Snack always gets 10%.

**Template scoring:** Each candidate is scored by calorie fit (overshoot penalized 1.5x, undershoot 0.5x), protein fit (surplus bonus capped at +10g × 2pts), required-tag pass/fail (missing required = -1000), and preferred-tag matches (+15 each). Top scorer wins.

**Meal variety:** Used template IDs are tracked across slots — the same template is never selected twice in one day.

**Things intentionally NOT implemented in Phase 6B:**
- Office Lunch Optimizer (Phase 6C) — the meal planner generates a lunch template even on office-lunch days; the Optimizer should eventually replace that slot with Eat/Reduce/Skip/Add guidance
- GoFood Planner (Phase 6D) — no budget filtering or GoFood-specific templates
- `MealPlan` is not yet wired into `DailyPlan` — the two outputs exist independently; connecting them is a future integration step
- No external recipe provider — templates are hardcoded
- Template library is intentionally small (18) — architecturally ready for expansion by simply adding entries to `MEAL_TEMPLATES`

---

## 3. Current Folder Structure

### AI-related folders (every file)

```
src/lib/
├── ai/
│   ├── contextBuilder.ts
│   ├── responseLayer.ts
│   ├── index.ts
│   └── providers/
│       ├── types.ts
│       ├── claudeProvider.ts
│       ├── stubProviders.ts
│       ├── registry.ts
│       └── index.ts
│
├── engines/
│   ├── types.ts
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
│   ├── decisionEngine.ts
│   └── index.ts
│
├── planner/
│   ├── plannerTypes.ts
│   ├── plannerHelpers.ts
│   ├── dailyPlanner.ts
│   ├── mealTemplates.ts
│   ├── mealPlanner.ts
│   └── index.ts
│
└── coach/
    ├── types.ts
    ├── scoring.ts
    ├── aggregateDailyInputs.ts
    ├── kpi.ts
    ├── milestones.ts
    ├── summary.ts
    ├── dateRanges.ts
    ├── energyEstimate.ts
    ├── weeklyChanges.ts
    └── index.ts

src/app/api/ai/coach/
    └── route.ts
```

### Test files (every file)

```
tests/
├── components/
│   ├── AICoachCard.test.tsx (14 tests)
│   ├── Badge.test.tsx
│   ├── Button.test.tsx
│   ├── CoachScoreCard.test.tsx
│   ├── DailyNutritionSummary.test.tsx
│   ├── EmptyState.test.tsx
│   ├── HealthRings.test.tsx
│   ├── MealDetailModal.test.tsx
│   ├── MealEntryForm.test.tsx
│   ├── MealPhotoSection.test.tsx
│   ├── MealTypeSection.test.tsx
│   ├── MilestonesList.test.tsx
│   ├── OfficeLunchQuickForm.test.tsx
│   ├── ProgressBar.test.tsx
│   ├── QuickWaterForm.test.tsx
│   ├── StatCard.test.tsx
│   ├── WaterTrackerCard.test.tsx
│   ├── WeeklyKpiCard.test.tsx
│   ├── WeeklyReviewCard.test.tsx
│   └── WorkoutSleepQuickLogCard.test.tsx
├── unit/
│   ├── ai/
│   │   ├── claudeProvider.test.ts
│   │   ├── registry.test.ts
│   │   ├── responseLayer.test.ts
│   │   └── stubProviders.test.ts
│   ├── coach/
│   │   ├── aggregateDailyInputs.test.ts
│   │   ├── dateRanges.test.ts
│   │   ├── energyEstimate.test.ts
│   │   ├── kpi.test.ts
│   │   ├── milestones.test.ts
│   │   ├── scoring.test.ts
│   │   ├── summary.test.ts
│   │   └── weeklyChanges.test.ts
│   ├── engines/
│   │   ├── adaptiveLearning.engine.test.ts
│   │   ├── behavior.engine.test.ts
│   │   ├── decisionEngine.test.ts
│   │   ├── exercise.engine.test.ts
│   │   ├── maintenance.engine.test.ts
│   │   ├── menstrual.engine.test.ts
│   │   ├── migraine.engine.test.ts
│   │   ├── nutrition.engine.test.ts
│   │   ├── thyroid.engine.test.ts
│   │   ├── why.engine.test.ts
│   │   └── workday.engine.test.ts
│   ├── planner/
│   │   ├── dailyPlanner.test.ts (13 tests)
│   │   ├── mealPlanner.test.ts (18 tests)
│   │   ├── mealTemplates.test.ts (6 tests)
│   │   └── plannerHelpers.test.ts (23 tests)
│   ├── cn.test.ts
│   ├── constants.test.ts
│   ├── format.test.ts
│   ├── nutritionEstimates.test.ts
│   └── syncQueue.test.ts
```

---

## 4. Architecture

### Complete runtime pipeline

```
Firestore Collections (17)
  ↓ (read via 15 repositories in src/lib/db/)
Context Builder (src/lib/ai/contextBuilder.ts)
  ↓ shapes data into each engine's typed input
10 Deterministic Engines (src/lib/engines/*.engine.ts)
  ↓ EngineInsight[] (pure functions, plain data in/out)
Decision Engine (src/lib/engines/decisionEngine.ts)
  ↓ suppress → rank → cap at 5 → CoachDecision
Planning Layer (src/lib/planner/)
  ├─ dailyPlanner.ts → DailyPlan (targets, schedule, summary)
  └─ mealPlanner.ts → MealPlan (4 meal recommendations)
       (both consume CoachDecision + PlannerUserContext)
  ↓
Response Layer (src/lib/ai/responseLayer.ts)
  ↓ builds LLM prompt from CoachDecision
Provider Registry (src/lib/ai/providers/)
  ↓ AIProvider.send() → ClaudeProvider
Server Route (src/app/api/ai/coach/route.ts)
  ↓ proxies to Anthropic Messages API (ANTHROPIC_API_KEY server-only)
LLM → natural language coaching message
```

### How Daily Planner and Meal Planner interact

They currently produce **independent outputs** from the same two inputs (`CoachDecision` + `PlannerUserContext`):

- `generateDailyPlan(decision, context)` → `DailyPlan` (targets, schedule, summary)
- `generateMealPlan(decision, context)` → `MealPlan` (breakfast, lunch, snack, dinner recommendations)

They are not yet composed — `DailyPlan` has no `meals` field. Connecting them (adding a `meals: MealPlan` field to `DailyPlan`, or having `generateDailyPlan` call `generateMealPlan` internally) is a natural integration step but was explicitly deferred so each could be built and tested independently first.

### How the Dashboard currently calls the pipeline

`AICoachCard.tsx` (client component):
1. On mount → `buildCoachDecision(uid)` (fires all engines, returns `CoachDecision`)
2. On mount (parallel) → fetches today's data for Coach Score computation
3. Renders: greeting, score badge, risk/win/actions from `CoachDecision`
4. On "Chat with your coach" button press → `generateCoachReply(decision)` → LLM call → renders natural language message

The Daily Planner and Meal Planner are **not yet called from any UI**. They exist as tested pure functions ready to be wired in.

---

## 5. Planning Layer Status

### Implemented

**Daily Planner (`dailyPlanner.ts`):**
- Input: `CoachDecision` + `PlannerUserContext`
- Output: `DailyPlan` containing:
  - `targets` — 6 goals (calories, protein, water, workout, steps, sleep) read from context
  - `schedule` — 6 time slots (breakfast, lunch, snack, dinner, workout, water reminder) placed around commute window
  - `summary` — top priority, biggest risk, today's win, encouragement, all extracted from already-ranked insights
  - `generatedAt` — passed through from `CoachDecision`

**Meal Planner (`mealPlanner.ts`):**
- Input: `CoachDecision` + `PlannerUserContext`
- Output: `MealPlan` containing one `MealRecommendation` per slot (breakfast, lunch, snack, dinner), each with a selected `MealTemplate` and a stated `reason`
- Constraint priority: Thyroid (1) → Migraine (2) → PMS (3) → Protein (4) → Practical (5)
- Template library: 18 approved templates in `mealTemplates.ts`
- Scoring: calorie fit + protein fit + tag matching, with disqualification for missing required tags or Thyroid-violating calorie overshoot
- Variety: no template repeats within a single day's plan

### What remains (not yet implemented)

| Component | Spec section | Status |
|---|---|---|
| Office Lunch Optimizer | AI_PLANNING_SPEC.md §4 | Not started |
| GoFood Planner | AI_PLANNING_SPEC.md §5 | Not started |
| Weekly Meal Prep | AI_PLANNING_SPEC.md §6 | Not started |
| Emergency Planner | AI_PLANNING_SPEC.md §7 | Not started |
| Adaptive Planner | AI_PLANNING_SPEC.md §8 | Not started |
| DailyPlan + MealPlan composition | — | Not wired together |
| Dashboard integration of plans | — | Not started |
| `daily_plans` collection (persistence) | AI_PLANNING_SPEC.md §12 | Not started, optional |

---

## 6. Testing Status

**Current counts:**
- Test suites: 52 passed, 52 total
- Tests: 394 passed, 394 total
- Snapshots: 0

**Verification pipeline (all passing):**
- ESLint: zero errors, zero warnings
- TypeScript (`tsc --noEmit`): zero errors
- Jest (`npx jest --coverage=false`): 394/394 pass
- Production build (`npm run build`): succeeds, 13 pages prerender, `/api/ai/coach` dynamic route

**Planner-specific tests:** 60 tests across 4 files:
- `plannerHelpers.test.ts` — 23 tests (time conversion, schedule placement, insight extraction, WHY text extraction)
- `dailyPlanner.test.ts` — 13 tests (targets, schedule, summary, celebration day, WHY, no insights, generatedAt, defaults)
- `mealTemplates.test.ts` — 6 tests (integrity: unique IDs, non-negative macros, slot coverage, tag coverage)
- `mealPlanner.test.ts` — 18 tests (constraint detection, target distribution, normal day, Thyroid/Migraine/PMS/Protein/combined constraints, custom goals, meal variety)

---

## 7. Frozen Rules

The following must NOT be modified by any future phase:

| Module | Why |
|---|---|
| Decision Engine (`decisionEngine.ts`) | Single source of truth for coaching decisions. The Planning Layer reads its output, never changes it. |
| Response Layer (`responseLayer.ts`) | Only place that builds LLM prompts. Never decides anything. |
| All 10 engines (`*.engine.ts`) | Each owns its coaching domain exclusively. No new engine duplicates an existing one's decisions. |
| `AI_COACH_SPEC.md` | Frozen business rules — thresholds, conflict resolution, scoring formulas. |
| `AI_PLANNING_SPEC.md` | Frozen planning specification — constraint priorities, meal planner rules, emergency planner philosophy. |
| `USER_PROFILE.md` | Frozen user profile — only changes when Natassha's life changes, not when the app changes. |
| `AI_COACH_ARCHITECTURE.md` | Frozen technical architecture documentation. |
| `ARCHITECTURE.md` | Frozen application architecture documentation. |

**Architectural constraints:**
- The Planning Layer never creates coaching decisions — it only operationalizes decisions already made.
- The Planning Layer never reads Firestore directly — it consumes `CoachDecision` + `PlannerUserContext`, both supplied to it.
- The LLM only paraphrases structured insights — it never invents facts, numbers, or recommendations.
- Safety guardrails always win (Thyroid > Migraine > everything else).
- No supplement/vitamin/medication/thyroid-diet recommendations, ever.
- No blood-type-based dietary logic, ever.
- Never shame or guilt — in any scenario, including error states and recovery.
- Consistency over perfection — the minimum viable action that keeps the streak alive always beats the ideal action done rarely.
- Weekly trend over daily noise — weight and similar metrics are judged by the weekly trend, never a single day.
- All tests must pass before any phase is complete (ESLint zero warnings, TypeScript zero errors, full suite green, production build succeeds).

---

## 8. Remaining Work

### Phase 6C — Office Lunch Optimizer

**Purpose:** When lunch is office-provided, replace the Meal Planner's generic lunch recommendation with Eat/Reduce/Skip/Add guidance for each office tray component.

**Expected files:**
- `src/lib/planner/officeLunchOptimizer.ts`

**Main public function:**
- `generateOfficeLunchPlan(decision, context, remainingBudget)` → per-component Eat/Reduce/Skip/Add recommendations with stated reasons

**Dependencies:** `CoachDecision`, `PlannerUserContext`, `OFFICE_LUNCH_ITEMS` from `nutritionEstimates.ts`, constraint priority from `mealPlanner.ts`'s `detectActiveConstraints()`

**Tests required:** normal day, Thyroid active (skip Sweet Drink), Migraine active (no skip that creates gap), protein priority (Add protein), all items Eat, mixed recommendations

**Verification:** ESLint + TypeScript + full Jest suite + production build, zero regressions

**Stop condition:** Office Lunch Optimizer is a tested pure function. Not wired to UI.

### Phase 6D — GoFood Planner

**Purpose:** Recommend specific orderable meals within the ~Rp 30,000 budget when Natassha orders via GoFood.

**Expected files:**
- `src/lib/planner/goFoodPlanner.ts`
- Possibly `src/lib/planner/goFoodTemplates.ts` (GoFood-specific meal templates with prices)

**Main public function:**
- `generateGoFoodRecommendation(decision, context, remainingCalories)` → recommended order with budget/calorie/protein rationale and trade-off explanation when constraints conflict

**Dependencies:** `CoachDecision`, `PlannerUserContext`, constraint priority, GoFood budget (currently prose-only in USER_PROFILE.md — may need a structured field per AI_PLANNING_SPEC.md §12)

**Tests required:** within budget, over budget trade-off, protein maximization, Mixue substitution, calorie-remaining fit

**Verification:** ESLint + TypeScript + full Jest suite + production build

**Stop condition:** GoFood Planner is a tested pure function. Not wired to UI.

### Phase 6E — Weekly Meal Prep

**Purpose:** Generate a 7-day meal plan with a derived shopping list and batch-cooking ideas.

**Expected files:**
- `src/lib/planner/weeklyMealPrep.ts`

**Main public function:**
- `generateWeeklyMealPrep(decision, context)` → 7-day plan, shopping list (protein/vegetables/fruit/snacks), batch-cook opportunities

**Dependencies:** `generateMealPlan()` applied per day, `MEAL_TEMPLATES`, `shopping` collection's `addedFrom: "ai-suggestion"` field

**Tests required:** 7 unique days, shopping list derivation, batch-cook detection, variety across days

**Verification:** ESLint + TypeScript + full Jest suite + production build

**Stop condition:** Weekly Meal Prep is a tested pure function. Not wired to UI.

### Phase 6F — Emergency Planner

**Purpose:** When a disruption is signaled (missed meal, overtime, travel, social event), produce an adjusted plan for the remaining hours.

**Expected files:**
- `src/lib/planner/emergencyPlanner.ts`

**Main public function:**
- `generateEmergencyPlan(decision, context, disruption)` → adjusted `DailyPlan` for the remaining day

**Dependencies:** `generateDailyPlan()`, `generateMealPlan()`, constraint priority ordering (§3.3), `PlannerUserContext.currentHour`

**Tests required:** missed breakfast, late dinner, overtime, mall trip, each disruption type, multiple simultaneous disruptions (safety-first per §7.3)

**Verification:** ESLint + TypeScript + full Jest suite + production build

**Stop condition:** Emergency Planner is a tested pure function. Not wired to UI. Detection of disruptions is explicitly NOT in scope (that's a future UX decision per AI_PLANNING_SPEC.md §7.2).

### Phase 6G — Adaptive Planner

**Purpose:** Adjust default plan choices based on patterns the Adaptive Learning Engine has already confirmed.

**Expected files:**
- `src/lib/planner/adaptivePlanner.ts`

**Main public function:**
- `applyAdaptiveAdjustments(plan, decision)` → adjusted plan with proactive pattern-aware defaults

**Dependencies:** Adaptive Learning Engine's 5 insight IDs (`adaptive.weekend_dessert_pattern`, `adaptive.late_night_hunger_pattern`, `adaptive.skipped_workout_day_pattern`, `adaptive.low_hydration_pattern`, `adaptive.stress_eating_pattern`), existing `MealPlan`

**Tests required:** weekend dessert → planned treat, late-night → bigger dinner, skipped workout day → shorter/moved workout, low hydration → earlier water reminder, stress eating → high-protein breakfast, no patterns active → no changes

**Verification:** ESLint + TypeScript + full Jest suite + production build

**Stop condition:** Adaptive Planner is a tested pure function. Not wired to UI.

### Phase 7 — Dashboard / UI Integration

**Purpose:** Surface the complete Planning Layer output on the Dashboard and relevant pages.

**Expected work:**
- Compose `DailyPlan` + `MealPlan` into a single rendered daily briefing
- Replace or extend `AICoachCard` to show the structured plan (schedule, meals, action items) alongside the coaching summary
- Wire `generateDailyPlan()` and `generateMealPlan()` into the existing auto-load flow on Dashboard mount
- Consider integrating Office Lunch Optimizer and GoFood Planner into the Meal page or a dedicated plan view

**Stop condition:** A user opening the Dashboard sees the full daily plan (targets, schedule, meals, risk/win/actions) without pressing any button.

---

## 9. Known Technical Debt

| Debt | Why it was left | When to address |
|---|---|---|
| `MealPlan` and `DailyPlan` are independent outputs, not composed | Built and tested independently first; composition is straightforward but deferred | Phase 7 (UI integration) |
| Template library is small (18 templates) | Enough to prove the scoring/constraint system works; expanding requires only adding entries | Before production use |
| Office lunch day still gets a generic lunch template from `generateMealPlan()` | Office Lunch Optimizer (Phase 6C) should replace that slot; doing it now would create a dependency on unbuilt code | Phase 6C |
| No GoFood budget field in Firestore (only prose in USER_PROFILE.md) | Structured field is optional additive change per AI_PLANNING_SPEC.md §12 | Phase 6D or later |
| No GoFood order log collection | Needed only for GoFood-specific adaptive patterns, not core planning | When GoFood patterns become a priority |
| No `daily_plans` collection (plans are computed on demand, not persisted) | Not required for first version per AI_PLANNING_SPEC.md §12 | When plan-following tracking is needed |
| Steps target displayed but unscored | No step-count data source exists; documented in AI_COACH_SPEC.md §10 | When step tracking is added |
| `splitBriefing()` in AICoachCard duplicates `extractSummary()` in plannerHelpers | splitBriefing existed first (Phase 5); extractSummary formalized it later (Phase 6A); AICoachCard hasn't been refactored to use the planner version | Phase 7 (UI integration) |
| `GreetingHeader` component still exists but is no longer used on Dashboard | Removed from Dashboard in Phase 5 but not deleted from disk; may be useful on other pages | Cleanup pass |
| No end-to-end LLM call verified | ANTHROPIC_API_KEY isn't configured in the dev environment; provider contract is tested via mocks | When deploying with a real key |
| No push notification delivery | All rules describe what/when to say, no delivery wired | Future phase |
| GPT/Gemini/Local providers are stubs | `isConfigured()` → false, `send()` → throws "not implemented" | When alternate providers are needed |

---

## 10. Recommended Next Prompt

Paste this into a brand-new Claude conversation:

> **Continue the Natassha AI Health Coach project at `/home/claude/natassha-health/`. Read `docs/PROJECT_CONTINUATION_PHASE6B.md` for the complete engineering handover — it contains every completed phase, every file, every public API, every frozen rule, and the exact remaining roadmap.**
>
> **Implement Phase 6C: Office Lunch Optimizer, as specified in `docs/AI_PLANNING_SPEC.md` §4.**
>
> **Requirements:**
> - **Create** `src/lib/planner/officeLunchOptimizer.ts` — a pure function that takes a `CoachDecision`, `PlannerUserContext`, and the day's remaining calorie/protein budget, and produces an Eat/Reduce/Skip/Add recommendation for each of the 11 office-lunch categories already defined in `src/lib/utils/nutritionEstimates.ts` (`OFFICE_LUNCH_ITEMS`).
> - **Each recommendation must include a one-sentence reason** grounded in a target or active insight.
> - **Follow the constraint priority ordering** in `AI_PLANNING_SPEC.md` §3.3 (Thyroid safety > Migraine > PMS > nutrition targets > practical).
> - **Reuse** `detectActiveConstraints()` from `src/lib/planner/mealPlanner.ts`.
> - **Do NOT modify** any engine, the Decision Engine, the Response Layer, or any frozen document.
> - **Add comprehensive tests** under `tests/unit/planner/officeLunchOptimizer.test.ts`.
> - **Run** ESLint, TypeScript, full Jest suite, and production build before reporting completion. Zero regressions required.
> - **Export** from the planner barrel (`src/lib/planner/index.ts`).
> - **Stop** after Phase 6C is complete. Do not continue into Phase 6D.
