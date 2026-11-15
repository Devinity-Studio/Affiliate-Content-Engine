# ACE Mission 1 — Data Model & Phase Boundary Design Proposal

**Task classification:** READ-ONLY RECONCILIATION + DESIGN PROPOSAL ONLY

**Execution form:** This proposal is returned as a response in this session. It is not a repository file, not a Requirement, not an Acceptance Criterion, not a Decision Record, and not an implementation authorization.

---

## 1. Executive Summary

This proposal reconciles the Owner-approved **Content Library & Publication Verification Design Direction** with the **current repository state at branch `mission1-planning-docs`, HEAD `795dc0a6ac66bef19725184107e6474b41aa1823`**, and then proposes a coherent conceptual and logical data model for:

- Content
- Finalized Snapshot
- Export Artifact
- Publication Record
- Review Record
- Evidence

It also proposes:

- a verification taxonomy (Finalize, Export, Publication, Destination Comparison, Audience Visibility)
- a Phase 1 human workflow
- lifecycle and edge-case rules
- an existing-contract and acceptance-criteria impact matrix
- a Phase 1 vs Phase 2 recommendation
- the specific Owner decisions that the design depends on

The headline finding is that the current repository already has much of the **approval / publication / caption-comparison integrity layer**, but it does **not** yet have a first-class **Finalized Snapshot**, **Export Artifact**, **Content Library artifact model**, or **Review Record** layer in the normative data model. The existing `Publication.asset_id` field is a real inconsistency today: Doc D §3.6 says `asset_id` comes “from asset record,” but Doc D §3.5 defines no identifier for the Content Asset record that field can reference, and Doc D §5 states that explicitly.

So the proposal is: the Owner-approved design direction is **coherent and largely aligned with the existing contract**, but to implement it cleanly we need **new entities and some clarifications**, and those additions require **explicit Owner scope decisions before any normative text is edited**.

---

## 2. Verified Baseline and Provenance

All baseline statements below were directly inspected for this session from the current repository. They are separated from interpretations and proposals.

### 2.1 Repository baseline

- Repository working directory: `Y:/DevProject/Affiliate Content Engine`
- Branch: `mission1-planning-docs`
- HEAD: `795dc0a6ac66bef19725184107e6474b41aa1823`
- `git status --short` shows modified tracked docs including:
  - `docs/mission1/A-product-specification.md`
  - `docs/mission1/B-workflow-specification.md`
  - `docs/mission1/C-system-architecture.md`
  - `docs/mission1/D-data-model.md`
  - `docs/mission1/E-vertical-slice-acceptance.md`
  - `docs/mission1/F-implementation-roadmap.md`
  - `docs/mission1/G-open-questions-decision-log.md`
  - `docs/mission1/H-evidence-register.md`
  - `docs/mission1/I-ux-ui-design-specification.md` is untracked / present
- Untracked material relevant to this proposal includes:
  - `data/mission1/content-library.json` — a local JSON file with a different “content library” shape than the one proposed here
  - `docs/mission1/schemas/` — contains a `content-work-item.schema.json` and validator, not an export-artifact schema
- Decision records present in `data/mission1/decision-log.md`:
  - `DEC-1-G1`, `DEC-1-2`, `DEC-1-3`, `DEC-1-4`, `DEC-1-5`, `DEC-1-6`

Provenance classification for this section:

- **VERIFIED** — branch, HEAD, file presence, decision-record list, schema directory contents, content-library.json presence.
- **NOT VERIFIED** — whether the working-tree modifications to A/B/C/D/E/F/G/H are individually authorized by a Decision Record. This report does not adjudicate that; it only inspects the documents.
- **AGENT PROPOSAL** — everything in this document after the baseline is a design proposal unless it explicitly cites an existing Requirement, Decision, or Owner-approved Design Direction.

---

## 3. Current-State Gap Analysis

### 3.1 What is already covered

- **Finalize as a concept:** The workflow already has a pre-publication approval point. Doc A places G3 after production and before publication; Doc B Stage 6 is QA & Human Approval (Gate G3); Doc B Stage 7 is Publication & Distribution (Gate G4). Doc I S7 reinforces gate-controlled publishing and caption comparison.
- **Publication record:** Doc D §3.6 now includes `caption_used`, `disclosure_settings_applied`, `evidence_files`, `status`, and the caption-comparison rules. Doc A FR-7.2 records publication fields. Doc B Stage 7 records immediate evidence. Doc E AC-06/AC-18/AC-19 govern publication correctness/comparison/attribution.
- **Caption comparison semantics:** Already explicit in Doc D §3.6 with `MATCH` / `DIFFERS` / `UNVERIFIABLE` / `NOT_APPLICABLE`, the rule that `UNVERIFIABLE` is only used when `caption_used` is `UNKNOWN`, and the rule that `DIFFERS`/`UNVERIFIABLE` are never recorded or reported as a match. This is well aligned with the Owner direction.
- **Invalidation / staleness behavior:** Doc D §3.8 and §3.11 already define `STALE`, RunHistory invalidation events, append-only decisions, and new G3 decisions for changed content. Doc B Stage 7 has a post-G3 change table. Doc E AC-18 relies on this.
- **Evidence model:** Doc D §3.1 and the Evidence Log provide the basic evidence-record shape.

### 3.2 What is partially covered

- **“Finalized snapshot” as a stable approved-version artifact:** The approved content state is currently represented by Script (`SCR`) + `caption_draft` + `cta` + `disclosure_plan` + the G3 decision + RunHistory invalidation behavior. That preserves a lot, but there is **no discrete immutable approved-snapshot record** that explicitly ties together the exact approved script version, caption, CTA, disclosure settings, link form, and destination variants at the moment of approval. The G3 decision is the approval event; it is not itself a full content snapshot.
- **Multiple destination variants and multiple artifacts per content:** Implied by the direction and partly addressable by multiple exports/publications, but not yet encoded as an explicit model.
- **Review/comparison history:** Caption comparison notes and screenshots exist as evidence, but there is no dedicated Review Record entity for pre-publication export review, publication verification, destination-to-destination comparison, or audience visibility checks.

### 3.3 What is not covered yet

- **Export Artifact entity:** No Artifact ID, no SHA-256 field, no local storage reference, no export timestamp, no export-status, no “file availability/integrity” field in the current Doc D entity definitions.
- **Content Library as a first-class model:** There is a `data/mission1/content-library.json` untracked file, but its shape is a flat item list with `CNT-1`, `filename`, `sha256`, `exported_at`, dimensions, and `status`. It does **not** currently model Content ID, Finalized Snapshot ID, Artifact ID as a stable identity, destination variant, export status edge cases, or review linkage. So this existing file is **interesting but not yet the contract model**; it is a separate untracked artifact and may be a draft, a prior shape, or an unrelated file. This proposal does not assume it is authoritative.
- **Review Record entity:** Not present.
- **Explicit verification taxonomy:** Caption/destination comparison semantics exist; the full five-type taxonomy is not yet stated.

### 3.4 Current data-model inconsistency to keep visible

- **Publication.asset_id vs Content Asset identity:**
  - Doc D §3.6: `asset_id` = “from asset record”
  - Doc D §3.5: Content Asset has `file_path`, `asset_kind`, `produced_by_tools`, `ai_use_notes`, `quota_state_during_production`, `script_id`. It has **no asset identifier field**.
  - Doc D §5: “`Publication.asset_id` refers to an asset record, but this document defines no identifier for the Content Asset record that the field can reference.”
  - This is a real inconsistency in the current model. The proposal resolves it by distinguishing:
    - **Content Asset** = production media asset (source/produced media)
    - **Export Artifact** = exact file produced by the export process
    - **Publication Record** = evidence a specific item was actually published to a destination

The proposal does **not** assume Content Asset and Export Artifact are the same thing.

---

## 4. Proposed Conceptual Model

### 4.1 One Content → Multiple Destinations → One Verification Center

The Owner direction’s intended product behavior can be expressed as:

- **One Content** is the logical content item.
- That Content may be exported to **multiple destinations/variants**.
- Each variant is an **Export Artifact** with its own identity and hash.
- Each actual publication is a **Publication Record** tied, when known, to its exact artifact.
- A **Verification Center** (Content Library) is the place where the Owner reviews, compares, and finds everything belonging to one Content.

This is a **design principle**, not yet a formal Requirement.

---

## 5. Proposed Entity/Relationship Model

### 5.1 Entity definitions (proposal)

#### A. Content

**Purpose:** stable identity of the logical content item, independent of revisions, exports, and publications.

**Proposed identity:** `Content ID`, for example `CNT-<n>` or a similar stable scheme chosen by the team.

**Proposed stable fields:**

- A human-meaningful title/name for the content work item, if the team wants one.
- The originating experiment/opportunity context reference, where applicable.
- The lifecycle state of the logical content item, if useful.
- Creation context and timestamps.

**Proposed mutable/derived fields (not part of stable identity):**

- Current “latest approved version” pointer, if the model uses one.
- A list of related snapshots/artifacts/publications.

**Relationship to existing records:**

- Likely one Content per creative work.
- If the existing MVP uses `EXP` as the content container, then `Content` may be a new explicit entity that relates to `EXP` rather than replacing it. The proposal intentionally does not force a single mapping here; it leaves the exact mapping to the team after Owner scope decisions.

**Existing equivalent?**

- **NOT VERIFIED** that any existing entity already means exactly “logical Content independent of revisions/exports/publications.” The current model has `EXP`, `SCR`, `Content Asset`, and `PUB`. Those are close to parts of the idea, but none is clearly “the stable Content identity” in the sense the Owner direction describes.

#### B. Finalized Snapshot

**Purpose:** immutable record of the exact content state approved at Finalize.

**Proposed identity:** `Finalized Snapshot ID`, for example `SNAP-<n>`.

**Proposed fields:**

- `id`
- `content_id`
- `approved_script_id` — the exact SCR version approved
- `caption` — the approved caption at approval time, or the approved caption reference
- `cta` — the approved CTA at approval time, or reference to the exact approved CTA state
- `disclosure_settings` — the approved disclosure settings at approval time
- `link_form` — approved link form, where applicable
- `affiliate_link_or_link_context` — where applicable; this should not embed credentials
- `destination_variant` — which platform/format variant this snapshot covers, if the Content has multiple
- `approval_decision_id` — the G3 (or relevant) Decision record that approved this snapshot
- `approved_at` — approval timestamp
- `approver` — who approved; in ACE this is the Owner/operator
- `evidence_refs` — any evidence relevant to the approval
- `source_reference` — what was reviewed to produce the snapshot

**Rules:**

- A later edit does **not** silently mutate an earlier Finalized Snapshot. A changed approved state is represented as a new snapshot (or a new approved version referencing the prior one), with the prior snapshot preserved.
- Re-finalization produces a new snapshot; the prior approved state remains readable.
- The G3 Decision Record is the **approval event**; the Finalized Snapshot is the **persistent approved content state**. The proposal treats them as complementary, not interchangeable. The G3 record alone may not fully preserve the approved content state unless the approved state is explicitly carried in or referenced by the snapshot and its evidence.

**Relationship to G3:**

- The snapshot should reference the G3 decision that approved it.
- The snapshot should carry enough approved-state detail that a later comparison can answer “what was approved?”
- If the existing G3 rationale does capture the key approved fields, then the snapshot may mostly formalize what is already intended. If it does not, then the snapshot adds the missing durable approved-state record. This is a **design clarification**, not a claim that the current G3 record is defective.

#### C. Export Artifact

**Purpose:** one record per distinct exported file.

**Proposed identity:** `Export Artifact ID`, for example `ART-<n>`.

**Proposed fields:**

- `id`
- `content_id`
- `finalized_snapshot_id` — which approved version this artifact derives from, when known
- `file_name`
- `format` and relevant export settings
- `destination_variant` — if applicable, e.g. TikTok vs Facebook vs YouTube variant
- `sha256`
- `local_storage_reference` — where the file is stored locally
- `exported_at`
- `export_status`
- `file_availability_and_integrity_status` — e.g., present and hash-verified, present but hash stale, missing, moved, replaced, corrupted

**Key distinctions:**

- **Artifact ID ≠ SHA-256.**
  - Artifact ID identifies the **logical exported artifact** in the system’s record model.
  - SHA-256 verifies the **exact file bytes**.
  - They can diverge: two different export events may produce byte-identical files; one artifact record or two is a modeling choice; either way, identity and byte verification are separate concerns.

**Identical bytes exported twice:**

- If the team wants “one artifact per distinct file content,” then identical bytes map to one artifact and multiple export events reference it.
- If the team wants “one artifact per export event,” then byte-identical exports are still separate artifacts that happen to share a SHA-256.
- The proposal does not hard-code one answer. It recommends the team choose one rule and document it, because the choice affects re-export, republication, and comparison semantics.

**Re-export after a change:**

- A changed export produces either:
  - a new Export Artifact with a new ID and new SHA-256, or
  - a new export event referencing a new artifact, depending on the team’s chosen identity rule.
- The prior artifact and its hash remain preserved.

**Missing / moved / replaced / corrupted files:**

- Record the artifact with an explicit availability/integrity status, not by silently deleting it.
- If a file is missing, the artifact is `MISSING` with a reason.
- If a file is replaced by different bytes, the old SHA-256 no longer matches; record the mismatch explicitly.
- Do **not** use file path as stable artifact identity. A path is a location hint, not an identity.

#### D. Publication Record

**Purpose:** one record for each actual publication event/destination.

**Proposed identity:** `Publication ID`, for example `PUB-<n>` or reuse/align with existing PUB conventions only after the team confirms the mapping.

**Proposed fields:**

- `id`
- `content_id`
- `finalized_snapshot_id` — when known
- `export_artifact_id` — nullable only when genuinely unknown
- `platform` and `account/handle`
- `destination_url`
- `actual_publication_timestamp`
- `actual_caption` and relevant metadata
- `disclosure/link information`, where applicable
- `publication_evidence`
- `verification_status`

**Reconciliation with existing `Publication.asset_id`:**

- If `asset_id` currently means “the production Content Asset used,” then the proposal says: keep the distinction clear.
- In the proposed model, the publication record should reference the **Export Artifact used, when known**, and it may also reference the **Content Asset** if that is a separate and relevant provenance link.
- Do not assume Content Asset == Export Artifact.

**How to record a publication when:**

- **Exact artifact known:** `export_artifact_id` is set to the known artifact ID; provenance is explicit.
- **Artifact suspected but not verified:** record the suspected artifact reference in a separate “suspectedArtifact” or “artifact_note” field with a clear unknown marker; do **not** set the authoritative `export_artifact_id` to an unverified value.
- **Artifact unknown:** `export_artifact_id` is `UNKNOWN` with a reason; no guessing.
- **URL unavailable:** record the publication with the URL unknown, or with the URL field `UNKNOWN` and a reason, plus whatever evidence does exist.
- **Post edited or removed after initial publication:** retain the original Publication Record as the record of what was captured at that time; if a later edit/removal is relevant, add a new record or note rather than overwriting.
- **Same artifact published more than once or to multiple destinations:** multiple Publication Records can reference the same Export Artifact ID; each publication is its own destination record.

**Rule:** never infer artifact identity from a matching file name, similar appearance, or URL alone.

#### E. Review Record

**Purpose:** a separate record for each review/check event; do not overwrite historical reviews when a new review is done.

**Proposed identity:** `Review ID`.

**Proposed fields:**

- `id`
- `review_type`
- `subject references` — Content / Snapshot / Artifact / Publication as applicable
- `what was compared and against which reference`
- `reviewer`
- `review_timestamp`
- `findings and differences`
- `outcome`
- `evidence_references`
- `limitations and UNKNOWN fields`

**Review types to support:**

- Pre-publication Export Review
- Publication Verification
- Destination-to-Destination Comparison
- Audience Visibility Check, if feasible as a manual Phase 1 check

**Clarify comparisons:**

- Some reviews are single-subject checks (for example “does this exported file exist and match its expected hash?”).
- Some are comparisons between two or more subjects (for example “exported TikTok artifact vs live TikTok post,” or “TikTok post vs Facebook post”).
- The Review Record should state the comparison subjects explicitly so later readers know what was compared.

#### F. Evidence

**Purpose:** explain how exported files, hashes, screenshots, review notes, and other evidence are referenced and retained.

**Proposed evidence rules:**

- Evidence carries:
  - what was captured
  - when it was captured
  - which artifact/publication/review it relates to
  - who or what produced it
  - whether it is direct evidence, a human observation, or an AI-generated hypothesis
- Evidence must preserve provenance and must not be treated as proof of more than it actually establishes.
- A screenshot or URL opening is **not** proof of every aspect of publication correctness.

---

## 6. Verification Taxonomy

The proposal separates verification into five kinds.

### 6.1 Finalize Verification

- **What is being verified:** does the approved snapshot contain the required approved content and approval evidence for the version that was finalized?
- **Evidence required:** the Finalized Snapshot, the approval decision, and the evidence/references the snapshot carries.
- **What it can prove:** what was approved and when.
- **What it cannot prove:** what was later published, whether the published item matches the approved item, or whether any external audience saw it.
- **Possible outcomes:** `MATCH` (snapshot is complete and consistent with the approval), `INCOMPLETE` (snapshot missing required approved-state fields), `UNVERIFIABLE` (required approved-state field cannot be established).

### 6.2 Export Verification

- **What is being verified:** does the exported file correspond to the intended snapshot/variant and pass file-integrity checks?
- **Evidence required:** the Export Artifact record, the local file, the SHA-256, and the file availability/integrity status.
- **What it can prove:** byte-level identity and local file integrity for the exported file.
- **What it cannot prove:** that a remote platform will display identical content, that the export matches the approved content in a semantic sense beyond file identity, or that any publication occurred.
- **Possible outcomes:** `MATCH` (file present and SHA-256 matches the expected artifact), `MISMATCH` (file present but hash differs from expected), `MISSING` (file not available), `UNVERIFIABLE` (cannot establish the expected hash or file state).

### 6.3 Publication Verification

- **What is being verified:** does the destination publication correspond to the intended artifact/snapshot?
- **Evidence required:** Publication Record, the referenced Export Artifact (when known), destination evidence such as a live-post screenshot or URL capture, and the comparison evidence.
- **What it can prove:** that a publication record exists with the recorded evidence; and, for specific checked dimensions, whether the checked dimension matches the reference.
- **What it cannot prove:** that every dimension of the publication matches the approved content, that every viewer saw the same thing, or that a remote platform has not transformed the media.
- **Possible outcomes:** `MATCH` for the checked dimension, `DIFFERS` for the checked dimension, `UNVERIFIABLE` where the dimension cannot be checked, `NOT_APPLICABLE` where the dimension does not apply.

### 6.4 Destination Comparison

- **What is being verified:** how two or more destinations differ for the same Content/variant.
- **Evidence required:** the subjects being compared and the comparison evidence for each dimension checked.
- **What it can prove:** the observed differences/similarities for the checked dimensions between the compared subjects.
- **What it cannot prove:** that untested dimensions are identical, or that either destination is universally visible.
- **Possible outcomes:** per-dimension `MATCH`, `DIFFERS`, `UNVERIFIABLE`, `NOT_APPLICABLE`.

### 6.5 Audience Visibility Check

- **What is being verified:** can an external viewer access and see the publication under the conditions actually tested?
- **Evidence required:** the tested access conditions and the observed result.
- **What it can prove:** access and visibility under the tested conditions.
- **What it cannot prove:** universal visibility to every audience member, or that the content is unchanged since the test.
- **Possible outcomes:** `VISIBLE` under the tested conditions, `NOT_VISIBLE` under the tested conditions, `UNVERIFIABLE` where the check cannot be performed or interpreted.

### 6.6 Preserved distinction

The proposal preserves:

- `MATCH`
- `DIFFERS`
- `UNVERIFIABLE`
- `NOT_APPLICABLE`

and treats `UNVERIFIABLE` as **not** equivalent to `MATCH`.

---

## 7. Phase 1 Human Workflow

Proposed end-to-end Phase 1 workflow:

1. **Finalize / G3 approval**
   - Human action: review and approve the content design.
   - System action: record the approval and create the Finalized Snapshot for the approved version.
   - Inputs: reviewed script/caption/CTA/disclosure/link form and any variant info.
   - Outputs/records: G3 decision + Finalized Snapshot.
   - Failure/recovery: if approval conditions are not met, no snapshot is created for publication; revision loops back as already defined.
   - External access: none required.

2. **Export**
   - Human action: export the approved content to the intended destination variant(s).
   - System action: create Export Artifact records with file name, format, destination variant, SHA-256, local storage reference, export timestamp, and availability/integrity status.
   - Inputs: the finalized snapshot/variant, export settings.
   - Outputs/records: one Export Artifact per exported file.
   - Failure/recovery: if an export fails or the file is not produced as expected, record the artifact status explicitly; do not fake a hash.
   - External access: none required for the local export artifact model.

3. **Store files in local Content Library**
   - Human action: place the exported files in local storage.
   - System action: record the local storage reference and file state.
   - Outputs/records: local file + Export Artifact record.
   - Failure/recovery: missing/moved files are recorded as such.
   - External access: none required.

4. **Review exported files**
   - Human action: open and review exported files from the Verification Center.
   - System action: support opening, comparison, and review record creation.
   - Outputs/records: Export Review Records.
   - Failure/recovery: if a file cannot be opened or verified, record `UNVERIFIABLE` with a reason.
   - External access: none required.

5. **Owner manually publishes externally**
   - Human action: publish manually in the platform.
   - System action: none that publishes; only record-keeping.
   - Outputs/records: Publication Record and URL and timely evidence.
   - Failure/recovery: platform-side failure handled as a manual retry or halt, not automation.
   - External access: required for the actual publish, but only by the human operator.

6. **Record Publication Records and URLs**
   - Human action: enter the publication record with destination URL, timestamp, caption, and evidence.
   - System action: validate and retain the record.
   - Outputs/records: Publication Records.
   - Failure/recovery: if URL or caption cannot be captured, record `UNKNOWN` with reason.
   - External access: only to capture the manual publication evidence.

7. **Perform manual destination reviews**
   - Human action: open the live destination and review.
   - System action: support review record creation and comparison.
   - Outputs/records: Publication Verification Review Records.
   - Failure/recovery: if the destination cannot be reached or checked, record `UNVERIFIABLE`.
   - External access: required for the manual review.

8. **Compare publication against the intended snapshot/artifact**
   - Human action: compare as appropriate (caption, CTA, disclosure, link, media where checkable).
   - System action: support comparison and outcome recording.
   - Outputs/records: comparison Review Records.
   - Failure/recovery: per-dimension `UNVERIFIABLE` is allowed.
   - External access: only as needed for manual comparison.

9. **Compare destinations where multiple publications exist**
   - Human action: compare multiple destination publications belonging to one Content.
   - System action: support cross-destination comparison.
   - Outputs/records: destination-comparison Review Records.
   - External access: only as needed for manual comparison.

10. **Retain Review Records and evidence**
    - Human action: keep evidence and review history.
    - System action: preserve append-only records and evidence references.
    - External access: none required for retention.

### 7.1 Finding everything for one Content

The Owner should be able to open one place — the Verification Center / Content Library view for a Content — and see:

- the Content
- its Finalized Snapshot(s)
- all Export Artifacts for that Content
- all Publication Records for that Content
- all Review Records for that Content
- evidence references for each

The proposal recommends a single navigable “Content → everything” view as the main UI/UX outcome of this model.

---

## 8. Lifecycle and Edge-Case Rules

Proposed rules:

- **Editing content after Finalize:** the edited content is a new version; the prior Finalized Snapshot is preserved; the new approved version is represented by a new snapshot when approved.
- **Re-finalizing:** create a new Finalized Snapshot; preserve the prior approved state.
- **Exporting multiple platform variants:** one Export Artifact per distinct exported file/variant, each with its own identity and hash.
- **Exporting the same variant again:** governed by the team’s chosen identity rule — either one artifact with multiple export events, or separate artifacts that happen to share a hash. Either way, the prior artifact/hash is preserved.
- **Identical hashes across two export events:** do not treat identical hash as proof of identical provenance, only of identical bytes. Record the export event context separately.
- **File moved or deleted:** record availability/integrity status accordingly; do not delete the artifact record silently.
- **File replaced with different bytes:** old SHA-256 no longer matches; record mismatch explicitly.
- **Hash mismatch:** record `MISMATCH` or `UNVERIFIABLE` rather than pretending integrity.
- **Publication with unknown artifact source:** `export_artifact_id` is `UNKNOWN` with reason; no guessing.
- **Publication edited after verification:** retain the original record; record the later edit as a new event/record if relevant.
- **Publication removed or URL no longer accessible:** retain the original Publication Record; note the current state if relevant.
- **Multiple reviews with conflicting findings:** keep both reviews; do not overwrite; the conflict is information.
- **Destination comparison where one side is UNVERIFIABLE:** the comparison result for that side/dimension is `UNVERIFIABLE`; the other side’s result remains independent.
- **Audience visibility that changes over time:** a visibility check proves only the tested moment/conditions; later changes require a new check if relevant.

General rule: **do not silently overwrite historical evidence or historical review results.**

---

## 9. Existing Contract and AC Impact Matrix

Legend: `COVERED` / `PARTIALLY COVERED` / `NOT COVERED` / `NOT VERIFIED`.

| Affected area | Current coverage | Existing source | Proposed change/addition | Type | Phase | Decision authority before editing |
|---|---|---|---|---|---|---|
| Finalized Snapshot | PARTIALLY COVERED | Approval exists via G3 + Script + Doc B Stages 6–7 + Doc D §3.8/§3.11; no discrete immutable snapshot record in current Doc D entities | New entity: Finalized Snapshot; clarify G3 = approval event, Snapshot = durable approved state | Data-model change + clarification | Phase 1 | Owner scope decision + any required contract amendment |
| Content (stable identity) | NOT COVERED as explicit stable Content entity | Existing entities: EXP, SCR, Content Asset, PUB | New or clarified Content entity; define stable identity | Data-model change / clarification | Phase 1 | Owner scope decision |
| Export Artifact identity | NOT COVERED | No Artifact ID/SHA-256/local storage/export status in current Doc D entities; `data/mission1/content-library.json` is untracked and not the contract model | New entity: Export Artifact with proposed fields | Data-model change | Phase 1 | Owner scope decision |
| Artifact ID vs SHA-256 | NOT COVERED | No current distinction in model | Clarify identity vs byte verification; document identity rule for identical-byte exports | Clarification | Phase 1 | Designer recommendation; Owner may ratify |
| Content Library | NOT COVERED as contract model | `data/mission1/content-library.json` exists but is untracked and does not model Content/Snapshot/Artifact/Review linkage | First-class Content Library / Verification Center model | Data-model + workflow + UI concept | Phase 1 | Owner scope decision |
| Pre-publication export review | NOT COVERED as a dedicated review type | Caption/asset QA exists pre-publication, but no dedicated Export Review Record | New Review Record type + export review step | Workflow + data-model change | Phase 1 | Owner scope decision |
| Publication Record / artifact linkage | PARTIALLY COVERED | Doc D §3.6 + FR-7 + Stage 7 + AC-06/AC-18/AC-19 | Extend Publication Record to reference Finalized Snapshot and Export Artifact; clarify `asset_id` semantics | Data-model change + clarification | Phase 1 | Owner scope decision; must also resolve `Publication.asset_id` |
| Publication with unknown artifact | NOT COVERED as explicit rule | Current model allows `caption_used: UNKNOWN`; no explicit artifact-unknown provenance rule | Explicit `export_artifact_id: UNKNOWN` rule and suspected-artifact handling | Clarification / contract addition | Phase 1 | Designer recommendation; Owner may ratify |
| Review Record | NOT COVERED | No Review Record entity today; caption-comparison notes and screenshots exist as evidence | New Review Record entity for export review, publication verification, destination comparison, audience visibility | Data-model change | Phase 1 | Owner scope decision |
| Verification taxonomy | PARTIALLY COVERED | Caption/destination comparison semantics exist in Doc D §3.6 and AC-19 | State five-type taxonomy; add Export Verification and Audience Visibility concepts | Clarification / possible new AC | Phase 1 | Owner scope decision |
| `Publication.asset_id` / Content Asset identity | PARTIALLY COVERED with known inconsistency | Doc D §3.5, §3.6, §5 | Distinguish Content Asset vs Export Artifact vs Publication; resolve undefined asset identity | Data-model clarification / correction | Phase 1 | Owner scope decision |
| AC-06 | PARTIALLY COVERED for this direction | Doc E AC-06; working tree includes `caption_used` and comparison outcome | Keep AC-06 as publication-with-live-evidence criterion; do not overload it with artifact/export/verification taxonomy | Clarification (likely no AC change needed) | Phase 1 | Owner decision if any change is wanted |
| AC-18 | COVERED for publication correctness/completeness discipline | Doc E AC-18 | Keep AC-18 as publication correctness/completeness discipline; add export/library review concerns elsewhere if approved | Clarification (likely no AC change needed) | Phase 1 | Owner decision if any change is wanted |
| AC-19 | COVERED for caption persistence/comparison/screenshot attribution | Doc E AC-19; Doc D §3.6 | Keep AC-19 for caption + screenshot attribution; do not expand it into generic artifact-vs-destination comparison | Clarification (likely no AC change needed) | Phase 1 | Owner decision if any change is wanted |
| AC-07/AC-08 and performance linkage | PARTIALLY COVERED for future analytics linkage | Doc E AC-07/AC-08; Doc D §3.7/§3.9/§6 | Performance linkage to Content/Snapshot/Artifact is future; current linkage is via EXP/PUB/OBS | Future clarification | Phase 2 for artifact-level analytics | Owner decision if expanded |
| Evidence and invalidation behavior | COVERED | Doc D §3.1, §3.8, §3.11; Doc B Stage 7; Doc E AC-18 | Reuse existing evidence/invalidation behavior; add Export Artifact and Review Record evidence references | Clarification / reuse | Phase 1 | Designer recommendation; Owner may ratify |

### 9.1 AC amendments that may be needed — presented as proposals only

- If the Owner wants Export Verification, Audience Visibility, or Review Record traceability to be testable acceptance criteria, then new ACs or AC amendments may be needed.
- If the Owner wants Finalized Snapshot completeness to be tested separately from G3 approval completeness, then a new AC or subcondition structure may be needed.
- These are **proposals**, not approvals, and they do not change any existing AC here.

---

## 10. Phase 1 vs Phase 2 Recommendation

### 10.1 Phase 1 recommendation

Phase 1 should include:

- First-class **Finalized Snapshot**
- First-class **Export Artifact** with Artifact ID, SHA-256, local storage reference, export status, and file availability/integrity status
- **Content Library / Verification Center** as the single place to find and review everything for one Content
- **Pre-publication export review**
- **Manual publication recording**
- **Manual destination URL review**
- **Manual comparison** between approved content, exported artifacts, and published destinations
- **Manual comparison** across multiple destination publications
- **Review Records** and associated evidence retention
- **Explicit unknown-artifact provenance handling**

Dependency/reason: these are all local, inspectable, human-operated capabilities. They do **not** require platform API access or automated publication, and the Owner direction explicitly lists them as intended Phase 1 target capabilities. Their absence from the current contract is a **gap to add**, not a reason to defer.

### 10.2 Phase 2 recommendation

Phase 2 should include:

- Platform API integrations
- Automated publishing
- Automated retrieval/verification of remote publication content
- Automated cross-platform performance analytics
- Expanded artifact-/variant-level performance analysis
- Other automation requiring external platform capabilities

Dependency/reason: these require external platform capabilities, automation, and possibly credentials/terms that are not part of the current Phase 1 scope. They are appropriately later.

### 10.3 Important boundary note

Do **not** defer a Phase 1 capability merely because it requires a new local data entity or a new contract. A new local entity is a normal part of Phase 1 expansion when the Owner approves the capability.

---

## 11. Owner Decision Questions

These are the decisions that genuinely require the Owner’s authority.

1. **Phase 1 capability boundary:** Is the Owner-approved list of Phase 1 target capabilities accepted as written here — Finalized Snapshot, Export Artifact identity, Artifact ID and SHA-256, local storage reference, local Content Library, pre-publication export review, manual publication recording, manual destination URL review, manual comparison, cross-destination comparison, Review Records, and explicit unknown-artifact provenance handling?

2. **First-class concepts:** Does the Owner want Finalized Snapshot, Export Artifact, Content Library, and Review Records to become first-class Phase 1 concepts in the normative contract, or are some of them intentionally later?

3. **Content identity mapping:** Should “Content” be a new explicit stable entity, or should the existing `EXP`/creative-work container be clarified as the Content identity? This affects downstream relationships.

4. **`Publication.asset_id` resolution:** Does the Owner want `asset_id` to mean the production Content Asset, the Export Artifact used, both via separate fields, or some other resolution? This is a real current inconsistency and needs a decision before normative edits.

5. **Artifact identity rule for identical bytes:** Should identical exported bytes be one artifact with multiple export events, or separate artifacts that happen to share a SHA-256? The proposal can support either, but the team must choose.

6. **Review type scope:** Does the Owner want the full five-type verification taxonomy as defined review types in Phase 1, including Audience Visibility Check as a manual check, or only a subset?

7. **Acceptance criteria changes:** Does the Owner want any new ACs or AC amendments to make these capabilities testable, or is the current AC set sufficient for the Owner’s intent once the data model and workflow are added?

8. **Whether `data/mission1/content-library.json` is related:** Is the existing untracked `content-library.json` an earlier draft of the Content Library concept that should inform this design, or is it unrelated and not authoritative? The proposal intentionally does not assume either answer.

---

## 12. Explicit Non-Authorization Statement

This proposal:

- does **not** create, amend, or approve any Requirement, Acceptance Criterion, Decision Record, Evidence entry, Gate, WorkflowState, RunHistory, or budget
- does **not** modify any repository file
- does **not** implement any code, schema, migration, UI, test, or automation
- does **not** grant any external access, publication, test click, spend, or automation authorization
- does **not** assume the Owner has approved implementation

It is a **design proposal only**, returned in-session for Owner review.

---

**DATA MODEL & PHASE BOUNDARY DESIGN PROPOSAL COMPLETE — READ-ONLY — NO FILES MODIFIED — NO IMPLEMENTATION — OWNER DECISION REQUIRED**
