# E. Vertical Slice Acceptance Criteria — Affiliate Content Engine

Status: DRAFT FOR OWNER APPROVAL · Version 1.0 · 2026-10-11

**Slice definition:** 1 Opportunity → 1 Offer → 1 Script → 1 Content Asset → 1 Human-Approved Publication → Measured Results → 1 Evidence-Based Report → 1 recorded decision.

**Definition of Done (Slice 1):** all scenarios below pass with evidence files present in the repo, and the owner has recorded a G5 decision for cycle 1. No scenario may be marked pass without its required evidence.

---

## 1. Happy path scenarios

### AC-01 · Market scout produces a source-backed shortlist
- **Given** the operator opens cycle 1 Stage 1
- **When** the AI drafts candidate niches and the operator verifies sources
- **Then** `data/mission1/` contains ≥3 Opportunity briefs, each citing ≥2 Evidence records, and exactly 1 is marked *selected* with rationale.
- **Evidence:** evidence log entries + brief files.
- **Pass condition:** every load-bearing claim in the selected brief is tagged Fact or Inference (with source); no Unknown is load-bearing.

### AC-02 · Experiment plan is pre-registered and gated
- **Given** the selected opportunity brief
- **When** the AI drafts the experiment record and the owner reviews it
- **Then** the Experiment record has: hypothesis with explicit arithmetic, ≥1 numeric success criterion measurable from dashboards, duration (default 14d), observation schedule (D+3/D+7/end), `budget_thb = 0`, channel + `link_form` pinned, program facts traceable to evidence — and a G2 Decision record APPROVED.
- **Evidence:** EXP yaml + DEC record.
- **Pass condition:** no stage transition to Stage 4 occurs in run history before the G2 record's timestamp.

### AC-03 · Script maps every claim to evidence
- **Given** the approved experiment
- **When** the script + claim map are drafted and the operator edits the final
- **Then** the SCR record's claim map shows zero claims with `evidence_id: null` and `kind: fact`, and includes the disclosure plan.
- **Evidence:** SCR file.
- **Pass condition:** any claim the operator could not evidence is `kind: opinion` (clearly framed) or removed.

### AC-04 · Content asset produced with THB 0 spend and quota discipline
- **Given** the approved script
- **When** the operator produces the asset using free/existing tools
- **Then** the asset file exists in the repo and its production metadata lists tools used, AI use, and quota state; `CostBudget.spent_thb_actual == 0` unless a G-pay record exists.
- **Evidence:** asset file + metadata note.
- **Pass condition:** no paid tool/subscription was used or activated (operator attestation + cost record).

### AC-05 · G3 content approval precedes any publication attempt
- **Given** the produced asset
- **When** the owner reviews the G3 checklist
- **Then** a G3 Decision record exists APPROVED (or REJECTED with revision loop evidence and a later APPROVED), timestamped before the publication record's `posted_at`.
- **Evidence:** DEC record.
- **Pass condition:** publishing actions in run history occur only after G3.

### AC-06 · Publication recorded with live evidence
- **Given** G3 approval
- **When** the operator publishes (platform settings applied) and records it
- **Then** a Publication record exists with live_url, `posted_at`, `link_form_used` matching the experiment's pinned link form, disclosure settings applied, and ≥1 screenshot of the live post in the repo.
- **Evidence:** PUB yaml + screenshot files.
- **Pass condition:** the live post's disclosure state (commercial label; AI label if triggered) is visible/recorded; link form is one the channel policy was verified to allow at publish time.

### AC-07 · Scheduled observations captured from real dashboards
- **Given** a LIVE publication
- **When** D+3, D+7, and experiment-end windows are reached
- **Then** ≥3 ResultObservation records exist, each with source, method, capture timestamp, evidence file (screenshot/export), and values where available (Unknown elsewhere); pipeline totals in the CycleReport trace to these.
- **Evidence:** OBS records + files.
- **Pass condition:** no OBS value is synthesized; pending vs confirmed commissions are recorded separately.

### AC-08 · Cycle report is evidence-traceable and drives a decision
- **Given** observations complete (or ended early by owner)
- **When** the AI drafts the CycleReport and the owner reviews
- **Then** the report contains: pipeline totals (reach→clicks→orders→pending→confirmed→refunds→costs→net income, THB), per-criterion verdicts (confirm/reject/inconclusive), each load-bearing line tagged Fact/Inference/Hypothesis/Unknown with references, an explicit list of unknowns/data gaps, the THB 1,000/day assessment via the agreed net-income definition and window (verdict achieved / not achieved / not yet measurable), a REPEAT/REVISE/STOP recommendation — and a G5 Decision record with rationale.
- **Evidence:** RPT file + DEC record + learnings archive entry.
- **Pass condition:** every number in the report appears in ≥1 referenced ResultObservation; the objective assessment verdict does not contradict the numbers.

## 2. Failure-path scenarios

### AC-09 · Quota exhaustion halts, does not pay
- **Given** a stage relying on a free tool whose quota is exhausted
- **When** the stage attempts to proceed
- **Then** workflow state becomes `HALTED_QUOTA`, a RunHistory entry BLOCKED_BY_QUOTA exists, and the owner report names the tool, quota, and free alternatives — with **no** paid-provider switch and no silent continuation.
- **Verification:** run history + owner-visible halt note.

### AC-10 · Gate enforcement blocks unauthorized publication
- **Given** an asset produced without a recorded G3 APPROVED decision
- **When** any publish-capable step is attempted
- **Then** the step is blocked: no Publication record may exist for that experiment before its G3 record; run history shows BLOCKED_BY_GATE.
- **Verification:** absence of PUB record; run history entry.

### AC-11 · Unverifiable claim is downgraded, not used
- **Given** a research claim the operator cannot verify at its source
- **When** Stage 1/2 records it
- **Then** the claim is Evidence with `claim_class: UNKNOWN` and is not load-bearing in the selected brief or experiment arithmetic (either removed or re-sourced).
- **Verification:** evidence log + brief/EXP references.

### AC-12 · Missed observation window degrades gracefully
- **Given** an observation point was missed (e.g., operator away at D+7)
- **When** the next capture occurs
- **Then** the OBS record notes the gap and the CycleReport lists it as a data limitation rather than interpolating or inventing values.
- **Verification:** OBS `open_questions` + RPT unknowns list.

### AC-13 · Budget overrun is impossible without a gate
- **Given** any stage with a cost-estimate field
- **When** a stage's estimate > `CostBudget.planned_thb` without a G-pay APPROVED record
- **Then** the stage is blocked (RunHistory BLOCKED_BY_GATE) until the plan is revised to 0 or the gate is approved; engine-initiated payment is impossible in Slice 1 by design (no payment rails connected).
- **Verification:** run history; absence of any payment record without DEC(G_PAY).

### AC-14 · Value integrity holds under correction
- **Given** a ResultObservation value recorded wrongly
- **When** the correction is made
- **Then** the original OBS record remains (append-only) and a new OBS/annotation referencing it stores the corrected value with its own evidence file; the CycleReport cites the corrected one and notes the correction.
- **Verification:** two OBS records linked; RPT note.

## 3. Cost guardrail tests (summary)

1. Default-deny: every stage's cost field starts at 0; plan-level budget is 0 (AC-02).
2. No payment rails connected in Slice 1: the engine literally cannot pay (AC-13).
3. Quota exhaustion → halt + report, never switch (AC-09).
4. Any future recurring-cost proposal appears only in Doc F §7 (Future Considerations), requiring a new G-pay + G1-class approval.

## 4. Definition of Done

Slice 1 is Done when:
1. AC-01..AC-08 all pass on cycle 1 for the same experiment.
2. At minimum one failure-path behavior (AC-09..AC-13, whichever occurred) has been exercised or verified through inspection if the condition did not arise naturally.
3. `data/mission1/` contains: evidence log, opportunity briefs, EXP record, SCR (final version), asset, PUB record, ≥3 OBS records, RPT, DEC records for G2/G3(/G4)/G5, run history with no unexplained gaps, cost record showing actual spend consistent with gates.
4. The owner's G5 decision explicitly records: confirmed net income for the window (if any), verdict on each success criterion, and the chosen next action (REPEAT/REVISE/STOP) with rationale.
