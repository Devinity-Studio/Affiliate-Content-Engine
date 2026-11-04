# D. Data Model Specification — Affiliate Content Engine (Slice 1)

Status: DRAFT FOR OWNER APPROVAL · Version 1.1 (reconciled) · 2026-10-11

## 1. Design principle

Minimum viable schema = the plain files needed for one complete experiment cycle, human-readable, no database. Everything is keyed by cycle IDs so later cycles can be analyzed without schema migration. Future extensions (Doc §7) are additive.

## 2. Core entity overview

```
Cycle (experiment cycle)
 ├─ 1..*  Evidence ────────────── source, url, retrieved_at, finding, class
 ├─ 1..*  Opportunity (brief) ─── niche, audience, offers, confidence
 ├─ 1      Experiment ─────────── hypothesis, offer, channel, criteria, budget
 │         ├─ 1    Script ─────── versioned text + claim map
 │         ├─ 1    Content asset file + production metadata
 │         ├─ 1    Publication ── platform, url, timestamp, link form, evidence
 │         ├─ 1..* ResultObservation (scheduled) ── source, method, values
 │         └─ 1    Decision (G2..G5, G-pay) records
 ├─ 1      CycleReport (analysis output)
 └─ Cycle Learnings (carried forward, tagged)

Cross-cutting: WorkflowState (single), RunHistory (append-only), CostBudget
```

## 3. Entity definitions (fields, types, constraints)

### 3.1 Evidence
| Field | Type | Notes |
|---|---|---|
| id | string `EV-<cycle>-<n>` | unique, monotonic per cycle |
| source_name | string | e.g., "ACCESSTRADE TH guide (own site)" |
| url_or_reference | string (or "offline/<file>") | required; offline files acceptable |
| retrieved_at | date | required |
| finding | text | exact claim as source states it |
| relevance_note | text | why it matters here |
| claim_class | enum FACT / INFERENCE / HYPOTHESIS / UNKNOWN | required, default UNKNOWN |
| methodology / limitations | text, optional | e.g., "marketing page, no rate table" |
| related_program | string, optional | e.g., "accesstrade_th" |

Rules: Facts require a URL or file reference. Anything used in a decision must be class Fact or Inference; Hypotheses can drive experiment designs but never reported outcomes.

### 3.2 Opportunity (brief, one per candidate)
| Field | Type |
|---|---|
| id | string `OPP-<cycle>-<n>` |
| niche | text |
| audience | text |
| problem | text |
| candidate_offers | list[str] (program refs) |
| why_now | text |
| risks | list[str] |
| evidence_ids | list[EV ids] |
| confidence | enum LOW / MEDIUM / HIGH + reason |

### 3.3 Experiment (the core record)
| Field | Type | Notes |
|---|---|---|
| id | string `EXP-<cycle>` (one per cycle in Slice 1) | |
| opportunity_id | OPP id | |
| hypothesis | text | incl. explicit arithmetic |
| success_criteria | list[{metric, comparator, target, source}] | pre-registered before ACTIVE |
| duration_days | int (default 14) | |
| observation_schedule | list of D+3, D+7, end (extendable) | |
| budget_thb | int (default 0) | >0 requires G-pay approval id |
| channel | enum/freetext | e.g., tiktok, facebook, youtube |
| link_form | enum PROFILE_BIO / NATIVE_TAG / DEEP_LINK / OTHER | pinned before Stage 4 |
| program_ref | string + evidence_ids | dashboard screenshot where possible |
| status | enum PLANNED / ACTIVE_SETTING_UP / IN_FLIGHT / OBSERVING / REPORTING / DECIDED / ARCHIVED / HALTED | see §4 |
| commission_assumption | {rate, aov_thb, conversion_assumption} | each sourced or ASSUMPTION |
| started_at / ended_at | date | actual publish date to end date |

### 3.4 Script
| Field | Type |
|---|---|
| id | string `SCR-<cycle>-v<n>` |
| experiment_id | EXP id |
| text / storyboard | markdown |
| claim_map | list[{claim, evidence_id | null, kind: fact|opinion}] |
| disclosure_plan | {commercial, ai_use, channel_note} |
| version_of | prior SCR id or null |
| status | enum DRAFT / DRAFT_DONE / APPROVED_G3 / REJECTED / SUPERSEDED |

### 3.5 Content Asset
| Field | Type |
|---|---|
| file_path | string (relative to repo) |
| asset_kind | enum SHORT_VIDEO / STATIC_POST / OTHER |
| produced_by_tools | list[str] |
| ai_use_notes | text |
| quota_state_during_production | text |
| script_id | SCR id |

### 3.6 Publication
| Field | Type |
|---|---|
| id | string `PUB-<cycle>` |
| experiment_id | EXP id |
| asset_id | from asset record |
| platform / handle | string |
| live_url | string |
| posted_at | timestamp (operator-recorded) |
| link_form_used | string (must match experiment.link_form) |
| affiliate_link_used | string (as placed; no credentials) |
| disclosure_settings_applied | list[str] (e.g., tiktok commercial toggle, ai label) |
| evidence_files | list (screenshot paths) |
| status | enum LIVE / REMOVED / BLOCKED |

### 3.7 ResultObservation (append-only)
| Field | Type |
|---|---|
| id | string `OBS-<cycle>-<n>` |
| experiment_id | EXP id |
| captured_at | timestamp |
| day_offset | enum D0 / D+3 / D+7 / END / ADHOC |
| source | string (which dashboard/report) |
| method | enum SCREENSHOT / EXPORT_CSV / MANUAL_COPY |
| values | raw dashboard fields verbatim: {views_or_reach, clicks, orders, commission_amounts_by_status [status_label, amount, currency, field_name], paid_out_thb, cost_thb, notes} | capture exactly as the dashboard shows; Unknown allowed; see §6 |
| mapped | {M1_confirmed_net_commission_thb, M2_cash_received_thb, cancellation_rate, refund_thb_deducted, mapping_notes} | normalized per §6; Unknown allowed |
| evidence_file | path |
| open_questions | text |

Rules: values must be traced to a file; no synthesizing. Missing values = explicit Unknown, not 0. Refunds/reversals are deducted at most once per transaction/observation across M1 (§6 R4).

### 3.8 Decision record (append-only)
| Field | Type |
|---|---|
| id | string `DEC-<cycle>-<n>` |
| gate | enum G1 / G2 / G3 / G4 / G5 / G_PAY |
| decided_at | timestamp |
| result | enum APPROVED / REJECTED / APPROVED_WITH_NOTES |
| rationale | text |
| related_ids | affected EXP/SCR/PUB/asset |
| approver | "owner" (only legal value) |

### 3.9 CycleReport
| Field | Type |
|---|---|
| id | `RPT-<cycle>` |
| pipeline_totals | {reach, clicks, orders, pending_thb, M1_confirmed_net_thb, M2_cash_received_thb, refunds_deduction_thb, costs_thb, net_thb = M1 − costs} |
| criteria_outcomes | list[{criterion, actual, verdict confirm/reject/inconclusive}] |
| unknowns | list |
| learnings | list[{text, class, evidence_refs}] |
| recommendation | enum REPEAT / REVISE / STOP |
| objective_assessment | {net_daily_thb, window, verdict achieved/not/not-measurable} |
| g5_decision_id | DEC id |

### 3.10 WorkflowState (single file)
| Field | Type |
|---|---|
| current_cycle | string |
| current_stage | enum S1..S10 |
| stage_status | enum NOT_STARTED / IN_PROGRESS / DRAFT_DONE / AWAITING_GX / HALTED_QUOTA / HALTED_FAILURE / COMPLETED |
| pending_action | text (what unblocks it) |
| last_updated | timestamp |

### 3.11 RunHistory (append-only)
| Field | Type |
|---|---|
| ts | timestamp |
| actor | enum AI / OWNER_OPERATOR |
| action | text |
| result | enum OK / ERROR / BLOCKED_BY_GATE / BLOCKED_BY_QUOTA |
| error_detail | text, optional |
| recovery | text, optional |

### 3.12 CostBudget (per cycle)
| Field | Type |
|---|---|
| planned_thb | int (default 0) |
| spent_thb_actual | int (updated with evidence ref when paid) |
| approvals | list[DEC ids] |

## 4. Status enums & state-transition constraints

**Experiment status transitions (allowed edges only):**
```
PLANNED → ACTIVE_SETTING_UP          (requires G2 APPROVED decision)
ACTIVE_SETTING_UP → IN_FLIGHT        (publication LIVE, Stage 7 done)
IN_FLIGHT → OBSERVING                (first observation captured)
OBSERVING → REPORTING                (schedule complete or owner ends early)
REPORTING → DECIDED                  (G5 decision recorded)
DECIDED → ARCHIVED                   (learnings saved)
any → HALTED                         (quota/failure; resume by operator exception)
HALTED → previous state              (explicit resume action logged)
```
Forbidden edges: skipping OBSERVING to REPORTING (no evidence-free reporting), PLANNED → IN_FLIGHT (no bypass of setup/publication gates), any transition without the required Decision record.

**Script status:** DRAFT → DRAFT_DONE → APPROVED_G3 (D2 gate) / REJECTED; APPROVED_G3 assets cannot revert; revisions create new versions with `version_of` linkage (old SUPERSEDED).

**Publication status:** LIVE only after G4; REMOVED/BLOCKED states are terminal for that publication id; a re-publication gets a new PUB id.

## 5. Auditability, versioning, integrity

- **Append-only records:** Evidence, ResultObservation, Decision, RunHistory. Corrections create a new record referencing the old one, never overwrite values.
- **Versioning:** scripts/assets revisions via new IDs + `version_of`; the repo's git history (owner commits) is the outer layer.
- **Integrity rules:** every numeric value in a CycleReport must trace to ≥1 ResultObservation; every Experiment state transition must have its Decision record; every Fact must have a URL or file reference. The AI may flag violations but only the owner/operator may correct records.

## 6. Normalized income metrics (M1 / M2) and dashboard-field mapping

Programs label commission stages differently (Doc H EV-27..EV-31; Doc C §3a). A raw subtraction like "confirmed − refunds − costs" can double-count reversals when a dashboard already nets them out. The CycleReport therefore uses two normalized metrics, not a single unverified formula.

**M1 — normalized confirmed net commission** (per experiment / cycle):
- Count only commissions whose conversion status is **beyond validation** per that program's verified field semantics (e.g., ACCESSTRADE conversion status Approved; TikTok TH Settled-commission). Never count Pending, Rejected, or status-Unknown amounts.
- Subtract reversals (cancellations / refunds / rejections) **at most once** per transaction, **only if** the counted commission figure is demonstrably still gross of that reversal (mapping rule R4). If the reversal is already reflected in the counted figure, apply no further deduction and record `refund_thb_deducted = 0` with `mapping_notes` explaining why.
- Objective net income over a window = M1 − direct costs (default THB 0). M1 is an accepted-earnings metric, not cash.

**M2 — cash received** (per payout / bank statement):
- M2 counts only amounts actually paid out and received (program payout record or bank credit), minus applicable costs (e.g., transfer fees), as verified per-account.
- M2 ≤ M1 typically, because of payout thresholds, settlement lags, and post-validation reversals. Discrepancies larger than explained lags must be flagged as open questions.

**Mapping rules (R1–R6):**
- R1: record the source field's exact label, report name, and retrieval date with every amount.
- R2: convert validation status ≠ payment status; never infer one from the other.
- R3: amounts whose program-specific semantics are Unknown are recorded raw only; they may not enter M1 until verified from the dashboard/program terms.
- R4: deduct a refund/reversal only once per transaction, and only when the counted figure is demonstrably still pre-reversal (e.g., TikTok TH settled commission already applies (revenue − refunds) × rate → no further deduction).
- R5: pending or rejected commissions never count as earned net income in any metric.
- R6: M2 is updated only on actual receipt with its own evidence file; sightings of "commission confirmed" in-dashboard never update M2.

Until each program's field semantics are verified in-dashboard (Doc G OQ-8), the objective verdict is "not yet measurable" — this is an Unknown, not a zero.

## 7. Minimum viable vs future

**Minimum (Slice 1):** all of §3 above, in text files, one cycle.
**Future extensions (not built now):** multi-cycle rollups/metrics across experiments; payout-lag modeling once confirmed data exists; channel/task automation; any API-driven capture (behind per-account feature verification); encryption/at-rest per repository policy.
