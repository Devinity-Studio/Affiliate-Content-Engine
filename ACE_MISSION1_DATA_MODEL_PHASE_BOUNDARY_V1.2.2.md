# ACE Mission 1 — Data Model & Phase Boundary Design Proposal v1.2.2

**Task classification:** READ-ONLY DESIGN RECONCILIATION + PROPOSAL v1.2.2  
**Execution form:** Returned in-session only. Not a repository file. Not a Requirement, Acceptance Criterion, Decision Record, Evidence record, Gate, WorkflowState, RunHistory, or budget. Not an implementation authorization.

**Nature of this revision:** final design-consistency closure relative to the v1.2.1 review.  
This revision is scoped narrowly to four points only:
1. remove the inconsistent Failure Detail example from §6.1;
2. define the canonical manifest representation, integrity rules, and provenance tiers for verification;
3. define the Review Outcome aggregation rule so it cannot silently override contrary Dimension Outcomes;
4. clarify the Destination Variant immutable identity and the meaning of `approval_coverage_ref`.

It does **not** reopen the product direction, does **not** change the Phase 1 / Phase 2 boundary, does **not** expand R1–R7, and does **not** start the A–K / Data Model / AC comparison. Those remain separate work.

---

## 1. Scope statement

v1.2.2 is a consistency closure pass on v1.2.1. It fixes the following four inconsistencies that were identified in the v1.2.1 review:

- **A.** The example `REVIEW_NOT_PERFORMED_ONLY_AS_WORKFLOW_STATE` in §6.1 is removed from the Failure Detail column entirely.
- **B.** Manifest canonicalization and integrity are operationally defined, with three provenance tiers instead of an ambiguous “where applicable.”
- **C.** Review Outcome aggregation rules are stated explicitly so that a composite review cannot be recorded as a clean match when a dimension is `DIFFERS` or when a required dimension is `UNVERIFIABLE`.
- **D.** Variant identity and approval binding are clarified without reopening the Variant design itself.

Everything else from v1.2.1 is preserved unless a direct contradiction required correction.

---

## 2. Baseline and provenance statement

This revision is reconciled against the same previously reported anchor used for v1.2.1:

- Repository working directory: `Y:/DevProject/Affiliate Content Engine`
- Branch: `mission1-planning-docs`
- Reported HEAD: `795dc0a6ac66bef19725184107e6474b41aa1823`

In this task, I am not re-running a fresh full repository verification. The baseline above is the previously reported comparison anchor.

Provenance labels used here:

- **CONSISTENCY CLOSURE** — correction made in v1.2.2 to fix a contradiction or gap in v1.2.1
- **CARRIED FORWARD FROM v1.2.1** — unchanged v1.2.1 content
- **CARRIED FORWARD / NOT RE-INSPECTED IN THIS TASK** — inherited from prior reports without fresh independent verification
- **RESIDUAL UNRESOLVED** — still open, Owner decision or separate work required

---

## 3. What is unchanged

The following remain as in v1.2.1:

- The lifecycle backbone: Content → Finalized Snapshot → Destination Variant → Export Event → Export Artifact → Publication → Review
- Phase 1 = Local + Manual + Human Verification
- The four-part verification structure: Outcome / Check Dimension / Observation / Failure Detail
- Failure Detail is optional, and `REVIEW_NOT_PERFORMED` is not a Failure Detail inside a completed review of content that was reviewed
- File Integrity vs Approved Content Conformance are separate purposes
- Hash mismatch is not automatic proof of content error
- Evidence identity is separate from storage and availability
- Historical reviews and Availability Observations are not rewritten when later availability changes
- The seven consistency requirements R1–R7 remain in force

Only the specific items listed in §1 are changed or clarified here.

---

## 4. Consistency closure A — Failure Detail vocabulary

### 4.1 The problem

In v1.2.1 §6.1, the Failure Detail column included the example:

- `REVIEW_NOT_PERFORMED_ONLY_AS_WORKFLOW_STATE`

Even with an explanatory note, placing that string in the Failure Detail column makes it part of the Failure Detail vocabulary example. That directly conflicts with R3 and with §6.2, which state that a check that was not performed belongs to workflow/checklist/pending state, not to the Failure Detail of a review that already occurred.

### 4.2 The correction

The example is removed from §6.1 entirely. No replacement example is invented in its place.

Updated §6.1 table:

| Part | Meaning | Example |
|---|---|---|
| **Outcome** | Summary result of the check | MATCH / DIFFERS / UNVERIFIABLE / NOT_APPLICABLE |
| **Check Dimension** | What was checked | FILE_INTEGRITY / VISUAL / AUDIO / CAPTION / LINK / DISCLOSURE / FORMAT / DURATION / ASPECT_RATIO / OTHER |
| **Observation** | What was actually found | HASH_MATCH / TEXT_DIFFERENCE / URL_UNAVAILABLE / VISIBLE / NOT_VISIBLE / etc. |
| **Failure Detail** | Why a check could not succeed, when applicable | MISSING_FILE / INCOMPLETE_EVIDENCE / UNAVAILABLE_SUBJECT / etc. |

### 4.3 Failure Detail discipline, restated

- Failure Detail is optional.
- A completed review of content that was actually reviewed does **not** use `REVIEW_NOT_PERFORMED` as a Failure Detail.
- If a check was not performed, that is represented outside the review record, as workflow state, checklist state, or pending action, depending on what the product uses.
- A Failure Detail example must describe a real failure mode of a check that was attempted or that failed to produce a usable result, not a missing execution step disguised as a failure value.

This closes the R3 contradiction identified in the review.

---

## 5. Consistency closure B — manifest canonicalization and integrity

### 5.1 Why this matters

v1.2.1 required a canonical representation and an integrity reference in principle, but did not define what “canonical” means operationally. That leaves open the risk that “canonical” becomes a label rather than a checkable rule, and that “where applicable” becomes an escape hatch for skipping integrity evidence.

v1.2.2 closes that gap by defining:
- what must be serialized,
- how serialization must be stable,
- how the integrity reference is computed,
- how later verification uses the recorded reference,
- and how the three provenance/integrity tiers work.

### 5.2 Canonical manifest representation

For any manifest used as a verification reference, the design requires a **canonical representation** with the following properties:

1. **Explicit serialization form.**  
   The manifest must be serialized in one defined form used for integrity purposes. The manifest’s meaning is independent of presentation, but the integrity reference is computed against a fixed canonical serialization, not against whatever display form happens to be used later.

2. **Stable field set.**  
   The canonical representation must include the fields that matter for later verification and must exclude fields that are not part of the manifest’s verification meaning. Fields that are purely incidental, volatile, or presentation-only must not be included in the canonical payload that is integrity-checked.

3. **Stable ordering and encoding.**  
   The canonical form must have stable field ordering and stable encoding so that the same logical manifest produces the same canonical byte sequence when it has not changed. If two systems can represent the same manifest differently, the canonical form must remove that ambiguity before integrity is computed.

4. **Explicit coverage statement.**  
   The manifest must state what it covers. For example, a manifest may cover file role, filename, format, applicable output spec, and result hash, while explicitly excluding unrelated metadata that is not part of the verification comparison.

### 5.3 Integrity reference

Each manifest intended for verification must carry, or be directly associated with, an integrity reference.

At minimum, the integrity reference must answer:
- what canonical form it protects,
- how it was produced,
- and how it can be re-checked later.

Recommended minimum practice for a verification-grade manifest:
- compute the integrity reference from the canonical representation using a defined algorithm;
- record the algorithm together with the reference so the same computation can be repeated;
- store the canonical form or a protected equivalent alongside the manifest at creation time;
- record the creation time and the creator/source so the reference is not treated as floating.

If the manifest is later corrected, the integrity reference must be handled explicitly:
- preserve the original manifest and its integrity reference where possible;
- if a correction is made, record it as a new or explicitly referenced version rather than silently mutating the original;
- if the correction changes the canonical form, the old integrity reference no longer applies to the new form, and that must be visible.

### 5.4 Verification reference usage

When a Review or Verification Reference uses a manifest as its expected source, it must identify:
- which manifest,
- which canonical form it is checked against,
- and which field or hash within the manifest is the expected value.

Verification must compare the current item against the **recorded manifest reference**, not recompute a new expected value from the current file and then call that a conformance check.

### 5.5 Three provenance/integrity tiers

The design now separates manifest trust into three tiers. The words “optional” or “where applicable” must not be used to imply automatic trustworthiness.

#### Tier 1 — integrity reference available and checkable

The manifest has:
- a defined canonical form,
- an integrity reference computed from that form,
- and a record of the algorithm and the protected payload or protected equivalent.

In this tier, later verification can check whether the manifest still matches its recorded integrity reference. If it does, the manifest may be treated as the same recorded manifest for verification purposes.

#### Tier 2 — no direct integrity reference, but provenance is established by other reliable means

The manifest does not have a stored integrity reference, but its provenance is established by other trustworthy evidence that meets the design’s provenance bar. Examples of acceptable support include an authoritative creation record tied to the manifest in a way that can be inspected later.

In this tier:
- the manifest is not treated as integrity-protected in the same way as Tier 1;
- verification may proceed only if the provenance support is sufficient for the specific verification purpose;
- the provenance basis must be recorded alongside the manifest, not inferred.

#### Tier 3 — provenance or integrity cannot be established

If neither Tier 1 nor Tier 2 conditions can be met:
- the related verification must be marked `UNVERIFIABLE`, with the reason recorded;
- the system must not pretend the manifest is trustworthy enough for that verification.

### 5.6 Change to §4.5 terminology

In v1.2.1, §4.5 used the phrase `result_manifest_integrity_ref — integrity reference for the manifest record itself where applicable`.

That wording is too loose. v1.2.2 replaces it with an explicit tiered rule:

- A verification-grade manifest should carry an integrity reference, and if it does, that reference must be usable for later comparison.
- If a manifest does not have a verifiable integrity reference, it is not “partially applicable”; it is either provenance-sufficient under Tier 2 or it falls to Tier 3 and cannot support the verification.
- “Where applicable” may describe the manifest’s coverage scope, not a free pass to skip integrity provenance.

---

## 6. Consistency closure C — Review Outcome aggregation rule

### 6.1 The problem

v1.2.1 separated Review Outcome from Dimension Outcomes, but did not define how the Review Outcome is determined when dimensions disagree.

That leaves open the following bad cases:
- a review recorded as `MATCH` overall even though one dimension was `DIFFERS`;
- a review recorded as `MATCH` overall even though a required dimension was `UNVERIFIABLE`;
- a review that hides a problematic dimension behind an aggregate label.

### 6.2 Rule: dimension outcomes are preserved

Every individual dimension outcome must be preserved in the record. Nothing in the aggregation rule may erase, overwrite, or discard a dimension outcome.

If the overall Review Outcome is presented in a workspace or report, that presentation is derived from the preserved dimension outcomes and is not the same thing as the historical record.

### 6.3 Aggregation rule

A Review Outcome is overall only after all applicable dimension outcomes for that review are known. The overall outcome must follow these rules:

1. **No overall MATCH when any dimension is DIFFERS.**  
   If any dimension outcome is `DIFFERS`, the overall Review Outcome must not be recorded as `MATCH`.

2. **No overall MATCH when any required dimension is UNVERIFIABLE.**  
   If a dimension that is required for that review is `UNVERIFIABLE`, the overall Review Outcome must not be recorded as `MATCH`.

3. **NOT_APPLICABLE is not a failure.**  
   `NOT_APPLICABLE` means the dimension did not apply to that review. It is not the same as `DIFFERS`, and it is not the same as a failed check. It must not be treated as evidence of a problem, but it also must not be used to hide a real failure in another dimension.

4. **UNVERIFIABLE is not a PASS.**  
   `UNVERIFIABLE` means the check could not be established with the available evidence. It is not equivalent to `MATCH` and must not be upgraded into a pass.

5. **Composite outcome must be stated explicitly when needed.**  
   If the product wants a composite Review Outcome label, that label must be recorded with its basis and must not contradict the preserved dimension outcomes. The basis should make clear which dimensions drove the composite outcome.

6. **No dimension may be dropped to improve the overall outcome.**  
   The aggregation rule is not a cleanup step. It does not allow removing a dimension outcome because it makes the review look worse.

### 6.4 Example

If a review has:

- `FILE_INTEGRITY`: MATCH
- `VISUAL`: MATCH
- `CAPTION`: DIFFERS
- `LINK`: UNVERIFIABLE

Then:
- The dimension outcomes are preserved as-is.
- The overall Review Outcome must **not** be `MATCH`.
- If a composite label is recorded, it must reflect that one dimension differed and one required dimension was unverifiable.
- The record must not be summarized as a clean match.

This rule does not require automation to decide everything. It does require a clear contract: the overall outcome may be recorded by the reviewer, but it must be consistent with the dimension outcomes, not incompatible with them.

---

## 7. Consistency closure D — Destination Variant immutable identity and approval reference

### 7.1 Immutable identity

The Destination Variant identity used for approval is not just the variant `id`. It is the pair:

- `id`
- `version`

together. That pair is the unit that can be referenced as an approved form without ambiguity.

This means:
- Two variant records with the same `id` but different `version` are different approved forms for the purpose of reference.
- A reference that means to point to the approved form must include the version, not just the variant id.

### 7.2 Meaning of approval_coverage_ref

`approval_coverage_ref` is not a second independent approval event by default. It is a reference indicating that the Finalized Snapshot covers that specific variant version as part of the snapshot’s approval.

In other words:
- It points back to the Finalized Snapshot and the approved variant version it includes.
- It does **not** by itself create a new standalone approval context unless the product explicitly requires one.

This clarification keeps the approval story consistent:
- the Snapshot is the durable approved reference;
- the variant version is part of what the Snapshot approves;
- later changes to the same variant do not retroactively change that coverage, because the coverage is tied to the variant version, not to the abstract variant id.

This is a clarification, not a redesign of the variant model.

---

## 8. Updated consistency map for the four closed points

The following sections are updated consistently in this revision:

- Failure Detail vocabulary: §4.1–4.3
- Manifest canonicalization, integrity, and provenance tiers: §5.1–5.6 and the updated field note in §4.5
- Verification reference usage: §5.4
- Review Outcome aggregation rule: §6.1–6.4
- Destination Variant identity and approval reference: §7.1–7.2

No other part of v1.2.1 is intentionally weakened by this revision.

---

## 9. Updated R1–R7 status after v1.2.2

After applying this revision, the consistency status of the seven requirements is:

- **R1 — Approved version immutable:** PASS
- **R2 — Variant only when real differences exist:** PASS
- **R3 — Four-part verification taxonomy:** PASS after removal of the inconsistent Failure Detail example
- **R4 — Evidence identity/storage/availability separation:** PASS
- **R5 — Explicit non-circular hash provenance:** improved; canonicalization and integrity rules are now defined, with three tiers instead of an ambiguous “where applicable”
- **R6 — File Integrity vs Approved Content Conformance:** PASS
- **R7 — Platform transformation tolerance:** PASS

The two previously partial areas are improved, and the one previous failure is removed by the vocabulary correction.

---

## 10. Remaining issues after v1.2.2

Even after this closure pass, the following remain open and are not resolved by v1.2.2:

1. **Owner decisions are still separate.**  
   This proposal does not approve product scope, Phase 1 / Phase 2 boundary, material product-risk trade-offs, or any Requirement/AC/Gate.

2. **Normative-document amendment is not done.**  
   v1.2.2 is an in-session consistency closure, not an amendment to A–K, Doc D, Doc E, Decision Records, Evidence Logs, or any repository file.

3. **Implementation, tests, and Gate approval are not authorized.**  
   Nothing in this revision authorizes implementation, tests, or Gate approval.

4. **Repository baseline is carried forward.**  
   The anchor used here is the previously reported baseline. Fresh independent repository verification is a separate task.

5. **Some operational details are still designer choices.**  
   For example, the exact canonical serialization format, exact integrity algorithm, and exact composite-outcome label vocabulary are designer-consistency choices in this proposal until Owner decision or implementation evidence says otherwise.

6. **A–K / Data Model / AC comparison is still pending.**  
   v1.2.2 is internal consistency closure only. The read-only comparison against existing documents is the next separate step, and v1.2.2 is the appropriate baseline for that comparison.

7. **Later work must preserve R1–R7.**  
   Any later change that weakens one of R1–R7 without explicit reason is internally inconsistent with this proposal.

---

## 11. Status statement

**Status:** `ACCEPT AS DESIGN DIRECTION — INTERNAL CONSISTENCY CLOSED IN SESSION — NOT CLOSED AS A WHOLE`

This means:
- v1.2 direction is preserved;
- the four identified inconsistencies are closed;
- R1–R7 are now consistent within this proposal version;
- the proposal is still read-only;
- it is still not a Requirement, Acceptance Criterion, Decision Record, Evidence record, Gate, WorkflowState, RunHistory, or implementation authorization.

---

## 12. Execution-boundary statement

- No repository file was edited, created, deleted, renamed, or formatted in this task.
- No file was staged or committed.
- No branch was switched and no Git state was changed.
- No Decision Record, Evidence Log, WorkflowState, RunHistory, Requirement, Acceptance Criterion, or Gate record was edited or approved.
- No schema, validator, UI, code, or test was implemented.
- No Shopee or external platform access was performed.
- No content was published.
- No money was spent and no paid service was used.

This v1.2.2 is a read-only design proposal returned in-session only.

**DATA MODEL & PHASE BOUNDARY DESIGN PROPOSAL — v1.2.2 — READ-ONLY — DESIGN-CONSISTENCY CLOSED — OWNER DECISION / NORMATIVE AMENDMENT / IMPLEMENTATION NOT AUTHORIZED**
