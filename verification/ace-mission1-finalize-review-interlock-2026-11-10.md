# ACE — Human-in-the-loop Finalize Interlock (Owner directive, 2026-11-10)

**Directive:** the Owner approved a mandatory human check of the Thai draft before a content project may become `FINALIZED`.
**Implemented:** 2026-11-10, in the same pass as the Gate 4 PASS.
**Scope:** MVP content workflow (`/api/mvp/content/:id/finalize`), its service handler, the finalize tab, and the acceptance suite.

## 1. The rule

A project may only leave `REVIEW` for `FINALIZED` when the request carries a review that matches the script **as it is right now**:

```json
{
  "draft_review": {
    "confirmed": true,
    "reviewed_by": "Owner",
    "script_checksum": "<sha256 of the current script text>"
  }
}
```

Binding the confirmation to the checksum is the part that matters: it is not enough to have reviewed *some* draft, and editing the script after review invalidates the confirmation instead of silently carrying it forward.

## 2. Refusals, with reason codes

| Situation | Response |
|---|---|
| No `draft_review`, or `confirmed !== true` | `409` `code: draft_review_required`, plus the script text and its checksum so the caller can review it |
| `reviewed_by` missing or blank | `409` `code: draft_review_required` |
| `script_checksum` does not match the current script | `409` `code: draft_review_stale`, with the expected and supplied checksums |

Nothing is written on a refusal; the project stays in `REVIEW`.

## 3. Enforcement points

1. **`app/mvp/service.js` — `requireDraftReview()`** in `handleContentFinalize`. This is the authoritative guard, because the HTTP API is reachable without the UI.
2. **`app/mvp/content.js` — `finalizeProject(project, qa, review)`** re-checks the confirmation and the checksum, so no future caller can reach `FINALIZED` by a different route.
3. **`app/public/mvp.js` — the Finalize tab.** In `REVIEW` it now shows the full Thai draft, its checksum, its source (`LIVE_LLM` / `TEMPLATE`), a confirmation checkbox and a reviewer name field. The Finalize button is disabled until the checkbox is ticked and a name is present.

## 4. Audit trail

`project.finalize.review` records `confirmed`, `reviewed_by`, `reviewed_at`, `script_checksum` and `script_source`, and an `edit_log` entry is appended: `ตรวจรับบทพูดภาษาไทยโดย <name> ก่อน FINALIZED (<checksum prefix>…)`. So the finalized record says who claimed to read which text.

## 5. Tests

The acceptance suite gained 7 checks (86 → **93**):

- finalize without a review is refused with `409` + `draft_review_required`
- the refusal returns the script text and checksum
- a blank reviewer name is refused
- a stale checksum is refused with `draft_review_stale`
- a refused review leaves the project in `REVIEW`
- a confirmed review finalizes and records reviewer, timestamp and checksum
- the review appears in the edit log

`node verification/mvp-workflow-acceptance.js` → **93 passed, 0 failed**; `site-article-acceptance.js` 18/18; the three Gate 3 suites 21/21, 6/6, 20/20.

## 6. What this does not do

1. **It is not a signature.** `reviewed_by` is self-declared text; the app has no accounts and no identity provider. The interlock forces an explicit, checksum-bound act — it does not prove who performed it.
2. **It cannot verify that a human actually read the text.** An automated caller can send `confirmed: true`. Its real value is that such a caller must do so deliberately, with the checksum in hand, and that the act is recorded.
3. **It does not block export.** Export still only requires `FINALIZED`; the interlock sits one step earlier, where a mistake is still cheap to reject.
4. **The checklist is unchanged.** This is an additional gate, not a replacement for the 11-item checklist.
