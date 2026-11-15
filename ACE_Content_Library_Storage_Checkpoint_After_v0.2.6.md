# ACE Content Library & Storage Architecture — Checkpoint Documentation
## Record Current State After v0.2.6 Review

**Checkpoint date:** 2026-11-02
**Document status at checkpoint:** v0.2.6 — RECONCILIATION PROPOSAL — NOT RATIFIED

---

### 1. Authorization and Scope

This checkpoint was requested to preserve the current position of the Content Library & Storage Architecture review before the work session ended.

This authorization is limited to creating checkpoint documentation only.

It does NOT authorize changes to:
- Application source code
- Repository content other than this checkpoint file
- Database or data files
- Runtime configuration or environment variables
- Storage locations, exports, or artifacts
- Operational state

No runtime tests were executed. No repository verification is claimed by this checkpoint.

---

### 2. Current State

**Latest reviewed document:** v0.2.6

**Reconciliation status:**
- Document-level reconciliation is **substantially complete**.
- Reconciliation is **NOT formally closed** — closure is pending the v0.2.7 revisions below.
- No Owner ratification has occurred.
- No Foundation Design authorization has been granted.
- No Implementation authorization has been granted.

**Document lineage:**
| Version | Role |
|---|---|
| v0.2 | Initial architecture proposal |
| v0.2.1 | Reconciliation (migration/replica/backup separation, evidence classes) |
| v0.2.2 | Five-point reconciliation (retirement safety, freshness, persistence, metadata safety, provenance) |
| v0.2.3 | Delta proposal (F-1 through F-6) |
| v0.2.4 | Delta proposal (S-1 through S-4, M-1 through M-4) |
| v0.2.5 | Delta proposal (C-1 through C-4, W-1 through W-3) |
| v0.2.6 | Delta proposal (X-1 through X-7 + cross-section consistency) |

**Change history during this review:**
- No repository, runtime, database, or operational data changes were made during any review round.
- Repository inspection, where performed, was read-only and is recorded as Code Finding (CF), not Owner-verified evidence.

---

### 3. Review Findings (D-1 through D-5)

#### D-1 — Integrity / Verification Validity derivation
**Status:** FOUNDATION DESIGN NOTE — open, not blocking
`verification_validity` and `integrity` are both derived, and `integrity` derivation consumes `validity` as an input. This double derivation is the reason §2.4 requires an "excluded combinations" list.
**Direction:** Reconsider raw evidence versus derived display states — store the raw verification result (`MATCH` / `MISMATCH` / `UNREADABLE` / `NONE`) plus `verified_at`, and let `integrity` and `validity` be separate display states.
**Constraint:** Do not simplify or reduce the 18-row matrix prematurely. Any simplification must be justified by an explicit derivation model.

#### D-2 — `transfer_id` binding
**Status:** WORDING FIX — required in v0.2.7
TB-09 requires verification evidence to reference the exact `transfer_id` it supports, but the schema allows `transfer_id` to be absent, and `basis = MIGRATION_VERIFY` is not explicitly barred from supporting a transfer.
**Required wording:** `MIGRATION_VERIFY` may support a `transfer_event` only when it references that exact `transfer_id`; otherwise the transfer must report `UNVERIFIED`.

#### D-3 — Root revision binding
**Status:** **BLOCKING** — must be resolved before Foundation Design
Verification evidence records `location_id` and `location_key`, but not the root identity/revision under which that key was interpreted. Because of this, `locator_state = USABLE` (defined as "qualifying verification under the current root") cannot be computed from recorded facts after a root change. RC-06 and §4.2 are therefore not implementable as written.
**Direction:** Consider `root_id` plus `root_revision` rather than relying only on a path string or a single `root_snapshot` value.
**Required additional behavior:** evidence produced under a previous root must remain preserved but must not establish usability under the current root.

#### D-4 — Active Location invariant
**Status:** WORDING FIX — required in v0.2.7
§8.5 states the MVP "may" identify one active location per File ID, while the rest of the document treats at-most-one active location as an invariant.
**Required wording:** change "may" to "must"; retained historical and replica locations remain permitted.

#### D-5 — Migration sequence
**Status:** WORDING FIX — required in v0.2.7
§10.1 currently presents Retire inside the migration arrow sequence while also describing it as a separate future operation.
**Required wording:** the MVP migration sequence ends at **Copy → Verify → Switch → Retain** (`COMPLETE_RETAINED`). Retire remains a separate future operation and stays outside the MVP path (CD-01, CD-12).

---

### 4. Proposed Next Revision — v0.2.7

**Scope:**
- Address D-2, D-3, D-4, and D-5.
- Preserve D-1 as an open Foundation Design Note.
- Re-run the relevant cross-section consistency checks after revision.
- Do not silently change unrelated requirements or decisions.

**Anticipated affected sections (indicative, not authorized changes):** §3.3 (TB-09 wording), §4.1/§4.2 (root binding, RC-06), §8.5 (invariant wording), §10.1 (migration sequence), and the Field Change List for the root-binding field.

**Closure condition:** reconciliation may be closed at document level once v0.2.7 addresses D-2 through D-5 and the cross-section checks are re-run, with D-1 carried forward as a Foundation Design Note.

---

### 5. Owner Gates

| ID | Decision | Status |
|---|---|---|
| OWN-01 | Data Custody: Library metadata location, custody responsibility, backup/recovery approach and disclosure acceptance | **OPEN** |
| OWN-03 | Authorization to enter Foundation Design Stage | **OPEN** |
| OWN-02 | Previously withdrawn (v0.2.2) | WITHDRAWN |

Neither OWN-01 nor OWN-03 has been approved or acknowledged. No Foundation Design or Implementation is authorized.

---

### 6. Amendment Acknowledgment Register — Carried Forward

All amendments recorded in v0.2.6 remain **PROPOSED**. None is `ACKNOWLEDGED`, because no acknowledgment evidence (person, date, channel) has been supplied.

Carried items: U-01 (`NOT_PROBED`), U-02 (removal of `verified_sha256` as current-state authority), U-03 (`trust_window_days` default 30, configurable), U-04 (`UNVERIFIED` freshness value), U-05 (`key` in locator identity/constraint), U-06 (`location_key` + operation basis + direct transfer binding), U-07 (CD-03 scope per `storage_location`), U-08 (separate `transfer_status` / `verification_state` + `locator_state`).

---

### 7. Open Technical Issues (non-Owner)

| ID | Issue | Status |
|---|---|---|
| R-01 | Verification Event retention policy | OPEN — Foundation Design |
| R-02 | Trust window per provider/location | OPEN — not MVP-blocking |
| R-03 | Re-encoding / replacing bytes within an existing Content Version | OPEN — requires behavioral testing |
| R-04 | `file_asset` supersession rules | OPEN — Foundation Design |
| R-05 | Legacy `content-library.json` import plan | OPEN |
| R-06 | Physical placement of `version_relationship` (one File ID ↔ multiple Versions) | OPEN — Foundation Design |
| R-07 | Provider-specific root and key mapping | OPEN — Foundation Design |
| R-08 | Transfer retry and partial-copy behavior | OPEN — Foundation Design |
| R-09 | Metric quarantine resolution workflow | OPEN — Foundation Design |
| R-10 | Same-location key relocation (must it use `migration_job`?) | OPEN |
| R-11 | Multiple active Content Versions and Version Relationship definition | OPEN |

**Evidence backlog:**
- RE-01 through RE-08 — NOT EXECUTED / Requires Evidence
- RT-01 through RT-05 — NOT EXECUTED (require authorization)

---

### 8. Preserved Boundaries

- Migration success ends at `COMPLETE_RETAINED`; it is not a backup.
- Verified Replica is not Backup; no backup/restore guarantee exists in MVP.
- Retire/delete execution remains closed in MVP; no delete UI or operation.
- Retention expiry is never deletion authority.
- Storage Location and Publication Destination remain separate entities.
- Metrics attach to Publication Events only, never to Transfer Events.
- No green status implies safety, recoverability, or backup.
- Derived display states must not be persisted as independent facts.

---

### 9. Work Boundaries Honored by This Checkpoint

This checkpoint records state only.

- It does not ratify v0.2.6 or v0.2.7.
- It does not modify repository files other than this checkpoint file.
- It does not modify runtime, database, or operational data.
- It does not fabricate test results or evidence.
- It preserves unresolved issues and decision ownership.

**Evidence proves what happened; evidence does not become Requirement.**
