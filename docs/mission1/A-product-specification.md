# A. Product Specification — Affiliate Content Engine

Status: **DRAFT FOR OWNER APPROVAL** — planning only. Nothing in this document is authorized for implementation until the owner approves the plan (Section: Human approval and permission model).
Version: 1.0 · Date: 2026-10-11

Every claim below is tagged: **[Fact]** (directly supported by reliable evidence, source logged), **[Inference]** (derived from evidence), **[Hypothesis]** (needs testing), **[Unknown]** (unverified). Sources are listed in `docs/mission1/H-evidence-register.md`.

---

## 1. Mission

Build an **AI-assisted Affiliate Content Engine** that helps a single operator in Thailand discover market opportunities, create useful affiliate content, publish it with human approval, measure *real* commercial outcomes, and feed verified evidence back into the next decision cycle.

**Business objective (the objective the system serves, not the system itself):**
Achieve **repeatable net income ≥ THB 1,000 per day**, with a clearly defined net-income calculation and a realistic measurement period.

**Hard constraints (binding):**

| Constraint | Implementation consequence |
|---|---|
| One operator, one computer, existing or free/low-cost tools | No servers, no paid infrastructure. File-based system of record. |
| Revenue Before Recurring Cost | THB 0 recurring spend until evidence justifies it. Any paid commitment requires explicit owner approval in writing. |
| Free quota exhausted → pause and report | Guardrail check at every stage that consumes an external service. Never silently switch to a paid provider. |
| Prefer simple, maintainable architecture | Plain files (Markdown + YAML/CSV) in this repository. No database, no dashboard in Slice 1. |
| Human approval for consequential decisions | Publication, spending, and experiment go/no-go are human-controlled gates. |
| Never invent results | All measurement comes from affiliate-dashboard screens/exports and platform analytics, captured as evidence files with provenance. Automated generation of "success" numbers is prohibited. |

**What success is NOT:** a sophisticated system, high impression counts, or an impressive report. Early success is a **completed end-to-end loop with genuine evidence**, whatever its size.

## 2. Target user

Primary and only user: **the owner/operator** — one person in Thailand, running everything on one computer. Secondary stakeholder roles are played by the same person:

- **Owner (approver):** approves the plan, spending, content, publication, and go/no-go decisions.
- **Operator (executor):** performs research reviews, records evidence, records/publishes approved content, exports dashboard data.
- **AI/system assistant (this engine):** drafts research, analysis, scripts, reports, and bookkeeping — drafts only; never the final approver.

## 3. Core user journey

1. Operator runs a **market scout** (AI-assisted research, human-verified sources) → shortlist of 1–3 opportunities with tagged evidence.
2. Operator reviews the **opportunity analysis** (audience, offer candidates, risks, hypothesis, confidence) → selects ONE offer and defines the experiment (success criteria, duration, budget = THB 0 default).
3. AI drafts a **script/storyboard** for one short-form content asset → operator edits/approves (Gate G3).
4. Operator produces the asset (screen-recording/order-friendly cuts are acceptable; production quality is not the first-slice bottleneck), disclose requirements applied per channel policy.
5. Operator **publishes** through an authorized channel (Gate G4) using an affiliate link from a verified program.
6. Operator captures **result evidence** on a fixed schedule: platform analytics (reach/clicks as available) and affiliate-dashboard data (clicks, orders, commission status fields as displayed, reversals/refunds).
7. At experiment end, AI drafts the **comparison report** (hypothesis vs actuals, net income, learnings) → owner decides **Repeat / Revise / Stop** (Gate G5).
8. Verified outcomes and decision rationale are archived; the next scout cycle uses them as inputs.

## 4. Functional requirements

IDs are referenceable in acceptance criteria (Doc E) and the workflow spec (Doc B).

### FR-1 Market Intelligence
- FR-1.1 Capture every market finding as an **Evidence record** with: source name, URL/reference, retrieval date, exact finding, relevance note, and claim class (Fact/Inference/Hypothesis/Unknown).
- FR-1.2 Classify what is our observation vs. what is *someone else's* published claim. Third-party market observations may never be recorded as proof of our own sales potential.
- FR-1.3 Produce an **Opportunity record**: target audience, problem, candidate offers, why-now reasoning, risks, and confidence level — no numbers presented as forecasts without a stated method.
- FR-1.4 Verify that each listed affiliate program/offer was actually located on the program's own page or the operator's logged-in dashboard; unverifiable "offers" are marked Unknown until seen.

### FR-2 Analysis & Forecast
- FR-2.1 For each shortlisted opportunity, state the **revenue hypothesis** including arithmetic: assumed commission rate, assumed conversion rate, assumed order value — each sourced from evidence or explicitly labeled assumption.
- FR-2.2 State a confidence level (Low/Medium/High) with the reason.
- FR-2.3 Prohibited: advanced forecasting on insufficient data; presenting competitor prices or public demand signals as our sales proof.

### FR-3 Experiment Planning
- FR-3.1 One **Experiment record** per cycle defining: hypothesis, one audience, one offer, one channel, success criteria (pre-registered, numeric, measurable), experiment duration, and cost budget.
- FR-3.2 Cost budget defaults to **THB 0**. Any budget > 0 requires owner approval (Gates G2 and G-pay) before the experiment starts.
- FR-3.3 Success criteria must be achievable-and-discernible from real dashboard data, e.g. "≥ 1 confirmed commission within 14 days", not "go viral".

### FR-4 Script & Storyboard
- FR-4.1 One script/storyboard per experiment, saved with version history.
- FR-4.2 Mandatory content-quality rules: the claim statements in the script must each be traceable to gross-level evidence (e.g., product feature recorded on the product page); no invented testimonials or personal-use stories ("I used this") unless true for the operator.
- FR-4.3 The script must include the affiliate disclosure suitable for the channel (see channel policy notes, Doc C §6) and use only authorized link forms for that channel.

### FR-5 Content Production
- FR-5.1 Asset produced on the operator's computer using existing/free tools (AI-assisted is acceptable).
- FR-5.2 AI-use disclosure must be applied where the channel requires it (e.g., YouTube 'altered content' disclosure; TikTok AI-generated-content label) — based on the per-channel policy checklist (`docs/mission1/C-system-architecture.md` §6), not on memory.
- FR-5.3 Asset file and final edit metadata (what tools were used, what disclosures were applied) are recorded.

### FR-6 QA & Approval
- FR-6.1 **Gate G3 (content approval):** owner reviews against a fixed checklist: claim-to-evidence mapping present, disclosure present, link form authorized, no invented results, no platform-policy conflicts flagged.
- FR-6.2 Approval recorded as a Decision record with date and checklist result. No approval → no publication. Revisions loop back to FR-4/FR-5 with a new version.

### FR-7 Publication & Distribution
- FR-7.1 **Gate G4 (publication):** publishing is a manual operator action inside the platform's own app/site. The engine may prepare a kit (caption, hashtags, link, steps) but must never auto-publish in Slice 1.
- FR-7.2 Publication record stores: platform, exact URL/handle, exact posting timestamp, exact affiliate link used, link form (deep link / bio / tag), and a screenshot of the live post as evidence.
- FR-7.3 Only link forms that the channel policy has been verified to allow may be used. If a channel restricts a link form, alternative (e.g., profile link) is used, or the channel is skipped and that fact recorded.

### FR-8 Results Tracking & Measurement
- FR-8.1 Scheduled observation: at minimum D+3, D+7, and experiment end, capture (a) post-level reach/engagement from the platform's own analytics where available and (b) affiliate-dashboard rows: clicks, orders, commission status fields **as displayed**, reversals/refunds, and paid-out amounts — raw values captured verbatim, then mapped to normalized metrics per Doc D §6.
- FR-8.2 Each observation is a **Result observation record** with: date/time captured, source (which dashboard/report), method (screenshot/export/manual copy), values, and open questions.
- FR-8.3 Financial classification is mandatory. Raw dashboard values are recorded verbatim (field name, report, status label, amount, currency — Obs record §Doc D 3.7) and mapped into the normalized metrics of Doc D §6: **M1 normalized confirmed net commission** and **M2 cash received**; objective net income = M1 − direct costs. Refunds/reversals are subtracted **at most once** per transaction; pending or declined commissions never count as earned income; dashboard-attributed amounts never count as cash until actually paid out. Where a program's field semantics are Unknown, the net-income verdict is 'not yet measurable' until verified from the dashboard itself (Doc G OQ-8).

### FR-9 Analysis, Learning & Reporting
- FR-9.1 At experiment end, produce a **Cycle report** comparing: hypothesis vs actuals, with each line tagged Fact/Inference/Hypothesis/Unknown; unknowns and data gaps listed; recommendation (Repeat/Revise/Stop) with rationale — drafted by AI, decided by owner.
- FR-9.2 The THB 1,000/day target is assessed **only** over a defined measurement window (Doc G OQ-1) using the normalized net-income metrics (Doc D §6), and reported as "achieved / not achieved / not yet measurable" — never inferred.
- FR-9.3 Learnings feed the next cycle only as tagged records; raw speculation without evidence is not carried forward.

### FR-10 Foundation (shared system)
- FR-10.1 **Evidence & source log**, FR-10.2 **workflow state**, FR-10.3 **experiment & decision records**, FR-10.4 **version history**, FR-10.5 **cost & budget guardrails**, FR-10.6 **run history & error recovery** — specified in Docs C/D; each stage of Doc B declares which of these it reads and writes.

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Simplicity:** all state must be human-readable plain text/CSV, inspectable without special tooling. |
| NFR-2 | **Auditability:** every consequential statement in any report must trace to an Evidence record ID or be explicitly tagged Unknown. |
| NFR-3 | **Cost safety (functional):** no stage may perform a paid action; cost-estimate fields exist on every stage and are checked against the budget record before execution. |
| NFR-4 | **Resumability:** after any failure or interruption, the workflow state file is sufficient to resume without redoing approved work. |
| NFR-5 | **Operator maintainability:** the full loop must be executable by one person with ≤ 2–3 hours of work/day on a bad day; automation must reduce work, never create a dependency that silently stalls the loop. |
| NFR-6 | **Privacy/security:** no personal data collected from third parties; no platform passwords stored in project files; evidence files must not include account credentials. PDPA-relevant only if/when we collect personal data (we do not plan to in Slice 1). |
| NFR-7 | **Evidence integrity:** captured screenshots/exports stored read-only; never edited to alter values. |
| NFR-8 | **Compliance:** content must satisfy: affiliate disclosure per channel policy, AI-use disclosure per channel policy, Thai Consumer Protection Act constraint on misleading claims (no false/exaggerated statements), and any campaign-level promotion restrictions found in the program terms. Reviewed per channel via the per-channel policy checklist (`docs/mission1/C-system-architecture.md` §6); unknowns carried to Doc G. |

## 6. In scope / out of scope

### In scope (Slice 1)
- Market scout on ONE narrow niche (operator-selected from a shortlist), evidence-tagged.
- One offer on ONE affiliate program already joined by the operator (or joinable without spend).
- One scripted short-form content asset (vertical video ≤ 60s or a rich post), AI-assisted, human-approved.
- One publication, manual, on ONE owned channel.
- Manual scheduled measurement from platform + affiliate dashboards (no integrations assumed beyond what is already verified per account).
- One cycle report + owner decision (Repeat/Revise/Stop).
- Foundation items: evidence log, workflow state, experiment/decision records, version history, cost guardrails, run history — at file-level fidelity only.

### Out of scope for Slice 1 (each item's dismissal reason)
- Multi-channel orchestration, multiple simultaneous experiments, multi-agent orchestration.
- Any automated publishing, any API integration not required for evidence capture (and even that is manual in Slice 1).
- Dashboards/BI beyond the markdown cycle report.
- Paid ads or any spending without a pre-approved budget (default THB 0).
- Any feature that does not materially validate a revenue hypothesis (contents of the Future Considerations registry in Doc F §7).

## 7. Human approval & permission model

Approval is a human action by the Owner, recorded as a **Decision record** in the log. Each gate blocks the workflow until approved or explicitly rejected-with-reason.

| Gate | Blocks | Owner must confirm |
|---|---|---|
| **G1 — Plan approval** | Operational execution (definition below) | Approve this spec (incl. budget = THB 0 default) before operational execution begins. |
| **G2 — Experiment approval** | Going from analysis to experiment execution | Niche, offer, program, channel, success criteria, duration, cost budget (THB 0 unless explicitly changed). |
| **G3 — Content approval** | Production → publication | Claim-evidence mapping, disclosure, authorized link form, quality bar, no invented results. |
| **G4 — Publication approval** | Actual publishing action | Platform, URL, timestamp, link to be published. (Owner may also *perform* the publish as part of this gate; the engine records the evidence.) |
| **G5 — Report acceptance & next-step decision** | Loop closure; unlock the next cycle | Accept the cycle report; choose Repeat / Revise / Stop, recorded with rationale. |
| **G-pay — Spend approval** | Any action that creates a cost | Required for any planned payment; default state is deny. Approval record must state amount, purpose, and expected evidence to measure return. |

### Definition — pre-G1 work vs. operational execution

To reconcile Gate G1 with Doc B Stages 1–2 (research-only, pre-G1):
- **Pre-G1 work is limited to non-binding planning and public-source research** performed manually with existing/free tools. It may prepare draft evidence, analyses, and candidate opportunities.
- It **cannot** authorize or perform: program enrollment/joining, platform account creation or changes, final content production, publication, paid activity, or any irreversible/account-affecting action.
- **G1 approves the plan before operational execution proceeds.** G2 separately approves a specific experiment. G-pay is mandatory for any spending.
- This policy was proposed for consistency across Docs A/B/E and **confirmed by the Owner (Record G1-A, Doc G §2a) on 2026-10-11**.

### Permission boundaries for the AI/engine
- The engine **may**: draft research, analyses, scripts, reports, bookkeeping; run free/local tools; record proposed (not final) states.
- The engine **may not**: publish anything, delete/patch results or evidence, prompt-free authorize itself through G2–G5, spend money, subscribe to services, install paid services, or connect new accounts. Doing any of these is a workflow **failure condition** (halt + report to owner).
