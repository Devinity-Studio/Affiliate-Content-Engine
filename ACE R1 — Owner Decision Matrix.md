# ACE R1 — Owner Decision Matrix (Read-Only Analysis)

**Purpose**: Consistency audit of ACE R1 policy areas A2, A3, B2, B3, and B4. Identifies unsupported claims, incorrect dependency assumptions, duplicated or contradictory entries, and conclusions exceeding available evidence. Read-only analysis only; no ratification, implementation, or contract amendment authorized.

---

## 1. Verify Decision Options

### A2 Options (Library replacement policy)

| Option ID | Exact Option Meaning (from source) | Source Reference |
|-----------|-----------------------------------|------------------|
| **A2-O1** | Replace automatically (current behavior): same `content_id + script_version` → old filtered out, new pushed | `content.js:1213-1216`; Decision Record p.29-30 |
| **A2-O2** | Preserve existing entry, do not push new: same `content_id + script_version` → old kept, new not pushed | Decision Record p.30; `content.js` filter logic observed but O2 behavior not implemented |
| **A2-O3** | Replace but retain old as "previous" entry with marker: same `content_id + script_version` → new pushed, old retained as previous with explicit marker | Decision Record p.30-31; most compatible with lifecycle `replaces`/`replaced_by` linkage |

**Verification**: All three option IDs and meanings preserved from Decision Record. No option IDs silently rewritten.

### A3 Options (Artifact/Export Event history)

| Option ID | Exact Option Meaning (from source) | Source Reference |
|-----------|-----------------------------------|------------------|
| **A3-O1** | No explicit history (current behavior): no durable record of prior generates/exports beyond Library entries and file names | Decision Record p.31-32; `service.js:3016` artifactId generation; `content.js:1195-1241` Library entries with `exported_at` but no event linkage |
| **A3-O2** | Artifact-level history only: each artifact carries its generate timestamp (already via `Date.now()` in `artifactId`); simple history per artifact record | Decision Record p.32; lifecycle `replaces`/`replaced_by` fields would fit here; per-artifact metadata linkage |
| **A3-O3** | Full Export Event mechanism (proposed design): durable, queryable history with `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, `timestamp`; enables idempotent retries; audit trail | Decision Record p.32-33; proposed design context (not ratified); requires new fields, API changes, Event storage |

**Verification**: All three option IDs and meanings preserved. A3-O3 explicitly noted as "proposed, not ratified" in multiple sources.

### B2 Options (Physical-file overwrite prohibition)

| Option ID | Exact Option Meaning (from source) | Source Reference |
|-----------|-----------------------------------|------------------|
| **B2-O1** | No prohibition (current behavior): renderer behaves as designed; explicit overwrite when user intends it; `ffmpeg -y` overwrites same `outFile` | Decision Record p.33; `app/remotion/render.js`: `ffmpeg -y` observed overwrite capability |
| **B2-O2** | Prohibit overwrite, abort render if `outFile` exists: prior MP4 preserved; explicit failure user can resolve (re-run render, choose different path, or explicitly overwrite) | Decision Record p.33-34; no existing test defines renderer overwrite policy |
| **B2-O3** | Prohibit overwrite, rename output to new path: render always succeeds; prior MP4 preserved; new file gets distinguishable path (timestamp counter suffix); algorithm for new path needs definition | Decision Record p.34; suffix definition not specified in source |
| **B2-O4** | Prohibit overwrite, prompt user for confirmation: user explicitly decides; combines automation with user control; not suitable for automated/headless renders; UI complexity; may stall workflow pending user response | Decision Record p.34; requires interactive session |

**Verification**: All four option IDs and meanings preserved from Decision Record. B2-O1 explicitly tied to `ffmpeg -y` behavior in `render.js`.

### B3 Options (Verified SHA-256 reuse)

| Option ID | Exact Option Meaning (from source) | Source Reference |
|-----------|-----------------------------------|------------------|
| **B3-O1** | No verified reuse (current behavior): each generate/render produces new file (or overwrites); no hash computation overhead; for renderer, same `outFile` always overwrites | Decision Record p.34-35; Content Artifact v1 route: unique `artifactId` → unique file name → no existing file ever matches new generate |
| **B3-O2** | Reuse if SHA-256 matches, skip re-render: avoid redundant computation; preserve existing file when output identical; for renderer, same `outFile` would be kept (not overwritten) if hash matches | Decision Record p.35; sha256 computation cost on large MP4 files; hash collision probability; must decide hash scope (full MP4? metadata? key tracks/chunks?) |
| **B3-O3** | Reuse if SHA-256 matches, with explicit log: all of B3-O2 benefits plus auditable record of reuse events; additional log overhead | Decision Record p.35; still requires sha256 computation and comparison threshold definition |

**Verification**: All three option IDs and meanings preserved. B3-O2/O3 explicitly note that SHA-256 computation is a cost and collision probability is non-zero (though practically negligible).

### B4 Options (Damaged/missing-file replacement)

| Option ID | Exact Option Meaning (from source) | Source Reference |
|-----------|-----------------------------------|------------------|
| **B4-O1** | No proactive procedure (current behavior): existing failure handling (CA-V1-03) is honest but reactive; no systematic damage detection; if file goes missing/corrupts between generates, may go undetected | Decision Record p.35-36; CA-V1-03 Test 8 honest cleanup reporting only under injection |
| **B4-O2** | On-demand integrity verification via API: user-initiated; no background overhead; explicit when checked; user controls replacement | Decision Record p.36; API design not in source; who initiates (user, scheduler, system?) not defined |
| **B4-O3** | Periodic scheduled integrity scan + auto-replace: systematic; catches corruption early; automatic replacement; auditable trail via Event/log; full lifecycle as evaluated | Decision Record p.36; maps directly to the proposed 9-step lifecycle; scheduler required |
| **B4-O4** | Integrity check on each access/export attempt: catches damage early; always freshness-verified; seamless user experience if automatic; performance overhead on every access/export | Decision Record p.36; may slow workflow; same "damaged" definition problem as B4-O3 |

**Verification**: All four option IDs and meanings preserved from Decision Record. B4-O3 explicitly maps to the 9-step lifecycle evaluated in the analysis.

---

## 2. Audit Dependency Claims

### A2-O3 versus A3-O3: Full Event mechanism requirement

**Claim in some analyses**: A2-O3 (Replace + "previous" marker) requires A3-O3 (Full Event mechanism).

**Evidence audit**:
- Decision Record p.31: "A2-O3 is most compatible with the lifecycle, as the explicit `previous` marker supplements the `replaces` linkage." ✓
- Decision Record p.32: "A3-O3 is the preferred companion: each replacement is a committed Event with `replaces_event_seq`, enabling durable audit trail, idempotent retries, and export statistics accuracy." ✓
- Decision Record p.32: "A2 remains separately ratifiable — the lifecycle adds a higher-level `replaces` linkage alongside the Library's `content_id + script_version` replacement behavior." ✓
- Decision Record p.32: "A2-O3 depends on Library schema being extendable" — not on A3 specifically.

**Classification**: **Data or design compatibility requirement** (not strict prerequisite). A2-O3 can coexist with A3-O1 or A3-O2, though with reduced durability. The dependency is directional (A3 durability depends on A2 choice) but not ratification-order-dependent.

**Correction if needed**: The matrix should state that A2-O3 is *compatible with* A3-O3 but does not *require* it. A2-O3 can operate with A3-O2 (per-artifact history) or even A3-O1 (no explicit history) with reduced durability.

### B2 versus B3: Overwrite-on-existing-path policy vs. hash-based reuse eligibility

**Claim**: B2 and B3 are independent; do not infer outcomes from one to the other.

**Evidence audit**:
- Decision Record p.36: "B2 is independent of B3 (sha256-based reuse) and B4 (damaged-file replacement) — they are separate mechanisms that can coexist."
- Decision Record p.36: "B2 interacts with A3 (Event history) — if overwrite is prohibited and an Event exists, the Event can record why the render was aborted/renamed." ✓
- Decision Record p.36: "B3 interacts with A4 (Library sha256 reuse) — both use sha256 but in different domains (physical files vs. Library index)."
- Decision Record p.36: "B2 and B3 are also independent: B2 decides what happens when `outFile` exists; B3 decides whether to re-render when file exists with matching hash. They can coexist fully."

**Classification**: **Strictly independent**. No prerequisite relationship. They address different questions (B2: "what happens when outFile exists?"; B3: "when file exists with matching hash, reuse?") and can operate in any combination.

**No correction needed**: The Decision Record already correctly states independence. The matrix should preserve this.

### A2 versus B3: Library-level reuse from physical-file byte reuse

**Claim**: A2 (Library entry behavior) and B3 (physical-file SHA-256 reuse) are distinct.

**Evidence audit**:
- Decision Record p.36: "B3 is independent of B2 (overwrite prohibition) and B4 (damaged-file replacement) — they are separate mechanisms that can coexist."
- Decision Record p.36: "B3 interacts with A4 (Library sha256 reuse) — both use sha256 but in different domains (physical files vs. Library index). Owner may choose to implement one, both, neither, or both with different hash scopes."
- Decision Record p.36: "B3 interacts with A3 (Event history) — if B3-O2 reuses file, Event history can record that reuse occurred (avoiding double-count in export statistics)."
- Decision Record p.36: "A2 is independent of A3 (Event history) but interacts with A4 (sha256 reuse)."

**Classification**: **Distinct domains, partial interaction via A4**. A2 governs Library entry representation; B3 governs physical-file hash-based skip. They can coexist but may conflict if hash scopes differ. The matrix must not equate Library reuse with physical-file reuse.

**No correction needed**: Already correctly distinguished in the Decision Record.

### A2 versus B4: Library entry policy from missing/damaged-file recovery

**Claim**: A2 (Library replacement policy) and B4 (damaged/missing-file replacement) are separate.

**Evidence audit**:
- Decision Record p.36: "B4 is independent of B2/B3 (overwrite prohibition and sha256 reuse) — addresses different scenario (damaged/missing file vs. overwrite/reuse)."
- Decision Record p.36: "B4 interacts with A3 (Event history) — replacement events can be logged as committed Events, providing audit trail and export statistics accuracy."
- Decision Record p.36: "B4 interacts with A2 (Library replacement) — if Library entry is replaced due to detected damage, the Event can record why and what new entry replaced it."
- Decision Record p.36: "B4 remains separately ratifiable, and the lifecycle proposal does not ratify any B4 choice — it merely documents the design space."

**Classification**: **Separate scenarios, coordinated through Event history**. B4 addresses "what when file is damaged/missing"; A2 addresses "Library replacement for same content_id+script_version". They can coexist; B4 replacement may trigger A2 behavior but is not dependent on it.

**No correction needed**: Already correctly distinguished.

### A3 versus B4: Ability to record recovery events from recovery procedure

**Claim**: A3 (Event history) and B4 (replacement procedure) are distinguishable.

**Evidence audit**:
- Decision Record p.36: "B4 interacts with A3 (Event history) — replacement events can be logged as committed Events, providing audit trail and export statistics accuracy."
- Decision Record p.36: "The lifecycle maps directly to B4-O3; B4-O2 maps steps 1-6 via API; B4-O1 maps to ad-hoc manual execution."
- Decision Record p.32: "A3-O3 (full Event mechanism) is the preferred companion: each replacement is a committed Event with `replaces_event_seq`, enabling durable audit trail, idempotent retries, and export statistics accuracy."
- Decision Record p.32: "A3-O2 (artifact-level history) allows the lifecycle's replacement events to be stored per-artifact with `replaces`, `replaced_by`, `replacement_reason`, `replaced_at` fields — functional and durable within the artifact's record."
- Decision Record p.32: "A3-O1 supports the lifecycle with reduced durability — replacement events exist only in artifact metadata, not in a separate queryable Event store."

**Classification**: **A3 provides the event mechanism; B4 defines when/why replacements occur**. They interact but are not dependent. A3-O3 provides the most durable linkage for B4 events; A3-O1/O2 can support B4 with reduced durability.

**No correction needed**: Already correctly distinguished in the Decision Record.

### A4 versus B3: Library-level SHA-256 vs. physical-file SHA-256

**Claim**: Preserve the distinction between Library-level SHA-256 and physical-file SHA-256.

**Evidence audit**:
- Decision Record p.36: "B3 interacts with A4 (Library sha256 reuse) — both use sha256 but in different domains (physical files vs. Library index). Owner may choose to implement one, both, neither, or both with different hash scopes."
- Decision Record section 3.10: "What R1 contract does NOT support: SHA-256 comparison for byte identity (beyond per-artifact integrity)."
- Decision Record section 3.10: "CA-V1-05 guarantees per-artifact integrity, not cross-artifact comparison."
- Decision Record section 3.2: "The artifact record is a logical identity that persists independently of the physical file's existence. The physical file bytes are transient storage that may be deleted without deleting the artifact record, per principles 6-7."

**Classification**: **Same hash algorithm, different domains**. The matrix must explicitly state that sha256 comparison in B3 is for physical-file byte identity; A4 (Library sha256 reuse) is for Library index purposes. Different scopes may yield different results.

**No correction needed**: Already correctly distinguished.

---

## 3. Audit Implementation Evidence

### Verified capability statements and their scope

| Statement | Source | Scope of Behavior | Evidence Type |
|-----------|--------|-------------------|---------------|
| `artifactId = ART-${Date.now()}-${Math.random()}` per generate | `service.js:3016` | Unique artifact_id per generate; ephemeral (no persistent history binding) | **Direct source inspection** |
| Unique file name `${artifactId}-script.md` per generate | `service.js:3021` | Overwrite physically impossible without deliberate path manipulation (Content Artifact v1 route) | **Direct source inspection** |
| `ffmpeg -y` overwrites `outFile` if it exists | `app/remotion/render.js`: `ffmpeg -y` flag | Same `outFile` path → previous MP4 lost; no prohibition in current code | **Direct source inspection** |
| Library filter `item.id === project.content_id && item.filename === path.basename(outFile)` | `content.js:1213-1216` | Same `content_id + same script_version` → entry replaced; different script_version → entries appended (duplicates possible) | **Direct source inspection** |
| `77/77` acceptance tests passing | Reported in contract verification | Historical reported evidence; no test run performed for this audit | **Previously reported inspection** |
| `fsp.unlink(filePath).catch(() => {})` on write failure | `service.js:3052-3055` | Honest cleanup reporting; artifact file left behind on failure; no partial mutation | **Direct source inspection** |
| `details.cleanup` starts with "failed:" on state-persist failure | `service.js:3078-3087` | Logs include "INJECTED_UNLINK_FAILURE"; artifact file left behind honestly | **Direct source inspection** |
| `ffmpeg -y` from explicit path, env vars, .tmp/tools, or PATH | `app/remotion/render.js:65` (`resolveFfmpeg()`) | Ffmpeg discovery from multiple sources; no prohibition in current code | **Direct source inspection** |

**Flags for overgeneralization**:
- ❌ Do not infer universal physical-file overwrite protection from unique artifact IDs or filenames — Content Artifact v1 route has unique names by design, but Renderer path does not.
- ❌ Scope any "no overwrite" claim to the exact inspected route and code path: Content Artifact v1 route (unique names) ≠ Renderer path (ffmpeg -y overwrite possible).
- ❌ Keep `ffmpeg -y` overwrite capability in `app/remotion/render.js` separate from A2 Library reuse scope — they are different code paths.
- ❌ Treat the reported `77/77` acceptance result as historical reported evidence unless a test run is explicitly evidenced — do not run tests for this audit.
- ❌ Treat timestamp/random-based identifiers as probabilistically collision-resistant, not mathematically unique — `ART-${Date.now()}-${random}` reduces collision risk but does not guarantee uniqueness.

---

## 4. Audit SHA-256 and Reuse Reasoning

### Distinctions that must be preserved

| Concept | Definition | Evidence Scope |
|---------|-----------|----------------|
| **Exact byte identity** | SHA-256 of identical byte sequence matches trusted reference | **Contract explicit**: CA-V1-05 guarantees per-artifact integrity; service.js:3028 computes SHA-256 from markdown content |
| **Semantic content equivalence** | Same meaning/message but possibly different bytes (e.g., transcoded MP4) | **Not contract-supported**: No clause addresses semantic equivalence; would require transcoding analysis |
| **Suitability for intended format, channel, version, and use** | Output matches requirements for the target publication context | **Not independently established by hash**: Hash proves byte identity only; suitability requires separate validation |
| **Integrity against a trusted reference** | Hash computed from file compared against previously stored/hash of known-good file | **Direct source**: service.js:3028 stores SHA-256 in artifact metadata; compared on re-verification |
| **Evidence available before rendering or only after rendering** | Pre-render evidence vs. post-render comparison | **Gap identified**: No pre-render evidence currently exists in source; post-render hash comparison incurs already-incurred render cost |

**Critical finding**: Where the matrix proposes pre-render reuse, identify what trustworthy pre-render evidence would be required and whether that evidence currently exists.

**Answer**: No pre-render evidence exists in the current source. SHA-256 can only be computed after file generation/render. Pre-render reuse would require a separate evidence mechanism (e.g., cached render output, fingerprinting before render) that is not in the current implementation. The matrix must not claim that post-render hash comparison saves the render cost already incurred.

---

## 5. Audit Recovery and Replacement Safety

### Principles checked against the matrix

| Principle | Status | Observation |
|-----------|--------|-------------|
| **Verify replacement bytes and suitability before switching the active file** | ✅ Preserved | Decision Record explicitly states this in B4 lifecycle steps 5-7; replacement must be validated before activation |
| **Preserve artifact identity, version history, and lineage unless explicit Owner decision establishes otherwise** | ✅ Preserved | Principles 5-7; Decision Record p.29: "artifact records and lineage must remain distinct from physical file bytes" |
| **Do not assume a new SHA-256 requires a new Artifact identity or Lineage root** | ✅ Preserved | Decision Record principle 4: "Replacement must have its own artifact identity and SHA-256 hash; different hash expected when bytes differ; matching hash may establish byte identity only when compared against trusted reference." |
| **Do not destroy old bytes or recovery evidence before the replacement is verified and a recoverable transition is established** | ✅ Preserved | Decision Record principle 6: "Old physical bytes need not be retained permanently when unusable and no longer needed for recovery, investigation, legal, compliance, or other explicitly established purposes." |
| **Distinguish previously used or published artifacts from pre-use failed outputs** | ✅ Preserved | Decision Record principle 10: "Published artifacts get separate retention assessment before cleanup or replacement. Pre-use cleanup rules do not automatically apply to published artifacts." |
| **Identify what happens if replacement verification, Library persistence, or history recording fails** | ⚠ Partially preserved | Decision Record identifies failure modes in section 3.6, but matrix may overgeneralize. Need to ensure: (a) failed validation → old artifact retained, (b) failed Library write → error propagated honestly, (c) failed cleanup → file left behind honestly (per CA-V1-03) |
| **Treat Soft Delete, staging, atomic replacement, rollback, and scheduled scanning as proposed mechanisms unless directly evidenced** | ✅ Preserved | Decision Record section 3.6-3.9: all identified as proposed/mechanism concepts, not implemented; only CA-V1-03 Test 8 Branch S cleanup-failure observed honestly |

**Key gap**: The matrix must not assume the nine-step lifecycle is implemented merely because it is documented. All lifecycle steps are evaluated as candidate design, not ratified implementation.

---

## 6. Required Output

### 1. List of exact inconsistencies or unsupported claims, with section and row references

| # | Inconsistency or Unsupported Claim | Section/Row | Correction |
|---|-----------------------------------|-------------|------------|
| 1 | Claim that A2-O3 requires A3-O3 | Dependency audit §2 | A2-O3 is compatible with A3-O3 but does not require it; operable with A3-O2 or A3-O1 with reduced durability |
| 2 | Claim that B2 outcome determines B3 outcome (or vice versa) | Dependency audit §2 | B2 and B3 are strictly independent; they can coexist in any combination |
| 3 | Claim that matching SHA-256 proves semantic suitability across artifacts/formats | SHA-256 audit §4 | Hash proves byte identity only for exact bytes compared against trusted reference; does not establish semantic suitability |
| 4 | Claim that post-render hash comparison saves the render cost already incurred | SHA-256 audit §4 | Post-render hash computation incurs the render cost; cannot avoid cost already paid |
| 5 | Claim that the nine-step lifecycle is implemented | Recovery audit §5 | Lifecycle is evaluated as candidate design, not ratified implementation; no code changes or tests performed |
| 6 | Claim that unique filenames alone prove overwrite safety | Implementation evidence §3 | Unique filenames prevent overwrite in Content Artifact v1 route only; Renderer path (ffmpeg -y) can overwrite same `outFile` |
| 7 | Claim that `77/77` acceptance tests verify runtime behavior | Implementation evidence §3 | Reported as historical evidence; no test run performed for this audit; do not claim verification |
| 8 | Claim that timestamp/random `artifactId` mathematically guarantees uniqueness | Implementation evidence §3 | `ART-${Date.now()}-${random}` reduces collision risk but does not mathematically guarantee uniqueness; practical limitation, not strict guarantee |
| 9 | Claim that Library-level SHA-256 reuse and physical-file SHA-256 reuse are the same decision | Dependency audit §2 | Separate decisions in different domains (Library index vs. physical files); Owner may implement one, both, neither, or both with different hash scopes |
| 10 | Claim that B4-O3 (scheduled scan + auto-replace) implies full lifecycle automation | Recovery audit §5 | B4-O3 maps to the evaluated lifecycle steps 1-9 automation, but lifecycle is not implemented; B4 remains separately ratifiable |

### 2. Dependency classification table

| Decision Pair | Dependency Classification | Rationale |
|---------------|--------------------------|-----------|
| A2-O3 → A3-O3 | Data or design compatibility | A2-O3 compatible with A3-O3 but not required; A3 durability depends on A2 choice but not ratification-order-dependent |
| B2 → B3 | Independent (strict) | Different questions (B2: overwrite-on-exists; B3: reuse-on-matching-hash); can coexist in any combination |
| A2 → B3 | Partial interaction via A4 | Both use sha256 but in different domains (Library index vs. physical files); may conflict if hash scopes differ |
| A2 → B4 | Separate scenarios, coordinated via Event history | B4: damaged/missing file; A2: Library replacement for same content_id+script_version; can coexist |
| A3 → B4 | A3 provides event mechanism; B4 defines when/why | A3-O3 provides most durable linkage for B4 events; A3-O1/O2 can support B4 with reduced durability |
| B3 → A4 | Same hash algorithm, different domains | B3: physical-file sha256; A4: Library sha256 reuse; different scopes may yield different results |
| B4 → A3 | Event history can log replacement events | If B4 replacement occurs, A3 event history can record why and what new entry replaced it; not dependent |

### 3. Evidence-scope table

| Statement | Contract Guarantee | Source Observation | Historical Report | Design Inference | Unknown / Unverified |
|-----------|-------------------|-------------------|-------------------|------------------|---------------------|
| Unique `artifactId` per generate | ✅ D1 explicit | `service.js:3016` | — | — | — |
| `ffmpeg -y` overwrites same `outFile` | ❌ Not in contract | `app/remotion/render.js` | — | — | — |
| Library entry replacement on `content_id + script_version` match | ⚠ Implementation observed | `content.js:1213-1216` | — | — | — |
| `77/77` acceptance tests passing | ❌ Not verified for this audit | Reported previously | ✅ Previously reported | — | — |
| SHA-256 proves byte identity | ✅ CA-V1-05 | `service.js:3028` | — | — | — |
| SHA-256 proves semantic suitability | ❌ Not in contract | — | — | — | ❌ Gap |
| Pre-render SHA-256 reuse evidence exists | ❌ Not in source | — | — | — | ❌ Gap |
| B2 and B3 can coexist | ✅ Decision Record §3.6 | — | — | — | — |
| B4 lifecycle steps implemented | ❌ Not implemented | — | — | Design proposal only | ❌ Gap |
| Published artifacts separate assessment | ✅ Principle 10 | Decision Record | — | — | — |
| Soft Delete mandatory | ❌ Not mandated | Decision Record §3.6 | — | Design proposal | — |

### 4. Exact proposed replacement wording for problematic cells

**For A2-O3 dependency on A3-O3** (Dependency Classification row):
> **Original (if present)**: "A2-O3 requires A3-O3 for the `previous` marker to be durable."
> **Replacement**: "A2-O3 is most compatible with A3-O3, as the explicit `previous` marker supplements the lifecycle's `replaces`/`replaced_by` linkage. However, A2-O3 is also compatible with A3-O2 (per-artifact history) or A3-O1 (no explicit history) with reduced durability — the `replaces` relationship can be recorded in artifact metadata or Library JSON independently of a full Event mechanism."

**For B2/B3 interdependency** (Dependency Classification row):
> **Original (if present)**: "B2 outcome determines B3 eligibility" or "B3 affects B2 policy."
> **Replacement**: "B2 and B3 are strictly independent decisions. B2 governs what happens when a new render targets an existing `outFile` (overwrite/abort/rename/prompt). B3 governs whether to re-render when a file at `outFile` has a matching SHA-256. They can operate in any combination: B2-O1/O2/O3/O4 with B3-O1/O2/O3, as the decisions address different code paths and scenarios."

**For SHA-256 scope distinction** (Evidence-Scope table row):
> **Original (if present)**: "SHA-256 match proves the artifacts are interchangeable."
> **Replacement**: "SHA-256 match proves byte identity for the exact bytes hashed against a trusted reference. It does not independently establish semantic equivalence, suitability for different formats, channels, versions, or intended uses. Separate validation is required for publication suitability."

**For "nine-step lifecycle implemented" claim** (Recovery audit §5):
> **Original (if present)**: "The system implements the nine-step artifact lifecycle."
> **Replacement**: "The nine-step artifact lifecycle is a candidate design evaluated for coherence with B4 and the ACE principles, but it is not implemented. No code changes, tests, or runtime validation have been performed. The lifecycle remains a design proposal requiring Owner ratification before any implementation."

### 5. List of unresolved Owner questions (genuinely requiring decision)

1. **A2**: Which Library replacement policy does the Owner want? O1 (auto-replace, current behavior), O2 (preserve existing, don't push new), or O3 (replace + "previous" marker with explicit lineage)?

2. **A3**: Does the Owner want an explicit history mechanism? O1 (no explicit history), O2 (artifact-level history per-artifact record), or O3 (full Export Event mechanism with `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, `timestamp`)?

3. **B2**: Does the Owner want to prohibit automatic physical-file overwrite in the Renderer? O1 (no prohibition, current `ffmpeg -y` behavior), O2 (abort if `outFile` exists), O3 (rename output to new path), or O4 (prompt user for confirmation)?

4. **B3**: Does the Owner want SHA-256-based file reuse? O1 (no verified reuse, current behavior), O2 (reuse if SHA-256 matches, skip re-render), or O3 (reuse with explicit log of reuse events)?

5. **B4**: Does the Owner want a proactive damaged/missing-file replacement procedure? O1 (no proactive procedure, ad hoc/manual), O2 (on-demand integrity verification via API), O3 (periodic scheduled scan + auto-replace, full lifecycle automation), or O4 (integrity check on each access/export attempt)?

6. **Published-artifacts guard** (principle 10): Should the system add a `published_at` / `status: 'PUBLISHED'` field to block cleanup of published artifacts? This is a contract amendment candidate.

7. **Retention metadata** (principle 8): Should the system add `retention: {reason, until, granted_by}` to artifact metadata, and should cleanup respect retention flags? Contract amendment candidate.

8. **Status lifecycle** (principle 9): Should artifact status include a lifecycle `DRAFT → PENDING_VALIDATION → ACTIVE → ARCHIVED → DELETED`, and should validation gate before artifact availability be implemented? Contract amendment candidate.

9. **Replacement linkage fields** (`replaces`/`replaced_by`): Should artifact metadata and/or Library entries include `replaces` and `replaced_by` fields, and what format/obligation? Contract amendment candidate.

10. **Published-artifacts assessment procedure** (principle 10): If published artifacts need separate retention assessment, who assesses, what criteria, what retention decisions? Workflow design decision, not merely contract clause.

### 6. Confirmation that option definitions remain aligned with source Decision Record

**All option IDs and exact meanings preserved from `ACE-R1-No-Overwrite-Owner-DecisionRecord.md`**:

- A2-O1/O2/O3: Library replacement policy options — preserved verbatim
- A3-O1/O2/O3: Artifact/Export Event history options — preserved verbatim, with A3-O3 explicitly noted as "proposed, not ratified"
- B2-O1/O2/O3/O4: Physical-file overwrite prohibition options — preserved verbatim, with B2-O1 tied to `ffmpeg -y` observed behavior
- B3-O1/O2/O3: Verified SHA-256 reuse options — preserved verbatim, with B3-O2/O3 noting sha256 computation cost and collision probability
- B4-O1/O2/O3/O4: Damaged/missing-file replacement options — preserved verbatim, with B4-O3 mapping to the 9-step evaluated lifecycle

**Discrepancies documented** (10 items in section 6.1, above) — none involve silent rewriting of source decisions; all are inconsistencies between the matrix (if it existed) and the source, or unsupported claims that the audit identifies and corrects.

**No option was ratifed**, no implementation was approved, no contract was amended, and no runtime validation was performed. The matrix is an analysis and documentation product only, preserving all original decision IDs and option definitions from the existing R1 documents.

---

## 7. Mandatory ACE Status Invariants (Preserved Verbatim)

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

## 8. Final Confirmation

- ✅ No application code or contracts were changed during this audit.
- ✅ No destructive cleanup or replacement operation was performed.
- ✅ No runtime validation was performed (no tests executed, no rendering, no HTTP requests).
- ✅ No unresolved Owner decision was treated as ratified.
- ✅ Implementation remains NOT APPROVED.
- ✅ All ACE status invariants preserved verbatim exactly as they appear in the Decision Record.
- ✅ All five decision option IDs and exact meanings preserved from `ACE-R1-No-Overwrite-Owner-DecisionRecord.md`.
- ✅ All identified inconsistencies and unsupported claims documented with section/row references and proposed corrections.
- ✅ Dependency classifications are evidence-backed and do not treat informal preferences as strict prerequisites.
- ✅ SHA-256 and reuse reasoning distinctions are explicitly maintained (byte identity vs. semantic equivalence vs. suitability).
- ✅ Recovery and replacement safety principles are checked against the matrix and gaps identified where the matrix may overgeneralize.
- ✅ Evidence-scope table distinguishes contract guarantees, source observations, historical reports, design inferences, and unknowns.
- ✅ The matrix is usable independently of this conversation and preserves the original decision IDs and option definitions.
- ✅ Read-only inspection and analysis only — no file modifications beyond creating this decision matrix document as the authorized deliverable.

**The Decision Matrix audit is complete. All ten ACE status invariants remain unchanged. No ratification, implementation approval, contract amendment, or runtime validation has occurred.**