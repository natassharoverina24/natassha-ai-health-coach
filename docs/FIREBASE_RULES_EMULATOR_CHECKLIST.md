# Firebase Rules Emulator Checklist

Use this checklist with the Firebase Emulator Suite before deploying active
Firestore rules. Do not use production data or credentials. Meal-photo
Firebase Storage deployment is inactive: meal images are analyzed
ephemerally, never persisted, and do not require Firebase Storage.

## Setup

1. Install or invoke an approved Firebase CLI version outside the application
   dependency tree and confirm that Java is available.
2. Start the Authentication, Firestore, Storage, and Emulator UI services
   against the local-only demo project:

   ```text
   npm run emulator:rules
   ```

   This command always supplies
   `--project demo-natassha-health-coach`; it does not require credentials or
   select a production Firebase project.

3. Confirm these localhost endpoints:

   | Service | Endpoint |
   |---|---|
   | Emulator UI | `http://127.0.0.1:4000` |
   | Firestore | `127.0.0.1:8080` |
   | Authentication | `127.0.0.1:9099` |
   | Storage | `127.0.0.1:9199` |

4. Use two synthetic Authentication emulator users (`owner-user` and
   `other-user`) plus an unauthenticated client. Clear emulator data between
   cases where existing state would affect the result.

5. Use the Emulator UI Rules evaluation tools and local SDK clients connected
   only to the endpoints above to execute every case below. Record each case
   as PASS, FAIL, or BLOCKED.

## Firestore

Run the cases against one auto-ID collection carrying `userId` (for example,
`meals`) and repeat the ownership checks for each applicable collection before
release.

| Case | Operation | Expected |
|---|---|---|
| Matching owner create | `owner-user` creates a document with `userId: "owner-user"` | Allow |
| Other-owner create | `owner-user` creates a document with `userId: "other-user"` | Deny |
| Owner update | `owner-user` updates owned data while preserving `userId` | Allow |
| Ownership mutation | `owner-user` changes `userId` to `"other-user"` | Deny |
| Other-user read | `other-user` reads the owner document | Deny |
| Other-user update | `other-user` updates the owner document | Deny |
| Other-user delete | `other-user` deletes the owner document | Deny |
| Unauthenticated access | Unauthenticated client creates, reads, updates, or deletes | Deny |

Also confirm `users/{uid}` and `settings/{uid}` remain accessible only when the
path uid equals the authenticated uid, `reports` remains client-read-only, and
`ai_logs` remains append-only.

## Storage

These cases validate rollback rules only. Do not deploy Storage for the active
meal-photo flow and do not interpret a passing result as authorization to
restore persistent photo uploads.

Use paths shaped exactly like the application builders:
`users/{uid}/meal_photos/{fileName}` and
`users/{uid}/reports/{fileName}`.

| Case | Operation | Expected |
|---|---|---|
| Owner image upload | `owner-user` uploads an `image/*` object smaller than 10 MiB to its meal-photo path | Allow |
| Non-image upload | `owner-user` uploads a non-image object to its meal-photo path | Deny |
| Oversized image | `owner-user` uploads an image larger than 10 MiB to its meal-photo path | Deny |
| Unauthenticated upload | Unauthenticated client uploads to a meal-photo path | Deny |
| Cross-user overwrite | `other-user` overwrites `owner-user`'s meal-photo object | Deny |
| Owner report access | `owner-user` reads or writes its report path | Allow |
| Cross-user report access | `other-user` reads or writes `owner-user`'s report path | Deny |
| Unknown user path | Any user reads or writes an unrecognized path below `users/{uid}` | Deny |

Record the emulator version, rules-file hashes, date, tester, and pass/fail
result with the release evidence.
