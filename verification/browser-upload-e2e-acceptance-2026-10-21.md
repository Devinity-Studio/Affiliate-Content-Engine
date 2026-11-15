# Browser Upload E2E — Verification Record

**Date:** 2026-10-21
**Scope:** the browser upload path only — `file selected in the browser → preview → confirm → staging → Research → Source Library`, plus the refusal paths for invalid uploads, on a real Chromium against a throwaway copy of the app.
**Verdict:** the browser upload path is exercised end to end in a real browser engine and every assertion passes. **Real Shopee Import is NOT verified** — every file used is a SYNTHETIC-labelled fixture. One real product defect was found and fixed (`.txt` accepted as CSV). No gate decision, no publication, no spend, no commit.

> All numbers below come from the recorded runs, not from a design intent. Raw runner output is in [browser-upload-e2e-2026-10-21.log](browser-upload-e2e-2026-10-21.log).

---

## 1. Commands and results

All five suites were re-run on 2026-10-21 between 15:03Z and 15:11Z, against the final state of the tree (the product fix and every harness fix were in place before the last run of each suite).

| Command | Exit | Result | Log |
|---|---|---|---|
| `node verification/browser-upload-e2e.js` | **0** | **58 / 58 assertions passed** | [browser-upload-e2e-2026-10-21.log](browser-upload-e2e-2026-10-21.log) |
| `node verification/import-source-acceptance.js` | **0** | **83 / 83 assertions passed** | [import-source-acceptance-2026-10-21.log](import-source-acceptance-2026-10-21.log) |
| `node verification/mvp-workflow-acceptance.js` | **0** | **56 / 56 assertions passed** | [mvp-workflow-acceptance-2026-10-21.log](mvp-workflow-acceptance-2026-10-21.log) |
| `node verification/foundation-regression.js` | **0** | **19 / 19 assertions passed** | [foundation-regression-2026-10-21.log](foundation-regression-2026-10-21.log) |
| `node verification/mvp-server-isolation-audit.js` | **0** | **0 failures** (isolation checks) | [mvp-server-isolation-2026-10-21.log](mvp-server-isolation-2026-10-21.log) |

The browser suite copies `app/`, `data/` and `docs/` into a temp directory, starts the server there with `ACE_MVP_STATE_FILE` / `ACE_MVP_STAGING_FILE` pointing into the temp directory, and drives a real Chromium over the Chrome DevTools Protocol. The real `data/app/state.json` is never mounted.

**Browser used:** Chromium `Chrome/151.0.7922.34` (`HeadlessChrome/151.0.0.0`), driven through CDP. No npm dependency — Node's built-in `WebSocket` + `fetch` only.

**How the upload is exercised:** the file is attached to the page's real `<input type="file">` with CDP `DOM.setFileInputFiles`, so Chromium reads the bytes from disk and the app consumes them through the same `file.arrayBuffer()` path a human upload uses. **No step calls the import API directly to simulate an upload**; the only scripted calls are UI clicks and network capture of the requests the page itself made.

---

## 2. Measured behaviour, step by step

| Step | What was done in the browser | Measured result | Log |
|---|---|---|---|
| 0 | Server + Chromium start, page loads | server healthy; CDP exposed; real file input present | [L10-L14](browser-upload-e2e-2026-10-21.log#L10-L14) |
| 1 | Select the synthetic CSV in the file input | preview `200`; hash `eba833cf…` and size `2149` match the bytes on disk; 8 rows classified `valid 8 / invalid 0 / unknown 0`; preview card visible and states nothing was written | [L18-L33](browser-upload-e2e-2026-10-21.log#L18-L33) |
| 2 | Nothing else clicked | no staging file, no research state file, temp Foundation state untouched | [L36-L38](browser-upload-e2e-2026-10-21.log#L36-L38) |
| 3 | Fill account / from / to / confirm checkbox in the UI | all four fields accepted by the page's own handlers | [L41](browser-upload-e2e-2026-10-21.log#L41) |
| 4 | Click **Import to staging** | `201`; staged import records the uploaded file hash, the account label, the date range, per-row counts and `source_validation: PASSED`; staging file holds exactly 1 import with 8 per-row statuses; Research still untouched | [L44-L60](browser-upload-e2e-2026-10-21.log#L44-L60) |
| 5 | Select the **same file again** and confirm | duplicate handled (`201`, import updated in place); staging still holds exactly 1 import | [L63-L71](browser-upload-e2e-2026-10-21.log#L63-L71) |
| 6 | Click the promote control in the page | promote `201`; response carries exactly 5 candidates; research state file created with the uploaded file hash; 8 products · 8 offers · 72 evidence; every offer carries the contracted fields, the same file hash, its own row number (`2..9`) and the source type | [L105-L121](browser-upload-e2e-2026-10-21.log#L105-L121) |
| 7 | Open the **Research** step in the pipeline | Source Library shows the source id `SRC-EXPORT-EBA833CF`, the file hash, the record counts, the linked candidates, the synthetic badge and the `Source → Candidate trace` | [L124-L130](browser-upload-e2e-2026-10-21.log#L124-L130) |
| 8 | Upload four bad files through the **same** file input | `.txt` → `415`; legacy `.xls` → `415`; empty file → `400`; incomplete header → `200` preview with the unmapped required fields named and the import button disabled. None of the four changed the staging file or the research state (compared by md5 of the files on disk) | [L141-L166](browser-upload-e2e-2026-10-21.log#L141-L166) |
| 9 | End of run | real `data/app/state.json` byte-identical, real `app/`, `data/`, `docs/` byte-identical, `data/mvp` not created, Git HEAD unchanged, nothing staged | [L169-L175](browser-upload-e2e-2026-10-21.log#L169-L175) |

The `.txt` refusal is visible in the UI, not only in the HTTP status: the page renders a `.notice-error` element and raises an error toast, both carrying the same message. That was captured by the debug block retained for this round (see §6).

---

## 3. Product defect found and fixed

**Defect `IMP-EXT-1` — a plain-text `.txt` file was silently parsed as CSV.**

`detectFormat()` mapped the `.txt` extension to the CSV reader, so a text file that is not a spreadsheet produced a **successful** preview (`200`) with a plausible-looking mapping, and the UI showed no error at all. A user dragging a notes file into the upload box was told the file was fine.

| | |
|---|---|
| Code | [app/mvp/importer.js:556-566](../app/mvp/importer.js#L556-L566) |
| Before | `if (['csv', 'tsv', 'txt'].includes(extension)) return extension === 'tsv' ? 'tsv' : 'csv';` |
| After | `if (['csv', 'tsv'].includes(extension)) return extension === 'tsv' ? 'tsv' : 'csv';` ([L561](../app/mvp/importer.js#L561)) plus an explicit rejection at [L564](../app/mvp/importer.js#L564): `if (extension === 'txt') throw httpError(415, 'The .txt file is not a supported spreadsheet format. Re-export from Shopee as .csv or .xlsx.');` |
| Measured after the fix | preview → `415` with `{"error":"The .txt file is not a supported spreadsheet format. Re-export from Shopee as .csv or .xlsx."}` — API level [import log L43](import-source-acceptance-2026-10-21.log#L43), browser level [E2E log L141-L144](browser-upload-e2e-2026-10-21.log#L141-L144), UI shows the message in `.notice-error` and in the toast |

The `.txt` rejection sits **after** the content sniffing (`PK` magic → xlsx, `{` → json), so a `.txt` file that is actually a JSON payload is still detected as JSON; only a genuine plain-text file is refused.

This is the **only** change to product code in this round.

---

## 4. Test-harness defects found and fixed

These were defects in the verification scripts, not in the product. They are recorded because each of them could produce a **false pass**.

| # | Defect | Why it mattered | Fix |
|---|---|---|---|
| H1 | `lastResponse()` returned the most recent matching response, which could be a leftover — or a still-empty entry — from the **previous** upload | a file could be judged by another file's response | `clearResponses()` before each upload + `waitForResponse(fragment)`, which polls until the matching response has both a status and a captured body ([browser-upload-e2e.js](browser-upload-e2e.js)) |
| H2 | The suite read `state.offers` / `state.candidates` / `staging.imports` as **arrays** | they are objects keyed by id, so `.length` was `undefined` and the "nothing was written" comparison silently compared nothing | `Object.keys(...).length`; "nothing was written" is now proved by the **md5 of the state and staging files** before/after the invalid uploads |
| H3 | A `/\s+/g` written inside a template literal became `/s+/g` | button text was mis-normalised ("Import to taging") and the button match could miss | escaped to `\\s+` in the injected expression |
| H4 | The log was written with `lines.join('\\n')` — the two characters `\` and `n` | the log file was one physical line with literal `\n` markers; it could not be read or grepped as a log | `lines.join('\n')`; the log is now 180 real lines and the run above is the regenerated artifact |

New API-level regression coverage was added for the two paths this round depends on: the `.txt` refusal ([import-source-acceptance.js:290](import-source-acceptance.js#L290)) and the incomplete-header preview ([import-source-acceptance.js:299](import-source-acceptance.js#L299)).

---

## 5. What is NOT verified and NOT claimed

- **Real Shopee Import is NOT verified.** No real Shopee Affiliate export exists in this workspace — the check is recorded as `PENDING` (exit code 2 = pending, neither a pass nor a failure) in [real-shopee-export-pending-2026-10-21.log](real-shopee-export-pending-2026-10-21.log). Everything above was measured against SYNTHETIC-labelled fixtures only.
- **The column alias catalogue is still a hypothesis.** It has never been run against a real export header, so the mapping cannot be claimed to match Shopee's real columns. The user must confirm the mapping in the preview step.
- **No Shopee account, API, or market truth** was involved. The app never opens Shopee and never verifies a file against an affiliate account.
- **Only CSV was uploaded through the browser input.** XLSX, JSON, TSV and the windows-874 Thai CSV are covered at API level only ([import log L27-L34](import-source-acceptance-2026-10-21.log#L27-L34)), not through the real file input.
- **The 500-row / 3 MB limits** are not exercised through the browser.
- **No accessibility audit**, no multi-browser coverage (Chromium only), no visual-regression baseline.
- **D5 is still `NOT RUN`, D9 is still not applicable as written, and `DEF-CWI-1` is still open.** This round changes none of them; see [d5-reserved-fields-review-2026-10-21.md](d5-reserved-fields-review-2026-10-21.md).

---

## 6. Repository integrity

| Item | Measured |
|---|---|
| `data/app/state.json` | md5 `5d29cdbdace0a73580bc2e0633f2e8cb` before and after every suite |
| `app/`, `data/`, `docs/` (repository copies) | byte-identical before and after the browser run |
| `data/mvp/` | absent before and after — the real repository never got MVP state |
| Git HEAD | `9749f38e7bdb1ec6ee56be0e2227473c3b973f2b` — unchanged, no commit created |
| Staged files | none, before and after |
| Foundation state | `/api/state` still has empty `decisions`, `planVersions`, `cwis`; the Foundation decision log is untouched |

The 8 modified `docs/mission1/*.md` files shown by `git status` are **pre-existing work from an earlier session**, not part of this round. The same is true of `app/remotion/**` (mtime 20:26) and `reference/Note.txt` (20:55), which belong to another workstream and predate the 21:07 product fix. `app/` and `verification/` are untracked in this repository, so Git cannot show a baseline diff for them; the byte-identity checks in the browser suite (step 9) are what prove the real files did not change during the run.

**Final read-only check of this round** (mtime scan of `app/`, `data/`, `docs/`, `verification/`): the only product file touched is [app/mvp/importer.js](../app/mvp/importer.js); everything else that changed is under `verification/`. Git HEAD is `9749f38e…` (9 commits, unchanged), **0 staged files**, 27 worktree entries — the same 27 as before this round.

---

## 7. Files changed by this round

| Path | Change |
|---|---|
| [app/mvp/importer.js](../app/mvp/importer.js) | **product fix** — `.txt` is refused with `415` instead of being parsed as CSV ([L561](../app/mvp/importer.js#L561), [L564](../app/mvp/importer.js#L564)) |
| [verification/browser-upload-e2e.js](browser-upload-e2e.js) | new — real-browser upload suite; harness fixes H1–H4; debug instrumentation retained (§8) |
| [verification/import-source-acceptance.js](import-source-acceptance.js) | API-level regression cases for `.txt` and the incomplete header |
| [verification/browser-upload-e2e-2026-10-21.log](browser-upload-e2e-2026-10-21.log) | raw run log (58/58) |
| [verification/import-source-acceptance-2026-10-21.log](import-source-acceptance-2026-10-21.log) | raw run log (83/83) |
| [verification/mvp-workflow-acceptance-2026-10-21.log](mvp-workflow-acceptance-2026-10-21.log) | raw run log (56/56) |
| [verification/foundation-regression-2026-10-21.log](foundation-regression-2026-10-21.log) | raw run log (19/19) |
| [verification/mvp-server-isolation-2026-10-21.log](mvp-server-isolation-2026-10-21.log) | raw run log (0 failures) |
| [verification/browser-upload-e2e-acceptance-2026-10-21.md](browser-upload-e2e-acceptance-2026-10-21.md) | this record |

---

## 8. Deferred — not done in this round

**D1 · Strip the debug instrumentation from the browser suite.** The two debug blocks were deliberately **kept** for this round because their output is the evidence for the UI-side claims in §2 and §3 (the `.notice-error` / toast capture, and the button inventory that shows which control was clicked). They are throwaway instrumentation, not assertions.

| Item | Detail |
|---|---|
| Block 1 | [browser-upload-e2e.js:663-705](browser-upload-e2e.js#L663-L705) — "DEBUG AFTER DUPLICATE IMPORT": dumps `ui.section`, `ui.lastStaged`, the staging list and every button with its `disabled` state |
| Block 2 | [browser-upload-e2e.js:821-852](browser-upload-e2e.js#L821-L852) — "DEBUG INVALID FILE (.txt)": dumps the notice elements, the toast and `ui.error` |
| Acceptance criteria | both blocks removed; the assertions they support are rewritten as **table-driven checks** (one row per invalid file: expected status, expected message, expected UI surface) instead of free-form `note()` dumps; `node verification/browser-upload-e2e.js` still exits `0` with **58 assertions or more**; the log stays line-per-assertion |
| Constraint | the `.txt` → `415` + `.notice-error` + toast claim in §3 must remain **asserted**, not just printed — the debug output alone is not a passing check |
