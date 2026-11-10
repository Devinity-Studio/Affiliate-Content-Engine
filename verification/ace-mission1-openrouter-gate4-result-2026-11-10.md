# ACE — OpenRouter Gate 4 Result: FINDING, not PASS

**Date:** 2026-11-10
**Authority:** Owner authorized exactly one live request (`ace-mission1-openrouter-gate4-owner-authorization-2026-11-10.md` §2)
**Executed by:** the agent, on the Owner's instruction, reading the credential from the Owner's local `.env` (the value was never printed, logged or committed)
**Requests sent:** **1 of 1** — no second request was made
**Result:** **FINDING — the live request completed and was paid for in nothing, but the provider returned no usable text; ACE fell back to the deterministic template.**

## 1. What happened

| Item | Observed |
|---|---|
| Route | `POST /api/mvp/content/draft` `{candidateId: "CND-1008", useLlm: true}` → `201` |
| Trace | `6b3bb618-65c8-4eee-a77b-635796decdc0`, `operation: script_draft.create` |
| `executionMode` | **`LIVE`** |
| `trace.source` | `TEMPLATE` (not `LIVE_LLM`) |
| `trace.status` | `graceful_fallback` |
| `trace.fallbackReason` | **`empty_response`** |
| `trace.validation` | `null` (validation never ran — there was no text to validate) |
| `trace.latencyMs` | 773 |
| `boundary` | `external_calls: 1`, `spend_thb: 0`, `real_state_touched: false` |
| Credential | accepted far enough to receive a parsed provider payload (see §2) |

Evidence bundle: `verification/evidence/openrouter/6b3bb618-65c8-4eee-a77b-635796decdc0/` — `trace-record.json`, `script-draft.txt`, `request.log`. The bundle is untracked; it contains accepted Thai copy and must be reviewed before it is committed.

## 2. What this run does and does not prove

**Proven:**

1. The interlock **permits** egress when `ACE_LLM_LIVE_ENABLED=1`. Previously it had only ever been proven to block. **PASS** on that sub-claim.
2. The credential is **accepted**: `empty_response` is only reachable after a response body was parsed into an object with a `choices` array (`app/mvp/provider/openrouter.js:313-319`); a rejected credential, a non-JSON body or a non-2xx status would have produced `auth_error`, `invalid_response` or `provider_error` instead. **PASS** on "the key works against this endpoint".
3. Exactly **one** request left the machine, and `spend_thb` stayed `0`. **PASS** on the package limits.
4. The fallback contract holds on the **live** path, not just offline: the deterministic draft was produced unchanged (`text.length 260`, checksum `93f324f9…6786db8f`, identical to the offline preflight earlier today), the response was still `201`, and the content record was created. **PASS** on "a failed live call cannot break the workflow".
5. The interlock was shut off when the run ended (the runner unsets it and the server process exited). **PASS** on containment.
6. The real workspace state was not touched: `data/mvp/fixture-state.json` mtime `2026-10-30 01:51` before and after; the run used `.tmp/gate4-live/run/state.json`.

**Not proven — the substance of Gate 4:**

1. **The provider contract's text field.** No usable assistant text came back, so nothing yet confirms that `choices[0].message.content` is where this model puts a Thai script.
2. **Live Thai quality.** No live draft exists to read.
3. **Validation on live text.** It did not run.
4. **Price fidelity on live text.** Untested.

Gate 4 exists to prove the exchange end to end. It proved the transport and the containment, not the content. **So Gate 4 is a FINDING, not a PASS.**

## 3. Why the text was empty — what the artifacts can and cannot tell us

The adapter deliberately never echoes the response body, and the trace persists neither `httpStatus` nor `usage` nor `finish_reason`, so the exact cause is **not recorded**. Three candidates remain, in order of likelihood:

1. **The model spent the output budget on reasoning and returned empty content.** The request sets `max_tokens: 700`, `temperature: 0` and nothing that controls reasoning. A reasoning-capable model that exhausts the ceiling emits `finish_reason: "length"` with `content: ""`.
2. **`content` is an array of parts rather than a string.** `textFromResponse` (`openrouter.js:127-135`) accepts only a string at `message.content` or `text`, so any array form degrades to `empty_response`.
3. **`content: null` with the text in a sibling field** (for example a `reasoning` field).

Candidates 2 and 3 are cheap to distinguish; candidate 1 is the one that costs money to confirm, because it needs another request.

## 4. Recommended next step (needs a new authorization)

**One further request, plus a diagnostic capture that makes that request conclusive.** Capture, in the trace and in the log (never the prompt, never the credential):

- `httpStatus`
- `finish_reason` of `choices[0]`
- `usage` (`prompt_tokens`, `completion_tokens`, `total_tokens`), which the adapter already extracts but the trace drops
- the **shape** of `message.content` (type name, and array length if it is an array) — a type fingerprint, not the text

With that, a single request distinguishes all three candidates above. Without it, every attempt is a coin flip that spends an authorized request.

Two decisions belong to the Owner and are **not** taken here:

1. **Whether to grant that second request.**
2. **Whether the package may change.** If the cause is reasoning-token exhaustion, the fixes are `reasoning: { exclude: true }` / `effort: "low"` in the request, a higher output ceiling than 700, or a different model. Each one amends the package the Owner approved (model, 700 tokens, THB 0), so each needs an explicit amendment rather than a quiet edit.

## 5. What did not happen

- No second request. No retry. No model change. No ceiling change. No code change to the provider path.
- Nothing was published, promoted or written into `data/mvp/`.
- The credential was not printed, logged, committed, or copied into any evidence file (checked: no `sk-or-v1-` string anywhere under the evidence directory).

---

**Gate 4 state after this record:** **OPEN — FINDING recorded, awaiting an Owner decision on the diagnostic re-run.** Gate 3 remains **PASS**: none of the offline guarantees it covers were contradicted; the failure occurred on the one path Gate 3 explicitly could not reach.
