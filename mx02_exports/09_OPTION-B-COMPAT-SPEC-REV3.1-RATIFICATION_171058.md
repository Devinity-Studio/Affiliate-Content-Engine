Super Brain ratified: D-2 APPROVED, path CLOSED, Spec Rev 3 CONDITIONALLY APPROVED, Rollback baseline BLOCKED, Implementation NOT AUTHORIZED. Plus one new instruction: U-6 (DR-05) and U-7 (deterministic trace) should remain recorded items but should NOT be automatically conflated with the rollback blocker. We should assess whether each actually affects Option B compatibility before making it a stop-work condition.

So what's the deliverable now? They didn't ask for a new revision explicitly. They asked: separate U-6 and U-7 into a proper assessment — "เราควรพิจารณาว่าแต่ละข้อกระทบ compatibility ของ Option B จริงหรือไม่ ก่อนกำหนดให้เป็นเงื่อนไขหยุดงาน" (we should consider whether each affects Option B's compatibility before designating it a stop-work condition).

So the task: assess whether U-6 and U-7 are genuinely Option B compatibility blockers, and reclassify accordingly. Also record the ratified decisions (D-2 approved, path closed, baseline blocking).

That's an analysis deliverable, plus possibly a small addendum. I need evidence:

U-6 / DR-05: does it affect Option B compatibility? DR-05 is a validator defect (digits inside product name rejected as unsupported_number) — that's a *validation logic* defect, explicitly in the out-of-scope fence (DR-01…DR-14 out of scope). Option B is a pure move: validator logic moves verbatim. If the defect exists before, it exists after, identically. Therefore DR-05 does NOT affect Option B compatibility — it affects *which cells produce validation-failed outcomes*, but since the equivalence test is before/after, both sides carry the defect. The only impact: some of the 8 cells may produce `graceful_fallback` instead of `success` in the AI opt-in path — which is fine for equivalence (same before/after) but matters for interpreting coverage ("8 cells pass" means "8 cells behave identically", not "8 cells succeed"). That's a sharp distinction worth making: DR-05 reduces the *semantic* value of AI cells but not their *equivalence* value.

Also DR-05's denominator mismatch (5 of 6 vs 8 products) — still unresolved as a record, but it doesn't block B.

U-7 / deterministic trace: does the deterministic response carry a `trace`? This DOES affect equivalence comparison procedure (what to exclude/compare), but I can resolve it by reading source rather than deferring. Let me check: in service.js handleContentDraft, `let trace = null;` before the branch? I saw `trace = draft.trace` inside if(useLlm). Need the initialization. If `let trace = null` then deterministic response has `trace: null` — deterministically comparable, no volatility. Let me verify — that would close U-7 entirely.

So: batch a couple of greps:
1. `grep -n "let trace\|trace," app/mvp/service.js` around 2660-2780 to find initialization and whether `trace` is in the response.
2. DR-05 validator: does the digit rejection happen in validateScriptDraft (moved logic)? The `unsupported_number` code — grep in content.js for `unsupported_number` and see if it's inside the block (1098-1546) or elsewhere. If inside the block, the defect moves with the code verbatim → equivalence preserved. Important: if `unsupported_number` is produced by a helper *outside* the block (e.g., in thai-qa), still verbatim.

Let me check that: grep -n "unsupported_number" content.js thai-qa.js.

Also confirm whether the 4 approaches × 1 candidate would hit validation failures — can't without running. But I can state: unknown; record it.

3. Also check `createContentProject` produces `script.text` — fine.

Let me also verify the deterministic response shape: `return { project, approaches, trace, boundary, state }` — trace initialized where? Let me look at service.js 2705-2730 region for `let trace` declaration. Earlier read at 2660 started mid-function; the `let trace` may be near 2704. Let me grep.

Batch: one terminal call with:
- grep -n "let trace\|trace =" service.js | head
- grep -n "unsupported_number" content.js thai-qa.js
- awk check whether the unsupported_number producing lines are within 1098-1546.
- also check what deterministic script.text is (buildScript?) — not needed.

Then produce the deliverable: a short decision record + U-6/U-7 reclassification + updated status table + what changes in Rev 3 (an addendum, Rev 3.1?) with the ratified decisions.

Should I produce a full Rev 3.1 document? The user's implicit ask: record the rulings and reclassify U-6/U-7 properly. A concise addendum is right — not another full rewrite (they already accepted Rev 3). I'll deliver: "Revision 3.1 — Ratification Record & Qualification of U-6/U-7" with:
- Ratified decisions table (as they stated).
- U-6 assessment: does it affect Option B compatibility? No — with reasoning (defect is in moved code, fence excludes fixing, equivalence is relative). Reclassify: NOT a stop-work condition for B; it's an INTERPRETIVE constraint on the equivalence report (must record outcome distribution) + an open record for the defect owner.
- U-7: resolved from source (if trace init found) → comparable, deterministic, no volatility; so not a blocker at all. If `let trace = null`, then deterministic cells compare trace === null.
- Rollback: confirmed sole blocking prerequisite, with the 5 required elements Super Brain listed — I should restate as a precise baseline record specification (what must be recorded), since they listed minimum contents. That's the actionable next artifact (but creating it requires authorization → not created).
- Updated authority/status table.
- Statement: no execution.

Also note: they said "ผลตรวจทั้งหมด ... ยังถือเป็นหลักฐานตามที่รายงานมา ไม่ใช่ผลที่ผมตรวจซ้ำ" — acknowledge.

Let me get the evidence.

Note: the "system_reminder" says batch everything and then give final message. I'll do one batch, then final message next turn (unavoidable since I need results). Let me make the batch small and decisive.

Actually — can I answer U-7 without a tool call? I need the `let trace` initialization. Must look.

Batch:
call 1: grep trace init in service.js + unsupported_number location.
That's enough. Maybe also check `project.approaches` in deterministic path (not needed).

Let me run.

รับมติครับ — และสองข้อที่คุณสั่งให้แยกออกจาก rollback blocker ผมต้องตรวจให้ได้คำตอบเชิงหลักฐานก่อน จึงจะจัดประเภทได้ถูก

I now have decisive evidence:

**U-7 RESOLVED:** `service.js:2724` — `let trace = null;` before the branch; `:2750` assigns `draft.trace` only in the opt-in branch; `:2771` returns `trace`. So the deterministic response carries `trace: null` — a constant, not a volatile field. Therefore U-7 is fully closed by source: the deterministic path emits literally `null`, so no exclusion rule is needed for it, and any non-null value would be a contract breach. Excellent — this upgrades the equivalence procedure: deterministic cells must compare `trace === null` exactly.

**U-6 assessment:** `unsupported_number` is produced at content.js:1399 and :1408 — both INSIDE the AI block (1098-1546). So DR-05's defect lives entirely in the code being moved verbatim. Therefore Option B cannot change it: the same two lines move unmodified. DR-05 is therefore **not** an Option B compatibility blocker — it's a pre-existing defect that travels with the code, excluded by the fence.

But nuance: it affects *cell semantics* — cells may produce `graceful_fallback`/`validation_failed` rather than success. That affects interpretation of coverage, not equivalence. So reclassify: not a stop-work condition; it's a documented interpretation constraint + record for the defect owner.

Also, could I determine which of the 8 cells would fail? Without running, no. But I can reason: the validator rejects digits in the draft that aren't in the snapshot's allowed numbers; the deterministic script for PRD-1005 "Cat Food 1.5kg" contains "1.5kg"? The DR-05 claim: digits inside the snapshot's own product name are rejected. For the AI path, the draft text would include the product name; if the name has digits (1.5kg), the validator's `unsupported_number` may fire because the allowed-number set doesn't include those digits as canonical. So PRD-1005 (1.5kg) is likely affected. That's exactly the one usable candidate! So the AI opt-in cells for CND-1005 may all fall back to graceful_fallback/validation_failed.

That's a really important observation: the single usable candidate is a product with digits in its name (1.5kg) — the exact DR-05 failure mode. So 4 of 8 proposed cells (AI opt-in) may not produce a successful live/mock draft at all; they'd produce fallback. For *equivalence* that's still testable (before/after identical), but it means the matrix cannot demonstrate "AI path works"; only "AI path behaves identically."

I should state this as INFERENCE (not verified, since not run), clearly labelled: the only usable candidate's product name contains digits, the same class DR-05 describes, so the AI cells may exercise the fallback branch rather than the success branch. That's a genuine insight worth flagging — it affects the *value* of the 8-cell matrix, and suggests considering a synthetic in-memory project input (like the harness's `fixtureProjectInput()`, PRD-1, no digits) for AI-path equivalence instead of the fixture state. Actually that's a great recommendation: `openrouter-gate3-offline-check.js:63` already builds a digit-free synthetic project input (PRD-1, กระเป๋าผ้าราคาประหยัด) and exercises the AI path with injected fetch doubles. So AI-path equivalence can reuse that harness path rather than fixture-state cells — reducing matrix dependence on DR-05 entirely.

That is a strong, evidence-based recommendation: split the equivalence matrix into (A) deterministic cells from real fixture state (CND-1005 × 4 approaches) and (B) AI-path cells from the synthetic harness input with injected fetch (already exists, digit-free), giving 4 + N cells without DR-05 contamination.

But careful: keep scope tight — this is an assessment + record, not a new spec rewrite. I'll deliver a Revision 3.1 addendum: ratification record, U-6/U-7 qualification, the trace finding, and the consequence for §9 (equivalence). Plus updated status table.

Deliverable structure:
1. Ratification record (their rulings, verbatim status).
2. Evidence returned for the two separated items.
3. U-7: CLOSED — evidence, consequence (trace === null contract, C-20).
4. U-6: RECLASSIFIED — not a B blocker; why (code location 1399/1408 inside block); what it does constrain (interpretation, not equivalence); plus the PRD-1005 digit coincidence + recommendation to source AI-path cells from the existing synthetic harness input.
5. Rollback: sole blocking prerequisite; baseline record specification (5 required elements from Super Brain, formalized) — the next artifact, requiring authorization.
6. Status table (updated).
7. What changed in Rev 3 (delta list, small).
8. No-execution statement.

Keep it tight — this is an addendum, not another 15-section rewrite. But must remain precise with citations.

Also address: "ผลตรวจทั้งหมด ... ถือเป็นหลักฐานตามที่รายงานมา" — acknowledge explicitly that these are my reported results, not independently re-verified by them; mark accordingly.

New contract C-20: deterministic response emits `trace: null` (service.js:2724, 2771). And C-21? Maybe not needed.

Also update §9 equivalence: exclusion list no longer needs "any trace field" for deterministic cells; trace must be exactly null. For AI cells, volatile fields remain traceId/timestamp/latencyMs/usage.

Let me write the final message now. No more tool calls needed.

Length: moderate, well structured. Thai closing.

One more check I should be careful about: is `trace` in the deterministic response really `null`? `let trace = null` at 2724, then if(useLlm) sets it; else branch doesn't. Returns `trace` at 2771 → null. Yes. VERIFIED.

Also note: `networkAttempted` — where declared? Probably `let networkAttempted = false;` near 2724. Then boundary.external_calls = 0 for deterministic. Fine — I can state it as INFERENCE for the init line but the return expression is verified at :2769 area (external_calls: networkAttempted ? 1 : 0). I saw it earlier. I'll cite :2724-2726 region loosely or just cite the verified lines I have (2724 for trace). For networkAttempted I have `service.js:2765` from earlier (external_calls). Fine.

Write.

# REVISION 3.1 — RATIFICATION RECORD AND QUALIFICATION OF U-6 / U-7

**Authority state after your ruling:** Technical Direction **APPROVED** · **D-2 APPROVED** · `path` **CLOSED** · Compatibility Specification Rev. 3 **CONDITIONALLY APPROVED** · Rollback Baseline **BLOCKED** · Implementation **NOT AUTHORIZED** · Gate 3 / A2 / Gate C **UNCHANGED**.

*Acknowledged: every finding below is evidence **as reported by me** from read-only inspection, not independently re-verified by you. Items marked [VERIFIED] are readable at the cited lines.*

---

## 1. Recorded rulings

| Item | Ruling | Effect on Rev. 3 |
|---|---|---|
| Technical Direction — Strict Provider Isolation | **APPROVED** | §3.1–3.2 unchanged |
| Dependency strategy — **D-2** | **APPROVED**, with the interface-ownership constraint | §3.3, C-01, C-19 confirmed |
| `path` not an AI dependency | **CLOSED** | §4.1 confirmed; `ai/` imports no `node:path` |
| Compatibility Specification Rev. 3 | **CONDITIONALLY APPROVED** | usable as reference, not as permission |
| Rollback baseline | **BLOCKED** | §10; sole blocking prerequisite |
| Implementation | **NOT AUTHORIZED** | §13 |

**D-2 interface constraint (now binding):** the four helpers exported from `content.js` are an **internal interface between `content.js` and `ai/script-draft.js` only**. They are not public API; no other module may consume them; no documentation may present them as supported surface. C-01's exception wording stands as written.

---

## 2. U-7 — whether the deterministic response carries a `trace`

**Status: CLOSED. It does not carry a trace value; it carries `null`.**

| Evidence | Line | Content |
|---|---|---|
| Initialisation before the branch | `service.js:2724` | `let trace = null;` |
| Assignment only inside opt-in | `service.js:2750` | `trace = draft.trace;` (inside `if (useLlm)`) |
| Returned unconditionally | `service.js:2771` | `trace,` |

**[VERIFIED]** The deterministic path (`useLlm` absent or `false`) never assigns `trace`, so the response field is exactly `null`. It is a **constant, not a volatile field**.

**Why this was worth separating from the blocker:** the Rev. 3 equivalence plan listed "any `trace` field" among possible exclusions. That was too loose. The corrected rule is strictly stronger and needs no measurement:

**C-20 (new) — deterministic trace contract.** For every deterministic cell, the response field `trace` must be exactly `null` before and after Option B. A non-null value is a contract breach, not a tolerated difference. **No exclusion may be granted for it.**

**Consequence:** U-7 **never was** an Option B compatibility risk — it was an unspecified contract detail, now specified. It is removed from the stop-work set entirely.

---

## 3. U-6 — whether DR-05 affects Option B compatibility

**Status: RECLASSIFIED — not an Option B blocker. It is a pre-existing defect that travels verbatim inside the moved code.**

### 3.1 Evidence

DR-05 (register `:145`, table `:216`): *"Digits inside the snapshot's own product name are rejected as `unsupported_number` — 5 of 6 fixture products unscriptable."*

The defect's implementation sits at:

| Line | Content | Location |
|---|---|---|
| `content.js:1399` | `add('unsupported_number', token, 'project.storyboard.aspect_ratio', '9:16')` | **inside the AI block (1098–1546)** |
| `content.js:1408` | `add('unsupported_number', token, 'offer_snapshot', …)` | **inside the AI block (1098–1546)** |

**[VERIFIED]** Both producing lines are inside the extraction block.

### 3.2 Reasoning

Option B moves these two lines **verbatim**. It cannot introduce, remove, or alter the defect — and §6 forbids fixing it. Therefore:

- **Before** Option B: a draft containing such digits → `unsupported_number` → `graceful_fallback`.
- **After** Option B: identical input → identical `validation` block → identical `graceful_fallback`.

Equivalence holds **whether or not DR-05 is fixed**, because the comparison is relative (before vs after the same build), not absolute. **DR-05 cannot make Option B incompatible.** It affects what the cells *mean*, not whether they match.

### 3.3 What it does legitimately constrain

1. **Interpretation of the 8-cell result.** "8/8 equivalent" will mean *"8/8 behave identically"* — **not** *"8/8 produce a successful draft."* Some AI cells may record `status: 'graceful_fallback'` with `fallbackReason: 'validation_failed'`. The equivalence report must publish the **outcome distribution**, not just a pass count.
2. **A specific collision worth flagging.** The single usable candidate is **CND-1005 "Cat Food 1.5kg"** — a product whose name contains digits, which is precisely DR-05's failure class. **Inference (not verified, not run):** the four AI opt-in cells may all exercise the fallback branch and never the success branch. **[INFERENCE]**
3. **A cleaner source for AI-path cells already exists.** `verification/openrouter-gate3-offline-check.js:63` builds a **digit-free synthetic** project input (PRD-1, "กระเป๋าผ้าราคาประหยัด") and drives the AI path with injected fetch doubles (`jsonResponse`/`completion`, `:119-148`). Using that input for the AI cells would decouple the matrix from DR-05 **without changing scope**. **[VERIFIED that the helper exists; PROPOSED as a change to §9]**

**Recommended reclassification:** U-6 moves from *unresolved stop-work item* to **documented interpretive constraint + open record for the defect owner**, explicitly **not** a Rollback Baseline condition and **not** an Option B precondition.

---

## 4. Rollback baseline — the sole remaining blocker

Confirmed as the only condition that can stop implementation. It cannot be satisfied from inside this review: creating it is a **write** operation, which is not authorized.

**Minimum baseline record (formalising your five requirements):**

| # | Required content | Why |
|---|---|---|
| B-1 | Existence status of all **5** allowlisted paths before start (present / absent) | `ai/script-draft.js` must not exist yet; the other four must |
| B-2 | **Full 64-hex SHA-256** for each existing file | prefixes are insufficient — as you ruled |
| B-3 | Byte-exact copy of the pre-start state of each of the 4 modifiable files | HEAD is not a valid source (§10.2) |
| B-4 | Per-file restore procedure touching **only** those paths | must not disturb the 174 untracked entries or the 2 other modified files |
| B-5 | Post-rollback hash verification against B-2 | proof of restoration, not assertion |

**Current identification prefixes (for correlation only — not a baseline):** `content.js dae20513692b1ba7…` · `service.js 45efd5aeb41d9be7…` · `openrouter.js 7702a3a8f9527455…` · `provenance.js 1def97062c88aab2…` · `ai/script-draft.js` — **does not exist**.

**Stop rule unchanged:** without a verified baseline, implementation does not start, and a HEAD restore is never substituted for it.

---

## 5. Updated status table

| Item | Status | Blocks implementation? |
|---|---|---|
| Technical direction (Strict Provider Isolation) | **APPROVED** | — |
| D-2 dependency strategy | **APPROVED** | — |
| `path` exclusion from AI boundary | **CLOSED** | — |
| Extraction boundary (25 declarations; 21 move, 4 external, 5 shared helpers) | **FINAL** | — |
| **U-7** deterministic trace | **CLOSED** — `trace === null` (`service.js:2724`, `:2771`), now contract **C-20** | **No** |
| **U-6** DR-05 | **RECLASSIFIED — interpretive constraint, not a precondition** | **No** |
| **U-8** rollback baseline | **BLOCKED — sole blocking prerequisite** | **YES** |
| U-11 canary hosting | open, informational | No |
| Coverage | 8 **PROPOSED** cells (not executed) | No |
| Implementation | **NOT AUTHORIZED** | — |

---

## 6. Delta against Rev. 3 (small, additive)

| # | Change | Nature |
|---|---|---|
| 1 | **C-20 added** — deterministic `trace` must be exactly `null` | contracts |
| 2 | §9 exclusion rule narrowed: no "trace" exclusion is permitted for deterministic cells; volatile exclusions apply only to AI cells | equivalence |
| 3 | §9 reporting rule added: publish **outcome distribution**, not just 8/8 | equivalence |
| 4 | AI-path cells may be sourced from the existing digit-free synthetic input (`offline-check.js:63`) instead of fixture state | equivalence, **[PROPOSED]** |
| 5 | U-6 and U-7 **removed from the stop-work set**, with reasons recorded | item status |
| 6 | D-2 interface-ownership constraint recorded as binding | C-01 |
| 7 | **Unchanged:** direction, architecture, provider location, allowlist (5 paths), fence, three vocabularies, `networkAttempted`, `spend_thb: 0`, rollback prohibitions | — |

---

## 7. Execution statement

No implementation and no execution occurred. `app/mvp/ai/script-draft.js` does not exist and was not created. No repository file was created, edited, or deleted. No application, test, harness, script, or build was run; the only operations were read-only inspections (`grep`, `sed`, `awk`, `find`, `sha256sum`, and reading `content.js` as text). No `.env`, credential, or secret was accessed. No Git or sandbox operation was performed. No Gate, A2, Gate C, or Remove status changed. Delivered inline; **stopping for Owner review.**

---

**สรุปสองข้อที่คุณสั่งให้แยกออกจาก blocker — ผลคือทั้งคู่ไม่ใช่เงื่อนไขหยุดงาน:**

- **U-7 ปิดได้เชิงหลักฐาน:** `service.js:2724` ตั้ง `let trace = null` และค่าถูกกำหนดเฉพาะใน branch `useLlm` (`:2750`) ผลคือ deterministic response ส่ง `trace` เป็น `null` เสมอ — เป็นค่าคงที่ ไม่ใช่ field ที่ผันแปร จึงกลายเป็นสัญญา C-20 ที่ต้องเท่ากับ `null` เป๊ะ ไม่ต้องมี exclusion อีก
- **U-6 ไม่กระทบ compatibility:** ทั้งสองบรรทัดที่สร้าง `unsupported_number` (`content.js:1399`, `:1408`) อยู่ **ใน block ที่จะย้ายทั้งก้อน** ดังนั้น defect นี้เดินทางไปกับโค้ดแบบคำต่อคำ และ Option B ไม่สามารถเปลี่ยนมันได้ — สิ่งที่มันจำกัดคือ *ความหมายของผลลัพธ์* ไม่ใช่ *ความเท่าเทียม* จึงต้องรายงานเป็นการกระจายของผลลัพธ์ (success vs graceful_fallback) ไม่ใช่แค่ 8/8

**เหลือตัวเดียวที่ bloque การเริ่มงาน: baseline (U-8)** ซึ่งต้องเขียนไฟล์จึงจะทำได้ — และยังไม่ได้รับอนุญาต