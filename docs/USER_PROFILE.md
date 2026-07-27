# User Profile: Natassha

**Status:** Permanent single source of truth describing the application's
only intended user. This document changes when Natassha's own life
changes — not when the application changes.

**What this document is not:** a technical document, an implementation
guide, a set of business rules, or a prompt template. It contains no code
and no system logic. See `AI_COACH_SPEC.md` for how the coach behaves and
`ARCHITECTURE.md` / `AI_COACH_ARCHITECTURE.md` for how it's built. This
document only describes the person those documents are built around.

**How to read this document:** every item below is either a **confirmed
fact** (stated by Natassha or established as a fixed premise of the app)
or explicitly marked **not yet confirmed**. Nothing here is invented,
assumed, or generalized from typical users. Sections with no confirmed
information yet are left visibly empty rather than filled with plausible
guesses, so this file never silently drifts from the truth. Future
features (Meal Planner, Coach Chat, Weekly Review, Adaptive Learning,
Motivation, Notifications) should treat an empty subsection as "unknown,"
never as "assume a typical default."

---

## 1. Identity

| Field | Value |
|---|---|
| Preferred name | Natassha |
| Age / birth year | Not yet confirmed |
| Height | 155 cm |
| Starting weight | 71 kg |
| Target weight | 53 kg |
| Country | Indonesia |

---

## 2. Primary Goals

- **Fat loss** — confirmed. The gap between starting weight (71 kg) and
  target weight (53 kg) is the app's central tracked goal.
- **Long-term maintenance** — confirmed as an intended eventual phase.
  The app is explicitly designed to shift its coaching mode once goal
  weight is reached and sustained, rather than treating fat loss as the
  only mode that exists.
- These goals are driven by confirmed personal motivations — an upcoming
  wedding, feeling confident, and being able to wear clothes comfortably
  — documented in full in §9 (Long-Term Motivation).

---

## 3. Daily Routine

| Field | Value |
|---|---|
| Wake time | Around 05:00 |
| Leaves home | Around 06:30 |
| Arrives home | Around 19:00 |
| Work schedule | Office-based; commute window above is the known constraint. Further detail (days per week, remote days, etc.) not yet confirmed |
| Lunch habits | Lunch is provided by the office on workdays |
| Dinner habits | Not yet confirmed as a routine, though see §8 (Known Weaknesses) for a confirmed late-working-night pattern |
| Weekend routine | Church around 15:00, often followed by a trip to the mall |
| Church schedule | Weekends, around 15:00 |

---

## 4. Exercise Preferences

- **Home treadmill** — confirmed as the primary exercise equipment
  available; coaching is designed around treadmill/walking access rather
  than assuming gym equipment.
- **No gym** — confirmed. Exercise coaching does not assume access to a
  gym or gym-specific equipment.
- **HIIT** — confirmed as a cardio format Natassha does use, but treated
  as a secondary/optional intensity, not the default recommendation.
  Walking is the default; HIIT is offered as an alternative once it's
  been part of her own recent routine.
- **Preferred coaching intensity** — confirmed as strict/structured,
  consistent with the strictness level documented in §6 (Coaching Style).

---

## 5. Nutrition Preferences

- Favorite foods: spicy food is a confirmed preference. Matcha is a
  confirmed preferred beverage.
- Foods that tend to trigger overeating: see §8 (Known Weaknesses) for
  confirmed specifics (Mixue, fried food).
- Coffee habits: confirmed — coffee intake increases during stress.
- Matcha habits: confirmed as a liked beverage; no further detail (e.g.
  frequency) confirmed yet.
- Mixue: confirmed as a known temptation — see §8 for the weakness
  framing.
- GoFood / food-delivery habits: confirmed as a regular habit, with a
  typical order budget of around Rp 30,000.
- Budget considerations: the Rp 30,000 GoFood budget above is the only
  confirmed figure; no broader food-budget constraint has been confirmed.

Common Indonesian meal staples (rice, chicken, fish, egg, tempe, tofu,
vegetables, soup, fruit) are reflected in the app's quick-logging tools as
generally common choices for an Indonesian office-lunch context — this is
a general design convenience, distinct from the specific personal
preferences confirmed above, and should not be read as an exhaustive
statement of Natassha's own tastes.

---

## 6. Coaching Style

- **Weekly CEO Review** — confirmed as an established coaching format:
  a weekly summary covering weight/waist change and adherence across
  calories, protein, water, workout, sleep, and meal logging.
- **Sweet but very firm** — confirmed as the coaching posture: warm and
  affectionate in tone, while being direct and firm about what needs to
  change. This refines the general "positive but firm" description below
  with Natassha's own stated framing.
- **Positive but firm coaching** — confirmed as the general coaching
  posture: guidance is warm and encouraging by default, but becomes more
  direct and firm specifically when a real pattern (not a single bad day)
  is at stake — for example, a multi-day decline or a multi-day exercise
  gap.
- **Strictness level** — confirmed at 9 out of 10.
- **Coach should never shame** — confirmed as a firm boundary on the
  above: however firm the coaching gets, it must never cross into shame.
- **Coach should intervene early when adherence drops** — confirmed:
  Natassha prefers the coach to name a declining pattern as soon as it's
  real, rather than waiting.
- **Accountability style** — confirmed as gentle-first, escalating only
  when a pattern persists: a single off day is reframed as normal, while
  a sustained decline is named directly rather than left unaddressed.
  This sits alongside, not in conflict with, the early-intervention
  preference above — early intervention means naming the pattern sooner,
  not skipping the gentle-first framing.
- **Emotional adherence is stronger than knowledge** — confirmed as a
  guiding principle behind the coaching approach: Natassha responds more
  to how coaching feels than to being given more information, which is
  part of why warmth and firmness both matter more than explanation
  alone.
- **Morning greeting** — a confirmed example of the desired tone:
  "Morning Natassha cantik 🌸" — affectionate and personal, illustrating
  the "sweet but very firm" balance rather than a plain, generic
  greeting.

---

## 7. Health Awareness

**The coach does not provide medical diagnosis.** Nothing in this section
is a diagnosis, and nothing the app does should be read as one. Items
here exist solely to *personalize coaching behavior* — for example,
softening exercise intensity suggestions, adjusting how a calorie deficit
is framed, or adjusting coaching around estimated cycle phase — never to
identify, treat, or make claims about a medical condition.

The following are confirmed as known facts about Natassha:

- **Thyroid nodule awareness** — confirmed. Documented so coaching can
  stay mindful of this (e.g. avoiding aggressive calorie deficits, never
  suggesting supplements) without the app diagnosing or treating it.
- **Migraine awareness** — confirmed. Documented so coaching can adjust
  exercise and meal-timing guidance around migraine episodes.
- **Menstrual cycle awareness** — confirmed. Documented so coaching can
  adjust by estimated cycle phase (see also PMS-related cravings in §8).
- **Blood type A** — confirmed as a known fact about Natassha. Documented
  for completeness only; no dietary or coaching logic in this app is
  based on blood type.

This section should be updated the moment any new health-awareness fact
is confirmed by Natassha herself.

---

## 8. Known Weaknesses

Confirmed weaknesses, in Natassha's own terms:

- **Mixue** — a specific, known temptation (also noted in §5).
- **Fried food** — a confirmed trigger food.
- **Stress eating** — confirmed: Natassha tends to eat more when
  stressed.
- **Busy work schedule** — confirmed as a contributing factor, including
  a pattern of eating and then sleeping shortly after when work runs
  late.
- **GoFood convenience** — confirmed: the ease of ordering (see the
  ~Rp 30,000 typical order in §5) is itself part of the challenge, not
  just what's ordered.
- **Weekend temptation** — confirmed, plausibly connected to the
  weekend mall trips noted in §3.
- **PMS cravings** — confirmed: cravings for spicy food increase during
  PMS, connecting the spicy-food preference in §5 to the menstrual-cycle
  awareness in §7.

This section should continue to be filled in only from Natassha's own
described experience, not inferred from patterns common to other people.

---

## 9. Long-Term Motivation

Natassha's confirmed personal reasons for pursuing this goal — the "why"
the coach is meant to reference sparingly and meaningfully, per
`AI_COACH_SPEC.md` §6.5:

- **Wedding** — an upcoming wedding is a confirmed motivation.
- **Confidence** — feeling confident is a confirmed motivation in its own
  right, distinct from the wedding itself.
- **Feeling attractive** — confirmed as part of how Natassha wants to
  feel, day to day.
- **Not struggling to find clothes** — confirmed: being able to wear
  clothes comfortably, without the current difficulty finding things that
  fit well, is a stated motivation.

These four are related but distinct — the wedding is a specific event,
while confidence, feeling attractive, and clothing comfort are more
durable, everyday motivations that will outlast the event itself. Future
coaching should be able to draw on any one of them individually, not only
the wedding.

---

## 10. Non-Negotiables

Confirmed coaching principles that hold regardless of context:

- Never shame or guilt Natassha.
- Be sweet but very firm.
- Prioritize long-term consistency over perfection.
- Never recommend crash diets.
- Never promise medical outcomes.
- Celebrate small wins.
- Intervene early when adherence declines.
- Focus on sustainable fat loss, not rapid or extreme loss.

---

## 11. Definition of Success

Success is not defined as reaching 53 kg alone. It also includes:

- Sustainable habits.
- Confidence.
- Comfortable clothing.
- Being ready for the wedding.
- Long-term maintenance once goal weight is reached.

---

## 12. Coaching Preferences

The coach should:

- Give clear action items.
- Give daily accountability.
- Give Weekly CEO Reviews.
- Use data-driven feedback.
- Be practical.
- Intervene early.

The coach should avoid:

- Generic motivational quotes.
- Excessive praise.
- Guilt-based coaching.
- Unrealistic perfectionism.

---

*Update this document only when Natassha's own circumstances, goals,
routine, preferences, or stated motivations change. Do not update it in
response to new app features — a new coaching capability being built
does not, by itself, mean anything new is confirmed about Natassha.*
