# Mission 1 — E2E Run Evidence (append-only; one block per run, never edit an existing block)

Schema: this file records Content Library E2E verification runs (G-13) as
self-contained, auditable run blocks. Each block is appended and never edited.
A correction is a new block referencing the old Run ID.

Raw runner output is separated from operator-added context. Values whose only
source is the terminal transcript or filesystem metadata are labeled as such;
they are declared in the raw log only when the label says so.

## Run ACE-M1-E2E-20261026-01

### 1. Run identity

| Field | Value | Source |
|---|---|---|
| Branch | `mission1-planning-docs` | git (verified live) |
| HEAD at run time | `83fbde5e1cc53c8a3193927cb9d6b223eb68fec3` | git output shown in terminal transcript; corroborated: run start (mtime below) is after both commits of 2026-10-26 23:34:07 +0700, no later commits existed |
| Commit A | `bcbfe470c8894b4c583312977daccd0747ca8fb3` (feat(ace): add content library foundation) | git log |
| Commit B (runner) | `83fbde5e1cc53c8a3193927cb9d6b223eb68fec3` (test(ace): add content library end-to-end verification) | git log |
| Command | `node verification/check-content-library.js --e2e` | terminal transcript only (not in raw log) |
| Run observation time | 2026-10-26 23:35:59.820224100 +0700 | raw log file mtime — filesystem metadata, not cryptographic |
| Raw log written via | terminal `tee .tmp/g13-e2e-recheck.log` | terminal transcript; note the shell echoed wrapper markers AFTER the tee'd stream, so the raw log contains only the runner's own stdout |

### 2. Runtime result

- Command execution: streaming stderr included, captured via `2>&1 | tee`.
- Exit code: **`E2E_EXIT=0`** — recorded on the terminal transcript **only**;
  it is not present inside the raw log file. Treated as supporting evidence
  from that transcript, per the no-backfill rule.
- Raw log final line: `ALL G-13 E2E CHECKS PASSED` (runner's own output).
- Per-check results: **all 23 `check()` assertions PASS**, plus 10 `ok` status
  lines (server up + 9 workflow HTTP steps). Counting note: an earlier chat
  summary said "26 checks"; the per-file count from the raw log is as stated
  here (23 PASS + 10 ok). The raw log is authoritative.
- Full per-check list (verbatim statuses from the raw log):
  1. `ok` isolated server on http://127.0.0.1:8441
  2. `ok` import fixture (201)
  3. `ok` generate candidates (201)
  4. `ok` save candidate (200)
  5. `ok` plan draft (201)
  6. `ok` create plan (201)
  7. `ok` content draft (201)
  8. `ok` edit visual track (200)
  9. `ok` edit text track (200)
  10. `ok` edit audio track (200)
  11. `PASS` export before finalize rejected (409) — status 409
  12. `PASS` failed export leaves no library entry — entries for CNT-1: 0
  13. `ok` run Thai QA (200)
  14. `ok` review (200)
  15. `ok` finalize (200)
  16. `ok` export (200)
  17. `PASS` export file exists and is non-empty — `.tmp/g13-verify/exports/CNT-1/CNT-1-v2.mp4` (210651 bytes)
  18. `PASS` library entry stored
  19. `PASS` entry filename matches export — CNT-1-v2.mp4
  20. `PASS` entry sha256 matches actual file — `954a843273e40a494db54472a625518a4338578918850d54d8b584264824b448`
  21. `PASS` pre-existing unrelated entry preserved
  22. `PASS` no duplicate entry for the id
  23. `PASS` retrieve by ID returns 200 — status 200
  24. `PASS` retrieved record matches stored entry
  25. `PASS` retrieval resolves expected path — `.tmp/g13-verify/exports/CNT-1/CNT-1-v2.mp4`
  26. `PASS` retrieval integrity VERIFIED
  27. `PASS` unknown ID handled safely (404)
  28. `PASS` missing asset reported MISSING — MISSING
  29. `PASS` missing asset sha256_match is null
  30. `PASS` restored asset VERIFIED again
  31. `PASS` corrupted asset reported MISMATCH — MISMATCH
  32. `PASS` repaired asset VERIFIED again
  33. `PASS` repeat export does not duplicate records — 1 record(s)
  34. `PASS` repeat export entry still hash-correct
  35. `PASS` pre-existing entry still preserved after repeat
  36. `PASS` final index holds exactly expected entries — 2 entr(ies)
- Raw log size: 40 lines / 1,739 bytes (see §4).

### 3. Isolation evidence

Runner mode: `--e2e` boots `app/server.js` with isolated env vars
(`ACE_MVP_STATE_FILE`, `ACE_MVP_ASSETS_DIR`, `ACE_MVP_EXPORTS_DIR`,
`ACE_CONTENT_LIBRARY_FILE`) all under `.tmp/g13-verify/`, forces
`HOST=127.0.0.1` on a free port.

| Value | Value | Source label |
|---|---|---|
| Real index SHA-256 BEFORE run | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` | terminal transcript (sha256sum executed just before the run) |
| Real index SHA-256 AFTER run | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` | terminal transcript (sha256sum executed just after the run) |
| Before == After | equal — byte-identical; no mutation of the real index | operator inference from the two transcript values above, not contained in the raw log |
| Real index SHA-256 at recording time (this block) | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` | re-verified live at file creation: 2026-10-26 23:41:44 +0700 |
| Runner's own isolation check | `PASS  real Content Library untouched by e2e run` | raw log (in-file, verbatim) |
| Test workspace cleanup | `.tmp/g13-verify/` absent after the run | shell listing after the run (terminal transcript); re-checked absent at file creation |

### 4. Artifact integrity (raw log)

| Field | Value |
|---|---|
| Path | `.tmp/g13-e2e-recheck.log` |
| SHA-256 | `c3adafa17b2a8a4bc6d5aafc79f3be3d1ea0fb9dd41f28a51572317e27174a09` |
| Size / lines | 1,739 bytes / 40 lines |
| mtime | 2026-10-26 23:35:59.820224100 +0700 (filesystem metadata) |
| State | kept as captured; never edited, appended, or reformatted |
| Re-verified at file creation | SHA-256 matches the value above (checked 2026-10-26 23:41:44 +0700) |
| Storage caveat | `.tmp/g13-e2e-recheck.log` currently lives in the ignored scratch area (`.tmp/`), not under version control; its integrity depends on filesystem retention, not Git |

### 5. Evidence limitations

1. **mtime is filesystem metadata, not cryptographic proof.** The observed
   run time (2026-10-26 23:35:59 +0700) cannot be cryptographically shown to
   be exact or unfalsifiable; filesystem mtimes are forgeable. The remaining
   corroboration (commit timestamps preceding the run, no later commits,
   unchanged HEAD) is inference, not proof.
2. **Exit code placement:** `E2E_EXIT=0` exists on the terminal transcript
   only. The raw log deliberately does not contain it, and no value has been
   back-filled into the raw log or re-attributed to it.
3. **Before/after isolation hashes** were executed around the run and are
   recorded from the terminal transcript; only the "at recording time" value
   was independently re-hashed while writing this block.
4. **In-file vs transcript boundary:** everything inside the raw log is
   runner output; everything marked "terminal transcript" in the tables above
   has no in-file backing and must not be quoted as if it did.
5. Chat summaries from the same session (e.g., "26 checks") are not evidence;
   where they differ from the raw log, the raw log governs.

### 6. Git boundary at creation

| Check | Result | Source |
|---|---|---|
| Branch / HEAD unchanged | `mission1-planning-docs` / `83fbde5e1cc53c8a3193927cb9d6b223eb68fec3` | git (live) |
| Staged area | empty (`git diff --cached --stat` shows nothing) | git (live) |
| `docs/mission1/A–H` owner edits | untouched, still unstaged ` M` × 8, stat `+285/−67` unchanged | git short/status (live) |
| Files created by this exercise | `data/mission1/e2e-log.md` only | git status after creation |
| Not modified: raw log, `run-history.yaml` (DEFER), `workflow-state.yaml` (DEFER), backups, tracked commits | confirmed | git status + sha256 re-check |

Scope note: this file records a NEW run's evidence. It does not assert,
edit, or validate the historical entries in `data/mission1/run-history.yaml`,
which remains DEFER by owner decision.

---

## Append-only correction — ACE-M1-E2E-20261026-01

Block `ACE-M1-E2E-20261026-01-CORR-01`, appended 2026-10-26 23:47
(+0700). This block supplements — and does not replace — the
"Runtime result" section of Run ACE-M1-E2E-20261026-01. The original
block above remains present byte-for-byte. This correction is NOT a new
runtime execution; the E2E test was not re-run.

### Independently verified counts (source: raw log itself, counted with line-oriented grep)

| Count | Correct value | Value stated in the original block | Status of the original claim |
|---|---|---|---|
| `PASS` check lines | **23** | 23 | correct |
| `ok` status lines | **14** | "plus 10 `ok` status lines (server up + 9 workflow HTTP steps)" | **wrong** — the raw log holds 14 `ok` lines: server up + 13 workflow HTTP steps (import, generate candidates, save candidate, plan draft, create plan, content draft, edit visual track, edit text track, edit audio track, run Thai QA, review, finalize, export) |
| Total result lines | **37** (14 ok + 23 PASS) | implicitly 33 (23 + 10) | **wrong** by omission — the raw log is 40 lines total: 37 result lines + 1 blank line after the server-up `ok`, 1 blank line before the final line, and the final `ALL G-13 E2E CHECKS PASSED` line |

### Final check line

The raw log's last result line is `PASS  real Content Library untouched by e2e
run`. Its presence in the raw log was re-verified for this correction
(1 matching line). It was **not included** in the original block's "Full
per-check list": that listing ended at "final index holds exactly expected
entries — 2 entr(ies)" and silently omitted this 23rd PASS.

### What exactly was wrong in the original block and what governs now

1. The claim "all 23 `check()` assertions PASS" was and is correct (23 PASS is
   verified).
2. The claim "plus 10 `ok` status lines (server up + 9 workflow HTTP steps)"
   was wrong: the correct composition is server up + 13 workflow HTTP steps =
   14 `ok` lines (verified by counting lines beginning `ok` in the raw log).
3. The "Full per-check list" (36 numbered rows) omitted the final PASS line,
   so the list did not match the raw log's complete result set.
4. The parenthetical "Counting note" attributed 23 + 10 to the raw log; the
   raw-log-verified totals are 23 PASS + 14 ok = 37 result lines. Where the
   two differ, the raw log governs (unchanged rule) — and specifically, the
   counts in this correction govern over the counts in the original block.
5. The per-check list ordering and the 36 rows that do appear in the original
   block were re-checked against the raw log line sequence and matched exactly
   as far as they go; only the missing final PASS makes the list incomplete.

### Raw log anchoring for this correction (unchanged artifact)

| Field | Value |
|---|---|
| Path / SHA-256 / size / lines | `.tmp/g13-e2e-recheck.log` — `c3adafa17b2a8a4bc6d5aafc79f3be3d1ea0fb9dd41f28a51572317e27174a09`, 1,739 bytes, 40 lines — re-calculated immediately before appending this block and unchanged after (§6 re-check below) |
| In-file (raw-log) facts used | the 37 result lines, their exact statuses, the final PASS line, and the final `ALL G-13 E2E CHECKS PASSED` line — all verbatim in the raw log |
| Terminal-transcript-only facts | nothing new in this block depends on the transcript; the count verification used the raw log file itself |
| Scope | this correction does not touch the isolation, artifact-integrity, limitation, or Git-boundary sections of the original block; those remain as written |

Scope note: `data/mission1/run-history.yaml` remains DEFER by owner decision;
this correction changes nothing about that decision. No staging, no commit,
and no re-execution of any test occurred for this correction.

---
