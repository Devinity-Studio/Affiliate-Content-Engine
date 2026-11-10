# ACE — OpenRouter Integration: Owner Gate 3 PASS Decision Record

**Date:** 2026-11-10
**Authority:** Owner (sole Gate 3 PASS authority, per the 2026-11-01 ratification §Q7)
**Decision:** **Gate 3 — PASS**
**Scope accepted:** the offline implementation of the opt-in Script Draft operation and its offline verification evidence, committed on the same date in three commits (runtime, verification, documentation).
**Not changed by this record:** Gate 4 remains **NOT AUTHORIZED**; no live OpenRouter request has been made, no real API key has been used, and no paid spend has occurred.

## Status labels

- **VERIFIED** — established by a re-run check in this pass.
- **ACCEPTED** — approved by the Owner in this decision.
- **NOT AUTHORIZED** — explicitly outside this approval.
- **OPEN** — still requires an Owner decision before Gate 4.

---

## 1. Authorization state after this record

| Gate | State |
|---|---|
| Gate 1 — OpenRouter as first AI Provider | APPROVED (unchanged) |
| Gate 2 — Proof Contract v0.1 | APPROVED (unchanged) |
| Gate 3 — Implementation | **PASS — ACCEPTED** |
| Gate 4 — Live API Test | **NOT AUTHORIZED** |

**ACCEPTED.**

## 2. Evidence this PASS rests on

Re-run on 2026-11-10 against the committed tree. All suites exit `0`; none made a network call and none used a real key.

| Suite | Result | Log |
|---|---|---|
| `verification/openrouter-gate3-offline-check.js` | 21/21 passed | `openrouter-gate3-offline-2026-11-01.log` |
| `verification/openrouter-gate3-route-check.js` | 6/6 passed, 0 requests | `openrouter-gate3-route-2026-11-01.log` |
| `verification/openrouter-gate3-script-validation-check.js` | 20/20 passed | `openrouter-gate3-script-validation-2026-11-01.log` |
| `verification/mvp-workflow-acceptance.js` (regression) | 86/86 passed, 0 commits created | — |
| `node --check` on `content.js`, `service.js`, `provider/openrouter.js`, `provider/provenance.js` | passed | — |

**VERIFIED.**

## 3. What was accepted

1. The opt-in operation `createScriptDraftWithProvider()` alongside, not inside, the unchanged deterministic `createContentProject()`. With no opt-in flag the previous behaviour is byte-identical. **ACCEPTED.**
2. `app/mvp/provider/openrouter.js` — one endpoint, native `fetch`, no new dependency, key read only from `process.env.OPENROUTER_API_KEY`, never logged or echoed. **ACCEPTED.**
3. `app/mvp/provider/provenance.js` — provenance is decided by ACE, not by the provider; a template result cannot record itself as live. **ACCEPTED.**
4. `validateScriptDraft()` — evidence-based rejection of prices, discounts, dates, identifiers and unprovable claim categories (commission, shipping, stock, guarantee, gift, personal experience, certification) that `offer_snapshot` cannot support. **ACCEPTED.**
5. The egress interlock `ACE_LLM_LIVE_ENABLED`, unset by default, added during implementation to keep Gate 4 structurally unreachable. **ACCEPTED as part of this PASS**, with the limitation in §4.1 restated. **ACCEPTED.**

## 4. Limitations this PASS does not remove

1. **The provider contract is unverified.** The endpoint path, the `Authorization: Bearer` header, the request body shape and the response field names were written from documentation. The interlock is proven to block, never proven to permit. **OPEN — closable only by Gate 4.**
2. **No live `LIVE` trace exists.** Every recorded trace in this build carries `executionMode: OFFLINE_TEST`. **OPEN.**
3. **Privacy of the prompt is not yet approved.** The prompt transmits `product_name`, both prices, the promo label, rating and rating count. Whether those fields may leave the machine is a Gate 4 question. **OPEN.**
4. **Price-fidelity policy for a live draft** — whether a live draft must be checked against `offer_snapshot` numbers before it may be labelled `LIVE_LLM` — was recommended, not decided. **OPEN.**

## 5. Owner decisions still required before Gate 4

1. **Gate 4 package:** model slug, key owner, permitted request count, token ceiling, maximum spend, timeout/retry policy, prompt and data scope, evidence storage and retention, time window and operator. **OPEN.**
2. **Live price-fidelity rule** for accepting a live draft. **OPEN.**
3. **Acknowledged accepted risk:** Gate 4 may fail on the first real exchange. A failure is recorded as a Gate 4 finding, not as a Gate 3 regression. **ACCEPTED.**

## 6. What this record does not do

It does not authorize a live call, it does not select a production model, it does not approve the prompt's data scope for egress, and it does not declare Mission 1 or any other gate complete.

---

**Owner decision:** Gate 3 — PASS (2026-11-10). Gate 4 — still NOT AUTHORIZED.
