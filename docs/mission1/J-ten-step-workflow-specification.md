# J. Ten-Step Workflow Specification — Affiliate Content Engine (Slice 1)

**Status:** DRAFT FOR OWNER REVIEW · Version 2.1 (reconciled to Doc B) · 2026-10-19

This document specifies the ten user-facing workflow steps. Each step corresponds **one-to-one** to a business stage in Doc B §2, which remains the canonical definition of the process and its gates. Doc I renders these same ten steps in the interface. Nothing here changes a stage, a gate, a state, or a data-model field; where this document and Doc B differ, Doc B governs.

Production activities (generate/edit video, insert text, music and SFX, final export) are **sub-activities of Step 5**, not separate workflow steps. The two control points they must never displace are Step 3 (experiment approval, G2) and Step 6 (content approval, G3).

For each step this document specifies: Purpose, Inputs, Outputs, User Actions, Completion Criteria/Gates, Dependencies, Failure/Recovery Path, Evidence Required, and UI Behavior (per Doc I).

## 0. Conventions

- **Stage vs. step.** "Stage" is Doc B's business-process unit (Stage 1–10). "Step" is the user-facing workflow unit (Step 1–10). The mapping is 1:1 and is fixed by §0.1.
- **Gate labels.** G1–G5 and G-pay refer to the gate model in Doc A §7 and Doc B §2. No gate is added, removed, renamed, or relocated by this document.
- **Status values.** Per-step status uses the `stage_status` values in Doc D §3.10 (`NOT_STARTED`, `IN_PROGRESS`, `DRAFT_DONE`, `AWAITING_GX`, `HALTED_QUOTA`, `HALTED_FAILURE`, `COMPLETED`). Doc B's `AWAITING_G3`, `G3_APPROVED`, `G3_REJECTED`, `PUBLISHED_LIVE`, `OBSERVING`, and `OBSERVATIONS_COMPLETE` are stage descriptions in Doc B; they are not additional schema. Where a step is waiting on a gate, `stage_status` is `AWAITING_GX` and `pending_action` names the gate.
- **Versioning.** Revisions create new IDs with `version_of` linkage; superseded versions are `SUPERSEDED` (Doc D §3.4, §5).
- **Invalidation.** Revising an upstream step requires an operator-recorded re-execution assessment in RunHistory (Doc B Stage 7 "Post-G3 change handling"; Doc D §3.11). There is no automatic dependency detection. `STALE` is reserved for a G3 approval that no longer covers changed content (Doc D §3.8); it is not a general workflow status.
- **Evidence traceability.** Every numeric value traces to a ResultObservation, and every load-bearing claim traces to an Evidence record or is explicitly `UNKNOWN` (Doc D §5–§6, Doc G OQ-8).

### 0.1 Canonical stage → step map

| Stage (Doc B) | Step (this doc / Doc I) | Gate at exit |
|---|---|---|
| Stage 1 — Market Scout | Step 1 — Research | none (pre-G1) |
| Stage 2 — Analysis & Forecast | Step 2 — Work Plan | G1 |
| Stage 3 — Offer Selection & Experiment Planning | Step 3 — Experiment Plan | G2 |
| Stage 4 — Script & Storyboard | Step 4 — Storyboard & Script | none |
| Stage 5 — Content Production | Step 5 — Production | none |
| Stage 6 — QA & Human Approval | Step 6 — Review & Approve | G3 |
| Stage 7 — Publication & Distribution | Step 7 — Publish & Confirm | G4 |
| Stage 8 — Results Tracking | Step 8 — Monitor | none |
| Stage 9 — Analysis, Reporting & Learning | Step 9 — Analyze & Report | G5 |
| Stage 10 — Feedback into next cycle | Step 10 — Carry Forward | none |

## 1. Step 1 — Research (Stage 1 · Market Scout)

### 1.1 Purpose
Gather market evidence about candidate niches, audience problems, products, offers, and competitor content; produce a shortlist of addressable opportunities. Per Doc B Stage 1 and Doc A §7, this is pre-G1, non-binding research with existing/free tools.

### 1.2 Inputs
- Previous cycle learnings, or none in the first cycle
- Current affiliate-program availability (Doc C §4)
- Operator's own interests and knowledge areas

### 1.3 Outputs
- Evidence records (≥1 per key claim) in the evidence log
- Opportunity briefs: niche, audience, problem, candidate offers, why-now reasoning, risks, confidence
- Exactly 1 selected niche, with rationale

### 1.4 User Actions
- The AI proposes 3–5 candidates, tagging every market statement FACT / INFERENCE / HYPOTHESIS / UNKNOWN.
- The operator opens each source and verifies the finding; unverifiable claims become `UNKNOWN` and do not drive decisions.
- The operator selects one candidate and records the reason.

### 1.5 Completion Criteria/Gates
- **No gate.** G1 is not a prerequisite for Step 1 (Doc A §7).
- **Acceptance:** ≥3 candidates with sources; 1 selected with reasons; every load-bearing claim tagged.

### 1.6 Dependencies
- Feeds Step 2 as the opportunity brief.
- Pre-G1 research does not authorize account creation, enrollment, production, publication, or spending.

### 1.7 Failure/Recovery Path
- Unverifiable program/offer → claim marked `UNKNOWN` and excluded.
- Too few candidates → widen the zero-cost search, or halt with `HALTED_QUOTA` (called `PAUSED_QUOTA` in Doc B) + owner report if free-tool quota is exhausted.
- Contradictory sources → record as `UNKNOWN`; do not resolve silently.

### 1.8 Evidence Required
- Per key claim: source name, URL/reference, retrieval date, exact finding, methodology/limitations.
- Claim-class tags on every entry.
- Selected brief with rationale and Evidence IDs.

### 1.9 UI Behavior (per Doc I)
- **Sidebar:** Step 1 highlighted; `IN_PROGRESS` or `DRAFT_DONE`.
- **Workspace:** Evidence log browser, candidate cards, source-verification panel.
- **Prev:** Disabled (first step).
- **Edit:** Opens the evidence log; add or remove candidate briefs.
- **Next:** Enabled when ≥3 candidates are sourced and 1 is selected with reasons.

## 2. Step 2 — Work Plan (Stage 2 · Analysis & Forecast)

### 2.1 Purpose
Turn the selected opportunity into a hypothesis with explicit arithmetic, risks, and confidence. Per Doc B Stage 2 this is analysis only; G1 approves the plan as a whole before operational execution, and G2 later approves the specific experiment.

### 2.2 Inputs
- Opportunity brief from Step 1
- Program facts verified on the program's own page or the logged-in dashboard
- Operator's channel setup and available time

### 2.3 Outputs
- Analysis brief: hypothesis, arithmetic, confidence (L/M/H), risks, disqualifiers
- Plan-level budget statement (default THB 0)
- Optionally, a draft content outline carried into Step 3 (it is not a record until the experiment exists)

### 2.4 User Actions
- The AI drafts the hypothesis arithmetic: commission rate × conversion assumption × traffic assumption × order value, each sourced or labeled `ASSUMPTION`.
- The operator corrects facts and confirms the logic.
- The operator records G1 approval of the plan before any operational execution.

### 2.5 Completion Criteria/Gates
- **G1** at exit: the plan is approved before account-affecting, production, publication, or spending actions (Doc B diagram, Doc A §7).
- **Acceptance:** arithmetic explicit; every term sourced or labeled assumption; risks listed; confidence stated.

### 2.6 Dependencies
- Feeds Step 3. G1 does not replace G2; the experiment still requires its own approval.
- If the plan is rejected, the workflow returns here for revision.

### 2.7 Failure/Recovery Path
- Data required by the arithmetic is unavailable (e.g., our CTR) → record `UNKNOWN`, state an estimate range, and note that the first experiment exists to replace it with a FACT.
- No eligible program → return to Step 1 with the reason logged.

### 2.8 Evidence Required
- Program facts from the program's own source; dashboard screenshot where available.
- Every assumption labeled as such.
- G1 decision record referencing the plan.

### 2.9 UI Behavior (per Doc I)
- **Sidebar:** Step 2 highlighted; `AWAITING_GX` with `pending_action: "G1 plan approval"` until the decision exists.
- **Workspace:** HYPOTHESIS editor, success-criteria table, channel/offer selector, budget guardrail.
- **Prev:** Loads Step 1 briefs for review.
- **Edit:** Modify hypothesis, criteria, channel, budget; budget > 0 triggers the G-pay check.
- **Next:** Enabled when a G1 APPROVED decision exists.

## 3. Step 3 — Experiment Plan (Stage 3 · Offer Selection & Experiment Planning)

### 3.1 Purpose
Choose exactly one offer/program and design the smallest experiment that can confirm or refute the hypothesis. This is the step that carries **G2**; without it there is no approved experiment to produce content for.

### 3.2 Inputs
- Analysis brief and approved plan (Step 2)
- Operator's channel assets and program-join status
- Channel capability note (e.g., follower gate relevant to the planned link form)

### 3.3 Outputs
- Experiment record (`EXP-<cycle>`) with status `PLANNED`
- `content_blueprint` block (Doc D §3.3) with the seven required fields
- Cost budget (default THB 0) and observation schedule

### 3.4 User Actions
- Select ONE offer: product + program + link form + channel.
- Pre-register numeric success criteria, duration (default 14 days), and observation points (D+3, D+7, end).
- Define the decision rule at experiment end.
- Approve at G2, or reject with reasons.

### 3.5 Completion Criteria/Gates
- **G2 required** before Step 4 (Doc B Stage 3).
- **Acceptance:** experiment record complete; blueprint required fields present and consistent with channel/link form/criteria (Doc E AC-15); G2 decision logged with the EXP id.

### 3.6 Dependencies
- Depends on the Step 2 analysis brief and G1.
- Feeds Step 4. A blueprint change after G2 is a recorded change assessed under Doc B Stage 7.

### 3.7 Failure/Recovery Path
- No eligible program → return to Step 1 with the reason logged.
- Paid join or buy-in required → stage blocks pending G-pay or the offer is dropped.
- G2 rejected → revise here; no production begins.

### 3.8 Evidence Required
- Program/offer facts from the dashboard screenshot where available.
- Complete experiment record and blueprint.
- G2 decision record.

### 3.9 UI Behavior (per Doc I)
- **Sidebar:** Step 3 highlighted; `AWAITING_GX` with `pending_action: "G2 experiment approval"` until decided.
- **Workspace:** Experiment form (hypothesis, criteria, duration, schedule), blueprint fields, channel/link-form selector, budget guardrail.
- **Prev:** Loads the Step 2 analysis brief.
- **Edit:** Modify offer, criteria, blueprint, budget; budget > 0 requires G-pay.
- **Next:** Enabled only when a G2 APPROVED decision exists; error text "G2 decision required".

## 4. Step 4 — Storyboard & Script (Stage 4 · Script & Storyboard)

### 4.1 Purpose
Draft the single content asset's script and storyboard with claim-to-evidence mapping and required disclosures. This is drafting only; approval happens at G3 in Step 6, after production.

### 4.2 Inputs
- Experiment record and `content_blueprint` (Step 3)
- Evidence entries for the product
- Channel policy notes and disclosure requirements (Doc C §6)

### 4.3 Outputs
- `SCR-<cycle>-v<n>`: script, storyboard, `claim_map`, `disclosure_plan`, `cta`, `caption_draft`
- Version identifier and blueprint-conformance note

### 4.4 User Actions
- Structure one asset: hook → problem → product facts/demo → CTA with the authorized link location.
- Map every factual claim to an Evidence ID; cut or relabel anything unmapped.
- Include the channel's disclosure line/setting and any AI-use disclosure trigger.
- Write the CTA wording per placement and the planned caption as one coordinated design.

### 4.5 Completion Criteria/Gates
- **No gate at this step** (Doc B Stage 4; G3 follows production).
- **Acceptance:** every claim mapped; disclosure plan present; link form authorized; CTA and planned caption conform to the blueprint and are consistent with the script; operator-edited final exists.

### 4.6 Dependencies
- Depends on the approved experiment and blueprint.
- Feeds Step 5. Script/CTA/caption changes later are recorded changes (Doc B Stage 7).

### 4.7 Failure/Recovery Path
- Claim lacks evidence → supply evidence or cut/relabel the claim.
- Disclosure cannot be determined for the channel → treat as `UNKNOWN`; do not publish; follow the OQ-8 resolution path.
- Blueprint conflict → stop and resolve at the plan level rather than redefining the blueprint inside the script.

### 4.8 Evidence Required
- Claim map (claims → Evidence IDs), disclosure plan, CTA plan, planned caption, version identifier.

### 4.9 UI Behavior (per Doc I)
- **Sidebar:** Step 4 highlighted; `IN_PROGRESS` or `DRAFT_DONE`.
- **Workspace:** Script editor with claim map, evidence selector, disclosure planner, CTA/caption panel.
- **Prev:** Loads the Step 3 experiment record.
- **Edit:** Add/remove claims, map evidence, edit CTA and caption; unmapped facts are flagged.
- **Next:** Enabled when zero factual claims are unmapped and the disclosure plan is present.

## 5. Step 5 — Production (Stage 5 · Content Production)

### 5.1 Purpose
Produce the approved script into one asset using free/existing tools. Production is one workflow step containing four sub-activities.

### 5.2 Inputs
- Final script/storyboard (Step 4)
- Free tools on the operator's computer, within free quota
- Channel format requirements

### 5.3 Outputs
- Asset file
- Production metadata: tools used, AI use, quota state, disclosures applied

#### 5.3a Sub-activities (not separate steps, no gates)

| Sub-activity | Completion condition | Evidence |
|---|---|---|
| 5a Generate & edit video | Timeline assembled from the storyboard; AI drafts may be replaced by manual edits | Draft file, tool list |
| 5b Insert text | On-screen text and subtitles match the script; disclosure placement applied | Overlay/subtitle files |
| 5c Music & SFX | Audio selected from free/licensed sources; levels set | Audio asset list |
| 5d Finalize/export | Export profile matches the channel; asset file is final for review | Exported asset + export settings |

### 5.4 User Actions
- Produce in the order above; record tools and quota state as work proceeds.
- If a free quota is exhausted, pause and report; never switch to a paid tool.
- Submit the final asset and script to Step 6.

### 5.5 Completion Criteria/Gates
- **No gate at this step**; G3 reviews the output.
- **Acceptance:** asset exists and matches the approved script; metadata recorded; `spent_thb_actual == 0` unless a G-pay record exists (Doc E AC-04).

### 5.6 Dependencies
- Depends on Step 4.
- Feeds Step 6. Any later media change is a new asset file and a full G3 re-review (Doc E AC-20).

### 5.7 Failure/Recovery Path
- Tool unavailable or free tier blocked → fall back to a simpler asset form and record the fallback in RunHistory.
- Quota exhausted → `HALTED_QUOTA` (called `PAUSED_QUOTA` in Doc B) + owner report.

### 5.8 Evidence Required
- Asset file, production metadata, quota state, tool list, AI-use notes.

### 5.9 UI Behavior (per Doc I)
- **Sidebar:** Step 5 highlighted; `IN_PROGRESS` or `DRAFT_DONE`.
- **Workspace:** One workspace with four tabs (video, text, audio, finalize); preview, timeline, tool palette (free tools only), metadata editor.
- **Prev:** Loads the Step 4 script.
- **Edit:** Replace drafts, change tools, update metadata; quota exhaustion surfaces the halt notice.
- **Next:** Enabled when the asset exists and metadata is complete.

## 6. Step 6 — Review & Approve (Stage 6 · QA & Human Approval, G3)

### 6.1 Purpose
The owner approves content before any publication. This step carries **G3** and is mandatory.

### 6.2 Inputs
- Produced asset and final script
- Claim map, disclosure plan, CTA plan, planned caption
- Channel policy notes

### 6.3 Outputs
- G3 Decision record with date, result, and reasons
- On rejection: revision notes and a new script version

### 6.4 User Actions
- Review the six checklist items: (1) claim map present and valid, (2) disclosures present, (3) link form authorized, (4) no invented results/testimonials, (5) no platform-policy conflicts, (6) content design conforms to the approved plan — storyboard, script, CTA, and planned caption consistent, with CTA/caption claims evidence-mapped.
- Approve, or reject with reasons that route back to Step 4.

### 6.5 Completion Criteria/Gates
- **G3 required** before Step 7. No approval → no publication.
- **Acceptance:** recorded G3 decision covering all six items (Doc E AC-17).

### 6.6 Dependencies
- Depends on Step 5.
- Feeds Step 7. A post-G3 CTA/caption change makes the approval `STALE` until a new G3 decision exists (Doc B Stage 7, Doc E AC-18).

### 6.7 Failure/Recovery Path
- Owner unavailable → workflow stays in `AWAITING_GX`; no timeout auto-approves.
- Rejection → return to Step 4 with a new version; the old version is `SUPERSEDED`.

### 6.8 Evidence Required
- Decision record; reviewed asset identified by file path plus SCR id/version. Doc D §3.5 defines no asset identifier or content hash.

### 6.9 UI Behavior (per Doc I)
- **Sidebar:** Step 6 highlighted; `AWAITING_GX` with `pending_action: "G3 content approval"`.
- **Workspace:** Asset preview beside the six-item checklist, claim map, disclosure and link-form confirmation, CTA/caption comparison.
- **Prev:** Loads the Step 5 asset.
- **Edit:** Records revision notes; routes back to Step 4.
- **Next:** Enabled only when a G3 APPROVED decision exists; error text "G3 approval required".

## 7. Step 7 — Publish & Confirm (Stage 7 · Publication & Distribution, G4)

### 7.1 Purpose
Publish the approved asset on exactly one channel with the authorized affiliate link, then record what was actually published.

### 7.2 Inputs
- G3-approved asset and reviewed CTA/planned caption
- Caption/hashtag/link kit
- Operator's channel account and the affiliate link from the program dashboard

### 7.3 Outputs
- Publication record (`PUB-<cycle>`) with evidence files
- Caption-comparison note (`MATCH` / `DIFFERS` / `UNVERIFIABLE` / `NOT_APPLICABLE`)

### 7.4 User Actions
- Apply required platform settings (commercial disclosure, AI-use label where required).
- Compare the text to be published with the G3-reviewed text before publishing.
- Publish manually inside the platform; capture URL, timestamp, link form, caption, and a screenshot.
- Record the publication and the comparison outcome.

### 7.5 Completion Criteria/Gates
- **G4 required** before publication; the operator may publish as owner while logging the G4 record.
- **Acceptance:** publication record complete with live URL, `posted_at`, matching link form, disclosure settings, `caption_used` (or `UNKNOWN` with reason), and the comparison outcome (Doc E AC-06, AC-19).

### 7.6 Dependencies
- Depends on Step 6 (G3) and the produced asset.
- Feeds Step 8; a changed caption/CTA after G3 invalidates the approval before publication.

### 7.7 Failure/Recovery Path
- Text differs from the reviewed text → stop; record the invalidation in RunHistory naming the prior decision and changed artifact; obtain a new G3 decision (Doc D §3.11).
- Publish fails platform-side → retry manually at most twice, then `HALTED_FAILURE` + owner report.
- Disclosure unclear → do not publish; raise to the owner.
- Caption not capturable → `caption_used: UNKNOWN` with the reason; never claim verification.

### 7.8 Evidence Required
- Live URL, screenshot, timestamp, link form, disclosure settings, `caption_used`, comparison note.

### 7.9 UI Behavior (per Doc I)
- **Sidebar:** Step 7 highlighted; `AWAITING_GX` with `pending_action: "G4 publish approval"`, then the published state.
- **Workspace:** Channel selector, caption/hashtag editor, link-form selector, disclosure toggles, publish-kit preview, screenshot uploader, comparison outcome field.
- **Prev:** Loads the Step 6 approval.
- **Edit:** Change channel, caption, hashtags, link form, disclosures; any change to reviewed text triggers re-review.
- **Next:** Enabled when the G4 decision exists and the publication record is complete.

## 8. Step 8 — Monitor (Stage 8 · Results Tracking & Measurement)

### 8.1 Purpose
Collect real outcome evidence on the fixed schedule, without automation assumptions or reinterpretation of dashboard fields.

### 8.2 Inputs
- Publication record from Step 7
- Program dashboard (affiliate statistics)
- Platform analytics (post-level views/reach/clicks where available)

### 8.3 Outputs
- ≥3 ResultObservation records: D+3, D+7, experiment end
- Evidence files for each capture

### 8.4 User Actions
- Capture platform analytics and affiliate-dashboard values for the relevant date range only.
- Record source, method, capture timestamp, raw values, and open questions.
- Keep reach/engagement, clicks, orders, commission-status values, and paid-out cash distinct; record raw values verbatim and map to M1/M2 separately (Doc D §6).

### 8.5 Completion Criteria/Gates
- **No gate.** G5 follows in Step 9.
- **Acceptance:** observations exist for the schedule, or gaps are explicitly recorded as `UNKNOWN` (Doc E AC-07).

### 8.6 Dependencies
- Depends on a complete Step 7 publication record; no observations exist for an unpublished asset.
- Feeds Step 9. If the publication is revised, observations restart from the new publication.

### 8.7 Failure/Recovery Path
- Missed window → proceed with what exists and record the gap; do not interpolate.
- Dashboard value not yet visible → `UNKNOWN` + retry at the next point.
- Dashboard fields changed → re-derive meaning and note it in RunHistory before comparing.

### 8.8 Evidence Required
- Per capture: source, method, timestamp, raw values, evidence file, open questions.
- M1/M2 mapping notes where a mapping was attempted; `UNKNOWN` where program semantics are unverified (OQ-8).

### 8.9 UI Behavior (per Doc I)
- **Sidebar:** Step 8 highlighted; `IN_PROGRESS` during captures and `DRAFT_DONE` when the schedule is complete.
- **Workspace:** Observation scheduler, capture viewer (platform analytics beside affiliate dashboard), result grid, M1/M2 tracker with mapping notes.
- **Prev:** Loads the Step 7 publication record.
- **Edit:** Add captures (D+3, D+7, end, ad hoc); record missed windows as open questions.
- **Next:** Enabled when ≥3 observations exist with source, method, timestamp, and values where available.

## 9. Step 9 — Analyze & Report (Stage 9 · Analysis, Learning & Reporting, G5)

### 9.1 Purpose
Compare hypothesis to actuals, extract learnings, produce the cycle report, and record the next-step decision.

### 9.2 Inputs
- All observations from Step 8
- Experiment record with pre-registered criteria
- Evidence log

### 9.3 Outputs
- Cycle report (`RPT-<cycle>`): pipeline totals, criterion verdicts, unknowns, learnings, recommendation, objective assessment
- G5 Decision record

### 9.4 User Actions
- Compute the pipeline: reach → clicks → orders → pending → M1 → M2 → costs → net income (Doc D §6).
- Report confirm/reject/inconclusive per pre-registered criterion; a CTA difference is at most an INFERENCE, never proof of causation.
- Tag every claim FACT / INFERENCE / HYPOTHESIS / UNKNOWN; list data gaps.
- Assess the income objective only through the approved 14-day formula (Doc G §2b); report `achieved` / `not achieved` / `not yet measurable`.
- Assign a trend status only when comparable windows exist: Improving / Stable / Declining / Inconclusive.
- Recommend Repeat / Revise / Stop; the owner decides at G5.

### 9.5 Completion Criteria/Gates
- **G5 required** to close the cycle and unlock the next one.
- **Acceptance:** report complete; every number traces to an observation; decision recorded with rationale (Doc E AC-08).

### 9.6 Dependencies
- Depends on Step 8 observations.
- Feeds Step 10.

### 9.7 Failure/Recovery Path
- Insufficient data for a confident decision → say so; the owner may extend observation, revise, or stop. No automatic re-run.
- Unverified field semantics → the net-income verdict is `not yet measurable`, never zero.

### 9.8 Evidence Required
- Report with references to observation/Evidence IDs; G5 decision; learnings archive entry.

### 9.9 UI Behavior (per Doc I)
- **Sidebar:** Step 9 highlighted; `AWAITING_GX` with `pending_action: "G5 report acceptance"`, then decided.
- **Workspace:** Cycle report editor, criterion verdict table, unknowns list, trend-status selector, recommendation form, G5 decision form.
- **Prev:** Loads Step 8 observations.
- **Edit:** Modify totals, verdicts, learnings, recommendation; untraceable numbers are flagged.
- **Next:** Submits G5 and closes the cycle.

## 10. Step 10 — Carry Forward (Stage 10 · Feedback into the next cycle)

### 10.1 Purpose
Feed verified outcomes and learnings into the next cycle's Step 1, so work resumes from evidence rather than from scratch.

### 10.2 Inputs
- Cycle report and G5 decision
- Learnings archive

### 10.3 Outputs
- Carry-forward learnings, tagged with class and evidence references
- Next cycle's opportunity brief citing the prior cycle

### 10.4 User Actions
- Carry forward only tagged/sourced learnings: Proven → FACT, Promising → INFERENCE (requires validation), Failed/Warning → UNKNOWN, HYPOTHESIS claims → retestable.
- Open the next cycle at Step 1; do not silently rewrite the prior cycle's records.

### 10.5 Completion Criteria/Gates
- **No gate.** G5 already authorized the transition.
- **Acceptance:** next brief cites prior cycle records explicitly.

### 10.6 Dependencies
- Depends on a recorded G5 decision.
- Feeds the next cycle's Step 1.

### 10.7 Failure/Recovery Path
- Learnings missing → the next cycle notes that and proceeds; no fabrication of carry-forward.
- Contradictory learnings → carry both with their evidence and mark the conflict.

### 10.8 Evidence Required
- Links to prior cycle report, decision, and observation records.

### 10.9 UI Behavior (per Doc I)
- **Sidebar:** Step 10 highlighted; `COMPLETED` after the archive entry, then resets to Step 1 for a new cycle.
- **Workspace:** Learnings browser, carry-forward selection, next-cycle seed form.
- **Prev:** Loads the Step 9 report.
- **Edit:** Add or annotate learnings; no edits to prior records.
- **Next:** Starts a new cycle (REPEAT) or archives the cycle (STOP).

## Appendix A: Workflow State Transitions Summary

Conditions match the Doc B diagram. `stage_status` values are from Doc D §3.10.

| From → To | Condition | State change |
|---|---|---|
| Step 1 → Step 2 | ≥3 candidates with sources; 1 selected with reasons | `DRAFT_DONE` |
| Step 2 → Step 3 | **G1 APPROVED** (plan approval) | `AWAITING_GX → COMPLETED` for Step 2 |
| Step 3 → Step 4 | **G2 APPROVED**; experiment record and blueprint complete | `PLANNED → ACTIVE_SETTING_UP` |
| Step 4 → Step 5 | Every claim mapped; disclosure plan present | `DRAFT_DONE` |
| Step 5 → Step 6 | Asset exists; metadata complete; spend consistent with gates | `DRAFT_DONE` |
| Step 6 → Step 7 | **G3 APPROVED** | `AWAITING_GX → COMPLETED` for Step 6 |
| Step 7 → Step 8 | **G4** recorded; publication record complete | `IN_FLIGHT → OBSERVING` on first capture |
| Step 8 → Step 9 | ≥3 observations (D+3, D+7, end) with source/method/timestamp/values | `OBSERVING → REPORTING` |
| Step 9 → Step 10 | **G5 DECIDED** | `REPORTING → DECIDED` |
| Step 10 → Step 1 (new cycle) | G5 = REPEAT; carry-forward learnings selected | workflow resets to Step 1 |
| Step 10 → archived | G5 = STOP | cycle `ARCHIVED` |

## Appendix B: Re-execution after an upstream change

This assessment is **operator-recorded** in RunHistory per Doc B Stage 7 and Doc D §3.11. No automatic dependency detection or enforcement exists, and no new workflow field is introduced. `STALE` applies only to a G3 approval (Doc D §3.8).

| Upstream change | Steps that may need re-execution | Minimum action |
|---|---|---|
| Step 1 research/selection | 2–10 | Re-run from Step 2; carry forward only sourced learnings |
| Step 2 hypothesis/plan | 3–10 | G1 re-recorded if the plan changes |
| Step 3 experiment/blueprint | 4–10 | G2 re-recorded; affected artifacts regenerated |
| Step 4 script/CTA/caption | 5–9 | New SCR version; G3 re-review before publication |
| Step 5 asset (visuals, audio, burned-in text) | 6–9 | New asset file; full six-item G3 |
| Step 6 approval | 7–9 | Publication blocked until a new G3 exists |
| Step 7 publication | 8–9 | New PUB record; new observation baseline; prior observations retained |
| Step 8 observations | 9 | Recompute the report; never edit prior observations |
| Step 9 report/decision | 10 | G5 re-recorded; cycle archive updated |

## Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-10-16 | Codebuff (Buffy) | Initial draft for owner review |
| 2.0 | 2026-10-16 | Codebuff (Buffy) | Step-level detail added |
| 2.1 | 2026-10-19 | Codebuff (Buffy) | Reconciled to Doc B: ten steps 1:1 with ten stages; restored Step 3 (G2) and Step 6 (G3); production sub-activities contained in Step 5; corrected the step count, cross-references, and appendix conditions; removed undefined state fields |
