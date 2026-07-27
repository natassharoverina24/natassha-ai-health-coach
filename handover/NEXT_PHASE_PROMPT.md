# NEXT PHASE PROMPT

Paste the following into a brand-new Claude conversation to continue implementation immediately.

---

```
Continue the Natassha AI Health Coach project at /home/claude/natassha-health/.

Before doing anything, read these handover documents in order:
1. handover/PROJECT_STATUS.md (current status)
2. handover/PROJECT_CONTINUATION.md (architecture, APIs, conventions)
3. handover/IMPLEMENTATION_STATE.md (every completed phase in detail)

Then read the frozen specification:
4. docs/AI_PLANNING_SPEC.md §4 (Office Lunch Optimizer business rules)

Implement Phase 6C: Office Lunch Optimizer.

Requirements:
- Create src/lib/planner/officeLunchOptimizer.ts
- It must be a pure function: no React, no Firestore, no API calls, no side effects.
- It consumes CoachDecision + PlannerUserContext + a remaining calorie/protein budget for the day.
- For each of the 11 office-lunch items defined in OFFICE_LUNCH_ITEMS (src/lib/utils/nutritionEstimates.ts), produce exactly one action: Eat, Reduce, Skip, or Add.
- Each recommendation must include a one-sentence reason grounded in an actual target or active insight.
- Follow the constraint priority ordering from AI_PLANNING_SPEC.md §3.3:
  Priority 1: Thyroid safety
  Priority 2: Migraine requirements
  Priority 3: Menstrual/PMS adjustments
  Priority 4: Daily calorie/protein targets
  Priority 5: Practical constraints
- Reuse detectActiveConstraints() already exported from src/lib/planner/mealPlanner.ts.
- Do NOT modify any existing engine, the Decision Engine, the Response Layer, or any frozen document.
- Do NOT modify any existing planner file (dailyPlanner.ts, mealPlanner.ts, mealTemplates.ts, plannerHelpers.ts, plannerTypes.ts).
- Export the new module from src/lib/planner/index.ts.
- Add comprehensive tests in tests/unit/planner/officeLunchOptimizer.test.ts covering: normal day (all Eat), Thyroid active (skip Sweet Drink), Migraine active (no skip that creates a meal gap), PMS active (Add protein), protein priority, mixed recommendations.
- Run: ESLint (zero warnings), TypeScript (zero errors), full Jest suite (zero regressions), production build (succeeds).
- Stop after Phase 6C is complete. Do not continue into Phase 6D.
- After completion, produce a summary with: Completed, Verification, Remaining, Known Limitations.
```
