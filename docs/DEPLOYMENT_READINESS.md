# Deployment Readiness

This Phase 8 checklist does not authorize a deployment, user-account creation,
or changes to deterministic coaching and planning rules.

## Environment variables

Production builds fail with a field-specific error when any required Firebase
Web SDK variable is absent. Development and tests may use the explicit
non-functional placeholder configuration.

| Variable | Classification | Exposure | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Required | Client-visible | Firebase SDK and server token verification |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Required | Client-visible | Authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Required | Client-visible | Firebase project identity |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Required | Client-visible | Firebase app configuration |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Required | Client-visible | Firebase web-app identity |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Optional, inactive | Client-visible | Rollback-only Storage configuration; unused at runtime |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional | Client-visible | Analytics, when enabled |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Optional | Client-visible | Push messaging, when enabled |
| `GEMINI_API_KEY` | Feature-required | Server secret | Gemini Developer API Free Tier meal-photo and text nutrition estimation |
| `GEMINI_MODEL` | Optional | Server configuration | Free Tier multimodal model override |
| `GROQ_API_KEY` | Optional | Server secret | Groq free-plan fallback for text nutrition estimation |
| `OPENROUTER_API_KEY` | Optional | Server secret | OpenRouter `openrouter/free` fallback for text nutrition estimation |
| `ANTHROPIC_API_KEY` | Optional | Server secret | Unrelated on-demand Response Layer rewriting |
| `ANTHROPIC_MODEL` | Optional | Server configuration | Unrelated response-model override |

`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, and
`ANTHROPIC_API_KEY` must never use a `NEXT_PUBLIC_` prefix. Firebase Web SDK
values are intentionally client-visible; security rules enforce data access.

## Free text nutrition estimation

- Text nutrition uses this fixed fallback order: bundled approved food data,
  the user's previously confirmed matching meals, Gemini Free Tier, Groq free
  plan, OpenRouter `openrouter/free`, then editable manual entry.
- Gemini defaults to `gemini-3.5-flash-lite`, Groq defaults to
  `llama-3.1-8b-instant`, and OpenRouter is fixed to `openrouter/free`.
  There is no paid-model fallback or automatic upgrade.
- Configure only Gemini Free Tier, Groq Free Tier, and OpenRouter free-model
  credentials without billing or automatic top-up. The application cannot
  change an account's provider billing tier.
- Each server provider has an eight-second timeout and a process-local limit
  of ten requests per authenticated user per hour. These safeguards reset when
  a server instance restarts.
- Only food name, quantity, and portion are sent. User name, email, health
  history, and other profile data are never included.
- Free providers may process or retain submitted text under their own data-use
  terms, so food fields must not contain personal or sensitive information.
- Provider output is schema-validated and remains editable. Provider/model
  provenance is stored only after the user confirms the meal values.
- Free-tier quota and model availability can change. Check the current
  [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing),
  [Groq free-plan limits](https://console.groq.com/docs/rate-limits), and
  [OpenRouter free router](https://openrouter.ai/openrouter/free) before
  deployment. Bundled local data and manual nutrition entry remain available
  without any AI provider.

## Free Tier photo analysis

- Meal-photo analysis uses the Gemini Developer API with
  `gemini-3.5-flash-lite` by default and permits a model change only through
  `GEMINI_MODEL`.
- No billing account, paid-tier fallback, retry, Files API upload, or alternate
  provider is configured.
- Gemini Free Tier submissions may be used by Google to improve its products.
  The UI therefore instructs users to upload food only and exclude faces,
  documents, addresses, and other sensitive information.
- One authenticated request makes at most one Gemini request.
- A process-local limiter permits five requests per authenticated uid per
  rolling hour. The sixth is rejected before Gemini. This basic free safeguard
  resets whenever the server instance restarts and is not a distributed quota.
- Gemini HTTP 429 responses are returned as a sanitized 429 without retry.

## Firebase setup

1. Create the Firebase project and web app.
2. Enable Google Authentication.
3. Add the deployment domain under Authentication **Authorized domains**.
4. Create Firestore in production mode. Firebase Storage is not required.
5. Configure the five required Firebase variables in the host and GitHub
   Actions.
6. Complete the Firestore portion of the Firebase Rules Emulator checklist
   before deploying rules.
7. After approval, deploy with:

   ```text
   firebase deploy --only firestore:rules,firestore:indexes
   ```

8. Restrict the Firebase Web API key to intended APIs and production origins
   without blocking Firebase Authentication.

## CI expectations

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests:

1. `npm ci`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `npm test -- --coverage=false --runInBand`
5. `npm run build`

The five required Firebase values must be configured for GitHub Actions or the
production build fails intentionally. CI must be green for the release commit.

## Dependency review

Read-only audits performed for the Phase 8 lockfile:

- Production dependencies (`npm audit --omit=dev`): 0 known vulnerabilities.
- Full dependency tree (`npm audit`): 0 known vulnerabilities.
- Production-critical findings: none reported.
- Development-only findings: none reported.
- Deferred advisory findings: none reported.

No dependency versions were changed and no audit-fix command was run.

## Security boundaries

- Browser code receives only `NEXT_PUBLIC_*` Firebase configuration.
- `ANTHROPIC_API_KEY` is read only inside the unrelated coach response route.
- `GEMINI_API_KEY` is read only inside server AI routes.
- `GROQ_API_KEY` and `OPENROUTER_API_KEY` are read only inside the server text
  nutrition route.
- `/api/ai/coach` requires and verifies a Firebase ID token.
- `/api/ai/meal-photo` verifies a Firebase ID token, accepts only JPEG, PNG, or
  WebP multipart images, rejects requests over 4 MiB, and keeps image bytes in
  request memory only.
- Meal photos are compressed in the browser, previewed only with a temporary
  object URL, and never written to Storage, Firestore, browser storage, logs,
  or analytics.
- Only explicitly confirmed and editable food name, portion, calorie, and
  protein values plus minimal provenance are written to the existing meal.
- The API rejects oversized/malformed requests and does not relay upstream
  response bodies or exception details.
- Pages and components use repositories; Firebase SDK access remains isolated
  under `src/lib/firebase`.
- The API transports Response Layer text only; it creates no coaching decision.

## Authenticated smoke-test checklist

Use a dedicated, pre-approved test account. Never store access information in
Git.

- Sign in through Google and reach `/dashboard`.
- Confirm daily targets and all six schedule entries.
- Confirm four approved meals with serving, calories, protein, and reasons.
- Confirm retained risks, wins, and action items.
- Exercise Energy, Office Lunch, Weekly Prep unavailable-data, Emergency, and
  Adaptive UI states.
- Refresh `/dashboard`; confirm session and data remain available.
- Confirm unauthenticated page access redirects to `/login`.
- Confirm unauthenticated `/api/ai/coach` returns `401`.
- Confirm unauthenticated `/api/ai/meal-photo` returns `401`.
- Confirm unauthenticated `/api/ai/meal-nutrition` returns `401`.
- Add a known bundled food and confirm no AI provider request occurs.
- Add a previously confirmed food with the same quantity and confirm the
  cached values appear without an AI request.
- Simulate Gemini 429, invalid Gemini output, and Groq failure; confirm fallback
  reaches Groq and then `openrouter/free` without exposing provider details.
- Disable or exhaust every text provider; confirm editable manual nutrition
  remains available and the unresolved item is excluded from totals.
- Select JPEG, PNG, and WebP meal images; confirm each is locally previewed and
  returns visibly uncertain, editable estimates.
- Confirm the food-only privacy warning appears before selection.
- Confirm five analyses succeed for one user within the available Gemini Free
  Tier quota, the sixth is rejected locally without a provider call, and a
  different authenticated user has an independent allowance.
- Confirm a simulated/provider 429 produces the sanitized free-quota message
  without a retry or provider fallback.
- Confirm GIF/PDF input and a compressed request over 4 MiB are rejected.
- Correct every estimate field, confirm it explicitly, and verify only the
  corrected structured values and `photo-estimate` provenance appear in the
  meal document.
- Close the meal without confirming and verify no estimate or image metadata is
  persisted.
- Verify no `meal_photos` document, Storage object, download URL, base64 value,
  or provider payload is created.
- Confirm no console/server errors, secret values, or permission errors.

## Rollback checklist

1. Record the current application release and Firebase rules versions.
2. Retain the prior known-good application artifact or host release.
3. Restore the prior application release if smoke tests fail.
4. Restore the prior rules version independently if an approved rules update
   causes access failures.
5. Repeat authentication, dashboard refresh, Firestore, and Storage checks.
6. Record the failed release, observed error, and rollback result.

## Deployment blockers

1. **Rules verification:** run the active Firestore cases in
   `docs/FIREBASE_RULES_EMULATOR_CHECKLIST.md` and record passing results
   before deployment. Meal-photo Storage rules are retained but inactive.
2. **Production configuration:** real Firebase values must be configured in
   the host and CI; placeholders are rejected in production.
3. **Release evidence:** the release commit needs green CI and an authenticated
   smoke test.
4. **Weekly ingredient data:** no approved production ingredient catalogue is
   supplied. The UI fails safely, but shopping output remains unavailable.
