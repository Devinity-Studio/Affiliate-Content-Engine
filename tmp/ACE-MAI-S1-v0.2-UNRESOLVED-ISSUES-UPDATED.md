# ACE-MAI-S1 — v0.2 Owner Questions and Unresolved Issues Register

**Associated documents:**

- `tmp/ACE-MAI-S1-v0.2-SEPARATE-DELIVERABLES.md`
- `tmp/ACE-MAI-S1-v0.2-OWNER-DECISION-RECORD.md`
- `tmp/ACE-MAI-S1-v0.2-CHANGE-LOG.md`

**Working baseline:** v0.1 (Draft)

**Target revision:** v0.2 (Draft)

**Status:** PROPOSED — PENDING FINAL OWNER REVIEW

---

## 1. Status summary

| Category | Count | Status |
|---|---|---|
| Owner-decision questions | 4 | OWNER APPROVED: Q1, Q12, Q13, Q14 |
| Remaining owner questions | 11 | REMAINING OWNER QUESTIONS — STATUS UNCHANGED: Q2–Q11 |
| Owner decisions integrated | 4 | OD-01, OD-02, OD-03, OD-04 |

---

## 2. Owner decisions integrated

### OD-01 — Q1 — Two-Layer Approach

**Question:** Does the Owner accept the proposed two-layer approach of Plan Preparation and Phase A Preparation Activities as defined in revised Section 2.1, and does the Owner accept its implications, including that approval of this plan does not automatically authorize Phase A activities?

**Decision:** APPROVED

**Decision attribution:** Owner

**Requirements adopted:**

1. Plan Preparation and Phase A Preparation Activities must have separate scope, deliverables, completion criteria, and authorization status.
2. Completing or approving Layer 1 does not automatically authorize Layer 2.
3. Work may begin with a limited scope and expand incrementally.
4. Any scope expansion requires explicit Owner authorization.
5. No AI or team member may infer execution authority from completion of a previous layer.

**Package implication:**

- Section 2.1, Section 5.2, Section 9.1, Section 9.2, and Section 14 continue to express the two-layer model explicitly.
- Approval of the plan is not treated as authorization for Phase A activities.

**Open item carried forward:**

- The exact boundary between Phase A preparation and any later proposed execution phase remains an open Owner Question for later clarification.

---

### OD-02 — Q12 — WS-02 and WS-03 Dependency

**Question:** Does the Owner accept the WS-02/WS-03 dependency reconciliation, specifically that WS-03 may begin provisionally in parallel with WS-02 but should not be completed or accepted before the WS-02 mapping inputs it relies on are available or explicitly recorded as unavailable, with the resulting limitations and acceptance implications documented?

**Decision:** APPROVED

**Decision attribution:** Owner

**Requirements adopted:**

1. Adopt **Provisional Parallel Start with Completion Gate**.
2. WS-02 and WS-03 may begin provisionally in parallel.
3. WS-02 must maintain a Field Mapping Register with: Source Field, Target Field, Mapping Status, Mapping Rule, Evidence Reference, Unresolved Issue, and Future Confirmation Requirement.
4. Mapping statuses must distinguish Mapped, Provisional, and Unknown.
5. WS-03 may prepare ingestion processes before all mappings are complete.
6. WS-03 must not be declared complete or accepted until required WS-02 inputs are provided or explicitly recorded as unavailable, with the resulting limitations and acceptance implications documented.
7. No missing mapping may be filled through unsupported assumptions.

**Package implication:**

- WS-02 acceptance criteria now require the Field Mapping Register shape and status vocabulary.
- WS-03 keeps provisional parallel-start permission plus a completion gate, not early acceptance.

**Open item:**

- None created by this decision; the dependency question is now an accepted decision rather than an open question.

---

### OD-03 — Q13 — Data Quality Stop vs Authorization Breach

**Question:** Does the Owner accept that a data-quality issue is not automatically an authorization-boundary breach unless the facts support that classification?

**Decision:** APPROVED

**Decision attribution:** Owner

**Requirements adopted:**

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

**Package implication:**

- Stop Conditions retain both families and both response patterns.
- A Data Quality Stop is narrower than an Authorization Breach.
- Classification uncertainty triggers escalation, not self-certification.

**Open item:**

- None created by this decision.

---

### OD-04 — Q14 — Phase A Exit Criteria

**Question:** Does the Owner accept the proposed Phase A Exit Criteria framework, subject to the stated interpretation?

**Decision:** APPROVED

**Decision attribution:** Owner

**Requirements adopted:**

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

**Package implication:**

- Section 9.2 continues to express Phase A completion as a preparation pass only.
- Accepted conclusions remain qualified as required.
- The package does not imply production readiness from Phase A completion.

**Open item:**

- None created by this decision.

---

## 3. Remaining Owner Questions

These are unchanged by OD-01 through OD-04. They are explicitly not marked as approved or resolved.

1. Q2: What is the exact boundary between Phase A preparation and any later proposed execution phase?
2. Q3: Are there any specific dashboard fields, filters, or download behaviors the Owner wants reviewed in more detail during Phase A?
3. Q4: What level of schema-mapping confirmation is acceptable at the preparation stage before any later phase proposes execution?
4. Q5: How should the NaN-related limitation be handled if and when empty-file paths are encountered in real data?
5. Q6: What evidence would be required for the Owner to consider lifecycle/runtime enforcement claims reviewable beyond the current preparation posture?
6. Q7: Are there any Owner-defined stop conditions beyond the ones listed here?
7. Q8: Should any later proposed execution phase be gated by separate approval, evidence, or cost review?
8. Q9: Should Gemini be confirmed as the proposed Independent Reviewer, or replaced, or deferred?
9. Q10: Is the version discrepancy between “Owner-approved v1.1” in the task brief and the v0.1 file in the workspace resolvable, or should v0.1 remain the working baseline until that is clarified?
10. Q11: Are there any specific assumptions the Owner wants removed, tightened, or confirmed before approving a next phase?
11. Q12: WS-02 and WS-03 dependency — OWNER APPROVED as OD-02

---

## 4. Unresolved issues still open

The following remain open and are not closed by OD-01 through OD-04:

- UI-01: CLOSED – Evidence-Based Administrative Closure (Owner decision, 2026-11-07)
- UI-02: Gemini Independent Reviewer not yet confirmed.
- UI-03: Dashboard conclusion is structural/UI-level only.
- UI-04: Source Library entry labelled with Shopee affiliate dashboard language may be a UI concept rather than a verified live integration.
- UI-05: Schema mapping is provisional.
- UI-06: Lifecycle/runtime enforcement is not independently verified.
- UI-07: Real revenue and settlement validation are deferred.
- UI-08: Evidence register still depends on artifact identity for the dashboard excerpt that is not independently supplied in this package.

---

## 5. Open assumptions still in force

The following assumptions are retained as labeled limitations and are not silently removed:

- OA-01: Some empty-file handling paths may produce NaN in some calculations.
- OA-02: Conversion Report schema mapping remains provisional.
- OA-03: Lifecycle testing validates logic only, not an implemented real state machine.
- OA-04: Revenue-state testing uses mock data, not actual settlement evidence.
- OA-05: Runtime enforcement has not been independently verified.
- OA-06: v0.1 draft is the working baseline for v0.2. V0.1 is not retroactively promoted to an Owner-approved v1.1 or another official baseline beyond its use as the working baseline for this revision pass.
- OA-07: WS-03 may begin provisionally in parallel with WS-02, but should not be accepted before the WS-02 mapping inputs it relies on are available or explicitly recorded as unavailable.

---

## 6. Items not decided by OD-01 through OD-04

- v0.2 is not finally approved by these four decisions.
- No execution, implementation, deployment, data creation, external contact, API use, spend, repository modification, or governance-ledger modification is authorized.
- The v0.1 file is not retroactively promoted to an Owner-approved v1.1 or another official baseline beyond its use as the working baseline for this revision pass.
- Q2 through Q11 remain unchanged in status.
