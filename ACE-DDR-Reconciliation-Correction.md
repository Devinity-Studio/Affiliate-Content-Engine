# ACE — DDR Reconciliation Follow-up: Evidence Correction Report

## 1. Library Behavior Precise Trace

**Export write path** (`app/mvp/content.js:1100-1241`, `exportProject` function):

| Step | Code Reference | Behavior |
|---|---|---|
| Output file path | `content.js:1134` | `outFile = path.join(outDir, \`${project.content_id}-v${project.script_version}.mp4\`)` |
| Library read | `content.js:1208-1231` | Reads `content-library.json`; supports `#` comment header; creates `{items: []}` if missing/malformed (refuses silent overwrite) |
| **Filter condition** | `content.js:1213-1216` | `library.items = library.items.filter((item) => !(item && item.id === project.content_id && item.filename === path.basename(outFile)))` |
| New entry push | `content.js:1216-1221` | `library.items.push({id: project.content_id, filename: path.basename(outFile), sha256: rendered.sha256, exported_at, width, height, duration_s, aspect_ratio: '9:16', status: 'EXPORTED'})` |
| Library write | `content.js:1241` | `await fsp.writeFile(contentLibraryPath, JSON.stringify(library, null, 2))` |

**Filter condition analysis:**
- `path.basename(outFile) = \`${project.content_id}-v${project.script_version}.mp4\``
- Filter removes entries where `item.id === project.content_id && item.filename === \`${project.content_id}-v${project.script_version}.mp4\``

**Behavior by scenario:**

| Scenario | Library Behavior | Physical File |
|---|---|---|
| Same `content_id` + same `script_version` | **Entry replaced**: Old filtered out, new pushed. One entry remains. | **Overwritten**: Same path `${content_id}-v{version}.mp4` |
| Same `content_id` + different `script_version` | **Entries appended**: Old NOT filtered out (filename differs), new appended. Two entries for same `content_id`. | **Overwritten**: New file `${content_id}-v{newVersion}.mp4`; old file retained on disk but Library has both entries |
| Different `content_id` | **New entry added**: No filter match; new entry pushed alongside existing. | New file in new `content_id` directory |

**This contradicts** Design Closure Review Decision 3 option B (history-preserving Library with `content_id + artifact_id + sha256` filters that reuse entries if identical). The current source behavior replaces when `content_id + script_version` match, and appends when `script_version` differs — neither pure "replace" nor pure "history-preserving" behavior.

---

## 2. Prior Owner Decisions Recovered

| Decision | Evidence | Classification | Scope |
|---|---|---|---|
| **R1 contract D1** ("uniqueness, version 1, no overwrite") | `verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md` — CA-V1-05 + D1: "uniqueness, version 1, no overwrite" — PASS | `SOURCE_VERIFIED` (ratified in R1 contract, 2026-10-26) | Acceptance test: verifies no partial mutation, no orphan file, state unchanged on failure. Does NOT specifically address Library overwrite behavior for successful exports. |
| **Design Closure Review Decision 3** (history-preserving Library) | `ACE-Design-Closure-Review.md` §7 — Decision 3: "Library overwrite-versus-history-preservation?" — proposed option B recommended | `SOURCE_REPORTED` (design proposal, not ratified) | Library design: A. always push new entry vs B. history-preserving with filters. **Not ratified** by Owner. |
| **DEC-1-G1** (G1 plan approval) | `data/mission1/decision-log.md` — DEC-1-G1, 2026-10-19 | `SOURCE_VERIFIED` (recorded in workspace) | Foundation Slice only; does not authorize EXP/SCR/PUB/asset operations. Does not address Library or Event behavior. |
| **EV-1 through EV-1-10** (Shopee Affiliate evidence) | `data/mission1/evidence-log.md` | `SOURCE_VERIFIED` (inspected help pages, no account access) | Program terms, commission semantics, application status. No conclusions about ACE Library/Event design. |

**No other explicit Owner decisions** about Library overwrite policy, `artifact_id`, Event persistence, or recovery state machine were found in the workspace. All 5 Design Closure Review Decisions 1-5 remain unresolved.

---

## 3. Reconciliation of the Five Decisions

| # | Decision | Existing Owner Decision Evidence | Classification | Remaining Ambiguity |
|---|---|---|---|---|
| 1 | Implement Export Event mechanism? | No Event mechanism in source. R1 contract D1 does not address Event persistence. | `NOT_FOUND_IN_INSPECTED_SCOPE` for Event mechanism; `SOURCE_REPORTED` for design proposal | Is the R1 "no overwrite" constraint about Library entries or physical files? Does it imply Event should exist? |
| 2 | `artifact_id` derived from SHA-256 or separate? | No `artifact_id` field in source or contracts. R1 contract D1 mentions "version 1, no overwrite" but does not define `artifact_id` scheme. | `NOT_FOUND_IN_INSPECTED_SCOPE` | The R1 "no overwrite" phrase is ambiguous: does it mean "no Library overwrite" or "no physical file overwrite" or both? |
| 3 | Library overwrite-versus-history-preservation? | **Critical inconsistency**: R1 contract CA-V1-05 + D1 ("uniqueness, version 1, no overwrite") PASSED, but source behavior is: (a) same `content_id + same script_version` → Library entry replaced; (b) same `content_id + different script_version` → Library entries appended (duplicates). Neither matches Decision 3 option A (always replace) nor option B (history-preserving with `artifact_id + sha256` filters). | `CONFLICTING` — R1 contract language does not map cleanly to either Decision 3 option. Source behavior is hybrid: replace-by-`content_id+script_version`, append-by-different-version. | What does R1 "no overwrite" actually refer to? Does the source need redesign to match Decision 3 option B? |
| 4 | Retry / Recovery state machine? | No retry mechanism; `withLock` only prevents concurrent requests (content.js/service.js). R1 contract covers failure injection (M/W/S) but not retry semantics. | `NOT_FOUND_IN_INSPECTED_SCOPE` | R1 M/W/S injection tests (content.js:Test 8) verify cleanup honesty but do not implement retry/recovery state machine. |
| 5 | Variant differentiation strategy? | No variant differentiation in source. R1 D3 defines structural determinism (D3) but not variant strategy. | `NOT_FOUND_IN_INSPECTED_SCOPE` | R1 D3: "determinism = structural only; the 'Generated at' timestamp is the only field expected to differ between two identical generates." Does not address variant Artifact/Event handling. |

**Key reconciliation finding**: The R1 contract's CA-V1-05 + D1 ("uniqueness, version 1, no overwrite") is **inconsistent** with the Design Closure Review Decision 3 options as currently worded, because the actual source code behavior does not match either option cleanly. This requires Owner clarification: does "no overwrite" mean (a) Library entries should never be replaced, (b) physical files should never be overwritten, (c) both with specific conditions, or (d) something else? Until resolved, Decision 3 remains genuinely ambiguous.

---

## 4. Technical Terminology Corrections

| Term | Correct Definition | Source |
|---|---|---|
| **Export Request** | A logical operation initiated by a user or system; identified by `export_request_id` (not currently in source) | Design discussion context |
| **Export Attempt** | A single execution of the export pipeline; may succeed or fail; not necessarily durable | Design discussion context |
| **committed Event** | A durable, persisted record of export occurrence with `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, `timestamp`; not in current source | Design discussion context (proposed) |
| **Artifact** | Immutable recorded file: `artifact_id` (stable logical identity distinct from SHA-256) + `sha256` (integrity verification) + physical file path + provenance | Design discussion context (proposed); not currently in source as structured record |
| **Request Binding** | Binds `export_request_id` to project + script version + renderer config; enables idempotent retries | Design discussion context (proposed); not in source |
| **Content Library entry** | Derived index entry: `id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status`; latest-entry catalog per `content_id + filename` filter | `SOURCE_VERIFIED` (inspected in `content.js:1195-1241` and `data/mission1/content-library.json`) |

**Terminology prohibitions** (from task boundaries):
- ✅ Do not treat an error response as proof that no artifact was written
- ✅ Do not treat the absence of an Event or Artifact lookup result as proof of PROVEN-CLEAN
- ✅ Treat PROVEN-CLEAN as requiring positive evidence; otherwise preserve UNKNOWN
- ✅ Keep SHA-256 byte identity separate from Artifact record identity unless an approved decision explicitly defines them as identical

**Correction**: The original report correctly maintained these distinctions. No terminology changes needed beyond clarifying the R1 contract "no overwrite" ambiguity.

---

## 5. Exact Recommended Next Action

**Owner clarification required on Decision 3 inconsistency**:

The R1 contract (2026-10-26) contains CA-V1-05 + D1: "uniqueness, version 1, no overwrite" — PASS in acceptance tests. However, the actual source code behavior in `exportProject` (`content.js:1195-1216`) is:

1. Same `content_id` + same `script_version`: Library entry **replaced** (old filtered out by `content_id + filename` match, where filename includes `script_version`)
2. Same `content_id` + different `script_version`: Library entries **appended** (old kept, new added — possible duplicates)

This hybrid behavior does not match either Design Closure Review Decision 3 option:
- **Option A**: Library always pushes new entry (current behavior partially, but with specific `content_id + filename` filter)
- **Option B**: Library filters by `content_id + artifact_id + sha256`; reuses entry if identical (not implemented)

**Required Owner decision**: 
- Does "no overwrite" in R1 D1 mean Library entries should never be replaced for successful exports? 
- Or does it mean physical files should never be overwritten? 
- Or does it imply a specific Library design that the source code must be redesigned to match?

**Until this is resolved**, the five Design Closure Review Decisions 1-5 remain genuinely unresolved, and no Vertical Slice can be executed. The recommended next action is:

> **The Owner must explicitly clarify the R1 "no overwrite" constraint scope (Library entries, physical files, or both) and either ratify Decision 3 option A or B, or redesign the source Library write path to match the chosen option.** 

This clarification is a prerequisite for any further DDR v1.3 consistency assessment, Event mechanism implementation, or Vertical Slice execution.

---

## Status Invariants Preserved

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
```

**Scenario E = OWNER DECISION REQUIRED** — until the R1 "no overwrite" constraint scope is explicitly clarified and ratified.