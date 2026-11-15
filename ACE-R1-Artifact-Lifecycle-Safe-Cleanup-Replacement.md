# ACE R1 — Artifact Lifecycle, Safe Cleanup & Replacement Lineage
## Read-only Analysis and Decision-Record Update Proposal

### 1. Objective

Continue the ACE R1 No-Overwrite investigation by translating the Owner's latest design direction into a precise, evidence-based design proposal.

The goal is to let ACE remove unnecessary or unusable physical files without losing the history, identity, origin, and lineage needed to explain what happened.

This task is **analysis and decision-record preparation only**. It does not authorize implementation.

### 2. Owner's Design Direction (Preserved Principles)

The Owner's 10 preserved principles govern the lifecycle design:

1. **Used/published vs. pre-use preservation significance**: Content actually used or published has different preservation significance from content that failed before real use.
2. **Damaged/missing pre-use replacement**: When a damaged, missing, or unusable pre-use artifact needs replacement, ACE should generate a replacement and validate it before making it available.
3. **Same logical location, old identity preserved**: Replacement may occupy same logical output location, but must not silently destroy the old artifact's identity or historical record.
4. **Replacement has own identity and SHA-256**: Replacement must have its own artifact identity and SHA-256 hash; different hash expected when bytes differ; matching hash may establish byte identity only when compared against trusted reference.
5. **Old-new replacement relationship**: System must preserve relationship between old artifact and replacement, including origin, reason for replacement, relevant evidence, validation outcome, and lifecycle events.
6. **Old physical bytes disposal**: Old physical file bytes need not be retained permanently when unusable and no longer needed for recovery, investigation, legal, compliance, or other explicitly established purposes.
7. **Deletion ≠ record deletion**: Deleting physical file bytes must not automatically delete the associated artifact record, lineage, or required history.
8. **Evidence retention for investigation**: ACE should record enough evidence to investigate why a file became damaged, missing, or unusable. Where retaining bytes is unnecessary, consider whether metadata, hashes, error details, and event records are sufficient.
9. **No interchangeability claim**: ACE must not claim two artifacts are interchangeable merely because one replaces the other or because their hashes differ. Replacement suitability must be established through relevant validation of content integrity, format, product, CTA, links, channel constraints, and other applicable requirements.
10. **Published artifacts separate assessment**: Artifacts actually published or used must receive separate impact and retention assessment before cleanup or replacement. Pre-use cleanup rules do not automatically apply to published artifacts.

### 3. Required Analysis (Read-only)

#### 3.1 The Distinction: Artifact Record vs. Physical File Bytes

**Verified from source inspection:**

| Component | Source | Verified Behavior | Status |
|---|---|---|---|
| **Artifact record** | `service.js:3016`: `artifactId = ART-${Date.now()}-${random}`<br>`service.js:3021`: `version: 1`<br>`service.js:3028`: SHA-256 of markdown content | Logical identity per generate; unique per generate; stores integrity hash; metadata (exported_at, status, etc.) | **CONTRACT EXPLICIT** — D1 guarantees uniqueness; version: 1 enforced |
| **Physical file bytes** | `service.js:3046`: `fsp.writeFile(filePath, markdownContent, 'utf8')`<br>`content.js:1134`: filename = `${content_id}-v${script_version}.mp4`<br>`render.js`: `ffmpeg -y` overwrite | Actual file on disk at path determined by pipeline; Content Artifact v1: unique `artifactId` → unique file name; Renderer: same `outFile` → overwrite possible | **IMPLEMENTATION OBSERVED** — varies by pipeline; not contract-governed across pipelines |
| **Library entry** | `content.js:1195-1241`: `{id: content_id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status}` | Index record per `content_id + filename` filter; same `content_id + same script_version` → replace; different script_version → append | **IMPLEMENTATION OBSERVED** — hybrid: replace-by-(content_id+script_version), append-by-different-version |
| **Artifact ID vs. SHA-256** | `service.js:3016,3028` | `artifact_id` = timestamp+random suffix (generate-unique); SHA-256 = markdown content hash (integrity verification) | **DISTINGUISHED** — neither implies the other; not contract-linked |

**Key distinction**: The artifact record is a **logical identity** that persists independently of the physical file's existence. The physical file bytes are **transient storage** that may be deleted without deleting the artifact record, per principles 6-7.

#### 3.2 Artifact Identity and Lineage After Physical Deletion

**How ACE can preserve artifact identity and lineage after physical deletion:**

- **Artifact record persists** (principles 6-7): The artifact record with its `artifact_id`, SHA-256, metadata, and version survives physical file deletion. The record documents what the file contained, when it was exported, and its status.
- **Lineage tracking** (principle 5): The system must record `replaces` relationship: if artifact B replaces artifact A, the record for B must reference A as the artifact it replaced, with origin reason, evidence, and validation outcome.
- **No automatic record deletion** (principle 7): Deleting the physical file bytes must not automatically delete the artifact record or its lineage. The record becomes an "historical" artifact, not "active" but not "gone."
- **Hash as integrity witness** (principle 4): The SHA-256 stored in the artifact record serves as an integrity witness. Even after the physical file is gone, the hash remains as evidence of what the file contained at export time.
- **Event-based linkage** (principle 8): Damage detection, missing-file detection, root-cause evidence, replacement generation, validation, activation, and cleanup should be recorded as events or logs, providing investigative trail even without the original bytes.

**Gaps (no contract clause explicitly addresses this):**
- No contract clause says "artifact record persists after physical file deletion"
- No contract clause says "lineage must be preserved across replacement"
- The R1 contract (D1, CA-V1-05) governs generate/export behavior, not cleanup/replacement lifecycle
- No schema field in source observed for `replaces`, `replaced_by`, `replacement_reason`, or `cleanup_status`

#### 3.3 How a Replacement Can Be Linked to the Artifact It Replaces

**Mechanism for linking replacement to replaced artifact:**

- **`replaces` field in artifact metadata** (proposed, not in source): Artifact B's metadata includes `replaces: artifact_id_of_A`, documenting that B was generated to replace A.
- **`replaced_by` field in replaced artifact** (proposed, not in source): Artifact A's metadata includes `replaced_by: artifact_id_of_B`, documenting it was superseded.
- **Event sequence linkage** (proposed, not in source): A committed `Export Event` with `event_seq` could have `replaces_event_seq` linking to the prior event, creating an event chain.
- **Library entry update** (observed but limited): `content.js:1213-1216` already performs Library entry replacement when `content_id + script_version` match; this could be extended to include `status: 'REPLACED'` and `replaced_at` timestamp.
- **SHA-256 comparison as linkage** (proposed, not automatic): If new generate's SHA-256 matches a known pattern or is compared against the replaced artifact's hash, this could be recorded, but the contract does not mandate this.

**Existing source that partially supports this:**
- `content.js:1213-1216`: Library filter already removes old entry when `content_id + script_version` match, pushing new entry — this is a form of "replacement" at the Library level, but does not document the old entry's fate or link the two records.
- `service.js:3078-3087`: On state-persist failure after artifact file written, attempts `fsp.unlink(filePath)` and honestly reports `details.cleanup` — this documents cleanup outcome but does not link to a replacement.

**Gaps:**
- No field in artifact metadata or Library entry for `replaces` / `replaced_by` / `replacement_reason`
- No event mechanism exists (`export_request_id`, `event_seq` not in source)
- Library replacement (content.js) does not record why or link to prior version's identity beyond `content_id + script_version`

#### 3.4 How the System Records Damage Detection, Missing-File Detection, Root-Cause Evidence, Replacement Generation, Validation, Activation, and Cleanup

**Current observed recording (read-only evidence):**

| Lifecycle Step | Current Recording | Gap |
|---|---|---|
| **Damage detection** | CA-V1-03 Test 8 Branches W/S: honest cleanup reporting (`details.cleanup` starts with "succeeded:" or "failed:"); Test 8 Branch S cleanup-failure: artifact file left behind honestly; `(await fsp.readdir(exportsS)).length === 1` | No systematic damage detection for existing artifacts; only injection-tested failure scenarios |
| **Missing-file detection** | Not observed; only detected on write failure (service.js:3052-3055: `fsp.writeFile` error → throw 500) | No on-access or scheduled missing-file check; no API for "is this artifact's file present?" |
| **Root-cause evidence** | Injection test logs ("INJECTED_MKDIR_FAILURE", "INJECTED_UNLINK_FAILURE", "failed:") | No production root-cause capture; injection tests are artificial, not from real failures |
| **Replacement generation** | Not observed — no code path for "generate replacement for damaged artifact" | Would require new API/service method; not in current source |
| **Validation** | CA-V1-03 Test 8: state persist verified; artifact file integrity via SHA-256 (service.js:3028) | Validation is per-generation, not per-"is-this-artifact-still-valid" check |
| **Activation** | Not observed — no "make artifact available" state transition beyond successful export | No "pending validation → active" transition documented; export success → available by default |
| **Cleanup** | CA-V1-03 Test 8: Branch S removes artifact file on state-persist failure; Branch S cleanup-failure: file left behind honestly; logs include outcome | No systematic cleanup for "damaged or obsolete" artifacts; cleanup only on failure branches |
| **Audit observability** | Test 8 logs (`details.cleanup` prefix, file counts) | No production-observable cleanup status for end-user; only visible in test logs |

**Gaps summary:** The system records cleanup honesty under injected failure, but has no production lifecycle for: damage detection of existing artifacts, missing-file detection, root-cause evidence collection, replacement generation workflow, validation-then-activation transition, or systematic cleanup of obsolete artifacts.

#### 3.5 How ACE Prevents a Replacement from Becoming Active Before Successful Validation

**Current behavior: No prevention mechanism observed.**

- No state transition "pending validation → active" exists in source
- Export success immediately makes artifact available (no observed intermediate state)
- No flag or field: `status: 'PENDING_VALIDATION'`, `status: 'ACTIVE'`, `status: 'REPLACING'`
- No API route or middleware that checks validation before serving artifact to user
- Renderer `renderVideo` success → MP4 written to `outFile` → immediately available (no observed gate)

**What would be needed (proposed, not implemented):**
- Artifact status field with lifecycle: `DRAFT` → `PENDING_VALIDATION` → `ACTIVE` → `ARCHIVED` → `DELETED`
- Validation check before serving artifact to user (e.g., fetch API route that verifies SHA-256, format, CTA, links, channel constraints per principle 9)
- Replacement cannot become active until validation step 6 succeeds (per proposed lifecycle step 6-7)
- If validation fails, replacement remains `PENDING_VALIDATION` or reverts; old artifact remains available unless explicitly replaced

**Gaps:** No status lifecycle observed; no validation gate before artifact availability; no replacement activation control.

#### 3.6 How the System Handles a Failed Replacement, Failed History Write, or Failed Cleanup

**Current failure handling (observed):**

| Failure Type | Current Handling | Gap |
|---|---|---|
| **Failed replacement** | Not observed — no replacement workflow exists | Would need: retry, abort, fallback to old artifact, user-visible error |
| **Failed history write** | `content.js:1238-1241`: `await fsp.writeFile(contentLibraryPath, JSON.stringify(library, null, 2))` — if this throws, error propagates; no retry in observed code | No observed on-retry; no partial-write recovery; Library JSON assumed atomic (though Node `writeFile` not truly atomic) |
| **Failed cleanup** | CA-V1-03 Test 8 Branch S: `fsp.unlink(filePath)` removes artifact file; `(await fsp.readdir(exportsS)).length === 1` file left behind honestly; `details.cleanup` starts with "failed:"; logs include "INJECTED_UNLINK_FAILURE" | No production cleanup failure handling beyond injection tests; no user-visible cleanup status; no recovery procedure |
| **Failed validation** | Not observed | Would need: artifact marked `PENDING_VALIDATION`, old artifact retained, user notified, retry option |

**Gaps:** All failure modes for the proposed lifecycle are unverified; only CA-V1-03 Test 8 covers failure honesty under injection, not production behavior.

#### 3.7 How the System Handles a File Still Referenced by a Published Item, Another Artifact, or an Active Workflow

**Current behavior: No observed protection mechanism.**

- No check: "is this file referenced by a published item before deletion?"
- No observed `published` flag on artifact or Library entry that blocks cleanup
- No workflow-reference tracking (e.g., "active_exports", "in_use_by")
- Content Artifact v1: unique `artifactId` per generate → different file names → no same-file reuse across generates; but no published-status tracking
- Renderer: same `outFile` overwrite possible; no published-status check before overwrite

**What would be needed (proposed):**
- Artifact or Library entry field: `status: 'PUBLISHED'` or `published_at: timestamp`
- Cleanup/ deletion API route that checks: `IF artifact.status = 'PUBLISHED' OR artifact.referenced_by > 0 THEN block cleanup OR block deletion WITH user-visible error`
- Workflow reference counting or ownership tracking
- For published artifacts (principle 10): separate impact and retention assessment before cleanup — do not assume pre-use cleanup rules apply

**Gaps:** No published-status field observed; no reference counting; no cleanup guard for published artifacts.

#### 3.8 How It Handles Recovery or Investigation Cases Where Retaining the Original Bytes Is Justified

**Current behavior: Retention is ad hoc, not policy-driven.**

- CA-V1-03 Test 8 Branch S cleanup-failure: artifact file left behind honestly; `(await fsp.readdir(exportsS)).length === 1` — this is an observed "retain because failure" case
- No general policy: "retain original bytes if investigation or legal hold required"
- No metadata flag: `retention_reason: 'INVESTIGATION'`, `retention_until: timestamp`, `legal_hold: true`
- No API to set/query retention reasons

**What would be needed (proposed):**
- Artifact metadata: `retention: { reason: 'INVESTIGATION' | 'LEGAL_HOLD' | 'COMPLIANCE', until: timestamp, granted_by: 'user' | 'system' }`
- Cleanup API that respects retention: `IF artifact.retention.reason THEN block cleanup OR schedule for later`
- Investigation workflow: detect damage → set retention → generate replacement → validate → make replacement active → retain old artifact record with retention flag → periodic review of retention reasons

**Gaps:** No retention metadata field; no retention-aware cleanup; no investigation/legal-hold workflow observed.

#### 3.9 How Cleanup Can Reclaim Storage Without Silently Erasing Required Audit Evidence

**Current behavior: Cleanup is honest but limited.**

- CA-V1-03 Test 8: On cleanup success → no orphan files; on cleanup failure → file left behind honestly; `details.cleanup` reports outcome
- No systematic cleanup of "obsolete" artifacts (only tested under injection)
- No "reclaim storage" workflow observed
- If file deleted, artifact record persists (principle 7), so audit evidence is not silently erased — but this is incidental, not designed

**What would be needed (proposed):**
- Cleanup procedure that: (a) verifies artifact status is not `PUBLISHED` (principle 10), (b) verifies no active workflow references the file, (c) optionally archives metadata/hash before byte deletion, (d) records `cleanup_status: 'SUCCEEDED'` / `'PARTIAL'` / `'FAILED'` with outcome details, (e) if `cleanup_status = 'FAILED'`, the event is observable and recoverable
- Before byte deletion: export metadata (SHA-256, exported_at, content_id, script_version, reason for cleanup) to persistent store (D1 table, appended JSON, audit log)
- After byte deletion: artifact record marked `physical_file_present: false` or `file_location: 'DELETED'` — record survives as audit evidence

**Gaps:** No systematic cleanup workflow; no metadata-archival-before-deletion; no `cleanup_status` field observed; no active-workflow-check before deletion.

#### 3.10 Whether Existing Contracts and Schemas Already Support Any of These Behaviors, and What Gaps Remain

**What R1 contract (CA-V1-05 + D1) already supports (from verified source):**

| Behavior | Contract Support | Evidence |
|---|---|---|
| Unique artifact_id per generate | **CONTRACT EXPLICIT** | D1: "version semantics = as-implemented (artifact ใหม่ต่อ generate, version 1, id unique)" |
| Version: 1 enforcement | **CONTRACT EXPLICIT** | D1: version semantics includes `version: 1` |
| SHA-256 integrity of artifact file | **CONTRACT EXPLICIT** | CA-V1-05: sha256 computed from markdown; stored in metadata and response |
| Honest cleanup reporting on failure | **TEST COVERAGE OBSERVED** | CA-V1-03 Test 8 Branches W/S; but contract clause only covers failure branches, not success cleanup |
| No orphan files on write/mkdir failure | **TEST COVERAGE OBSERVED** | CA-V1-03 Test 8 Branch M (mkdir-blocked): no artifact file/dir created; Branch W (artifact write fails): no artifact file/dir created |
| State byte-unchanged on failure | **TEST COVERAGE OBSERVED** | CA-V1-03 Test 8 Branch S: state file byte-unchanged; no partial mutation |

**What R1 contract does NOT support (gaps):**

| Missing Behavior | Contract Gap | Severity |
|---|---|---|
| Artifact record persists after physical file deletion | **NOT SPECIFIED** | High — principle 6-7 require this, but contract silent |
| Lineage/relationship preservation across replacement | **NOT SPECIFIED** | High — principle 5 requires this, but contract silent |
| Published artifact separate retention assessment | **NOT SPECIFIED** | High — principle 10 requires this, but contract silent |
| Damage detection of existing artifacts | **NOT SPECIFIED** | Medium — no contract clause addresses this |
| Replacement activation before validation prevention | **NOT SPECIFIED** | Medium — no contract clause addresses this |
| Cleanup that reclaims storage without erasing audit evidence | **NOT SPECIFIED** | Medium — contract only covers failure cleanup honesty |
| Published-status field blocking cleanup | **NOT SPECIFIED** | High — principle 10 requires this, but contract silent |
| Retention reason/metadata for investigation/legal hold | **NOT SPECIFIED** | Medium — principle 8 requires this, but contract silent |
| Status lifecycle (DRAFT → PENDING_VALIDATION → ACTIVE → ARCHIVED → DELETED) | **NOT SPECIFIED** | Medium — no contract clauses address artifact lifecycle states |
| Replacement `replaces` / `replaced_by` field | **NOT SPECIFIED** | High — principle 5 requires this, but contract silent |
| SHA-256 comparison for byte identity (beyond per-artifact integrity) | **NOT SPECIFIED** | Low-Medium — CA-V1-05 guarantees per-artifact integrity, not cross-artifact comparison |

**Summary of gaps:** The R1 contract governs generate/export failure behavior honestly, but provides **no clauses** for the proposed lifecycle: replacement, cleanup, published-artifacts separate assessment, damage detection, status lifecycle, replacement linkage, retention reasons, or published-artifacts guard. These are all design proposals outside the ratified R1 scope.

### 4. Proposed Lifecycle to Evaluate (Candidate Design, Not Ratified)

**Evaluated sequence without implementation:**

1. **Detect that artifact A is damaged, missing, or unusable.**
   - Trigger: on-access check, scheduled scan, user report, API query
   - Evidence: SHA-256 mismatch (if file present), file-not-found error, corrupt header detection, playability test failure
   - Recording: `damage_event` recorded with timestamp, detector, evidence hash, file path, observation

2. **Record the detection event and available evidence.**
   - Write to artifact metadata: `damage: { detected_at, method, evidence, status: 'DAMAGED' }`
   - If file present: store SHA-256 of file (or error reading it), file path, corruption symptoms
   - If file missing: record `file_present: false`, last_known_path, time_missing_estimated
   - Link to artifact record (not dependent on physical file survival)

3. **Determine whether artifact A is eligible for cleanup or requires retention.**
   - Check artifact metadata: `status`, `published_at`, `retention.reason` (if exists)
   - Principle 10: IF `published_at` exists → separate impact and retention assessment → do not apply pre-use cleanup rules automatically
   - Principle 6: IF artifact was pre-use (never published) AND no investigation/legal-hold → eligible for cleanup consideration
   - Principle 8: IF root-cause investigation needed → retain bytes (or at least metadata/hash) until investigation complete
   - Decision: eligible_for_cleanup / requires_retention / under_investigation

4. **Generate replacement artifact B with a new artifact identity and its own hash.**
   - Generate new `artifactId = ART-${Date.now()}-${random}` (Content Artifact v1 scheme, principle 4)
   - New SHA-256 computed from new markdown content (or new render output for renderer)
   - Artifact B metadata: `artifact_id`, `sha256`, `version: 1`, `status: 'PENDING_VALIDATION'`, `replaces: artifact_id_of_A`
   - Record `replacement_event: { replaced_artifact_id, replacement_artifact_id, reason, detected_at, generated_at }`

5. **Validate B against the applicable requirements.**
   - Validation checks: SHA-256 integrity (already computed), format compliance, CTA presence, link integrity, channel constraints, product requirements
   - If validation succeeds: `status: 'ACTIVE'`
   - If validation fails: `status: 'FAILED_VALIDATION'`, retain artifact A, record `validation_outcome`, notify owner, do not make B available

6. **Record the replacement relationship `B replaces A`.**
   - Artifact B metadata: `replaces: artifact_id_of_A`
   - Artifact A metadata: `replaced_by: artifact_id_of_B`, `replacement_reason`, `replaced_at`, `status: 'REPLACED'` (or remain `ACTIVE` if still valid for historical purposes)
   - Library entry update (content.js model): if applicable, update Library entry with `status: 'REPLACED'` and `replaced_at` timestamp
   - Event recording (proposed): committed `Export Event` with `replaces_event_seq` linking to prior event

7. **Make B available for use only after required validation and state transitions succeed.**
   - Only when `status = 'ACTIVE'` is artifact B served to users or made available for download/export
   - User-facing: new artifact available; old artifact A remains accessible as historical (not automatically removed from UI/API unless explicitly cleaned up)
   - Principle 9: Do not claim B is interchangeable with A merely because B replaces A or because hashes differ; suitability established through validation

8. **If safe, remove A's physical bytes while retaining A's historical record and lineage.**
   - Safety checks per principle 10: IF `A.published_at` exists → block byte deletion OR block until separate published-artifacts assessment completed
   - Safety checks per principle 7: Delete physical bytes ONLY if `A.retention.reason` absent OR retention period elapsed; artifact record survives
   - Safety checks per principle 9: Do not claim A and B are interchangeable; record that B replaces A with documented reason
   - Byte deletion: `fsp.unlink(A.file_path)`; on success: record `cleanup_status: 'SUCCEEDED'`, `cleanup_at`; on failure: record `cleanup_status: 'FAILED'`, `cleanup_error`, file left behind honestly (per CA-V1-03 principle)
   - After deletion: artifact A metadata updated: `physical_file_present: false`; record survives as audit evidence with its SHA-256 and metadata

9. **Record cleanup status and outcome so a failed or incomplete cleanup is observable and recoverable.**
   - `cleanup_status: 'SUCCEEDED'` / `'PARTIAL'` / `'FAILED'` with details
   - `cleanup_error`: error message if failed
   - `cleanup_at`: timestamp
   - If `cleanup_status = 'FAILED'`: artifact record A retains `physical_file_present: true` (file left behind); investigation may be needed; recovery procedure documented
   - Audit log: all cleanup events recorded with outcome, not silently swallowed

**Ordering, transaction, retry, concurrency, and recovery risks (identified, not resolved):**

- **Ordering**: Step 4 (generate B) must precede step 6 (record relationship); step 8 (byte deletion) must follow step 7 (B active) and step 10 (published-assessment guard). Wrong ordering risks: B active before A's record updated; bytes deleted before investigation complete.
- **Transaction**: Steps 1-9 should ideally be atomic or at least consistent. If system crashes mid-lifecycle, partial state may remain. No observed transaction mechanism in source.
- **Retry**: If generation of B fails (e.g., renderer error), should retry, fall back to A, or mark A as needing replacement later? No retry policy observed.
- **Concurrency**: Two concurrent replacement attempts for same A risk conflict. No observed locking or `replaces` conflict resolution. Could result in two B artifacts, both claiming to replace A, or one overwriting the other's Library entry.
- **Recovery**: If step 6 (record relationship) fails after step 8 (byte deletion), artifact A's record exists but physical bytes gone, and no linkage to B. Recovery would require manual reconciliation. If step 7 (make B active) fails after step 8, B is generated but not available; A's bytes already deleted — data loss risk.

**No implementation is authorized.** This lifecycle is a candidate design for evaluation and discussion.

### 5. Decision-Record Treatment

**How the new design direction affects A2, A3, and B4:**

- **A2 (Library replacement policy)**: The proposed lifecycle makes A2 more nuanced. If the lifecycle formally records `replaces` relationships and replacement events (step 6), the Library's automatic replacement behavior (A2-O1/O2/O3) interacts with this: 
  - A2-O1 (replace auto) could coexist with lifecycle recording if the Library entry's `replaced_by` field is updated alongside the automatic replacement.
  - A2-O2 (preserve existing) is compatible with lifecycle if the old entry is kept as historical and a new entry documents the replacement.
  - A2-O3 (replace + "previous" marker) is most compatible with the lifecycle, as the `replaces`/`replaced_by` fields provide the explicit lineage the marker would supplement.
  - **Impact**: The lifecycle does not resolve A2; it adds a higher-level `replaces` linkage that exists alongside the Library's `content_id + script_version` replacement behavior. A2 remains separately ratifiable.

- **A3 (Artifact/Export Event history)**: The proposed lifecycle is heavily dependent on A3. 
  - Without an Event mechanism (A3-O1), the `replaces` linkage and replacement events would have to be stored in artifact metadata or Library JSON only — less durable, less queryable, but functional.
  - With A3-O2 (artifact-level history), each artifact carries its generate/replace history; the lifecycle's `replaces` field fits naturally.
  - With A3-O3 (full Event mechanism), the lifecycle fully integrates: each replacement is a committed Event with `replaces_event_seq`, enabling durable audit trail, idempotent retries, and export statistics accuracy.
  - **Impact**: The lifecycle design partiall y depends on A3; A3-O3 is the preferred companion, but A3-O1 or A3-O2 can support the lifecycle with reduced durability. A3 remains separately ratifiable.

- **B4 (Damaged/missing-file replacement)**: The proposed lifecycle is essentially a formalization of B4. 
  - B4-O1 (no proactive procedure) is the baseline: the lifecycle steps are manual/ad hoc, matching current behavior.
  - B4-O2 (on-demand API verification) aligns with lifecycle steps 1-3 (detect → record → determine eligibility) exposed via API.
  - B4-O3 (scheduled scan + auto-replace) is the full lifecycle as evaluated — steps 1-9 are automated via scheduled task.
  - B4-O4 (integrity check on each access) extends the lifecycle to make damage detection per-access rather than scheduled.
  - **Impact**: The lifecycle is the design embodiment of B4. Ratifying B4-O2, B4-O3, or B4-O4 determines the degree of automation; the lifecycle steps are common to all, differing only in trigger and initiation. B4 remains separately ratifiable, and the lifecycle proposal does not ratify any B4 choice — it merely documents the design space.

**Analysis B2 and B3 independently:**

- **B2 (Physical-file overwrite prohibition)**: The proposed lifecycle does not directly address B2. B2 concerns what happens when a new render/export targets an existing `outFile`. The lifecycle concerns replacement of damaged/missing pre-use artifacts. These are separate domains:
  - B2: "New render targets existing outFile — what happens?" (overwrite/abort/rename/prompt)
  - Lifecycle: "Existing artifact damaged/missing — generate replacement, validate, activate, optionally delete old bytes"
  - They can coexist: B2-O1/O2/O3/O4 and lifecycle steps 1-9 operate in different contexts. B2 remains independently ratifiable; do not infer lifecycle outcomes from B2 or vice versa.
- **B3 (Verified SHA-256 reuse)**: The proposed lifecycle uses SHA-256 as the integrity witness (principle 4: "matching hash may establish byte identity only when compared against trusted reference"). However:
  - B3 concerns: "When new output's SHA-256 matches existing file, reuse it?"
  - Lifecycle: SHA-256 is used to verify artifact A's integrity before deciding on replacement/cleanup, and to generate B's hash for validation.
  - They intersect at: "Does matching SHA-256 prevent unnecessary re-generation?" but are not the same question. B3 remains independently ratifiable; do not infer B3 outcomes from the lifecycle or vice versa.

**Separate retention of physical bytes from artifact records and history:**

- **Physical bytes**: Transient storage; may be deleted per principles 6-7 when no longer needed for recovery/investigation/compliance.
- **Artifact record and history**: Persistent logical identity; must survive physical byte deletion (principles 6-7). The record includes `sha256`, `exported_at`, `status`, `replaces`, `replaced_by`, `retention` metadata — all survive byte deletion.
- **Decision boundary**: The system can delete the file at `A.file_path` while keeping artifact record A intact. The record becomes "file-less" but not "gone." This separation is central to the proposed lifecycle and is explicitly distinguished from both A2 (Library replacement) and B3 (SHA-256 reuse).

**Artifact History vs. Export Event History:**

- **Artifact History**: Records the lifecycle of a specific artifact: generation, replacement, validation, activation, cleanup. Stored in artifact metadata and/or Library JSON. Tied to a specific `artifact_id`.
- **Export Event History**: Records each export attempt/occurrence as a durable event: `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, `timestamp`. Proposed mechanism (not in source) that would allow querying "how many times was this content exported?" independent of artifact lifecycle.
- **Both required?** For the proposed lifecycle, **artifact history is required** (to track replacement relationships, validation states, cleanup outcomes per artifact). **Export Event history is beneficial but not strictly required** for the lifecycle to function — the lifecycle can record replacement/replacement events in artifact metadata without a separate Event mechanism. However, Export Event history provides advantages: (a) export statistics accuracy when replacements occur, (b) idempotent retry support, (c) audit trail independent of artifact metadata changes, (d) client-consumable history format. The lifecycle does not require A3-O3 specifically; A3-O1 or A3-O2 can support it with reduced durability. Both are listed as desirable but artifact history is the minimum.

**Exact Owner decisions still required before any contract amendment or implementation:**

1. **A2**: Confirm O1 (current/auto-replace), O2 (preserve existing), or O3 (replace + "previous" marker). Note: lifecycle coexistence is possible with any, but A2 choice affects Library-level behavior.
2. **A3**: Confirm O1 (no explicit history), O2 (artifact-level history), or O3 (full Event mechanism). Note: lifecycle is compatible with any, but A3-O3 provides the most durable event linkage for replacement events.
3. **B4**: Confirm O1 (no proactive procedure, lifecycle manual/ad hoc), O2 (on-demand API, lifecycle semi-automated via API), or O3 (scheduled scan + auto-replace, full lifecycle automation). Note: the proposed lifecycle maps directly to B4-O3; B4-O2 maps steps 1-6 via API; B4-O1 maps to ad-hoc manual execution of lifecycle steps.
4. **Published-artifacts guard (principle 10)**: Owner must decide whether to add `published_at` / `status: 'PUBLISHED'` field to artifact/Library, and whether cleanup should block when `published_at` exists. This is a contract amendment candidate but requires Owner decision.
5. **Retention metadata (principle 8)**: Owner must decide whether to add `retention: {reason, until, granted_by}` field to artifact metadata, and whether cleanup should respect retention flags. Contract amendment candidate.
6. **Status lifecycle (principle 9)**: Owner must decide whether to add artifact status field with lifecycle `DRAFT → PENDING_VALIDATION → ACTIVE → ARCHIVED → DELETED`, and whether validation gate before artifact availability is implemented. Contract amendment candidate.
7. **Replacement linkage fields (`replaces`/`replaced_by`)**: Owner must decide whether to add these fields to artifact metadata and/or Library entries, and what format/obligation. Contract amendment candidate.
8. **Published-artifacts assessment procedure (principle 10)**: If Owner decides published artifacts need separate retention assessment, the procedure (who assesses, what criteria, what retention decisions) must be defined. This is a workflow design decision, not merely a contract clause.

**No contract amendment or implementation is authorized until all the above Owner decisions are completed and explicitly ratified.**

### 6. Scope and Safety Constraints (Preserved)

- ✅ Read-only inspection and documentation only
- ✅ No application source code, tests, runtime behavior, database schemas, contracts, or configuration modifications
- ✅ No migrations, cleanup operations, deletion operations, or replacement generation
- ✅ No runtime validation claimed unless separately authorized and executed (none executed in this analysis)
- ✅ No new baseline accepted; no Mission 1 status change
- ✅ No Vertical Slice or implementation authorized

### 7. Required Deliverables

#### 1. Verified current-state report with evidence
Provided in sections 3.1–3.10 above, with exact file paths, line numbers, and contract references for all verified behaviors and gaps.

#### 2. Proposed lifecycle model for damaged, missing, replaced, and cleaned-up artifacts
Provided in section 4 (Proposed Lifecycle to Evaluate), steps 1–9, with identified ordering/transaction/retry/concurrency/recovery risks.

#### 3. Failure-mode and recovery analysis
Provided in section 4 (risks) and section 5 (decision-record treatment, gaps identified for each lifecycle step).

#### 4. Proposed amendment to the R1 Owner Decision Record, with all unresolved choices clearly labeled
To be integrated into `ACE-R1-No-Overwrite-Owner-DecisionRecord.md` — see the "Decision-Record Treatment" section (5) above and the updated Decision Record appended here.

#### 5. List of Owner decisions required next
Provided in section 5 (exactly 8 Owner decisions listed, plus the 5 original A2–A3/B2–B4 decisions).

#### 6. Concise change-impact summary identifying which existing contracts or components may eventually need review, without modifying them
Provided in section 3.10 (What R1 contract already supports vs. what gaps remain). Summary:

**Contracts/components that may eventually need review (not modified):**
- R1 contract (CA-V1-05 + D1): Currently governs generate/export failure honesty. May need amendment to add: artifact lifecycle states, published-artifacts guard, retention metadata, replacement linkage fields (`replaces`/`replaced_by`), damage detection criteria, Event mechanism provisions.
- `service.js`: `handleContentGenerate` (line ~3016) and state-persist/cleanup logic (line ~3078-3087). May need extension for: status lifecycle, retention metadata, replacement linkage, validation gate.
- `content.js`: `exportProject` (line ~1195-1241) Library replacement behavior (line ~1213-1216). May need extension for: `replaced_by` field, `replaces` field, `retention` metadata, different dedupe logic if sha256-based reuse adopted.
- `render.js`: `renderVideo` and `ffmpeg -y` overwrite behavior. May need modification for: B2 choice (overwrite prohibition), but no change required for lifecycle per se (lifecycle concerns pre-use artifacts, not renderer overwrite policy).
- ACE status invariants: Must remain verbatim; no acceptance without explicit Owner ratification.

**No components were modified in this analysis.** All observations are read-only.

### 8. Final Response Format Confirmations

- ✅ No application code or contracts were changed.
- ✅ No destructive cleanup or replacement operation was performed.
- ✅ No runtime validation was performed.
- ✅ No unresolved Owner decision was treated as ratified.
- ✅ Implementation remains NOT APPROVED.

**ACE status invariants preserved verbatim:**
```
Runtime Validation = NOT PERFORMED  
Implementation = NOT APPROVED  
Z1 / Mission 1 Status = UNCHANGED  
contractResolutionStatus = UNRESOLVED  
Row 18 / Row 3c = PENDING RECONCILIATION  
Canonical precedence = PENDING CONFIRMATION  
Baseline captured and accepted = NO  
ACS Seed Consolidation = PENDING OWNER REVIEW  
ACS Implementation = NOT APPROVED  
Scenario E = OWNER DECISION REQUIRED
```