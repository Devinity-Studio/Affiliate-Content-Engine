ECHNICAL REVIEW 1.1 — ROLLBACK BASELINE CAPTURE PLAN v1.0

Document type: Review of a proposed plan — not approval, not capture authorization
Status: REVIEW ONLY · Repository changes: NONE · Baseline captured: NONE · Implementation: NOT AUTHORIZED
Inputs: Capture Plan v1.0 (DRAFT/PROPOSED) + Compatibility Specification Rev. 3.1
Supersedes: Technical Review 1.0 (same cycle)
> Revision note: this version corrects one overstatement in F-1, downgrades A-1 to match the available evidence, guards A-2's wording, adds A-3, and moves A-4 out of this plan into Rev. 3.1 §10 as a separate proposal. Findings are otherwise unchanged.


แล้วก็อันนี้ใช่ไหมครับ


────────────────────────────────────────────────────────────────────────────────

1. Authority boundary of this document

This document does not:
- approve the Capture Plan, or any part of it;
- authorize repository inspection for capture, file copying, hashing, or baseline creation;
- authorize implementation, verification runs, commits, pushes, or branch changes;
- change Gate 3, A2, Gate C, or Remove status;
- reopen Preservation work.

Its only function is to state which parts of the plan are technically sound and which are incomplete.

────────────────────────────────────────────────────────────────────────────────

2. What the plan gets right

- HEAD explicitly rejected as a baseline source (§1, §3, §6.1) — the single most important safety property in the document.
- Five-path scope is exact, provider files excluded from capture and restore (§3) — matches C-15.
- Absence recorded, never faked (§4 B-2) — prevents the classic false-baseline failure.
- Stop conditions are complete and non-negotiable (§8), including "do not repair unexpected conditions."
- Decision separation (§9) is correct: plan approval ≠ capture authorization ≠ baseline acceptance ≠ implementation authorization.
- §10 status table matches Rev. 3.1, including U-6 as recorded/not-stop-work and U-7 as closed.

────────────────────────────────────────────────────────────────────────────────

3. Findings

F-1 — [CORRECTED] Two of the four capture targets have no recovery path inside the repository

┌──────────────────────────────────────────────────────────┬────────────────────┬─────────┬──────────────────────────────────┐
│ Path                                                     │ Git status         │ Bytes   │ Recovery from Git                │
├──────────────────────────────────────────────────────────┼────────────────────┼─────────┼──────────────────────────────────┤
│ app/mvp/content.js                                       │ TRACKED (modified) │ 84,695  │ HEAD exists, but ≠ current state │
│ app/mvp/service.js                                       │ TRACKED (modified) │ 150,787 │ HEAD exists, but ≠ current state │
│ verification/openrouter-gate3-offline-check.js           │ UNTRACKED          │ 27,423  │ none                             │
│ verification/openrouter-gate3-script-validation-check.js │ UNTRACKED          │ 18,742  │ none                             │
└──────────────────────────────────────────────────────────┴────────────────────┴─────────┴──────────────────────────────────┘

VERIFIED: both Gate 3 scripts are untracked and absent from  HEAD ; within this repository there is no second copy and no Git history to restore from.

UNVERIFIED — awaiting Owner: whether the Owner's preservation package covers these two files. I cannot see that package and have made no attempt to.

Therefore the correct statement is: the baseline would be the first in-repository second copy of those two files, not "the only copy in existence." The former is a verified statement about Git; the latter is an unverified claim about the whole environment, and Review 1.0 overstated it. This correction does not remove the risk — it removes the overclaim.

F-2 —  app/mvp/ai/  does not exist, and the plan records only the file path

 ls: cannot access 'app/mvp/ai': No such file or directory .  app/mvp/  currently holds  content.js, fixtures, importer.js, provider, service.js, thai-qa.js  plus 7 stale  service.js.*  backups.

Rollback that removes only the file leaves an empty  app/mvp/ai/  — visible residue and an ambiguous signal to the next reviewer.

F-3 — Rollback has no verification step

B-5 verifies capture; nothing verifies restoration. AC-01…AC-10 are capture-only. Your own earlier requirement — post-rollback hash check — is absent from the plan that will actually be executed.

F-4 — No baseline-freshness rule [moved to Rev. 3.1 §10 in this revision — see R-1]

Stated here as a finding only: the plan permits capture at any time and never requires the baseline to still describe the tree when implementation begins. All four files currently carry mtimes of 2026-11-01 04:35:06 – 05:00:33 (unchanged since the audits), which is precisely the kind of fact that silently stops being true.

F-5 — Working-tree drift detector is unspecified

Current shape: 176 status entries = 2 modified + 174 untracked, branch  mission1-planning-docs , HEAD  3de3443 . The 174 is directory-collapsed ( ?? .zwork/  counts once). A count recorded without its flags can later produce false drift, or hide real drift inside a collapsed directory.

F-6 — Restore method is named but not constrained by command

§6.1 forbids  git reset --hard  "as a substitute", but does not forbid  git checkout -- <path>  — the same HEAD-vs-working-tree error the plan rejects in principle. Given F-1, that omission matters.

────────────────────────────────────────────────────────────────────────────────

4. Amendments required to the Capture Plan

A-1 — [DOWNGRADED] Add B-6 "Repository recovery status"

For each of the five paths record: tracked / untracked / absent, and whether a Git recovery path exists. State plainly that the two untracked Gate 3 scripts have no in-repository recovery path.

Add one capture-time line to Phase A: "Record whether each untracked path is covered by the Owner's preservation package. If this cannot be established, record  UNVERIFIED (Owner)  in the acceptance report. This does not block capture and does not reopen Preservation work."

(No re-audit of Preservation. One record field, one status label.)

A-2 — Record directory state, and separate it from governance Remove

Extend B-1 with:  app/mvp/ai/  — ABSENT (directory), recorded explicitly. Add to §6: "On rollback, remove  app/mvp/ai/  only if it was created by the authorized Option B work and B-1 records it as ABSENT."

Add a clarifying sentence: "Directory deletion here is filesystem cleanup only. It is unrelated to the governance Remove operation, which remains PROPOSAL-ONLY and is not touched by this plan."

A-3 — Add post-rollback verification and AC-11

§6 new final step: after restore, recompute each file's full SHA-256 and compare to B-2; confirm  ai/script-draft.js  no longer exists and  app/mvp/ai/  matches the B-1 record.

 AC-11 | Post-rollback hashes match baseline | 4/4 

Restoration is not complete until AC-11 passes.

A-5 — Specify the drift record format

Store, for both Phase A and Phase C:
1. full  git status --porcelain=v1  output, byte-for-byte, same flags both times;
2. SHA-256 of that output;
3. entry count, with the flag set stated;
4. branch and HEAD.

A count alone must not be accepted as the drift record.

R-1 — [MOVED OUT OF THIS PLAN] Baseline freshness → Rev. 3.1 §10

Not an amendment to the Capture Plan. Proposed as Rev. 3.1 §10 step 0:
> At implementation start, before any edit, re-hash the four files and compare to B-2. Any mismatch means the baseline no longer describes the tree: stop and re-capture. The baseline must never be updated in place, because updating hashes destroys the evidence of what was actually captured.


Rationale for moving it: the Capture Plan's scope is capture. Freshness binds the moment of implementation, so it belongs in the document that governs implementation, not in the one that governs evidence collection.

────────────────────────────────────────────────────────────────────────────────

5. Minor recommendations (non-blocking)

1. Destination durability — one copy in one location remains a single point of loss (see F-1). Recommend two copies plus a manifest whose own hash is recorded in the acceptance report.
2. Manifest-change rule — if implementation ever appears to need a  package.json  change, that is outside C-14 and outside this capture set: stop, do not extend the set unilaterally.
3. Neighbour awareness —  app/mvp/  holds 7 stale  service.js.*  backups; path-specific operations only, no directory-level replace.
4. Do not import these figures as baseline evidence — the sizes and mtimes above are identification from a review pass. A-5/R-1 require re-derivation at capture.

────────────────────────────────────────────────────────────────────────────────

6. Consistency check against Rev. 3.1

┌──────────────────────────────────┬────────────────────────────┬────────────────────┐
│ Rev. 3.1 / plan item             │ Plan v1.0                  │ Review 1.1 verdict │
├──────────────────────────────────┼────────────────────────────┼────────────────────┤
│ 5-path allowlist                 │ §3 exact                   │ ✓                  │
│ Provider files untouched         │ §3 explicit                │ ✓                  │
│ HEAD is not a baseline           │ §1, §3, §6.1               │ ✓                  │
│ U-6 recorded (not stop-work)     │ §10                        │ ✓                  │
│ U-7 closed (trace === null)      │ §10                        │ ✓                  │
│ Rollback = blocking prerequisite │ §10 BLOCKED — NOT CAPTURED │ ✓                  │
│ Implementation not authorized    │ §2, §9, §10                │ ✓                  │
│ Post-rollback verification       │ missing                    │ ✗ → A-3            │
│ Directory state                  │ missing                    │ ✗ → A-2            │
│ Repository recovery status       │ missing                    │ ✗ → A-1            │
│ Drift record format              │ count only                 │ ✗ → A-5            │
│ Baseline freshness               │ missing                    │ ✗ → R-1 (Rev. 3.1) │
└──────────────────────────────────┴────────────────────────────┴────────────────────┘

────────────────────────────────────────────────────────────────────────────────

7. What was and was not done

Inspected (read-only): tracked/untracked status of the five paths; existence of  app/mvp/ai/ ;  app/mvp/  listing;  git status --porcelain  counts; branch; HEAD;  stat  sizes and mtimes.

Not done: no file copied, created, renamed, or deleted · no SHA-256 computed (that is B-2 and is not authorized) · no baseline directory created · no verification, restore, or test executed · no Git mutation · no  .env  or secret access · no Gate / A2 / Gate C / Remove status changed · no Preservation audit reopened.

Figures are as inspected earlier in this review cycle. A-5 and R-1 require re-derivation at capture time; they are not baseline evidence.

────────────────────────────────────────────────────────────────────────────────

8. Recommendation to the Owner

1. Consider approving the Capture Plan subject to A-1, A-2, A-3, A-5. These four close gaps in the plan's own scope.
2. Consider R-1 separately as a Rev. 3.1 §10 addition, not as a plan amendment.
3. Grant capture authorization separately afterwards, with two facts on the record before signing:
- F-1: the two Gate 3 scripts have no in-repository recovery path, and coverage by the Owner's preservation package is [UNVERIFIED — รอ Owner ยืนยัน];
- A-3: without post-rollback verification, a "successful" rollback is an assertion, not evidence.

────────────────────────────────────────────────────────────────────────────────

9. Open item carried forward

┌─────────────────────────────────────────────────┬─────────────────────┬────────────┬───────────────────────────────────────────────────┐
│ Item                                            │ Status              │ Blocks     │ Blocks implementation?                            │
│                                                 │                     │ capture?   │                                                   │
├─────────────────────────────────────────────────┼─────────────────────┼────────────┼───────────────────────────────────────────────────┤
│ Preservation-package coverage of the two        │ [UNVERIFIED — รอ    │ No         │ No — but must appear in the acceptance report as  │
│ untracked Gate 3 scripts                        │ Owner ยืนยัน]         │            │ recorded, not resolved                            │
└─────────────────────────────────────────────────┴─────────────────────┴────────────┴───────────────────────────────────────────────────┘

────────────────────────────────────────────────────────────────────────────────

10. Change log — Review 1.0 → 1.1

┌─────┬─────────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────┐
│ #   │ Change                                                                                  │ Reason                                 │
├─────┼─────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────┤
│ 1   │ F-1 reworded from "only copy in existence" to "no in-repository recovery path; package  │ Review 1.0 overstated what the         │
│     │ coverage UNVERIFIED"                                                                    │ evidence supports                      │
│ 2   │ A-1 downgraded to a record field + one capture-time cross-check, with explicit "does    │ Match evidence; avoid reopening R5     │
│     │ not reopen Preservation"                                                                │                                        │
│ 3   │ A-2 guarded with directory-absence recording and the filesystem-vs-governance-Remove    │ Prevent misreading as a Remove         │
│     │ clarification                                                                           │ proposal                               │
│ 4   │ A-3 added — post-rollback verification + AC-11                                          │ Rollback had no verification step      │
│ 5   │ A-4 → R-1, moved to Rev. 3.1 §10                                                        │ Freshness binds implementation, not    │
│     │                                                                                         │ capture                                │
│ 6   │ A-5 made concrete — exact status record format and hashing of the output                │ Count alone is not a drift detector    │
│ 7   │ Status block added: REVIEW ONLY, no capture, no authorization                           │ Prevent inheritance of authority       │
│ 8   │ Unchanged: F-2, F-3, F-5, F-6, minor recommendations, consistency table, execution      │ —                                      │
│     │ statement                                                                               │                                        │
└─────┴─────────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────┘

────────────────────────────────────────────────────────────────────────────────

สรุป: ฉบับ 1.1 แก้ครบ 6 ข้อตามที่คุณกำหนด — F-1 ถอยจาก "สำเนาเดียวที่มีอยู่" เป็น "ไม่มีเส้นทางกู้คืนภายใน repository และยังไม่ยืนยันว่า package ครอบคลุม", A-1 ลดระดับเป็นฟิลด์บันทึก + การตรวจตอน capture โดยไม่เปิดงาน Preservation, A-2 แยก filesystem cleanup ออกจาก governance Remove, A-3 เพิ่ม AC-11, A-4 ย้ายไปเป็น R-1 ใน Rev. 3.1 §10, A-5 กำหนดรูปแบบบันทึก Git status ที่ทำซ้ำได้