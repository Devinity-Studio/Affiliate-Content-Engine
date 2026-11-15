# ACE — Content Library & Publication Verification Reconciliation

**Mode:** READ-ONLY — NO FILES MODIFIED — NO IMPLEMENTATION

**Baseline inspected for this report:**

- Repository root: `Y:/DevProject/Affiliate Content Engine` (working directory)
- Branch: `mission1-planning-docs`
- HEAD: `795dc0a6ac66bef19725184107e6474b41aa1823`
- Working-tree status at inspection:
  - `M docs/mission1/A-product-specification.md`
  - `M docs/mission1/E-vertical-slice-acceptance.md`
  - `M docs/mission1/D-data-model.md`
  - `M docs/mission1/C-system-architecture.md`
  - `M docs/mission1/B-workflow-specification.md`
  - `?? docs/mission1/I-ux-ui-design-specification.md`
- The eight core slice docs are all present at the expected paths.

Where this report states a difference between HEAD `795dc0a` and the current working tree, that difference was read directly from `git show 795dc0a:<file>` versus the current file contents. Where a section is labelled `NOT VERIFIED`, that label reflects the absence of an identifiable authoritative source that I could inspect for this specific claim in this task; it is not a claim that the claim is false.

---

## 1. Verified Baseline

**Verified facts**

- The repository is on branch `mission1-planning-docs` at HEAD `795dc0a6ac66bef19725184107e6474b41aa1823`.
- The core document set is present:
  - `docs/mission1/A-product-specification.md`
  - `docs/mission1/B-workflow-specification.md`
  - `docs/mission1/C-system-architecture.md`
  - `docs/mission1/D-data-model.md`
  - `docs/mission1/E-vertical-slice-acceptance.md`
  - `docs/mission1/G-open-questions-decision-log.md`
  - `docs/mission1/H-evidence-register.md`
  - `docs/mission1/I-ux-ui-design-specification.md`
- The working tree contains modified tracked docs (`A`, `B`, `C`, `D`, `E`) and an untracked UI spec (`I`).
- Decision records currently present in `data/mission1/decision-log.md`:
  - `DEC-1-G1`, `DEC-1-2`, `DEC-1-3`, `DEC-1-4`, `DEC-1-5`, `DEC-1-6`.
- The Evidence Log currently contains `EV-1-1` through `EV-1-12` plus the `## Remaining Phase 1 captures (not evidence)` block.

**Not verified in this task**

- Whether any of the modifications in the working tree were itself authorized by an Owner Decision Record. This report reads the files; it does not adjudicate authorization except where a Decision Record explicitly states itself as the authority for a specific change.
- Whether any Execution/Application artifact beyond those listed above exists in the active scope for this reconciliation task.

---

## 2. Current Contract Reconciliation

### 2.1 Finalize

**Owner-approved design direction requires:** a pre-publication final approval point that establishes a stable snapshot of the approved content at the moment of approval — what version was approved, including text, media, captions, links, and destination-specific variants — and that this proves what was approved, not what was published.

**Current state: PARTIALLY COVERED**

What is already present in the current reconciliation baseline:

- Doc A:
  - `FR-5 Content Production` preserves `script/storyboard/CTA/planned caption` as one coordinated content design that the operator edits and finalizes before production.
  - `FR-6 QA & Approval (Gate G3)` requires owner review and approval before publication.
  - The workflow sequence in Doc A `FR-5`/`FR-6` now explicitly places G3 after production and before publication.
- Doc D:
  - `Script` (`§3.4`) carries `caption_draft` and `cta`, and the rules state these are one coordinated content design conforming to the experiment's `content_blueprint`.
  - `Decision record (§3.8)` exists as an append-only record type.
  - `RunHistory (§3.11)` records invalidation as an append-only event and expressly does not edit the original decision.
- Doc B:
  - `Stage 6 (Gate G3)` and `Stage 7 (Gate G4)` establish the approval-before-publish boundary.
  - Staff `Stage 7` post-G3 change handling defines `STALE` and requires a new G3 decision before publishing changed text.
- Doc E:
  - `AC-05` requires a G3 Decision record APPROVED (or REJECTED with revision loop) before publication.
  - `AC-06` now requires `caption_used` and the caption-comparison outcome.
  - `AC-16`, `AC-17`, `AC-18`, `AC-19`, `AC-20`, `AC-21` address caption/CTA/content-design lifecycle and publication correctness.
- Doc I:
  - `S7 — Publish & Confirm` workspace and controls carry the caption-comparison outcome and screenshot uploader, and the `Next` rule requires a complete publication record including `caption_used` (or `UNKNOWN`) and the comparison outcome and at least one screenshot.

What is missing or incomplete for the exact “Finalize snapshot” concept:

- **No explicit Finalize Snapshot record or artifact exists yet.** The current model captures the approved design through `Script`/`caption_draft`/`cta` plus the G3 Decision record and its rationale, but there is no dedicated “approved snapshot” entity in the current Doc D schema that ties together the exact approved script version, caption, CTA, disclosure settings, link form, and destination-specific variant at the moment of approval.
- The current model does **not** yet establish a stable, reviewable snapshot identity separate from the mutable script-asset-publication lifecycle. Existing records reference script versions and publication records, but the reconciliation for Finalize is stronger on lifecycle integrity than on a discrete approved-snapshot artifact.

**Verdict:** The approval point and the “what was approved” content fields are largely present; the “stable snapshot” as a first-class record/artifact is not yet defined in the current schema. This is a design gap to be specified, not a contradiction with existing contracts.

---

### 2.2 Local Content Library (exports)

**Owner-approved design direction requires:** Content Library begins its role immediately after Export, not only after publication. It stores exported files locally, maintains traceability to the originating Content and Finalized Snapshot, supports opening and reviewing exported files from the library, supports pre-publication verification of exported files, and preserves identity and integrity of each exported artifact.

**Current state: NOT COVERED AS A FIRST-CLASS CONTRACT**

What the current documents do address:

- Doc B mentions exports only in a limited, narrow scope. My read of the current Doc B stage definitions did not surface an Export/Artifact/Library lifecycle as a first-class contract in the stage definitions I inspected. Export as a dedicated stage or library with artifact identity is not present in the current workflow stage definitions I read for this reconciliation.
- Doc A `FR-8 Results Tracking & Measurement` mentions `method: enum SCREENSHOT / EXPORT_CSV / MANUAL_COPY` inside `ResultObservation`, which implies exports may exist as evidence-capture methods in the results layer. That is an evidence-capture reference, not a content-library/export-artifact contract.
- Doc D does not currently define an Export Artifact entity with Artifact ID, SHA-256, local storage reference, and linkage to originating Content/Finalized Snapshot.
- Doc A `FR-7 Publication & Distribution` records the publication side, not the local export-artifact side.

**What is specifically missing:**

- No current Export Artifact entity.
- No current Artifact ID or SHA-256 field in the current Doc D entity definitions I inspected.
- No current local storage reference field tied to an export artifact in the current entity definitions.
- No current one-content-to-many-artifacts model (for example TikTok/Facebook/YouTube variants) in the current schema I inspected.
- No current pre-publication export review step in the workflow stage definitions I inspected.

**Verdict:** The current documents establish publication records, evidence capture methods, and a results layer, but they do not yet establish the Content Library and Export Artifact concept that the Owner-approved design direction describes. This is an addition/gap, not a conflict.

---

### 2.3 Artifact Identity and Hash

**Owner-approved design direction requires:** each distinct exported file/artifact has its own Artifact ID, its own SHA-256 hash, its local storage reference, its originating Content ID and Finalized Snapshot reference, and relevant format/destination-profile/export metadata where applicable. Hash proves byte-level identity only; it is not a publication URL and not a substitute for a Publication Record. One Content may have multiple artifacts.

**Current state: NOT PRESENT**

Directly inspected facts:

- Doc D entity definitions I inspected (`§3.1 Evidence`, `§3.2 Opportunity`, `§3.3 Experiment`, `§3.4 Script`, `§3.5 Content Asset`, `§3.6 Publication`, `§3.7 ResultObservation`, `§3.8 Decision`, `§3.9 CycleReport`, `§3.10 WorkflowState`, `§3.11 RunHistory`, `§3.12 CostBudget`, `§3.13 CWI`) do not include an Export Artifact entity with Artifact ID / SHA-256 / local storage reference / Finalized Snapshot linkage.
- The current Doc D `§3.5 Content Asset` does not yet define an asset-version identifier or an export-artifact derivative; my exact read of the current `§3.5` is unchanged from HEAD on that note — it still records assets by file path and defines no asset-version field.
- Doc D current `§3.6` now includes `caption_used`, `disclosure_settings_applied`, `evidence_files`, and `status`, and includes caption comparison rules. It is stronger on publication-side identity than on export-artifact identity.
- `§3.13 CWI` exists but is a separate runtime work-item contract, not an export-artifact contract.

**Verdict:** This requirement is not yet encoded in the current repository material. It must be added through schema/contract design. It is consistent with current publication identity only if the new design is written so that hash is never treated as a publication proof.

---

### 2.4 Publication Records and Destination URLs

**Owner-approved design direction requires:** each actual publication has its own Publication Record; the record traces the relevant Content, the Export Artifact used when known, the destination platform/account, the actual published URL, actual publication timestamp, actual caption and relevant published metadata, and evidence/verification status. The relationship must support one Content → multiple artifacts, one artifact → multiple publications/republication, multiple destinations, and incomplete or untraceable source artifacts without inventing relationships.

**Current state: PARTIALLY COVERED**

What is already present:

- Doc D `§3.6 Publication`:
  - Current `§3.6` includes `id`, `experiment_id`, `asset_id`, `platform / handle`, `live_url`, `posted_at`, `link_form_used`, `affiliate_link_used`, `caption_used`, `disclosure_settings_applied`, `evidence_files`, `status`.
  - This addresses the core publication record fields the Owner direction names: destination platform, URL, timestamp, affiliate link, actual caption (or `UNKNOWN`), and evidence.
- Doc A `FR-7`:
  - `FR-7.1` states publishing is a manual operator action and the engine may prepare a kit but must never auto-publish in Slice 1.
  - `FR-7.2` states the publication record stores platform, exact URL/handle, exact posting timestamp, exact affiliate link used, exact caption published (or `UNKNOWN`), link form, and a screenshot of the live post as evidence.
  - `FR-7.3` restricts link forms to channel-policy-verified forms.
- Doc B `Stage 7`:
  - Current `Stage 7` captures live post URL, timestamp, link form used, the caption text as published, and screenshot of live post; records publication with `caption_used` verbatim or `UNKNOWN` and the caption-comparison outcome.
- Doc E:
  - `AC-06` defines the publication-record evidence expectations.
  - `AC-18` addresses publication correctness, coverage, and completeness discipline.
  - `AC-19` addresses caption persistence, comparison, and screenshot attribution.
  - `AC-20` addresses asset-affecting changes and new publication records.

What is incomplete:

- The current model links Publication to `asset_id` from an asset record, but Doc D current `§3.5` does not define an asset identifier that `asset_id` can reliably reference. Doc D `§5` explicitly states this: “`Publication.asset_id` refers to an asset record, but this document defines no identifier for the Content Asset record that the field can reference.” That is a real gap.
- The current model links Publication to `experiment_id`, not directly to a Content/Finalized Snapshot identity in the sense of the Owner direction’s “originating Content and Finalized Snapshot reference.” That linkage can plausibly be traced via EXP and SCR, but it is not a single explicit Content-to-Finalized-Snapshot-to-Artifact-to-Publication chain in the current schema.
- Multiple-artifact and multiple-publication-per-artifact support is implied by republishing rules in Doc B Stage 7 (`changes after G4 / after publication → new publication record`) and Doc D entity rules, but the explicit one-to-many artifact model and artifact-to-publication mapping are not yet a defined schema in the inspected material.
- Unknown/untraceable source artifact handling is not an explicit field/rule in the current Publication schema I inspected. The current system can presumably record a publication with partial linkage, but it does not yet have a named rule for “PUB exists, source artifact UNKNOWN, no invented relationship.”

**Verdict:** Publication record fields are substantially present and improved versus HEAD. The remaining gaps are: explicit asset identity for the `asset_id` reference, explicit Content/Finalized-Snapshot-to-Artifact-to-Publication chain, explicit multiple-artifact/multiple-publication model, and explicit unknown-source-artifact handling.

---

### 2.5 Review and Comparison from Content Library

**Owner-approved design direction requires:** Content Library provides a central place to open and review local exported files, open published destination URLs, review actual published content, compare local exported artifacts against corresponding published destinations, compare different destination publications against each other, and record review findings, differences, evidence, and timestamps. Review must be possible after export and before publication, as well as after publication. It must support convenient side-by-side comparison where technically feasible. Review must not silently modify finalized snapshots or exported artifacts; edited content must create a new version/artifact and follow the appropriate approval process.

**Current state: PARTIALLY COVERED — mostly at the publication-review layer, not yet a general export-library comparison layer**

What is present:

- There is a defined publication review/comparison concept in the current material:
  - Doc D `§3.6` caption comparison rules define a comparison outcome and a comparison note stored under `evidence_files`.
  - Doc B `Stage 7` requires comparison of the to-be-published caption/CTA against the G3-reviewed text before publishing.
  - Doc E `AC-19` and `AC-06` cover caption comparison persistence and the screenshot attribution rules.
  - Doc I `S7` surface the caption-comparison outcome and screenshot uploader and requires a complete publication record including the comparison outcome.
- There is a defined audit/evidence trail and a live-post screenshot evidence concept.
- The lifecycle rules prevent silent edits: edits create new versions; post-G3 changes require invalidation + new G3 decision; post-G4/asset changes require a new publication record.

What is missing:

- There is no explicit “open and review local exported files from one place” contract for the export library in the stage definitions or schema I inspected.
- There is no explicit “compare exported artifact against published destination” contract as a first-class review action beyond the caption comparison already embedded in publication handling.
- There is no explicit “compare multiple destination publications against each other” contract.
- There is no explicit review-record artifact (review finding, difference, evidence, timestamp) in the current schema I inspected, other than caption-comparison notes and evidence_files references.
- Pre-publication export review is not a defined stage in the current workflow definitions I inspected; the current pre-publication verification point is G3 approval of the content design, not a review of the exported artifact itself.

**Verdict:** The current docs already institutionalize caption/CTA comparison and screenshot evidence, which is a meaningful part of the Owner direction. But the broader “Content Library review and comparison hub” — including local export artifact review, cross-destination comparison, and explicit review-record retention — is not yet specified.

---

### 2.6 Verification Semantics

**Owner-approved design direction requires:** a clear distinction between Finalize Verification, Export Verification, Publication Verification, Destination Comparison, and Audience Visibility Check. Hash equality proves byte-level identity only. Opening a URL alone does not prove publication correctness. A local file hash does not prove that a remote platform displays identical content. Use explicit outcomes such as MATCH, MISMATCH, UNKNOWN; UNKNOWN must never be treated as MATCH.

**Current state: PARTIALLY COVERED — caption/destination-comparison semantics are present; the full verification-semantic taxonomy is not yet stated as such**

What is present:

- The current material already uses the key distinction between evidence and identity:
  - Doc D `§3.6` explicitly states: “The comparison is textual evidence only — it does not prove asset identity, and no hash or identifier binding is created.”
  - Doc D `§3.6` caption-comparison outcomes include `MATCH`, `DIFFERS`, `UNVERIFIABLE`, `NOT_APPLICABLE`.
  - Doc D `§3.6` states `UNVERIFIABLE` is used only when `caption_used` is `UNKNOWN`, and `DIFFERS` and `UNVERIFIABLE` are never recorded or reported as a match.
- Doc B `Stage 7` and Doc I `S7` reinforce comparison-before-publish and comparison recording.
- Doc A `FR-7` and Doc E `AC-06`/`AC-19` reinforce the publication verification and comparison expectations.
- The caption-comparison outcome vocabulary is present and already aligned with the direction’s explicit-outcome principle (at least for caption/destination comparison).
- The current material already treats `UNKNOWN` as a non-match rather than a positive verification.

What is incomplete:

- The explicitly named five-way verification taxonomy is not stated as a first-class taxonomy in the inspected material:
  - Finalize Verification — present implicitly through G3 approval and content-design snapshot concepts, but not labelled as a distinct verification type in the inspected material.
  - Export Verification — not yet defined; there is no current rule for verifying that the local exported file matches the expected output.
  - Publication Verification — present in AC-06/AC-18/AC-19 terms, but not explicitly labelled as a distinct verification type in a taxonomy.
  - Destination Comparison — present in caption comparison and screenshot scope, but not yet generalized.
  - Audience Visibility Check — not present as a defined check in the current material I inspected; this is the “can an external audience access and see the publication?” layer the Owner direction names.

**Verdict:** The semantics for caption/destination comparison are already strong and aligned with the direction. The gap is the explicit five-verification-type taxonomy, especially Export Verification and Audience Visibility Check, which are not yet defined.

---

### 2.7 Future Performance Analysis

**Owner-approved design direction requires:** the structure should preserve the ability to connect performance data to Content, Finalized Version, Export Artifact, Publication Record, and platform/destination, so outcomes can be compared across platforms and destination-specific variants. However, performance analytics must not be expanded into the current Phase 1 scope unless the existing approved contract already requires it.

**Current state: PARTIALLY COVERED — pipeline already exists for performance linkage at the publication/experiment layer; explicit artifact-level and variant-level performance comparison is not yet defined**

What is present:

- Doc D `§3.7 ResultObservation` and `§6 M1/M2` establish observation-level financial normalization and dashboard-field mapping.
- Doc D `§3.9 CycleReport` aggregates pipeline totals and normalized metrics.
- Doc A `FR-8` and `FR-9` establish scheduled observation and cycle reporting.
- Doc E `AC-07` and `AC-08` establish observation capture and evidence-traceable cycle reporting.
- Publication records link to experiment and asset, which provides a path from performance data back toward the content that produced it.
- Doc B `Stage 8` and `Stage 9` establish observation and reporting stages.

What is incomplete or future:

- The current model does not yet explicitly connect performance to a Finalized Version or Export Artifact as distinct linkage points. Performance is currently traceable to experiment/publication/asset, but not yet to a separate Finalized Snapshot or Export Artifact identity, because those are not yet defined.
- Cross-platform/destination-variant performance comparison is plausible via multiple publication records, but it is not yet an explicit requirement or supported schema in the inspected material.
- The explicit boundary rule — “do not expand performance analytics into Phase 1 unless the approved contract already requires it” — is not stated as an explicit constraint in the current inspected material, although Slice/Phase distinctions do appear elsewhere (for example, AC-15–AC-21 Slice-1 vs Phase-1 boundary in Doc E).

**Verdict:** The performance linkage foundation is present and consistent with the direction. The future part of the direction (artifact-level, finalized-version-level, multi-variant performance comparison) is not yet built, which is appropriate for the current scope. The current gap is not a contradiction; it is a future-capability note.

---

## 3. Proposed Conceptual Data Model

This section is a designer proposal for reconciliation only. It is not an approved requirement and does not modify any existing document.

### 3.1 Content

- `Content` is the primary creative container for one approved creative work.
- Identity: `Content ID` — one per creative work, stable across revisions where the work itself is the same logical content.
- Carries: planned content design reference, destination variants considered, approval linkage, lifecycle state.

### 3.2 Finalized Snapshot

- One `Finalized Snapshot` per approved version of a Content at the moment of approval.
- Snapshot identity: `Finalized Snapshot ID`.
- Captures at approval time: the exact script version reference, `caption_draft`, `cta` wording/placement, disclosure settings intended, link form, destination-specific variant identity if applicable, and the Decision record that approved it.
- Purpose: proves what was approved, not what was published.
- Immutable after creation for the approved version it represents; a new approval creates a new snapshot; the prior snapshot is retained as the historical approved version.

### 3.3 Export Artifact

- One `Export Artifact` per distinct exported file produced from a Finalized Snapshot or Content variant.
- Artifact identity: `Artifact ID`.
- Each artifact has its own `SHA-256` of the exact exported file bytes and its own local storage reference.
- Links to: originating Content ID and/or Finalized Snapshot ID, destination profile/format metadata where applicable, export metadata, and the export source/version it was produced from.
- Supports: one Content → many artifacts (TikTok/Facebook/YouTube variants, revised exports, re-exports).
- Missing/changed/duplicate/re-export handling:
  - Missing file: record the artifact with status `FILE_MISSING` and the reason; do not claim verification.
  - Changed file: a changed file is a new artifact or a flagged mismatch, not a silent overwrite of the original artifact’s hash.
  - Duplicate file: if two exports produce byte-identical files, that is an explicit finding, not an accidental merge; the artifact identity remains distinct per export event unless the design deliberately deduplicates by hash with a documented rule.
  - Re-export: a new export event may produce a new artifact with its own ID/hash/storage reference, and may reference the same originating snapshot.

### 3.4 Publication Record

- One Publication Record per actual publication event.
- Already largely present in Doc D `§3.6`; extended here to support the direction more explicitly.
- Links to: Content ID and/or Finalized Snapshot ID where known; Export Artifact ID where the source artifact is known; platform and account; actual published URL; actual publication timestamp; actual published caption and relevant published metadata; evidence and verification status.
- Supports: one artifact → multiple publications/republication; multiple destinations; different formats/variants.
- Unknown/untraceable source artifact: a Publication Record may exist with `source_artifact_id: UNKNOWN` and an explicit reason; the record must not invent a relationship.

### 3.5 Review Record

- A review record captures a comparison or review event.
- May be created pre-publication (after export, before publish) and post-publication.
- May compare: local exported artifact vs published destination; one destination publication vs another; exported artifact vs approved snapshot fields where applicable.
- Stores: what was reviewed, evidence used, findings/differences, outcome where applicable (for example MATCH/MISMATCH/UNKNOWN for a specific check), timestamp, and reviewer action.
- Does not silently modify the finalized snapshot or the exported artifact. Edits create new versions/artifacts and follow approval.

### 3.6 Evidence

- Evidence records already exist in Doc D `§3.1` and the Evidence Log.
- For this lifecycle, evidence includes: exported file references, screenshots, live-post evidence, export-verification files, comparison notes, review-record evidence files, and the caption-comparison note already defined in Doc D `§3.6`.

### 3.7 Relationships and cardinality

- One Content → many Finalized Snapshots over time (one per approved version).
- One Finalized Snapshot → many Export Artifacts (multiple destinations/variants).
- One Export Artifact → zero or many Publication Records.
- One Publication Record → one or many Review Records.
- Performance data links to Publication Record and, through it, to Content/Finalized Snapshot/Export Artifact where those identities exist.

---

## 4. Proposed End-to-End Lifecycle

This is a designer proposal for reconciliation only. It is not an approved workflow and does not modify Doc B, Doc I, or any existing contract.

1. **Finalize**
   - The operator/designer finalizes the content design (script, storyboard, CTA, planned caption, disclosure settings, link form, destination-specific variants).
   - G3 approves the content design.
   - On approval, a Finalized Snapshot is created/referenceable for the approved version.

2. **Export**
   - The approved content is exported to one or more destination-specific artifacts.
   - Each artifact gets an Artifact ID, SHA-256, and local storage reference.
   - Each artifact references the originating Content/Finalized Snapshot.

3. **Local storage**
   - Exported artifacts are stored locally in the Content Library with their identity and hash.
   - The Library preserves artifact identity and integrity.

4. **Export Review**
   - Before publication, the operator can open and review the exported artifact from the Library.
   - Export Verification checks whether the local exported file matches the expected output for the intended destination/format; outcome is explicit, may be MATCH/MISMATCH/UNKNOWN.
   - Any needed edit creates a new artifact/version and follows the approval path; it does not silently mutate the approved snapshot or the original artifact hash.

5. **External Publication**
   - The operator publishes manually through the platform (no auto-publish in Slice 1).
   - Publication Record created/updated with platform, URL, timestamp, link form, affiliate link, actual caption (or UNKNOWN), disclosure settings applied, and evidence.

6. **Destination Review**
   - The operator opens the published destination URL and reviews the live post.
   - Destination Comparison checks whether the published content matches the relevant approved/exported artifact for the dimension being checked.
   - Caption comparison and screenshot attribution continue to be governed by Doc D `§3.6` and AC-19.

7. **Comparison**
   - Side-by-side comparison where technically feasible:
     - exported artifact vs live destination.
     - one destination vs another destination.
     - live post vs approved snapshot fields where applicable.
   - Findings, differences, evidence, and timestamps are retained in Review Records/notes.

8. **Evidence retention**
   - All artifacts, hashes, screenshots, comparison notes, review records, and publication records are retained as evidence.
   - Hash equality is not treated as publication proof; platform transformations are acknowledged.

---

## 5. Acceptance Criteria Impact Matrix

### 5.1 AC-06

- **Current meaning (working tree):** publication record exists with live_url, posted_at, link_form_used matching the experiment’s pinned link form, disclosure settings applied, ≥1 screenshot of the live post, `caption_used` (or explicit UNKNOWN), and the caption-comparison outcome; live-post disclosure state visible/recorded; link form is one the channel policy was verified to allow at publish time.
- **Proposed responsibility under this direction:** AC-06 remains the “publication recorded with live evidence” criterion; it continues to govern that a publication record exists and is evidenced. It is not the place to define export-artifact identity, Finalize Snapshot, or the full verification taxonomy; those are broader contract/design concerns.
- **Gap/overlap:** AC-06 already absorbed `caption_used` and the caption-comparison outcome; that is consistent with the direction’s publication-verification and destination-comparison needs. The direction does not require AC-06 to also carry artifact hash or export verification; doing so would blur the criterion.
- **New AC/amendment need:** probably not for AC-06 itself; the missing parts belong to new schema/contract work and possibly to new or revised criteria if the Owner wants explicit export-verification or audience-visibility checks.

### 5.2 AC-07

- **Current meaning:** scheduled observations captured from real dashboards; ≥3 ResultObservation records with source, method, capture timestamp, evidence file, and values where available.
- **Proposed responsibility:** AC-07 remains the observation-capture criterion. It is not the natural home for export-artifact or content-library review concerns.
- **Gap/overlap:** none material for this direction; the direction’s performance-analysis linkage is downstream of AC-07.

### 5.3 AC-08

- **Current meaning:** cycle report is evidence-traceable and drives a G5 decision; numbers trace to ≥1 ResultObservation.
- **Proposed responsibility:** AC-08 remains the reporting/decision criterion. It supports the direction’s future-performance-analysis goal only insofar as the report structure preserves linkage; that linkage is currently via experiment/publication/observation, not yet via Finalized Snapshot/Export Artifact.

### 5.4 AC-18

- **Current meaning (working tree):** post-G3 changes invalidate approval; publication records are correct and their coverage is stated; completeness must be judged against a named trustworthy source, not inferred from absence of records.
- **Proposed responsibility:** AC-18 is highly relevant to the direction’s publication-verification and destination-comparison integrity. It already prevents treating absence of records as completeness, which aligns with the direction’s caution against claiming publication correctness from URL access alone.
- **Gap/overlap:** AC-18 already covers publication-set correctness/completeness discipline well. The direction’s extra concern — comparing published content to exported/approved artifacts — is partly in AC-19 and partly in the proposed export/library review layer. AC-18 does not need to be the place for export-artifact comparison rules; that would be a scope expansion.

### 5.5 AC-19

- **Current meaning (working tree):** published caption is persisted, comparable, and the screenshot is attributable; caption comparison outcome recorded; screenshot existence must be established and screenshot content/attribution must be validated as far as evidence permits; file-existence alone is not enough.
- **Proposed responsibility:** AC-19 already covers the caption-and-screenshot part of the direction extremely well. It is the natural place for caption persistence, comparison, and screenshot attribution.
- **Gap/overlap:** The direction’s broader “compare exported artifact to published destination” and “compare multiple destinations” concepts are not fully contained in AC-19; AC-19 is caption/screenshot focused. Extending it to generic artifact-vs-destination comparison would risk overloading it.

### 5.6 Related criteria and the caption/CTA lifecycle set

- `AC-15`, `AC-16`, `AC-17`, `AC-20`, `AC-21` remain the content-design, consistency, G3 completeness, asset-change, and attribution-scope criteria in the current working tree.
- The direction’s Finalize Snapshot concept is complementary to these, not a replacement. A Finalized Snapshot is the “what was approved” record; these criteria remain the checks that the approval and lifecycle were conducted correctly.

### 5.7 Whether a new AC or amendment may be needed

- For the publication/caption side, the existing AC set already covers most of what the direction wants, especially AC-06, AC-18, and AC-19.
- For export artifact identity, Finalize Snapshot, content-library review hub, export verification, and audience visibility check, the current AC set does not yet have dedicated criteria. If the Owner wants those as testable acceptance criteria, new or amended criteria would be needed.
- Any such addition/amendment is a Decision-authority matter, not something to infer from design direction.

---

## 6. Phase 1 vs Phase 2 Boundary

### 6.1 Current-scope capabilities that the Owner direction requires or implies

These are within or adjacent to the current Slice 1 / Phase 1 scope and should be considered for the current contract if the Owner wants them now:

- Manual publication, no auto-publish (already present in Doc A FR-7.1, Doc B Stage 7, Doc I S7).
- Publication record with platform, URL, timestamp, link form, affiliate link, actual caption (or UNKNOWN), screenshot evidence (already present; improved in the working tree).
- Caption comparison before and after publication (already present in Doc D §3.6, Doc B Stage 7, Doc E AC-06/AC-19, Doc I S7).
- Evidence retention and audit trail (already present).
- Post-G3 and post-G4 change handling with new versions/records (already present).

### 6.2 Future capabilities that belong later, unless the approved contract already requires them

These are explicitly or implicitly future in the direction and should not be pulled into Phase 1 solely because the design direction mentions them:

- Dedicated Export Artifact entity with Artifact ID, SHA-256, local storage reference, Finalized Snapshot linkage.
- Dedicated Finalized Snapshot record as a first-class approved-version snapshot.
- Full Content Library with pre-publication export review, cross-destination comparison, and review-record retention as a first-class hub.
- Explicit five-verification-type taxonomy, especially Export Verification and Audience Visibility Check.
- Explicit multiple-artifact, multiple-publication, republication, and unknown-source-artifact handling schema.
- Performance analytics expanded to artifact/finalized-version/variant-level comparison across platforms.

Whether any of these belong in Phase 1 depends on whether the existing approved contract already requires them. My read is that the current inspected contract does not yet contain these as requirements; if the Owner wants them now, that is an explicit scope decision, not an automatic consequence of the design direction.

---

## 7. Owner Decision Questions

These are questions that genuinely need Owner judgment. Designer-level clarifications are marked as such.

### 7.1 Owner decisions likely required

1. **Finalize Snapshot:** Does the Owner want a first-class Finalized Snapshot record/artifact in the current contract, or is the current G3-approved Script/`caption_draft`/`cta`/Decision-rationale sufficient for Phase 1?
2. **Export Artifact identity:** Does the Owner want Artifact ID + SHA-256 + local storage reference + Content/Finalized Snapshot linkage added now, or deferred?
3. **Content Library scope:** Does the Owner want a Content Library that begins after Export with pre-publication export review and cross-destination comparison now, or only after publication?
4. **Verification taxonomy:** Does the Owner want the explicit five verification types — especially Export Verification and Audience Visibility Check — as defined checks now, or later?
5. **Performance linkage scope:** Does the Owner want performance linkage to Finalized Snapshot/Export Artifact now, or is experiment/publication/observation linkage sufficient for Phase 1?
6. **Asset identity fix:** Doc D `§3.5` currently defines no asset identifier that `Publication.asset_id` can reference. Does the Owner want that fixed as part of the same contract pass, or treated separately? (This is currently a real inconsistency in the inspected material, independent of the new design direction.)

### 7.2 Designer-level items, not Owner approval items

- The exact schema shape for Artifact, Finalized Snapshot, and Review Record.
- The exact lifecycle rules for missing/changed/duplicate/re-export artifacts.
- The exact placement of export review in the workflow and UI.
- The exact mapping of the five verification types onto existing or new criteria.

These can be resolved by the system designer once the Owner decides the scope and priority.

---

## 8. Recommended Next Step

Recommended smallest bounded next action:

1. The Owner reviews this reconciliation and decides the scope question: which parts of the Content Library & Publication Verification direction belong in the current contract now versus later.
2. If any part is approved for the current contract, the next action is a narrow contract/ schema draft that adds only the approved pieces — for example Finalized Snapshot, Export Artifact identity, or export review — without expanding into implementation, publication, automation, or external access.
3. No implementation, no file modification, no commit, and no authorization change occurs until the Owner reviews and approves the proposed contract.

---

## 9. Explicit Non-Actions

In this task I did **not**:

- Create, edit, delete, rename, or move any repository file.
- Stage, commit, push, merge, or create a branch.
- Change any Acceptance Criterion text, status, or Decision Record.
- Change WorkflowState, RunHistory, Evidence Log, Gate status, or any authorization.
- Run tests or pilots.
- Access external platforms, log in, publish, or perform live verification.
- Spend money or authorize paid services or automation.
- Expand the current Phase 1 scope based on the design direction.

---

**CONTENT LIBRARY & PUBLICATION VERIFICATION — READ-ONLY RECONCILIATION COMPLETE — NO FILES MODIFIED — OWNER REVIEW REQUIRED**
