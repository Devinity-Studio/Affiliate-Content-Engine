# PR Summary: Documentation Package for Affiliate Content Engine (Slice 1)

**Purpose:** Reconcile existing planning documents (A–H) and produce the smallest coherent set of Markdown documents extending the design specification, without implementing application code, production UI, or integrations.

**Status:** Ready for owner review. Do not merge, deploy, or implement application code.

---

## 1. Files Changed (New Documents)

| Path | Description | Size |
|---|---|---|
| `docs/mission1/I-ux-ui-design-specification.md` | UX/UI Design Specification: persistent left sidebar, workspace per-step, Prev·Edit·Next controls, state preservation, dependency-aware invalidation, gate semantics | 17,064 bytes |
| `docs/mission1/J-ten-step-workflow-specification.md` | Ten-Step Workflow Specification: detailed step-level inputs/outputs/gates/evidence for all 10 steps (Research→Report), with UI behavior per step, dependency invalidation propagation, and appendix of state transitions | 29,866 bytes |
| `docs/mission1/K-research-analyzer-daily-report-loop.md` | Research & Analyzer + Daily Report / Reusable Knowledge Loop: FACT / HYPOTHESIS / UNKNOWN distinction, daily report template, forecasting principles, carry-forward rules, net revenue per clip per day metric | 15,196 bytes |

**No existing files were modified.** All new documents are documentation-only, scope minimal, and additive.

---

## 2. Decisions Made (Proposals Adopted)

| Decision ID | Description | Status |
|---|---|---|
| D-1 (adopted) | File-based system of record (no DB, no dashboard) | ✅ Adopted — reflected in Doc D §1 design principle and all new docs |
| D-2 (adopted) | Gate model G1–G5 + G-pay, default THB 0 budget | ✅ Adopted — workflow state and all step gates respect this model |
| D-3 (adopted) | Manual publishing; no auto-publish in Slice 1 | ✅ Adopted — Doc I §2.3 S8 explicitly prevents auto-publish; all new docs reinforce |
| D-4 (adopted) | Word-of-record discipline: every claim tagged F/I/H/U | ✅ Adopted — all new docs enforce claim class tagging; every numeric value traces to Evidence ID |
| D-5 (adopted, revised) | Net income = **M1 normalized confirmed net commission − direct costs** (Doc D §6), not raw subtraction; reversals deducted once per transaction (R4), pending/rejected never counted (R5), cash tracked separately as M2 (R6) | ✅ Adopted — Doc K §1.1–1.5, Doc J step-level specs, and all pipeline totals use this formula |
| D-6 (adopted) | Preferred program order: ACCESSTRADE TH → TikTok Shop (if eligible) → Shopee direct | ✅ Adopted — reflected in Doc K §3.4 carry-forward rules and Doc J step dependencies |
| D-7 (adopted) | Observations at D+3/D+7/end (min) | ✅ Adopted — Doc J §9.4, Doc K §2.7, and all three new docs use this schedule |
| G1-A/B/C/D/E (owner-approved, carried forward) | Pre-G1 policy, measurement window, operating timeline, continuous optimization principle | ✅ Carried forward — all new docs are consistent with Records G1-A through G1-E (2026-10-11) |
| §2b (Owner-approved Measurement Formula) | 14-day rolling window, daily divisor 14, `Net Income_14d = Σ Eligible M1 − Σ Direct Costs`, `Daily Average_14d = Net Income_14d / 14` | ✅ Carried forward — all new docs use this formula for objective assessment |

---

## 3. Unresolved Questions (Carried Forward from Doc G)

| # | Question | Impact | Status |
|---|---|---|---|
| OQ-1 | Objective-measurement window definition | Affects S9/S10 verdict "achieved/not yet measurable" | Resolved per G1-B/§2b (14-day trailing window) |
| OQ-2 | Commission-lag reality | Affects M1/M2 timing in daily reports and 14-day window | Operator action — requires dashboard observation in Phase 1/2 |
| OQ-3 | Per-campaign commission terms | Affects M1 computation and pipeline totals | Operator action — requires dashboard screenshot in Phase 1/2 |
| OQ-4 | Channel eligibility reality | Affects S8 link form selector options and S4–S6 tool choices | Operator action — verified in-app during Phase 1 |
| OQ-5 | Thailand direct-marketing license threshold | Deferred; Slice-1 income far below THB 1.8M/yr trigger | No UI impact at this scope |
| OQ-6 | Budget > 0 appetite / G-pay thresholds | Affects S2 budget field and S4/S5/S6 quota exhaustion behavior | Default THB 0; explicit G-pay required for any future spend |
| OQ-7 | Which niche? | Affects S1 candidate brief display and downstream step population | Evidence-backed decision at G2; carried forward as learnings |

**Note:** OQ-1 was resolved by Record G1-B (2026-10-11): 14-day trailing window for THB 1,000/day assessment. Remaining OQs require operator/action owner input during Phase 1/2.

---

## 4. Verification Performed

### 4.1 Acceptance Criteria Mapping

All AC-01 through AC-14 from Doc E vertical slice acceptance criteria are supported by the new documents:

| AC ID | Description | Supported By |
|---|---|---|
| AC-01 | Market scout produces source-backed shortlist | Doc J §1 (S1) + Doc K (Evidence register) |
| AC-02 | Experiment plan pre-registered and gated | Doc J §2 (S2) + G2 gate semantics |
| AC-03 | Script maps every claim to evidence | Doc J §3 (S3) + claim map specs |
| AC-04 | Content asset produced with THB 0 spend and quota discipline | Doc J §4 (S4) + cost guardrail |
| AC-05 | G3 content approval precedes any publication attempt | Doc J §6 (S6) + gate enforcement |
| AC-06 | Publication recorded with live evidence | Doc J §8 (S8) + publication record |
| AC-07 | Scheduled observations captured from real dashboards | Doc J §9 (S9) + OBS record specs |
| AC-08 | Cycle report is evidence-traceable and drives a decision | Doc J §10 (S10) + CycleReport schema + Doc K (learning loop) |
| AC-09 | Quota exhaustion halts, does not pay | Doc I §2.4 (PAUSED_QUOTA) + Doc J failure paths |
| AC-10 | Gate enforcement blocks unauthorized publication | Doc I gate semantics + Doc J step gates |
| AC-11 | Unverifiable claim is downgraded, not used | Doc K §2.3 classification rules |
| AC-12 | Missed observation window degrades gracefully | Doc J §9.7 failure/recovery + OBS open_questions |
| AC-13 | Budget overrun is impossible without a gate | Doc J cost guardrails + Doc I budget checks |
| AC-14 | Value integrity holds under correction | Doc J §10.7 (append-only OBS + correction annotation) + Doc K §2.5 |

### 4.2 No Duplicate Source of Truth

- **Evidence register (Doc H):** All external program/platform facts trace here; new docs reference EV-xx IDs where load-bearing.
- **Data model (Doc D):** All entity definitions (Evidence, Experiment, Script, Publication, ResultObservation, CycleReport, WorkflowState) are the single source of truth for field schemas.
- **Acceptance contract (Doc E):** All acceptance criteria, the `acceptance_status` vocabulary (Doc E §0.1), the assessment-method and evidence-dependency rules (Doc E §0.2), the source-of-truth and authority rules (Doc E §0.3) and the Definition of Done (Doc E §4) are the single source of truth for acceptance. No other document defines or overrides them.
- **Workflow state (Doc B §2 + Doc D §3.10):** Single source of truth for current stage, status, pending action. New Docs I/J/K only read/describe this state; they do not redefine it.
- **Gate model (Doc A §7 + Doc B §2):** Single source of truth for G1–G5, G-pay. New docs enforce these gates; no new gates introduced.
- **No document duplicates another:** Each new doc covers a distinct concern (UI/UX, step-level workflow, learning loop) with non-overlapping scope.

### 4.2b Source-of-truth layers and conflict handling (DEC-1-6, 2026-10-30)

Three layers, each with a distinct owner. A layer never substitutes for another:

| Layer | Owner | What it establishes | What it does not do |
|---|---|---|---|
| **Normative contract** | Doc E (acceptance criteria + acceptance status), Doc D (entity schemas), Doc A §7 + Doc B §2 (gates), Doc H (external program facts) | The operative text — what the rules are | It does not record what was observed |
| **Verification result** | `verification/*`, `data/mission1/e2e-log.md` | Observations and assessments, with the evidence actually inspected | It never carries an `acceptance_status`, never amends the contract, and never authorizes a Gate |
| **Owner decision** | `data/mission1/decision-log.md` (schema Doc D §3.8) | That the Owner decided something, its scope, and its effective date | It does not substitute for missing normative text and must not be read as contract text |

Conflict handling (no deletion of history):

1. If a decision is approved but the corresponding normative documents have not been amended, the affected requirement is marked **`UPDATE PENDING`** and is not assessed under the proposed new wording.
2. When normative text is amended, it cites the Decision ID and marks the superseded text `SUPERSEDED by DEC-<id>`; historical content is never deleted or silently rewritten.
3. Where two normative documents disagree and no Owner decision resolves it, the affected item stays `NOT_VERIFIED` and is escalated to the Owner.
4. Evidence coverage (Gap Matrix, RTM), acceptance status (`acceptance_status`), and normative requirement status (in force / `UPDATE PENDING` / `SUPERSEDED`) are three separate dimensions and must not be conflated — see Doc E §0.4.

### 4.3 Consistency Checks Performed

1. **Doc B §2 (Stage 1–10) ↔ Doc J (Step 1–10):** Each stage maps to its corresponding step. All stage acceptance criteria are reflected in step acceptance criteria. No stage-step mapping gaps.
2. **Doc D (Data Model) ↔ Doc J/K:** All entity fields referenced in new docs match Doc D definitions. WorkflowState field `current_stage` enum S1..S10 is shared. ResultObservation `mapped` field matches M1/M2 computation in Doc D §6.
3. **Doc A (Constraints & Gates) ↔ New Docs:** All gate semantics (G1–G5, G-pay, PAUSED_QUOTA, HALTED_FAILURE) are respected. No new gates that bypass existing ones.
4. **Doc F (Operating Principles) ↔ New Docs:** Continuous optimization loop (Observe→Analyze→Diagnose→Adapt→Measure→Reconcile→Repeat) is implemented in Doc K §3.1. Timeline flexibility (Weeks 1–4 are planning horizons) is in Doc K §1.1. Sustainable income objective is in Doc K §1.4–1.5.
5. **Doc G (Open Questions/Decision Log) ↔ New Docs:** All OQs carried forward; none resolved (or over-resolved) by new docs. OQ-1 resolution (14-day window) is documented and consistent.

---

## 5. Evidence Gaps (Open Questions Requiring Owner Action)

| Gap | Required Action | When Needed |
|---|---|---|
| OQ-2: Commission-lag reality | Capture dashboard screenshots of a real order's status timeline; verify how long from order → validation-completed commission in chosen program | Phase 1 (before S8 observations) |
| OQ-3: Per-campaign commission terms | Log actual commission rates/cookies for the chosen offer from dashboard | Phase 1 (before S9 M1 computation) |
| OQ-4: Channel eligibility reality | Verify operator's follower counts/account states per platform; TikTok profile-link gate; Meta native affiliate availability | Phase 1 (before S3 link_form pinning, S8 publish) |
| OQ-6: Budget > 0 appetite | Owner decides G-pay thresholds for any future paid tools/advertising | At any future phase; default remains THB 0 |

**All other OQs are either resolved (OQ-1) or deferred (OQ-5) without UI impact at Slice 1 scope.**

---

## 6. Out of Scope (Reaffirmed)

- Application code, production UI, database migrations
- Marketplace/API integrations (ACCESSTRADE API, TikTok Shop API, etc.)
- Automated publishing or API posting
- Paid-ad analysis features or any spending without explicit G-pay approval
- New subscription costs or paid services
- Multi-user SaaS build or multi-agent orchestration
- Advanced forecasting models before enough own-data exists
- Full multi-channel orchestration or simultaneous experiments

---

## 7. Verification Checklist (Completed)

- [x] Existing documents reconciled; no duplicate or conflicting source of truth
- [x] Clear distinction between decided requirements, proposals, assumptions, and open questions
- [x] Each step has explicit inputs, outputs, gates, and evidence
- [x] UI behavior and Prev · Edit · Next semantics are unambiguous
- [x] Reports feed learning back into Research & Analyzer, while forecasts retain uncertainty
- [x] Net income and sustainability remain the guiding metrics (M1 − costs, THB/clip/day)
- [x] Links/anchors and terminology checked against existing docs (A–H)
- [x] Diff is documentation-only; scope is minimal (3 new files, 0 modified existing files)
- [x] PR summary includes files changed, decisions made, unresolved questions, verification performed, and evidence gaps

---

**Prepared by:** Codebuff (Buffy)  
**Date:** 2026-10-16  
**Next:** Owner review. After approval, Phase 1 (Foundation & Access) can begin per Doc F §1.

---