# G. Open Questions & Decision Log — Affiliate Content Engine

Status: DRAFT FOR OWNER APPROVAL · Version 1.1 (reconciled) · 2026-10-11

**Consistency note:** Doc F Phase 1 is research-first (non-binding public research may run pre-G1) BUT program enrollments/build/preparation are operational execution requiring G1 approval; Doc F cross-references Doc A §7 for this boundary.

## 1. Open questions that materially affect feasibility

| # | Question | Why it matters | Evidence needed to resolve | Cheapest safe resolution | Owner input needed? |
|---|---|---|---|---|---|
| OQ-1 | **Objective-measurement window.** What window defines "repeatable THB 1,000/day"? (e.g., trailing 14 days of M1-based net income? 30? 90?) | Determines when the objective can honestly be judged; too short rewards luck, too long delays learning. | Owner's risk tolerance + commission-lag reality of chosen program + OQ-8 field verification. | Propose: judge via trailing 14-day **M1-based** net income (Doc D §6) after 60 days of operation. | **Yes** |
| OQ-2 | **Commission-lag reality.** How long from order → validation-completed commission in the chosen program? | Normalized metrics and "repeatable" concept depend on it; also cash-flow reality. | Screenshots of a real order's status timeline in-dashboard. | Run a live experiment and actually watch one order reach status-beyond-validation. | No |
| OQ-8 | **Field semantics per program.** Does each program's "confirmed/approved/settled" figure already net refunds/cancellations? (Doc C §3a / H EV-27..31: ACCESSTRADE Approved/Confirmed are distinct validation-vs-payment stages; TikTok TH settled commissions already apply (revenue − refunds) × rate; Shopee TH dashboard-to-terms mapping undocumented) | Net-income math would double-count reversals without this. Prevents subtracting the same refund twice (Doc D §6 R4). | Per program: dashboard screenshots of a refunded order's status/timeline, or program-terms text mapping fields. | Operator captures in Phase 1/2 before any M1 computation. | Operator action |
| OQ-3 | **Per-campaign commission terms.** Actual commission rates/cookies for the chosen offer, visible only in-dashboard. | Core arithmetic of the hypothesis. | Logged-in dashboard screenshot. | Apply/join programs in Phase 1 then read the dashboard. | Operator action |
| OQ-4 | **Channel eligibility reality.** Operator's actual follower counts / account states per platform; TikTok profile-link gate; Meta native affiliate availability for this account. | Determines publishable link forms; changes script's CTA design. | In-app eligibility screens (screenshots). | Check each platform's account status in Phase 1. | Operator action |
| OQ-5 | **Thailand direct-marketing license trigger.** OCPB's THB 1.8M/yr warning applies at what size for a Thai-resident affiliate creator? | Compliance risk if objective is met and business grows. | Written OCPB guidance or Thai counsel. | Defer (Slice-1 income is far below threshold); revisit at Phase 4 if income grows. | Yes, at scale |
| OQ-6 | **Budget > 0 appetite.** If a future experiment justifies paid tools/ads, what's the owner's approval process? | Sets G-pay thresholds; nothing is auto-approved. | Owner decision. | Keep default THB 0; require explicit written G-pay per proposal. | **Yes** |
| OQ-7 | **Which niche?** Operator's selection among candidates (from market scout). | Content credibility and audience fit. | Evidence-backed briefs from Stage 1. | AI drafts candidates; operator selects. | **Yes** |

## 2. Decisions that can safely be made now (proposals)

| # | Decision | Rationale | Status |
|---|---|---|---|
| D-1 | File-based system of record (no DB, no dashboard) | NFR-1 simplicity; one-operator scale; zero cost. | Proposal — adopt on plan approval |
| D-2 | Gate model G1–G5 + G-pay, default THB 0 budget | Matches "consequential decisions + no silent spend" constraint. | Proposal |
| D-3 | Manual publishing; no auto-publish in Slice 1 | No verified publishing API; manual evidence is stronger. | Proposal |
| D-4 | Word-of-record discipline: every claim tagged F/I/H/U | Mission requirement; non-negotiable. | Proposal — adopt on plan approval |
| D-5 (revised) | Net income = **M1 normalized confirmed net commission − direct costs** (Doc D §6), not a raw "confirmed − refunds" subtraction; reversals are deducted once per transaction (R4), pending/rejected never counted (R5), cash tracked separately as M2 (R6) | Conservative; avoids double-counting reversals and treating settled commission as cash. | Proposal — pending OQ-1 window and OQ-8 field verification |
| D-6 | Preferred program order: ACCESSTRADE TH → TikTok Shop (if eligible) → Shopee direct (terms known only in-dashboard) → deprioritized: ClickBank, Amazon | Research: local payout/regulatory fit + evidence availability. | Proposal; Phase 1 verifies |
| D-7 | Observations at D+3/D+7/end (min) | Sufficient for a first slice; cheap; consistent with pending→confirmed lag investigation. | Proposal — adopt on plan approval |

## 3. Decisions requiring owner input

- **OQ-1:** objective measurement window.
- **OQ-6:** policy for any future paid tool (even if not now).
- **OQ-5/risk:** threshold for seeking Thai legal/tax counsel as income grows.
- **G1 (approving this plan), G2 (the specific niche/offer/experiment), G-pay (any future spend).**

## 4. Recommended experiment order (rationale)

1. **Cycle 1 — "cheap, boring, local" experiment.** One niche where the operator has some credibility, one product on ACCESSTRADE TH (Thailand-local payout, evidence-friendly dashboards, commission in THB), published on a non-follower-gated channel (e.g., FB Page + profile link, or TikTok organic without Shop tagging if gate not met). Rationale: minimizes eligibility unknowns (OQ-2,3,4) and produces real commission-lag data even if engagement is weak.
2. **Future cycles** (approval-gated): introduce TikTok Shop tagging and short-video-first formats; then evaluate whether a second simultaneous offer or paid tools are justified by cycle data.

## 5. How future features get considered

Everything not approved now lives in Doc F §7 (Future Considerations — Not Approved for Implementation). Nothing moves from there into active scope without a new owner decision recorded as a Decision record.
