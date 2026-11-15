# ARTIFACT-SOLAR-03 — Scope and Authority Review

**Prepared by:** Solar Pro 4 (REVIEW ONLY — NOT AUTHORIZED)
**Mode:** Independent Challenge & Evidence Audit
**Primary evidence base read-only:** `docs/mission1/B-workflow-specification.md`, `docs/mission1/D-data-model.md`, `docs/mission1/A-product-specification.md`, `docs/mission1/F-implementation-roadmap.md`, `ACE-MVP-Phase1-DoD-Amendment-Proposal.md`, `ACE-MISSION1_RECONCILIATION_CORRECTION_SUPPLEMENT.md`, `oq8_gate_assessment.md`, `ACE-S6-GOVERNANCE-DECISION-MATRIX-01.md`, `verification/ace-mission1-acceptance.js`, `app/mvp/service.js`, `app/mvp/content.js`

**Status framing throughout:** REVIEW ONLY — NOT AUTHORIZED.

---

## 1. Purpose

This artifact reviews three authority/scope questions raised by the Gemini plan:

1. whether the Active / Watchlist / Archive structure has checkable criteria,
2. whether the Execution Profile lists capabilities that are not yet verified,
3. whether any planned work exceeds the Preparation / Phase A boundary,
4. whether stop conditions and decision authority are complete.

The underlying reference model is the repo’s 10-stage workflow, its gate set, and its current decision record inventory, not an external plan text that was not located in the repo.

---

## 2. Active / Watchlist / Archive structure criteria

### 2.1 What the repo actually specifies

The repo’s live status model is not “Active / Watchlist / Archive” as a freestanding taxonomy. It is:

- **Experiment status** with an explicit allowed-edge list in `docs/mission1/D-data-model.md` §4:
  - PLANNED → ACTIVE_SETTING_UP → IN_FLIGHT → OBSERVING → REPORTING → DECIDED → ARCHIVED
  - any → HALTED; HALTED → previous state by explicit resume
  - Forbidden edges: skipping OBSERVING, PLANNED → IN_FLIGHT, any transition without the required Decision record.
- **Script status**: DRAFT → DRAFT_DONE → APPROVED_G3 / REJECTED; revisions create new versions, old SUPERSEDED.
- **Publication status**: LIVE only after G4; REMOVED/BLOCKED terminal for that PUB id; re-publication gets a new PUB id.
- **Source status** in the MVP slice: ACTIVE / ARCHIVED / EXPIRED / AGING / UNKNOWN via freshness and validation logic in `app/mvp/service.js`.

### 2.2 Where “Watchlist” is not yet a checked term

There is no single repo-stated “Watchlist” state with explicit entry/exit criteria in the documents read for this audit. The MVP source code does implement candidate actions: SAVE / REJECT / QUEUE / REMOVE, and it implements `isActiveCandidate()` with removal tracking.

So if the plan uses “Active / Watchlist / Archive” as its operating vocabulary, the challenge is:

- the repo has **Active-like** (ACTIVE_SETTING_UP / IN_FLIGHT / OBSERVING), **Archive-like** (ARCHIVED / REMOVED / BLOCKED / SUPERSEDED), and **queue/remove/holding-like** behavior,
- but the exact “Watchlist” label, its gates, and its verification criteria are not established by the repo evidence read for this audit.

### 2.3 Checkability assessment

Checkable where the repo uses explicit transitions:

- experiment stage progression tied to decision records,
- script version lifecycle,
- publication gate,
- source freshness/archive state.

Not yet checkable as written if the plan means:

- a separate Watchlist bucket with its own admission criteria,
- a distinction between “watching but not active” and “paused/quota/failure”,
- archive criteria that differ from the repo’s terminal states.

**Recommendation posture:** do not assume the plan’s Active/Watchlist/Archive is automatically consistent with the repo’s explicit state machine. If the plan wants that vocabulary, it should map each of the three buckets onto repo states with explicit entry/exit criteria and decision records.

---

## 3. Execution Profile — capabilities not yet verified

### 3.1 What “Execution Profile” could mean in this repo

The term “Execution Profile” is not a single canonical document label in the evidence read for this audit. If the plan uses it to summarize “what the system can do during execution,” the relevant evidence is:

- `app/mvp/service.js`: MVP affiliate slice behavior — synthetic fixture import, source/product/offer/evidence building, candidate generation and ranking, plan draft, impact preview; fixture state only; never contacts Shopee; never creates Experiment/Script/Content Work Item/Publication; never records G1–G5.
- `app/mvp/content.js`: plan → content project → storyboard/script/CTA → QA → FINALIZED → EXPORTED → READY_TO_PUBLISH; fixture/MVP state only; never contacts Shopee or any external account; “Publish preparation” builds a handoff payload and explicitly does not publish.
- `verification/ace-mission1-acceptance.js`: test harness and historical result claims; not a live authorization.

### 3.2 Capabilities that are implemented facts, not verified live readiness

Based on the repo evidence, the following are **implementation/historical-evidence facts**, not verified live authorization:

- import route exists and writes fixture state only,
- content generation/export exists in code and is described by a ratified acceptance contract and historical test claims,
- a 173/173 historical result and a G-13 E2E run log exist in reports,
- 16-item finalize checklist exists as an implementation function.

The strongest supported statement for each is “a code path/report exists,” not “the capability is currently authorized and verified live for Phase A use.”

### 3.3 Capabilities that are explicitly out of scope / not performed

From `ACE-MISSION1_RECONCILIATION_CORRECTION_SUPPLEMENT.md` and the source module boundaries:

- real content production or publication is not authorized by DEC-1-G1,
- content library overwrite/lifecycle policy resolution is not authorized,
- live Shopee export verification is not performed,
- runtime test execution for Mission 1 acceptance is not performed in this audit,
- any external account contact would be out of scope here.

### 3.4 Likely over-claim risk in an Execution Profile

If the plan’s Execution Profile says “system can do X” and relies on:

- code existence alone,
- a historical test result recorded in a report,
- a UI screenshot showing a modal or dashboard,

then it is mixing three different evidence classes:

1. implementation presence,
2. historical test claim,
3. screenshot/OCR evidence.

For a Profile that is meant to guide execution, each capability should be labeled with its actual evidence class and current authorization status. Otherwise the profile can imply readiness that the repo does not support.

---

## 4. Work exceeding Preparation or Phase A

### 4.1 The repo’s own phase boundary

Per `ACE-MVP-Phase1-DoD-Amendment-Proposal.md`:

- **Phase 1** = Content Creation & Content Library, ending at Export and Content Library store/retrieve.
- **Phase 1 does not inherently require** integrated automated publication, observation, analysis, or Cycle Report.
- **Phase 2** = Integrated Affiliate Workflow, full cycle through observation/analysis/Cycle Report.

That is the repo’s own Phase 1/Phase 2 boundary, which is the closest thing in the evidence to a “Preparation / Phase A” style split.

### 4.2 What the current physical records authorize

From `ACE-MISSION1_RECONCILIATION_CORRECTION_SUPPLEMENT.md`:

- The only decision record physically located in `decision-log.md` in that pass is `DEC-1-G1`.
- `DEC-1-G1` authorizes Mission 1 plan and **Phase 1 (Foundation & Access)**, Cycle 1 only, under **THB 0**, scope = Foundation Slice only.
- It explicitly does **not** authorize real content production/publication, purchases, paid services, paid APIs, advertising, automation.
- It explicitly preserves G2, G3, G4, G5, and G-pay as separate gates.

### 4.3 Work that would exceed the boundary

If the plan includes any of the following without the corresponding gate/decision, it likely exceeds the current boundary:

- actual publication and distribution with live dashboard observation,
- expected-income conclusions based on real post-publication results,
- content library overwrite/lifecycle behavior changes,
- any spend above THB 0 without G-pay,
- any experiment go-live without the relevant gate record.

Even within Phase 1, the repo treats content creation through export/store-retrieve as the endpoint, not a full revenue loop.

### 4.4 Comparison with AC-05 / AC-08 and OQ-8

- `ACE-MVP-Phase1-DoD-Amendment-Proposal.md` separates Phase 1 DoD from Phase 2 DoD and marks Cycle Report / G5 / OBS-dependent items as Phase 2.
- `AC-08-CycleReport-Assertion-Matrix.md` is explicit that fixture assertion matrix is insufficient for real dashboard data, program semantics verification, real payout records, real revenue figures, and real cost submissions.
- `oq8_gate_assessment.md` says M1 is measurable for TikTok SH and ACCESSTRADE TH, but Shopee TH remains PARTIAL until dashboard mapping is verified.

So if the plan’s Preparation/Phase A discussion implies that income measurement, publication, or live observation is already in scope, that is a boundary overreach relative to the repo’s evidence.

---

## 5. Stop conditions and decision authority

### 5.1 Stop conditions present in the repo

The repo has explicit global failure conditions in `docs/mission1/B-workflow-specification.md`:

- free quota exhausted → PAUSED_QUOTA,
- hallucinated/unverifiable claim → mark Unknown, exclude,
- publication blocked by platform → retry ≤2 manually, then HALTED_FAILURE + owner,
- missed observation window → proceed with best available + explicit Unknown,
- approval gate pending (G1–G5) → workflow halts; no timeout auto-approves,
- budget > THB 0 detected → stage blocks until G-pay approval,
- engine attempts a restricted action → HALTED_FAILURE + owner report,
- dashboard reporting changed → re-derive meaning; note in run history.

Doc D §4 also defines forbidden transitions and halting/resume edges.

So the repo does contain stop/halt conditions. What it does **not** necessarily provide is a single “Execution Profile stop-conditions table” unless the plan builds one from these pieces and labels it as such.

### 5.2 Decision authority present in the repo

Per `docs/mission1/A-product-specification.md` §7 and Doc B:

- G1 — plan approval,
- G2 — experiment approval,
- G3 — content approval,
- G4 — publication approval,
- G5 — report acceptance and next-step decision,
- G-pay — spend approval.

Doc A also states: human approval for consequential decisions; publication/spending/experiment go/no-go are human-controlled gates; engine may not publish, spend, subscribe, install paid services, or connect new accounts.

### 5.3 Where authority is incomplete or ambiguous

Incomplete or ambiguous relative to a plan that may be written more loosely:

- The repo distinguishes decision record IDs and references (DEC-1-G1, DEC-1-2..6, DEC-1-G2..G5), but the current physical decision-log snapshot only clearly contains DEC-1-G1 in that audit pass; the others are referenced by documents or reported as owner-confirmed-but-not-located. That is a **record-inventory ambiguity**, not necessarily proof that the decisions never happened.
- The S6 governance matrix expressly separates three Owner decision levels:
  - Level 1 — Document Review,
  - Level 2 — Governance Decision,
  - Level 3 — Execution Authorization.
  It also states that Level 1 or 2 does **not** imply Level 3, and that A2 execution requires a separate explicit Owner decision.

So if the Gemini plan assumes “review done = execution authorized,” it is over-reading authority. The repo evidence says review and execution authorization are separate.

### 5.4 Stop/authority completeness verdict

- Stop conditions: substantially present in the repo, but distributed across workflow spec, data model, and MVP source logic; not necessarily consolidated into one plan-facing table.
- Decision authority: substantially present and explicit about gates and human-only approval.
- Missing/ambiguous: exact consolidation of Active/Watchlist/Archive, exact status of some decision record bodies, and any statement that code/existence equals authorization.

---

## 6. Overall scope and authority verdict

- The repo has a coherent, checkable status model, but it is more detailed and gate-bound than a plain “Active / Watchlist / Archive” label suggests. The plan should map its vocabulary onto the repo’s explicit states or define the new terms with entry/exit criteria.
- An Execution Profile built from implementation presence, historical test claims, and screenshots will overstate readiness unless each capability is labeled by evidence class and authorization status.
- Any work touching live publication, live observation, real income conclusion, content library lifecycle changes, or spend above THB 0 is beyond the current Preparation/Phase 1 boundary as evidenced in the repo.
- Stop conditions and decision authority are present, but authority is explicitly not conferred by review alone.

---

*End of ARTIFACT-SOLAR-03. Read-only; no files modified, no external contact, no content created, no repository change.*
