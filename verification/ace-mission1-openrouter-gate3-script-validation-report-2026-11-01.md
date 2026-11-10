# ACE — Gate 3 Follow-up: Script Validation Correction Report

**Scope:** strengthen Script Draft validation against `offer_snapshot`, plus directly necessary offline tests and documentation. No Gate 4 work.

**Owner decisions applied:** Safety Interlock APPROVED and retained; Script Validation FIX authorized; Test Isolation SEPARATE (untouched); Gate 4 NOT AUTHORIZED.

---

## A. Reconciliation

### A.1 Actual git state at start of this task

| Item | Value |
|---|---|
| Branch | `mission1-planning-docs` |
| HEAD | `795dc0a6ac66bef19725184107e6474b41aa1823` |
| Porcelain entries | 152 |
| Tracked modifications | `app/mvp/content.js` (+190), `app/mvp/service.js` (+66/−11) — the Gate 3 slice |
| Commit / staged | none |

### A.2 Prior report vs actual source — checked, and what disagreed

| Claim in the Gate 3 implementation report | Actual source | Verdict |
|---|---|---|
| `validateScriptDraft` checked length, Thai, placeholders, markup only | Confirmed — it was purely structural, `content.js:1147` | matches |
| Safety interlock exists, default OFF | Confirmed — `service.js:2721` compares `=== '1'`; no other assignment; `.env.example` ships it commented out | matches |
| Validation called with no offer evidence | Confirmed — call site was `validateScriptDraft(result.text)` | matches |
| Deterministic project untouched | Confirmed — `createContentProject` unmodified | matches |

**Two discrepancies found that the prior report did not mention:**

1. **`thai-qa.js:594` reads a field that does not exist.** `checkCta` uses `project.offer_snapshot.promo_depth_pct`, but the real snapshot field is `promo.depth_pct`. `Number(undefined || 0)` is `0`, so `expected` is always falsy and **every** CTA carrying a discount claim is reported as `CTA-DISCOUNT: FAIL`. This is a pre-existing defect outside this task's scope. I did not touch it, and I deliberately did not copy the pattern — the new validator reads `offer_snapshot.promo.depth_pct`.
2. **`offer_snapshot` has no commission field.** It carries `item_id, product_id, shop_id, product_name, shop_name, price_thb, list_price_thb, promo {type,label,depth_pct}, rating, rating_count, affiliate_link, product_url, checked_at, data_as_of, synthetic`. The offer record *does* have `commission_rate` and `commission_per_order_thb`, but the snapshot does not copy them. Commission claims therefore cannot be validated from the snapshot, and the validator rejects them rather than inferring.

---

## B. Changes

### B.1 Files changed

| File | Change |
|---|---|
| `app/mvp/content.js` | MODIFIED — `validateScriptDraft(text, source)` rewritten as an evidence-based validator (+265 lines); one call site now passes `project`; `finiteOrNull` null-coercion fix |
| `verification/openrouter-gate3-script-validation-check.js` | NEW — 20 focused offline checks |
| `verification/openrouter-gate3-script-validation-log` → `openrouter-gate3-script-validation-2026-11-01.log` | NEW — captured run output |
| `verification/openrouter-gate3-offline-check.js` | MODIFIED — check 07b now passes the project to the new signature (assertions kept, plus the exact failure reason in the message) |

Not changed: `app/mvp/service.js`, `app/mvp/provider/*`, `.env.example`, `package.json`, `verification/content-creation-acceptance.js`, and every data file. No new dependency.

### B.2 Validation strategy

`validateScriptDraft(text, source)` accepts a content project (reads `offer_snapshot`) or a snapshot object. It returns `{ ok, failed, findings }`, where `failed` is the deduplicated code list recorded in the trace and `findings` identifies each claim:

```
{ code, claim, field, expected }
```

Deterministic checks, in order:

| # | Rule | Codes produced |
|---|---|---|
| 1 | Structural: empty, length bounds, Thai ratio ≥ 0.5, placeholder markers, HTML-like markup | `empty`, `too_short`, `too_long`, `not_thai`, `placeholder_leak`, `markup` |
| 2 | Snapshot must exist; without it nothing about an offer can be proven | `missing_snapshot_evidence` |
| 3 | Id-shaped tokens (`SKU-1`) must equal a snapshot id | `identity_mismatch` |
| 4 | Date tokens must appear in `checked_at` / `data_as_of` | `unsupported_date` |
| 5 | Price **role**: amount after `ราคา`/`ตอนนี้`/`เหลือ` must equal `price_thb`; after `ราคาปกติ`/`ราคาเต็ม`/`จากปกติ`/`ราคาก่อนลด` must equal `list_price_thb` | `conflicting_price`, `unsupported_price` (when the role's field is absent) |
| 6 | Every other currency amount must be one of the snapshot prices | `unsupported_price` |
| 7 | Every percentage must equal `promo.depth_pct` | `unsupported_discount` |
| 8 | Aspect ratio must be a known ratio (9:16, 16:9, 1:1, 4:5) | `unsupported_number` |
| 9 | Every remaining bare number must be an allowed snapshot/project value | `unsupported_number` |
| 10 | Keyword-gated categories with no snapshot evidence: commission, shipping, guarantee, stock, gift, personal experience, certification — rejected unless the phrase literally appears in the snapshot's own text | `unsupported_claim:<category>` |
| 11 | Product identity present (whitespace-insensitive substring of `product_name`) | `missing_product_identity` |

Allowed numbers are exactly: `price_thb`, `list_price_thb`, `promo.depth_pct`, `rating`, `rating_count`, the rating scale `5`, the aspect components `9`/`16`, the scene count and summed scene duration, and the date components of `checked_at`/`data_as_of`. Thai digits are normalised (`๒๙๙` → `299`). Nothing is derived: savings arithmetic such as `ประหยัด 300 บาท` is rejected because it is not a snapshot value and the validator does not calculate on the model's behalf.

An invalid draft cannot be accepted: `createScriptDraftWithProvider` already routes a failed validation to `source: TEMPLATE`, `status: graceful_fallback`, `fallbackReason: 'validation_failed'`, and keeps the deterministic text. Check 08 proves the fabricated text never survives.

### B.3 Known limitations (deliberate, not hidden)

1. **Qualitative claims are not detected.** "คุณภาพดี", "ทนทาน", "ขายดีมาก", "คุ้มที่สุด" carry no number and no gated keyword, so they pass. These are subjective marketing adjectives, but they are still unsupported assertions.
2. **Numbers are validated by value, not by meaning.** Rule 5 covers the common Thai price phrasings; a sentence that puts the original price after `ราคา` (e.g. `ราคา 599 บาท ลดเหลือ 299 บาท`) is rejected as conflicting even though a human reads it correctly. This is the main false-positive class, and it is the price of fail-closed behaviour.
3. **Product identity is a substring test.** A draft that paraphrases the product name instead of quoting it fails closed. Deliberately strict.
4. **Implicit comparisons are not checked** — "ถูกกว่าที่อื่น" names no competitor amount, so there is nothing to compare against the snapshot.
5. **Commission could be validated** if `offer_snapshot` were extended to carry `commission_rate` / `commission_per_order_thb`. It is not, so the validator rejects commission claims. Extending the snapshot is a contract change for the Owner, not something I did.
6. **`promo.label` is trusted as text.** If the snapshot's label itself contains an unverified promise (e.g. "ส่งฟรี"), that phrase is treated as supported because it came from the source record.

---

## C. Evidence

### C.1 Commands executed, exit codes, counts

| Command | Exit | Result |
|---|---|---|
| `node --check app/mvp/content.js` | 0 | syntax clean |
| `node verification/openrouter-gate3-script-validation-check.js` | 0 | **20/20 passed** |
| `node verification/openrouter-gate3-offline-check.js` | 0 | **21/21 passed** |
| `node verification/openrouter-gate3-route-check.js` | 0 | **6/6 passed** |
| `node verification/mvp-workflow-acceptance.js` | 0 | **56/56 passed**, 0 commits created |
| `node verification/content-creation-acceptance.js` | **not run** | see C.3 |

`executionMode: OFFLINE_TEST` on every trace produced. All suites print `network calls made: 0` and `real API key used: no`.

Focused coverage of the ten required cases:

| Required case | Check(s) |
|---|---|
| 1. Valid claims supported pass | 01, 01b (Thai digits) |
| 2. Unsupported price claims fail | 02 (199 vs 299, field + expected asserted), 02b (1,299) |
| 3. Conflicting price claims fail | 03 (list price in current slot), 03b (current price in list slot) |
| 4. Unsupported discount/commission fail | 04 (70% vs 50%), 04b (commission), 04c (no promo) |
| 5. Unsupported numeric claims fail | 05 (review count 500), 05b (stock/shipping/guarantee), 05c, 05d (date) |
| 6. Missing snapshot fields do not permit invented claims | 06 (absent price → `expected: 'absent'`), 06b (no snapshot at all), 06c (no product identity) |
| 7. Creative text remains eligible | 07 |
| 8. Invalid drafts cannot be accepted as successful output | 08 |
| 9. Fallback provenance correctly identified | 09, 08 |
| 10. Interlock still defaults OFF and blocks egress | 10 (`provider_disabled`, 0 requests) |

### C.2 Confirmation: offline only

No OpenRouter or other provider endpoint was contacted. Every provider interaction used an injected `fetch` double; the interlock check additionally replaced `globalThis.fetch` with a recorder so a broken guard would have failed the run rather than reached the network. No credential was read: the only key values used are the literal canary strings `sk-or-v1-validation-canary` inside the test process, never sent anywhere.

### C.3 Deliberate omission: `content-creation-acceptance.js`

I did **not** run it this round. From the previous task's evidence, that suite writes into the real tracked `data/mission1/content-library.json`; Test Isolation is explicitly out of scope, and the instruction forbids running tests known to mutate real project data. The affected code path is narrow: `createContentProject`, the storyboard builder, QA, and export are unchanged, and `mvp-workflow-acceptance.js` (56/56) independently confirms the deterministic pipeline and that no real state file is written. I am recording this as an omission, not as a pass.

### C.4 Safety Interlock

**Unchanged and still default OFF.** `service.js:2721` remains `process.env.ACE_LLM_LIVE_ENABLED === '1'`; `.env.example` still ships it commented out; check 10 asserts the variable is unset and that a key present in the environment with no injected fetch yields `provider_disabled` with zero requests. No real request is possible without the operator explicitly enabling it **and** supplying a real key.

### C.5 Test isolation

**Untouched.** `verification/content-creation-acceptance.js` was not modified, and no isolation remediation was performed. The new suite uses in-memory fixtures only and writes nothing outside its own log file.

No destructive git command was used. (The previous task's `git checkout` on the content library is not repeated here — the file was verified unchanged.)

---

## D. Git state

| Item | Value |
|---|---|
| Branch | `mission1-planning-docs` (unchanged) |
| HEAD | `795dc0a6ac66bef19725184107e6474b41aa1823` (unchanged) |
| Commit | none created |
| Staging | nothing staged (`git diff --cached` empty) |
| Push / merge / deploy | none |

Final `git diff --stat`:

```
 app/mvp/content.js | 455 +++++++++++++++++++++++++++++++++++++++++++++++++++++
 app/mvp/service.js |  66 ++++++--
 2 files changed, 510 insertions(+), 11 deletions(-)
```

`content.js` went from +190 (Gate 3 slice) to +455; the +265 delta is this task's validator. `service.js` is unchanged by this task.

Working-tree entries added by this task, compared entry-by-entry against the pre-task baseline (152 → 154):

```
> ?? verification/openrouter-gate3-script-validation-check.js
> ?? verification/openrouter-gate3-script-validation-2026-11-01.log
```

Plus this report. No entry was removed, no tracked file changed beyond `content.js`, and no data file was touched.

---

## E. Remaining risks

1. **Qualitative and comparative claims remain unverified** (B.3 items 1 and 4). The validator catches numbers, price roles, discounts, dates, identity, and seven keyword-gated categories — not meaning. A live draft could say "คุ้มที่สุดในตลาด" and pass.
2. **False positives are real.** The price-role heuristic rejects a human-readable sentence that states the original price after `ราคา`. If live drafts are rejected too often, the fix belongs in the prompt wording, not by loosening the check.
3. **Snapshot contract gaps that need an Owner decision:** `offer_snapshot` carries no `commission_rate`, `commission_per_order_thb`, shipping, stock, guarantee, or certification data — even though the offer record holds commission. Adding them would let commission claims be verified instead of rejected. Not done: it changes the content contract.
4. **`thai-qa.js:594` bug is still live** (`offer_snapshot.promo_depth_pct` does not exist), so CTA discount QA always fails when a discount is claimed. Pre-existing, out of scope, and it means the deterministic pipeline's own QA is stricter than its data supports.
5. **No live confirmation of anything.** The provider contract, model behaviour, and whether a real draft passes this stricter validator are all unknown until Gate 4.
6. **Validation is not idempotent against prompt changes** — if the prompt stops asking for the product name, `missing_product_identity` will reject otherwise-good drafts.

---

`Gate 3 Script Validation Correction: PARTIAL`

`Gate 4: NOT AUTHORIZED`

**Why PARTIAL rather than PASS:** every one of the ten required offline checks passes, the validator fails closed for numeric, price-role, discount, date, identity, and seven gated claim categories, and an invalid draft provably cannot be accepted as provider output. What it does **not** do is verify qualitative or comparative claims, which carry no number and no gated keyword — and item B.3.2 means it can reject a correct sentence. Claiming complete factual verification would overstate the evidence, so the status stays PARTIAL for Owner review.
