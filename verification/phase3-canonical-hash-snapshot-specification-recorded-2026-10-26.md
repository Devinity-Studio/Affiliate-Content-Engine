# Phase 3 Specification — Canonical Hash & Snapshot (Recorded)

**Date:** 2026-10-26 · **Status:** RECORDED + AMENDED (Owner Decisions A & B, 2026-10-26 — Canonical Payload field list ratified, UNRESOLVED-1 closed at decision level, Evidence Annex β + Generation Binding + Subject-Chain added) · **Implementation: NOT authorized** — the first Vertical Slice requires separate Owner approval
**Authority:** Owner review chain over Phase 3 spec drafts, Phase 3 Reconciliation Addendum, Final Spec Reconciliation, Final Consistency Check, and Final Edge-Case Reconciliation (2026-10-25/26, Owner conversations)
**Operating principle (Owner):** "ระบบที่น่าเชื่อถือไม่ใช่ระบบที่ไม่มีวันล้มเหลว แต่เป็นระบบที่รู้ว่าอะไรล้มเหลว รักษาสิ่งที่ควรรักษา และไม่กล่าวอ้างเกินหลักฐานที่มี"

This document is the single canonical Phase 3 specification. It records design contracts only. All behavioral statements about the future are contracts for implementation; they are **not** claims that current code behaves this way. Where current code differs, the difference is documented in §5.3 and must be reconciled during the implementation phase — not silently.

---

## §1 Scope

- **In scope:** canonical payload representation and hashing for **Candidates** (`CND-*`, originals and variants); entity **revision** (`rev`) contract; **snapshot** records for candidate payloads; **recovery** preconditions.
- **Out of scope:** Content/Artifact payload spec (`CNT`/`ART` keep their own existing integrity: `script.checksum` @content.js:406–410, `artifact.sha256` @service.js:2797–2806); Auto Save; debounce UI; recovery UI; event sourcing; retention design; any candidate/content deletion.

## §2 Verified Implementation Anchors (read-only inspection, 2026-10-26)

| Fact | Position |
|---|---|
| Candidate full field set | `buildCandidate` @service.js:885–971 |
| Provenance fields (original) | `source` @960, `method: 'DETERMINISTIC_SCORING'` @961, `input_sha256` @962, `formula_version` @963, `data_quality` (nullable) @964, `limitations[]` @965–970 |
| Variant creation overwrites provenance | @1735: `method: 'VARIANT_OF_ORIGINAL'` + `variant_of`/`variant_index` appended |
| Generate rebuilds the candidate map | @1043–1062 (`state.candidates = candidates` @1055; queue filter @1057; status restore from last action @1059–1060; `status_history` **not** carried over) |
| Lifecycle mutation sites (post-creation) | `rank` @1018 (rerank), `status` @1060/@1530/@1533/@1537/@1544, `status_history.push` @1388 — **payload fields have no mutation sites** (immutable by construction today) |
| State persistence | `writeState` @195–199 (temp file + `rename` — single atomic boundary); `readState` @179–186 (kind validation + baseState spread); no cached state across requests (grep: 0 matches) |
| Concurrency | `withLock` promise-chain serializes every mutation path (25 sites); read-only paths are lock-free but observe either the old or the new complete state |
| Import hash computed from real bytes | @1398 (`createHash('sha256').update(csv)`) → stored as `import.sha256` **and** `import.file_hash` (identical values, two keys) @1429–1430 |
| Import is a single object | baseState @142 (`import: null`); re-import resets all candidates (@1394–1403, `reset_scope`) → every candidate belongs to the current import |
| Hash precedent | sha256 → lowercase hex (content.js @134–136) |
| No revision field exists today | grep `rev/revision`: none — §5 is a contract for implementation |
| No candidate/content delete route exists | only scene DELETE @3131 |

## §3 Canonical Payload Contract

**Envelope:** `{"spec": "ace-candidate-payload", "version": 1, "body": { …payload… } }` — `version` changes whenever canonicalization rules change; snapshots verify under the version recorded on them.

**body = Decision Content only — ratified field list (Decision A, 2026-10-26):**

- `title`, `category`, `shop: { name }`
- `scores: { formula_version, ranking_score, opportunity_score, confidence: { level, score, basis }, components: { weights, normalized } }` — full substructure retained (not collapsed to aggregate scores)
- `claims: [ { text, claim_class } ]`
- `reasons: [ … ]`

**Excluded from the canonical payload (ratified):**
- Identity / lifecycle / revision: `id`, `rank`, `status`, `status_history`, `created_at`, `rev`, `edit_history`
- References / source context: `product_id`, `offer_id`, `shop.id`, `source_ids`, `evidence_ids` (top-level), `claims[].evidence_ids`, `synthetic`
- Lineage / provenance: `variant_of`, `variant_index`, `provenance` (entire object, incl. `input_sha256`)
- Mechanism: `payload_hash` itself

Evidence references remain on the live entity and in the Snapshot Annex (§6.2); they are validated **outside** the hash (§7). `claims[].evidence_ids` embed the item identity (`EV-<item_id>-<code>` @895) — excluding them is what makes identity-change equivalence (§9) achievable.

**Semantics (Decision Content Equivalence):** equality of `payload_hash` means two entities assert the same evaluated content under the same formula and weights. It does **not** mean complete entity equality, same source/import, commercial interchangeability, or execution eligibility (§4, §6.3).

**Canonicalization rules (v1):**
1. Recursive key sort (Unicode code-point ascending) at every object level — required because insertion order is not stable across construction paths (variant deep-copy @1727 appends keys).
2. No whitespace; output bytes are UTF-8.
3. Numbers: JS JSON serialization; integers preserved; `NaN`/`Infinity` rejected; `-0` → `0`.
4. Missing ≠ null: `undefined` keys are omitted from the canonical form; explicit `null` keys are serialized and hash-significant.
5. Strings: byte-exact; **no Unicode normalization in v1** — NFC/NFD variants are different canonical contents by definition (recorded behavior, not a defect).
6. Arrays: order-preserving, no de-duplication (`claims`/`reasons` are semantically ordered; `source_ids`/`evidence_ids` preserve lineage order).
7. Nothing with business meaning is normalized away (claim text, including embedded `toFixed(2)` formatting, is content).

## §4 Hash Contract

- **Algorithm:** SHA-256 · **Input:** UTF-8 bytes of the canonical JSON string (whole envelope) · **Encoding:** lowercase hex.
- **Meaning:** equality of `payload_hash` establishes **Decision Content Equivalence** under one canonicalization version — two entities assert the same evaluated content under the same formula and the same weights. It does **not** establish complete entity equality, identity, lineage, creation path, source/import binding, persistence, authenticity, commercial interchangeability, execution eligibility, or recoverability.
- **Non-decision metadata (documented behavior):** changes to `provenance` fields, `data_quality.complete`/`derived_fields`, `limitations` text, or `unknown_fields` outside the five decision-relevant columns (`rating`, `rating_count`, `promo_depth_pct`, `related_shop_count`, `shop_rating` — @858–868) do **not** affect the hash, provided the Decision Content is unchanged.
- **`input_sha256` binding:** the value lives on the **live entity's** `provenance.input_sha256` (@962 — excluded from the canonical payload) and was computed at import time from actual CSV bytes (@1398 → @1429–1430). Recovery validates it against `state.import.sha256` (canonical key; `file_hash` @1430 and source-record `file_hash` @553 are aliases carrying the identical value). It does **not** re-hash the source file in real time. This limitation is recorded.
- **Recalculation:** only at edit-commit boundaries (future edit feature). Mismatch between stored and recomputed hash = content drift/corruption → reported honestly, never auto-repaired.
- **A hash is not:** a storage key, a backup, a version, a parent reference, or proof of recoverability.

## §5 Entity Revision Contract (`rev`)

**Semantics: change-set per entity.** After composing `new-state` (inside the lock, before persisting), diff each entity's stored representation (deep equality) between old-state and new-state:

1. **New Entity** (ID exists only in new-state): `rev = 1`.
2. **Changed Entity** (ID in both; representation differs): `rev = old rev + 1`, exactly **once** per request regardless of how many fields changed.
3. **Unchanged Entity** (ID in both; representation identical): revision preserved — **no increment**.
4. **Failed persistence / request that changes nothing:** no persisted revision increment.
5. **Successful restore:** increments the restored entity's revision exactly once.
6. **Snapshot append alone:** does not increment the entity's revision.
7. **Legacy:** entities without `rev` are treated as `rev = 0` — a **migration convention for compatibility only**; it does not prove the entity was never mutated. The first mutation under these rules sets `rev = 1`.
8. **Monotonicity:** `rev` for a given Entity ID never decreases (see Generate rules below).

`state.queue` and `state.actions` are state-level structures, not entity fields: changes to them alone do not bump any candidate's `rev` (except where the candidate's own stored fields also changed).

### §5.1 Generate identity and revision rules (contract for implementation)

1. **Survivor — ID exists in both old-state and new-state:**
   - Match by stable Entity ID; use the old persisted entity's `rev` as the **base**.
   - Diff the persisted entity representation **excluding the newly calculated `rev` itself** (the new `rev` value must not create a second diff).
   - Representation changed → new revision = old revision + 1, exactly once. Representation unchanged → old revision preserved.
   - Revision is monotonic per Entity ID: **Generate must never reset a surviving entity to `rev = 1`** (prevents an old `expected_revision` from accidentally matching a reset value).
2. **New Entity — ID exists only in new-state:** `rev = 1`.
3. **Dropped Entity — ID exists only in old-state:**
   - Absent from the current candidate set. Its historical actions/snapshots are preserved (append-only); nothing is silently deleted.
   - **Recovery of an entity absent from the current state is rejected in v1** with a clear "entity not present" result. No re-creation contract exists in v1.

### §5.2 Mutation Inventory (per-route rev effects)

| Route / event | Entities changed | rev effect |
|---|---|---|
| `POST /candidates/generate` | survivors: +1 only if representation differs (incl. `status_history` loss — see §8); new IDs: 1; dropped IDs: removed from current set | §5.1 |
| `POST /candidates/select` ADD | added: 1 each · actives whose `rank` actually changed: +1 · rank unchanged: no bump | change-set |
| `POST /candidates/select` REPLACE | replacement: 1 · Removed target: **not mutated** → no bump | change-set |
| `POST /candidates/:id/action` (SAVE/REJECT/QUEUE/REMOVE) | target: +1 (one request = one bump; status/history/queue_after all change together) · other entities: no bump | change-set |
| `POST /candidates/:id/restore` | target: +1 · actives whose `rank` actually changed: +1 | change-set |
| `POST /candidates/:id/variant` | variant: 1 · original: **no bump** (byte-for-byte unchanged — T11-04 evidence) | change-set |
| Failed / no-change requests | — | no persisted bump |
| Content routes (`CNT`) | — | out of `rev` scope (`script_version` covers content edits) |

### §5.3 Known implementation gap (documented, NOT to be implemented in this recording)

Current code rebuilds candidate objects on Generate (@1055) without carrying `status_history`, so after a regenerate that follows actions, survivors' stored representation differs (history lost) and their `consistency` field flags `ACTION_LOG_DIVERGENT` (D2 semantics: surfaced, never auto-repaired). This is pre-existing behavior, not yet runtime-tested (see §8). The implementation phase must reconcile Generate with §5.1 (carry/derive revision per the survivor rule; decide history handling explicitly) — that reconciliation is authorized only in the implementation phase.

## §6 Snapshot Contract

**Snapshot record:** `{ snapshot_id: "SNP-<ts>-<rand>", entity_id, entity_kind: "CANDIDATE_PAYLOAD", spec_version, canonical_json, payload_hash, evidence_annex, created_at, trigger, previous_snapshot_id, source_revision }`

- **`source_revision`** = the entity's `rev` **as written in the same new-state** that carries this snapshot (i.e., after the triggering mutation's increment). It is **historical metadata only**: not a CAS token, not the current revision, and never included in the canonical payload hash. Current-revision vs snapshot-recorded revision are always distinguished.
- **Storage:** embedded in `state.json` (single file of record) for v1 — under the single-instance / in-process-lock assumption. No pointer field exists; the append is part of the atomically replaced new-state.
- **Immutable:** append-only; restore creates a **new** snapshot; historical snapshots are never rewritten or deleted (including snapshots of entities later dropped from the current set).
- **Atomic persist sequence (normative):** (1) read state inside the lock → (2) compose one `new-state` containing entity mutation + `rev` increment + snapshot append together → (3) persist via atomic replacement (`writeFile(tmp)` → `rename`, @195–199) → (4) report success only after successful persist. On failure at any point, none of the three appears in the persisted state.
- **Failure responses:** a failed persist must yield an actual error response; the in-memory `new-state` is discarded (no cached state exists), so no memory/file divergence is possible by construction.

### §6.1 V11 failure assertions (split by failure point)

**"Byte-identical" (normative definition):** the persisted `state.json` file bytes immediately before the injected failure equal the bytes after — a full-file byte comparison; parsed-JSON or object equality is **not** a substitute. The byte scope includes the evidence annex (§6.2).

| Test | Injection point | Required evidence |
|---|---|---|
| V11a | `rename` fails | persisted `state.json` byte-identical; **actual error response** (no success); no entity mutation / rev increment / snapshot (incl. annex) in the persisted state; the leftover temp file is **observed and reported as found** |
| V11b | `writeFile` fails (before creating temp / mid-write) | persisted `state.json` byte-identical; actual error response; `.tmp` result (absent or partial) **observed and reported as found** |
| V11c | success path | persisted state contains the entity mutation, rev increment and snapshot, mutually consistent (`snapshot.source_revision` = the written `rev`; annex consistent per §6.2) |

`.tmp` policy: observe and report per failure point — never assert a fixed presence/absence; claim "cleanup succeeded" only when cleanup was performed **and** the post-cleanup filesystem state was verified.

**Crash/power-loss safety is outside v1.** Injection tests prove in-process exception behavior only; they must never be cited as crash-safety evidence. A process-level test (if ever required) is separate evidence.

### §6.2 Evidence Annex (Decision B — β)

Snapshot records carry an `evidence_annex` preserving the recorded claim↔evidence relationship at snapshot time, **outside** the `payload_hash` scope:

```
evidence_annex: {
  annex_spec: "ace-evidence-annex", version: 1,
  candidate_evidence_ids: [ … ],                                  // top-level aggregate as of snapshot time
  claims: [ { claim_index: 0, evidence_ids: [ … ] }, … ],         // claim_index points into the hash-protected claims array
  import_sha256: "…",                                             // Generation Binding — import generation of this snapshot
  annex_hash: "<sha256 lowercase hex>"                            // covers {annex_spec, version, candidate_evidence_ids, claims, import_sha256} — never itself
}
```

- Canonical `claims` are `{ text, claim_class }` only; the refs live here and on the live entity.
- **Annex integrity:** `annex_hash = sha256(canonical JSON of {annex_spec, version, candidate_evidence_ids, claims, import_sha256})` — same canonicalizer as the payload; verified before every restore; mismatch → reject, never auto-repaired. **Coverage ratified by Owner (D-COV, 2026-10-26):** `import_sha256` is intentionally inside the hashed object — closing the Generation-Binding bypass where it could otherwise be edited while `annex_hash` stayed valid. `annex_hash` never covers itself.
- **Structural consistency:** `annex.claims.length === canonical_json.claims.length`; every `claim_index` within range; else reject (annex corrupt or mismatched with its snapshot).
- **Generation Binding:** `annex.import_sha256 === state.import.sha256` must hold at restore; **cross-generation restore is rejected even when `synthetic` matches** (Decision B).
- **Same-generation consistency check (secondary, non-authoritative):** for every referenced evidence record: `record.synthetic === state.import.synthetic` and the entity's `synthetic === state.import.synthetic`.
- **Immutability:** the annex is append-only with its snapshot; restore re-records a fresh annex from what was actually applied (§7) and never touches historical snapshots.
- Snapshot append alone (with annex) does not bump `rev` (§5.2) — the annex is part of the snapshot, not an entity change.

## §7 Recovery Contract (future feature — preconditions defined here)

Executed entirely within one lock (validation and apply never cross the boundary):

1. **Snapshot integrity:** `sha256(canonical_json) === payload_hash` (and `spec_version` supported).
2. **Annex integrity:** `sha256(canonical(annex body)) === annex_hash`; structural consistency with the canonical claims (count + `claim_index` range).
3. **Annex reference validity:** every evidence id in the annex (per-claim and aggregate) resolves in the current `state.evidence`.
4. **Generation binding:** `annex.import_sha256 === state.import.sha256` — cross-generation restore is rejected even when `synthetic` matches.
5. **Subject-chain integrity (all five, per referenced evidence record):** record exists; `subject.type === 'OFFER'` and the subject offer exists; the subject offer's `evidence_ids` contain the reference; the record's `source_ids` contain `SRC-EXPORT-` + `state.import.sha256.slice(0,8).toUpperCase()` (@526); `record.checked_at === state.import.checked_at` and `record.synthetic === state.import.synthetic`.
6. **Source binding:** the live entity's `provenance.input_sha256 === state.import.sha256` (canonical key; `file_hash` is an identical-valued alias).
7. **CAS:** `entity.rev === expected_revision` (from the request). Mismatch → reject, reporting both values.
8. **Entity absent from the current state** → reject in v1 ("entity not present").
9. **Apply:** write the restored Decision Content; re-attach evidence references **from the validated annex** — never silently substituted with current entity refs; create a new append-only snapshot with a freshly recorded annex (`source_revision` = post-increment rev); historical snapshots are never rewritten.
10. **Every rejection leaves the persisted state byte-identical** (full-file byte comparison). Failure cases: F-R1 payload-hash mismatch · F-R2 unsupported version · F-R3 annex-hash mismatch · F-R4 annex↔canonical structural mismatch · F-R5 unresolved annex refs (reported per id) · F-R6 reference/binding failure · F-R7 CAS mismatch · F-R8 persist failure (the whole new-state — entity mutation, rev, snapshot, annex — is discarded together).

## §8 Known Behavior — `ACTION_LOG_DIVERGENT` after Generate (RV-13)

Regenerate after prior actions rebuilds candidates without carrying `status_history` (@1055–1062), so survivors' stored representation diverges from the action log and `consistency` flags `ACTION_LOG_DIVERGENT`. Category: **Regression / Known Behavior** — separate from Revision/Snapshot acceptance criteria. When runtime verification is authorized: record actual output/log evidence; do not conceal, mask, or auto-repair; do not change Generate semantics inside a spec-recording task.

## §9 Test Matrix — **PROPOSED — NOT EXECUTED** (for the implementation phase)

**Status: every vector below is `PROPOSED — NOT EXECUTED` — none has been run against any implementation; they become executable acceptance tests only after the Vertical Slice is authorized.**

| Group | Vectors |
|---|---|
| Canonicalization | V1 insertion-order · V2 pretty/compact · V4 one-char diff · V6 null vs missing · V7 number vs string · V8 NFC/NFD differ · V9 array order · V10 non-finite rejected |
| Equivalence | V3 original vs untouched variant → equal hash · V3b different `input_sha256` → different · V3c different `method` → equal · V5 lifecycle change → hash unchanged |
| Revision | RV-1 single bump per request · RV-2 failure/no-change → no bump · RV-3 idempotent action → no bump · RV-4 generate per §5.1 (survivor diff / new=1 / dropped removed) · RV-5 select-add (added=1; re-ranked-changed +1; rank-identical no bump) · RV-6 restore (target +1; re-ranked-changed +1) · RV-7 variant (variant=1; original unchanged) · RV-8 legacy absent=0 → first mutation=1 · RV-9 failed write → no bump |
| Snapshot/Recovery | V11a/V11b/V11c per §6.1 (byte scope includes the annex) · V12 lifecycle-only change between request and apply → CAS rejects via `rev` (V12b: payload_hash alone would false-pass — negative control) · V13 reference/source-binding/version failures → reject, byte-identical · V14 content generated from a variant carries the variant ID (existing lineage) |
| Decision Content | V-DC-1 rank/status change → equal · V-DC-2 normalized metric change → different · V-DC-3 unknown_fields in the five decision columns → different (via confidence/basis) · V-DC-4 unknown_fields outside them → equal (documented) · V-DC-5 `input_sha256` change → equal hash + separate source-binding rejection · V-DC-6 `scores.formula_version` meaningful change → different · V-DC-7 provenance/`source_ids`/`synthetic`/`evidence_ids` changes → equal (α + Decisions 1–4) · V-DC-8 identity/`rev` change → equal |
| Confidence independence | V-C1 `score` only → different · V-C2 `level` only → different · V-C3 `basis` only → different (pure hash-contract vectors; internally inconsistent records are intentional and must not be read as business scenarios) |
| Evidence Annex | V-AN-1 annex integrity pass → restore proceeds · V-AN-2 `annex_hash` mismatch → reject · V-AN-3 unresolved refs → reject with per-id report · V-AN-4 restore re-records a consistent annex · V-AN-5 cross-generation (`import_sha256` mismatch) → reject even when `synthetic` matches · V-AN-6 subject-chain broken → reject with the broken link reported · V-AN-7 same-generation full pass → restore + re-recorded annex consistent |
| Commercial context (gap register — documented behaviors; **no gate exists today**) | S1 same content + same `shop.name` + different `shop.id` → equal hash; commercial check required independently · S2 different `shop.name` → different hash · S3 same text, different offer/product ids → may be equal; offers are NOT interchangeable · S4 old content vs changed price/commission/promo/link → freshness validation gap (candidates carry no offer snapshot) · S5 synthetic vs real identical content → equal hash; trust/authorization must not treat them as equivalent (no gate exists today) |
| Regression | Existing suites on the final working tree: mission1 acceptance harness (currently 143 checks), mvp-workflow 56, content-creation 62, foundation 19 — plus **RV-13 known-behavior test** (§8) |

## §10 Invariant Table

| INV | Invariant | Enforcement | Falsifiable test |
|---|---|---|---|
| 1 | same payload → same canonical bytes/hash across insertion orders | `canonicalize()` | V1, V2 |
| 2 | hash covers body only (identity/lifecycle excluded) | exclusion list | V3c, V5 |
| 3 | lineage excluded from hash | exclusion list | V3, V3b |
| 4 | missing ≠ null; non-finite rejected | canonicalize | V6, V10 |
| 5 | rev changes only for entities whose stored representation changed; once per request | per-entity diff before persist | RV-1..RV-7 |
| 6 | failure → persisted state byte-identical + error response | withLock + writeState + response order | V11a/b, T11-10 pattern |
| 7 | entity mutation + rev + snapshot compose one new-state | persist sequence §6 | V11a/b/c |
| 8 | snapshots immutable; restore = new snapshot | structure + restore | V12 + history growth |
| 9 | recovery = 4-stage validation in one lock | recovery route | V12/V13 |
| 10 | `source_revision` = written rev; never a CAS token | snapshot composer | V11c + V12 |
| 11 | every candidate binds to the current import | import reset + reference check | V13 |
| 12 | legacy absent rev = 0 (migration convention) | read path | RV-8, V14 |
| 13 | Generate survivor revision monotonic, never reset to 1 | §5.1 | V-gen set (§5.1 tests) |
| 14 | Annex integrity: `annex_hash` verified before restore; never auto-repaired | recovery stage 2 | V-AN-2 |
| 15 | Generation binding: cross-generation restore rejected even when `synthetic` matches | recovery stage 4 | V-AN-5 |
| 16 | Subject-chain integrity (5 links) per referenced evidence record | recovery stage 5 | V-AN-6 |
| 17 | Restore re-attaches refs from the validated annex — never silently substituted with current refs | recovery stage 9 (apply) | V-AN-3/V-AN-4 |

## §11 Open Items & Gap Register

**Open items:**

1. **Retention/size policy** — deferred until real size evidence exists (current real state is 117 B, empty).
2. **CNT payload hash spec** — separate future specification (script/artifact checksums exist but are not this spec).
3. **Deletion features** (candidate/content) — would require persistent monotonic counters (variant sibling numbering and `CNT-<n>` are safe only while nothing is deleted).
4. **Generate history handling** (§5.3) — reconcile during implementation.

**Gap register (future features — documented, no gate exists today; outside the Vertical Slice):**

- Commercial-context validation (S1/S3/S4: shop/offer interchangeability, content freshness vs changed prices/links).
- Evidence validators: claims `evidence_ids` existence/relevance resolution (§7 stage 3 is a contract for implementation, not an existing capability).
- Synthetic trust/authorization gate (S5).
- Cross-generation restore (currently refused by Generation Binding — a future feature would need its own Owner decision).

## §12 Implementation Boundary (for the future Vertical Slice authorization)

**Would include:** `canonicalize()` utility; `payload_hash` and `rev` fields (additive; legacy = absent/0); snapshot append with `evidence_annex` embedded in `state.json`; edit-commit hook; recovery route (stages 1–10 of §7, single lock); annex/evidence-resolution validators (§7 stages 2–3, 5); test matrix §9; lazy hash computation for legacy entities.
**Would exclude:** Auto Save UI/debounce; recovery UI; event sourcing; CNT payload spec; deletion features; migration/rewrites of existing state; changes to CA-V1 content-artifact behavior; commercial-context and trust/authorization gates (gap register, §11).

## §13 Recording Statement

- This document is the **only** file created by the "Decision A: Record Approved Specification Only" task. No application code, tests, real state, exports, decision log, or Git history were modified.
- Baseline before recording: branch `mission1-planning-docs`, HEAD `9749f38e…`, 9 commits, porcelain 29, staged 0, `service.js` 136,071 B / `d13a23f4…`, real state 117 B / md5 `5d29cdbd…`.
- **Porcelain caveat (G-1):** a porcelain count may remain unchanged when a newly created file lies inside an already-untracked directory that Git reports as one collapsed entry (e.g. `?? verification/`). Inspect individual files with `git status -uall` (plus an appropriate diff) and never treat an unchanged porcelain count alone as proof that no file was added.
- **Amended 2026-10-26** per Owner **Decision A** (Canonical Payload field list ratified per design α → **UNRESOLVED-1 CLOSED at decision level**) and **Decision B** (Amendment Plan F1–F8 + Evidence Annex β approved, incl. Generation Binding, Subject-Chain Integrity, and the condition that all annex validators are new implementation requirements, not existing capabilities). Conditions of Decision B are recorded in §6.2 and §7. **D-COV (2026-10-26): Annex hash coverage ratified** — `annex_hash` covers `{annex_spec, version, candidate_evidence_ids, claims, import_sha256}` and never itself (§6.2). §9 relabelled **PROPOSED — NOT EXECUTED**.
- Spec lineage: Phase 3 draft → Reconciliation Addendum (F1–F3) → Final Spec Reconciliation (rev/CAS) → Final Consistency Check (persist sequence, change-set semantics, V11 split) → Final Edge-Case Reconciliation (Generate identity, V11 assertions, RV-13) → Recording → **β Annex + Decision A/B amendments (this version)**.
