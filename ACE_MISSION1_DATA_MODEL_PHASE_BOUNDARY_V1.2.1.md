# ACE Mission 1 — Data Model & Phase Boundary Design Proposal v1.2.1

**Task classification:** READ-ONLY DESIGN RECONCILIATION + PROPOSAL v1.2.1  
**Execution form:** Returned in-session only. Not a repository file. Not a Requirement, Acceptance Criterion, Decision Record, Evidence record, Gate, WorkflowState, RunHistory, or budget. Not an implementation authorization.

**Nature of this revision:** consistency corrections only.  
This revision does **not** reopen the product direction, does **not** expand the scope of Mission 1, and does **not** alter the Owner/decision/implementation boundary established in v1.1 and v1.2. It resolves internal consistency items that remain after v1.2 and adds five explicit consistency requirements drawn from the accumulated reconciliation history.

---

## 1. Executive Summary and Revision Summary

This v1.2.1 is a read-only consistency correction to the existing design direction. It keeps the backbone:

- Content → Finalized Snapshot → Destination Variant → Export Event → Export Artifact → Publication → Review
- Phase 1 = Local + Manual + Human Verification
- Content Library as Verification Workspace
- Hash and Evidence must be traceable backward
- Platform transformation must be handled explicitly
- AC-06 / AC-18 / AC-19 must not become catch-all criteria
- Adding local data entities is not a reason to defer Owner-approved Phase 1 capabilities

v1.2.1 adds **five explicit consistency corrections** and restates the **seven accumulated reconciliation principles** as binding internal consistency requirements for the rest of the proposal.

### 1.1 What v1.2.1 corrects

1. **Variant versioning and approval binding.** A Finalized Snapshot references the approved Destination Variant **version** at the time of approval, and a Variant record must be treated as immutable once used as an approved reference. Editing the same logical Variant afterward is not allowed to retroactively change what was approved.
2. **Manifest integrity and canonical representation.** The design now defines a canonical representation, an integrity reference, and a check against the previously recorded reference, with explicit handling for when provenance/integrity cannot be established.
3. **Artifact availability directly on Export Artifact.** The design now supports Availability Observation for the Export Artifact itself, not only for the broader Evidence Record, while preserving an append-only history of availability checks.
4. **Review Outcome vs Dimension Outcome separation.** The overall Review conclusion is now explicitly separated from per-dimension outcomes, and one must not silently override the other.
5. **Seven accumulated reconciliation principles as consistency constraints.** The seven principles collected through the prior rounds are stored as consistency requirements and must not be weakened, contradicted, or silently downgraded by later paragraphs.

### 1.2 What v1.2.1 does **not** do

- It does **not** begin editing A–K, Doc D, Doc E, Decision Records, Evidence Logs, or any repository file.
- It does **not** perform implementation, tests, or Gate approval.
- It does **not** access Shopee or any external platform.
- It does **not** claim fresh independent Git verification in this session; the baseline below is the previously reported anchor.

---

## 2. Baseline and Provenance Statement

This revision is reconciled against the previously reported anchor:

- Repository working directory: `Y:/DevProject/Affiliate Content Engine`
- Branch: `mission1-planning-docs`
- Reported HEAD: `795dc0a6ac66bef19725184107e6474b41aa1823`

For the purposes of v1.2.1, I am **not** asserting that I rerun or re-verify the full repository state from scratch in this session. The baseline above is the previously reported comparison anchor. Where a fact depends on repository inspection beyond that anchor, I label it as **carried forward / not independently re-verified in this session** rather than as freshly inspected.

Provenance classification used in this document:

- **DESIGN DIRECTION (CARRIED FROM v1.1/v1.2)** — established design position carried forward for consistency
- **CONSISTENCY CORRECTION** — v1.2.1 internal fix for cross-paragraph consistency
- **CARRIED FORWARD / NOT RE-INSPECTED IN THIS SESSION** — inherited from prior reports without fresh independent verification
- **RESIDUAL UNRESOLVED** — still needs Owner decision, evidence, or a separate reconciliation step

---

## 3. Core Backbone (unchanged from v1.2)

### 3.1 Lifecycle backbone

The design backbone remains:

1. **Content** — the working content state and its working-tree provenance
2. **Finalized Snapshot** — the immutable approved core state at one approval event
3. **Destination Variant** — destination/format-specific approved variation, where it actually exists
4. **Export Event** — the event that produces export results
5. **Export Artifact** — the produced file identity plus immutable export facts
6. **Publication** — the published item referencing what was actually used
7. **Review** — the auditable history of verification checks, each preserved separately

Phase 1 remains Local + Manual + Human Verification and does **not** depend on a Platform API to function.

---

## 4. Entity Model Consistency Corrections

### 4.1 Finalized Snapshot

**Identity:** Finalized Snapshot ID

**Purpose:** immutable record of the approved core content state at one approval event.

**Fields (consistent with v1.2, restated for clarity):**
- `id`
- `content_id`
- `approved_at`
- `approved_by`
- `approval_decision_id`
- `approved_core_ref` — pointer to the approved core content state at that time
- `approved_variant_refs` — references to the Destination Variant records and their versions included in that approval, where applicable
- `core_evidence_refs`
- `source_reference`
- `note`

**Consistency rules:**
- The snapshot is the durable answer to “what was approved as the core content at this time.”
- A later edit does not mutate this snapshot. If the approved core changes, a new snapshot is created and the prior snapshot is preserved.
- The snapshot is not the same thing as the approval decision, though they reference each other.
- The snapshot’s variant references must be to the **specific variant version** approved at that time, not merely to the abstract notion of “a variant that may now look different.”

### 4.2 Destination Variant — with versioning and approval binding

**Identity:** Destination Variant ID + variant version

**Purpose:** express a destination/format-specific approved variation tied to one Finalized Snapshot, where such a variation actually exists, and keep the approved version stable once referenced.

**When a variant must exist:**
- A distinct platform or format has its own approved spec differences worth recording, such as different aspect ratio, duration, caption handling, disclosure behavior, or output spec.
- If content is produced for more than one platform or more than one format with real per-destination/format approved differences, each such difference set should be identifiable through its own variant record.

**When a variant is not required:**
- If the same approved core is used for a destination without any meaningful per-destination approved difference, the export/publication can reference the approved core directly without inventing a variant.
- Do not create variants just to inflate record count.
- Do not merge materially different formats into one variant such that it becomes unclear which spec produced which file.
- A variant must be precise enough to say which destination spec it was produced against.

**Fields:**
- `id`
- `snapshot_id`
- `version` — the approved variant version
- `platform`
- `format`
- `aspect_ratio`
- `duration_s`
- `output_spec`
- `variant_specific_approved_fields` — only what differs from the approved core, stated explicitly
- `variant_evidence_refs`
- `approval_coverage_ref` — points back to the Finalized Snapshot and its approved variant version when this variant is included in that approval
- `note`

**Consistency rules:**
- A variant record used as an approved reference must be treated as **version-immutable** for the purpose of that approval. Any later change to the same logical variant creates a new variant version and must be re-approved as applicable.
- An existing approved snapshot does **not** automatically cover a modified variant just because the variant’s id is the same. If the variant changes in a way material to approval, the old variant version remains what was approved; the new version is a new record and a new approval context unless the product explicitly says otherwise.
- Do not allow a later edit to a variant to retroactively alter what the snapshot says was approved.

**Designer trade-off:**
- Keeping the variant id stable while version-immutabilizing the approved form avoids fragmenting approval state too early, while still preventing the dangerous case where a later edit silently changes the apparent approved artifact.
- The cost is that variant versions must be explicit and later changes must be recorded as new versions rather than as overwriting the approved form.

### 4.3 Export Event and manifests

**Identity:** Export Event ID

**Purpose:** record the export action and the two distinct manifest layers used for later verification.

**Fields:**
- `id`
- `event_timestamp`
- `initiator` — who/what initiated the export
- `expected_artifact_manifest_ref`
- `export_result_manifest_ref`
- `related_snapshot_id`
- `related_variant_id` where applicable
- `note`

### 4.4 Expected Artifact Manifest — intent layer

**Identity:** Expected Artifact Manifest ID

**Purpose:** record the intended/expected file set before or during export, not the actual bytes produced.

**Fields:**
- `id`
- `export_event_id`
- `expected_files` — role, filename, format, and applicable output spec for each expected file
- `expectation_source` — how this expectation was formed
- `note`

**Rule:** This manifest expresses expectation and role/spec intent. It is **not** the source of the post-export SHA-256 used for File Integrity unless explicitly stated and provenance-sufficient.

### 4.5 Export Result Manifest — actual-result layer

**Identity:** Export Result Manifest ID

**Purpose:** record the actual files produced by the export, with immutable result facts captured after export.

**Fields:**
- `id`
- `export_event_id`
- `result_files` — for each produced file: role, filename, format, actual output spec if applicable, and the SHA-256 computed **after** export
- `result_manifest_integrity_ref` — integrity reference for the manifest record itself where applicable
- `created_at`
- `creator_source`
- `note`

**Consistency rules:**
- The Export Result Manifest is a record of **actual files produced**, not a pre-export intent list.
- The SHA-256 values in this manifest are computed from the actual exported files and recorded at export time. They are the basis for later File Integrity comparison.
- If the manifest’s own provenance or integrity cannot be established later, the related verification must be marked `UNVERIFIABLE` with the reason recorded.

### 4.6 Verification Reference — the link between a Review and a manifest

**Identity:** Verification Reference ID

**Purpose:** state which manifest, which hash, and which field are being used as the expected reference for a given verification action.

**Fields:**
- `id`
- `review_id`
- `manifest_ref` — which manifest is cited as the expected reference for this check
- `expected_source` — expected Artifact Manifest, Export Result Manifest, or other named source
- `expected_hash_field_or_reference`
- `provenance_note`

**Consistency rule:** a verification must say what it is comparing and where the expected value came from. It must not claim a hash match implies approved-content conformance, and it must not compare a current file to a freshly recomputed hash of itself and call that meaningful conformance.

---

## 5. Export Artifact — stable facts plus direct availability observation

### 5.1 Export Artifact fields

**Identity:** Export Artifact ID

**Purpose:** stable file identity and export facts. Not a live availability dashboard.

**Fields:**
- `id`
- `export_event_id`
- `snapshot_id`
- `variant_id` where applicable
- `role`
- `filename`
- `format`
- `sha256`
- `storage_reference` — or relationship to a Storage Location Record
- `export_timestamp`
- `other immutable or provenance-related metadata as justified`

**Consistency rule:** The Artifact retains **stable file identity and export facts only**. It does **not** carry a mutable combined field such as `file_availability_and_integrity_status`.

### 5.2 Where availability lives

- **File Integrity results** belong in Review Records.
- **File availability** may be recorded as **Availability Observation** directly against the Export Artifact when checking the artifact itself, and also against Evidence where that is the relevant subject.
- **Current/latest presentation** may be derived by the Verification Workspace from those records.
- **Historical results** remain preserved and must not be silently overwritten.

### 5.3 Availability Observation

**Identity:** Availability Observation ID

**Purpose:** record, at a point in time, whether the subject was reachable/usable, and preserve the history of such checks.

**Fields:**
- `id`
- `subject_type` — for example Export Artifact or Evidence
- `subject_id`
- `observed_at`
- `observed_by`
- `availability_result` — such as AVAILABLE / UNAVAILABLE / DEGRADED / UNKNOWN, as applicable
- `check_method`
- `note`

**Consistency rules:**
- Availability is inherently time-bounded. A record at one time does not mean the same subject is still available later, and an early AVAILABLE result is not proof of later availability.
- If the subject later becomes unavailable, do **not** rewrite earlier Availability Observations. Record a new observation and, if needed, an evidence-availability follow-up note or status record separate from historical reviews.
- An Availability Observation on the Export Artifact is allowed directly; it is not limited to the surrounding Evidence Record.

---

## 6. Verification Model — four parts, plus Review Outcome vs Dimension Outcome

### 6.1 Four-part verification structure

Verification is structured into four distinct parts:

| Part | Meaning | Example |
|---|---|---|
| **Outcome** | Summary result of the check | MATCH / DIFFERS / UNVERIFIABLE / NOT_APPLICABLE |
| **Check Dimension** | What was checked | FILE_INTEGRITY / VISUAL / AUDIO / CAPTION / LINK / DISCLOSURE / FORMAT / DURATION / ASPECT_RATIO / OTHER |
| **Observation** | What was actually found | HASH_MATCH / TEXT_DIFFERENCE / URL_UNAVAILABLE / VISIBLE / NOT_VISIBLE / etc. |
| **Failure Detail** | Why a check could not succeed, when applicable | MISSING_FILE / INCOMPLETE_EVIDENCE / UNAVAILABLE_SUBJECT / REVIEW_NOT_PERFORMED_ONLY_AS_WORKFLOW_STATE / etc. |

**Consistency rule:** the four parts are preserved as four parts. They are not compressed into three by force, because each carries a different meaning.

### 6.2 Failure Detail discipline

- Failure Detail is **not required** in every Review Record. Some checks succeed cleanly and have no failure detail.
- `REVIEW_NOT_PERFORMED` is **not** used as a Failure Detail inside a completed Review of content that was actually reviewed. If a check was genuinely not performed, that is represented as a separate workflow/checklist/pending state rather than as a Failure Detail inside a completed Review.
- Where a term like “not performed” must appear, it belongs to workflow state, not to the failure vocabulary of a review that already happened.

### 6.3 Review Outcome vs Dimension Outcome

A Review Record has:
- A **Review Outcome**, which is the overall conclusion for that review event.
- One or more **Dimension Outcomes**, each tied to a Check Dimension and its own Observation and optional Failure Detail.

**Consistency rules:**
- The Review Outcome must not silently overwrite or hide a contrary Dimension Outcome.
- If one dimension is UNVERIFIABLE or DIFFERS, the Review Outcome must reflect that reality rather than being recorded as a blanket success.
- The workspace may derive a current/latest presentation from multiple Review Records, but that presentation is derived, not the same thing as the historic record.
- Do not treat a HASH_MATCH in one dimension as proof of APPROVED_CONTENT_MATCH across all dimensions.

---

## 7. File Integrity vs Approved Content Conformance

### 7.1 File Integrity

File Integrity compares the current file’s SHA-256 against the SHA-256 captured in the Export Result Manifest at the time of export.

- It answers: “do the current bytes match the bytes that were recorded as produced at export time?”
- A match does **not** prove that the export was correct, complete, or conformant to the approved content.

### 7.2 Approved Content Conformance

Approved Content Conformance compares the exported result against the approved Finalized Snapshot and applicable Destination Variant:

- Check relevant dimensions: visual, audio, caption, link, disclosure, format, duration, aspect ratio, and other applicable output requirements.
- Hash comparison alone cannot establish complete conformance to approved content.

**Consistency rule:** The Verification Workspace must never infer `APPROVED_CONTENT_MATCH` merely from `HASH_MATCH`.

### 7.3 Platform transformation tolerance

When verifying a published item against the artifact:

- Hash match = bytes match.
- Hash mismatch does **not** automatically mean content is wrong, because a platform may compress or transform the file.
- Publication verification must therefore check multiple dimensions and not conclude non-conformance from hash mismatch alone.

---

## 8. Manifest Integrity, Canonical Representation, and Provenance

### 8.1 Canonical representation

Where a manifest is recorded in v1.2.1, the design requires:

- A **canonical representation** sufficient for later comparison, meaning the manifest’s relevant fields and structure are recorded in a stable, predictable form.
- A clear statement of what is covered by that representation.

This is a consistency requirement for the manifest layer, not a claim that any specific storage backend is tamper-proof.

### 8.2 Manifest integrity reference

Each relevant manifest should carry or be associated with an integrity reference where applicable, for example:

- A manifest-level integrity reference such as a checksum/sha of the manifest record itself
- A clear link to the Export Event and the artifacts it describes

### 8.3 Checking against the previously recorded reference

Later verification must be able to answer:

- Is the manifest being used the same manifest that was recorded at the relevant time?
- Has the manifest been altered since it was recorded?

If the check against the recorded integrity reference succeeds, the system may treat the manifest as the same recorded manifest for verification purposes.

### 8.4 Fallback when provenance/integrity cannot be established

If provenance or integrity for a manifest cannot be established:

- The related verification must be marked `UNVERIFIABLE`, with the reason recorded.
- Do not silently downgrade this into a pass or pretend the comparison is trustworthy.

**Consistency rule:** `UNVERIFIABLE` here is a real option, not an escape hatch to be avoided by asserting trust that the design does not actually provide.

---

## 9. Evidence model consistency

### 9.1 Evidence identity and storage separation

Evidence identity is kept separate from storage location. Moving a file does not change the Evidence ID.

The design already supports:

- Evidence Record — identity and source provenance
- Storage location — current position and move history
- Availability Observation — whether the subject was reachable at a point in time

### 9.2 Historical reviews are not rewritten for later availability loss

If evidence later becomes unavailable:

- Do **not** rewrite earlier Review Records in a way that changes what was concluded at the time.
- Record the availability change separately, including an Availability Observation or evidence-availability note, as applicable.
- If verification later depends on missing evidence, mark it `UNVERIFIABLE` with the reason, rather than retroactively changing the original review’s meaning.

---

## 10. Phase 1 Human Workflow consistency

### 10.1 System actions vs human actions

In Phase 1:

- The system may compute hashes and compare them.
- The system may record what is supplied and what is observed.
- A human opens files and performs visual/audio/caption/destination checks.
- The system records the results and evidence that were actually produced.
- The system does **not** claim to have verified content that was not actually checked by a human or a tool capable of that check.

### 10.2 What the system may not claim

- A hash match is not a claim of full content approval.
- An availability observation at one time is not a permanent guarantee.
- A manifest reference is not tamper-proof unless the implementation actually provides tamper-proof storage, which must not be assumed.

---

## 11. Verification Workspace behavior consistency

The Verification Workspace may:

- derive a current/latest presentation from Review Records and Availability Observations
- surface which manifest and which expected reference were used for a given check
- show that a check was unverifiable and why

The Verification Workspace must not:

- silently merge Review Outcome and Dimension Outcomes so that a problem in one dimension is hidden
- present a derived “current status” as if it were the historical record
- infer approved-content conformance from file integrity alone

---

## 12. Lifecycle and edge-case consistency

### 12.1 Variant changes after approval

If a Destination Variant changes after it has been included in an approved Snapshot:

- The approved Snapshot continues to refer to the variant version that was actually approved.
- Any new variant state is a new version and is not automatically covered.
- Approval coverage does not spread by shared id alone.

### 12.2 Manifest corrections and provenance

If a manifest is corrected:

- Preserve the original where possible or record the correction as a new/referenced record, not as silent mutation.
- Keep the integrity reference consistent with the manifest form in use.
- If the correction breaks the ability to verify against the original, mark affected verifications `UNVERIFIABLE` with the reason.

### 12.3 Missing or unavailable artifact/evidence

If an artifact or evidence is missing or unavailable later:

- Record availability as a fresh observation/status rather than by rewriting prior review conclusions.
- Use `UNVERIFIABLE` where verification depends on the missing subject.
- Do not convert “cannot verify now” into “was verified previously” retroactively.

---

## 13. The seven accumulated reconciliation principles as consistency requirements

The following seven principles are carried forward from the accumulated reconciliation history and are now stated as binding consistency requirements for the rest of this proposal. No later section may weaken, contradict, or silently downgrade them.

**R1. Approval state is immutable for the approved version.**  
A Finalized Snapshot records what was approved at that time, including the specific approved variant version where applicable. Later edits do not retroactively change that approval.

**R2. Variants exist only when there is a real per-destination/format approved difference.**  
A variant is not created merely to inflate record count, and materially different formats are not merged into one ambiguous variant.

**R3. Verification has four parts and they are not collapsed by force.**  
Outcome, Check Dimension, Observation, and Failure Detail remain distinct. Failure Detail is optional and is not used to represent a check that was simply not performed inside a completed review of content that was reviewed.

**R4. Evidence identity is separate from storage and availability.**  
Moving files does not change the Evidence ID; availability is recorded over time; historical reviews are not rewritten to change past conclusions.

**R5. Hash provenance must be explicit and non-circular.**  
Expected hash must come from a named, provenance-sufficient source such as the Export Result Manifest recorded at export time. A current file must not be compared to a freshly recomputed hash of itself and treated as a conformance proof.

**R6. File integrity and approved-content conformance are different purposes.**  
File Integrity checks bytes against the recorded export result. Approved Content Conformance checks against the approved snapshot/variant and relevant dimensions. A hash match is not an approved-content match.

**R7. Platform transformation is tolerated in verification.**  
A hash mismatch does not by itself establish that published content is wrong; multi-dimensional verification is required, and the system does not claim to have verified content it did not actually verify.

These seven requirements are the minimum consistency spine for v1.2.1.

---

## 14. Cross-section consistency checklist applied in v1.2.1

This revision applies the changes consistently across:

- Entity Model — Finalized Snapshot, Destination Variant versioning, manifests, Export Artifact, Availability Observation
- Verification Model — four-part structure, Failure Detail discipline, Review Outcome vs Dimension Outcome
- Manifest and hash provenance rules — canonical representation, integrity reference, check against recorded reference, UNVERIFIABLE fallback
- Phase 1 Human Workflow — system vs human separation
- Verification Workspace behavior — derived presentation vs historical record
- Lifecycle and edge cases — variant changes, manifest corrections, missing/unavailable subjects
- Consistency requirements — the seven principles above

No single paragraph is updated in isolation while leaving a contradictory statement elsewhere in the same proposal version.

---

## 15. Remaining Issues — stated directly

v1.2.1 is a consistency correction, not a closure of all open questions. The following remain open and are not resolved by this revision:

1. **Owner product decisions are still pending.**  
   This proposal does not decide product scope, Phase 1 / Phase 2 boundary, material product-risk trade-offs, or any Requirement/AC/Gate approval. Those remain Owner decisions.

2. **Formal normative-document amendment is not done.**  
   This is an in-session design reconciliation, not an amendment to A–K, Doc D, Doc E, Decision Records, Evidence Logs, or any repository file.

3. **Implementation, tests, and Gate approval are not authorized.**  
   No implementation, test, or Gate approval has been made or implied by this revision.

4. **Repository baseline is carried forward, not freshly re-verified.**  
   The comparison anchor used here is the previously reported baseline. Fresh independent repository verification is a separate task.

5. **Some operational details are still designer choices, not Owner approvals.**  
   For example, exact field names, exact manifest encoding, and exact availability-observation vocabulary are designer-consistency choices in this proposal until Owner decisions or implementation evidence say otherwise.

6. **Cross-document comparison has not been performed yet in this revision.**  
   v1.2.1 is internal consistency only. The separate read-only A–K / Data Model / AC comparison is the next appropriate step after this revision is accepted as a consistency baseline.

7. **Any future change must preserve the seven consistency requirements.**  
   If later work weakens one of R1–R7 without an explicit reason, that later work is internally inconsistent with this proposal.

---

## 16. Status statement

**Status:** `ACCEPT AS DESIGN DIRECTION — CONSISTENCY CORRECTED IN SESSION — NOT CLOSED`

This means:

- The v1.2 direction is preserved.
- The five consistency corrections are applied.
- The seven accumulated reconciliation principles are stored as binding internal consistency requirements.
- The proposal is still read-only.
- It is still not a Requirement, Acceptance Criterion, Decision Record, Evidence record, Gate, WorkflowState, RunHistory, or implementation authorization.

---

## 17. Execution-boundary statement

- No repository file was edited, created, deleted, renamed, or formatted in this task.
- No file was staged or committed.
- No branch was switched and no Git state was changed.
- No Decision Record, Evidence Log, WorkflowState, RunHistory, Requirement, Acceptance Criterion, or Gate record was edited or approved.
- No schema, validator, UI, code, or test was implemented.
- No Shopee or external platform access was performed.
- No content was published.
- No money was spent and no paid service was used.

This v1.2.1 is a read-only design proposal returned in-session only.

**DATA MODEL & PHASE BOUNDARY DESIGN PROPOSAL — v1.2.1 — READ-ONLY — CONSISTENCY CORRECTED — OWNER DECISION / NORMATIVE AMENDMENT / IMPLEMENTATION NOT AUTHORIZED**
