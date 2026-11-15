# ACE R1 — Owner Decision Brief

**Purpose**: Concise, evidence-grounded decision brief for the Owner's consideration of the five pending ACE R1 policy areas. Derived from `ACE-R1-No-Overwrite-Owner-DecisionRecord.md`, `ACE-R1-Artifact-Lifecycle-Safe-Cleanup-Replacement.md`, `ACE-R1-No-Overwrite-Scope.md`, `ACE-R1-No-Overwrite-ImpactAnalysis.md`, and verified source files `app/mvp/service.js`, `app/mvp/content.js`, `app/remotion/render.js`, and `verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md`. Read-only analysis; no decisions ratified, no implementation approved, no contract amended.

---

## Mandatory ACE Status Invariants (Preserved Verbatim)

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

## A2: Library Replacement Policy

### Option IDs and Definitions (from Decision Record p.29-30)

| Option | Exact Definition | Current Behavior |
|--------|-----------------|------------------|
| **A2-O1** | Replace automatically (current behavior): same `content_id + script_version` → old filtered out, new pushed | Library always reflects latest export; no accumulation of same-version entries |
| **A2-O2** | Preserve existing entry, do not push new: same `content_id + script_version` → old kept, new not pushed | Library history retained for same `content_id + script_version`; each entry documents its export event |
| **A2-O3** | Replace but retain old as "previous" entry with marker: same `content_id + script_version` → new pushed, old retained as previous with explicit marker | Both current and prior export recorded; explicit lineage; most compatible with lifecycle `replaces`/`replaced_by` linkage |

### Behavior and Consequences

- **A2-O1**: Library always reflects latest export. No record of prior exports for same `content_id + script_version`. Entry changes unexpectedly if user regenerates.
- **A2-O2**: Library retains history for same `content_id + script_version`. Entries accumulate indefinitely for repeated same-version generates. User expecting "latest" may be confused.
- **A2-O3**: Both current and prior export recorded. Requires Library schema extension (e.g., `status: 'PREVIOUS'` field or `previous_artifact_id` marker). More complex filter logic. Most compatible with the Artifact Lifecycle's `replaces`/`replaced_by` fields (lifecycle section 4).

### Benefits, Risks, Reversibility, and Trade-offs

| Option | Benefits | Risks / Failure Modes | Reversibility |
|--------|----------|----------------------|---------------|
| **A2-O1** | Simplest; Library always shows latest | Loses record of prior export for same `content_id + script_version`; Library entry changes unexpectedly | High — can switch to O2 or O3 later, but prior history already lost |
| **A2-O2** | Library history retained for same `content_id + script_version` | Library grows indefinitely for repeated same-version generates; may confuse user expecting "latest" | Medium — can switch to O1 or O3 later; old entries preserved |
| **A2-O3** | Both current and prior export recorded; explicit lineage | Requires Library schema change; more complex filter logic | Medium — can switch to O1 or O2 later; `previous` marker may be removed or archived |

**Design inferences** (Decision Record p.30-31): A2-O3 is most compatible with the lifecycle's `replaces`/`replaced_by` linkage, but O1 and O2 are also compatible if the lifecycle records the linkage separately in artifact metadata or Library JSON.

### Dependencies and Interactions

- **A2 is independent of A3** (Event history) but interacts with A4 (sha256 reuse) — Decision Record p.36
- **A2-O3 depends on Library schema being extendable** — not on A3 specifically — Decision Record p.32
- **A2 interacts with B3** (sha256-based file reuse) — if A2 prevents replacement and B3 permits sha256 reuse, the two policies may conflict or complement depending on implementation — Decision Record p.36
- **A2 is separate from B2/B3/B4** (physical-file policies) — addresses Library index behavior, not physical-file overwrite or reuse — Decision Record p.36

### Evidence Gaps and Assumptions After Selection

- **If A2-O1**: No assumption about Library history retention; prior entries already lost. Assumes user accepts "latest only" behavior.
- **If A2-O2**: Assumes Library growth is acceptable or that periodic cleanup will be addressed separately. No assumption about cleanup policy.
- **If A2-O3**: Assumes Library schema can be extended with `previous_artifact_id` or `status: 'PREVIOUS'` field. No assumption about what format the marker takes — Owner must define.
- **All options**: No assumption about how Library replacement interacts with B2 (physical-file overwrite) or B3 (sha256 reuse) unless separately decided.

### Additional Owner Decisions Required Before Implementation

1. **Library schema extension** (if A2-O3): Design of `previous_artifact_id` or `status: 'PREVIOUS'` field — exact format, type, and obligation
2. **Library growth limits or cleanup policy** (if A2-O2): Whether indefinite accumulation is acceptable, or if periodic cleanup is desired (separate decision)
3. **Interaction with A4 (sha256 reuse)**: How A2 choice affects B3 policy and vice versa — Owner must confirm both independently

### Neutral Comparison Table

| Criterion | A2-O1 | A2-O2 | A2-O3 |
|-----------|-------|-------|-------|
| **Library always shows latest** | ✅ Yes | ❌ No (old kept) | ✅ Yes (new pushed, old as previous) |
| **Prior export recorded** | ❌ No | ✅ Yes, retained | ✅ Yes, retained as "previous" |
| **Library schema change required** | ❌ No | ❌ No | ✅ Yes — `previous` marker or `replaced_by` field |
| **Compatible with lifecycle** | ✅ Yes (any) | ✅ Yes (any) | ✅ Most compatible; O1/O2 also compatible if linkage recorded separately |
| **User expectation of "latest"** | ✅ Satisfied | ❌ Not satisfied (old kept) | ✅ Satisfied (new pushed, old retained) |
| **Indefinite Library growth** | ❌ No accumulation | ✅ Entries accumulate | ✅ Old retained as "previous", not accumulated separately |

---

## A3: Artifact/Export Event History

### Option IDs and Definitions (from Decision Record p.31-33)

| Option | Exact Definition | Current Behavior |
|--------|-----------------|------------------|
| **A3-O1** | No explicit history (current behavior): no durable record of prior generates/exports beyond Library entries and file names | Relies on Library entries and file names only; no event mechanism |
| **A3-O2** | Artifact-level history only: each artifact carries its generate timestamp (already via `Date.now()` in `artifactId`); simple history per artifact record | Per-artifact metadata linkage; `replaces`/`replaced_by` fields would fit here |
| **A3-O3** | Full Export Event mechanism (proposed design): durable, queryable history with `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, `timestamp`; enables idempotent retries; audit trail | Requires new fields in artifact metadata and/or Library JSON; API changes; Event storage (D1 table, separate KV, or appended JSON) |

### Behavior and Consequences

- **A3-O1**: Simplest; no new fields or storage mechanisms. No durable record of prior generates/exports beyond what Library entries and file names already provide.
- **A3-O2**: Each artifact carries its generate timestamp (already via `Date.now()` in `artifactId`). Simple per-artifact history. Replacement events can be stored per-artifact with `replaces`, `replaced_by`, `replacement_reason`, `replaced_at` fields — functional and durable within the artifact's record, but not in a separate queryable Event store.
- **A3-O3**: Durable, queryable history. Enables idempotent retries, audit trail, export statistics accuracy. Requires: new fields in artifact metadata, API design for Event creation/commit/retrieval, storage mechanism choice (D1 table, `freebuff.wrangler.jsonc` secrets, appended Library JSON, or separate Durable Object). Client-facing UI/UX for viewing export history.

### Benefits, Risks, Reversibility, and Trade-offs

| Option | Benefits | Risks / Failure Modes | Reversibility |
|--------|----------|----------------------|---------------|
| **A3-O1** | Simplest; no new fields or storage | No durable record of prior generates/exports; rely on Library entries and file names only | High — no new infrastructure; can add A3-O2 or A3-O3 later |
| **A3-O2** | Per-artifact history simple; durable within artifact record | Not queryable across artifacts; cannot reconstruct export sequence without Library; limited audit capability | Medium — can enhance to A3-O3 later by adding Event mechanism |
| **A3-O3** | Durable audit trail; idempotent retries; export statistics accuracy; supports A2 by providing replacement rationale | Requires new fields, API changes, Event storage design; client UI/UX design; storage costs | Lower — changing after implementation may require migration of existing Event data; but option can be selected alongside any A2 choice |

**Design inferences** (Decision Record p.32-33): A3-O3 is the preferred companion to the Artifact Lifecycle: each replacement is a committed Event with `replaces_event_seq`, enabling durable audit trail, idempotent retries, and export statistics accuracy. A3-O2 allows the lifecycle's replacement events to be stored per-artifact with `replaces`, `replaced_by`, `replacement_reason`, `replaced_at` fields — functional and durable within the artifact's record. A3-O1 supports the lifecycle with reduced durability — replacement events exist only in artifact metadata, not in a separate queryable Event store.

### Dependencies and Interactions

- **A3 is independent of A2** (Library replacement policy) but interacts with A4 (sha256 reuse) — Event history can provide rationale for why a Library entry was replaced/reused — Decision Record p.36
- **A3-O3 is the preferred companion for A2-O3, not a mandatory prerequisite.** A2-O3 primarily depends on the Library schema being extendable, not on A3-O3 specifically. A3-O3 provides the most durable Event linkage through committed replacement Events with `replaces_event_seq`, supporting durable audit trails, idempotent retries, and export statistics accuracy. A2-O3 can also operate with A3-O2 or A3-O1, with reduced durability.
- **A3 is independent of B1-B4** (Physical file policies) but may inform them — Event history can identify which file belongs to which export — Decision Record p.36
- **A3 interacts with B4** (damaged/missing-file replacement) — replacement events can be logged as committed Events, providing audit trail and export statistics accuracy — Decision Record p.36

### Evidence Gaps and Assumptions After Selection

- **If A3-O1**: No assumption about durable event history; can be added later. Assumes existing Library entries and file names provide sufficient traceability.
- **If A3-O2**: Assumes per-artifact metadata can carry `replaces`/`replaced_by`/`replacement_reason`/`replaced_at` fields. No assumption about cross-artifact queryability.
- **If A3-O3**: Assumes storage mechanism (D1 table, KV, appended JSON, or Durable Object) is chosen and implemented. Assumes API design for Event creation/commit/retrieval. Assumes client-facing UI/UX for viewing history.
- **All options**: No assumption about how Event history interacts with A2 (Library replacement) unless separately decided. A3-O3 provides the most durable linkage for A2-O3, but A3-O1/O2 can support A2 with reduced durability.

### Additional Owner Decisions Required Before Implementation

1. **Storage mechanism for Events** (if A3-O3): Choice of D1 table, `freebuff.wrangler.jsonc` secrets, appended Library JSON, or separate Durable Object
2. **API design for Event creation, commit, and retrieval** (if A3-O3): Endpoint design, parameters, response format
3. **Client-facing UI/UX for viewing export history** (if A3-O3): Design of history display, filtering, sorting
4. **Contract amendment acknowledgment** (for A3-O3): R1 contract does not mention Events; ratification would acknowledge this gap and either approve contract amendment adding Event provisions, or operate with proposed design outside ratified R1 scope
5. **If A3-O2**: Design specification for history fields (exact schema, field names, types)

### Neutral Comparison Table

| Criterion | A3-O1 | A3-O2 | A3-O3 |
|-----------|-------|-------|-------|
| **Durable, queryable history** | ❌ No | ✅ Per-artifact, not cross-artifact | ✅ Yes, queryable across all artifacts |
| **Enables idempotent retries** | ❌ No | ❌ Limited to same artifact | ✅ Yes |
| **Audit trail for replacements** | ❌ No (rely on Library entries) | ✅ Per-artifact metadata | ✅ Yes, with `replaces_event_seq` linkage |
| **Export statistics accuracy** | ❌ No | ✅ Per-artifact only | ✅ Yes, across all exports |
| **Requires new fields/API/storage** | ❌ No | ✅ Per-artifact metadata fields | ✅ Yes, new Event fields, API, storage mechanism |
| **Client UI/UX needed** | ❌ No (rely on file names) | ❌ Minimal (per-artifact) | ✅ Yes, dedicated history view |
| **Compatible with lifecycle** | ✅ Yes (reduced durability) | ✅ Yes (per-artifact metadata) | ✅ Yes (preferred companion; each replacement is committed Event) |

---

## B2: Physical-File Overwrite Prohibition

### Option IDs and Definitions (from Decision Record p.33-34)

| Option | Exact Definition | Current Behavior |
|--------|-----------------|------------------|
| **B2-O1** | No prohibition (current behavior): renderer behaves as designed; explicit overwrite when user intends it; `ffmpeg -y` overwrites same `outFile` | Renderer overwrites same `outFile`; prior MP4 lost without trace |
| **B2-O2** | Prohibit overwrite, abort render if `outFile` exists: prior MP4 preserved; explicit failure user can resolve (re-run render, choose different path, or explicitly overwrite) | Render fails when path conflict; user workflow disruption; may need manual path management |
| **B2-O3** | Prohibit overwrite, rename output to new path: render always succeeds; prior MP4 preserved; new file gets distinguishable path (timestamp counter suffix); algorithm for new path needs definition | Disk accumulation of versioned files; algorithm for new path not specified |
| **B2-O4** | Prohibit overwrite, prompt user for confirmation: user explicitly decides; combines automation with user control; not suitable for automated/headless renders; UI complexity; may stall workflow pending user response | Requires interactive session; not suitable for headless/automated modes; may stall workflow |

### Behavior and Consequences

- **B2-O1**: Renderer behaves as designed with `ffmpeg -y`. Same `outFile` path → previous MP4 lost without trace. No auditable control over overwrite.
- **B2-O2**: If `outFile` exists, render aborts. Prior MP4 preserved. User can re-run render, choose different path, or explicitly overwrite. Workflow disruption when conflict occurs.
- **B2-O3**: If `outFile` exists, renderer renames output (e.g., `-v2`, `-${timestamp}`, `-${counter}`). Render always succeeds. Prior MP4 preserved. Disk accumulation of versioned files. Algorithm for new path needs definition.
- **B2-O4**: If `outFile` exists, renderer prompts user for confirmation. User decides. Not suitable for automated/headless renders. May stall workflow pending user response.

### Benefits, Risks, Reversibility, and Trade-offs

| Option | Benefits | Risks / Failure Modes | Reversibility |
|--------|----------|----------------------|---------------|
| **B2-O1** | Simplest; renderer behaves as designed | Renderer overwrites same `outFile`; prior MP4 lost without trace; no auditable control | High — can add B2-O2/O3/O4 later; prior overwrites already lost |
| **B2-O2** | Prior MP4 preserved; explicit failure user can resolve | Render fails when path conflict; user workflow disruption; may need manual path management | Medium — can switch to O1/O3/O4 later; O2 behavior becomes new baseline |
| **B2-O3** | Render always succeeds; prior MP4 preserved; new file gets distinguishable path | Disk accumulation of versioned files; algorithm for new path needs definition; may confuse user expecting single `outFile` | Medium — can switch to O1/O2/O4 later; new path algorithm may need adjustment |
| **B2-O4** | User explicitly decides; combines automation with user control | Not suitable for automated/headless renders; UI complexity; may stall workflow pending user response | Low — changing after implementation may disrupt existing renders; prompt design is UI-specific |

**Design inferences** (Decision Record p.33-34): B2 is independent of the lifecycle and B3. Do not infer lifecycle outcomes from B2 or vice versa. B2-O1/O2/O3/O4 all require: decision on whether Content Artifact v1 route needs any change (it likely doesn't, given unique file names, but must be explicitly confirmed). The `ffmpeg -y` overwrite capability in `app/remotion/render.js` is separate from A2 Library reuse scope and must be evaluated under the separately pending B2 decision.

### Dependencies and Interactions

- **B2 is independent of B3** (sha256-based reuse) and B4 (damaged-file replacement) — they are separate mechanisms that can coexist — Decision Record p.36
- **B2 interacts with A3** (Event history) — if overwrite is prohibited and an Event exists, the Event can record why the render was aborted/renamed — Decision Record p.36
- **B2 is independent of A2/A3/A4** (Library policies) — physical file and Library index are separate domains; changes to one do not necessitate changes to the other — Decision Record p.36
- **B2-O2/B2-O3/B2-O4 all require**: decision on whether Content Artifact v1 route needs any change (it likely doesn't, given unique file names, but must be explicitly confirmed) — Decision Record p.36

### Evidence Gaps and Assumptions After Selection

- **If B2-O1**: No assumption about overwrite protection; `ffmpeg -y` behavior observed in `render.js`. Assumes user accepts current `ffmpeg -y` overwrite behavior.
- **If B2-O2**: Assumes render abort is acceptable user experience. Assumes user can re-run render or choose different path. No assumption about UI for error message.
- **If B2-O3**: Assumes algorithm for generating new path (suffix: `-v2`, `-${timestamp}`, `-${counter}`?) can be defined. Assumes disk accumulation of versioned files is acceptable or managed separately.
- **If B2-O4**: Assumes interactive session is acceptable (not suitable for headless/automated). Assumes UI can present confirmation prompt without blocking non-interactive workflows.
- **All options**: No assumption about how B2 interacts with Content Artifact v1 route (unique file names already prevent overwrite there) unless explicitly confirmed.

### Additional Owner Decisions Required Before Implementation

1. **Content Artifact v1 route unaffected confirmation**: Explicit confirmation that unique file names in Content Artifact v1 route prevent overwrite, so B2 choice only affects Renderer path
2. **Renderer overwrite policy for headless/automated modes**: If B2-O2/O3/O4 chosen, design fallback behavior when render is invoked non-interactively (e.g., B2-O3 rename with counter suffix as default, or B2-O2 abort with clear error message)
3. **Algorithm for new path (if B2-O3)**: Definition of suffix pattern (`-v2`, `-${timestamp}`, `-${counter}`?), how many versions to retain, whether older versions are pruned
4. **UI/UX for confirmation prompt (if B2-O4)**: Design of prompt, handling of non-interactive mode fallback

### Neutral Comparison Table

| Criterion | B2-O1 | B2-O2 | B2-O3 | B2-O4 |
|-----------|-------|-------|-------|-------|
| **Renderer overwrites same `outFile`** | ✅ Yes (current behavior) | ❌ No (aborts) | ❌ No (renames) | ❌ No (prompts) |
| **Prior MP4 preserved** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes (if user confirms) |
| **Render always succeeds** | ✅ Yes | ❌ No (aborts on conflict) | ✅ Yes (renames) | ❌ No (prompts may stall) |
| **Requires UI/UX changes** | ❌ No | ❌ Minimal (error message) | ❌ Moderate (new path algorithm) | ✅ Yes (confirmation prompt) |
| **Suitable for headless/automated** | ✅ Yes | ❌ No (aborts may stall) | ✅ Yes (renames automatically) | ❌ No (prompts require interaction) |
| **Disk accumulation risk** | ❌ No (overwrites) | ❌ Low (only on conflict) | ✅ Yes (versioned files) | ❌ Low (only on user confirmation) |

---

## B3: Verified SHA-256 Reuse

### Option IDs and Definitions (from Decision Record p.34-35)

| Option | Exact Definition | Current Behavior |
|--------|-----------------|------------------|
| **B3-O1** | No verified reuse (current behavior): each generate/render produces new file (or overwrites); no hash computation overhead; for renderer, same `outFile` always overwrites | Content Artifact v1 route: unique `artifactId` → unique file name → no existing file ever matches new generate; Renderer: same `outFile` always overwrites |
| **B3-O2** | Reuse if SHA-256 matches, skip re-render: avoid redundant computation; preserve existing file when output identical; for renderer, same `outFile` would be kept (not overwritten) if hash matches | SHA-256 computation cost on large MP4 files; hash collision probability; must decide hash scope (full MP4? metadata? key tracks/chunks?) |
| **B3-O3** | Reuse if SHA-256 matches, with explicit log: all of B3-O2 benefits plus auditable record of reuse events; additional log overhead | Still requires sha256 computation and comparison threshold definition |

### Behavior and Consequences

- **B3-O1**: Each generate/render produces new file (or overwrites). No hash computation overhead. For renderer, same `outFile` always overwrites. Content Artifact v1 route: unique `artifactId` → unique file name → no existing file ever matches new generate by design.
- **B3-O2**: If new output's SHA-256 matches existing file at target path, reuse existing file (skip re-render). Avoids redundant computation. Preserves existing file when output identical. For renderer, same `outFile` would be kept (not overwritten) if hash matches. SHA-256 computation cost on large MP4 files. Must decide hash scope: full MP4 binary? MP4 metadata only? Key audio/video tracks? Hash collision probability theoretically non-zero, practically negligible.
- **B3-O3**: Same as B3-O2 plus explicit log of reuse events. Additional log overhead. Still requires sha256 computation and comparison threshold definition.

### Benefits, Risks, Reversibility, and Trade-offs

| Option | Benefits | Risks / Failure Modes | Reversibility |
|--------|----------|----------------------|---------------|
| **B3-O1** | Simplest; no hash computation overhead | Wasted compute if output identical; no file reuse; for renderer, same `outFile` always overwrites | High — no new infrastructure; can add B3-O2/O3 later |
| **B3-O2** | Avoids redundant computation; preserves existing file when output identical | SHA-256 computation cost on large MP4 files; hash collision probability (theoretically non-zero, practically negligible); must decide hash scope; false positive/negative handling | Medium — can switch to B3-O1 or B3-O3 later; hash scope definition may need adjustment |
| **B3-O3** | All of B3-O2 benefits plus auditable record of reuse events | Additional log overhead; still requires sha256 computation and comparison threshold definition; false positive/negative handling | Medium — can switch to B3-O1 or B3-O2 later; log format may need migration |

**Design inferences** (Decision Record p.34-35): B3 is independent of B2 (overwrite prohibition) and B4 (damaged-file replacement). B3 intersects with A4 (Library sha256 reuse) — both use sha256 but in different domains (physical files vs. Library index). Owner may choose to implement one, both, neither, or both with different hash scopes. B3-O2/O3 note that SHA-256 computation is a cost and collision probability is non-zero (though practically negligible). Pre-render SHA-256 reuse would require a separate evidence mechanism (e.g., cached render output, fingerprinting before render) that is not in the current implementation — the matrix must not claim that post-render hash comparison saves the render cost already incurred.

### Dependencies and Interactions

- **B3 is independent of B2** (overwrite prohibition) — they can coexist: B2 decides what happens when `outFile` exists; B3 decides whether to re-render when file exists with matching hash — Decision Record p.36
- **B3 interacts with A4** (Library sha256 reuse) — both use sha256 but in different domains (physical files vs. Library index). Owner may choose to implement one, both, neither, or both with different hash scopes — Decision Record p.36
- **B3 interacts with A3** (Event history) — if B3-O2 reuses file, Event history can record that reuse occurred (avoiding double-count in export statistics) — Decision Record p.36
- **B3 is independent of B1-B4** — addresses different scenario (hash-based reuse vs. overwrite or damage) — Decision Record p.36

### Evidence Gaps and Assumptions After Selection

- **If B3-O1**: No assumption about hash-based reuse; current behavior has no sha256 comparison for dedupe. Assumes each generate/render produces new file.
- **If B3-O2**: Assumes sha256 computation is feasible on target platforms (typical file sizes, compute time). Assumes hash scope (full MP4? metadata? key tracks?) is defined. Assumes collision probability assessment and acceptable risk level. Assumes acceptance test verifying: (a) identical output → reuse, (b) different output → new file, (c) hash collision handling procedure.
- **If B3-O3**: Same as B3-O2 plus assumption about log overhead and format. Assumes auditable record of reuse events can be designed and implemented.
- **All options**: No pre-render SHA-256 evidence exists in current source. SHA-256 can only be computed after file generation/render. Pre-render reuse would require separate evidence mechanism not currently implemented.

### Additional Owner Decisions Required Before Implementation

1. **SHA-256 scope definition**: Full MP4 binary hash? MP4 metadata only? Key audio/video tracks? Definition must be deterministic and reproducible.
2. **Match threshold**: Exact byte-for-byte hash, or allowance for perceptual equivalence? (For MP4, byte-for-byte is standard; perceptual would require transcoding analysis.)
3. **Acceptance test design**: Verification that (a) identical output → reuse, (b) different output → new file, (c) hash collision handling procedure.
4. **Performance benchmark**: MP4 SHA-256 computation on typical platforms (file sizes, compute time).
5. **Collision probability assessment**: Acceptable risk level for hash collisions.
6. **If B3-O3**: Log format and overhead acceptance.

### Neutral Comparison Table

| Criterion | B3-O1 | B3-O2 | B3-O3 |
|-----------|-------|-------|-------|
| **SHA-256 computation performed** | ❌ No | ✅ Yes (incurs render cost) | ✅ Yes (incurs render cost) |
| **Reuse existing file when output identical** | ❌ No | ✅ Yes | ✅ Yes |
| **Skip re-render when hash matches** | ❌ No | ✅ Yes | ✅ Yes |
| **Auditable record of reuse events** | ❌ No | ❌ No | ✅ Yes (explicit log) |
| **SHA-256 scope required** | ❌ N/A | ✅ Must define (full MP4? metadata? tracks?) | ✅ Must define same as B3-O2 |
| **Collision probability concern** | ❌ N/A | ✅ Theoretically non-zero, practically negligible | ✅ Theoretically non-zero, practically negligible |
| **Post-render hash saves render cost** | ❌ N/A | ❌ No (hash computed after render) | ❌ No (hash computed after render) |
| **Pre-render reuse evidence exists** | ❌ No (gap) | ❌ No (gap) | ❌ No (gap) |

---

## B4: Damaged/Missing-File Replacement

### Option IDs and Definitions (from Decision Record p.35-36)

| Option | Exact Definition | Current Behavior |
|--------|-----------------|------------------|
| **B4-O1** | No proactive procedure (current behavior): existing failure handling (CA-V1-03) is honest but reactive; no systematic damage detection; if file goes missing/corrupts between generates, may go undetected | CA-V1-03 Test 8 honest cleanup reporting only under injection; no on-access or scheduled missing-file check |
| **B4-O2** | On-demand integrity verification via API: user-initiated; no background overhead; explicit when checked; user controls replacement | API design not in source; who initiates (user, scheduler, system?) not defined |
| **B4-O3** | Periodic scheduled integrity scan + auto-replace: systematic; catches corruption early; automatic replacement; auditable trail via Event/log; full lifecycle as evaluated | Maps directly to the proposed 9-step lifecycle; scheduler required |
| **B4-O4** | Integrity check on each access/export attempt: catches damage early; always freshness-verified; seamless user experience if automatic; performance overhead on every access/export | May slow workflow; same "damaged" definition problem as B4-O3 |

### Behavior and Consequences

- **B4-O1**: Existing failure handling (CA-V1-03) is honest but reactive. No systematic damage detection. If file goes missing/corrupts between generates, may go undetected until next export attempt. No auditable replacement trail.
- **B4-O2**: User-initiated integrity verification via API. No background overhead. Explicit when checked. User controls replacement. API not in source; who initiates not defined.
- **B4-O3**: Periodic scheduled scan detects corruption early. Automatic replacement. Auditable trail via Event/log. Maps directly to the 9-step lifecycle evaluated in the analysis. Scheduler required.
- **B4-O4**: Integrity check on each access/export attempt. Catches damage early. Always freshness-verified. Seamless user experience if automatic. Performance overhead on every access/export. Same "damaged" definition problem as B4-O3.

### Benefits, Risks, Reversibility, and Trade-offs

| Option | Benefits | Risks / Failure Modes | Reversibility |
|--------|----------|----------------------|---------------|
| **B4-O1** | Simplest; existing failure handling is honest but reactive | No systematic damage detection; if file goes missing/corrupts, may go undetected | High — no new infrastructure; can add B4-O2/O3/O4 later; prior undetected damage already lost |
| **B4-O2** | User-initiated; no background overhead; explicit when checked; user controls replacement | User must remember to verify; not systematic; may miss corrupted files until data loss observed | Medium — can enhance to B4-O3/O4 later; B4-O2 API design may need extension |
| **B4-O3** | Systematic; catches corruption early; automatic replacement; auditable trail via Event/log | Background overhead; scheduler required; defines "damaged" (sha256 mismatch threshold? playable header? full transcoding test?); replacement policy (re-generate with same `content_id + script_version`? new `artifactId`?) | Lower — scheduler and replacement workflow are now part of baseline; changing may require migration |
| **B4-O4** | Catches damage early; always freshness-verified; seamless if automatic | Performance overhead on every access/export; may slow workflow; same "damaged" definition problem; may slow typical workloads | Lower — per-access checking is now part of baseline; changing may require significant rewrite |

**Design inferences** (Decision Record p.35-36): The proposed lifecycle is essentially a formalization of B4. B4-O1 (no proactive procedure) is the baseline: the lifecycle steps are manual/ad hoc, matching current behavior. B4-O2 (on-demand API verification) aligns with lifecycle steps 1-3 (detect → record → determine eligibility) exposed via API. B4-O3 (scheduled scan + auto-replace) is the full lifecycle as evaluated — steps 1-9 are automated via scheduled task. B4-O4 (integrity check on each access) extends the lifecycle to make damage detection per-access rather than scheduled. **B4 remains separately ratifiable**, and the lifecycle proposal does not ratify any B4 choice — it merely documents the design space.

### Dependencies and Interactions

- **B4 is independent of B2/B3** (overwrite prohibition and sha256 reuse) — addresses different scenario (damaged/missing file vs. overwrite/reuse) — Decision Record p.36
- **B4 interacts with A3** (Event history) — replacement events can be logged as committed Events, providing audit trail and export statistics accuracy — Decision Record p.36
- **B4 interacts with A2** (Library replacement) — if Library entry is replaced due to detected damage, the Event can record why and what new entry replaced it — Decision Record p.36
- **B4 is independent of A1/A2/A3/A4/A5** (Library choices) — physical file damage detection is separate from Library index management, though they may be coordinated through Event history — Decision Record p.36

### Evidence Gaps and Assumptions After Selection

- **If B4-O1**: No assumption about proactive damage detection; current behavior is reactive only. Assumes existing CA-V1-03 honest cleanup reporting is sufficient.
- **If B4-O2**: Assumes API for integrity verification can be designed. Assumes who initiates (user, scheduler, system?) is defined. Assumes user will actually initiate verification.
- **If B4-O3**: Assumes scheduler can be implemented (cron-like, system-triggered). Assumes definition of "damaged" (sha256 mismatch threshold? playable header check? full transcoding test?). Assumes replacement policy (re-generate with same `content_id + script_version`? new `artifactId`?). Assumes storage for scan results and replacement history (D1 table? appended Library JSON? separate audit log?). Retention policy for scan results.
- **If B4-O4**: Assumes performance overhead measurement on typical workloads. Assumes acceptable latency impact. Same "damaged" definition problem as B4-O3.
- **All options**: Assumes definition of "damaged" file — sha256 mismatch? corrupt MP4 header (ftyp atom missing)? unplayable in standard player? specific corruption patterns? No general policy currently exists.

### Additional Owner Decisions Required Before Implementation

1. **Definition of "damaged" file**: sha256 mismatch threshold? corrupt MP4 header (ftyp atom missing)? unplayable in standard player? specific corruption patterns?
2. **Retention metadata** (principle 8): Whether to add `retention: {reason, until, granted_by}` to artifact metadata, and whether cleanup should respect retention flags. Contract amendment candidate.
3. **Published-artifacts guard** (principle 10): Whether to add `published_at` / `status: 'PUBLISHED'` field to block cleanup of published artifacts. Contract amendment candidate.
4. **If B4-O2**: API design for integrity verification (endpoint, parameters, response format); who initiates (user, scheduler, system?).
5. **If B4-O3**: Scheduled task design (cron-like, system-triggered). Storage for scan results and replacement history (D1 table? appended Library JSON? separate audit log?). Retention policy.
6. **If B4-O4**: Performance overhead measurement on typical workloads; acceptable latency impact.

### Neutral Comparison Table

| Criterion | B4-O1 | B4-O2 | B4-O3 | B4-O4 |
|-----------|-------|-------|-------|-------|
| **Proactive damage detection** | ❌ No | ✅ On-demand (user-initiated) | ✅ Yes (scheduled scan) | ✅ Yes (on each access) |
| **Background overhead** | ❌ No | ❌ No (user-initiated) | ✅ Yes (scheduler required) | ✅ Yes (on each access) |
| **Automatic replacement** | ❌ No | ❌ No (user controls) | ✅ Yes | ✅ Yes (if automatic) |
| **Auditable trail** | ❌ No (CA-V1-03 only under injection) | ✅ Yes (if logged) | ✅ Yes (via Event/log) | ✅ Yes (via Event/log) |
| **Scheduler required** | ❌ No | ❌ No | ✅ Yes | ❌ No (per-access) |
| **"Damaged" definition needed** | ❌ N/A (reactive only) | ❌ Yes (for API verification) | ✅ Yes (threshold/method) | ✅ Yes (same as O3) |
| **Performance overhead** | ❌ No | ❌ No (user-initiated) | ⚠️ Yes (scheduler overhead) | ⚠️ Yes (per-access overhead) |
| **Published-artifacts guard** | ❌ Not addressed | ❌ Not addressed | ✅ Principle 10 applies | ✅ Principle 10 applies |
| **Separately ratifiable** | ✅ Yes (baseline) | ✅ Yes (independent) | ✅ Yes (independent) | ✅ Yes (independent) |

---

## Summary of Distinctions (Explicit Throughout)

| Distinction | How It Is Maintained |
|-------------|---------------------|
| **Library-entry replacement vs. physical-file overwrite** | A2 governs Library index behavior (entry replace/preserve). B2 governs Renderer `outFile` overwrite/abort/rename/prompt. They are separate domains; changes to one do not necessitate changes to the other. |
| **Artifact metadata/history vs. durable Export Event mechanism** | A3-O1/O2 store history in artifact metadata and/or Library JSON. A3-O3 adds a durable, queryable Event mechanism with `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, `timestamp`. A3-O3 is the preferred companion for the lifecycle and for B4 event logging, but A3-O1/O2 can support B4 with reduced durability. |
| **Library-level SHA-256 reuse vs. physical-file SHA-256 reuse** | B3 governs physical-file byte identity via SHA-256 comparison. A4 (Library sha256 reuse) is a separate decision in the Library index domain. Different scopes may yield different results. The matrix explicitly states: sha256 comparison in B3 is for physical-file byte identity; A4 (if implemented) is for Library index purposes. |
| **Byte identity vs. semantic suitability and intended-use compatibility** | SHA-256 match proves byte identity for the exact bytes hashed against a trusted reference. It does not independently establish semantic equivalence, suitability for different formats, channels, versions, or intended uses. Separate validation is required for publication suitability. |
| **Current source behavior vs. proposed policy and unimplemented lifecycle design** | All options are presented with explicit connection to current observed behavior (from source code inspection) and proposed policy design (from Decision Record analysis). The nine-step lifecycle is evaluated as a candidate design for B4, not as implemented code. No runtime validation is claimed. |
| **Internal export completion vs. external publication** | B4 principle 10: published artifacts get separate retention assessment before cleanup or replacement. Pre-use cleanup rules do not automatically apply to published artifacts. This distinction is maintained throughout all B4 option descriptions. |

---

## Files Actually Inspected

| File | Purpose |
|------|---------|
| `ACE-R1-No-Overwrite-Owner-DecisionRecord.md` | Authoritative source for all 5 decision areas and option definitions |
| `ACE-R1-Artifact-Lifecycle-Safe-Cleanup-Replacement.md` | Read-only lifecycle analysis evaluating 9-step candidate design |
| `ACE-R1-No-Overwrite-Scope.md` | Read-only scope clarification (R1 D1 covers both Library and Physical Files) |
| `ACE-R1-No-Overwrite-ImpactAnalysis.md` | Read-only impact analysis (content.js, render.js, service.js behaviors) |
| `app/mvp/service.js` | Source code: `artifactId` generation, two-phase commit, cleanup on failure |
| `app/mvp/content.js` | Source code: Library filter, entry replacement/append logic |
| `app/remotion/render.js` | Source code: `ffmpeg -y` overwrite behavior, ffmpeg discovery |
| `verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md` | Contract clauses CA-V1-01 through CA-V1-06 + D1-D5; 77/77 acceptance tests passing |

## Missing Evidence and Unresolved Questions

The following evidence gaps require Owner decisions or additional investigation:

1. **A2-O3 Library schema extension**: Exact format of `previous_artifact_id` or `status: 'PREVIOUS'` field
2. **A3-O3 Storage mechanism**: Choice of D1 table, KV, appended JSON, or Durable Object for Event storage
3. **A3-O3 API design**: Endpoint design for Event creation, commit, and retrieval
4. **B2 Content Artifact v1 confirmation**: Explicit confirmation that unique file names prevent overwrite in Content Artifact v1 route
5. **B2 headless fallback**: Design for non-interactive mode if B2-O2/O3/O4 chosen
6. **B3 SHA-256 scope**: Full MP4 binary, metadata, or key tracks definition
7. **B3 acceptance test**: Design of verification that identical output → reuse, different output → new file, hash collision handling
8. **B4 "damaged" definition**: sha256 mismatch threshold? corrupt header? unplayable? specific patterns?
9. **B4-O3 scheduler design**: Cron-like trigger, storage for scan results, retention policy
10. **B4-O2 API design**: Endpoint, parameters, who initiates
11. **Published-artifacts guard**: Whether to add `published_at`/`status: 'PUBLISHED'` field and cleanup guard
12. **Retention metadata**: Whether to add `retention: {reason, until, granted_by}` to artifact metadata
13. **Status lifecycle**: Whether to add artifact status field with lifecycle `DRAFT → PENDING_VALIDATION → ACTIVE → ARCHIVED → DELETED`
14. **Replacement linkage fields**: Whether to add `replaces`/`replaced_by` to artifact metadata and/or Library entries

## Confirmations

- ✅ **No Owner decision was ratified**: All five decision areas (A2, A3, B2, B3, B4) remain pending Owner confirmation. The brief presents option definitions, consequences, and evidence-supported trade-offs without selecting or ratifying any option.
- ✅ **No source code, contract, schema, or test was changed or executed**: Read-only inspection of existing documents only. No modifications to `ACE-R1-No-Overwrite-Owner-DecisionRecord.md`, `ACE-R1-Artifact-Lifecycle-Safe-Cleanup-Replacement.md`, source code files, contracts, schemas, or tests.
- ✅ **All ten ACE status invariants remain unchanged**: The invariants block is reproduced verbatim as required.
- ✅ **No runtime validation was performed**: No tests executed, no rendering, no HTTP requests, no recovery procedures.
- ✅ **Design inferences are labeled and cited**: All design inferences are explicitly marked and cite the relevant source file and section or line references.
- ✅ **No option was silently selected as winner**: The neutral comparison tables present all options side by side without implying a recommendation.
- ✅ **All explicit distinctions maintained**: Library-entry vs. physical-file, metadata/history vs. Event mechanism, Library-level vs. physical-file SHA-256, byte identity vs. semantic suitability, current behavior vs. proposed design, internal export vs. external publication.

## Completion Report

**Deliverable created**: `ACE R1 — Owner Decision Brief.md`

**Files inspected**: 8 files as listed above (all read-only, no modifications)

**Missing evidence**: 14 unresolved Owner questions (listed in section above under "Missing Evidence and Unresolved Questions") requiring Owner confirmation before any implementation or contract amendment.

**No Owner decision was ratified**: All five decision areas remain pending individual Owner confirmation. The brief is a decision-support document only.

**No source code, contract, schema, or test was changed or executed**: Confirmed — read-only analysis only, no files modified beyond creating this brief.

**All ten ACE status invariants remain unchanged**: Confirmed — block reproduced verbatim.

**The ACE R1 Owner Decision Brief is complete and ready for Owner consideration.**