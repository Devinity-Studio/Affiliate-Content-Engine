# AC-08 CycleReport Assertion Matrix — ResultObservation to G5 Decision

**Purpose**: Define assertion matrix for CycleReport generation, ResultObservation provenance, M1/M2 normalized metrics, and G5 decision scope. Fixture-first design; deployment/account evidence separate.

---

## 1. Overview and Formula Verification

| Metric | Verified Formula | Source | Condition if Unverified |
|--------|----------------|--------|------------------------|
| **M1 — Confirmed net commission** | Program-specific verified field semantics (per Doc D §6, R1–R6) | Doc D §6 + EV-1-2/1-3 affiliate terms | If OQ-8 unverified: `"not yet measurable"` (not 0) |
| **M2 — Cash received** | Actual payout record or bank credit, verified per-account | Doc D §6 + per-program payout docs | If OQ-8 unverified: `"not yet measurable"` (not 0) |
| **net_thb** | `M1 − costs` (THB) | Doc D §6, CycleReport field definition | If M1 `"not yet measurable"`: net_thb marked `"not yet measurable"` |
| **costs_thb** | Direct production costs (tools, subscriptions, etc.) | Operator attestation + cost-budget.yaml | Default THB 0 if no costs incurred |
| **pending_thb** | Pending commissions (not yet beyond validation) | Doc D §6 R5: never count as earned net income | Always excluded from M1 |

**Critical**: Do not use `revenue − commission` as the net income formula. The verified formula is `M1 − costs` per Doc D §6. If program commission semantics are unverified (OQ-8), the verdict is `"not yet measurable"`.

---

## 2. Assertion Matrix: CycleReport ← ResultObservation

| CycleReport Field | Required ResultObservation Source | Provenance Rule | Verification Assertion |
|-------------------|----------------------------------|-----------------|-----------------------|
| **reach** | OBS `values.views_or_reach` (any source) | Must trace to `evidence_file` path | At least 1 OBS contributes; no synthesis |
| **clicks** | OBS `values.clicks` with `mapping_notes.per_post` / `per_link` / `aggregate` / `unknown` | Clicks retain attribution scope; `unknown` never becomes 0 | Scope labeled in `mapping_notes` or `open_questions` |
| **orders** | OBS `values.orders` (raw dashboard field) | Must trace to `evidence_file`; `UNKNOWN` allowed | No zero substitution for unknown orders |
| **pending_thb** | OBS `values.commission_amounts_by_status` (status = Pending) + mapping_notes | Pending never count as earned (R5) | Asserted: pending_thb appears in RPT only if supported by OBS |
| **M1_confirmed_net_thb** | OBS `values.commission_amounts_by_status` (status = Approved/ Settled) per R1–R6 | Only confirmed commissions counted; reversals handled per R4 | If no program semantics verified: `"not yet measurable"` |
| **M2_cash_received_thb** | OBS `values.paid_out_thb` + evidence file of payout record | Actual cash received; sightings of "commission confirmed" never update M2 (R6) | If no payout record: `"not yet measurable"` |
| **refunds_deduction_thb** | OBS `values.refund_thb_deducted` (at most once per transaction, R4) | Deducted at most once per transaction; only if counted figure is demonstrably gross of reversal | If reversal already reflected: `refund_thb_deducted = 0` with mapping_notes |
| **costs_thb** | Operator attestation + receipt files (tool subscriptions, etc.) | Direct costs; default THB 0 | Asserted: costs_thb ≥ 0; if 0, note "no paid tool/subscription used" |
| **net_thb** | `M1_confirmed_net_thb − costs_thb` | **Verified formula**: `M1 − costs` per Doc D §6 | If M1 = `"not yet measurable"`: net_thb = `"not yet measurable"` (not forced to 0) |
| **objective_assessment** | Derived from net_thb + window + criterion verdicts | `{net_daily_thb, window, verdict achieved/not/not-measurable}` per Doc F §0a/Doc G G1-E | Verdict must not contradict the numbers in the report |

---

## 3. Unknown Preservation Rules

| State | Definition | When used | How recorded |
|-------|------------|-----------|--------------|
| **UNKNOWN** | Value not yet verified from dashboard/program terms | OQ-8 unverified, field not captured, source unavailable | `values.{field}: "UNKNOWN"` (string, not 0/0.0)<br>`evidence_file: "requires_dashboard_access"` (or permitted path)<br>`open_questions: text` documenting the gap |
| **0** | Value confirmed as zero from credible source | Dashboard shows 0, or program terms define 0 for this metric | `values.{field}: 0` (number)<br>`evidence_file: real-path-or-URI`<br>`mapping_notes: "verified from X source"` |
| **ไม่มีหลักฐาน** | Cannot confirm value origin | Source inaccessible, retrieval failed, data corrupted | `values.{field}: "UNKNOWN"`<br>`open_questions: "source unavailable: X"`<br>`evidence_file: "unavailable"` (only if contract permits) |

**Critical rule** (from D-data-model.md §3.7): `"Missing values = explicit UNKNOWN, not 0. No synthesizing."`

**Test assertion**: CycleReport must not contain any `0` that originated from an `UNKNOWN` dashboard field. Each number must either (a) trace to a ResultObservation with verified value, or (b) be explicitly marked `"not yet measurable"` where OQ-8 prevents verification.

---

## 4. G5 Decision Scope and Verdict Matrix

| G5 Verdict | Required Rationale | Metric Conditions | Pass-Fail Criteria |
|------------|-------------------|-------------------|-------------------|
| **REPEAT** | "Insufficient data; run experiment again with same design" | - M1/M2 not yet measurable (OQ-8 unverified)<br>- Fewer than 3 ResultObservation contributing to pipeline totals<br>- Objective assessment verdict: `not yet measurable` | Assert: Report explicitly states "insufficient data" + specific gaps |
| **REVISE** | "Modify design, thresholds, or observation schedule" | - Measurable M1/M2 but criteria not met<br>- High unknowns ratio (>30% of OBS have UNKNOWN values)<br>- Objective assessment: `not achieved` with quantified gap | Assert: Report lists specific revisions + expected impact on metrics |
| **STOP** | "Terminate experiment; no further value expected" | - M1 measurable but below threshold (e.g., net_thb < 0 or insufficient ROI)<br>- Critical data gaps cannot be resolved<br>- Objective assessment: `not achieved` with documented rationale | Assert: Report includes net_thb value + threshold comparison + irreversible-gap list |

**Mandatory G5 fields**:
- `verdict`: one of REPEAT/REVISE/STOP
- `rationale`: free-text reason rooted in verified metrics (not assumptions)
- `related_ids`: references to CycleReport id, contributing ResultObservation ids
- `objective_assessment`: `{net_daily_thb, window, verdict achieved/not/not-measurable}`

**G5 does NOT**:
- Assume `revenue − commission` formula
- Force `net_thb` to 0 when OQ-8 unverified
- Declare experiment "successful" or "failed" without evidence traceability

---

## 5. Provenance and Traceability Assertions

| Assertion | Specification |
|-----------|---------------|
| **Every number in CycleReport appears in ≥1 ResultObservation** | Verified by iterating all CycleReport numeric fields and confirming `field_value ∈ {OBS[i].values.{field} for some i}` |
| **M1_confirmed_net_thb traced to confirmed commissions** | Audit: sum of all OBS `commission_amounts_by_status[status=Approved/Settled]` across all OBS records = M1 value (within rounding) |
| **M2_cash_received_thb traced to payout records** | Audit: OBS `paid_out_thb` values + payout evidence files sum to M2 value (or `"not yet measurable"` if no payout record) |
| **net_thb = M1 − costs** arithmetic verified | Compute M1 − costs from independently audited values; assert result matches reported net_thb within acceptable rounding |
| **objective_assessment verdict does not contradict numbers** | If net_thb > 0, verdict cannot be `not achieved` without documented rationale; if net_thb < 0, verdict `achieved` requires extraordinary evidence |
| **unknowns list contains all unverified fields** | CycleReport `unknowns` array lists every OBS field marked `UNKNOWN` + reason; no uncovered UNKNOWN should remain |

---

## 6. Test Execution and Verification (Fixture-Only)

**Pseudo-command structure** (not executed in real repo):

```bash
node verification/ac-08-cycle-report-test.js \
  --formula "M1_minus_costs" \
  --trace-observations true \
  --verify_verdicts true \
  --tag "SYNTHETIC_FIXTURE · สูตร net_thb = M1 − costs ตาม Doc D §6"
```

**Verification steps after test run**:

1. **Real repository integrity**: `data/app/state.json` MD5 unchanged, `data/mvp/` absent before and after, Git HEAD unchanged (as with all fixture tests)

2. **ResultObservation coverage**: Count OBS records contributing to each CycleReport metric; assert minimum thresholds (e.g., ≥3 OBS for pipeline totals per AC-07)

3. **Formula verification**: 
   - Compute `M1` from OBS confirmed commissions per R1–R6
   - Compute `costs_thb` from operator attestation + receipt files
   - Compute `net_thb = M1 − costs`
   - Assert `reported net_thb === computed net_thb` (within rounding) **OR** both are `"not yet measurable"`

4. **Unknown preservation**: 
   - Assert no `0` appears where OBS had `UNKNOWN`
   - Assert all `UNKNOWN` values are documented in `open_questions` or `mapping_notes`

5. **G5 verdict consistency**: 
   - If M1 measurable and net_thb > threshold → verdict ∈ {REVISE, STOP} with rationale
   - If M1 not measurable → verdict = `"not yet measurable"` + report field reflects this
   - If critical gaps exist → verdict = STOP with documented gaps

6. **Prohibited patterns detected and rejected**:
   - `revenue − commission` formula used instead of `M1 − costs`
   - `0` substituted for `UNKNOWN` dashboard field
   - `net_thb` forced to 0 when OQ-8 unverified
   - verdict contradicts reported numbers without documented rationale

---

## 7. When to Escalate to Deployment/Account Evidence

This fixture assertion matrix is **insufficient** for the following, which require separate evidence:

- Actual Shopee/Agoda dashboard data → OBS `values` populated with real fields
- Program commission semantics verification (OQ-8) → M1/M2 measurability decision
- Real payout records → M2_cash_received_thb populated
- Real Revenue figures → must not be used as input; M1 uses confirmed commissions only
- Real cost submissions (tool subscriptions, paid APIs) → costs_thb from operator attestation only

**Escalation path**: After fixture tests pass and are documented, create separate test contract for:
1. Account-access OBS capture (if owner authorizes dashboard login)
2. Program term verification (if commission semantics can be confirmed from public terms)
3. Sites deployment with D1/R2 for durable PUB/OBS/RPT record storage

**Design principle**: Fixture tests verify the *logic* (formulas, tracing, verdicts) independent of data source. Data-source verification is a separate concern.

---