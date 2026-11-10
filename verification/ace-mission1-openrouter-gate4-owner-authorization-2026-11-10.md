# ACE — OpenRouter Gate 4 Owner Authorization (Live API Test)

**Date:** 2026-11-10
**Authority:** Owner (sole Gate 4 authorization authority)
**Decision:** **Gate 4 — AUTHORIZED**, package as recorded in §2
**Executed by:** Owner (BombINdyBoy), who runs the live request and records the evidence
**Prepared by:** this pass (wiring, preflight, runbook — no live request)
**Result:** **NOT RUN — blocked on credential.** `OPENROUTER_API_KEY` is not present in this machine's environment, so no live request has been sent. See §6.

## Status labels

- **AUTHORIZED** — approved by the Owner in this decision.
- **VERIFIED** — established by an executed check in this pass.
- **NOT RUN** — not executed; no result may be inferred.
- **NOT AUTHORIZED** — outside this approval.

---

## 1. Authorization state

| Gate | State |
|---|---|
| Gate 1 — OpenRouter as first AI Provider | APPROVED |
| Gate 2 — Proof Contract v0.1 | APPROVED |
| Gate 3 — Implementation | **PASS** (`ace-mission1-openrouter-gate3-owner-pass-2026-11-10.md`) |
| Gate 4 — Live API Test | **AUTHORIZED** by this record |

This record supersedes the "Gate 4 — NOT AUTHORIZED" line in the Gate 3 PASS record for the scope in §2 only. The earlier record is left unedited, per the append-only convention.

## 2. Approved package

| Parameter | Approved value |
|---|---|
| Model | `nvidia/nemotron-3.5-lightning:free` (the module default; no other model may be used under this authorization) |
| Requests | **1** — a second request needs a new authorization |
| Output ceiling | ≤ 700 output tokens (module `DEFAULT_MAX_OUTPUT_TOKENS`) |
| Prompt ceiling | ≤ 8,000 characters (module `MAX_PROMPT_CHARS`) |
| Timeout | 20 s default; ≤ 60 s hard cap (module `MAX_TIMEOUT_MS`) |
| Spend | **THB 0** — the approved model is free; any provider charge is a stop condition, not an accepted cost |
| Operator | Owner, running the command himself |
| Evidence owner | Owner; the evidence bundle in §5 is the artifact Gate 4 is judged on |

**AUTHORIZED.**

## 3. What this authorizes, precisely

One `POST /api/mvp/content/draft` request, with `useLlm: true`, against a **fixture-state** workspace, with `ACE_LLM_LIVE_ENABLED=1` and `OPENROUTER_API_KEY` present in the operator's process environment, producing one `executionMode: LIVE` trace.

**ACCEPTED.** It does not authorize: a second request, a different model, a real Shopee export in the prompt, any publish step, any spend, or leaving the interlock enabled after the test.

## 4. Preflight executed in this pass — VERIFIED, no egress

The runbook in §5 was executed end to end against a throwaway state file, with the interlock unset and no key, on port 4460:

| Step | Result |
|---|---|
| `POST /api/mvp/import` (fixture) | `201` |
| `POST /api/mvp/candidates/generate` | `201` |
| `POST /api/mvp/candidates/select` (`method: research`, `count: 5`) | `201`, 3 candidates added (`added_count: 3`) |
| `POST /api/mvp/candidates/CND-1008/action` (`action: SAVE`) | `200` |
| `POST /api/mvp/content/draft` (`useLlm: true`) | `201` |

The draft response proved the wiring and the refusal path:

```
trace.source = TEMPLATE, status = graceful_fallback,
executionMode = OFFLINE_TEST, fallbackReason = missing_credential
boundary = { external_calls: 0, spend_thb: 0, real_state_touched: false }
```

So the sequence, the route contract and the fallback are correct today; the only missing element is the credential. The real `data/mvp/fixture-state.json` was not touched (preflight used `.tmp/gate4-preflight/`).

## 5. Runbook — what the Operator runs

Set the credential in **your own shell**. Never paste it into a chat or a file in this repository; the app reads it only from the process environment.

```bash
# Git Bash, from the repository root
export OPENROUTER_API_KEY='<your key>'        # never echo or commit this
export ACE_LLM_LIVE_ENABLED=1                 # unlock egress for this one request
export ACE_MVP_STATE_FILE="$PWD/.tmp/gate4-live/state.json"
export ACE_MVP_STAGING_FILE="$PWD/.tmp/gate4-live/staging.json"
mkdir -p .tmp/gate4-live
node app/server.js                            # leave running; default port 4173
```

In a second shell:

```bash
H='content-type: application/json'
B=http://127.0.0.1:4173

curl -s -X POST -H "$H" -d '{}' $B/api/mvp/import
curl -s -X POST -H "$H" -d '{}' $B/api/mvp/candidates/generate
curl -s -X POST -H "$H" -d '{"method":"research","context":"add","count":5}' \
  -o .tmp/gate4-live/select.json $B/api/mvp/candidates/select

CID=$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('.tmp/gate4-live/select.json','utf8')).added[0].id)")
curl -s -X POST -H "$H" -d '{"action":"SAVE"}' $B/api/mvp/candidates/$CID/action

# the one authorized request
curl -s -X POST -H "$H" -d "{\"candidateId\":\"$CID\",\"useLlm\":true}" \
  -o .tmp/gate4-live/draft.json $B/api/mvp/content/draft
```

Then close the interlock immediately:

```bash
unset ACE_LLM_LIVE_ENABLED      # back to the default: no egress
```

**Use relative paths for files Node reads.** A `/y/...` style path is accepted by `curl` but not by Node's `require`/`readFileSync` resolution on this machine.

## 6. Blocker — why the live request has not run

`OPENROUTER_API_KEY` is **not set** in this environment (`ACE_LLM_LIVE_ENABLED` unset as well). The code intentionally refuses before any socket is opened, which is what §4 observed as `fallbackReason: missing_credential`.

Nothing in this repository, and no configuration I can change, provides that credential. It must be supplied by the Owner in the process environment, in the shell that starts the server. **NOT RUN.**

## 7. What a Gate 4 PASS requires

The one response must show all of:

1. `trace.executionMode === 'LIVE'`
2. `trace.source === 'LIVE_LLM'` (provenance is decided by ACE, not by the provider)
3. `trace.validation.ok === true`, with the accepted Thai text present in `project.script.text`
4. `boundary.external_calls === 1` and `boundary.spend_thb === 0`
5. an evidence bundle written to `verification/evidence/openrouter/<traceId>/` containing `trace-record.json`, `script-draft.txt` and the request log — this path stays **uncommitted** until it is reviewed, because it holds accepted Thai copy derived from the offer snapshot

Anything less — a fallback, a validation rejection, an auth error, a timeout — is recorded as a **Gate 4 finding**. It is not a Gate 3 regression: Gate 3 covers wiring, validation and failure handling, all of which already passed.

## 8. Known limitations carried into Gate 4

1. The provider contract (endpoint path, `Authorization: Bearer`, body shape, response field names) is still documentation-derived. Gate 4 is the first real proof of it. **NOT RUN.**
2. The interlock has never been proven to *permit* a request, only to block one. **NOT RUN.**
3. Prompt egress includes `product_name`, both prices, the promo label, rating and rating count. This bundle is fixture data, which is why it is acceptable here; real Shopee data needs its own decision. **AUTHORIZED for fixture data only.**
4. The live price-fidelity rule (whether an accepted live draft must be re-checked against `offer_snapshot` before being labelled `LIVE_LLM`) is still undecided. The validator in Gate 3 does run on the live path with the same rules, so a fabricated price is rejected rather than accepted. **ACCEPTED with that caveat.**

---

**Owner decision:** Gate 4 authorized for exactly one free-model request on fixture data, THB 0, executed by the Owner. Live result: **NOT RUN — awaiting credential.**
