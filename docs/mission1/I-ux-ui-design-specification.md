# I. UX/UI Design Specification — Affiliate Content Engine (Slice 1)

**Status:** DRAFT FOR OWNER REVIEW · Version 1.1 · 2026-10-19

## 1. Design Overview

This specification describes the user interface and experience for the 10-step Affiliate Content Engine workflow. It is built on top of the functional workflow defined in Doc B and the data model in Doc D. The UI is documentation-only; no application code or production UI is implemented.

The design goals are:
- **Persistent context:** The left sidebar always lists all 10 workflow steps with current step indicator and status.
- **Workspace adaptivity:** The right workspace changes its tools and presentation according to the active step.
- **Control semantics:** Prev · Edit · Next controls are always present with consistent meaning.
- **State preservation:** Workflow state is saved so the user can pause and resume.
- **Dependency-aware invalidation:** When an upstream step changes, only downstream outputs whose dependencies changed are invalidated; stale output is never silently reused.
- **Gate semantics:** Next advances within the workflow; it does not authorize external or financial actions.

## 2. Layout Structure

### 2.1 Persistent Left Sidebar

| Element | Description |
|---|---|
| **Step list** | Vertical list of the 10 steps, one per Doc B stage (S1 Research → S2 Work Plan → S3 Experiment Plan → S4 Storyboard & Script → S5 Production → S6 Review & Approve → S7 Publish & Confirm → S8 Monitor → S9 Analyze & Report → S10 Carry Forward) |
| **Current step indicator** | Highlighted step showing which step is active; shows step number and name |
| **Step status** | Each step shows status: `NOT_STARTED`, `IN_PROGRESS`, `DRAFT_DONE`, `AWAITING_GX`, `COMPLETED`, `HALTED_QUOTA`, `HALTED_FAILURE` |
| **Progress bar** | Optional: shows fraction of completed steps (e.g., 3/10) |
| **Step tooltip** | On hover/focus, shows the step's purpose and current gate status |

### 2.2 Right Workspace

The right workspace dynamically changes its tools and presentation based on the active step number. The overall layout remains consistent, but the controls, inputs, and output area are step-specific.

| Step | Workspace Presentation |
|---|---|
| **S1 — Research** | Market research panel, evidence log browser, candidate niche cards, source verification UI |
| **S2 — Work Plan** | HYPOTHESIS editor, arithmetic table, confidence selector, risks list, G1 decision panel, budget guardrail |
| **S3 — Experiment Plan** | Experiment form (offer, channel, link form, criteria, duration, schedule), content-blueprint fields, G2 decision panel |
| **S4 — Storyboard & Script** | Script editor with claim map, evidence ID selector, disclosure planner, CTA and planned-caption panel |
| **S5 — Production** | One workspace with four tabs: video, text, audio, finalize; preview/timeline, tool palette (free tools only), production metadata |
| **S6 — Review & Approve** | Asset preview beside the six-item G3 checklist, claim map, disclosure and link-form confirmation, CTA/caption comparison, G3 decision panel |
| **S7 — Publish & Confirm** | Channel selector, caption/hashtags editor, link form selector (profile_bio/native_tag), disclosure toggles, publish kit preview, caption-comparison outcome, screenshot uploader, G4 decision panel |
| **S8 — Monitor** | Observation scheduler, dashboard capture viewer, result comparison grid, M1/M2 tracker with mapping notes |
| **S9 — Analyze & Report** | Cycle report editor, criterion verdict editor, unknowns list, trend status selector, G5 decision panel |
| **S10 — Carry Forward** | Learnings browser, carry-forward selection, next-cycle seed form |

### 2.3 Persistent Controls (always visible)

| Control | Semantics | Enabled when |
|---|---|---|
| **Prev** | Reviews the prior step; loads the prior step's output into the workspace for review/editing. **Does not** advance the workflow or produce any output. | Always enabled except when current step is S1 (first step) |
| **Edit** | Changes the current step's output. In the workflow state, this transitions the step to `DRAFT_DONE` (if not already) and allows the user to modify the step's deliverables. Revisions create a new version with `version_of` linkage (old version SUPERSEDED). | Always enabled; step must be in a state that supports editing (typically `DRAFT_DONE` or `IN_PROGRESS`) |
| **Next** | Accepts/passes the current step's output to the next step. This is a **workflow advancement** action, not a blanket authorization for external or financial actions. Gating gates (G2–G5, G-pay) remain in effect. | Enabled when current step's output is valid and its gate (if any) is approved. Moves workflow to the next step. |

### 2.4 State Preservation & Pause/Resume

- The **workflow state file** (`workflow-state.yaml`) stores: `current_cycle`, `current_stage` (S1–S10), `stage_status`, `pending_action`, `last_updated`.
- When the user clicks **Prev** or **Next**, the workflow state is updated accordingly.
- When the user pauses (e.g., closes the app or switches steps), the current state is persisted.
- On resume, the workflow restores from the last saved state: the sidebar highlights the last active step, the workspace presents that step's tools, and the controls reflect the saved state.
- If an **upstream step changes** (user clicks Prev to revisit a prior step), the workflow flags the downstream outputs whose recorded dependencies are affected and disables **Next** for those steps until they are re-run (see §2.5). The flag is not persisted as a new workflow-state field.

### 2.5 Dependency-Aware Re-execution

When an upstream step is revised:

1. The workflow identifies the downstream outputs whose **recorded dependencies** are affected and disables **Next** for those steps until they are re-run.
2. This assessment is made and recorded by the operator in **RunHistory** (Doc D §3.11). There is no automatic dependency detection: the UI prompts and the operator confirms.
3. Doc B Stage 7 defines the affected scope for content-stage changes (script, CTA/caption, media, claims). Example: revising S4 (Storyboard & Script) affects S5–S9, because production, review, publication, monitoring, and reporting all reference the script.
4. `STALE` applies only to a G3 approval that no longer covers changed content (Doc D §3.8). It is not a general step status; all other statuses come from the Doc D §3.10 enum.
5. The RunHistory entry names the upstream step and the artifacts re-run. No workflow-state fields beyond Doc D §3.10 are introduced.

### 2.6 Step-Specific UI Behaviors

#### S1 — Research (Doc B Stage 1)
- **Workspace:** Evidence log browser + candidate niche cards + source verification
- **Prev:** Disabled (S1 is the first step)
- **Edit:** Opens evidence log for review; allows adding/removing candidate briefs
- **Next:** Advances to S2 if ≥3 candidates documented with sources and 1 selected with reasons (Doc B Stage 1 acceptance); otherwise shows an error summarizing missing items

#### S2 — Work Plan (Doc B Stage 2, Gate G1)
- **Workspace:** HYPOTHESIS editor, arithmetic table, confidence selector, risks list, G1 decision panel, budget guardrail (default THB 0)
- **Prev:** Loads S1 candidate brief for review
- **Edit:** Allows modifying hypothesis, assumptions, confidence, budget; budget > 0 triggers the G-pay check
- **Next:** Advances to S3 only when a **G1 APPROVED** decision exists; otherwise shows "G1 plan approval required"

#### S3 — Experiment Plan (Doc B Stage 3, Gate G2)
- **Workspace:** Experiment form (offer, program, channel, link form, success criteria, duration, observation schedule), content-blueprint fields, G2 decision panel
- **Prev:** Loads the S2 analysis brief
- **Edit:** Allows changing the offer, criteria, blueprint, channel, link form, budget; blueprint required fields are validated (Doc E AC-15); budget > 0 requires G-pay
- **Next:** Advances to S4 only when a **G2 APPROVED** decision exists; otherwise shows "G2 decision required"

#### S4 — Storyboard & Script (Doc B Stage 4)
- **Workspace:** Script editor with claim map, evidence ID selector, disclosure planner, CTA and planned-caption panel
- **Prev:** Loads the S3 experiment record and blueprint
- **Edit:** Allows adding/removing claims, mapping claims to evidence IDs, editing the disclosure plan, CTA, and planned caption; claims without evidence are marked `kind: opinion` or removed
- **Next:** Advances to S5 when zero factual claims are unmapped (`evidence_id: null` with `kind: fact`) and the disclosure plan is present; otherwise lists the unmapped claims. No gate here: G3 follows production.

#### S5 — Production (Doc B Stage 5)
- **Workspace:** One workspace with four tabs — video, text, audio, finalize; preview/timeline, AI draft toggle, tool palette (free tools only), production metadata editor
- **Prev:** Loads the S4 script and storyboard
- **Edit:** Allows replacing AI drafts with manual edits, inserting text/subtitles, selecting audio, exporting, and updating the tool list and AI-use notes; free-quota exhaustion pauses with `HALTED_QUOTA` (Doc D §3.10) and an owner report
- **Next:** Advances to S6 when the asset file exists and metadata records tools, AI use, quota state, and disclosures; `CostBudget.spent_thb_actual == 0` unless a G-pay record exists (Doc E AC-04)

#### S6 — Review & Approve (Doc B Stage 6, Gate G3)
- **Workspace:** Asset preview beside the six-item G3 checklist, claim map, disclosure and link-form confirmation, CTA/caption comparison, G3 decision panel
- **Prev:** Loads the S5 asset and final script
- **Edit:** Records rejection reasons only; content edits route back to S4 as a new version
- **Next:** Advances to S7 only when a **G3 APPROVED** decision exists; otherwise shows "G3 approval required". A post-G3 CTA/caption change makes the approval `STALE` until a new G3 decision is recorded (Doc D §3.8).

#### S7 — Publish & Confirm (Doc B Stage 7, Gate G4)
- **Workspace:** Channel selector, caption/hashtags editor, link form selector (profile_bio/native_tag/deep_link/OTHER), disclosure toggles, publish kit preview, caption-comparison outcome, screenshot uploader, G4 decision panel
- **Prev:** Loads the S6 approval and reviewed text
- **Edit:** Allows changing channel, caption, hashtags, link form, disclosure settings; link form must be one the channel policy was verified to allow at publish time (Doc C §6); any change to the reviewed text requires a new G3 decision
- **Next:** Advances to S8 when the **G4** decision is recorded and the publication record is complete with live_url, posted_at, link_form_used, disclosure_settings_applied, `caption_used` (or `UNKNOWN`), the comparison outcome, and ≥1 screenshot

#### S8 — Monitor (Doc B Stage 8)
- **Workspace:** Observation scheduler, dashboard capture viewer, result comparison grid, M1/M2 tracker with mapping notes
- **Prev:** Loads the S7 publication record
- **Edit:** Allows adding captures (D+3, D+7, end, ad hoc); notes missed windows as open questions; raw values only, never inferred
- **Next:** Advances to S9 when ≥3 ResultObservation records exist with source, method, capture timestamp, and values where available (Doc E AC-07)

#### S9 — Analyze & Report (Doc B Stage 9, Gate G5)
- **Workspace:** Cycle report editor, criterion verdict editor, unknowns list, trend status selector (Improving/Stable/Declining/Inconclusive), G5 decision panel
- **Prev:** Loads the S8 observation records
- **Edit:** Allows modifying pipeline totals, criterion verdicts, learnings, and the recommendation (REPEAT/REVISE/STOP); every number must trace to ≥1 referenced ResultObservation; net-income verdicts remain `not yet measurable` where field semantics are unverified (OQ-8)
- **Next:** Submits the **G5** decision and closes the cycle

#### S10 — Carry Forward (Doc B Stage 10)
- **Workspace:** Learnings browser, carry-forward selection, next-cycle seed form
- **Prev:** Loads the S9 report
- **Edit:** Allows adding or annotating learnings; prior cycle records are never edited
- **Next:** Starts a new cycle at S1 (REPEAT) or archives the cycle (STOP)

## 3. Workflow State Model Integration

The workflow state file (`data/mission1/workflow-state.yaml`) is the authoritative source of UI state. It is structured as follows:

```yaml
current_cycle: EXP-1
current_stage: S4    # S1..S10
stage_status: IN_PROGRESS   # NOT_STARTED / IN_PROGRESS / DRAFT_DONE / AWAITING_GX / HALTED_QUOTA / HALTED_FAILURE / COMPLETED
pending_action: "Revise claim map in S4 to map all facts"
last_updated: 2026-10-16T10:30:00Z

# Per-step output references (opaque IDs; actual files in docs/data)
step_outputs:
  S1:
    selected_brief: OPP-1-1
    evidence_log_ref: evidence-log.md#ev-01
  S2:
    analysis_brief: analysis-brief.md
    g1_decision: DEC-1-G1
  S3:
    experiment_record: EXP-1
    content_blueprint: true
    g2_decision: DEC-1-G2
  S4:
    script_id: SCR-1-v1
    claim_map_valid: false   # becomes true after edit
  S5:
    asset_file: data/mission1/assets/video1.mp4
    quota_state: OK
    text_overlays: ["overlay1.srt"]
    audio_assets: ["track1.mp3", "sfx1.wav"]
    export_profile: "youtube_short_1080p30fps"
  S6:
    g3_decision: DEC-1-G3
  S7:
    publication_record: PUB-1
    live_url: "https://www.tiktok.com/@owner/video/123456789"
    link_form_used: "profile_bio"
    caption_comparison: MATCH
  S8:
    observations:
      - id: OBS-1-D+3
        captured_at: 2026-10-17T10:00:00Z
      - id: OBS-1-D+7
      - id: OBS-1-END
  S9:
    cycle_report: RPT-1
    g5_decision: DEC-1-G5
    recommendation: REPEAT   # REPEAT / REVISE / STOP
  S10:
    carry_forward_learnings: learnings-cycle-1.md
    next_cycle_brief: OPP-2-1
```

## 4. Gate Semantics (Prev · Edit · Next)

| Gate | Controle | Meaning |
|---|---|---|
| **Prev** | Workflow regression | Loads prior step output for review; **does not** bypass any gate. The workflow state may remain in the current step until Next is explicitly clicked. |
| **Edit** | Step output modification | Allows modifying the current step's deliverables. Creates a new version (version_of linkage). Does not advance the workflow. Gating: some steps require gate approval before Edit is enabled (e.g., S4 requires every factual claim to be mapped before Next is enabled). |
| **Next** | Workflow advancement | Advances the workflow to the next step. **This is not** blanket authorization for external or financial actions. All gates (G2–G5, G-pay) remain in effect. The workflow will block Next if the step's gate is not approved. |

### 4.1 Gate Enforcement

- **Next is disabled** when the current step's gate is not approved. The error message explains what's needed (e.g., "G3 approval required before Next", "G2 decision required", "G4 publish approval required").
- **Edit is always enabled** but may produce a validation warning if the modified output would violate a gate (e.g., editing S3 to remove a claim map entry that S4 depends on).
- **Prev does not bypass gates** but may show the prior step's state as it was when it was last active.

## 5. State Preservation on Interruption

If the workflow is interrupted (crash, restart, etc.):

1. The workflow state file is saved atomically on every control click (Prev/Edit/Next).
2. On restart, the workflow reads the last saved state and restores the sidebar and workspace.
3. If a step was `IN_PROGRESS` at interruption, it resumes from that state.
4. If a step was `DRAFT_DONE`, it stays in `DRAFT_DONE` and the Next control is enabled (if gate approved).
5. If a step was `HALTED_QUOTA` or `HALTED_FAILURE`, the workflow shows a halt notice in the sidebar and disables controls until the operator resolves the issue and resumes.

## 6. Evidence & Audit Trail

Every step change produces an entry in the **run history** (`run-history.yaml`):

```yaml
- ts: 2026-10-16T10:30:00Z
  actor: OWNER_OPERATOR
  action: "Clicked Next from S4 to S5"
  result: OK
- ts: 2026-10-16T10:35:00Z
  actor: OWNER_OPERATOR
  action: "Edited S5 asset; changed tool list"
  result: OK
  recovery: "Freed quota; re-imported from simpler form"
```

Every numeric value in cycle reports traces to an Evidence record ID or is explicitly tagged UNKNOWN (per Doc D §6, Doc G OQ-8).

## 7. Terminology Check

| Term | Definition (per this spec) |
|---|---|
| **Step** | One of the 10 user-facing workflow steps (Research, Work Plan, Experiment Plan, Storyboard & Script, Production, Review & Approve, Publish & Confirm, Monitor, Analyze & Report, Carry Forward) |
| **Stage** | The corresponding business stage in Doc B (Stage 1–10). The mapping is 1:1; production sub-activities live inside Step 5 and are not steps |
| **Output** | The deliverable produced at a step (brief, experiment record, script, asset, etc.) |
| **Gate** | A decision point (G1–G5, G-pay) that must be approved before the workflow can advance |
| **Prev** | Moves workflow context to the prior step for review; does not advance or approve |
| **Edit** | Modifies the current step's output; creates a new version |
| **Next** | Advances the workflow to the next step; subject to gate approval |
| **Stale** | A G3 approval that no longer covers changed content (Doc D §3.8); not a general step status |
| **Dependency-aware re-execution** | Operator-recorded assessment of which downstream outputs must be re-run after an upstream change (Doc B Stage 7, Doc D §3.11); no automatic detection |
| **Evidence record** | A tagged entry in the evidence log (Doc H format) with source, URL, retrieval date, finding, claim class |

## 8. Open Questions & Unresolved (carried from Doc G)

| # | Question | Impact on UI |
|---|---|---|
| OQ-2 | Commission-lag reality | Affects S8 observation scheduling and M1/M2 timing display |
| OQ-3 | Per-campaign commission terms | Affects S8 pipeline totals and M1 computation display |
| OQ-4 | Channel eligibility reality | Affects S7 link form selector options |
| OQ-6 | Budget > 0 appetite | Affects S3 budget field and S5 quota exhaustion behavior |
| OQ-7 | Which niche? | Affects S1 candidate brief display and downstream step population |
| OQ-8 | Field semantics per program | Affects whether S9 shows a net-income verdict or `not yet measurable`; numeric displays must not imply verified semantics |

These are noted for the owner's resolution but do not prevent this UI specification from being drafted.

## 9. Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-10-16 | Codebuff (Buffy) | Initial draft for owner review |
| 1.1 | 2026-10-19 | Codebuff (Buffy) | Reconciled to Doc B: sidebar, workspace table, and per-step behavior use the ten canonical steps; G2 and G3 are visible; production sub-activities live in S5; removed undefined invalidation fields in favour of RunHistory recording |