# Firebase Rules Emulator Checklist

This repository does not include `@firebase/rules-unit-testing` or an existing
rules-test harness. Use this checklist with the Firebase Emulator Suite before
deploying `firestore.rules` or `storage.rules`. Do not use production data or
credentials.

## Setup

1. Install or invoke an approved Firebase CLI version outside the application
   dependency tree.
2. Select a non-production Firebase project alias.
3. Start the local emulators:

   ```text
   firebase emulators:start --only firestore,storage
   ```

4. Use two synthetic authenticated users (`owner-user` and `other-user`) plus
   an unauthenticated client. Clear emulator data between cases where existing
   state would affect the result.

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
