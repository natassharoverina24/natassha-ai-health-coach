# Project Handover — After Phase 5

**Purpose:** This document allows a new Claude conversation to continue
the Natassha AI Health Coach project seamlessly. It summarizes everything
built, everything frozen, everything remaining, and every constraint a
future implementer must respect.

**Location:** `/home/claude/natassha-health/`

---

## 1. Project Overview

### What this is

A Progressive Web App built for a single user (Natassha, Indonesia) that
combines manual health tracking with a deterministic, rule-based AI
coaching system. The app tracks meals, water, weight, waist, workouts,
sleep, menstrual cycles, and supplements, and uses that data to produce
daily coaching guidance through a pipeline of independent rule engines, a
ranking/conflict-resolution layer, and a provider-agnostic LLM
integration that only phrases decisions already made — never makes them.

### Tech stack

Next.js 16, TypeScript, Tailwind CSS v4, Firebase (Auth / Firestore /
Storage / Messaging), React 19. PWA with offline persistence. Jest +
Testing Library for tests.

### Design philosophy

Every coaching decision is deterministic and traceable to a specific
engine rule. The LLM's only role is rephrasing structured decisions into
natural language — it is never permitted to invent a fact, number, or
recommendation. The system favors consistency over perfection, weekly
trends over daily noise, and sweet-but-firm accountability over shame.

### Non-negotiable principles (from `USER_PROFILE.md` §10)

- Never shame or guilt the user.
- Be sweet but very firm.
- Prioritize long-term consistency over perfection.
- Never recommend crash diets.
- Never promise medical outcomes.
- Celebrate small wins.
- Intervene early when adherence declines.
- Focus on sustainable fat loss.

---

## 2. Completed Work

### Phase 1 — Foundation (COMPLETE, FROZEN)

Clean Architecture with separated layers: UI, database (repository
pattern), auth (Firebase/Google), business logic, and AI. Eleven
Firestore collections, generic repository pattern, design system (Soft
Pink / Apple Health / glassmorphism), reusable UI components (Button,
GlassCard, Badge, Input, Modal, Skeleton, Avatar, ProgressBar, Spinner,
EmptyState), responsive layout (Sidebar desktop, BottomNav mobile), 8 app
pages, auth/theme contexts, custom hooks, PWA manifest, service worker,
Firestore security rules. Jest configured.

### Phase 2A — Meal Tracking (COMPLETE, FROZEN)

Meal page with Breakfast/Lunch/Dinner/Snack sections, add/edit/delete
with quantity and fiber tracking. Office Lunch quick-select with 11
Indonesian items. Water Tracker with quick-add buttons and progress bar.
Daily Nutrition Summary. Quick Log FAB. Nutrition estimates utility.

### Phase 2B — Meal History & Photos (COMPLETE, FROZEN)

Date-based meal history browsing via date picker. Food photo upload
(camera capture + gallery, Firebase Storage, next/image). Meal Detail
modal with photo management and all macros. MealTypeSection enhanced with
clickable rows and photo-count indicator.

### Phase 2C — Weekly Progress & Coach Dashboard (COMPLETE, FROZEN)

Workouts and sleep_logs collections added. Coach business-logic layer
(`src/lib/coach/`): daily Coach Score (6 dimensions, 0-100), weekly
adherence, weekly KPI, milestones (weight/streak/workout). Coach UI
components: WeeklyReviewCard, CoachScoreCard, WeeklyKpiCard,
MilestonesList, WorkoutSleepQuickLogCard. Progress page extended with all
coach sections plus Coach Score trend chart.

### Phase 3 — Adaptive AI Coach Core (COMPLETE, FROZEN)

Ten deterministic rule engines (`src/lib/engines/`), each a pure
function:

| Engine | Knowledge domain |
|---|---|
| Behavior | Self-monitoring, accountability, streaks, reminders, consistency |
| Nutrition | Protein first, structured meals, migraine-safe timing, office schedule |
| Exercise | Treadmill-first, walking default, HIIT optional, minimum action, adherence priority |
| Maintenance | Weekly trend, regain detection, maintenance mode, extended care |
| WHY | Long-term motivation rotation with cooldown |
| Migraine | Active symptom care, meal-gap correlation, suppresses Exercise |
| Menstrual | Phase-aware coaching (28-day model), PMS hunger, water retention |
| Thyroid | Deficit guardrail (>25%), symptom follow-up, suppresses Nutrition, never recommends supplements |
| Workday | Morning/office/evening window timing |
| Adaptive Learning | Weekend dessert, late-night hunger, skipped workout day, low hydration, stress eating patterns |

Decision Engine: ranks by priority+urgency, resolves conflicts via
suppression, caps at 5 insights.

Provider abstraction (`src/lib/ai/providers/`): AIProvider interface,
ClaudeProvider (calls server route), stub GPT/Gemini/Local providers,
registry.

AI Response Layer (`src/lib/ai/responseLayer.ts`): the only file that
builds an LLM prompt. Transforms EngineInsights into compact prompt
lines. Never computes or decides anything.

Context Builder (`src/lib/ai/contextBuilder.ts`): fetches data via
repositories, runs all 10 engines, returns CoachDecision.

Server route (`src/app/api/ai/coach/route.ts`): proxies to Anthropic API,
key stays server-only.

### Phase 4A — AI Coach UI (COMPLETE, FROZEN)

AICoachCard on the Dashboard calling the existing AI pipeline on button
press. Shows greeting, coach status, top priority, insights list,
provider badge, retry on failure. Duplicate-request prevention via
in-flight ref guard.

### Phase 4B — Daily Coaching Experience (COMPLETE, FROZEN)

AICoachCard auto-loads CoachDecision on mount (no button press needed).
Today's Coach Score computed via existing scoring functions. "Ask Coach"
repositioned as "Ask Coach for more" — reuses already-loaded decision,
only fires LLM on request. Plan stability: one load per session, guarded
ref prevents re-fire.

### Phase 5 — Personal Coach Polish (COMPLETE, FROZEN)

System prompt rewritten with confirmed persona: sweet, feminine, firm
when it matters, never guilt-tripping, always action-oriented.
AICoachCard restructured around three questions: "Biggest risk today" /
"Today's win" / "Also today" (action items). De-duplication: spotlighted
insights excluded from action list. "Great day" case handled (celebratory
top insight shows calm message instead of mislabeling as risk). Redundant
GreetingHeader removed from Dashboard. CoachScoreCard "Trending down"
softened from danger-red to amber.

### Phase 5 — AI Planning Layer Specification (COMPLETE, FROZEN)

`docs/AI_PLANNING_SPEC.md` — full business specification for the new
Planning Layer (not yet implemented). 12 sections covering purpose, daily
plan, meal planner, office lunch optimizer, GoFood planner, weekly meal
prep, emergency planner, adaptive planner, planning principles, future
expansion, architecture relationship, and feasibility evaluation.

### Documentation Suite (COMPLETE, FROZEN)

- `docs/AI_COACH_SPEC.md` — Business rules for all 10 coaching domains
- `docs/USER_PROFILE.md` — Natassha's permanent profile (12 sections)
- `docs/AI_PLANNING_SPEC.md` — Planning Layer specification
- `AI_COACH_ARCHITECTURE.md` — Technical architecture of the AI layer
- `ARCHITECTURE.md` — Full app architecture
- `README.md` — Setup and development instructions

### Current Verification State

- **Tests:** 334 passed, 48 suites, zero failures
- **ESLint:** zero errors, zero warnings
- **TypeScript:** zero errors
- **Production build:** succeeds, 13 pages prerender, `/api/ai/coach`
  dynamic route

---

## 3. Frozen Documents

The following must not be redesigned. They may only receive additive
clarifications or corrections if a factual error is found:

| Document | Scope |
|---|---|
| `docs/AI_COACH_SPEC.md` | All coaching business rules, thresholds, conflict resolution |
| `docs/USER_PROFILE.md` | Natassha's personal profile, preferences, motivations, non-negotiables |
| `docs/AI_PLANNING_SPEC.md` | Planning Layer specification (not yet implemented) |
| `AI_COACH_ARCHITECTURE.md` | Technical architecture of the AI Coach pipeline |
| `ARCHITECTURE.md` | Full application architecture |

---

## 4. Current Architecture

```
Firestore Collections (17)
  → Repository Layer (src/lib/db/) — one repo per collection, generic CRUD
  → Context Builder (src/lib/ai/contextBuilder.ts) — fetches data, shapes engine inputs
  → 10 Deterministic Engines (src/lib/engines/) — pure functions, plain data in, EngineInsight[] out
  → Decision Engine (src/lib/engines/decisionEngine.ts) — rank, suppress, cap at 5
  → [FUTURE: Planning Layer — specified but not implemented]
  → Response Layer (src/lib/ai/responseLayer.ts) — builds LLM prompt from CoachDecision
  → Provider Registry (src/lib/ai/providers/) — AIProvider interface, currently defaults to Claude
  → Server Route (src/app/api/ai/coach/route.ts) — proxies to Anthropic API
  → LLM (Anthropic Messages API)
```

**Coach business-logic layer** (`src/lib/coach/`): scoring, weekly
aggregation, KPIs, milestones, energy estimate, weekly changes, date
ranges — reused by both the Progress page and the AI context builder.

**UI layer**: Next.js App Router pages under `src/app/(app)/`, component
library under `src/components/` (ui, layout, charts, dashboard, coach,
meal, forms).

---

## 5. Planning Layer Status

`docs/AI_PLANNING_SPEC.md` is a **complete business specification, not
yet implemented.**

**Responsibility:** Turns already-decided coaching insights into an
executable daily plan — specific meals, times, actions, and shopping
lists. It answers "what exactly should Natassha do today?" instead of
"what should improve?"

**Inputs:** Two things only — the ranked `CoachDecision` and the
validated User Context (profile, settings, goals, confirmed routines)
already assembled by the context builder. It never queries the database
directly.

**Outputs:** A Daily Plan containing today's targets, a time-anchored
schedule, top priority / biggest risk / today's win, encouragement, and
specific meal suggestions. Also weekly meal prep with a shopping list.

**Boundaries:** Never changes a coaching decision. Never changes
priorities. Never invents a new judgment. Never reads raw Firestore data.
Only transforms decisions into plans.

**Key business rules:**
- Planning constraint priority: Safety (Thyroid) > Migraine > Menstrual/PMS > Daily nutrition targets > Practical constraints (time, budget, GoFood)
- Plan stability: remains stable throughout the day, regenerates only on significant user-initiated events
- Meals selected from approved recipes/templates, never invented with fabricated nutrition values
- Macro distribution follows actual eating patterns, not even splits
- GoFood: budget first, then calories, then protein; explain trade-offs transparently
- Office lunch: Eat/Reduce/Skip/Add with stated reasons, never replaces lunch
- Emergency planner: the day is always recoverable, never a failure
- Blood type explicitly excluded from all meal planning logic
- Day-one behavior: deterministic plan from defaults, no fabricated patterns

---

## 6. Remaining Work

Listed in the order they should be implemented:

1. **Planning Layer Implementation** — Build the Planning Layer as
   specified in `docs/AI_PLANNING_SPEC.md`. This is the primary remaining
   work item. Includes Daily Plan generation, Meal Planner, Office Lunch
   Optimizer, GoFood Planner, Weekly Meal Prep, Emergency Planner,
   Adaptive Planner.

2. **Planning Layer UI** — Surface the Daily Plan on the Dashboard and
   relevant pages. Replace or extend the existing AICoachCard to show
   the structured plan alongside the coaching briefing.

3. **Recommended Additive Changes** (from `AI_PLANNING_SPEC.md` §12,
   all optional):
   - `daily_plans` collection for plan persistence
   - Structured food-preference fields on profile/settings
   - Structured GoFood budget field
   - GoFood order log (only if GoFood-specific patterns become a priority)

4. **Gap Analysis Items** (from the earlier evidence review, all
   optional):
   - Fiber tracking unused in coaching rules
   - Sleep-aware exercise softening
   - Positive reinforcement on resolved adaptive-learning patterns
   - Individual menstrual cycle-length variation
   - Plateau detection far from goal (distinct from maintenance mode)
   - Day-to-day calorie consistency scoring

5. **Not-Yet-Implemented Features** (from `AI_COACH_SPEC.md` §10):
   - Step-count tracking
   - Push notifications
   - Conversational chatbot follow-up
   - Auto-adjustment of stored goals
   - Localization
   - GPT/Gemini/Local provider implementations

---

## 7. Important Constraints

Every future implementation must respect these rules:

- **The Decision Engine is the single source of truth.** No downstream
  layer creates coaching decisions.
- **The Planning Layer never creates coaching decisions.** It only
  operationalizes decisions the Decision Engine already ranked.
- **The Response Layer never changes advice.** It only rephrases
  structured insights into natural language.
- **The LLM only paraphrases.** It never invents a fact, number, or
  recommendation not already present in the CoachDecision.
- **No engine duplication.** Each coaching decision is owned by exactly
  one engine. No two engines decide the same thing.
- **Safety guardrails always win.** The Thyroid Engine's deficit guardrail
  and the Migraine Engine's active-care rule override lower-priority
  guidance when they conflict (see `AI_COACH_SPEC.md` §7 and
  `AI_PLANNING_SPEC.md` §3.3).
- **No supplement, vitamin, or medication recommendations ever.** This is
  an absolute rule with no exceptions (`AI_COACH_SPEC.md` §6.8).
- **No blood-type-based dietary logic.** Explicitly excluded
  (`AI_PLANNING_SPEC.md` §3.1).
- **Never shame or guilt.** Every message, in every scenario — including
  recovery and adaptive scenarios — must avoid framing anything as
  compensation for something done "wrong."
- **Consistency over perfection.** The minimum viable action that keeps
  the streak alive always beats the ideal action done rarely.
- **Weekly trend over daily noise.** Weight and similar noisy metrics are
  always judged by the weekly trend, never a single day's number.
- **All tests must pass before any phase is considered complete.** ESLint
  zero warnings, TypeScript zero errors, full test suite green,
  production build succeeds.

---

## 8. Known Future Enhancements

Documented but intentionally **not part of MVP** scope:

- Barcode scanning for food logging
- Photo-based meal recognition (AI image recognition)
- Restaurant menu optimization
- Calendar integration for schedule-aware planning
- AI-assisted grocery optimization
- Dynamic recipe generation
- Smart pantry awareness
- Seasonal ingredient awareness
- Configurable coaching personality/aggressiveness
- Multi-person or family coaching
- Non-English localization
- Step-count tracking and step-based coaching
- Push notification delivery of coaching guidance
- Conversational chatbot follow-up
- Auto-adjustment of stored daily goals
- Individual menstrual cycle-length learning (vs. fixed 28-day model)
- Strength training emphasis in exercise coaching
- Exercise variety / overuse detection

---

## 9. Recommended Next Conversation

The next conversation should begin with implementation, not design. All
specifications are complete and frozen. The recommended first prompt:

> **"Continue the Natassha AI Health Coach project. Read the handover
> document at `docs/PROJECT_HANDOVER_PHASE5.md` and then implement the
> Planning Layer as specified in `docs/AI_PLANNING_SPEC.md`. Begin with
> the Daily Plan generator — it should consume the existing
> CoachDecision and validated User Context to produce the complete Daily
> Plan output defined in AI_PLANNING_SPEC.md §2. Follow the existing
> architecture patterns (pure functions in `src/lib/`, repository layer
> for any new data, provider-agnostic). Include comprehensive tests.
> Run ESLint, TypeScript, tests, and production build before reporting
> completion."**

This prompt gives the next conversation a clear entry point, references
the frozen specs by path, and sets the same quality bar every prior phase
met.
