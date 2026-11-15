# ACE-S6-GOVERNANCE-DECISION-MATRIX-01

## Governance Decision Matrix — Mission 1 / S-6

| Field | Value |
|---|---|
| **Revision** | `0.2` |
| **Status** | `PROPOSED — NOT APPROVED` |
| **Mode** | Read-only governance review |
| **Authority** | Owner review and explicit decision required |
| **Supersedes** | Revision `0.1` (also unapproved) — not withdrawn, not replaced in any governed record |
| **Task ID** | `ACE-S6-GOVERNANCE-MATRIX-REV02` |
| **Prepared by** | Document Creator |
| **Phase** | 1.2 — Governance Adjudication |
| **Date** | 2026-11-05 |

> This document is a proposal. It is not a Governance Decision, not an execution
> instruction, not an authorization, and not a change to the ACE repository. Its
> SHA-256 is an integrity reference for this file only and does not constitute
> Owner approval or authorization of anything described in it.

---

## 0. Document Control

### 0.1 Basis of this revision

Revision 0.2 was prepared against the Super Brain Independent Review findings on
Revision 0.1 and the Phase 1.1 reconciliation findings.

**Recorded limitation (must remain visible):** the text of Revision 0.1 was not
present in the inspected workspace at the time of this revision. A search for the
identifier `ACE-S6-GOVERNANCE-DECISION-MATRIX-01` and for the tokens it relies on
(`D-05`, `GOVERNANCE-DECISION-MATRIX`, `Super Brain Independent Review`) returned
**0 hits** across the repository working tree, `.git`, and the retained external
transcript (`.zwork/attachments`). Revision 0.2 therefore:

- preserves the decision identifiers and the dispositions named explicitly in the
  Revision 0.2 brief;
- rebuilds the surrounding register entries from the verified Phase 1.1 findings;
- does **not** assert that any unchanged passage reproduces Revision 0.1 verbatim.

If Owner holds Revision 0.1, the two should be diffed before this proposal is
treated as a substitute. Until then, Revision 0.1 remains the earlier statement of
the matrix and is not deleted, withdrawn, or superseded in any governed record.

### 0.2 Revision history

| Rev | Change | Nature |
|---|---|---|
| `0.1` | Initial governance decision matrix | Proposal; never approved |
| `0.2` | **C1** — D-05 narrowed to Phase 1.2 governance review; A2 execution moved to new **D-09** (`NOT AUTHORIZED — REQUIRES SEPARATE OWNER DECISION`) | Separation of review from execution |
| `0.2` | **C2** — D-02 restated as reported documentation-level acceptance with unresolved applicability to the current repository file revision | Historical preservation |
| `0.2` | **C3** — D-04 records the A2 protocol hash **provenance conflict**; both earlier and later reports preserved | Non-overriding history |
| `0.2` | **C4** — R-03 and Section 7 restructured into decision-critical vs historical-supporting evidence, with per-dependency blocking statements | Proportionality of source recovery |
| `0.2` | **C5** — Section 9 split into three independent Owner decision levels | Authorization separation |
| `0.2` | Added Section 3 **Current Governance Status** (carried-forward reported statuses) | Status clarity |
| `0.2` | All authorization boundaries retained verbatim in Section 1.3 | Non-negotiable |

---

## 1. Purpose, Scope, and Non-Negotiable Boundaries

### 1.1 Purpose

Provide a single, reviewable index of the governance questions currently open on
Mission 1 / S-6, the evidence each question actually rests on, which decision type
each question requires, and which missing evidence genuinely blocks a decision —
as distinct from missing evidence that is merely historical.

### 1.2 Scope

In scope: decision register, dependency classification, status reporting,
Owner decision levels, and the source-recovery proportionality rule.

Out of scope: any execution, any Gate transition, any repository change, any
reconstruction of missing source documents, and any determination of historical
fidelity.

### 1.3 Non-negotiable authorization boundaries

This document, and any review or approval of it, does **not** authorize:

- A2 execution;
- any Gate change;
- any OPEN-6 status change;
- M1–M3 execution or any change to their status;
- repository edits;
- commits, pushes, merges, or rebases;
- reconstruction or replacement of missing source documents;
- invented evidence;
- inferred Owner authorization;
- any automatic approval resulting from document review or governance review.

A separate, explicit Owner decision is required for each of the above.

---

## 2. Evidence Classification and Reporting Conventions

Every statement in this matrix carries one of four classes. The distinction is
load-bearing: the same status word can be *reported* and still be *unverified*.

| Class | Meaning | Can it support a Governance Decision alone? |
|---|---|---|
| `DIRECT` | Inspectable in the repository or Git metadata at a stated revision; hash or object identity can be recomputed | Yes, for the fact it directly shows |
| `REPORTED` | Stated in a retained report or transcript; no independently recomputable artifact | Only as reported evidence, with the limitation recorded |
| `INFERRED` | Derived by reasoning from DIRECT or REPORTED items; always labelled as inference | No |
| `ABSENT` | Searched for and not found in any inspected source | No — and its absence must not be read as a negative finding about history |

Retained conflict rule: when two retained reports disagree, **both are preserved
with their provenance**. Neither silently overrides the other, and no attempt is
made to decide between them by plausibility.

---

## 3. Current Governance Status

Carried-forward **reported** statuses. These are not newly verified results and
are not new Owner decisions. Each row states its own evidence class.

| Item | Status | Class |
|---|---|---|
| **SB-02-R1** | `DRAFT — PROPOSED — NOT APPROVED` in repository file; historical documentation-level acceptance reported, revision applicability unresolved | REPORTED + DIRECT (file state) |
| **A1 Infrastructure** | `CLOSED — PASS` (REPORTED); independent artifact verification `NOT VERIFIED` | REPORTED |
| **A2 Execution** | `NOT AUTHORIZED` | REPORTED (consistent across retained sources) |
| **OPEN-6** | `ENVIRONMENT BLOCKED` | REPORTED |
| **Gate B/B2** | `NOT PASSED` | REPORTED |
| **Gate C** | `NOT AUTHORIZED` | REPORTED |
| **M1–M3** | `NOT RUN` | REPORTED |
| **Source Recovery** | `INCOMPLETE`; targeted recovery of `A2-FEP-COE v0.3` `CLOSED — NOT FOUND` | REPORTED |
| **CODEX-02-R2** | `NOT ASSEMBLED / NO EVIDENCE` | ABSENT (0 hits in all inspected sources) |

**Naming caution retained from Phase 1.1.** `M1–M4` / `m1–m7` are *amendment
identifiers* (U-17), while `M1–M3` in the status table above are *run stages*
("M2/M3 must not be run"). These are different identifier families and must not be
conflated. Likewise `OPEN-6` (an S-6 work package name) is not `OQ-6` (a budget
open question recorded in Doc G).

---

## 4. Decision Register

Each entry states the question, the evidence actually available, what a decision
would change, the recommended disposition, and **which Owner decision level**
(Section 9) the question requires.

### D-01 — Is the historical Amendment Package recovered?

- **Question:** Has the original Amendment Package been recovered, such that the
  M1–M4 / m1–m7 wording can be treated as historical text?
- **Reported state:** Not recovered. CODEX-01 recorded `Original Amendment
  Recovery: NOT ESTABLISHED` and `Historical Fidelity: NOT VERIFIED`.
- **Class:** REPORTED.
- **What a decision would change:** whether reconstructed wording remains labelled
  `RECONSTRUCTED / PROPOSED` (U-17) or could ever be cited as historical text.
- **Recommended disposition:** `KEEP OPEN — NOT ESTABLISHED`. Reconstructed
  wording must continue to be labelled as such; no upgrading to historical text.
- **Owner decision level:** Level 2 (Governance Decision).

### D-02 — Does SB-02-R1 carry Owner acceptance, and to which revision does it apply?

- **Question:** What exactly does the reported "OWNER ACCEPTED" for SB-02-R1
  establish, and does it attach to the revision currently in the repository?
- **Reported state (all three parts must be read together):**

  1. **Reported historical acceptance.** Retained reports dated 2026-11-05
     (09:31, 09:46, 09:48, 09:53) record SB-02-R1 as `OWNER ACCEPTED —
     documentation-level only`, subject to limitations U-17 through U-22, and
     explicitly state that this acceptance **does not authorize A2 execution** and
     that the Owner should not be asked to approve it again (D-02 recorded as
     `ESTABLISHED`).
  2. **Current repository file status.** The file
     `SB-02-R1 — Controlled Revision Patch.md` on disk
     (sha256 `943ccd61…f498`, 5,509 bytes, mtime 2026-11-05 10:13:27 — i.e.
     written *after* the reports above) still reads
     `Revision status: DRAFT — PROPOSED — NOT APPROVED`, and §4 states
     "Workstream closure does not constitute Owner acceptance of this proposal."
  3. **Applicability.** No retained source binds the reported acceptance to a
     revision identifier or content hash. Whether the acceptance covers this file
     revision, an earlier revision, or the proposal in substance is not
     determinable from the evidence held.

- **Status wording (C2):**

  > `Reported documentation-level acceptance exists; applicability to the current
  > repository file revision remains unverified.`

- **Class:** REPORTED (acceptance) + DIRECT (file state and hash).
- **What is explicitly NOT claimed:** that the Owner has never accepted the
  proposal (unsupported — acceptance is reported); and that the current
  repository file revision is approved (unsupported — the file says otherwise).
- **What must NOT be requested:** repeated approval of SB-02-R1 solely because the
  attributable revision/hash record is missing. D-02 is recorded as established;
  re-requesting it would reopen a closed decision without new evidence.
- **Recommended disposition:** `ACCEPT REPORTED; RECORD APPLICABILITY AS
  LIMITATION`. If an attributable record is later produced, it should be filed as
  a decision record addendum (revision id + hash + date), not as a re-approval.
- **Owner decision level:** Level 2 for the current-revision applicability gap;
  **not** Level 3, and not a re-approval request.

### D-03 — Is the A1 PASS sufficient evidence for infrastructure capability?

- **Question:** Does the reported A1 result establish the environment capability
  it is cited for?
- **Reported state:** `CLOSED — PASS` (4 Nov 15:18) — directory symlink created,
  file symlink created, reparse tag `0xa000000c`, cleanup PASS, residual 0. Earlier
  the same day (13:44) the same item was `INCONCLUSIVE`, with the JSON evidence
  never received. No A1 artifact exists in the repository (0 hits), and the
  intermediate transition INCONCLUSIVE → PASS has no retained record. The status is
  also limited by its own reporting to *infrastructure capability only*, which does
  not establish A2 classifier or traversal execution capability.
- **Class:** REPORTED; artifact ABSENT.
- **Recommended disposition:** `ACCEPT AS REPORTED — SCOPE LIMITED TO
  INFRASTRUCTURE CAPABILITY`. If this evidence is ever cited for A2 execution
  readiness, an independent artifact (JSON + hash) must be produced first.
- **Owner decision level:** Level 2 if the limitation is to be formally accepted.

### D-04 — What is the provenance of the A2 Execution Protocol v2.4 hash?

- **Question:** Which exact source file, revision, and transfer did the earlier
  canonical hash verification refer to?
- **Reported state — two retained reports, both preserved (C3):**

  1. **Earlier report.** An earlier retained report states that
     `A2 EXECUTION PROTOCOL v2.4` passed canonical hash verification.
  2. **Later report (Phase 1.1).** The Phase 1.1 investigation reported that no
     canonical hash was found in the inspected sources, and recorded the v2.4 text
     as present in the external transcript (30,706 bytes) with SHA-256 listed as
     *not predeclared*, together with an explicit instruction not to assume a hash.

- **Status wording (C3):**

  > `HASH VERIFICATION — HISTORICALLY REPORTED; CURRENT SOURCE PROVENANCE
  > UNRESOLVED`

- **What remains open:** the identity of the source file, revision, and transfer
  channel that the earlier verification covered. The two reports are compatible if
  the earlier verification referred to a source artifact not present in the
  Phase 1.1 inspected set — but that reconciliation is **not established** and is
  not asserted here.
- **What is NOT claimed:** that the earlier verification was false; that it is
  currently independently reproducible; or that no hash was ever computed.
- **Recommended disposition:** `PRESERVE BOTH REPORTS; RESOLVE BY LOCATING THE
  ORIGINAL ARTIFACT`. Until then, v2.4 is cited by content and byte size only, with
  no hash asserted as canonical.
- **Owner decision level:** Level 2 (accept the unresolved status) — or Level 1 if
  Owner can supply the artifact identity.

### D-05 — May Phase 1.2 governance review proceed?

- **Question:** May Phase 1.2 governance review proceed?
- **Reported state:** Phase 1.1 reconciliation is complete; the remaining work is
  adjudication over evidence already held. No execution is required to answer the
  open governance questions in this register.
- **Class:** REPORTED + DIRECT (the evidence set itself is inspectable).
- **What a decision would change:** whether governance review continues. **It
  changes nothing about authorization.**
- **Recommended disposition:** `PROCEED WITH READ-ONLY GOVERNANCE REVIEW`.
- **Explicit boundary (C1):** proceeding with Phase 1.2 governance review does
  **not** authorize A2 execution, any Gate change, any OPEN-6 change, any M1–M3
  run, or any repository change. A2 execution is decided only under **D-09**.
- **Owner decision level:** Level 1 (Document Review) may suffice to confirm the
  matrix; Level 2 confirms the review scope. Neither reaches Level 3.

### D-06 — May OPEN-6, Gate B/B2, or Gate C status change?

- **Question:** Is any status change authorized for OPEN-6, Gate B/B2, or Gate C?
- **Reported state:** `OPEN-6 = ENVIRONMENT BLOCKED`; `Gate B/B2 = NOT PASSED`;
  `Gate C = NOT AUTHORIZED`. No retained source authorizes a change.
- **Class:** REPORTED.
- **Recommended disposition:** `NO CHANGE — STATUS REMAINS AS REPORTED`.
- **Owner decision level:** Level 2 for the governance boundary; any actual Gate
  transition requires its own separate explicit decision and supporting evidence.

### D-07 — How complete must Source Recovery be before decisions proceed?

- **Question:** Must every historical source be recovered before governance
  decisions can be made?
- **Reported state:** Source Recovery is `INCOMPLETE`; targeted recovery of
  `A2-FEP-COE v0.3` is `CLOSED — NOT FOUND`. Several named sources have never been
  present in this workspace (Section 7.4).
- **Class:** REPORTED + ABSENT.
- **Recommended disposition:** `NO — RECOVERY IS PROPORTIONATE TO THE DECISION`.
  Historical supporting evidence may remain unresolved and be recorded as a
  limitation. Only decision-critical evidence (Section 7.1, class A) blocks the
  specific decision that relies on it.
- **Owner decision level:** Level 2.

### D-08 — Is CODEX-02-R2 required, and for what?

- **Question:** What is CODEX-02-R2, and is it a precondition for anything here?
- **Reported state:** `NOT ASSEMBLED / NO EVIDENCE`. Zero hits across repository,
  `.git`, and the retained transcript. The only contextual trace is the declared
  workflow `GLM v0.3 → Super Brain Review → Codex Independent Review → Owner
  Decision`, and the completed `CODEX-01 = PASS WITH LIMITATIONS`.
- **Class:** ABSENT.
- **Recommended disposition:** `NO ACTION — NO EVIDENCE`. It cannot gate any
  decision in this matrix, because its scope, inputs, and required output are
  undefined. A definition from Owner is required before it can be treated as a
  dependency at all.
- **Owner decision level:** Level 2 (define or decline).

### D-09 — Is A2 execution authorized?

- **Question:** Is A2 execution authorized?
- **Current status (C1):** `NOT AUTHORIZED — REQUIRES SEPARATE OWNER DECISION`.
- **Class:** REPORTED — consistent across every retained source that addresses it,
  including SB-02-R1 §5 and the protocol text.
- **What would be required before any change:** a separate, explicit Owner
  authorization naming the activity, its scope, and its evidence prerequisites —
  none of which exists today.
- **Recommended disposition:** `NO CHANGE — NOT AUTHORIZED`.
- **Owner decision level:** **Level 3 only.** Approval at Level 1 or Level 2 does
  not reach this decision, and no document review, however favourable, produces it.

---

## 5. Dependency Register

`Blocks` columns answer one question each: does this missing item prevent that
activity *today*? A dependency that blocks nothing is retained, not dropped — it
becomes a recorded limitation.

| ID | Dependency | Status | Class (C4) | Blocks Phase 1.2 review? | Blocks a Governance Decision? | Blocks A2 execution? | Blocks Gate/status change? |
|---|---|---|---|---|---|---|---|
| R-01 | Repository evidence at a stated revision (HEAD `3de3443`, 2 modified tracked files, 171 untracked entries) | AVAILABLE | DIRECT | No | No | N/A — execution not authorized | No |
| R-02 | Git and remote provenance (push 2026-11-04T08:35:52Z; `main` = `19dfa1f`, divergent from branch; PR #1 open, not merged) | AVAILABLE | DIRECT + REPORTED | No | No | No | No |
| R-03 | Source-recovery dependency cluster: `SB-01`, `A2-FEP-COE` v0.1–v0.3, `S-6 rev.3`, `Z-1`, `T24–T28`, `CODEX-01` review record (only its result summary exists) | INCOMPLETE / `v0.3 CLOSED — NOT FOUND` | ABSENT (locally) | **No** | Only D-01 (recovery status) — and D-01 is already answered `NOT ESTABLISHED` | **No** — A2 is not authorized regardless | No |
| R-04 | A1 environment-capability artifact (JSON + hash) | ABSENT | ABSENT | No | Only if A1 is cited beyond infra capability (D-03) | Not today; would be needed if A1 is ever used as an A2 readiness input | No |
| R-05 | Canonical hash of A2 v2.4 / v2.4.1 | UNRESOLVED (provenance conflict, D-04) | REPORTED + ABSENT | No | Yes — D-04 cannot be closed without it | No | No |
| R-06 | Attributable Owner decision record for SB-02-R1 acceptance (revision id + hash + date) | ABSENT | ABSENT | No | Only the D-02 applicability sub-question | No | No |
| R-07 | Definition/scope of `CODEX-02-R2` | ABSENT | ABSENT | No | Only D-08 (define or decline) | No | No |
| R-08 | Written rationale for the 2026-11-04 push, which conflicts with the same-day closure record and with the standing no-git-operations instruction | ABSENT | ABSENT | No | No | No | No |

**R-03 note.** The identifier `R-03` is retained and its subject is restated as the
source-recovery dependency cluster, per the Revision 0.2 brief. No claim is made
about Revision 0.1's exact wording for this row.

**Reading of the table.** No row in this register blocks Phase 1.2 read-only
review. The only decisions genuinely blocked are narrow and named: D-04 by R-05,
the applicability sub-question of D-02 by R-06, D-08 by R-07. D-01 and D-07 are
answerable as "not established" and "proportionate" without any further recovery.

---

## 6. Records Requiring Parallel Preservation

Three retained conflicts are preserved rather than resolved. Each is a historical
record; resolving them is not required to complete Phase 1.2.

1. **A2 v2.4 hash.** Earlier report: canonical hash verification passed. Later
   report: no canonical hash found in inspected sources. → D-04. Both retained.
2. **Push event, 2026-11-04.** A closure record dated the same morning states
   "Push: ไม่มี — branch ahead 12", yet local reflog, remote refs
   (`origin/mission1-planning-docs = 3de3443`), and the GitHub API
   (`pushed_at = 2026-11-04T08:35:52Z`, identical second to PR #1's
   `updated_at`) all place a push at 15:35:52 +07 — after a same-day brief that
   prohibited Git operations. No retained source authorizes or explains the push.
   → R-08. Reported as a conflict; no attribution assigned.
3. **SB-02-R1 acceptance vs file status.** Reported acceptance (09:31–09:53)
   precedes the on-disk file (10:13) which still reads `NOT APPROVED`. → D-02.
   Both retained; neither overrides the other.

---

## 7. Source Recovery Plan — Proportionality Rule

### 7.1 A. Decision-critical evidence

Evidence that **must** be available before the specific decision relying on it can
be made.

| Evidence | Blocked decision | Why it is decision-critical |
|---|---|---|
| Canonical hash / artifact identity of A2 v2.4 (R-05) | D-04 | The decision is *about* hash provenance; without the artifact the question cannot be closed |
| Definition of `CODEX-02-R2` (R-07) | D-08 | An undefined item cannot be assessed, scheduled, or gated |
| Attributed acceptance record (R-06) | D-02 applicability sub-question only | Only needed if the acceptance must be bound to a specific revision |

### 7.2 B. Historical supporting evidence

Evidence that may remain unresolved and be recorded as a limitation, because the
current decisions do not depend on it.

`SB-01` · `A2-FEP-COE` v0.1–v0.3 · `S-6 rev.3` · `Z-1` · `T24–T28` · `CODEX-01`
review record · A1 JSON artifact (unless D-03's limitation is challenged) ·
push rationale (R-08).

These remain `OPEN LIMITATION`. Their absence is **not** evidence that they never
existed, and it does **not** justify reconstructing them.

### 7.3 Proportionality rule

- Phase 1.2 read-only review **must not** be delayed pending full historical
  recovery.
- A dependency is pursued only when it is decision-critical per Section 7.1, or
  when a new source lead appears.
- **Completed targeted searches are not to be reopened** without either a new
  source lead or a specific decision-critical reason stated in advance. In
  particular, the `A2-FEP-COE v0.3` targeted search remains `CLOSED — NOT FOUND`
  and is not to be retried as a routine step.
- Every unresolved item is carried into the limitation register (Section 7.4) with
  its identifier, so that "not found" is recorded rather than silently dropped.

### 7.4 Limitation register (carried forward)

| ID | Limitation | Effect |
|---|---|---|
| L-01 | A1 PASS has no independently verifiable artifact | A1 citable for infrastructure capability only |
| L-02 | A2 v2.4 hash provenance unresolved | v2.4 citable by content/size only, never as hash-verified |
| L-03 | SB-02-R1 acceptance not bound to a revision/hash | acceptance recorded as reported; applicability unverified |
| L-04 | Several named sources never present in this workspace | recovery status stays `INCOMPLETE` |
| L-05 | `CODEX-02-R2` undefined, no evidence | cannot act as a gate |
| L-06 | Push of 2026-11-04 unexplained; conflicts with closure record | recorded conflict; no attribution |
| L-07 | ACE R1 line citations no longer resolve in the working tree (observed drift: `content.js` 1213→1646; `service.js` 3016→3073 and 3052→3105) because of uncommitted edits | cite by commit + blob or symbol, not by line number |

---

## 8. Gate and Status Boundary

Statuses remain exactly as reported in Section 3. This document proposes **no**
transition and records **no** new decision. Any transition requires its own
explicit Owner decision supported by evidence that satisfies Section 7.1.

---

## 9. Owner Decision Levels (C5)

Owner decisions fall into three **independent** levels. Advancement is never
automatic and never cumulative.

### Level 1 — Document Review

*What it is:* confirmation that this matrix accurately represents the available
evidence and proposals.
*What it produces:* a correction list, or acceptance of the document as a fair
representation.
*What it does not produce:* approval of any disposition, any governance rule, or
any activity.

### Level 2 — Governance Decision

*What it is:* approval of evidence-handling rules, dispositions, or governance
boundaries — for example accepting a limitation, confirming a status as reported,
or adopting the proportionality rule in Section 7.
*What it produces:* a governance position that future reviews may cite.
*What it does not produce:* permission to execute anything.

### Level 3 — Execution Authorization

*What it is:* separate, explicit authorization for a specific activity — A2
execution being the only such activity contemplated here.
*What it produces:* permission for that named activity, within the stated scope,
and nothing else.
*What it does not produce:* Gate changes, OPEN-6 changes, or M1–M3 runs, each of
which requires its own explicit decision.

### 9.1 Independence rules

- Approval at **Level 1 does not imply Level 2.**
- Approval at **Level 1 or Level 2 does not imply Level 3.**
- **A2 execution requires a separate explicit Owner decision** (D-09).
- **Gate/status changes require their own explicit decision** (D-06).
- No document review, governance review, or review outcome — including a
  favourable Super Brain Independent Review of this proposal — constitutes
  authorization of any activity.

### 9.2 Decision routing summary

| Decision | Level required | Current status |
|---|---|---|
| D-01 Amendment recovery | 2 | `NOT ESTABLISHED` |
| D-02 SB-02-R1 acceptance applicability | 2 (no re-approval) | `REPORTED; APPLICABILITY UNVERIFIED` |
| D-03 A1 evidence sufficiency | 2 | `REPORTED; SCOPE-LIMITED` |
| D-04 v2.4 hash provenance | 2 (or 1 if artifact supplied) | `UNRESOLVED` |
| D-05 Phase 1.2 review proceeds | 1 / 2 | `RECOMMENDED: PROCEED READ-ONLY` |
| D-06 OPEN-6 / Gate B/B2 / Gate C | 2 (+ separate decision for any transition) | `NO CHANGE` |
| D-07 Source recovery proportionality | 2 | `RECOMMENDED: PROPORTIONATE` |
| D-08 CODEX-02-R2 | 2 | `NO EVIDENCE` |
| D-09 A2 execution | **3** | `NOT AUTHORIZED` |

---

## 10. Integrity Reference

SHA-256 of this file is recorded in the accompanying completion report and must be
recomputed by any reviewer who relies on it. A matching hash establishes only that
the reviewer holds the same bytes as this revision. It is **not** Owner approval,
not authorization, and not evidence of historical fidelity.

---

## 11. Open Ambiguities Referred to Owner

1. **Revision 0.1 text was unavailable** (Section 0.1). Confirm whether a diff
   against the held 0.1 is required before this proposal is reviewed.
2. **D-02 applicability.** If an attributable acceptance record exists outside this
   workspace, supplying revision id + hash + date closes the sub-question without
   any re-approval.
3. **D-04 provenance.** Locating the artifact the earlier hash verification covered
   would reconcile the two reports; otherwise the conflict stands as recorded.
4. **D-08 definition.** `CODEX-02-R2` needs a purpose and inputs before it can be
   treated as a dependency.
5. **R-08 push rationale.** Whether an explanation is required, or the event is to
   remain a recorded unexplained conflict, is an Owner call.

---

*End of Revision 0.2 — `PROPOSED — NOT APPROVED`. No authority is granted by this
document. No repository change was made in producing it.*
