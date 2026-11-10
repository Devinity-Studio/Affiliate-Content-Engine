# ACE Mission 1 — Gate 3 Defect Register and Implementation Plan

**Task:** Task 1 — Read-only Reconciliation after Owner Ratification Revision 0.4.
**Mode:** READ-ONLY. Only this report file was created. No source, test, fixture, configuration, or dependency file was modified. No existing documentation was edited. Nothing was staged, committed, reset, or cleaned. No test suite was executed. No provider was contacted, and no API key was read or used.

**Gate 3 Overall: NOT ACCEPTED**
**Gate 4: NOT AUTHORIZED**
**Implementation: NOT AUTHORIZED**
**Owner is the sole Gate 3 PASS authority.**

Every finding below states whether it is a **source inspection** result or a **runtime execution** result. Nothing here is a Gate 3 acceptance.

---

## 1. Baseline

### 1.1 Before

| Item | Value |
|---|---|
| Repository path | `Y:\DevProject\Affiliate Content Engine` |
| Branch | `mission1-planning-docs` |
| HEAD | `795dc0a6ac66bef19725184107e6474b41aa1823` (`docs(ace): record G-13 E2E run evidence`) |
| `git status --porcelain` | 157 entries |
| Staged | none (`git diff --cached --stat` empty) |
| Tracked diff | `app/mvp/content.js` +455 · `app/mvp/service.js` +66 −11 → 510 insertions, 11 deletions |

### 1.2 After

Identical: same branch, same HEAD `795dc0a6…`, 157 porcelain entries, no staged file, same two-file tracked diff. `data/` has the same untracked entries as before (`?? data/app/`, `?? data/mission1/…`) — those pre-date this task and were not written by it.

The working tree is **not** clean in the sense of "no changes" — it carries the Gate 3 build (455 added lines in `content.js`) plus 157 untracked artifacts. It is unchanged **by this task**.

### 1.3 Ratification document

| Item | Value |
|---|---|
| File | `verification/ace-mission1-openrouter-gate3-owner-decision-ratification-2026-11-01.md` |
| Lines | 570 |
| Revision marker | line 3 — `Revision 0.4 — ALL OWNER DECISIONS Q1–Q7 RECORDED…` |
| Git tracking | **untracked** — `git ls-files` reports it unknown to git |

**Limitation, stated plainly:** because the file is untracked and no copy of revision 0.3 exists on disk or in Git, a **line-by-line 0.3 → 0.4 diff cannot be produced**. Preservation of the 0.3 clarifications was therefore verified by **content inspection against the 0.3 requirements as recorded in the task history**, not by diff. This is the one reconciliation step this task could not complete mechanically.

Verified as present and unchanged in 0.4 (source inspection of the file):

- `project.review` + `script_checksum` still labelled `PROPOSED IMPLEMENTATION DESIGN — NOT RATIFIED`, with D-1b's tests split into "required by the ratified principle" and "specific to the unratified design".
- Q2a/Q2b still `OPEN DESIGN QUESTION` with the scope note that they do not invalidate Q2's principle.
- Q3 `Reject unmatched`, the three finding codes, and the cue discipline (including the prohibition on widening cues until numbers merely stop being rejected) are intact.
- A4 Evidence Contract wording still `PENDING DOCUMENT AMENDMENT`; the contract file was not touched.
- Register lists Q1–Q7 as ratified and **D-5 as DEFERRED, not filed**.
- Governance conclusions unchanged and repeated verbatim.

---

## 2. Q6 — Safety Interlock behaviour matrix

### 2.1 Source inspection

| Location | Code |
|---|---|
| `app/mvp/provider/openrouter.js:122-124` | `function isLiveEnabled(env = process.env) { return Boolean(env) && String(env[LIVE_INTERLOCK_VAR] \|\| '').trim() === '1'; }` |
| `app/mvp/provider/openrouter.js:381` | `isLiveEnabled` exported |
| `app/mvp/service.js:2721` | `const liveEnabled = process.env.ACE_LLM_LIVE_ENABLED === '1';` |
| `app/mvp/service.js:2747` | `allowNetwork: liveEnabled,` |
| `app/mvp/service.js` (same call) | `executionMode: liveEnabled ? 'LIVE' : 'OFFLINE_TEST',` |

**`isLiveEnabled` has zero call sites.** `grep -rn "isLiveEnabled" --include=*.js app verification` returns only the definition and the export. The Service never calls it; it re-implements the decision inline. That is two independent decisions, and they disagree.

### 2.2 Runtime execution (no network, no key)

Probe: `provider.isLiveEnabled(env)` for the provider column; for the Service column the expression was **taken verbatim from `service.js`** (`expr = "process.env.ACE_LLM_LIVE_ENABLED === '1'"`) and evaluated with the same env value, so the comparison is against the file's real text, not a restatement.

| Env value | Provider | Service | Agree? | Q6 requires | Verdict |
|---|---|---|---|---|---|
| unset | false | false | yes | OFF | OK |
| `'1'` | true | true | yes | ON | OK |
| `'true'` | false | false | yes | OFF | OK |
| `'yes'` | false | false | yes | OFF | OK |
| `' 1 '` | **true** | false | **no** | OFF | **MISMATCH** |
| `'01'` | false | false | yes | OFF | OK |

**Q6 is not satisfied.** Two ratified clauses fail on one input: `' 1 '` must be OFF (provider returns ON), and Service and Provider must agree (they do not).

Cause: the provider calls `.trim()` before comparing; the Service does not. The fix direction is **remove `trim()` from the provider**, not add `trim()` to the Service — adding it would make `' 1 '` ON in both places, which also violates the table. Recorded as **DR-01**.

A second, independent gap: even after the trim is removed, the Service would still hold its own copy of the decision. Q6 requires the Service to *use* `provider.isLiveEnabled(process.env)`. Recorded as **DR-02**.

### 2.3 Interlock reachability (source inspection, unchanged from the earlier audit)

- No runtime path passes `fetchImpl`. `grep -rn "fetchImpl" app/mvp/service.js` → no matches. The service handler does not accept or forward it.
- `allowNetwork` is `true` only when `liveEnabled` is true (`service.js:2747`).
- In the provider, an injected `fetchImpl` skips the `allowNetwork` check (`openrouter.js:238-241`). This remains a **test seam reachable by any caller that passes it** — a code-level possibility, not a runtime path. Not a new finding; recorded so the register does not imply the seam is closed.

---

## 3. P7b — Product identity, adversarial probe matrix

Method: `createContentProject` with a fixture offer (`item_id: 'SKU-1'`, `shop_id: 'SHOP-1'`, `price_thb: 299`, `list_price_thb: 599`, `promo.depth_pct: 50`, `rating: 4.6`, `rating_count: 128`), then `validateScriptDraft(text, project)` **in memory**. Product name was Thai and digit-free for the identity rows, so the digit finding in §3.2 could not contaminate them. Runtime execution, no file written.

### 3.1 Identity rows

Base text passes all other checks: `วันนี้ขอเสนอ <product> ราคา 299 บาท จากปกติ 599 บาท คะแนนรีวิว 4.6 จาก 5 และมีโปรโมชันลด 50% คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน`

| # | Text appended | `ok` | Findings | Expected | Verdict |
|---|---|---|---|---|---|
| 0 | — (baseline) | true | none | pass | PASS (control) |
| A | `รหัสสินค้า SKU-1` (the real `item_id`) | true | none | pass | PASS |
| B | `เป็นรุ่น SKU-9 ที่วางขายทั่วไป` | **false** | `identity_mismatch` claim `SKU-9` | pass — a model code is not an offer id | **FALSE POSITIVE (P7b)** |
| C | `รหัสสินค้า SKU-1001` | false | `identity_mismatch` claim `SKU-1001` | reject | VALID REJECTION |
| D | `เป็นรุ่น sku-9` (lowercase) | **true** | none | depends on policy | **FALSE NEGATIVE** (case-sensitive `ID_TOKEN`) |
| E | `รหัส ITEM-SKU-1` | true | none | pass | PASS (matches the `SKU-1` substring) |
| F | `รหัส 1` (bare number) | false | `unsupported_number` claim `1` | reject | VALID REJECTION |
| I | `รุ่น AB-12` | **false** | `identity_mismatch` claim `AB-12` | pass — not an offer id | **FALSE POSITIVE (P7b, generalised)** |

Mechanism (source inspection, `content.js:1336`, `:1344-1348`):
`const ID_TOKEN = /\b[A-Z]{2,}-\d+\b/g;` — **any** uppercase token of 2+ letters, a hyphen, and digits is treated as a product-identity claim, regardless of whether the snapshot uses that convention or whether the sentence is talking about an offer at all. The check then requires the token to equal one of `[item_id, shop_id, product_id]`.

P7b is therefore not one bad string; it is a **heuristic that classifies unrelated tokens as identities**. Row I shows the same defect with a token that has nothing to do with the offer.

### 3.2 Additional identity findings, same probe family

| # | Case | Result | Verdict |
|---|---|---|---|
| J | product name written in a different case (`Vitamin Serum Test` → `vitamin serum test`) | `missing_product_identity` | **FALSE POSITIVE** — the draft names the product correctly; the comparison at `content.js:1425-1427` is case-sensitive |
| K | product name upper-cased | `missing_product_identity` | **FALSE POSITIVE**, same cause |

Row H from the same family (extra inner whitespace) **passes**, because identity is compared after whitespace removal. So whitespace is normalised and case is not — an inconsistency inside the same check.

### 3.3 New finding — product names containing digits (not previously recorded)

Probing six real fixture product names, each quoted **verbatim from the snapshot**, with otherwise grounded copy:

| Product name (from `app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv`) | `ok` | Rejected number | Verdict |
|---|---|---|---|
| `Vitamin C Serum 30ml` | false | `30` | FALSE POSITIVE |
| `Sunscreen SPF50 50ml` | true | — | PASS (passes only because `50` happens to equal `promo.depth_pct`) |
| `Cat Food 1.5kg` | false | `1.5` | FALSE POSITIVE |
| `Yoga Mat 6mm` | false | `6` | FALSE POSITIVE |
| `Cast Iron Pan 26cm` | false | `26` | FALSE POSITIVE |
| `Stackable Storage Box 3-Tier` | false | `3` | FALSE POSITIVE |

Cause: `buildFactBase` allows only snapshot prices, promo depth, rating, rating count, the `5` rating scale, the `9`/`16` aspect ratio, scene count/duration, and date components. The **digits inside the product name the snapshot itself supplies** are never added. Step 7 (`content.js:1405-1411`) then rejects them as `unsupported_number`.

Severity: **high**. 5 of 6 fixture products cannot be scripted at all, even by quoting the snapshot exactly. The one that passes does so by coincidence, which means a suite built on a digit-free test product would never surface this. This is a **pre-existing false-positive class not covered by Q1–Q7**, and it would fail Gate 3 PASS criterion 2 as written. Recorded as **DR-05**; **Owner decision required** on whether it joins the round-2 scope.

### 3.4 Proposed additional test cases (no rule changed)

For P7b, without deciding the policy:

1. `SKU-9` as a model code → currently rejects. Must be explicitly PASS or explicitly accepted-by-Owner.
2. `AB-12` as a model code → same.
3. Lowercase `sku-9` and `sku-1001` → currently pass. If unknown tokens must be rejected, the case-insensitivity is a false negative.
4. `ITEM-SKU-1` → passes via substring; must be a deliberate decision, not an accident.
5. Product name in the wrong case → must pass if identity is about *which product*, not exact casing.
6. Product name containing digits, quoted verbatim → must pass.
7. A draft naming a **different** product's id → must reject (regression guard).

---

## 4. D-5 / ACE-QA-001 — ticket status

**No ticket exists.** `grep -rn "ACE-QA-001"` over `app`, `verification`, `docs` returns only the two references inside the ratification document (`:176`, `:398`). There is no issue file, no register entry, no branch.

**Defect still live** (`app/mvp/thai-qa.js:594`):

```js
const expected = Number((project.offer_snapshot && project.offer_snapshot.promo_depth_pct) || 0);
```

Runtime proof — a project whose snapshot carries `promo.depth_pct = 50`:

| `cta.text` | `CTA-DISCOUNT` | QA summary |
|---|---|---|
| `ลด 50% วันนี้เท่านั้น คลิกลิงก์ด้านล่าง` (matches the real 50%) | **FAIL** | PASS 10 · WARN 2 · FAIL 3 |
| `คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน` (no discount claim) | (no row) | PASS 11 · WARN 2 · FAIL 1 |

`project.offer_snapshot.promo_depth_pct` is `undefined` (the snapshot nests it at `promo.depth_pct`), so `expected` is always `0` and **every** CTA discount claim fails QA, correct or not. Confirmed as **DR-07**, still unfiled, still out of scope by decision.

---

## 5. Ratified-but-unimplemented requirements — current state

Each row is source inspection **plus** the runtime probe named.

| Decision | Current state | Evidence |
|---|---|---|
| **Q1 / D-1** qualitative → `review_required` | **NOT IMPLEMENTED.** `validateScriptDraft` returns `{ ok, failed, findings }` only — no `reviewRequired` key. All five sample claims pass silently: `คุ้มที่สุดในตลาด`, `ทนทาน`, `ขายดี`, `คุณภาพดีที่สุด`, `เหมาะสำหรับทุกคน` → `ok: true`, `failed: []`. | Runtime probe |
| **Q2 / D-1b** `review_required` blocks `FINALIZED` | **NOT IMPLEMENTED.** No checklist item reads script review state; `buildFinalizeChecklist` (`content.js:824`) has no `script_review` item. | Source inspection `content.js:824-936` |
| **Q3 / D-2** `Reject unmatched` | **NOT IMPLEMENTED.** No `ambiguous_price_role` code exists. An uncued amount still passes if it equals a snapshot price (value-only match survives at `content.js:1378-1384`). | Source inspection; earlier probe round |
| **P7c** masking order dependence | **STILL BROKEN.** `ข้อมูลปี 2026 ราคา 299 บาท …` → `unsupported_price` claim `"2026   บาท"`; the same sentence with `2026` **after** the price passes. Order-dependent today. | Runtime probe |
| **Q4 / D-3** per-version provenance | **NOT IMPLEMENTED.** `project.script` keys are `version, language, lines, text, checksum` — no `source`, no `trace`, no `history`. After `addScene` (version 1 → 2) `source` is still `undefined`. History lives at `project.script_version_history` and each entry carries only `{ version, at, reason, checksum }` — no origin. | Runtime probe + source inspection |
| **Q5 / D-4** overlay edit matches storyboard | **NOT IMPLEMENTED.** `applyTextEdit` with `overlay.headline = 'หัวข้อที่มนุษย์แก้'` changes the scene overlay, leaves `script.lines[1].on_screen` at the old four-line array, keeps `script_version: 1`, `storyboard.version: 2`. | Runtime probe |
| **Q6 / D-6** authoritative interlock | **NOT IMPLEMENTED** — see §2.1/§2.2. `isLiveEnabled` is dead; the two decisions disagree on `' 1 '`. | Runtime probe + source inspection |
| **A1/A2/A3** provenance matrix | **NOT IMPLEMENTED.** `SOURCES = ['LIVE_LLM','TEMPLATE','MOCK']`; `STATUSES = ['success','template_default','graceful_fallback']`; `ALLOWED` has 4 rows. No `HUMAN_EDIT`, no `review_required`, no `edited`. | Source inspection `app/mvp/provider/provenance.js:31-35`, `:70-75` |
| **Q7** evidence governance | Process rule; applies to future rounds. Not a code state. | — |

The matrix guard is doing its job: until A1–A3 exist, the new combinations **throw** rather than defaulting. That failure mode must not be relaxed.

### 5.1 LIVE validation boundary (re-confirmed, source inspection)

`content.js:1500-1518`: `liveTrace()` is called **only** inside `if (result.ok) { … if (validation.ok) { … } }`. A validation failure takes the `fallbackTrace(..., fallbackReason: 'validation_failed')` branch and sets `source: trace.source` = `TEMPLATE`. There is no other assignment of `LIVE_LLM` in the file. **Validation failure cannot become a `LIVE_LLM` success.**

---

## 6. Defect Register

Severity: **S1** blocks Gate 3 PASS · **S2** blocks a ratified decision's acceptance tests · **S3** quality/hygiene.

| ID | Sev | Defect | Ratified decision | Evidence | Status |
|---|---|---|---|---|---|
| DR-01 | S1 | Provider trims the interlock value → `' 1 '` is ON where Q6 requires OFF | Q6 | §2.2 runtime | Open |
| DR-02 | S1 | Service re-implements the interlock inline; `provider.isLiveEnabled` is never called (dead export) | Q6 | §2.1 source | Open |
| DR-03 | S1 | `ID_TOKEN` classifies any `[A-Z]{2,}-\d+` as a product identity → model codes rejected (P7b) | none — **undecided** | §3.1 runtime | Open, needs Owner decision |
| DR-04 | S1 | Identity comparison is case-sensitive → lowercased id bypasses the check; product name in different case is a false positive | none — **undecided** | §3.1 J/K, §3.2 runtime | Open, needs Owner decision |
| DR-05 | **S1** | Digits inside the snapshot's own product name are rejected as `unsupported_number` — 5 of 6 fixture products unscriptable | none — **new, undecided** | §3.3 runtime | Open, needs Owner decision |
| DR-06 | S1 | Price-claim masking leaves the currency word behind → order-dependent `unsupported_price` (P7c) | Q3 / D-2 | §5 runtime | Open |
| DR-07 | S2 | `thai-qa.js:594` reads `promo_depth_pct`; field is `promo.depth_pct` → every CTA discount FAILs | D-5 (deferred) | §4 runtime | Open, **no ticket** |
| DR-08 | S1 | Qualitative claims pass silently; no `reviewRequired` state, no `review_required` status | Q1 / D-1 | §5 source + runtime | Open |
| DR-09 | S1 | No finalize gate for review state | Q2 / D-1b | §5 source | Open |
| DR-10 | S1 | No `ambiguous_price_role`; value-only matching still active for uncued amounts | Q3 / D-2 | §5 source | Open |
| DR-11 | S1 | `script` carries no provenance; history entries carry only `{version, at, reason, checksum}` | Q4 / D-3 | §5 runtime | Open |
| DR-12 | S1 | Overlay edit leaves `script.lines` stale, no version bump, no line regeneration | Q5 / D-4 | §5 runtime | Open |
| DR-13 | S1 | `SOURCES`/`STATUSES`/`ALLOWED` lack `HUMAN_EDIT`, `review_required`, `edited` → matrix throws on the new states | A1–A3 (Q1, Q4) | §5 source | Open, **blocker** for DR-08/DR-11 |
| DR-14 | S3 | Repo carries stale copies under `app/mvp/` (`service.js.bak`, `.phase-2c-5-*`, `.ace-mission-2c-3-*`, `.pre-fix-*`, `.repair-*`, `.phase2c5-backup-before-fixes`, `.stage-2c8-precheck-*`) — dead security-adjacent surface for anyone grepping for interlock code | Q7 criterion 9 | Source listing | Open, hygiene |

**Dependency note:** DR-13 gates DR-08 and DR-11. DR-01 and DR-02 must land together, or a future caller can re-split the decision.

### 6.1 Classification required by the task

- **Ratified requirements:** Q1, Q2, Q3, Q4/3A, Q5/4A, Q6/6B-strict, Q7 — all at their stated levels, none implemented.
- **Verified findings:** DR-01, DR-02, DR-03, DR-04, DR-05, DR-06, DR-07, DR-08, DR-11, DR-12, DR-13, DR-14 (each with a command and output in this report).
- **Unverified claims:** none carried forward as fact. The 0.3 → 0.4 textual diff is **not** verified — see §1.3.
- **Open design questions:** Q2a, Q2b; `project.review` + `script_checksum` remains a proposal; `HUMAN_EDIT` inheritance semantics for a version whose predecessor has no trace.
- **Proposed fixes:** §7. None is approved.

---

## 7. Implementation Plan (proposal — nothing started, nothing authorized)

Order is dependency-driven, not preference-driven. Each step lists what would have to be true before it is called done.

**Step 0 — Provenance vocabulary (DR-13).** Add `HUMAN_EDIT` to `SOURCES`, `review_required` and `edited` to `STATUSES`, three rows to `ALLOWED` with their execution modes. Nothing else compiles against a vocabulary that rejects the new states.
*Done when:* the matrix accepts the three new combinations and still throws on an invalid mode pairing.

**Step 1 — Interlock (DR-01, DR-02).** Remove `trim()` from the provider; make `service.js:2721` call `provider.isLiveEnabled(process.env)`.
*Done when:* all six Q6 values produce identical Service and Provider results, with `' 1 '` OFF, and a recorder proves zero requests in every OFF case.

**Step 2 — Validator truth (DR-06, DR-10, DR-03, DR-04, DR-05).** Mask whole claim spans before the currency scan; add `ambiguous_price_role`; settle the identity question; stop rejecting digits that appear inside the snapshot's own `product_name`.
*Done when:* every row in §3.1/§3.2/§3.3 has a test asserting the Owner-approved outcome, **including the cases that must still reject**, and P7c passes in both orders.

DR-03/DR-04/DR-05 need an Owner ruling first: they are false positives with no ratified policy behind them, and fixing them by widening heuristics is exactly what Q3's cue discipline forbids.

**Step 3 — Review state (DR-08, DR-09).** `validateScriptDraft` returns `reviewRequired` + `unverified_qualitative_claim`; the provider success branch writes `status: 'review_required'`; a finalize checklist item blocks `FINALIZED`; a human review record unlocks it, bound to the content reviewed.
*Depends on:* Step 0. Needs a choose-or-replace decision on the unratified `project.review` shape.

**Step 4 — Per-version provenance (DR-11).** Capture `{source, status, traceId, provider, model, fallbackReason}` on every history entry; `HUMAN_EDIT`/`edited` for human edits; `derived_from_trace` when a trace exists.
*Depends on:* Step 0.

**Step 5 — Overlay regeneration (DR-12).** Rebuild `lines` from the storyboard in `applyTextEdit`, without touching `text` or `checksum` and without bumping `script_version`.
*Depends on:* Step 4 coheres better once scripts stop drifting.

**Step 6 — D-5 (DR-07).** Separate track, separate evidence, its own ticket. Not bundled with Step 2 even though both touch price/discount semantics.

**Step 7 — Hygiene (DR-14).** Remove or relocate the stale `app/mvp/*.bak`-family copies. Only with explicit authorization — they are untracked working-tree files.

### 7.1 Constraints that hold for every step

1. `source`, `status`, and `reviewRequired` each have a single writer.
2. A hard validation failure outranks review.
3. `review_required` blocks `FINALIZED` but not save, edit, preview, or review submission.
4. An approval is bound to the content it reviewed.
5. Cue additions need a justified phrasing **and** an ambiguous case that must still fail.
6. No weakening of the provenance matrix, the interlock, or the `fetchImpl` seam.
7. No Live Provider call.

### 7.2 What would make a future Gate 3 PASS legitimate

Unchanged from the ratification document, with one addition: criterion 2 ("every known false positive fixed or accepted in writing") now has **four** open items — P7b/DR-03, DR-04, DR-05, and DR-06. P1 is fixed. DR-05 is new and cannot be waived silently, because it makes most real products unscriptable.

---

## 8. Evidence limitations

1. **0.3 → 0.4 diff not reproducible.** The document is untracked and 0.3 no longer exists on disk. Preservation was checked against the recorded 0.3 requirements, not against the 0.3 file itself.
2. **No suite was run.** Per the read-only restriction, no `verification/*.js` suite was executed, so the previously reported counts (20/20, 21/21, 6/6, 56/56) are **REPORTED, not re-verified** in this task. All probes above were inline `node` with in-memory fixtures.
3. **Q6 Service column is an expression evaluation**, not a live service call: the expression text is read from `service.js` and evaluated. It proves what the line decides; it does not prove the surrounding handler's behaviour end to end.
4. **Identity probes used a synthetic fixture** (`item_id: 'SKU-1'`) matching the existing check script, not a real import. The digit finding in §3.3 used the real fixture product names.
5. **`' 1 '` was not exercised through the HTTP handler.** The interlock conclusion rests on the two decision sites plus §5.1's source proof that no other path sets `LIVE_LLM`.
6. **Untested by design:** whether a stale `service.js.*` copy in `app/mvp/` is required by anything (DR-14). Nothing references them by name in the tests inspected.
7. **Not audited in this task:** export filename policy, Content Library overwrite policy, and the full `mvp-workflow-acceptance` surface — all outside the requested scope.

---

## 9. Owner decisions required

| # | Question | Why it blocks |
|---|---|---|
| O-1 | DR-03/DR-04/DR-05 — fix in round 2, or accept in writing and record as known false positives? | §7.2 criterion 2 cannot be met while they are undecided. DR-05 affects most real products. |
| O-2 | Identity policy: should an unknown `ABC-123`-shaped token reject at all, or only tokens shaped like the snapshot's own id convention? | Determines whether DR-03 is a bug or intended strictness. |
| O-3 | `project.review` shape — adopt, replace, or leave as a proposal? | Step 3 cannot be specified without it. |
| O-4 | `HUMAN_EDIT` when the predecessor version has no trace: `derived_from_trace: null` or field absent? | Q4 says "when one exists"; storage shape is unspecified. |
| O-5 | Open D-5 ticket as ACE-QA-001? | It is verified live and currently has no owner. |
| O-6 | Authorize removing the stale `app/mvp/*` backup copies? | Untracked working-tree files; needs explicit permission. |
| O-7 | Approve an Implementation Scope covering Steps 0–5 (and whether Step 6/7 are in it)? | **Implementation remains NOT AUTHORIZED until this is approved.** |

---

## 10. Final status

| Dimension | Status |
|---|---|
| **Gate 3 Script Validation Correction** | **PARTIAL** — the evidence-based checks exist and reject fabricated prices, but carry four open false-positive/false-negative classes (DR-03, DR-04, DR-05, DR-06) and no qualitative state (DR-08). |
| **Gate 3 Overall** | **NOT ACCEPTED** |
| **Gate 4** | **NOT AUTHORIZED** |
| **Implementation** | **NOT AUTHORIZED** |
| **Owner is the sole Gate 3 PASS authority** | Unchanged |

Q1–Q7 ratification is **not** Gate 3 acceptance. This report is evidence for the Owner, not a certification.
