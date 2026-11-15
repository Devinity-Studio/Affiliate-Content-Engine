# Research Brief — PostHog AI Observability (ACE)

**Date:** 2026-10-31
**Type:** Read-only research. **No code, test, state, or configuration was changed. No commit, no push.**
**Status of the subject under study:** `PENDING` (offline half 10/10; live half never executed — no `POSTHOG_API_KEY`)

| Pin | Value |
|---|---|
| `app/observability/posthog-ai.js` | 8,859 B · sha256 `b220648dc3078579bd19334ffe87ec255d393f3b90fcdf25a6e809469d135f56` |
| `verification/posthog-ai-observability-check.js` | 10,905 B · sha256 `7d818f4daa0eea22ca8004af0411f0c414daa837829b70da92f70088afcbdca2` |
| `@posthog/ai` (installed) | 8.17.0 |
| `posthog-node` (installed) | 5.57.2 |
| Node.js used for probes | v24.20.0 (project `engines: >=18`) |
| Branch / HEAD at time of research | `mission1-planning-docs` / `795dc0a` |

---

## 0. Scope decision — and how to change it

The trigger for this run was the single word **"Research"**, with no subject. No one was available to disambiguate, so the scope was chosen by the following test: *which open question in this repository has a verifiable gap that public documentation and local observation can actually settle, without touching frozen code or pre-empting an owner decision?*

Candidates considered and rejected:

| Candidate | Why not researched |
|---|---|
| T4 markdown footer | Blocked on owner-supplied source text. Not a factual question; research cannot supply it. |
| Defect #4 `user_custom` | Design already ratified (`user-custom-v1-design-ratified-2026-10-26.md`), implementation explicitly **NOT AUTHORIZED**. Research here would become design/implementation work. |
| Content Artifact v1 baseline | Frozen and ratified; nothing open that is researchable rather than decidable. |
| **PostHog AI observability** | **Selected.** Newest addition (2026-10-28), status `PENDING`, and it was reviewed only for *non-impact on the core workflow* — never for whether the instrumentation is correct. Its claim surface is checkable against vendor docs and the installed SDK. |

**If this was not the intended subject:** nothing here is destructive or binding. The brief is one new file; delete it and state the intended subject, and the same method applies to it.

---

## 1. Evidence classes

Every claim below is tagged with how it was established. Nothing in this brief rests on inference alone.

- **E1 — Vendor documentation.** PostHog public docs, fetched 2026-10-31, quoted with URLs in §9.
- **E2 — Installed dependency source.** The actual `dist` bundles of `@posthog/ai@8.17.0` and `posthog-node@5.57.2` in `node_modules`, read locally.
- **E3 — Local observation.** A probe (`.tmp/obs-probe/research-probe.js`) that calls the real `captureAiGeneration` with a recording stub client. **No network request is made.** Results are printed values, not expectations.
- **E4 — Repository facts.** `rg`/file pins over this working tree.

Where a question could only be answered with a live PostHog project, it is listed in §6 as *not established* rather than guessed.

---

## 2. What exists today (E4)

1. `app/observability/posthog-ai.js` exports `isEnabled`, `getClient`, `captureGeneration`, `traceGeneration`, `usageFromResponse`, `outputFromResponse`, `shutdown`.
2. `package.json` declares `@posthog/ai@8.17.0` and `posthog-node@5.57.2` as **regular dependencies**, and a script `check:posthog`.
3. `.env.example` documents `POSTHOG_API_KEY` (optional; empty = pass-through) and `POSTHOG_HOST`.
4. `verification/posthog-ai-observability-check.js` runs two halves: offline (child process, key deleted) and live (parent process, key required). Re-run today, unchanged, on the bytes pinned above: `10/10 checks passed`, exit 0 — the offline baseline still reproduces.
5. `app/README.md` contains **no** mention of PostHog or observability — operator documentation exists only in the module docstring and `.env.example`.
6. Prior reconciliation documents classify these files as "sponsored changes … do not alter the core ACE MVP workflow, content lifecycle, publish logic, or Content Library behavior". That conclusion is consistent with everything found here: **every finding below is confined to the observability seam and none touches the content workflow.**

---

## 3. Findings

Severity is stated **relative to the observability feature's own purpose**. None of these is a core-workflow defect.

### F1 — The wrapper is not wired into any AI call · **high (for the feature) / none (for core)** · E4

`traceGeneration` has **zero call sites** in `app/`. The only occurrences of the name are its definition, its export, and the usage example inside its own docstring.

Consequence: even with a valid key, the running application emits no `$ai_generation` events, because nothing calls the wrapper. The feature is a library plus a self-test, not live instrumentation. The live check's own probe note says so: `'seam check — no LLM provider is integrated in this project yet'`.

### F2 — `captureGeneration()` returning `true` does not mean "delivered" · **high** · E2 + E3

`@posthog/ai@8.17.0` swallows every capture failure internally:

```js
} catch (error) {
    try { options.onError?.(error); } catch {}
    console.warn("[PostHog AI] Failed to capture generation telemetry:", error);
}
```

So `captureAiGeneration` **never rejects**. The `try/catch` in ACE's `captureGeneration` therefore only fires on a synchronous `require` failure; on any delivery problem the function still falls through to `return true`, and the error goes to `onError` → `console.warn` → discarded.

Independently confirmed at the transport layer (E3): `posthog-node`'s `captureImmediate` **resolved with no error** against an unreachable host (`http://127.0.0.1:9`, connection refused).

Consequence: the boolean is "handed to the SDK", not "accepted by PostHog". It cannot be used as delivery evidence, and the absence of a warning is not evidence either.

### F3 — `$ai_output_choices` does not match the documented shape · **medium** · E1 + E2 + E3

Documented contract (E1): `$ai_output_choices` is a *"List of response choices from the LLM. Each choice should have a `role` property with one of: `user`, `system`, or `assistant`."*

Implementation (E2): the SDK assigns the caller's output verbatim — `$ai_output_choices: safeOutput`, where `safeOutput = toJsonSafeValue(options.output)`. No normalisation into a choices list.

Observed (E3), with the value ACE's own `outputFromResponse()` produces for a Gemini response (`response.text`, a bare string):

```
$ai_output_choices : typeof = string | isArray = false | value = "generated promo text"
```

Same for the Anthropic branch, where `outputFromResponse()` returns `response.content` (content blocks with no `role`):

```
$ai_output_choices : [{"type":"text","text":"hello"}]   |  [0].role present? false
```

So for the three provider families the module claims to support, the field is respectively a string, a role-less block array, and (for unknown shapes) the whole response object. **What this does to the AI Observability UI is not established** — that needs a live project (§6). What *is* established is that the emitted event does not conform to the documented property contract.

### F4 — `$ai_session_id` is never sent · **low** · E1 + E4

Docs (E1): the property is optional, but *"A workload that finishes in a single trace … Send it as `null` on those to say so explicitly, which tells the instrumentation checklist the workload is complete rather than missing a session id."*

ACE never sets it (E4: 0 occurrences). Every event is therefore indistinguishable from "missing", on PostHog's own instrumentation checklist.

### F5 — Error path forwards message **and stack**, and no redaction policy is recorded · **medium** · E1 + E3 + E4

Observed (E3), error branch with `privacyMode` unset:

```
$ai_is_error: true | $ai_http_status: 429
$ai_error contains message text? true
$ai_error contains stack? true
```

Provider error strings routinely echo request content. ACE passes `error` straight through and never sets `privacyMode` (E4: 2 occurrences, both pass-through plumbing, no call site sets it). Nothing in the repository records a decision about sending prompt/response content — including `user_custom` text — to a third-party analytics service.

By contrast, success-path content is sent in full by default: `$ai_input` and `$ai_output_choices` carry verbatim prompt and output.

### F6 — A working redaction lever exists · **informational** · E3

With `privacyMode: true` the SDK nulls content and keeps accounting:

```
$ai_input: null | $ai_output_choices: null | $ai_input_tokens still present: 3
```

So token/latency/cost analytics are available **without** shipping content. This makes F5 a policy choice rather than a constraint.

### F7 — "error re-thrown as the same object" holds today, but is version-fragile · **low** · E2 + E3

The SDK mutates the error object only when `client.options?.enableExceptionAutocapture` is set, and then also emits a separate exception event. With the installed `posthog-node@5.57.2` that option is **`undefined`** (E3, inspected on a real client instance), so:

```
error object mutated by SDK? false | captureException called: 0
same error reference rethrowable? true
```

ACE's claim holds on these exact versions. It would stop holding — silently, and with an extra event per failure — if a future `posthog-node` defaults that option on. This is a dependency-upgrade watch item, not a present defect.

### F8 — The live half's "VERIFIED" verdict does not observe the AI event · **high (evidence integrity)** · E4

Reading `verification/posthog-ai-observability-check.js`, the `VERIFIED` path is reached when **two** things are true:

1. `traceGeneration(...)` returned the stub object unchanged (a pass-through assertion);
2. a **separate, hand-built plain event** named `ace_ai_observability_probe` — not `$ai_generation` — was POSTed to `${host}/batch/` and answered 2xx.

Neither step inspects the `$ai_generation` event, its properties, or whether PostHog stored it. Combined with F2 (no failure signal reaches the caller) and F3 (the payload shape is non-conforming), a green "VERIFIED" would establish **host reachability and key validity** — not instrumentation correctness.

Secondary inconsistency in the same probe: its comment says the probe `"claims no model tokens"`, while it passes `usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 }`, which `usageFromResponse()` converts to `inputTokens: 3 / outputTokens: 2` and the SDK emits as `$ai_input_tokens: 3`, `$ai_output_tokens: 2` (E3 confirms this mapping for exactly that object). The probe will therefore appear as a real 3-token/2-token generation under model `ace-observability-probe`, contradicting its own stated intent.

### F9 — The 10/10 offline suite cannot see F3, F4 or F5 · **medium** · E4

The offline half asserts: disabled-without-key, no client without key, Gemini and OpenAI usage extraction, no invented usage, output extraction for two shapes, return-value identity, error identity, no network. It never asserts the **emitted property set**. That is why a non-conforming `$ai_output_choices`, a missing `$ai_session_id`, and a stack-bearing `$ai_error` all coexist with a clean 10/10.

### F10 — Optional peers are absent, and that is fine for the root entry · **informational** · E2 + E3

`@posthog/ai@8.17.0` declares `openai`, `@anthropic-ai/sdk`, `@ai-sdk/provider`, `langchain`, OpenTelemetry packages and others as **optional** peer dependencies. None of `openai` / `@anthropic-ai/sdk` is installed here (E4), yet (E3):

```
CJS require OK | export count: 5 | has captureAiGeneration: function
```

So the lazy-load design holds for the CJS root entry; `captureAiGeneration` is usable without any provider SDK present.

### F11 — Missing provider degrades silently · **low** · E2 + E4

`provider` is a **required** field in the SDK's `CaptureAiGenerationOptions`, while ACE substitutes `options.provider || 'unknown'`. A caller that forgets the provider produces an event that PostHog cannot price or group, with no signal at the call site.

---

## 4. Documented contract vs. observed event

For a Gemini-family call through ACE's own extraction paths (E1 contract, E3 observation):

| Property | Documented requirement (E1) | Observed emitted value | Verdict |
|---|---|---|---|
| `$ai_trace_id` | Groups events of one interaction; restricted character set | `trace-1` / auto-UUID | conforming |
| `$ai_session_id` | Optional; send `null` for single-trace workloads | **absent** | F4 |
| `$ai_model` | The model used | `gemini-2.5-flash` | conforming |
| `$ai_provider` | e.g. `openai`, `anthropic`, `gemini` | `google` (caller-supplied) | conforming-by-vocabulary, not validated |
| `$ai_input` | List of messages, each with `role` | array with `role` | conforming |
| `$ai_output_choices` | List of choices, each with `role` | **string** | **F3** |
| `$ai_input_tokens` / `$ai_output_tokens` | integer counts | `3` / `2` | conforming |
| `$ai_latency` | optional, seconds | `0.42` | conforming |
| `$ai_base_url` | optional | `""` (empty string) | cosmetic stray |
| `$ai_usage` | not in the documented `$ai_generation` core table | full raw provider usage object | extension; duplicates raw usage in-event |
| `$ai_is_error` / `$ai_error` | optional; error message or object | `true` / message **+ stack** | **F5** |
| `$ai_http_status` | optional | `429` from `error.statusCode`, `200` default | conforming |

---

## 5. Claim ledger — what the 2026-10-28 log does and does not establish

| Statement | Established? | By what |
|---|---|---|
| "With no key, every helper is a pass-through; the wrapped call returns its value unchanged; errors are re-thrown as the same object; no network call is made" | **Yes**, for the tested shapes | E3 + the offline suite; re-observed here |
| "Gemini/OpenAI usage and output extraction work" | **Yes** | offline suite + E3 |
| "PostHog AI observability works / events arrive" | **No** | never executed; and per F2/F8 a green live run would still not establish it |
| "The emitted event conforms to PostHog's `$ai_generation` schema" | **No** — and F3 says it does not, for output | E1 vs E3 |
| "The feature is active in the application" | **No** — it is not wired (F1) | E4 |
| "No core ACE workflow behaviour changed" | **Yes**, consistent with prior reconciliation | prior docs; not re-litigated here |

---

## 6. Not established — requires a live project or an owner decision

1. Whether a `$ai_generation` event from this module is **accepted and queryable** in a PostHog project.
2. How the AI Observability UI **renders** a string-valued `$ai_output_choices` (cosmetic, broken conversation view, or silently coerced).
3. Whether cost is computed for `gemini-2.5-flash` / whether the `ace-observability-probe` pseudo-model yields `$0`.
4. Whether `/batch/` and `/i/v0/e/` behave identically for this project's key.
5. Ingest volume, quota and billing impact.
6. Any retention/residency question — `POSTHOG_HOST` is configurable, but no decision record chooses a region.

Items 1–3 need a project API key; item 4 needs a key; items 5–6 need owner input. None can be resolved by more local research, and none is asserted above.

---

## 7. Decision inputs (not recommendations; implementation is not authorized)

| Option | What it buys | Cost / risk | Evidence it would produce |
|---|---|---|---|
| **A. Leave code unchanged; correct the claim surface** — record in the log/docstring that only the offline half exists, that the wrapper is unwired, and that the boolean is not a delivery signal | Removes the one real integrity problem (F8) at near-zero cost | Documentation-only edit; still requires owner authorization to touch files | A log that cannot be read as "observability verified" |
| **B. Make the live half observable** — after capture, read the event back (query API, personal API key) instead of probing `/batch/` | Turns F8 from a claim defect into a real check | Needs a personal API key with query scope, not just a project key; test-harness work | A verdict that names the event id it found |
| **C. Conform the payload** — wrap outputs as `[{ role: 'assistant', content: … }]`, set `$ai_session_id: null`, drop the empty `$ai_base_url` | Fixes F3/F4; makes events render as documented | Touches the module; needs tests that assert the emitted property set (F9) | Offline assertions on the event object |
| **D. Decide the content policy** — `privacyMode`, or accept content egress, and record it | Converts F5 from an unrecorded default into a decision | Owner policy call; affects analytics usefulness | A written decision + a test asserting `$ai_input === null` |
| **E. Wire it into a real provider call** | Makes the feature mean what its name says | Needs a provider integration inside a frozen-baseline repository; largest blast radius | A real generation with a real model and real tokens |

A, B and D are independent of each other. C and E are the two that touch executable code and would need the baseline-diff review the freeze directive requires.

---

## 8. Reproduction

```powershell
# Event-shape observation, no network:
node .tmp\obs-probe\research-probe.js

# SDK failure semantics, unreachable host:
node -e "const {PostHog}=require('posthog-node');const c=new PostHog('phc_dummy',{host:'http://127.0.0.1:9',flushAt:1});c.captureImmediate({distinctId:'x',event:'p',properties:{}}).then(()=>console.log('resolved without error'))"

# Export surface of the installed SDK:
node -e "console.log(Object.keys(require('@posthog/ai')).join(','))"

# Existing suite (unchanged, as-is):
npm run check:posthog -- --offline
```

`.tmp/obs-probe/research-probe.js` is a scratch artifact of this research run; it is not part of the test suite and asserts nothing about the product.

---

## 9. References

**E1 — PostHog docs (fetched 2026-10-31)**

- Manual capture / event properties — <https://posthog.com/docs/ai-observability/installation/manual-capture>
  Quoted: *"`$ai_trace_id` groups the events of one LLM interaction into a trace."* · *"A workload that finishes in a single trace … Send it as `null` on those to say so explicitly, which tells the instrumentation checklist the workload is complete rather than missing a session id."* · property table: *"`$ai_output_choices` | List of response choices from the LLM. Each choice should have a `role` property with one of: `"user"`, `"system"`, or `"assistant"`"*
- Generations — <https://posthog.com/docs/ai-observability/generations>
  Quoted: *"Generations are tracked as `$ai_generation` events"* · *"When you send generation (`$ai_generation`) … events with a `$ai_trace_id`, PostHog automatically creates a pseudo-trace event"*

**E2 — installed source**

- `node_modules/@posthog/ai/dist/index.cjs` — `captureAiGeneration` property assembly, the `catch` that swallows failures, `captureAiEventImmediate`
- `node_modules/@posthog/ai/dist/index.d.ts` — `CaptureAiGenerationOptions`, `TokenUsage`
- `node_modules/@posthog/ai/package.json` — optional peer dependencies, `exports` map
- `node_modules/posthog-node/dist/*` — client surface (`capture`, `captureImmediate`, `captureException`, `captureAi`), absent `enableExceptionAutocapture`

**E3 — local observation** — `.tmp/obs-probe/research-probe.js`, output reproduced in F3/F5/F6/F7/F10

**E4 — repository** — `app/observability/posthog-ai.js`, `verification/posthog-ai-observability-check.js`, `verification/posthog-ai-observability-2026-10-28.log`, `package.json`, `.env.example`, `app/README.md`

---

## 10. Conclusion in one paragraph

The observability seam is honestly built for what it claims **offline** — pass-through, no invented usage, no altered return value, no swallowed provider error — and those properties were re-observed here. What it does not have is any of the things that would let a "VERIFIED" label mean *AI events are arriving correctly*: it is not wired to a provider (F1), its success signal cannot distinguish delivered from dropped (F2), the output field it emits does not match the documented schema (F3), and the live check certifies reachability of a different event rather than the one under test (F8). The core content workflow is untouched by all of this, exactly as the earlier reconciliation concluded. The honest current status is the one already written in the log — **PENDING, offline pass-through verified only** — with one addition: a live run passing as currently written would still not upgrade that status, because the check does not look at the event it claims to verify.
