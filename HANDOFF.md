# ACE — Handoff (Mission 1 vertical slice + MVP affiliate workflow)

**Project:** Affiliate Content Engine (ACE)
**Branch:** `ace-mvp-repair-2026-11-09`
**Handoff date:** 2026-11-10
**Written against:** HEAD `f7f2af6` plus the documentation commit that carries this file
**Status in one line:** the MVP workflow, the A1 article preview slice, the OpenRouter Gate 3 implementation and **Gate 4 (live API test)** are **implemented and verified — Gate 4 PASSED on 2026-11-10 with a live Thai draft at THB 0**; the live draft is still not publishable copy, and **Mission 1 itself is still not complete**.

This file replaces the 2026-10-21 handoff. That version is obsolete — the runtime gained an MVP slice, an A1 article slice and the Gate 3 provider path since it was written. Do not treat its statements about `package.json`, the endpoint list or the working tree as current.

---

## 0. Scope of this handoff

It records the verified state of the **committed** tree and names everything that is not verified. It does not approve any gate, and it does not declare Mission 1 or the MVP complete.

The working tree still carries a large untracked corpus (documents, verification evidence, the `tmp/` MAI-S1 set). That corpus is **project work, not junk** — it has not been deleted and must not be swept up by a `git clean` or an "untracked files" cleanup.

---

## 1. Where the project stands

### 1.1 Mission 1 gates

| Gate | State |
|---|---|
| G1 — Opportunity decision | Implemented (classic slice) |
| G2, G3, G4, G5 | **Not implemented** — the classic slice is G1 plus a decision UI, and never records a gate approval |

The server records OPPORTUNITY decisions only. No gate approval is ever inferred from a decision.

### 1.2 The three slices that exist

| Slice | Entry point | What it does |
|---|---|---|
| Classic Mission 1 | `/` | Mock opportunity list, SELECT / REJECT / DEFER, plan versions, CWI records |
| MVP affiliate workflow | `/mvp.html`, `/api/mvp/*` | Import → research → 5 candidates → plan → storyboard/script/CTA → Thai QA → finalize → render 9:16 MP4 → Content Library |
| A1 article prototype | `/review/:slug`, `/media/:contentId/:file` | One synthetic content record rendered as an article for local review; `DRAFT` and `PREVIEW` only, no publish state |

### 1.3 Provider / AI gates (OpenRouter)

| Gate | State | Record |
|---|---|---|
| Gate 1 — OpenRouter as first AI Provider | APPROVED | — |
| Gate 2 — Proof Contract v0.1 | APPROVED | — |
| Gate 3 — Implementation | **PASS** | `verification/ace-mission1-openrouter-gate3-owner-pass-2026-11-10.md` |
| Gate 4 — Live API Test | **PASS** (`LIVE_LLM`, validation ok, THB 0) | authorization: `…-gate4-owner-authorization-2026-11-10.md`; first result (finding): `…-gate4-result-2026-11-10.md`; PASS: `…-gate4-pass-2026-11-10.md` |

The Script Draft provider path is opt-in and fallback-safe: without `useLlm: true` the deterministic builder runs exactly as before, and `ACE_LLM_LIVE_ENABLED` is unset by default, so a key alone cannot spend anything.

---

## 2. What shipped in this pass

| Commit | Content |
|---|---|
| `2532089` feat — opt-in OpenRouter script draft | `app/mvp/provider/openrouter.js`, `app/mvp/provider/provenance.js`, provider section in `app/mvp/content.js`, opt-in wiring in `app/mvp/service.js`, `.env.example` |
| `357b33c` test — Gate 3 offline suites | `verification/openrouter-gate3-{offline,route,script-validation}-check.js` + their logs |
| `f7f2af6` docs — Gate 3 evidence chain | the readiness brief, ratification, implementation and validation reports, the two reconciliations, plus the Gate 3 PASS decision record |
| this commit | `HANDOFF.md` rewrite, the Gate 4 authorization record |

Nothing was pushed. The Gate 3/Gate 4 records follow the append-only convention: the earlier "not authorized" documents are left unedited and superseded by a new entry, never rewritten.

---

## 3. Verified — re-run on this tree (2026-11-10)

| Suite | Result | Notes |
|---|---|---|
| `verification/openrouter-gate3-offline-check.js` | 21/21, exit 0 | provider + provenance behaviour, key never appears in output |
| `verification/openrouter-gate3-route-check.js` | 6/6, exit 0 | opt-in route refuses egress without the interlock, 0 requests |
| `verification/openrouter-gate3-script-validation-check.js` | 20/20, exit 0 | fabricated prices/discounts/claim categories rejected |
| `verification/mvp-workflow-acceptance.js` | 86/86, exit 0 | through FINALIZED, no FFmpeg needed, 0 commits created |
| `verification/site-article-acceptance.js` | 18 passed, 0 failed, exit 0 | one check is MANUAL: layout inspected at 375/416/622 px on 2026-11-09 |
| `verification/check-content-library.js` | index parses, 0 entries, exit 0 | no export has been registered in the real index yet |
| `node --check` on the four edited runtime files | passed | — |
| FFmpeg resolution | available (`.tmp/tools/.../ffmpeg.exe`) | video export path is usable on this machine |
| Gate 4 preflight sequence (temp state, interlock off) | import/generate/select/SAVE `201`-`200`, draft `201` with `missing_credential` fallback, `external_calls: 0`, `spend_thb: 0` | proves the runbook in the Gate 4 record; no egress |
| Gate 4 live run #1 (temp state, interlock on, 1 request) | `executionMode: LIVE`, `external_calls: 1`, `spend_thb: 0`, 773 ms, `fallbackReason: empty_response` → deterministic template, `201` | transport, credential and containment proven; no usable text. Bundle: `verification/evidence/openrouter/6b3bb618-…/` |
| Gate 4 diagnostic sequence + PASS (6 further requests) | request #7: `source: LIVE_LLM`, `status: success`, `validation.ok: true`, `usage` 475/258, 734 ms, `external_calls: 1`, `spend_thb: 0` | **Gate 4 PASS.** Cause of #1 measured as reasoning-token exhaustion; fixed with `reasoning: { enabled: false }` and a 1200 ceiling. Bundle: `verification/evidence/openrouter/fb1e140c-…/` |

All suites build their own temporary workspace and assert that the real state files are byte-identical afterwards.

---

## 4. Not verified — do not treat these as done

1. **REAL SHOPEE EXPORT PENDING.** No real Shopee Affiliate export exists in this workspace; `data/imports/` is empty. The importer's column mapping is provisional until a real file is supplied (`node verification/real-shopee-export-check.js`, exit 2 = pending).
2. **The live draft is not publishable copy.** It is a fixture-data draft whose per-scene lines remain deterministic (`lines_source: TEMPLATE`), narration is still absent, and no human has reviewed it as copy. The accepted Thai text lives only in an untracked evidence bundle.
3. **An unexplained body-read anomaly.** At a 2400-token ceiling, requests #2–#4 returned HTTP 200 with a body that could not be read (`bodyError: true`, `content-type: application/json`), while the same endpoint at 700 and 1200 tokens parsed normally. Cause not established; it is recorded as an open observation in the Gate 4 PASS record, not as a failure, because the passing configuration does not exhibit it.
4. **`DEF-CWI-1` — CWI creation is not concurrency-safe.** `POST /api/content-work-item` does its read-modify-write outside the state lock: two concurrent creates can receive the same `CWI-<n>` and one record is lost. Reported, not fixed.
5. **OQ-8** — mapping dashboard fields to commission statuses is blocked on affiliate-account access.
6. **CWI acceptance case D5** is still `NOT RUN`; it now needs a `type` in the request body.
7. **`ACE-MAI-S1` Phase A** is `PROPOSED — PENDING OWNER REVIEW` (`ACE-MAI-S1-PHASE-A-PREPARATION-PLAN.md`). Its supporting v0.2 documents sit untracked in `tmp/`.
8. **Narration is not synthesised** — scenes are silent unless audio is uploaded.
9. **No publication path exists.** No sitemap, robots policy, click tracking or public route.
10. **Documentation gap on the CWI entity.** The 2026-10-21 handoff recorded `docs/mission1/D-data-model.md` §3.13 (the CWI entity) as added. No committed revision of that file contains a §3.13, the file on disk has no CWI section, and the schema file it was meant to point at does exist (`docs/mission1/schemas/content-work-item.schema.json`). Treat the schema file as the contract and the Doc D section as **not written**.

---

## 5. Gate 4: authorized, blocked on one missing input

The approved package (one request, `nvidia/nemotron-3.5-lightning:free`, ≤700 output tokens, ≤8,000 prompt characters, THB 0, fixture data only, Owner-operated) and the exact commands are in
`verification/ace-mission1-openrouter-gate4-owner-authorization-2026-11-10.md` §5.

**Gate 4 has since PASSED.** The Owner supplied the key locally in `.env` (which the runner lifts into the process environment; the app itself has no `.env` loader) and authorized a diagnostic re-run plus a package amendment. Request #7 returned `LIVE_LLM` text that ACE's validator accepted, at THB 0.

The decisive measurement: the configured model is a reasoning model, and for such models `max_tokens` covers reasoning plus visible output — at 700 tokens the whole budget went to reasoning (`finish_reason: length`, `content: null`, 2,187 reasoning characters). `reasoning: { exclude: true }` does **not** help, because those tokens are still billed and still count against `max_tokens`; `reasoning: { enabled: false }` is the switch that works. Both facts are now baked into the provider defaults (1200-token ceiling, reasoning disabled) with the evidence in the code comment.

Full chain: `verification/ace-mission1-openrouter-gate4-result-2026-11-10.md` (the finding) and `verification/ace-mission1-openrouter-gate4-pass-2026-11-10.md` (the PASS, including the anomaly in §3 of that record).

After any run: `unset ACE_LLM_LIVE_ENABLED` to return to the no-egress default. The runner does this itself.

---

## 6. Working-tree hygiene

- **Source-file backups were removed from the tree** on 2026-11-10: 7 `app/mvp/service.js.*` and 3 `app/server.js.*` copies from the October repair rounds. They are **quarantined**, not destroyed, in `.tmp/quarantine-2026-11-10/` (git-ignored) because some October intermediate states are not in Git history. Deleting that folder is safe once nobody wants them.
- **`tmp/` is not junk** — it holds the ACE-MAI-S1 v0.2 document set.
- **`app/exports/CNT-1/`** holds one rendered MP4 from 2026-10-28. It is untracked runtime output sitting in a source directory; content exports belong under `data/mvp/exports/`. It was left in place because it may be cited by the A1 evidence.
- A large untracked corpus remains under `verification/`, `docs/`, `app/` and the repository root. Decide its tracking status deliberately; do not bulk-add it and do not bulk-delete it.

---

## 7. Constraints that must not break

- **THB 0 floor.** No revenue below zero, no rounded placeholder. Unknown is not `0`.
- **Gates stay manual.** The server records decisions only; no gate approval is auto-issued or inferred.
- **No auto-publish.** Nothing publishes to a channel on its own.
- **Mock stays labelled.** Served candidate data is mock/fixture and must stay visibly labelled in API and UI.
- **Append-only records.** Evidence log, decision history, run history, and governance decision records. A correction is a new entry that references the old one.
- **Evidence discipline.** Nothing enters the evidence log before it was inspected; a submission is `PENDING`, never `VERIFIED`.
- **Runtime stays dependency-free.** `package.json` exists (start script plus optional `@posthog/ai` / `posthog-node`, which no runtime module requires), and the app runs with no `npm install`. Do not add a runtime dependency without an Owner decision and a README update.
- **The deterministic content path stays the default.** Any provider path is opt-in, fallback-safe, and must never mutate the deterministic output.
- **The key never leaves the process.** Not logged, not in a trace, not in an error, not in a file.

---

## 8. Where to start

1. `README.md` — how to run the app, the workflow steps, the data locations, the troubleshooting table.
2. `app/README.md` — architecture and the full endpoint list.
3. `docs/mission1/` — the Mission 1 specification set (A–K); `D-data-model.md` §3 for entities 3.1–3.12, and `docs/mission1/schemas/content-work-item.schema.json` for the CWI contract (see §4.10 — the CWI section the previous handoff reported in Doc D is not there).
4. `verification/ace-mission1-openrouter-gate4-owner-authorization-2026-11-10.md` — if the next step is the live test.
5. The suites in §3 — they are the acceptance contract in executable form.

---

## 9. Next steps, in order

1. **Decide what to do with the Gate 4 evidence bundle** (may its accepted Thai draft be committed?) and whether to chase the 2400-ceiling body-read anomaly. Then decide whether a live draft may ever reach `FINALIZED` without a human reading it — today nothing forces that review.
2. **Supply a real Shopee export**, then run `node verification/real-shopee-export-check.js <path>` and correct the alias catalogue against a real header.
3. **Fix `DEF-CWI-1`** (bring CWI create inside the state lock) and re-run the D5 case with a `type`.
4. **Review the ACE-MAI-S1 Phase A plan** and decide whether Phase A starts.
5. **Decide the tracking status of the untracked corpus** — which documents and evidence files are repository content and which are local working material.

---

## 10. Open questions that need an Owner decision

| ID | Question | Recommendation |
|---|---|---|
| OQ-A | Closed set of CWI `decision` values (only `PENDING` observed) | Fix the vocabulary in `D-data-model.md`, then narrow schema and server together |
| OQ-D / OQ-8 | Dashboard-field to commission-status mapping; blocked on account access | Keep the gap visible; never infer field names from terms text |
| OQ-E | Stay with the in-process JSON Schema subset, or adopt `ajv` | Stay zero-dependency until full-schema coverage is genuinely needed |
| — | Live price-fidelity rule for an accepted live draft | The Gate 3 validator already runs on the live path; confirm that is sufficient |
| — | Evidence retention for `verification/evidence/` | Keep it uncommitted until reviewed; accepted Thai copy is not casual repository content |
