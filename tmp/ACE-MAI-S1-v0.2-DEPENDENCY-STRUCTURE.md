# ACE-MAI-S1 — Phase A Preparation Plan — Workstream Dependency Structure

**Associated documents:**  
- `tmp/ACE-MAI-S1-v0.2-SEPARATE-DELIVERABLES.md`  
- `tmp/ACE-MAI-S1-v0.2-ACCEPTANCE-CRITERIA-MATRIX.md`

**Working baseline:** v0.1 (Draft)  
**Target revision:** v0.2 (Draft)  
**Status:** Proposed — Pending Owner Review

---

## 1. Dependency types used in this model

To avoid ambiguity, this model distinguishes four dependency types:

- **Start Dependency:** the dependent workstream may not begin until the prerequisite workstream has reached a defined starting state, such as having its inputs available or its scope defined.
- **Input Dependency:** the dependent workstream may begin, but it consumes specific outputs or decisions from another workstream, so its content depends on that other workstream.
- **Completion Dependency:** the dependent workstream cannot be completed until the prerequisite workstream has completed its required outputs.
- **Acceptance Dependency:** the dependent workstream cannot be accepted as done until the prerequisite workstream has been checked against its acceptance criteria, or any exception has been explicitly recorded.

When a dependency is described below, the dependent workstream is the one that relies on the prerequisite.

For example, “WS-03 has an input dependency on WS-02” means WS-03 may begin, but its content depends on WS-02’s schema readiness posture.

---

## 2. Layer 1 — Foundational inputs

### WS-06 — Evidence & Audit

- **Dependency role:** Cross-cutting evidence discipline.
- **Start dependency for other workstreams:** Not a gate for starting WS-01 through WS-05, but each of those workstreams should apply the evidence classification discipline WS-06 defines.
- **Input dependency for others:** WS-01 through WS-05 should treat WS-06’s classification and evidence-referencing rules as inputs to how they describe their own claims.
- **Completion dependency for others:** Weak evidence discipline degrades the reliability of every other workstream’s outputs, so the other workstreams’ completed claims depend indirectly on WS-06’s discipline.
- **Acceptance dependency for others:** WS-07 cannot accept the overall evidence posture unless WS-06 has maintained a usable Evidence Register and classification discipline.
- **Parallelizable with:** WS-01, WS-02, WS-03, WS-04, WS-05.
- **Blocking condition:** WS-06 does not block the start of WS-01 through WS-05, but it does block acceptance of the overall evidence posture if it has not been maintained.
- **Completion evidence:** Evidence Register with claim-level classifications, evidence references, and verification statuses; no silent upgrades.

---

## 3. Layer 2 — Workstream-level dependencies

### WS-01 — Dashboard & Data Structure

- **Prerequisites:** Available dashboard/UI evidence.
- **Start dependency:** Available dashboard/UI evidence must exist before WS-01 can begin evidence extraction.
- **Input dependency:** WS-06’s evidence classification discipline.
- **Output to WS-07:** Structured evidence record and limitation statements.
- **Parallelizable with:** WS-02, WS-03, WS-04, WS-05.
- **Blocking condition:** WS-01 does not block WS-02 through WS-05, but its evidence limits must be visible to WS-07.
- **Acceptance dependency:** WS-07 accepts the overall evidence posture only if WS-01’s dashboard claim is tied to a specific evidence reference and observable/inferred separation.
- **Completion evidence:** Dashboard claim tied to a specific evidence reference, with observable/inferred separation and no revenue/status upgrade.

### WS-02 — Data Schema Preparation

- **Prerequisites:** Current schema/mapping artifacts, if any; field-level observations.
- **Start dependency:** WS-01 data structure observations, if used, should be available when WS-02 needs them, but WS-02 can begin with its own schema/mapping artifacts if those are available.
- **Input dependency:** WS-01, where relevant, and WS-06’s classification discipline.
- **Output to WS-03:** Schema readiness posture, field status, and unresolved mapping list.
- **Parallelizable with:** WS-01, WS-03, WS-04, WS-05.
- **Blocking condition for WS-03:** WS-03 has an input dependency on WS-02, not necessarily a start dependency. WS-03 can begin provisionally in parallel with WS-02, but its content should reflect WS-02’s current schema posture.
- **Acceptance dependency for WS-03:** WS-03 may begin in parallel with WS-02, but WS-03 should not be accepted as complete until the WS-02 mapping inputs it relies on are available or explicitly recorded as unavailable.
- **Acceptance dependency for WS-07:** WS-07 should not accept the overall readiness posture without WS-02’s field-mapping register and unresolved-mapping list.
- **Completion evidence:** Source/target field lists, mapping status, unknown list, unresolved mappings, and future confirmation requirements.

### WS-03 — Data Ingestion Readiness

- **Prerequisites:** Current ingestion documentation or shapes, if any.
- **Start dependency:** Current ingestion description should be available before WS-03 begins extracting readiness items.
- **Input dependency:** WS-02 schema readiness posture; WS-06 classification discipline.
- **Output to WS-07:** Ingestion readiness posture and mock/fixture labeling.
- **Parallelizable with:** WS-01, WS-02, WS-04, WS-05.
- **Blocking condition:** WS-03 can begin provisionally in parallel with WS-02, but it should not be completed or accepted before the WS-02 mapping inputs it relies on are available or explicitly recorded as unavailable.
- **Acceptance dependency:** WS-07 accepts ingestion readiness only if WS-03’s readiness items are enumerated and verifiable, and its mock/fixture labeling is explicit.
- **Completion evidence:** Readiness posture, synthetic labels, and limitation notes; not proof of real ingestion results.

### WS-04 — Lifecycle & Revenue Model

- **Prerequisites:** Current lifecycle/revenue documentation, if any.
- **Start dependency:** Current lifecycle/revenue documentation, if used, should be available before WS-04 begins.
- **Input dependency:** WS-06 classification discipline.
- **Output to WS-07:** Lifecycle/revenue limitation record.
- **Parallelizable with:** WS-01, WS-02, WS-03, WS-05.
- **Blocking condition:** WS-04 must not overstate logic validation as runtime or settlement verification.
- **Acceptance dependency:** WS-07 accepts the lifecycle/revenue posture only if WS-04 names the specific logic elements reviewed and states the settlement-not-tested limitation.
- **Completion evidence:** Documented logic-only posture and explicit settlement-not-tested statement.

### WS-05 — Execution Safety

- **Prerequisites:** Scope, out-of-scope, prohibitions, and owner-control statements.
- **Start dependency:** These prohibitions and owner-control statements must be available before WS-05 begins.
- **Input dependency:** WS-06 classification discipline.
- **Output to WS-07:** Boundary discipline and stop-condition handling.
- **Parallelizable with:** WS-01, WS-02, WS-03, WS-04.
- **Blocking condition:** None; this is a guard, not a data producer.
- **Acceptance dependency:** WS-07 accepts execution safety only if WS-05 maintains prohibitions and an operational stop-condition record with roles and authority.
- **Completion evidence:** Maintained prohibitions and operational stop-condition structure.

---

## 4. Layer 3 — Consolidation

### WS-07 — Readiness Assessment

- **Prerequisites:** Outputs from WS-01 through WS-06.
- **Start dependency:** WS-07 should not begin its final readiness synthesis until WS-01 through WS-06 have advanced enough to provide their outputs.
- **Input dependency:** WS-01 for dashboard evidence limits; WS-02 for schema readiness; WS-03 for ingestion readiness; WS-04 for lifecycle/revenue posture; WS-05 for execution safety posture; WS-06 for evidence discipline.
- **Completion dependency:** WS-07 cannot be completed until WS-01 through WS-06 have produced the outputs on which WS-07 depends.
- **Acceptance dependency:** WS-07 must explicitly review WS-01 through WS-06 outputs and acceptance results before producing the overall readiness conclusion.
- **Parallelizable with:** None at this layer; it is the synthesizer.
- **Blocking condition:** WS-07 cannot finalize the readiness conclusion without the other workstreams’ outputs and limitations.
- **Completion evidence:** Explicit readiness verdict, explicit limitations, compiled unresolved questions, and a record of the WS-01 through WS-06 review.

---

## 5. WS-02 and WS-03 reconciliation

This revision reconciles WS-02 and WS-03 as follows:

1. WS-02 and WS-03 are parallel-capable during Plan Preparation; they do not have to be strictly sequential.
2. WS-03 has an **input dependency** on WS-02, not a hard **start dependency** on WS-02 completion.
3. WS-03 may begin provisionally in parallel with WS-02, using its current best understanding of schema readiness.
4. WS-03 should not be **completed or accepted** before the WS-02 mapping inputs it relies on are available or explicitly recorded as unavailable.
5. If WS-02 mapping inputs remain unavailable, WS-03 should record that as an open dependency and should not present itself as complete on that basis.
6. WS-07 should reflect this dependency rather than pretending WS-03 is fully independent of WS-02.

> This reconciliation is reinforced under OD-02 as Provisional Parallel Start with Completion Gate. WS-03 may prepare ingestion processes before all mappings are complete, but WS-03 does not adopt early acceptance; it must not be declared complete or accepted until the required WS-02 inputs it relies on are provided or explicitly recorded as unavailable, with the resulting limitations and acceptance implications documented.

This reconciliation is the main change from the earlier dependency wording, which described the relationship more loosely as “WS-03 depends on WS-02 where ingestion depends on schema readiness.”

---

## 6. Parallelization summary

Likely parallelizable during Plan Preparation:
- WS-01, WS-02, WS-03, WS-04, WS-05, and WS-06 can proceed in parallel to a large degree, because each has its own evidence or documentation needs.
- WS-03 may run provisionally alongside WS-02, subject to the open-input dependency above.
- WS-07 is a downstream consolidation point, not a parallel track.

Likely sequential dependency:
- WS-07 should follow the others, because it synthesizes their outputs into the readiness conclusion and unresolved questions.

---

## 7. Blocking conditions

A workstream should stop or defer if:
- It would rely on evidence not yet available.
- It would treat provisional mapping as verified.
- It would blur preparation and execution.
- It would upgrade a conclusion beyond the supporting evidence.
- It would treat mock/fixture as real.

These are operationalized in Section 8 of the main v0.2 document and in WS-05 acceptance criteria.

---

## 8. Completion evidence per workstream

| Workstream | Completion evidence |
|---|---|
| WS-01 | Dashboard claim tied to evidence reference; observable/inferred separation; no revenue/status upgrade |
| WS-02 | Provisional mapping with field status; Catalog/Conversion Ledger distinction; future confirmation requirements stated |
| WS-03 | Ingestion readiness posture; mock/fixture labelled; edge-case limitations stated |
| WS-04 | Lifecycle/revenue posture; logic-only validation distinguished from settlement; settlement-not-tested stated |
| WS-05 | Prohibitions maintained; stop conditions operationalized |
| WS-06 | Evidence Register with classifications and references; no silent upgrades |
| WS-07 | Readiness verdict, limitations, and unresolved questions compiled |

---

## 9. Dependency model rationale

This structure is chosen because:

- WS-06 is cross-cutting and should inform all evidence-bearing workstreams, but it is not a start gate for DS-01 through WS-05.
- WS-01 through WS-05 each have distinct evidence domains, so they can proceed largely in parallel without inventing dependencies that do not exist.
- WS-02 and WS-03 are parallel-capable but not independent; WS-03’s content depends on WS-02, and WS-03 should not be accepted early on that basis.
- WS-07 is the natural integrator for readiness and unresolved questions, and it must explicitly review WS-01 through WS-06 before it produces readiness.
- The model avoids inventing fixed durations or artificial sequencing where none is required.
- The model preserves the distinction between Plan Preparation and any later authorized Phase A Preparation Activities.

This model differs in detail from the earlier dependency sketch in the submission, which was accepted in substance but not adopted verbatim. The current model is preferred because it separates start, input, completion, and acceptance dependencies more explicitly and because it makes the WS-02/WS-03 open-input dependency visible.

---

## 10. Unresolved dependency questions

- Whether, for any later Phase A activity, WS-02 mapping completeness should be a hard gate before WS-03 accepts real ingestion readiness. That is left as an unresolved question, not decided here.
- Whether WS-01 dashboard evidence completeness should be a gate for WS-03 or WS-07 acceptance. That depends on the Owner’s evidence expectations and is not decided here.
- Whether the dependency model should be tightened further for any specific later execution proposal. That is out of scope for v0.2.
