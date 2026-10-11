# G. Open Questions & Decision Log — Affiliate Content Engine

Status: Owner G1 direction approved (Record G1-A/B, 2026-10-11); full-plan adoption at G1 remains owner's open item · Version 1.2 · 2026-10-11

**Consistency note:** Doc F Phase 1 is research-first (non-binding public research may run pre-G1) BUT program enrollments/build/preparation are operational execution requiring G1 approval; Doc F cross-references Doc A §7 for this boundary.

## 1. Open questions that materially affect feasibility

| # | Question | Why it matters | Evidence needed to resolve | Cheapest safe resolution | Owner input needed? |
|---|---|---|---|---|---|
| OQ-1 | **Objective-measurement window.** What window defines "repeatable THB 1,000/day"? (e.g., trailing 14 days of M1-based net income? 30? 90?) | Determines when the objective can honestly be judged; too short rewards luck, too long delays learning. | Owner's risk tolerance + commission-lag reality of chosen program + OQ-8 field verification. | **RESOLVED by Owner (see Record G1-B below).** Capture M1/M2/costs daily from experiment start; evaluate sustained performance on a trailing 14-day window once sufficient data exists; no day-60 wait required. | Resolved 2026-10-11 |
| OQ-2 | **Commission-lag reality.** How long from order → validation-completed commission in the chosen program? | Normalized metrics and "repeatable" concept depend on it; also cash-flow reality. | Screenshots of a real order's status timeline in-dashboard. | Run a live experiment and actually watch one order reach status-beyond-validation. | No |
| OQ-8 | **Field semantics per program.** Does each program's "confirmed/approved/settled" figure already net refunds/cancellations? (Doc C §3a / H EV-27..31: ACCESSTRADE Approved/Confirmed are distinct validation-vs-payment stages; TikTok TH settled commissions already apply (revenue − refunds) × rate; Shopee TH dashboard-to-terms mapping undocumented) | Net-income math would double-count reversals without this. Prevents subtracting the same refund twice (Doc D §6 R4). | Per program: dashboard screenshots of a refunded order's status/timeline, or program-terms text mapping fields. | Operator captures in Phase 1/2 before any M1 computation. | Operator action |
| OQ-3 | **Per-campaign commission terms.** Actual commission rates/cookies for the chosen offer, visible only in-dashboard. | Core arithmetic of the hypothesis. | Logged-in dashboard screenshot. | Apply/join programs in Phase 1 then read the dashboard. | Operator action |
| OQ-4 | **Channel eligibility reality.** Operator's actual follower counts / account states per platform; TikTok profile-link gate; Meta native affiliate availability for this account. | Determines publishable link forms; changes script's CTA design. | In-app eligibility screens (screenshots). | Check each platform's account status in Phase 1. | Operator action |
| OQ-5 | **Thailand direct-marketing license trigger.** OCPB's THB 1.8M/yr warning applies at what size for a Thai-resident affiliate creator? | Compliance risk if objective is met and business grows. | Written OCPB guidance or Thai counsel. | Defer (Slice-1 income is far below threshold); revisit at Phase 4 if income grows. | Yes, at scale |
| OQ-6 | **Budget > 0 appetite.** If a future experiment justifies paid tools/ads, what's the owner's approval process? | Sets G-pay thresholds; nothing is auto-approved. | Owner decision. | Keep default THB 0; require explicit written G-pay per proposal. | **Yes** |
| OQ-7 | **Which niche?** Operator's selection among candidates (from market scout). | Content credibility and audience fit. | Evidence-backed briefs from Stage 1. | AI drafts candidates; operator selects. | **Yes** |

## 2. Decisions that can safely be made now (proposals; D-1..D-7 remain PROPOSALS — §2a records the Owner-approved subset only)

| # | Decision | Rationale | Status |
|---|---|---|---|
| D-1 | File-based system of record (no DB, no dashboard) | NFR-1 simplicity; one-operator scale; zero cost. | Proposal — adopt on plan approval |
| D-2 | Gate model G1–G5 + G-pay, default THB 0 budget | Matches "consequential decisions + no silent spend" constraint. | Proposal |
| D-3 | Manual publishing; no auto-publish in Slice 1 | No verified publishing API; manual evidence is stronger. | Proposal |
| D-4 | Word-of-record discipline: every claim tagged F/I/H/U | Mission requirement; non-negotiable. | Proposal — adopt on plan approval |
| D-5 (revised) | Net income = **M1 normalized confirmed net commission − direct costs** (Doc D §6), not a raw "confirmed − refunds" subtraction; reversals are deducted once per transaction (R4), pending/rejected never counted (R5), cash tracked separately as M2 (R6) | Conservative; avoids double-counting reversals and treating settled commission as cash. | Proposal — pending OQ-1 window and OQ-8 field verification |
| D-6 | Preferred program order: ACCESSTRADE TH → TikTok Shop (if eligible) → Shopee direct (terms known only in-dashboard) → deprioritized: ClickBank, Amazon | Research: local payout/regulatory fit + evidence availability. | Proposal; Phase 1 verifies |
| D-7 | Observations at D+3/D+7/end (min) | Sufficient for a first slice; cheap; consistent with pending→confirmed lag investigation. | Proposal — adopt on plan approval |

## 2a. Owner-Approved Decision Records (2026-10-11)

> Recorded verbatim per Owner authorization in conversation; no fabrication of ID/date/evidence beyond what was authorized. These records change the approval status only of the items below; they do **not** alter any other document's rule set, nor G2/G3/G4/G5/G-pay, THB 0 defaults, or Doc D §6 accounting rules.

**Record G1-A — G1 direction + Pre-G1 policy CONFIRMED.**
- **Status:** APPROVED.
- **Content:** G1 direction confirmed as designed; Pre-G1 restrictions confirmed:
  - Before G1: only non-binding planning and public-source research using existing/free tools.
  - No account creation or changes, affiliate-program enrollment, final content production, publication, spending, or irreversible/account-affecting actions before the applicable authorization.
  - G1 approval does **not** bypass G2, G3, G4, G5, or G-pay.
- **Rationale:** as previously reasoned in Docs A/B/E/F — the pre-G1 boundary allows valuable free research while preserving all consequential-decision gates.
- **Evidence:** Owner conversation (this session); documented as the textual decision record itself, no external artifact claimed.

**Record G1-B — OQ-1 measurement approach APPROVED.**
- **Status:** APPROVED.
- **Content:**
  1. Capture M1, M2, direct costs, and supporting evidence from the beginning of the experiment.
  2. Report these measures daily when data is available.
  3. Use a **trailing 14-day window** to evaluate sustained performance once sufficient data exists; do **not** require waiting until day 60 to begin evaluating early evidence.
  4. Keep M1 and M2 distinct: M1 = normalized confirmed net commission under verified program-specific rules (Doc D §6); M2 = actual cash received, supported by payout evidence or bank credit, less applicable transfer costs.
  5. Do not count pending, rejected, or semantically unverified commissions as confirmed net commission.
  6. Preserve the distinction between measured commission performance and actual cash flow.
- **Rationale:** enables early signal without sacrificing rigor; aligns with D-5 and Doc D §6 R4/R5 (no double-subtraction, no pending-as-confirmed).
- **Aggregation ambiguity (flagged, per authorization):** Doc D §6 defines M1/M2 and net = M1 − costs but does **not** specify the exact daily-to-window aggregation formula (e.g., sum-of-daily-net vs. sum-of-window-M1 minus sum-of-window-costs, and whether to average per-day or divide by elapsed days). **Flagged as OPEN, not silently invented**; owner/operator to settle at G2 or in first CycleReport. All other accounting rules (R1–R6) unchanged.
- **Evidence-gating note:** OQ-8 field-semantics verification still required before M1 counts any program-specific figure.

**Record G1-C — OQ-5 / OQ-6 / OQ-7 remain UNRESOLVED.**
- **OQ-5:** legal/tax advice trigger remains deferred as written.
- **OQ-6:** THB 0 default budget and explicit G-pay approval remain in force; future thresholds unresolved.
- **OQ-7:** niche selection remains a later evidence-backed decision for G2.

## 3. Decisions requiring owner input

- **OQ-1:** RESOLVED by Record G1-B (trailing-14-day approach approved); see §2a for the flagged aggregation ambiguity.
- **OQ-6:** policy for any future paid tool (even if not now) — still unresolved per Record G1-C.
- **OQ-5/risk:** threshold for seeking Thai legal/tax counsel as income grows.
- **G1 (approving this plan), G2 (the specific niche/offer/experiment), G-pay (any future spend).**

## 4. Recommended experiment order (rationale)

1. **Cycle 1 — "cheap, boring, local" experiment.** One niche where the operator has some credibility, one product on ACCESSTRADE TH (Thailand-local payout, evidence-friendly dashboards, commission in THB), published on a non-follower-gated channel (e.g., FB Page + profile link, or TikTok organic without Shop tagging if gate not met). Rationale: minimizes eligibility unknowns (OQ-2,3,4) and produces real commission-lag data even if engagement is weak.
2. **Future cycles** (approval-gated): introduce TikTok Shop tagging and short-video-first formats; then evaluate whether a second simultaneous offer or paid tools are justified by cycle data.

## 5. How future features get considered

Everything not approved now lives in Doc F §7 (Future Considerations — Not Approved for Implementation). Nothing moves from there into active scope without a new owner decision recorded as a Decision record.
