# ACE-MAI-S1 — v0.2 Owner Decision Record

**Document:** The owner decisions accepted into the v0.2 documentation package.

**Decisions recorded:** OD-01, OD-02, OD-03, OD-04, OD-05

**Status of this record:** PART OF PROPOSED v0.2 PACKAGE — NOT A SEPARATE RELEASE

---

## 1. How to read this record

For each decision, this record lists:
- the decision ID,
- the question ID it answers,
- the decision,
- the decision attribution,
- the requirements the decision imposes,
- the implications for the package,
- the integration locations,
- any open item created or carried forward.

A decision being recorded here is not the same as full v0.2 approval. Remaining Owner Questions are not decided by these five decisions unless explicitly stated.

---

## 2. OD-01 — Q1 — Two-Layer Approach

**Question ID:** Q1

**Decision:** APPROVED

**Decision attribution:** Owner

**Question answered:** Does the Owner accept the proposed two-layer approach of Plan Preparation and Phase A Preparation Activities as defined in revised Section 2.1, and does the Owner accept its implications, including that approval of this plan does not automatically authorize Phase A activities?

**Requirements imposed by this decision:**

1. Plan Preparation and Phase A Preparation Activities must have separate scope, deliverables, completion criteria, and authorization status.
2. Completing or approving Layer 1 does not automatically authorize Layer 2.
3. Work may begin with a limited scope and expand incrementally.
4. Any scope expansion requires explicit Owner authorization.
5. No AI or team member may infer execution authority from completion of a previous layer.

**Implications for the package:**

- The main submission must continue to label Layer 1 and Layer 2 clearly.
- The change log and section narrative should avoid wording that can imply Layer 1 approval is Layer 2 authorization.
- Remaining Owner Questions unrelated to the two-layer distinction are not decided by this decision.

**Integration locations:**

- Main submission: Section 2.1, Section 5.2, Section 9.1, Section 9.2, Section 14
- Change Log
- Owner Questions / Unresolved Issues Register
- Solar Self-Review

**Open item created or carried forward:**

- The two-layer model is approved, but the exact boundary between Phase A preparation and any later proposed execution phase remains an open Owner Question for later clarification.

This package remains proposed until the Owner confirms the next review step.

---

## 3. OD-02 — Q12 — WS-02 and WS-03 Dependency

**Question ID:** Q12

**Decision:** APPROVED

**Decision attribution:** Owner

**Question answered:** Does the Owner accept the WS-02/WS-03 dependency reconciliation, specifically that WS-03 may begin provisionally in parallel with WS-02 but should not be completed or accepted before the WS-02 mapping inputs it relies on are available or explicitly recorded as unavailable, with the resulting limitations and acceptance implications documented?

**Requirements imposed by this decision:**

1. Adopt **Provisional Parallel Start with Completion Gate**.
2. WS-02 and WS-03 may begin provisionally in parallel.
3. WS-02 must maintain a Field Mapping Register with:
   - Source Field
   - Target Field
   - Mapping Status
   - Mapping Rule
   - Evidence Reference
   - Unresolved Issue
   - Future Confirmation Requirement
4. Mapping statuses must distinguish Mapped, Provisional, and Unknown.
5. WS-03 may prepare ingestion processes before all mappings are complete.
6. WS-03 must not be declared complete or accepted until required WS-02 inputs are provided or explicitly recorded as unavailable, with the resulting limitations and acceptance implications documented.
7. No missing mapping may be filled through unsupported assumptions.

**Implications for the package:**

- WS-02 entry must include the Field Mapping Register columns and status vocabulary.
- WS-03 entry must retain provisional parallel-start permission and the completion gate.
- WS-02 and WS-03 dependency wording must not contradict the Completion Gate.
- Any field that cannot be mapped must remain Unknown and unresolved, not normalized to “mapped” by assumption.

**Integration locations:**

- Main submission: WS-02, WS-03, Section 5.2
- Acceptance Criteria Matrix
- Dependency Structure
- Change Log
- Correction Crosswalk, if affected

**Open item created or carried forward:**

- None created by this decision; the dependency model already left the WS-02 gating question as a pending approval question, and this decision confirms it.

---

## 4. OD-03 — Q13 — Data Quality Stop vs Authorization Breach

**Question ID:** Q13

**Decision:** APPROVED

**Decision attribution:** Owner

**Question answered:** Does the Owner accept that a data-quality issue is not automatically an authorization-boundary breach unless the facts support that classification?

**Requirements imposed by this decision:**

A. Data Quality Stop

Examples include incomplete data, duplicate records, malformed dates, inconsistent row counts, or unverifiable source data.

Required response:
- Stop the affected activity.
- Preserve relevant evidence.
- Notify Owner.
- Assess the data-quality issue.
- Resume only within the already authorized scope and applicable procedures.

A Data Quality Stop does not automatically constitute an Authorization Breach.

B. Authorization Breach

Examples include modifying repository files without authorization, using real data outside the approved scope, or executing Phase A without explicit authorization.

Mandatory response:

**STOP → PRESERVE EVIDENCE → NOTIFY OWNER → WAIT FOR EXPLICIT OWNER AUTHORIZATION.**

No AI or team member may independently authorize resumption after an Authorization Boundary breach.

If classification is uncertain, stop the affected activity and escalate to Owner.

**Implications for the package:**

- Stop Conditions must retain both families and both response patterns.
- The Data Quality Stop response must be narrower than the Authorization Breach response.
- The record must allow classification to be uncertain and require escalation rather than self-certification.

**Integration locations:**

- Main submission: Section 8
- Stop Conditions
- Change Log
- Solar Self-Review

**Open item created or carried forward:**

- None created by this decision; it confirms the two-family stop model already proposed.

---

## 5. OD-04 — Q14 — Phase A Exit Criteria

**Question ID:** Q14

**Decision:** APPROVED

**Decision attribution:** Owner

**Question answered:** Does the Owner accept the proposed Phase A Exit Criteria framework, subject to the stated interpretation?

**Requirements imposed by this decision:**

1. All seven Workstreams, WS-01 through WS-07, must provide their required deliverables.
2. Acceptance Criteria must be checked, or exceptions explicitly recorded.
3. Evidence Register must reflect actual available evidence.
4. Unresolved Issues must have recorded statuses and follow-up requirements.
5. No unsupported upgrade from mock evidence to real evidence is permitted.
6. No claim of verified runtime enforcement or real settlement may be made without supporting evidence.

**Important distinction accepted by this decision:**

- Phase A Completed ≠ Execution-Ready.
- Phase A Completed ≠ Production-Ready.
- Phase A completion does not authorize subsequent implementation, deployment, live testing, or commercial execution.

**Implications for the package:**

- Section 9.2 must continue to express Phase A completion as a preparation pass only.
- The accepted conclusions must remain qualified as required.
- The package must not imply that Phase A completion is production readiness.

**Integration locations:**

- Main submission: Section 9.2, Section 11, Section 13, Section 14
- Acceptance Criteria Matrix
- Change Log
- Correction Crosswalk, if affected
- Solar Self-Review

**Open item created or carried forward:**

- None created by this decision; it confirms the framework and the non-execution-readiness distinction.

---

## 6. Decisions not made by OD-01 through OD-05

These five decisions do not resolve the following:

- Q2 through Q11 remain unresolved unless explicitly answered elsewhere.
- The exact Phase A-to-execution boundary for any later phase remains open.
- The Owner-approved v1.1 baseline question is not answered by these five decisions; v0.1 remains the working baseline for this revision pass only.
- Gemini Independent Reviewer confirmation is not decided by these five decisions.
- Any additional Owner-defined stop condition beyond the ones accepted is not invented by these five decisions.

---

## 7. Conflict check note

No conflict was created by these five decisions that required silent reinterpretation. The only note worth carrying forward is that OD-01 and OD-04 both reinforce the same boundary: Plan Preparation and Phase A Preparation Activities are distinct, and Phase A completion is not execution readiness. That is retained as an explicit reinforcement rather than treated as redundant text to be stripped out.

## 8. OD-05 — Q10 & UI-01 — Closure Record

**Question ID:** Q10 / UI-01

**Decision:** CLOSED – Evidence-Based Administrative Closure

**Decision attribution:** Owner

**Decision date:** 2026-11-07

**Requirements imposed by this decision:**
1. Record that Q10 and UI-01 are CLOSED.
2. Include closure type (Evidence-Based Administrative Closure), decision date (2026-11-07), authority (Owner), and selected option (Option A).
3. Reference investigation report `ACE-MAI-S1-V1.1-INVESTIGATION`.
4. State that v0.1 is established as the Historical Working Draft based on the investigation report.
5. State that v1.1 was not located in the inspected sources.
6. State that no approval evidence for v1.1 was located in the inspected sources.
7. Clarify that the global existence of v1.1 is undetermined; this decision does not assert that v1.1 never existed elsewhere.
8. Confirm that v0.2 remains the Owner‑approved Documentation & Readiness baseline under H‑1 Option C.
9. Permit reopening: new relevant evidence may be submitted and reviewed later.
10. Preserve governance: OD‑01 through OD‑05 and H‑1 Option C remain unchanged.
11. No execution authority is granted.

**Implications for the package:**
- The Unresolved Issues Register must mark UI-01 as CLOSED.
- Evidence Register must include a traceable entry for the investigation and closure.

**Integration locations:**
- Owner Decision Record (this entry)
- Unresolved Issues Register
- Evidence Register

**Open item created or carried forward:**
- None.
