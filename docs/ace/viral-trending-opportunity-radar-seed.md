# ACE Seed 02: Viral & Trending Opportunity Radar

**Status:** OWNER-PROPOSED SEED · PENDING OWNER REVIEW · NOT APPROVED FOR IMPLEMENTATION  
**Type:** Research Intelligence / Opportunity Detection / Fast-Track Approval  
**Scope:** Concept for finding/time-limited opportunities. Not an approved requirement for development.

## 1. Concept and goals

Enhance ACE Research to detect affiliate products/opportunities gaining unusual traction intraday—especially those standing out relative to peers at the same time.

Goal: help the Owner decide quickly on short-lived opportunities without waiting for the regular Research cycle or daily report.

## 2. Modes of operation

**A. Continuous Research**  
Search and evaluate opportunities per normal workflow, collect evidence, prioritize.

**B. Viral & Trending Radar**  
Monitor intraday changes, detect anomalies/outlier growth, and trigger urgent alerts when thresholds are met.

Both modes must share evidence and evaluation rules that are auditable/reversible.

## 3. Signal types

**Platform Signals**
- Platform rankings/popularity
- Sales/order metrics if accessible and verifiable
- Affiliate data and offer readiness
- Intraday metric changes

**External Viral Signals**
- Social trends/viral clips
- Search trends
- Mentions/growth of interest in communities
- External sources with verifiable provenance/time

Keep signal type, source, time detected, and metrics separate to avoid comparing different units directly.

## 4. Detection/evaluation principles

Evaluate using (not just totals):
- **Growth Rate:** vs prior window
- **Relative Performance:** vs appropriate peer/group
- **Velocity:** speed and continuity of growth
- **Signal Quality:** credibility, freshness, data limits
- **Commercial Readiness:** product/offer/affiliate conditions
- **Risk & Feasibility:** risk/cost/time/feasibility

Thresholds/formulas to be determined from real data, not arbitrary fixed numbers.

## 5. Fast-Track Approval

If a signal is significant and passes initial checks:
1. Record signal + evidence
2. Verify credibility/fit
3. Create a scoped experimental project draft with clear success criteria
4. Send summary via IM Messenger for Owner review
5. Record decision in ACE
6. Only start work if approved and conditions met
7. Track real outcomes (clicks/orders/commission) when available

Fast-track means faster review/decision, not skipping evidence or approval.

## 6. Output structure

Draft project should include:
- Opportunity ID and detection time
- Product/affiliate offer
- Sources/evidence
- Growth metrics and comparison window
- Rationale for urgency
- Hypotheses/unknowns
- Experimental content plan/target
- Cost/resources
- Risks/success criteria
- Status/history of consideration/decisions

## 7. Statuses and alerts

Proposed statuses (must reconcile with ACE State Model):
- `DETECTED`
- `NEEDS_MORE_EVIDENCE`
- `EVALUATING`
- `DRAFT_READY`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `MONITORING`
- `EXPIRED`

## 8. Safeguards

- Prevent duplicate alerts for same opportunity
- Adjust urgency based on new data/time remaining
- Views/shares ≠ proof of sales
- Don't guarantee/predict revenue
- Don't create invest-ready projects without sufficient evidence
- No auto-approval/auto-publish from trends
- Retain decision data for audit

## 9. Relationship to IM Messenger

Radar produces opportunities; IM Messenger is notification/approval channel. ACE remains source of truth for projects/status/decisions.

## 10. Future evaluation criteria

Before development: verify data sources/frequency/access/cost/backtesting capability; define testable evaluation criteria. Success = timely detection with suitable evidence, convenient Owner decision, and measurable outcomes for approved projects.

## 11. Approval and implementation status

- Storing this seed does not approve system changes.
- Does not change acceptance criteria or imply Mission 1 Definition of Done is met.
- Status: `SEED` — concept for future consideration only.
- Relationship: `Viral & Trending Radar → Opportunity Evaluation → Project Draft → IM Messenger → Owner Approval → ACE Execution Workflow` (conceptual; must not bypass existing ACE gates)
