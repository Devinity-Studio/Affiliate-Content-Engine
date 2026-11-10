# ACE — Final Gate 3 Independent Reconciliation

**Authorization:** read-only. No source, test, configuration, dependency, or fixture was modified. The only file created is this report. No external provider was contacted, no real key was used, and `verification/content-creation-acceptance.js` was not run.

**Method:** every claim below was re-derived from the working tree in this session — `git` inspection, source reading, and inline `node` probes run through a heredoc so nothing was written to disk. Where a probe disagreed with the earlier report, the probe is reported and the earlier claim is corrected.

Evidence classes: **VERIFIED** (observed in this session), **REPORTED** (asserted in an earlier report only), **NOT VERIFIED**, **INCONCLUSIVE**.

---

## 1. Executive Summary

The Gate 3 slice is present and its offline suites genuinely pass in the current tree: 20/20 validation, 21/21 provider, 6/6 route, 56/56 MVP workflow, and `content.js` parses cleanly. The provenance boundary holds: **no path reaches `LIVE_LLM` except `result.ok && validation.ok`**, verified both by source inspection (one `liveTrace` call site) and by the LIVE-branch probes. The safety interlock has no runtime bypass; its only escape is the `fetchImpl` test seam, which no production caller passes.

Three findings materially qualify "validation is now evidence-based":

1. **Price-role checking is phrase-list-limited, and both over- and under-strict.** `ราคา 599 บาท ลดเหลือ 299 บาท` is rejected although a human reads it correctly, while `ราคาพิเศษ 599 บาท`, `ราคาโปรโมชัน 599 บาท`, and `เพียง 599 บาท` all **pass** — the list price presented as the current price is accepted whenever the wording avoids the three enumerated patterns.
2. **A masking artifact creates a false positive that my own suite never caught.** `ข้อมูลปี 2026 ราคา 299 บาท` is rejected as `unsupported_price` with claim `"2026   บาท"`, because masking the price leaves the word `บาท` to bind to an earlier number. Proven at the helper level.
3. **Qualitative claims pass with no signal at all** — `ok: true`, `findings: []` — indistinguishable from a fully grounded draft. There is no `HUMAN REVIEW` state to carry them.

Also confirmed: provenance is silently dropped on version-bumping edits (not mislabelled), `isLiveEnabled` is a dead export, and the `thai-qa.js:594` `promo_depth_pct` defect is untouched and unrelated to this work.

**Status: correction PARTIAL, Gate 3 not accepted.** The validator is a real improvement over structural-only checks, but "price semantics validated" overstates what the code does.

---

## 2. Repository Baseline

| Item | Value |
|---|---|
| Repository path | `Y:/DevProject/Affiliate Content Engine` |
| Branch | `mission1-planning-docs` |
| HEAD | `795dc0a6ac66bef19725184107e6474b41aa1823` |
| `git status --porcelain` entries | 155 |
| Tracked files (`git ls-files`) | 38 |
| `git diff --stat` | `app/mvp/content.js` +455; `app/mvp/service.js` +55/−11 |
| `git diff --numstat` | `455  0  app/mvp/content.js` / `55  11  app/mvp/service.js` |
| Staged | none (`git diff --cached` empty) |

Changed tracked files are exactly two. Everything else in the provider slice (`app/mvp/provider/*`, `.env.example`, the four verification scripts and logs) is untracked, consistent with the repo's pre-existing state where only 38 files are tracked at all.

**Files that changed across Gate 3:** `app/mvp/content.js`, `app/mvp/service.js`, `.env.example`, plus new `app/mvp/provider/` and `verification/openrouter-gate3-*`.
**Files that did not change:** `app/mvp/thai-qa.js`, `app/mvp/importer.js`, `app/remotion/*`, `app/server.js`, `package.json`, all `data/` files.

---

## 3. Diff Reconciliation

### 3.1 The `0 deletions` question — resolved

`git diff --numstat` reports `455  0` for `content.js`. This is **not** evidence of a duplicated function. The entire validator block is new *relative to HEAD*: the Gate 3 slice added 190 lines and this task added 265, which sums exactly to 455. Nothing in the Gate 3 slice was ever committed, so there is no earlier version of `validateScriptDraft` in the index for git to show as deleted.

Arithmetic check: 190 + 265 = 455 = `git diff --numstat` value. **VERIFIED**

### 3.2 No duplicate definition, single export

```
$ grep -n "function validateScriptDraft" app/mvp/content.js
1299:function validateScriptDraft(text, source) {

$ grep -n "validateScriptDraft," app/mvp/content.js
1930:  validateScriptDraft,

$ git diff app/mvp/content.js | grep -c "^-[^-]"
0
```

One definition, one export, zero deleted lines. **VERIFIED** — a shadowing duplicate, which would have mattered because a later `function` declaration wins in JS, is ruled out.

### 3.3 What `service.js` actually changed

`55 insertions, 11 deletions` — the opt-in branch in `handleContentDraft` plus the honest `external_calls` count. Unchanged by this reconciliation task. **VERIFIED**

---

## 4. Price Semantics Findings

All probes run inline against the fixture snapshot `price_thb=299, list_price_thb=599, promo.depth_pct=50, rating=4.6, rating_count=128, product_name=กระเป๋าผ้าราคาประหยัด`, with `data_as_of=2026-10-21`.

| # | Input (product name omitted for brevity) | Snapshot | `ok` | `failed` | Expected | Verdict |
|---|---|---|---|---|---|---|
| P1 | `ราคา 599 บาท ลดเหลือ 299 บาท` | standard | **false** | `conflicting_price` (claim `599`, expected `299`, field `offer_snapshot.price_thb`) | accept — human reads 599 as the old price | **FALSE POSITIVE** |
| P2 | `จาก 599 เหลือ 299` | standard | true | — | accept | PASS |
| P3 | `ราคาปกติ 599 บาท ราคาพิเศษ 299 บาท` | standard | true | — | accept | PASS (but see P9) |
| P4 | `ราคา 299 บาท` | standard | true | — | accept | PASS |
| P5 | `ราคา 299 บาท` | `list_price_thb: null` | true | — | accept | PASS |
| P5b | `ราคา 299 บาท` | `price_thb: null` | **false** | `unsupported_price` (expected `absent`) | reject — no price in evidence | PASS (fail-closed) |
| P6 | `ราคาปกติ 599 บาท` | `price_thb: null` | true | — | accept — only the list price is claimed | PASS |
| P7a | `มี 3 ชิ้น` | standard | false | `unsupported_number` (claim `3`) | reject — no quantity field | PASS (fail-closed, over-strict by design) |
| P7b | `รุ่น SKU-9` | standard | false | `identity_mismatch` (claim `SKU-9`, expected `SKU-1\|SHOP-1\|PRD-1`) | ambiguous — a model number is not an identity claim | **FALSE POSITIVE** (over-strict) |
| P7c | `ข้อมูลปี 2026 ราคา 299 บาท` | standard | false | `unsupported_price` (claim `"2026   บาท"`) | accept — 2026 is a year, not an amount | **FALSE POSITIVE** (bug, see 4.2) |
| P7e | `ราคา 299 บาท ข้อมูลปี 2026` | standard | true | — | accept | PASS |
| P8 | `ลด 30%` | standard | false | `unsupported_discount` (expected `50`) | reject | PASS |

### 4.1 Under-strictness the suite never tested — the more serious half

| # | Input | `ok` | Expected | Verdict |
|---|---|---|---|---|
| P9 | `ราคาพิเศษ 599 บาท` | **true** | reject — the list price claims to be the special price | **FALSE NEGATIVE** |
| P10 | `ราคาโปรโมชัน 599 บาท` | **true** | reject | **FALSE NEGATIVE** |
| P11 | `เพียง 599 บาท` | **true** | reject | **FALSE NEGATIVE** |

The role rules in `content.js` are two regexes (`CURRENT_PRICE_CLAIM`, `LIST_PRICE_CLAIM`). `CURRENT_PRICE_CLAIM` covers `ราคา` / `ตอนนี้` / `เหลือ`; a special-price phrase such as `ราคาพิเศษ` does not match it, so the number falls through to the generic allowlist, where `599` is legitimate because it *is* the list price. So the same semantic error that P1 rejects is silently accepted under different wording. The earlier report's claim that "price **role** is validated" is true only for the enumerated phrasings and should be read that way.

### 4.2 Root cause of the P7c artifact — proven at the helper

```
$ node -e "…thaiQa.priceMentions('ข้อมูลปี 2026  บาท')…"
[{"raw":"2026  บาท","value":2026,"currency":"บาท","index":9}]
$ node -e "…thaiQa.priceMentions('299  บาท')…"
[{"raw":"299  บาท","value":299,"currency":"บาท","index":0}]
```

After the role patterns replace `ราคา 299` with a space, the currency word `บาท` remains and `priceMentions`' `\s*` binds it to the nearest preceding number — the year. Result: order-dependent behaviour (P7c rejects, P7e accepts) driven by masking, not by meaning. **VERIFIED**

### 4.3 Assessment

"Price semantics validated" would overstate the code. What exists is a value allowlist plus a three-phrase role heuristic. It fails closed on invented amounts (P5b, P8) and fails open on unenumerated role phrasings (P9–P11). Both failure directions are demonstrated, not hypothesised.

---

## 5. Qualitative Claim Policy

Actual behaviour of `validateScriptDraft` on the requested examples (standard snapshot):

| Input | `ok` | `failed` | `findings` |
|---|---|---|---|
| `คุ้มที่สุดในตลาด` | **true** | `[]` | `[]` |
| `ทนทาน` | **true** | `[]` | `[]` |
| `ขายดี` | **true** | `[]` | `[]` |
| `ถูกกว่าร้านอื่น` (comparative) | **true** | `[]` | `[]` |

**Finding:** there is no third state. A draft full of unverifiable superlatives produces exactly the same result object as a perfectly grounded draft — `ok: true, failed: [], findings: []`. Downstream, `trace.validation.ok` is `true` and `source` can legitimately become `LIVE_LLM`, with nothing recording that unpriced, unevidenced assertions are present. This is worse than "not checked": there is no place for a reviewer to see that the question was never asked. **VERIFIED**

### Policy options (no code changed)

**Option A — Rejected (treat as failure)**
Reject any draft containing a qualitative superlative/comparative keyword list.
*Pros:* simple, deterministic, consistent with the fail-closed stance already taken for commission/shipping.
*Cons:* large false-positive surface — Thai marketing copy is saturated with `คุ้ม`, `ดี`, `ทนทาน`; a keyword list will reject most natural drafts and can never be complete. Would likely make live drafts unusable.

**Option B — Human Review Required (new explicit state)**
Add a third outcome, e.g. `validation.status: 'REVIEW_REQUIRED'`, with `findings` carrying `{ code: 'unverified_qualitative_claim', claim }`. The draft is not labelled `LIVE_LLM success`; it enters a review queue.
*Pros:* nothing passes silently; preserves usable creative copy; the trace records that the gap was known rather than absent.
*Cons:* requires a new status value in the provenance matrix (today only `success | template_default | graceful_fallback`), plus a decision about whether `source` may be `LIVE_LLM` when status is `REVIEW_REQUIRED` — that is a provenance-contract change, not a validator tweak.

**Option C — Accepted with annotation**
Keep `ok: true` but attach `findings` so the trace carries the unverified claim list.
*Pros:* cheapest; no matrix change.
*Cons:* `ok: true` still feeds `LIVE_LLM`; the annotation is advisory and easy to ignore.

**Recommendation (Owner decides):** Option B fits the Owner's stated principle better than A or C. Option A would reject most real Thai copy, and Option C leaves the silent-pass problem substantially intact — an annotation that changes no state is not a control. Option B's cost is a small, explicit extension of the existing provenance matrix rather than new machinery. I am not choosing it on the Owner's behalf.

---

## 6. LIVE Validation Boundary

### 6.1 Source-code proof

| Symbol | Call sites found |
|---|---|
| `createScriptDraftWithProvider` | `service.js` (opt-in branch only), verification scripts |
| `validateScriptDraft` | `content.js:1501` inside `createScriptDraftWithProvider`, verification scripts |
| `provenance.liveTrace` | **exactly one**: `content.js:1504`, inside `if (result.ok)` → `if (validation.ok)` |
| `provenance.mockTrace` | `content.js:1505`, the non-live arm of the same branch |
| `provenance.fallbackTrace` | `content.js:1518` (validation failure), `content.js:1533` (provider failure) |
| `allowNetwork: true` | **exactly one**: `service.js:2747`, value `liveEnabled` |
| `ACE_LLM_LIVE_ENABLED` | `service.js:2721` (read at request time), `openrouter.js` constant + unused helper |
| `fetchImpl` in runtime | **none** — `grep fetchImpl app/mvp/service.js` is empty |

The only route to `LIVE_LLM` is: service passes `liveEnabled` → content passes `allowNetwork` → provider returns `ok` → `validateScriptDraft` returns `ok`. There is no second constructor of a live trace. **VERIFIED**

### 6.2 Behavioural proof (all with in-memory `fetchImpl`, no network)

| Case | exec | Provider | validation | Final `script.source` | Trace | Result |
|---|---|---|---|---|---|---|
| A. LIVE + valid draft | `LIVE` | ok | `ok: true` | `LIVE_LLM` | `source=LIVE_LLM status=success exec=LIVE` | correct |
| B. LIVE + fabricated draft | `LIVE` | ok | `ok: false` | `TEMPLATE` | `source=TEMPLATE status=graceful_fallback fallback=validation_failed` | correct |
| C. LIVE + empty response | `LIVE` | `empty_response` | not run | `TEMPLATE` | `source=TEMPLATE fallback=empty_response` | correct |
| D1. OFFLINE_TEST + valid draft | `OFFLINE_TEST` | ok | `ok: true` | `MOCK` | `source=MOCK status=success` | correct |
| D2. LIVE but egress not allowed | `LIVE` | `provider_disabled` | not run | `TEMPLATE` | `source=TEMPLATE fallback=provider_disabled` | correct |
| E. Validation failure after provider success | `LIVE` | ok | `ok: false` | `TEMPLATE` | text identical to deterministic output | correct |

**Probe correction, stated because it matters:** my first run of case E printed "fabricated text survived? YES" from `text.includes('99 บาท')`. That assertion was wrong — `299 บาท` contains the substring `99 บาท`. Re-run with exact equality: `script.text === deterministic text` → **true**, and the fabricated markers `9999` and `90%` are absent. Case E is correct; the first assertion was mine, not a code defect. **VERIFIED**

---

## 7. Safety Interlock Audit

**Default OFF — VERIFIED.** `service.js:2721` is `process.env.ACE_LLM_LIVE_ENABLED === '1'`, read per request (not cached at module load). `.env.example` ships it commented out. The audit probe confirmed the variable is unset in the shell used for these runs.

**Activation condition — VERIFIED.** Only the exact string `1` (after `trim()`) satisfies `isLiveEnabled` in the provider; the service comparison is strict `===` against `'1'`. Any other value (`true`, `yes`, `TRUE`) leaves egress disabled.

**Provider-side refusal — VERIFIED.** `openrouter.js:239`: if no `fetchImpl` is injected **and** `allowNetwork !== true`, the call returns `provider_disabled` before any request object is built. Probe: with a key present and `allowNetwork` unset, `fetchImpl` recorder captured **0** calls.

**Conclusions, separated as requested:**

1. **No bypass found in runtime paths.** One `allowNetwork: true` site, derived solely from `liveEnabled`; one `liveTrace` site; no runtime `fetchImpl` injection; no other environment read can enable egress. **VERIFIED**
2. **A code-level possibility exists and must not be described as impossible.** `generateScriptDraft` permits the call whenever `fetchImpl` is a function, regardless of `allowNetwork`. Any future caller that passes `fetchImpl: globalThis.fetch` would perform real egress with the interlock off. Today no runtime caller does, but this is caller discipline, not an enforced boundary. **VERIFIED (as a seam), NOT a currently exploitable path**
3. **Not verified:** that some future route or refactor would not introduce such a caller. Nothing in the current tree does.

---

## 8. Existing QA Mismatch — Separate Defect

```
$ git status --porcelain app/mvp/thai-qa.js
(empty — untouched)

$ grep -n "promo_depth_pct" app/mvp/thai-qa.js
594:    const expected = Number((project.offer_snapshot && project.offer_snapshot.promo_depth_pct) || 0);
```

Actual snapshot path is `offer_snapshot.promo.depth_pct` (confirmed from `content.js` `offer_snapshot` construction). `offer_snapshot.promo_depth_pct` is therefore `undefined`, `Number(undefined || 0)` is `0`, so `expected` is always falsy and every CTA carrying a discount claim yields `CTA-DISCOUNT: FAIL`.

- Defect still present: **yes** (`thai-qa.js:594`).
- Modified in the current diff: **no** — `thai-qa.js` is not in `git diff`.
- Relationship to the Script Validation correction: **none in code**. The validator reads `promo.depth_pct` correctly and never calls this QA path. They are independent; this task did not fix it and did not conflate it. **VERIFIED**

---

## 9. Provenance Durability

`bumpScript` (`content.js:582`) does `project.script_version += 1` then `project.script = buildScript(project)` — a **whole-object replacement**, which discards `source`, `trace`, `lines_source`, and `fallback_reason`. Callers: `content.js:693` (text/audio edit when `textChanged`), `:737` (add scene), `:750` (remove scene).

Observed:

| Action | version | `script.source` | `script.trace` |
|---|---|---|---|
| After a MOCK draft | 1 | `MOCK` | present |
| Overlay-only edit (headline) | 1 | `MOCK` | **present** |
| `addScene()` | 2 | **absent** | **absent** |

Classification:

- **Provenance preserved** for overlay-only edits — but see below.
- **Provenance silently lost** on any version-bumping edit. It is not rebuilt and not replaced with a weaker label; the fields simply vanish. `script_version_history` records only `version, at, reason, checksum`, so the origin is not carried forward into history either. **VERIFIED**
- **No misattribution of text:** after a bump the script carries no `source` at all, so it cannot be read as `LIVE_LLM`. Being unlabelled is not the same as being wrong-labelled. **VERIFIED**
- **A distinct staleness risk exists:** an overlay-only edit changes `scene.overlay.headline` but does **not** regenerate `script.lines[].on_screen`, because `textChanged` tracks the voiceover only. Probe output:

```
script version after overlay edit : 1
script.lines[1].on_screen before  : ["ปัญหาที่พบบ่อย","ของใช้บ้านรก ซื้อผิดขนาด","เช็กข้อมูลก่อน ไม่ต้องเดา","คะแนนรีวิว 4.6 จาก 5 · รีวิว 128 รายการ"]
script.lines[1].on_screen after   : (identical)
scene.overlay.headline after      : หัวข้อที่มนุษย์แก้
lines contain new headline?       : false
```

So a script carrying `source: MOCK` (or `LIVE_LLM`) can contain on-screen lines that no longer match the storyboard that will be rendered. That is a pre-existing deterministic-path behaviour, not introduced by Gate 3, but it means the trace describes a `lines` snapshot that has drifted. **VERIFIED**; no fix attempted.

---

## 10. Dead Code and Test Seam

**`isLiveEnabled` is a dead export.** Grep across `app/` and `verification/` returns only its definition and its entry in `module.exports` (`openrouter.js:381`). No caller. It duplicates the service-layer check and has **no effect** on the interlock — enabling it would require a caller that does not exist. Harmless, but it is dead surface in a security-adjacent module, and a future reader could mistake it for an active control. **VERIFIED**

**Test seam reachability.** `fetchImpl` is reachable only by passing it explicitly to `generateScriptDraft` / `createScriptDraftWithProvider`. `service.js` passes neither, so the HTTP route cannot reach the seam. The seam is therefore test-only **in the current tree**, but it is a public option on a public function — see 7.2.

---

## 11. Test Rerun Evidence

Run in the current working tree, this session:

| Command | Exit | Count |
|---|---|---|
| `node --check app/mvp/content.js` | 0 | syntax clean |
| `node verification/openrouter-gate3-script-validation-check.js` | 0 | **20 / 20 passed, 0 failed** |
| `node verification/openrouter-gate3-offline-check.js` | 0 | **21 / 21 passed, 0 failed** |
| `node verification/openrouter-gate3-route-check.js` | 0 | **6 / 6 passed, 0 failed** |
| `node verification/mvp-workflow-acceptance.js` | 0 | **56 / 56 assertions passed, 0 failed** |
| `node verification/content-creation-acceptance.js` | — | **not run** (forbidden; mutates the real content library) |

Post-run working tree check: `git status --porcelain` was captured before and after, and the two captures are **identical** (155 entries). No tracked data file changed. Two honest qualifications:

- The three OpenRouter suites **rewrite their own untracked `.log` artifacts** on every run (`fs.writeFileSync(LOG_FILE, …)` in their source). Git status is unchanged because those files are untracked and their content is stable; the files are nevertheless rewritten, and I did not verify byte-identity by hash.
- The route suite writes disposable fixture state into `.tmp/gate3-route-check/`, which is inside the git-ignored `.tmp/` area.

**Important scope limit:** the suites passing proves the assertions they contain. It does not prove the validator is correct — P9/P10/P11 and P7c are behaviours no assertion covers. That gap is exactly why this reconciliation exists.

---

## 12. Limitations / Unverified Items

- **No live provider contact.** The OpenRouter contract (endpoint, headers, body, response fields) remains unverified; only Gate 4 can settle it. **NOT VERIFIED**
- **Semantic/qualitative coverage is absent**, not merely incomplete (section 5). **VERIFIED as absent**
- **Thai linguistic parsing is not used.** No tokenizer, no NLP; all checks are regex and allowlist. Any claim phrased outside the enumerated patterns is unmeasured.
- **False-negative rate on real model output is unknown** — no real draft has ever been produced. **UNVERIFIED**
- **The `content-creation-acceptance.js` suite was not run** in either Gate 3 task, so the deterministic content pipeline's own 62 checks are not re-confirmed in the current tree. The 56-assertion MVP workflow suite is the substitute evidence, and it covers less.
- **`numeric` checks are value-based, not semantic**: a correct number attached to a wrong noun passes whenever the phrase is not role-matched (P9–P11).
- I did not audit `app/remotion/*` or the export path at all; they are outside this reconciliation's scope.

---

## 13. Owner Decisions Required

1. **Qualitative claim policy** — choose Rejected / Human Review Required / Accepted-with-annotation (section 5). Recommend **Human Review Required**, which implies a new status in the provenance matrix; that matrix change needs explicit approval because it alters an approved contract.
2. **Price-role coverage** — accept the current three-phrase heuristic, extend the phrase list, or move role checking behind a different mechanism. Note that extending it will also increase P1-style false positives unless a "decrease" context is recognised.
3. **The masking artifact (P7c)** — decide whether it is worth a fix; it is a small, contained defect but it is a defect.
4. **Provenance durability** — decide whether a trace should be carried into `script_version_history` so an edited script retains its origin, or whether provenance legitimately covers only the unedited draft.
5. **`thai-qa.js:594`** — raise as its own fix ticket. It is a separate defect and should not be bundled into price validation.
6. **`offer_snapshot` commission fields** — still absent, so commission claims are rejected rather than verified.
7. **`isLiveEnabled` dead export** — remove or wire; it is currently decorative in a security-adjacent module.
8. **Gate 4 package** — model, key owner, request limits, token limits, cost ceiling, timeout/retry, prompt/data scope, evidence storage and retention. All still outstanding.

---

## 14. Final Status

**Gate 3 Script Validation Correction: PARTIAL**
The validator is real and fail-closed on invented amounts, discounts, dates, identity tokens, and seven gated categories, and its boundary to `LIVE_LLM` is sound. It is simultaneously over-strict (P1, P7b) and under-strict (P9–P11), carries a masking defect (P7c), and has no state at all for qualitative claims. Declaring PASS would misrepresent these as edge cases; they are on the main path of Thai marketing copy.

**Gate 3 Overall: NOT ACCEPTED — awaiting Owner review of this reconciliation.**

**Gate 4 Authorization: NOT AUTHORIZED** — unchanged, and not advanced by any work in this report.

---

## Appendix — Commands used

```
git rev-parse --show-toplevel && git branch --show-current && git rev-parse HEAD
git status --porcelain            (before, mid, after; diffed)
git status --porcelain <path>     (per-file checks)
git diff --stat / --numstat / --cached --stat
git diff app/mvp/content.js | grep -c "^-[^-]"
git ls-files | wc -l
grep -rn "validateScriptDraft|provenance.liveTrace|allowNetwork|fetchImpl|ACE_LLM_LIVE_ENABLED|isLiveEnabled" app verification
sed -n '/^module.exports/,/^};/p' app/mvp/provider/openrouter.js
node --check app/mvp/content.js
node verification/openrouter-gate3-script-validation-check.js
node verification/openrouter-gate3-offline-check.js
node verification/openrouter-gate3-route-check.js
node verification/mvp-workflow-acceptance.js
node - <<'EOF' … EOF     (six inline probes: price matrix, qualitative claims, LIVE boundary A–E,
                          masking root cause, provenance durability, overlay staleness)
```

No file was written except this report. No `git add`, `commit`, `checkout`, `reset`, `stash`, or branch operation was performed.
