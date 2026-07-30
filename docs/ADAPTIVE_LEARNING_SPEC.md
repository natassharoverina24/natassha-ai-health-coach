# Transparent Adaptive Learning

## Purpose

This module surfaces conservative, deterministic observations from existing
user-owned logs. It helps the user notice repeated logging patterns without
diagnosing a condition, changing a target, or silently changing a plan.

## Boundaries

- The Decision Engine remains the only source of coaching decisions.
- Adaptive observations do not add, remove, rank, or mutate retained insights.
- Suggestions are optional review prompts and are never applied automatically.
- No LLM, external ML provider, paid API, diagnosis, medical claim, or invented
  nutrition value is used.
- Missing or unavailable data suppresses the affected observation.
- Accept and dismiss are UI-only in this phase; they do not persist or alter
  coaching rules.

## Deterministic rules

The default rolling window is 14 days. A pattern needs at least seven
meaningfully observed days and at least three occurrences. Low-water detection
requires four occurrences. Breakfast absence is evaluated only on days with at
least three confirmed meal slots. Low protein is evaluated only on days with
all four confirmed meal slots. Water is evaluated only on days with water
entries. A migraine-related observation requires at least three user-declared
disruptions in 28 days and is explicitly phrased as planning support, not a
diagnosis.

At most three observations are shown. Ordering is deterministic by evidence
ratio, then fixed pattern order. Every observation includes evidence counts,
window dates, and source IDs.

## Non-goals

The module does not infer why a log is absent, predict symptoms, alter thyroid
or migraine rules, adjust calorie or protein targets, or apply planner changes.
