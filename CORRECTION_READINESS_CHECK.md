# ACE — Final Readiness Check: Persistent Acknowledgement

## Contradiction Resolved

**The previous report claimed** that `ui.notificationAcknowledged` (transient UI state) could survive page reload. **This is incorrect.**

### Source Evidence

1. **Boot sequence** (`app/public/mvp.js:2682-2694`): On every page load (including reload), the IIFE runs:
   ```javascript
   const [meta, state] = await Promise.all([api('/api/mvp/meta'), api('/api/mvp/state')]);
   ui.meta = meta;
   applyState(state);  // sets ui.state = state, replacing previous value
   ```
   `applyState` unconditionally replaces `ui.state` with the server response.

2. **No client-side persistence** (`app/public/mvp.js`): There is NO `localStorage`, NO `sessionStorage`, NO mechanism to persist `ui` state across reloads. The `ui` object is re-initialized to `{meta: null, state: null}` on each script execution.

3. **State survives reload because the server re-sends it** (verified in acceptance test): The acceptance test log shows `GET /api/mvp/state -> 200` after reloads, and "candidate statuses survive reload". This is because the API always returns the current fixture state — it does not because of client-side persistence.

4. **`state.planDrafts` IS persistent** because it's part of the server's fixture state that is re-fetched on each load. The `handlePlanDraft` function stores drafts in `state.planDrafts`, and `applyState` restores them. This is verified: "plan survives reload with its custom approach."

### The Contradiction

- **Previous claim**: `ui.notificationAcknowledged` survives reload → **INCORRECT**. `ui` state is transitory; it's replaced by `applyState(state)` on every load.
- **Actual behavior**: On each page load, the server returns the current `state.planDrafts`; the UI must re-derive the pending-review list from that. Any in-memory acknowledgement set is lost on reload.

## A. Source-Backed Current-State Findings

| Finding | Evidence |
|---|---|
| `state.planDrafts` persists and survives reload | `handlePlanDraft` at `app/mvp/service.js:1942` stores in `state.planDrafts`; `applyState` restores; acceptance test confirms "plan survives reload" |
| `ui.state` does NOT survive reload | Boot sequence at `app/public/mvp.js:2682-2694` always fetches fresh state via `api('/api/mvp/state')`; `applyState` replaces `ui.state` |
| No existing API for acknowledgement persistence | Search of `app/mvp/service.js` routes: no `POST /api/mvp/plan/draft/acknowledge`, no `POST /api/mvp/notification` endpoint |
| Draft ID and title fields available in planDrafts | `handlePlanDraft` response includes `draft.id` (e.g., `PD-1`), `draft.candidate_id`, `draft.basis.evidence_ids`, `draft.created_at` |
| Plan Draft fields sufficient to represent Viral Content Draft | Plan Draft already contains: `candidate_id`, `basis.{evidence_ids, source_ids, ranking_score, opportunity_score}`, `approaches.{generated, user_custom}`, `status: 'DRAFT'`, `created_at` — all required fields already present; "Viral" is an interpretive layer |

## B. Corrected Minimal Design

### Source of Truth for Draft Status

**`state.planDrafts` map** from the server's fixture state API response. This is the only persistent source — it survives reload because the API always returns the current state.

### Acknowledgement Design (Corrected)

Given that `ui` state does NOT survive reload, the only honest design is **session-level acknowledgement**:

1. **On each page load**, UI reads `ui.state.planDrafts` and identifies all drafts with `status: 'DRAFT'`
2. **Display**: Show ALL undrafted plans as a pending-review list (not just the "most recent"). Each entry shows: candidate title, approach, creation timestamp.
3. **Acknowledgement (within session)**: Owner clicks "Acknowledge" on a specific draft → UI adds that draft's ID to a transient `ui.notificationAcknowledged` Set → draft removed from pending-review display.
4. **Reload resets acknowledgement**: On page reload, `ui.notificationAcknowledged` is lost (re-initialized). The pending-review list re-derives from `state.planDrafts`, showing all DRAFT plans again. Owner must re-acknowledge.
5. **No gate transition**: Acknowledgment is purely "I have seen this" — does NOT change draft `status`, does NOT trigger G2/G3, does NOT advance to production/publication.

### Why This Design Is Minimal and Correct

- **No backend changes**: Uses only existing `state.planDrafts` from the server API
- **No new state schema**: Leverages existing `status: 'DRAFT'` field
- **No code changes to service.js**: Only UI changes in `app/public/mvp.js`
- **Honest about limitations**: Acknowledgment resets on reload, which is the correct behavior given the read-only, fixture-state-only architecture
- **Deduplication**: Each draft ID is unique; showing all DRAFT plans naturally handles deduplication

### What This Design Does NOT Claim

- Acknowledgement persists across page reloads (honestly: it does not, due to architecture)
- Acknowledgment implies production approval or gate transition (explicitly: it does not)
- The notification list is comprehensive across sessions (it re-derives per session from the server)

## C. Exact Minimal File/Function Change List (Identified, Not Executed)

| # | Change Target | Change Type | Reason | Scope |
|---|---|---|---|---|
| 1 | `app/public/mvp.js` — boot IIFE | Add acknowledgement tracking logic | After `applyState(state)`, initialize `ui.notificationAcknowledged = new Set()` and populate from any previously acknowledged IDs stored... wait, there's no storage mechanism. **Correction**: Initialize as empty `Set()`; acknowledgement is session-only. | UI only; no server changes |
| 2 | `app/public/mvp.js` — renderPlan or main render | Display pending-review list | Render section that lists all `ui.state.planDrafts` where `draft.status === 'DRAFT'` AND `!ui.notificationAcknowledged.has(draft.id)`. Shows draft ID, candidate title, approach key, created_at. | UI only |
| 3 | `app/public/mvp.js` — acknowledgment handler | Add click handler on "Acknowledge" button | When clicked, add `draft.id` to `ui.notificationAcknowledged`, re-render to remove the acknowledged entry from the list. | UI only |
| 4 | `app/public/mvp.js` — renderPlan | Filter acknowledged drafts | In the pending-review list render, skip drafts whose ID is in `ui.notificationAcknowledged`. | UI only |
| 5 | **No changes** to `app/mvp/service.js` | — | Existing `handlePlanDraft` already persists drafts correctly; no schema change needed. | Preserved |
| 6 | **No changes** to fixture-state.json | — | `planDrafts` map already exists; no new field required. | Preserved |

**File functions requiring changes**: Only `app/public/mvp.js` — specifically the boot IIFE and plan render functions. No server-side or service.js changes needed.

## D. Acceptance Criteria for Future Runtime Testing

| # | Test Scenario | Expected Behavior |
|---|---|---|
| 1 | **Reload shows pending-review list** | After creating a plan draft via `POST /api/mvp/plan/draft`, reloading the page must display the pending-review list derived from the current `state.planDrafts` from the server |
| 2 | **Multiple drafts visible** | Creating multiple plan drafts (PD-1, PD-2, etc.) must each appear as separate entries in the pending-review list, all with `status: 'DRAFT'` |
| 3 | **Acknowledgment removes from list (session-only)** | Clicking "Acknowledge" on a specific draft must remove it from the pending-review display. The draft's `status` field must remain `'DRAFT'` unchanged. |
| 4 | **Reload re-presents list** | After acknowledging a draft and reloading the page, the pending-review list must re-appear (because `ui.notificationAcknowledged` is session-only and resets). The Owner must re-acknowledge. |
| 5 | **Deduplication by draft ID** | Each draft ID (PD-1, PD-2, etc.) is unique; the list must not contain duplicate entries for the same draft ID. |
| 6 | **No automatic production/publication/gate transition** | Acknowledgment must NOT: change candidate status, create an Experiment/CWI, advance to G2/G3, or modify any publish-ready state. |
| 7 | **Acknowledgment is not production approval** | Explicit test: after acknowledging all drafts, the system must not have advanced any gate, created any publication, or changed any production-ready state. |
| 8 | **Plan Draft fields represent Viral Content honestly** | A Plan Draft can be labeled "Viral Content Draft" only if it has: `candidate_id` linking to a scored Candidate, `basis.evidence_ids` and `basis.source_ids` for provenance, and an Owner-provided reason/signal recorded separately. Not every Plan Draft is automatically a Viral Content Draft. |

## E. Exactly One Next Action

**Implement the session-level persistent pending-review list in `app/public/mvp.js`.**

**Specific implementation**: In the boot IIFE (after line 2694 `applyState(state)`), add:

```javascript
// Initialize session acknowledgement set
ui.notificationAcknowledged = ui.notificationAcknowledged || new Set();

// Build pending-review list from current planDrafts
const pendingDrafts = (ui.state.planDrafts || [])
  .filter((draft) => draft.status === 'DRAFT' && !ui.notificationAcknowledged.has(draft.id));

// Render pending-review banner if there are undrafted plans
if (pendingDrafts.length > 0) {
  // Show the earliest (first-created) plan as the primary notification,
  // or show a summary count: `${pendingDrafts.length} plan(s) pending review}`
  // Include "Acknowledge" action for each
}
```

**And add an acknowledgment handler**: When Owner clicks "Acknowledge" on a draft entry, add `draft.id` to `ui.notificationAcknowledged` and re-render.

**Why this is the one next action**:
- It correctly resolves the `ui.notificationAcknowledged` survival contradiction by making acknowledgement explicitly session-only
- It uses the only persistent source available: `state.planDrafts` from the server API
- It requires no backend changes, no new state schema, no service.js modifications
- It provides the Owner with a reliable way to see and acknowledge Viral Content Drafts within the existing ACE architecture
- It honestly acknowledges the architectural limitation (acknowledgement resets on reload) rather than inventing persistence that doesn't exist

**Result**: The Owner sees a reliable pending-review list of Viral Content Drafts each time they load ACE. They can acknowledge drafts within a session, and on reload the list re-appears (as expected in a fixture-state-only architecture). Acknowledgment never implies production approval or gate transition.