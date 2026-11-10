# ACE — OpenRouter Integration: Gate 3 Implementation Report

**Scope executed:** Gate 3 only — offline implementation and offline verification.
**Not executed:** Gate 4. No OpenRouter request was sent, no real API key was used, no `.env` was read, no deployment or commit was made.

- **Branch:** `mission1-planning-docs`
- **HEAD:** `795dc0a6ac66bef19725184107e6474b41aa1823` (unchanged; no commit created)
- **Repository root:** `Y:\DevProject\Affiliate Content Engine`
- **Report:** `verification/ace-mission1-openrouter-gate3-implementation-report-2026-11-01.md`

Status labels: **VERIFIED** (source inspection or an executed command with its exit status), **ANALYSIS**, **PROPOSED**, **UNTESTED ASSUMPTION**, **OWNER DECISION REQUIRED**.

---

## 1. What was built

A narrow opt-in slice: the existing deterministic content path is untouched, and a caller can explicitly ask for a Thai Script Draft from OpenRouter. On any provider, configuration, or validation failure the deterministic script stands and the trace says so honestly.

| File | Change | Purpose |
|---|---|---|
| `app/mvp/provider/openrouter.js` | NEW (429 lines) | One OpenRouter chat-completions call over native `fetch`: key from `process.env.OPENROUTER_API_KEY`, bounded timeout, failure classification, response normalization, zero logging |
| `app/mvp/provider/provenance.js` | NEW (283 lines) | The single writer of `source` / `status` / `executionMode`; enforces the trace allowlist and the provenance matrix |
| `app/mvp/content.js` | MODIFIED (+190) | Adds `buildScriptDraftPrompt`, `validateScriptDraft`, `createScriptDraftWithProvider`; `createContentProject` itself is unchanged |
| `app/mvp/service.js` | MODIFIED (+66/-11) | `handleContentDraft` gains the opt-in branch, the live-egress interlock, and an honest `external_calls` count |
| `.env.example` | MODIFIED | Documents `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `ACE_LLM_LIVE_ENABLED`, and that no `.env` loader exists |
| `verification/openrouter-gate3-offline-check.js` | NEW | 21 offline checks (provider + provenance + content) |
| `verification/openrouter-gate3-route-check.js` | NEW | 6 offline checks driving `handleMvp()` in-process |
| `verification/openrouter-gate3-offline-2026-11-01.log` | NEW | Captured output of the provider/provenance suite |
| `verification/openrouter-gate3-route-2026-11-01.log` | NEW | Captured output of the route suite |

**Deleted files:** none. **Files modified outside this scope:** none.

Owner decisions honoured exactly: key read only from `process.env.OPENROUTER_API_KEY`; no `.env` loader added; no `dotenv`; native `fetch`; no new dependency (`package.json` untouched); Thai Script Draft; opt-in only; PostHog observability never imported or enabled.

---

## 2. Reconciliation before editing — what checked out, and what did not

Reconciled against the Gate 3 readiness brief:

| Brief claim | Result |
|---|---|
| `createContentProject()` at `content.js:422` | **VERIFIED** — still line 422 |
| `buildScript()` at `content.js:388`, assignment at `:510` | **VERIFIED** — unchanged |
| `POST /api/mvp/content/draft` at `service.js:3375` → `handleContentDraft()` at `:2667` | **VERIFIED** — handler now starts at 2667; the route line shifted with my edit, as expected |
| No `.env` loader anywhere | **VERIFIED** — re-confirmed; only `process.env` reads exist |
| `posthog-ai.js` required by no runtime module | **VERIFIED** — still true after my change |
| 38 tracked files | **VERIFIED** — `git ls-files` = 38 |

**One correction to the planned design.** The plan assumed a provider call blocked by an interlock would still let offline tests exercise response handling. That was wrong at first: with egress refused before the injected stub, validation never ran and the offline suite failed on its own test 07 (`provider_disabled` instead of `validation_failed`). The fix is part of the implementation: an injected `fetchImpl` is a test double, not egress, so it runs; real egress still requires `allowNetwork`. This is recorded because the first attempt genuinely failed and the failure shaped the design — not because it looks tidy in hindsight.

---

## 3. Source-code changes in detail

### 3.1 `app/mvp/provider/openrouter.js` — **VERIFIED**

- `generateScriptDraft({ prompt, model, timeoutMs, maxOutputTokens, allowNetwork, fetchImpl, env })` returns a result object; it never throws for provider or configuration problems.
- Failure statuses: `missing_credential`, `invalid_configuration`, `provider_disabled`, `auth_error`, `rate_limited`, `provider_error`, `timeout`, `network_error`, `invalid_response`, `empty_response`, plus `success`.
- Egress rule: `allowNetwork: true` is required **unless** a `fetchImpl` is injected (test seam). `ACE_LLM_LIVE_ENABLED=1` is the operator interlock read by the service layer.
- Timeout: single deadline computed once; both the request and the body read race it; the `AbortController` is aborted on expiry and again in `finally`. The losing promise is detached via `.catch(() => {})` so a late rejection cannot surface as an unhandled rejection.
- Secret hygiene: the credential is placed in the `Authorization` header and nowhere else. The response body is consumed and discarded, including on 401/403, because an auth-error body can echo a shadowed key. Failure results carry a fixed per-kind message plus an optional HTTP status — never a thrown error message. The module contains no `console.*` call at all (asserted by test 11).
- `usage` is reported only when the provider reported it; an absent count stays absent, never zero.

### 3.2 `app/mvp/provider/provenance.js` — **VERIFIED**

The enforced matrix:

| `source` | allowed `status` | allowed `executionMode` |
|---|---|---|
| `LIVE_LLM` | `success` | `LIVE` only |
| `MOCK` | `success` | `OFFLINE_TEST` only |
| `TEMPLATE` | `template_default` | both |
| `TEMPLATE` | `graceful_fallback` (requires `fallbackReason`) | both |

Anything outside this throws (`INVALID_TRACE_RECORD`). This is what makes it structurally impossible for an offline test to write `LIVE_LLM`, and for a deterministic run to be recorded as a live success.

The allowlist is enforced as a **rejection**, not a filter: a caller cannot smuggle a raw request/response payload into evidence (test 09c). `fallbackReason` must be one of a fixed vocabulary, so a provider message can never be pasted into the trace.

### 3.3 `app/mvp/content.js` — **VERIFIED**

- `createContentProject()` is **not modified**. Test 12 and 12b assert the deterministic script still has exactly `version, language, lines, text, checksum` — no `source`, no `trace` — and that a provider run leaves it byte-identical.
- `buildScriptDraftPrompt(project)` writes a Thai prompt from `offer_snapshot` only, with explicit instructions not to invent prices, discounts, or review counts.
- `validateScriptDraft(text)` returns `{ ok, failed }` with named checks: `empty`, `too_short`, `too_long`, `not_thai` (Thai-character ratio < 0.5), `placeholder_leak` (`{{`, `}}`, `[insert`, `TODO`, `lorem ipsum`), `markup`. A failed check becomes `validation_failed` and falls back.
- `createScriptDraftWithProvider({ projectInput, ... })` builds the deterministic project first, then optionally replaces only `script.text` (recomputing `checksum`) and stamps `source`, `lines_source: 'TEMPLATE'`, and `trace`. Per-scene `lines` stay deterministic and are labelled as such.
- Egress needs both `executionMode: 'LIVE'` and `allowNetwork: true`, so an offline test cannot reach the network even if it sets `LIVE`.

### 3.4 `app/mvp/service.js` — **VERIFIED**

`handleContentDraft` accepts `useLlm: true` at the top level or inside `scriptDraft`. Diff shape:

- `const useLlm = body.useLlm === true || (scriptDraftOptions?.useLlm === true);`
- `const liveEnabled = process.env.ACE_LLM_LIVE_ENABLED === '1';`
- Branch: `createScriptDraftWithProvider(...)` when opted in, otherwise the original `createContentProject(...)` call **verbatim**.
- Response gains `trace` (the allowlisted record) and `boundary.external_calls` now reflects whether a request was actually attempted instead of being hardcoded to `0`.

**Deviation flagged for the Owner:** `ACE_LLM_LIVE_ENABLED` is a new environment variable that was not in the approved plan. It exists solely to keep Gate 4 unreachable: without it, a key present in the environment plus an opt-in request would have sent a real request, which Gate 3 does not authorize. **OWNER DECISION REQUIRED** — acknowledge this interlock, or specify a different gate.

---

## 4. Offline test results

Both suites were run in this session. Commands and observed exit statuses:

```
node verification/openrouter-gate3-offline-check.js     → exit 0, 21/21 checks passed
node verification/openrouter-gate3-route-check.js       → exit 0,  6/6 checks passed
node verification/content-creation-acceptance.js        → exit 0, 62/62 (pre-existing suite)
node verification/mvp-workflow-acceptance.js            → exit 0, 56/56 (pre-existing suite)
```

Coverage of the twelve required cases:

| Required case | Check | Result |
|---|---|---|
| 1. Missing API key | 01, C1 | pass — `missing_credential`, 0 fetch calls |
| 2. Invalid/malformed configuration | 02 | pass — 4 refusals (whitespace key, bad model slug, bad timeout, empty prompt), 0 requests |
| 3. Provider error response | 03 | pass — 401/403→`auth_error`, 429→`rate_limited`, 500/502→`provider_error`, body never echoed |
| 4. Timeout | 04, 04b | pass — hanging fetch returns `timeout` in 65 ms; thrown fetch → `network_error` |
| 5. Malformed response | 05 | pass — HTML body → `invalid_response` |
| 6. Empty output | 06 | pass — 4 empty shapes → `empty_response` |
| 7. Validation failure | 07, 07b | pass — non-Thai draft → `validation_failed`; placeholder/markup/short drafts rejected |
| 8. Explicit deterministic fallback | 08, 08b | pass — `source=TEMPLATE`, `status=graceful_fallback`, text and checksum equal the deterministic result |
| 9. Mock provenance | 09, 09b, 09c | pass — stubbed success is `MOCK`/`OFFLINE_TEST`; 4 impossible combinations rejected; payload smuggling rejected |
| 10. Trace schema consistency | 10, 10b | pass — 12/12 allowlisted fields, one schema for mock/template/fallback, usage absent when unreported |
| 11. Secret redaction | 11, 11b | pass — 9 output surfaces free of the canary, header sent exactly once, no `console.*` in the provider, key absent from the body |
| 12. Deterministic behaviour unchanged | 12, 12b, A1, D1 | pass — deterministic script keys unchanged and stable; a provider attempt does not alter it |

Route-level checks (in-process `handleMvp`, `globalThis.fetch` replaced by a recorder that throws): default draft returns 201 with `trace: null` and `external_calls: 0`; opt-in with a key but no interlock → `provider_disabled` and 0 requests; opt-in with the interlock but no key → `missing_credential` and 0 requests; all three written projects are `synthetic` with `DETERMINISTIC_TEMPLATE_FROM_EXPORT`.

**No existing test was weakened, skipped, or edited.** The two pre-existing suites were run unmodified and pass.

---

## 5. Actual execution evidence

- Commands run: the four `node` invocations above, plus `node --check` on the three touched source files (clean), `git status --porcelain`, `git diff`, `git ls-files`.
- `executionMode: OFFLINE_TEST` for every trace produced in this session. Offline logs are the evidence:
  - `verification/openrouter-gate3-offline-2026-11-01.log` — 21/21, `network calls made to OpenRouter: 0`, `real API key used: no`
  - `verification/openrouter-gate3-route-2026-11-01.log` — 6/6, `network calls made: 0`, `real API key used: no`
- **No evidence bundle was created at `verification/evidence/openrouter/<trace-id>/`.** There is no live trace to bundle, and manufacturing an offline one under that path would blur exactly the distinction the Evidence Contract exists to protect. The `traceId`, `executionMode: OFFLINE_TEST`, and `source: MOCK`/`TEMPLATE` records inside the two logs carry the same schema a live bundle would use. Retention policy is still an open Owner decision.

### 5.1 Test-isolation defect found (pre-existing, not caused by this change)

`verification/content-creation-acceptance.js` writes its export entry into the **real** tracked file `data/mission1/content-library.json` (it does not override `ACE_CONTENT_LIBRARY_FILE`). Running it for regression turned `[]` into a one-item library containing `CNT-1-v5.mp4` from a temporary workspace. I restored the file exactly with `git checkout -- data/mission1/content-library.json` and confirmed the bytes are `[]\r\n` again.

This is a real pre-existing gap: a routine test run dirties a tracked file. I did not fix it, because the assignment scope is the OpenRouter slice and the fix is a decision about that suite's configuration. **Flagged for the Owner.**

---

## 6. Untested assumptions

These are written plainly because Gate 3 cannot close them:

1. **The provider contract is unverified.** The endpoint `https://openrouter.ai/api/v1/chat/completions`, the `Authorization: Bearer` header name, the `messages`/`max_tokens`/`temperature`/`stream` request body, and the `choices[0].message.content` + `usage.prompt_tokens`/`completion_tokens` response shape were written from documentation knowledge. Nothing in this session confirms OpenRouter accepts or returns them. **Only Gate 4 can confirm this.**
2. **The default model string is a placeholder.** `nvidia/nemotron-3.5-lightning:free` was used only so wiring has a syntactically valid slug. It is not an approved live-test model and was not resolved against OpenRouter.
3. **Prompt quality is unmeasured.** The Thai prompt is built only from `offer_snapshot`, but no model output has ever been seen, so whether the model obeys the "no invented numbers" instruction is unknown.
4. **Token accounting is approximate at best** — `max_tokens` is passed, but no real completion has been measured against it.
5. **Price fidelity is not validated.** `validateScriptDraft` checks language, length, placeholders, and markup. It does **not** check that a number in the draft matches `offer_snapshot`. A model could state a wrong price and still pass validation. **This is the weakest link in the current design.**
6. **Retry behaviour is untested** because there is no retry: one request, no automatic repeat. That is deliberate for a first slice but is a choice, not a verified property.
7. **`ACE_LLM_LIVE_ENABLED` semantics are unexercised live** — the interlock is proven to block, never proven to permit, since permitting would be Gate 4.
8. **The `HTTP-Referer` value is `https://local.ace.invalid`** — a deliberate non-routable placeholder. Whether OpenRouter cares is unknown.

---

## 7. Remaining Gate 4 risks

- **Contract mismatch** (item 1 above) — the most likely single point of failure.
- **Cost exposure** — with one request, one call; but no ceiling is enforced in code beyond `max_tokens`. The Owner-approved cost ceiling still needs a mechanism.
- **Secret exposure at the provider boundary** — the module never logs the key, but a 401 body is discarded rather than inspected; if OpenRouter echoes a key fragment, ACE never sees it, which is correct but means ACE also cannot detect that leak class.
- **Privacy** — the prompt transmits `product_name`, both prices, promo label, rating and rating count to a third party. Gate 4 must confirm these fields are approved for egress and that no real Shopee user data enters the prompt.
- **A live request cannot be proven from offline evidence.** Gate 4 must produce its own trace with `executionMode: LIVE`, and the honest possibility that it fails must be budgeted for.

---

## 8. Final state

### 8.1 Working-tree changes

Starting baseline for this assignment: `143` porcelain entries, `M` entries none.

```
=== TRACKED DIFF STAT ===
 app/mvp/content.js | 190 ++++++++++++++++++++++
 app/mvp/service.js |  66 ++++++---
 2 files changed, 245 insertions(+), 11 deletions(-)
```

Per-entry comparison against the pre-assignment baseline:

```
>  M app/mvp/content.js                                  (modified, in scope)
>  M app/mvp/service.js                                  (modified, in scope)
> ?? app/mvp/provider/                                   (new: provider/openrouter.js, provider/provenance.js)
> ?? verification/openrouter-gate3-offline-check.js      (new)
> ?? verification/openrouter-gate3-offline-2026-11-01.log (new)
> ?? verification/openrouter-gate3-route-check.js        (new)
> ?? verification/openrouter-gate3-route-2026-11-01.log  (new)
```

Plus this report. `data/mission1/content-library.json` was transiently dirtied by the pre-existing acceptance suite and has been restored to `[]\r\n` (its HEAD content); it no longer appears in the diff. No other entry was added, removed, or changed. No file was staged, no commit created, no branch changed.

Line endings: both modified files remain pure LF (0 CRLF), matching their previous state; the diff shows insertions only, so no line-ending churn was introduced.

### 8.2 Isolation guarantees

- `.tmp/gate3-route-check/` holds the route suite's disposable fixture state; it is inside the git-ignored `.tmp/` scratch area.
- The route suite never touched `data/mvp/`, `data/app/state.json`, or the real content library.
- No external network request was made by any command in this session. The route suite additionally replaced `globalThis.fetch` with a throwing recorder, so a broken interlock would have failed the run rather than reached the internet.

### 8.3 Deterministic path intact

**VERIFIED.** `createContentProject()` is byte-for-byte unmodified; its script object still carries exactly `version, language, lines, text, checksum`; the multi-step acceptance suite (62/62) and the workflow acceptance suite (56/56) pass unmodified; and `createScriptDraftWithProvider` leaves the deterministic output identical when it falls back.

---

## 9. Open items for the Owner

1. **Acknowledge `ACE_LLM_LIVE_ENABLED`** as the egress interlock (new variable, added to keep Gate 4 unreachable). **OWNER DECISION REQUIRED**
2. **Gate 4 package** — model, key owner, request count, input/output token limits, maximum cost, timeout and retry policy, prompt/data scope, evidence storage and retention, time window and operator. **OWNER DECISION REQUIRED**
3. **Price-fidelity validation** — decide whether a live draft must be checked against `offer_snapshot` numbers before it can be labelled `LIVE_LLM`. Recommended before Gate 4. **PROPOSED**
4. **Evidence path and retention** — the `verification/evidence/openrouter/<trace-id>/` proposal is not git-ignored; decide storage, retention, and commit permission. **OWNER DECISION REQUIRED**
5. **Test-isolation defect** in `content-creation-acceptance.js` (writes the real content library). **OWNER DECISION REQUIRED**
6. **Retry policy** — currently zero retries; confirm that is the intended first-slice behaviour. **PROPOSED: keep 0**

---

## 10. Stop condition

Gate 3 scope is complete and verified offline. **Gate 4 remains NOT AUTHORIZED and was not started.** Nothing in this build can reach the network without an operator explicitly setting `ACE_LLM_LIVE_ENABLED=1` **and** supplying a real key, and even then no live test has been run or approved.

Stopping here for Owner review.
