# Architecture

This document describes how the codebase is organized, why it's organized
that way, and — since the AI Coach isn't built yet — exactly where it plugs
in when it is.

## Guiding principle: Clean Architecture layering

Every feature is built in the same direction, and each layer only knows
about the one below it:

```
Pages (src/app)
   ↓ uses
Feature components (src/components/dashboard, forms, layout)
   ↓ uses
Hooks (src/hooks) ─── Contexts (src/contexts)
   ↓ uses
Repositories (src/lib/db) ─── AI layer (src/lib/ai, not implemented)
   ↓ uses
Firebase SDK wrapper (src/lib/firebase)
   ↓ uses
Firebase (Auth / Firestore / Storage / Messaging)
```

A page never imports `firebase/firestore` directly, and a repository never
imports React. That seam is what makes it possible to swap Firestore for
another database later, or to unit-test business logic without a real
Firebase project (see `tests/unit/syncQueue.test.ts` for an example of
testing a `src/lib` module in complete isolation).

## Directory map

```
src/
├── app/                        Routes (Next.js App Router)
│   ├── layout.tsx              Root layout: providers, PWA metadata
│   ├── page.tsx                "/" — redirects to /dashboard or /login
│   ├── globals.css             Design tokens (see "Design system" below)
│   ├── (auth)/
│   │   └── login/page.tsx      Google sign-in screen
│   └── (app)/                  Route group behind the auth guard
│       ├── layout.tsx          Auth guard + AppShell wrapper
│       ├── dashboard/page.tsx
│       ├── weight/page.tsx
│       ├── meal/page.tsx
│       ├── progress/page.tsx
│       ├── shopping/page.tsx
│       ├── supplements/page.tsx
│       ├── reports/page.tsx
│       └── settings/page.tsx
│
├── components/
│   ├── ui/                     Design-system primitives (Button, GlassCard,
│   │                           Input, Modal, Badge, ProgressBar, ...) —
│   │                           no app-specific logic, reusable anywhere
│   ├── layout/                 Sidebar, BottomNav, TopBar, AppShell,
│   │                           PageHeader
│   ├── dashboard/               StatCard, GreetingHeader, WeeklyProgressCard,
│   │                           HealthRingsCard — dashboard-specific
│   │                           composites built from ui/ primitives
│   ├── charts/                 HealthRings (signature concentric-ring
│   │                           visual) and TrendLineChart (recharts wrapper)
│   ├── forms/                  WeightEntryForm, MealEntryForm — controlled
│   │                           forms used inside page-level modals
│   └── ServiceWorkerRegistration.tsx
│
├── contexts/
│   ├── AuthContext.tsx         Firebase Auth state + the user's profile doc
│   └── ThemeContext.tsx        light/dark/system, persisted to localStorage
│
├── hooks/
│   ├── useFirestoreCollection.ts   Subscribe to a repository query
│   ├── useFirestoreDoc.ts          Subscribe to a single document
│   ├── useOnlineStatus.ts          navigator.onLine, via useSyncExternalStore
│   ├── useMediaQuery.ts            Responsive breakpoint queries
│   └── useStable.ts                Internal: caller-deps memoization helper
│                                   (see inline doc comment for why it
│                                   exists instead of useCallback/useMemo)
│
├── lib/
│   ├── firebase/                The ONLY layer allowed to import the
│   │   ├── config.ts            Firebase SDK. Everything else goes through
│   │   ├── auth.ts              this.
│   │   ├── firestore.ts
│   │   ├── storage.ts
│   │   └── messaging.ts
│   ├── db/                      One repository per Firestore collection —
│   │   ├── baseRepository.ts    see "Firestore collections" below
│   │   ├── users.repository.ts
│   │   ├── weights.repository.ts
│   │   ├── waists.repository.ts
│   │   ├── meals.repository.ts
│   │   ├── mealPhotos.repository.ts
│   │   ├── supplements.repository.ts  (also exports supplementLogsRepository)
│   │   ├── shopping.repository.ts
│   │   ├── reports.repository.ts
│   │   ├── cycles.repository.ts
│   │   ├── settings.repository.ts
│   │   └── aiLogs.repository.ts
│   ├── ai/                      AI Provider Layer — scaffolded, not
│   │   ├── contextBuilder.ts    implemented. See "AI layer" below.
│   │   └── aiClient.ts
│   ├── offline/
│   │   └── syncQueue.ts         Custom retry queue for Storage uploads made
│   │                           while offline (Firestore has its own queue
│   │                           built in — see "Offline support" below)
│   └── utils/
│       ├── cn.ts                Tailwind class merging
│       ├── format.ts            Pure formatting helpers (unit-tested)
│       └── constants.ts         NAV_ITEMS, DEFAULT_GOALS, DEFAULT_USER_PROFILE
│
└── types/
    └── firestore.ts             Single source of truth for every document
                                  shape — plain TypeScript, no SDK imports
```

Supporting files at the project root: `firestore.rules`, `storage.rules`,
`firestore.indexes.json`, `firebase.json` (security + deployment config),
`public/manifest.json` + `public/sw.js` (PWA), `scripts/generate-icons.py`
(icon generation), `jest.config.ts` + `tests/` (testing).

## Firestore collections

Every collection is defined once in `src/types/firestore.ts` and the
`COLLECTIONS` constant there is the only place collection name strings are
written — repositories reference `COLLECTIONS.weights`, never the literal
`"weights"`, so a rename never becomes a silent runtime bug.

| Collection | Doc ID | Purpose |
|---|---|---|
| `users` | `= uid` | Profile: name, height, start/goal weight, commute times, office-lunch flag. One doc per user, created automatically on first sign-in via `usersRepository.ensureProfile()`. |
| `weights` | auto | Time-series of weigh-ins (`weightKg`, optional body fat %, note). |
| `waists` | auto | Time-series of body measurements (waist/hip/chest cm). |
| `meals` | auto | Logged meals with a `MealMacro` breakdown (calories/protein/carbs/fat/fiber), `isOfficeLunch` flag, and a `photoIds` array pointing into `meal_photos`. |
| `meal_photos` | auto | Metadata for uploaded meal photos (the binary lives in Storage under `users/{uid}/meal_photos/...`); `aiAnalyzed` flags rows still waiting on the AI layer. |
| `supplements` | auto | Supplement *definitions* (name, dosage, frequency, active flag). |
| `supplement_logs` | auto | Daily taken/not-taken checkmarks against a `supplements` doc. Kept as a separate collection from `supplements` so history isn't lost when a supplement is deactivated. |
| `shopping` | auto | Grocery list items, categorized, with a `checked` flag and an `addedFrom` provenance field (`manual` / `ai-suggestion` / `recurring`) for when the AI layer starts suggesting items. |
| `reports` | auto | Generated weekly/monthly summaries. **Client-writable: never** — `firestore.rules` allows `read` only; `create/update/delete` are `false`, because reports are meant to come from a trusted backend/Cloud Function once report generation is implemented. |
| `cycles` | auto | Menstrual/hormonal cycle entries — reserved for future coaching logic that adjusts targets across cycle phases. Not surfaced in any page yet. |
| `settings` | `= uid` | Per-user preferences: theme, unit system, notification toggles, daily goals (calories/protein/water/steps), FCM tokens. |
| `ai_logs` | auto | Append-only conversation/event log for the AI Coach. `firestore.rules` allows `create` + `read`, never `update`/`delete` — a log is a log. |

All collections carry `userId` (or use the uid as the document id) and
`firestore.rules` enforces per-user isolation on every one of them — see
the file for the exact rule per collection. `firestore.indexes.json` has
the composite indexes the repository layer's queries actually need
(`userId` + a sort field), generated by reading every `.list()`/`.subscribe()`
call in `src/lib/db`.

### Repository pattern

`src/lib/db/baseRepository.ts` exports `createRepository<T>(collectionName)`,
which returns `get`, `list`, `create`, `update`, `remove`, `subscribe`, and
`subscribeOne` — all typed against `T`. Each collection's repository file
wraps that generic base with collection-specific query helpers (e.g.
`weightsRepository.listForUser(userId, take)` builds the
`where("userId", "==", userId) + orderBy("date", "desc") + limit(take)`
query so no page ever hand-writes a Firestore query directly).

## AI Provider Layer (`src/lib/ai/`) — scaffolded, not implemented

Two files exist to establish the interface future work will fill in:

- **`aiClient.ts`** — the `AIClient` interface (`send(messages): Promise<string>`)
  that will eventually wrap calls to the model provider. Nothing else in
  the app imports a provider SDK directly; everything goes through this
  interface so the provider can change without touching call sites.
- **`contextBuilder.ts`** — `buildAICoachContext(userId)`, typed to return
  an `AICoachContext` (`profile` + recent `weights`/`meals`/`supplementLogs`
  + `generatedAt`). This is the function that will assemble what gets
  handed to the AI Coach before every turn, sourced entirely from the
  repository layer already built.

Both currently `throw new Error(...)` on call — they exist so the *shape*
of the integration is locked in and reviewable now, without any AI
coaching logic actually running. When this is implemented, `ai_logs`
(append-only) is where the conversation gets persisted, and
`meal_photos.aiAnalyzed` / `shopping.addedFrom === "ai-suggestion"` /
`reports.generatedBy === "ai"` are the fields already in place for the AI
layer to write into other collections.

## Design system

Tokens live in `src/app/globals.css` as CSS custom properties (Tailwind v4's
`@theme inline` block), not in a `tailwind.config.js` — this is the
"Soft Pink / Apple Health" theme: rose/petal/teal/amber palette, glass
surfaces (`.glass` utility class — frosted background + blur), and full
light/dark variants driven by `data-theme` on `<html>`. The signature visual
is `HealthRings` (`src/components/charts/HealthRings.tsx`): hand-built SVG
concentric progress rings, no chart library, echoing Apple Health's
activity rings for the dashboard's daily-metrics summary.

## Authentication flow

`src/contexts/AuthContext.tsx` wraps `onAuthStateChanged` from
`src/lib/firebase/auth.ts`. On sign-in, it calls
`usersRepository.ensureProfile(uid, defaults)`, which reads `users/{uid}`
and creates it with `DEFAULT_USER_PROFILE` values if it doesn't exist yet —
so a new user always has a complete profile document before they ever see
the dashboard. Route protection is client-side (`src/app/(app)/layout.tsx`
checks `useAuth()` and redirects to `/login` if there's no user) rather than
Next.js middleware, because Firebase Auth state only resolves in the
browser — middleware has no access to it.

## Offline support & sync

Two independent mechanisms, each suited to what it's persisting:

1. **Firestore reads/writes** — handled entirely by the Firestore SDK's
   own `persistentLocalCache` (enabled in `src/lib/firebase/config.ts`,
   with `persistentMultipleTabManager` for multi-tab consistency). Writes
   made offline are queued by the SDK and replayed automatically on
   reconnect; no custom code needed.
2. **Storage uploads** (meal photos taken with no signal) — `src/lib/offline/syncQueue.ts`
   is a small custom retry queue backed by `localStorage`, since Storage
   uploads aren't covered by Firestore's built-in offline queue.
   `useOnlineStatus()` drains it automatically when the browser reports
   connectivity again.

The service worker (`public/sw.js`) handles a third, separate concern —
caching the app shell itself so the PWA still *opens* offline — and
deliberately never intercepts Firebase network requests, leaving those
entirely to the SDK's own offline handling.

## Data-fetching hooks

`useFirestoreCollection` / `useFirestoreDoc` (`src/hooks/`) are built on
`useSyncExternalStore` rather than `useEffect` + `useState`, specifically
to give every page in `src/app/(app)/*` real-time Firestore subscriptions
without hand-rolling subscribe/unsubscribe/loading-state boilerplate in
every page component. See the doc comment in `src/hooks/useStable.ts` for
why they don't use `useCallback`/`useMemo` directly (a generic hook's
caller-supplied dependency array can't satisfy the array-literal
requirement those hooks now enforce).
