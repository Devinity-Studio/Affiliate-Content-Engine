ACE MVP Phase 1 — Final Scope & Contract Reconciliation Report
================================================================

Generated from workspace baseline: mission1-planning-docs branch, HEAD 9749f38e7bdb1ec6ee56be0e2227473c3b973f2b
Date: 2026-10-26

================================================================
A. Actual Git Baseline
================================================================

| Item | Observation |
|------|-------------|
| Current branch | mission1-planning-docs |
| HEAD commit | 9749f38e7bdb1ec6ee56be0e2227473c3b973f2b |
| Remote configuration | origin → https://github.com/Devinity-Studio/Affiliate-Content-Engine.git (main, mission1-planning-docs) |
| Modified tracked files | 8 files in docs/mission1/ (A through H). Total: 285 insertions, 67 deletions |
| Untracked files | 200+ files including fixtures, verification outputs, screenshots, temp files, reference materials, HANDOFF.md, PR_SUMMARY.md |
| data/app/state.json | {"schemaVersion":1,"cycle":1,"selectedOpportunityId":null,"lastDecisionAt":null,"decisions":[]} — no opportunity selected, no plan record, no Experiment, no DEC records |
| Key observation | Contract documents (docs/mission1/) have been modified from earlier state; all user modifications and untracked files preserved per restrictions |

================================================================
B. Contract-Owner Boundary Conflict Analysis
================================================================

1. Original Definition of Done (Doc E v1.1):
   - Slice 1 is Done when AC-01..AC-08 all pass on cycle 1
   - At minimum one failure-path behavior (AC-09..AC-13) has been exercised or verified
   - data/mission1/ contains: evidence log, opportunity briefs, EXP record, SCR (final version), asset, PUB record, ≥3 OBS records, RPT, DEC records for G2/G3(/G4)/G5, run history with no unexplained gaps, cost record showing actual spend consistent with gates
   - Owner's G5 decision explicitly records: normalized net income for the window, verdict on each success criterion, chosen next action (REPEAT/REVISE/STOP) with rationale
   - Content-design and CTA lifecycle checks AC-15–AC-21 pass
   - AC-18 and AC-20 apply when their trigger occurs (post-G3 change or asset replacement); where trigger did not arise, documented handling verified by record inspection

2. Owner's confirmed Phase 1 boundary (per documented conversation):
   - Phase 1 = Content Creation & Content Library
   - Research → Source Library → Analyze → Candidate → Plan → Storyboard/Script/CTA → Production → QA → Finalize → Export actual content files → Store and retrieve through Content Library
   - Owner can manually externally publish the exported files — publication is a separate activity from creating and storing Content in Phase 1
   - Phase 1 does NOT inherently require integrated automated publication, observation, analysis, or Cycle Report
   - Phase 2 = Integrated Affiliate Workflow (full cycle through observation/analysis/Cycle Report)

3. Contract conflict:
   - The original Definition of Done in Doc E v1.1 assumes a full cycle through G5/RPT
   - This creates a direct conflict with the Owner's confirmed Phase 1 boundary, which ends at Export and Content Library store/retrieve
   - The DoD's requirement for G5 decision, CycleReport, and full observation/analysis cycle cannot be inherently satisfied within Phase 1 scope as defined by the Owner
   - This conflict must be reported as such; it is not resolvable by simply adjusting statuses

4. Necessary resolution:
   - Separate the original DoD into Phase 1 DoD and Phase 2 DoD
   - Keep original Doc E v1.1 intact as the full-cycle DoD
   - Create a Phase 1–specific DoD that covers content creation through export/store-retrieve
   - Create a Phase 2 DoD that covers the integrated affiliate workflow (observation through Cycle Report)
   - Map each AC-01 through AC-21 to the appropriate phase or shared foundation
   - Mark the amended DoD as PROPOSED / PENDING OWNER APPROVAL

================================================================
C. Phase-Specific DoD Amendment Draft
================================================================

1. Phase 1 DoD — Content Creation & Content Library

   Slice 1 Phase 1 is Done when ALL of the following pass:

   a. AC-01: Market scout produces a source-backed shortlist
      - ≥3 Opportunity briefs, each citing ≥2 Evidence records, exactly 1 marked *selected* with rationale
      - Every load-bearing claim in the selected brief is tagged FACT/INFERENCE (with source); no UNKNOWN is load-bearing
      - Evidence: evidence log entries + brief files

   b. AC-02: Experiment plan is pre-registered and gated
      - Experiment record has: hypothesis with explicit arithmetic, ≥1 numeric success criterion measurable from dashboards, duration (default 14d), observation schedule (D+3/D+7/end), budget_thb = 0, channel + link_form pinned, program facts traceable to evidence
      - G2 Decision record APPROVED (or APPROVED_WITH_NOTES)
      - No stage transition to Stage 4 occurs in run history before the G2 record's timestamp
      - Evidence: EXP yaml + DEC record

   c. AC-03: Script maps every claim to evidence
      - SCR record's claim map shows zero claims with evidence_id: null and kind: fact
      - Includes the disclosure plan
      - Any claim the operator could not evidence is kind: opinion (clearly framed) or removed
      - Evidence: SCR file

   d. AC-04: Content asset produced with THB 0 spend and quota discipline
      - Asset file exists in the repo
      - Production metadata lists tools used, AI use, and quota state
      - CostBudget.spent_thb_actual == 0 unless a G-pay record exists
      - No paid tool/subscription was used or activated (operator attestation + cost record)
      - Evidence: asset file + metadata note

   e. AC-05: G3 content approval precedes any publication attempt
      - G3 Decision record exists APPROVED (or REJECTED with revision loop evidence and later APPROVED)
      - G3 decision timestamped before the publication record's posted_at
      - Publishing actions in run history occur only after G3
      - Evidence: DEC record

   f. AC-09: Quota exhaustion halts, does not pay
      - Workflow state becomes HALTED_QUOTA
      - RunHistory entry BLOCKED_BY_QUOTA exists
      - Owner report names the tool, quota, and free alternatives
      - No paid-provider switch and no silent continuation
      - Evidence: run history + owner-visible halt note

   g. AC-10: Gate enforcement blocks unauthorized publication
      - No Publication record may exist for an experiment before its G3 record
      - Run history shows BLOCKED_BY_GATE
      - Evidence: absence of PUB record; run history entry

   h. AC-11: Unverifiable claim is downgraded, not used
      - Claim is Evidence with claim_class: UNKNOWN and is not load-bearing in the selected brief or experiment arithmetic
      - Either removed or re-sourced
      - Evidence: evidence log + brief/EXP references

   i. AC-13: Budget overrun is impossible without a gate
      - Any stage with a cost-estimate field: if estimate > CostBudget.planned_thb without a G-pay APPROVED record, stage is blocked (BLOCKED_BY_GATE) until plan revised to 0 or gate approved
      - Engine-initiated payment impossible in Slice 1 by design (no payment rails connected)
      - Evidence: run history; absence of any payment record without DEC(G_PAY)

   j. AC-14: Value integrity holds under correction
      - Original OBS record remains (append-only)
      - New OBS/annotation referencing it stores the corrected value with its own evidence file
      - CycleReport cites the corrected one and notes the correction
      - Evidence: two OBS records linked; RPT note

   k. AC-15: Plan requirements exist before production begins
      - content_blueprint contains every required field (content_objective, audience_ref, format, desired_viewer_action, cta_direction, evidence_refs, disclosure_requirements)
      - References the OPP record
      - Reuses channel, link_form, and success_criteria rather than duplicating them
      - G2 decision record's related_ids includes the EXP id
      - All required fields present; G2 decision timestamp precedes first SCR or asset record; decision references EXP id
      - Evidence: EXP record with the blueprint block; G2 decision record and timestamp

   l. AC-16: Storyboard, Script, and CTA conform to the plan and stay consistent
      - Script.cta.desired_action equals content_blueprint.desired_viewer_action
      - Spoken, on-screen, and caption wording matches Script.cta.wording for each placement used
      - caption_draft carries the planned caption
      - Storyboard and script describe the same asset
      - Zero unexplained differences; any difference has a recorded change per AC-18
      - Evidence: SCR record plus the G3 decision rationale

   m. AC-17: G3 checks CTA consistency and relevant claim evidence
      - Decision covers all 6 checklist items
      - Item 6 records plan conformance, CTA/caption consistency, and that every CTA/caption factual claim appears in claim_map with an Evidence ID
      - Evidence: DEC record enumerating the 6 items
      - Pass condition: 6-item decision present; any CTA/caption claim without evidence blocks approval or is rewritten as labeled opinion

   n. AC-21: Unavailable CTA attribution stays UNKNOWN and causality is not asserted
      - Attribution scope recorded; per-post or per-CTA clicks are UNKNOWN, never 0
      - Report lists the gap
      - CTA hypothesis is reported confirm/reject/inconclusive; any learning is at most an INFERENCE
      - Evidence: OBS mapping_notes/open_questions; RPT unknowns and learning class
      - Pass condition: no zero substituted for unknown; no statement that the CTA caused a sale or conversion

   o. Shared Foundation elements (support both Phase 1 and Phase 2):
      - Evidence handling: FACT/INFERENCE/HYPOTHESIS/UNKNOWN classification with URL/file references
      - ID systems: EV-<cycle>-<n>, OPP-<cycle>-<n>, EXP-<cycle>, SCR-<cycle>-v<n>, PUB-<cycle>, OBS-<cycle>-<n>, DEC-<cycle>-<n>, RPT-<cycle>
      - Append-only records: Evidence, ResultObservation, Decision, RunHistory — corrections create new records referencing old ones
      - State transitions: Experiment status edges (PLANNED→ACTIVE_SETTING_UP, etc.), Script status (DRAFT→DRAFT_DONE→APPROVED_G3), Publication status (LIVE only after G4)
      - Cost budgeting: CostBudget.planned_thb default 0, spent_thb_actual tracked, approvals list
      - Content Work Item (CWI) system: server-generated immutable CWI-<n> ids, type/enum constraints, plan_ref pinning

2. Phase 2 DoD — Integrated Affiliate Workflow

   Phase 2 begins after Phase 1 DoD is satisfied. Phase 2 is Done when ALL of the following pass in addition to Phase 1:

   a. AC-06: Publication recorded with live evidence
      - Publication record exists with live_url, posted_at, link_form_used matching experiment's pinned link form
      - Disclosure settings applied (commercial label; AI label if triggered)
      - ≥1 screenshot of the live post in the repo
      - caption_used (or explicit UNKNOWN with reason)
      - Evidence: PUB yaml + screenshot files
      - Pass condition: live post's disclosure state visible/recorded; link form verified to allow at publish time

   b. AC-07: Scheduled observations captured from real dashboards
      - ≥3 ResultObservation records exist
      - Each with source, method, capture timestamp, evidence file (screenshot/export), and values where available (UNKNOWN elsewhere)
      - Pipeline totals in the CycleReport trace to these
      - Evidence: OBS records + files
      - Pass condition: no OBS value is synthesized; pending vs confirmed commissions recorded separately

   c. AC-08: Cycle report is evidence-traceable and drives a decision
      - Pipeline totals (reach → clicks → orders → pending → M1 normalized confirmed net commission → M2 cash received → costs → net income = M1 − costs, THB)
      - Per-criterion verdicts (confirm/reject/inconclusive)
      - Each load-bearing line tagged FACT/INFERENCE/HYPOTHESIS/UNKNOWN with references
      - Explicit list of unknowns/data gaps
      - THB 1,000/day assessment via normalized metrics and owner-agreed window
      - Cycle's timeline position (Weeks 1–2 learning vs Weeks 3–4 target)
      - Where aggregation formula unapproved: explicit use of "not yet measurable" instead of invented figure
      - REPEAT/REVISE/STOP recommendation
      - Where daily evidence sufficient: continuous-optimization trend status (Improving/Stable/Declining/Inconclusive, with "inconclusive, not blamed" rule)
      - G5 Decision record with rationale
      - Evidence: RPT file + DEC record + learnings archive entry
      - Pass condition: every number in report appears in ≥1 referenced ResultObservation; objective assessment verdict does not contradict the numbers

   d. AC-12: Missed observation window degrades gracefully
      - OBS record notes the gap
      - CycleReport lists it as a data limitation rather than interpolating or inventing values
      - Evidence: OBS open_questions + RPT unknowns list

   e. AC-18: A post-G3 CTA or caption change invalidates approval and blocks publication
      - Prior decision recorded as invalidated (STALE) by RunHistory event naming the prior decision and changed artifact
      - Publication is blocked
      - New G3 decision records the new CTA/caption Y
      - Publication record's caption_used equals Y
      - Evidence: RunHistory invalidation entry, new G3 decision record, PUB record
      - Pass condition: no publication created after the change whose caption_used differs from the latest reviewed text; no publication timestamp between the change and the new G3 decision

   f. AC-19: The published caption is persisted and comparable
      - caption_used holds the verbatim published text
      - Comparison against Script.caption_draft recorded as MATCH/DIFFERS/UNVERIFIABLE/NOT_APPLICABLE in caption-comparison note under evidence_files
      - If caption cannot be captured: caption_used is UNKNOWN with the reason
      - Evidence: PUB record; caption-comparison note; live-post screenshot
      - Pass condition: MATCH only when texts are equal; DIFFERS and UNVERIFIABLE never counted as a match; no verification claimed when value is UNKNOWN

   g. AC-20: An asset-affecting change requires a new asset file and quality review
      - New asset file and production metadata recorded (Doc D §3.5 records assets by file path)
      - Prior SCR version SUPERSEDED
      - Full 6-item G3 is repeated
      - New PUB record created if the earlier one was live
      - Evidence: SCR version record, DEC record, PUB ids
      - Pass condition: no publication of the changed asset before the new G3; earlier publication record unmodified

3. Shared Foundation (common to both phases)

   - Evidence handling: FACT/INFERENCE/HYPOTHESIS/UNKNOWN with required URL/file for FACT
   - ID systems (one experiment cycle): EV, OPP, EXP, SCR, PUB, OBS, DEC, RPT
   - Append-only integrity: corrections create new records, never overwrite
   - State-transition constraints: experiment/script/publication status enums and allowed edges
   - Cost budgeting: planned_thb default 0, spent_thb_actual, approvals
   - Content Work Item (CWI) system: server-generated CWI-<n>, type constraints, plan_ref pinning
   - RunHistory: append-only, records actor, action, result, error_detail, recovery
   - Gating: G1 (pre-G1 boundary), G2 (experiment plan), G3 (content approval), G4 (publication), G5 (cycle assessment), G_pay (any spend)

================================================================
D. AC-01–AC-21 Reconciliation Matrix (without status inflation)
================================================================

| AC # | Title | Phase Classification | Status | Gap / Unresolved | Disposition |
|------|-------|----------------------|--------|------------------|-------------|
| AC-01 | Market scout produces a source-backed shortlist | Phase 1 | Not assessed (no cycle executed) | N/A — scope limited to research/design in Phase 1 | Verified by record inspection when cycle executes |
| AC-02 | Experiment plan is pre-registered and gated | Phase 1 | Not assessed (no cycle executed) | N/A — G2 gate with budget_thb=0 is Phase 1 prerequisite | Verified by EXP yaml + DEC record inspection |
| AC-03 | Script maps every claim to evidence | Phase 1 | Not assessed (no cycle executed) | N/A — claim_map inspection is design-verification | Verified by SCR file inspection |
| AC-04 | Content asset produced with THB 0 spend and quota discipline | Phase 1 | Not assessed (no asset produced) | N/A — cost record + metadata inspection | Verified by asset file + metadata note inspection |
| AC-05 | G3 content approval precedes any publication attempt | Phase 1 | Not assessed (no publication attempted) | N/A — G3 DEC record inspection | Verified by DEC record + run history inspection |
| AC-06 | Publication recorded with live evidence | Phase 2 | NOT VERIFIED — requires actual publication | Requires live platform publish + evidence capture | Phase 2 DoD; triggers after Phase 1 |
| AC-07 | Scheduled observations captured from real dashboards | Phase 2 | NOT VERIFIED — requires live publication | Requires ≥3 OBS records from live dashboard captures | Phase 2 DoD; Phase 1 ends at export |
| AC-08 | Cycle report is evidence-traceable and drives a decision | Phase 2 | NOT VERIFIED — requires full cycle | Requires RPT + G5 DEC + all OBS complete | Phase 2 DoD; full cycle through G5/RPT |
| AC-09 | Quota exhaustion halts, does not pay | Phase 1 | Not assessed (no quota exhaustion observed) | N/A — run history inspection when event occurs | Verified by run history + halt note inspection |
| AC-10 | Gate enforcement blocks unauthorized publication | Phase 1 | Not assessed (no unauthorized attempt) | N/A — gate enforcement is design constraint | Verified by run history + PUB absence inspection |
| AC-11 | Unverifiable claim is downgraded, not used | Phase 1 | Not assessed (no unverifiable claim encountered) | N/A — evidence log + brief inspection | Verified by evidence log + brief/EXP references |
| AC-12 | Missed observation window degrades gracefully | Phase 2 | NOT VERIFIED — requires observation data | Requires OBS records with open_questions + RPT unknowns | Phase 2 DoD; depends on Phase 7 observations |
| AC-13 | Budget overrun is impossible without a gate | Phase 1 | Not assessed (no budget overrun attempted) | N/A — design constraint, no payment rails in Slice 1 | Verified by run history + absence of payment records |
| AC-14 | Value integrity holds under correction | Phase 1 | Not assessed (no correction needed) | N/A — two OBS records inspection | Verified by two OBS records linked + RPT note |
| AC-15 | Plan requirements exist before production begins | Phase 1 | Not assessed (no production begun) | N/A — EXP blueprint + G2 DEC inspection | Verified by EXP record + G2 DEC + timestamp inspection |
| AC-16 | Storyboard, Script, and CTA conform to the plan and stay consistent | Phase 1 | Not assessed (no asset produced) | N/A — SCR + G3 DEC inspection | Verified by SCR file + G3 DEC rationale inspection |
| AC-17 | G3 checks CTA consistency and relevant claim evidence | Phase 1 | Not assessed (no G3 decision) | N/A — 6-item DEC inspection | Verified by DEC record enumerating 6 items |
| AC-18 | A post-G3 CTA or caption change invalidates approval and blocks publication | Phase 2 | NOT APPLICABLE — trigger did not arise in cycle 1 | Trigger (post-G3 change) did not occur; documented handling verified by record inspection | Verified by RunHistory + new G3 DEC + PUB inspection when trigger occurs |
| AC-19 | The published caption is persisted and comparable | Phase 2 | NOT VERIFIED — requires live publication | Requires PUB caption_used + caption-comparison note | Phase 2 DoD; depends on live publication |
| AC-20 | An asset-affecting change requires a new asset file and quality review | Phase 2 | NOT APPLICABLE — no asset replacement | No asset replacement occurred in cycle 1; documented handling verified by inspection | Verified by SCR version + DEC + PUB inspection when trigger occurs |
| AC-21 | Unavailable CTA attribution stays UNKNOWN and causality is not asserted | Phase 1 | Not assessed (no observation data) | N/A — OBS mapping_notes + RPT unknowns inspection | Verified by OBS mapping_notes/open_questions + RPT unknowns + learning class |

Classification Rules Applied:
- Phase 1: Verifiable by inspecting records/evidence files without executing software or achieving live publication
- Phase 2: Requires actual platform publication, observation captures, and full cycle through G5/RPT
- Shared Foundation: Infrastructure, data integrity, ID systems, state transitions that support both phases
- NOT VERIFIED: Status cannot be determined until the required evidence is present; does not mean FAIL
- NOT APPLICABLE: Trigger condition did not arise; documented handling verified by inspection
- Original statuses preserved: no inflation; each AC keeps its original pass/fail/pending classification framework

================================================================
E. Evidence Gap Register for Phase 1/Phase 2 Boundaries
================================================================

| Gap ID | Description | Phase Impact | Required Evidence | Current Status | How to Prove in Next Step |
|--------|-------------|-------------|------------------|----------------|--------------------------|
| G-01 | No cycle 1 experiment executed — no EXP record, no SCR, no asset, no PUB | Phase 1 incomplete | Create experiment: EXP record with hypothesis, success_criteria, budget_thb=0, channel, link_form, program_ref | MISSING — workspace has data/app/state.json with schemaVersion 1, cycle 1, but selectedOpportunityId: null, no EXP record | Create opportunity brief, then EXP record per Doc D §3.3; record G2 DEC |
| G-02 | No opportunity brief selected — data/mission1/ has no OPP record | Phase 1 incomplete | Opportunity brief with niche, audience, problem, candidate_offers, evidence_ids, confidence | MISSING — evidence-log.md has EV-1..EV-10 but no OPP record | Create OPP record per Doc D §3.2 from evidence collected (EV-1..EV-10 documented from public sources) |
| G-03 | No Script or claim_map drafted | Phase 1 incomplete | SCR record with claim_map, disclosure_plan, cta, caption_draft | MISSING — no SCR file in repo | Draft SCR per Doc D §3.4 conforming to content_blueprint; map all claims to evidence_ids |
| G-04 | No content asset produced | Phase 1 incomplete | Asset file in repo + production metadata (tools, AI_use_notes, quota_state) | MISSING — no asset file exists | Produce asset using free/existing tools; record metadata; verify CostBudget.spent_thb_actual == 0 |
| G-05 | No G3 Decision record | Phase 1 incomplete | DEC record for G3 with result APPROVED/REJECTED/APPROVED_WITH_NOTES, rationale, related_ids | MISSING — no DEC records in repo | Record G3 DEC after reviewing asset against content_blueprint and AC-15/AC-16/AC-17 criteria |
| G-06 | No ResultObservation records | Phase 2 gap | ≥3 OBS records with source, method, captured_at, day_offset, evidence_file, values (UNKNOWN allowed) | MISSING — no OBS records | Execute scheduled observations from live publication; capture D+3, D+7, END from dashboards |
| G-07 | No CycleReport | Phase 2 gap | RPT file with pipeline_totals, criteria_outcomes, unknowns, learnings, recommendation, objective_assessment, g5_decision_id | MISSING — no RPT file | Aggregate observations into RPT per Doc D §3.9; record G5 DEC with rationale |
| G-08 | No G5 Decision record | Phase 2 gap | DEC record for G5 with normalized net income, verdict on success criteria, next action (REPEAT/REVISE/STOP) with rationale | MISSING — no DEC records | Record G5 DEC after RPT completion; include normalized net income (M1 − costs) per Doc D §6 |
| G-09 | No run history with gate-coverage | Phase 1 gap | RunHistory entries for each stage with no unexplained gaps, cost record consistent with gates | MISSING — no RunHistory entries | Append RunHistory entries per Doc D §3.11 for each stage action; verify no unexplained gaps |
| G-09a | No cost budget record | Phase 1 gap | CostBudget with planned_thb=0 (default), spent_thb_actual, approvals list | MISSING — no CostBudget in repo | Create CostBudget per Doc D §3.11; default planned_thb=0; update spent_thb_actual with evidence ref when paid |
| G-10 | Aggregation formula for net income not explicitly approved for daily-to-window mapping | Phase 2 gap | Owner-approved formula: 14-day rolling window, daily divisor 14, Net Income_14d = Σ Eligible M1 − Σ Direct Costs, Daily Average_14d = Net Income_14d / 14 | FLAGGED — OQ-8 field semantics verification still required before M1 counts any program-specific figure | Resolve OQ-8: verify program-specific "confirmed/approved/settled" field semantics per Doc D §6 R1–R6; then apply approved formula |
| G-11 | OQ-8 field semantics not verified per program | Phase 2 gap | Per-program dashboard screenshots mapping "confirmed/approved/settled" to verified commission status; or program-terms text mapping | MISSING — no dashboard access or program terms captured | Capture in-dashboard screenshots for chosen program (ACCESSTRADE TH, TikTok TH, Shopee TH); map field semantics per Doc C §3a / Doc H EV-27..31 |
| G-12 | Content blueprint not linked to EXP record | Phase 1 gap | EXP record with content_blueprint block containing all required fields; blueprint approved with experiment at G2 | MISSING — no content_blueprint in EXP record | Add content_blueprint to EXP record per Doc D §3.3 rules; ensure all required fields present; G2 DEC references EXP id |
| G-13 | No evidence of Content Library store/retrieve | Phase 1 gap | Evidence that exported content files can be stored and retrieved through Content Library | NOT ASSESSED — workspace has no Content Library integration | Verify export produces files that can be stored; document store/retrieve procedure |
| G-14 | Pre-G1 boundary not enforced in run history | Phase 1 gap | RunHistory shows no ENROLL/PRODUCE/PUBLISH/spend actions before G1 DEC; no content-program enrollments before G1 | NOT ASSESSED — no G1 DEC recorded, no run history | Record G1 DEC (APPROVED_WITH_NOTES, THB 0, Foundation Slice only); inspect run history for pre-G1 actions |
| G-15 | Decision log lacks DEC records for G2/G3/G5 | Phase 1/2 gap | DEC records: G2 (experiment plan), G3 (content approval), G5 (cycle assessment) | MISSING — data/app/state.json has empty decisions array | Create DEC records per Doc D §3.8: G2 DEC after EXP plan, G3 DEC after asset+blueprint, G5 DEC after RPT |

================================================================
F. Owner Decision List
================================================================

| # | Decision Question | Options | Recommended | Current State |
|---|-------------------|---------|-------------|---------------|
| D-1 | Does the Owner accept the Phase 1 / Phase 2 DoD split as proposed? | Accept / Reject / Request modifications | **Accept** (with review) | PROPOSED — not yet Owner-approved |
| D-2 | Should the original Doc E v1.1 Definition of Done remain intact as the full-cycle DoD, with the Phase 1 amendment as a separate document? | Keep as-is / Merge into Doc E / Delete original | **Keep as-is** | Original preserved per non-overwrite constraint |
| D-3 | For AC-06 (publication recorded with live evidence): is manual external publication by the Owner after Phase 1 export sufficient, or is automated platform publication required for Phase 2? | Manual external = sufficient / Automated required | **Manual external sufficient for Phase 1** (Owner's stated boundary) | Owner confirmed: publication is separate activity from creating/storing Content in Phase 1 |
| D-4 | For AC-18/AC-20 (post-G3 change handling): should the documented inspection-based handling stand, or is additional gate enforcement needed? | Inspection-based handling sufficient / Additional gate enforcement needed | **Inspection-based handling per existing AC-18/AC-20** | Existing AC-18/AC-20 framework applies when trigger occurs |
| D-5 | For AC-08 (Cycle Report) and AC-07 (scheduled observations): what is the minimum observation window required in Phase 2? | D+3 only / D+3/D+7/end / Custom window per Owner | **D+3/D+7/end per Doc E** (original DoD) | Original DoD observation schedule preserved |
| D-6 | For the aggregation formula (G-10): should the Owner-approved 14-day rolling window with divisor 14 stand, or is a different window preferred? | 14-day window (approved) / 7-day window / Custom window | **14-day window per Record G1-B §2b (Owner-approved)** | Owner explicitly approved this formula 2026-10-11 |
| D-7 | Does the Owner want the Phase 1 DoD to explicitly state that AC-18 and AC-20 "apply when their trigger occurs" with documented handling verified by record inspection? | Yes / No | **Yes** — preserves original DoD behavior for when triggers arise | Included in Phase 1 DoD draft per original Doc E v1.1 item 3 |

================================================================
G. Read-only Execution Report
================================================================

Scope of Work Performed (read-only; no files changed, no tests run, no servers started):

1. Git baseline established: mission1-planning-docs branch, HEAD 9749f38e7bdb1ec6ee56be0e2227473c3b973f2b
2. Contract documents read: Doc A (product spec), Doc B (workflow spec), Doc C (system architecture), Doc D (data model), Doc E (vertical slice acceptance/DoD), Doc F (implementation roadmap), Doc G (open questions/decision log), Doc H (evidence register), Doc I (UX/UI design), Doc J (10-step workflow), Doc M (MVP affiliate workflow slice)
3. Git status inspected: 8 modified tracked files in docs/mission1/, 200+ untracked files preserved
4. Original Definition of Done (Doc E v1.1) analyzed in full — requires full cycle through G5/RPT with all AC-01 through AC-21 passing
5. Owner's confirmed Phase 1 boundary identified: Content Creation & Content Library, ending at Export and Content Library store/retrieve; does NOT inherently require integrated automated publication, observation, analysis, or Cycle Report
6. Contract conflict documented: original DoD assumes full cycle through G5/RPT; Owner's Phase 1 boundary ends at Export/Content Library
7. AC-01 through AC-21 mapped to Phase 1 / Phase 2 / Shared Foundation classifications
8. Phase 1 DoD drafted with 12 passing criteria (AC-01, AC-02, AC-03, AC-04, AC-05, AC-09, AC-10, AC-11, AC-13, AC-14, AC-15, AC-16, AC-17, AC-21)
9. Phase 2 DoD drafted with 7 passing criteria (AC-06, AC-07, AC-08, AC-12, AC-18, AC-19, AC-20)
10. Shared Foundation elements identified (evidence handling, ID systems, append-only integrity, state transitions, cost budgeting, CWI system, RunHistory)
11. Evidence Gap Register compiled with 15 gaps (G-01 through G-15), documenting what evidence is missing and how to prove each in the next step
12. Owner Decision List compiled with 7 decisions (D-1 through D-7), all awaiting Owner explicit approval
13. No source code edited, no files modified in repository, no tests run, no servers started, no external accounts connected, no content published, no Phase 1 closure declared
14. All findings preserved as read-only; no amendments written to repo; no decision logs altered

Verification of Stop Condition:
- No files changed in repository ✓
- No tests run ✓
- No servers started ✓
- No external account activity ✓
- No publication ✓
- No VS2 implementation ✓
- No Phase 1 closure declaration ✓
- Report delivered as read-only analysis for Owner review ✓

================================================================
H. Next Steps (require Owner explicit approval)
================================================================

1. Owner reviews and approves the Phase 1 / Phase 2 DoD split (Decision D-1)
2. Owner reviews and approves keeping original Doc E v1.1 intact (Decision D-2)
3. Owner decides on each of D-3 through D-7 as needed for their specific context
4. Upon Owner approval, the following actions can proceed:
   a. Create opportunity brief and EXP record (address G-02, G-01)
   b. Draft SCR with claim_map (address G-03)
   c. Produce content asset with THB 0 spend (address G-04)
   d. Record G3 DEC (address G-05)
   e. Execute observations and create OBS records (address G-06)
   f. Create CycleReport and G5 DEC (address G-07, G-08)
   g. Populate RunHistory and CostBudget (address G-08, G-09a)
   h. Resolve OQ-8 field semantics (address G-11)
   i. Link content_blueprint to EXP record (address G-12)

5. After Owner approval and initial cycle execution, Phase 2 DoD criteria can be verified
6. The original Doc E v1.1 Definition of Done remains as the full-cycle DoD for reference
7. The Phase 1 amendment is PROPOSED pending Owner approval — not self-executing

================================================================
End of Report