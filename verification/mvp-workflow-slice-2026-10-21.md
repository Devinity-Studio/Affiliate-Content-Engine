# MVP Affiliate Workflow Slice — Verification Record

**Date:** 2026-10-21
**Scope:** the first MVP slice only — `Shopee Affiliate export/fixture → Research → 5 Candidates → Candidate workspace → Plan draft → Impact preview`.
**Verdict:** implemented and exercised on temporary fixture state. **Not** AC-01, **not** SCOPE-1, **not** Mission 1 completion. No gate decision, no publication, no spend, no commit.

> All numbers below come from the recorded runs, not from a design intent. The runner output is in [mvp-workflow-acceptance-2026-10-21.log](mvp-workflow-acceptance-2026-10-21.log).

---

## 1. Commands and results

| Command | Exit | Result |
|---|---|---|
| `node --check app/mvp/service.js` | 0 | no syntax error |
| `node --check app/public/mvp.js` | 0 | no syntax error |
| `node verification/mvp-workflow-acceptance.js` | **0** | **56 / 56 assertions passed** |
| `node verification/foundation-regression.js` | 0 | 19 / 19 passed (unchanged foundation) |
| `node verification/cwi-contract-enforcement.js` | 0 | all CWI contract checks passed |
| `node verification/verify-cwi-endpoint.js` | 0 | 20 cases · 0 failures |
| `node verification/validate-claim-classes.js` | 0 | all claim-class checks passed |
| `node verification/d1-d2-id-semantics.js` | 0 | D1/D2 evidence test passed |
| `node verification/d10-v1-immutability.js` | 0 | D10 evidence test passed |

The acceptance runner copies `app/`, `data/` and `docs/` to a temp directory, starts the server there with `ACE_MVP_STATE_FILE=<temp>/mvp-runtime/fixture-state.json`, and never mounts the real `data/app/state.json`.

---

## 2. Measured behaviour

### 2.1 Import

| Item | Measured |
|---|---|
| `POST /api/mvp/import` | `201` |
| Fixture | `app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv` |
| SHA-256 | `5a929f637cdabbbe7113abb97fe12f20d5b327e4c1e3c75e8adf23211e6e3a87` (matches the file) |
| Row count | 8 |
| Records | 8 Sources · 8 Products · 8 Offers · **72 Evidence** |
| `checked_at` | ISO timestamp on every Source/Product/Offer/Evidence record |
| Provenance | `synthetic: true`, file, row, sha256, method, limitations on every record |
| Re-import same fixture | `200`, `reused: true`, candidates/plan retained |

### 2.2 Candidates

| Candidate | Rank | Ranking | Opportunity | Confidence |
|---|---|---|---|---|
| `CND-1005` Cat Food 1.5kg | 1 | 81 | 78 | HIGH |
| `CND-1001` Vitamin C Serum 30ml | 2 | 66 | 60 | HIGH |
| `CND-1006` Yoga Mat 6mm | 3 | 59 | 53 | HIGH |
| `CND-1002` Sunscreen SPF50 50ml | 4 | 53 | 45 | HIGH |
| `CND-1003` Stackable Storage Box | 5 | 53 | 45 | HIGH |

- Exactly five, unique ids, ranks `1..5`.
- All four claim classes present in **every** candidate (`FACT`, `INFERENCE`, `HYPOTHESIS`, `UNKNOWN`).
- Every claim has a valid class, text and resolvable `evidence_ids`.
- Every candidate has resolvable `source_ids` / `evidence_ids`, ≥3 reasons, `provenance.method = DETERMINISTIC_SCORING`.
- Regenerating twice produced identical ids, ranks and scores.

### 2.3 Workspace actions and persistence

| Step | Result |
|---|---|
| Save `CND-1005` | `200`, `SAVED`, queue `[CND-1005]` |
| Queue `CND-1001`, `CND-1006`, `CND-1003` | `200`, queue `[CND-1005, CND-1001, CND-1006, CND-1003]` |
| Reject `CND-1002` | `200`, `REJECTED`, removed from queue |
| Queue a rejected candidate | `409` |
| Save a rejected candidate | `409` |
| Reorder `CND-1003` up | `200`, queue `[CND-1005, CND-1001, CND-1003, CND-1006]` |
| Remove `CND-1001` | `200`, `NONE`, queue `[CND-1005, CND-1003, CND-1006]` |
| Restart server, same state file | statuses, queue order, scores and evidence intact |
| Restart again after plan creation | plan, statuses and queue intact; draft `FINALISED` |

### 2.4 Plan

| Step | Result |
|---|---|
| Draft from an unsaved candidate | `409` |
| Draft from a rejected candidate | `409` |
| Draft from `CND-1005` | `201`, `PD-1` |
| Draft approaches | 3 generated (`personalized_a`, `personalized_b`, `exploration`), all `AI_DRAFT`; `user_custom: null` |
| Impact preview | changes, `not_done` (incl. CWI), gates, `spend_thb: 0`, `external_calls: 0` |
| Create without `confirmImpact` | `400` with `impact_preview`; state still `plans: 0` |
| Save User Custom | `200`, `approaches.user_custom.origin = USER`, `evidence_ids: []` |
| Generated approaches after custom | still exactly 3, none named `user_custom` |
| Create with `confirmImpact: true` | `201`, `plan_id: MVP-PLAN-1-1`, `id: MVP-PLAN-1-1-v1`, `version: v1`, `status: FIXTURE_DRAFT` |
| `foundation_handoff` | `attempted: false`, `available: false` |
| Plan reload | plan and custom approach intact |

### 2.5 Repository integrity

| File / state | Before = After |
|---|---|
| `data/app/state.json` | `5d29cdbdace0a73580bc2e0633f2e8cb` |
| `docs/mission1/schemas/content-work-item.schema.json` | unchanged |
| `app/mock/opportunities.json` | unchanged |
| `data/mission1/evidence-log.md` | unchanged |
| `data/mvp/` | absent before and after |
| Git HEAD | `9749f38e7bdb1ec6ee56be0e2227473c3b973f2b` (no new commit) |
| Staged files | none |

Temp foundation state was also byte-identical after the run, proving the MVP module never wrote it even inside the copy.

---

## 3. Requirement checklist

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Shopee export or fixture as input | Pass | bundled synthetic fixture + pasted-CSV path |
| 2 | Source/Product/Offer with `checked_at` + provenance | Pass | 8/8/8 records, assertions 8–10 |
| 3 | Analyse price, promotion, commission, reviews, shops | Pass | offer metrics table; 72 evidence rows |
| 4 | 5 candidates with scores, confidence, classes, reasons, ids | Pass | table above; class assertions |
| 5 | Candidate workspace | Pass | `/mvp.html` section 3, manual + DOM checks |
| 6 | Save / Reject / Queue / Remove / reorder | Pass | action matrix; persists across restart |
| 7 | Plan from selected candidate | Pass | draft is `409` for unselected/rejected |
| 8 | Four approaches incl. User Custom | Pass | 3 generated + separate `user_custom` |
| 9 | Impact preview before next step | Pass | confirm gate enforced with `400` |
| 10 | No video, publish or external account | Pass | no such route or action exists |

---

## 4. Manual UI pass

Browser: `http://127.0.0.1:4180/mvp.html`, fixture state at `.tmp/mvp-preview/state.json`.

1. Imported the fixture → 8 sources / 8 products / 8 offers / 72 evidence.
2. Generated 5 candidates → verified all four claim chips and evidence ids on screen.
3. Saved #1 and queued #2 → counts and queue updated.
4. Reordered the queue → order flipped and persisted after reload.
5. Created a plan draft → 3 generated approaches + empty custom card + impact preview.
6. Saved a User Custom angle → radio selected it, generated three unchanged.
7. Confirmed the preview → created `MVP-PLAN-1-1-v1`; boundary box shown.
8. Reloaded → candidate statuses, queue and plan restored.

Screenshots: [candidate workspace](../screenshots/mvp-candidates-narrow.png) · [impact preview](../screenshots/mvp-plan-impact-preview.png).

---

## 4.1 Server isolation audit

Run after the slice acceptance: [mvp-server-isolation-audit.js](mvp-server-isolation-audit.js) → [log](mvp-server-isolation-2026-10-21.log). **31 / 31 checks passed, exit 0.**

| Question | Measured evidence |
|---|---|
| How much did `app/server.js` change for MVP? | Exactly **4 lines** mention MVP: comment L18, `require('./mvp/service')` L20, dispatch L346 and its `return` L347. Only one `/api/mvp/` dispatch exists. |
| Can the dispatch fall through into Foundation? | No. It is the first branch under `if (pathname.startsWith('/api/'))` and returns; Foundation's first route is L351. |
| Are the Foundation handlers still there? | 7 anchors present unchanged: `STATE_FILE`, `readState`, `writeState`, `/api/state`, `/api/plan-version` POST, `/api/content-work-item` POST, `/api/decision` POST. |
| Does the MVP module share Foundation code? | No. It requires only `node:fs/promises`, `node:path`, `node:crypto`; no server/Foundation import, no `fetch`, no `node:http`. Its state path is `ACE_MVP_STATE_FILE` or `data/mvp/fixture-state.json`. |
| Does MVP traffic touch Foundation state? | No. After a full import → plan run, `/api/state` still has empty `decisions`, `planVersions`, `cwis`; temp `data/app/state.json` md5 unchanged (`5d29cdbd…`). |
| Does Foundation traffic touch MVP state? | No. Creating `PLAN-1-1-v1` and `CWI-1` left MVP candidates, queue and plans identical. |
| Do the namespaces overlap? | No. `MVP-PLAN-1-1-v1` is absent from the Foundation plan store, and `GET /api/plan-version/MVP-PLAN-1-1-v1` returns `400` invalid format. |
| Was any pre-existing work staged or committed? | No. `git diff --cached` empty; HEAD `9749f38…`; 9 commits before and after. Only the 8 pre-existing tracked doc edits remain modified. |
| Were those pre-existing docs touched this round? | No. Their newest mtime is `06:01:37Z`; this round's earliest file is `06:56:50Z`. |

**Caveat on git diff:** the whole `app/` directory is untracked in this repository, so git cannot show a baseline diff for `app/server.js`. The audit therefore proves isolation by the literal 4-line footprint, Foundation-anchor presence, and two-way runtime checks — not by `git diff`.

---

## 5. Limitations / not verified

- **Synthetic data only.** No real Shopee export, account, API or market truth.
- **Scores are heuristics.** `mvp-score-v1` ranks fixture fields; it is not a sales forecast, and conversion/payout remain `UNKNOWN`.
- **Single-process locking.** The fixture state lock is an in-process promise queue, not a multi-process guarantee.
- **No experiment downstream.** No EXP/CWI/script/video/publication exists, so no later-stage acceptance is evidenced.
- **D5 not run; D9 not applicable as written; `DEF-CWI-1` remains open.** This slice changes none of them.
- **No accessibility audit**; the page was exercised manually at two viewport widths.
- **No commit** was made, and nothing was staged.

---

## 6. Files added/changed by this slice

| Path | Change |
|---|---|
| [app/mvp/service.js](../app/mvp/service.js) | new — import, records, analysis, candidates, actions, queue, plan, impact preview |
| [app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv](../app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv) | new — synthetic fixture |
| [app/public/mvp.html](../app/public/mvp.html) · [mvp.js](../app/public/mvp.js) · [mvp.css](../app/public/mvp.css) | new — candidate workspace UI |
| [app/server.js](../app/server.js) | delegate `/api/mvp/*`; foundation routes untouched |
| [.gitignore](../.gitignore) | ignore `data/mvp/` and preview scratch |
| [docs/mission1/M-mvp-affiliate-workflow-slice.md](../docs/mission1/M-mvp-affiliate-workflow-slice.md) | new — slice specification |
| [verification/mvp-workflow-acceptance.js](mvp-workflow-acceptance.js) | new — acceptance runner |
| [verification/mvp-workflow-acceptance-2026-10-21.log](mvp-workflow-acceptance-2026-10-21.log) | new — raw run log |
| [app/README.md](../app/README.md) | MVP section and endpoints |
