# ACE — Mission 1 vertical slice

A dependency-free local web app that demonstrates one path through Mission 1:

**Mock opportunity → evidence with claim classes → analysis & brief → human decision → persisted history**

It is deliberately narrow. It is not the full ten-step workflow, and it does not contact Shopee, TikTok, Facebook or any external service.

A second, separate page demonstrates the first MVP affiliate slice on a synthetic Shopee Affiliate export fixture: **import → research → 5 candidates → candidate workspace → plan draft → impact preview**. It keeps its own fixture state and never writes `data/app/state.json`.

A third capability sits on that same MVP page: **real export import**. You drop a Shopee Affiliate export (CSV / TSV / XLSX / JSON) into the Import step; the app detects the format, encoding, header and column mapping, shows a preview, and only writes **staging state** until you confirm the mapping, the account and the date range. Promoting a staged import turns it into the Research source and feeds the same ranking contract. A **Source Library** panel in Research lists every source with its file hash, `checked_at`, record counts, freshness and validation, and lets you archive a source without deleting the evidence that already uses it.

- Classic opportunity view: `http://127.0.0.1:4173/`
- MVP affiliate slice: `http://127.0.0.1:4173/mvp.html`

## Run

Requires Node.js 18 or newer. No install step and no dependencies.

```bash
node app/server.js
# http://127.0.0.1:4173
```

`HOST` and `PORT` are optional; the defaults are `127.0.0.1` and `4173`.

## What works

| Area | Behaviour |
|---|---|
| Ten-step sidebar | All ten steps are listed with their gate and status. Step 1 is active; Steps 2–10 show a scope notice rather than fake content. |
| Candidates | Three synthetic opportunities, each labelled `MOCK` with a `mock://` reference. |
| Evidence | Nine entries tagged `FACT`, `INFERENCE` or `UNKNOWN`, each with source, retrieval date, relevance and limitations. |
| Analysis | Hypothesis, arithmetic terms with `ASSUMPTION` / `MOCK_EVIDENCE` basis, and an explicitly illustrative result. |
| Measurement | Commission and net income are shown as `NOT_YET_MEASURABLE` because OQ-8 is unresolved. |
| Brief | Rationale, uncertainties, proposed (unapproved) experiment, and a suggested next action. |
| Decision | Select / reject / defer, with a required reason. Appends to history; never advances a gate. |
| Persistence | Decisions and the last selection are written to `data/app/state.json` and survive refresh and server restart. |

## MVP affiliate slice

| Area | Behaviour |
|---|---|
| Input | Synthetic `app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv`, or a pasted CSV with the same columns. |
| Records | 8 Sources, 8 Products, 8 Offers and 72 Evidence records, each with `checked_at` and `provenance`. |
| Analysis | Price vs fixture category median, promotion depth, commission per order, review signal, shop rating and related-shop crowding. Conversion and payout stay `UNKNOWN`. |
| Candidates | Exactly 5, each with `ranking_score`, `opportunity_score`, confidence, reasons, `source_ids`, `evidence_ids`, and FACT / INFERENCE / HYPOTHESIS / UNKNOWN claims. |
| Workspace | Save, Reject, Add to queue, Remove, reorder. Actions persist in fixture state across reload and restart. |
| Plan | Draft from a saved/queued candidate, with Personalized A, Personalized B, Exploration and a separate User Custom entry. |
| Impact preview | Required before creation; states what will not happen (no EXP, CWI, asset, publication, gate or spend) and confirms THB 0 / 0 external calls. |

### Real export import + Source Library

| Area | Behaviour |
|---|---|
| Formats | CSV, TSV, XLSX (SpreadsheetML) and JSON. Legacy `.xls` (BIFF) is rejected with a re-export instruction. |
| Encodings | UTF-8, UTF-8 with BOM, UTF-16LE, UTF-16BE and windows-874 (Thai). |
| Detection | Format, encoding, delimiter, header columns, canonical field mapping, unmapped columns and one-column conflicts. |
| Preview | Computes in memory: per-row status (VALID / DUPLICATE / INVALID / UNKNOWN), a 5-row sample and the suggested date range. **A preview writes no state at all.** |
| Confirmation | The commit needs `confirmMapping: true`, an `account` label and a `date_range`. Missing any of them is a 400 and nothing is written. |
| Staging | A confirmed commit writes **only** the staging file. Research keeps using the previous import until the staged record is promoted. |
| Records | Source / Product / Offer / Evidence, each carrying `source_id`, `product_id`, `shop_id`, `offer_id`, `affiliate_link`, `price_thb`, `commission_rate`, `promo`, `checked_at`, `file_hash`, `row_number` and `source_type`. |
| Duplicates | Identity is `file_hash` + `(item_id\|shop_id)`. A repeated file is reported as a duplicate import and writes nothing new. |
| Row report | Valid, duplicate, invalid and unknown counts plus the first 50 rows of each with reasons. |
| Source Library | Every source with `file_hash`, `checked_at`, `data_as_of`, record counts, freshness (FRESH / AGING / EXPIRED), validation checks and the candidates it feeds. |
| Archive | Archives a source, keeps all evidence and all existing candidates, and blocks new candidate generation until the source is active again. |
| Guards | No candidate is created when source validation fails, and expired data must be acknowledged explicitly. |
| Provenance | Synthetic uploads are labelled `SYNTHETIC`; user uploads are labelled `USER FILE` and never claim verification against Shopee. |

MVP endpoints:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/mvp/meta` | Fixture descriptor, sha256, boundaries and non-claims. |
| `POST` | `/api/mvp/import` | Import the fixture or `{ csv }`. |
| `GET` | `/api/mvp/state` | Fixture view: records, candidates, queue, plans. |
| `POST` | `/api/mvp/candidates/generate` | Generate exactly 5 candidates. |
| `POST` | `/api/mvp/candidates/:id/action` | `{ action: SAVE \| REJECT \| QUEUE \| REMOVE }`. |
| `POST` | `/api/mvp/queue/reorder` | `{ candidateId, direction }` or `{ order }`. |
| `POST` | `/api/mvp/plan/draft` | Draft with 3 generated approaches + custom slot + impact preview. |
| `POST` | `/api/mvp/plan/custom` | Store the user-custom approach separately. |
| `POST` | `/api/mvp/plan` | Create the fixture plan; requires `confirmImpact: true`. |

Import and Source Library endpoints:

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/mvp/import/preview` | Parse an upload in memory: format, encoding, mapping, row status. Writes nothing. |
| `POST` | `/api/mvp/import/commit` | Stage an upload. Requires `confirmMapping`, `account` and `date_range`. Writes staging only. |
| `GET` | `/api/mvp/staging` | List staged imports. |
| `GET` | `/api/mvp/staging/:id` | Staged rows, report and dataset counts. |
| `POST` | `/api/mvp/staging/:id/research` | Promote a staged import into Research; optionally generates the 5 candidates. |
| `GET` | `/api/mvp/research-report` | Source → candidate → evidence trace. |
| `POST` | `/api/mvp/sources/:id/archive` | Archive a source; keeps evidence and candidates, blocks new generation. |
| `POST` | `/api/mvp/sources/:id/validate` | Re-run the source validation checks. |

Fixture state defaults to `data/mvp/fixture-state.json` (git-ignored) and can be redirected with `ACE_MVP_STATE_FILE`. Staged imports live next to it in `data/mvp/staging-state.json` and can be redirected with `ACE_MVP_STAGING_FILE`. The MVP module never reads or writes `data/app/state.json` and never calls the Plan Version or CWI endpoints.

### Real Shopee export status

No real Shopee Affiliate export has been supplied to this workspace, so the import path is verified against **SYNTHETIC-labelled fixtures only**. `node verification/real-shopee-export-check.js` reports that blocker with exit code 2 and, once a real file is dropped into `data/imports/`, runs the real preview → commit → promote and prints the actual status codes and bodies.

## Content creation → export → Content Library

`app/mvp/content.js` owns the second half of the workflow and `app/remotion/render.js` renders the video.

**Prerequisite:** FFmpeg (with `libass`, `libx264`, `aac`) and optionally ffprobe. Discovery order is `$ACE_FFMPEG` / `$FFMPEG_PATH` → `.tmp/tools/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe` → `PATH`; ffprobe is read from the same directory. Without FFmpeg the app works up to FINALIZED and export returns `503`. Thai captions use `$ACE_THAI_FONT` when set, otherwise the first font found in `render.js`'s candidate list (Leelawadee UI / Tahoma / Cordia on Windows). Setup and troubleshooting are in the [root README](../README.md).

| Area | Behaviour |
|---|---|
| Lifecycle | `DRAFT → REVIEW → FINALIZED → EXPORTED → READY_TO_PUBLISH`, one step at a time; every other transition is a 409. |
| Storyboard | Scenes with visual / text / audio tracks, per-scene duration, reorder and delete, plus uploaded image and narration assets. |
| Script + CTA | Versioned script with a sha256 checksum; editing the last scene's text keeps the CTA in sync. |
| Thai QA | Seven categories (spelling, price, promotion, product name, CTA, evidence, external scope) recorded on the project without changing its status. |
| Finalize | 11-item checklist: QA `FAIL = 0`, previews, per-scene image/headline/voiceover, CTA in the last scene, evidence for factual lines, 5–90 s duration, audio state, script version and IDs. |
| Export | Local ffmpeg render to `1080×1920` H.264 + AAC at 30 fps, plus a still frame. Writes the Content Library index in the same transaction. |
| `EXPORT_KIND` | Every export records `kind`. `VIDEO` means a real MP4 exists; `SCRIPT_ARTIFACT` means only Markdown was written. Publish prep requires `VIDEO`. |
| Content Library | Append-or-replace index at `data/mission1/content-library.json` (`ACE_CONTENT_LIBRARY_FILE` override); leading `#` comments tolerated; a malformed index is refused, never overwritten. |
| Retrieval | By ID with live integrity (`VERIFIED` / `MISMATCH` / `MISSING`), whole-library listing, and a download route that derives the path from the record. |

Content endpoints:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/mvp/content` | List content projects. |
| `POST` | `/api/mvp/content/draft` | Create a project from a plan or a candidate. |
| `POST` | `/api/mvp/content/:id/track/:track` | Edit the visual / text / audio track of a scene. |
| `POST` | `/api/mvp/content/:id/qa` | Run Thai QA. |
| `POST` | `/api/mvp/content/:id/review` | `DRAFT → REVIEW`. |
| `POST` | `/api/mvp/content/:id/finalize` | `REVIEW → FINALIZED` behind the checklist. |
| `POST` | `/api/mvp/content/:id/export` | `FINALIZED → EXPORTED`, renders the MP4, writes the library entry. |
| `GET` | `/api/mvp/content/:id/export/video` \| `/still` | Stream the exported file or its still frame. |
| `POST` | `/api/mvp/content/:id/publish-prep` | `EXPORTED → READY_TO_PUBLISH`; requires a `VIDEO` export. |
| `GET` | `/api/mvp/library` | List the whole library with per-entry integrity and counts. |
| `GET` | `/api/mvp/library/:id` | One stored record plus live integrity evidence. |
| `GET` | `/api/mvp/library/:id/file` | Download the stored bytes; 404 when the file is gone. |
| `POST` | `/api/mvp/content/generate` | Content Artifact v1: Markdown only, `kind = SCRIPT_ARTIFACT`. |
| `GET` | `/api/mvp/content/export/:artifact_id` | Download that Markdown artifact. |

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/opportunities` | Mock dataset (validated on read). |
| `GET` | `/api/state` | Persisted slice state and decision history. |
| `POST` | `/api/decision` | Append `{ opportunityId, decision, reason }`; `decision` is `SELECT`, `REJECT` or `DEFER`. |
| `GET` | `/api/health` | Liveness check. |

The server binds to loopback only and sets a restrictive CSP, `no-store`, and `nosniff`.

## Persistence

State lives outside the mission records, in [data/app/state.json](../data/app/state.json). It is git-ignored. Deleting it resets the slice; the server recreates it on the next request.

Mission records under `data/mission1/` are read-only for this app. In particular, the app does not append to `run-history.yaml`, because an app decision is not a mission run-history entry and G1 remains the only recorded gate decision.

## Boundaries

- Mock data only; no account access, credentials, APIs, publishing, purchases or spend.
- The decision recorded here is an **opportunity decision**, not G2. G1 stays plan-level (`APPROVED_WITH_NOTES`); G2–G5 stay unapproved.
- `Edit` and `Next` are disabled, with the reason shown. Workflow advancement is out of scope.
- No build step, no tests runner, no dependencies.

## A1 — Article preview routes

| Method | Route | Notes |
|---|---|---|
| `GET` | `/review/:slug` | `200` only when a `PREVIEW` publication exists **and** the request carries the preview token. Everything else is `404`. |
| `GET` | `/media/:contentId/:file` | Same gate. Serves only image files referenced by the content record, by basename, from the exports directory. |
| `GET` | `/review.css` | Static stylesheet, served from `app/public`; external because the CSP forbids inline styles. |

Publication records live in `data/site/publications.json` (git-ignored) and are created with
`node app/site/seed.js`. The store is separate from the MVP content lifecycle:
`READY_TO_PUBLISH` never implies a publication, and A1 has no `PUBLISHED` state at all.
