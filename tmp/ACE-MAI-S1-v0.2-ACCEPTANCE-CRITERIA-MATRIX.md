# ACE-MAI-S1 — Phase A Preparation Plan — Acceptance Criteria Matrix

**Associated document:** `tmp/ACE-MAI-S1-v0.2-SEPARATE-DELIVERABLES.md`  
**Working baseline:** v0.1 (Draft)  
**Target revision:** v0.2 (Draft)  
**Status:** Proposed — Pending Owner Review

---

## Format

For each workstream:

- Objective
- Activities
- Inputs
- Expected outputs
- Deliverables
- Required evidence
- Acceptance criteria
- Dependencies
- Known limitations
- Exit criteria

---

## WS-01 — Dashboard & Data Structure

**Objective**  
Review the dashboard and data structure as presentable and structurally sound.

**Activities**  
- Identify dashboard structure as documented and structurally verified at the preparation level.  
- Distinguish structural review from revenue conclusion.  
- Preserve the conclusion: **Dashboard Structure Verified — Real Revenue Data Not Yet Available.**  
- Record observed dashboard elements and their limits.

**Inputs**  
- Available dashboard/UI evidence artifact(s).  
- Current system/data documentation where present.

**Expected outputs**  
- Structured list of observable dashboard elements.  
- Clear statement of what the evidence supports.  
- Clear statement of what the evidence does not prove.

**Deliverables**  
- Dashboard evidence record.  
- Evidence Register entry for the dashboard posture.

**Required evidence**  
- Specific dashboard artifact reviewed.  
- Enumeration of observable elements and limits.  
- Artifact identity, extraction date, or hash if available; if not, that absence must be stated explicitly.

**Acceptance criteria**  
- The dashboard claim is tied to a specific evidence reference and artifact identity.  
- Each observation is classified as directly observable or inferred.  
- Price, rating, and displayed sales text are not treated as proof of Affiliate revenue, commission realization, shop-level revenue, or settlement.  
- The verification status is not upgraded beyond a structural/UI observation.  
- No acceptance criterion, exit criterion, or approval statement in this plan implies that runtime enforcement, implementation, live testing, or real-revenue settlement has been verified unless evidence for that specific claim is separately supplied and clearly identified as such.  
- If any criterion cannot be objectively checked against a supplied artifact, it is recorded as Not Verified rather than assumed present.

**Dependencies**  
- WS-06 for evidence classification discipline.  
- WS-07 for readiness synthesis.

**Known limitations**  
- Evidence supports structural/UI observation only.  
- Evidence does not establish real revenue or settlement validation.

**Exit criteria**  
- The structural review is documented, evidence-tied, and not overstated.  
- Real data claims are deferred until evidence is available.

---

## WS-02 — Data Schema Preparation

**Objective**  
Prepare schema work so future real data can be ingested without false confidence.

**Activities**  
- Keep schema mapping labelled provisional.  
- Distinguish Catalog Schema from Conversion Ledger Schema where relevant.  
- Keep alias catalogue and related mappings marked as preparation artifacts, not finalized truth.  
- Record which fields are treated as provisional or unknown.  
- Record requirements for future real-export confirmation.

**Inputs**  
- Current schema documentation and mapping artifacts, if any.  
- Field-level observations from review of current data shapes.

**Expected outputs**  
- Source field inventory.  
- Target field inventory.  
- Mapping status per field.  
- Unknown field list.  
- Unresolved mappings list.  
- Future confirmation requirements.

**Deliverables**  
- Provisional schema mapping document.  
- Field-level status register.

**Required evidence**  
- Current mapping state, clearly labelled.  
- Explicit marking of provisional and unknown items.  
- For each mapped field, the mapping rule used, where applicable.

**Acceptance criteria**  
- A Field Mapping Register is present with the following columns: Source Field, Target Field, Mapping Status, Mapping Rule where applicable, Evidence Reference, Unresolved Issue, Future Confirmation Requirement.  
- Mapping statuses distinguish Mapped, Provisional, and Unknown.  
- Each field is classified as Mapped, Provisional, or Unknown, never as Verified unless that status is genuinely supported.  
- No field is presented as verified unless it genuinely is.  
- Catalog Schema and Conversion Ledger Schema are explicitly distinguished.  
- Any future confirmation requirement is stated rather than assumed.  
- No missing mapping is filled through unsupported assumptions; an unmapped or uncertain field remains Unknown and unresolved.  
- If a field cannot be mapped at this stage, its status is recorded as Unknown and the reason is noted.  
- Missing mapping is not filled in with invented completeness.

**Dependencies**  
- WS-01 where data structure informs schema review.  
- WS-03 where ingestion shape depends on schema readiness.

**Known limitations**  
- Schema mapping remains provisional and is recorded in Mapped, Provisional, or Unknown terms only.  
- Real-export confirmation is required before any claim of completeness.  
- Missing mapping must not be filled through unsupported assumptions; any such case is an unresolved mapping, not an implicit completion.

**Exit criteria**  
- Schema work is clearly a readiness task.  
- The mapping is not represented as complete for real data.  
- The Field Mapping Register is present and consistent with the OD-02 status vocabulary.  
- Any unresolved mapping is recorded with its limitation and future confirmation requirement.

WS-03 may prepare ingestion processes before all mappings are complete, but WS-03 does not adopt early acceptance: WS-03 must not be declared complete or accepted until the required WS-02 inputs it relies on are provided or explicitly recorded as unavailable, with the resulting limitations and acceptance implications documented.

---

## WS-03 — Data Ingestion Readiness

**Objective**  
Prepare ingestion readiness for future real data without faking it.

**Activities**  
- Review ingestion shape, formats, and readiness patterns.  
- Keep mock/fixture usage explicit.  
- Do not create real imports to manufacture evidence.  
- Distinguish ingestion readiness from proof of ingestion results.

**Inputs**  
- Current ingestion documentation or shapes, if present.  
- Known limitations around empty-file handling.

**Expected outputs**  
- Ingestion readiness posture.  
- Explicit mock/fixture labels.  
- Limitation notes for edge cases.

**Deliverables**  
- Ingestion readiness record.

**Required evidence**  
- Current ingestion description.  
- Explicit labeling of what is prepared versus what is proven.

**Acceptance criteria**  
- Ingestion readiness is documented without manufacturing evidence.  
- Mock/fixture usage is labelled synthetic.  
- Empty-file handling limitations are stated, not silently resolved.  
- If ingestion readiness is asserted, the specific readiness items asserted are enumerated and verifiable.  
- Plain assertions such as “ready to ingest” are not treated as sufficient; the specific items that are and are not ready must be listed.  
- WS-03 may prepare ingestion processes before all mappings are complete.  
- WS-03 does not adopt early acceptance; it must not be declared complete or accepted until the required WS-02 inputs it relies on are provided or explicitly recorded as unavailable, with the resulting limitations and acceptance implications documented.

**Dependencies**  
- WS-02 where ingestion depends on schema readiness.

**Known limitations**  
- Empty-file handling may produce NaN in some calculations.  
- Real ingestion results are not claimed.

**Exit criteria**  
- A prepared-to-ingest posture is documented.  
- The task does not claim proof of real ingestion results.
- WS-03 retains provisional parallel-start permission but does not adopt early acceptance.
- If any required WS-02 input is still unavailable, WS-03 records the completion-gate status with the limitation and acceptance implication stated.

---

## WS-04 — Lifecycle & Revenue Model

**Objective**  
Document what is known and not known about lifecycle and revenue.

**Activities**  
- Preserve: **Revenue State Logic Partially Validated — Real Settlement Not Tested.**  
- Keep lifecycle verification limited to logic review, not implementation of a real state machine.  
- Keep revenue-state work on mock data, not actual settlement evidence.  
- Explicitly separate logic validation from settlement evidence.

**Inputs**  
- Current lifecycle/revenue model documentation, if present.  
- Any available logic-test evidence that is clearly scoped.

**Expected outputs**  
- Documented lifecycle and revenue posture.  
- Explicit separation of logic-only validation from real settlement.

**Deliverables**  
- Lifecycle/revenue limitation record.

**Required evidence**  
- Evidence of what was reviewed.  
- Explicit statement that settlement was not tested.

**Acceptance criteria**  
- Logic validation is not overstated as runtime or implementation verification.  
- Real settlement is not claimed.  
- Mock data usage is labelled.  
- If the lifecycle logic is claimed to be reviewed, the specific logic elements reviewed are named.  
- If settlement is claimed not to be tested, that limitation is stated explicitly in the deliverables.

**Dependencies**  
- WS-06 for evidence discipline.  
- WS-07 for readiness synthesis.

**Known limitations**  
- Lifecycle testing validates logic only, not an implemented real state machine.  
- Revenue-state testing uses mock data, not actual settlement evidence.

**Exit criteria**  
- Partial validation is acknowledged explicitly.  
- Real settlement is not claimed.

---

## WS-05 — Execution Safety

**Objective**  
Keep preparation from becoming unauthorized execution.

**Activities**  
- Maintain explicit prohibitions and boundaries.  
- Keep mock/fixture clearly labelled synthetic.  
- Maintain readiness gate thinking without authorizing live action.  
- Maintain operational stop conditions for boundary-risk activity.

**Inputs**  
- Current scope, out-of-scope, and prohibition statements.  
- This plan’s stop conditions and ownership rules.

**Expected outputs**  
- Maintained boundary discipline.  
- Stop-condition handling that is operational, not just aspirational.

**Deliverables**  
- Execution safety record.

**Required evidence**  
- Current prohibitions.  
- Current owner-control statements.  
- Traceability from each stop condition to a recorded trigger, response, and authority.

**Acceptance criteria**  
- Prohibitions remain explicit.  
- No role is represented as authorized to implement, deploy, contact Shopee, use Shopee APIs, create products/content/orders, generate real revenue, or incur costs.  
- Stop conditions define trigger, immediate response, affected activity, role responsible for recording the Stop Event, minimum evidence to preserve, owner notification responsibility and timing, required review responsibility, and exact authority required to resume.  
- If a Stop Event occurs, the record shows whether it was an Evidence/Data Quality Stop or an Authorization Boundary Breach, and why.  
- A data-quality issue is not automatically described as an authorization breach unless the facts support that classification.

**Dependencies**  
- WS-07 for overall readiness posture.

**Known limitations**  
- Execution safety is preserved as a boundary discipline, not a production enforcement claim.

**Exit criteria**  
- Boundary discipline is documented and preserved.  
- Live action is not authorized.

---

## WS-06 — Evidence & Audit

**Objective**  
Keep evidence classification honest and traceable.

**Activities**  
- Classify claims as Fact / Derived / Assumption / Unknown.  
- Prevent silent upgrades of provisional findings into verified facts.  
- Keep audit posture consistent with what the evidence can support.  
- Maintain an Evidence Register with references and limitations.

**Inputs**  
- Available evidence artifacts.  
- Current conclusion and limitation statements.

**Expected outputs**  
- Evidence Register.  
- Classification consistency across the plan.

**Deliverables**  
- Evidence Register / Traceability Matrix.

**Required evidence**  
- Evidence references where available.  
- Explicit unavailable/unknown marking where a reference is missing.  
- For each material claim, a verification status that distinguishes “supplied and reviewable,” “source-document statement only,” and “not independently verified.”

**Acceptance criteria**  
- Each material claim has a classification.  
- Each claim has an evidence reference or an explicit unavailable/unknown note.  
- Where underlying evidence is missing, the register uses an explicit status such as Underlying Evidence Not Supplied or Not Independently Verified.  
- Claims are not upgraded merely because a document mentions them.  
- Evidence artifact identity, version, date, or hash is recorded where available; where not available, that absence is recorded.

**Dependencies**  
- All workstreams for claim inputs.

**Known limitations**  
- Some claim references may be unavailable and must remain marked as such.

**Exit criteria**  
- Evidence posture is reviewable and constrained by actual evidence.

---

## WS-07 — Readiness Assessment

**Objective**  
Produce the readiness conclusion and unresolved questions.

**Activities**  
- Assess readiness against preparation criteria.  
- Preserve: **Preparation-Ready — Not Execution-Ready.**  
- Preserve: **Execution Profile: POLICY SIMULATION PASSED — RUNTIME ENFORCEMENT NOT VERIFIED.**  
- Preserve: **Mock Validation Completed — Real Revenue Validation Deferred.**  
- Compile unresolved questions for the Owner.

**Inputs**  
- Results of WS-01 through WS-06.  
- Current preserved conclusions and limitations.

**Expected outputs**  
- Readiness conclusion.  
- Unresolved questions for the Owner.

**Deliverables**  
- Readiness assessment record.

**Required evidence**  
- The assembled workstream outputs.  
- Explicit linkage between unresolved questions and evidence gaps.  
- Evidence that WS-01 through WS-06 outputs and acceptance results were reviewed before the readiness conclusion was formed.

**Acceptance criteria**  
- Readiness verdict is explicit.  
- The readiness verdict does not, by itself, authorize execution.  
- Unresolved questions are explicit, traceable to evidence gaps, and do not invent answers.  
- Before producing the overall readiness assessment, WS-07 explicitly reviews the outputs of WS-01 through WS-06 and their acceptance results, and records any exception or Not Verified item.  
- The readiness conclusion states which items were supported by supplied evidence and which were not.  
- If a readiness item depends on evidence that was not supplied, that dependency is recorded as unresolved or not verified.

**Dependencies**  
- WS-01 through WS-06.

**Known limitations**  
- Readiness here means a complete preparation document, not authorization for execution.

**Exit criteria**  
- The readiness verdict may be raised to the Owner for decision.  
- Execution is not authorized by this assessment.
