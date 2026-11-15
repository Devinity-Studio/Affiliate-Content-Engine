# ACE — R1 No-Overwrite: Owner Preliminary Direction Decision Record (Updated with Artifact Lifecycle Analysis)

## Purpose

Record the Owner's preliminary direction and enumerate the exact decisions still requiring explicit confirmation. This document does **not** constitute formal ratification, contract amendment, Vertical Slice authorization, or implementation approval.

## Owner's Preliminary Direction (CONFIRMED R1 D1 SCOPE)

- **R1 D1 Scope Clarification**: The Owner has confirmed that R1 "no overwrite" constraint covers **both** Content Library (Dimension A) and **Physical Files** (Dimension B).
- **Dimension A direction**: Consider A2–A3 to protect existing entries and design history.
- **Dimension B direction**: Consider B2–B4 to prevent automatic overwrite and design auditable reuse/replacement.
- **Artifact Lifecycle design direction** (principles 1–10, from the supplementary analysis): Preserve used/published significance vs. pre-use; allow replacement of damaged/missing pre-use artifacts with validation; never silently destroy old artifact identity or history; replacement has own artifact identity and SHA-256; preserve old-new replacement relationship; old physical bytes may be deleted if no longer needed for recovery/investigation/compliance; deleting physical bytes must not delete artifact record or lineage; record enough evidence for investigation; do not claim interchangeability; published artifacts get separate retention assessment before cleanup.
- **This direction authorizes analysis and decision-record drafting only**. It does **not** upgrade any A1-A5 or B1-B5 choice to a ratified requirement, nor does it authorize any source or contract modifications.

## Status Update Table

| รายการ                                   | สถานะ                                    |
| ---------------------------------------- | ---------------------------------------- |
| Content Library — ขอบเขต No-Overwrite    | อยู่ในขอบเขตที่ยืนยันแล้ว                |
| Physical Files — ขอบเขต No-Overwrite     | อยู่ในขอบเขตที่ยืนยันแล้ว                |
| A2 — Library replacement policy          | ยังไม่ได้รับการรับรอง (เห็นสม côtés ทั้ง O1, O2, O3) |
| A3 — Artifact / Export Event History     | ยังไม่ได้รับการรับรอง (เห็นสม sides ทั้ง O1, O2, O3) |
| B2 — Physical-file overwrite prohibition | ยังไม่ได้รับการรับรอง (เห็นสม sides ทั้ง O1, O2, O3, O4) |
| B3 — Verified SHA-256 reuse              | ยังไม่ได้รับการรับรอง (เห็นสม sides ทั้ง O1, O2, O3) |
| B4 — Damaged/missing-file replacement    | ยังไม่ได้รับการรับรอง (เห็นสม sides ทั้ง O1, O2, O3, O4) |
| Contract amendment / Vertical Slice      | ยังไม่ได้รับอนุมัติ                      |
| Implementation / Runtime Validation      | ยังไม่ได้รับอนุมัติ / ยังไม่ได้ดำเนินการ |

## 5 Outstanding Decisions (All Requiring Owner Confirmation)

### A2: Prevent automatic replacement of Library records

**Exact question requiring Owner confirmation:**
> When the same `content_id` + same `script_version` combination is generated again, should the Library entry be **automatically replaced** (current behavior: old filtered out, new pushed), **preserved** (old kept, new not pushed), or **handled differently** (with explicit lineage tracking)?

**Current contract and source evidence:**
- R1 contract D1: "version semantics = as-implemented (artifact ใหม่ต่อ generate, version 1, id unique)" — guarantees unique artifact_id per generate, version: 1
- CA-V1-05 + D1: PASS in acceptance ledger — but does not specify Library replacement policy
- `content.js:1213-1216`: Current filter `item.id === project.content_id && item.filename === path.basename(outFile)` where filename = `${content_id}-v${script_version}.mp4`; same match → entry replaced
- No contract clause explicitly governs Library replacement for successful exports

**Available options and consequences:**
- **A2-O1: Replace automatically** (current behavior)
  - Pro: Library always reflects latest export; no accumulation
  - Con: Loses record of prior export for same `content_id + script_version`; Library entry changes unexpectedly
- **A2-O2: Preserve existing entry, do not push new**
  - Pro: Library history retained for same `content_id + script_version`; each entry documents its export event
  - Con: Library grows indefinitely for repeated same-version generates; may confuse user expecting "latest"
- **A2-O3: Replace but retain old as "previous" entry with marker**
  - Pro: Both current and prior export recorded; explicit lineage
  - Con: Requires Library schema change; more complex filter logic

**How the Artifact Lifecycle analysis affects A2:**
- The lifecycle's `replaces`/`replaced_by` fields and replacement events can coexist with any A2 choice.
- **A2-O3** is most compatible with the lifecycle, as the explicit `previous` marker supplements the `replaces` linkage.
- **A2-O1** and **A2-O2** are also compatible if the lifecycle records the `replaces` relationship separately in artifact metadata/Library JSON.
- **A2 remains separately ratifiable** — the lifecycle adds a higher-level `replaces` linkage alongside the Library's `content_id + script_version` replacement behavior.

**Minimum evidence and acceptance criteria required:**
1. Owner confirms which of A2-O1, A2-O2, or A2-O3 is desired
2. If A2-O2 or A2-O3: Library schema acceptance (can entries have `previous_artifact_id` or `status: 'PREVIOUS'?)
3. If A2-O2: Policy on Library growth limits or periodic cleanup
4. If A2-O3: Design of `previous` marker field and its semantics

**Dependencies on other decisions:**
- A2 is independent of A3 (Event history) but interacts with A4 (sha256 reuse)
- A2-O3 depends on Library schema being extendable
- A2 interacts with B3 (sha256-based file reuse) — if A2 prevents replacement and B3 permits sha256 reuse, the two policies may conflict or complement depending on implementation

### A3: Preserve explicit Artifact and Export Event history

**Exact question requiring Owner confirmation:**
> Should the system maintain an explicit, durable history of Artifact generates and Export Events, and if so, what fields, storage mechanism, and access pattern should it use?

**Current contract and source evidence:**
- R1 contract: Silent on Event persistence; CA-V1-05 + D1 mentions uniqueness, version 1, no overwrite but not Event mechanism
- No `committed Event`, `event_seq`, `export_request_id`, or `request_fingerprint` fields exist in current source
- `service.js:3016`: `artifactId = ART-${Date.now()}-${random}` per generate — unique but ephemeral (no persistent history binding)
- `content.js:1195-1241`: Library entries have `exported_at` timestamp but no event linkage
- Design discussion context (proposed, not ratified): `committed Event` with `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, `timestamp`

**Available options and consequences:**
- **A3-O1: No explicit history** (current behavior)
  - Pro: Simplest; no new fields or storage mechanisms
  - Con: No durable record of prior generates/exports; rely on Library entries and file names only
- **A3-O2: Artifact-level history only**
  - Pro: Each artifact carries its generate timestamp (already via `Date.now()` in `artifactId`); simple
  - Con: No explicit export event linkage; cannot reconstruct export sequence without Library
- **A3-O3: Full Export Event mechanism** (proposed design)
  - Pro: Durable, queryable history; enables idempotent retries; audit trail; supports A2 by providing replacement rationale
  - Con: Requires new fields in artifact metadata and/or Library JSON; API changes; Event storage (D1 table, separate KV, or appended JSON); client consumption design

**How the Artifact Lifecycle analysis affects A3:**
- The lifecycle is **heavily dependent on A3**. Without an Event mechanism, the `replaces` linkage and replacement events must be stored in artifact metadata or Library JSON only — less durable, less queryable, but functional.
- **A3-O2 (artifact-level history)** allows the lifecycle's replacement events to be stored per-artifact with `replaces`, `replaced_by`, `replacement_reason`, `replaced_at` fields — functional and durable within the artifact's record.
- **A3-O3 (full Event mechanism)** is the preferred companion: each replacement is a committed Event with `replaces_event_seq`, enabling durable audit trail, idempotent retries, and export statistics accuracy.
- **A3-O1** supports the lifecycle with reduced durability — replacement events exist only in artifact metadata, not in a separate queryable Event store.
- **A3 remains separately ratifiable** — the lifecycle design does not resolve A3; it adds a dependency: the degree of lifecycle durability depends on the A3 choice.

**Minimum evidence and acceptance criteria required:**
1. Owner confirms which of A3-O1, A3-O2, or A3-O3 is desired
2. If A3-O2 or A3-O3: Design specification for history fields (exact schema, field names, types)
3. If A3-O3: Storage mechanism choice (D1 table, `freebuff.wrangler.jsonc` secrets, appended Library JSON, separate Durable Object)
4. If A3-O3: API design for Event creation, commit, and retrieval
5. If A3-O3: Client-facing UI/UX for viewing export history
6. Contract gap acknowledgment: R1 contract does not mention Events; ratification would acknowledge this gap and either (a) approve contract amendment adding Event provisions, or (b) operate with proposed design outside ratified R1 scope

**Dependencies on other decisions:**
- A3 is independent of A2 (Library replacement policy) but interacts with A4 (sha256 reuse) — Event history can provide rationale for why a Library entry was replaced/reused
- A3-O3 is a prerequisite for A2-O3 (Replace but retain old as "previous" needs Event linkage to explain why)
- A3 interacts with B2/B3/B4 (File overwrite/reuse/replacement policies) — Event history can track which export produced which file, but does not directly control overwrite behavior
- A3 is independent of B1-B4 (Physical file policies) but may inform them (e.g., Event history can identify which file belongs to which export)

### B2: Prohibit automatic physical-file overwrite

**Exact question requiring Owner confirmation:**
> Should the system **prohibit** automatic physical-file overwrite in the Video Renderer (and/or Content Artifact v1 route), and if so, what should happen when the target file already exists?

**Current behavior and source evidence:**
- Content Artifact v1 route (`service.js:3016`): Already satisfies this by design — unique `artifactId` per generate → unique file name `${artifactId}-script.md`; overwrite physically impossible without deliberate path manipulation
- Video Renderer (`render.js`): `ffmpeg -y` overwrites `outFile` if it exists; same `outFile` path → previous MP4 lost; no prohibition in current code
- R1 contract orphan cleanup (CA-V1-03 Test 8): Honestly reports cleanup outcome; removes artifact file on state-persist failure; but does not address proactive overwrite prohibition

**Available options and consequences:**
- **B2-O1: No prohibition** (current behavior)
  - Pro: Simplest; renderer behaves as designed; explicit overwrite when user intends it
  - Con: Renderer overwrites same `outFile`; prior MP4 lost without trace; no auditable control
- **B2-O2: Prohibit overwrite, abort render if `outFile` exists**
  - Pro: Prior MP4 preserved; explicit failure user can resolve (re-run render, choose different path, or explicitly overwrite)
  - Con: Render fails when path conflict; user workflow disruption; may need manual path management
- **B2-O3: Prohibit overwrite, rename output to new path**
  - Pro: Render always succeeds; prior MP4 preserved; new file gets distinguishable path (timestamp counter suffix)
  - Con: Disk accumulation of versioned files; algorithm for new path needs definition; may confuse user expecting single `outFile`
- **B2-O4: Prohibit overwrite, prompt user for confirmation**
  - Pro: User explicitly decides; combines automation with user control
  - Con: Requires interactive session (not suitable for automated/headless renders); UI complexity; may stall workflow pending user response

**How the Artifact Lifecycle analysis affects B2:**
- The lifecycle does **not** directly address B2. B2 concerns what happens when a new render/export targets an existing `outFile`. The lifecycle concerns replacement of damaged/missing pre-use artifacts. These are separate domains:
  - B2: "New render targets existing outFile — what happens?" (overwrite/abort/rename/prompt)
  - Lifecycle: "Existing artifact damaged/missing — generate replacement, validate, activate, optionally delete old bytes"
- They can coexist: B2-O1/O2/O3/O4 and lifecycle steps 1-9 operate in different contexts. B2 remains independently ratifiable; **do not infer lifecycle outcomes from B2 or vice versa**.

**Minimum evidence and acceptance criteria required:**
1. Owner confirms which of B2-O1, B2-O2, B2-O3, or B2-O4 is desired for the Renderer
2. If B2-O2: Acceptance test defining render failure behavior when `outFile` exists; user-facing error message spec
3. If B2-O3: Algorithm for generating new path (suffix: `-v2`, `-${timestamp}`, `-${counter}`?); policy for how many versions to retain
4. If B2-O4: UI/UX design for confirmation prompt; headless/automated mode fallback behavior
5. If B2-O2/B2-O3/B2-O4: Evidence that Content Artifact v1 route is unaffected (unique file names already prevent overwrite there); explicit confirmation
6. Gap: No existing test defines renderer overwrite policy; acceptance test must be designed and accepted before ratification

**Dependencies on other decisions:**
- B2 is independent of B3 (sha256-based reuse) and B4 (damaged-file replacement) — they are separate mechanisms that can coexist
- B2 interacts with A3 (Event history) — if overwrite is prohibited and an Event exists, the Event can record why the render was aborted/renamed
- B2 is independent of A2/A3/A4 (Library policies) — physical file and Library index are separate domains; changes to one do not necessitate changes to the other
- B2-O2/B2-O3/B2-O4 all require: decision on whether Content Artifact v1 route needs any change (it likely doesn't, given unique file names, but must be explicitly confirmed)

### B3: Permit verified reuse of an intact matching file

**Exact question requiring Owner confirmation:**
> When a new render/export produces output with SHA-256 matching an existing file at the target path, should the system **reuse** the existing file (skip re-render), or always write a new file?

**Current behavior and source evidence:**
- Content Artifact v1 route: Unique `artifactId` per generate → unique file name → **no existing file ever matches** new generate (different name by design); sha256 comparison would be meaningless for file-reuse decision
- Video Renderer: No sha256 verification before `ffmpeg -y` overwrite; no reuse logic; each render writes new file to `outFile` (overwriting if exists)
- Library: No sha256-based dedupe; entry replacement/append based on `content_id + script_version`, not physical-file sha256

**Available options and consequences:**
- **B3-O1: No verified reuse** (current behavior)
  - Pro: Simplest; each generate/render produces new file (or overwrites); no hash computation overhead
  - Con: Wasted compute if output identical; no file reuse; for renderer, same `outFile` always overwrites
- **B3-O2: Reuse if SHA-256 matches, skip re-render**
  - Pro: Avoids redundant computation; preserves existing file when output identical; for renderer, same `outFile` would be kept (not overwritten) if hash matches
  - Con: SHA-256 computation cost on large MP4 files; hash collision probability (theoretically non-zero, practically negligible); requires deciding: hash of raw MP4? selective tracks/chunks?; false positive/negative handling
- **B3-O3: Reuse if SHA-256 matches, with explicit log**
  - Pro: All of B3-O2 benefits plus auditable record of reuse events
  - Con: Additional log overhead; still requires sha256 computation and comparison threshold definition

**How the Artifact Lifecycle analysis affects B3:**
- The lifecycle uses SHA-256 as the integrity witness (principle 4: "matching hash may establish byte identity only when compared against trusted reference"). However:
  - B3 concerns: "When new output's SHA-256 matches existing file, reuse it?"
  - Lifecycle: SHA-256 is used to verify artifact A's integrity before deciding on replacement/cleanup, and to generate B's hash for validation.
- They intersect at: "Does matching SHA-256 prevent unnecessary re-generation?" but are **not** the same question.
- **B3 remains independently ratifiable** — do not infer B3 outcomes from the lifecycle or vice versa.
- B2 and B3 are also independent: B2 decides what happens when `outFile` exists; B3 decides whether to re-render when file exists with matching hash. They can coexist fully.

**Minimum evidence and acceptance criteria required:**
1. Owner confirms which of B3-O1, B3-O2, or B3-O3 is desired
2. If B3-O2 or B3-O3: Definition of SHA-256 scope (full MP4 binary? MP4 metadata only? key audio/video tracks?); computation must be deterministic and reproducible
3. If B3-O2 or B3-O3: Threshold for "match" — exact byte-for-byte hash, or allowance for perceptual equivalence? (for MP4, byte-for-byte is standard; perceptual would require transcoding analysis)
4. If B3-O2 or B3-O3: Acceptance test verifying: (a) identical output → reuse, (b) different output → new file, (c) hash collision handling procedure
5. If B3-O2 or B3-O3: Performance benchmark of MP4 SHA-256 computation on target platforms (typical file sizes, compute time)
6. If B3-O2 or B3-O3: Collision probability assessment and acceptable risk level
6. Gap: No test exists for sha256-based file reuse in either pipeline; acceptance test must be designed

**Dependencies on other decisions:**
- B3 is independent of B2 (overwrite prohibition) — they can coexist: B2 decides what happens when `outFile` exists; B3 decides whether to re-render when file exists with matching hash
- B3 is independent of B4 (damaged-file replacement) — B3 is for identical-output reuse; B4 is for when file is damaged/missing; they address different scenarios
- B3 interacts with A4 (Library sha256 reuse) — both use sha256 but in different domains (physical files vs. Library index); Owner may choose to implement one, both, neither, or both with different hash scopes
- B3 interacts with A3 (Event history) — if B3-O2 reuses file, Event history can record that reuse occurred (avoiding double-count in export statistics)

### B4: Define auditable replacement procedure for damaged or missing files

**Exact question requiring Owner confirmation:**
> When a previously generated or rendered file is detected as damaged or missing, what auditable procedure should the system follow for replacement: silent re-generation, explicit user prompt, scheduled scan, or other?

**Current behavior and source evidence:**
- Content Artifact v1 route (`service.js:3052-3055`): On write failure, `fsp.unlink(filePath).catch(() => {})` and throw 500; on state-persist failure, honest cleanup reporting (`details.cleanup` starts with "failed:"); CA-V1-03 Test 8 Branch S: artifact file left behind honestly `(await fsp.readdir(exportsS)).length === 1`; state file byte-unchanged; no partial mutation
- CA-V1-03 Test 8 Branch S cleanup-failure: `details.cleanup` starts with "failed:"; logs include "INJECTED_UNLINK_FAILURE"; artifact file left behind honestly
- Renderer: No damage detection or replacement procedure; `ffmpeg -y` either succeeds or throws; no integrity verification after render
- Library: No damage detection; entry replacement based on `content_id + script_version`

**Available options and consequences:**
- **B4-O1: No proactive procedure** (current behavior)
  - Pro: Simplest; existing failure handling (CA-V1-03) is honest but reactive; no new overhead
  - Con: No systematic damage detection; if file goes missing/corrupts between generates, may go undetected until next export attempt; no auditable replacement trail
- **B4-O2: On-demand integrity verification via API**
  - Pro: User-initiated; no background overhead; explicit when checked; user controls replacement
  - Con: User must remember to verify; not systematic; may miss corrupted files until data loss observed
- **B4-O3: Periodic scheduled integrity scan + auto-replace**
  - Pro: Systematic; catches corruption early; automatic replacement; auditable trail via Event/log
  - Con: Background overhead; requires scheduler; what defines "damaged"? sha256 mismatch? playable header?; replacement policy (re-generate with same `content_id + script_version`? new `artifactId`?)
- **B4-O4: Integrity check on each access/export attempt**
  - Pro: Catches damage early; always freshness-verified; seamless user experience if automatic
  - Con: Performance overhead on every access/export; may slow workflow; same "damaged" definition problem as B4-O3

**How the Artifact Lifecycle analysis affects B4:**
- The proposed lifecycle is essentially a **formalization of B4**. The degree of automation in the lifecycle maps directly to the B4 choice:
  - **B4-O1 (no proactive procedure)**: The lifecycle steps are manual/ad hoc, matching current behavior. The lifecycle design is documented but not automated; Owner or scheduler would execute steps 1-9 manually.
  - **B4-O2 (on-demand API verification)**: Steps 1-6 of the lifecycle are exposed via API; Owner/scheduler triggers detection → recording → eligibility determination → replacement generation → validation → activation. Steps 8-9 (cleanup) are on-demand.
  - **B4-O3 (scheduled scan + auto-replace)**: The full lifecycle as evaluated in section 4 is automated via scheduled task. Steps 1-9 execute automatically on a trigger (cron, system event); all outcomes recorded audibly.
  - **B4-O4 (integrity check on each access)**: Extends the lifecycle to make damage detection per-access rather than scheduled; each export/access attempt triggers step 1 (detect damage), with steps 2-9 following if damage is found.
- **Impact**: The lifecycle design partiall y depends on B4; B4-O3 is the closest match to the full lifecycle evaluated; B4-O2 maps steps 1-6 via API; B4-O1 maps to ad-hoc manual execution. **B4 remains separately ratifiable**, and the lifecycle proposal does not ratify any B4 choice — it merely documents the design space.

**Minimum evidence and acceptance criteria required:**
1. Owner confirms which of B4-O1, B4-O2, B4-O3, or B4-O4 is desired
2. If B4-O2: API design for integrity verification (endpoint, parameters, response format); who initiates (user, scheduler, system)?
3. If B4-O3: Scheduled task design (cron-like, system-triggered); definition of "damaged" (sha256 mismatch threshold? playable header check? full transcoding test?); replacement policy (re-generate with same `content_id + script_version`? new `artifactId`?)
4. If B4-O3: Storage for scan results and replacement history (D1 table? appended Library JSON? separate audit log?); retention policy
5. If B4-O4: Performance overhead measurement on typical workloads; acceptable latency impact
6. If B4-O2/O3/O4: Definition of "damaged" file — sha256 mismatch? corrupt MP4 header (ftyp atom missing)? unplayable in standard player? specific corruption patterns?
7. If B4-O2/O3/O4: Auditable trail format and content requirements (what's logged, for how long, access policy)
8. Gap: No existing damage detection or replacement procedure in either pipeline; would require new implementation

**Dependencies on other decisions:**
- B4 is independent of B2/B3 (overwrite prohibition and sha256 reuse) — addresses different scenario (damaged/missing file vs. overwrite/reuse)
- B4 interacts with A3 (Event history) — replacement events can be logged as committed Events, providing audit trail and export statistics accuracy
- B4 interacts with A2 (Library replacement) — if Library entry is replaced due to detected damage, the Event can record why and what new entry replaced it
- B4 is independent of A1/A2/A3/A4/A5 (Library choices) — physical file damage detection is separate from Library index management; though they may be coordinated through Event history
- B4 interacts with overall system reliability — definition of "damaged" and replacement policy affects data integrity guarantees the system promises

## Decision Dependencies Summary

| Decision | Depends on | Affected by |
|---|---|---|
| **A2** | Owner preference on Library replacement | A3 (Event history for A2-O3), A4 (sha256 reuse interacts) |
| **A3** | Contract gap acknowledgment (Event mechanism not in R1) | A2 (Event linkage for A2-O3), B2/B3/B4 (Event can record overwrite/reuse/replacement events) |
| **B2** | Content Artifact v1 unaffected (unique names) | B3 (coexists: B2 decides overwrite-on-exists, B3 decides re-render-on-matching-hash) — **do not infer outcomes** |
| **B3** | sha256 computation scope and threshold | B2 (can coexist: B2 on `outFile` exists, B3 on matching hash), A4 (separate sha256 domain: Library vs. files) — **do not infer outcomes** |
| **B4** | Definition of "damaged" file | A3 (Event history can log replacement events), A2 (can coordinate Library replacement reason) |

**Prerequisite**: Owner has confirmed R1 D1 scope covers both Content Library and Physical Files. **No decision can be ratified until each of A2, A3, B2, B3, B4 is individually confirmed (or baseline O1 selected for each).**

## Mandatory Status Invariants (Preserved Verbatim)

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

## Explicit Disclaimer

**This Decision Record is not:**
- ✅ Formal Owner ratification of any A1-A5 or B1-B5 choice
- ✅ Contract amendment or modification of any kind
- ✅ Vertical Slice authorization or execution approval
- ✅ Implementation approval or source code change authorization
- ✅ Baseline acceptance of any kind
- ✅ Inferred Owner decision or policy establishment

**This Decision Record is:**
- ✅ Evidence-backed documentation of the Owner's preliminary direction
- ✅ Enumeration of all outstanding decisions requiring Owner confirmation
- ✅ Identification of decision dependencies, evidence gaps, and contract amendment candidates
- ✅ Integration of the Artifact Lifecycle analysis (principles 1–10) and its effect on A2, A3, and B4 trade-offs
- ✅ Explicit statement that B2 and B3 are independent of the lifecycle and of each other — do not infer outcomes
- ✅ Preservation of all ACE status invariants verbatim
- ✅ Read-only compliance: no file modifications (beyond this Decision Record), no test execution, no HTTP requests, no state mutation, no baseline acceptance, no implementation approval
- ✅ Explicit distinction between Owner-ratified decisions and technical details resolvable by evidence

## The 5 Decisions Are Now Ready for Owner Individual Consideration

The Owner can now consider each decision individually, with full awareness of how the Artifact Lifecycle analysis affects the options and trade-offs:

### 1. **A2: Library replacement policy**
- Confirm O1 (current/auto-replace), O2 (preserve existing), or O3 (replace + "previous" marker)
- **Note**: A2-O3 is most compatible with the Artifact Lifecycle's `replaces`/`replaced_by` linkage; O1 and O2 are also compatible if lifecycle records the linkage separately.

### 2. **A3: Artifact/Event history**
- Confirm O1 (no explicit history), O2 (artifact-level history), or O3 (full Event mechanism)
- **Note**: The lifecycle's durability depends on A3: O3 provides the most durable event linkage; O2 provides per-artifact metadata linkage; O1 supports the lifecycle with reduced durability.

### 3. **B2: Physical-file overwrite prohibition**
- Confirm O1 (no prohibition), O2 (abort if exists), O3 (rename output), or O4 (prompt user)
- **Note**: B2 is independent of the lifecycle and B3. Do not infer lifecycle outcomes from B2 or vice versa.

### 4. **B3: Verified SHA-256 reuse**
- Confirm O1 (no reuse), O2 (reuse if matches, skip re-render), or O3 (reuse with explicit log)
- **Note**: B3 is independent of the lifecycle and B2. Do not infer lifecycle outcomes from B3 or vice versa. B3 intersects with A4 (Library sha256 reuse) but is a separate decision.

### 5. **B4: Damaged/missing-file replacement**
- Confirm O1 (no proactive procedure, lifecycle manual/ad hoc), O2 (on-demand API, lifecycle semi-automated via API), or O3 (scheduled scan + auto-replace, full lifecycle automation)
- **Note**: The lifecycle maps directly to B4-O3; B4-O2 maps steps 1-6 via API; B4-O1 maps to ad-hoc manual execution. B4 remains separately ratifiable.

## For Each Decision: Owner Should

1. **Review the evidence, options, and consequences** documented in this Decision Record (and the supplementary `ACE-R1-Artifact-Lifecycle-Safe-Cleanup-Replacement.md` for the lifecycle design)
2. **Confirm or decline each choice** — selecting O1 (baseline/current behavior) for any decision is valid and maintains the status quo
3. **Understand independence** — all five decisions are now independently ratifiable given the confirmed R1 D1 scope (both Library and Physical Files). B2 and B3 are explicitly independent of the lifecycle and each other.
4. **Note that baseline selections are valid** — the Owner can choose O1 for some decisions and O2-O3 for others, creating a mixed policy that is fully consistent with the confirmed R1 D1 scope.

## After Owner Confirmation

Once the Owner confirms each decision (or selects baseline for each), this Decision Record can be updated to reflect ratified choices, and the proposed minimum implementation plan (Phases 1-5 as documented in the supplementary analysis) can be considered for future execution — but **no implementation, test execution, or server startup is authorized until all ratifications are complete and explicit Owner authorization is given**.

## Suggested Follow-ups for the Owner

The Owner can now proceed with individual decision consideration. The suggested next steps are:

1. **Consider A2** — Library replacement policy (confirm O2-O3 or accept O1)
2. **Consider A3** — Artifact/Event history (confirm O2-O3 or accept O1)
3. **Consider B2** — Physical-file overwrite prohibition (confirm O2-O4 or accept O1)
4. **Consider B3** — Verified SHA-256 reuse (confirm O2-O3 or accept O1)
5. **Consider B4** — Damaged/missing-file replacement (confirm O2-O4 or accept O1)

Each follow-up can be a short confirmation: e.g., "A2-O2 confirmed" or "B1 accepted for all decisions." After all five are resolved, the Decision Record updates and the implementation plan can be formally considered — but **no code changes, test execution, or deployment is authorized without complete Owner ratification**.

## Files Created in This Session

1. `ACE-R1-No-Overwrite-Scope.md` — R1 No-Overwrite Scope Clarification (read-only investigation)
2. `ACE-R1-No-Overwrite-ImpactAnalysis.md` — R1 No-Overwrite: Read-only Impact Analysis
3. `ACE-R1-Artifact-Lifecycle-Safe-Cleanup-Replacement.md` — Artifact Lifecycle, Safe Cleanup & Replacement Lineage (read-only analysis)
4. `ACE-R1-No-Overwrite-Owner-DecisionRecord.md` — Owner Preliminary Direction Decision Record (updated with confirmed R1 D1 scope and Artifact Lifecycle analysis integration)

## Final Confirmations (Preserved Verbatim)

- ✅ No application code or contracts were changed.
- ✅ No destructive cleanup or replacement operation was performed.
- ✅ No runtime validation was performed.
- ✅ No unresolved Owner decision was treated as ratified.
- ✅ Implementation remains NOT APPROVED.
- ✅ All ACE status invariants preserved verbatim:
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

**The Decision Record is complete with confirmed R1 D1 scope and integrated Artifact Lifecycle analysis. The Owner can now consider each of the 5 decisions individually.**