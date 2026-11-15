# ACE — R1 No-Overwrite Scope Clarification
## Read-only Evidence Investigation Report

### 1. Inspect the original contract

**File:** `verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md`

**Clause D1** (line in §5 Design Decisions table):
> D1 | version semantics = as-implemented (artifact ใหม่ต่อ generate, version 1, id unique)

**Clause CA-V1-05 + D1** (in Ratified Status Ledger):
> CA-V1-05 + D1 (uniqueness, version 1, no overwrite) | **PASS**

**Exact contract text regarding overwrite:**
- The contract explicitly states D1: "version semantics = as-implemented (artifact ใหม่ต่อ generate, version 1, id unique)"
- CA-V1-05 + D1 is classified PASS in the acceptance ledger
- The orphan policy R1 (amended 2026-10-26) addresses cleanup on failure branches M/W/S
- R1 §2: On cleanup success — "ห้ามมี orphan file หลงเหลือ" (no orphan files left behind)
- R1 §2: On cleanup failure — "ระบบต้องตรวจพบความล้มเหลวของการลบ และรายงาน orphan ที่เหลืออย่างตรงไปตรงต้น"
- The contract does **not** explicitly address physical-file overwrite
- The contract does **not** explicitly address Content Library entry replacement for successful exports
- The contract does **not** explicitly address prior-version preservation
- The contract guarantees: unique Artifact IDs per generate, version: 1, sha256 integrity verification

**Contract classification:**
- Artifact record uniqueness: **CONTRACT EXPLICIT** — D1 guarantees unique artifact_id per generate
- Existing-file overwrite: **NOT SPECIFIED** — contract language only guarantees unique IDs, not physical-file behavior
- Content Library entry replacement: **NOT SPECIFIED** — contract language does not address Library for successful exports
- Prior-version preservation: **NOT SPECIFIED** — contract silent on version history
- Identical-file reuse: **NOT SPECIFIED** — contract silent on reusing identical artifacts
- Replacement of damaged/incomplete files: **NOT SPECIFIED** — contract only addresses failure cleanup (CA-V1-03), not replacement
- Partial-failure cleanup: **TEST COVERAGE OBSERVED** — Test 8 (CA-V1-03) verifies honesty of cleanup reporting

### 2. Inspect the actual implementation

**A. `app/mvp/service.js` — `handleContentGenerate` (line 2991)**

**Artifact record behavior:**
- `artifactId = ART-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` (line 3016)
- Unique per generate because Date.now() + random suffix produces different IDs
- `version: 1` explicitly set in artifact metadata (line 3021)
- SHA-256 computed from markdown content: `crypto.createHash('sha256').update(markdownContent).digest('hex')` (line 3028)
- Two-phase commit: write artifact file first, then persist state
- File name: `${artifactId}-script.md` — guaranteed unique because artifact_id is unique

**Physical-file behavior:**
- `await fsp.writeFile(filePath, markdownContent, 'utf8')` (line 3046) — writes to the unique file path
- No explicit overwrite protection needed because artifact_id ensures unique file names
- On write failure: `await fsp.unlink(filePath).catch(() => {})` and throw 500 (lines 3052-3055)
- On state-persist failure: attempt `await fsp.unlink(filePath)` and honestly report `details.cleanup` outcome (lines 3078-3087)
- **Conclusion:** Physical-file overwrite does NOT occur in Content Artifact v1 route because each generate produces a unique artifact_id and unique file name. The "no overwrite" constraint is implicitly satisfied by the ID scheme.

**Renderer — `app/remotion/render.js` — `renderVideo`:**
- Uses `ffmpeg -y` flag (overwrite existing file)
- `const outFile = path.resolve(options.outFile)` — writes to the specified outFile path
- If same outFile path used for consecutive renders, previous MP4 is overwritten/lost
- **Conclusion:** Physical-file overwrite OCCURS in renderer when same outFile path is used. This is a separate pipeline from Content Artifact v1.

**Content Library — `app/mvp/content.js` — `exportProject` (line 1195-1216):**
- Filter condition (line 1213-1216):
  `library.items = library.items.filter((item) => !(item && item.id === project.content_id && item.filename === path.basename(outFile)))`
- Same `content_id` + same `script_version`: Library entry **replaced** (old filtered by `content_id + filename` match, filename = `${content_id}-v${script_version}.mp4`); one entry remains
- Same `content_id` + different `script_version`: Library entries **appended** (old kept, new added — possible duplicates); new file written to disk; old file retained on disk
- Different `content_id`: New entry added; entries accumulate per `content_id`
- **Conclusion:** Library entry replacement behavior is: (a) same content_id + same script_version → replace; (b) same content_id + different script_version → append. This hybrid behavior does not match either "always replace" or "history-preserving with artifact_id+sha256 filters."

### 3. Inspect test evidence

**Test 7 in `verification/ace-mission1-acceptance.js`:**
- Exercises real HTTP path for Content Artifact v1 route
- Reported T3 `req.body` defect at what was then line 2531, but source inspection shows current code at line 2991 now uses `ctx.readBody + parseJsonBody` — classified "appears superseded by source inspection"
- No test specifically addresses overwrite behavior or Library entries for successful exports

**Test 8 (CA-V1-03) — M/W/S failure injections:**
- Branch M (mkdir-blocked): Verifies 500 error + fs error in server log; no artifact file/dir created
- Branch W (artifact write fails): Verifies 500 error + specific reason in server log; **R1 no orphan file** — `listW.length === 0`; state unchanged
- Branch S (state persist fails after artifact file written): Verifies 500 error + "failed to persist artifact state" in log; **R1 cleanup honestly reported** — `details.cleanup` starts with "failed:"; **artifact file removed by rollback** — `listS.length === 0`; **state file byte-unchanged**; **no partial mutation** (empty contents/contentOrder); **no .tmp leftover**
- Branch S cleanup-failure: Verifies `details.cleanup` starts with "failed:" and logs includes "INJECTED_UNLINK_FAILURE"; **artifact file left behind** — `(await fsp.readdir(exportsS)).length === 1`
- **Classification:** These tests verify failure cleanup honesty but do **not** address overwrite behavior for successful exports

**No test specifically addresses:**
- Repeated generation with same `content_id` and `script_version`
- Existing output-file overwrite in Content Artifact v1 route
- Content Library entry replacement for successful exports
- Renderer overwrite with same `outFile` path
- Identical-file reuse vs. replacement decisions

### 4. Produce a scope matrix

| Row | Classification | Evidence and citation |
|---|---|---|
| **1. Artifact record uniqueness** | CONTRACT EXPLICIT | D1: "version semantics = as-implemented (artifact ใหม่ต่อ generate, version 1, id unique)" — `verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md` §5. Designer decision. service.js line 3016: `artifactId = ART-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` guarantees uniqueness per generate. |
| **2. Content Library entry replacement** | IMPLEMENTATION OBSERVED | `content.js:1213-1216`: Library filter `item.id === project.content_id && item.filename === path.basename(outFile)` where `filename = ${content_id}-v${script_version}.mp4`. Same `content_id + same script_version` → entry replaced; same `content_id + different script_version` → entries appended (duplicates possible). Does NOT match either Decision 3 option A (always push new) or B (history-preserving with artifact_id+sha256 filters). |
| **3. Physical-file overwrite** | CONTRACT EXPLICIT (v1 route), IMPLEMENTATION OBSERVED (renderer) | Content Artifact v1: service.js line 3016 — unique `artifactId` per generate → unique file name → no overwrite. Renderer `app/remotion/render.js`: `ffmpeg -y` flag overwrites `outFile` if it exists — same outFile path → previous MP4 lost. Contract only addresses v1 route; renderer separate pipeline. |
| **4. Prior-version preservation** | NOT SPECIFIED | Contract silent on version history. Library: when `script_version` differs, old entries kept (appended), new file retained on disk. Content Artifact v1: always creates new artifact with unique ID; no version history maintained. |
| **5. Identical-file reuse** | NOT SPECIFIED | Contract silent on reusing identical artifacts. Acceptance test CA-V1-02 verifies "artifact persistence, byte-equal" SHA-256 integrity but does not address reuse. No test addresses whether identical SHA-256 should trigger reuse or new generation. |
| **6. Replacement of damaged/incomplete files** | NOT SPECIFIED | Contract only addresses failure cleanup (CA-V1-03 Test 8 Branches W/S): honest reporting of cleanup outcome, no orphan files, state unchanged. Does not address replacing a previously generated artifact that is now known to be damaged or incomplete. |
| **7. Partial-failure cleanup** | TEST COVERAGE OBSERVED | Test 8 (CA-V1-03) Branches W and S verify: (a) no orphan files left behind on write/mkdir failure, (b) state byte-unchanged on failure, (c) honest `details.cleanup` reporting (succeeded/failed: prefix), (d) on cleanup-failure branch, artifact file left behind honestly. Does NOT address overwrite or replacement for successful exports. |

### 5. Present Owner decision options

**The single most important Owner question to resolve R1 "no-overwrite" scope:**

> **Does "no overwrite" in R1 D1 ("version semantics = as-implemented (artifact ใหม่ต่อ generate, version 1, id unique)") refer to:**
> - **(a) Library entries only** — the content-library.json index records; physical files may or may not be overwritten depending on pipeline
> - **(b) Physical files only** — the actual .md script files or .mp4 video files on disk; Library entries may be replaced/appended independently
> - **(c) Both Library entries and physical files** — the full constraint applies to both records and files
> - **(d) Neither** — the "no overwrite" phrase only guarantees unique Artifact IDs per generate; overwrite behavior is an implementation detail not governed by the contract

**Why this question is the prerequisite blocker:**

- **If (a)**: Library overwrite policy is separate from Content Artifact v1; Decision #2 (Library behavior) stands alone; Artifact identity (Decision #2 in broader scope) uses unique IDs which already prevent overwrite in v1 route
- **If (b)**: Content Artifact v1 already prevents physical-file overwrite by design (unique artifact_id → unique file name); renderer overwrite is a separate concern; no additional constraint needed
- **If (c)**: Both Library and physical files must be considered; Library behavior (Decision #2) must be reconciled with Content Artifact v1 file protection; Artifact identity must include both record and file dimensions
- **If (d)**: The "no overwrite" constraint is already satisfied by the unique artifact_id scheme in Content Artifact v1; the remaining ambiguity concerns only the Library, and Decision #2 (Library behavior) is the only active question

**Dependencies among the 6 Owner decisions (from Owner Decision Brief):**

1. **Decision #1 (R1 "no overwrite" scope clarification)** is the prerequisite for Decisions #2–#5
2. Until Decision #1 is resolved, Decisions #2 (Library behavior), #3 (Artifact identity), #4 (existing-file protection), and #5 (Recovery/history) cannot be fully decided
3. Decision #6 (§7 future considerations) is independent but consistent with maintaining status quo until other decisions are resolved

**Current status** — All ACE status invariants preserved verbatim:
- `Runtime Validation = NOT PERFORMED`
- `Implementation = NOT APPROVED`
- `Z1 / Mission 1 Status = UNCHANGED`
- `contractResolutionStatus = UNRESOLVED`
- `Row 18 / Row 3c = PENDING RECONCILIATION`
- `Canonical precedence = PENDING CONFIRMATION`
- `Baseline captured and accepted = NO`
- `ACS Seed Consolidation = PENDING OWNER REVIEW`
- `ACS Implementation = NOT APPROVED`
- `Scenario E = OWNER DECISION REQUIRED`

**No files were modified, no tests were executed, no HTTP requests were made, no state was mutated, no baseline was accepted** — all statements are based on read-only inspection of the specified sources.