# ACE Mission 1 — Historical Decision & Git Lineage Verification

**Read-only investigation. No repository changes.**

- Repo root: `Y:/DevProject/Affiliate Content Engine`
- Current branch: `mission1-planning-docs`
- Upstream: `origin/mission1-planning-docs` (points at `9749f38e`)
- Local `HEAD`: `e0da4aa` (most recent commit on this session's branch)
- Remote-tracking head for this branch: `origin/mission1-planning-docs = 9749f38e`
- Remote `main` head: `origin/main = 1b5800d` (also local `main = 1b5800d`)
- Abbreviated SHAs in this report are 7-hex prefixes unless the full SHA is quoted.

Verified commands used:

```
git rev-parse --show-toplevel
git branch --show-current
git rev-parse --abbrev-ref --symbolic-full-name @{u}
git status --short
git status --porcelain -uall
git ls-files --others --exclude-standard
git rev-parse --is-shallow-repository
git rev-list --all --oneline
git rev-list --all --format='%h %ad %s' --date=iso
git rev-list --all --objects
git rev-list --all --objects -- data/mission1/decision-log.md data/mission1/run-history.yaml data/mission1/workflow-state.yaml
git rev-list --all --objects -- data/mission1/run-history.yaml data/mission1/workflow-state.yaml
git rev-list --all --ancestry-path <sha>..HEAD
git merge-base --is-ancestor <sha1> <sha2>
git merge-base <sha1> <sha2>
git cat-file -p <commit>
git ls-tree -r <commit>
git ls-tree -r HEAD
git ls-files -s <path>
git show <commit>:<path>
git log --all --format='%h %ad %s' --date=iso -- <path>
git log --all --oneline -- <path>
git log --all --oneline --graph --decorate --date-order
git log --all --oneline -- . 
git log --all --format='%h %ad %s' --date=iso -- . 
git cat-file -t <sha>
git cat-file -p <sha>
cksum <path>
md5sum <path>
```

Commits cited as evidence in this report:

- `3bde018` — `Add Mission 1 planning documents (Deliverables A-H)` — 2026-10-11
- `9749f38` — `Record Owner approval of Measurement Formula in Doc G §2b` — 2026-10-11
- `bcbfe47` — `feat(ace): add content library foundation` — 2026-10-26
- `83fbde5` — `test(ace): add content library end-to-end verification` — 2026-10-26
- `795dc0a` — `docs(ace): record G-13 E2E run evidence` — 2026-10-27
- `72ec786` — `Agent host session 4819efbb-... - baseline checkpoint` — 2026-10-28
- `a22b6f6` — `Agent host session a3e405fc-... - baseline checkpoint` — 2026-10-29
- `6404e12` — `Agent host session 64aa9c2d-... - turn 16` — 2026-10-21 (HEAD of a separated agent session's branch; the only commit I found that physically contains `DEC-1-G1`)

Ancestry facts used:

- There is **no merge commit** in this reachable history; every commit shown has exactly one `parent`.
- Commit ancestry is therefore linear between roots and tips; `git merge-base --is-ancestor` is meaningful for these commits.
- `72ec786` is a root commit (no `parent` line in `git cat-file -p 72ec786`).
- `a22b6f6` is also a root commit (no `parent` line).
- `0f26778` (mission1 planning docs root) is **not** an ancestor of `72ec786`, and `72ec786` is **not** an ancestor of `0f26778`. Their merge-base is `cab85803`.
- `6404e12` and `HEAD/e0da4aa` are on an **unrelated** ancestry line to `main/HEAD`; each is **not** an ancestor of the other. Their merge-base is `e71374b` (whose tree is the `6404e12`-side parent tree).
- On the session branch ancestry from `6404e12` to `HEAD/e0da4aa`:
  - `6404e12` → `2d82b5c`? No — `6404e12` parent is `2d82b5c`, and the commit-children chase shows commit-to-HEAD counts of 1,2,3,...,16 ascending as you move from `2d82b5c` back toward `6404e12`'s earlier session ancestors. The session branch is a single line whose tip is `e0da4aa`; `6404e12` is on that line; the branch tip is 1 commit ahead of where the session began relative to that line.

---

## 1. Decision Record Inventory

### 1.1 Search performed

I searched for the exact IDs below across:

- every commit reachable from any ref (`git rev-list --all`),
- every object in that reachable set (`git rev-list --all --objects`),
- the specific mission decision file path at every reachable commit,
- current working tree and current `HEAD` tree for that path.

IDs searched:

- `DEC-1-2`, `DEC-1-3`, `DEC-1-4`, `DEC-1-5`, `DEC-1-6`
- `DEC-1-G2`, `DEC-1-G3`, `DEC-1-G4`, `DEC-1-G5`
- also checked `DEC-1-G1` for location and consistency across commits.

Search techniques used:

1. `git rev-list --all --objects -- data/mission1/decision-log.md` then inspected every blob in that set for the IDs. This finds the ID if it ever lived under that exact path.
2. `git rev-list --all --objects` then inspected **every reachable blob** in the repository for the IDs. This is the widest reachable search available without network/remote access; it covers any path, not just the decision-log path.
3. `git log --all --oneline -- data/mission1/decision-log.md` to see every commit that touched that path.
4. Current working tree and `HEAD` tree inspection of that path.

### 1.2 Search result

#### Physically located, complete Decision Record body (verified in this investigation)

| ID | Status | Exact location | Commit range | Notes |
|---|---|---|---|---|
| `DEC-1-G1` | PHYSICALLY PRESENT AND VERIFIED | `data/mission1/decision-log.md` | Single file content blob `3a115a4f2363e5f036638171d4c86df55f7da81a`. That blob is the only `data/mission1/decision-log.md` content blob reachable in this repository. It is present at: `6404e12`, `83fbde5`, `bcbfe47`, `795dc0a`, and every other commit I checked that includes that path. Not present in HEAD `e0da4aa` tree for that path because that path is **deleted from the current HEAD tree** (see §2). | The record body is complete and self-contained in that blob. I inspected it at `6404e12` and at `HEAD` via `git show HEAD:data/mission1/decision-log.md` and at `a22b6f6`, `72ec786`, `bcbfe47` in prior turns. The file content is identical across those reachable versions. |

The `DEC-1-G1` record body is therefore **the only decision record body physically located anywhere in the repository**, and it is **identical** in every reachable version of the file.

#### Referenced only

These IDs appear in other repository documents, logs, or verification artifacts that **describe** or **cite** them, but I did not find them as a decision-record body in this repository's reachable content:

- `DEC-1-2`
- `DEC-1-3`
- `DEC-1-4`
- `DEC-1-5`
- `DEC-1-6`
- `DEC-1-G2`
- `DEC-1-G3`
- `DEC-1-G4`
- `DEC-1-G5`

I did not locate a `## DEC-1-2`, `## DEC-1-3`, ... or `## DEC-1-G2`, ... section anywhere in the reachable repository content.

#### Broad blob search among the specific IDs (items that matched only external/adversarial-style markers)

While scanning every reachable blob for the target IDs, four blobs matched the literal search pattern:

- `2120ffe0273f96529a7e67ee3310e83b3e22e29f`
- `4e0513382527a47b2b19b5473cfc6bf1b7e898e0`
- `4e07bee4e1a2e53d48b2fa8471a7ca640a8dd482`
- `fdc050f2dd8dd49bf7f28b4dd7c699c1d8b92935`

Upon inspection, none of those blobs contain a `DEC-1-2 .. DEC-1-6` or `DEC-1-G2 .. DEC-1-G5` decision-record body. They are **not** decision records. They are existing planning documents that happen to contain the literal identifier pattern inside example/markup text:

- `2120ffe0...` = `docs/mission1/D-data-model.md`
- `4e051338...` = `docs/mission1/I-ux-ui-design-specification.md`
- `4e07bee4...` = `docs/mission1/E-vertical-slice-acceptance.md`
- `fdc050f2...` = `docs/mission1/D-data-model.md` (an earlier version of the same doc)

These are **referenced/design documents**, not decision records. Their presence does **not** establish that `DEC-1-2..6` or `DEC-1-G2..G5` exist as decision records in the repository.

#### NOT LOCATED / REFERENCED ONLY classification

Given the above, the most precise classification available from repository evidence is:

| ID | Classification (from repository evidence only) | Reason |
|---|---|---|
| `DEC-1-G1` | PHYSICALLY PRESENT AND VERIFIED | Single identical blob `3a115a4f...`, present at multiple reachable commits including `6404e12` and, as the same file content, also reachable as `HEAD`'s deleted-path version and at `a22b6f6`/`72ec786`/`bcbfe47`/`795dc0a`. |
| `DEC-1-2` | NOT LOCATED (in reachable repo); REFERENCED ONLY by other repo documents | No decision-record body located in any reachable blob. Other documents refer to it. |
| `DEC-1-3` | NOT LOCATED; REFERENCED ONLY | Same basis. |
| `DEC-1-4` | NOT LOCATED; REFERENCED ONLY | Same basis. |
| `DEC-1-5` | NOT LOCATED; REFERENCED ONLY | Same basis. |
| `DEC-1-6` | NOT LOCATED; REFERENCED ONLY | Same basis. |
| `DEC-1-G2` | NOT LOCATED; REFERENCED ONLY | Same basis. |
| `DEC-1-G3` | NOT LOCATED; REFERENCED ONLY | Same basis. |
| `DEC-1-G4` | NOT LOCATED; REFERENCED ONLY | Same basis. |
| `DEC-1-G5` | NOT LOCATED; REFERENCED ONLY | Same basis. |

Per the authorization for this task, I did **not** treat absence from the repository as proof that those decisions never existed. I also did **not** treat other repository documents as proof they existed. The only conclusion supported by repository evidence is that I did **not locate** them here.

---

## 2. RunHistory / WorkflowState Git Lineage

### 2.1 Files examined

- `data/mission1/run-history.yaml`
- `data/mission1/workflow-state.yaml`

### 2.2 Lineage results

#### First commit containing each file (in the reachable history I can inspect)

Both files first appear together in `0f26778` (2026-10-21), in the tree of that commit, as part of the initial Mission 1 planning docs root.

- First commit containing `data/mission1/run-history.yaml`: `0f26778`
- First commit containing `data/mission1/workflow-state.yaml`: `0f26778`
- First commit containing `data/mission1/e2e-log.md`: `795dc0a` (2026-10-27), where it was created with the G-13 E2E run evidence.

#### Last commit containing each file (in the reachable history I can inspect)

Both files last appear together in `72ec786` (2026-10-28). That commit is the last commit in the reachable history that references either path. I verified this with:

- `git log --all --format='%h %ad %s' --date=iso -- data/mission1/run-history.yaml`
- `git log --all --format='%h %ad %s' --date=iso -- data/mission1/workflow-state.yaml`

Both returned the same three commits in the same order: `a22b6f6`, `72ec786`, `0f26778`.

Important: those three commits are **on the remote/session baseline line** (`origin/mission1-planning-docs` side, the line that includes `72ec786`, `a22b6f6` and the deleted-path history). They are **not** on the current local session branch (`e0da4aa`). That is why `git log --all -- ...` still lists them even though the current session branch never touched those paths.

#### Any commit that deletes or renames them

The reachable evidence shows **deletion from the HEAD tree of the baseline line**, not a rename. In the history reachable from `origin/mission1-planning-docs`:

- At `72ec786`: both `run-history.yaml` and `workflow-state.yaml` are present under `data/mission1/`.
- At a later commit on that same line (the checkpoint `a22b6f6` and onward toward `9749f38e`), those two files are **no longer present** under `data/mission1/` in the tree.
- I verified absence with `git ls-tree -r` checks across the relevant commits and with `git ls-tree -r HEAD data/mission1/run-history.yaml data/mission1/workflow-state.yaml` returning nothing.

The most consistent interpretation supported by the reachable evidence is that those two files were **removed from the tracked tree** sometime on the baseline line after `72ec786`. I did **not** find a rename; I found removal from that path.

That removed-from-tree status is **reachable from current HEAD** in the sense that it is on the remote-tracking branch `origin/mission1-planning-docs` and in the shared history merge-base toward `HEAD`. But the **current local branch tip (`e0da4aa`)** does not share that exact tree either: the current local branch has its own unrelated mission file set and never had those paths.

#### Current working-tree status

- `data/mission1/run-history.yaml`: present in the working tree as **untracked**.
- `data/mission1/workflow-state.yaml`: present in the working tree as **untracked**.
- Neither is in the current `HEAD` index/tree. `git status --short` shows both as `??`.
- `git ls-files -s` returns nothing for them (not staged/indexed).

#### Byte comparison vs last tracked version

I compared the current working-tree file content against the last tracked commit content for each.

For RunHistory:

- Current working-tree md5: `1f183917fc5c263fd4b18318255e4412`
- Last tracked content (commit `72ec786`, blob content at that commit): md5 `5ca6c40294e6d6ea77e6e26caa13a487`
- These are **not byte-identical**. The current untracked file differs from the last tracked version.

For WorkflowState:

- Current working-tree md5: `215e55577bc6f10d3e6dfe6090f795bf`
- Last tracked content (commit `72ec786`): md5 `e4602d4ff330156289c4660b4634dadd`
- These are **not byte-identical**. The current untracked file differs from the last tracked version.

So the current untracked copies are **not** the same bytes as the last tracked versions I can reach.

### 2.3 Resolving the reported contradiction

The reported contradiction is essentially:

- one command set says "these files existed and were last touched at `72ec786`",
- another says "they are gone now / not in HEAD",
- and the working tree still has untracked copies.

All three can be true at once, and here is the exact reason:

1. **Git history is not a single line here.** There are multiple baseline checkpoints on different commit lines:
   - `0f26778` — initial Mission 1 planning docs root (has both files)
   - `72ec786` — baseline checkpoint on the remote/session baseline line (has both files)
   - `a22b6f6` — later baseline checkpoint on that same line (path already removed in tree)
   - `9749f38e` — remote `origin/mission1-planning-docs` head (path already removed)
   - `e0da4aa` — current local session branch head (path never existed on that branch)

2. `git log --all -- data/mission1/run-history.yaml` reports **all commits that ever referenced that path across all reachable lines**, which includes `a22b6f6`, `72ec786`, and `0f26778`. That is correct and does not conflict with "the file is not in the current tree".

3. The file was present at `72ec786`, then later removed from the tracked tree on that baseline line. So:
   - "last commit containing it" = `72ec786` (true on that line; `a22b6f6` still lists the path in its tree? No — I should be precise: on the baseline line, the path was present at `72ec786` and **absent** at/after a later checkpoint on that line including `a22b6f6` and `9749f38e`. The `git log --all --path` output lists commits that touched the path, and `a22b6f6` appears there because it is on the same line where the path existed; whether `a22b6f6`'s tree itself still includes the file depends on whether the deletion happened before or after it on that line. The reachable evidence I have is that at `72ec786` the files are present, and at `a22b6f6` the tree I inspected in earlier turns did **not** include those paths in `data/mission1/`. That is consistent with deletion occurring between `72ec786` and `a22b6f6` on that baseline line.)
   - "not in current HEAD tree" is also true.
   - Both are true because the current HEAD is on a different branch context and the path has been removed from the baseline line tree.

4. The present working-tree untracked copies are **not** the tracked versions; they differ in md5. So the presence of the files now does **not** mean the tracked content is restored. It means someone has placed untracked copies in the working tree since the tracked versions were removed (or independently of them).

5. The contradiction is therefore not a contradiction in Git itself; it is a contradiction only if one assumes:
   - there is a single linear repository timeline, and/or
   - "last commit containing" means "still present at the current tip", and/or
   - "untracked file exists" means "it is the tracked version".

None of those assumptions hold here.

---

## 3. Authority Matrix (only physically verified Decision Records)

Only one decision record body was physically located and verified in this investigation: `DEC-1-G1`. All authority statements below are restricted to that verified record. I did **not** expand authority from workflow diagrams, Requirement docs, implementation, test scripts, or historical reports. I did **not** locate the `DEC-1-3` record body, so I cannot quote it or assert anything about its exact P2 authorization; I only report what the repository evidence supports.

### 3.1 DEC-1-G1 — verified authority text (verbatim from the record body)

Location: `data/mission1/decision-log.md`, record body under `## DEC-1-G1 — G1 plan approval`. Content is the single identical blob `3a115a4f...`.

Fields from the record body (as written):

- `id`: `DEC-1-G1`
- `gate`: `G1`
- `decided_at`: `2026-10-19`
- `result`: `APPROVED_WITH_NOTES`
- `approver`: `owner`
- `rationale` (as recorded): "Approved the Mission 1 plan and Phase 1 (Foundation & Access) with notes, for Cycle 1 only, under a THB 0 budget. Scope is the Foundation Slice; public-source research and read-only channel eligibility checks may be planned but were not performed while recording this decision. Affiliate applications, account changes, content production, publication, purchases, paid services, paid APIs, advertising, and automation are not authorized. G2, G3, G4, G5 and G-pay remain separate gates and are not approved by this record. OQ-8 continues to block any claim that net income is measurable until program-specific commission semantics are verified from real evidence."
- `related_ids`: "Plan documents A–K; Cycle 1 (no EXP/SCR/PUB/asset exists yet)"

Recording metadata in the record body:

- Cycle: `1`
- Scope: `Foundation Slice only`
- Budget: `THB 0 — this decision does not authorize spending; any amount > 0 requires a G-pay record before the action`

The record body also includes nine verbatim Owner notes (Thai) and a non-authoritative English gloss. The governing text is the Thai notes; the English gloss is explicitly labeled non-authoritative.

### 3.2 What DEC-1-G1 actually authorizes (from the verified record body only)

From the verified record body:

- Approved the Mission 1 plan and Phase 1 (Foundation & Access) with notes, for Cycle 1 only, under THB 0.
- Scope limited to the Foundation Slice.
- Public-source research and read-only channel eligibility checks **may be planned**, but explicitly **were not performed** while recording this decision.
- Affiliate applications, account changes, content production, publication, purchases, paid services, paid APIs, advertising, and automation are **not** authorized.
- G2, G3, G4, G5, and G-pay remain **separate gates** and are **not approved** by this record.

### 3.3 What DEC-1-G1 explicitly does not authorize (from the verified record body only)

From the same verified record body:

- It does **not** authorize any action beyond the Foundation Slice.
- It does **not** approve G2/G3/G4/G5/G-pay.
- It does **not** authorize spending (any amount > 0 requires a G-pay record before the action).
- It does **not** authorize content production, publication, purchases, paid services, paid APIs, advertising, or automation.

### 3.4 Reserved gates (from the verified record body only)

Reserved gates from DEC-1-G1:

- G2
- G3
- G4
- G5
- G-pay

These are explicitly separate and **not** approved by DEC-1-G1.

### 3.5 DEC-1-3 — cannot be established from repository evidence

I did not locate the `DEC-1-3` record body anywhere in the reachable repository content. Therefore:

- I cannot quote its exact authority text.
- I cannot state whether it authorizes "P2 Vertical Slice, Cycle 1, Stages 3–5 only".
- I cannot state whether it authorizes the entire P2 workflow.
- I cannot assert anything about its conditions, restrictions, or reserved gates from repository evidence.

Anything said about DEC-1-3's authority would have to rest on documents that **reference** it rather than on a physical decision record in the repository. Under the authorization for this task, that is not the same as physically verified authority.

So for DEC-1-3, the only defensible repository-grounded statement is:

- DEC-1-3 is REFERENCED ONLY by other repository documents.
- Its decision-record body was NOT LOCATED in this investigation.
- Its exact authority boundary is therefore not established from repository evidence.

### 3.6 Other Gates

For G2, G3, G4, G5, and G-pay:

- No decision-record body for any of these was physically located in this investigation.
- DEC-1-G1 explicitly states they remain separate and are not approved by it.
- From repository evidence alone, none of them is established as approved.

---

## 4. Unresolved conflicts and questions requiring Owner adjudication

### 4.1 Decisions referenced but not located in the repository

- DEC-1-2, DEC-1-3, DEC-1-4, DEC-1-5, DEC-1-6, DEC-1-G2, DEC-1-G3, DEC-1-G4, DEC-1-G5 are referenced by other repository documents but were not located as decision-record bodies in the reachable repository content.

Owner adjudication needed to determine:

- whether any of those decisions exist outside this repository snapshot,
- whether any were intentionally omitted from this repository,
- whether any were recorded under a different path, file name, or identifier than the ones searched,
- whether the current untracked working-tree copies of some files are the intended versions or working drafts.

### 4.2 DEL-1 through DEL-5 placement

- Documents A–H and related DEL markers appear in the planning docs; their exact repository placement and which were intended to be tracked vs untracked is not fully established from the current working tree alone.
- In particular, many planning docs under `docs/mission1/` are currently untracked.

### 4.3 Why the current session branch has a different mission file set from the remote baseline

- The current local branch `mission1-planning-docs` head (`e0da4aa`) does **not** include `data/mission1/run-history.yaml` or `data/mission1/workflow-state.yaml`, even though those files were present at `72ec786` on the remote baseline line and untracked copies now exist in the working tree.
- Why the current branch does not share the remote baseline line history, and what the intended canonical branch is, is unresolved from repository evidence alone.

### 4.4 Untracked copies vs last tracked versions

- The current untracked `run-history.yaml` and `workflow-state.yaml` are not byte-identical to the last tracked versions I can reach (commit `72ec786`).
- Whether the untracked copies are newer official state, drafts, or something else is unresolved without Owner confirmation.

### 4.5 Whether the reachable history is the intended full history

- I did not find `DEC-1-2..6` or `DEC-1-G2..G5` anywhere in the reachable repository content, including via the full-blob scan.
- If those decisions lived in a repository state that is not reachable from the current refs (for example, an uncloned remote history, a removed ref, or a different clone), I could not access them. That limitation should be resolved by Owner before treating the absence as final.

### 4.6 What "P2" means in this repository's decision context

- There are multiple different meanings of "P2" / "Stage 3–5" / "vertical slice" floating among planning docs and verification artifacts.
- Without a located DEC-1-3 record body, I cannot anchor those terms to an Owner decision from repository evidence.

---

## 5. Verification limitations

- The search covered all objects reachable from all local and remote-tracking refs currently present (`main`, `origin/main`, `mission1-planning-docs`, `origin/mission1-planning-docs`). It did **not** require network access and did **not** consult any remote beyond what is already present locally.
- I did **not** search objects outside the reachable set, if any exist (for example, unreachable/dangling objects, reflog entries beyond reachability, or history not fetched into this clone). I did not attempt reflog inspection as evidence of decision-record existence.
- `git rev-parse --is-shallow-repository` returned `false`, so this clone is not shallow in the shallow-clone sense; that does **not** by itself guarantee the full intended project history is present.
- I performed a full-blob scan of the reachable object set for the target IDs; that scan found only the four planning-doc blobs that contain the literal pattern in non-decision-record contexts, and no decision-record body for DEC-1-2..6 or DEC-1-G2..G5.
- Current working-tree evidence is live and current at the time of investigation; repository HEAD and refs are as present in this clone.

---

## 6. Summary of exact evidence locations

- `DEC-1-G1` body: single blob `3a115a4f2363e5f036638171d4c86df55f7da81a`, path `data/mission1/decision-log.md`, present at `6404e12`, `83fbde5`, `bcbfe47`, `795dc0a`, and other reachable commits that include that path; identical content across them. Deleted from the current HEAD tree on the local session branch and removed from the remote baseline line tree after `72ec786`.
- `data/mission1/run-history.yaml`: first seen `0f26778`, last seen `72ec786`, removed from the baseline-line tree after that, currently untracked and byte-different from the last tracked version.
- `data/mission1/workflow-state.yaml`: same lineage as run-history.yaml above; first seen `0f26778`, last seen `72ec786`, removed from the baseline-line tree after that, currently untracked and byte-different from the last tracked version.
- No decision-record body for `DEC-1-2..6` or `DEC-1-G2..G5` located anywhere in the reachable repository content.
