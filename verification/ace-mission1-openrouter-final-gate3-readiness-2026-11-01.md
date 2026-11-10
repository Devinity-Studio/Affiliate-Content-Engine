# ACE — OpenRouter Integration: Final Gate 3 Readiness Brief

Read-only readiness assessment. No source code, configuration, dependency, or environment was changed. No external API was called. No `.env` was read. Only this single report file was created, as instructed.

- **Branch:** `mission1-planning-docs`
- **HEAD:** `795dc0a6ac66bef19725184107e6474b41aa1823`
- **Repository root:** `Y:\DevProject\Affiliate Content Engine`
- **Report path:** `verification/ace-mission1-openrouter-final-gate3-readiness-2026-11-01.md`

## Status labels

- **VERIFIED** — established by source inspection or a non-mutating executed check in this pass.
- **ANALYSIS** — reasoned conclusion drawn from verified facts.
- **PROPOSED** — a recommendation; not implemented and not approved.
- **UNKNOWN** — evidence insufficient; cannot be resolved under read-only boundaries.
- **OWNER DECISION REQUIRED** — a policy or authorization choice reserved to the Owner.

---

## 1. Authorization state (unchanged)

| Gate | State |
|---|---|
| Gate 1 — OpenRouter as first AI Provider | APPROVED |
| Gate 2 — Proof Contract v0.1 | APPROVED |
| Gate 3 — Implementation | **NOT AUTHORIZED** |
| Gate 4 — Live API Test | **NOT AUTHORIZED** |

This brief does not change any state. It is an input to the Owner's Gate 3 decision, nothing more. **VERIFIED**

---

## 2. Confirmed Owner decisions (recorded)

Recorded as confirmed, not re-litigated:

1. First LLM output artifact: **Script Draft**.
2. First controlled prompt language: **Thai**.
3. First integration direction: a narrow, explicit opt-in operation **alongside** `contentModule.createContentProject()`.
4. The existing deterministic path is preserved.
5. Prefer Node built-in `fetch`; **no new dependency approved**.
6. PostHog AI observability stays **disabled by default**.
7. No live API call is authorized.

**VERIFIED (as recorded decisions)**

---

## 3. Verified technical baseline for the slice

These facts were re-established by inspection in this pass and are the ground the implementation plan must stand on.

### 3.1 The runtime entry point for a Script Draft is an HTTP route

- `POST /api/mvp/content/draft` is registered at `app/mvp/service.js:3375`.
- It dispatches to `handleContentDraft()` at `app/mvp/service.js:2667`.
- That handler builds the project via `contentModule.createContentProject({...})` and persists state.
- **Consequence:** this route is the natural "originates from ACE Runtime" evidence anchor for Gate 4. A request driven through this route is distinguishable from a script run outside the app. **VERIFIED**

### 3.2 The Script Draft is produced deterministically, inside `createContentProject`

- `createContentProject()` is defined at `app/mvp/content.js:422`.
- It calls `buildStoryboard()` (`content.js` around line 236) and then `buildScript()`.
- `project.script = buildScript(project)` is assigned at `app/mvp/content.js:510`.
- `buildScript()` is defined at `app/mvp/content.js:388` and returns `{ version, language: 'th', lines, text, checksum }`, where `text` is the scene voiceovers joined by spaces and `checksum` is `sha256(text)`.
- **Consequence:** the "Script Draft" a live slice must return is `project.script.text` (Thai), and it already has a checksum field that can be compared before/after a live substitution. **VERIFIED**

### 3.3 There is no `.env` loader anywhere in the application

This is the most consequential new finding of this pass.

- `app/server.js` reads `process.env.HOST` and `process.env.PORT` (lines 22-23) and loads nothing else.
- `app/mvp/service.js:33-47` reads `ACE_MVP_STATE_FILE`, `ACE_MVP_STAGING_FILE`, `ACE_MVP_ASSETS_DIR`, `ACE_MVP_EXPORTS_DIR` directly from `process.env`.
- `app/mvp/content.js:1159-1160` and `:1426-1427` read `ACE_CONTENT_LIBRARY_FILE` directly from `process.env`.
- `app/observability/posthog-ai.js:33-34` reads `POSTHOG_API_KEY` / `POSTHOG_HOST` directly from `process.env` at module load.
- No `dotenv` import, no `.env` file read, and no CLI preload script exists in `app/` or in `package.json` scripts (`start: node app/server.js`).

**Consequence (ANALYSIS):** a key placed in `.env` would **not** be visible to the app today. For the slice, the OpenRouter key must be supplied through the real process environment (shell export / task runner), or a deliberate loading mechanism must be approved. Adding `OPENROUTER_API_KEY` to `.env.example` alone would not make the integration work, and `.env.example` is documentation only. This is a design decision the Owner must be aware of, because it changes how "loads the key securely" is demonstrated.

### 3.4 Environment-variable override convention already exists

The codebase has a consistent "resolve against `process.cwd()`" override pattern for paths (`ACE_MVP_*`, `ACE_CONTENT_LIBRARY_FILE`). A future `ACE_EVIDENCE_DIR`-style override should follow that same convention rather than inventing a new one. **VERIFIED (pattern), PROPOSED (application to evidence)**

### 3.5 Runtime and dependency posture

- `package.json:3` — `engines.node: ">=18"`; installed runtime is Node 22.23.2 with native `fetch` and `crypto.randomUUID()`. **VERIFIED**
- Dependencies remain exactly `@posthog/ai@8.17.0` and `posthog-node@5.57.2`. **VERIFIED**
- `app/observability/posthog-ai.js` is required by **no** runtime module; the only textual references are its own usage docstring and a comment in `verification/posthog-ai-observability-check.js`. It is a wrapper, not an inference provider, and it is currently inert. **VERIFIED**
- There is no OpenRouter module, and no `openrouter` string in runtime source. **VERIFIED**
- `verification/evidence/` does **not** exist yet. `verification/` does exist and is currently entirely untracked. **VERIFIED**

### 3.6 Repository tracking reality

Only **38** files are tracked in Git. The working tree contains 141+ untracked entries, including all of `app/observability/`, `package.json`, `.env.example`, `.gitignore`, and the entire `verification/` corpus. **VERIFIED**

**Consequence (ANALYSIS):** "modified tracked file" checks are nearly meaningless here; almost everything is untracked. Working-tree integrity for this project must be reported as entry-level before/after comparison, which Section 8 does.

---

## 4. Evidence Contract reconciliation

### 4.1 Bundle layout — accepted with one caveat

Proposed: `verification/evidence/openrouter/<trace-id>/` containing `trace-record.json`, `script-draft.txt`, `runtime-log.txt`, all keyed to one ACE-generated trace ID.

**Assessment: PROPOSED, structurally sound, one issue.** `verification/` is not covered by `.gitignore`, so an evidence directory under it would be a commit candidate by default. Evidence that contains accepted Thai script text (derived from real offer/product data) should not be committed casually. Either the path needs a `.gitignore` entry, or evidence should live outside the tracked tree. This needs an Owner decision, not a silent choice by the implementer.

### 4.2 Trace record allowlist — evaluated

The proposed field set:

- `traceId`, `timestamp`, `operation`, `provider`, `model`, `source`, `status`, `latencyMs`, `usage.inputTokens`, `usage.outputTokens`, `validation`, `fallbackReason`, `executionMode`.

**Assessment: PROPOSED, and sufficient as a minimum set.** Notes:

- `usage.inputTokens` / `usage.outputTokens` must be omitted rather than zero-filled when the provider reports no usage. This mirrors the existing rule in `posthog-ai.js` ("an absent count means not reported, never zero") and avoids inventing data. **VERIFIED (existing convention), PROPOSED (applied here)**
- `validation` should record the outcome of ACE's own checks (shape present, non-empty text, Thai-script plausibility, length bounds) — not a provider claim.
- `fallbackReason` is only meaningful when `status` indicates fallback; it should be `null` otherwise rather than a free-text field always populated.
- `executionMode` distinguishes offline test records from real execution; see 4.4.
- No API key, Authorization header, environment value, or raw provider payload appears anywhere in this set. That satisfies the stated privacy boundary. **VERIFIED (by construction)**

### 4.3 `source` / `status` semantics — accepted as written

- `LIVE_LLM` = actual successful provider inference contributed to the accepted output.
- `TEMPLATE` = deterministic template output.
- `MOCK` = test-only simulated provider output.
- `source` and `status` are recorded independently.
- On live failure with deterministic fallback: `source: TEMPLATE`, status such as `graceful_fallback`. Never `LIVE_LLM`.

**Assessment: PROPOSED, correct and sufficient.** The important property is that the pair `(source, status)` cannot be produced by a template path in a way that resembles live success: a deterministic run can only ever emit `source: TEMPLATE`, and only a successful provider exchange can emit `LIVE_LLM`. That is enforceable in code by construction (the provenance factory is the only writer of `source`).

### 4.4 `executionMode: OFFLINE_TEST` — recommendation

**Recommendation: yes, adopt it, and use one trace schema for both offline and live.** Reasons:

- A single schema means the offline tests exercised under Gate 3 are the same code path that produces live evidence under Gate 4 — so Gate 3 testing actually de-risks Gate 4 rather than testing a parallel implementation.
- `executionMode: OFFLINE_TEST | LIVE` is the one field that makes an offline record impossible to mistake for live provider evidence, which is the exact failure mode the Evidence Contract exists to prevent.
- It costs one enumerated field and no new infrastructure.

Counter-consideration: a shared schema means offline records could be mislabeled `LIVE` by a bug. Mitigation is structural — `executionMode` and `source` should both be derived from the execution path, not passed in by the caller.

### 4.5 Retention and privacy — recommendation

Proposed policy (do not store complete raw request/response by default; store only the minimum redacted evidence; no indefinite retention without explicit policy) is **accepted as the right default**.

**Recommendation: review-based retention.** Specifically:

- Default: retain the bundle for the current verification cycle, review it at the Owner sign-off for that cycle, and delete or archive per that review.
- Do not adopt a fixed retention window (e.g. "30 days") without the Owner choosing one — a self-chosen number would be an invented policy.
- `script-draft.txt` and `runtime-log.txt` are the artifacts most likely to carry sensitive content; `trace-record.json` as allowlisted above does not.

**OWNER DECISION REQUIRED:** retention window, review cadence, deletion authority, and whether evidence may be committed to the repository at all.

---

## 5. Success criteria — reconciled against the offline/live split

| # | Criterion | Testable offline (Gate 3)? | Needs Gate 4? |
|---|---|---|---|
| 1 | Request originates from ACE Runtime | **Partially** — the route wiring and trace-ID generation can be asserted offline; that a real request traversed that route cannot be simulated without a provider | Yes, for the real-request claim |
| 2 | A real OpenRouter response is received for the same trace ID | No | **Yes** — inherently live |
| 3 | ACE validates and normalizes the provider response | **Yes** — with recorded/stubbed response fixtures covering good, malformed, empty, error, and timeout shapes | No (fixtures suffice) |
| 4 | ACE produces the accepted Script Draft | **Yes** for the deterministic and fallback paths; the live path's accepted output needs Gate 4 | Partially |
| 5 | Provenance correctly identifies `LIVE_LLM` | **Partially** — the mapping logic is testable; that a given record honestly corresponds to a live call is not | Yes, for authenticity |
| 6 | Evidence connects Request → Response → Validation → Accepted Result | **Yes** for schema and linkage; the live instance needs Gate 4 | Partially |
| 7 | No secrets appear in logs or evidence | **Yes** — assert by construction and by scanning generated offline artifacts for the key variable name and header shape | Yes, for a real request's real logs |
| 8 | Failure and fallback paths accurately represented, not mistakable for live success | **Yes** — this is exactly the `(source, status, executionMode)` matrix, fully offline-testable | No |

**ANALYSIS.** Criteria 2 and the authenticity half of 1, 4, 5, 6 and 7 are structurally unreachable under Gate 3. Everything else is reachable offline. This split is what makes a Gate 3 approval meaningful without a live call: Gate 3 buys all wiring, all validation, all failure handling, and all evidence scaffolding; Gate 4 buys only the real exchange.

One caveat the Owner should see: **Gate 3 cannot prove the provider contract is correct** (endpoint, header name, request body shape, response field names). Those will be written from documentation and remain unverified until Gate 4. This is an accepted, named risk — not something the plan can close.

---

## 6. Proposed Gate 3 file-by-file scope

Every path below was checked against the repository in this pass. Nothing here is implemented.

### 6.1 New: `app/mvp/provider/openrouter.js`

- **Status:** NEW. Does not exist; no `app/mvp/provider/` directory exists.
- **Responsibility:** build the request, perform the call, classify failures, normalize the response. One endpoint, one function.
- **Interface (proposed):** `generateScriptDraft({ prompt, model, timeoutMs, signal, fetchImpl })` → normalized `{ ok, text, provider, model, usage, latencyMs, rawStatus, failureKind }`.
- **Why necessary:** there is no provider code at all; the contract-facing logic is the only genuinely new capability in the slice, and it must live in one auditable place.
- **Required:** yes.
- **Offline tests:** missing key → typed `missing_credential`; HTTP 401/403 → `auth_error`; HTTP 429/5xx → `provider_error`; abort/timeout → `timeout`; non-JSON body → `invalid_response`; JSON with no usable text → `empty_response`; well-formed response → `ok` with text and usage. All via injected `fetchImpl`; no network.
- **Note:** `fetchImpl` injection is the mechanism that makes criterion 8 testable without a network. It is also why no new dependency is needed.

### 6.2 New: `app/mvp/provider/provenance.js` (or a small shared module)

- **Status:** NEW.
- **Responsibility:** construct the trace record; be the sole writer of `source`, `status`, and `executionMode`; enforce the allowlist from 4.2.
- **Interface (proposed):** `buildTraceRecord({ traceId, operation, executionMode, outcome })` returning the allowlisted object, plus `buildErrorRecord(...)` for failure paths.
- **Why necessary:** the entire anti-confusion property of the Evidence Contract depends on `source` not being a free parameter set at a call site. Centralizing it is cheaper than reviewing every call site for mistakes.
- **Required:** yes — merging it into `openrouter.js` is acceptable if the Owner prefers one file, but the single-writer property must survive.
- **Offline tests:** allowlist enforcement (unknown extra fields rejected/dropped); a template path cannot emit `LIVE_LLM`; a failed live attempt emits `TEMPLATE` + fallback status; usage fields absent when unreported.

### 6.3 New: `app/mvp/provider/evidence.js` (optional)

- **Status:** NEW; **optional for the first slice**.
- **Responsibility:** write the bundle to disk using the existing `process.cwd()`-relative override convention (3.4).
- **Why it may be deferred:** evidence writing is not required to prove the integration works; it is required to *retain* that proof. Under Gate 3 there is no live proof to retain, so the first slice can ship with the trace record in-memory and the writer added at Gate 4.
- **Required:** optional.
- **Offline tests:** path resolution honors its override; no key-shaped string appears in a written artifact.

### 6.4 Existing: `app/mvp/content.js`

- **Status:** EXISTING (tracked, 1494 lines).
- **Responsibility added:** an opt-in draft path that attempts the provider and, on any failure, falls back to the existing deterministic `buildScript()` output with `source: TEMPLATE`.
- **Interface (proposed):** a new exported function, e.g. `createScriptDraftWithProvider(input)`, that internally reuses `buildStoryboard()` and `buildScript()` and does not modify `createContentProject()`.
- **Why necessary:** it is the approved call site; the deterministic path must remain byte-identical when the opt-in flag is off.
- **Required:** yes.
- **Offline tests:** flag off → `project.script` byte-identical to the pre-change implementation and `source: TEMPLATE`; flag on with stubbed success → `source: LIVE_LLM` with the stubbed text accepted; flag on with stubbed failure → `source: TEMPLATE`, fallback status, checksum equal to the deterministic result.
- **Risk to record:** `content.js` holds the R1 no-overwrite behaviour and the Content Library filter at `content.js:1213-1216`. The change must not touch `exportProject()` or the library path; a diff review should be scoped to the new function only.

### 6.5 Existing: `app/mvp/service.js`

- **Status:** EXISTING (tracked, 3537 lines).
- **Responsibility added:** route or flag exposure for the opt-in path, so execution enters through the application rather than a bare function call.
- **Interface (proposed):** either a new route (`POST /api/mvp/content/draft/llm`) or an explicit body field on the existing `POST /api/mvp/content/draft` handled by `handleContentDraft()` at `service.js:2667`. **This is an Owner/implementation choice, not a verified requirement.**
- **Why necessary:** criterion 1 ("originates from ACE Runtime") is only demonstrable if there is a runtime entry point.
- **Required:** yes (mechanism to be chosen).
- **Offline tests:** default request takes the deterministic path and returns identical results; opt-in request with the provider unconfigured returns the documented fallback shape, not a 500.

### 6.6 Existing: `.env.example`

- **Status:** EXISTING (untracked in Git despite being present).
- **Responsibility added:** document the OpenRouter variable name and its non-secret status. Documentation only — see 3.3, this file does not make the key loadable.
- **Required:** yes (documentation), with the 3.3 caveat stated in the file so no one assumes `.env` is read automatically.

### 6.7 `.gitignore`

- **Status:** EXISTING.
- **Responsibility:** ignore the evidence directory if the Owner places evidence inside the repository (see 4.1).
- **Required:** conditional on the storage decision.

### 6.8 Confirmed non-changes

- `app/observability/posthog-ai.js` — not wired, stays unwired. **VERIFIED as currently unused by runtime.**
- `package.json` — no dependency change. **VERIFIED that none is required for the design in 6.1.**
- `app/remotion/*`, `app/mvp/thai-qa.js`, `app/mvp/importer.js` — out of scope.

---

## 7. Gate 4 live test package — outstanding Owner approvals

No request may be made until every line below has an explicit Owner value:

1. **Model** — exact OpenRouter model identifier, recorded verbatim in the trace record.
2. **Account / key owner** — who owns the credential and the billing relationship.
3. **Request count limit** — a hard number for the entire live test, not per run.
4. **Input token limit** — the maximum prompt size the slice may send.
5. **Output token limit** — the maximum completion size requested.
6. **Maximum cost** — a ceiling expressed in the account's billing currency, plus the action if the ceiling would be exceeded (abort, not degrade).
7. **Timeout and retry policy** — the timeout value and an explicit retry count (a `0` retry default is a legitimate and preferable choice for a first proof).
8. **Evidence storage and retention** — path, whether it may be committed, retention window, deletion authority.
9. **Exact prompt / data scope** — the Thai prompt template plus which candidate/offer/product fields may be transmitted, and confirmation that no real Shopee user data enters the prompt. Note `.gitignore` already treats real exports as user data.
10. **Time window and operator** — when the live call may run and who runs/observes it.
11. **Go/no-go for telemetry** — confirmation that PostHog stays disabled during the live call, or a separately approved scope if it is enabled.
12. **Failure acknowledgment** — that a Gate 4 failure produces `source: TEMPLATE` evidence and no retry beyond the approved count.

**OWNER DECISION REQUIRED (all twelve).**

---

## 8. Working-tree integrity

### 8.1 Comparison method

`git status --porcelain` was captured to a scratch file **outside the repository** before any work, and captured again after the report was written. Entries were compared with `diff`, not by line count alone. No scratch state was written inside the repository.

### 8.2 Baselines

| Point | Branch | HEAD | Porcelain entries |
|---|---|---|---|
| Start of this assignment | `mission1-planning-docs` | `795dc0a6ac66bef19725184107e6474b41aa1823` | 143 |
| End of this assignment | `mission1-planning-docs` | `795dc0a6ac66bef19725184107e6474b41aa1823` | see 8.3 |

The 143-entry starting baseline matches the previous report's ending baseline of the same value; no discrepancy against the previously reported baseline. **VERIFIED**

### 8.3 Difference

Exactly one entry added:

```
?? verification/ace-mission1-openrouter-final-gate3-readiness-2026-11-01.md
```

Everything else is identical: no entries removed, no tracked file modified (`git diff --stat` empty), no file staged. The only tracked-file change in the entire repository remains the pre-existing condition described in 3.6 (only 38 files tracked; the rest of the tree is untracked and was so before this assignment).

### 8.4 Boundary compliance

- No source code change, no implementation, no dependency change, no configuration or environment change.
- `.env` was not opened; no secret value was read, printed, or inferred.
- No external API was called; the only network activity in this pass was the earlier planning pass's documentation reads, not this one.
- No commit, branch, push, or offline test that mutates repository state.

**VERIFIED**

---

## 9. Final decision brief

### 9.1 Ready for Gate 3 approval

Supported by verified evidence and the approved contract:

- The call site and mechanism are known: Script Draft, Thai, opt-in alongside `createContentProject()` at `app/mvp/content.js:422`, deterministic path untouched.
- The deterministic target is precisely identified: `project.script = buildScript(project)` at `content.js:510`, with `{ version, language: 'th', lines, text, checksum }` from `content.js:388`.
- The runtime entry point exists and is known: `POST /api/mvp/content/draft` → `handleContentDraft()` (`service.js:3375` → `:2667`), which is the anchor for "originates from ACE Runtime".
- Runtime capability is sufficient: Node >= 18 declared, Node 22 installed, `fetch` and `crypto.randomUUID()` available, no new dependency required.
- The provider surface is genuinely additive: no OpenRouter code, no `openrouter` string, no provider module anywhere in runtime source.
- Telemetry is safely inert: `posthog-ai.js` is required by no runtime module, so "disabled by default" requires no new work.
- The provenance model is specifiable with a single writer, and the failure matrix is fully testable offline via `fetchImpl` injection.
- The evidence schema, trace linkage, and `executionMode: OFFLINE_TEST` recommendation are coherent and cost no new infrastructure.
- Success criteria split cleanly: six of eight are offline-testable in whole or part; only the authenticity of a real exchange needs Gate 4.

### 9.2 Still requires Owner decision

- **API key delivery** — the app has no `.env` loader (3.3). Confirm whether the key comes from the real process environment, or whether an approved loading mechanism is added to the slice. This is the single largest unresolved technical choice.
- **Route vs. body flag** for the opt-in path (6.5).
- **Evidence storage location** — `verification/evidence/openrouter/<trace-id>/` is proposed, but `verification/` is not git-ignored (4.1).
- **Evidence retention and commit permission** — window, review cadence, deletion authority, and whether evidence may enter version control.
- **One shared trace schema vs. two** — recommended shared, with `executionMode` as the discriminator (4.4); confirm.
- **`script-draft.txt` content scope** — whether the accepted Thai draft may be retained, given it derives from offer/product data.
- **Retry policy for the first slice** — recommended `0` retries.
- **All twelve Gate 4 items** in Section 7.

### 9.3 Not authorized

- **Implementation is NOT AUTHORIZED.** No code may be written for any file in Section 6.
- **Live API testing is NOT AUTHORIZED.** No request may be sent to OpenRouter or any provider.
- This brief does not approve, and must not be read as approving, Gate 3 or Gate 4.

### 9.4 Recommendation

**The plan is sufficiently complete for the Owner to consider Gate 3, with one condition.**

The technical baseline is verified rather than assumed; the call site, deterministic target, runtime entry point, dependency posture, and telemetry inertness are all established from source. The evidence contract is coherent and, importantly, makes the offline path and the live path produce records of the same shape — which means Gate 3 work genuinely de-risks Gate 4 instead of merely preceding it.

The condition: **resolve Section 9.2's API key delivery question first.** If the Owner approves Gate 3 assuming `.env` works the way `.env.example` implies, the first implementation pass will either fail confusingly or quietly grow a configuration-loading feature nobody scoped. That is a small, cheap decision now and an expensive one later.

Recommended approach if Gate 3 is granted: implement 6.1, 6.2, 6.4 and 6.6 with the offline failure matrix from 6.1 as the acceptance gate; defer 6.3 and all of Section 7 to the Gate 4 decision.

---

## 10. Status

Report complete. Working tree differs from the starting state by exactly the one file above. No secrets were read, no API was called, no code was changed.

**Stopping here and awaiting the Owner's Gate 3 decision.**
