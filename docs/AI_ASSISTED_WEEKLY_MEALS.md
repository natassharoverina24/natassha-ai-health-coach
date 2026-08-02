# AI-Assisted Weekly Meals

Weekly planning remains deterministic: the Decision Engine and existing Meal
Planner choose the approved base plan. AI is optional and may only propose a
practical meal name, ingredient identifiers, roles, reason, and recipe-search
keywords after the user requests a variation. It must not provide calories,
macros, targets, medical guidance, restrictions, or coaching decisions.

The UI starts with the local Indonesian catalogue. If requested and configured,
free-provider fallback is Gemini, Groq, then `openrouter/free`; every response is
validated before display. Free-tier quotas and model availability can change.
When providers are unavailable, invalid, limited, or time out, the local
catalogue remains usable and the user can still choose a menu manually.

Liked/disliked and quick-meal preferences, selected replacements, and optional
recipe links use browser storage for this stage. TikTok support is a generated
search link only: the app does not scrape or download TikTok content.
