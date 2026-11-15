# D5 and reserved-field policy — read-only review

Review date: 2026-10-21
Reviewer role: implementation team (read-only)
Scope: acceptance case **D5** in
[-final-contract-id-concurrency.md](../docs/mission1/-final-contract-id-concurrency.md#L143)
and the **reserved** CWI fields listed at the end of
[D-data-model.md §3.13](../docs/mission1/D-data-model.md#L212).

**What this review did NOT do:** no runtime file was modified, no schema field was
added, no request against D5 was executed, and nothing was committed. **D5 remains
`NOT RUN`.** Every statement below is either a quote from an existing document, an
inspection of the current code, or an explicitly labelled proposal.

---

## 0. Findings summary, classified and line-referenced

Three kinds of finding, kept separate because they need different owners:
**D** = real defect in code, **A** = requirement ambiguity (needs a decision),
**M** = documentation mismatch (the doc and the code/behaviour disagree).

| ID | Class | Location | What the source says | What the code/evidence shows |
| --- | --- | --- | --- | --- |
| DEF-CWI-1a | **D** | [app/server.js:507](../app/server.js#L507), read at [:539](../app/server.js#L539), write at [:601](../app/server.js#L601) | Doc D §3.13 states the CWI id is server-generated so no two records share one ([D-data-model.md:232](../docs/mission1/D-data-model.md#L232)) | CWI create does read→compute `max+1`→write **without** `withStateLock`; Plan versions ([:380](../app/server.js#L380)) and Decisions ([:715](../app/server.js#L715)) do take it. Two concurrent creates both returned `201` with `CWI-1`. |
| DEF-CWI-1b | **D** | [app/server.js:93](../app/server.js#L93) | — | The write temp path is per **process** (`<state>.${pid}.tmp`), so two in-process writers collide and `rename` fails → `500` (measured: `201,201,500,500,500`). |
| A-D5 | **A** | [-final-contract-id-concurrency.md:143](../docs/mission1/-final-contract-id-concurrency.md#L143) | "Create two CWIs both referencing `PLAN-1-1-v1`" → "Both CWIs created successfully; neither mutates the other or the Version" | No body, no status, no comparison defined; `type` is now mandatory, and the precondition "State after D3" is itself `NOT RUN`. Not runnable as written. |
| A-D9 | **A** | [L147](../docs/mission1/-final-contract-id-concurrency.md#L147) | "but somehow reference nonexistent version" → "appropriate 400" | No 400 path exists for that intent; `version` is only used for the duplicate check and is otherwise ignored ([:431](../app/server.js#L431), [:448](../app/server.js#L448), [:464-466](../app/server.js#L464)). Measured: `v9` → `201` `v3`. |
| M-D1/D2 | **M — resolved 2026-10-21** | [L139](../docs/mission1/-final-contract-id-concurrency.md#L139), [L140](../docs/mission1/-final-contract-id-concurrency.md#L140) vs [L30-L34](../docs/mission1/-final-contract-id-concurrency.md#L30) | **Contract clarification, not a runtime defect.** Owner decision: `plan_id` = Plan identity, `id` = immutable snapshot id; D1/D2 rows now expect `PLAN-1-1-v1` / `PLAN-1-2-v1`. | The server always returned the snapshot id; only the matrix's `id` column was wrong. Verified by [d1-d2 probe](./d1-d2-id-semantics-2026-10-21.log) and its [re-run](./d1-d2-id-semantics-rerun-2026-10-21.log), exit `0` both times, 25/25 checks each on temp state; runtime/schema/state unchanged. |
| M-D3.2 | **M** | [L125](../docs/mission1/-final-contract-id-concurrency.md#L125), [L127](../docs/mission1/-final-contract-id-concurrency.md#L127) | "`withStateLock` … serializes **all** state read-modify-write cycles" | True for plan versions and decisions; **not** true for CWI create (DEF-CWI-1a). The sentence's scope must be narrowed or the handler fixed. |
| A-RES-1 | **A** | [D-data-model.md:248-260](../docs/mission1/D-data-model.md#L248), row at [:257](../docs/mission1/D-data-model.md#L257) | `claims` reserved, shape undecided | `Script.claim_map` uses `kind: fact\|opinion`; `Evidence` uses `claim_class: FACT/INFERENCE/HYPOTHESIS/UNKNOWN`. Two vocabularies for one idea — a decision, not a code change. |
| A-RES-2 | **A** | [D-data-model.md:258-259](../docs/mission1/D-data-model.md#L258) | `source_ids` + `evidence_ids` both reserved | Undefined distinction; an EV id already references a source, so the two lists will drift without a rule. |
| A-RES-3 | **A** | [D-data-model.md:260](../docs/mission1/D-data-model.md#L260) | `updated_at` reserved | Conflicts with the append-only discipline in Doc D §5: no update path exists, so the field can only mislead. |
| A-RES-4 | **A** | [D-data-model.md:228](../docs/mission1/D-data-model.md#L228) | `status` vs `decision` | The stored key is `decision`; the doc's table maps `status`→`decision`. One concept, one name the team must fix (OQ-A). |
| M-SELF | **M** | this review, §1.5 | An earlier draft claimed D8/D10 mismatched | **Wrong.** Measured: both match ([d-case-expectation-probe-2026-10-21.log](./d-case-expectation-probe-2026-10-21.log)). Corrected in §1.5. |

**Verified matches (not findings):** D3 `id: PLAN-1-1-v2`, D8 `400 plan_id not found: PLAN-999`,
D10 `409 plan_id/plan_version already exists: PLAN-1-1/v1` — all reproduced on a temp
copy.

### 0.1 D8 and D10 in detail — requirement, prior error, evidence, status

#### D8 — "Nonexistent Plan ID rejected"

| Item | Detail |
| --- | --- |
| Requirement | [-final-contract-id-concurrency.md:146](../docs/mission1/-final-contract-id-concurrency.md#L146): precondition *no state with `PLAN-1-1`*; step *POST `new_version` with `plan_id: "PLAN-999"`*; expected *`400 "plan_id not found: PLAN-999"`* |
| Code | [app/server.js:441-443](../app/server.js#L441) — guard `!Object.values(state.planVersions).some(v => v.plan_id === planId)` → [:442](../app/server.js#L442) `sendJson(res, 400, { error: \`plan_id not found: ${planId}\` })` |
| Evidence | [d8-d10-requirement-check-2026-10-21.log:5-9](./d8-d10-requirement-check-2026-10-21.log#L5): precondition `[]`, status `400`, body `{"error":"plan_id not found: PLAN-999"}`, verdict `VERIFIED` |
| Status | **Verified** (matrix expectation == measured behaviour) |
| Case status | still `NOT RUN` in the matrix — this is a read-only spot-check, not an accepted acceptance record |

#### D10 — "Duplicate (plan_id, version) pair rejected"

| Item | Detail |
| --- | --- |
| Requirement | [L148](../docs/mission1/-final-contract-id-concurrency.md#L148): precondition *state after D3 (v1 and v2)*; step *POST `new_version` with `plan_id: "PLAN-1-1"`, `version: "v1"`*; expected *`409 "plan_id/plan_version already exists: PLAN-1-1/v1"`; existing v1 unchanged* |
| Code | [:431](../app/server.js#L431) reads `body.version`; [:447-449](../app/server.js#L447) duplicate guard → [:448](../app/server.js#L448) `sendJson(res, 409, …)` |
| Evidence A (duplicate path) | [d8-d10-requirement-check-2026-10-21.log:10-18](./d8-d10-requirement-check-2026-10-21.log#L10): status `409`, exact message, state ids still `["PLAN-1-1-v1","PLAN-1-1-v2"]`, `duplicate record created: false` |
| Evidence B (immutability clause) | [d10-v1-immutability-2026-10-21.log](./d10-v1-immutability-2026-10-21.log) — dedicated run, exit `0`: v1 snapshotted from **both** the GET route and the state file, `new_version` created, v1 read back, **6 fields compared with 0 differences** at both levels, v1 entry md5 `dabb3d16…` identical before/after, v2 present as a separate entry, Plan still has exactly two versions, real state unchanged, HEAD unchanged |
| Evidence B detail | The comparison prints every field (`content`, `createdAt`, `id`, `plan_id`, `schemaVersion`, `version`) with `same`/`DIFF`, so "unchanged" is observed rather than asserted: `PASS step 5a … 6 fields compared, 0 differences` and `PASS step 6a … sorted v1 entry byte-identical in state` |
| Status | **Verified (scoped)** — the "existing v1 unchanged" clause is proven by a field-level run, not inferred (it was **Pending Evidence** before this run). Scoped by the owner on 2026-10-21 to exactly these two clauses, on temporary state, for a sequential create. |
| Case status | **`Verified`** in the acceptance matrix since 2026-10-21 ([-final-contract-id-concurrency.md §4.1](../docs/mission1/-final-contract-id-concurrency.md#L150)). The rest of the D-series: D1/D2 **`Verified (scoped)`** as a contract clarification ([-§4.2](../docs/mission1/-final-contract-id-concurrency.md#L177)), D3/D8 `Verified`, D9 `Not Applicable as written`, D5 `NOT RUN`. |
| Reproduce | `node verification/d10-v1-immutability.js` → exit `0`; temporary workspace only, real `data/app/state.json` md5 unchanged |

#### What the earlier wrong conclusion was, and why it was wrong

An earlier draft of §1.5 stated:

1. "D8 … the endpoint answers `404 "plan_id/plan_version not found: <plan>/<version>"`" —
   **wrong**. That `404` belongs to the **CWI** endpoint
   ([app/server.js:559](../app/server.js#L559)); the plan-version `new_version` path
   returns `400` at [:442](../app/server.js#L442).
2. "D10 … no 409 path is exercised … the `new_version` contract takes no `version`
   field" — **wrong**. `version` is read at [:431](../app/server.js#L431) and the
   duplicate `409` is emitted at [:448](../app/server.js#L448).

Root cause: I generalised from a different endpoint's error string instead of
reading the `new_version` branch. The fix was to measure both cases
([log](./d8-d10-requirement-check-2026-10-21.log)) rather than re-read the same
partial view.

What did **not** change: the D1/D2 `id` mismatch and the D9 gap are measured
independently ([d-case log:6-10](./d-case-expectation-probe-2026-10-21.log#L6)) and
remain valid.

#### Status labels for the whole D-series review

| Case | Requirement vs behaviour | Label |
| --- | --- | --- |
| D8 | `400 plan_id not found` matches | **Verified** |
| D10 | `409` + `v1 unchanged` (field-level run, exit 0) — **Verified (scoped)**, matrix row updated 2026-10-21 | **Verified (scoped)** |
| D3 | `id: PLAN-1-1-v2` matches | **Verified** |
| D1, D2 | matrix `id` column said Plan id; §1.2 and runtime use snapshot id — owner clarified: `plan_id` = Plan identity, `id` = snapshot id | **Resolved — contract clarification, not a runtime defect** (verified 2026-10-21) |
| D9 | describes a rejection path that does not exist (`v9` → `201 v3`) | **Not Applicable as written** (+ ambiguity) |
| D5 | no payload/status/assertion; precondition unrun | **Not Verified** |
| DEF-CWI-1 | identity guarantee vs measured duplicate id + lost update | **Contradiction** |

---

## 1. D5 as written

> **D5 · Multiple CWIs can reference the same Version** — Preconditions: *State
> after D3*; Steps: *Create two CWIs both referencing `PLAN-1-1-v1`*; Expected:
> *Both CWIs created successfully; neither mutates the other or the Version*;
> Status: `NOT RUN`.

### 1.1 What D5 is actually testing

Three distinct properties are bundled into one row:

1. **Non-exclusive reference** — a Plan version may be referenced by more than one
   CWI (it is not consumed or locked by the first one).
2. **Record independence** — the two CWI records are separate entities; creating
   the second does not alter the first.
3. **Snapshot immutability under reference** — creating CWIs does not mutate the
   referenced Plan version.

Each property needs its own assertion; "both created successfully" only covers the
happy path of (1).

### 1.2 Blockers before D5 can be run as written

| # | Blocker | Why it stops a reproducible run |
| --- | --- | --- |
| B1 | **No request bodies are specified.** | The enforced contract makes `type` required, and `product_id` required for `PRODUCT`/`REVIEW`. A body of `{plan_id, plan_version}` now returns `400 type is required`. D5 cannot be run without a payload that satisfies the contract. |
| B2 | **No expected status codes or response fields.** | "Created successfully" is not checkable. The current endpoint returns `201` plus the stored record. |
| B3 | **"Neither mutates the other" is not operationalised.** | Nothing states what to compare. The check requires a before/after comparison of each stored record, not a visual reading. |
| B4 | **"Nor the Version" is not operationalised.** | The Plan version must be captured before the first CWI and compared after the second (deep equality of `planVersions["PLAN-1-1-v1"]`, or an md5 of its serialised form). |
| B5 | **Precondition "State after D3" is itself `NOT RUN`.** | D3 (create `PLAN-1-1-v2`) has never been executed as an acceptance case. D5 depends on a state that no executed case has produced. |
| B6 | **The `cwi_id` policy changed after D5 was written.** | Owner policy (2026-10-21) rejects any client-supplied `cwi_id` with `400`. If the case was ever intended to send ids, it would now fail by design. D5 must send no `cwi_id` and must assert that the server assigned `CWI-<n>` values. |

B6 is the only blocker created by a recent decision; B1–B5 predate it.

### 1.3 Implementation support, and a defect found while checking it

Read-only inspection of the handler:

- it keys records by a server-generated `CWI-<n>` (`state.cwis[newCwiId] = record`);
- it reads the referenced Plan version only to check existence — it never writes
  `planVersions`.

But it does **not** take the state lock: the handler calls `readState()` → computes
`max(CWI-<n>) + 1` → `writeState()` directly, while the Plan-version handler
(`app/server.js:380`) and the Decision handler (`app/server.js:715`) both wrap the
same read-modify-write in `withStateLock`.

Measured on an isolated copy (see
[cwi-create-concurrency-probe-2026-10-21.log](./cwi-create-concurrency-probe-2026-10-21.log)):

```text
plan: 201 PLAN-1-1-v1
two concurrent creates: 201 201 | ids: CWI-1 CWI-1
cwis stored: 1 -> [ 'CWI-1' ]
five concurrent: 201,201,500,500,500 | ids: CWI-2,CWI-2,,,
cwis stored after five: 2
```

Two concurrent creates both returned `201` with the **same** id `CWI-1`, and only
one record survived. That is a lost update, and it contradicts the identity rule in
Doc D §3.13 as first written. The `500`s have a second cause: `writeState` uses
`${STATE_FILE}.${process.pid}.tmp`, a **per-process** temp name, so two in-process
writers collide on the same temp path and the `rename` fails.

**Status: open defect, not fixed here.** This review was read-only by instruction.
It matters for D5 because D5 creates two CWIs; if they are issued concurrently the
case fails today, and if they are issued sequentially the case passes but proves
nothing about concurrency.

### 1.4 Proposed D5 execution spec (a proposal, still `NOT RUN`)

To make D5 reproducible without changing any contract:

| Step | Request | Expected |
| --- | --- | --- |
| 0 | Capture `planVersions["PLAN-1-1-v1"]` and the state checksum on a temporary state | baseline recorded |
| 1 | `POST /api/content-work-item` `{plan_id:"PLAN-1-1", plan_version:"v1", type:"PRODUCT", product_id:"P-1001"}` | `201`, `id` matches `^CWI-[0-9]+$` |
| 2 | Capture the full record returned in step 1 | baseline for the first CWI |
| 3 | `POST /api/content-work-item` `{plan_id:"PLAN-1-1", plan_version:"v1", type:"REVIEW", product_id:"P-2002"}` | `201`, **different** `id` |
| 4 | `GET /api/content-work-item/<id1>` | `200`, record **deep-equal** to the step-2 baseline |
| 5 | `GET /api/content-work-item/<id2>` | `200`, `plan_version` is `v1` |
| 6 | Re-read `planVersions["PLAN-1-1-v1"]` | **deep-equal** to the step-0 baseline |
| 7 | Read state | exactly two new entries under `cwis`; both reference `PLAN-1-1`/`v1`; no `planVersions` entry added or removed |
| 8 | Negative control: send `cwi_id` | `400` with the policy message, and **no** third record written| Constraint for whoever runs it: temporary state only, real
`data/app/state.json` checksummed before and after, Git HEAD compared, no commit.

**Sequential only.** The spec above creates the two CWIs one after the other. A
concurrent variant must wait for the lock defect in §1.3 to be fixed; running it now
would produce a duplicate id and a lost update, and would be a defect report, not a
D5 result.

### 1.5 Adjacent D-cases, measured (correction to an earlier draft of this review)

An earlier draft of this section claimed D8 and D10 did not match the implementation.
**That was wrong** — I inferred it from the CWI endpoint's `404` instead of measuring
the plan-version endpoint. The measured values are below
([d-case-expectation-probe-2026-10-21.log](./d-case-expectation-probe-2026-10-21.log)),
and they change the classification: D8 and D10 **match**.

| Case | Matrix line | Expected by matrix | Measured | Verdict |
| --- | --- | --- | --- | --- |
| D8 | [L146](../docs/mission1/-final-contract-id-concurrency.md#L146) | `400 "plan_id not found: PLAN-999"` | `400 {"error":"plan_id not found: PLAN-999"}` (server.js:442) | **match** |
| D10 | [L148](../docs/mission1/-final-contract-id-concurrency.md#L148) | `409 "plan_id/plan_version already exists: PLAN-1-1/v1"` | `409 {"error":"plan_id/plan_version already exists: PLAN-1-1/v1"}` (server.js:448) | **match** |
| D3 | [L141](../docs/mission1/-final-contract-id-concurrency.md#L141) | `id: PLAN-1-1-v2` | `201 {"id":"PLAN-1-1-v2",…}` | **match** |
| D1 | [L139](../docs/mission1/-final-contract-id-concurrency.md#L139) | `id: "PLAN-1-1"`, `plan_id: "PLAN-1-1"` | `201 {"id":"PLAN-1-1-v1","plan_id":"PLAN-1-1",…}` | **resolved** — owner clarified the semantics; the row now expects the snapshot id |
| D2 | [L140](../docs/mission1/-final-contract-id-concurrency.md#L140) | `id: "PLAN-1-2"` | `201 {"id":"PLAN-1-2-v1",…}` | **resolved** — same clarification as D1 |
| D9 | [L147](../docs/mission1/-final-contract-id-concurrency.md#L147) | "somehow reference nonexistent version" → 400 | `version:"v9"` → `201 {"id":"PLAN-1-1-v3"…}` | **ambiguous + undocumented behaviour** (below) |

**D9's real issue is not the error text — it is that there is no such error path.**
`new_version` reads `body.version` (server.js:431) but uses it only for the duplicate
check (server.js:448); otherwise the version is assigned by the server
(server.js:464-466). A client asking for `v9` therefore receives `v3` with `201`.
That is consistent with "the server assigns versions", but the matrix row describes a
rejection that does not exist, and no document states that a client-supplied
`version` is ignored rather than honoured.

Recommendation: fix D1/D2's `id` expectation and rewrite D9 (either delete it as
unreachable, or replace it with the real behaviour: `version` is advisory and only
triggers the duplicate `409`). Owner action; not changed here.

---

## 2. Reserved-field policy

`D-data-model.md` §3.13 lists six intended fields that are **not** in the contract.
Because the schema uses `additionalProperties: false`, each one is currently a
`400` if sent. For each field: what it is for, what must be decided before it can be
added, and a recommendation.

| Field | Intended purpose | Conflict / prerequisite | Recommendation |
| --- | --- | --- | --- |
| `title` | Human label for the work item | Needs: required or optional, max length, uniqueness (none proposed), and whether duplicates across kinds are allowed. Low risk, no dependency on an open question. | **Accept first.** Cheapest field to add, and it is the one an operator needs to tell two CWIs apart in a list. |
| `description` | Free-text intent for the work item | Same shape questions as `title`; must not become a second home for claims (claims belong in `claims`). | **Accept with `title`**, with an explicit rule that factual claims may not live only in `description`. |
| `claims` | The claims the work item will make | **Vocabulary conflict:** `Script.claim_map` (§3.4) tags each entry `kind: fact|opinion`, while `Evidence` (§3.1) uses `claim_class: FACT/INFERENCE/HYPOTHESIS/UNKNOWN`. Two vocabularies for the same idea. Also needs the rule that a load-bearing claim requires FACT/INFERENCE evidence. | **Do not add until the vocabulary is unified.** Reusing `claim_class` + `evidence_id` is the consistent option; introducing a third vocabulary would be the worst outcome. |
| `source_ids` | Upstream sources behind the item | Overlaps `evidence_ids`: `Evidence` already carries `url_or_reference` and `related_program`, and an EV id *is* the reference to a source. Without a definition, two id lists will drift. | **Merge or drop.** Prefer a single `evidence_ids` (EV refs). Only keep `source_ids` if it is defined as something genuinely different (e.g. non-Evidence artefacts such as a Plan version or brief). |
| `evidence_ids` | Traceability to Evidence records | Needs the linkage rules: may a CWI cite HYPOTHESIS/UNKNOWN evidence (yes, as a risk, but not load-bearing)? Must ids resolve to `evidence-log.md`, and is an unresolvable id a `400` or a recorded `UNKNOWN`? | **Accept after `claims` is settled**, since both point at the same records and should share one validation rule. |
| `updated_at` | Last modification timestamp | **Semantic conflict with append-only discipline.** Nothing in the runtime updates a CWI; every other record in Doc D is append-only and corrections are new entries. An `updated_at` with no update path is a field that can only lie, and adding one quietly introduces in-place mutation. | **Drop, or replace with revision semantics** (new id + `version_of`/`supersedes`, mirroring Script). Do not add a bare `updated_at`. |
| `status` (naming) | Lifecycle value | Already stored as `decision` with default `PENDING`; the closed vocabulary is OQ-A, still open. Adding a *second* name for the same concept will split the contract. | **Keep the name `decision`** in the contract unless the record itself is renamed. Decide the vocabulary (OQ-A) before constraining it. |

### 2.1 Recommended decision order

1. **OQ-A** — fix the `decision` vocabulary (unblocks constraining `status`).
2. **Claim vocabulary** — unify `claim_map.kind` and `claim_class` (unblocks `claims`).
3. **Evidence linkage** — decide required-vs-optional and unresolvable-id behaviour
   (unblocks `evidence_ids`, and settles `source_ids` vs `evidence_ids`).
4. **`title` + `description`** — no dependency; can ship first if the team wants a
   quick win.
5. **`updated_at`** — either drop it or write the revision policy that gives it
   meaning.

### 2.2 What must accompany any schema change

Adding a field is not a doc edit; the repo's own discipline requires all of:

- the field added to `content-work-item.schema.json` (the source of truth);
- §3.13's table updated, with the field moved out of the reserved list;
- behavioural cases in `validate-content-work-item.js` (valid, wrong type, and — for
  conditional fields — the wrong-`type` case);
- enforcement cases in `cwi-contract-enforcement.js` (accept, reject, and **no record
  written on reject**);
- a re-run of the consolidated runner on temporary state, with the real state
  checksum and Git HEAD unchanged.

Fields added only to the document would be rejected by the running server
(`additionalProperties: false`) — that is the failure mode this review is meant to
prevent.

---

## 3. Defect record (found during this review)

| Field | Value |
| --- | --- |
| ID | `DEF-CWI-1` |
| Endpoint | `POST /api/content-work-item` |
| Symptom | Two concurrent creates both return `201` with the same `CWI-<n>`; one record is lost. Five concurrent creates also produce `500`s. |
| Root cause 1 | The handler's read-modify-write is outside `withStateLock`, unlike the Plan-version and Decision handlers. Two requests compute the same next id from the same state. |
| Root cause 2 | `writeState()` uses a per-process temp path (`<state>.${pid}.tmp`), so concurrent writers in one process collide and the `rename` fails → `500`. |
| Impact | The "server-generated, immutable, unique id" guarantee holds for sequential creates only. Id uniqueness is not established under concurrency, and a rejected/partial write can surface as `500` rather than a contract error. |
| Not affected | Contract validation, `product_id` rules, `cwi_id` rejection, sequential create/GET, Plan-version concurrency (that path is locked and has 5-way evidence). |
| Evidence | [cwi-create-concurrency-probe-2026-10-21.log](./cwi-create-concurrency-probe-2026-10-21.log) — reproduced twice |
| Status | **Open. Not fixed** (this review was read-only) |
| Suggested fix (not applied) | Wrap the CWI handler body in `withStateLock`, and make `writeState`'s temp name unique per write (e.g. add a counter or `randomUUID()`), then re-run the probe plus a CWI concurrency case. |

## 4. Status of this review

| Item | Status |
| --- | --- |
| D5 | **Still `NOT RUN`** — this review only specified what a runnable D5 requires |
| D1, D2 | **`Verified (scoped)`** — contract clarification accepted 2026-10-21: `plan_id` = Plan identity, `id` = immutable snapshot id; the runtime never changed. Evidence: [d1-d2 probe](./d1-d2-id-semantics-2026-10-21.log) + [re-run](./d1-d2-id-semantics-rerun-2026-10-21.log), exit `0`, 25/25 checks each, temp state. |
| D10 | **`Verified (scoped)`** — accepted 2026-10-21; the matrix row in [-final-contract-id-concurrency.md §4](../docs/mission1/-final-contract-id-concurrency.md#L148) now says so and cites §4.1. Scope: the `409` message and "existing v1 unchanged", sequential create, temporary state. Concurrency, `DEF-CWI-1`, and every other D-case are outside it. |
| `DEF-CWI-1` | **Reported, unfixed** — untouched by the D10 evidence run (different endpoint) |
| Reserved CWI fields | **Unchanged** — none added to the schema or the runtime |
| Runtime, schema, `data/app/state.json` | **Unmodified** — no code, schema, or state edit in this round |
| Contract document | **Status-only edit** — D10 row status + new §4.1 evidence record; no requirement text changed, no other row marked |
| Evidence produced | This document, plus [d10-v1-immutability-2026-10-21.log](./d10-v1-immutability-2026-10-21.log) and its script |
| Commit | **None** |
