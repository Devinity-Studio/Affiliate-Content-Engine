# ACE Mission 1 — Save & Recovery Foundation: Final ID and Concurrency Consistency Check
## Planning-Document-Only Correction

**Status**: Planning-document-only. No runtime files modified, no implementation begun, no commits created.
**Scope**: Bounded Save & Recovery Foundation — Plan Version persistence, Content Work Item persistence, isolated Save & Recovery tests.
**Budget**: THB 0.
**Boundaries**: No UI changes, Experiment lifecycle, S2–S10, G2–G5, G-pay, content production, publication, spending, or external integrations.

This document represents the final corrected planning documents. It clearly separates specification decisions from verified runtime facts and unexecuted tests. Test statuses stay NOT RUN except D10 (§4.1) and D1/D2 (§4.2), which have execution evidence.

---

## 1. ID Formats: Multiple Plans Within One Cycle

### 1.1 Plan ID (`plan_id`)
**Format**: `PLAN-<cycle>-<plan_number>`

- Uniquely identifies a Plan within a cycle
- `plan_number` distinguishes multiple Plans in the same cycle
- **Server-generated**: client omits `plan_id`; server assigns deterministically

| Example | Meaning |
|---|---|
| `PLAN-1-1` | First Plan in cycle 1 |
| `PLAN-1-2` | Second Plan in cycle 1 |
| `PLAN-2-1` | First Plan in cycle 2 |

**Generation**: From cycle context. Cycle 1 → `PLAN-1`; the `plan_number` is assigned incrementally based on existing Plans under the same cycle. Within cycle 1, if `PLAN-1-1` exists and a new Plan is created, the new Plan receives `PLAN-1-2`.

### 1.2 Snapshot/Version ID (`id`)
**Format**: `PLAN-<cycle>-<plan_number>-v<version_number>`

- Uniquely identifies an immutable snapshot/Version under a specific Plan
- Includes both `plan_number` and `version_number`, making it separate from and unambiguous relative to the Plan ID
- **Immutable**: once created, never changes; new Versions get new IDs

| Example | Meaning |
|---|---|
| `PLAN-1-1-v1` | First Version of Plan 1 in cycle 1 |
| `PLAN-1-1-v2` | Second Version of Plan 1 in cycle 1 |
| `PLAN-1-2-v1` | First Version of Plan 2 in cycle 1 |

**Separate from Plan ID**: The Snapshot ID format (`PLAN-<cycle>-<plan_number>-v<version>`) is distinct from the Plan ID format (`PLAN-<cycle>-<plan_number>`). The Snapshot ID carries the version suffix (`-v<n>`) that the Plan ID lacks, ensuring immutability and uniqueness.

### 1.3 Deterministic Version Assignment (server-side, within `withStateLock`)

**Algorithm**:

1. **Identify** the Plan via `plan_number` from the request → e.g., `plan_number: "1"` → Plan ID `PLAN-1-1`
2. **Read** existing Version records for the given Plan ID from `state.json`
3. **Determine** next `version_number`:
   - If no versions exist → `version_number: 1`
   - If versions exist → find max numeric suffix; increment (e.g., from `v2` → `v3`)
4. **Assign** new `id: "PLAN-1-1-v<n>"` where `<n>` is the next version number
5. **Save**; **409 Conflict** if the exact `(plan_id, version_number)` pair already exists

**Collision Safety**:
- **409 Conflict** with message `"plan_id/plan_version already exists: PLAN-1-1/v1"` if the exact `(plan_id, version_number)` pair already exists
- **No data overwrite**: Existing snapshot remains unchanged; new snapshot gets new `id`
- **Wrong-plan prevention**: `plan_id` validated against cycle context; client cannot assign a `plan_id` that conflicts with the current cycle's Plan

### 1.4 Rejection Rules

| Situation | Response |
|---|---|
| Missing `content` | 400 `"content is required"` |
| Unsupported `operation` value | 400 `"unsupported operation: <value>"` |
| `plan_id` references a Plan from a different cycle context | 400 `"plan_id mismatch: PLAN-1-2 does not belong to cycle 1"` |
| Duplicate `(plan_id, version_number)` pair | 409 `"plan_id/plan_version already exists: PLAN-1-1/v1"` |

---

## 2. Cycle Context Semantics

### 2.1 `create` Operation
- Uses the **current Cycle** to assign the new Plan's ownership/context
- Request: `operation: "create"`, no `plan_id` or `version` in request body
- Server generates `plan_id` from cycle context (e.g., cycle 1 → `PLAN-1-1` for first Plan)
- Creates initial Version `v1` under the new Plan

### 2.2 `new_version` Operation
- **Must reference an existing Plan by its exact `plan_id`, independent of whether the current Cycle has changed**
- Request: `operation: "new_version"`, `plan_id: "PLAN-1-1"` (exact match required), `content: "..."`
- Server validates that the `plan_id` corresponds to an existing Plan
- **Does NOT** require the current Cycle to match the Plan's cycle
- Creates a new Version incrementing from the last saved version under that Plan

### 2.3 Preserving Plan Identity and Ownership
- Creating a Version must preserve the original Plan identity and ownership/context
- The `plan_id` of the existing Plan is never mutated when creating a new Version
- The original Plan's snapshots remain unchanged; new snapshots get new IDs

### 2.4 Explicit Plan ID Rejection
- **Nonexistent Plan ID**: return 400 `"plan_id not found: PLAN-1-1"`
- **Valid existing Plan rejected merely because current Cycle differs**: must NOT happen; the `plan_id` is validated for existence, not cycle consistency
- **Do not invent additional permission or ownership machinery outside the authorized scope**

---

## 3. Concurrent Version Creation

### 3.1 Isolated Acceptance Test: Concurrent New Version

**Test Purpose**: Verify that concurrent `new_version` requests for the same Plan produce unique snapshot IDs, monotonically assigned version values, preserve all previously saved snapshots, and have no lost updates.

**Test Setup**:
- Isolated temporary state file (does not modify the real `data/app/state.json`)
- Real server stop/start cycle (the test starts a server instance, performs concurrent requests, then stops it)
- Pre-seeded state with one existing Plan Version (e.g., `PLAN-1-1-v1`)

**Test Steps**:
1. Start server with isolated state containing `PLAN-1-1-v1` as the only Version under plan `PLAN-1-1`
2. Issue 5 concurrent `POST /api/plan-version` requests with `operation: "new_version"` and `plan_id: "PLAN-1-1"`
3. Server processes all requests under the persistence lock
4. Stop server

**Verified Conditions** (all must pass):
- [ ] **Unique snapshot IDs**: All 5 new snapshots have distinct `id` values (e.g., `PLAN-1-1-v2`, `PLAN-1-1-v3`, `PLAN-1-1-v4`, `PLAN-1-1-v5`, `PLAN-1-1-v6`)
- [ ] **Monotonically assigned Version values**: Version numbers are strictly incrementing (2, 3, 4, 5, 6, 7) with no gaps or duplicates
- [ ] **Preservation of all previously saved snapshots**: `PLAN-1-1-v1` from the pre-seeded state still exists and is unchanged
- [ ] **Absence of lost updates**: Total count of Versions under `PLAN-1-1` = 6 (1 pre-seeded + 5 concurrent), matching the expected count
- [ ] **No interleaved data corruption**: All 5 new snapshots have correct `content` fields matching their respective request bodies

### 3.2 Serialization Contract Explanation
The contract explains that **serialization applies only if every relevant read-modify-write operation uses the same lock**. If separate processes or threads perform reads and writes without coordinating through the shared `withStateLock`, lost updates can occur. The `withStateLock` in the server serializes all state read-modify-write cycles on `state.json` using a promise queue, ensuring that rapid consecutive decisions cannot both read the same history length and reuse a decision ID.

**Formal statement**: "Concurrent Version Creation safety is guaranteed solely by the `withStateLock` serializing all read-modify-write cycles on `state.json`. Without explicit coordination through this lock, concurrent requests may interleave unpredictably."

### 3.3 Test Status
- **All tests marked `NOT RUN`** until actual execution evidence exists
- Tests must use isolated temporary state and must not modify the real application state

---

## 4. Acceptance-Test Matrix

| ID | Test Description | Preconditions | Steps | Expected Pass Conditions | Status |
|---|---|---|---|---|---|
| D1 | Create new Plan (cycle 1, first Plan) | Isolated state, no existing Plans | POST `create` with `content: "Plan A"`, `schemaVersion: 1` | Returns `id: "PLAN-1-1-v1"` (immutable snapshot id), `plan_id: "PLAN-1-1"` (Plan identity), `version: "v1"`, `createdAt` timestamp | **Verified (scoped)** — see §4.2 |
| D2 | Create new Plan (cycle 1, second Plan) | State after D1 | POST `create` with `content: "Plan B"` | Returns `id: "PLAN-1-2-v1"` (immutable snapshot id), `plan_id: "PLAN-1-2"` (Plan identity), `version: "v1"`, `createdAt` timestamp | **Verified (scoped)** — see §4.2 |
| D3 | Create new Version under existing Plan | State after D1/D2 | POST `new_version` with `plan_id: "PLAN-1-1"`, `content: "Version A2"` | Returns `id: "PLAN-1-1-v2"`, `plan_id: "PLAN-1-1"`, `version: "v2"`, `createdAt` timestamp | NOT RUN |
| D4 | v1 remains valid after v2 exists | State after D3 | GET `/api/plan-version/PLAN-1-1-v1` | Succeeds; returns the original v1 snapshot unchanged | NOT RUN |
| D5 | Multiple CWIs can reference the same Version | State after D3 | Create two CWIs both referencing `PLAN-1-1-v1` | Both CWIs created successfully; neither mutates the other or the Version | NOT RUN |
| D6 | Actual immutable snapshot IDs resolve through GET routes | State after D3 | GET `/api/plan-version/PLAN-1-1-v1` and GET `/api/plan-version/PLAN-1-1-v2` | Both routes succeed; returns respective snapshots; IDs are immutable | NOT RUN |
| D7 | Concurrent Version Creation — unique IDs and no lost updates | Isolated state with pre-existing Plan | 5 concurrent `new_version` requests for same Plan | 5 unique snapshot IDs; Version numbers 2-6; pre-existing Version preserved; total count = 6 | NOT RUN |
| D8 | Nonexistent Plan ID rejected | No state with `PLAN-1-1` | POST `new_version` with `plan_id: "PLAN-999"` | Returns 400 `"plan_id not found: PLAN-999"` | NOT RUN |
| D9 | Nonexistent Version under existing Plan rejected | State after D1/D2 (has v1 only) | POST `new_version` with `plan_id: "PLAN-1-1"`, but somehow reference nonexistent version | Returns appropriate 400 error (see D3 spec) | NOT RUN |
| D10 | Duplicate (plan_id, version) pair rejected | State after D3 (has v1 and v2) | POST `new_version` with `plan_id: "PLAN-1-1"`, `version: "v1"` | Returns 409 `"plan_id/plan_version already exists: PLAN-1-1/v1"`; existing v1 unchanged | **Verified (scoped)** — see §4.1 |

### 4.1 D10 evidence record — `Verified (scoped)`, accepted 2026-10-21

D10 has two clauses. Both are now backed by execution evidence, not by code reading
or inference. Only D10 (§4.1) and D1/D2 (§4.2) are marked; every other row in §4
remains `NOT RUN`.

| Clause | Evidence | What it shows |
|---|---|---|
| `409 "plan_id/plan_version already exists: PLAN-1-1/v1"` | [d8-d10-requirement-check-2026-10-21.log:10-18](../../verification/d8-d10-requirement-check-2026-10-21.log#L10) | Status `409`, exact message; state ids still `["PLAN-1-1-v1","PLAN-1-1-v2"]`; no duplicate record created |
| `existing v1 unchanged` | [d10-v1-immutability-2026-10-21.log](../../verification/d10-v1-immutability-2026-10-21.log) · script [d10-v1-immutability.js](../../verification/d10-v1-immutability.js) | Dedicated run, exit `0`, 12/12 checks: v1 snapshotted from **both** the GET route and the state file, `new_version` created, v1 re-read, **6 fields compared with 0 differences** at both levels; v1 entry md5 `dabb3d1691298a2ad61f1ed9b14636dd` identical before/after; v2 exists as a separate entry; the Plan still holds exactly two versions; real `data/app/state.json` md5 `5d29cdbdace0a73580bc2e0633f2e8cb` unchanged; Git HEAD unchanged |

**Run conditions:** temporary workspace only (`ace-d10-*` under the OS temp
directory); one retained log, exit `0`, 12/12 checks; no commit. The script is
re-runnable and reproduces the same assertions:
`node verification/d10-v1-immutability.js` → exit `0`.

**Status semantics:** `Verified (scoped)` applies to the two clauses above only. The
rest of §4 keeps `NOT RUN`.

**Scope of the claim — what this does *not* establish:**

- **Sequence only.** The run creates v1, then one `new_version`, then re-reads v1. It does not exercise concurrent mutation of v1, and it says nothing about interleaving with other writers.
- **Not `DEF-CWI-1`.** The Content Work Item create path (unlocked read-modify-write, per-process temp filename) is a separate endpoint and remains an open defect; nothing here clears it.
- **Not a generalisation.** The result covers this one `new_version` case. It does not upgrade D1/D2 (resolved separately as a contract clarification — §4.2), D9 (describes a rejection path that does not exist), or D5 (`NOT RUN`, and unreproducible as written).
- **Not Mission 1 acceptance.** No Mission 1 record, gate, or AC-01–AC-21 criterion is evidenced by this run.
- `Verified (scoped)` therefore means: exactly the two clauses above, on temporary state, for a sequential create.

### 4.2 D1/D2 ID semantics — contract clarification, `Verified (scoped)`

**Decision (owner, 2026-10-21):**

| Identifier | Meaning | Format |
|---|---|---|
| `plan_id` | **Plan identity** | `PLAN-<cycle>-<n>` |
| `id` | **Immutable snapshot/version id** | `PLAN-<cycle>-<n>-v<n>` |
| `version` | Version label | `v<n>` |

So the first Plan must return `id: "PLAN-1-1-v1"`, `plan_id: "PLAN-1-1"`, `version: "v1"`, and the second Plan `id: "PLAN-1-2-v1"`, `plan_id: "PLAN-1-2"`, `version: "v1"`.

**This was a documentation defect, not a runtime defect.** §1.2 already defined `id` as
the immutable snapshot id and the server has always returned it; the D1/D2 rows put the
**Plan** id in the `id` column. The rows are corrected here; `app/server.js`, the schema,
and `data/app/state.json` are untouched.

| Evidence | What it shows |
|---|---|
| [d-case-expectation-probe-2026-10-21.log:6-7](../../verification/d-case-expectation-probe-2026-10-21.log#L6) | Raw measured bodies: `D1 … {"id":"PLAN-1-1-v1","plan_id":"PLAN-1-1","version":"v1",…}` and `D2 … {"id":"PLAN-1-2-v1","plan_id":"PLAN-1-2","version":"v1",…}` |
| [d1-d2-id-semantics-2026-10-21.log](../../verification/d1-d2-id-semantics-2026-10-21.log) · [re-run log](../../verification/d1-d2-id-semantics-rerun-2026-10-21.log) · script [d1-d2-id-semantics.js](../../verification/d1-d2-id-semantics.js) | Two runs on separate temporary workspaces, exit `0` both times, **25/25 checks each**, identical after normalising the temp path and ISO timestamps: both creates `201` with the ids above, `id !== plan_id`, `id === plan_id + "-" + version`, both snapshot ids resolve through `GET`, state holds exactly `["PLAN-1-1-v1","PLAN-1-2-v1"]` keyed by their own `id`, and no Plan is stored under a bare `plan_id` |

**Scope:** cycle 1, two sequential `create` requests, temporary state only. It does not
exercise concurrency, does not cover D5 or D9, and does not establish Mission 1 records,
gates, or AC-01–AC-21.

---

## 5. Scope and Governance

### 5.1 Budget
- **THB 0**: No costs incurred. All work is planning-document-only.

### 5.2 In Scope
- Plan Version persistence (`plan_id`, snapshot/Version IDs, `create` and `new_version` operations)
- Content Work Item persistence (CWI references to Plan Versions; multiple CWIs may reference the same Version)
- Isolated Save & Recovery acceptance tests (D10 per §4.1 and D1/D2 per §4.2 verified and scoped; the rest still marked NOT RUN)
- ID format definitions and collision-safe version assignment
- Concurrency contract (serialization via `withStateLock`)

### 5.3 Out of Scope
- UI changes
- Experiment lifecycle (S2–S10)
- G2–G5, G-pay
- Content production/publication
- Spending or external integrations
- Any runtime implementation, commits, or real-state changes

### 5.4 Governance Statement
**No runtime implementation or commits were made during this planning-only task.** The corrected contract, ID formats, acceptance-test matrix, and governance boundaries are delivered as planning documents only. Implementation sequence triggers only upon explicit owner authorization beyond the bounded scope already recorded.

**Final Position**: All planning-document corrections are complete and locked. The specification, acceptance-test matrix, and scope specifications are delivered as above. Stop here: no runtime files modified, no implementation begun, no commits created. All corrections are planning-document-only per the task constraint.

---