# ACE Content Workflow — Route Transition Mapping (Read-only Investigation)

**No source code, configuration, fixture, test, state file, or repository artifact was modified.** All evidence was extracted through source inspection only, per the read-only requirement.

---

## A. Verified Repository Baseline

- **Repository**: `/y/DevProject/Affiliate Content Engine`
- **Branch**: `mission1-planning-docs`
- **HEAD**: `795dc0a6ac66bef19725184107e6474b41aa1823`
- **Working tree**: 14 modified tracked files (sponsored PostHog changes), 160+ untracked files — all pre-existing; no modifications made by this investigation
- **Sponsored changes present**: `.env.example`, `.gitignore`, `app/observability/posthog-ai.js`, `app/README.md`, `app/server.js`, `package-lock.json`, `package.json`, `verification/posthog-ai-observability-2026-10-28.log`, `verification/posthog-ai-observability-check.js` — these add PostHog AI observability but do not alter the core ACE MVP workflow
- **No code changes, no runtime state changes, no application startup, no HTTP requests performed**

---

## B. Content Workflow Route Matrix

Every route that touches content status/state, with its HTTP method, required state, transition enforced, and source file reference.

| Route | Method | From Status | To Status | Enforced By | Precondition/Guard | Post-state |
|---|---|---|---|---|---|---|
| **`POST /api/mvp/content/draft`** | POST | (none / fresh) | **DRAFT** | `contentModule.createContentProject()` | Requires `planId` or `candidateId`; candidate must be SAVED/QUEUED; offer+product must exist in state | `project.status = 'DRAFT'`; `project.content_id` assigned; added to `state.contentOrder` |
| **`POST /api/mvp/content/:id/approach`** | POST | **DRAFT** or **REVIEW** | (stays) | Route guard `if (project.status !== 'DRAFT' && project.status !== 'REVIEW')` | Requires valid `approach` key from `['problem_first', 'value_compare', 'evidence_first', 'user_custom']` | `project.approaches[selected.key]` updated; `project.updated_at`; `project.edit_log` |
| **`POST /api/mvp/content/:id/track/visual|text|audio`** | POST | **DRAFT** or **REVIEW** (or any pre-export) | (stays) | Route guard `if (project.status === 'EXPORTED' || project.status === 'READY_TO_PUBLISH')` throws 409 | Visual/text/audio edit applied via `contentModule.applyVisualEdit/...`; `project.preview` rebuilt; `project.qa = null` |
| **`POST /api/mvp/content/:id/scenes`** | POST | **DRAFT** or **REVIEW** (or any pre-export) | (stays) | Route guard `if (project.status === 'EXPORTED' || project.status === 'READY_TO_PUBLISH')` throws 409 | add/remove/reorder scenes via `contentModule.addScene/...`; `project.preview` rebuilt; `project.qa = null` |
| **`POST /api/mvp/content/:id/assets`** | POST | **DRAFT** or **REVIEW** (or any pre-export) | (stays) | Route guard `if (project.status === 'EXPORTED' || project.status === 'READY_TO_PUBLISH')` throws 409 | Adds asset via `contentModule.addAsset`; `project.asset_order` updated |
| **`POST /api/mvp/content/:id/qa`** | POST | Any (but typically DRAFT/REVIEW) | (stays, QA report attached) | No explicit status guard; QA run via `contentModule.runProjectQa()` | `project.qa = report`; `project.updated_at`; preview rebuilt |
| **`POST /api/mvp/content/:id/review`** | POST | Any (enforced via `assertTransition`) | **REVIEW** | `contentModule.assertTransition(project.status, 'REVIEW')` — one-step transition per STATUSES order | `project.status = 'REVIEW'`; `project.updated_at`; `project.edit_log` entry 'ส่งเข้าการตรวจ' |
| **`POST /api/mvp/content/:id/finalize`** | POST | **REVIEW** (enforced via guard) | **FINALIZED** | Route guard `if (project.status !== 'REVIEW')` throws 409; then `contentModule.finalizeProject(project, report)` | `project.status = 'FINALIZED'`; `project.finalize` object written (finalized_at, checklist, qa_ran_at, script_version, script_checksum, audio); `project.updated_at` |
| **`POST /api/mvp/content/:id/export`** | POST | **FINALIZED** (enforced via guard) | **EXPORTED** | Route guard `if (project.status !== 'FINALIZED')` throws 409; then `contentModule.exportProject(project, {exportsDir})` | `project.status = 'EXPORTED'`; `project.export` object written (file, bytes, sha256, width, height, duration_s, fps, codec, container, encoder, font, pipeline, audio limitations); library index updated with entry `id: content_id, filename: basename, sha256: rendered.sha256, exported_at: now, status: 'EXPORTED'` |
| **`POST /api/mvp/content/:id/publish-prep`** | POST | **EXPORTED** (enforced via `buildPublishPrep` guard) | **READY_TO_PUBLISH** | `contentModule.buildPublishPrep(project)` throws 409 if `project.status !== 'EXPORTED'` | `project.publish_prep = payload`; `project.status = 'READY_TO_PUBLISH'`; `project.updated_at`; `project.edit_log` entry 'เตรียมข้อมูลพร้อมเผยแพร่'. Payload explicitly: `publish: { status: 'NOT_PUBLISHED', executed: false, external_calls: 0, spend_thb: 0, note: 'เฟสนี้เตรียมข้อมูลเท่านั้น...' }`; `boundaries: ['ไม่มีการเรียก Shopee หรือ API ภายนอกใด', ...]` |
| **`GET /api/mvp/library/:id`** | GET | — | — | `contentModule.getLibraryItem(id)` | Returns library entry `id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status: 'EXPORTED'`; or `null` if not found. Also verifies file integrity against stored SHA-256 |
| **`GET /api/mvp/content/:id`** | GET | — | — | `findContent(state, id)` + `contentView()` | Returns full project view including `status, content_id, product_id, candidate_id, offer_id, shop_id, approach, storyboard, cta, qa, finalize, export, publish_prep, assets, edit_log, provenance` |
| **`GET /api/mvp/content`** | GET | — | — | `state.contentOrder.map((id) => state.contents[id]).filter(Boolean)` | Lists all content projects with their statuses and statuses array `['DRAFT', 'REVIEW', 'FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH']` |

---

## C. Status Transition Enforcement Mechanics

### 1. `assertTransition` Function (content.js)
```javascript
function assertTransition(from, to) {
  const index = STATUSES.indexOf(from);
  const target = STATUSES.indexOf(to);
  if (index < 0) throw httpError(409, `unknown content status ${from}`);
  if (target !== index + 1) {
    throw httpError(409, `content status can only move one step at a time (${from} -> ${to})`);
  }
}
```
- `STATUSES = ['DRAFT', 'REVIEW', 'FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH']`
- Enforces **one-step-at-a-time** transitions
- `from` must be exactly one position before `to` in the array
- Called by `handleContentReview` before setting status to REVIEW

### 2. Route-Level Guards
Each route handler has its own status check **in addition** to `assertTransition`:
- `handleContentFinalize`: requires `project.status === 'REVIEW'`
- `handleContentExport`: requires `project.status === 'FINALIZED'`
- `handleContentTrack`: blocks if `project.status === 'EXPORTED' || project.status === 'READY_TO_PUBLISH'`
- `handleContentScenes`: blocks if `project.status === 'EXPORTED' || project.status === 'READY_TO_PUBLISH'`
- `handleContentAssets`: blocks if `project.status === 'EXPORTED' || project.status === 'READY_TO_PUBLISH'`

### 3. Actual Transition Flow (verified by route guards + assertTransition)

```
DRAFT  →  (POST /review)  →  REVIEW  →  (POST /finalize)  →  FINALIZED  →  (POST /export)  →  EXPORTED  →  (POST /publish-prep)  →  READY_TO_PUBLISH
```

**Key transitions and their enforcers:**

| Transition | Enforcer | What Happens |
|---|---|---|
| **DRAFT → REVIEW** | `assertTransition(project.status, 'REVIEW')` in `handleContentReview` | Status changes to REVIEW; log entry 'ส่งเข้าการตรวจ' |
| **REVIEW → FINALIZED** | Route guard `if (project.status !== 'REVIEW')` in `handleContentFinalize` + `contentModule.finalizeProject()` | QA run, preview built, project status → FINALIZED; finalize checklist, script/audio info written |
| **FINALIZED → EXPORTED** | Route guard `if (project.status !== 'FINALIZED')` in `handleContentExport` + `contentModule.exportProject()` | Video rendered to exports dir; library index updated; status → EXPORTED |
| **EXPORTED → READY_TO_PUBLISH** | `contentModule.buildPublishPrep(project)` guard `if (project.status !== 'EXPORTED')` | Publish prep payload written; status → READY_TO_PUBLISH; external publication explicitly NOT done |

### 4. Transitions That Are Blocked (by route guards)
- **Any status → EXPORTED** without going through FINALIZED: 409 thrown
- **EXPORTED or READY_TO_PUBLISH → any edit** (tracks, scenes, assets, approach): 409 thrown with "the content is already ${status} and can no longer be edited"
- **Skipping REVIEW** (e.g., DRAFT → FINALIZED): Would fail `assertTransition` since target must be index+1 from current; also `handleContentFinalize` guard requires status === 'REVIEW'
- **Finalize without QA passing**: `finalizeProject` throws 409 if checklist not passed; but the route handler runs QA first via `contentModule.runProjectQa()` and passes the report to `finalizeProject`

---

## D. Content Recovery / Re-Entry into Workflow

### 1. Can exported content re-enter the workflow?
**No — not without creating a new content project.**

Once a project reaches `EXPORTED` status:
- `handleContentTrack`, `handleContentScenes`, `handleContentAssets`, `handleContentApproach` all throw 409: "the content is already EXPORTED and can no longer be edited"
- `buildPublishPrep` can still be called (status → READY_TO_PUBLISH), but this is preparatory only
- The content library entry is written and read-only; no mechanism to "bring back" an exported project for editing

### 2. Can READY_TO_PUBLISH content re-enter the workflow?
**No — same restriction as EXPORTED.**

Once status is READY_TO_PUBLISH:
- Same edit-blocking guards as EXPORTED
- No route allows transitioning backward to DRAFT/REVIEW/FINALIZED

### 3. Can content be "rebuilt" or "regenerated"?
**Partial — only from the early stages.**

- **DRAFT content**: Can re-select approach, edit tracks/scenes/assets, re-run QA, re-finalize, re-export. Full workflow cycle can repeat.
- **REVIEW content**: Same as DRAFT — can edit, re-QA, re-finalize, re-export.
- **FINALIZED content**: Can still be exported (the export route only requires FINALIZED), but cannot be edited.
- **EXPORTED content**: Cannot be edited; can only have `publish-prep` called (produces READY_TO_PUBLISH payload).
- **READY_TO_PUBLISH content**: Cannot be edited; publish-prep effectively a no-op (already in final state).

**To rebuild/regenerate, the user must:**
1. Have the content at DRAFT or REVIEW status
2. Use the existing edit routes (approach, tracks, scenes, assets) to modify
3. Re-run QA via `POST /api/mvp/content/:id/qa`
4. Re-finalize via `POST /api/mvp/content/:id/finalize`
5. Re-export via `POST /api/mvp/content/:id/export`
6. Re-call publish-prep via `POST /api/mvp/content/:id/publish-prep`

All of these preserve the original `content_id`, `product_id`, `candidate_id`, `offer_id`, `shop_id` — the provenance is maintained through the state and edit_log.

---

## E. Minimal Additional Capabilities Required

Based on the route analysis, here's what currently exists vs. what would be needed for the requested capabilities:

### 1. Content Library Browse (List all entries)
- **Currently**: Only `GET /api/mvp/library/:id` — retrieve one item by ID
- **Missing**: No endpoint to list all library entries, filter by status, or search
- **Smallest addition**: `GET /api/mvp/library` that returns `state.content-library.json` items (same convention as `ACE_CONTENT_LIBRARY_FILE` env var)

### 2. Publish + External Publication
- **Currently**: `POST /api/mvp/content/:id/publish-prep` produces payload with `publish.status: 'NOT_PUBLISHED'` and explicit boundaries blocking external calls
- **Missing**: No route to actually publish externally (Shopee, Facebook, TikTok, etc.)
- **Design decision required**: Owner must decide whether to add external publication integration (would require auth, platform SDKs, etc.) or document that READY_TO_PUBLISH is preparatory-only and external publication is a separate system

### 3. Content Rebuild/Regenerate from Exported State
- **Currently**: No mechanism to bring exported content back into the workflow for editing
- **Missing**: No route to import/convert an exported project back to DRAFT/REVIEW for modification
- **Smallest safe addition**: Could add a route that creates a **new** content project from the exported artifact's metadata (content_id, offer snapshot, script, CTA), but this would be a new workflow entry, not a "bringing back" of the old project. The old project would remain in EXPORTED status.

### 4. Status History / Recovery Tracking
- **Currently**: `project.edit_log` tracks all changes with `at, track, scene_id, change`; `project.status_history` not explicitly found in content.js
- **Missing**: No explicit "recovery" or "undo" mechanism, but the edit_log + status transitions provide a traceable history
- **Smallest addition**: Document the existing edit_log as the recovery mechanism; no code change required

### 5. Content Search/Filter by Criteria
- **Currently**: `GET /api/mvp/content` returns all contents with their statuses; no filtering by candidate, product, approach, or QA result
- **Missing**: No search/filter endpoints
- **Smallest addition**: Could be built on top of the existing `state.contents` structure; would require owner decision on search criteria

---

## F. Verified Workflow Sequence (from Source)

```
1. POST /api/mvp/content/draft
   → Creates content project in DRAFT status
   → Requires: planId or candidateId (candidate must be SAVED/QUEUED)
   → Returns: project view with approaches, boundary: { writes: 'MVP fixture state only', ... }

2. Edit while DRAFT/REVIEW (any of):
   - POST /approach (change approach key)
   - POST /track/visual|text|audio (edit scene overlays/visuals/audio)
   - POST /scenes (add/remove/reorder scenes)
   - POST /assets (add image/audio assets)
   - POST /qa (run Thai QA)
   → All blocked if status = EXPORTED or READY_TO_PUBLISH

3. POST /api/mvp/content/:id/review
   → Enforced via contentModule.assertTransition(project.status, 'REVIEW')
   → Status: DRAFT → REVIEW (or any → REVIEW, but one-step only)
   → Log: 'ส่งเข้าการตรวจ'

4. POST /api/mvp/content/:id/finalize
   → Guard: requires status === 'REVIEW'
   → Runs QA, builds preview, finalizes project
   → Status: REVIEW → FINALIZED
   → Writes: project.finalize (finalized_at, checklist, qa info, script, audio)

5. POST /api/mvp/content/:id/export
   → Guard: requires status === 'FINALIZED'
   → Renders MP4 + still PNG to exports dir
   → Writes: content library index entry
   → Status: FINALIZED → EXPORTED
   → Project.export: { file, bytes, sha256, width, height, duration_s, fps, codec, container, encoder, font, pipeline, audio limitations }

6. POST /api/mvp/content/:id/publish-prep
   → Guard: requires status === 'EXPORTED'
   → Writes: project.publish_prep payload
   → Status: EXPORTED → READY_TO_PUBLISH
   → Payload: publish: { status: 'NOT_PUBLISHED', executed: false, external_calls: 0, spend_thb: 0, note: '...' }
   → Boundaries: no external calls, no Shopee API, no seller login, no ad spend

7. GET /api/mvp/library/:id
   → Reads data/mission1/content-library.json
   → Returns entry by ID with integrity verification
   → Or 404 if not found

8. GET /api/mvp/content/:id/export/video|still
   → Serves the rendered file from exports dir
   → Requires that export has been completed (status EXPORTED)
```

---

## G. Evidence Provenance

- **Repository evidence**: Source code inspection of `app/mvp/service.js` (full route registration at lines 3197–3454), `app/mvp/content.js` (STATUSES at line 1, assertTransition at line 2653, buildPublishPrep at lines 1283–1451, exportProject at lines 1100–1203, getLibraryItem at lines 1454–1461), plus all handler functions read through `sed` commands
- **Prior test logs**: Not consulted — this was a purely read-only source inspection
- **User-supplied observations**: None
- **Sponsored changes impact**: None on the core ACE MVP workflow routes or content status logic

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

The ACE content workflow has a **fully defined state machine** enforced at both the `assertTransition` level (content.js) and the route-handler level (service.js). The statuses and transitions are:

```
DRAFT → REVIEW → FINALIZED → EXPORTED → READY_TO_PUBLISH
```

Each transition has:
1. A route handler that validates the precondition status
2. `assertTransition` that enforces one-step-at-a-time progression
3. Specific actions (QA, editing, rendering, payload generation) that occur during the transition

**Key findings:**

1. **Content can be freely edited** (approach, tracks, scenes, assets, QA) while in DRAFT or REVIEW status. All edit operations are blocked once status becomes EXPORTED or READY_TO_PUBLISH.

2. **The REVIEW step is enforced**: `POST /api/mvp/content/:id/review` must be called to transition from DRAFT (or any valid status) to REVIEW. `POST /api/mvp/content/:id/finalize` requires status === 'REVIEW'. You cannot skip REVIEW and finalize directly from DRAFT.

3. **Export is the gateway to publish-prep**: `POST /api/mvp/content/:id/export` requires FINALIZED status. After export, the content library is updated, and `POST /api/mvp/content/:id/publish-prep` can be called to produce a `READY_TO_PUBLISH` payload — but this payload explicitly does NOT publish externally (`publish.status: 'NOT_PUBLISHED'`, `external_calls: 0`).

4. **Once EXPORTED or READY_TO_PUBLISH, editing is blocked**: All track/scene/asset/approach routes throw 409 with "the content is already ${status} and can no longer be edited." This is a hard boundary.

5. **Content Library** is written during `exportProject` and can be read by ID via `GET /api/mvp/library/:id`. No "list all" endpoint exists.

6. **To rebuild/regenerate**: Content must be at DRAFT or REVIEW status. Once exported, the project is effectively locked; the edit-blocking guards prevent accidental modification of finished work.

7. **No "Publish Now" or scheduled publication exists**: The system stops at READY_TO_PUBLISH. External publication would require additional routes, authentication, and platform integrations — which the current boundaries explicitly prohibit.

**The smallest safe evolution path** (based on existing structure, no new API designs):
- Add `GET /api/mvp/library` to list all library entries (browse capability)
- Document that READY_TO_PUBLISH is preparatory-only; external publication is a separate system decision
- Keep edit-blocking guards as-is; they preserve work integrity
- If rebuild/regenerate from exported state is needed, add a route that creates a **new** content project from exported metadata (preserving the original project in EXPORTED status as reference)

All of the above can be investigated through further read-only source inspection before any implementation decision.