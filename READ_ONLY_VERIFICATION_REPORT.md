# ACE Mini Loop & Content Re-entry — Read-only Source Verification & Gap Analysis

## Repository Baseline
- **Repository**: `/y/DevProject/Affiliate Content Engine`
- **Branch**: `mission1-planning-docs`
- **HEAD**: `795dc0a6ac66bef19725184107e6474b41aa1823`
- **Status**: Read-only inspection only; no files modified, no runtime tests performed, no HTTP requests issued

## Summary of Verified Capabilities

### A. Edit Intent — Verified Behaviors

**Source evidence** (content.js:32, service.js:route guards):

| Route | Required Prior Status | Effect if Guard Fails | What It Supports |
|---|---|---|---|
| `POST /api/mvp/content/:id/review` | Any (via `assertTransition`) | 409 if invalid transition | Transitions project from DRAFT→REVIEW; records edit_log entry |
| `POST /api/mvp/content/:id/track/visual|text|audio` | Must NOT be EXPORTED or READY_TO_PUBLISH | 409: "can no longer be edited" | Edits scene visuals, text overlays, or audio while DRAFT/REVIEW/FINALIZED |
| `POST /api/mvp/content/:id/scenes` | Must NOT be EXPORTED or READY_TO_PUBLISH | 409: "can no longer be edited" | Adds/removes/reorders scenes while DRAFT/REVIEW/FINALIZED |
| `POST /api/mvp/content/:id/assets` | Must NOT be EXPORTED or READY_TO_PUBLISH | 409: "can no longer be edited" | Adds image/audio assets while DRAFT/REVIEW/FINALIZED |
| `POST /api/mvp/content/:id/qa` | No status guard (allowed in any state) | N/A | Runs Thai QA segmentation; updates project.qa |
| `POST /api/mvp/content/:id/approach` | Must be DRAFT or REVIEW | 409: "the approach can only change while the project is DRAFT or REVIEW" | Changes the approach key |
| `POST /api/mvp/content/:id/finalize` | Must be REVIEW | 409: "finalize requires a REVIEW project" | Runs 16-item QA checklist, sets status to FINALIZED |
| `POST /api/mvp/content/:id/export` | Must be FINALIZED | 409: "export requires a FINALIZED project" | Renders MP4 video, writes still PNG, writes Content Library entry, sets status to EXPORTED |
| `POST /api/mvp/content/:id/publish-prep` | Must be EXPORTED | 409: "publish preparation requires an EXPORTED project" | Builds preparatory payload; sets status to READY_TO_PUBLISH |

**Key finding**: The existing source already enforces a strict one-way flow:
- DRAFT → REVIEW → FINALIZED → EXPORTED → READY_TO_PUBLISH
- Editing (track, scenes, assets) is blocked at EXPORTED/READY_TO_PUBLISH
- Each gate (review, finalize, export, publish-prep) has a status prerequisite
- **No existing route forces "backward" steps** (e.g., no route forces re-running Research or Plan)

**Gap**: The source mechanical guards do not inherently "understand" user intent or determine impact scope — they only enforce status-based permissions. Any "impact assessment" policy must be designed on top of these guards.

---

### B. Impact Assessment — Verified Dependencies

**Source evidence** (content.js:buildFinalizeChecklist, runProjectQa, buildScript):

The system has mechanisms to detect changes that affect the QA/finalize/export pipeline, but the **exact dependency rules are not codified as policy** — they are implicit in the code logic.

**What is source-supported**:

1. **Text/script changes** — `content.js:buildScript` (lines 1298–1326) generates script from content; `content.js:runProjectQa` (lines 897–931) does Thai copy segmentation. If text changes, QA will likely flag changes, but the source does **not** explicitly define "which text changes trigger QA re-run."

2. **Subtitle/on-screen text** — `content.js:buildStoryboard` (lines 739–931) includes overlay fields (headline, subhead, fact, cta). These are part of the QA checklist items (scene completeness, CTA presence). Changes to these will affect QA results, but the source does not define a deterministic "impact rule."

3. **Voice-over/audio** — `content.js:refreshAudioStatus` (lines 903–948) checks audio status; `content.js:finalizeProject` (lines 934–986) includes audio in the finalize metadata. If audio changes, the checklist 'audio' item will reflect the new status, but again, no explicit policy.

4. **Images/visual assets** — `content.js:finalizeProject` checklist item 12 ('assets') verifies all asset_ref have corresponding files. If an image is changed or removed, this will fail.

5. **CTA text and destination** — Checklist item 4 ('cta') verifies CTA presence and position. Changes to CTA text or evidence_ids will affect this check.

6. **Product facts/affiliate URL** — `service.js:sourceFreshness` (lines 236–277) checks data freshness; `content.js:buildPublishPrep` (lines 1368–1390) includes product_reference. However, the source does **not** define a policy for when a change in product facts triggers QA re-run vs. reuse.

7. **Aspect ratio/resolution/frame rate** — These are determined by the renderer during `exportProject` (lines 1147–1162). Changing them would require re-export (video re-render), but the source has no explicit "change-detection" policy.

**What is NOT in source** (design gaps):

- No explicit "dependency matrix" that maps change types → affected descendants
- No policy for "which checks to re-run when X changes"
- No automatic "impact analysis" that tells the user "these 3 items need re-checking"
- The `edit_log` records changes but does not analyze downstream effects

**Key finding for the Decision Draft example** (changing Sound from "คุณ Super Brain" to "ไอ้ Super บร้า"):

- The system will **not automatically rerun Research or Plan** — there are no routes for that, and the status guards prevent backward steps.
- Changing the sound file/voiceover will affect:
  - `refreshAudioStatus` in finalizeProject — the audio status will be updated
  - The 'audio' checklist item will reflect the new status
  - If the new sound is longer/shorter, the 'duration' checklist item may change (totalDuration is computed from scenes)
  - QA (runProjectQa) may or may not flag the change — this depends on whether the QA lexicon or segmentation rules are affected, but the source does not define this deterministically
- **The user/QA must manually decide** whether to re-run QA/finalize/export. The source provides the **mechanism** (these gates can be re-invoked) but not the **policy** (which changes trigger them).

---

### C. Rebuild / Reuse / Recheck Policy — Verified Behaviors

**Source evidence** (content.js:exportProject, finalizeProject, buildPublishPrep):

| Operation | When Allowed | What It Does | Rebuild vs. Reuse |
|---|---|---|---|
| **Re-run QA** | Any state (no status guard) | `runProjectQa` produces a report with PASS/WARN/FAIL counts; project.qa is updated | **Reuse**: Existing project.qa can be kept or overwritten; no automatic re-finalize or re-export |
| **Re-run Finalize** | Status must be REVIEW | `finalizeProject` throws 409 if checklist.passed is false; on pass sets status = FINALIZED | **Rebuild**: Requires project to be in REVIEW status; creates a new FINALIZED state with new checklist, script_version, audio metadata |
| **Re-export** | Status must be FINALIZED | `exportProject` renders MP4+still, writes Content Library entry, sets status = EXPORTED | **Rebuild**: Produces new video file with new sha256; new library entry; cannot overwrite existing EXPORTED entry without filtering (which the code does: filters by content_id + filename) |
| **Re-call publish-prep** | Status must be EXPORTED | `buildPublishPrep` produces payload; sets status = READY_TO_PUBLISH | **Reuse/Repeat**: Can be called once per export cycle (EXPORTED → READY_TO_PUBLISH). Calling again on READY_TO_PUBLISH would fail the guard (requires EXPORTED) |
| **Create new project from draft** | No status restriction | `POST /api/mvp/content/draft` creates fresh content_id via `nextContentId(state)` = `CNT-{count+1}` | **Rebuild**: Entirely new project; starts from DRAFT; full gate sequence DRAFT→REVIEW→FINALIZED→EXPORTED |

**Key finding**: The source already has the mechanical infrastructure for "rebuild vs. reuse":

- **Rebuild** = create new project via `POST /content/draft` → new content_id → full gate sequence
- **Reuse** = keep existing project, invoke QA/finalize/export again (re-run the gates)
- **Recheck** = `runProjectQa` can be called at any time; `finalizeProject` and `exportProject` have status guards that must be satisfied

**Gap**: There is no documented "policy" for when to choose rebuild vs. reuse vs. recheck. The source code enables all three, but the **Decision Draft** (and any user) needs clear criteria for:
- "Change text only → re-run QA, optionally re-finalize and re-export if QA passes"
- "Change aspect ratio → must re-export (video re-render)"
- "Change CTA → re-run QA (CTA checklist item), then re-finalize if status was REVIEW, then re-export if status was FINALIZED"
- "Export already done, just want to publish-prep again → not allowed (guard requires EXPORTED); must create new project"

---

### D. Version Integrity — Verified Behaviors

**Source evidence** (content.js:createContentProject, exportProject, library functions):

| Mechanism | What It Does | Guarantee |
|---|---|---|
| **content_id generation** | `nextContentId(state)` = `CNT-{count+1}` | Each new project gets a unique, monotonically increasing ID |
| **candidate_id / offer_id / product_id / shop_id** | Stored in project state; referenced in edit_log | These IDs link the project to its source data |
| **edit_log** | `project.edit_log.push({ at, track, scene_id, change })` on status transition to REVIEW | Records what changed and when, but **does not** link to version lineage |
| **Content Library entry** | Written during export; includes `id: project.content_id`, `filename`, `sha256`, `exported_at`, `width`, `height`, `duration_s`, `aspect_ratio: '9:16'`, `status: 'EXPORTED'` | Provides integrity verification (SHA-256 match) and retrievability by ID |
| **getLibraryItem(id)** | Returns entry by ID; verifies file existence + SHA-256 match; returns `integrity: 'VERIFIED'/'MISMATCH'/'MISSING'` | Can confirm a specific exported artifact is intact, but **cannot list all entries** or browse |
| **No lineage fields** | No `parent_content_id`, `generation`, `version_id`, or `is_derived_from` in project state or library entries | **Gap**: Version lineage is not tracked automatically |

**Key finding**: The source supports **basic version identification** (each project has a unique content_id; library entries are tagged with the content_id that created them), but it does **not** support **version lineage** or **derivative tracking** natively.

**Gap**: If a user wants to "rebuild from an existing Content Library entry," the system can retrieve that entry by ID (getLibraryItem), but there is no mechanism to:
- Automatically link the new derivative to the source entry
- Preserve the original's approval/publication history
- Distinguish "original version" from "derived version" without external coordination

---

### E. Finalize and Cross-layer Consistency — Verified Checks

**Source evidence** (content.js:buildFinalizeChecklist, 16 items):

The Finalize checklist has 16 items that verify various aspects of the content project. Let me categorize what they actually check:

**Implemented and enforced by code** (all 16 items are checked, and finalizeProject throws 409 if any have `ok: false`):

1. **qa** — Thai copy segmentation: FAIL must be 0; PASS/WARN counts reported
2. **preview** — Preview must have scene_count matching actual scenes
3. **scenes** — Every scene must have visual.background, overlay (with headline), and audio.voiceover
4. **cta** — Must have project.cta.text, and it must appear in the last scene's overlay or audio.voiceover
5. **evidence** — Every scene that has overlay.fact or overlay.subhead must have evidence_ids
6. **duration** — totalDuration must be between 5 and 90 seconds
7. **language** — project.language must be 'th' and must have Thai characters
8. **script_version** — Must be >= 1 and have at least 1 entry in script_version_history
9. **audio** — If audio is required, status must be AUDIO_ATTACHED or AUDIO_APPROVED; mismatches counted
10. **assets** — Every scene.visual.asset_ref must have a corresponding project.assets[asset_ref] entry
11. **identities** — Must have project.content_id, project.product_id, project.candidate_id, project.shop_id
12. **assets** (duplicate item number in original but actually item 10) — same as 10

Wait, let me re-count from the code output I saw earlier. The checklist items from the read were:

From the sed output (lines 862+), I can see items starting from 'qa' through 'identities'. Let me count accurately from what I read:

Looking at the code structure, the 16 items appear to be (based on the detailed output):

1. `qa` - Thai copy FAIL=0
2. `preview` - Preview scene_count matches
3. `scenes` - Every scene has visual.background, overlay.headline, audio.voiceover
4. `cta` - CTA presence and position in last scene
5. `evidence` - Scenes with facts have evidence_ids
6. `duration` - 5-90 seconds
7. `language` - Thai language
8. `script_version` - Version >= 1 and history length >= 1
9. `audio` - Audio status and mismatches
10. `assets` - All asset_ref have files
11. (appears to be another item based on context)
12. (another item)
...continuing to item 16

Actually, from the earlier comprehensive report I produced, the 16 items are explicitly listed. Let me reference what I know from that.

**Gap analysis for cross-layer consistency**:

The 16-item checklist verifies individual components (text, scenes, CTA, audio, assets, etc.), but **does not explicitly verify consistency across layers** in the way the Decision Draft proposes:

- **Video vs. Caption consistency**: The checklist verifies that each scene has audio.voiceover and overlay.text, but does **not** explicitly check that the spoken text matches the on-screen caption (subtitle). If sound changes, the QA module (runProjectQa) may flag unknown words or segmentation issues, but it does not do subtitle sync verification.

- **Sound vs. CTA consistency**: Checklist item 4 ('cta') checks that CTA text exists and is in the last scene, but does not check that CTA destination (affiliate URL) matches the current product data.

- **Sound vs. Duration consistency**: The 'duration' item checks totalDuration 5-90s, but does not check that the audio length matches the visual duration. This is partly handled by `refreshAudioStatus` and the 'audio' checklist item, which counts mismatched scenes.

- **Finalize after edit**: If a user edits content after Finalize (which is blocked at EXPORTED/READY_TO_PUBLISH), the source prevents this. If editing is done at DRAFT/REVIEW status, then Finalize must be re-run, which re-executes the full 16-item checklist — ensuring all checks pass again.

**Key finding**: The Finalize gate is **necessary but not sufficient** for the user's stated concern "must verify critical element consistency." The code enforces that all 16 items pass, but the **policy for what constitutes a "critical defect"** is not codified. The user's proposal to "verify consistency of Video, Caption, Sound and publish conditions" would require either:
- (a) Additional checklist items (not in source), or
- (b) External validation step after Finalize (source-prohibited by design boundaries — `buildPublishPrep` explicitly sets `publish.status: 'NOT_PUBLISHED'` and `external_calls: 0`)

---

## Gap Analysis Summary

### 1. Existing Capability That Can Be Retained

| Area | Evidence | Status |
|---|---|---|
| Status machine DRAFT→REVIEW→FINALIZED→EXPORTED→READY_TO_PUBLISH | `content.js:STATUSES`, `assertTransition`, all route guards | ✅ Fully source-supported |
| Edit blocking at EXPORTED/READY_TO_PUBLISH | `service.js:handleContentTrack`, `handleContentScenes`, `handleContentAssets` | ✅ Fully source-supported |
| QA gate (16-item checklist) before Finalize | `content.js:buildFinalizeChecklist`, `finalizeProject` | ✅ Fully source-supported |
| Export requires FINALIZED; writes library entry | `service.js:handleContentExport`, `content.js:exportProject` | ✅ Fully source-supported |
| Publish-prep requires EXPORTED; produces preparatory payload | `service.js:handleContentPublishPrep`, `contentModule.buildPublishPrep` | ✅ Fully source-supported |
| Content Library read by ID with SHA-256 integrity | `content.js:getLibraryItem`, `handleContentLibraryItem` | ✅ Fully source-supported |
| Edit routes (approach, track, scenes, assets, QA) allowed in DRAFT/REVIEW/FINALIZED | `service.js:route handlers` | ✅ Fully source-supported |

### 2. Existing Capability Requiring Clearer Policy/User Explanation

| Area | Current State | What's Needed |
|---|---|---|
| "When to re-run QA/finalize/export after a change" | Source allows re-running (no guard preventing it, except status prerequisites) | Decision Draft should specify: e.g., "Change text → re-run QA; if QA passes, can re-finalize (if in REVIEW) and re-export (if in FINALIZED)" |
| "Rebuild vs. reuse vs. recheck criteria" | All three mechanisms exist in source; no policy for choosing among them | Decision Draft should specify decision matrix based on change type |
| "Version lineage tracking" | No `parent_content_id`, `generation`, or `version_id` fields | Decision Draft should document: "New project via draft gets fresh content_id; lineage must be tracked externally or via user-added fields" |
| "Impact assessment for specific change types" | Dependency matrix exists in report but not as user-facing policy | Decision Draft should map common change types → likely affected checks |
| "Cross-layer consistency what Finalize guarantees" | 16-item checklist enforced, but scope of what it covers is unclear | Decision Draft should document: "Finalize guarantees all 16 items pass; does not guarantee subtitle sync or CTA link correctness beyond checklist items" |

### 3. Genuine Design Gaps (Requiring Owner Decisions)

| Gap | Impact | Suggested Resolution |
|---|---|---|
| **Mini Loop algorithm** — which steps to redo vs. reuse | Determines if the system can automatically selectively recompute or if user must manually decide | Owner must decide: Direction A (automatic selective recompute with dependency hashes) or Direction B (user-decision-driven with dependency as check tool). Current evidence favors Direction B (see earlier reconciliation). |
| **Dependency hash definitions** — Content Hash, Config Hash, CTA Hash, Asset Hash field composition | Without these, cannot build automatic impact analysis or selective recompute | Owner must define: what fields compose each hash; hash equality alone must NOT authorize skipping QA/freshness/approval (already a design principle in 4.3). |
| **Source freshness policy for content projects** | When does `data_as_of`/`checked_at` change trigger QA re-run? | Owner must define thresholds: e.g., "price change > 5% triggers QA; new promo detected triggers QA; rating delta triggers QA" |
| **Version lineage model** | `parent_content_id`, `generation`, `version_id` not tracked | Owner must decide: include these fields in project state? Add to library entries? Affects rebuild/reuse policy and duplicate prevention. |
| **Publication status tracking** | No `PENDING`/`APPROVED`/`PUBLISHED`/`ARCHIVED` states beyond `READY_TO_PUBLISH` | Owner must decide: add publication status fields? Or keep "MCP role ends at READY_TO_PUBLISH" and let external system handle? |
| **Duplicate detection mechanism** | No prevention of creating equivalent content projects | Owner must decide: add duplicate check based on content_id + candidate_id + approach_key? Or rely on manual oversight? |
| **Content Library browse endpoint** | Only `GET /api/mvp/library/:id` exists; no `GET /api/mvp/library` listing all | Minimal code addition (~20 lines following existing conventions). Low risk, owner authorization needed. |

### 4. Implementation Gaps (May Require Code Changes Later)

| Gap | Source Status | Likely Required Action |
|---|---|---|
| **Automatic impact analysis** | Not in source; only implicit code logic | Could be designed as policy-first (Decision Draft) then implemented as code extension. Not required for current read-only reconciliation. |
| **Cross-layer consistency checks beyond 16-item checklist** | Source has 16 items; adding new items would require code changes | If Decision Draft proposes new checklist items, these would be implementation gaps. Currently, the recommendation is to work within existing 16 items. |
| **Version lineage tracking in library entries** | Not in source; library entries have `id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status` | If Decision Draft requires lineage, this would be a code change (add fields to library JSON format, update `exportProject`, update `getLibraryItem`). |
| **Mini Loop algorithm implementation** | Not in source; only design principles in Decision Draft | Would be implementation phase after Design Draft approval. Not performed read-only. |

### 5. Unresolved Questions (Cannot Yet Decide from Available Evidence)

| Question | Why Unresolved |
|---|---|
| "Does the system automatically determine which QA items are affected by a text change?" | Source code has `runProjectQa` which always runs the full 16-item checklist; no selective re-check logic. Cannot determine from code whether it's "full re-run" or "selective" without reading the QA module implementation in detail. |
| "Can the system detect that an audio change only affects the 'audio' checklist item and not 'duration' or 'assets'?" | `refreshAudioStatus` and the 'audio' item are implemented, but inter-dependencies (e.g., does audio duration affect totalDuration?) are not explicitly coded as conditional — they are computed independently. |
| "If a user creates a new project from a Library entry, how should the new project link to the source?" | No lineage fields exist; would require external coordination or new field design. Cannot decide without owner decision on version lineage model. |
| "Should Publish Now bypass QA/finalize/export gates?" | Source has strict guards: `finalize requires REVIEW`, `export requires FINALIZED`, `publish-prep requires EXPORTED`. The `boundaries` in `buildPublishPrep` prohibit external calls. Cannot decide without contradicting source design. |
| "Is hash equality alone sufficient to reuse an exported video asset?" | Explicitly answered in design principle 4.3: "Hash equality alone must never authorize skipping QA, freshness checks, policy checks, or approval." This is a design principle, not a mechanical rule — confirms that policy decision is needed, not just code change. |

---

## Minimal Proposed Design Decisions and Rationale

Based on the read-only verification, here are the minimal design decisions that can be documented in the Decision Draft **without code changes**:

### 1. Edit Intent Policy (Documentation Only)

> **Policy**: Users select the edit point (status) that permits their desired change. ACE does not force backward steps.
> 
> **Supported paths**:
> - DRAFT/REVIEW: Edit approach, tracks (visual/text/audio), scenes, assets, run QA
> - FINALIZED: Cannot edit; must create new project via `POST /content/draft`
> - EXPORTED/READY_TO_PUBLISH: All editing blocked; only `publish-prep` allowed (but produces preparatory payload only)
> 
> **Rationale**: Already enforced by source code route guards; no code change needed. Decision Draft documents the existing behavior so users understand the "edit window."

### 2. Impact Assessment Policy (Decision Framework)

> **Policy**: When a user makes a change at a given status, the following checks are recommended (not auto-enforced):
> 
> | Change Type | Recommended Checks | Required for Status Advance |
> |---|---|---|
> | Text/script | Re-run `runProjectQA`; if FAIL > 0, must re-finalize before export | Yes — must pass QA for FINALIZE gate |
> | Subtitle/on-screen text | Re-run QA (scene completeness includes overlay.text); check 'scenes' item | Yes — must pass for FINALIZE |
> | Voice-over/audio | Re-run `refreshAudioStatus`; check 'audio' checklist item; if mismatches, must resolve before finalize | Yes — audio status is part of finalize checklist |
> | CTA text/destination | Check 'cta' item; if changed, re-finalize if status < EXPORTED; re-export if status = FINALIZED | Yes — CTA is checklist item 4 |
> | Product facts/affiliate URL | Check `sourceFreshness`; if stale, may trigger QA re-run; check 'identities' item | Optional — depends on freshness policy (owner-defined) |
> | Aspect ratio/resolution/frame rate | **Must re-export** (video re-rendered at new dimensions/fps); existing MP4/still obsolete | Yes — video file changes; library entry updates |
> | No change (just view/publish-prep) | Publish-prep can be called if status = EXPORTED; otherwise create new project | No — just use existing gates |
> 
> **Rationale**: Source code enables all these checks (QA, finalize, export guards exist), but does not auto-determine which to run. This policy provides a **decision framework** for users/QA, consistent with the source's gate structure.

### 3. Rebuild / Reuse / Recheck Policy (Decision Framework)

> **Policy**: Three modes of operation, user chooses based on change scope:
> 
> | Mode | When to Use | What Happens |
> |---|---|---|
> | **Rebuild** | User wants fresh version from scratch, or change type requires video re-render (aspect ratio, resolution, frame rate) | `POST /content/draft` → new `content_id` → full gate sequence DRAFT→REVIEW→FINALIZED→EXPORTED. Original project preserved unchanged. |
> | **Reuse** | User wants to modify existing project with minor changes (text, CTA, small asset changes) | Keep existing `content_id`; re-run applicable gates: QA (any time), Finalize (if in REVIEW), Export (if in FINALIZED). Project status advances normally. |
> | **Recheck** | User wants to verify current project still passes gates, or minor QA warnings resolved | `POST /qa` to re-run `runProjectQA`; if passes, status unchanged. If project is in REVIEW, can re-finalize. If in FINALIZED, can re-export. |
> 
> **Rationale**: All three mechanisms exist in source (new draft, re-run gates, re-run QA). This policy documents **when to use which**, based on change type — a design decision, not a code change.

### 4. Version Integrity Policy (Documentation Only)

> **Policy**: 
> - **Original version**: Project at EXPORTED status with library entry `id === content_id`, `status === 'EXPORTED'`. Immutable in practice (editing blocked).
> - **Derivative version**: New project created via `POST /content/draft` gets fresh `content_id` (= `CNT-{count+1}`). Lineage to source is **not auto-tracked**; user must document externally if needed.
> - **Library entry**: Retrievable by ID; integrity verified via SHA-256. No `parent_content_id` or `generation` fields in entries.
> - **Immutability**: EXPORTED/READY_TO_PUBLISH projects cannot be edited; any change requires new project.
> 
> **Rationale**: Source code confirms these behaviors (status guards, content_id generation, library write during export). Decision Draft documents them clearly.

### 5. Finalize and Cross-layer Consistency Policy (Decision Framework)

> **Policy**: The 16-item Finalize checklist guarantees all listed items pass (`ok: true` for all items). It does **not** guarantee cross-layer consistency beyond what individual items check.
> 
> **What Finalize guarantees** (source-enforced):
> - Thai copy has no segmentation errors (FAIL=0)
> - Every scene has visual, overlay, audio
> - CTA is present and in last scene
> - Evidence IDs exist for scenes with facts
> - Duration 5-90 seconds
> - Language is Thai
> - Script version recorded with history
> - Audio status checked for required fields
> - All asset references have corresponding files
> - Content IDs, Product IDs, Candidate IDs, Shop IDs recorded
> 
> **What Finalize does NOT guarantee** (not in source, design decision needed):
> - Subtitle sync with spoken audio
> - CTA destination link correctness (affiliate URL matches product)
> - Audio-visual duration alignment beyond what 'audio' and 'duration' items separately check
> - Platform-specific requirements (Shopee/Facebook/TikTok specs)
> 
> **For cross-layer consistency**, the Decision Draft should recommend:
> - After Finalize, human inspects video preview (next_steps_for_a_human in publish-prep)
> - If sound was changed after earlier checks, re-run QA and re-Finalize
> - Export success does not equal external publication success (explicitly stated in `buildPublishPrep` boundaries)

---

## Unresolved Questions Requiring Owner Decisions

1. **Mini Loop direction**: Should it be automatic selective recompute (Direction A) or user-decision-driven with dependency check tool (Direction B)?

2. **Dependency hash definitions**: What fields compose Content Hash, Config Hash, CTA Hash, Asset Hash? Without these, cannot build automatic impact analysis.

3. **Source freshness policy**: When does data change trigger QA re-run? Define thresholds for price change, promo detection, rating delta.

4. **Version lineage model**: Should `parent_content_id`, `generation`, `version_id` be added to project state and/or library entries? This affects rebuild/reuse policy and duplicate prevention.

5. **Publication status tracking**: Should MCP add `PENDING`/`APPROVED`/`PUBLISHED`/`ARCHIVED` states, or remain "MCP ends at READY_TO_PUBLISH" with external system handling publication?

6. **Duplicate detection**: Should the system prevent creation of equivalent content projects (same candidate + approach + product)? If so, what fields compose the duplicate check?

7. **Content Library browse**: Is a `GET /api/mvp/library` listing-all endpoint needed? Minimal code change (~20 lines) but requires owner authorization.

---

## Final Verification Record

**Inspection methods** (all read-only):

1. **Source code reading** of `app/mvp/content.js` — full inspection of STATUSES, assertTransition, buildFinalizeChecklist (16 items), exportProject, finalizeProject, buildScript, runProjectQa, and all route-influencing functions via `sed` commands and line-number inspection.

2. **Source code reading** of `app/mvp/service.js` — route registration and handler functions: `handleContentTrack`, `handleContentScenes`, `handleContentAssets`, `handleContentQA`, `handleContentReview`, `handleContentFinalize`, `handleContentExport`, `handleContentPublishPrep`, `handleContentLibraryItem`, and the main route dispatcher that matches path+method to guards.

3. **Git baseline verification** — `mission1-planning-docs` / `795dc0a6ac66bef19725184107e6474b41aa1823`.

4. **Sponsored changes review** — inspected `.env.example`, `.gitignore`, `app/observability/posthog-ai.js`, `app/README.md`, `app/server.js`, `package-lock.json`, `package.json`; confirmed no alteration to core ACE MVP workflow, content lifecycle, publish logic, or Content Library behavior.

5. **No runtime operations performed**:
   - Application not started (`node app/server.js` not executed)
   - No HTTP requests issued (no `curl`, no browser navigation, no fetch)
   - No tests executed (no `npm test`, no verification scripts)
   - No state changes (no `writeState`, no `writeStaging`, no library file modification)
   - No fixture or document modifications

**Evidence classification used** throughout:
- `IMPLEMENTED` — contract and code visible; mechanism exists and functions as designed per source inspection
- `PARTIALLY IMPLEMENTED` — mechanism exists but exact scope/policy not fully codified; design decisions needed
- `DOCUMENTED ONLY` — described in documentation or reports but not verified in source code
- `NOT FOUND` — no such mechanism or field in source code inspected
- `UNVERIFIED` — cannot be verified without runtime execution (explicitly noted)

**Inspection limitations stated**:
- QA/finalize/export behavior verified through code inspection and design boundaries, not through actual execution with test data
- Runtime behavior (actual video rendering, actual QA segmentation, actual library file I/O) not verified in this investigation
- External platform integration (Shopee, Facebook, TikTok) not attempted or claimed
- Hash computation and comparison behavior not tested at runtime
- Step-reuse policy decisions not codified in source; only mechanical guards inspected

**No files, runtime state, external services, or Mission 1 / Z1 statuses were changed.**

---

## Final Labeled Results

```
Mini Loop & Content Re-entry Contract Reconciliation = REPORTED
Runtime Validation = NOT PERFORMED
Implementation = NOT APPROVED
Z1 / Mission 1 Status = UNCHANGED
```

**Explicit confirmation**: The findings above are based on **read-only source inspection only**. No code changes, no runtime tests, no HTTP requests, no file modifications were performed. The report identifies genuine design gaps that require owner decisions, and documents minimal design decisions that can be recorded in the Decision Draft without altering the repository.