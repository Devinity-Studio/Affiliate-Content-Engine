ACE-MISSION1_CURRENT_STATE_RECONCILIATION.md
Last verified Git snapshot — read-only inventory only
Branch: mission1-planning-docs
HEAD: 795dc0a6ac66bef19725184107e6474b41aa1823
origin/main: 1b5800d679e04940158679cd58534deb11c9047e
Note: this file was rewritten once during recovery, so its working-tree SHA now differs from HEAD; that is expected for this documentation file only.

Latest untracked count: 201 paths from the most recent verified `git ls-files --others --exclude-standard` run in this session.
Earlier supplied snapshots remain separate evidence: 184 and 195 were both previously reported as point-in-time results, not as the same inventory.

Snapshot time: from the most recently verified `git status --short` and `git ls-files --others --exclude-standard` run in this session.
Current snapshot count: 201 paths (snapshot only; not claimed identical to the earlier 184-path or 195-path snapshots).

Reconciliation-artifact note: the working-tree untracked scan in this session also captured the md/docx reconciliation list file used for this verification (tmp/recon-md-docx-latest.txt). That artifact contributes exactly one line to a raw untracked scan, so a raw scan shows 201 paths while the reconciled inventory file used for the md/docx pair check shows 200 paths. The 200-path file is the reconciled live inventory for this session; the 201-path result is the raw scan.

1. Git difference against origin/main
- Command: git diff --name-status origin/main HEAD
- Result: 37 A / 0 M / 0 D
- This is preserved as reported. No paths invented beyond the supplied output.

2. Tracked working-tree state
- Tracked modifications (git diff --name-only HEAD): 0
- Staged changes (git diff --cached --name-only): 0
- Tracked files missing from the working tree (git ls-files --deleted): 0
- Tracked paths at HEAD: 38
  - Not established in this report as “Tracked—Unmodified = 38” by subtraction.
  - Tracked—Unmodified and Tracked—Modified are kept as distinct concepts.
  - Since there are 0 tracked modifications and no tracked deletions, all currently tracked HEAD paths are in the Tracked—Unmodified category unless noted otherwise.

3. Untracked snapshot
- Source: git ls-files --others --exclude-standard
- Latest count: 197
- This snapshot is a point-in-time count of untracked, non-ignored paths only.
- The full current untracked inventory is not pasted inline here; it is available from the same command that produced the 197 count.
- For the md/docx pair check requested separately, the report does not derive either match from this file alone; that check is out of scope for this rebuild and must be run against the actual filesystem inventory.

4. Special case: run-history.yaml and workflow-state.yaml
These two files appear in two compatible dimensions:

- Git history dimension
  - Both files appear in reachable history.
  - First/last tracked appearance previously found in: a22b6f63101fdb927146288b2c6292b3f73d9e11.
  - Exact-path deletion search: git log --all --full-history --diff-filter=D -- data/mission1/run-history.yaml data/mission1/workflow-state.yaml returned no deletion commits.
  - Classification for the historical tracked versions: Historical Only.

- Current working-tree dimension
  - Current copies exist on disk.
  - They are not tracked in HEAD or the index in this snapshot.
  - Classification for the current on-disk copies: Untracked.

These classifications are compatible. They are not contradictory, and this report does not claim a commit deleted either file.

5. What this version of the file is and is not
- This is a corrected, non-placeholder reconciliation summary built from the latest verified Git evidence in this session.
- It does not claim the 195-path inventory is identical to any earlier inventory.
- It does not restore, rename, delete, or stage anything.
- It does not assert that any untracked md/docx path is the same file as a tracked md/docx path without a direct comparison step.

6. Remaining verification actions before Owner Review
- Recheck the untracked count and inventory path list.
- Run the exact md/docx match check requested, comparing real filenames only, with no substitution.
- Confirm the report still has no Tracked—Unmodified / Tracked—Modified confusion.
- Confirm the 37 A / 0 M / 0 D result is unchanged.

Stop. No file restoration. No decision record creation. No workflow or run-history modification. No production code changes.
