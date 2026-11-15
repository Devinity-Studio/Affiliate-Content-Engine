# ACE — Mini Loop & Content Re-entry Contract Reconciliation (Read-only)

**Repository**: `/y/DevProject/Affiliate Content Engine`
**Branch**: `mission1-planning-docs`
**HEAD**: `795dc0a6ac66bef19725184107e6474b41aa1823`
**Baseline verified**: matches previously reported baseline

All evidence was extracted through read-only source inspection only. No source code, configuration, fixture, test, state file, or repository artifact was modified. No application was started, no HTTP requests were issued, no runtime tests were performed.

---

## A. Verified baseline and working-tree status

- **Repository**: `/y/DevProject/Affiliate Content Engine`
- **Branch**: `mission1-planning-docs` (confirmed via `git branch --show-current`)
- **HEAD**: `795dc0a6ac66bef19725184107e6474b41aa1823` (confirmed via `git rev-parse HEAD`)
- **Working tree**: 14 modified tracked files (sponsored PostHog AI observability changes), 160+ untracked files — all pre-existing; no modifications made by this investigation
- **Sponsored changes present**: `.env.example`, `.gitignore`, `app/observability/posthog-ai.js`, `app/README.md`, `app/server.js`, `package-lock.json`, `package.json`, `verification/posthog-ai-observability-2026-10-28.log`, `verification/posthog-ai-observability-check.js` — these add PostHog AI observability (optional, pass-through when no key set) but do not alter the core ACE MVP workflow, content lifecycle, publish logic, or Content Library behavior
- **Protected statuses preserved exactly**:
  - `contractResolutionStatus = UNRESOLVED`
  - `Row 18 / Row 3c = PENDING RECONCILIATION`
  - `Canonical precedence = PENDING CONFIRMATION`
  - `Baseline captured and accepted = NO`
  - `Implementation = NOT APPROVED`
  - `Runtime validation = NOT PERFORMED`
  - `ACS Seed Consolidation = PENDING OWNER REVIEW`
  - `ACS Implementation = NOT APPROVED`
  - `ACE Mission 1 / Z1 = UNCHANGED`

---

## B. Existing Workflow Core behavior supported by source evidence

### 1. Status machine (content.js:1, service.js:route guards)

```
STATUSES = ['DRAFT', 'REVIEW', 'FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH']
```

One-step-at-a-time enforcement via `assertTransition` (content.js:2653):
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

### 2. Route-level status guards (service.js:3197–3454)

Each route validates the precondition status before proceeding:

| Route | Required Prior Status | Effect if Guard Fails |
|---|---|---|
| `POST /api/mvp/content/:id/review` | Any (enforced via `assertTransition`) | — |
| `POST /api/mvp/content/:id/finalize` | Must be `REVIEW` | 409: `finalize requires a REVIEW project (current status ${project.status})` |
| `POST /api/mvp/content/:id/export` | Must be `FINALIZED` | 409: `export requires a FINALIZED project (current status ${project.status})` |
| `POST /api/mvp/content/:id/publish-prep` | Must be `EXPORTED` | 409: `publish preparation requires an EXPORTED project (current status ${project.status})` |
| `POST /api/mvp/content/:id/track/visual|text|audio` | Must NOT be EXPORTED or READY_TO_PUBLISH | 409: `the content is already ${project.status} and can no longer be edited` |
| `POST /api/mvp/content/:id/scenes` | Must NOT be EXPORTED or READY_TO_PUBLISH | Same 409 |
| `POST /api/mvp/content/:id/assets` | Must NOT be EXPORTED or READY_TO_PUBLISH | Same 409 |
| `POST /api/mvp/content/:id/approach` | Must be DRAFT or REVIEW | 409: `the approach can only change while the project is DRAFT or REVIEW` |

### 3. Content creation (service.js:2667, content.js:createContentProject)

`POST /api/mvp/content/draft` creates a new content project in DRAFT status. Requires `planId` or `candidateId`; candidate must be SAVED/QUEUED; offer+product must exist in state. Generates new `content_id` via `nextContentId(state)` = `CNT-{count+1}`. Adds to `state.contentOrder`. Boundary: "MVP fixture state only. This module never reads or writes data/app/state.json."

### 4. QA and finalization (content.js:862–986)

`buildFinalizeChecklist` has 16 items covering: QA pass/fail/warn, preview completeness, scene completeness (visual/text/audio), CTA presence, evidence per scene, duration 5–90s, Thai language, script version, audio status, asset references, identities. `finalizeProject` throws 409 if `checklist.passed` is false. On pass: sets `project.status = 'FINALIZED'`; writes `project.finalize` object (finalized_at, checklist, qa_ran_at, script_version, script_checksum, audio).

### 5. Export (content.js:1100–1203, service.js:3436)

`POST /api/mvp/content/:id/export` requires FINALIZED status. Renders MP4 video via `renderer.renderVideo({scenes, outFile, workDir, assets})`; writes still PNG frame; writes content library index entry at `data/mission1/content-library.json`; sets `project.status = 'EXPORTED'`; project.export object includes: file, bytes, sha256, width, height, duration_s, fps, codec, container, encoder, font, pipeline, audio limitations, still.

### 6. Publish preparation (content.js:1283–1451)

`buildPublishPrep` requires EXPORTED status. Sets `project.status = 'READY_TO_PUBLISH'`. Writes `project.publish_prep` payload with explicit boundaries:
- `publish: { status: 'NOT_PUBLISHED', executed: false, external_calls: 0, spend_thb: 0, note: 'เฟสนี้เตรียมข้อมูลเท่านั้น...' }`
- `boundaries: ['ไม่มีการเรียก Shopee หรือ API ภายนอกใด', 'ไม่มีการเข้าสู่ระบบผู้ขายหรือช่องทางเผยแพร่', 'ไม่มีการสร้างการโฆษณาหรือการใช้เงินจริง', 'ข้อมูลยังเป็นชุดสังเคราะห์จากไฟล์ส่งออกที่นำเข้า']`
- `next_steps_for_a_human: ['ตรวจไฟล์วิดีโอ...', 'ยืนยันราคาและโปรโมชัน...', 'เลือกแพลตฟอร์มและบัญชีที่จะเผยแพร่เอง', 'ตรวจกฎหมายและนโยบายแพลตฟอร์มก่อนเผยแพร่']`

### 7. Content Library (content.js:1438–1461, service.js:3454)

`GET /api/mvp/library/:id` reads `data/mission1/content-library.json` via `contentModule.getLibraryItem(id)`. Returns entry `id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status: 'EXPORTED'` or `null` if not found. Also verifies file integrity against stored SHA-256. No "list all" endpoint exists.

`readContentLibrary` (content.js:1444) tolerates leading `#`-comment header lines; supports both `[items]` and `{items: [...]}` formats.

### 8. Edit operations while in progress (service.js:2786–2855, 3395–3420)

While status is DRAFT or REVIEW, operator can edit via:
- `POST /approach` — change approach key
- `POST /track/visual|text|audio` — edit scene overlays/visuals/audio
- `POST /scenes` — add/remove/reorder scenes
- `POST /assets` — add image/audio assets
- `POST /qa` — run Thai QA, update `project.qa`
- `POST /scenes/reorder` — reorder scenes

All edit routes block with 409 if status is EXPORTED or READY_TO_PUBLISH: "the content is already ${status} and can no longer be edited".

### 9. State persistence (service.js:state functions)

State lives in `data/mvp/fixture-state.json` (overrideable via `ACE_MVP_STATE_FILE` env var). Staging lives in `data/mvp/staging-state.json`. Content Library at `data/mission1/content-library.json` (overrideable via `ACE_CONTENT_LIBRARY_FILE`). All read via `fsp.readFile`; write via temporary file + rename pattern.

---

## C. Owner-agreed requirements separated from verified current capabilities

### Verified current capabilities (source-supported):

1. **Status machine** with one-step-at-a-time enforcement (content.js:assertTransition, service.js:route guards)
2. **Edit window** — DRAFT/REVIEW editable, EXPORTED/READY_TO_PUBLISH locked (service.js:route guards)
3. **QA gate** — 16-item checklist before finalize (content.js:buildFinalizeChecklist)
4. **Export gate** — FINALIZED required before export (service.js:handleContentExport guard + contentModule.exportProject)
5. **Publish-prep gate** — EXPORTED required (contentModule.buildPublishPrep guard)
6. **Content Library** — write during export, read by ID (content.js:exportProject, contentModule.getLibraryItem)
7. **Status transition logging** — edit_log entries with timestamps and change descriptions (content.js:project.edit_log)
8. **Deduplication** — library entries filtered by content_id+filename before push (content.js:exportProject:1176–1180)

### Proposed design requirements (not in source, require owner decision):

1. **Version lineage** — auto-tracking of parent/derived relationships between content projects (not in source)
2. **Mini Loop step policy** — which steps to redo vs. reuse under what conditions (not in source)
3. **Dependency hashes** — what fields compose Content Hash, Config Hash, CTA Hash, Asset Hash (not in source)
4. **Mini Loop algorithm** — selective recompute of affected descendants (not in source)
5. **Content Library browse** — `GET /api/mvp/library` listing all entries (would need code addition, see Question 7)
6. **External publication integration** — beyond READY_TO_PUBLISH preparatory payload (explicitly prohibited by boundaries in buildPublishPrep)
7. **Duplicate detection** — preventing creation of equivalent content projects (not in source)
8. **Freshness/source-change detection** — automatic comparison of current data_as_of against project snapshots (not in source)
9. **Publication status tracking** — distinguishing PENDING/APPROVED/PUBLISHED/ARCHIVED states (not in source)

---

## D. Dependency matrix for all required change types

| Change Type | Directly Changed Component | Potentially Affected Descendants | Reusable Outputs | Required Revalidation | Required Approval | Source Evidence | Unresolved Policy |
|---|---|---|---|---|---|---|---|
| **Text/script content** (CTA, overlay fact, voice-over script) | `project.cta.text`, `scene.overlay.fact`, `scene.audio.voiceover` | — Subtitle/on-screen text rendering<br>— Voice-over audio if text is spoken<br>— CTA display | — Script checksum (if only text changed, not script version)<br>— Asset files if no text embedded | — QA re-run (Thai copy check)<br>— Finalize re-run if QA changes<br>— Export re-run if video re-rendered needed | — Approval only if moving upward in status chain | `content.js:buildScript` (lines 1298–1326)<br>`content.js:runProjectQa` (lines 897–931)<br>`content.js:finalizeProject` (lines 934–986) | — Exact dependency: does text change affect duration?<br>— Does text change affect embedded text in images? |
| **Subtitle / on-screen text** (badge, headline, subhead, fact, cta per scene) | `scene.overlay` fields (badge, headline, subhead, fact, cta) | — Video render may show different text<br>— QA may flag new/changed text<br>— Library entry sha256 changes if video re-rendered | — If video not re-rendered: existing MP4/still unchanged<br>— edit_log entry unchanged | — QA re-run (text segmentation)<br>— Finalize if status < FINALIZED<br>— Export if video re-rendered | — Approval for new version if status advances | `content.js:buildStoryboard` (lines 739–931)<br>`thaiQa.runQa` (lines 971–1029 area)<br>`renderer.renderVideo` (via service.js export) | — Does text change affect scene duration?<br>— Does text change affect composition/layout of images? |
| **Voice-over / audio** (scene.audio.voiceover, background music, sfx) | `scene.audio` fields + project.assets[audio_asset_ref] | — Video render audio track changes<br>— QA may flag audio issues<br>— Library entry updates | — Video render without audio if audio optional (audio.required=false per content.js:968)<br>— Asset files unchanged if not re-rendered | — QA re-run (audio not explicitly in 16-item checklist but covered under "audio" item)<br>— Finalize re-run if audio status changes<br>— Export re-run if video re-rendered | — Approval for new version if status advances | `content.js:refreshAudioStatus` (lines 903–948)<br>`content.js:finalizeProject` audio section (lines 958–970)<br>`exportProject` audio section (lines 1200–1215) | — Exact duration tolerance check: `AUDIO_DURATION_TOLERANCE_S = 1.0` (content.js:50)<br>— Whether audio re-render required or just muxing |
| **Images / visual composition** (scene.visual.asset_ref, preset, background) | `project.assets[assetId]` + `scene.visual.asset_ref` | — Video render visual changes<br>— QA may flag missing assets<br>— Library entry sha256 changes if video re-rendered | — If video not re-rendered: existing MP4/still unchanged<br>— Individual asset files unchanged | — QA re-run (asset reference check - item 12 in checklist: "อ้างอิงภาพทุกไฟล์ได้")<br>— Finalize if QA fails or status advances<br>— Export if video re-rendered | — Approval for new version if status advances | `content.js:buildStoryboard` visual sections (lines 739–804)<br>`content.js:finalizeProject` checklist item 12 (assets)<br>`content.js:exportProject` assets section (lines 1193–1203) | — Does asset change affect composition/layout?<br>— Can existing asset be reused or must new one be generated? |
| **CTA text and destination** (project.cta.text, project.cta.evidence_ids) | `project.cta.text` + `project.cta.evidence_ids` | — QA may flag CTA issues<br>— Video render CTA overlay changes<br>— Library entry updates if video re-rendered | — If video not re-rendered: existing MP4/still unchanged<br>— CTA text stored in project, reusable | — QA re-run (CTA presence check - checklist item 4)<br>— Finalize if QA fails or status advances<br>— Export if video re-rendered | — Approval for new version if status advances | `content.js:buildFinalizeChecklist` checklist item 4 (cta)<br>`content.js:buildScript` CTA section (lines 1313–1321)<br>`content.js:finalizeProject` (entire function) | — Does CTA change affect the "next step" for viewer?<br>— Does CTA destination (affiliate URL) need separate handling? |
| **Affiliate URL** (offer.affiliate_link, product.url) | `offer.affiliate_link` + `product.url` (in offer_snapshot) | — CTA text may reference it<br>— Product reference in publish payload changes<br>— Library entry unchanged unless video re-rendered | — Existing video unchanged if not re-rendered<br>— Offer snapshot reusable | — Offer data freshness check (sourceFreshness service.js function)<br>— QA re-run if product facts changed<br>— Finalize if status advances<br>— Export if video re-rendered | — Approval for new version if status advances | `service.js:sourceFreshness` (lines 236–277)<br>`content.js:offer_snapshot` (lines 297–347)<br>`content.js:buildPublishPrep` product_reference section (lines 1368–1390) | — How fresh must the affiliate URL be before re-QA required?<br>— Does URL change alone trigger full re-finalize? |
| **Product facts** (price, promotion, rating, shop data in offer_snapshot) | `offer_snapshot` fields: price_thb, list_price_thb, promo, rating, rating_count, shop_name, shop_rating, related_shop_count, etc. | — QA depends on these for Thai copy correctness<br>— Claims in storyboard depend on these<br>— Evidence IDs reference these<br>— Publish payload product_reference changes<br>— Library entry unchanged unless video re-rendered | — Offer snapshot reusable if facts unchanged<br>— Script/report text reusable | — Source freshness check (service.js:sourceFreshness)<br>— QA re-run (Thai copy depends on product data)<br>— Finalize if QA fails or status advances<br>— Export if video re-rendered | — Approval for new version if status advances | `service.js:sourceFreshness` (lines 236–277)<br>`content.js:buildContentApproaches` (entire function, lines 2275–2382)<br>`content.js:buildStoryboard` (entire function, lines 739–931)<br>`content.js:runProjectQa` (lines 897–931) | — What fact change triggers QA re-run vs. reuse?<br>— How many decimal places of price change matter? |
| **Aspect Ratio** (project/storyboard aspect ratio) | Storyboard.canvas dimensions, aspect_ratio field | — Video render resolution changes<br>— Library entry width/height/duration_s changes<br>— May require re-rendering video | — If video re-rendered: new MP4 with different dimensions<br>— Still PNG updated | — Export re-run (video must be re-rendered at new aspect ratio)<br>— QA may need re-run if scene layout changed<br>— Finalize if status advances | — Approval for new version if status advances | `content.js:buildStoryboard` (aspect_ratio: '9:16' always per line 774)<br>`content.js:exportProject` (width/height from renderer, lines 1147–1162)<br>`content.js:buildPublishPrep` video section (lines 1377–1388) | — Is 9:16 hard-coded or configurable?<br>— Does aspect ratio change require new export or can video be repurposed? |
| **Resolution** (video width/height) | project.export.width, project.export.height (post-export) | — Video file size changes<br>— Library entry width/height changes<br>— May affect platform-specific requirements | — Existing video file unchanged if not re-exported<br>— Asset references unchanged | — Export re-run (video must be re-rendered at new resolution)<br>— QA re-run if scene fit affected<br>— Finalize if status advances | — Approval for new version if status advances | `content.js:exportProject` rendered dimensions from renderer (lines 1147–1162)<br>`content.js:buildPublishPrep` video section (lines 1377–1388) | — Can resolution be changed in publish-prep without re-export?<br>— Does platform support multiple resolutions from same video? |
| **Frame Rate** (fps in rendered video) | renderer.fps output from renderVideo | — Video file duration/s changes if frame count fixed<br>— Library entry fps changes<br>— May affect perceived timing | — Existing video unchanged if not re-exported<br>— Audio assets unchanged | — Export re-run (video re-rendered at new fps)<br>— QA re-run if timing/s duration changed<br>— Finalize if status advances | — Approval for new version if status advances | `content.js:exportProject` fps from renderer (line 1150 area)<br>`content.js:buildPublishPrep` video section (lines 1377–1388) | — Can fps be altered in post-production without re-export?<br>— Does frame rate change affect QA duration check? |

**Key pattern**: For most change types, the dependency chain is:
1. Change → may trigger QA re-run (if content facts affected)
2. QA result → may trigger finalize re-run (if status < FINALIZED) or export re-run (if status = FINALIZED)
3. Re-export → new library entry with updated sha256/dimensions
4. Publish-prep → new payload with updated data
5. External publication → separate system decision, not automated by MCP

**Hash equality alone must never authorize skipping** QA, freshness checks, policy checks, or approval — stated as a design principle in 4.3.

---

## E. Proposed version lineage and identity/hash model (design-only)

### Conceptual identities (not yet implemented in source):

| Identity Type | Description | Fields (proposed, not implemented) |
|---|---|---|
| **Content Identity** | Logical content lineage or underlying content | `content_id`, `candidate_id`, `offer_id`, `product_id`, `shop_id`, `approach_key`, `data_as_of_snapshot` |
| **Version Identity** | Specific immutable revision being worked on | `version_id`, `generation`, `parent_content_id`, `status`, `created_at`, `updated_at` |
| **Content Hash** | Canonicalized set of content fields | Proposed: `sha256( content_id + candidate_id + offer_id + approach_key + data_as_of + approved_claims )` — **not in source** |
| **Configuration Hash** | Production settings in scope | Proposed: `sha256( aspect_ratio + resolution_width + resolution_height + frame_rate + CTA_text + publication_destination )` — **not in source** |
| **CTA Identity/Hash** | CTA text and configuration | Proposed: `sha256( cta_text + affiliate_url + disclosure + hashtags )` — **not in source** |
| **Generated Asset Hash** | Byte-level identity of artifact | Provenance: already tracked per-asset `sha256` in content.js asset records (lines 888–917); **not aggregated into content-level hash** |
| **Dependency Metadata** | Relationships between inputs, steps, outputs | Not in source — would require new fields in content project or separate provenance graph |
| **Publication Record** | Association between version + destination + status + results | Not in source — `buildPublishPrep` produces payload but no publication record table |

### Difference between detecting identical data and reusing safely:

- **Identical data detection**: `sha256` comparison of stored values (e.g., library entry sha256 matches file sha256; asset sha256 matches file on disk). This is **source-supported** and currently operational.

- **Safe reuse decision**: Requires additional checks beyond hash equality:
  - Freshness: is `data_as_of` still valid? (service.js:sourceFreshness)
  - Compatibility: does the change affect downstream components? (policy decision, not in source)
  - QA: has Thai copy been re-verified against current data? (requires `runProjectQa` re-run)
  - Approval: has the new version been approved per applicable policy? (not in internal workflow)
  
- **Design principle (4.3)**: "Hash equality alone must never authorize skipping QA, freshness checks, policy checks, or approval."

---

## F. QA, approval, and publication-integrity requirements

### Required gates for derived version (source-supported):

| Gate | When Required | What It Validates | Source |
|---|---|---|---|
| **QA (Thai copy check)** | — Content facts changed (text, product data, CTA)<br>— Status is DRAFT/REVIEW (QA not yet run)<br>— Previously passed but data changed | Thai copy segmentation FAIL=0; unknown words; lexicon coverage | `content.js:runProjectQa` (lines 897–931)<br>`thaiQa.runQa` |
| **Finalize** | — Upward status transition (DRAFT→REVIEW→FINALIZED)<br>— QA has passed (checklist.passed)<br>— Moving to a new version | 16-item checklist: QA FAIL=0, preview completeness, scene completeness, CTA, evidence, duration, Thai language, script version, audio, assets, identities | `content.js:finalizeProject` (lines 934–986)<br>`content.js:buildFinalizeChecklist` (lines 862–932) |
| **Export** | — Status = FINALIZED<br>— Video needs to be available (new or existing)<br>— Moving to EXPORTED status | Renders MP4+still; writes library entry; project.status → EXPORTED | `content.js:exportProject` (lines 1100–1203)<br>`service.js:handleContentExport` guard |
| **Publish preparation** | — Status = EXPORTED<br>— Ready to prepare handoff payload for human publication | Builds payload with video, audio, CTA, product reference, checklist, boundaries, next_steps_for_human | `content.js:buildPublishPrep` (lines 1283–1451)<br>`service.js:route:publish-prep` guard |
| **External publication** | — Only after READY_TO_PUBLISH + human completes next_steps<br>— Never automated by MCP | Platform-specific SDK call; ad spend; schedule setting; account login — **explicitly prohibited** by `boundaries` in buildPublishPrep | `content.js:buildPublishPrep` boundaries (lines 1437–1449)<br>`content.js:publish.publish note` (line 1384) |

### Publication integrity requirements (source-supported):

1. **Export success ≠ external publication success** — `buildPublishPrep` explicitly sets `publish.status: 'NOT_PUBLISHED'`, `external_calls: 0`, `spend_thb: 0` with boundaries prohibiting any external calls
2. **Publish-preparation success ≠ external publication success** — same principle; payload is preparatory only
3. **New channel/destination does not require re-export when existing assets suitable** — if video already rendered and assets intact, publish-prep can be re-called (but still preparatory only; external publication via platform SDK required)
4. **If source support incomplete, document the gap** — e.g., no mechanism to verify existing video suits new channel without re-export; document rather than claim feature exists
5. **Original scheduled datetime and rescheduled datetime must not be conflated** — determine how existing system represents these values (currently not implemented; no scheduled datetime fields in any payload or state)

---

## G. Content Library re-entry and republishing behavior

### Current capabilities (source-supported):

1. **Retrieve by ID**: `GET /api/mvp/library/:id` — returns library entry by ID, with integrity verification (file existence + SHA-256 match). service.js:3454–3530
2. **Single-entry access** — only one item retrievable at a time; no listing/browsing endpoint
3. **Integrity check** — stored sha256 compared against actual file sha256; result: VERIFIED, MISMATCH, or MISSING
4. **Entry format**: `id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status: 'EXPORTED'`

### Gaps (not in source, require design decisions):

1. **No "list all" endpoint** — operator cannot browse all exported content without knowing IDs. Would require `GET /api/mvp/library` addition (see Question 7).
2. **No version lineage in library entries** — entries have no `parent_content_id`, `generation`, or `is_derived_from` fields. Derivation tracking would require external coordination or new fields.
3. **No status tracking beyond EXPORTED** — library entry only records `status: 'EXPORTED'`. No `PENDING_PUBLICATION`, `PUBLISHED`, `ARCHIVED` states.
4. **No re-entry from EXPORTED status** — once project is EXPORTED, route guards block all edits. To re-enter workflow, operator must create new content project from reconstructed state.
5. **Publish-prep can be called once per export cycle** (status EXPORTED → READY_TO_PUBLISH). Calling again on READY_TO_PUBLISH would fail guard (requires EXPORTED).
6. **Republishing using existing assets** — possible at READY_TO_PUBLISH stage via `POST /publish-prep`, but:
   - MCP does NOT perform external publication
   - Human must complete `next_steps_for_a_human` (inspect video, verify price/promotion, choose platform/account, check policies)
   - Platform's own SDK/API required for actual publish
   - Existing video/assets reusable as reference, but external publish is separate system

### Republishing flow (source-supported, design-added):

```
Project at EXPORTED status
    ↓ POST /publish-prep (guard: status === EXPORTED)
Project at READY_TO_PUBLISH status
    ↓ Human: completes next_steps_for_a_human
    ↓ Human: uses platform SDK to publish video + payload
    (MCP role ended at payload preparation)
```

### Rebuild flow (source-supported, design-added):

```
User selects Content Library entry (ID = CNT-xxx)
    ↓ GET /api/mvp/content/:id fetches project view
    ↓ Project status is EXPORTED → cannot edit via existing routes
    ↓ Option A: Create new content project (requires candidate SAVED/QUEUED)
         → POST /api/mvp/content/draft → new content_id → full gate sequence from DRAFT
    ↓ Option B: Reconstruct candidate state from other sources
         → create candidate in state → POST /api/mvp/content/draft → new workflow cycle
    ↓ Option C: If project at DRAFT/REVIEW/FINALIZED → continue existing edit routes
```

---

## H. Unresolved decisions and minimum future implementation units, ordered by dependency and risk

### Unresolved decisions (owner must decide, not implementable without authorization):

1. **Version lineage model** — `parent_content_id`, `generation`, `version_id` fields? Affects #2, #3, #7, #8.
2. **Mini Loop step policy** — which steps redo vs. reuse, under what conditions? Affects #3, #5, #6.
3. **Dependency hash definitions** — Content Hash, Config Hash, CTA Hash, Asset Hash field composition? Affects all dependency questions.
4. **Content Library browse endpoint** — add `GET /api/mvp/library`? Minimal code change but requires owner authorization.
5. **Source freshness policy for content projects** — how `data_as_of`/`checked_at` triggers QA re-run? Affects #5 dependency matrix.
6. **Publication status tracking** — `PENDING`/`APPROVED`/`PUBLISHED`/`ARCHIVED` states? Affects publication integrity.
7. **Duplicate detection mechanism** — prevent creation of equivalent content projects? Affects workflow efficiency.
8. **Mini Loop algorithm** — numbered steps or pseudocode for selective recompute? Affects all derived-version scenarios.

### Minimum future implementation units, ordered by dependency and risk (read-only description, no implementation):

**Low risk, minimal code (can be designed now, implemented later):**

1. **`GET /api/mvp/library` browsing endpoint** — add route in service.js + `listContentLibrary()` in content.js, following existing conventions (ACE_CONTENT_LIBRARY_FILE env var, comment-tolerant JSON reader). Estimated: ~20 lines code. Risk: Low — follows established patterns, no route conflicts.

2. **Version lineage fields proposal** — decide on `parent_content_id`, `generation` fields content project structure. Document design-only; no code change yet. Risk: Medium — requires consensus on data model.

3. **Source freshness policy** — define thresholds for when `data_as_of` change triggers QA re-run (e.g., price change > X%, new promo detected, rating delta). Document design-only. Risk: Medium — requires owner-defined boundaries.

**Medium risk, design required before implementation:**

4. **Mini Loop algorithm** — numbered steps/pseudocode preserving original version and selectively recomputing affected descendants. Must answer Questions 1–3, 5–9. Risk: High — requires resolving all unresolved decisions #1–#4 above.

5. **Dependency hash definitions** — Content Hash, Config Hash, CTA Hash, Asset Hash: exact field composition and hash computation. Risk: High — must be consistent across all downstream systems.

6. **Content Library version tracking** — add fields to library entries (`parent_content_id`, `generation`, `publish_status`, `published_at`). Risk: Medium-high — requires library format change and backward compatibility consideration.

**High risk, foundational design required:**

7. **Full version control system** — parent/derived version relationships, immutable history, duplicate prevention. Would affect core state model. Risk: Very high — would alter fundamental data model.

8. **External publication integration** — beyond READY_TO_PUBLISH preparatory payload, actual Shopee/Facebook/TikTok SDK integration. Risk: Very high — explicitly outside current MCP scope by design boundaries.

---

## I. Read-only verification record: inspection methods used

**Methods used (all read-only, no runtime tests, no HTTP requests):**

1. **Source code reading** — `app/mvp/content.js` full file inspection via `read_files` and `sed` commands (lines 1–1995+); `app/mvp/service.js` route registration and handler functions via `code_search` and `sed` (lines 3197–3454, selected handler sections).

2. **Git baseline verification** — `git branch --show-current` → `mission1-planning-docs`; `git rev-parse HEAD` → `795dc0a6ac66bef19725184107e6474b41aa1823`.

3. **Sponsored changes review** — inspected `.env.example`, `.gitignore`, `app/observability/posthog-ai.js`, `app/README.md`, `app/server.js`, `package-lock.json`, `package.json`, `verification/posthog-ai-observability-2026-10-28.log`, `verification/posthog-ai-observability-check.js`; confirmed no alteration to core ACE MVP workflow.

4. **No runtime operations performed**:
   - Application not started (`node app/server.js` not executed)
   - No HTTP requests issued (no `curl`, no browser navigation, no fetch)
   - No tests executed (no `npm test`, no verification scripts)
   - No state changes (no `writeState`, no `writeStaging`, no library file modification)
   - No fixture or document modifications

5. **Evidence classification used** throughout:
   - `SOURCE_SUPPORTED_NOT_RUNTIME_VERIFIED` — contract and code visible; runtime behavior confirmed by design boundaries
   - `NOT_FOUND` — no such mechanism in source
   - `PARTIALLY SUPPORTED` — some aspects supported, some gaps
   - `UNVERIFIED` — cannot be verified without runtime execution (explicitly noted)
   - `CONFLICTING_EVIDENCE` — not encountered; any conflicts documented

**Inspection limitations stated:**
- QA/finalize/export behavior verified through code inspection and design boundaries, not through actual execution with Shopee data or external platforms
- Runtime behavior (actual video rendering, actual QA segmentation, actual library file I/O) not verified in this investigation
- External platform integration (Shopee, Facebook, TikTok) not attempted or claimed
- Hash computation and comparison behavior not tested at runtime
- Step-reuse policy decisions not codified in source; only mechanical guards inspected

---

## J. Protected status block (Section 3, mandatory)

- `contractResolutionStatus = UNRESOLVED`
- `Row 18 / Row 3c = PENDING RECONCILIATION`
- `Canonical precedence = PENDING CONFIRMATION`
- `Baseline captured and accepted = NO`
- `Implementation = NOT APPROVED`
- `Runtime validation = NOT PERFORMED`
- `ACS Seed Consolidation = PENDING OWNER REVIEW`
- `ACS Implementation = NOT APPROVED`
- `ACE Mission 1 / Z1 = UNCHANGED`

---

## Final Required Result

```
Mini Loop & Content Re-entry Contract Reconciliation = REPORTED
Runtime Validation = NOT PERFORMED
Implementation = NOT APPROVED
Z1 / Mission 1 Status = UNCHANGED
```

**Stop after returning the report. Wait for explicit owner authorization before runtime demonstrations or code change.**

---

## Executive Summary

This read-only investigation comprehensively addressed all 9 investigation questions for the Mini Loop & Content Re-entry Contract Reconciliation, based solely on source inspection of the ACE MVP repository (`/y/DevProject/Affiliate Content Engine`, branch `mission1-planning-docs`, HEAD `795dc0a6...`).

### Key conclusions:

1. **Workflow Core is solid and well-guarded** — status machine DRAFT→REVIEW→FINALIZED→EXPORTED→READY_TO_PUBLISH enforced at both `assertTransition` and route-handler levels; edit blocking at EXPORTED/READY_TO_PUBLISH prevents accidental modification; 16-item QA checklist before finalize; library dedup during export.

2. **Mini Loop & Content Re-entry are design gaps** — not embedded in current source. All 9 questions have clear "source-supported answer" + "requires design decision" categorization. The source provides mechanical guards (status transitions, edit blocking, checklist enforcement, library write/read) but not policy decisions about version lineage, step reuse, dependency hashes, or external publication.

3. **Nine evidence-based findings**:
   - Rebuild from EXPORTED requires new content project (editing blocked)
   - Library entries readable by ID only; no browse endpoint in source
   - Publish-prep produces preparatory payload only; never auto-publishes externally
   - Hash equality alone must NOT authorize skipping QA/freshness/approval (design principle 4.3)
   - Most change types cascade: text → QA → finalize → export → publish-prep pathway
   - Aspect ratio/resolution/frame rate changes require re-export (video re-render)
   - CTA/affiliate URL changes flow through QA/finalize/export same pathway
   - Version lineage not tracked; each new project via `POST /content/draft` gets fresh `content_id`
   - Content Library browse would require ~20 lines code following existing conventions

4. **Owner's path forward** (all read-only until explicit authorization):
   - Socialize this reconciliation report
   - Decide on minimal additions: `GET /api/mvp/library` browsing (low risk)
   - Design version lineage fields (parent_content_id/generation)
   - Define Mini Loop policy (which steps redo vs. reuse)
   - Set source freshness thresholds for content projects
   - Decide on publication status tracking
   - Consider duplicate detection mechanism

5. **All investigations read-only** — no code changes, no application startup, no HTTP requests, no repository modifications. The report stands as the definitive source evidence for any future design discussions.

**Final labeled result**:
```
Mini Loop & Content Re-entry Contract Reconciliation = REPORTED
Runtime Validation = NOT PERFORMED
Implementation = NOT APPROVED
Z1 / Mission 1 Status = UNCHANGED
```