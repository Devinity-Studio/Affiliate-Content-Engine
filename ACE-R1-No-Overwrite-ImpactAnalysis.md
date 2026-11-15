# ACE — R1 No-Overwrite: Read-only Impact Analysis

## 1. Dimension A — Content Library Impact Analysis

**Inspected path:** `app/mvp/content.js:1195-1241` (`exportProject` function)

### A1: Preserve current behavior

1. **Current observed behavior** (lines 1213-1216):
   - Filter: `library.items = library.items.filter((item) => !(item && item.id === project.content_id && item.filename === path.basename(outFile)))`
   - Where `path.basename(outFile) = ${content_id}-v${script_version}.mp4`
   - Same `content_id` + same `script_version`: Entry **replaced** (old filtered out, new pushed; one entry remains)
   - Same `content_id` + different `script_version`: Entries **appended** (old kept, new added — possible duplicates)
   - Different `content_id`: New entry added; entries accumulate per `content_id`
   - Library write: `await fsp.writeFile(contentLibraryPath, JSON.stringify(library, null, 2))` (line 1241)

2. **Guideline satisfaction**: **Fully satisfied** — this is the existing behavior.

3. **Expected behavioral change**: None — maintains status quo.

4. **Effects on Library entries, history, duplicates, file references**:
   - Entries with same `content_id + script_version` are overwritten (one record survives)
   - Entries with same `content_id` but different `script_version` accumulate (duplicates possible)
   - No explicit history retention beyond latest entries per `content_id + filename`
   - Physical file `${content_id}-v${script_version}.mp4` written to disk; old file retained/lost depending on renderer pipeline

5. **Evidence/acceptance criteria for ratification**: 
   - No new evidence needed; this is the baseline behavior
   - Owner would ratify by confirming "current behavior is acceptable"
   - Gap: No test verifies Library entry count after repeated generates with same/different script_versions

### A2: Prevent automatic replacement of Library records

1. **Current observed behavior**: Same `content_id` + same `script_version` → Library entry **replaced** (old filtered by `content_id + filename` match, filename includes `script_version`); one entry remains after push.

2. **Guideline satisfaction**: **Not satisfied** — source replaces entries when `content_id + script_version` match.

3. **Expected behavioral change**: If adopted, the filter would be modified to **keep** existing entry when `content_id + script_version` match, rather than removing it before pushing the new entry. The new entry would not be pushed, or would be pushed but the old one retained with a "conflict" marker.

4. **Effects on Library entries, history, duplicates, file references**:
   - Existing entries would never be removed for same `content_id + script_version`
   - Library would grow indefinitely for repeated generates with same `script_version`
   - File references: Same physical file `${content_id}-v${script_version}.mp4` would accumulate version history in Library, but on disk only one file exists at that path (renderer overwrite behavior independent)
   - Duplicates would be explicit in Library records, not hidden

5. **Evidence/acceptance criteria for ratification**:
   - Source modification to `content.js:1213-1216` to remove or alter the filter condition
   - Agreement that indefinite Library growth is acceptable, or that a periodic cleanup policy should accompany this option
   - No contract clause currently addresses this; CA-V1-05 + D1 does not specify Library replacement policy
   - **Gap**: No existing test covers Library growth behavior; would need to define acceptance test

### A3: Preserve explicit Artifact and Export Event history

1. **Current observed behavior**: 
   - No `committed Event` mechanism in source — `export_request_id` not used as durable record
   - Artifact records: `artifactId = ART-${Date.now()}-${random}` per generate; unique per generate
   - Library entries: `{id: content_id, filename: ${content_id}-v${script_version}.mp4, sha256, exported_at, width, height, duration_s, aspect_ratio: '9:16', status: 'EXPORTED'}`
   - No `event_seq`, `export_request_id`, or `request_fingerprint` fields in Library or artifact metadata

2. **Guideline satisfaction**: **Not satisfied** — no Export Event history exists in source.

3. **Expected behavioral change**: Library entries and/or artifact metadata would include explicit history tracking fields:
   - `event_seq` incrementing per export
   - `export_request_id` binding export to specific request
   - Possibly `previous_artifact_id` or `export_event_id` for lineage
   - Library entries might retain `export_event_id` linking to committed Event

4. **Effects on Library entries, history, duplicates, file references**:
   - Each Library entry would carry its export event lineage
   - Re-running generates could reference prior events rather than silently replacing
   - Physical file references would still follow renderer behavior; Library history would be separate
   - No automatic prevention of file overwrite; history would be auditable but not protective

5. **Evidence/acceptance criteria for ratification**:
   - Design decision on Event format: what fields, where stored (separate Durable Object, D1 table, or appended to Library JSON)
   - API changes to create/commit Events
   - Client-side consumption of Event history
   - **Gap**: No Event mechanism exists in current source; would require new implementation beyond read-only inspection
   - Contract gap: R1 contract does not mention Events; CA-V1-05 + D1 silent on Event persistence

### A4: Add verified reuse and replacement rules

1. **Current observed behavior**:
   - Same `content_id` + same `script_version`: Library entry **replaced** (no verification of whether existing entry's sha256 matches new generate's sha256)
   - Same `content_id` + different `script_version`: Entries **appended** (no dedupe by sha256)
   - No sha256-based reuse check in current Library write path

2. **Guideline satisfaction**: **Not satisfied** — no verified reuse rules exist.

3. **Expected behavioral change**: Before replacing or appending, compute SHA-256 of new output; compare against existing Library entry's sha256; if identical, reuse existing entry (do not push new); if different, apply replacement/append rules per current logic or new rules.

4. **Effects on Library entries, history, duplicates, file references**:
   - Eliminates duplicate Library entries when output is byte-identical
   - Preserves existing entry's `exported_at` timestamp if output identical
   - Physical file: If output identical and Content Artifact v1 route (unique `artifactId`), file already has unique name so no overwrite needed; if renderer, would need additional logic
   - Library entries would be stable: same content → same entry, not replaced

5. **Evidence/acceptance criteria for ratification**:
   - Code change in `content.js:1213-1221` to add sha256 comparison before filter/push
   - Agreement on sha256 computation scope: hash of markdown content? rendered MP4 binary? Both?
   - Definition of "identical" — exact byte-for-byte, or semantically equivalent (e.g., same content with different timestamp)
   - **Gap**: No test verifies sha256-based dedupe; would need acceptance test defining hash scope and identity criteria
   - Contract gap: CA-V1-05 guarantees sha256 integrity of artifact file, but not Library-entry identity

### A5: Another clearly described alternative (if supported by evidence)

- **Current evidence**: No alternative A5 observed in inspected sources. The five Design Closure Review Decisions 1-5 remain unresolved, and no ratified alternative has been documented.
- **Conclusion**: Cannot document A5 without new evidence. If Owner later defines an alternative, it would be added per the same structure.

---

## 2. Dimension B — Physical Files Impact Analysis

**Inspected paths:**
- Content Artifact v1: `app/mvp/service.js:3016` (`handleContentGenerate`)
- Video Renderer: `app/remotion/render.js` (`renderVideo`, `ffmpeg -y`)
- Content Library: `app/mvp/content.js:1241` (Library write, relationship to physical files)

### B1: Preserve current behavior

1. **Current observed behavior**:
   - **Content Artifact v1 route**: `artifactId = ART-${Date.now()}-${random}` per generate (line 3016) → unique file name `${artifactId}-script.md` → **physical-file overwrite cannot occur** by design (different file paths per generate)
   - **Video Renderer**: `ffmpeg -y` overwrites `outFile` if it exists; same `outFile` path → **previous MP4 lost**
   - **Content Library**: `await fsp.writeFile(contentLibraryPath, JSON.stringify(library, null, 2))` persists index; Library entries reference physical files via filename, but Library write does not control physical-file overwrite

2. **Guideline satisfaction**: **Fully satisfied** — this is the existing behavior for each pipeline independently.

3. **Expected behavioral change**: None — maintains status quo per pipeline.

4. **Effects on file overwrites, file reuse, replacement, recovery, loss of prior files**:
   - Content Artifact v1: Each generate produces new file with new name; old files retained on disk unless explicitly deleted; no overwrite ever occurs
   - Renderer: Same `outFile` path used for consecutive renders → previous MP4 overwritten/lost; this is intentional `ffmpeg -y` behavior
   - Library entries reference filenames but do not prevent or cause physical-file overwrites

5. **Evidence/acceptance criteria for ratification**: 
   - No new evidence needed; this is the baseline behavior per pipeline
   - Owner would ratify by confirming "current pipeline behaviors are acceptable"
   - Gap: No test verifies Content Artifact v1 file-name uniqueness across generates; no test verifies renderer overwrite behavior

### B2: Prohibit automatic physical-file overwrite

1. **Current observed behavior**:
   - Content Artifact v1: Already satisfies this by design (unique `artifactId` → unique file name)
   - Renderer: `ffmpeg -y` actively overwrites; no prohibition in current code
   - Library: No direct control over physical-file overwrite

2. **Guideline satisfaction**: **Partially satisfied** (v1 route only); **not satisfied** (renderer).

3. **Expected behavioral change**:
   - Content Artifact v1: No change needed; already prohibited by unique file names
   - Renderer: `ffmpeg -y` flag removed or replaced with `ffmpeg` without `-y`, or pre-check that aborts if `outFile` exists and no overwrite flag set
   - Could add pre-render check: if `outFile` exists, either (a) abort and keep existing, (b) rename output to new path, (c) proceed with overwrite after user confirmation

4. **Effects on file overwrites, file reuse, replacement, recovery, loss of prior files**:
   - Content Artifact v1: No effect (already satisfied)
   - Renderer: Prior MP4 files preserved when same `outFile` path used; new render either fails (if overwrite prohibited) or writes to new path
   - Recovery: If render aborts due to existing file, user would need to manually manage output paths or use explicit overwrite flag
   - Risk: If renderer always previously overwrote, users expecting append/history may be surprised; if render fails, workflow may stall until user resolves path conflict

5. **Evidence/acceptance criteria for ratification**:
   - Source change in `render.js` to remove or conditionally apply `ffmpeg -y` flag
   - Decision on overwrite policy when `outFile` exists: abort? rename? prompt user?
   - If rename: algorithm for generating new path (timestamp? counter?)
   - **Gap**: No existing test covers renderer overwrite behavior; would need acceptance test defining policy
   - **Gap**: No test defines user-facing behavior when overwrite is prohibited (error message? automatic rename? retry?)

### B3: Permit verified reuse of an intact matching file

1. **Current observed behavior**:
   - Content Artifact v1: Unique `artifactId` per generate → unique file name → **no existing file matches** new generate (different name)
   - Renderer: `ffmpeg -y` overwrites; no sha256 verification before overwrite
   - Library: Entry replacement/append based on `content_id + script_version`, not sha256 of physical file

2. **Guideline satisfaction**: **Not satisfied** — no verified reuse logic exists.

3. **Expected behavioral change**: Before writing new file, compute SHA-256 of candidate output; compare against existing file's SHA-256 (if file exists at target path); if identical, reuse existing file (do not write new); if different, write new file.

4. **Effects on file overwrites, file reuse, replacement, recovery, loss of prior files**:
   - Content Artifact v1: Would never match (different `artifactId` → different file name), so no effect; behavior unchanged
   - Renderer: If same `outFile` path and SHA-256 of new render matches existing file, reuse existing file (skip ffmpeg); if different, write new file (or overwrite with confirmation)
   - Recovery: Existing files preserved when output identical; new files written when output differs
   - Risk: SHA-256 comparison may be computationally expensive for large MP4 files; false negative (different content same hash unlikely but possible); false positive (same hash different content impossible by design)

5. **Evidence/acceptance criteria for ratification**:
   - Code change: add SHA-256 computation and comparison before file write in renderer (and potentially in Library path)
   - Definition of hash scope: full MP4 binary, or key tracks/chunks only?
   - Threshold for "identical" — exact byte-for-byte, or perceptually equivalent?
   - **Gap**: No test verifies sha256-based file reuse; would need acceptance test
   - **Gap**: MP4 SHA-256 computation performance on target platforms not measured
   - **Gap**: Hash collision probability for large files — practically negligible but theoretically non-zero

### B4: Define an auditable replacement procedure for damaged or missing files

1. **Current observed behavior**:
   - Content Artifact v1: On write failure (`fsp.writeFile` error), `fsp.unlink(filePath).catch(() => {})` and throw 500; state persist failure triggers honest cleanup reporting (`details.cleanup` starts with "failed:")
   - CA-V1-03 Test 8 Branch S: On state-persist failure after artifact file written, `fsp.unlink(filePath)` removes artifact file; `details.cleanup` reports "failed:"; artifact file left behind honestly `(await fsp.readdir(exportsS)).length === 1`
   - Renderer: No damage detection or replacement procedure; `ffmpeg -y` either succeeds or throws
   - Library: No damage detection; entry replacement based on `content_id + script_version`

2. **Guideline satisfaction**: **Partially satisfied** (v1 failure cleanup); **not satisfied** (renderer, proactive damage detection).

3. **Expected behavioral change**: 
   - Procedure for detecting when a previously-generated file is damaged or missing
   - Auditable steps: verify file integrity (sha256), report gap, execute replacement workflow
   - Replacement could generate new file with new `artifactId` (v1) or new render (renderer)
   - Library entry updated to reflect replacement; old file marked or logged

4. **Effects on file overwrites, file reuse, replacement, recovery, loss of prior files**:
   - Content Artifact v1: Extends existing CA-V1-03 cleanup honesty; if file damaged, new generate produces new `artifactId` → new file; old file left on disk honestly (as current Test 8 Branch S behavior)
   - Renderer: If `outFile` detected as damaged (sha256 mismatch or corrupt header), trigger replacement render to new path or with suffix; old file logged as "replaced due to damage"
   - Recovery: Damaged files replaced through explicit procedure, not silent; audit trail left

5. **Evidence/acceptance criteria for ratification**:
   - Definition of "damaged": sha256 mismatch? unplayable MP4? specific corruption patterns?
   - Procedure for detecting damage on each access, or on-demand via API
   - Replacement workflow: who triggers it (user, scheduler, system)?
   - Library update protocol: how is replaced entry recorded?
   - **Gap**: No test defines damage detection criteria; would need acceptance test
   - **Gap**: No existing replacement procedure in either pipeline; would require new implementation
   - **Gap**: Audit trail format not defined

### B5: Another clearly described alternative (if supported by evidence)

- **Current evidence**: No alternative B5 observed in inspected sources. The five Design Closure Review Decisions 1-5 remain unresolved, and no ratified alternative has been documented.
- **Conclusion**: Cannot document B5 without new evidence. If Owner later defines an alternative, it would be added per the same structure.

---

## 3. Identity and Integrity Mapping (Verified Source Behavior)

**Traced relationships from inspected source code only:**

| Identifier | Source definition | Verified behavior | Assumptions (not in source) |
|---|---|---|---|
| `artifact_id` | `service.js:3016`: `ART-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` | Unique per generate (Date.now() + random suffix); guarantees unique file name `${artifactId}-script.md` | Not linked to SHA-256; unrelated to `content_id` or `script_version` |
| SHA-256 | `service.js:3028`: `crypto.createHash('sha256').update(markdownContent).digest('hex')` | Computed from markdown content; stored in artifact metadata and Library entry response; guarantees file integrity per CA-V1-05 | Not used as Library dedupe key (currently `content_id + script_version + filename` used); not used by renderer for overwrite decision |
| `content_id` | Propagated from API request body; used in Library filter `item.id === project.content_id` (content.js:1213) | Filters Library entries by `content_id`; filename includes `content_id`: `${content_id}-v${script_version}.mp4` | Not globally unique across different scripts; same `content_id` can have multiple `script_version` entries |
| `script_version` | Part of Library entry; included in filename `${content_id}-v${script_version}.mp4` (content.js:1134) | Determines Library filter behavior: same `script_version` → replace; different → append | Not inherently tied to physical-file versioning; renderer may use different versioning scheme |
| `filename` / `file_ref` | `content.js:1134`: `${content_id}-v${script_version}.mp4`; Library entry `filename` field | Physical file path for renderer output; Library index references filename; does not control overwrite | Filename alone does not guarantee unique content; same `content_id + different script_version` → two files on disk with different versions |
| Export operations | `service.js:2991-3007`: HTTP POST to `/api/mvp/content/generate` with `candidate_id` and `approach_key` | Generates artifact with unique `artifactId`; writes markdown file; persists state; Library entry updated via `exportProject` | No `export_event_id` or `event_seq` in current source; no durable Event persistence |
| Export events / history | Not in current source (proposed in design discussions) | N/A — no fields, no mechanism | If added, proposed fields: `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, `timestamp` |

**Critical distinction**: `artifact_id` is a **generate-unique identifier** that guarantees different file names in Content Artifact v1 route. SHA-256 is a **content-integrity hash** computed from markdown. Neither currently serves as the other's substitute, and neither is tied to `content_id` or `script_version` in a way that the contract explicitly defines.

**Do not assume** that `artifact_id`, a file path, a content version, and a SHA-256 hash represent the same identity. They are separate concepts with separate verified behaviors.

---

## 4. Owner Decision Matrix

### Dimension A — Content Library Choices

| Choice | Description | Current Behavior | Required Change | Evidence Gap |
|---|---|---|---|---|
| **A1: Preserve current behavior** | Library entries replaced/appended as per `content_id + script_version` filter | Same `content_id + same script_version` → replace; different version → append; different `content_id` → accumulate | None | None (baseline) |
| **A2: Prevent automatic replacement of Library records** | Existing entries never removed when `content_id + script_version` match | Currently replaces; would keep old entry | Modify `content.js:1213-1216` filter to retain old entry; decide on new-entry disposition (push with marker? ignore?) | Test defining Library growth limits or cleanup policy |
| **A3: Preserve explicit Artifact and Export Event history** | Library entries carry event lineage; prior exports referenceable | No Event mechanism; no `event_seq`, `export_request_id` in source | Design Event format; add fields to Library/artifact; API changes for Event creation/commit | Full Event mechanism implementation beyond read-only inspection |
| **A4: Add verified reuse and replacement rules** | SHA-256 comparison before replace/append; identical output → reuse entry | No sha256-based dedupe; replace/append by `content_id + script_version` only | Add sha256 computation and comparison in `content.js:1213-1221`; define hash scope | Acceptance test defining hash scope and identity criteria; performance data for MP4 hashing |
| **A5: Alternative (not documented)** | Not supported by current evidence | N/A | N/A | Requires new evidence from Owner or design session |

**Dimension A dependencies**: A2 depends on A3 (Event history needs Library changes); A3 is independent of A4 (sha256 reuse can exist without Event history); A4 is independent of A3.

### Dimension B — Physical File Choices

| Choice | Description | Current Behavior | Required Change | Evidence Gap |
|---|---|---|---|---|
| **B1: Preserve current behavior** | Per-pipeline: v1 no-overwrite by design; renderer overwrite via `ffmpeg -y` | v1: unique file names prevent overwrite; renderer: `ffmpeg -y` overwrites | None | None (baseline) |
| **B2: Prohibit automatic physical-file overwrite** | No pipeline automatically overwrites existing files | v1: already satisfies (unique names); renderer: would remove `-y` or add pre-check | Remove `-y` from ffmpeg command in `render.js`; add pre-overwrite policy (abort/rename/prompt) | Acceptance test defining overwrite policy when `outFile` exists; user-facing behavior spec |
| **B3: Permit verified reuse of an intact matching file** | If existing file's SHA-256 matches new output, reuse it | No sha256-based reuse; always write new or overwrite | Add sha256 computation before file write in renderer (and v1 if needed); define hash scope and "identical" threshold | MP4 SHA-256 performance data; collision probability acceptance; test verifying reuse vs. re-render |
| **B4: Define auditable replacement procedure for damaged/missing files** | Explicit procedure to detect+replace damaged files | v1: CA-V1-03 Test 8 honesty on cleanup; renderer: no detection | Define "damaged" criteria; add integrity verification step; procedure for replacement render/generate; audit trail format | Damage definition; detection method (on-access vs. on-demand); replacement workflow; Library update protocol |
| **B5: Alternative (not documented)** | Not supported by current evidence | N/A | N/A | Requires new evidence from Owner or design session |

**Dimension B dependencies**: B2 is independent of B3 (overwrite prohibition vs. sha256 reuse are different mechanisms); B3 requires B2 or coexisting policy (if overwrite prohibited but sha256 matches, reuse would need separate handling); B4 is independent of B1-B3 (damage detection is separate from overwrite policy, though they may interact).

**Cross-dimension dependencies**:
- A4 (Library sha256 reuse) and B3 (Physical-file sha256 reuse) are **independent** — they operate in different domains (Library JSON index vs. file system), but both rely on sha256 computation. Owner may choose to implement one, both, or neither.
- A3 (Event history) and B2/B3 (File overwrite/reuse) are **partially dependent** — Event history can track which files were produced by which export, but does not directly control overwrite behavior.
- All choices remain subject to the **prerequisite**: Owner must first clarify R1 D1 no-overwrite scope (Dimension A vs. Dimension B, or both) before any of A1-A5 or B1-B5 can be ratified.

---

## 5. Mandatory Constraints (Preserved Verbatim)

- Read-only investigation only ✓
- No file modifications ✓
- No tests executed ✓
- No server startup or HTTP requests ✓
- No state mutation ✓
- No baseline acceptance ✓
- No implementation or Vertical Slice ✓
- No change to the Main Workflow or existing project status ✓
- Status invariants preserved verbatim:
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

---

## 6. Minimum Evidence Required for Each Possible Decision

### For Owner to ratify any A-choice or B-choice, the following minimum evidence gaps must be addressed:

| Choice | Minimum evidence needed before ratification |
|---|---|
| **A1, B1** | None — these are the baseline behaviors; ratification = Owner confirmation |
| **A2** | 1. Modified `content.js:1213-1216` source code showing filter change<br>2. Acceptance test defining Library growth behavior and limits<br>3. Owner agreement on whether indefinite entry accumulation is acceptable, or what cleanup policy accompanies A2 |
| **A3** | 1. Design specification for Event mechanism (fields, storage location)<br>2. API changes to create/commit Events<br>3. Client-side consumption design<br>4. No contract clause currently addresses Events; ratification would require acknowledging contract gap |
| **A4** | 1. Code change adding sha256 comparison in `content.js:1213-1221`<br>2. Definition of hash scope (markdown content? rendered MP4? both?)<br>3. Acceptance test verifying dedupe behavior for identical/different outputs<br>4. Definition of "identical" (byte-for-byte, or semantic equivalence?)<br>5. Performance data for sha256 computation on target platforms |
| **B2** | 1. Source change in `render.js` removing/conditionalizing `ffmpeg -y`<br>2. Acceptance test defining overwrite policy when `outFile` exists<br>3. User-facing behavior spec: error message? automatic rename? retry option?<br>4. No test currently exists for renderer overwrite; gap identified |
| **B3** | 1. Code change adding sha256 computation and comparison in renderer (and/or Library path)<br>2. MP4 SHA-256 performance benchmark on target platforms<br>3. Acceptance test verifying: (a) identical output → reuse, (b) different output → new file, (c) hash collision handling<br>4. Definition of "identical" threshold for large files<br>5. Risk assessment: false positive/negative probabilities |
| **B4** | 1. Definition of "damaged" file criteria (sha256 mismatch? corrupt header? unplayable?)<br>2. Integrity verification method and frequency (on-access, on-demand, scheduled?)<br>3. Replacement workflow procedure (who triggers, what generated/re-rendered)<br>4. Library update protocol for replaced entries<br>5. Audit trail format and content requirements<br>6. No existing procedure in either pipeline; would require new implementation |

### Evidence gaps summary

- **No test exists** in the inspected codebase for: Library entry replacement behavior with same/ different `script_version`; renderer overwrite when same `outFile` path; sha256-based dedupe in either pipeline; damage detection criteria; Event mechanism implementation.
- **No contract clause** explicitly addresses: Library overwrite vs. history-preservation; physical-file overwrite prohibition; verified reuse rules; damage detection and replacement; Event persistence.
- **Owner clarification prerequisite**: Before any A2-A4 or B2-B4 can be ratified, the Owner must first clarify R1 D1 no-overwrite scope (Dimension A, Dimension B, both, or neither). This clarification is the single most important unresolved question.

---

## Deliverable Confirmation

This complete evidence-backed impact analysis has been produced with:

- ✅ Source references for all current behaviors (exact file paths and line ranges)
- ✅ Scope matrix documenting 7 rows across 5 classifications each
- ✅ Explicit distinction between verified source behavior and assumptions
- ✅ Owner Decision Matrix with A1-A5 and B1-B5 choices, dependencies, and evidence gaps
- ✅ Minimum evidence requirements for each possible decision
- ✅ Preservation of all ACE status invariants verbatim
- ✅ Read-only compliance: no file modifications, no test execution, no HTTP requests, no state mutation, no baseline acceptance, no implementation or Vertical Slice
- ✅ Identification of evidence gaps rather than filling with assumptions
- ✅ Clear distinction between Content Artifact v1 and Video Renderer pipelines
- ✅ No inference of requirements absent from contract

**No files were modified, no tests were executed, no HTTP requests were made, no state was mutated, no baseline was accepted** — all statements based on read-only inspection of the specified sources.

**The single most important remaining question**: Once the Owner clarifies R1 D1 no-overwrite scope (Dimension A, Dimension B, both, or neither), which of the A1-A5 and B1-B5 choices should be ratified, and what is the minimum evidence package required for each ratification?

Until that clarification, no Vertical Slice can execute, and the five Design Closle Review Decisions 1-5 remain genuinely unresolved.