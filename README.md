# Natassha AI Health Coach

A daily companion for weight, meals, supplements, deterministic coaching, and
planning. Phases 1–7 are implemented; Phase 8 adds production validation, CI,
API hardening, and deployment-readiness documentation.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **React 19**
- **Tailwind CSS v4** — design tokens in `src/app/globals.css`
- **Firebase**: Authentication (Google sign-in), Cloud Firestore, Storage,
  Cloud Messaging
- **PWA**: installable, offline-capable, with a custom service worker
- **Jest + Testing Library** for unit and component tests

## 1. Prerequisites

- Node.js 20+ and npm
- A Firebase project (free Spark plan is enough to start)

## 2. Install dependencies

```bash
npm install
```

## 3. Firebase project setup

### 3.1 Create the project

1. Go to the [Firebase Console](https://console.firebase.google.com/) →
   **Add project**.
2. Once created, go to **Project settings → General → Your apps** and add a
   **Web app**. Copy the `firebaseConfig` values shown — you'll need them in
   step 3.4.

### 3.2 Enable Authentication

1. **Build → Authentication → Get started**.
2. Enable the **Google** sign-in provider.
3. Under **Settings → Authorized domains**, add `localhost` (already there
   by default) and your production domain once you have one.

### 3.3 Enable Firestore and Storage

1. **Build → Firestore Database → Create database**. Start in production
   mode (the security rules in this repo lock it down correctly — see
   below).
2. **Build → Storage → Get started**. Same production-mode default.

### 3.4 Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in every `NEXT_PUBLIC_FIREBASE_*` value from step 3.1. These are safe
to expose to the browser — real access control is enforced by
`firestore.rules` / `storage.rules`, not by hiding these values.

For push notifications (optional, `NEXT_PUBLIC_FIREBASE_VAPID_KEY`): Firebase
Console → **Project settings → Cloud Messaging → Web Push certificates →
Generate key pair**.

### 3.5 Deploy security rules and indexes

Install the Firebase CLI once, then deploy the rules/indexes that ship in
this repo:

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # select your project
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

Without this step, every read/write will be rejected — the rules default
to deny-all outside a user's own data (see `firestore.rules`).

### 3.6 (Optional) Run against the local emulator suite instead

```bash
firebase emulators:start
```

This spins up local Auth/Firestore/Storage emulators (ports configured in
`firebase.json`) so you can develop without touching a real project. Point
the app at them by adding the emulator connection calls to
`src/lib/firebase/config.ts` if you go this route (not wired in by default,
since most contributors will want a real project from day one).

## 4. Generate PWA icons (already generated, only needed if you change them)

```bash
npm run generate:icons
```

Regenerates everything in `public/icons/` from `scripts/generate-icons.py`
(pure Pillow, no external image assets).

## 5. Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on
`/login`; sign in with Google to reach the dashboard. The first sign-in
creates your `users/{uid}` profile document automatically, seeded with the
defaults in `src/lib/utils/constants.ts` (155 cm height, 71 → 53 kg goal,
06:30/19:00 commute window, office lunch on).

## 6. Testing

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

## 7. Linting & type-checking

```bash
npm run lint
npx tsc --noEmit
```

Both are expected to pass with zero errors and zero warnings on `main`.

## 8. Production build

```bash
npm run build
npm start
```

Production builds require all six mandatory Firebase Web SDK variables and
fail with their exact missing names when configuration is incomplete.
Development and tests retain a non-functional placeholder and do not require
real Firebase credentials.

## 9. Deployment

This app is a standard Next.js app and isn't locked to one host:

- **Vercel** (recommended, zero config): connect the repo, add the
  `NEXT_PUBLIC_FIREBASE_*` env vars in the project settings, deploy.
- **Firebase App Hosting**: `firebase init apphosting` and follow the
  prompts — it understands Next.js's server runtime natively.

Static export is not supported because `/api/ai/coach` requires a server
runtime.

Whichever host you choose, remember to also run
`firebase deploy --only firestore:rules,firestore:indexes,storage:rules`
whenever you change `firestore.rules`, `firestore.indexes.json`, or
`storage.rules` — those don't ship with the app deploy.

Before deployment, follow
[`docs/DEPLOYMENT_READINESS.md`](./docs/DEPLOYMENT_READINESS.md). It records
the environment contract, CI expectations, authenticated smoke test, rollback
steps, and unresolved security-rules blocker.

## Project scope (Phase 1)

Implemented: architecture, responsive UI, navigation, database (all 11
collections), authentication, dashboard, reusable components, offline
support, PWA installability.

**Not implemented yet, by design:** the AI Coach itself (`src/lib/ai/`),
automatic report generation, meal-photo AI analysis, and push-notification
scheduling. These have real interfaces and storage already in place — see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for exactly where each one plugs in.
