# ACE — Gate 3 Owner Decision Ratification (Round 2 scope)

**Revision 0.4 — ALL OWNER DECISIONS Q1–Q7 RECORDED at their stated levels.**
**Implementation: NOT AUTHORIZED.** Ratification of a design decision is not authorization to build it. A separate Implementation Scope and an explicit Owner authorization are still required.

**Gate 3 Overall: NOT ACCEPTED**
**Gate 4: NOT AUTHORIZED**
**Owner is the sole Gate 3 PASS authority.**

**Basis:** `verification/ace-mission1-openrouter-gate3-final-reconciliation-2026-11-01.md` (findings P1–P11, §5, §7, §9, §10). Line references were re-confirmed against the working tree.

**Update history:** 0.1 initial proposal → 0.2 recorded Q1–Q3 → 0.3 applied Owner review corrections → 0.4 records Q4–Q7 (this revision, documentation-only).

---

## 0. Decision register

| Decision | Status | Level | Amends |
|---|---|---|---|
| Q1 / D-1 — qualitative claims → `review_required` | **RATIFIED** | Principle | Provenance matrix (A1, A2), Evidence Contract (A3) |
| Q2 / D-1b — `review_required` blocks `FINALIZED` | **RATIFIED IN PRINCIPLE** | Principle | `content.js:824`, `:936`; `service.js:2914` |
| Q3 / D-2 — unmatched price amounts rejected | **RATIFIED** | Principle | Validator only |
| Q4 / D-3 — per-version provenance, Option 3A | **RATIFIED** | Design decision | `SOURCES`, matrix row, history schema |
| Q5 / D-4 — overlay edit, Option 4A | **RATIFIED** | Design decision | Script representation |
| Q6 / D-6 — authoritative interlock, Option 6B strict | **RATIFIED** | Design decision | `service.js:2721`, provider `isLiveEnabled` |
| Q7 — Gate 3 PASS authority and evidence bundle | **RATIFIED** | Governance | Evidence process |
| D-5 — `thai-qa.js:594` defect | **DEFERRED** — separate ticket, not filed | Out of scope | QA module |

No decision above is implemented. No decision above is verified in code.

### Levels used in this document — do not conflate

- **RATIFIED PRINCIPLE** — the behaviour the Owner requires; implementation shape still open.
- **RATIFIED DESIGN DECISION** — the specific option the Owner selected; not built.
- **PROPOSED IMPLEMENTATION DESIGN** — the Assistant's suggestion; **carries no Owner approval**.
- **PENDING DOCUMENT AMENDMENT** — approved in principle, but the target document has not been edited.
- **OPEN DESIGN QUESTION** — a detail that follows from a design; not an unresolved Owner decision.

---

## 0.1 Owner decisions — Q1 to Q3

### Q1 / D-1 — Qualitative claims → **APPROVED**

- `source` states the **origin** of the content.
- `status` states the **acceptance** state.
- `LIVE_LLM` does **not** imply the content has been confirmed.
- Evidence Contract clause A3 must be amended to match this principle.
- The status and matrix rows proposed in D-1 are to be added.

### Q2 / D-1b — Finalization gate → **APPROVED IN PRINCIPLE**

- `review_required` **must block** the transition to `FINALIZED`.
- Saving, editing, previewing, and submitting for review remain allowed.
- Unlocking finalize requires a **retrospectively auditable human review result**.
- A bare acknowledgement is **not** evidence.
- The record must capture reviewer, decision, and supporting evidence or changes.
- No expansion into other workflow areas without a further decision.

### Q3 / D-2 — Unmatched price amounts → **APPROVED: `Reject unmatched`**

- A currency amount matching a snapshot number is **not** sufficient to confirm the *meaning* of the price.
- An amount whose role cannot be determined must **not** pass on value-only matching.
- Reject or return for correction when the role cannot be determined.
- Naturally correct text must not be rejected without cause.
- Adversarial tests must cover **both** false positives and false negatives.

---

## 0.2 Owner decisions — Q4 to Q7

### Q4 / D-3 — Provenance per Script Version → **APPROVED — Option 3A**

Every Script Version must retain **its own** provenance in its history entry.

Required proposed history provenance fields: `source`, `status`, `traceId`, `provider`, `model`, `fallbackReason`.

For human-edited versions: `source: 'HUMAN_EDIT'`, `status: 'edited'`, and `derived_from_trace` referencing the originating trace **when one exists**.

Required design changes to record:

- Add `HUMAN_EDIT` to `SOURCES`.
- Add the `HUMAN_EDIT + edited` row to the provenance matrix.
- Ensure a human-edited version **does not falsely inherit** the previous AI version's provenance.
- Preserve traceability between versions without misrepresenting the origin of the current version.

### Q5 / D-4 — Overlay edit → **APPROVED — Option 4A**

When a human edits an Overlay:

1. Regenerate `script.lines` from the latest Storyboard state.
2. Ensure `script.lines[].on_screen` reflects the current Overlay.
3. Do **not** increment `script_version`.
4. Voiceover text and its checksum must remain unchanged.
5. Voiceover edits continue to increment Script Version under existing rules.
6. Adding or removing a Scene continues to increment Script Version.
7. Ensure Script Lines remain consistent with the current Scene structure.

Option 4B is **not** selected. This decision does **not** extend to Export filename or Content Library overwrite policy — those remain separate concerns requiring their own decision.

### Q6 / D-6 — Authoritative Safety Interlock → **APPROVED — Option 6B, Strict Behavior**

The Service must use `provider.isLiveEnabled(process.env)` as the authoritative check.

| Environment value | Expected result |
|---|---|
| Unset | OFF |
| `'1'` | ON |
| `'true'` | OFF |
| `'yes'` | OFF |
| `' 1 '` | OFF |
| `'01'` | OFF |

- Service and Provider must produce identical results.
- No trimming or normalization may turn an otherwise invalid value into ON.
- Default OFF is preserved.
- Only the exact string `'1'` enables Live mode.

#### Verified discrepancy against this decision (found in this task, not fixed)

The current implementation **does not satisfy Q6**. Probed directly:

```
value    provider:  service:
"1"      true       true      AGREE
" 1 "    true       false     DISAGREE   <- spec requires OFF/OFF
"01"     false      false     AGREE
"true"   false      false     AGREE
"yes"    false      false     AGREE
```

Cause: `provider/openrouter.js:122-124` does `String(env[...] || '').trim() === '1'` (trims, so `' 1 '` → ON), while `service.js:2721` does `process.env.ACE_LLM_LIVE_ENABLED === '1'` (no trim, so `' 1 '` → OFF).

Two ratified requirements are therefore unmet today: `' 1 '` must be OFF (the provider returns ON), and service and provider must agree (they do not). Implementation must remove the trim from the provider, not add it to the service. Recorded as a **known discrepancy**, not as a completed fix.

### Q7 — Gate 3 PASS authority and Evidence Bundle → **APPROVED**

**Authority**

- The Owner is the **sole** authority who may declare and sign off Gate 3 PASS or NOT ACCEPTED.
- Agents may inspect, test, collect evidence, and report findings.
- Agents must **never** declare Gate 3 PASS on the Owner's behalf.

**Evidence integrity**

- Every evidence item must distinguish actual execution results from agent-reported claims.
- Never describe an unexecuted test as passed.
- Never describe source inspection as runtime verification.
- Record limitations and missing evidence explicitly.

**Required Gate 3 Evidence Bundle**

1. Git baseline and working-tree status before and after.
2. Changed-file inventory and relevant diffs.
3. Test results with exact commands, exit codes, and actual outputs.
4. Adversarial validation probes covering false positives and false negatives.
5. Provenance tests covering AI, Template, and Human Edit.
6. Finalization gate tests, including `review_required`.
7. Safety Interlock tests for every Q6 input value.
8. Runtime behaviour evidence without calling the Live Provider.
9. Remaining defects, unresolved findings, and evidence limitations.

The Owner alone decides whether the assembled evidence is sufficient.

---

## 0.3 Open design questions and pending items (not Owner decisions)

| Item | Type | Note |
|---|---|---|
| Q2a | **OPEN DESIGN QUESTION** | If a reviewer field is stored, free text or authenticated principal? App has no auth today. |
| Q2b | **OPEN DESIGN QUESTION** | On a rejected review, does the script return to `DRAFT`, or is only the review cleared? |
| `project.review` + `script_checksum` design | **PROPOSED IMPLEMENTATION DESIGN — NOT RATIFIED** | One way to satisfy Q2; not a requirement. |
| Evidence Contract A3 wording | **PENDING DOCUMENT AMENDMENT** | Approved in principle; contract file deliberately untouched. |
| P7b (`SKU-9` treated as identity claim) | **UNRESOLVED FINDING** | Existing false positive, not covered by Q1–Q7; will fail PASS criterion 2 if undecided. |
| D-5 / ACE-QA-001 | **DEFERRED** | Separate ticket; not filed, not scheduled. |

Q2a/Q2b do **not** invalidate Q2's ratified principle. Q2 is decided; these are details of one possible implementation.

---

## D-1 — Qualitative claims enter `review_required` — **RATIFIED (principle)**

### Policy

A draft may contain assertions no snapshot field can support (`คุ้มที่สุดในตลาด`, `ทนทาน`, `ขายดี`, `คุณภาพดีที่สุด`, `เหมาะสำหรับทุกคน`, `ถูกกว่าร้านอื่น`). These must not pass silently and must not be hard-rejected.

- `validateScriptDraft` returns `ok: true` plus `reviewRequired: true`, with findings `{ code: 'unverified_qualitative_claim', claim }`.
- `createScriptDraftWithProvider` writes `source: 'LIVE_LLM'` (origin) with `status: 'review_required'` (acceptance).
- `project.script.review_required = true`; the API response surfaces the trace.

**Ratified semantic rule:** `source` = origin, `status` = acceptance. `LIVE_LLM` asserts provenance only.

### Detection limit (must be stated in code and report)

A bounded lexicon of superlative/comparative markers. **The lexicon is not exhaustive, and a non-match is not evidence of groundedness.** The state prevents *silent* passing; it does not claim semantic verification.

### Implementation constraints (not authorized)

1. `reviewRequired` is derived by the validator, never supplied by a caller — same single-writer rule as `source`.
2. A hard failure outranks review: fabricated price **plus** superlative → `TEMPLATE` + `graceful_fallback` + `validation_failed`.
3. The response must name the triggering claims, not only the state.
4. `review_required` must be representable in `OFFLINE_TEST` as `MOCK + review_required`.

### Acceptance tests

- `คุ้มที่สุดในตลาด` in a grounded draft → `ok: true`, `reviewRequired: true`, `status: 'review_required'`, `source: 'LIVE_LLM'`, not `success`.
- Same in `OFFLINE_TEST` → `source: 'MOCK'`, `status: 'review_required'`.
- No qualitative marker → `success` (no regression).
- Fabricated price + superlative → `TEMPLATE` + `graceful_fallback` + `validation_failed`.

### Blast radius

`content.js` validator (~1299-1440) and provider-success branch (~1500-1530); `provenance.js:31-35`, `:70-75`.

---

## D-1b — `review_required` blocks `FINALIZED` — **RATIFIED (principle)**

`finalizeProject` (`content.js:936`) throws `409` with failed checklist labels when `checklist.passed` is false; `buildFinalizeChecklist` (`content.js:824`) produces `items[]` of `{ id, label, ok, detail }`. No item considers script review state today — `:1755` checks only `script_version >= 1` and `checksum` presence.

### Ratified requirements

1. `review_required` blocks `FINALIZED`.
2. Save, edit, preview, and submit-for-review stay allowed.
3. Unlocking requires a retrospectively auditable human review result.
4. A bare acknowledgement is not evidence.
5. Record reviewer, decision, and supporting evidence or changes.
6. No expansion into other workflow areas.

### Proposed implementation design — **NOT RATIFIED**

> Everything in this subsection is `PROPOSED IMPLEMENTATION DESIGN`. It is the Assistant's suggestion and carries **no Owner approval**. It must not be cited as a requirement, schema decision, or ratified constraint.

Fits the existing checklist pattern (a `{ id: 'script_review', ok, detail }` item) plus a persisted record:

```
project.review = {
  required: true,
  reason: ['unverified_qualitative_claim'],
  reviewer: <string>,
  decided_at: <ISO>,
  decision: 'APPROVED' | 'REJECTED',
  evidence_refs: [<string>, ...],
  changes: [<string>, ...],
  script_version: <int>,
  script_checksum: <sha256>,
}
```

`script_checksum` is the proposed mechanism making "an acknowledgement is not evidence" enforceable: an approval applies only to the checksum it names, so later edits invalidate it.

### Acceptance tests

**Required by the ratified principle (hold whatever design is chosen):**

- `review_required` script → `POST /finalize` returns `409` naming the reason.
- The same script can still be saved, edited, previewed, and submitted for review.
- After an auditable approved review → finalize succeeds.
- After that approval, editing the script → finalize blocked again.
- A review record with no substantive evidence → not accepted as approval.
- Non-`review_required` script → finalize unchanged (no regression).
- `DRAFT`/`REVIEW`/`EXPORTED` semantics untouched.

**Specific to the unratified design** (only if adopted): the `script_checksum` field, non-empty `evidence_refs`, the exact `project.review` shape.

### Blast radius

`content.js:824`, `:936`, possibly `:1854`; `service.js:2914`, route `:3480`.

---

## D-2 — Price-role coverage and masking — **RATIFIED (principle): `Reject unmatched`**

Value-only matching is retired. An amount matching a snapshot price whose **role cannot be determined** must fail.

| Code | Meaning |
|---|---|
| `conflicting_price` | Role determined; amount is the other price |
| `ambiguous_price_role` | Matches a snapshot price but no role cue recognised — **new, required by Q3** |
| `unsupported_price` | Role determined, but the snapshot has no value for that role |

Outcome uses the existing path: `TEMPLATE` + `graceful_fallback` + `validation_failed`, with the specific code recorded.

### Two implementation changes

**1. Mask before scanning (fixes P7c).** Today the role patterns replace only the number (`content.js:1372-1374`), leaving `บาท` behind; `priceMentions` then binds it to an earlier number — `ข้อมูลปี 2026 ราคา 299` yields claim `"2026   บาท"`. Mask each *claim span* (cue + amount + trailing currency word / `฿` / `THB`) with an inert placeholder before the currency scan, and strip orphan currency words. The `2026`-before / `2026`-after order dependence must disappear; both must pass.

**2. Widen role cues, then reject what remains uncued.** Current-price cues: `ราคา` (when not immediately followed by `ลด`/`จาก` in the same clause), `ตอนนี้`, `เหลือ`, `เพียง`, `แค่`, `ราคาพิเศษ`, `ราคาโปรโมชัน`, `ราคาลด`, `ราคาสุทธิ`. List cues: `ราคาปกติ`, `ราคาเต็ม`, `จากปกติ`, `ราคาก่อนลด`, `จาก`. Any other currency amount → `ambiguous_price_role`.

### Cue discipline (ratified constraint, tightened in 0.3)

- A **cue-coverage test set** of ordinary Thai phrasings that must pass, written before the cue list is finalised.
- The same set must include **ambiguous and adversarial phrasings that must still be rejected**. A cue may be added only when justified by a real phrasing and accompanied by an ambiguous case proving it did not widen acceptance indiscriminately.
- **Adding cues until numbers merely stop being rejected is prohibited** — that restores value-only matching under a longer keyword list.
- Every cue addition is a reviewed change with its own before/after probe output.
- The first-draft prompt must use cued phrasings, so the model is guided rather than punished for a gap ACE created.
- Rejections must name the missing role.

Recorded honestly: this change will reject some sentences a Thai reader finds correct. That cost is accepted and must appear in the round-2 report.

### Acceptance tests — both directions, mandatory

**Must accept:** P1 `ราคา 599 … ลดเหลือ 299`; P2 `จาก 599 เหลือ 299`; P3 `ราคาปกติ 599 … ราคาพิเศษ 299`; P7c `ข้อมูลปี 2026 ราคา 299 บาท`; P7e `ราคา 299 บาท ข้อมูลปี 2026`; `เพียง 299 บาท`; the grounded draft; creative copy; plus the cue-coverage set.

**Must reject:** P9 `ราคาพิเศษ 599 บาท`; P10 `ราคาโปรโมชัน 599 บาท`; P11 `เพียง 599 บาท`; `ราคา 199`; `ลด 30%`; `1,299 บาท`; **and** a bare uncued amount `${PRODUCT} 299 บาท` → `ambiguous_price_role`.

**Non-regression:** 20/20 validation, 21/21 provider, 6/6 route, 56/56 MVP workflow.

**Process requirement:** the suite was green while P9–P11 and P7c were broken. Round-2 evidence must publish probe inputs and outputs beside expected values.

### Blast radius

`content.js:1255-1262`, `:1360-1402`. No provider, service, or schema change.

---

## D-3 — Provenance per script version — **RATIFIED: Option 3A**

### Problem this fixes

`bumpScript` (`content.js:582-590`) replaces `project.script` wholesale, so `source`, `trace`, `lines_source` and `fallback_reason` vanish. Verified earlier: after `addScene`, `source` and `trace` are absent. History entries (`content.js:513-518`, `:585-590`) record only `version, at, reason, checksum` — origin is never carried.

### Ratified design

- Every history entry carries its **own** provenance: `{ source, status, traceId, provider, model, fallbackReason }`.
- Human-edited versions record `source: 'HUMAN_EDIT'`, `status: 'edited'`.
- `derived_from_trace` references the originating trace **when one exists** (a project that never used a provider has none).
- `HUMAN_EDIT` is added to `SOURCES`; the `HUMAN_EDIT + edited` matrix row is added.
- A human-edited version must **not** inherit the previous AI version's provenance.
- Traceability between versions is preserved without misrepresenting the current version's origin.

### Implementation constraints (not authorized)

1. Capture provenance at creation **and** at every bump; a version with no record is a defect, not a default.
2. Never copy the previous entry's provenance forward as if the new version had the same origin.
3. `derived_from_trace` may be null; it must not be fabricated to make a chain look complete.
4. Persisted fixture state lacking the field must remain readable — additive, not a migration.

### Acceptance tests

- Create → `history[0].provenance.source` matches the trace source.
- Add scene after a `MOCK`/`LIVE_LLM` draft → `history[1].provenance.source = HUMAN_EDIT`; `history[0]` unchanged.
- Text edit → same, with `derived_from_trace` equal to the earlier traceId.
- Deterministic-only project → `history[0].provenance.source = TEMPLATE`, `derived_from_trace` null or absent.
- No history entry claims `LIVE_LLM` for a version whose text differs from the accepted draft.
- Provenance of version *n* is never identical-by-inheritance to version *n-1* after a human edit.

### Blast radius

`content.js:513-518`, `:582-590`; `provenance.js:28`, `:70-75`. Additive to persisted state.

---

## D-4 — Overlay edits match the storyboard — **RATIFIED: Option 4A**

### Problem this fixes

`applyTextEdit` (`content.js:642`) changes `scene.overlay.headline`, but `bumpScript` runs only when `textChanged` (voiceover) is true (`content.js:693`). `buildScript` derives `lines[].on_screen` from overlays, so the script keeps stale on-screen lines. Verified earlier: new headline `หัวข้อที่มนุษย์แก้` present on the scene, absent from `script.lines[1].on_screen`, `script_version` still 1.

`runProjectQa` reads the storyboard via `thaiQa.collectText` (`thai-qa.js:231`, called at `:811`), not `script.lines` — which is why QA never noticed.

### Ratified design (7 requirements)

1. Regenerate `script.lines` from the latest Storyboard state.
2. `script.lines[].on_screen` reflects the current Overlay.
3. `script_version` is **not** incremented.
4. Voiceover text and its checksum remain unchanged.
5. Voiceover edits still increment Script Version.
6. Add/remove Scene still increments Script Version.
7. Script Lines stay consistent with the current Scene structure.

**Out of scope by decision:** Export filename policy and Content Library overwrite policy. Do not extend this decision into them.

### Implementation constraints (not authorized)

1. Regeneration must derive from the storyboard, not patch individual fields — a partial copy re-introduces drift.
2. Regeneration must not touch `text` or `checksum`, since neither depends on overlays.
3. If the scene structure changed, lines are rebuilt to match; a length mismatch is a defect.
4. Exports at `content.js:1561` keep using the unchanged `script_version`.

### Acceptance tests

- Overlay edit → `script.lines[k].on_screen` contains the new value; `script_version` and `checksum` unchanged.
- Voiceover edit → version bumps, `text`/`checksum` update, `lines` regenerated.
- Add/remove scene → version bumps, `lines` length equals scene count.
- QA unaffected by overlay edits, asserted explicitly.
- Export filename unchanged after an overlay edit.

### Blast radius

`content.js:642-700` (`applyTextEdit`/`bumpScript`), `content.js` buildScript consumers. No provider or schema change.

---

## D-5 — `thai-qa.js:594` — DEFERRED, separate ticket

- **Proposed ID:** ACE-QA-001
- **Location:** `app/mvp/thai-qa.js:594` — `Number((project.offer_snapshot && project.offer_snapshot.promo_depth_pct) || 0)`
- **Root cause:** the snapshot field is `offer_snapshot.promo.depth_pct`; `promo_depth_pct` does not exist, so `expected` is always `0`.
- **Symptom:** every CTA containing a discount claim reports `CTA-DISCOUNT: FAIL`, matching or not.
- **Fix shape:** read `promo.depth_pct`; keep the tolerance comparison.
- **Behaviour change:** matching CTAs start passing QA — needs before/after evidence.
- **Rule:** not bundled with D-2 or D-1.

**Status:** not filed, not scheduled; outside Q4–Q7, outside this revision.

---

## D-6 — Authoritative interlock — **RATIFIED: Option 6B, strict**

`service.js:2721` takes the decision inline (`=== '1'`); `provider/openrouter.js:122-124` takes it again with `.trim()`. The two disagree on `' 1 '` — proven in §0.2.

### Ratified design

- The Service uses `provider.isLiveEnabled(process.env)` as the authoritative check.
- Only the exact string `'1'` enables Live mode.
- No trimming or normalization may turn an invalid value into ON.
- Service and Provider must produce identical results.
- Default OFF preserved.

### Implementation constraints (not authorized)

1. Remove the `trim()` from the provider — Q6's table requires `' 1 '` → OFF, and the provider currently returns ON.
2. The service must call the provider helper rather than compare the env string itself, so a future change cannot split the two again.
3. Any normalisation added later must be covered by the six-value table as a test.
4. The interlock's *meaning* does not change: no request without it.

### Acceptance tests

- Unset → `isLiveEnabled()` false; `provider_disabled`; 0 requests.
- `'1'` → true; `'true'`, `'yes'`, `' 1 '`, `'01'` → all false.
- Service decision === provider decision for every value above, asserted directly.
- No request leaves the process in any OFF case, asserted with a recorder.

### Blast radius

`service.js:2721` (one line), `provider/openrouter.js:122-124`.

---

## Cross-cutting contract amendments

| # | Target | Change | State |
|---|---|---|---|
| A1 | `provenance.js:28` | `SOURCES` gains `'HUMAN_EDIT'` (Q4) | Ratified design, unimplemented |
| A2 | `provenance.js:31-35` | `STATUSES` gains `'review_required'` (Q1), `'edited'` (Q4) | Ratified design, unimplemented |
| A3 | `provenance.js:70-75` | add `LIVE_LLM+review_required (LIVE)`, `MOCK+review_required (OFFLINE_TEST)`, `HUMAN_EDIT+edited (any)` | Ratified design, unimplemented |
| A4 | Evidence Contract (Owner-held) | `LIVE_LLM` = origin; acceptance carried by `status` | **PENDING DOCUMENT AMENDMENT — not edited** |
| A5 | `provenance.js:TRACE_FIELDS` | unchanged — per-version provenance lives on the history entry | No change |

Until A1–A3 exist, the matrix guard throws on the new combinations. That is the correct failure mode and must not be relaxed.

---

## Implementation constraints — consolidated (still NOT authorized)

All Q1–Q7 decisions are ratified **at their stated levels**. None is implemented. None is verified. Implementation remains unauthorized pending a separately approved Implementation Scope.

1. `source`, `status`, and `reviewRequired` each have a single writer; none may be supplied by a caller.
2. A hard validation failure outranks review.
3. `review_required` blocks `FINALIZED` but not save, edit, preview, or review submission.
4. An approval is bound to the content it reviewed; a later edit invalidates it.
5. Unmatched price amounts fail as `ambiguous_price_role`; value-only matching is retired.
6. Cue additions require a justified phrasing **and** an ambiguous case that must still fail.
7. Each script version carries its own provenance; `HUMAN_EDIT` never inherits an AI origin.
8. Overlay edits regenerate `lines` without bumping `script_version`; voiceover and scene changes still bump.
9. The provider is the single source of truth for the interlock, and only exact `'1'` is ON.
10. Export filename and Content Library overwrite policy are **not** covered by these decisions.
11. No weakening of the provenance matrix guard, the interlock, or the `fetchImpl` seam.

---

## Sequencing for round 2 (proposal — nothing here is started)

1. **D-2** — validator truth first; a state machine over a wrong verdict is worse than none.
2. **D-1 + D-1b** — needs A1–A3, and a choose-or-replace decision on the *unratified* proposed review record.
3. **D-3**, then **D-4** — provenance per version coheres only once the script stops drifting.
4. **D-6** — includes the trim discrepancy fix; touches the interlock surface, so land it alone.
5. **D-5** — separate track, separate evidence.

No task above is complete, started, or authorized.

---

## What would make a future Gate 3 PASS legitimate

1. Zero known false negatives in the accepted matrix; every FN case exists as a test that rejects.
2. Every known false positive fixed or explicitly accepted by the Owner in writing. P1 must be fixed; **P7b is still undecided and would fail this criterion**.
3. No silent qualitative pass; superlatives produce a non-`success` state visible in trace and response.
4. `review_required` demonstrably blocks `FINALIZED`; approval bound to reviewed content.
5. Provenance survives an edit cycle with per-version origins (Q4).
6. Script representation matches the storyboard after every accepted edit type (Q5).
7. Interlock proven identical across all six Q6 values.
8. Adversarial probes published alongside the suites.
9. No dead security-adjacent exports.

**The Owner alone decides whether evidence meets this bar (Q7).** Agents report; they do not certify.

---

## What this document does not authorize

- No source, test, fixture, or configuration change; no dependency change.
- No edit to the Evidence Contract, the provenance implementation, or the QA module.
- No test execution that could mutate project data.
- No staging, commit, push, merge, or deployment.
- No change to the safety interlock in this task.
- **No implementation of Q1–Q7.**
- **No Gate 4 activity, and no Live Provider call.** Gate 4 remains NOT AUTHORIZED.

---

## Governance conclusions (verbatim, unchanged)

**Gate 3 Overall: NOT ACCEPTED**
**Gate 4: NOT AUTHORIZED**
**Implementation: NOT AUTHORIZED**
**Owner is the sole Gate 3 PASS authority.**

Q1–Q7 ratification is **not** Gate 3 acceptance.

---

## Verification of revision 0.4

Checked in this task:

1. Q1–Q7 recorded with the correct options (D-1, D-1b, D-2, 3A, 4A, 6B strict, Q7 governance).
2. Q2a/Q2b remain `OPEN DESIGN QUESTIONS` with the note that they do not invalidate Q2.
3. `project.review` + `script_checksum` remains explicitly `PROPOSED IMPLEMENTATION DESIGN — NOT RATIFIED`, and D-1b's tests are split accordingly.
4. A3 remains a pending document amendment; the Evidence Contract file was not read for editing and not modified.
5. Q3 `Reject unmatched` and the cue-discipline constraints remain intact, including the prohibition on widening cues to stop rejections.
6. Q4 records Option 3A with the six fields, `HUMAN_EDIT`/`edited`, `derived_from_trace`, and the no-inheritance rule.
7. Q5 records Option 4A with all seven requirements and the explicit exclusion of export-filename/library policy.
8. Q6 records Option 6B with the six-value table **and** the verified trim discrepancy.
9. Q7 records Owner-only PASS authority and the nine-item Evidence Bundle.
10. No statement implies Gate 3 has been accepted.
11. Gate 4 remains NOT AUTHORIZED.
12. Implementation remains NOT AUTHORIZED.

**Commands actually run in this task:** `git rev-parse`, `git branch --show-current`, `git status --porcelain`, `git diff --stat`, `grep`/`sed` over the document and source for line references, and one inline `node -e` probe of `provider.isLiveEnabled` across the six Q6 values. No test suite was executed. No provider was contacted. No `.env` was read.

---

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-01 | Initial proposal: D-1…D-6, amendments, Q1–Q7 |
| 0.2 | 2026-11-01 | Q1–Q3 recorded; added `ambiguous_price_role`, cue-coverage mitigation; flagged P7b; Q4–Q7 open |
| 0.3 | 2026-11-01 | Owner review corrections: `project.review` re-labelled unratified; Q2a/Q2b re-labelled open design questions with scope note; D-2 cue rule tightened against rubber-stamping |
| 0.4 | 2026-11-01 | Q4–Q7 recorded as ratified (3A, 4A, 6B strict, Q7 governance + Evidence Bundle). Register updated; Q4–Q7 removed from open decisions. Added the verified Q6 trim discrepancy (**not fixed**). Preserved all 0.3 clarifications. Documentation-only: no code, test, config, or contract change |

---

## สรุปการอัปเดตรอบนี้ (0.4)

บันทึกมติ Q4–Q7 ครบแล้ว โดยยังไม่มีการแก้โค้ดหรือรันชุดทดสอบใด ๆ

- **Q4 / D-3** — Option 3A: ทุก version มี provenance ของตัวเอง, `HUMAN_EDIT` + `edited`, `derived_from_trace` เมื่อมีต้นทาง และห้ามสืบทอด provenance ของ version ก่อน
- **Q5 / D-4** — Option 4A: overlay edit สร้าง `script.lines` ใหม่จาก storyboard โดยไม่เพิ่ม `script_version` และไม่แตะ `text`/`checksum` ส่วน export filename และ Content Library อยู่นอกขอบเขตมตินี้
- **Q6 / D-6** — Option 6B strict: provider เป็นแหล่งตัดสินเดียว, เฉพาะ `'1'` เท่านั้นที่เปิด
- **Q7** — Owner เป็นผู้เดียวที่ประกาศ Gate 3 PASS และกำหนด Evidence Bundle 9 ข้อ

**สิ่งที่ตรวจพบเพิ่มและยังไม่แก้:** โค้ดปัจจุบันไม่ตรงกับมติ Q6 — provider ตัด `trim()` ทำให้ `' 1 '` กลายเป็น ON ขณะที่ service มองเป็น OFF (ยืนยันด้วยการรัน probe จริง) ดังนั้นสองเงื่อนไขที่ ratify ไว้คือ `' 1 '` ต้องเป็น OFF และ service/provider ต้องตรงกัน ยังไม่เป็นจริง ต้องแก้โดยลบ `trim()` ออกจาก provider ไม่ใช่เติม `trim()` ที่ service

ยังค้าง: P7b (false positive ที่ไม่มีมติ), Q2a/Q2b (design questions), A4 (ถ้อยคำ Evidence Contract), D-5 (ticket ที่ยังไม่ถูกเปิด)

สถานะ: **Gate 3 Overall = NOT ACCEPTED**, **Gate 4 = NOT AUTHORIZED**, **Implementation = NOT AUTHORIZED**, Owner เท่านั้นที่ลงนาม PASS ได้
