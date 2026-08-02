# Watch Integration Feasibility

## Current decision

This release uses manual workout entry plus a deterministic, editable calorie estimate. It does not claim to sync a watch and does not require a paid API or service.

## Apple Watch / Apple Health

Apple health and fitness data is accessed through HealthKit with explicit user permission. HealthKit capability and entitlements are configured in an iOS or watchOS app target, so the current pure Next.js web app cannot directly read Apple Watch HealthKit data.

Future feasibility: create a native iOS app or carefully scoped native wrapper that requests only the required HealthKit permissions, then passes user-approved structured workout and sleep records to the existing repository boundary.

Official references:

- [HealthKit overview](https://developer.apple.com/documentation/healthkit)
- [Configuring HealthKit access](https://developer.apple.com/documentation/Xcode/configuring-healthkit-access)

## Android watches / Health Connect

For a future Android mobile integration, use Health Connect for on-device health and fitness records with user-managed permissions. This requires an Android application and Health Connect SDK; a browser-only Next.js app cannot directly use the native SDK.

Do not start a new Google Fit dependency. Google states that Google Fit APIs are deprecated in 2026 and recommends Health Connect or other Android Health APIs for migration.

Official references:

- [Health Connect overview](https://developer.android.com/health-and-fitness/health-connect)
- [Google Fit migration FAQ](https://developer.android.com/health-and-fitness/guides/health-connect/migrate/fit-apis-end-of-service)

## Recommended future sequence

1. Keep manual workout and sleep logging as the reliable free baseline.
2. Validate whether a native mobile wrapper is worth maintaining.
3. Define explicit user consent, data minimization, deletion, and owner-only sync rules.
4. Build separate native bridges for HealthKit and Health Connect; never show fake sync in the web UI.
