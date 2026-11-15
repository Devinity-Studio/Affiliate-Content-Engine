# Mini Loop & Content Re-entry Contract Reconciliation (Read-only Investigation)

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

## B. Answers to the 7 Investigation Questions

### 1. Content version new will reference Content original and store history how

**Answer**: Based on source evidence, a new content project can reference the original through its embedded identities, but the existing state does not automatically create a "version history chain" between separate content projects.

**Source evidence**:

- Each content project (`state.contents[contentId]`) stores these identity fields:
  - `candidate_id`, `product_id`, `offer_id`, `shop_id`
  - `plan_id`, `plan_record_id`
  - `approach` (the selected approach key)
  - `edit_log`: array of `{at, track, scene_id, change}` entries
  - `provenance`: `{source, method, candidate_id, plan_id, approach, source_sha256, limitations}`

- When `createContentProject` is called, it generates a **new** `content_id` via `nextContentId(state)` which is `CNT-{count+1}`. The new project does **not** automatically link back to a parent project.

- The `edit_log` within a single project tracks all visual/text/audio edits, scene changes, and asset additions with timestamps. This provides a history **within** that project's lifetime.

- There is **no field** in the content project structure that references a `parent_content_id`, `previous_version`, or `original_content_id`. The state structure has:
  - `contents: {}` — mapping content_id → project
  - `contentOrder: []` — ordered list of content_ids
  - No `contentVersionHistory` or `contentParentLinks`

- **How a new version can reference original**: A developer/route can embed the original `content_id`, `offer_id`, `product_id` etc. in the new project's `provenance.limitations` or in the `approach.angle`/`hook` text. The route handlers do not prevent this — they only guard status transitions. For example, `handleContentDraft` accepts any `planId` or `candidateId` and creates a new content project from that candidate. The new project will have the same `candidate_id`, `offer_id`, `product_id` as the original candidate, but a new `content_id`.

- **History storage**: The `edit_log` within each project stores the revision history for that project. To store cross-project history, the operator must manually coordinate (e.g., via the decision-log at `data/mission1/decision-log.md`, or by embedding references in the new project's `provenance.limitations` or approach notes).

**Conclusion**: The existing Workflow Core does not automatically link new content projects to originals or maintain a version chain. This is a gap that would need a design decision: either (a) add `parent_content_id` / `previous_content_id` fields to the content project structure, or (b) rely on operators to manually track versions through external logs or embedded references.

---

### 2. Starting new work from Content Library will re-enter Workflow Core from which point

**Answer**: Based on source evidence, re-entering the workflow from the Content Library depends on what state information is available in the library entry, and the re-entry point is typically **DRAFT** (if starting from a candidate) or a **new workflow cycle**.

**Source evidence**:

- `GET /api/mvp/library/:id` returns library entries with this format (from `exportProject`):
  ```json
  {
    "id": "CNT-xxx",           // same as content_id
    "filename": "CNT-xxx-v1.mp4",
    "sha256": "rendered hash",
    "exported_at": "ISO datetime",
    "width": 1080, "height": 1920,
    "duration_s": 30,
    "aspect_ratio": "9:16",
    "status": "EXPORTED"
  }
  ```

- **What the library entry does NOT contain** that would enable direct workflow re-entry:
  - `candidate_id` — not in the library entry format
  - `offer_id`, `product_id`, `shop_id` — not in the library entry format
  - `approach` key — not in the library entry format
  - `status` beyond `EXPORTED` — the entry only has `status: 'EXPORTED'`
  - `edit_log` — not included in library entries
  - `provenance` details beyond what's in the export

- **What the library entry DOES provide**:
  - `id` (= `content_id`) — can be used to fetch the full project view via `GET /api/mvp/content/:id`
  - But if the project is at `EXPORTED` status, the route guards block all edits: `handleContentTrack`, `handleContentScenes`, `handleContentAssets`, `handleContentApproach` all throw 409 with "the content is already EXPORTED and can no longer be edited"

- **Re-entry points available from source**:

  a) **Via `GET /api/mvp/content/:id`**: Fetch the full project. If status is DRAFT or REVIEW, full editing is possible via all edit routes. If status is FINALIZED, export is still possible. If status is EXPORTED or READY_TO_PUBLISH, editing is blocked.

  b) **If the project is at DRAFT/REVIEW/FINALIZED status**: The operator can continue the workflow from that point using existing routes (approach, tracks, scenes, assets, QA, finalize, export).

  c) **If the project is at EXPORTED status**: No re-entry via existing routes. The only option is `POST /publish-prep` which produces READY_TO_PUBLISH payload (preparatory only, no external publication).

  d) **Creating a new content project from library metadata**: Not directly supported. The operator would need to reconstruct the candidate/offer/product state from other sources (e.g., the fixture state, or by re-importing the original Shopee export), then create a new content project via `POST /api/mvp/content/draft`.

**Conclusion**: Starting new work from Content Library entries is possible **only** if the content project is at DRAFT, REVIEW, or FINALIZED status. Once EXPORTED, the project is locked and cannot re-enter the editing workflow via existing routes. The library entry itself lacks the metadata (candidate_id, offer_id, etc.) needed for automatic re-entry; the operator must reconstruct this from external records or accept that EXPORTED projects require a fresh start.

---

### 3. Mini Loop will know which steps need to be redone and which can reuse previous results

**Answer**: Based on source evidence, the Mini Loop decision logic must be operator-defined, because the existing Workflow Core does not embed "step-skippability" flags or dependency graphs into content projects or library entries.

**Source evidence**:

- **No "step completion" flags exist** in the content project structure. The project has:
  - `status` (one of DRAFT/REVIEW/FINALIZED/EXPORTED/READY_TO_PUBLISH)
  - `qa` (QA report object or null)
  - `finalize` (object with checklist, qa_ran_at, script_version, script_checksum, audio — or null)
  - `export` (object with file, bytes, sha256, dimensions, duration, or null)
  - `publish_prep` (payload with checklist, or null)
  - `edit_log` (array of change entries)
  - `approaches` (4 approach objects with evidence_ids, gate_notes, tradeoffs)
  - `storyboard`, `script`, `cta`

- **No per-step metadata** indicates which steps were completed. For example:
  - No `approach_selected: true/false`
  - No `qa_run: true/false` with results flag
  - No `finalized: true/false` with checklist summary
  - No `exported: true/false` with renderer status
  - No `publish_prepped: true/false`

- **How the workflow currently tracks completion**:
  - Status transitions are the primary indicator: DRAFT → REVIEW → FINALIZED → EXPORTED → READY_TO_PUBLISH
  - `finalizeProject` throws 409 if the 16-item checklist has any FAIL items
  - `exportProject` requires FINALIZED status and ffmpeg availability
  - `buildPublishPrep` requires EXPORTED status

- **What the Mini Loop would need to determine** (operator-defined, not source-embedded):
  - If status is DRAFT: all steps (approach selection, edits, QA, finalize, export) need to be redone from the beginning, OR approach/QA/edits can be reused if the operator decides
  - If status is REVIEW: QA hasn't been run yet (or was run but project is stuck in REVIEW). Finalize step needs to be done.
  - If status is FINALIZED: QA and finalize are done. Export step may need to be redone if the export file is lost or corrupted, but the project state is preserved.
  - If status is EXPORTED: Video file and library entry exist. Re-editing is blocked. Only publish-prep can be called (produces READY_TO_PUBLISH). To re-edit, the operator must create a new content project.
  - If status is READY_TO_PUBLISH: Publish prep is done. No further internal steps.

- **Dependency reuse decisions** (operator-defined):
  - **Approach**: Can reuse the existing approach key, or select a new one. If the approach key is the same, the same `buildContentApproaches` logic applies. If changed, the new approach's `evidence_ids` and `gate_note` apply.
  - **QA**: Can reuse the previous QA report if the source data hasn't changed, or re-run `runProjectQa` if the data has changed (e.g., fresh export, updated prices). The route `POST /qa` re-runs QA and overwrites `project.qa`.
  - **Edits (tracks/scenes/assets)**: If status is DRAFT/REVIEW, all edits are possible. If the operator wants to reuse previous edits, they must manually coordinate via `edit_log` inspection or external records. There is no "reuse previous edits" flag.
  - **Finalize**: Must re-run if QA was re-run or source data changed. The checklist is deterministic given the same project state and QA report.
  - **Export**: Must re-run if the video file is lost, ffmpeg is newly available, or the operator wants a new render (e.g., different font, updated codec). The render uses `renderer.renderVideo({scenes, outFile, workDir, assets})` which depends on the current project's storyboard, assets, and audio state.
  - **Publish prep**: Can be re-called after export to update the payload, but the `publish.status: 'NOT_PUBLISHED'` and `boundaries` remain the same.

**Conclusion**: The Mini Loop's "which steps to redo" logic is **not embedded in the source** — it must be operator-defined based on the current status and the specific context. The source provides the mechanics (status guards, route handlers, QA/finalize/export functions) but not the policy decisions about step reuse. The operator must track:
  - Current status
  - Whether QA has passed (via `qa.summary.FAIL === 0`)
  - Whether the export file exists and is intact (via library SHA-256 verification)
  - Whether source data has changed (track via `data_as_of` / `checked_at` / freshness checks)
  - Which approach is selected and whether it matches the original

---

### 4. Any changes must re-run QA, Finalize, and Approval before Publish new version

**Answer**: Based on source evidence, **yes** — any content that moves from one status to another (especially upward in the state machine) requires the full gate sequence. However, if staying at the same status and only editing, QA/finalize/approval may not need re-running if the operator confirms no changes affecting those gates.

**Source evidence**:

- **QA** is run via `runProjectQa(project, context)` which segments Thai copy against the lexicon and generates a report with `summary: {PASS, WARN, FAIL counts}`. The report is stored in `project.qa`. 

- **Finalize** is the gate that moves status from REVIEW → FINALIZED. `finalizeProject(project, report)`:
  - Calls `buildFinalizeChecklist(project, qa)` which checks 16 items
  - If `checklist.passed` is false, throws `httpError(409, 'finalize blocked: ...')`
  - If passed, sets `project.status = 'FINALIZED'` and writes `project.finalize` object
  - The checklist includes: QA FAIL=0, preview completeness, scene completeness (visual/text/audio), CTA presence, evidence per scene, duration 5-90s, Thai language, script version, audio status, asset references, identities

- **Approval** (external publication) is not part of the internal workflow. `buildPublishPrep` produces `publish: {status: 'NOT_PUBLISHED', executed: false, external_calls: 0, spend_thb: 0}` with explicit boundaries. There is no "approval" field within the internal state — external publication would be a separate system.

- **Re-running gates when editing**:

  a) **If editing while status is DRAFT or REVIEW**: 
     - New approach selection via `POST /approach` — does **not** re-run QA or finalize automatically. The approach just changes; the gate_note indicates "Draft only. No experiment is created and G2 is not requested."
     - Text/visual/audio edits via `POST /track/...`, `POST /scenes`, `POST /assets` — do not re-run QA or finalize. `project.qa = null` is set after any edit, forcing QA re-run before finalize.
     - `POST /qa` re-runs Thai QA and updates `project.qa`. This should be done before finalize.
     - After edits + QA, `POST /finalize` re-finalize with the new QA report.

  b) **If editing while status is FINALIZED**: Not possible — edit routes block with 409.

  c) **If exporting again after FINALIZED**: 
     - `POST /export` can be called again on the same FINALIZED project. It re-renders the video and updates the library entry (replacing the old one with same content_id + filename). The QA and finalize status are not re-checked — export only requires FINALIZED status.

  d) **If creating a new version from an existing EXPORTED project**: 
     - Not possible via existing routes (editing blocked).
     - Must create a **new** content project via `POST /api/mvp/content/draft`, which requires a candidate that is SAVED/QUEUED. The new project starts at DRAFT, and the full gate sequence (approach → edits → QA → finalize → export) applies from scratch.

- **Approval before Publish**: The internal workflow never implements external publication approval. `buildPublishPrep` explicitly states `publish: { note: 'เฟสนี้เตรียมข้อมูลเท่านั้น ไม่มีการกดเผยแพร่ ไม่มีการเข้าสู่ระบบ Shopee Seller และไม่มีการตั้งเวลาเผยแพร่' }`. If external publication is desired, it would be a separate system decision outside the MCP.

**Conclusion**: Yes — any upward status transition (DRAFT → REVIEW → FINALIZED → EXPORTED → READY_TO_PUBLISH) requires the full gate sequence. However:
- While at DRAFT/REVIEW, edits can be made; QA should be re-run before finalize
- While at FINALIZED, export can be repeated without re-running QA/finalize
- While at EXPORTED/READY_TO_PUBLISH, no internal steps can be re-done; the only action is publish-prep (preparatory only)
- External publication approval is not part of the internal workflow

---

### 5. Re-publication using existing assets will be possible without re-Exporting

**Answer**: Based on source evidence, **yes** — re-publication using existing assets (without re-exporting) is possible **at the READY_TO_PUBLISH stage**, but the re-publication itself is not automated. The existing assets are those bound to the project's scenes via `asset_ref`, and they are already rendered in the exported video.

**Source evidence**:

- **Assets in the project**: Each content project has `assets: {}` mapping assetId → record, and `asset_order: []` listing the order. Each asset record has `id, kind, filename, file, path, bytes, mime, sha256, created_at, used_by[]`. Scenes have `visual.asset_ref` and `audio.asset_ref` that point to asset IDs.

- **Exported video contains the assets**: When `exportProject` renders the video, it includes the asset files. The exported MP4 at `project.export.file` contains the visual and audio mix. The `project.export.still` is a PNG frame from the video. The library entry records `sha256: rendered.sha256` (of the rendered video, not individual assets).

- **`POST /api/mvp/content/:id/publish-prep`** is the route that enables re-publication without re-exporting:

  a) **Guard**: Requires `project.status === 'EXPORTED'`
  
  b) **What it does**:
     - Validates 10 checklist items: exported, aspect, cta, script, ids, assets, qa, audio, no_account
     - Builds a publish payload with `publish: { status: 'NOT_PUBLISHED', executed: false, external_calls: 0, spend_thb: 0, note: '...' }`
     - Sets `project.status = 'READY_TO_PUBLISH'`
     - Writes `project.publish_prep = payload`
     - Logs `change: 'เตรียมข้อมูลพร้อมเผยแพร่'`
  
  c) **What the payload provides for external publication**:
     - `video: { file: project.export.filename, bytes, sha256, width, height, duration_s }` — the already-rendered MP4
     - `audio: { required, status, approved, mismatches, files }` — the audio assets already in the project
     - `assets: [...]` — the asset records (paths, sha256, used_by)
     - `caption_draft`: formatted text from offer data
     - `hashtags`, `disclosure`, `product_reference`
     - `next_steps_for_a_human`: human instructions for the actual publication step
     - `boundaries`: explicit prohibitions on external calls

  c) **What re-publication requires** (operator/external step, not automated by the MCP):
     - The MCP's `publish-prep` produces a **preparation payload only**. It does **not** contact any external platform, does not post to Shopee/Facebook/TikTok, does not set publication schedules, and does not handle ad spend.
     - The `next_steps_for_a_human` field lists what a human must do:
       1. "ตรวจไฟล์วิดีโอด้วยสายตาก่อนใช้งานจริง" — visually inspect the video file
       2. "ยืนยันราคาและโปรโมชันปัจจุบันกับหน้าสินค้าต้นทาง" — verify current price/promotion against the source product page
       3. "เลือกแพลตฟอร์มและบัญชีที่จะเผยแพร่เอง" — choose the platform and account
       4. "ตรวจกฎหมายและนโยบายแพลตฟอร์มก่อนเผยแพร่" — check platform laws/policies
     - After these human steps, the operator would use the platform's own SDK/API to publish the video file, using the prepared payload as reference but not as an automated action.

  d) **If the project is at EXPORTED status and publish-prep has NOT been called**:
     - Calling `publish-prep` once sets status to READY_TO_PUBLISH and writes the payload
     - Calling `publish-prep` again on a READY_TO_PUBLISH project would throw 409 (status must be EXPORTED). So it can only be called once per export cycle.

  e) **If the project is at READY_TO_PUBLISH status**:
     - The publish prep payload is already written. Re-calling publish-prep is not needed; the payload is intact.
     - The only way to reset would be to re-export (which replaces the video and updates the library), then call publish-prep again.

**Conclusion**: Yes — re-publication using existing assets is possible at the READY_TO_PUBLISH stage via `POST /publish-prep`. The route:
- Requires status EXPORTED (can only be called once per export cycle)
- Produces a payload with the already-rendered video, audio assets, and publication-preparation data
- Sets status to READY_TO_PUBLISH
- **Does NOT** actually publish externally — it prepares the data for a human to publish via the platform's own SDK/API

The `next_steps_for_a_human` and `boundaries` fields make it clear that the MCP prepares the handoff but does not perform the external publication. If the operator wants to publish to another channel, they use the prepared payload as reference and publish through the platform's own tools.

---

### 6. Adding full Content Library browsing will be done without damaging the existing API contract

**Answer**: Based on source evidence, **yes** — a `GET /api/mvp/library` endpoint can be added without damaging the existing API contract, by following the same conventions already in the codebase.

**Source evidence**:

- **Existing library convention**: The Content Library is at `data/mission1/content-library.json`, read via `contentModule.contentLibraryFile()` which respects `ACE_CONTENT_LIBRARY_FILE` env var override (same pattern as state, exports, and assets directories).

- **Existing read pattern**: `readContentLibrary()` function (content.js lines 1438-1461) handles:
  - Reading the file, tolerating leading `#`-comment header lines (same convention as `verification/check-content-library.js`)
  - Parsing JSON, supporting both `[items]` and `{ items: [...] }` formats
  - Returning `{ items: [...] }`

- **Existing library item format** (from exportProject): each entry has `id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status: 'EXPORTED'`

- **How to add browsing without breaking the contract**:

  a) **Add `GET /api/mvp/library` route** (following the existing route pattern in service.js):
     ```javascript
     if (pathname === '/api/mvp/library' && method === 'GET') {
       const state = await readState(); // not needed for library, but consistent
       ctx.sendJson(res, 200, await contentModule.listContentLibrary());
       return true;
     }
     ```
     
  b) **Add `listContentLibrary()` to contentModule** (content.js), following the same pattern as `readContentLibrary()`:
     ```javascript
     async function listContentLibrary() {
       const contentLibraryPath = contentModule.contentLibraryFile();
       let text;
       try {
         text = await fsp.readFile(contentLibraryPath, 'utf-8');
       } catch (err) {
         if (err && err.code === 'ENOENT') return { items: [] };
         throw err;
       }
       const cleaned = text.split('\n').filter((line) => !line.trimStart().startsWith('#')).join('\n');
       let parsed;
       try {
         parsed = JSON.parse(cleaned);
       } catch (err) {
         throw httpError(500, `content library index is malformed; cannot read ${contentLibraryPath}`);
       }
       if (Array.isArray(parsed)) return { items: parsed };
       if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) return parsed;
       throw httpError(500, `content library index has an unexpected shape: ${contentLibraryPath}`);
     }
     ```
     
  c) **Contract compatibility**: The new endpoint returns the same shape as individual library entries, just as a list. Existing code that uses `GET /api/mvp/library/:id` continues to work unchanged. The library file format is unchanged. The env var `ACE_CONTENT_LIBRARY_FILE` continues to work for overriding the path.

  d) **No route conflicts**: The new route `GET /api/mvp/library` does not conflict with existing routes:
     - `GET /api/mvp/library/:id` — retrieves one item by ID (path has `:id` segment)
     - `GET /api/mvp/library` — lists all items (no `:id` segment)
     - These are distinguishable by the presence/absence of the `:id` segment, same as how `GET /api/mvp/content` (list all) and `GET /api/mvp/content/:id` (one item) are distinguished.

- **No state modification**: `listContentLibrary()` only reads the file; it does not write, does not modify state, does not call `writeState`. Same read-only pattern as `readContentLibrary()`.

- **Error handling**: Same pattern as other routes — if the file doesn't exist, return `{ items: [] }`. If malformed, throw 500 with descriptive message. Same as `readContentLibrary()` and `handleContentLibraryItem`.

**Conclusion**: A `GET /api/mvp/library` browsing endpoint can be added with minimal code (≈15 lines in content.js + 1 route handler in service.js) without damaging the existing API contract. The pattern follows existing conventions (env var override, comment-tolerant JSON reader, same library file format). The endpoint would return all library entries, enabling UI to display "all my exported content" without needing to know IDs in advance.

---

### 7. Preventing duplicate work, using old version results, and wrong version publication

**Answer**: Based on source evidence, the existing Workflow Core does **not** have built-in mechanisms for preventing duplicate work, using old version results, or preventing wrong version publication. These are operator-level policies that must be designed externally or through additional fields.

**Source evidence**:

- **No "version" or "generation" fields** in the content project structure that auto-increment or link between projects. Each project gets a sequential `content_id` via `nextContentId(state)`, but there's no `version` field or `generation` counter that's preserved across projects.

- **No deduplication logic** between content projects. The `state.contents` object maps `content_id` → project, and `state.contentOrder` lists the order. There's no check before creating a new content project to see if an "equivalent" project already exists (same candidate, same approach, same source data).

- **No "source data change detection"** that automatically flags when QA/finalize/export should be re-done. The project stores `offer_snapshot.data_as_of` and `offer.checked_at`, but there's no automatic comparison against current data. The `sourceFreshness` function (service.js) exists for source records, but is not applied to content projects.

- **No "publication version" tracking**. The library entry has `exported_at` and `status: 'EXPORTED'`, but no `published_at`, `publish_version`, or `is_latest` flag. Multiple export calls replace the library entry with same `content_id + filename` (via the `filter` before `push`), but there's no way to know which export is the "latest" or "approved" one.

- **How duplicate prevention could be designed** (not in source, but possible extensions):

  a) **Add `parent_content_id` and `generation` to content projects**:
     - When creating a new content project via `POST /api/mvp/content/draft`, optionally accept `parent_content_id`. The new project gets `generation: parent_generation + 1`.
     - This would enable tracking which version is derived from which.
     
  b) **Add `source_hash` or `data_as_of_snapshot` to content projects**:
     - When a content project is created, snapshot the current `data_as_of` from the offer/candidate.
     - Before re-running QA/finalize/export, compare the current `data_as_of` against the snapshot. If different, re-run the gates.
     
  c) **Add `publish_version` and `is_approved` to library entries**:
     - Each export could increment `publish_version` and set `is_approved: true` only after owner review.
     - Library browsing could filter by `is_approved: true` to show only verified publications.
     
  d) **Add `duplicate_check` route** (operator-designed):
     - `POST /api/mvp/content/duplicate-check` that accepts `{ candidate_id, approach_key, data_as_of }` and returns whether an equivalent content project already exists in DRAFT/REVIEW/FINALIZED status.
     - If yes, the operator can reuse that project instead of creating a duplicate.
     
  e) **Add `publication_status` to content projects** (e.g., `PENDING`, `APPROVED`, `PUBLISHED`, `ARCHIVED`):
     - Track the publication lifecycle separately from the internal workflow status.
     - Prevent "wrong version publication" by checking `publication_status` before allowing a publish-prep call.

- **What the operator can do today** (without code changes):
  - Inspect `state.contentOrder` and `state.contents` to see what content projects exist
  - Check each project's `status` and `finalize.checklist.passed` to determine which are completed
  - Read the library index `data/mission1/content-library.json` to see what's been exported
  - Use the `edit_log` within each project to trace what changes were made
  - Manually coordinate through `data/mission1/decision-log.md` or external systems

- **What the source currently prevents/guards against**:
  - **Status transition guards**: Prevent skipping steps (e.g., DRAFT → FINALIZED without REVIEW)
  - **Edit blocking**: Prevent editing EXPORTED/READY_TO_PUBLISH projects
  - **Finalize checklist**: Ensure 16 QA/approval items pass before finalizing
  - **Export guard**: Require FINALIZED status before exporting
  - **Library dedup**: When exporting, filter out existing entry with same `content_id + filename` before pushing new one (prevents duplicate library entries for the same project, but doesn't prevent creating new projects with same source data)

**Conclusion**: The existing Workflow Core does not have built-in mechanisms for preventing duplicate work, using old version results, or preventing wrong version publication. These are recognized gaps that would require design additions (new fields, new routes, new policies). The source provides the foundation (status machine, guards, library, edit_log) but the policy decisions about duplication and versioning must be made by the owner/operator.

The existing guards do provide some level of protection:
- Status machine prevents step-skipping
- Edit blocking prevents accidental modification of finished work
- Finalize checklist ensures minimum quality before export
- Library dedup prevents duplicate entries for the same project export

But these are **mechanical guards**, not **policy decisions** about what constitutes a "duplicate" or "correct version" — those are owner-defined decisions that would require additional design.

---

## C. Summary of Findings

| # | Question | Source-Supported Answer | Requires Design Decision |
|---|-----|---|---|
| 1 | New version references original + stores history | Projects reference original via embedded `candidate_id`/`offer_id`/`product_id`; history stored in `edit_log` per project; no auto version chain | Add `parent_content_id`/`generation` fields, or rely on operator tracking via external logs |
| 2 | Re-enter workflow from Library from which point | Only if status is DRAFT/REVIEW/FINALIZED. EXPORTED is locked. Library entry lacks `candidate_id`/`offer_id` — operator must reconstruct or accept fresh start | Add metadata to library entries, or accept manual re-entry |
| 3 | Mini Loop knows which steps to redo | Not embedded in source — operator-defined based on current status + context (QA pass, export file integrity, data freshness) | Define Mini Loop policy; optionally add step-completion flags to projects |
| 4 | Changes must re-run QA, Finalize, Approval before Publish new | Yes — upward status transitions require full gate sequence. At same status, edits may not require re-gates if operator confirms no changes. | Design policy for when re-gates are needed; add data freshness tracking |
| 5 | Re-publication using existing assets without re-Exporting | Yes — `POST /publish-prep` at EXPORTED status produces READY_TO_PUBLISH payload with existing video/audio. Does NOT auto-publish externally. | Design external publication flow; the MCP prepares but does not perform |
| 6 | Add full Content Library browsing without breaking API contract | Yes — `GET /api/mvp/library` can be added following existing conventions (env var, comment-tolerant reader, same library format). No route conflicts. | Minimal code addition (~15 lines in content.js + 1 route in service.js) |
| 7 | Prevent duplicate work, use old results, prevent wrong version publication | Not in source — these are operator-level policies. Existing guards provide mechanical protection (status machine, edit blocking, checklist, library dedup) but not policy decisions. | Design owner-defined policies; possible extensions: version fields, source hash snapshots, publish_status, duplicate-check routes |

---

## D. Evidence Provenance

- **Repository evidence**: Source code inspection of `app/mvp/content.js` (STATUSES, createContentProject, buildPublishPrep, exportProject, getLibraryItem, readContentLibrary, contentLibraryFile, STATUSES, assertTransition, buildFinalizeChecklist, finalizeProject), `app/mvp/service.js` (route registration at lines 3197–3454, all handler functions read via `sed`), `app/README.md` (run instructions, ACE_MVP_* env var conventions)
- **No prior test logs consulted** — this was a purely read-only source inspection
- **User-supplied observations**: None
- **Sponsored changes impact**: None on the core ACE MVP workflow, content status logic, or Content Library behavior

---

## E. Explicit Confirmation

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

This read-only investigation addressed 7 questions about Mini Loop & Content Re-entry Contract, based solely on source inspection of the ACE MVP workflow:

### Key findings:

1. **Version history**: The existing Workflow Core does not auto-link new content projects to originals or maintain a version chain. Each new project via `POST /api/mvp/content/draft` gets a fresh `content_id` with no automatic parent link. History is stored per-project in `edit_log`. Version tracking would require design additions (e.g., `parent_content_id`/`generation` fields).

2. **Re-entry from Library**: Possible only if content project is at DRAFT/REVIEW/FINALIZED status. EXPORTED projects are locked by route guards. Library entries lack `candidate_id`/`offer_id` — operator must reconstruct or accept fresh start.

3. **Mini Loop step decisions**: Not embedded in source — operator-defined based on current status, QA pass status, export file integrity, and data freshness. The source provides the mechanics (status guards, QA/finalize/export functions) but not the policy decisions.

4. **Gate re-running**: Yes — upward status transitions (DRAFT → REVIEW → FINALIZED → EXPORTED → READY_TO_PUBLISH) require the full gate sequence. At same status, edits may not require re-gates if the operator confirms no changes affecting QA/finalize/export.

5. **Re-publication without re-export**: Yes — `POST /api/mvp/content/:id/publish-prep` at EXPORTED status produces a `READY_TO_PUBLISH` payload containing the already-rendered video, audio assets, and publication-preparation data. **Does NOT** auto-publish externally — the human must complete the `next_steps_for_a_human` using the platform's own SDK/API.

6. **Content Library browsing**: Can be added via `GET /api/mvp/library` with ~15 lines of code in content.js + 1 route handler in service.js, following existing conventions (ACE_CONTENT_LIBRARY_FILE env var, comment-tolerant JSON reader, same library format). No route conflicts or contract breakage.

7. **Duplicate prevention / version control**: Not in source — these are operator-level policies. Existing guards provide mechanical protection (status machine prevents step-skipping, edit blocking prevents modifying EXPORTED, finalize checklist ensures quality before export, library dedup prevents duplicate entries for same project). Policy decisions about what constitutes a "duplicate" or "correct version" require owner design (possible extensions: version fields, source hash snapshots, publication status flags, duplicate-check routes).

### Overall assessment:

The ACE MVP Workflow Core is **solid and well-guarded** for its intended scope: DRAFT → REVIEW → FINALIZED → EXPORTED → READY_TO_PUBLISH with proper edit blocking at the right boundaries. The Mini Loop & Content Re-entry enhancements are **design gaps** that go beyond the current scope but are architecturally compatible — they would add fields/routes/policies rather than modifying the core state machine.

The smallest safe next steps (all read-only, no code changes yet):
1. Document the 7 findings above for owner socialization
2. Decide whether to add `GET /api/mvp/library` browsing (minimal code, low risk)
3. Decide on version-tracking design (parent_content_id/generation, or operator external logs)
4. Decide on Mini Loop policy (which steps to redo, under what conditions)
5. Decide on external publication flow (MCP prepares, human + platform SDK performs)

All investigations remain read-only until explicit owner authorization for implementation.

---

**Final labeled result**:
```
Mini Loop & Content Re-entry Contract Reconciliation = REPORTED
Runtime Validation = NOT PERFORMED
Implementation = NOT APPROVED
Z1 / Mission 1 Status = UNCHANGED
```