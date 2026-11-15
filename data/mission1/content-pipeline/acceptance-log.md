## Run ACE-M1-CONTENT-ACCEPT-20261103-01

**Record type:** Content Pipeline Acceptance (MVP Content Creation slice).
This is **not** a G-13 Content Library E2E run: no Export and no video
rendering were executed. See §7 for the schema note.

### 1. Run identity

| Field | Value | Source |
|---|---|---|
| Branch | `mission1-planning-docs` | git (live) |
| HEAD before run | `1b55de0e0d707d7f95f21d43fdc59b012e9ded96` | git rev-parse HEAD at start |
| HEAD after run | `1b55de0e0d707d7f95f21d43fdc59b012e9ded96` (unchanged) | git rev-parse HEAD at end |
| Commit count before / after | 13 / 13 | `git rev-list --count HEAD` |
| Command | `node verification/mvp-workflow-acceptance.js` | terminal transcript |
| Exit code | **0** | terminal transcript |
| Assertions | **86 total · 86 passed · 0 failed** | raw log, line 171 |
| New assertions added by this change | **30** (harness sections 10–15) | count of `check(` calls in the added block |
| Raw log | `.tmp/mvp-acceptance-run.log` — 23,895 bytes, 174 lines, sha256 `d35f9eb362808257341c1e19771be43589d5c1d6894f30808a73a456984f9c5d` | filesystem (raw log is git-ignored) |
| Harness start timestamp | `2026-11-03T06:00:07.317Z` | raw log line 2 |
| Log mtime (finish, local) | `2026-11-03 13:00:09 +0700` | filesystem metadata only |
| Temp workspace | `C:\Users\bomb_\AppData\Local\Temp\ace-mvp-acceptance-qtPaY2` (removed by the harness on exit) | raw log line 6 |

### 2. Files changed

| File | Change | Git state |
|---|---|---|
| `verification/mvp-workflow-acceptance.js` | Added sections 10–15: content project from plan and from candidate, QA, REVIEW, finalize, publish-prep-before-export, reload persistence | untracked before and after (pre-existing state) |
| `data/mission1/e2e-log.md` | This append-only block | tracked |

No Product Code, requirement, contract, schema or unrelated verification file
was modified. `git status --porcelain` held 170 entries before and after the
run, and the only tracked-modified files remained the pre-existing
`M app/mvp/content.js` and `M app/mvp/service.js` (not touched by this run).

### 3. Assertions added and expected behaviour

| # | Assertion | Expected behaviour |
|---|---|---|
| 1 | content project is created from the plan with 201 at DRAFT | `POST /api/mvp/content/draft` with a plan id returns 201, status `DRAFT` |
| 2 | content project keeps Content / Product / Candidate / Shop identities | `content_id`, `product_id`, `candidate_id`, `shop_id`, `offer_id` all present and linked to the plan candidate |
| 3 | content project traces back to the plan and the synthetic source | `plan_id`, `plan_record_id`, `synthetic: true`, `provenance.method = DETERMINISTIC_TEMPLATE_FROM_EXPORT` |
| 4 | content project starts with three generated approaches and a 9:16 storyboard | 3 approaches with `origin: GENERATED`; canvas 1080×1920; at least 4 scenes |
| 5 | every scene carries overlay text, a voiceover line and evidence ids | every scene has a headline, voiceover text and non-empty `evidence_ids` |
| 6 | content draft records zero external calls and zero spend | `boundary.external_calls = 0`, `spend_thb = 0`, `real_state_touched = false` |
| 7 | content project is created from a saved candidate | `POST /api/mvp/content/draft` with `candidateId` (SAVED) returns 201, `DRAFT`, `plan_id: null` |
| 8 | content project from a rejected candidate is refused with 409 | a REJECTED candidate is not a valid content source |
| 9 | content list exposes both projects and the five documented statuses | `GET /api/mvp/content` lists 2 projects; statuses `DRAFT, REVIEW, FINALIZED, EXPORTED, READY_TO_PUBLISH` |
| 10 | QA runs and returns a report on the DRAFT project | `POST /api/mvp/content/:id/qa` returns 200 with non-empty `qa.checks` |
| 11 | QA covers spelling, price, promotion, product name, CTA, evidence and external scope | all documented categories present in the report |
| 12 | QA summary counts every check and agrees with blocking | `PASS+WARN+FAIL = checks.length`; `passed === (FAIL === 0)`; `blocking.length === FAIL` |
| 13 | QA finds no blocking failure on the generated content | `qa.summary.FAIL === 0` (measured `PASS 13 · WARN 0 · FAIL 0`) |
| 14 | QA result is stored on the project and does not change its status | project stays `DRAFT`; `project.qa.ran_at` equals the report timestamp |
| 15 | finalize before REVIEW is refused with 409 | REVIEW is a required prerequisite |
| 16 | DRAFT transitions to REVIEW | `POST /review` returns 200 and status `REVIEW` |
| 17 | the REVIEW transition is recorded in the edit log | edit log contains `ส่งเข้าการตรวจ` |
| 18 | a second REVIEW transition is refused with 409 | the status machine moves one step at a time |
| 19 | REVIEW transitions to FINALIZED with 200 | `POST /finalize` returns 200 and status `FINALIZED` |
| 20 | finalize runs the full checklist and every item passes | at least 8 items, `passed: true`, `ok === total`, and ids `qa, preview, scenes, cta, evidence, duration, language, script_version, identities` all ok (measured 11/11) |
| 21 | finalize checklist relies on a QA result with no blocking failure | the `qa` item is ok and its detail reflects the measured PASS count |
| 22 | finalize records the script version, checksum and QA timestamp | `finalize.script_version`, `script_checksum` equal to the script checksum, parseable `qa_ran_at` equal to `project.qa.ran_at` |
| 23 | finalize keeps the QA report on the project with no blocking failure | `project.qa.passed === true`, `FAIL === 0` |
| 24 | finalizing a FINALIZED project again is refused with 409 | finalize requires REVIEW |
| 25 | publish prep before export is refused with 409 | `POST /publish-prep` on FINALIZED returns 409 |
| 26 | the refusal names the EXPORTED requirement | error text `publish preparation requires an EXPORTED project (current status FINALIZED)` |
| 27 | a refused publish prep changes no status and writes no payload | project stays `FINALIZED`, `publish_prep = null`, `export = null` |
| 28 | finalized content survives reload with its QA and checklist | after restart, status `FINALIZED`, QA preserved, checklist passed |
| 29 | content list still holds both projects after reload | both projects survive the restart |
| 30 | pre-existing integrity and commit assertions still pass | records that they ran in the same execution; not a new assertion |

### 4. Isolation and repository-state preservation (measured)

| Check | Result |
|---|---|
| Temporary-workspace isolation established | PASS — the harness copied `app/`, `data/`, `docs/` to an OS temp directory and started the server there with `ACE_MVP_STATE_FILE` inside that temp directory; assets and exports resolve beside it |
| Fixture state written to the configured temp file | PASS |
| Temp foundation `data/app/state.json` byte-identical | PASS (MVP never wrote it) |
| Real `data/app/state.json` byte-identical | PASS — md5 `5d29cdbdace0a73580bc2e0633f2e8cb` |
| Real schema / mock / evidence-log byte-identical | PASS |
| Real `data/mvp` fixture state not created or changed | PASS (pre-existing content unchanged) |
| No commit created during the run | PASS — HEAD `1b55de0` before and after |
| Nothing staged during the run | PASS — `git diff --cached --name-only` empty |

### 5. Observed HTTP results (from the raw log)

| Step | Status / result |
|---|---|
| `POST /api/mvp/content/draft` (plan) | 201, `CNT-1`, `DRAFT` |
| `POST /api/mvp/content/draft` (saved candidate) | 201, `CNT-2`, `DRAFT` |
| `POST /api/mvp/content/draft` (rejected candidate) | 409 |
| `POST /api/mvp/content/CNT-1/qa` | 200, `PASS 13 · WARN 0 · FAIL 0` |
| `POST /api/mvp/content/CNT-1/finalize` while `DRAFT` | 409 |
| `POST /api/mvp/content/CNT-1/review` | 200, `REVIEW` |
| `POST /api/mvp/content/CNT-1/review` again | 409 |
| `POST /api/mvp/content/CNT-1/finalize` | 200, `FINALIZED`, checklist 11/11 |
| `POST /api/mvp/content/CNT-1/finalize` again | 409 |
| `POST /api/mvp/content/CNT-1/publish-prep` before export | 409, `publish preparation requires an EXPORTED project (current status FINALIZED)` |
| `GET /api/mvp/content/CNT-1` after restart | 200, `FINALIZED` with QA and checklist intact |

### 6. Limitations

- Export / video rendering was excluded by authorization, so the successful
  `EXPORTED → READY_TO_PUBLISH` path was not exercised; only the documented
  409 guard was asserted.
- The raw log lives under git-ignored `.tmp/`, so it is local-only evidence and
  is not part of this append. The harness file is untracked, so "30 new
  assertions" is counted from the added block rather than from a git diff.
- Spelling QA is a heuristic against the system's own lexicon (the report's
  `scope_note` says a human must re-check); this block does not claim
  proofreading or publication readiness.
- No staging, no commit and no remote operation occurred for this run.

### 7. Schema note for this file

The header of this file describes G-13 Content Library E2E run blocks. This
block is recorded here because the authorization named this file, and it is
labelled with a distinct run type (`Content Pipeline Acceptance`). It contains
no Content Library or export evidence. The Owner may decide whether it belongs
here or should move to a content-pipeline verification record.
