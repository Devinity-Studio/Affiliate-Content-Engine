# ACE — OpenRouter Integration
## Read-only Implementation Plan

**Status of this document:** READ-ONLY planning artifact
**Authorization state used for this plan:**
- Gate 1 — Direction: **APPROVED**
- Gate 2 — Proof Contract v0.1: **APPROVED**
- Gate 3 — Implementation: **NOT AUTHORIZED**
- Gate 4 — Live API Test: **NOT AUTHORIZED**

**What this document is:** a proposal-ready implementation plan that traces the approved Proof Contract v0.1 against the verified repository baseline.
**What this document is not:** authorization to edit code, create files, install dependencies, change configuration, read secrets, or call an external AI API.

**Repository root:** `Y:\DevProject\Affiliate Content Engine`
**Branch:** `mission1-planning-docs`
**HEAD:** `795dc0a6ac66bef19725184107e6474b41aa1823`

> Note on Proof Contract v0.1
>
> This plan treats Proof Contract v0.1 as approved by Owner. The exact text of Proof Contract v0.1 was not found as a single readable file in the repository sections I searched. Where this plan references contract requirements, it uses the requirements stated in the current assignment and the previously approved direction. If Proof Contract v0.1 contains additional constraints, those should be reconciled before any implementation work.

---

## 1. Executive Summary

This plan maps the smallest viable OpenRouter integration path to the approved Proof Contract v0.1 using only the current repository baseline.

Verified baseline:
- No live AI provider exists in runtime.
- Content generation is deterministic/template-based.
- PostHog AI observability exists but is not an inference provider and is currently unwired.
- No OpenRouter key, model config, provider module, or response normalization exists in runtime code.
- Dependencies are only `@posthog/ai` and `posthog-node`.

Proposed plan shape:
- One small provider module for OpenRouter.
- One controlled call site in the MVP slice.
- Minimal request/response normalization.
- Secret handling that never emits key material.
- Failure and cost controls that keep the first slice safe and auditable.

This plan stops before Gate 3 and Gate 4. It is intended for Owner review and separate authorization.

---

## 2. Verified Repository Baseline

### 2.1 Git and working tree

| Item | Status | Evidence |
|---|---|---|
| Repository root | `Y:\DevProject\Affiliate Content Engine` | VERIFIED, `git rev-parse --show-toplevel` |
| Branch | `mission1-planning-docs` | VERIFIED, `git branch --show-current` |
| HEAD | `795dc0a6ac66bef19725184107e6474b41aa1823` | VERIFIED, `git rev-parse HEAD` |
| Tracked file changes this turn | none | VERIFIED, `git status --porcelain` |
| Untracked files | large set, pre-existing | VERIFIED, `git status --porcelain` |
| Working tree after this plan | unchanged | VERIFIED, `git status --porcelain` |

### 2.2 Dependencies

| Dependency | Version | Role in current code |
|---|---|---|
| `@posthog/ai` | 8.17.0 | AI observability helper |
| `posthog-node` | 5.57.2 | PostHog SDK |
| LLM provider SDK | none | VERIFIED absent from `package.json` and lockfile |

Source: `package.json`, `package-lock.json`, code search.

### 2.3 Environment template and secret handling policy

| File | Contents relevant to this plan |
|---|---|
| `.env.example` | `GEMINI_API_KEY=`, `POSTHOG_API_KEY=`, `POSTHOG_HOST=`, `ACE_IMPORT_ROOT=` |
| `.gitignore` | excludes `.env` and `.env.*`, retains `.env.example` |

Sources: `.env.example`, `.gitignore`.

Note:
- There is no `.env` entry for OpenRouter in the repository template.
- There is no runtime reference to an OpenRouter key in the code sections I inspected.

### 2.4 Existing application structure

Relevant modules and their roles:

| Module | Role | Notes |
|---|---|---|
| `app/server.js` | HTTP server and state/endpoint layer | Contains state helper functions; reviewed structurally |
| `app/mvp/service.js` | MVP affiliate workflow core | Contains import, scoring, candidate, plan, and `generateMarkdownContent()` |
| `app/mvp/content.js` | MVP content creation slice | Contains storyboard, script, QA, finalize, assets, and audio asset handling |
| `app/mvp/thai-qa.js` | Thai copy QA | Language QA helper |
| `app/remotion/render.js` | Local 9:16 video renderer | ffmpeg-based local render |
| `app/observability/posthog-ai.js` | PostHog AI observability | `traceGeneration()`, `captureGeneration()`, `usageFromResponse()`, `outputFromResponse()` |

Sources: repository file inspection and code search.

### 2.5 Existing provider-related code and telemetry

| Concept | Current status |
|---|---|
| OpenRouter client | NOT FOUND in runtime code |
| OpenRouter endpoint reference | NOT FOUND in runtime code |
| OpenRouter API key reference | NOT FOUND in runtime code |
| Gemini API key reference | NOT FOUND in runtime code (only in `.env.example` and reports) |
| Provider adapter interface | NOT FOUND |
| Model selection config | NOT FOUND in runtime |
| OpenAI-compatible response normalization | Not present for generation; only observability extraction shapes exist in `posthog-ai.js` |

Sources: code search for `OPENROUTER_API_KEY`, `OPENROUTER`, `chat/completions`, `GEMINI_API_KEY`, and related terms.

### 2.6 Existing content-generation entry points and data flow

Current generation path:
1. Import/export ingestion in `app/mvp/service.js`.
2. Dataset build, source/product/offer/evidence creation.
3. Scoring and candidate generation.
4. Deterministic content scaffolding in `app/mvp/content.js`:
   - approaches
   - storyboard
   - script
   - QA
   - finalize checklist
5. Local MP4 render in `app/remotion/render.js`.

Deterministic generation functions:
- `generateMarkdownContent()` in `app/mvp/service.js`
- `buildApproaches()` in `app/mvp/service.js`

These are template-based and not LLM calls.

---

## 3. Current Runtime Data Flow

### 3.1 What currently flows

1. **Input:** CSV export or fixture import.
2. **State:** `data/mvp/fixture-state.json` by default, overridable by `ACE_MVP_STATE_FILE`.
3. **Processing:** deterministic analysis and scoring.
4. **Output artifacts:** candidates, plan drafts, content projects, scripts, storyboards, QA reports, and a local MP4 render.

### 3.2 Where an LLM call would enter

The first slice should introduce a new narrow step, not rearrange the existing pipeline.

Likely insertion points:
- A new generation helper in `app/mvp/`.
- A call from a content-related operation that currently produces template output.

The cleanest separation is:
- **Existing flow:** remains deterministic.
- **New flow:** one optional LLM step that may enrich or replace one small piece of text output.

### 3.3 What must not be affected

- Import and source validation.
- Candidate generation and scoring.
- Plan and content scaffolding core objects.
- Local render and asset handling.
- Existing deterministic output when the LLM path is not used.

---

## 4. Proposed Minimal Implementation Architecture

This section is PROPOSED.

### 4.1 Architectural principles for the first slice

1. **One provider, one request shape.**
   - Start with OpenRouter `chat/completions` only.
   - Do not build a multi-provider framework yet.
2. **One module owns transport + auth + normalization.**
   - Keep HTTP, bearer auth, timeout, error mapping, and response extraction together.
3. **One call site owns business meaning.**
   - The call site decides when and why to call the provider.
   - The provider module should not know content-tracking logic.
4. **Telemetry is optional and wraps the call.**
   - Use `traceGeneration()` only if the slice needs observability.
   - Telemetry must not own the call, and must not receive the raw key.

### 4.2 Data flow for the first slice

1. App decides to run the LLM path.
2. App validates configuration:
   - model name present
   - key present
   - prompt/input present
3. App builds a minimal chat completions request.
4. Provider module sends the request with a timeout and bearer auth.
5. Provider module validates the response shape.
6. Provider module normalizes the response into a small contract object.
7. App uses the normalized output in a controlled place.
8. Optionally, `traceGeneration()` wraps the call for observability.

---

## 5. File-by-File Change Proposal

This section is PROPOSED. No file is created or modified in this plan.

### 5.1 Proposed new file

#### `app/mvp/providers/openrouter.js` (PROPOSED)

Proposed responsibility:
- Load OpenRouter configuration from environment.
- Build a chat completions request.
- Attach bearer auth.
- Set timeout and retry/failure mapping.
- Normalize a successful response.
- Expose a small, reviewable interface.

Why necessary:
- It isolates auth, HTTP, and failure handling from the rest of the app.
- It makes response normalization explicit and testable.
- It prevents OpenRouter transport details from leaking into content logic.

Can it be avoided:
- Not for a clean first slice. Inline HTTP calls would mix transport, auth, error handling, and business logic.
- A shared generic provider module is possible, but for a first slice a focused OpenRouter module is smaller and easier to review.

#### `app/mvp/ai/openrouter.js` or `app/mvp/ai/providers/openrouter.js` (PROPOSED alternative)

Same responsibilities as above, different placement.

Why considered:
- If Owner wants a slightly more generic `ai/` area for future expansion.
- For the first slice, the simpler location under `app/mvp/` is likely easier to justify.

#### `app/mvp/providers/index.js` or similar (PROPOSED, optional)

Proposed responsibility:
- Re-export or centralize provider modules if more than one is added later.

Why necessary:
- Only if Owner expects multiple providers soon. Not required for the first slice.

### 5.2 Proposed changed file

#### `app/mvp/service.js` or `app/mvp/content.js` (PROPOSED call site change)

Proposed responsibility:
- Add one explicit call site that decides to invoke the provider.
- Pass prompt/context and model config.
- Accept normalized output.
- Keep existing deterministic code untouched.

Why necessary:
- There must be a business-level entry point for the LLM path.
- The call site should be easy to inspect as the “real ACE runtime” caller.

Can it be avoided:
- Not if the app is to call the provider through its own runtime.
- The exact location depends on where the generated text should be consumed.

#### `.env.example` (PROPOSED documentation change)

Proposed responsibility:
- Document the new key name and model config name.

Why necessary:
- So the repo documents supported configuration without containing secrets.

Can it be avoided:
- Not if Owner wants the supported variables documented in repo.

### 5.3 Files likely not needed for the first slice

| File | Reason not needed now |
|---|---|
| Any new provider SDK | A minimal client can be built from Node built-ins/Http request module if Owner prefers no new dependency |
| Multi-provider abstraction | Not justified until there is evidence of more than one provider |
| New observability module | Existing `posthog-ai.js` can be reused if needed |
| New state schema | Not required for a single controlled text-generation step |

---

## 6. Dependency Assessment

### 6.1 Existing dependencies that can be reused

| Dependency | Reuse potential | Notes |
|---|---|---|
| Node built-ins | High | HTTP client, crypto, timers, streams |
| `app/observability/posthog-ai.js` | Medium | Can wrap a provider call if observability is desired |
| `usageFromResponse()` / `outputFromResponse()` | Medium | Useful inspiration, but OpenRouter chat completions normalization should be explicit in provider code |

### 6.2 Dependencies that may or may not be necessary

| Candidate | Assessment |
|---|---|
| New HTTP client package | Not strictly necessary for a minimal slice; Node built-ins are enough. May be acceptable if Owner wants a maintained HTTP client. |
| Any LLM provider SDK | Not necessary for OpenRouter chat completions; likely overkill for the first slice. |
| Dotenv or env-loading package | Not necessary if the app continues to read from `process.env`. Current repo does not ship an env loader. |

### 6.3 Dependency decision rule for the first slice

Recommended rule:
- Keep the first slice dependency-free if it can be done cleanly with Node built-ins.
- Add a dependency only with an explicit Owner-approved reason.

This keeps Gate 3 approval smaller and easier to review.

---

## 7. Proof Contract Traceability Matrix

This section maps the approved Proof Contract v0.1 to implementation and evidence. The contract text itself is not reproduced here; the mapping assumes the requirements in the current assignment and approved direction.

### 7.1 Contract requirement: Application Runtime request path

| Contract requirement | Implementation mapping | Evidence type |
|---|---|---|
| ACE makes the request through its runtime | Provider module + one call site in `app/mvp/` | Source inspection + runtime execution |
| Request uses ACE code path, not an external script | Call site is inside app module, not standalone verification script | Source inspection |
| Request is configurable, not hardcoded template | Model/prompt from config/env | Source inspection + runtime evidence |

### 7.2 Contract requirement: OpenRouter provider exchange

| Contract requirement | Implementation mapping | Evidence type |
|---|---|---|
| Request goes to OpenRouter chat completions | Provider module targets `https://openrouter.ai/api/v1/chat/completions` | Source inspection + external API response evidence |
| Auth uses bearer token from env | Provider module reads key from env and sets `Authorization: Bearer ...` | Source inspection + security evidence |
| Request reflects configured model | Provider module uses configured model name in body | Source inspection + external API response evidence |

### 7.3 Contract requirement: Provider/model provenance

| Contract requirement | Implementation mapping | Evidence type |
|---|---|---|
| Model name is explicit | Config/env model variable | Source inspection |
| Provider is explicit | Provider module and/or request header/body indicate OpenRouter | Source inspection |
| Provenance is recorded, not inferred | App can record provider/model used with the result | Source inspection + runtime evidence |

### 7.4 Contract requirement: Response validation and normalization

| Contract requirement | Implementation mapping | Evidence type |
|---|---|---|
| Response is validated before use | Provider module checks for valid choices/content | Source inspection + failure tests |
| Output is normalized | Extract `choices[0].message.content` into a controlled shape | Source inspection + offline tests |
| Empty or unexpected output is rejected or flagged | Explicit validation logic | Source inspection + failure tests |

### 7.5 Contract requirement: Secret handling and log redaction

| Contract requirement | Implementation mapping | Evidence type |
|---|---|---|
| Key is never logged or returned | Key only passed to HTTP client | Source inspection + security evidence |
| Error messages do not include secret material | Error mapping excludes auth details and raw bodies | Source inspection + failure tests |
| Artifacts do not contain key | Generated output and exported files examined for absence of key | Security evidence |

### 7.6 Contract requirement: Failure handling

| Contract requirement | Implementation mapping | Evidence type |
|---|---|---|
| Missing key fails cleanly | Config validation before request | Source inspection + offline tests |
| Invalid key fails cleanly | Provider error mapped to controlled error | Runtime evidence + failure tests |
| Provider error fails cleanly | Non-200 or error body mapped to app error | Runtime evidence + failure tests |
| Timeout fails cleanly | HTTP timeout with explicit timeout error | Source inspection + failure tests |
| Malformed response fails safely | Response validation + safe error | Source inspection + failure tests |

### 7.7 Contract requirement: Cost and request limits

| Contract requirement | Implementation mapping | Evidence type |
|---|---|---|
| First slice has defined scope | One controlled prompt, one model, limited attempts | Owner decision + plan |
| Cost boundary is explicit | Approval requires cost limit/boundary before live test | Owner decision required |
| Rate/quota risk is acknowledged | Documented as risk and test constraint | Plan + Owner decision |

### 7.8 Contract requirement: Evidence collection

| Contract requirement | Implementation mapping | Evidence type |
|---|---|---|
| Proof distinguishes LLM call from template | Call path and response provenance recorded | Source inspection + runtime evidence |
| Proof includes provider/model metadata | Recorded with result and/or in observability | Source inspection + runtime evidence |
| Proof includes request/response evidence | Logged or captured sanitized request/response metadata | Runtime evidence + external API response evidence |
| Proof excludes secret material | Redaction and absence checks | Security evidence |

---

## 8. Test Strategy

This section separates tests that do not need network/provider cost from tests that require a live provider call.

### 8.1 Offline / no-cost tests

| Test | Can be done without live API | What it proves |
|---|---|---|
| Missing key handling | yes | App rejects LLM path safely without key |
| Invalid key handling | yes, for app-side behavior | App surfaces controlled error without leaking key |
| Response normalization logic | yes | Extraction logic works on shaped sample objects |
| Timeout handling | yes, for app-side behavior | Timeout produces expected error path |
| Malformed response handling | yes | Validation rejects bad shapes |
| Empty response handling | yes | Empty content is treated as invalid/unusable |
| Template/mock fallback prevention | yes, structurally | Call path is not `generateMarkdownContent()` or another template function |
| Secret leakage review | yes, by inspection | Key material does not appear in logs/output/code paths |

### 8.2 Live / cost-requiring tests

| Test | Requires live API | What it proves |
|---|---|---|
| Real provider exchange | yes | App makes a real OpenRouter request and receives a real response |
| Model selection behavior | yes | Configured model is actually used |
| Provider error behavior | yes | Real provider error is mapped as expected |
| Timeout behavior | yes, if induced or observed | Timeout handling holds under real conditions |
| Full secret-absence evidence | yes, ideally | After a real run, no key appears in logs/artifacts |

Note:
- The live tests require Gate 4 authorization.
- Until Gate 4 is authorized, only offline tests and source inspection can be completed.

### 8.3 Template/mock fallback prevention

This should be proven by combining:
- Source inspection showing the call goes through the provider module and call site.
- A live response that cannot be reproduced by app-side template logic alone.
- Sanitized request/response metadata showing a real provider exchange.

A marker in the output alone is insufficient.

---

## 9. Security and Cost Controls

### 9.1 Security controls

| Control | Implementation proposal |
|---|---|
| Key storage | Environment variable only; never in code or repo |
| Key transmission | Bearer token in HTTPS request only |
| Logging | Exclude key, auth headers, and raw response bodies |
| Error reporting | Exclude auth details and provider internals |
| Artifacts | No key in generated content, state, exports, screenshots, or UI |
| Observability | If used, prefer privacy controls and do not send key material |

### 9.2 Cost controls

| Control | Proposal |
|---|---|
| Scope | One controlled proof prompt for the first live test |
| Model | Configurable, defaulting to an approved free/low-cost model only if Owner chooses |
| Request limits | Explicitly approved limit before any live test |
| Approval gate | No live call without Gate 4 authorization and a defined cost boundary |

Recommended free/low-cost candidate for the first slice:
- `nvidia/nemotron-3.5-lightning:free` is a known free model on OpenRouter.
- Whether to use it is an Owner decision, not an assumption encoded in implementation.

### 9.3 Minimal live-test safety rules

- Use the smallest possible prompt.
- Use a model and account chosen by Owner.
- Set a hard request limit and a timeout.
- Fail closed on missing/invalid config.
- Do not log or persist secret material.

---

## 10. Risks, Assumptions, and Unknowns

### 10.1 VERIFIED

- No live AI provider in current runtime.
- No OpenRouter client, key, or model config in runtime code.
- Only `@posthog/ai` and `posthog-node` are dependencies.
- Content generation is deterministic/template-based today.
- Working tree is unchanged during this plan.

### 10.2 ANALYSIS

- The smallest clean integration is a focused provider module plus one call site.
- A separate normalization layer is safer than scattering extraction logic.
- Telemetry can wrap the call but should not own it.
- A marker-only proof is weaker than request/response + provenance evidence.
- Live tests require explicit authorization and cost control.

### 10.3 PROPOSED

- Provider module location under `app/mvp/`.
- Call site in `app/mvp/service.js` or `app/mvp/content.js`.
- Dependency-free first slice if possible.
- One controlled prompt for the first live test.

### 10.4 UNKNOWN

- Exact text of Proof Contract v0.1 not located in repository search; must be reconciled if it contains extra constraints.
- Whether `.env` currently contains an OpenRouter key.
- Whether the Owner wants Thai or English for the proof prompt.
- Whether PostHog observability should be enabled for the first live test.
- Whether any cost limit should be set for the first slice.

### 10.5 OWNER DECISION REQUIRED

- Final approval of this plan as the implementation design.
- Approval of the exact call site location.
- Approval of whether to stay dependency-free.
- Approval of the proof prompt and acceptable proof output shape.
- Approval of cost boundary and request limits.
- Approval of observability for the first live test.
- Confirmation of the free/low-cost model choice, if any.
- Authorization for Gate 3 and Gate 4 separately.

---

## 11. Implementation Sequence

This sequence is PROPOSED and is not authorized yet.

### 11.1 Before implementation

1. Reconcile Proof Contract v0.1 text with this plan.
2. Confirm exact call site and prompt/output shape.
3. Confirm cost boundary and request limits.
4. Confirm observability decision.

### 11.2 Implementation order if authorized

1. Add provider module:
   - config loading
   - request building
   - auth
   - timeout
   - response validation and normalization
2. Add or update documentation in `.env.example` for the new variable names.
3. Add the single call site.
4. Add offline tests for normalization and failure paths.
5. Add source-inspection evidence that the call is in the app runtime path.
6. Prepare live-test evidence collection plan, without executing it yet.

### 11.3 After implementation, before live test

1. Run offline tests.
2. Review secret-handling paths.
3. Review error paths.
4. Owner authorizes Gate 4 for the controlled live test.

---

## 12. Owner Decisions and Required Authorizations

### D1. Plan approval

- Decide whether this plan correctly reflects the approved Proof Contract v0.1.
- Decide whether the proposed provider module and call site locations are acceptable.

### D2. Dependency decision

- Decide whether the first slice should remain dependency-free or allow a new HTTP/client dependency.

### D3. Proof scope decision

- Decide the proof prompt, output shape, and what constitutes sufficient evidence.
- Decide whether a marker alone is acceptable or whether request/response metadata is required.

### D4. Cost and limits decision

- Decide the cost boundary, request limit, model choice, and account/key owner for the first live test.

### D5. Observability decision

- Decide whether `traceGeneration()` should wrap the first live test.

### D6. Authorization gates

- Gate 3: authorize implementation only after the above are settled.
- Gate 4: authorize the first live API test only after implementation and review.

### D7. Approval separation rule

- Approval of Gate 1 and Gate 2 does not authorize Gate 3 or Gate 4.
- This plan does not authorize implementation or live API activity.

---

## Completion Check

- Working tree before this document: unchanged tracked state, pre-existing untracked files.
- Working tree after this document: unchanged tracked state; only this new read-only plan file was added.
- No code, configuration, dependency, environment, or secret inspection beyond non-secret files was performed.
- No API was called.
- No implementation was started.

---

## Evidence trail for this turn

- `git rev-parse --show-toplevel`
- `git branch --show-current`
- `git rev-parse HEAD`
- `git status --porcelain`
- `cat package.json`
- `cat .env.example`
- `grep` on `.gitignore`
- Code search for provider/config/telemetry symbols
- Read: `verification/ace-mission1-openrouter-decision-brief-2026-11-01.md`, `verification/ace-mission1-ai-provider-readonly-reconciliation-2026-11-01.md`, `verification/posthog-ai-observability-research-2026-10-31.md`
- Live OpenRouter model lookup from public model list for context only; no API key or secret was used

---

**Next step:** wait for Owner review and separate authorization of Gate 3 and Gate 4.
