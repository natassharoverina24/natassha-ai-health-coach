# Thyroid Personalization Specification

**Status:** Proposed specification for a future additive capability.  
**Scope:** Safe, deterministic personalization for a single user. This
document specifies business rules and proposed data contracts only. It does
not authorize implementation or modify the existing frozen architecture.

---

## 1. Purpose and Non-Negotiable Boundaries

This capability may personalize thyroid-related meal guidance, medication
reminders, supplement tracking, and food-medication interaction reminders
only from structured information entered by the user or explicitly approved
by a clinician.

The existing ownership boundaries remain unchanged:

1. The **Thyroid Engine** validates structured, approved profile rules and
   emits deterministic insights.
2. The **Decision Engine** remains the only source of retained coaching
   decisions. It suppresses, ranks, and limits engine insights.
3. The **Planning Layer** only operationalizes retained decisions. It never
   creates, expands, or reinterpret rules.
4. The **Response Layer** only rewrites structured decisions naturally.
5. The **LLM** never invents medical advice, food restrictions, supplements,
   medication instructions, doses, calories, macros, facts, or coaching
   decisions.

The application is an organizational aid, not a diagnostic or prescribing
system. It must never diagnose a condition; prescribe, start, stop, replace,
or change the dose of medication; recommend starting a supplement; or claim
that food treats or cures thyroid disease.

---

## 2. Thyroid Care Profile

The profile is a structured record of facts and rules. A free-text note is
never sufficient authority for personalized guidance.

### 2.1 Condition

The profile may store:

- The condition type exactly as entered by the user or supplied by a
  clinician.
- Whether the condition detail is user-entered or clinician-confirmed.
- The provenance fields required by §7.

The application does not infer a condition type from symptoms, medication,
laboratory values, food logs, weight changes, or any other signal.

### 2.2 Medication

For each medication, the profile may store:

- Medication name exactly as entered.
- Active/inactive status.
- Schedule and reminder times exactly as entered or approved.
- Optional user-facing administration text copied from an approved source.
- Confirmed food/drink interaction rules linked to that medication.
- Provenance fields required by §7.

The application does not infer dosage, frequency, administration method, or
interaction rules from the medication name.

### 2.3 Clinician-Approved Food Rules

The profile may store separate structured lists of:

- Foods to prefer.
- Foods to limit.

Each entry must identify the specific food or catalogue/template identifier,
the approved operational action, and the provenance fields required by §7.
The application must not generalize a rule from one food to a broader food
group.

### 2.4 Clinician-Approved Supplements

The profile may store supplements for logging purposes whether or not they
are approved. Only a supplement entry with current clinician approval and an
explicit user-enabled reminder schedule may produce a reminder.

The application must never turn a logged supplement into a recommendation to
start, continue, stop, replace, or change it.

### 2.5 Confirmed Interaction Rules

An interaction rule must identify:

- The exact medication entry.
- The exact food, drink, supplement, or approved catalogue identifier.
- The reminder text or deterministic timing constraint as supplied by the
  approved source.
- Provenance fields required by §7.

The application must not derive an interaction from general knowledge, an
LLM, a medication name, or similarity to another rule.

---

## 3. Allowed Application Behavior

When all required provenance and approval checks pass, the application may:

1. Select meal templates or office-lunch actions that comply with retained
   clinician-approved food rules.
2. Remind the user about an active medication at the stored schedule.
3. Reproduce an approved timing reminder without modifying its meaning.
4. Remind the user about a confirmed food, drink, or supplement interaction
   linked to an active medication.
5. Log supplements without presenting the log as endorsement.
6. Remind the user about a clinician-approved supplement only when the user
   explicitly enabled the reminder.
7. Warn that information is missing, expired, conflicting, or unverified and
   therefore cannot be used for personalized guidance.
8. Ask the user to review updated information or confirm it with the relevant
   clinician, without suggesting what the corrected medical instruction
   should be.

Meal guidance may use only approved profile rules and approved meal/catalogue
data. Calories and macros must come from existing approved templates or
catalogue entries, never from a medical rule or LLM estimate.

Warnings about missing or unverified information are safety/status messages,
not medical recommendations.

---

## 4. Prohibited Application Behavior

The application, including deterministic code and the LLM, must never:

- Diagnose or infer a thyroid condition.
- Interpret symptoms or laboratory values as a diagnosis.
- Recommend, calculate, or modify a medication dose.
- Recommend starting, stopping, skipping, replacing, or changing medication.
- Invent a medication schedule or administration instruction.
- Invent a thyroid diet or food-restriction protocol.
- Invent rules concerning iodine, selenium, iron, calcium, gluten, soy, or
  cruciferous foods.
- Recommend starting a supplement or invent a supplement schedule.
- Convert an unapproved supplement log into a recommendation.
- Claim or imply that a food, drink, meal, supplement, or diet treats, cures,
  reverses, or controls thyroid disease.
- Infer an interaction from general medical knowledge, an external model, or
  a similarly named medication.
- Add a preferred or avoided food merely because the user has a thyroid
  condition.
- Use expired, rejected, conflicting, or unverified rules to generate a
  recommendation.
- Allow the Planning or Response Layer to broaden a retained rule beyond its
  exact structured scope.

---

## 5. Decision Ownership and Runtime Flow

The future runtime flow must remain:

```text
Structured Thyroid Care Profile
  → profile validation
  → Thyroid Engine
  → deterministic EngineInsight[]
  → Decision Engine
  → retained CoachDecision insights
  → Planning Layer
  → structured plan/reminder
  → Response Layer
  → natural-language rewrite
```

### 5.1 Thyroid Engine

The Thyroid Engine may:

- Validate approval, provenance, dates, scope, and internal consistency.
- Match an approved rule to exact structured context.
- Emit a deterministic insight containing the approved action and provenance.
- Emit a non-medical status warning when information cannot be used.

It may not invent a rule or repair incomplete medical information.

### 5.2 Decision Engine

The Decision Engine remains the only component that retains and prioritizes
coaching decisions. Personalized Thyroid insights do not bypass its existing
suppression, ranking, or limiting behavior.

### 5.3 Planning Layer

The Planning Layer may apply only a retained insight's exact structured
action. It may select among already-approved templates or catalogue items,
but may not add a food restriction, interaction, medication instruction, or
supplement recommendation.

### 5.4 Response Layer and LLM

The Response Layer may provide only structured facts, actions, and provenance
that the Decision Engine retained. The LLM may rephrase them without adding
medical interpretation, causal claims, new examples, new numbers, or new
recommendations.

---

## 6. Required Edge-Case Behavior

### 6.1 Missing Diagnosis Details

- Store the profile as incomplete.
- Do not infer the missing condition.
- Do not generate condition-specific food guidance.
- A deterministic status warning may ask the user to complete or verify the
  profile.

### 6.2 No Medication

- Generate no medication or interaction reminder.
- Do not interpret absence as non-adherence.
- Food rules with their own current approval may remain eligible if they do
  not depend on a medication.

### 6.3 Medication Changed

- Mark the previous medication record and its dependent rules inactive.
- Do not transfer schedules or interactions to the replacement medication.
- Require new structured provenance and approval before generating reminders
  for the changed medication.

### 6.4 Conflicting Rules

- Do not select one rule by guessing.
- Suppress all recommendations affected by the conflict.
- Emit a deterministic conflict-status warning that identifies the records
  requiring review without proposing a medical resolution.

### 6.5 Expired Clinician Guidance

- Do not generate recommendations or interaction instructions from it.
- Preserve it as historical data.
- Emit only a review-needed status warning.

### 6.6 Incomplete Interaction Information

- Do not infer the missing food, drink, medication, timing, or action.
- Generate no interaction recommendation.
- Emit only a verification-needed status warning.

### 6.7 Supplement Recorded Without Clinician Approval

- Permit neutral logging.
- Clearly mark the entry unverified.
- Do not recommend it or create a clinician-approved supplement reminder.
- Do not infer a dose, schedule, benefit, interaction, or reason for use.

---

## 7. Safety, Approval, and Provenance

Every rule that could affect a recommendation must contain:

- `source`: where the rule came from.
- `approvalStatus`: whether it is approved, unverified, rejected, expired, or
  superseded.
- `reviewedAt`: when its content was last reviewed.
- A structured approval record containing the approver label, source
  reference, approval date, and exact approved rule.

Periodic review is required. Each active rule must carry an administrative
review date. Passing that date does not mutate the stored rule, approval
status, or provenance. Deterministic logic derives an effective status at
runtime: a past review date produces effective status `review-due`, makes the
rule ineligible, and suppresses recommendations until it is reviewed and
approved again. The review interval is administrative metadata, not a medical
decision, and this specification does not prescribe a review period. A
time-limited rule must also contain an expiry date. A rule without enough
information to determine whether it is current is treated as unverified.

Only rules that are:

- explicitly approved,
- not expired or superseded,
- linked to the relevant active profile record,
- complete enough to apply without inference, and
- free of unresolved conflicts

may generate a recommendation.

Medication reminders require a clinician-confirmed schedule. The application
must never infer a schedule or dosage instruction.

When eligible rules conflict, all affected rules are paused and generate no
affected recommendation until the conflict is reviewed. The application must
not select a winner automatically.

Unapproved supplements may be logged neutrally but must not generate
reminders, recommendations, dosage guidance, or endorsement.

Food and interaction references must store both a fixed catalogue ID and a
human-readable display label. Deterministic logic uses only the catalogue ID;
the display label is for readability and must not affect matching or
decisions.

Provenance must remain attached through the Thyroid Engine insight,
`CoachDecision`, structured plan/reminder, and Response Layer input so that
every output is auditable.

### 7.1 Safe Fallback Messages

Fallbacks are separate deterministic status messages. They request review or
verification and provide no medical advice:

- **Missing information:** "Personalized guidance is unavailable because
  required information is missing. Please review and complete the record."
- **Expired guidance:** "This guidance is inactive because its review date
  has passed. Please have the record reviewed before using it again."
- **Conflicting guidance:** "Personalized guidance is paused because approved
  records conflict. Please have the records reviewed."
- **Unverified information:** "Personalized guidance is unavailable because
  this information has not been verified. Please verify the record before
  using it."

---

## 8. Proposed TypeScript Types

These types are illustrative contracts only. They are not implementation.
All example values are placeholders and are non-authoritative.

```ts
type ApprovalStatus =
  | "approved"
  | "unverified"
  | "rejected"
  | "expired"
  | "superseded";

type EffectiveRuleStatus = ApprovalStatus | "review-due";

type RuleSourceKind =
  | "user-entered"
  | "clinician-provided"
  | "clinician-approved-document";

interface StructuredApprovalRecord {
  approverLabel: string;
  sourceReference: string;
  approvalDate: string; // ISO date or datetime
  exactApprovedRule: string;
}

interface ReviewMetadata {
  reviewedAt: string; // ISO datetime
  reviewDueAt: string; // ISO datetime; administrative, not medical.
  reviewIntervalLabel: string; // Administrative metadata; no default period.
}

interface RuleProvenance {
  source: {
    kind: RuleSourceKind;
    label: string;
    referenceId?: string;
  };
  approvalStatus: Exclude<ApprovalStatus, "unverified">;
  approvalRecord: StructuredApprovalRecord;
  review: ReviewMetadata;
  expiresAt?: string; // ISO datetime
}

interface UnverifiedUserEnteredRecord {
  source: {
    kind: "user-entered";
    label: string;
    referenceId?: string;
  };
  approvalStatus: "unverified";
  review?: ReviewMetadata;
}

interface RuleEligibility {
  effectiveStatus: EffectiveRuleStatus;
  eligible: boolean;
  reason:
    | "eligible"
    | "review-due"
    | "expired"
    | "unverified"
    | "rejected"
    | "superseded"
    | "conflicting"
    | "incomplete";
}

interface ThyroidConditionRecord extends RuleProvenance {
  conditionType: string; // Exact entered/approved text; never inferred.
}

interface ClinicianConfirmedMedicationSchedule {
  scheduleId: string;
  localTimes: string[]; // "HH:mm", copied from structured approved input.
  daysOfWeek?: number[];
  reminderEnabled: boolean;
  confirmation: StructuredApprovalRecord;
}

interface ThyroidMedicationRecord extends RuleProvenance {
  medicationId: string;
  medicationName: string;
  active: boolean;
  schedule?: ClinicianConfirmedMedicationSchedule;
  approvedAdministrationText?: string;
}

type FoodRuleAction = "prefer" | "limit";

interface CatalogueReference {
  catalogueId: string; // Sole value used by deterministic logic.
  displayLabel: string; // Readability only; never used for matching.
}

interface ApprovedFoodRule extends RuleProvenance {
  ruleId: string;
  action: FoodRuleAction;
  foodReference: CatalogueReference;
  operationalText: string;
  conditionRecordId?: string;
}

interface SupplementRecord extends RuleProvenance {
  supplementId: string;
  supplementName: string;
  active: boolean;
  userLogged: boolean;
  reminder?: ClinicianConfirmedMedicationSchedule;
}

interface UnverifiedSupplementRecord extends UnverifiedUserEnteredRecord {
  supplementId: string;
  supplementName: string;
  active: boolean;
  userLogged: true;
}

type InteractionSubject =
  | { kind: "food"; reference: CatalogueReference }
  | { kind: "drink"; reference: CatalogueReference }
  | { kind: "supplement"; reference: CatalogueReference };

interface ConfirmedInteractionRule extends RuleProvenance {
  interactionId: string;
  medicationId: string;
  subject: InteractionSubject;
  approvedReminderText: string;
  timingConstraint: {
    relation: "before" | "after" | "separate";
    durationMinutes: number;
  };
}

interface ThyroidCareProfile {
  condition?: ThyroidConditionRecord;
  medications: ThyroidMedicationRecord[];
  foodsToPrefer: ApprovedFoodRule[];
  foodsToLimit: ApprovedFoodRule[];
  supplements: Array<SupplementRecord | UnverifiedSupplementRecord>;
  interactions: ConfirmedInteractionRule[];
  profileReviewedAt: string;
}

interface ThyroidPersonalizationInsightData {
  profileRuleId: string;
  sourceReferenceId?: string;
  approvalStatus: "approved";
  effectiveStatus: "approved";
  reviewedAt: string;
  reviewDueAt: string;
  expiresAt?: string;
  exactAction:
    | "apply-approved-food-preference"
    | "apply-approved-food-limit"
    | "send-medication-reminder"
    | "send-interaction-reminder"
    | "send-approved-supplement-reminder"
    | "request-profile-review";
}

type SafeFallbackCategory =
  | "missing-information"
  | "expired-guidance"
  | "conflicting-guidance"
  | "unverified-information";

interface SafeFallbackMessage {
  category: SafeFallbackCategory;
  message: string; // Exact approved neutral text from §7.1.
}
```

Placeholder example, not medical guidance:

```ts
const nonAuthoritativeExample = {
  medicationName: "<clinician-confirmed medication name>",
  approvedReminderText: "<exact approved reminder text>",
  foodReference: {
    catalogueId: "<approved catalogue item identifier>",
    displayLabel: "<human-readable label>",
  },
};
```

No placeholder may be shipped as an active rule.

---

## 9. Future Implementation Test Requirements

### 9.1 Provenance and Validation

- Approved, current, complete rules are eligible.
- Missing `source`, `approvalStatus`, structured approval record, or review
  metadata makes a rule ineligible.
- Every stored rule with `approvalStatus: "approved"` that is eligible to
  generate a recommendation has a required `StructuredApprovalRecord`.
- Unverified user-entered records use a separate contract and cannot satisfy
  the approved-rule contract or generate recommendations.
- The approval record preserves the approver label, source reference,
  approval date, and exact approved rule.
- Unverified, rejected, review-due, expired, or superseded rules generate no
  recommendation.
- Passing `reviewDueAt` derives effective status `review-due` at runtime and
  suppresses recommendations until the rule is reviewed and approved again.
- Runtime eligibility evaluation does not mutate the stored approval status,
  rule, approval record, review metadata, or provenance.
- Re-evaluating the same stored rule at the same injected time returns the
  same effective status and eligibility.
- Review intervals are treated only as administrative metadata.
- Expiry is evaluated deterministically against an injected time.
- Provenance survives unchanged through insight and plan output.

### 9.2 Decision Ownership

- The Thyroid Engine emits structured insights only from eligible rules.
- The Decision Engine can retain, suppress, rank, or omit those insights.
- The Planning Layer does nothing when the corresponding insight was not
  retained.
- The Planning Layer cannot broaden an exact food rule to a food group.
- The Response Layer receives no rule that was not retained.

### 9.3 Medication and Interaction Safety

- No medication produces no medication or interaction reminders.
- A changed medication invalidates dependent schedules and interactions.
- Incomplete interaction information produces no interaction reminder.
- Only a clinician-confirmed medication schedule produces a reminder.
- No function infers timing or interaction behavior from a medication name.
- No function infers a medication schedule or dosage instruction.
- Reminder output reproduces only approved structured text and timing.
- No output advises a dose change, skipped dose, start, stop, or replacement.

### 9.4 Food Guidance Safety

- An approved exact food rule applies only to its referenced item.
- Deterministic matching uses the fixed catalogue ID, never the display label.
- Changing a display label without changing its catalogue ID does not change
  matching or decisions.
- No thyroid condition alone creates a preferred or avoided food.
- No iodine, selenium, iron, calcium, gluten, soy, or cruciferous-food rule
  appears without an eligible exact rule in the profile.
- Calories and macros remain those of approved meal templates/catalogue
  entries.
- No output claims that food treats or cures thyroid disease.

### 9.5 Supplement Safety

- An unapproved supplement can be logged but is never recommended.
- An unapproved supplement produces no reminder, dosage guidance, or
  endorsement.
- An approved reminder requires explicit user enablement.
- No output invents a supplement, benefit, dose, schedule, or interaction.

### 9.6 Edge Cases and Conflicts

- Missing diagnosis details produce no inferred diagnosis or condition-based
  guidance.
- Conflicting rules suppress affected recommendations and produce only a
  review-needed status.
- All affected conflicting rules remain paused until reviewed; no automatic
  winner is selected.
- Expired clinician guidance remains historical and inactive.
- Missing, expired, conflicting, and unverified states each produce their
  separate exact neutral fallback from §7.1.
- Every fallback requests review or verification without medical advice.

### 9.7 LLM and Response-Layer Containment

- Prompt construction contains only retained structured facts and actions.
- Adversarial or embellished provider output cannot add medical advice,
  restrictions, supplements, doses, macros, or new decisions.
- Unsafe provider output is rejected or replaced with deterministic safe
  fallback text.
- Placeholder examples never become runtime guidance.

---

## 10. Required Owner Inputs Before Implementation

Implementation must not begin until the owner supplies or approves:

1. The supported condition-type representation and whether condition details
   require clinician confirmation.
2. The approved provenance-source categories and required source identifiers.
3. The administrative review interval and who is authorized to complete a
   periodic review.
4. The workflow for superseding an old, non-conflicting approved rule.
5. The supported catalogue namespaces and the specific catalogue IDs that
   food and interaction rules may reference.

Until these inputs are resolved, this document is a design constraint, not
authorization to generate personalized thyroid guidance.
