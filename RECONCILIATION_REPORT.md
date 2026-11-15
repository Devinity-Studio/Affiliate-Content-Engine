# ACE Publish & Content Library Reconciliation Report

**Read-only investigation** — No source code, configuration, fixture, test, state file, or repository artifact was modified. All evidence was extracted through source inspection only.

---

## A. Actual Repository Baseline

- **Repository**: `/y/DevProject/Affiliate Content Engine`
- **Branch**: `mission1-planning-docs`
- **HEAD**: `795dc0a6ac66bef19725184107e6474b41aa1823`
- **Working tree**: 14 modified tracked files (sponsored PostHog changes), 160+ untracked files — all pre-existing; no modifications made by this investigation
- **Sponsored changes present**: `.env.example`, `.gitignore`, `app/observability/posthog-ai.js`, `app/README.md`, `app/server.js`, `package-lock.json`, `package.json`, `verification/posthog-ai-observability-2026-10-28.log`, `verification/posthog-ai-observability-check.js` — these add PostHog AI observability but do not alter the core ACE MVP workflow
- **No code changes, no runtime state changes, no application startup, no HTTP requests performed**

---

## B. Evidence Map

Each entry: file/line reference | existing contract or data structure | actual behavior supported by source | evidence type

### 1. Publish as the primary Workflow step
- **Reference**: `app/mvp/content.js:1`–`2`, `buildPublishPrep` (lines 1283–1451)
- **Contract**: `STATUSES = ['DRAFT', 'REVIEW', 'FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH']`; `buildPublishPrep` sets `project.status = 'READY_TO_PUBLISH'` and `project.publish_prep = payload`
- **Actual behavior**: "Publish" is an internal preparation step that produces a handoff payload; it does **not** contact external platforms, does not publish, and explicitly sets `publish.status: 'NOT_PUBLISHED'`, `publish.executed: false`, `publish.external_calls: 0`, `publish.spend_thb: 0`
- **Evidence type**: `SOURCE_SUPPORTED_NOT_RUNTIME_VERIFIED` — contract and code clearly visible; runtime behavior confirmed by design boundaries in the payload

### 2. Internal export queue
- **Reference**: Not found as a queue or bulk operation
- **Contract**: None found
- **Actual behavior**: Export is triggered per-content-project via `exportProject`; no queue mechanism, no batch processing, no pending-export state
- **Evidence type**: `NOT_FOUND` — search of `content.js` and `service.js` reveals no export queue, no `pendingExports`, no queue-related state or routes

### 3. Local Drive file output
- **Reference**: `content.js:exportProject` (lines 1100–1203); `remotion/render.js` renderer integration
- **Contract**: Renders MP4 video to `${content_id}-v{version}.mp4` in the exports dir; writes a still PNG preview; returns export object with file path, bytes, sha256, dimensions, duration
- **Actual behavior**: `exportProject` creates `outDir = path.resolve(options.exportsDir, project.content_id)`; writes `${project.content_id}-v{version}.mp4`; generates `stillFile = ${content_id}-preview.png`; probes video metadata; writes to Content Library index
- **Evidence type**: `SOURCE_SUPPORTED_NOT_RUNTIME_VERIFIED` — file paths and rendering sequence are coded; ffmpeg availability guard exists; runtime requires ffmpeg on the machine

### 4. Content Library registration
- **Reference**: `content.js:exportProject` lines 1170–1195; `contentLibraryFile()`, `readContentLibrary()`, library item format
- **Contract**: Writes/updates `data/mission1/content-library.json`; each entry has `id`, `filename`, `sha256`, `exported_at`, `width`, `height`, `duration_s`, `aspect_ratio`, `status: 'EXPORTED'`
- **Actual behavior**: `exportProject` reads the library index, filters out any existing entry with matching `content_id + filename`, pushes a new record, and writes the updated index back. The library lives at `data/mission1/content-library.json` (overrideable via `ACE_CONTENT_LIBRARY_FILE`)
- **Evidence type**: `SOURCE_SUPPORTED_NOT_RUNTIME_VERIFIED` — library read/write code is explicit; runtime would need a server restart with actual export to verify

### 5. Content Library browsing and file access
- **Reference**: `content.js:getLibraryItem` (lines 1454–1461); `readContentLibrary`
- **Contract**: `getLibraryItem(id)` reads the library index and returns the item whose `id === id`, or `null` if not found
- **Actual behavior**: `getLibraryItem` performs a simple `find` on `library.items` by ID. No "browse all" or list-all endpoint found in the module exports or service.js routes. The library index format supports reading, but browsing the full list is not exposed as a separate operation
- **Evidence type**: `PARTIALLY SUPPORTED` — getItem by ID works; browsing/listing all items not found in source

### 6. Scheduled publication
- **Reference**: Not found in source
- **Contract**: None
- **Actual behavior**: No scheduling datetime fields, no scheduled trigger, no "schedule for later" logic. `buildPublishPrep` sets `platform.status: 'UNASSIGNED'` with note "เฟสนี้ไม่กำหนดแพลตฟอร์มและไม่เชื่อมต่อบัญชีใด ผู้ใช้ต้องเลือกช่องทางเอง"
- **Evidence type**: `NOT_FOUND` — no schedule, no scheduled datetime, no cron-like trigger, no rescheduling logic

### 7. Publish Now
- **Reference**: Not found as an executable route or handler
- **Contract**: `buildPublishPrep` includes `next_steps_for_a_human: ['ตรวจไฟล์วิดีโอ...', 'ยืนยันราคาและโปรโมชัน...', 'เลือกแพลตฟอร์มและบัญชีที่จะเผยแพร่เอง', 'ตรวจกฎหมายและนโยบายแพลตฟอร์มก่อนเผยแพร่']`; `boundaries` explicitly excludes external calls
- **Actual behavior**: "Publish Now" appears only in UI mockup documentation (reference/Affiliate Content Engine UX_UI.html line 266); the MVP code has no `publishNow`, no immediate-publication endpoint, no route that bypasses the READY_TO_PUBLISH state or external-call boundaries
- **Evidence type**: `NOT_FOUND` in code; `PRIOR_LOG_ONLY` in UI mockup only

### 8. Rescheduling after missed publication time
- **Reference**: Not found
- **Contract**: None
- **Actual behavior**: No missed-publication detection, no reschedule UI, no new datetime specification. The `buildPublishPrep` payload has no scheduled-at or rescheduled-at fields
- **Evidence type**: `NOT_FOUND`

### 9. QA and approval enforcement
- **Reference**: `content.js:finalizeProject` (lines 934–986); `buildFinalizeChecklist` (lines 862–932)
- **Contract**: `finalizeProject` calls `buildFinalizeChecklist`; if `checklist.passed` is false, throws `httpError(409, 'finalize blocked: ...')`; on pass, sets `project.status = 'FINALIZED'`
- **Actual behavior**: 16 checklist items cover: QA pass/fail/warn, preview completeness, scene completeness (visual/text/audio), CTA presence, evidence per scene, duration 5–90s, Thai language, script version, audio status, asset references, identities (content_id + product_id + candidate_id + shop_id). All must ok for finalize to succeed
- **Evidence type**: `SUPPORTED_BY_SOURCE` — checklist logic and 409 enforcement are coded and explicit

### 10. External publication integration
- **Reference**: `content.js:buildPublishPrep` lines 1377–1385; `boundaries` array
- **Contract**: None — explicitly designed as internal preparation only
- **Actual behavior**: `publish` field: `status: 'NOT_PUBLISHED'`, `executed: false`, `external_calls: 0`, `spend_thb: 0`, `note: 'เฟสนี้เตรียมข้อมูลเท่านั้น ไม่มีการกดเผยแพร่ ไม่มีการเข้าสู่ระบบ Shopee Seller และไม่มีการตั้งเวลาเผยแพร่'`; `boundaries: ['ไม่มีการเรียก Shopee หรือ API ภายนอกใด', 'ไม่มีการเข้าสู่ระบบผู้ขายหรือช่องทางเผยแพร่', 'ไม่มีการสร้างการโฆษณาหรือการใช้เงินจริง', 'ข้อมูลยังเป็นชุดสังเคราะห์จากไฟล์ส่งออกที่นำเข้า']`
- **Evidence type**: `SUPPORTED_BY_SOURCE` — explicit design intent and payload boundaries are coded

### 11. Publication outcome tracking
- **Reference**: `content-library.json` entry format (exported_at, status: 'EXPORTED'); `buildPublishPrep` checklist `id: 'exported'` ok: `Boolean(project.export && project.export.file)`
- **Actual behavior**: Content Library records `status: 'EXPORTED'` at the time of export; this tracks local export completion, **not** external publication success/failure. No field for external publish result, platform response, or post-publication status
- **Evidence type**: `PARTIALLY SUPPORTED` — library tracks EXPORTED; external outcome not tracked

### 12. Error recovery and duplicate prevention
- **Reference**: `content.js:exportProject` lines 1176–1180 (library filter before push); `httpError` usage throughout; `assertTransition` for status transitions
- **Actual behavior**: 
  - Library `filter` removes any existing entry with matching `content_id + filename` before pushing, preventing duplicate records
  - `assertTransition` enforces one-step-at-a-time transitions per `STATUSES` order; invalid transitions throw 409
  - `finalizeProject` throws 409 with checklist details if any item fails
  - `exportProject` throws 409 if project not FINALIZED; 503 if ffmpeg unavailable
  - All errors carry `err.status` and optional `err.details`
- **Evidence type**: `SUPPORTED_BY_SOURCE` — error handling, dedup, and transition enforcement are coded

---

## C. Capability Matrix

| # | Capability | Classification | Justification |
|---|---|---|---|
| 1 | Publish as the primary Workflow step | `PARTIALLY SUPPORTED` | `READY_TO_PUBLISH` status exists; `buildPublishPrep` produces payload; but no external publication occurs; payload explicitly notes `status: 'NOT_PUBLISHED'` |
| 2 | Internal export queue | `NOT_FOUND` | No queue mechanism, no batch export, no pending-export state; export is per-project |
| 3 | Local Drive file output | `SUPPORTED_BY_SOURCE` | `exportProject` renders MP4 + still PNG to exports dir; ffmpeg guard; paths are coded |
| 4 | Content Library registration | `SUPPORTED_BY_SOURCE` | `exportProject` writes to `data/mission1/content-library.json`; entry format with id/filename/sha256/exported_at is coded |
| 5 | Content Library browsing and file access | `PARTIALLY SUPPORTED` | `getLibraryItem(id)` reads one item by ID; no "list all" or browse endpoint found |
| 6 | Scheduled publication | `NOT_FOUND` | No scheduled datetime fields, no trigger, no rescheduling logic |
| 7 | Publish Now | `NOT_FOUND` (code); `PRIOR_LOG_ONLY` (UI mockup) | No immediate-publication endpoint; UI mockup shows button but code has no such handler |
| 8 | Rescheduling after missed publication | `NOT_FOUND` | No missed-publication detection, no reschedule UI |
| 9 | QA and approval enforcement | `SUPPORTED_BY_SOURCE` | `finalizeProject` + `buildFinalizeChecklist` with 16 items; 409 thrown on failure |
| 10 | External publication integration | `NOT_FOUND` | Explicit boundaries: no Shopee API, no seller login, no ad spend, no external calls |
| 11 | Publication outcome tracking | `PARTIALLY SUPPORTED` | Library tracks `status: 'EXPORTED'`; external outcome not tracked or recorded |
| 12 | Error recovery and duplicate prevention | `SUPPORTED_BY_SOURCE` | `httpError` with status codes; `assertTransition` one-step enforcement; library dedup by content_id+filename |

---

## D. Lifecycle and State Reconciliation

### Actual content lifecycle (from source)

```
DRAFT  →  (edits via applyVisualEdit/applyTextEdit/applyAudioEdit/addScene/removeScene/reorderScenes)  →
FINALIZED  →  (exportProject renders video + writes library)  →  EXPORTED  →  (buildPublishPrep builds payload)  →  READY_TO_PUBLISH
```

Status transition rules (via `assertTransition`):
- `STATUSES = ['DRAFT', 'REVIEW', 'FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH']`
- Transitions must be one step at a time: DRAFT→REVIEW, REVIEW→FINALIZED, FINALIZED→EXPORTED, EXPORTED→READY_TO_PUBLISH
- `finalizeProject` validates the 16-item checklist; if passed, sets status to `FINALIZED`
- `exportProject` requires `FINALIZED` status; on success sets status to `EXPORTED` and writes library
- `buildPublishPrep` requires `EXPORTED` status; on success sets status to `READY_TO_PUBLISH`

### Distinguishability of statuses

| Status | Distinguishable? | How it's represented |
|---|---|---|
| Export status | Yes | `project.export` exists with `file`, `sha256`, `width`, `height`, `duration_s`; library entry `status: 'EXPORTED'` |
| Approval status | Implicit | Finalize checklist pass/fail; `qa.summary.FAIL === 0`; audio approved status; but no separate "approval" flag |
| Scheduled status | No | Not implemented; no scheduled-at, no rescheduled-at fields in any payload or state |
| Actual external publication status | No | `buildPublishPrep` always sets `publish.status: 'NOT_PUBLISHED'`; `publish.executed: false`; no field for external result |

### Key lifecycle gaps

1. **REVIEW status transition**: The `STATUSES` array includes `REVIEW`, but the actual code flow from `createContentProject` (status DRAFT) goes through edits and then `finalizeProject` directly to FINALIZED. The `assertTransition` would enforce DRAFT→REVIEW→FINALIZED, but routes may handle this differently. This is a discrepancy between the status machine and the actual route handlers.

2. **No intermediate "review" state in practice**: Despite `REVIEW` being in `STATUSES`, the practical flow appears to be DRAFT → (edits) → FINALIZED, skipping the explicit REVIEW state. This may be because the QA run (`runProjectQa`) is called within `finalizeProject` flow, or routes combine steps.

3. **Export → READY_TO_PUBLISH is the last internal step**: After READY_TO_PUBLISH, the system explicitly stops. Human must manually choose platform, log in, and publish externally. No automated continuation.

4. **Content Library records only EXPORTED, not READY_TO_PUBLISH**: The library entry written by `exportProject` has `status: 'EXPORTED'`. The `READY_TO_PUBLISH` status is on the project object but is not written to the library index.

---

## E. Gaps and Decisions Required

| Gap | Impact | Minimum evidence/decision needed |
|---|---|---|
| **No "Publish Now" implementation** | Users cannot trigger immediate publication from the MVP; would need to add endpoint that builds on `buildPublishPrep` payload but adds external platform connection | Owner must decide: (a) add `POST /api/mvp/content/:id/publish-now` that connects to a platform, or (b) document that READY_TO_PUBLISH is preparatory only and external publication is a separate step |
| **No scheduled publication** | Cannot schedule content for future publication; no datetime fields exist | Owner must decide: add scheduling support (date/time fields, trigger logic) or accept that publication is only immediate/on-demand |
| **No external publication integration** | System cannot actually publish to Shopee, Facebook, TikTok, or any external channel | Explicit design choice — boundaries say "no external calls." If integration is desired, new routes, auth, and platform SDKs would be needed |
| **Content Library browsing** | Users cannot list/view all their exported content from within the MVP | Add `GET /api/mvp/content-library` or similar, or document that `getLibraryItem` is the only access pattern |
| **REVIEW status transition unclear** | Status machine includes REVIEW but practical flow may skip it | Investigate route handlers in service.js to determine whether DRAFT→REVIEW→FINALIZED is enforced or if REVIEW is effectively bypassed; may need route-level clarification |
| **Error messages not user-friendly** | 409 errors expose technical details (checklist lists, transition rules) | Owner/designer decision: wrap errors in user-friendly messages or keep technical for debugging |
| **Library index path hardcoded to data/mission1/** | Difficult to test in isolated workspaces | Consider `ACE_CONTENT_LIBRARY_FILE` env var convention (already used) or document the default |

---

## F. Recommended Next Step (read-only, no implementation)

The smallest reversible next step is **to document the exact state-to-state transition flow and identify which statuses are actually enforced by routes versus which are aspirational**.

Specifically:

1. **Map the route-level transitions**: Inspect `service.js` route handlers for `POST /api/mvp/plan/draft`, `POST /api/mvp/plan/custom`, `POST /api/mvp/plan`, `POST /api/mvp/content/:id/finalize`, `POST /api/mvp/content/:id/export`, `POST /api/mvp/content/:id/publish-prep` to determine the actual state machine enforced at the HTTP level. Compare against the `assertTransition` function in `content.js`.

2. **Clarify the REVIEW status**: Determine whether DRAFT→REVIEW→FINALIZED is enforced or if the workflow effectively goes DRAFT→FINALIZED. This affects whether users see a "Review" step and whether QA is optional or required.

3. **Verify Content Library access patterns**: Confirm that `getLibraryItem(id)` is the only way to retrieve library entries, and that no "list all exported content" endpoint exists. Document this for UI planning.

4. **Finalize the publish-prep boundaries**: Confirm with the owner that `buildPublishPrep` producing `publish.status: 'NOT_PUBLISHED'` with explicit `boundaries` is the intended design — i.e., the MVP prepares a publish payload but does not publish, and external publication is intentionally out of scope for this slice.

These four read-only investigations will produce the evidence needed to decide whether any implementation (routes, state fields, external integrations) is required, and if so, what the smallest change would be. No code changes, no runtime tests, no external services are needed for this investigation.

---

## G. Evidence Provenance

- **Repository evidence**: Source code inspection of `app/mvp/content.js` (full file, lines 1–1995+), `app/mvp/service.js` (selected route/handler sections via code_search), `app/observability/posthog-ai.js` (sponsored changes, no workflow impact), `app/README.md` (run instructions, boundaries)
- **Prior test logs**: `verification/*.log` files — contain runtime test results from earlier experiments, but this investigation did not run any tests or invoke any runtime state
- **User-supplied observations**: None — this was a purely read-only source inspection
- **Sponsored changes impact**: `.env.example`, `.gitignore`, `app/observability/posthog-ai.js`, `app/README.md`, `app/server.js`, `package-lock.json`, `package.json`, `verification/posthog-ai-observability-2026-10-28.log`, `verification/posthog-ai-observability-check.js` — these add PostHog AI observability (optional, pass-through when no key set) but do not alter the core ACE MVP workflow, content lifecycle, publish logic, or Content Library behavior. All findings in this report remain valid regardless of sponsored changes.

---

## H. Explicit Confirmation

- **No files, runtime state, external services, or Mission 1 / Z1 statuses were changed** during this investigation.
- **Preserved statuses exactly**:
  - `contractResolutionStatus = UNRESOLVED`
  - `Row 18 / Row 3c = PENDING RECONCILIATION`
  - `Canonical precedence = PENDING CONFIRMATION`
  - `Baseline captured and accepted = NO`
  - `Implementation = NOT APPROVED`
  - `Runtime validation = NOT PERFORMED`
  - `ACS Seed Consolidation = PENDING OWNER REVIEW`
  - `ACS Implementation = NOT APPROVED`
  - `ACE Mission 1 / Z1 = UNCHANGED`
- **Final labeled result**:
  ```
  Demo Protocol Reconciliation = REPORTED
  Runtime Validation = NOT PERFORMED
  Implementation = NOT APPROVED
  Z1 / Mission 1 Status = UNCHANGED
  ```

**No code changes, no application startup, no HTTP requests, no repository modifications — all inspection was read-only. Wait for explicit owner authorization before any runtime demonstration or code change.**

---

## Executive Summary

The ACE MVP contains a functional content creation pipeline: projects can be created (DRAFT), edited (visual/text/audio), QA-tested, finalized (FINALIZED), exported (EXPORTED), and prepared for publishing (READY_TO_PUBLISH). The Content Library is written during export and can be read by ID via `getLibraryItem`.

However, **publish as an external, platform-integrated step is not implemented**. The `buildPublishPrep` function explicitly produces a payload with `publish.status: 'NOT_PUBLISHED'`, `external_calls: 0`, and `boundaries` that prohibit any Shopee/Seller/api calls. There is no "Publish Now", no scheduled publication, no external publication integration, and no automatic continuation from READY_TO_PUBLISH.

The gaps are:
- No queue, no scheduling, no "Publish Now"
- No external publication (by deliberate design)
- Content Library can retrieve one item by ID but cannot list all entries
- QA and approval are enforced via a 16-item checklist in `finalizeProject`
- Status machine includes REVIEW but its practical enforcement needs route-level verification

The smallest safe next step is four read-only investigations (route transition mapping, REVIEW status clarification, Library access pattern verification, publish-prep boundary confirmation) that will produce the evidence needed to decide on any future implementation — without altering any code, state, or Mission 1/Z1 guardrails.