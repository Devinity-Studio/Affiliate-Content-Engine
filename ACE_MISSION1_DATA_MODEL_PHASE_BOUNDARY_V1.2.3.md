# ACE Mission 1 — Data Model & Phase Boundary Design Proposal v1.2.3

**Task classification:** READ-ONLY DESIGN RECONCILIATION + PROPOSAL v1.2.3  
**Execution form:** Returned in-session only. Not a repository file. Not a Requirement, Acceptance Criterion, Decision Record, Evidence record, Gate, WorkflowState, RunHistory, or budget. Not an implementation authorization.

**Relationship to earlier versions:**  
v1.2.3 is a revision patch of v1.2.1, applied through the v1.2.2 closure pass and then tightened in v1.2.3. It does not replace v1.2.1 as the conceptual baseline; it narrows and completes the consistency language already established there. Where v1.2.2 and v1.2.3 conflict, v1.2.3 governs.

**Nature of this revision:** final-design-consistency tightening only.  
This revision is scoped to five items:
1. Tier 2 minimum provenance record and the conditions that drop a manifest to Tier 3;
2. separation of design rules from the as-yet-undetermined implementation profile;
3. explicit definition of required dimensions and the outcome behavior when a dimension is not yet checked or genuinely not applicable;
4. confirmation that `approved_variant_refs` and `approval_coverage_ref` are consistent, not independent approval channels;
5. status and cross-reference alignment for R5 and §4.5, plus an explicit statement that v1.2.2 is a revision patch of v1.2.1.

It does **not** reopen the product direction, does **not** change the Phase 1 / Phase 2 boundary, does **not** redesign the entity model, does **not** start the A–K / Data Model / AC comparison, and does **not** authorize implementation, tests, or Gate approval.

---

## 1. Scope statement

v1.2.3 is a final-consistency patch over v1.2.1/v1.2.2. It closes five remaining looseness points without adding new product scope:

- **A.** Tier 2 is given a minimum provenance record, and the conditions under which a manifest must fall to Tier 3 are stated explicitly.
- **B.** Canonicalization design rules are separated from the implementation profile, which is left undetermined for now.
- **C.** Review aggregation now explicitly handles required vs optional dimensions and the case where a dimension is not yet checked or is genuinely not applicable.
- **D.** The relationship between `approved_variant_refs` and `approval_coverage_ref` is confirmed as one consistent approval reference, not two separate approvals.
- **E.** R5 and §4.5 are aligned with the actual v1.2.3 status, and the document states plainly that v1.2.2 is a revision patch of v1.2.1.

Everything else from v1.2.1/v1.2.2 is preserved unless a direct contradiction required correction.

---

## 2. Baseline and provenance statement

This revision is reconciled against the same previously reported anchor used for v1.2.1 and v1.2.2:

- Repository working directory: `Y:/DevProject/Affiliate Content Engine`
- Branch: `mission1-planning-docs`
- Reported HEAD: `795dc0a6ac66bef19725184107e6474b41aa1823`

In this task, I am not re-running a fresh full repository verification. The baseline above is the previously reported comparison anchor.

Provenance labels used here:

- **FINAL CONSISTENCY PATCH** — correction made in v1.2.3 to tighten a point left loose in v1.2.1/v1.2.2
- **CARRIED FORWARD FROM v1.2.1/v1.2.2** — unchanged content
- **CARRIED FORWARD / NOT RE-INSPECTED IN THIS TASK** — inherited from prior reports without fresh independent verification
- **RESIDUAL UNRESOLVED** — still open, Owner decision or separate work required

---

## 3. What remains unchanged

The following remain as established in v1.2.1/v1.2.2 unless a direct contradiction required correction here:

- Lifecycle backbone: Content → Finalized Snapshot → Destination Variant → Export Event → Export Artifact → Publication → Review
- Phase 1 = Local + Manual + Human Verification
- Four-part verification structure: Outcome / Check Dimension / Observation / Failure Detail
- Failure Detail is optional and does not include `REVIEW_NOT_PERFORMED` for a completed review of content that was reviewed
- File Integrity vs Approved Content Conformance are separate purposes
- Hash mismatch is not automatic proof of content error
- Evidence identity is separate from storage and availability
- Historical reviews and Availability Observations are not rewritten when later availability changes
- R1–R7 remain in force and are not reopened

Only the five items in §1 are tightened in this revision.

---

## 4. Final patch A — Tier 2 minimum provenance record and Tier 3 drop conditions

### 4.1 Purpose of this patch

v1.2.2 defined three tiers for manifest trust, but left Tier 2 underspecified. That is dangerous because Tier 2 can look like a soft pass even when the provenance support is too weak to justify the verification purpose. v1.2.3 closes that gap.

### 4.2 Tier 1 — unchanged

Tier 1 means:
- the manifest has a defined canonical form,
- an integrity reference computed from that canonical form,
- a record of how the reference was produced,
- and a protected payload or protected equivalent that can be re-checked later.

Tier 1 remains the only tier that supports verification as integrity-protected against the recorded manifest.

### 4.3 Tier 2 — minimum provenance record

For a manifest to be treated as Tier 2, the design now requires a **minimum provenance record** that is sufficient to support at least one specific verification purpose without pretending the manifest is integrity-protected.

The minimum provenance record must contain at least all of the following:

1. **Manifest identity.**  
   The manifest must be identifiable in a stable way, with the same identity usable when the manifest is later referenced.

2. **Creation record.**  
   The manifest must be tied to a creation record that states when and by what source it was created. This is not a vague “created at some point”; it must be inspectable.

3. **Purpose scope.**  
   The provenance record must state what purpose the manifest was created for, so a later verifier can tell whether the manifest is being used within its intended scope.

4. **Coverage statement.**  
   The manifest must state what it covers and, if relevant, what it explicitly does not cover.

5. **Source control enough to prevent silent substitution confusion.**  
   The provenance record must be sufficient to establish that the manifest being referenced is the same manifest that was created for that purpose, to the extent the available evidence allows. If the evidence cannot establish that, the manifest does not qualify for Tier 2.

6. **Explicit non-guarantee statement.**  
   Because Tier 2 does not have a stored integrity reference, the record must make clear that Tier 2 means provenance-supported, not integrity-confirmed in the Tier 1 sense.

### 4.4 Tier 3 — when a manifest must fall here

A manifest must be treated as Tier 3 when any of the following is true:

- it does not have a stored integrity reference and does not meet the Tier 2 minimum provenance record;
- the available provenance is too weak to establish that the referenced manifest is the same manifest created for that purpose;
- the manifest’s creation record or coverage statement is missing or insufficient for the verification purpose at hand;
- the provenance record exists but cannot be tied to the referenced manifest in a way that meets the purpose.

When a manifest is Tier 3 for a given verification purpose:
- the related verification must be marked `UNVERIFIABLE`, with the reason recorded;
- the system must not treat the manifest as good enough on the basis of convenience, age, or assumed trust.

### 4.5 Tier is per verification purpose, not a blanket label

A manifest may be Tier 2 for one verification purpose and Tier 3 for another. The tier must be stated for the purpose being verified, not as a global property of the manifest alone.

This avoids the common failure mode where a manifest is called “provenance-backed” in general while the specific verification at hand still cannot be established.

---

## 5. Final patch B — design rules vs implementation profile

### 5.1 Why this separation matters

v1.2.1/v1.2.2 said that canonicalization must be stable, but it was possible to read those statements either as design requirements or as already-selected implementation choices. That ambiguity should be removed.

v1.2.3 separates:
- **canonicalization design rules**, which are required now; from
- **canonicalization implementation profile**, which is not yet fixed.

### 5.2 Canonicalization design rules — required now

The following are design rules that must hold for any verification-grade manifest in this proposal:

1. **One canonical form per manifest type.**  
   For each manifest type used as a verification reference, there must be one defined canonical form for integrity purposes.

2. **Stable payload boundary.**  
   The canonical payload must be restricted to the fields and content that are part of the manifest’s verification meaning. Volatile, presentation-only, or unrelated metadata must be excluded from the canonical integrity payload.

3. **Deterministic representation.**  
   The canonical form must be deterministic in the sense that the same manifest content produces the same canonical representation when nothing material has changed.

4. **Stable reference computation.**  
   The integrity reference must be computed from the canonical form, and the method used must be recorded with the manifest so the same computation can be repeated later.

5. **Reference protects the recorded form, not a later re-derivation.**  
   Later verification must be able to compare against the recorded form or its protected equivalent. Verification must not be based on re-deriving a new “expected” form from the current file and then treating that as the manifest reference.

6. **Coverage must be explicit.**  
   The canonical form must be accompanied by a statement of what it covers.

### 5.3 Implementation profile — not yet determined

The following are implementation-profile questions and are **not** fixed by this proposal:

- exact serialization format;
- exact byte-level encoding rules;
- exact field ordering mechanics;
- exact integrity algorithm selection;
- exact storage layout for the canonical form or its protected equivalent;
- exact tooling used to compute and record the reference.

These may be selected later, but only under the design rules above. The design rules are the constraint; the implementation profile is a later fill-in.

### 5.4 Consistency rule

A later implementation choice must not be allowed to weaken any of the design rules by calling itself “the implementation detail.” If a proposed implementation cannot meet the design rules, it is not a valid implementation profile for this manifest model.

---

## 6. Final patch C — required dimensions, not-yet-checked, and not-applicable

### 6.1 Required vs optional dimensions

Not every dimension is required for every review. A review must state which dimensions were required for that review. The aggregation rule depends on that statement.

So each review must include, at least implicitly through its record:
- which dimensions were part of the review,
- which of those were required for the review purpose,
- and which were checked.

### 6.2 Outcome rules with explicit dimension categories

For each review, the dimension outcomes are categorized as follows:

- **Checked and result available.**  
  The dimension was checked and has a result such as MATCH, DIFFERS, or UNVERIFIABLE.

- **Not yet checked.**  
  The dimension was within scope for that review but had not been checked at the time the review record was finalized. This is **not** the same as a result. It is an open check status.

- **Not applicable.**  
  The dimension did not apply to that review at all. This is a coverage statement, not a verification result.

### 6.3 Required-dimension outcome rule

For required dimensions:

- If a required dimension is checked and is `DIFFERS`, the overall Review Outcome must not be `MATCH`.
- If a required dimension is checked and is `UNVERIFIABLE`, the overall Review Outcome must not be `MATCH`.
- If a required dimension is not yet checked, the review record must not be treated as if that dimension were clean. The review may be recorded with an explicit open-check state, but it must not claim completion for that required dimension.
- If a required dimension is missing from the record without an explicit open-check or not-applicable statement, the record is incomplete for that review purpose.

### 6.4 Optional-dimension outcome rule

For optional dimensions:

- If an optional dimension is checked and is `DIFFERS`, the overall Review Outcome must still not be recorded as a clean `MATCH` if the product requires that any DIFFERS outcome be visible at the review level. In that case, the overall outcome must reflect the presence of a difference, even if the dimension was optional.
- If an optional dimension is `NOT_APPLICABLE`, that is a coverage statement and does not by itself imply failure.
- If an optional dimension is not yet checked, the review may still be internally complete for its required dimensions, but the open optional check must remain visible if it was in scope.

### 6.5 Not-applicable is not a filler

`NOT_APPLICABLE` may not be used as a placeholder to make a dimension appear covered when it was simply not examined. It is a claim about applicability, not about completion.

If a dimension was examined and found irrelevant for that specific case, `NOT_APPLICABLE` may be appropriate. If a dimension was never examined, the record should say so explicitly rather than converting “not examined” into “not applicable.”

### 6.6 Overall Review Outcome behavior

The overall Review Outcome must be consistent with the dimension outcomes and the required/optional classification:

- It must not be `MATCH` when any required dimension is `DIFFERS` or `UNVERIFIABLE`.
- It must not hide a `DIFFERS` in an optional dimension if visibility of that difference is required by the review purpose.
- It must not be `MATCH` when a required dimension is not yet checked.
- It may be recorded as a composite label only if that label is stated with its basis and does not contradict the preserved dimension outcomes.
- It must never be cleaner than the underlying dimension outcomes permit.

### 6.7 What the workspace may do

The workspace may present a derived current posture, but it must:
- preserve every dimension outcome,
- preserve which dimensions were required,
- preserve any not-yet-checked status,
- and make clear when a derived presentation is not the same thing as the recorded review.

---

## 7. Final patch D — approved_variant_refs and approval_coverage_ref consistency

### 7.1 The point to confirm

v1.2.1/v1.2.2 introduced both:
- `approved_variant_refs` on the Finalized Snapshot; and
- `approval_coverage_ref` on the Destination Variant.

That can be misread as two separate approval mechanisms. v1.2.3 confirms they are one consistent approval reference, expressed from two sides.

### 7.2 Snapshot side

The Snapshot’s `approved_variant_refs` lists the Destination Variant identities plus their approved versions that are covered by that Snapshot’s approval.

That list is the Snapshot’s record of what it approves at the variant level. Listing a variant id without its version is insufficient.

### 7.3 Variant side

A Destination Variant’s `approval_coverage_ref` points back to the Finalized Snapshot that covers that specific variant version.

It does not create a separate approval event. It is the variant’s way of saying, “this approved variant version is covered by that Snapshot.”

### 7.4 Reciprocal consistency rule

Variant coverage is a reciprocal, exact-version link:

- If Finalized Snapshot A lists Destination Variant V version N in `approved_variant_refs`, then Destination Variant V version N must carry an `approval_coverage_ref` pointing back to Snapshot A.
- If Destination Variant V version N carries an `approval_coverage_ref` pointing to Finalized Snapshot A, then Snapshot A must contain Destination Variant V version N in its `approved_variant_refs`.
- The match must be on both the variant identity and the version. Matching on variant id alone is not sufficient.
- If the two sides do not match in this exact way, approval coverage cannot be confirmed until the relationship is recorded correctly.

### 7.5 Cardinality

For this model, a given Destination Variant version is covered by exactly one Finalized Snapshot. If a variant version appears to be covered by more than one Snapshot, the record is ambiguous and must be resolved by recording the correct single coverage relationship.

This does not mean a variant id can have only one version ever. Different versions of the same variant id may be covered by different Snapshots for different approvals. What must stay singular is the coverage of one specific variant version.

### 7.6 What this is not

This is not:
- a new approval entity,
- a second approval channel,
- or a loosening of the rule that approval is tied to the approved variant version.

It is a precise reciprocal consistency rule for the same approval relationship, expressed from both sides.

---

## 8. Final patch E — status and cross-reference alignment

### 8.1 Relationship statement

v1.2.3 is a revision patch of v1.2.1, applied through the v1.2.2 closure pass and then tightened further. It does not supersede the v1.2 backbone or the v1.2.2 closure items; it completes and aligns them.

### 8.2 Status statement

**Status:** `DESIGN-CONSISTENCY TIGHTENED IN SESSION — NOT DECLARED FULLY CLOSED`

This means:
- the five listed items are tightened;
- R1–R7 are maintained;
- the document remains read-only;
- it remains not a Requirement, Acceptance Criterion, Decision Record, Evidence record, Gate, WorkflowState, RunHistory, or implementation authorization;
- and the overall reconciliation is not declared fully closed yet, because there are still items that cannot be verified solely by document review.

### 8.3 R5 alignment

R5 now reads as:

**R5 — Explicit non-circular hash provenance:**  
Expected hash must come from a named, provenance-sufficient source such as the Export Result Manifest recorded at export time. A current file must not be compared to a freshly recomputed hash of itself and treated as a conformance proof. For manifest-based verification, the manifest must be evaluated under the three-tier model in §4, with Tier 2 having a minimum provenance record and Tier 3 triggering `UNVERIFIABLE` when provenance or integrity cannot be established.

This makes R5 consistent with §4 and §5 in this version.

### 8.4 §4.5 alignment

§4.5 in this version is the Tier 2/Tier 3 rule and the statement that “where applicable” may describe coverage scope, not the skipping of integrity provenance. That supersedes the looser v1.2.1 wording.

---

## 9. Consistency map for the five tightened points

This revision updates the following sections consistently:

- Tier 2 minimum provenance record and Tier 3 drop conditions: new §4.1–4.5
- Design rules vs implementation profile: §5.1–5.4
- Required dimensions, not-yet-checked, and not-applicable: §6.1–6.7
- `approved_variant_refs` / `approval_coverage_ref` consistency: §7.1–7.5
- Status, R5, and §4.5 alignment: §8.1–8.4

No other part of v1.2.1/v1.2.2 is intentionally weakened by this revision.

---

## 10. R1–R7 status after v1.2.3

After this tightening, the consistency status of the seven requirements is:

- **R1 — Approved version immutable:** PASS
- **R2 — Variant only when real differences exist:** PASS
- **R3 — Four-part verification taxonomy:** PASS
- **R4 — Evidence identity/storage/availability separation:** PASS
- **R5 — Explicit non-circular hash provenance:** PASS at the design-rule level; implementation profile still open
- **R6 — File Integrity vs Approved Content Conformance:** PASS
- **R7 — Platform transformation tolerance:** PASS

The previous looseness in R5 has been reduced from “ambiguous where applicable” to “design rules fixed, implementation profile undecided,” which is the honest state of the model at this point.

---

## 11. Remaining issues after v1.2.3

The following remain open and are not resolved by v1.2.3:

1. **Owner decisions are still separate.**  
   This proposal does not approve product scope, Phase 1 / Phase 2 boundary, material product-risk trade-offs, or any Requirement/AC/Gate.

2. **Normative-document amendment is not done.**  
   v1.2.3 is an in-session consistency patch, not an amendment to A–K, Doc D, Doc E, Decision Records, Evidence Logs, or any repository file.

3. **Implementation, tests, and Gate approval are not authorized.**  
   Nothing in this revision authorizes implementation, tests, or Gate approval.

4. **Some details are still designer-level and not Owner-approved operational choices.**  
   For example, exact serialization, exact algorithm, exact storage layout, and exact composite-outcome label vocabulary remain design-consistency decisions at the proposal level until Owner decision or implementation evidence says otherwise.

5. **One class of verification is still not fully verifiable by document review alone.**  
   The model now says more precisely what it requires, but whether a specific future manifest record actually satisfies Tier 1, Tier 2, or Tier 3 depends on the real record and its provenance, not only on the proposal text.

6. **A–K / Data Model / AC comparison is still pending.**  
   v1.2.3 is the appropriate baseline for that next step, but the comparison itself still needs to be done as a separate read-only task.

7. **Later work must preserve R1–R7.**  
   Any later change that weakens one of R1–R7 without explicit reason is internally inconsistent with this proposal.

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

This v1.2.3 is a read-only design proposal returned in-session only.

**DATA MODEL & PHASE BOUNDARY DESIGN PROPOSAL — v1.2.3 — READ-ONLY — FINAL-CONSISTENCY TIGHTENING — NOT FULLY CLOSED — OWNER DECISION / NORMATIVE AMENDMENT / IMPLEMENTATION NOT AUTHORIZED**
