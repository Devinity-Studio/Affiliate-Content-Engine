# Owner decisions — D-series acceptance cases

Date: 2026-10-21
Prepared by: implementation team (read-only)
Status: **Decision 1 decided 2026-10-21 (Option A) and applied to the documents.
Decisions 2 and 3 still waiting on owner.** No runtime, schema, or state file was
modified, nothing is staged, and no commit was created.

Related: [-final-contract-id-concurrency.md §4](../docs/mission1/-final-contract-id-concurrency.md#L135)
(acceptance matrix) · [d5-reserved-fields-review-2026-10-21.md](./d5-reserved-fields-review-2026-10-21.md)
(D5 + reserved fields) · [mission1-acceptance-gap-matrix.md](./mission1-acceptance-gap-matrix.md#L61)
(consolidated D-series status).

## Where the D-series stands

| Case | Status now | Blocked on |
|---|---|---|
| D1, D2 | **`Verified (scoped)`** — resolved as a contract clarification | — (Decision 1 decided 2026-10-21) |
| D3, D8 | Verified (matrix row still `NOT RUN`) | — |
| D4, D6, D7 | Partial evidence only | — |
| D5 | **Not verified** (`NOT RUN`) | Decision 3 |
| D9 | **Not Applicable as written** | Decision 2 |
| D10 | **`Verified (scoped)`**, owner-accepted | — |

Nothing in this table changes `DEF-CWI-1` (open), the reserved CWI fields (absent from
the schema), or Mission 1 completion (not established).

---

## Decision 1 — D1/D2: which identifier is `id`?

**Decided 2026-10-21 — Option A (keep the implementation, fix the matrix).** Applied to
the D1/D2 rows, new §4.2, the gap matrix, and this review. Verified by
[d1-d2-id-semantics-2026-10-21.log](./d1-d2-id-semantics-2026-10-21.log) and its
[re-run](./d1-d2-id-semantics-rerun-2026-10-21.log) (exit `0` twice, 25/25 checks
each) and the raw bodies in
[d-case-expectation-probe-2026-10-21.log:6-7](./d-case-expectation-probe-2026-10-21.log#L6).
The options below are kept as the record of what was considered.

**The disagreement.** The matrix rows for D1/D2 expect `id: "PLAN-1-1"` / `"PLAN-1-2"`
([L139](../docs/mission1/-final-contract-id-concurrency.md#L139), [L140](../docs/mission1/-final-contract-id-concurrency.md#L140)),
while §1.2 of the same document defines `id` as the immutable snapshot id
([L24-L28](../docs/mission1/-final-contract-id-concurrency.md#L24-L28)) and the running
server returns `PLAN-1-1-v1` / `PLAN-1-2-v1`
([d-case log:6-8](./d-case-expectation-probe-2026-10-21.log#L6)). One word, two
meanings.

| Option | What it means | Files touched | Cost / risk |
|---|---|---|---|
| **A. Keep the implementation, fix the matrix** (recommended) | Matrix rows state the **Plan id** (`PLAN-1-1`) and the **snapshot id** (`PLAN-1-1-v1`) as separate fields, matching §1.2 and the runtime | 2 matrix rows + §4.1-style note | Documents only; removes the Contradiction without changing behaviour |
| B. Keep the matrix, change the runtime | `create` returns `id: PLAN-1-1` and the snapshot id moves to another field | `app/server.js`, schema, contract, CWI/Plan tests, GET routes | Breaking: `GET /api/plan-version/PLAN-1-1-v1` and existing CWI references key off the snapshot id; needs migration and a new acceptance run |
| C. Leave it open | Contradiction stays recorded | none | Every D1/D2 acceptance claim stays unusable |

**Why A was chosen:** §1.2 is consistent, the runtime is consistent, and the snapshot
id is the value that has to stay immutable for D4/D6/D10 to mean anything. Only the
matrix's column label was wrong. The owner's ruling: `plan_id` is the Plan identity,
`id` is the immutable snapshot id.

---

## Decision 2 — D9: rewrite, delete, or implement the rejection?

**The disagreement.** D9 expects a `400` when a `new_version` request references a
nonexistent version ([L147](../docs/mission1/-final-contract-id-concurrency.md#L147)).
No such rejection exists: `body.version` is read only for the duplicate check
([:431](../app/server.js#L431), [:448](../app/server.js#L448)), otherwise the server
assigns the next version ([:464-466](../app/server.js#L464)). Measured:
`version: "v9"` → `201` with `PLAN-1-1-v3`.

| Option | What it means | Files touched | Cost / risk |
|---|---|---|---|
| **A. Rewrite D9 as the real behaviour** (recommended) | D9 asserts: a client-supplied `version` is **advisory** — it can only trigger the duplicate `409`; the server assigns the next number; no record named `v9` is created | 1 matrix row (+ explicit sentence in §2.2) | Documents only; converts an untestable row into a checkable one |
| B. Delete D9 | Row removed as unreachable | 1 matrix row | Loses the requirement's intent; nobody records that `version` is ignored |
| C. Implement the rejection | Server returns `400` for a version that is not the next expected one | `app/server.js` + contract + tests | Behaviour change; any caller that currently passes `version` (including D10's own request) changes meaning |

**Why A is recommended:** the current behaviour is defensible ("the server assigns
versions"), it is just undocumented. Option C would also make D10's request shape
depend on a stricter rule, so it should not be adopted without re-specifying D10.

---

## Decision 3 — D5 and the reserved CWI fields

Two separate things share this decision because they point at the same records.

### 3a. D5 — run it, or defer it?

D5 is `NOT RUN` and not reproducible as written: no request bodies, no expected status,
no operationalised "neither mutates", and its precondition ("state after D3") has
never run as an acceptance case ([d5 review §1.2](./d5-reserved-fields-review-2026-10-21.md#L122)).
`DEF-CWI-1` (unlocked read-modify-write in CWI create) is still open.

| Option | What it means | Cost / risk |
|---|---|---|
| **A. Defer, with a stated trigger** (recommended) | Mark D5 `Deferred`, citing B1–B6 and `DEF-CWI-1`; revisit after the defect is fixed *or* when the reserved-field policy is settled | Documents only; D5 stays unusable meanwhile |
| B. Run the §1.4 execution spec now | Sequential create of two CWIs on temp state; compares each CWI and the referenced version | Produces real evidence for "non-exclusive reference" and "record independence"; proves nothing about concurrency and does not clear `DEF-CWI-1` |
| C. Retire D5 | Fold the intent into the CWI contract suite | Loses a named case; no evidence either way |

**Recommendation:** A if the priority is a clean matrix; B is acceptable if the team
wants one piece of positive evidence now, provided the report says "sequential only".

### 3b. Reserved fields — keep frozen or open one?

`title`, `description`, `claims`, `source_ids`, `evidence_ids`, `updated_at` are listed
in Doc D §3.13 but absent from the schema, which uses `additionalProperties: false` —
so every one of them is currently a `400` if sent.

| Option | What it means | Cost / risk |
|---|---|---|
| **A. Keep all six frozen** (recommended) | No schema change until `claims` vocabulary, `source_ids`/`evidence_ids` overlap, and `updated_at` vs append-only are decided | Documents only |
| B. Open `title` + `description` first | Cheapest pair; no dependency on the open vocabulary questions | Schema + §3.13 + validator + enforcement cases + rerun; small, well-bounded |
| C. Open `claims` now | Requires unifying `claim_map.kind` with `claim_class` first | Two vocabularies risk becoming three; do not do this first |

**Why A is recommended:** `updated_at` conflicts with append-only, and `claims` would
create a third claim vocabulary. `title`/`description` (B) is the only low-risk slice
and can be taken independently whenever the owner wants a quick win.

---

## What happens after a decision

Each choice has a fixed follow-through so nothing is left implied:

1. Edit only the rows/paragraphs named in the option — no opportunistic rewrites.
2. Re-run `node verification/check-md-links.js` on every edited document.
3. Record HEAD hash and `existing commit count` vs `new commits this round` in the log.
4. Confirm `app/server.js`, the schema, and `data/app/state.json` checksums are unchanged.
5. Stage and commit **only on explicit instruction**; this document authorizes neither.

If an option requires runtime work (Decision 1B, 2C, 3b), it needs its own bounded task,
its own tests, and its own evidence log — not a silent edit alongside a doc fix.
