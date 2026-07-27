# AI Planning Layer — Specification

**Status:** Business specification only. Nothing in this document has been
implemented. No engine, the Decision Engine, and the Response Layer are
unchanged by this document and remain exactly as specified in
`AI_COACH_SPEC.md` and `AI_COACH_ARCHITECTURE.md`.

**Scope:** This document describes a new layer that sits *after* the
Decision Engine and *before* the Response Layer. It contains business
rules and output requirements only — no code, no pseudocode, no database
schema changes. Where a rule depends on data the app doesn't yet capture
in a structured way, that gap is named explicitly rather than assumed.

---

## 1. Purpose

Every layer built so far answers one question:

> **"What should improve?"**

The Behavior, Nutrition, Exercise, Maintenance, WHY, Migraine, Menstrual,
Thyroid, Workday, and Adaptive Learning engines each look at what
happened and decide what matters, why, how urgently, and in what tone.
The Decision Engine ranks and reconciles all of that into a short,
prioritized list — the `CoachDecision`. That list is the single source of
truth for what the coach believes matters today. Nothing downstream is
allowed to second-guess it.

The Planning Layer answers a different question:

> **"What exactly should Natassha eat, cook, buy, and do today?"**

Where a `CoachDecision` insight says *"protein is behind — make the next
meal protein-forward,"* the Planning Layer is what turns that into
*"grilled chicken, ~150g, ready by the time you're home, order it before
6:45 if you're using GoFood."* It is the difference between a diagnosis
and a to-do list.

**The Planning Layer never changes a decision.** It doesn't decide that
protein matters more than sleep today, doesn't soften a Thyroid guardrail,
and doesn't invent a new priority the Decision Engine didn't already rank.
It only **operationalizes** decisions already made — turning "what should
improve" into "what to actually do about it, today, given the rest of
Natassha's day."

The Planning Layer's own inputs are deliberately narrow: the already-ranked
`CoachDecision`, plus the same **validated User Context** (profile,
settings, goals, confirmed routines, preferences, and historical data) the
application already assembles before the engines run. It never queries the
database independently and never introduces a judgment of its own — the
complete data-flow contract is defined in §11.

If the Decision Engine is the coach thinking, the Planning Layer is the
coach handing over a written plan for the day.

---

## 2. Daily Plan

Every morning, the Planning Layer produces one Daily Plan. Below is the
complete output and — for every field — exactly which existing part of
the system it comes from: either the ranked `CoachDecision`, or a factual
value already present in the validated User Context (goals, profile,
confirmed routines — see §11). Nothing in this section requires a new
engine or a new decision.

### 2.1 Today's Targets

| Field | Source |
|---|---|
| Calories | The person's stored calorie goal (`settings.calorieGoal`), same value the Coach Score already scores against. |
| Protein | `settings.proteinGoalG`, same value the Nutrition Engine's protein-first rule already uses. |
| Water | `settings.waterGoalMl`, same value the Water Tracker and Coach Score already use. |
| Workout | `settings.workoutGoalMinPerDay`, same value the Exercise Engine already uses. |
| Steps | The stored steps goal (`settings.stepsGoal`). **Gap:** no engine or Coach Score dimension currently scores step adherence (steps tracking is explicitly not implemented per `AI_COACH_SPEC.md` §10) — the Daily Plan can display the target as a stored preference, but cannot yet report progress against it. |
| Sleep | `settings.sleepGoalHours`, same value the Coach Score's sleep dimension already uses. |

No new targets are introduced. This section is a direct restatement of
goals the app already stores and already scores against — the Planning
Layer's only job here is collecting them into one place for the day.

### 2.2 Today's Schedule

| Field | Source |
|---|---|
| Breakfast / Lunch / Snack (suggested times) | Derived from the same commute facts the Workday Engine already reads (`profile.leaveHomeTime`, `profile.arriveHomeTime`) plus the confirmed daily routine in `USER_PROFILE.md` §3 (wake ~05:00, leave ~06:30, arrive ~19:00). Meal slots are placed realistically around the commute window the Workday Engine already treats as fixed, not invented independently. |
| Dinner (suggested time) | `USER_PROFILE.md` §3 explicitly marks dinner habits as **not yet confirmed** as a routine — unlike the other meals, dinner has no confirmed anchor time. Until Natassha confirms a preferred dinner schedule, Planning uses a reasonable default derived from arrival-home time (`profile.arriveHomeTime`) rather than treating dinner as being on the same confirmed footing as breakfast or lunch. Once a preferred dinner time is confirmed, Planning follows that preference instead of the default. |
| Workout Time | Placed in whichever window the Workday Engine already identifies as available (the "evening window" once arrival-home time has passed, per its existing rule), softened or moved first by any active Migraine- or Menstrual-phase guidance — governed by the same safety-first priority ordering defined in §3.3, not a separate rule. |
| Water Reminder | Timed using the same water-adherence signal already tracked (the Water Tracker/Coach Score's water dimension) — if the day's water intake is behind pace at the time the plan is generated or refreshed, a reminder slot is placed sooner rather than later. |

The Planning Layer does not invent a new notion of "the day" — it lays
suggested times across the same confirmed routine the Workday Engine
already reasons about, so a plan never contradicts what the app already
knows about Natassha's actual schedule.

### 2.3 Today's Top Priority, Biggest Risk, and Win

These three fields are **not new concepts** — they are the same fields
the Dashboard's daily briefing already surfaces (see Phase 4B/5), now
formalized as part of the Daily Plan's contract so any future surface
(not just the Dashboard card) can render them consistently:

- **Today's Top Priority** — the highest-ranked insight in
  `CoachDecision.insights` (already sorted by priority, then urgency).
- **Today's Biggest Risk** — the same top-ranked insight, *unless* it is
  itself tagged with a celebratory tone, in which case there is no risk
  to name today.
- **Today's Win** — the highest-ranked insight tagged with a celebratory
  tone, if one exists among today's insights; otherwise there is no win
  insight to report (the Daily Plan should say so plainly rather than
  invent one).

### 2.4 Today's Encouragement

Sourced from the WHY Engine's existing output when it fires (the
`why.surface_motivation` insight, which already selects one
not-recently-referenced motivation on a cooldown). If the WHY Engine has
nothing to say today (every motivation is within its cooldown, or none
are stored), the Daily Plan carries no encouragement line rather than
fabricating one — consistent with the WHY Engine's own existing rule that
saying nothing is preferable to overusing a motivation.

### 2.5 Plan Stability

The Daily Plan is intended to **remain stable throughout the day** once
generated. It does not silently regenerate itself every time the app is
opened — a plan that keeps changing under her would create exactly the
kind of decision fatigue this whole layer exists to reduce (§9).

- The application may regenerate the plan only after a **significant
  user-initiated event** — for example, an explicit manual regeneration
  request, or a meaningful change to a stored goal or profile fact. The
  specific mechanism for triggering regeneration (a button, a
  settings-save action, or otherwise) is a future product/UX decision and
  is deliberately not prescribed here.
- **Goal changes mid-day:** if a goal (for example, the calorie or
  protein target) is edited after the day's plan has already been
  generated, the existing plan is not required to update automatically.
  Stability is the default; immediate goal-driven regeneration is a
  future product behavior the application may choose to support, not a
  requirement of this specification.

### 2.6 Day-One Behavior

When a person has no historical data yet — a new install, or simply a day
before enough logging history exists — the Planning Layer does not
assume any pattern that hasn't actually been observed:

- There is no history yet for the Adaptive Planner (§8) to draw on, so it
  contributes nothing on day one — consistent with its own existing rule
  that a pattern requires a minimum number of confirmed occurrences
  before it's acted on, not guessed at.
- Targets (§2.1) still generate normally, since they come from stored
  goals (or the defaults defined in `AI_COACH_SPEC.md` §2.2), not from
  history.
- The Meal Planner (§3), Office Lunch Optimizer (§4), and GoFood Planner
  (§5) all still function normally on day one, since their core inputs —
  goals, confirmed routine, budget, active guardrails — are profile and
  settings facts, not historical patterns.

In short: day one produces a fully deterministic plan built from stored
facts and defaults. It has no adaptive personalization layered on top of
it yet, and it does not fabricate any to compensate.

---

## 3. Meal Planner

The Meal Planner is the part of the Planning Layer responsible for
turning a nutrition-related decision into specific food. It **never
decides** that protein or calories need attention — that remains the
Nutrition Engine's job, unchanged. It only decides *which food*, given
everything else known about the day.

### 3.1 Adaptation factors and where each comes from

| Factor | Existing source | Status |
|---|---|---|
| Goal weight | `profile.goalWeightKg` | Already available |
| Weekly weight trend | The Maintenance Engine's existing weekly-trend insight | Already available |
| Calorie target | `settings.calorieGoal` | Already available |
| Protein target | `settings.proteinGoalG` | Already available |
| Work schedule / office lunch / arrival time | `profile.leaveHomeTime`, `profile.arriveHomeTime`, `profile.lunchProvidedByOffice`, and the Workday Engine's existing timing logic | Already available |
| Sleep target | `settings.sleepGoalHours` | Already available |
| PMS | The Menstrual Engine's existing luteal-phase PMS hunger-support insight | Already available |
| Migraine | The Migraine Engine's existing meal-gap and active-care insights | Already available |
| Thyroid awareness | The Thyroid Engine's existing aggressive-deficit guardrail — the Meal Planner must never propose a plan whose total deficit the Thyroid Engine would flag | Already available |
| Motivation | The WHY Engine's existing surfaced motivation | Already available |
| Food preferences (spicy food, matcha) | Confirmed in `USER_PROFILE.md` §5 | **Gap** — documented in prose only; not yet a structured, queryable field (see §12 Recommended Additive Changes) |
| Budget (GoFood ~Rp 30,000) | Confirmed in `USER_PROFILE.md` §5 | **Gap** — same as above |
| GoFood habits | Confirmed in `USER_PROFILE.md` §5, §8 | **Gap** — no GoFood order history is logged anywhere in the app today |
| Adaptive Learning | The Adaptive Learning Engine's existing detected patterns (weekend dessert, late-night hunger, low hydration, stress-eating proxy, skipped-workout day) | Already available |
| Blood type | `USER_PROFILE.md` §7 confirms Blood type A | **Explicitly excluded** — blood-type-based diet logic is not an evidence-based coaching principle and is deliberately never used anywhere in this app, matching `USER_PROFILE.md` §7's own statement that no dietary or coaching logic here is blood-type-based. Blood type is documented as a known fact about Natassha and nothing more; it must never become a Meal Planner input. |

### 3.2 Core rules

- The Meal Planner never proposes a meal that ignores an active Thyroid
  guardrail — if the Thyroid Engine has flagged today's deficit as too
  aggressive, the Meal Planner's suggestions must land within the more
  moderate range the guardrail recommends, not the original target.
- The Meal Planner never proposes a meal during an active migraine-care
  day (per the Migraine Engine) that reintroduces a long meal gap — it
  actively favors smaller, more frequent meals that day.
- During a luteal-phase PMS window (per the Menstrual Engine), the Meal
  Planner favors protein- and fiber-forward snack options over
  calorie-restrictive ones, consistent with the Menstrual Engine's own
  existing guidance.
- Every proposed meal must be **practical**: something realistically
  available given Natassha's actual routine (home-cooked, office-provided,
  or GoFood-ordered) — never a meal that assumes equipment, time, or
  access she doesn't have.
- The planner never produces an "impossible" meal: no meal that would
  require grocery shopping mid-day, no recipe requiring equipment not
  confirmed to exist (the confirmed kitchen/exercise context is a home
  treadmill and no gym — the same logic applies to meals: no restaurant
  reservations, no specialty ingredients without a clear sourcing path).

### 3.3 Planning Constraint Priority

When more than one of the core rules above applies to the same day, they
are resolved in a **fixed priority order** — the Planning Layer does not
weigh them situationally or guess which matters more on any given day:

| Priority | Constraint | Source |
|---|---|---|
| 1 (highest) | Safety guardrails | The Thyroid Engine's aggressive-deficit guardrail |
| 2 | Migraine-related requirements | The Migraine Engine's active-care and meal-gap guidance |
| 3 | Menstrual / PMS adjustments | The Menstrual Engine's luteal-phase guidance |
| 4 | Daily nutrition targets | Calories, protein, water — the stored goals in §2.1 |
| 5 (lowest) | Practical constraints | Time, office lunch, budget, GoFood (§4, §5) |

A lower-priority constraint never overrides a higher one. For example, a
GoFood option that fits the budget perfectly (priority 5) is still set
aside if it would push the day outside the Thyroid guardrail's moderate
range (priority 1).

**This ordering never changes what the Decision Engine decided.** The
Decision Engine still determines which insights matter and how urgently.
This priority order only governs *how* the Planning Layer executes those
already-ranked decisions safely when turning them into a concrete plan —
it decides how, never what or whether. The same ordering also governs any
non-meal planning decision that involves more than one active constraint
at once (for example, the Workout Time adjustment referenced in §2.2).

### 3.4 Recipe Source

The Meal Planner selects meals from a defined set of approved recipes,
meal templates, or — in the future — an external recipe provider. It does
not invent a meal or its nutritional values from scratch. Any calorie,
protein, carbohydrate, fat, or fiber figure attached to a suggested meal
must trace back to an actual, defined source (a stored recipe/template or
a provider's data), the same way every number in `CoachDecision` traces
back to logged data rather than being estimated freely. This keeps a
suggested meal exactly as verifiable as the app's existing macro tracking
— Natassha can trust that "grilled chicken, 250 kcal, 40g protein"
reflects a real, defined recipe, not a guess made up on the spot.

### 3.5 Macro Distribution

Today's calorie and protein targets (§2.1) are distributed across the
day's planned meals **realistically, not in equal fractions**. An even
four-way split — breakfast, lunch, snack, and dinner each getting exactly
one quarter — rarely matches how a real day actually unfolds: office
lunch is typically the largest meal of a workday, and breakfast before an
early commute is realistically smaller. The distribution should reflect
the confirmed routine and any known habits (for example, a heavier dinner
on a day breakfast was skipped, per the Emergency Planner in §7) rather
than defaulting to a mathematically even split that conflicts with how
the day is actually eaten.

---

## 4. Office Lunch Optimizer

Confirmed fact: lunch is provided by the office on workdays
(`profile.lunchProvidedByOffice`, `USER_PROFILE.md` §3). The Office Lunch
Optimizer's entire job is deciding how to treat a lunch that's already
happening — **it never replaces it.**

For each component already loggable via the existing office-lunch
quick-add categories (Rice, Chicken, Fish, Egg, Tempe, Tofu, Vegetables,
Soup, Fruit, Dessert, Sweet Drink), the Optimizer recommends exactly one
of four actions, each with a stated reason:

| Action | When it applies |
|---|---|
| **Eat** | The component fits today's remaining targets as-is. |
| **Reduce** | The component is fine in kind but not in the portion offered today, given what's already been eaten or what's still planned (e.g. a smaller rice portion when dinner is expected to be carb-heavy). |
| **Skip** | The component doesn't fit today's targets or an active guardrail (e.g. skipping Sweet Drink on a day the Thyroid guardrail is active), and skipping it doesn't create a meal-gap risk per the Migraine Engine. |
| **Add** | The office tray is short on protein or vegetables relative to today's targets, and something small and realistic can be added alongside it (not a separate meal — a supplement to this one). |

Every recommendation must state its reason in one sentence, grounded in
an actual target or an actual active insight — never a bare instruction
with no "why." Where more than one consideration applies to the same
component (for example, a target *and* an active guardrail), the priority
ordering in §3.3 decides which one governs the recommendation.

---

## 5. GoFood Planner

The GoFood Planner recommends specific, orderable meal choices when
Natassha is ordering rather than eating office-provided or home food.

### 5.1 Requirements

- **Never shame.** A GoFood order is never framed as a lapse or a
  weakness to apologize for (per the confirmed Non-Negotiables in
  `USER_PROFILE.md` §10) — it's simply today's ordering channel, planned
  for like any other meal.
- **Prefer substitution over restriction.** When a craving or a known
  temptation (e.g. Mixue, per `USER_PROFILE.md` §8) is in play, the
  planner's first move is a realistic substitution or a smaller planned
  portion — not a blanket "don't."
- **Explain why.** Every recommendation states the specific reason it was
  chosen (budget fit, protein content, remaining calories, or a
  substitution rationale) — never an unexplained pick.

### 5.2 Decision Order

When choosing among GoFood options, the planner applies the following
order — one constraint at a time, not a simultaneous weighing of all
three:

1. **Stay within a reasonable budget whenever possible.** The confirmed
   typical order budget (~Rp 30,000, `USER_PROFILE.md` §5) is the
   starting constraint.
2. **Stay as close as practical to today's remaining calorie target** —
   what's left of the day's calorie budget at the time of ordering, not
   the full daily target in isolation.
3. **Maximize protein** among whatever options remain after 1 and 2.

**If all three cannot be satisfied at once, the planner does not quietly
pick an option and present it as ideal.** It explains the trade-off
plainly — for example, naming that the closest-protein option runs
slightly over the usual budget, or that staying in budget means falling a
little short on protein today — so Natassha can make an informed choice
rather than being handed a recommendation that silently missed one of her
own targets.

This stays consistent with §3.3's broader priority ordering: budget and
calorie-fit here are "practical constraints" (priority 5). If a GoFood
choice would ever conflict with a higher-priority safety guardrail (for
example, Thyroid), §3.3's ordering governs — not this section's own
budget-first sequencing.

---

## 6. Weekly Meal Prep

Generated on the same weekly cadence as the existing Weekly CEO Review
(`AI_COACH_SPEC.md` §3), so meal prep and the weekly review land together
as one weekly rhythm rather than two disconnected schedules.

Weekly Meal Prep output includes:

- A **weekly meal plan** — one meal-shape per day (not necessarily full
  recipes), built from the same Meal Planner rules in §3, applied across
  the coming 7 days rather than just today.
- A **shopping list** derived from that plan, broken down into:
  - Protein requirements
  - Vegetables
  - Fruit
  - Healthy snacks
- **Batch-cooking ideas** — where the week's plan repeats a protein or
  base ingredient across multiple days, the plan calls that out as a
  single batch-cook opportunity rather than repeating separate
  from-scratch instructions.

**Relationship to the existing Shopping feature:** the app's `shopping`
collection already supports an `addedFrom: "ai-suggestion"` provenance
value (alongside `"manual"` and `"recurring"`) — meaning weekly meal-prep
shopping items are already representable in the existing schema with zero
changes. This is called out explicitly in §12 as a point of strength, not
a gap.

---

## 7. Emergency Planner

The Emergency Planner exists for the day the plan doesn't survive contact
with reality. Its entire philosophy is a direct extension of the Behavior
Engine's existing streak-recovery rule (`AI_COACH_SPEC.md` §6.1) and the
Non-Negotiables (`USER_PROFILE.md` §10): **the day is always recoverable,
never a failure to declare.**

Recognized disruption scenarios:

- Late dinner
- Missed breakfast
- Unexpected overtime
- Eating at a restaurant
- A mall trip (already a confirmed weekend pattern, `USER_PROFILE.md` §3)
- Travel
- A birthday
- Attending a wedding as a guest — an ordinary social occasion. **This is
  explicitly not a reference to Natassha's own upcoming wedding.** Her own
  wedding is a confirmed long-term motivation the WHY Engine draws on
  (`USER_PROFILE.md` §9) and is never treated as a disruption to recover
  from — it is the opposite of an emergency in this system.

### 7.1 Core rule

For any of the above, the Emergency Planner never regenerates a plan that
implies the day is unsalvageable. It produces an **adjusted** plan for
the remaining hours of the day — the same way the Behavior Engine already
reframes a broken streak as "get back to today's basics" rather than
treating it as a loss. A missed breakfast doesn't cascade into a "bad
day" narrative; it simply shifts remaining targets across the meals still
ahead.

### 7.2 Disruption Detection

The Planning Layer never detects that a disruption is happening on its
own — it has no independent awareness that "today is unusual." It only
reacts to a disruption signal the application provides to it. What that
signal looks like — a button Natassha taps, a conversational message, a
notification response, or some other interaction — is a future UX
decision entirely outside this specification's scope. This document only
defines how the Planning Layer *responds* once a disruption is signaled,
never how the disruption is noticed in the first place.

### 7.3 Overlapping Scenarios

When more than one disruption applies on the same day — for example,
unexpected overtime on a day a migraine was also logged — **safety-related
constraints always take precedence**, using the same ordering §3.3
already establishes (the Thyroid guardrail, then migraine-related
requirements, ahead of everything else). Any other adjustment the
Emergency Planner would otherwise make is applied only if it doesn't
conflict with whatever higher-priority safety guidance is already active
that day.

---

## 8. Adaptive Planner

The Adaptive Planner does not detect patterns itself — pattern detection
remains entirely the Adaptive Learning Engine's job, unchanged. The
Adaptive Planner **consumes** patterns the Adaptive Learning Engine has
already confirmed and adjusts default plan choices accordingly.

### 8.1 Patterns already available to consume

| Pattern | Existing source |
|---|---|
| Weekend dessert | Adaptive Learning Engine — already detects and reports this |
| Late-night hunger | Adaptive Learning Engine — already detects and reports this |
| Skipped workouts by day-of-week | Adaptive Learning Engine — already detects and reports this |
| Low hydration | Adaptive Learning Engine — already detects and reports this |
| Stress eating (low-sleep → overshoot proxy) | Adaptive Learning Engine — already detects and reports this |

When one of these is active, the Adaptive Planner's job is purely
presentational-in-effect: for example, if the weekend dessert pattern is
confirmed, Saturday's plan proactively includes a planned treat within
target rather than pretending it won't happen and being "surprised" by it
later — the same non-punitive philosophy the Adaptive Learning Engine's
own recommendations already use.

### 8.2 Patterns named in this phase's brief but not yet detectable

- **"Mondays are difficult"** (a general adherence dip tied to a specific
  weekday, beyond workouts specifically) — the Adaptive Learning Engine
  currently only detects day-of-week patterns for *workouts*, not for
  overall adherence or nutrition.
- **"Friday dessert"** — the existing weekend-dessert detector is scoped
  to Saturday/Sunday; a Friday-specific variant isn't currently detected.
- **Repeated GoFood** — there is no GoFood order log in the app today, so
  frequency can't be measured.

None of these are implemented by this specification. They would each
require a new detection rule inside the existing Adaptive Learning
Engine — which is explicitly out of scope for this phase ("do not modify
any existing Engine"). They are listed here so the gap is visible, and
are carried forward to §12 as a *future*, separate piece of work, not
something this document authorizes building now.

### 8.3 Principle

Whatever the Adaptive Planner does with a confirmed pattern, it never
punishes the pattern's existence. A detected pattern changes what the
plan *defaults to* — it never becomes a reason to restrict harder or
call out the behavior as a problem to fix through willpower.

---

## 9. Planning Principles

Every plan the Planning Layer produces, across every section above, must:

- **Reduce decision fatigue.** A plan that requires more decisions than
  it saves has failed at its one job.
- **Be realistic**, given the actual day (commute, office lunch,
  confirmed routine) — never a plan for an idealized day that isn't
  Natassha's.
- **Fit Natassha's lifestyle** specifically — home treadmill and no gym,
  office-provided lunch, a confirmed commute window, GoFood as a real
  ordering channel — not a generic template.
- **Be executable** — every item in a plan should be something that can
  actually be done with what's actually available today.
- **Prefer consistency over perfection** — the same principle already
  governing the Exercise Engine's minimum-action rule and the Behavior
  Engine's streak-recovery framing extends to every plan this layer
  produces.
- **Avoid guilt**, in every scenario, including recovery and adaptive
  scenarios — never frame a plan as compensation for something done
  "wrong."
- **Never recommend an impossible routine** — no plan should assume more
  time, money, energy, or access than Natassha actually has today.
- **Encourage reasonable variety.** A plan should not repeat the same
  primary meal excessively over a short period unless Natassha has
  specifically indicated she prefers that repetition. Rotation keeps a
  plan feeling considered rather than automated, without treating variety
  as more important than practicality (§3.2) or budget (§5).

---

## 10. Future Expansion

The following are named as directions worth documenting, but are **not**
implemented by this specification and require no action now:

- Barcode scanning (for faster food logging)
- Photo meal recognition (identifying food from a photo — note: this
  would be a form of AI image recognition, which `AI_COACH_SPEC.md` §10
  already explicitly excludes from current scope; any future work here
  would need to revisit that exclusion deliberately, not assume it away)
- Restaurant menu optimization (recommending specific items from a known
  restaurant's menu)
- Calendar integration (reading actual calendar events to time plans
  around real appointments rather than the fixed confirmed routine)
- AI-assisted grocery optimization (price comparison, store selection)
- Dynamic recipe generation (as opposed to selecting from known,
  practical meal shapes, per §3.4)
- **Smart pantry awareness** — if pantry information ever becomes
  available (what ingredients are already at home), the Planning Layer
  should prioritize recommending meals that use what's already on hand
  before recommending a new purchase. This is named here as a
  **future-compatible rule, not an active one**: it requires a data
  source (a pantry log) that doesn't exist today, and it remains entirely
  optional and additive — nothing in the current Meal Planner (§3),
  GoFood Planner (§5), or Weekly Meal Prep (§6) sections depends on it.
- Seasonal ingredient awareness

---

## 11. Relationship With Existing Architecture

To remove any ambiguity about where this layer sits and what it's allowed
to touch:

- The Planning Layer **consumes two things, and only two things:**
  - **`CoachDecision`** — the same ranked output the Response Layer
    already consumes.
  - **The validated User Context** already assembled by the application's
    existing orchestration/context-building process — the same profile,
    settings, goals, confirmed routines, preferences, and historical data
    already gathered together before the engines run. This context is
    *supplied to* the Planning Layer; the Planning Layer does not go
    fetch it independently.
- It **never reads raw Firestore repositories directly.** Any factual
  data it uses arrives as part of the already-assembled User Context
  above, through the same repository-mediated process every other part of
  the app already relies on — never a new, parallel path to the database.
- It **never performs a new coaching judgment.** Every threshold,
  comparison, or "is this on track" determination the Planning Layer
  might appear to make must already exist as a decision an Engine
  produced. The Planning Layer's role is to read and operationalize those
  decisions, never to originate one of its own — however small it might
  seem (see §2.2's water-reminder timing, which follows this same rule:
  it reacts to the water dimension already tracked, it does not invent a
  new "is this behind pace" judgment of its own).
- **`CoachDecision` remains the single source of truth** for what
  matters, why, how urgently, and in what tone. The User Context supplies
  *only* factual information — goals, profile facts, confirmed routines,
  preferences, and historical context — needed to turn an already-made
  decision into something concrete. It never supplies a new decision of
  its own.
- It **never bypasses the Decision Engine.** There is no scenario in
  which the Planning Layer acts on data the Decision Engine hasn't
  already ranked and approved as an insight.
- It **never changes priorities.** The ranking `CoachDecision` produces
  is final by the time the Planning Layer sees it.
- It **never changes coaching decisions.** If the Decision Engine says
  protein is today's top concern, the Planning Layer cannot decide sleep
  matters more instead — it can only decide *what specific action* serves
  the priority already set.
- It **only transforms decisions into plans** — the sole function of this
  entire layer.

Where the Planning Layer sits in the existing pipeline:

```
User Data
  → Deterministic Engines        (unchanged)
  → Decision Engine               (unchanged)
  → Planning Layer                 (this document)
  → Response Layer                (unchanged)
  → LLM                           (unchanged)
```

Both of the Planning Layer's inputs — `CoachDecision` and the validated
User Context — arrive through this same existing pipeline. Neither is
fetched by the Planning Layer independently, and neither represents a new
path into the application's data.

---

## 12. Feasibility Evaluation

**Can the Planning Layer be built on the current architecture without
redesigning any existing module? Yes.**

The current architecture already provides everything a first version of
this layer needs:

- `CoachDecision` is already a stable, well-typed output the Planning
  Layer can consume exactly as the Response Layer does today.
- Every `EngineInsight` already carries a generic `data` field capable of
  holding whatever structured numbers a plan needs to reference (e.g.
  remaining protein grams) — no change to the Decision Engine or any
  Engine is required for the Planning Layer to read what it needs.
- Every confirmed personal fact this specification relies on (routine,
  budget, food preferences, coaching tone) already exists in
  `USER_PROFILE.md` and, where structured, in the existing `users` and
  `settings` collections — exactly the kind of factual data the same
  orchestration/context-building process already assembles into the
  validated User Context described in §11, through the existing
  repository layer, with no new data-access path required.
- The `shopping` collection's existing `addedFrom: "ai-suggestion"` value
  means Weekly Meal Prep's shopping list output is already representable
  in the current schema with zero changes.

A minimal first version of this layer could be built with **no schema
changes at all** — computing a Daily Plan on demand, the same way
`buildCoachDecision` already computes a decision on demand, without
persisting anything new.

### Recommended Additive Changes

The following are **optional enhancements**, not requirements, and every
one is purely additive — none require modifying an existing collection's
existing fields, an existing engine, the Decision Engine, or the Response
Layer.

1. **A `daily_plans` collection** (new, additive), to persist a
   generated Daily Plan for the day rather than recomputing it on every
   view, and to allow future tracking of whether a plan was actually
   followed. Not required for a first version.
2. **Structured food-preference fields** (new, optional fields on the
   existing profile/settings data), to replace today's reliance on
   `USER_PROFILE.md` prose for favorite foods, trigger foods, and
   spice/flavor preference, so the Meal Planner can read them directly
   rather than depending on a document a machine can't query.
3. **A structured GoFood budget field** (new, optional setting), to
   replace today's prose-only confirmed figure (~Rp 30,000) with a real,
   editable value the GoFood Planner can read and Natassha can update
   herself later without a documentation change.
4. **A GoFood order log** (new, additive collection), only if/when
   GoFood-specific Adaptive Learning patterns (§8.2) become a priority —
   not needed for the Planning Layer's core function otherwise.
5. **New Adaptive Learning Engine pattern rules** (day-of-week overall
   adherence, Friday-specific dessert, GoFood repetition) — explicitly
   flagged as a **future engine change**, not authorized by this
   document, and out of scope for "additive" since it modifies an
   existing engine file rather than adding new data alongside it.

Items 1–4 are additive in the strictest sense: new collections or new
optional fields, nothing removed or changed on anything that exists
today. Item 5 is listed for completeness but is explicitly *not* an
additive change — it's called out separately so it's never mistaken for
one.
