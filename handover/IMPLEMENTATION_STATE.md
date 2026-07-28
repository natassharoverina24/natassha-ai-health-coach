# IMPLEMENTATION STATE

> **Superseding July 2026 status:** Phases 1–7 are complete. Phase 8 adds
> production environment validation, authenticated AI proxy transport, CI,
> security headers, ignore rules, Firebase deployment metadata, focused tests,
> and `docs/DEPLOYMENT_READINESS.md`. Older phase counts below are retained as
> historical implementation notes and must not be used as current status.

Every completed phase, with every file, function, type, design decision, and intentional omission.

---

## Phase 1 — Foundation

**Purpose:** Establish clean architecture with separated UI/DB/Auth/Business Logic/AI layers.

**Files created (~60):**
- `src/types/firestore.ts` — all Firestore types, `COLLECTIONS` constant, `BaseDocument`, `UserProfile`, `UserSettings`, `MealEntry`, `MealMacro`, `WeightEntry`, `WaistEntry`, `MealPhoto`, `WorkoutEntry`, `SleepEntry`, `MotivationEntry`, `SupplementEntry`, `ShoppingItem`, `CycleEntry`, `ReportEntry`, `WaterLogEntry`
- `src/lib/db/baseRepository.ts` — generic `createRepository<T>()` with CRUD, `list()`, `subscribe()`
- `src/lib/db/*.repository.ts` — 15 repositories: `users`, `weights`, `waists`, `meals`, `mealPhotos`, `supplements`, `waterLogs`, `workouts`, `sleepLogs`, `motivations`, `shopping`, `reports`, `cycles`, `settings`, `aiLogs`
- `src/lib/firebase/` — `config.ts` (graceful degradation without env vars), `auth.ts` (Google sign-in), `firestore.ts`, and `messaging.ts`; Firebase Storage is inactive for meal photos
- `src/lib/utils/` — `constants.ts` (`DEFAULT_GOALS`, `DEFAULT_USER_PROFILE`, `NAV_ITEMS`), `format.ts` (20+ formatters), `cn.ts` (tailwind merge), `nutritionEstimates.ts`, `syncQueue.ts`
- `src/components/ui/` — Button, GlassCard, Badge, Input, Modal, Skeleton, Avatar, ProgressBar, Spinner, EmptyState
- `src/components/layout/` — AppShell, Sidebar, BottomNav, TopBar, PageHeader
- `src/components/dashboard/` — StatCard, GreetingHeader, WeeklyProgressCard, HealthRingsCard
- `src/components/charts/` — HealthRings (SVG concentric rings), TrendLineChart (recharts wrapper)
- `src/contexts/` — AuthContext, ThemeContext
- `src/hooks/` — useFirestoreCollection, useFirestoreDoc, useOnlineStatus, useMediaQuery, useStable
- 10 page files under `src/app/`
- PWA: manifest.json, sw.js, scripts/generate-icons.py
- Security: firestore.rules, storage.rules, firestore.indexes.json

**Design decisions:**
- Generic repository pattern (one repo per collection, all share CRUD)
- Offline-first with Firestore persistence enabled
- Firebase config uses placeholder values for build-time safety
- `useSyncExternalStore`-based hooks for Firestore subscriptions

**Intentionally NOT implemented:** No actual step-count tracking, no push notifications wired, no chatbot.

**Tests:** Button, Badge, ProgressBar, EmptyState, HealthRings, StatCard, format, cn, constants, nutritionEstimates, syncQueue.

---

## Phase 2A — Meal Tracking

**Purpose:** Complete meal logging with office-lunch quick-select, water tracking, and daily nutrition summary.

**Files created:**
- `src/components/forms/MealEntryForm.tsx` — add/edit form, all macros including fiber
- `src/components/forms/OfficeLunchQuickForm.tsx` — 11 Indonesian office-lunch items with auto-estimated combined nutrition
- `src/components/meal/DailyNutritionSummary.tsx` — daily macro totals vs goals
- `src/components/meal/WaterTrackerCard.tsx` — quick-add buttons, progress bar
- `src/components/meal/QuickLogFab.tsx` — floating action button with 8 items
- `src/lib/db/waterLogs.repository.ts`

**Modified:** `src/app/(app)/meal/page.tsx` (full rebuild), `src/app/(app)/dashboard/page.tsx` (wired water data)

**Public API:** `OFFICE_LUNCH_ITEMS` (11 items), `QUICK_LOG_FOODS`, `sumMacros()`, `WATER_QUICK_AMOUNTS_ML`

**Tests:** MealEntryForm, OfficeLunchQuickForm, QuickWaterForm, WaterTrackerCard, DailyNutritionSummary.

---

## Phase 2B — Meal History & Photos

**Purpose:** Date-based meal browsing, food photo upload/preview/delete, meal detail modal.

**Files created:**
- `src/components/meal/MealPhotoSection.tsx` — camera/image selection, local preview, ephemeral Gemini Free Tier analysis, privacy warning, editable uncertainty-labelled estimates, and explicit confirmation
- `src/components/meal/MealDetailModal.tsx` — photo, macros, notes, time, edit/delete

**Modified:**
- `MealTypeSection.tsx` — added `onView` prop, clickable rows, photo-count indicator
- `meal/page.tsx` — date picker for history, photo upload orchestration
- `mealPhotos.repository.ts` — added `subscribeForMeal()`
- `format.ts` — added `formatTimeLabel()`
- `next.config.ts` — added Firebase Storage remote pattern

**Tests:** MealPhotoSection, MealDetailModal, MealTypeSection (updated).

---

## Phase 2C — Weekly Progress & Coach Dashboard

**Purpose:** Coach Score system, weekly review, KPIs, milestones, workout/sleep logging.

**Files created:**
- `src/lib/db/workouts.repository.ts`, `src/lib/db/sleepLogs.repository.ts`
- `src/lib/coach/` (9 files):
  - `types.ts` — `DailyLogInputs`, `DailyGoals`, `DailyCoachScore`, `DimensionScores`, `WeeklyAdherence`, `WeeklyReview`, `CoachScoreSummary`, `KpiSummary`, `Milestone`
  - `scoring.ts` — `computeDailyDimensionScores()`, `computeOverallScore()`, `computeDailyCoachScore()`, `computeWeeklyAdherence()`, `computeWeeklyAverageScore()`, `computeTrend()`
  - `aggregateDailyInputs.ts` — `buildDailyLogInputs(dates, sources)`
  - `kpi.ts` — `computeWeeklyKpi()`, `DIMENSION_LABELS`
  - `milestones.ts` — `computeWeightMilestones()`, `computeStreakMilestones()`, `computeWorkoutMilestones()`, `computeMilestones()`
  - `summary.ts` — `computeWeeklyReview()`, `computeCoachScoreSummary()`
  - `dateRanges.ts` — `addDaysToISODate()`, `getLastNDates()`, `getRollingWeekWindows()`
- `src/components/coach/` — WeeklyReviewCard, CoachScoreCard, WeeklyKpiCard, MilestonesList, WorkoutSleepQuickLogCard

**Modified:** `src/types/firestore.ts` (added `WorkoutEntry`, `SleepEntry`, settings fields), `constants.ts` (added workout/sleep defaults), `progress/page.tsx`, `settings/page.tsx`

**Coach Score algorithm:** 6 dimensions (calories closeness, protein/water/workout/sleep at-least-goal, meal-logging core-3-coverage), averaged equally, 0–100.

**Tests:** scoring (26 tests), aggregateDailyInputs, dateRanges, kpi, milestones, summary, weeklyChanges, energyEstimate, plus 5 component tests.

---

## Phase 3 — Adaptive AI Coach Core

**Purpose:** 10 deterministic rule engines, decision engine, provider abstraction, response layer, context builder, server route.

**Files created — Engines (`src/lib/engines/`, 12 files):**

| Engine | Function | Insight IDs |
|---|---|---|
| behavior | `runBehaviorEngine(input)` | `behavior.self_monitoring_reminder`, `.consistency_reinforcement`, `.streak_recovery`, `.accountability_nudge` |
| nutrition | `runNutritionEngine(input)` | `nutrition.protein_first`, `.meal_gap_too_long`, `.no_meals_logged_yet`, `.office_lunch_reminder` |
| exercise | `runExerciseEngine(input)` | `exercise.adherence_risk`, `.minimum_action` |
| maintenance | `runMaintenanceEngine(input)` | `maintenance.maintenance_mode`, `.weekly_trend`, `.regain_watch`, `.extended_care` |
| why | `runWhyEngine(input)` | `why.surface_motivation` |
| migraine | `runMigraineEngine(input)` | `migraine.active_symptom_care`, `.meal_gap_correlation` |
| menstrual | `runMenstrualEngine(input)` | `menstrual.flexible_intensity`, `.phase_aware_energy`, `.pms_hunger_support`, `.water_retention_awareness` |
| thyroid | `runThyroidEngine(input)` | `thyroid.deficit_too_aggressive`, `.symptom_follow_up` |
| workday | `runWorkdayEngine(input)` | `workday.morning_window`, `.office_hours_lunch_context`, `.evening_window` |
| adaptiveLearning | `runAdaptiveLearningEngine(input)` | `adaptive.weekend_dessert_pattern`, `.late_night_hunger_pattern`, `.skipped_workout_day_pattern`, `.low_hydration_pattern`, `.stress_eating_pattern` |
| decisionEngine | `runDecisionEngine(allInsights)` → `CoachDecision` | — |
| types | `EngineInsight`, `comparePriority()` | — |

**Files created — AI Layer (`src/lib/ai/`, 7 files):**
- `providers/types.ts` — `AIProvider` interface
- `providers/claudeProvider.ts` — `createClaudeProvider()` (calls `/api/ai/coach`)
- `providers/stubProviders.ts` — `gptProvider`, `geminiProvider`, `localProvider`
- `providers/registry.ts` — `getProvider(name)`, `getDefaultProvider()`
- `responseLayer.ts` — `buildCoachPrompt(decision)`, `generateCoachReply(decision, options?)`
- `contextBuilder.ts` — `buildCoachDecision(userId)` (the one impure file — fetches all data, runs all engines)

**Files created — Server route:** `src/app/api/ai/coach/route.ts` — POST proxy to Anthropic API

**Key types:**
- `EngineInsight { id, engine, priority, urgency, tone, summary, reason, recommendedAction, data?, suppresses? }`
- `CoachDecision { insights: EngineInsight[], suppressedEngineNames, generatedAt }`
- `CoachReply { message, insightIdsUsed, providerName }`

**Conflict resolution:** Migraine suppresses Exercise; Thyroid suppresses Nutrition. Decision Engine caps at 5 insights.

**Also added:** `motivations` collection + repository, `energyEstimate.ts`, `weeklyChanges.ts` in coach layer.

**Tests:** All 10 engines, decisionEngine, responseLayer, claudeProvider, stubProviders, registry (total ~130 engine/AI tests).

---

## Phase 4A — AI Coach UI

**Purpose:** Dashboard card that calls the AI pipeline on button press.

**File created:** `src/components/dashboard/AICoachCard.tsx`
**Modified:** `dashboard/page.tsx` (added AICoachCard), `dashboard/index.ts` (barrel)

---

## Phase 4B — Daily Coaching Experience

**Purpose:** Auto-load CoachDecision on mount without a button press.

**Modified:** `AICoachCard.tsx` — auto-loads via `useEffect` + `useRef` guard, computes today's Coach Score in parallel, "Ask Coach" repositioned as "Ask Coach for more" reusing the already-loaded decision.

---

## Phase 5 — Personal Coach Polish

**Purpose:** Persona consistency, risk/win/action framing, de-duplication.

**Modified:**
- `responseLayer.ts` — system prompt rewritten for confirmed persona (sweet, feminine, firm, never guilt-tripping)
- `AICoachCard.tsx` — restructured around `splitBriefing()`: "Biggest risk today" / "Today's win" / "Also today" with de-duplication
- `dashboard/page.tsx` — removed redundant GreetingHeader
- `CoachScoreCard.tsx` — "Trending down" color changed from red to amber

**Tests:** AICoachCard (14 tests covering idle, loading, success, error, retry, de-duplication, celebration-day, ask-coach).

---

## Phase 6A — Daily Planner Core

**Purpose:** Pure function producing a structured `DailyPlan` from `CoachDecision` + `PlannerUserContext`.

**Files created (`src/lib/planner/`):**
- `plannerTypes.ts` — `PlannerUserContext`, `DailyTargets`, `ScheduleSlot`, `DailySchedule`, `InsightSummary`, `DailySummary`, `DailyPlan`
- `plannerHelpers.ts` — `toMinutes()`, `toHHmm()`, `makeSlot()`, `buildSchedule()`, `extractSummary()`, `findWhyMotivationText()`
- `dailyPlanner.ts` — `generateDailyPlan(decision, context)` → `DailyPlan`
- `index.ts` — barrel

**Schedule placement:** Breakfast = leave−30min, Lunch = 12:00, Snack = 15:00, Dinner = arrive+60min, Workout = arrive+90min, Water = 13:00.

**Tests:** plannerHelpers (23), dailyPlanner (13) = 36 total.

---

## Phase 6B — Meal Planner

**Purpose:** Template-based meal recommendations following constraint priority ordering.

**Files created:**
- `mealTemplates.ts` — `MealSlot`, `MealTag` (8 values), `MealTemplate`, `MEAL_TEMPLATES` (18 templates: 5 breakfast, 8 lunch/dinner, 5 snack)
- `mealPlanner.ts` — `MealRecommendation`, `MealPlan`, `ActiveConstraints`, `SlotBudget`, `detectActiveConstraints()`, `distributeTargets()`, `generateMealPlan(decision, context)`

**Constraint priority (AI_PLANNING_SPEC.md §3.3):**
1. Thyroid safety — disqualify templates >115% of slot budget
2. Migraine safety — require `migraine-safe` tag
3. PMS adjustments — prefer `pms-friendly`/`fiber-forward`
4. Protein targets — prefer `high-protein`
5. Practical — prefer `quick-prep` for breakfast

**Insight IDs the Meal Planner reads:**
- `thyroid.deficit_too_aggressive` → Priority 1
- `migraine.active_symptom_care` → Priority 2
- `menstrual.pms_hunger_support` → Priority 3
- `nutrition.protein_first` → Priority 4

**Macro distribution:** Office day = 20/35/10/35%, Non-office = 25/30/10/35%.

**Scoring:** calorie fit (overshoot −1.5×, undershoot −0.5×) + protein fit (surplus bonus capped) + tag matches (+15 each). Missing required tag = −1000. Top scorer wins. No template repeats within a day.

**Tests:** mealTemplates (6), mealPlanner (18) = 24 total.

**Intentionally NOT implemented:** DailyPlan+MealPlan composition and external recipe providers. GoFood Planner and GoFood-specific budget filtering are cancelled and out of scope; GoFood purchases use the existing meal logging flow with existing estimates, photos, and manual corrections.

---

## Phase 6C — Office Lunch Optimizer

**Status:** Implemented and verified.

**Verification:**
- TypeScript: PASS
- ESLint: PASS
- Tests: 414/414 PASS
- Production build: PASS
