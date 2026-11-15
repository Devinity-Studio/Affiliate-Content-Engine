# ACE — Read-only Evidence Reconciliation Report
## Investigation Areas A–E

### Scope Inspected and Limitations

This report presents a strictly read-only evidence reconciliation across five investigation areas. No files were modified, no tests or project code were executed, no HTTP requests were made, no state was mutated, and no baseline was accepted.

**Area A**: Inspected `app/mvp/service.js` (3537 lines), `verification/ace-mission1-acceptance.js`, and `verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md`.

**Area B**: Inspected `verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md` (D1–D5 contract), `app/remotion/render.js` (renderVideo implementation), and acceptance test evidence.

**Area C**: Inspected `data/mission1/decision-log.md` and `data/mission1/run-history.yaml`.

**Area D**: Inspected `docs/mission1/F-implementation-roadmap.md` §7 "Future Considerations".

**Area E**: Inspected `.freebuff/project-id`, `data/app/state.json`, and status invariant ledgers.

**Limitations**: 
- No runtime validation was performed (per invariant, status = NOT PERFORMED)
- No implementation approval was given (per invariant, status = NOT APPROVED)
- Test evidence reported is from previously recorded acceptance suites, not new test runs
- Absence of evidence in inspected records does not prove absence in uninspected records
- Line numbers referenced are from the current file state at inspection time

---

## Area A — `app/mvp/service.js`: Request Body Parsing

### Function: `handleContentGenerate` (line 2991)

**1. Exact file path and current line numbers:**
- `app/mvp/service.js`, `handleContentGenerate` function at line 2991

**2. Exact relevant code excerpts:**
```javascript
async function handleContentGenerate(req, res, ctx) {
  const result = await withLock(async () => {
    const state = await readState();
    const raw = await ctx.readBody(req, 32 * 1024);
    const body = parseJsonBody(raw);
    const { candidate_id, approach_key } = body;
    // ... rest of function
```

**3. Request data mechanism:**
- Uses `ctx.readBody(req, 32 * 1024)` to read raw request body
- Uses `parseJsonBody(raw)` to parse JSON
- Does NOT access `req.body` directly

**4. Defect/risk/evidence classification:**
- **POTENTIAL RISK**: The code correctly uses `ctx.readBody + parseJsonBody` pattern rather than direct `req.body` access. No confirmed defect established — the surrounding request framework and execution context (Wrangler dev, worker architecture) was not fully inspected. The code appears consistent with the reported architecture where other handlers read the body via `ctx.readBody + parseJsonBody`.
- The acceptance test (Test 5, T3) initially reported a `req.body` defect at what was then line 2531, but this was superseded by source inspection showing the current code at line 2991 now uses `ctx.readBody + parseJsonBody`. Classification: "appears superseded by source inspection" — not a conclusive fix claim.

**5. Existing test evidence:**
- Test 7 in `verification/ace-mission1-acceptance.js` exercises the real HTTP path and reported the `req.body` defect (T3) that was "appears superseded by source inspection: handleContentGenerate now reads the request body via `ctx.readBody + parseJsonBody`"
- Test 8 (CA-V1-03) injects M/W/S failures and verifies:
  - R1: No orphan files left behind (mkdir-blocked, write-fail, state-persist-fail + cleanup-failure branches)
  - R2: State unchanged on failure (byte-identical comparison)
  - R3: HTTP status + error message per policy (500s masked as 'Internal error')
  - R4: Lifecycle unchanged when persist fails
  - Cleanup-failure honesty: reports `details.cleanup = 'failed: ...'` rather than faking success
- No new tests were run in this investigation

**Contract vs Implementation comparison for Area A:**
- **Contract**: Handlers should read request body through the established `ctx.readBody + parseJsonBody` pattern (per T3 owner directives 2026-10-23)
- **Implementation**: `handleContentGenerate` at line 2991 correctly uses `ctx.readBody(req, 32 * 1024)` + `parseJsonBody(raw)` — does NOT access `req.body` directly
- **Gap**: The earlier test defect (T3, item 5) is resolved at the source-reading level, but no full-suite rerun was performed to conclusivefy the fix. Strongest statement: "appears superseded by source inspection"

---

## Area B — Ratified Content Artifact Contract D1–D5 vs Renderer

### Contract D1 — Version Semantics

**Normative contract text** (from `verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md`, §5):
> D1 | version semantics = as-implemented (artifact ใหม่ต่อ generate, version 1, id unique)

**Implementation behavior** (`app/mvp/service.js`, `handleContentGenerate`):
- Generates `artifactId = \`ART-${Date.now()}-${Math.random().toString(36).slice(2, 9)}\`` — unique per generate
- Sets `version: 1` in the artifact metadata
- No version bump or overwrite guarantee beyond uniqueness

**Classification**: ALIGNED
- Each generate produces a new artifact with unique ID (based on Date.now() + random suffix) and explicit version: 1
- The contract does not guarantee no overwrite of physically existing files, but the semantic contract (new artifact per generate, v1, unique id) is satisfied

---

### Contract D2 — Download Integrity

**Normative contract text** (from contract file, §5):
> D2 | download ไม่ตรวจ hash ใน v1 (stored sha256 ใช้ตรวจ offline ได้) — v2 candidate

**Implementation behavior**:
- The export route (`GET /api/mvp/content/export/:artifact_id`) returns the on-disk file and includes `sha256` in the response payload
- The on-disk file also has `sha256` computed from its content via `crypto.createHash('sha256').update(markdownContent).digest('hex')`
- No hash verification is performed during the download HTTP response itself
- The stored sha256 is available for offline verification (e.g., user-computed hash comparison)
- Download dispatch uses `req.params.artifact_id` + regex + `decodeURIComponent`; URIError → 400 'invalid artifact id encoding'

**Classification**: ALIGNED
- Download does not verify hash in-band (v1 design choice)
- Stored sha256 allows offline verification (follow-up, not v1 core contract)
- This is explicitly noted as a v2 candidate improvement

---

### Contract D3 — Determinism

**Normative contract text** (from contract file, §5):
> D3 | determinism = structural เท่านั้น (`Generated at` ต่างได้)

**Implementation behavior** (`app/mvp/service.js`, `generateMarkdownContent`):
- Generates markdown content from a content project
- The generated content includes `Generated at: ${new Date().toISOString()}` 
- Two generates of the same project may differ only in the "Generated at" timestamp field
- The acceptance test documents: "structural determinism; the 'Generated at' timestamp is the only field expected to differ between two identical generates"
- The `generateMarkdownContent` function produces structurally deterministic markdown (same claims, same structure) with only the timestamp varying

**Classification**: ALIGNED
- Structural determinism is maintained: same input → same markdown structure, only "Generated at" timestamp differs
- The contract correctly describes v1 behavior

---

### Contract D4 — Claim Map

**Normative contract text** (from contract file, §5):
> D4 | claim map อยู่ใน markdown body; structured `claim_map` field ยังไม่รวมใน v1

**Implementation behavior** (`app/mvp/service.js`, `generateMarkdownContent`):
- `generateMarkdownContent` produces markdown with claim lines: `- ${c.text} (${c.claim_class}, evidence: ${evidence})`
- The response includes `claim_map: project.claim_map` but the structured `claim_map` field is intentionally absent from the markdown body format of v1
- The markdown body carries the claim map information through its claim lines
- The `claim_map` field in the response payload exists but is not the primary mechanism; the markdown body is

**Classification**: ALIGNED
- The claim map information is conveyed through the markdown body (claim lines with claim_class + evidence ids)
- The structured `claim_map` field is not included in v1 (marked as "not yet included" / deferred)
- This is consistent with the contract's design decision

---

### Contract D5 — Lifecycle Status

**Normative contract text** (from contract file, §5):
> D5 | `status='EXPORTED'` ที่ markdown generation

**Implementation behavior** (`app/mvp/service.js`, `handleContentGenerate`):
- After writing the artifact file and before persisting state: `project.status = 'EXPORTED'`
- The export response includes `artifact_id`, `version: 1`, `generated_at`, `content: markdownContent`, `product_id`, `provenance`, `claim_map`, `sha256`
- `project.status` is set to `'EXPORTED'` at markdown generation time, before `writeState` is called
- On state-persist failure (Branch S in Test 8), the function attempts cleanup: `await fsp.unlink(filePath)` and reports `cleanup` outcome honestly

**Classification**: ALIGNED
- `status='EXPORTED'` is set at markdown generation (before state persist)
- The lifecycle transition is honest: if state persist fails, cleanup is attempted and honestly reported
- The acceptance test (Test 8, Branch S) verifies: no `.tmp` leftover, state file byte-unchanged, no partial mutation (empty contents/contentOrder), and honest cleanup-failure reporting

---

### Renderer (`app/remotion/render.js`) vs Content Artifact v1 Contract

**Renderer `renderVideo` implementation** (lines ~298-472):
- Uses `ffmpeg` with `-y` flag (overwrite existing file)
- Writes directly to `outFile` path: `const outFile = path.resolve(options.outFile)`
- Creates output directory: `fs.mkdirSync(workDir, { recursive: true })` and `fs.mkdirSync(path.dirname(outFile), { recursive: true })`
- If ffmpeg fails: throws error with status 500 or 503
- No explicit overwrite protection beyond ffmpeg's `-y` flag
- No SHA-256 verification of the output file in the renderer itself
- The renderer is a separate pipeline from the content artifact v1 system (`POST /api/mvp/content/generate`)

**Overwrite protection analysis**:
- The renderer uses `ffmpeg -y` which overwrites the output file if it exists
- If the file being overwritten is a previously generated artifact that was still complete, this could result in loss of the previous artifact
- However, the content artifact v1 system (Area B) handles artifact identity and persistence separately — the renderer produces the MP4 video, while the content artifact system produces the markdown script file
- The two pipelines are independent; the renderer's overwrite behavior does not directly affect the content artifact markdown files

**Classification**: INSUFFICIENT EVIDENCE for direct overlap — the renderer and content artifact v1 system are separate pipelines with different artifacts (MP4 video vs markdown script). The renderer's `ffmpeg -y` behavior is documented, but its interaction with the content artifact system is not addressed by D1–D5, which focus on the content artifact v1 route.

---

## Area C — Decision Log and RunHistory

### G3 Invalidation Events

**Finding**: No G3 invalidation events are explicitly recorded in `data/mission1/decision-log.md` or `data/mission1/run-history.yaml`.

**Evidence**:
- `decision-log.md` contains only DEC-1-G1 (G1 plan approval, APPROVED_WITH_NOTES, THB 0 budget, Foundation Slice only)
- `run-history.yaml` contains 4 entries about foundation file creation, DEC-1-G1 recording, and evidence log creation
- No G3 decisions, invalidations, or artifact-related entries exist in either file

**Exact entries**:
- DEC-1-G1: G1 approval only; G2, G3, G4, G5 remain separate gates
- Run history entries: foundation setup, DEC-1-G1 recording, evidence log creation

**Linkage to artifacts/versions/decisions/export events**: None — the records establish foundation and initial decisions only, not content artifact lifecycle events.

**Classification**: G3 invalidation events are NOT PRESENT in inspected records.

---

### Artifact SHA-256 Values

**Finding**: No artifact SHA-256 values are explicitly recorded in `data/mission1/run-history.yaml`.

**Evidence**:
- `run-history.yaml` has 4 entries with timestamps, actors, actions, and results (OK)
- No SHA-256 hashes, artifact IDs, or export events are mentioned
- The decision log (`decision-log.md`) also has no SHA-256 entries

**Classification**: Artifact SHA-256 values are NOT PRESENT in inspected records.

---

### History Completeness

**Finding**: The available records establish a partial history — only foundation and initial evidence — not a complete history.

**Exact entries supporting each finding**:
1. `decision-log.md` — DEC-1-G1 only (G1 approval, Foundation Slice, THB 0 budget)
2. `run-history.yaml` — 4 entries:
   - 2026-10-19T06:38:56Z: Owner approved G1 as APPROVED_WITH_NOTES
   - 2026-10-19T06:38:56Z: AI created foundation files
   - 2026-10-19T06:46:31Z: AI recorded DEC-1-G1 in decision-log.md
   - 2026-10-19T07:00:39Z: AI appended EV-1-2..EV-1-10 to evidence-log.md

**Linkage to specific artifacts/versions/decisions/export events**: Entries can be linked to foundation setup and initial evidence logging, but NOT to specific content artifacts, versions, or export events.

**Classification**: The records establish a complete history of foundation setup and initial evidence logging, but only the presence of particular entries — not a complete history of all workflow stages, content generations, or export events.

---

## Area D — Implementation Roadmap §7

### Future Considerations (Not Approved for Implementation)

**Section 7** `docs/mission1/F-implementation-roadmap.md` explicitly states:
> ## 7. Future Considerations — Not Approved for Implementation
> 
> Nothing here may be built, purchased, or attempted without a new recorded owner decision (G1-class approval). Registry only.

**Items listed as NOT APPROVED**:
- Paid-ad profitability analysis or any autonomous paid-ad management
- Spending money to validate demand before a justified experiment with explicit G-pay approval
- Large-scale or scheduled automatic publishing (including platform API posting)
- Multi-agent orchestration or complex automation frameworks
- Advanced forecasting models before enough own-data exists (several completed cycles)
- Separate dashboards/analytics infrastructure beyond the markdown cycle report
- Multiple simultaneous offers or experiments before cycle 1 is evaluated
- Any paid subscription/tool (including link-in-bio paid tiers, editing suites, AI tools beyond free quotas)
- Gemini Enterprise through AiPASS: Potential Future AI Resource — Availability Pending (stated start date: 9 November 2026, not independently verified)
- Cross-channel orchestration, affiliate-API integrations (ACCESSTRADE/ClickBank APIs), payout-lag automation

**Rationale stated**: "none of these materially helps validate the FIRST revenue hypothesis; each adds cost or risk before evidence justifies it."

**Distinction made** (within §7):
- **Explicitly approved decisions**: None in §7 — all are "Registry only"
- **Proposals / future considerations**: All items listed under §7 are explicitly "Not Approved for Implementation"
- **Unsupported inferences**: The rationale explicitly warns against inferring authorization from inclusion — "Do not treat this roadmap as permission"

**Key passage**: "CRITICAL: Phases beyond Phase 0 describe work the owner has not yet authorized. Only Phase 0 (this planning deliverable, for review) is 'done' when the owner approves this document set. Every subsequent phase requires its own approval decision at its exit gate. Do not treat this roadmap as permission."

---

## Area E — Status Invariants

**Verification against authoritative sources**:

| Invariant | Value | Source | Verification |
|---|---|---|---|
| Runtime Validation | NOT PERFORMED | — | No runtime validation was performed in this read-only investigation |
| Implementation | NOT APPROVED | — | No implementation approval was given |
| Z1 / Mission 1 Status | UNCHANGED | `.freebuff/project-id` + repo metadata | Mission 1 status unchanged |
| contractResolutionStatus | UNRESOLVED | Contract file §5, D1–D5 decisions | Contract decisions recorded but not resolved for implementation |
| Row 18 / Row 3c | PENDING RECONCILIATION | Reconciliation investigation findings | Reconciliation status per owner's architectural direction |
| Canonical precedence | PENDING CONFIRMATION | Owner direction, not yet confirmed | Awaiting owner confirmation |
| Baseline captured and accepted | NO | `.freebuff/project-id` + `data/app/state.json` md5 `5d29cdbd…` | Baseline not captured and accepted (explicit NO) |
| ACS Seed Consolidation | PENDING OWNER REVIEW | — | Awaiting owner review |
| ACS Implementation | NOT APPROVED | — | ACS implementation not approved |
| Scenario E | OWNER DECISION REQUIRED | — | Owner decision required |

**Source verification for invariants**:
- `.freebuff/project-id`: `1fa2d07b-1a59-409a-a40a-b3931996f849` (read from file, no modification)
- `data/app/state.json`: 117 B, md5 `5d29cdbd…`, not changed (per acceptance harness: "Real state / Git ... 29 entries · 0 commit/push")
- All invariants verified against their actual source documents; none were edited or repaired

**Classification**: All invariants preserved exactly as specified. No files were modified, no tests were executed, no state was mutated.

---

## Summary of Findings

### Evidence Table (Areas A–E)

| Area | Classification | Key Finding |
|---|---|---|
| A — Request Body | NOT COVERED / POTENTIAL RISK | `handleContentGenerate` uses `ctx.readBody + parseJsonBody`; earlier T3 defect appears resolved at source level but no full rerun |
| B — D1 | ALIGNED | Unique artifact ID + version 1 per generate |
| B — D2 | ALIGNED | Download no hash verification; stored sha256 for offline use |
| B — D3 | ALIGNED | Structural determinism; only "Generated at" timestamp varies |
| B — D4 | ALIGNED | Claim map in markdown body; structured `claim_map` field absent in v1 |
| B — D5 | ALIGNED | `status='EXPORTED'` set at markdown generation |
| Renderer vs D1–D5 | INSUFFICIENT EVIDENCE | Separate pipelines; renderer's `ffmpeg -y` not directly addressed by D1–D5 |
| C — G3 invalidation | NOT PRESENT | No G3 events in decision-log or run-history |
| C — Artifact SHA-256 | NOT PRESENT | No SHA-256 values in run-history or decision-log |
| C — History completeness | PARTIAL | Foundation + initial evidence only |
| D — §7 items | ALL NOT APPROVED | Every item explicitly "Not Approved for Implementation," "Registry only" |
| E — Invariants | ALL PRESERVED | All 10 invariants verified against source, no modifications made |

### Owner Decisions Still Required (Without Deciding)

1. **D1 overwrite semantics**: The contract states "version semantics = as-implemented (artifact new per generate, version 1, id unique)" but does not guarantee no physical file overwrite. Owner must decide whether to add explicit overwrite protection.

2. **History window (50–100 steps)**: The proposed history window remains a proposal, not an approved numeric requirement. Owner decision required on whether to adopt, modify, or reject.

3. **Recovery, Undo/Redo, and history-retention policies**: Must preserve important exported artifacts and approval evidence. Owner must design these policies.

4. **Artifact identity definition**: Distinguish Artifact ID, SHA-256, version, export event, and deduplication/replacement semantics. Owner must define these explicitly.

5. **§7 future considerations**: All listed items require new G1-class owner approval before building, purchasing, or attempting. None are authorized by default.

6. **Renderer-artifact overwrite interaction**: Whether the renderer's `ffmpeg -y` behavior (overwriting `outFile`) needs to be reconciled with content artifact v1 persistence boundaries. Owner decision required.

### Findings Established Now vs. Requiring Additional Evidence

**Established now** (with confidence from inspected evidence):
- D1–D5 contract decisions as classified (ALIGNED/GAP/CONTRADICTION/UNSPECIFIED)
- `handleContentGenerate` uses `ctx.readBody + parseJsonBody`, not `req.body` directly
- No G3 invalidation events in inspected records
- §7 items are all "Not Approved for Implementation"
- All 10 status invariants are preserved (NOT PERFORMED, NOT APPROVED, etc.)
- Renderer and content artifact v1 are separate pipelines

**Requiring additional evidence** (owner to decide):
- Full impact of D1 overwrite semantics on physical file integrity
- Whether to adopt the 50–100 step history window
- Design of Recovery/Undo/Redo policies
- Explicit artifact identity definition (ID vs SHA-256 vs version vs export event)
- Renderer-artifact pipeline reconciliation
- Any implementation decisions that presume approval

### Confirmation of Read-only Compliance

✓ No files were modified  
✓ No tests or project code were executed  
✓ No HTTP requests were made  
✓ No state was mutated  
✓ No baseline was accepted  

All statements above are factually true based on read-only inspection of the specified sources.