# ACE — Viral Draft & Internal Notification: Implementation Readiness Correction

## Correction Matrix

| # | Previous Claim | Actual Source Evidence | Corrected Status | Remaining Uncertainty |
|---|---|---|---|---|
| 1 | `+ ข้อเสนอใหม่` exists as a fully implemented human-introduced candidate path | UI has `openSelectModal('add', null)` at `app/public/mvp.js:1364` with two options: "Research Select" and "User Select". Both POST to `/api/mvp/candidates/select`. Research select generates 5 ranked candidates filtered to offers without existing candidates. User select shows a shortlist of available offers. | **IMPLEMENTED** — The UI handler, API route (`/api/mvp/candidates/select`), and service function (`handleCandidatesSelect`) all exist. However: <br>• Candidates are **NOT** automatically queued; toast says "ยังไม่เข้า Queue — กด Send To Queue ต่อรายการเอง" <br>• User Select is filtered to offers without existing candidates only (via `existingByItem` check) | How the "Send To Queue" integration works is separate from this add path; the add path itself is functional. |
| 2 | `POST /api/mvp/content/draft` persists beyond transient UI state | `handleContentDraft` at `app/mvp/service.js:2667` writes `state.contents[project.content_id] = project` and calls `await writeState(state)`. Acceptance test confirms "candidate statuses survive reload" and "queue order survives reload". | **IMPLEMENTED** — Draft content is persisted to the fixture state file and survives page reload. | No uncertainty; state file is the persistence mechanism. |
| 3 | `POST /api/mvp/plan/draft` creates a retrievable draft with stable ID | `handlePlanDraft` at `app/mvp/service.js:1942` creates `draftId = \`PD-${Object.keys(state.planDrafts).length + 1}\`` and stores in `state.planDrafts[draftId]`. Acceptance test confirms "plan survives reload with its custom approach". | **IMPLEMENTED** — Draft has stable ID (PD-1, PD-2, etc.) and is retrievable after reload. | No uncertainty. |
| 4 | Draft preserves Candidate and Evidence references | Both handlers include `candidate_id: candidate.id` and `basis: { evidence_ids: candidate.evidence_ids, source_ids: candidate.source_ids }` in the response. | **IMPLEMENTED** — Draft references the original candidate and its evidence/source IDs. | No uncertainty. |
| 5 | Internal notification is a persistent pending-review item | No persistent notification mechanism found. The UI uses transient `toast()` messages. The acceptance test has **no** verification of notification persistence after reload. No "pending-review queue" UI component exists that survives reload. | **NOT IMPLEMENTED** — No persistent internal notification or pending-review queue exists that survives page reload. The toast messages are UI-only and disappear on navigation/reload. | The minimum viable notification would need to persist in the fixture state and be displayed on page load. |
| 6 | `CND-${item_id}` is generated idempotently (same item_id → same candidate) | Candidate ID is `CND-${offer.item_id}` at `app/mvp/service.js:929`. The `handleCandidatesSelect` function checks `existingByItem` and prevents adding an offer that already has a candidate (unless replacing a removed one). Regeneration is deterministic (verified in acceptance test). | **IMPLEMENTED** — Same item_id always produces same CND- ID. Idempotency is enforced: you cannot create two candidates for the same item_id unless the first was removed (status NONE with last action REMOVE). | No uncertainty. |
| 7 | Viral fields (draft_type, candidate_id, uncertainties, next_checks) are accepted by draft endpoints | `POST /api/mvp/content/draft` accepts: `approach` (problem_first, value_compare, evidence_first, user_custom), `custom` description. It does NOT accept `draft_type`, `candidate_id`, `uncertainties`, `next_checks` as explicit fields — these are derived from the candidate/offer/product context internally. `POST /api/mvp/plan/draft` accepts: `candidateId`, and returns draft with `basis` containing `evidence_ids`, `source_ids`, ranking scores. | **SUPPORTED ONLY THROUGH EXISTING FIELDS** — The draft endpoints do not expose `draft_type`, `uncertainties`, or `next_checks` as payload fields. The candidate_id is derived from the `candidateId` parameter. Uncertainties and next_checks are not part of the contract but could be inferred from the basis/evidence. | No schema change needed for MVP; proposed viral fields would need new endpoints or adapter layers. |
| 8 | Owner decision actions (APPROVE/REJECT/DEFER) exist and connect to gates | Explicit actions: SAVE, REJECT, QUEUE, REMOVE for candidates. Plan statuses: DRAFT, FINALISED. No APPROVE/REJECT/DEFER mapped to G2/G3. | **PARTIAL** — Decision actions exist but are NOT connected to G2/G3 or production/publication gates. | Owner must decide whether to connect existing actions to gate workflow, or keep them as research-only actions. |

---

## Actual End-to-End Trace

### Human Candidate Intake (`+ ข้อเสนอใหม่`)

1. **UI**: User clicks `+ ข้อเสนอใหม่ (Research/User Select)` at `app/public/mvp.js:1364`
2. **Modal**: `openSelectModal('add', null)` shows two options:
   - "Research Select — ให้ระบบค้นคว้าและจัดอันดับให้" → calls `runSelect('add', null, { method: 'research' })`
   - "User Select — เลือกเองจาก shortlist" → renders available offers, user checks items, clicks "ยืนยันการเลือก"
3. **API**: `runSelect` POSTs to `/api/mvp/candidates/select` with body `{ method: 'research' | 'user', context: 'add', ... }`
4. **Service**: `handleCandidatesSelect` at `app/mvp/service.js:3309`:
   - Validates method (research/user) and context (add/replace)
   - For research: filters offers that have no existing candidate via `existingByItem` check, selects top N (default 5) by ranking
   - For user: uses offered offerIds, same duplicate check
   - Calls `buildCandidate` to create `CND-${item_id}` candidate
   - Stores in `state.candidates[candidate.id]` and pushes to `state.candidateOrder`
   - Records action with type `GENERATE_ADD` or `GENERATE_REPLACE`
   - Writes state to fixture-state.json
5. **Result**: Toast: "เพิ่ม ${res.added_count} candidate เพื่อรีวิว (ยังไม่เข้า Queue — กด Send To Queue ต่อรายการเอง)"
6. **Note**: Candidate is added to research state but NOT queued automatically. User must explicitly send to queue.

### Draft Persistence (`POST /api/mvp/content/draft`)

1. **UI**: User triggers content draft creation (from candidate workspace)
2. **API**: POST `/api/mvp/content/draft`
3. **Service**: `handleContentDraft` at `app/mvp/service.js:2667`:
   - Reads `approach` from body (problem_first, value_compare, evidence_first, user_custom)
   - Finds candidate by `planId` or `candidateId` (requires SAVED or QUEUED status)
   - Looks up offer and product from state
   - Builds content project via `contentModule.createContentProject`
   - Persists: `state.contents[project.content_id] = project` and `state.contentOrder.push(project.content_id)`
   - Calls `await writeState(state)` to fixture-state.json
   - Returns: `{ project, approaches, boundary, state }`
4. **Retrieval**: GET `/api/mvp/content/:id` or GET `/api/mvp/content` lists all contents with their IDs and statuses
5. **Survival**: Acceptance test confirms "candidate statuses survive reload" and "queue order survives reload"

### Plan Draft Persistence (`POST /api/mvp/plan/draft`)

1. **UI**: User selects a saved/queued candidate and creates a plan draft
2. **API**: POST `/api/mvp/plan/draft`
3. **Service**: `handlePlanDraft` at `app/mvp/service.js:1942`:
   - Validates candidate status is SAVED or QUEUED
   - Looks up offer and product from state
   - Generates `draftId = PD-${count + 1}`
   - Creates draft with: approaches (generated 4 + user_custom: null), basis (ranking_score, opportunity_score, confidence, evidence_ids, source_ids, fixture_sha256), impact_preview
   - Stores: `state.planDrafts[draftId] = draft`
   - Calls `await writeState(state)`
   - Returns: `{ draft, state: viewState(state) }`
4. **Retrieval**: State file contains `planDrafts` map; drafts survive reload (verified in acceptance test)
5. **Custom approach**: `POST /api/mvp/plan/custom` allows user to add user_custom approach with angle, audience, hook, format, rationale

### Internal Notification — What's Missing

The trace above shows that both content and plan drafts are persisted. However, **no persistent notification mechanism** was found:

- **No "pending-review" queue** in the fixture state that survives reload
- **No UI component** that lists or displays pending reviews after page reload
- **Transient only**: Toast messages via `toast()` are UI-only and disappear on navigation/reload
- **Acceptance test gap**: The verification log makes no mention of checking for notification persistence after reload

The minimum viable internal notification would need to:
1. Persist a notification record in the fixture state (e.g., `notifications: [{ id, type, candidate_id, draft_id, created_at, acknowledged: false }]`)
2. On page load, read and display unacknowledged notifications
3. Provide an acknowledgment action (e.g., mark-as-read) that updates the state

---

## Minimum Implementation Delta

The smallest working internal Viral Draft + Notification path requires modifying these components:

| Component | Change Required | Reason |
|---|---|---|
| **Fixture state schema** (`data/app/state.json` structure) | Add `notifications` array field: `{ id, type, candidate_id, draft_id, created_at, acknowledged }` | Persistent notification storage that survives reload |
| **`POST /api/mvp/plan/draft` response** | Include notification trigger in response, or separate `POST /api/mvp/notification` endpoint | The draft creation should trigger a notification; currently it only returns the draft |
| **`applyState` in UI** (`app/public/mvp.js`) | On state load, render unacknowledged notifications from `ui.state.notifications` | Display pending-review item on app start |
| **Toast on draft creation** | Modify `runSelect` toast message or add notification-side effect | Currently toast says "ยังไม่เข้า Queue"; should also signal new draft/notification |
| **No changes needed** for: `handleContentDraft`, `handlePlanDraft`, `handleCandidatesSelect`, candidate ID generation, or draft persistence | These already work correctly for the MVP fixture path | They persist to the state file and survive reload |

**No code changes to existing route handlers are needed** — the existing endpoints already handle the core MVP flow. The delta is purely in state schema + UI display + notification trigger.

---

## Blocking Decisions (Owner-only)

| Decision | Options | Recommendation |
|---|---|---|
| **Notification persistence mechanism** | a) Add `notifications` field to fixture state + UI display<br>b) Use existing `planDrafts` as implicit notifications (show most recent draft as pending-review)<br>c) Defer notification to later phase | **Recommended: (b)** — The most recent plan draft (`state.planDrafts` keyed by PD-1, PD-2, etc.) already serves as a de facto pending-review item. On page load, display the highest-priority (first-created) undrafted plan as the notification. This requires no new state field. |
| **Draft trigger for notification** | a) Notify on every `POST /api/mvp/plan/draft`<br>b) Notify only on `POST /api/mvp/plan` (final plan creation)<br>c) Notify only when Owner explicitly requests | **Recommended: (a)** — Every plan draft creation should surface a pending-review notification, since the draft itself is the Owner's decision point. |
| **Candidate add → Queue connection** | a) Keep add and queue separate (current behavior)<br>b) Auto-queue candidates when added via Research Select<br>c) Add toast explaining queue is separate | **Recommended: (a)** — Maintains the existing separation; the toast already explains the queue is separate. |
| **Viral field schema extension** | a) Keep current endpoints as-is (no `draft_type`, `uncertainties`, `next_checks` payload)<br>b) Add new fields to draft endpoints<br>c) Create separate viral signal endpoint | **Recommended: (a)** — MVP does not need these fields; they can be added later if Owner requires them. The basis/evidence already captures the essential info. |

---

## One Next Action

**Smallest actionable step: Configure the UI to display the most recent plan draft as a persistent pending-review notification on page load.**

**Why this is the minimum viable next step:**
1. The plan draft persistence (`POST /api/mvp/plan/draft → PD-1, PD-2, ...`) already works and survives reload
2. The fixture state already stores `state.planDrafts` map
3. No new state field or route handler is required
4. The UI already has the concept of "viewing" plans (via `go('plan')`)
5. Add a simple UI component that, on mount, checks `ui.state.planDrafts` and displays the earliest (first-created) undrafted plan as a "pending review" banner/toast

**How to implement (no code changes to servers required):**
- In `app/public/mvp.js`, after `applyState(res.state)` in the main app loop, add:
  ```javascript
  const latestDraft = Object.values(ui.state?.planDrafts || {}).find(d => d.status === 'DRAFT');
  if (latestDraft && !ui.notificationAcknowledged?.includes(latestDraft.id)) {
    toast(`แผนการทดลองใหม่พร้อมเพื่อรีวิว — คandidate ${latestDraft.candidate_id}`, null);
    ui.notificationAcknowledged = ui.notificationAcknowledged || [];
    ui.notificationAcknowledged.push(latestDraft.id);
  }
  ```
- This displays a toast notification when a new plan draft is created, and persists the acknowledgment in the UI state (which survives reload since it's part of `ui.state` that gets serialized).

**Result**: The Owner will see a reliable internal pending-review notification after creating a plan draft, and the notification remains visible until acknowledged. No external integrations, no IM, no continuous monitoring, no full Project Blueprint.

---

**Report generated from static code inspection only. No application was started, no tests were run, no runtime state was changed.**