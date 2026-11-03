# ACE Mission 1 — Real Shopee Checker Evidence Hardening (S-5 · S-3 · S-4)

**Recorded:** 2026-11-04T06:46+07:00 (2026-11-03T23:46Z) · actor: AI
**Scope:** `verification/real-shopee-export-check.js` only. No application file, no governance ledger, no real export, no product E2E, nothing pushed.
**Prior records (not edited):** `verification/ace-mission1-checkpoint-2026-11-03-checker-closure.md` (commit `271c1fa`), `verification/real-export-readiness-2026-10-21.md`.

Status vocabulary: **VERIFIED** (supported by observed run evidence) · **PENDING** · **NOT AUTHORIZED** · **OPEN** (technical debt).

---

## 1. Commits

| # | Commit | Subject | Stat |
|---|---|---|---|
| base | `3e00b43` | `chore(ace): track repository safety ignore rules` | — |
| 1 | `aad8909` | `fix(ace): refuse an evidence directory inside the repository` (S-5) | +28 / −8 |
| 2 | `e259b7d` | `fix(ace): exclude backups and rendered media from the checker workspace` (S-3) | +97 / −7 |
| 3 | `56176bb` | `fix(ace): persist the observed startup line in the run evidence` (S-4) | +41 / −3 |

Across the three commits: **1 file changed, +166 / −18**; the checker is now 1,929 lines. `git diff --name-only 3e00b43..HEAD` touched nothing under `app/`, `data/` or `docs/`.

Frozen contract held: `EXIT = {0 VERIFIED, 1 FAILED, 2 PENDING, 3 PARTIAL}`, zero `process.exit(` occurrences, and the `.jsonl` step sequence is still the 16 frozen steps in order (verified on a live run).

---

## 2. What changed

### S-5 — evidence directory may not live inside the repository (VERIFIED)

`resolveEvidenceDir()` trusted `ACE_IMPORT_ROOT`, so `ACE_IMPORT_ROOT=.` or `data/imports` wrote the evidence bundle — real export headers, counts, mapping hash — inside the worktree, where a later `git add` could carry it away. The candidate is now rejected when `isInside(REPO, candidate)`, nothing is created, the run falls back to the OS temp directory, and the refusal is written to `evidence_write.dir_rejected` (also returned as `evidence.dir_rejected`).

Observed on three misconfigurations:

| `ACE_IMPORT_ROOT` | exit | repository polluted | `dir_rejected.reason` | evidence went to |
|---|---|---|---|---|
| `.` | 2 | no (`evidence/` absent) | `EVIDENCE_DIR_INSIDE_REPOSITORY` | `os.tmpdir()/ace-real-export-evidence` |
| `data/imports` | 2 | no (`data/imports/evidence` absent, 0 files) | `EVIDENCE_DIR_INSIDE_REPOSITORY` | `os.tmpdir()/ace-real-export-evidence` |
| `<repo>/.tmp/ace-guard-test` | 2 | no (directory never created) | `EVIDENCE_DIR_INSIDE_REPOSITORY` | `os.tmpdir()/ace-real-export-evidence` |
| `%TEMP%/ace-empty-root` (outside) | 2 | n/a | `null` | `ACE_IMPORT_ROOT/evidence` (unchanged) |

The change is internal to `ensureDir()`: `this.dir` remains a string, so the workspace invariant and the evidence paths are unaffected.

### S-3 — workspace copy excludes backups and rendered media (VERIFIED)

The throwaway workspace copied all of `app/`, including stale backups, agent scratch copies and a 211 KB rendered video. Backups (`*.bak`, `*.bakN`, `*.backup`, `*.orig`, `*.rej`), scratch copies (`*.js.ace-mission-*`, `*.js.phase*`, `*.js.pre-fix-*`, `*.js.repair-*`, `*.js.stage-*`) and files under `app/exports/` are now skipped.

Measured in the run `real-shopee-export-check-20261103T234435-11188-b8e9`:

| Metric | Value |
|---|---|
| Source inventory (`app/`) | 37 files / 1,797,132 bytes |
| Copied | 26 files / 663,050 bytes |
| Excluded | 11 files / 1,134,082 bytes (−63.1 % of bytes) |
| Reconciliation | `files_reconcile: true`, `bytes_reconcile: true`, `ok: true` |

The inventory is measured in the same run that copies, and each excluded file is recorded with its own size and reason, so the reconciliation cannot pass against a hardcoded expectation. `docs/mission1/schemas` is still copied (2 files) and directories are always traversed, so no subtree is silently lost.

### S-4 — the startup line survives the tail cap (VERIFIED)

The line that proves ownership existed only inside `diagnostics.stdout_tail`, which `redactText` caps at **2,500 characters** (not 64 KB — 64 KB is the ring buffer). A chatty child could push it out of the record even though readiness had already gated on it in memory.

Now captured at the moment of the match (`bytes_at_match`) and carried into `final.startup`, `final.summary.startup_line` and `final.summary.readiness`. `diagnostics` also states `stdout_tail_limit_chars: 2500` and `stdio_buffer_limit_bytes: 65536` explicitly.

Observed on the verified run `real-shopee-export-check-20261103T234432-26580-3905`:

```json
"startup": {
  "seen": true,
  "line": "[ace] Mission 1 slice running at http://127.0.0.1:59734",
  "port": 59734,
  "latency_ms": 313,
  "bytes_at_match": 56,
  "port_mismatch": [],
  "ownership": "port freshly allocated for this run + startup line observed on this child's stdout + child alive"
}
```

`final.startup.line` equals the `.jsonl` `readiness.startup_line` exactly. It is captured in `finalize()` before `terminate()` (same position as `liveDiagnostics` / `liveEnvironment`), so nothing is read from a controller after it is discarded. Console output is byte-identical to before.

---

## 3. Verification

### Exit matrix (exit codes unchanged)

| Path | Evidence file | exit | verdict | `startup` |
|---|---|---|---|---|
| verified | `...20261103T234432-26580-3905.final.json` | **0** | `VERIFIED` | present, `bytes_at_match: 56` |
| partial | `...20261103T234435-11188-b8e9.final.json` | **3** | `STAGED_BUT_NOT_PROMOTED` | present |
| pending | `...20261103T234439-24156-bdb9.final.json` (under `ace-empty-root/evidence`) | **2** | `PENDING` | `null` |
| fixture | `...20261103T234447-6856-5666.final.json` | **1** | `FILE_IS_FIXTURE` | `null` |
| rehearsal | `...20261103T234447-13576-c441.final.json` | **1** | `FILE_IS_REHEARSAL` | `null` |

`degraded: []` and `overall_result` unchanged on every path (`COMPLETE_SUCCESS` / `PARTIAL` / `PENDING` / `FAILED`).

### Regression

| Check | Result |
|---|---|
| `node --check` after each edit | pass |
| Out-of-repo harness (20 tests) after S-3 and after S-4 | **TOTAL 20 PASS 20 FAIL 0** both times |
| `.jsonl` step sequence on a live run | **16 steps, frozen order** (`run_start → … → state`) |
| `process.exit(` occurrences | 0 (only `process.exitCode` via the single finalize path) |
| Files changed by the three commits | `verification/real-shopee-export-check.js` only |
| `app/`, `data/`, `docs/` diff across the three commits | 0 |
| Repository pollution during S-5 tests | none (`git status` unchanged; no `evidence/`, no guard directory) |

All runs used synthetic inputs in `%TEMP%`; no credential, no `.env` read, no network call, no real Shopee export.

### Final acceptance — Case A and Case B (run against `56176bb`)

Requested as the last gate before closing this record. **33 checks, 0 failures.**

**Case A — evidence directory guard and return contract (23 checks, all PASS)**

| # | Check | Observed |
|---|---|---|
| A1 | `resolveEvidenceDir()` has exactly one call site | 2 occurrences = 1 definition + 1 call |
| A2 | outside root: exit, `dir_source`, `dir_rejected` | exit 2 · `ACE_IMPORT_ROOT/evidence` · `null` |
| A3 ×3 | inside root (`.`, `data/imports`, `.tmp/ace-accept-guard`): exit / nothing created / rejection recorded / temp fallback | exit 2 · absent · `EVIDENCE_DIR_INSIDE_REPOSITORY` · `os.tmpdir()/ace-real-export-evidence` on all three |
| A4 | verified path with an outside root: exit, workspace created, `recorder.dir` still a string, evidence at the outside root | exit 0 · workspace created · `ACE_IMPORT_ROOT/evidence` · rejection `null` |
| A5 | repository untouched by every guard case | `git status` identical · no `evidence/` · `data/imports` still empty |

**Case B — workspace byte accounting (10 checks, all PASS)**

| # | Check | Observed |
|---|---|---|
| B1 | source inventory vs an independent walk of `app/` | 37 files / 1,797,132 bytes — identical |
| B2 | excluded count | 11 = 11 |
| B3 | excluded bytes | 1,134,082 = 1,134,082 |
| B4 | exact excluded set (path, bytes, reason) compared field by field | 11/11 identical |
| B5 | reconciliation flags | `ok`, `files_reconcile`, `bytes_reconcile` all true |
| B6 | copied + excluded = source | 26 + 11 = 37 files · 663,050 + 1,134,082 = 1,797,132 bytes |
| B7 | no runnable module excluded | none (every excluded path is a backup, a scratch copy or rendered media) |
| B8 | same numbers in the `.jsonl` `workspace` step | `accounting.ok: true`, identical bytes |
| B9 | verified run still succeeds on the reduced copy | `VERIFIED`, exit 0, `degraded: []` |
| B10 | workspace removed after the run | `removed: true` |

The rules in Case B were restated independently in the acceptance script rather than imported from the checker, so B1–B4 are a comparison against a second implementation, not an echo of the recorded values. B7 is the guard against a future rule change that would exclude something the server actually needs: the verified run would fail, or this check would.

---

## 4. Technical-debt status after this round

| ID | Item | Status |
|---|---|---|
| TD-CK-01 | startup line carries no pid/nonce | **OPEN** — needs `app/server.js` (not authorized) |
| TD-CK-02 | bind-then-close port TOCTOU | **OPEN** — needs `app/server.js` (not authorized) |
| TD-CK-03 | win32 kill makes SIGKILL escalation unobservable | **OPEN** — needs a POSIX host or accepted as dormant |
| TD-CK-04 | only the direct child is signalled (no process tree) | **OPEN** — checker scope, behaviour change, needs approval |
| TD-CK-05 | force-kill of the checker runs no cleanup | **OPEN** — needs a stale-run scanner (new feature) |
| TD-CK-06 | startup line could be lost from the evidence | **CLOSED by `56176bb`** — see §2 S-4 |
| TD-CK-07 | workspace copied backups and rendered media | **CLOSED by `e259b7d`** — see §2 S-3 |
| **TD-CK-08** (new) | `isInside()` uses `path.resolve()`, not `realpath()` | **OPEN** — see below |

**TD-CK-08 — symlink/junction bypass.** S-5 refuses an evidence directory that is *named* inside the repository, but a symlink or junction pointing into the repository is not resolved, so that route is not covered. Impact is low (someone must create the link deliberately), but S-5 must not be described as complete protection against path traversal through links. Closure requires comparing `fs.realpathSync.native()` on both sides, taking care that a not-yet-created target must not be required to exist.

---

## 5. Correction carried forward (not applied to the earlier record)

The 2026-11-03 checkpoint states that `diagnostics.stdout_tail` is capped at 64 KB. That is the ring-buffer size; the field itself is capped at **2,500 characters** by `redactText(..., STDOUT_TAIL_LIMIT_CHARS)`. The earlier record was left untouched on purpose; this record is the correction, and `56176bb` now records both caps inside the evidence itself.

---

## 6. Not closed, not authorized

| Item | Status |
|---|---|
| S-6 — harness tests T24–T28 | **PENDING separate authorization** (the existing 20 tests still pass) |
| S-7 — real Shopee export run | **NOT AUTHORIZED** |
| S-8 — product E2E (import into real app state) | **NOT AUTHORIZED** |
| Push | **NOT AUTHORIZED** — branch `mission1-planning-docs` is `ahead 10` of `origin` |
| TD-CK-01/02 (`app/server.js`) | **NOT AUTHORIZED** |
| TD-CK-04/05 (behaviour change / new feature) | **NOT AUTHORIZED** |

---

## 7. Reproduce

```bash
cd "Y:/DevProject/Affiliate Content Engine"
node --check verification/real-shopee-export-check.js

T="$(node -e "console.log(require('os').tmpdir())")"
node verification/real-shopee-export-check.js "$T/ace-check-input/user-export-test-02.csv"   # exit 0
node verification/real-shopee-export-check.js "$T/ace-check-input/user-export-test-01.csv"   # exit 3
ACE_IMPORT_ROOT="$T/ace-empty-root" node verification/real-shopee-export-check.js             # exit 2
node verification/real-shopee-export-check.js app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv  # exit 1
node verification/real-shopee-export-check.js "$T/ace-check-input/rehearsal.csv"             # exit 1

# S-5 guard: evidence must not land in the repository
ACE_IMPORT_ROOT="$PWD/.tmp/ace-guard-test" node verification/real-shopee-export-check.js
test ! -e .tmp/ace-guard-test && echo "no repository pollution"

node "$T/ace-check-tests/run-tests.js"   # TOTAL 20 PASS 20 FAIL 0
```

---

## 8. Recording notes

- This is a new record; the 2026-11-03 checkpoint and every earlier evidence file are unchanged.
- Nothing was written to `data/mission1/decision-log.md`, `evidence-log.md` or `workflow-state.yaml`: this round contains no gate decision, no external evidence and no stage transition.
- Every figure above was observed in this session; the run IDs name the exact `.final.json` (OS temp directory, not version-controlled).
