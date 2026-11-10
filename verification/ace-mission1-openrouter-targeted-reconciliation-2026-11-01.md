# ACE — OpenRouter Integration: Targeted Implementation Plan Reconciliation

Read-only follow-up report. No files were modified, created, deleted, renamed, or formatted. No dependencies were installed, no environment or configuration was changed, no `.env` secret was inspected, and no external API was called. After submitting this report, the working tree was re-checked and found unchanged except for this read-only artifact and the same pre-existing untracked files already present before the work.

- **Branch:** `mission1-planning-docs`
- **HEAD:** `795dc0a6ac66bef19725184107e6474b41aa1823`
- **Repository root:** `Y:\DevProject\Affiliate Content Engine`
- **Read-only artifact:** `verification/ace-mission1-openrouter-targeted-reconciliation-2026-11-01.md`

### Status labels used

- **VERIFIED** — directly established by source inspection or a non-mutating executed check.
- **ANALYSIS** — reasoned conclusion from verified facts.
- **PROPOSED** — a recommendation, not an existing implementation.
- **UNKNOWN** — evidence is insufficient and no authorized action can resolve it right now.
- **OWNER DECISION REQUIRED** — an authorization or policy choice that must be made by the Owner.

---

## 1. Verified Facts

- The Node runtime constraint is `>=18` in `package.json:4`. The installed runtime on this machine is `Node 22.23.2` with native `globalThis.fetch` available. **VERIFIED**
- Existing dependencies are only `@posthog/ai` (8.17.0) and `posthog-node` (5.57.2). There is no OpenRouter SDK, no HTTP helper library, and no provider SDK in `package.json:6-7`. **VERIFIED**
- `posthog-ai.js` is an observability wrapper, not an inference provider. It wraps a provider `call()`, reads `POSTHOG_API_KEY`, and sends an `$ai_generation` event. It does not perform LLM inference and does not know about OpenRouter. **VERIFIED**
- The current runtime has no OpenRouter provider module. None of these paths exist:
  - `app/mvp/provider/openrouter.js`
  - `app/mvp/providers/openrouter.js`
  - `app/providers/openrouter.js`
  - `app/observability/openrouter.js`
  - `app/llm/openrouter.js`
  - `app/ai/openrouter.js`
  **VERIFIED**
- No runtime code currently references `OPENROUTER_API_KEY` or the string `openrouter`. **VERIFIED**
- `.env.example` has no OpenRouter variable. It documents `GEMINI_API_KEY`, `POSTHOG_API_KEY`, and an optional `ACE_IMPORT_ROOT`. The real `.env` is git-ignored and was not inspected. **VERIFIED**
- Request/response normalization for OpenAI-compatible chat completions does not exist yet in the app source; only PostHog's `usageFromResponse()` and `outputFromResponse()` handle some provider shapes for observability. **VERIFIED**
- `crypto.randomUUID()` is available in the current runtime. **VERIFIED**
- The selected first call site is `contentModule.createContentProject()` in `app/mvp/content.js:422`. **VERIFIED** (source location)

---

## 2. Selected Call Site Recommendation

**Recommendation:** The first live LLM slice should be a new operation layered alongside `contentModule.createContentProject()`, not a replacement of it.

### Why `createContentProject()` and not `exportProject()`

- `createContentProject()` is the deterministic creation step where the current storyboard/script is assembled from candidate, offer, product, and approach selection.
- `exportProject()` is the render step: it depends on `FINALIZED` status, ffmpeg, assets, and file I/O. It is a worse isolation point for the first LLM slice because it is farther downstream and couples the slice to rendering side effects and media tooling.
- The clearest first integration is a narrow text-generation step that can feed or augment the storyboard/script creation without changing the existing deterministic path.

### Recommended operation and isolation

- Create a new operation, conceptually `createContentProjectWithLlmDraft()` or a small wrapper around `createContentProject()`.
- Input: the same inputs that `createContentProject()` already receives (`state`, `candidate`, `offer`, `product`, `plan`, `approachKey`, `custom`, `dataAsOf`).
- Output: either the existing deterministic project, or a project augmented with a provenance-marked LLM draft field for one narrow artifact (for example a script draft, storyboard copy, or approach commentary).
- Business purpose of the slice: prove that ACE can select a configured OpenRouter model, send a controlled inference request through app code, receive and normalize the response, and attach honest provenance metadata.
- Isolation: the existing deterministic pipeline continues to work unchanged. The LLM path must be an explicit opt-in branch, not a hidden replacement. A missing or rejected provider call should fall back to deterministic output, but the fallback must be labeled `TEMPLATE`/`MOCK` provenance, not silently presented as a live LLM result.

**PROPOSED**

---

## 3. Node Compatibility and Dependency Decision

### Verified runtime capabilities

- The project declares `node >= 18` (`package.json:4`).
- Installed runtime is Node 22, which includes global `fetch` and `crypto.randomUUID()`.
- The app already uses `node:http` for non-provider network paths, so low-level HTTP is available in the runtime.
- `fetch` is therefore suitable for the first OpenRouter integration from a compatibility standpoint. **VERIFIED**

### Dependency assessment

- **Option A — dependency-free HTTP with global `fetch`**: smallest footprint. One provider module calls `fetch` directly to the OpenRouter chat completions endpoint, builds the request, reads the response, and normalizes it.
- **Option B — add an HTTP or OpenAI-compatible helper library**: could reduce boilerplate but is not required for a single endpoint. Current architecture has only two packages, both for PostHog observability.

**Recommendation:** For Gate 3 planning, assume Option A is sufficient. Option B can be proposed later only if there is a concrete reason (for example multipart streaming, SDK-level retries, typed request/response helpers, or multiple endpoints). Do not add a dependency just to make the first slice look more "complete." **PROPOSED**

### When a dependency might become necessary

- Streaming response handling beyond what `fetch` + response body reading can express cleanly.
- Additional provider endpoints or a future multi-provider abstraction.
- Heavy Normalized request/response modeling that the team wants to share across providers.

These are future considerations, not present blockers. **ANALYSIS**

---

## 4. Proposed Provenance Contract

The first slice should attach an explicit provenance record to any output that an LLM may have contributed. The label alone must never be treated as proof of a live inference call.

### Minimal provenance fields

- `source`: `LIVE_LLM` | `TEMPLATE` | `MOCK`
- `provider`: `"openrouter"` when live; omitted or `"template"` when deterministic
- `model`: the configured model string, for example `"nvidia/nemotron-3.5-lightning:free"`
- `traceId`: a stable request correlation ID generated in app code, for example `crypto.randomUUID()`
- `timestamp`: ISO timestamp of the request
- `status`: `success` | `provider_error` | `timeout` | `invalid_response` | `graceful_fallback`
- `request`: a redacted request summary suitable for logs, never containing the raw secret
- `response`: normalized response summary or normalized text, never the raw provider response as stored verbatim unless explicitly approved

### Why this fixes the `AI_DRAFT` confusion

- `AI_DRAFT` should be treated as a presentation label, not a proof token.
- The real proof of a live LLM call is the provenance record plus the request/response evidence for that specific trace, not the output label.
- If the slice produces text under `source: TEMPLATE` or `source: MOCK`, it must not be presented as if it came from an inference call.
- If the slice produces text under `source: LIVE_LLM`, it must include provider, model, trace ID, timestamp, and execution status so the call can be evidenced later without relying on naming.

**PROPOSED**

---

## 5. Telemetry Recommendation

### First slice default

- Keep PostHog AI observability disabled by default for the first slice unless the Owner explicitly authorizes it for the live test.
- A missing `POSTHOG_API_KEY` already makes `posthog-ai.js` a pass-through, so the current observability module does not gate the provider call.

### What telemetry would capture if later enabled

If enabled for a future live test, the telemetry wrapper would send an `$ai_generation` event with:

- `provider`
- `model`
- `input` (the prompt or message array passed to the provider)
- `output` (the normalized output text or response summary)
- `latency`
- `usage` only when the provider reported token usage
- error info only in the error path, in the same shape the existing wrapper uses

### Privacy and redaction rule

- Never log, serialize, or send the OpenRouter API key or any `Authorization` header value.
- Do not send raw provider responses verbatim without explicit Owner approval.
- Do not forward sensitive prompt data into logs or telemetry unless the Owner has approved the exact data class.
- For this planning pass, telemetry is a separate optional concern. It should be treated as a wrapper that may optionally wrap the provider call later, not as the provider call itself.

**ANALYSIS / PROPOSED**

---

## 6. Gate 3 vs Gate 4 Control Matrix

### Gate 3 — Implementation Authorization

These can be implemented and verified without a live API call:

- Provider module interface and request construction.
- Environment loading and key presence/absence behavior.
- Missing-key and invalid-key handling paths.
- Request normalization and response normalization logic.
- Provenance attachment and label/state semantics.
- Log redaction design and code review.
- Timeout and retry policy wiring, as code structure.
- Offline failure-mode tests using recorded responses, stubs, or local harness assertions.
- Static assertions that the provider module is only invoked behind the approved opt-in call site.
- Cost-boundary configuration shape and guard code structure.

**VERIFIED CAPABILITY / PROPOSED**

### Gate 4 — Live API Test Authorization

These require an Owner-approved live request and cannot be completed under Gate 3 alone:

- That the configured model string actually resolves and responds through OpenRouter.
- That ACE sends the request with the intended header/auth shape over the network.
- That the normalized response matches a real provider response.
- That timeouts, provider errors, and malformed responses behave as expected against the real endpoint.
- That no secret appears in real logs or telemetry during an actual request.
- That the cost boundary holds against real token usage and real billing behavior.

**OWNER DECISION REQUIRED**

### Explicit Gate 4 precondition list

Live testing must not begin without an explicit Owner-approved:

- Model
- OpenRouter account/key owner
- Request limit
- Input/output token limits
- Maximum cost
- Timeout and retry policy

A free model does not by itself authorize the live call. **OWNER DECISION REQUIRED**

---

## 7. Updated File-by-File Change Proposal

These are proposed changes, not implementation. No file is being created or modified in this pass.

### New file candidates

- `app/mvp/provider/openrouter.js` — minimal module with:
  - configuration read from environment
  - one request function for chat completions
  - response normalization for the expected OpenAI-compatible shape
  - error classification for timeout, network, HTTP error, and malformed response
  - no secret logging

  **Why necessary:** there is no existing OpenRouter provider code; a provider module is the smallest place to localize request construction, auth usage, and response handling. **PROPOSED**

- `app/mvp/provider/provenance.js` (or a shared shape in the provider module) — minimal provenance record factory and label semantics.

  **Why necessary:** to separate `LIVE_LLM` from `TEMPLATE`/`MOCK` at the code level and prevent label confusion. **PROPOSED**

### Existing file changes that may be needed

- `app/mvp/content.js` (or a thin wrapper around it) — add the opt-in call site and the fallback-to-deterministic path with correct provenance labeling.
  **Why necessary:** this is the selected first call site; the LLM path should be wired as a narrow opt-in branch here, not scattered across unrelated modules. **PROPOSED**

- `.env.example` — document the OpenRouter key variable and its secret handling expectations so the template matches the planned configuration. **PROPOSED**

- `.gitignore` — unchanged in purpose, but worth confirming that no provider-specific secret file is introduced without being ignored. **PROPOSED**

### What can be reused

- The existing `posthog-ai.js` helpers (`outputFromResponse`, `usageFromResponse`) may be useful later for normalizing provider response shapes for observability, but they do not replace the provider module.
- Existing process/runtime conventions (env loading, error handling style, lock/queue patterns already used in `service.js`) can inform the new code without requiring a new framework.

### What can likely be avoided for the first slice

- A full multi-provider abstraction layer.
- Streaming support if the first proof uses a non-streamed request.
- A new observability dependency.

**ANALYSIS / PROPOSED**

---

## 8. Remaining Owner Decisions

1. **Call site confirmation:** confirm that a narrow opt-in slice at or beside `contentModule.createContentProject()` is the right first integration point, or choose another candidate operation. **OWNER DECISION REQUIRED**
2. **What the first LLM output is:** confirm which narrow artifact the first slice should generate or augment (script draft, storyboard copy, approach commentary, etc.). **OWNER DECISION REQUIRED**
3. **Provider optionality for Gate 3:** decide whether the first implementation should assume a dependency-free `fetch` path or permit a new HTTP/provider dependency. **OWNER DECISION REQUIRED**
4. **Telemetry default for the slice:** decide whether PostHog AI observability should remain disabled by default for the first live test or be enabled with an explicit approved payload scope. **OWNER DECISION REQUIRED**
5. **Live test approval package:** before any live call, approve model, key owner, request limit, token limits, maximum cost, and timeout/retry policy. **OWNER DECISION REQUIRED**
6. **Prompt language:** confirm whether the proof prompt should be in Thai or English, and what minimal controlled prompt text is acceptable for the first proof. **OWNER DECISION REQUIRED**
7. **Acceptable evidence shape:** confirm whether the first live-test evidence should be captured as a stored redacted trace record, a console/short log excerpt, or some other approved artifact. **OWNER DECISION REQUIRED**

---

## 9. Final Implementation Readiness Assessment

### Ready for planning

- The target operation is identified: `contentModule.createContentProject()` in `app/mvp/content.js:422`.
- The runtime supports the likely implementation approach: Node >= 18, Node 22 installed, `fetch` available.
- The absence of a provider module and the absence of OpenRouter references in the codebase are established, so the integration is clearly additive.
- The observability layer exists but is correctly understood as a wrapper, not an inference provider.

### Not yet authorized

- Implementation is still not authorized.
- Live API testing is still not authorized.
- The Gate 4 approval package is not yet provided.

### Read-back

- This report does not change the repository or authorize code.
- It closes the targeted clarifications requested: exact first call site, runtime/dependency compatibility, provenance contract, telemetry default, and the Gate 3 vs Gate 4 control split.
- The next action is still an Owner decision on Gate 3 and the Gate 4 approval package.

**VERIFIED / OWNER DECISION REQUIRED**

---

## Working-tree re-check

Before this report, the working tree already contained only the pre-existing untracked files and artifacts for this branch. After producing this report, the working tree was re-checked and the only addition attributable to this pass is this read-only report.

- `git status --porcelain` line count after the report: **141**
- No tracked file was modified in this pass.
- No dependency, configuration, environment, or `.env` value was read or changed.
- No commit, branch, or push was performed.

**VERIFIED**
