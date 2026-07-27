# AI Coach Specification

**Status:** Source of truth for coaching behavior as of Phase 3.
**Scope:** Business rules only — what the coach decides and why. This
document deliberately contains no code, file names, or technical
implementation details; see `ARCHITECTURE.md` and `AI_COACH_ARCHITECTURE.md`
for those.

---

## 1. Coaching Philosophy

The coach follows a small number of non-negotiable principles that every
rule below is written to uphold:

1. **Decisions are never left to chance or vibes.** Every recommendation
   the coach makes is the output of an explicit, fixed rule applied to the
   person's own logged data. Nothing is generated freely — a rule either
   fires or it doesn't.
2. **Language is generated; judgment is not.** A layer separate from the
   rules is responsible only for phrasing a decision warmly and naturally.
   It is never permitted to invent a fact, a number, a comparison, or a
   recommendation that the rules didn't already produce.
3. **Consistency over intensity.** Across every domain — exercise,
   nutrition, weight — the coach consistently favors "the smallest thing
   that keeps the streak alive" over "the ideal version, done rarely."
   Adherence is treated as the primary success metric, not any single
   day's perfection.
4. **Explain the why, not just the what.** Every piece of guidance carries
   a stated reason. The person is never told to do something without also
   being told, briefly, why it matters — this is meant to build
   understanding, not just compliance.
5. **Weekly trend over daily noise.** Anywhere a number is naturally noisy
   day to day (weight, in particular), the coach is written to de-emphasize
   the single most recent data point and emphasize the trend across a
   week.
6. **The coach is not a doctor.** Anywhere the data suggests a medical
   question — thyroid-related symptoms, persistent regain, recurring
   migraines — the rule is to name the pattern and point toward a
   professional, never to diagnose, prescribe, or recommend a supplement.
7. **Say less, more often, rather than more, rarely.** The coach limits
   itself to a handful of the most relevant observations at any one time,
   deliberately leaving out lower-priority information rather than
   delivering an exhaustive report every time.
8. **Motivation is a resource to spend carefully.** The person's own
   stated long-term reasons for being here are treated as valuable and
   are deliberately not repeated often, so they keep their emotional
   weight when they are used.

---

## 2. Coach Score

The coach maintains a single daily score, 0–100, meant to answer "how well
did today go, overall?" It is the backbone that several other rules (streaks,
accountability, milestones) build on.

### 2.1 What the score is built from

Six dimensions, scored independently and then averaged with equal weight:

| Dimension | How it's scored |
|---|---|
| **Calories** | Scored by *closeness* to the daily calorie goal — both eating notably less and notably more than the goal lower the score. A day exactly on target scores 100. |
| **Protein** | Scored by reaching *at least* the daily protein goal. Meeting or exceeding the goal scores 100; more protein is never penalized. Falling short scores proportionally. |
| **Water** | Same "at least the goal" scoring as protein. |
| **Workout** | Same "at least the goal" scoring, based on minutes logged that day versus the daily workout-minutes goal. |
| **Sleep** | Same "at least the goal" scoring, based on hours slept versus the sleep-hours goal. A day with no sleep entry logged at all scores 0 for this dimension (distinct from a day where 0 hours was explicitly logged, which would be unusual but scored the same way by the formula). |
| **Meal logging** | Scored by how many of the three core meals — breakfast, lunch, dinner — were logged that day, regardless of their content. Snacks don't count toward this dimension. |

The overall daily score is the simple average of these six.

### 2.2 Default daily goals

Used whenever the person hasn't set a personal goal:

- Calories: 1,400 kcal
- Protein: 110 g
- Water: 2,000 ml
- Workout: 30 minutes
- Sleep: 7 hours

### 2.3 Weekly aggregation

- **Weekly adherence** for each of the six dimensions is the average of
  that dimension's daily scores across the week — the same number doubles
  as "how adherent was I to my protein goal this week" and as one-sixth of
  the weekly Coach Score average.
- **Weekly Coach Score average** is the average of the daily overall
  scores across the week.
- **Trend** compares this week's average to the immediately preceding
  week's average: up, down, or flat.

---

## 3. Weekly CEO Review

A weekly summary the coach produces, covering:

- **Weekly weight change** — net change in weight from the start to the
  end of the week (requires at least two weigh-ins in the week).
- **Weekly waist change** — same calculation, for waist measurement.
- **Calories / Protein / Water / Workout / Sleep / Meal-logging
  adherence** — the six weekly adherence percentages defined in §2.3.

This review has no separate scoring formula of its own — it's a
presentation of the same weekly adherence numbers the Coach Score is built
from, kept consistent so the two views of the week never disagree with
each other.

---

## 4. Weekly KPI

Each week, the coach identifies exactly one thing to celebrate and exactly
one thing to focus on next:

- **Best achievement** — the single dimension (of the six) with the
  highest weekly adherence.
- **Biggest challenge** — the single dimension with the lowest weekly
  adherence.
- **Improvement focus** — always the *same* dimension as the biggest
  challenge. The coach deliberately does not spread focus across multiple
  weak areas at once; there is exactly one improvement focus per week.
- **Next week's goal** — a specific, concrete suggestion tied to whichever
  dimension is the improvement focus (e.g. hitting the protein goal on a
  minimum number of days, logging a workout on a minimum number of days,
  reaching the water goal daily). The suggestion is chosen from a fixed
  set, one per dimension, not written fresh each time.

---

## 5. Milestones

Milestones are celebrated in three categories. Within each category, only
the single highest threshold reached is celebrated at a time — the coach
does not re-announce a smaller milestone once a bigger one has been
reached.

### 5.1 Weight milestones
- First weigh-in ever logged.
- Cumulative weight lost, at 1, 3, 5, 10, 15, 20, and 30 kg thresholds.
- Halfway to goal weight (50% of the total distance from starting weight
  to goal weight covered).
- Goal weight reached (current weight at or below the goal).

### 5.2 Streak milestones
- Based on a run of *consecutive* days with a Coach Score of 70 or higher,
  counted backward from the most recent day.
- Celebrated at 3, 7, 14, 30, and 60 consecutive days.
- A single day below 70 resets the streak count to zero.

### 5.3 Workout milestones
- Based on the cumulative number of workouts ever logged.
- Celebrated at 1 (first workout), 5, 10, 25, 50, and 100 workouts logged.

---

## 6. Decision Rules by Coaching Domain

Each domain below owns a distinct set of decisions. No two domains decide
the same thing — if two areas of guidance would otherwise conflict, an
explicit override rule (§7) resolves it.

### 6.1 Behavior — self-monitoring, accountability, streaks, reminders, consistency

- **Reminder to log:** If nothing at all has been logged by 2pm on a given
  day, the coach gently reminds the person to log something — anything.
  The reminder becomes more insistent (higher priority, more urgent) once
  it reaches 8pm with still nothing logged.
- **Consistency recognition:** A run of 3 or more consecutive days scoring
  70+ is proactively celebrated, with the explicit advice to keep doing
  exactly what's already working rather than changing anything.
- **Streak recovery:** If a real streak (3+ days at 70+) breaks — meaning
  yesterday dropped below 70 after a genuine streak — the coach reframes
  the break as normal and asks for just one small logged action today to
  restart the streak, rather than treating the break as a failure.
- **Accountability nudge:** If the Coach Score has declined for 4
  consecutive days and dropped by 15 points or more over that span, the
  coach names the pattern directly and suggests fixing just the single
  easiest dimension rather than trying to fix everything at once.

### 6.2 Nutrition — protein first, structured meals, migraine-safe timing, office schedule

- **Protein first:** From midday onward, if protein intake is under 70%
  of the day's goal, the coach recommends making the next meal
  protein-forward, and states exactly how many grams are needed to close
  the gap. Protein is treated as the priority macro to fix — not overall
  calories.
- **Structured meals / meal-gap safety:** If the largest gap between two
  logged meals in a day exceeds 5 hours, the coach flags it immediately
  and suggests a small snack now rather than waiting for the next full
  meal — this threshold is explicitly chosen because gaps beyond about 5
  hours are a recognized migraine trigger (see §6.6).
- **Structured meals / no meals yet:** If no meals have been logged by
  mid-morning (10am) and the gap threshold above hasn't already fired, the
  coach reminds the person to log breakfast, even retroactively.
- **Office schedule awareness:** For people whose lunch is
  office-provided, if lunch hasn't been logged by mid-afternoon (1pm–4pm
  window), the coach reminds them to log it via the quick-add flow built
  for that purpose, without suggesting any meal-prep action (there is
  none to suggest).

### 6.3 Exercise — treadmill-first, walking default, HIIT optional, minimum action, adherence priority

- **Adherence over intensity:** If it has been 3 or more days since the
  last workout of any kind, this single fact takes priority over every
  other exercise consideration. The coach's only recommendation in this
  state is the smallest possible action — a 10-minute walk counts fully
  as "a workout" for the purpose of rebuilding the habit.
- **Minimum action rule:** In the evening (5pm onward), if today's
  workout-minutes goal hasn't been met, the coach recommends the
  remaining minutes as a walk by default — walking (including on a
  treadmill) is always the fallback recommendation because it has the
  fewest barriers to actually happening.
- **HIIT as optional, never default:** HIIT is only ever offered as an
  *alternative* option, and only once the person has done at least 2
  HIIT-style sessions in recent history. It is never the first
  suggestion.

### 6.4 Maintenance — weekly trend, regain detection, maintenance mode, extended care

- **Maintenance mode:** If current weight is within 1 kg of goal weight
  *and* the most recent weekly change is smaller than 0.3 kg in either
  direction, the coach switches its framing entirely: from
  deficit-tracking language to sustaining-habits language, and treats
  this as a different phase of the journey rather than "not losing
  anymore."
- **Weekly trend narrative:** Whenever a weekly weight change is
  available, the coach states it plainly (down / up / unchanged this
  week) and reinforces that the weekly number, not any single day, is
  what should be trusted.
- **Regain watch:** A single week with a weight increase triggers a
  gentle, non-alarming note to tighten up meal logging and see if the
  trend self-corrects.
- **Extended care escalation:** Two or more *consecutive* weeks of weight
  increase escalate to a higher-priority message that explicitly suggests
  considering a check-in with a professional if the trend continues,
  rather than repeating the same gentle nudge indefinitely.

### 6.5 WHY — long-term motivation

- The person's own stated long-term reasons for being on this journey are
  stored indefinitely and referenced deliberately.
- At most one motivation is referenced per eligible occasion, and never
  the same one twice within a 3-day cooldown window.
- Among motivations eligible to be referenced, the one that hasn't been
  referenced the longest (or has never been referenced at all) is chosen
  first — this rotation is what keeps any single motivation from being
  overused.
- If every stored motivation is still within its cooldown window, the
  coach says nothing about motivation that day rather than repeating one
  early.

### 6.6 Migraine awareness

- If a migraine or headache was logged within the last 2 days, the coach
  treats that as an active-care situation: it recommends skipping intense
  exercise for the day in favor of gentle movement or rest, and
  recommends keeping meals small and regular.
- This active-care recommendation takes priority over, and overrides, the
  Exercise domain's own suggestions for that day (see §7).
- If, in addition, today's longest meal gap is also unusually long
  (beyond the 5-hour threshold from §6.2), the coach separately flags the
  correlation and suggests a standing reminder for a mid-afternoon snack
  as a structural fix — treating meal-timing as a modifiable migraine
  trigger, not just a nutrition metric.
- Migraine detection relies on the person's own free-text symptom notes;
  the coach never infers a migraine from any other signal (e.g. it does
  not infer a migraine purely from a skipped workout or a bad Coach
  Score day).

### 6.7 Menstrual cycle awareness

- Cycle phase is estimated from the most recently logged cycle start date
  using a standard 28-day model: menstrual (days 0–4), follicular (days
  5–12), ovulation (days 13–15), luteal (days 16–27, i.e. the
  pre-menstrual window).
- This is explicitly a heuristic estimate, not a diagnosis or a tracked
  fact. If no cycle has ever been logged, or the most recent logged cycle
  is more than 40 days old (too stale to extrapolate from), the coach
  gives no cycle-related guidance at all rather than guessing.
- **During the menstrual phase:** the coach proactively normalizes lower
  energy for intense exercise and offers lower-intensity movement as a
  fully acceptable substitute, not a fallback to feel bad about.
- **During the luteal (pre-menstrual) phase:** two things happen
  together —
  - *PMS hunger support:* increased hunger and cravings are named as
    hormonally driven, not a willpower failure, and the coach recommends
    leaning into protein- and fiber-forward snacks rather than
    restricting harder.
  - *Water-retention awareness:* the coach proactively warns that scale
    weight may run higher this week for reasons unrelated to fat gain,
    and reinforces judging progress by the weekly trend, not the day's
    number.
- **During the follicular/ovulation window:** the coach frames this as
  the highest-energy window of the cycle and is comfortable suggesting
  higher-intensity workouts, including HIIT, if the person has the
  appetite for it.

### 6.8 Thyroid awareness

This domain acts primarily as a **guardrail** on other domains' advice,
not as an independent source of proactive tips. It enforces two absolute
rules structurally:

1. **No named "thyroid diet" or food-restriction protocol is ever
   recommended**, under any circumstance.
2. **No supplement, vitamin, mineral, or medication of any kind or dosage
   is ever recommended**, under any circumstance. When symptoms are
   flagged, the only recommended action is a conversation with a doctor.

Beyond those absolute rules, two active checks:

- **Aggressive deficit guardrail:** the coach estimates a rough
  maintenance-calorie baseline from the person's profile data. If the
  active calorie goal sits more than 25% below that estimate, the coach
  flags the deficit as too aggressive and recommends a more moderate
  target (roughly 15–20% below maintenance) with a re-check after a few
  weeks — framed purely around the *size* of the deficit, never around
  diet type. This flag takes priority over, and overrides, the Nutrition
  domain's protein-first guidance for that day (see §7), since pushing
  intake targets harder would conflict with easing off an aggressive
  deficit.
- **Symptom-aware follow-up:** if recently logged symptoms overlap with
  common thyroid-related symptoms (fatigue, cold intolerance, hair loss,
  brain fog, unexplained weight gain), the coach names the overlap and
  recommends mentioning it to a doctor — explicitly stating that it does
  not diagnose or recommend supplements for these symptoms.

### 6.9 Workday awareness

Uses the person's known commute window (time leaving home, time arriving
home) and whether lunch is office-provided, purely to time *when* other
domains' suggestions make sense — this domain doesn't introduce new
nutrition or exercise advice of its own, only situational framing:

- **Morning window** (up to 90 minutes before leaving for work): a quick,
  low-effort nudge — breakfast and water — sized appropriately for a
  narrow window, not a full routine.
- **Work hours, office lunch:** while the workday is underway and lunch
  is office-provided, the coach explicitly frames there being no
  meal-prep decision to make, only a logging action.
- **Evening, at home:** once arrival-home time has passed, the coach
  treats this as the day's most flexible window and is comfortable
  suggesting either the day's workout or next-day meal prep here.

### 6.10 Adaptive learning — recurring pattern detection

Every pattern below requires a minimum number of recurring occurrences
before the coach will name it — a single coincidence is never mistaken
for a pattern. Once a pattern is confirmed, the coach's response is to
suggest planning *with* the pattern rather than fighting it every time it
recurs.

- **Weekend dessert pattern:** detected when dessert-like foods appear on
  more than half of observed weekend days, while appearing on well under
  a quarter of weekday days (at least 3 weekend occurrences required).
  Response: build a planned weekend treat into the week's targets instead
  of treating each one as an exception.
- **Late-night hunger pattern:** detected once late-night eating (at or
  after roughly 9pm) has recurred on at least 3 of the observed days.
  Response: suggest more protein or volume at dinner, or a small planned
  evening snack, rather than treating each occurrence as a lapse.
- **Skipped-workout day pattern:** detected when one specific day of the
  week is skipped (zero workout minutes) on at least 3 occasions *and* on
  70% or more of all observed instances of that particular weekday.
  Response: suggest moving that day's workout elsewhere in the week, or
  planning a shorter version specifically for that day.
- **Low hydration pattern:** detected once water intake has fallen below
  50% of goal on at least 4 of the observed days. Response: suggest using
  larger quick-add amounts to close the gap with less effort, framing it
  as a logging-friction problem rather than a habit problem.
- **Stress-eating pattern (proxy):** detected when a night with under 6
  hours of sleep is reliably followed by a day where calorie intake
  overshoots the goal by 15% or more, recurring at least 3 times.
  Response: plan a higher-protein breakfast in advance specifically for
  low-sleep days, framed around the physiological hunger-hormone effect
  of poor sleep, not a discipline failure.

---

## 7. Conflict Resolution Between Domains

When two domains would otherwise offer guidance that pulls in different
directions, the following overrides apply. In every case, the guardrail
or higher-priority domain wins; the overridden domain's guidance is
withheld for that day rather than shown alongside the conflicting advice.

| Situation | Overriding domain | Overridden domain | Why |
|---|---|---|---|
| A migraine was logged in the last 2 days | Migraine | Exercise | Recommending intense exercise on an active migraine day directly conflicts with the migraine-care recommendation to favor rest/gentle movement. |
| The active calorie goal is more than 25% below estimated maintenance | Thyroid | Nutrition | Nutrition's protein-first push (which implicitly reinforces sticking to intake targets) conflicts with the Thyroid guardrail's recommendation to ease off an aggressive deficit. |

Beyond overrides, guidance is also **ranked and limited** each time the
coach speaks:

- Every insight carries a **priority** (critical, high, medium, or low)
  and an **urgency** (now, soon, or none), both decided by the rule that
  produced it.
- The coach surfaces at most **5 pieces of guidance at a time**,
  highest-priority first, breaking ties by urgency. Lower-priority
  observations that don't make the cut are simply not mentioned that day
  — the coach does not attempt to say everything it noticed.

---

## 8. Personalization

The coach adapts to each person along these axes, all sourced from the
person's own data rather than assumed:

- **Personal daily goals** (calories, protein, water, workout minutes,
  sleep hours) override the defaults in §2.2 wherever the person has set
  their own.
- **Commute schedule** (leave-home time, arrive-home time) shapes when
  Workday-domain suggestions are offered.
- **Office-provided lunch** status changes how the Nutrition and Workday
  domains frame lunch-related guidance.
- **Body profile data** (weight, height, sex, age where available) feeds
  the maintenance-calorie estimate used only by the Thyroid guardrail —
  this estimate is never shown to the person directly, only used to judge
  whether a deficit is aggressive.
- **Cycle history**, where logged, drives the Menstrual domain's
  phase-aware guidance; where not logged, that guidance is silent rather
  than guessed at.
- **Symptom notes**, where logged, drive both the Migraine and Thyroid
  domains' awareness rules; where not logged, those rules stay silent.
- **Long-term motivations**, where the person has provided them, are
  rotated through per §6.5; if none have been provided, the WHY domain
  contributes nothing.
- **Recent workout history** determines whether HIIT is offered as an
  option (§6.3) — this adapts per person based on their own recent
  choices, not a fixed rule for everyone.
- **Recurring personal patterns** (§6.10) are, by definition, unique to
  each person's own logged history — no two people will trigger the same
  adaptive-learning insights unless their logged behavior genuinely
  matches.

---

## 9. Evidence-Based Principles Reflected in the Rules

The rules above are grounded in generally accepted, non-controversial
health-coaching principles, applied mechanically rather than left to
interpretation:

- Protein and fiber-forward eating supports satiety and lean mass
  retention during a calorie deficit (§6.2, §6.7).
- Long, irregular gaps between meals are a recognized migraine trigger
  and tend to degrade food choices later in the day (§6.2, §6.6).
- Weight fluctuates day to day due to water, food volume, and hormonal
  factors; trend-based judgment over a week is more reliable than any
  single day's number (§2.3, §6.4, §6.7).
- Sleep deprivation measurably increases next-day hunger and appetite
  hormones, independent of willpower (§6.10).
- Very large, sustained calorie deficits are associated with worse
  long-term adherence and are treated as a risk factor regardless of the
  reason someone is dieting (§6.8).
- Exercise adherence (showing up consistently, even briefly) predicts
  long-term outcomes better than the intensity of any single session
  (§6.3).
- Hormonal fluctuations across the menstrual cycle affect appetite,
  energy, and water retention in well-documented, cyclical ways that
  are not a discipline issue (§6.7).
- Self-monitoring (the act of logging) is one of the most consistently
  supported predictors of successful behavior change (§6.1).

---

## 10. Explicitly NOT Implemented / Placeholders

The following are named in the coach's design intent but are **not**
active rules today. They're listed here so the source of truth is
unambiguous about what exists versus what's planned.

- **No actual step-count tracking or step-based coaching.** A steps goal
  exists as a stored preference, but no rule in any domain currently
  reads or reacts to step data.
- **No image-based food or symptom recognition.** All coaching decisions
  are based on structured, manually logged data (numbers, timestamps,
  short text) — nothing is inferred from a meal photo or any other image
  the person may have attached to a log entry.
- **No true clinical diagnosis of thyroid conditions, migraines, or any
  other condition.** The Thyroid and Migraine domains work entirely from
  keyword matches against the person's own free-text notes and never
  claim or imply a diagnosis.
- **No dedicated symptom-tracking data entry.** Migraine and thyroid
  symptom awareness both depend on symptom notes attached to cycle
  entries, since there is no purpose-built symptom log yet — this is
  acknowledged as a workaround, not a first-class feature.
- **No real-time or push-notification delivery of coaching guidance.**
  All rules describe *what* the coach would say and *how urgently*, but
  no delivery mechanism (notification, scheduled check-in, etc.) is
  wired to actually reach the person yet.
- **No conversational / chatbot follow-up.** The coach produces a
  one-directional summary of guidance; it does not yet support the person
  asking a follow-up question and getting a rule-grounded answer back.
- **No adjustment of stored daily goals by the coach itself.** Even when,
  for example, the Thyroid domain recommends a more moderate calorie
  deficit, the coach only *recommends* the change — no rule automatically
  edits the person's stored goal.
- **No multi-person or family-plan coaching logic.** Every rule is
  written for a single person's own data; there's no concept of shared or
  comparative coaching.
- **No language other than English.** No localization or translation
  logic exists in any coaching rule yet.
- **No configurable coaching aggressiveness or personality setting.**
  Tone is decided per-rule (§1, §7) but there's no user-facing setting to
  make the coach generally gentler, firmer, or more clinical across the
  board.
- **Alternate language-generation providers are not yet functional.**
  The coaching *rules* in this document are fully provider-independent by
  design, but today only one language-generation provider is actually
  wired up to speak them; the others are recognized as valid future
  options, not active today.

---

*This document should be updated whenever a rule, threshold, or domain
listed above changes — treat any change to coaching behavior as
incomplete until this file reflects it.*
