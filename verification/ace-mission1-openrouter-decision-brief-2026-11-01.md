# ACE Mission 1 — OpenRouter Decision Brief (Read-only)

**Created:** 2026-11-01
**Repo root:** `Y:\DevProject\Affiliate Content Engine`
**Branch:** `mission1-planning-docs`
**HEAD:** `795dc0a6ac66bef19725184107e6474b41aa1823`
**Pre-existing working tree:** untracked-heavy; no staged tracked changes this turn
**Status of this document:** READ-ONLY proposal support. It does not modify code, config, dependencies, or environment.

---

## 1. Verified Facts

### 1.1 Repository and Git state

- Repo root `Y:\DevProject\Affiliate Content Engine` — verified by `git rev-parse --show-toplevel`
- Branch `mission1-planning-docs` — verified by `git branch --show-current`
- HEAD `795dc0a6ac66bef19725184107e6474b41aa1823` — verified by `git rev-parse HEAD`
- `git status --porcelain` shows no modified tracked files this turn
- Untracked files are numerous; they include `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `app/observability/`, `verification/ace-mission1-ai-provider-readonly-reconciliation-2026-11-01.md`, and many prior reports and verification artifacts

### 1.2 Dependencies

- `package.json` depends only on:
  - `@posthog/ai@8.17.0`
  - `posthog-node@5.57.2`
- Node engine requirement: `>=18`
- No LLM provider SDK is present in dependencies or lockfile

### 1.3 Environment template

- `.env.example` documents only:
  - `GEMINI_API_KEY=`
  - `POSTHOG_API_KEY=`
  - `POSTHOG_HOST=`
  - `ACE_IMPORT_ROOT=`
- `.gitignore` excludes `.env` and `.env.*`, while retaining `.env.example`

### 1.4 What current runtime code references

- `app/observability/posthog-ai.js` reads only `POSTHOG_API_KEY` and `POSTHOG_HOST`
- `app/mvp/service.js` reads only operation config like `ACE_MVP_STATE_FILE`, `ACE_MVP_STAGING_FILE`, `ACE_MVP_ASSETS_DIR`, `ACE_MVP_EXPORTS_DIR`
- No runtime file references `OPENROUTER_API_KEY`, `OPENROUTER`, or any OpenRouter base URL
- No runtime file references `GEMINI_API_KEY` as an executable value; it appears only in `.env.example` and report text
- `app/mvp/service.js` contains `generateMarkdownContent()` and `buildApproaches()`, both deterministic template functions in the examined file

### 1.5 What current runtime does not do

- It does not make a real LLM inference call
- It does not load an OpenRouter key
- It does not select an OpenRouter model from configuration
- It does not normalize OpenRouter `chat/completions` responses
- It does not have any provider adapter for inference in the code I inspected

---

## 2. Analysis

### 2.1 What is already working

- Import and fixture parsing for the MVP affiliate slice
- Deterministic scoring, candidate generation, approach drafting, storyboard, script, QA, finalize checklist, and local ffmpeg render
- Optional PostHog AI observability wiring, which is off by default and still does not perform inference

### 2.2 What is template/deterministic only

- Candidate claims, reasons, and approaches come from deterministic rules and the imported export data
- `generateMarkdownContent()` fills a fixed markdown template from project data; the only runtime-varying field is the timestamp
- `buildApproaches()` is deterministic based on candidate/offer/product data
- Name labels such as `AI_DRAFT` are provenance labels only, not evidence of an LLM call

### 2.3 What is not present

- No inference provider module
- No model selection config
- No API key loading path for OpenRouter
- No response normalization from OpenRouter chat completions
- No place in the current content pipeline that is designed to receive LLM output as an input

### 2.4 Why this matters

The previous report’s main conclusion still holds after re-checking the repository:
there is no live AI provider in the runtime today. The earlier verified OpenRouter API test was external to the app and does not imply any runtime integration exists here.

The clearest gap is not just “we need an API call.” The gap is:
- an inference client module
- a small normalization layer for OpenRouter responses
- a way to feed generated text into the existing content objects safely
- a secret-handling and error-handling path that cannot leak keys

---

## 3. Workflow Impact

### 3.1 Workflow parts that already function

- Import/export ingestion
- Source, product, offer, evidence creation from the export
- Deterministic analysis and ranking
- Candidate selection and actions
- Plan draft and impact preview
- Content project scaffolding: storyboard, script, QA, finalize check, local export

None of these require an LLM.

### 3.2 What would change if OpenRouter is enabled

Only a narrow slice of the workflow would gain an LLM dependency:
- A new generation step could optionally produce some text artifact — for example draft script lines, approach notes, or a content brief
- Downstream deterministic steps would remain the same
- The app would inherit provider availability, latency, and quota risk for that step only

### 3.3 What must stay true regardless

- Existing deterministic artifacts must remain deterministic when the LLM path is not used
- Any generated text must remain traceable to the same offer/candidate/evidence identities
- Failures in the provider path must not break import, candidate generation, or local export

---

## 4. Proposed Minimal OpenRouter Integration

This is a proposal only. It is not an approved design and not an implementation instruction.

### 4.1 Overall shape

The smallest coherent design is a thin new provider module plus one controlled call site, not a broad multi-provider framework.

Suggested responsibilities:

1. **Secret loading**
   - Read an environment variable at runtime, such as `ACE_OPENROUTER_API_KEY`
   - Keep the key out of source, logs, artifacts, and UI
   - Fail early with a clear message when the key is missing and the LLM path is requested

2. **Config**
   - Model selection from environment/config, such as `ACE_OPENROUTER_MODEL`
   - Optional site/org or other headers if Owner wants them later
   - Keep defaults explicit and reviewable

3. **Client module**
   - One small module responsible for:
     - building the OpenRouter `chat/completions` request
     - attaching auth
     - setting timeouts
     - returning the raw response or a normalized subset
   - This module should not import provider SDKs; it can use Node built-ins if that is the smallest path

4. **Normalization**
   - Extract the text from `choices[0].message.content`
   - Extract usage if OpenRouter returns it
   - Validate that output is present before using it downstream

5. **Telemetry hook**
   - Reuse `app/observability/posthog-ai.js` if Owner wants generation traced later
   - Telemetry should wrap the provider call, not own it

6. **Call site**
   - One explicit place in `app/mvp/` where the app chooses to call the provider
   - That call site should remain separate from import, scoring, plan, and local render paths

### 4.2 Files that would likely need changes

Only if Owner approves implementation:

- A new small provider module under `app/mvp/`, for example a provider or OpenRouter adapter file
- Possibly one new generation helper or call site in `app/mvp/service.js` or `app/mvp/content.js`, depending on where the LLM output is consumed
- Possibly `.env.example` documentation for the new key and model config, if Owner wants OpenRouter documented as a supported provider

### 4.3 Why a provider module is still needed

Even if only OpenRouter is targeted now, a dedicated small module is still the smallest safe option because:
- it isolates auth, HTTP, and failure handling
- it makes response normalization explicit instead of scattered
- it keeps the rest of `app/mvp/` independent of OpenRouter transport details
- it makes the first live test easier to inspect and review

### 4.4 Why not “just call OpenRouter inline”

Inline calls would mix transport, auth, error handling, normalization, and business logic in one place. That is larger and harder to review than a small dedicated provider module, and it makes the first controlled live test less clean.

---

## 5. First Vertical Slice Design

This is the smallest slice I would propose for Owner decision, not something to run now.

### 5.1 Goal

Prove that ACE can load an OpenRouter key securely, select the configured model, make a real inference call through the app’s own code path, receive and normalize the response, and handle failures safely without exposing secrets.

### 5.2 Proof prompt

Use the smallest possible controlled prompt.

Example shape only — final text to be chosen by Owner:

- A short Thai or English instruction asking the model to produce a fixed, easy-to-verify output
- For example: a short JSON-like or labeled response with a known marker, or a one-paragraph draft with a known closing phrase

The point is not production content quality. The point is verifiability:
- the app’s code path is the caller
- the response can be checked mechanically
- the output can be distinguished from template output

### 5.3 Expected result

- App constructs the request using the configured model name
- App sends it to OpenRouter’s `chat/completions` endpoint
- App receives a response
- App extracts a non-empty text output
- App returns or stores that output in a controlled place
- Observability, if enabled, records the generation without exposing secrets

### 5.4 How to prove it is a real LLM call

Distinguish four evidence types:

1. **Source inspection evidence**
   - The call flows through the new provider module and call site, not through `generateMarkdownContent()` or another template function
   - The prompt and model are configurable, not hardcoded in a way that would make the result look template-like

2. **Runtime execution evidence**
   - A test run against OpenRouter with a real key produces a response through the app
   - Preferably compare: same prompt with key disabled or invalid should not return a valid LLM response
   - The response should not be a static fixture returned by app code

3. **External API response evidence**
   - The received response shape matches an OpenRouter `chat/completions` response, with the expected model and content fields
   - Usage/timing may be captured if available

4. **Security evidence**
   - Log/output inspection shows no key value
   - App output files, state, screenshots, and exported artifacts do not contain the key
   - Error messages do not echo provider auth details

### 5.5 Failure tests to include

1. **Missing or invalid key**
   - App should reject or fail the LLM path cleanly
   - Error should not contain the key
   - Non-LLM workflow paths should remain unaffected

2. **Provider error**
   - If OpenRouter returns a non-200 or an error body, the app should translate it into a controlled error
   - The app should not crash unrelated features

3. **Timeout**
   - HTTP call should have a timeout
   - Timeout should become a clear provider-timeout error, not a hanging request

4. **Invalid or unexpected response**
   - Missing content, empty content, malformed JSON, or missing model field should be handled explicitly
   - App should not use an empty or unverified output as if it were real generated text

5. **No key configured, but LLM path invoked**
   - App should fail safely without attempting to guess credentials

### 5.6 Secret protection approach

- The key should live only in environment/config and be passed directly to the HTTP client as a bearer token
- No key should be written to:
  - app logs
  - console output
  - generated content
  - state files
  - exported markdown or video
  - screenshots or UI text
  - request/query parameters
- Error paths should log only non-secret problem info
- Any future observability payload should use PostHog’s privacy controls, and should not include the raw key

---

## 6. Assumptions, Risks, Dependencies, and Open Owner Decisions

### 6.1 Assumptions

- The earlier OpenRouter direct API test referenced in prior notes was real and external, but it is not part of ACE runtime code
- Owner may want a Thai-language generation path eventually because the current content slice is Thai-oriented
- The smallest first slice can be a non-production, controlled proof prompt rather than a full content generation feature

### 6.2 Risks

- Treating the external API test as evidence of current ACE integration would be incorrect
- Treating `AI_DRAFT` labels as evidence of LLM generation would be incorrect
- Adding the provider later without a small adapter could scatter auth/error/normalization logic
- A live test without a controlled prompt may create misleading evidence about quality or readiness
- Even a free-tier provider can have rate limits, downtime, or prompt-dependent behavior that affects the slice results

### 6.3 Dependencies

- An environment/secrets approach for the key outside source control
- A decision on what prompt/result counts as sufficient first proof
- A decision on whether to install any new dependency or stay Node-built-in only for the first slice
- If PostHog AI observability is desired for this slice, `POSTHOG_API_KEY` or equivalent may be needed for the live half
- If the first slice is to be run via the app server, the current server/app startup behavior should be re-verified for any env-loading assumptions before implementation

### 6.4 Open Owner decisions

Owner should decide:

1. Whether OpenRouter integration is in scope for this branch now
2. Whether the first step should be a minimal OpenRouter provider module plus one controlled live test, or whether to stop at the current template-only state
3. Whether the first proof prompt should be Thai or English, and what output shape is acceptable for proof
4. Whether PostHog AI observability should be enabled for the first live test or remain off
5. Who approves and supervises the first live request, including which account/key is used
6. Whether the first slice should stay dependency-free or allow a new dependency if needed

---

## 7. Decision Points for Owner

### D1. Scope decision

- Option A: Authorize a minimal OpenRouter provider path and a first controlled live test
- Option B: Do not integrate yet; keep the current deterministic/template-only state

### D2. First-slice scope

If Option A:
- Keep the first slice narrowly scoped to one controlled proof prompt and failure tests
- Do not extend to full production content generation in the same slice unless Owner explicitly wants that

### D3. Evidence acceptance criteria

If Option A:
- Owner should confirm which combination of source inspection, runtime evidence, external response evidence, and security evidence is enough for the first approval

### D4. Observability decision

- Owner should decide whether to keep telemetry off for the first test or enable it for a limited run

---

## 8. Summary for Owner

Verified current state:
- ACE today has no live AI provider in runtime
- Content generation is deterministic/template-based
- OpenRouter key and model are not wired into the app
- PostHog AI observability exists but does not perform inference

Proposed smallest next move, if Owner wants one:
- A small new provider module for OpenRouter
- One controlled call site
- A minimal first vertical slice with a verifiable prompt, failure tests, and secret protection
- Clear Owner decisions before any implementation

I will stop here and wait for Owner decision.
