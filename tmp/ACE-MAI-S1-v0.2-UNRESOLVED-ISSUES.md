# ACE-MAI-S1 — Phase A Preparation Plan — Unresolved Issues and Assumptions Register

> LEGACY — SUPERSEDED — RETAINED FOR TRACEABILITY

This file is an earlier corrective-only version of the unresolved-issues register prepared before the Owner Decision Integration pass.

It is retained for traceability only. The current integrated version is:
`tmp/ACE-MAI-S1-v0.2-UNRESOLVED-ISSUES-UPDATED.md`

Do not use this file as the current state of record for Owner questions, unresolved issues, or assumptions.

**Associated documents:**  
- `tmp/ACE-MAI-S1-v0.2-SEPARATE-DELIVERABLES.md`  
- `tmp/ACE-MAI-S1-v0.2-CHANGE-LOG.md`

**Working baseline:** v0.1 (Draft)  
**Target revision:** v0.2 (Draft)  
**Status:** Proposed — Pending Owner Review

---

## 1. Unresolved issues

| ID | Issue | Type | Why unresolved | Required treatment |
|---|---|---|---|---|
| UI-01 | Version discrepancy between “Owner-approved v1.1” in the task brief and the v0.1 file in the workspace | Governance / version control | No separately identifiable Owner-approved v1.1 copy was found in the inspected workspace | Owner clarification on whether v0.1 remains the working baseline or a separate v1.1 source exists |
| UI-02 | Gemini Independent Reviewer not yet confirmed | Roles and responsibilities | Role is proposed only in v0.2, subject to Owner confirmation | Owner confirmation, replacement, or deferral |
| UI-03 | Dashboard conclusion is structural/UI-level only | Evidence scope | Dashboard evidence supports structural/UI observation, not Affiliate revenue, commission realization, shop-level revenue, or settlement | Keep conclusion as proposed/limited until real revenue/settlement evidence is available |
| UI-04 | Source Library entry labelled with Shopee affiliate dashboard language may be a UI concept rather than a verified live integration | Evidence scope | The reviewed artifact shows the entry; what it represents in practice is not verified here | Clarify in later review whether it represents a real integration posture or a UI placeholder |
| UI-05 | Schema mapping is provisional | Evidence scope | v0.1 states mapping remains provisional; real-export confirmation is required for completeness | Continue to label provisional until confirmed with real data |
| UI-06 | Lifecycle/runtime enforcement is not independently verified | Evidence scope | v0.1 states runtime enforcement has not been independently verified | Continue to label as limitation until evidence changes |
| UI-07 | Real revenue and settlement validation are deferred | Evidence scope | No real revenue/settlement evidence is available for this preparation pass | Continue to defer; do not upgrade conclusion |
| UI-08 | Evidence register still depends on artifact identity for the dashboard excerpt that is not independently supplied in this package | Evidence traceability | The v0.2 evidence register identifies the dashboard evidence as a reviewed dashboard/UI artifact with a 2026-11-07 extraction date, but the artifact’s independent hash or identity was not supplied in this package | If stronger traceability is wanted, supply the artifact identity or hash; do not invent one here |

---

## 2. Open assumptions

| ID | Assumption | Current treatment | Condition to change |
|---|---|---|---|
| OA-01 | Some empty-file handling paths may produce NaN in some calculations | Labelled limitation | Evidence of a specific handling behavior |
| OA-02 | Conversion Report schema mapping remains provisional | Labelled provisional | Real-export confirmation |
| OA-03 | Lifecycle testing validates logic only, not an implemented real state machine | Labelled limitation | Evidence of implementation-level verification, if any |
| OA-04 | Revenue-state testing uses mock data, not actual settlement evidence | Labelled limitation | Real settlement evidence, if any is available and appropriate |
| OA-05 | Runtime enforcement has not been independently verified | Labelled limitation | Independent verification evidence, if any |
| OA-06 | v0.1 draft is the working baseline for v0.2 | Adopted for this revision | Owner clarification if a different baseline is intended |
| OA-07 | WS-03 may begin provisionally in parallel with WS-02, but should not be accepted before the WS-02 mapping inputs it relies on are available or explicitly recorded as unavailable | Adopted for dependency consistency | Owner guidance on whether that should be tightened for any later phase |

---

## 3. Owner questions carried forward from v0.1, with the Section 9.2/Question 1 correction applied

1. Does the Owner accept the proposed boundary between Plan Preparation and Phase A Preparation Activities as defined in Section 2.1, and does the Owner accept its implications, including that approval of this plan does not automatically authorize Phase A activities?
2. What is the exact boundary between Phase A preparation and any later proposed execution phase?
3. Are there any specific dashboard fields, filters, or download behaviors the Owner wants reviewed in more detail during Phase A?
4. What level of schema-mapping confirmation is acceptable at the preparation stage before any later phase proposes execution?
5. How should the NaN-related limitation be handled if and when empty-file paths are encountered in real data?
6. What evidence would be required for the Owner to consider lifecycle/runtime enforcement claims reviewable beyond the current preparation posture?
7. Are there any Owner-defined stop conditions beyond the ones listed here?
8. Should any later proposed execution phase be gated by separate approval, evidence, or cost review?
9. Should Gemini be confirmed as the proposed Independent Reviewer, or replaced, or deferred?
10. Is the version discrepancy between “Owner-approved v1.1” in the task brief and the v0.1 file in the workspace resolvable, or should v0.1 remain the working baseline until that is clarified?
11. Are there any specific assumptions the Owner wants removed, tightened, or confirmed before approving a next phase?

---

## 4. Owner questions added by the targeted correction

1. Does the Owner accept the WS-02/WS-03 dependency reconciliation in the dependency structure, specifically that WS-03 may begin provisionally in parallel with WS-02 but should not be completed or accepted before the WS-02 mapping inputs it relies on are available or explicitly recorded as unavailable?
2. Does the Owner accept that a data-quality issue is not automatically an authorization-boundary breach unless the facts support that classification?
3. Does the Owner accept the proposed Phase A exit criteria in Section 9.2, including the requirement that WS-01 through WS-07 outputs be delivered, acceptance results checked or exceptions recorded, the Evidence Register updated on actual work evidence, and unresolved items given a clear status?

---

## 5. Items that are NOT resolved by v0.2

- v0.2 does not establish that an Owner-approved v1.1 baseline exists.
- v0.2 does not establish an independent reviewer engagement.
- v0.2 does not upgrade the dashboard conclusion beyond structural/UI observation.
- v0.2 does not authorize Phase A activities.

---

## 6. Files retained for traceability

- This file is `tmp/ACE-MAI-S1-v0.2-UNRESOLVED-ISSUES.md`, marked `LEGACY — SUPERSEDED — RETAINED FOR TRACEABILITY`.
- The current integrated version is `tmp/ACE-MAI-S1-v0.2-UNRESOLVED-ISSUES-UPDATED.md`, marked `CURRENT INTEGRATED VERSION`.
- v0.2 does not authorize execution, implementation, deployment, data creation, external contact, API use, spend, repository modification, or governance-ledger modification.
- v0.2 does not decide whether a later Phase A activity should be gated by WS-02 mapping completeness or WS-01 dashboard completeness; that is left for Owner guidance.
