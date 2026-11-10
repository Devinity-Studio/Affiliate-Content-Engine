# ACE — OpenRouter Gate 4 Result: PASS

**Date:** 2026-11-10
**Authority:** Owner. Request #1 under `…-gate4-owner-authorization-2026-11-10.md`; the diagnostic re-runs under the Owner's in-session authorization of 2026-11-10, which approved both the diagnostic capture and an amendment to the package (raise the output ceiling, disable internal reasoning).
**Executed by:** the agent, on the Owner's instruction, with the credential read from the Owner's local `.env` — never printed, logged, or committed.
**Result:** **PASS.** One request (#7 of the sequence) produced a live Thai draft that ACE accepted.

## 1. The passing run

| Item | Observed |
|---|---|
| Trace | `fb1e140c-5f22-4f51-85eb-4abfe8d0032a`, `script_draft.create`, `openrouter` |
| Model | `nvidia/nemotron-3.5-lightning:free` |
| `executionMode` | `LIVE` |
| `trace.source` | **`LIVE_LLM`** |
| `trace.status` | `success` |
| `trace.validation` | `{ ok: true, failed: [] }` |
| `trace.fallbackReason` | `null` |
| `usage` | 475 in / 258 out |
| `latencyMs` | 734 |
| `boundary` | `external_calls: 1`, `spend_thb: 0`, `real_state_touched: false` |
| Draft | 435 chars, checksum `43eaa2a8…d49ce6c4c`, `lines_source` still `TEMPLATE` (per-scene lines stay deterministic) |
| HTTP | `200`, `finish_reason: stop`, `content` is a string, body read clean |

Evidence bundle: `verification/evidence/openrouter/fb1e140c-5f22-4f51-85eb-4abfe8d0032a/` — `trace-record.json`, `script-draft.txt`, `provider-diagnostics.log`, `server.log`. Untracked by design: it contains accepted Thai copy.

**Every Gate 4 acceptance condition in the authorization record is met.**

## 2. The diagnostic chain (7 requests, 1 PASS)

Each request changed or measured one variable. Metadata only — no prompt, no completion text, no credential.

| # | Ceiling | `reasoning` | Result | What it established |
|---|---|---|---|---|
| 1 | 700 | absent | `empty_response`, `content` parsed but empty | the exchange works; no usable text |
| 2 | 2400 | `{exclude:true}` | `invalid_response` (200, body unreadable) | larger ceiling alone did not help |
| 3 | 2400 | `{exclude:true}` | `invalid_response` (200, `bodyChars 0`) | repeatable, not a fluke |
| 4 | 2400 | absent | `invalid_response`, `bodyError: true`, `contentType: application/json` | the body **read failed**; not an empty response |
| 5 | 700 | absent | `empty_response`, **`finish_reason: length`, `contentKind: null`, `reasoningChars 2187`, output 700** | **root cause**: reasoning consumed the entire budget |
| 6 | 1200 | `{enabled:false}` | provider `success`, 249 output tokens, but `validation_failed` | reasoning off ⇒ real text; the validator then did its job |
| 7 | 1200 | `{enabled:false}` | **`success` + `LIVE_LLM` + validation ok** | **PASS** |

## 3. Root cause, and the mistake it corrects

The configured model is a **reasoning model**, and OpenRouter documents that for such models `max_tokens` covers reasoning tokens *and* visible output — "a small max_tokens can be consumed entirely by reasoning, returning `finish_reason: 'length'` with empty content" (openrouter.ai/docs/api-reference/parameters). Request #5 measured exactly that.

The first fix attempt was wrong, and the record keeps the mistake because it is instructive: `reasoning: { exclude: true }` **only hides the reasoning field**; the tokens are still billed and still count against `max_tokens` (openrouter.ai/docs/guides/reasoning-tokens). The parameter that actually disables reasoning is `reasoning: { enabled: false }`. Requests #2 and #3 therefore changed nothing about the budget.

Unresolved, and not blocking: requests #2–#4 at a 2400 ceiling returned HTTP 200 with an unreadable body (`bodyError: true`) while the same endpoint at 700 and 1200 returned parseable JSON. The cause was not established and is **not** attributed to the reasoning parameter, which request #4 had already removed. It is recorded here as an open observation, not a Gate 4 failure — the passing configuration does not exhibit it.

## 4. Package amendment applied (Owner-authorized)

| Parameter | Original | Amended |
|---|---|---|
| Output ceiling | ≤ 700 tokens | **1200** (`DEFAULT_MAX_OUTPUT_TOKENS`, still bounded by `MAX_OUTPUT_TOKENS` 4000) |
| Internal reasoning | not controlled | **disabled** in every request (`reasoning: { enabled: false }`) |
| Model | unchanged | `nvidia/nemotron-3.5-lightning:free` |
| Spend | THB 0 | unchanged, THB 0 across all 7 requests |
| Requests | 1 | 1 authorized + 6 under the Owner's diagnostic authorization |

## 5. Code changed in this pass

All in the provider path and its caller; the deterministic path and the trace schema are untouched.

1. `app/mvp/provider/openrouter.js`
   - `DEFAULT_MAX_OUTPUT_TOKENS` 700 → **1200**, with the measurement that justifies it.
   - Requests now send `reasoning: { enabled: false }` by default (opt out with `disableReasoning: false`).
   - New `diagnosticsFromPayload()` and `describeContentShape()`: `httpStatus`, `finish_reason`, `choiceCount`, `usage`, and the *type* of `message.content` (plus array length) and `reasoningChars`. No text is captured.
   - Unparseable bodies report `bodyChars`, `bodyError`, `bodyErrorName`, `timedOut`, `content-type`, `content-length` — never the body.
   - `ACE_LLM_MAX_OUTPUT_TOKENS` allows a bounded override for measured runs.
2. `app/mvp/content.js`
   - One `[ace] provider diagnostics …` log line per attempted live request: metadata only.
   - One `[ace] draft validation rejected …` line on a validation failure, carrying rule codes and the snapshot field each rule compared against. The finding's `claim` slice (draft text) is deliberately dropped.

No prompt, completion text, or credential appears in either log — verified by searching the run artifacts for `sk-or-v1-` (clean).

## 6. Regression checks after the change

| Suite | Result |
|---|---|
| `openrouter-gate3-offline-check.js` | 21/21 |
| `openrouter-gate3-route-check.js` | 6/6 (0 requests) |
| `openrouter-gate3-script-validation-check.js` | 20/20 |
| `mvp-workflow-acceptance.js` | passed, 0 commits created |
| `site-article-acceptance.js` | 18 passed, 0 failed |
| `check-content-library.js` | index parses, 0 entries |

The real workspace was never written: every run used `.tmp/gate4-live/run/state.json`; `data/mvp/fixture-state.json` kept its `2026-10-30 01:51` mtime throughout.

## 7. What PASS does and does not mean

**Means:** the endpoint, credential, request shape, response field (`choices[0].message.content`), ACE's Thai/price/claim validation, and the fallback path are all confirmed against the real provider, at THB 0, with one call per run and no leakage.

**Does not mean:** that the live draft is publishable. It is a fixture-data draft with `lines_source: TEMPLATE`; narration is still absent; no human has read it as copy; and the accepted text lives only in an untracked evidence bundle.

**Open, for the Owner:**

1. Whether the evidence bundle's Thai draft may be committed, or stays local.
2. Whether the 2400-ceiling body-read anomaly deserves its own investigation.
3. Whether a live draft should ever be able to reach `FINALIZED` without human review — currently nothing forces that review.

---

**Gate 4 state: PASS.** Gate 3 remains PASS and was re-verified after every change in this pass.
