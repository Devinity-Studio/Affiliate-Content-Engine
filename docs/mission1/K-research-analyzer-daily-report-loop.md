# K. Research & Analyzer + Daily Report / Reusable Knowledge Loop — Affiliate Content Engine (Slice 1)

**Status:** DRAFT FOR OWNER REVIEW · Version 1.1 · 2026-10-19

This specification describes the research analyzer, daily report, and reusable knowledge loop that feeds learning back into future workflow cycles. It is documentation-only; no application code or production UI is implemented.

The loop is a core part of the system's operating principle (Doc F §0b / Doc G Record G1-E): we are not building a one-time GPS to the income target but a system that learns from evidence, analyzes trends, adjusts its route, holds what works, and grows net income sustainably.

## 1. Design Principles

### 1.1 FACT / INFERENCE / HYPOTHESIS / UNKNOWN Distinction
Every claim in the system is classified into one of four classes:
- **FACT:** Directly supported by reliable evidence, source logged (Doc H). Requires a URL or file reference.
- **INFERENCE:** Derived from evidence (e.g., "high commission rate suggests good earning potential"). Warrants testing but not reported as outcome.
- **HYPOTHESIS:** Proposed explanation driving an experiment (Doc D §3.3 hypothesis field). Can drive experiment design but never reported as an outcome.
- **UNKNOWN:** Unverified; may become FACT or INFERENCE after testing. Never the basis for a decision without evidence.

### 1.2 Daily Report Per Content Item
A daily report is generated per content item (per experiment cycle) and captures:
- Results (reach, clicks, orders, commission status, refunds, paid-out amounts)
- Why it may have worked/failed (diagnostic hypotheses, not conclusions)
- Conditions/constraints (free quota state, platform policy, channel eligibility, commission lag)
- Cost/time (tool usage, operator hours, any THB 0 cost evidence)
- Commission/conversion/revenue evidence (raw dashboard values verbatim, mapped M1/M2)
- Reusable lessons (tagged with class and evidence refs)

### 1.3 Forecast Portfolio Income with Safety Buffer
The system forecasts portfolio income using:
- Lead time from content publication to commission realization (per OQ-2, OQ-3)
- Decay pattern per content clip (how commission declines over time)
- Uncertainty quantification (confidence intervals, not point forecasts)
- Safety buffer: the system does not optimize only for views or clip count; it explicitly accounts for concentration risk and durability

The forecast is not a guarantee; forecasts are explicitly marked as uncertain. The system forecasts when to prepare new content using lead time, decay, uncertainty, and a safety buffer; cadence must respond to evidence, not a blindly fixed daily clip quota.

### 1.4 Diagnostic Lens: Net Revenue Per Clip Per Day (THB/clip/day)
The objective metric remains **net income under the Owner-approved 14-day formula** (Doc G §2b), assessed at portfolio level. **Net revenue per clip per day (THB/clip/day)** is a secondary diagnostic view for comparing content items, reported alongside:
- Costs (tool usage, quota, any evidenced costs)
- Time (operator hours per clip)
- Conversions (clicks → orders)
- Commissions (M1 normalized confirmed net commission)
- Publication date
- Revenue trend/decay (per rolling window assessment per Doc F §0b / Doc G G1-E)
- Durability (how long the clip maintains relevance/revenue)
- Concentration risk (dependence on a single product/program/channel)

The system does **not** optimize only for views or clip count.

### 1.5 Forecasting Cadence Responds to Evidence
The system forecasts portfolio income and when to prepare new content using:
- **Lead time:** time from publication to measurable commission (per OQ-2, OQ-3)
- **Decay:** how commission per clip declines over time (per the trailing 14-day window per G1-B/§2b)
- **Uncertainty:** quantified via the UNKNOWN class and the "not yet measurable" verdict
- **Safety buffer:** a cushion above the THB 1,000/day target to account for decay and uncertainty
- **Cadence:** responds to evidence, not a blindly fixed daily clip quota

If evidence does not support the trajectory, the system honestly reports the gap and recommends a corrective experiment or strategic revision at Gate G5 — it does not fabricate performance or scale an approach merely to preserve the timeline (Doc F §0a).

## 2. Research Analyzer

### 2.1 Inputs
- Market scout candidates (S1 output: opportunity brief, evidence log)
- Experiment hypothesis and arithmetic (S2 output: analysis brief)
- Result observations from completed experiments (Step 8 / Doc B Stage 8 output: OBS records)
- Previous cycle learnings archive (tagged F/I/H/U with evidence refs)

### 2.2 Processing Rules
1. **Combine data sources:** Merge current market/product/trend/commission data with historical experiment results.
2. **Classify every claim:** Each statement is tagged FACT / INFERENCE / HYPOTHESIS / UNKNOWN per the rules below.
3. **Distinguish own observations vs. third-party claims:** Third-party market observations may never be recorded as proof of our own sales potential (Doc A FR-1.2). They are recorded as signals warranting an experiment, not as proof.
4. **Flag data gaps:** Any statement without a traceable Evidence ID is marked UNKNOWN and listed in the report's unknowns.
5. **Retain uncertainty:** Forecasts are not guarantees. UNKNOWN claims are explicitly carried forward.

### 2.3 Outputs
- Analyzer report: summary of findings with each line tagged F/I/H/U and sourced where possible.
- Updated learnings archive entry (carried forward to next cycle's S1).
- Recommendations for the next experiment (which may be: repeat, revise, stop, or collect more evidence).

### 2.4 Classification Rules
| Class | When Tagged | Can Drive Decision | Can Be Reported as Outcome |
|---|---|---|---|
| **FACT** | Supported by evidence with URL/file reference (Doc H) | Yes (load-bearing) | Yes, as outcome |
| **INFERENCE** | Derived from evidence but needs testing | Yes (as signal) | No, not as outcome |
| **HYPOTHESIS** | Proposed experiment driver (Doc D §3.3) | Yes (guides experiment) | No, not as outcome |
| **UNKNOWN** | No verifiable evidence; unverifiable claim | No | No, explicitly listed as data gap |

### 2.5 Daily Report Template (per content item)
| Field | Description | Class Requirement |
|---|---|---|
| `date` | Capture date | — |
| `reach` | Platform reach/impressions as displayed | Raw; map to normalized metrics separately |
| `clicks` | Clicks on affiliate link as displayed | Raw; map separately |
| `orders` | Orders attributed to the link as displayed | Raw; map separately |
| `commission_statuses` | Breakdown by status label, amount, currency, field name | Raw; must verify program semantics (OQ-8) |
| `refunds_deducted` | Refunds reversed, per R4 (at most once per transaction) | Must verify from dashboard; never double-count |
| `paid_out_thb` | Actual cash received (payout evidence or bank credit), less transfer costs | M2; verified per-account; never inferred from M1 |
| `cost_thb` | Evidenced direct costs attributable to this clip | Must have evidence ref; default 0 |
| `net_thb` | M1 − costs (normalized confirmed net commission minus direct costs) | Computed; traceable to OBS |
| `why_it_may_have_worked` | Diagnostic hypotheses (not conclusions) | All class except UNKNOWN presented as hypotheses |
| `why_it_may_have_failed` | Diagnostic hypotheses (not conclusions) | All class except UNKNOWN presented as hypotheses |
| `conditions_constraints` | Free quota state, platform policy, channel eligibility, commission lag | May include UNKNOWN; carried forward |
| `reusable_lessons` | Lessons tagged F/I/H/U with evidence refs | Carried forward to next cycle S1 |

### 2.6 Learning Feed-Forward
At experiment end, the AI drafts learnings that are archived and fed into the next cycle's S1 (Research). Only learnings with evidence attached are carried forward:

- **Proven:** Evidence/repeated results → carried as FACT into next S1 opportunity brief.
- **Promising:** Needs more tests → carried as INFERENCE with a note that it requires validation; not load-bearing until confirmed.
- **Failed/Warning:** Observation contradicts the hypothesis or shows a data gap → carried as UNKNOWN with explicit note of what was tested and the result.

The next cycle's S1 must begin from the previous cycle's decision (Doc B §2 S10), not from scratch. Only learnings with evidence attached may be carried forward as FACT or INFERENCE; HYPOTHESIS claims may be retested.

### 2.7 Daily Report Generation Schedule
Daily reports are generated at minimum at these points:
1. **At experiment start:** Baseline capture (D0) of all metrics.
2. **At D+3:** First scheduled observation.
3. **At D+7:** Second scheduled observation.
4. **At experiment end:** Final observation (END).
5. **On demand:** If the operator initiates a capture outside the scheduled window (ADHOC), it is recorded as an additional observation.

The schedule is **capture-point based, not one report per calendar day**: "daily report" names the per-item report format, and extra captures are recorded as ADHOC observations (Doc D §3.7). A daily series requires the operator to add ADHOC captures; it is not implied by the minimum schedule.

Each daily report captures the state as of the capture date/time. The rolling 14-day window (per G1-B/§2b) is assessed only when sufficient complete days are available; otherwise the verdict is `not yet measurable`.

## 3. Reusable Knowledge Loop

### 3.1 Loop Structure: Observe → Analyze → Diagnose → Adapt → Measure → Reconcile → Repeat

This is the continuous optimization loop (Doc F §0b / Doc G Record G1-E). Each iteration:

1. **Observe:** Capture real outcome evidence (Step 8 / Doc B Stage 8). Record raw dashboard values verbatim; map to M1/M2 separately (Doc D §6).
2. **Analyze:** Compare hypothesis to actuals (Step 9 / Doc B Stage 9). Tag every claim F/I/H/U. List unknowns/data gaps.
3. **Diagnose:** Inspect in fixed order: `Source/Data → Product/Offer → Content → Distribution → Conversion/Revenue → Costs → Next Action` (Doc B §2 S9 step 5).
   - **Improving:** results are getting better → document what changes have supporting evidence; consider careful, evidence-gated expansion.
   - **Stable:** good results sustained → hold what works; do not change merely to be changing.
   - **Declining:** results getting worse → investigate causes; run an evidence-based corrective experiment (via G2 if a new experiment is required).
   - **Inconclusive:** insufficient evidence for a conclusion → record it as such and specify the data or experiment needed next.
4. **Adapt:** Based on diagnosis, customize and improve the next experiment (Doc F §0a). Record the change as a testable hypothesis with measurable indicators, evidence, and post-adjustment outcome.
5. **Measure:** Capture new evidence from the adapted experiment. Use the same normalized metrics (M1/M2) and window (14-day rolling per G1-B/§2b).
6. **Reconcile:** Compare new results against prior window; assign one of four trend status values (Improving/Stable/Declining/Inconclusive). Disclose material uncertainty; never claim a trend from one day's fluctuation alone.
7. **Repeat:** Use the adapted parameters for the next cycle. The workflow state resets to S1 with carry-forward learnings.

### 3.2 Carry-Forward Rules (from Doc B §2 S10)
Only the following are carried forward into the next cycle's S1:

| Type | Carried As | Condition |
|---|---|---|
| **Proven** (repeated results) | FACT | Verified via Evidence IDs; load-bearing in next opportunity brief |
| **Promising** (needs more tests) | INFERENCE | Tagged with note: "requires validation; not load-bearing until confirmed" |
| **Failed/Warning** (contradicts hypothesis) | UNKNOWN | Explicitly noted: "tested in cycle N; result was X; not repeated" |
| **HYPOTHESIS** (retested) | HYPOTHESIS | May be retested in next S2; not carried as FACT / INFERENCE without confirmation |
| **Speculation without evidence** | Nothing | Not carried forward |

### 3.3 Daily Report Per Content Item (expanded)
The daily report captures results, why it may have worked/failed, conditions/constraints, cost/time, commission/conversion/revenue evidence, and reusable lessons. Both successes and failures are stored. The report is per content item (per experiment clip/asset), not a aggregate across all clips.

### 3.4 Forecast Portfolio Income
The system forecasts when to prepare new content using lead time, decay, uncertainty, and a safety buffer; cadence must respond to evidence, not a blindly fixed daily clip quota. The forecast is not a guarantee; it is explicitly uncertain.

- **Lead time:** Time from publication to measurable commission (informed by OQ-2, OQ-3).
- **Decay:** How commission per clip declines over the 14-day rolling window (per G1-B/§2b).
- **Uncertainty:** Quantified by the number of UNKNOWN claims, the "not yet measurable" verdict, and confidence intervals.
- **Safety buffer:** The system does not optimize only for views or clip count; it explicitly accounts for concentration risk and durability.

The forecast answers: given current evidence, when should we prepare the next clip to maintain portfolio income? The answer is evidence-driven, not schedule-driven.

### 3.5 Diagnostic: Net Revenue Per Clip (THB/clip over the 14-day window)

The objective metric is defined by the Owner-approved formula (Doc G §2b) and assessed at portfolio level:

```
Net Income_14d = Σ Eligible M1 − Σ Direct Costs
Daily Average_14d = Net Income_14d / 14
```

Per-clip figures are a **diagnostic view only**, computed on the same window and divisor:

```
Clip contribution_14d = Σ Eligible M1 attributable to the clip − direct costs attributable to the clip
```

Rules:
- Do not divide by `days_since_publication`; the approved divisor is the number of calendar days in the window (14), applied to a complete window (Doc G §2b).
- If commission or clicks cannot be attributed to the clip (e.g., only aggregate dashboard data), the per-clip figure is `not yet attributable` — never 0.
- Where the window is incomplete or program field semantics are unverified (OQ-8), the verdict is `not yet measurable`.
- A per-clip figure is never reported as the objective assessment and never used to claim the THB 1,000/day target is met.

### 3.6 Reports Feed Learning Back into Research & Analyzer
- The Cycle Report (Step 9 / Doc B Stage 9) explicitly lists `reusable_lessons` per content item, tagged F/I/H/U with Evidence IDs.
- The Research Analyzer (S1) reads the previous cycle's learnings archive and uses them to populate the opportunity brief candidate niches.
- Only tagged/sourced learnings are carried forward; raw speculation without evidence is not.
- The analyst marks each lesson's class; the operator decides at G5 (repeat/revise/stop) which lessons toact on.

### 3.7 Forecasts Retain Uncertainty
- Every forecast explicitly states its confidence level and unresolved UNKNOWN claims.
- Forecasts are not cited as guarantees or automatic conclusions.
- The "not yet measurable" verdict is used when the 14-day window is not complete or field semantics are unverified (OQ-8).
- Trends (Improving/Stable/Declining/Inconclusive) are diagnostic hypotheses, not verdicts (Doc F §0b / Doc G G1-E).

## 4. Open Questions & Unresolved (carried from Doc G)

| # | Question | Impact on Learning Loop |
|---|---|---|
| OQ-2 | Commission-lag reality | Affects M1/M2 timing in daily reports and the 14-day window assessment |
| OQ-3 | Per-campaign commission terms | Affects M1 computation in daily reports and pipeline totals |
| OQ-4 | Channel eligibility reality | Affects which observations are captureable and what link forms are available |
| OQ-6 | Budget > 0 appetite | Affects whether cost fields in daily reports include paid tool costs or remain THB 0 |
| OQ-7 | Which niche? | Affects which learnings from prior cycles are carry-forward candidates |

These are noted for the owner's resolution but do not prevent this specification from being drafted.

## 5. Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-10-16 | Codebuff (Buffy) | Initial draft for owner review; research analyzer and learning loop formalized per design direction |
| 1.1 | 2026-10-19 | Codebuff (Buffy) | Reconciled the per-clip metric with the Owner-approved 14-day formula (Doc G §2b); per-clip figures are diagnostic and never the objective; clarified capture-point cadence and Step numbering |