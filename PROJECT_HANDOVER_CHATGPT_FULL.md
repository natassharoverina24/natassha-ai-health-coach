# PROJECT_HANDOVER_CHATGPT_FULL

## Project

Natassha AI Health Coach

### Goal

Production-grade deterministic AI health coach for a single user
(Natassha). The LLM never decides; it only rewrites structured
decisions.

## Technology

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Firebase Auth / Firestore / Storage / Messaging
- PWA
- Jest + Testing Library

## Core Architecture

User Data → Repository Layer → Context Builder → 10 Deterministic
Engines → Decision Engine → Planning Layer → Response Layer → AI
Provider → Claude API

### 10 Engines

1. Behavior
2. Nutrition
3. Exercise
4. Maintenance
5. WHY
6. Migraine
7. Menstrual
8. Thyroid
9. Workday
10. Adaptive Learning

Decision Engine is the single source of truth.

## Current Status

Phases 1–7 are implemented. Phase 8 production hardening is implemented in
the current working copy, with deployment intentionally blocked pending the
manual prerequisites in `docs/DEPLOYMENT_READINESS.md`.

## Completed Phases

### Phase 1

Foundation, Clean Architecture, Firebase, PWA.

### Phase 2

Meal tracking, water tracking, meal history, food photos, dashboard.

### Phase 3

All deterministic AI engines, Context Builder, Decision Engine, Response
Layer.

### Phase 4

AI Coach UI and Daily Coaching Experience.

### Phase 5

Planning specification completed and frozen.

### Phase 6A

Daily Planner.

### Phase 6B

Meal Planner with approved meal templates and constraint priorities.

### Phase 6C

Office Lunch Optimizer, implemented and verified.

Verification:

- TypeScript: PASS
- ESLint: PASS
- Tests: 414/414 PASS
- Production build: PASS

## Phases 6D–7

- Phase 6D: Energy Calculator implemented.
- Phase 6E: Weekly Meal Prep implemented with injected approved ingredients.
- Phase 6F: Emergency Planner implemented.
- Phase 6G: Adaptive Adjustments implemented.
- Phase 7: Dashboard UI integration implemented.

The GoFood Planner is cancelled and out of scope. Meals purchased through
GoFood use the existing meal logging flow with existing estimates, photos,
and manual corrections. Do not remove or redesign existing meal logging,
and do not implement GoFood-specific code.

## Remaining Roadmap

Phase 8 manual readiness work only:

1. Approve and test the documented Firestore ownership-rule correction.
2. Configure production and CI Firebase values.
3. Obtain a green CI run for the exact release commit.
4. Complete the authenticated smoke-test checklist.

## Frozen Documents

- AI_COACH_SPEC.md
- USER_PROFILE.md
- AI_PLANNING_SPEC.md
- AI_COACH_ARCHITECTURE.md
- ARCHITECTURE.md

Do not redesign them without strong technical justification.

## Critical Rules

- Decision Engine owns coaching decisions.
- Planning Layer only operationalizes decisions.
- Response Layer only rewrites.
- LLM never invents facts.
- Meal Planner only uses approved templates.
- Blood type excluded.
- Thyroid safety always highest priority.
- Consistency over perfection.
- Never recommend supplements or medication.

## ChatGPT Responsibilities

- System Architect
- Technical Reviewer
- Business Rule Reviewer
- QA Reviewer
- Prompt Engineer
- Claude output reviewer

## Claude Responsibilities

- Implement code
- Write tests
- Run TypeScript
- Run ESLint
- Run production build

## Review Checklist

Always check:

- Clean Architecture
- SOLID
- Scalability
- Test coverage
- Duplicate logic
- Business-rule consistency
- Performance
- Security
- Future maintainability

## Current Objective

Resolve the explicit deployment blockers without changing completed coaching
or planning behavior.
