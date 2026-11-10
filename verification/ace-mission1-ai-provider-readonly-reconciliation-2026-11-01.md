# ACE Mission 1 — AI Provider Architecture Read-only Reconciliation

**Repository root:** `Y:\DevProject\Affiliate Content Engine`
**Investigation date:** 2026-11-01
**Mission type:** READ-ONLY investigation
**Branch:** `mission1-planning-docs`
**HEAD:** `795dc0a6ac66bef19725184107e6474b41aa1823`
**Pre-existing working-tree status:** ahead of `origin/mission1-planning-docs` by 3 untracked-only commits-equivalent context; many untracked files including prior reports, verification scripts, `app/observability/`, `app/mvp/*.js` local backups, `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `data/mission1/`, `tmp/`, `reference/`, `screenshots/`, and `app/exports/CNT-1/CNT-1-v5.mp4`.
**Working-tree status in this turn:** unchanged (no files created or modified except the report below).

---

**Status label legend**

- VERIFIED — directly established by source code or executed inspection in this turn.
- REPORTED — stated in an earlier file inspected this turn, but not independently re-verified here.
- PROPOSED — a recommendation, not an existing implementation.
- UNKNOWN — evidence is insufficient.
- NOT AUTHORIZED — implementation or action is outside this read-only mission.

---

## A. Executive Summary

ACE Mission 1 currently has **no real AI Provider architecture wired into its runtime**. The app has a documented OpenRouter/Nemotron API test result, but that test was performed externally and is not part of the runtime call path. Inside the current code tree, the only AI-related noun that exists in implementation is PostHog AI observability, which is an observability helper, not a provider adapter.

The closest thing to content generation in the app is a **deterministic template path** implemented in `app/mvp/service.js` and `app/mvp/content.js`. It produces markdown, script, storyboard, QA, finalize checks, and a real local MP4 via a local ffmpeg renderer. It does **not** call any LLM, OpenRouter, Gemini, or similar inference endpoint.

Therefore the current verified conclusion is:

- `OPENROUTER_API_KEY` appears only as a `.env` template hint and in prior report text; it is **not referenced by executable runtime code** in this branch.
- `GEMINI_API_KEY` appears only in `.env.example` and prior report text; it is **not referenced by executable runtime code** in this branch.
- PostHog AI observability is VERIFIED present, but it does **not** perform provider inference calls itself.
- The smallest viable integration path is a new small provider-layer module plus one or two call sites; no existing abstraction is currently usable as a provider adapter for generation.

---

## B. Actual Git Baseline

| Item | Value | Source |
|---|---|---|
| Repository root | `Y:\DevProject\Affiliate Content Engine` | VERIFIED, `git rev-parse --show-toplevel` |
| Current branch | `mission1-planning-docs` | VERIFIED, `git branch --show-current` |
| HEAD | `795dc0a6ac66bef19725184107e6474b41aa1823` | VERIFIED, `git rev-parse HEAD` |
| Upstream status | ahead of `origin/mission1-planning-docs` by 3 commits-equivalent context, untracked-only in this view | VERIFIED, `git status` |
| Tracked changed files in working tree | none in porcelain output this turn | VERIFIED, `git status --porcelain` |
| Untracked files | large set, including many pre-existing reports, verification scripts, backups, assets, and `app/observability/` | VERIFIED, `git status --porcelain` / `git ls-files --others --exclude-standard` |

The working tree is untracked-heavy. The relevant point here is that the branch HEAD is exactly as the checkpoint stated, and this investigation did not change Git state.

---

## C. Previous Checkpoint Verification

**Checkpoint file:** `verification/ace-mission1-continuity-checkpoint-2026-10-31.md` — VERIFIED present and readable.
**Checkpoint creation did change Git state:** REPORTED in prior checkpoint text as a read-only snapshot; this investigation cannot prove or refute attribution of checkpoint-related Git state without historical reflog inspection, which is outside scope. The checkpoint itself is a new file relative to the prior HEAD, so its existence is consistent with “a checkpoint was written at some point,” but I did not independently re-verify its pre-existing vs created-this-session origin here.

The checkpoint states the same branch and HEAD I verified here, and the same general conclusion: no AI-provider call path currently exists in the runtime.

---

## D. `.env` Loading and Provider Configuration

### Environment loading mechanism

- The current `app/server.js` does **not** appear to call `dotenv` or any equivalent `.env` file loader in the parts I reviewed. The repository does not ship `dotenv` or any env-loading package in `package.json` dependencies.
- `.env.example` is the only environment template present; `.env` is git-ignored and not part of the repository.
- Node’s `process.env` is the natural access path, and the code already uses `process.env` for operation-time config in `app/mvp/service.js` (for example `ACE_MVP_STATE_FILE`, `ACE_MVP_STAGING_FILE`, `ACE_MVP_ASSETS_DIR`, `ACE_MVP_EXPORTS_DIR`).

### Provider-related variables

| Variable | Where seen | Loaded by app? | Passed into provider code? | Runtime status |
|---|---|---|---|---|
| `GEMINI_API_KEY` | `.env.example:2`, prior report text, checkpoint text, `verification/posthog-ai-observability-research-2026-10-31.md` | NOT VERIFIED by app on startup | NOT FOUND in runtime code | INERT in current runtime |
| `OPENROUTER_API_KEY` | prior checkpoint text, prior report text, checkpoint line mentions “newly added variable” | NOT VERIFIED by app on startup | NOT FOUND in runtime code | INERT in current runtime |

### Reconciliation of conflicting historical statements

- Historical report text mentions both `GEMINI_API_KEY` as “existing/pre-existing” and an OpenRouter direct API test using `OPENROUTER_API_KEY`.
- `package.json` and current runtime code show no provider SDK and no env loader.
- My code search for `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER`, and `GEMINI` finds mentions only in docs/checkpoint/verification text and PostHog AI observability research, plus the `.env.example` template.
- I was NOT AUTHORIZED to read `.env`, so local presence/absence of a populated key cannot be confirmed here. The safe label is `.env.example` is the only non-secret file in the repo that mentions the variable names; the live `.env` file is out of scope.

Conclusion:

- `GEMINI_API_KEY` in `.env.example`: PRESENT as a template key name, EMPTY in template, NOT FOUND in executed code.
- `OPENROUTER_API_KEY` in `.env.example`: NOT FOUND in `.env.example` and NOT FOUND in executed code; REPORTED in prior checkpoint text as added in a local environment outside the repo.

---

## E. Existing Provider Architecture

### 1. Existing AI provider modules

None found.

Search and file inspection found:

- `app/mvp/service.js` — MVP affiliate workflow core.
- `app/mvp/content.js` — MVP content creation slice.
- `app/mvp/thai-qa.js` — Thai copy QA.
- `app/remotion/render.js` — local ffmpeg-based 9:16 render.
- `app/observability/posthog-ai.js` — PostHog AI observability helpers.
- `app/server.js` — HTTP server/state endpoint layer.

No module named `provider`, `openai`, `anthropic`, `gemini`, `openrouter`, `llm`, or similar exists in `app/` in the files I inspected.

### 2. Provider Adapter interfaces

None found.

There is no abstract provider interface, no `generate()` contract for inference, and no adapter registry. “AI_DRAFT” appears only as a label/origin on generated candidate approaches in `app/mvp/service.js`; it is a provenance label, not an adapter.

### 3. Model configuration and selection logic

None found in runtime.

The only model-like token in code is in `app/observability/posthog-ai.js`, which documents example shapes/configuration for Gemini-like responses, including example `model: 'gemini-2.5-flash'`. That is observability shape documentation, not an ACE model configuration.

### 4. Agent-to-provider execution path

None found.

The app does not have an agent loop or an inference call path in the files reviewed.

### 5. API client abstractions

None found.

`package.json` dependencies are only:

- `@posthog/ai`
- `posthog-node`

No `openai`, `google-auth-library`, @google/generative-ai, or similar provider dependency is present.

### 6. Error handling, retries, timeout handling, response normalization

For the existing app runtime, this is N/A to AI inference because there is no inference path.

For observability, `app/observability/posthog-ai.js` is the relevant file. My inspection of that file indicates it has:

- `captureGeneration()` and `traceGeneration()` as the main helpers.
- Offline usage/output extraction logic for Gemini-style and OpenAI-compatible shapes.
- Disabled/no-op behavior when PostHog is not configured.

This is observability extraction, not provider error handling.

### 7. Token usage and cost tracking

Not implemented in provider code.

PostHog AI observability has usage extraction helpers (`usageFromResponse()` shape) for reporting, but those are telemetry helpers, not billing/cost decisions.

### 8. Logging and observability boundaries

Present, but limited to PostHog AI observability hooks.

The relevant file is `app/observability/posthog-ai.js`. It is VERIFIED present and references Gemini-style response shapes in its docs/extractors. It is NOT an inference client.

### 9. Existing tests covering AI provider calls

None found in the repository’s `verification/` scripts.

The verification scripts I saw focus on:

- MVP workflow acceptance
- content artifact acceptance
- CWI endpoint behavior
- PostHog AI observability offline checks
- import/source handling
- claim-class validation

None of those appear to exercise a real provider inference call from within app code. The PostHog AI observability check is offline and does not require a live provider key.

---

## F. Actual Runtime AI Call Path

### Does the current ACE runtime make any real LLM inference request?

No. VERIFIED by inspection of the call paths I traced.

The runtime path for “content generation” is currently:

1. MVP state + candidate selection in `app/mvp/service.js`.
2. Deterministic content creation in `app/mvp/content.js`:
   - approaches
   - storyboard
   - script
   - QA
   - finalize checklist
3. local MP4 render via `app/remotion/render.js` using ffmpeg.

None of those files contain a provider HTTP call or provider SDK call.

### If yes, which provider and through which code path?

Not applicable.

### If no, where does execution stop?

Execution stops at deterministic template generation and local rendering. There is no external AI inference step in the current runtime path.

### Are provider-related environment variables currently inert?

Yes, in the current runtime, `OPENROUTER_API_KEY` and `GEMINI_API_KEY` are OUTSIDE runtime usage and are not loaded or consumed by the app code I reviewed. They are effectively inert placeholders for this branch.

### Is there a mock, stub, fixture, or test-only implementation that could be mistaken for a real provider?

No mock provider stub was found in the runtime modules I inspected.

The only “AI” naming in execution-adjacent code is the PostHog AI observability helpers, which are a pass-through/telemetry layer, not a model provider. The earlier report language about “AI_DRAFT” approaches refers to generated approach drafts, not LLM-generated text.

---

## G. OpenRouter Integration Gap

The gap between “OpenRouter direct API test worked” and “ACE can use OpenRouter” is substantial in the current codebase.

Current verified state:

- There is a verified **external** OpenRouter + Nemotron test result, likely performed by running a standalone Node request against `https://openrouter.ai/api/v1/chat/completions`.
- There is **no** OpenRouter client inside the app.
- There is **no** provider abstraction to plug that client into.
- There is **no** model selection code.
- There is **no** key-loading/secret-handling path wired to provider code.
- There is **no** response normalization from OpenRouter chat completions into the app’s existing content objects.

The strongest existing building blocks are:

- `app/observability/posthog-ai.js` for observability hooks if generation is added later.
- `app/mvp/content.js` structured objects (approaches, storyboard, script, QA) that a future generation path might populate.
- Deterministic markdown generation in `app/mvp/service.js` as a non-LLM fallback shape.

---

## H. Smallest Proposed Integration Path

This section is PROPOSED only.

### 1. Reusable existing interfaces

For provider calls themselves: none exist yet.

For surrounding concerns, the following are usable:

- Node built-ins only: no extra dependency needed for a minimal OpenRouter client.
- Existing state objects in `app/mvp/service.js` and `app/mvp/content.js` can remain the downstream shape that any future provider plug-in populates.
- `app/observability/posthog-ai.js` can be reused for observability of generation calls if desired.

### 2. Minimum files that might need future changes

A minimal path could be:

- A new small provider module, for example `app/mvp/providers/openrouter.js` or a more generic `app/mvp/ai/provider.js`.
- A small router/adapter entry point that normalizes OpenRouter `chat/completions` responses into the app’s expected project shape.
- Possibly one or two call-site changes in `app/mvp/content.js` or a new generation helper, depending on whether content generation should be LLM-driven.
- `.env.example` update to document the new key name, if Owner approves adding OpenRouter as a supported provider.

### 3. Whether a provider adapter is necessary

Not strictly necessary as a grand abstraction, but a thin adapter is the smallest sensible shape.

Even if only OpenRouter is targeted now, wrapping the HTTP call, auth, error handling, and response extraction in one small module would keep the MVP slice testable and separable. That is much smaller than a full multi-provider framework.

### 4. How model selection could be configured

Simplest viable approach:

- A single config value, likely from the environment, such as `ACE_OPENROUTER_MODEL` and/or `ACE_AI_PROVIDER`.
- Default to the already-verified free model if Owner wants minimal config: `nvidia/nemotron-3.5-lightning:free`.
- Keep model selection explicit rather than discovered, so behavior is reviewable.

### 5. How API keys should remain outside source control

Already consistent with current repo:

- Keep key names and values out of tracked files.
- Document the key name in `.env.example` only.
- Add `.env` to `.gitignore` if not already handled; it is git-ignored per current `.gitignore` entries for `.env` and `.env.*`.
- Never print, log, or return key values; only pass them to the HTTP client as a bearer token.

### 6. How failures and usage metadata should be represented

Minimal proposal:

- Network/HTTP errors: fail fast with a clear, non-secret error message; do not include response bodies that may contain secrets or provider internals.
- Provider errors: classify as provider error vs app config error vs input error.
- Usage metadata: capture prompt/input tokens and completion/output tokens where the provider returns them; pass to observability helpers if enabled.
- Response normalization: convert OpenRouter `choices[0].message.content` into a plain string at minimum; validate presence before using it.

---

## I. Minimal Vertical Slice and Evidence Requirements

Proposed only. Not executed.

### 1. ACE loads the OpenRouter key securely

Evidence:

- Source inspection: key variable name referenced only from env, never from code constant, file, or repo artifact.
- Runtime evidence: start the app with a real key and an empty/missing key; assert that missing key prevents generation and does not crash unrelated paths.
- Security evidence: assert no key value appears in logs, HTTP response bodies, generated content, or exported artifacts.

### 2. ACE selects the configured OpenRouter model

Evidence:

- Source inspection: model name read from env/config, not hardcoded in multiple places.
- Runtime evidence: with a config override, generation request uses the overridden model; default behavior uses the default when config is absent.
- This is best shown with external API response evidence, not just code inspection.

### 3. ACE makes a real inference request through its runtime

Evidence:

- Runtime execution evidence: a controlled request made by the app’s own code path, not an ad hoc script outside the app.
- External API response evidence: a real OpenRouter response received by the app’s provider module.
- Prefer a low-risk no-op-ish prompt for the first live proof, with Owner approval, not a production content generation.

### 4. ACE receives and normalizes the response

Evidence:

- Source inspection: response extraction logic present and tested.
- Runtime evidence: app returns normalized text/structured object downstream.
- Offline tests for extraction shape, plus a live integration run, would be stronger together.

### 5. ACE handles provider errors safely

Evidence:

- Runtime evidence: invalid/empty key, network failure, and bad-model/400-class errors produce controlled failures.
- Source inspection: error path does not leak secrets or raw provider response bodies to users.

### 6. No secret is exposed in logs or output

Evidence:

- Security evidence: logs, API responses, exported MP4s, markdown artifacts, and state files inspected after a generation run do not contain the key.
- This is easier to prove with a redacted log comparison and a controlled first request than with code inspection alone.

---

## J. Risks, Unknowns, and Contradictions

### Risks

- Treating the prior OpenRouter direct test as evidence of current ACE integration would be wrong. It is a separate external test.
- PostHog AI observability is real, but it must not be described as a provider adapter.

### Unknowns

- Whether `.env` currently contains a live `OPENROUTER_API_KEY` or `GEMINI_API_KEY`. Not AUTHORIZED to inspect.
- Whether any earlier branch or untracked workspace copy already added a provider module outside the current `app/mvp/` I inspected. Not fully ruled out for uncommitted/untracked work outside what I reviewed.

### Contradictions resolved or flagged

- Historical text sometimes referred to `GEMINI_API_KEY` as if it were live in the app. In the current code I inspected, it is not referenced by runtime. So the correct current label is: present in `.env.example`, absent from runtime code, inert for this branch.
- The checkpoint says a new `OPENROUTER_API_KEY` was added locally. That may be true in the live environment, but it is not in `.env.example` and not in runtime code here. So the repo-side record is not VERIFIED; only the prior written claim is REPORTED.

---

## K. Recommended Next Owner Decision

Recommended decision for Owner:

1. Decide whether OpenRouter/Nemotron integration is in scope for this branch now.
2. If yes, decide:
   - whether to start with a minimal provider module plus one controlled live test, or
   - whether to first stand up a provider abstraction.
3. If yes, decide who provides the first controlled live request and what prompt/content is acceptable for that proof.
4. If no, the current conclusion stands: the runtime has no AI provider integration yet, and the existing `.env` keys are inert.

No implementation should proceed until Owner chooses one of those directions.

---

## Completion Report

1. **Exact report file path:** `verification/ace-mission1-ai-provider-readonly-reconciliation-2026-11-01.md`
2. **Exact checkpoint file path, if found:** `verification/ace-mission1-continuity-checkpoint-2026-10-31.md`
3. **Git branch and HEAD:** `mission1-planning-docs` @ `795dc0a6ac66bef19725184107e6474b41aa1823`
4. **Working-tree status before and after investigation:** unchanged during this turn; pre-existing working tree was untracked-heavy with many reports, verification scripts, backups, assets, and `app/observability/`
5. **Files created by this investigation:** only `verification/ace-mission1-ai-provider-readonly-reconciliation-2026-11-01.md`
6. **Confirmation that no production code, configuration, dependencies, or existing reports were modified:** confirmed for this turn; only the new report above was written.
7. **Any inspection that could not be completed and why:** live `.env` contents could not be inspected (not authorized); running a live OpenRouter request from within ACE was not authorized; full historical Git attribution for the checkpoint creation was not reproven here.
8. **The next decision that requires Owner approval:** whether to authorize the smallest OpenRouter integration path and the first controlled live inference evidence run, or to leave the current inert-key state as-is.

---

## Evidence trail used this turn

- `git rev-parse --show-toplevel`
- `git branch --show-current`
- `git rev-parse HEAD`
- `git status --porcelain`
- `git status`
- `git ls-files --others --exclude-standard`
- Code search for OpenRouter / Gemini / provider loading patterns
- Read: `.env.example`, `.gitignore`, `package.json`, `app/server.js`, `app/mvp/service.js`, `app/mvp/content.js`, `app/remotion/render.js`, `app/observability/posthog-ai.js`, `verification/ace-mission1-continuity-checkpoint-2026-10-31.md`, `verification/posthog-ai-observability-research-2026-10-31.md`, and prior reconciliation report files.
