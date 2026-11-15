# M. MVP Affiliate Workflow Slice — Implementation Note

**Status:** IMPLEMENTED IN FIXTURE STATE · 2026-10-21
**Scope of this note:** the first workflow slice only —
`Shopee Affiliate export/fixture → Research → 5 Candidates → Candidate workspace → Plan draft → Impact preview`,
plus the **real export import** and **Source Library** extensions described in §12 and §13.

**This document does not claim acceptance.** It is not AC-01, not SCOPE-1, and not Mission 1 completion. No gate is recorded or changed by the slice, and no Mission 1 evidence record is created.

---

## 1. What the slice is

A dependency-free local page (`/mvp.html`) and API namespace (`/api/mvp/*`) that exercises one complete affiliate path on **synthetic fixture state**:

1. Import a Shopee Affiliate-shaped export (bundled fixture, or a pasted CSV with the same columns).
2. Build Source, Product, Offer and Evidence records, each with `checked_at` and `provenance`.
3. Analyse price, promotion, commission, reviews, shops and related-shop crowding.
4. Generate exactly five ranked Candidates, each with scores, confidence, reasons and claim-classified statements.
5. Operate a Candidate workspace: Save, Reject, Add to queue, Remove and reorder the queue.
6. Create a plan draft from a **selected** candidate, show four approaches, then create a fixture plan only after the impact preview is confirmed.

It never contacts Shopee, never reads or writes `data/app/state.json`, never calls the Plan Version or CWI endpoints, and never produces video, a publication, an account action or spend.

---

## 2. Input: synthetic fixture

| Item | Value |
|---|---|
| File | [app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv](../../app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv) |
| Label | `SYNTHETIC Shopee Affiliate export fixture (hand-authored, no Shopee account contacted)` |
| Rows | 8 offers · 7 shops · 6 categories |
| SHA-256 | `5a929f637cdabbbe7113abb97fe12f20d5b327e4c1e3c75e8adf23211e6e3a87` |
| Columns | `item_id, shop_id, shop_name, product_name, category, price_thb, list_price_thb, commission_rate, rating, rating_count, units_sold, shop_rating, related_shop_count, promo_type, promo_label, promo_depth_pct, product_url, shop_url, exported_at` |

The file starts with `#` comment lines that state it is invented. The importer skips comment and blank lines, validates every numeric range, rejects duplicate `item_id`s and reports row-level errors without writing state.

A real export has the same shape; replacing the fixture is an import, not a code change. **Every figure produced by this slice is fixture data — not market evidence.**

---

## 3. Records written on import

| Record | ID form | Key fields |
|---|---|---|
| Source (export) | `SRC-EXPORT-<sha8>` | `kind: AFFILIATE_EXPORT`, `reference`, `checked_at`, `provenance {method: CSV_IMPORT, synthetic, file, sha256, row_count, limitations}` |
| Source (shop) | `SRC-SHOP-<shop_id>` | `kind: SHOP_REFERENCE_FIXTURE`, `reference: fixture://shopee/shop/<id>`, same `checked_at`, per-shop provenance |
| Product | `PRD-<item_id>` | `name`, `category`, `shop_id`, `url`, `source_ids`, `checked_at`, `provenance {row, sha256, synthetic}` |
| Offer | `OFR-<item_id>` | `price_thb`, `list_price_thb`, `commission_rate`, `commission_per_order_thb`, `promo {type,label,depth_pct}`, `reviews {rating,rating_count,units_sold}`, `shop {id,name,rating,related_shop_count}`, `metrics`, `evidence_ids`, `source_ids`, `checked_at`, `provenance` |
| Evidence | `EV-<item_id>-<CODE>` | `claim_class`, `statement`, `value`, `unit`, `method`, `source_ids`, `checked_at`, `limitations` |

Nine evidence records per offer (72 for the fixture):

| Code | Class | Meaning |
|---|---|---|
| `PRICE` | FACT | Price and list price read from the row |
| `COMMISSION` | FACT | Rate and THB per order at the listed price |
| `PROMO` | FACT | Promotion type, label and stated depth |
| `REVIEWS` | FACT | Rating, rating count, units sold |
| `SHOP` | FACT | Shop rating and related-shop count |
| `PRICE_POSITION` | INFERENCE | Price vs the median of the same fixture category |
| `REVIEW_SIGNAL` | INFERENCE | `0.6 × normalised rating + 0.4 × normalised log10(1 + rating_count)` |
| `COMPETITION` | INFERENCE | Related-shop count mapped to low/medium/high fixture crowding |
| `CONVERSION` | UNKNOWN | Click-through, conversion and payout approval are absent |

`checked_at` is the import timestamp (server clock). `provenance.limitations` is mandatory and says what the record cannot support.

---

## 4. Candidate generation

Five candidates are selected from all imported offers; generation fails with `422` if fewer than five offers exist.

### 4.1 Scores

Each component is min–max normalised across the imported offers (0–1):

| Component | Weight | Source |
|---|---|---|
| Commission per order | 0.30 | `price_thb × commission_rate` |
| Promotion depth | 0.20 | `promo_depth_pct` |
| Review signal | 0.20 | rating/volume blend above |
| Shop signal | 0.15 | `shop_rating` |
| Competition (inverse) | 0.15 | `1 − normalised related_shop_count` |

```
opportunity_score = round(100 × Σ(weight × normalised component))
confidence_score  = 0.7 × (key fields present / 6) + 0.3 × volume factor
                    volume factor: ≥200 ratings = 1, ≥50 = 0.75, else 0.5
ranking_score     = round(0.85 × opportunity_score + 0.15 × 100 × confidence_score)
```

Ties break by commission per order, then `item_id`. The same input produces the same five ids, ranks and scores (verified by regenerating twice).

**Confidence is confidence in the fixture data, not in future sales.** No candidate is a forecast or a recommendation to publish.

### 4.2 Candidate shape

```json
{
  "id": "CND-1005",
  "rank": 1,
  "title": "Cat Food 1.5kg",
  "product_id": "PRD-1005",
  "offer_id": "OFR-1005",
  "scores": { "ranking_score": 81, "opportunity_score": 78,
              "confidence": { "level": "HIGH", "score": 1, "basis": "..." },
              "components": { "weights": {}, "normalized": {} },
              "formula_version": "mvp-score-v1" },
  "claims": [ { "text": "...", "claim_class": "FACT", "evidence_ids": ["EV-1005-PRICE"] } ],
  "reasons": [ "..." ],
  "source_ids": ["SRC-EXPORT-5A929F63", "SRC-SHOP-504"],
  "evidence_ids": ["EV-1005-PRICE", "..."],
  "status": "NONE",
  "status_history": [],
  "provenance": { "source": "MVP_AFFILIATE_SLICE", "method": "DETERMINISTIC_SCORING" }
}
```

Every candidate carries all four claim classes:

- **FACT** — price/list/commission/promo and rating/sales rows.
- **INFERENCE** — price position, review signal, crowding.
- **HYPOTHESIS** — the proposed content angle could turn observed demand into orders.
- **UNKNOWN** — click-through, conversion and payout approval.

Every `evidence_ids` entry must resolve to a stored Evidence record; the acceptance test checks this for claims, candidates and offers.

---

## 5. Candidate workspace

| Action | Transition | Queue effect |
|---|---|---|
| Save | `NONE`/`QUEUED` → `SAVED` | appended if absent |
| Reject | any non-rejected → `REJECTED` | removed |
| Add to queue | `NONE`/`SAVED` → `QUEUED` | appended if absent |
| Remove | `SAVED`/`QUEUED` → `NONE` | removed |
| Reorder | `UP` / `DOWN`, or a full order array | new order |

Rejected candidates cannot be saved or queued (`409`). Every action appends an audit entry (`ACT-<n>`) with `from`, `to`, timestamp and the resulting queue, and appends to the candidate's `status_history`.

State is a single JSON file at `ACE_MVP_STATE_FILE` (default `data/mvp/fixture-state.json`). Writes are atomic (temp file + rename) and serialised by an in-process queue. Reload and server restart restore candidates, statuses, queue order and plans; re-importing the same fixture is idempotent.

---

## 6. Plan and impact preview

A plan draft can only be created from a candidate in `SAVED` or `QUEUED` (`409` otherwise).

### 6.1 Four approaches

| Key | Label | Origin |
|---|---|---|
| `personalized_a` | Personalized A — problem-first demo for the category audience | `AI_DRAFT` |
| `personalized_b` | Personalized B — value/comparison framing | `AI_DRAFT` |
| `exploration` | Exploration — broad category hook, product appears late | `AI_DRAFT` |
| `user_custom` | User Custom | `USER` |

`approaches.generated` always contains exactly the three AI approaches. **User Custom is stored at `approaches.user_custom`, never inside `generated`**, has `origin: "USER"`, `evidence_ids: []` and a warning that its claims were not generated from evidence.

Generated approaches carry `gate_note: "Draft only. No experiment is created and G2 is not requested."`

### 6.2 Impact preview

The preview is generated with the draft and required before creation:

- **Will happen** — one fixture plan record; the chosen approach and custom entry persisted in fixture state.
- **Will NOT happen** — no Experiment (`EXP-*`), no Content Work Item (`CWI-*`), no script/video/asset/export, no publication, no account access, no purchase, no spend, no G1–G5 or G-pay change, nothing written to `data/app/state.json`.
- **Gates** — G1 unchanged; G2–G5 not requested; G-pay none.
- **Spend THB 0 · external calls 0.**

`POST /api/mvp/plan` without `confirmImpact: true` returns `400` with the preview and writes nothing.

### 6.3 Plan identity

The fixture plan follows the clarified identity semantics from [-final-contract-id-concurrency.md §4.2](-final-contract-id-concurrency.md#L177):

| Field | Value |
|---|---|
| `plan_id` (Plan identity) | `MVP-PLAN-<cycle>-<n>` |
| `id` (immutable snapshot id) | `MVP-PLAN-<cycle>-<n>-v1` |
| `version` | `v1` |
| `status` | `FIXTURE_DRAFT` |

The `MVP-` prefix is deliberate: this is a fixture plan, not a foundation Plan Version. `foundation_handoff.available` is `false` and nothing is posted to `/api/plan-version`. Submitting a real plan remains a separate owner decision.

---

## 7. API

All routes are under `/api/mvp/`. Errors are JSON `{ error }`; validation failures may add `details` (row-level CSV errors) or `impact_preview`.

| Method | Route | Success | Notes |
|---|---|---|---|
| GET | `/api/mvp/meta` | 200 | fixture path, sha256, row count, boundaries, non-claims |
| POST | `/api/mvp/import` | 201 (200 if same fixture reused) | `{ csv? }`; validates columns, ranges and duplicates |
| GET | `/api/mvp/state` | 200 | full fixture view |
| POST | `/api/mvp/candidates/generate` | 201 | exactly 5; `422` if fewer than 5 offers |
| GET | `/api/mvp/candidates` | 200 | candidates + queue |
| POST | `/api/mvp/candidates/:id/action` | 200 | `SAVE`, `REJECT`, `QUEUE`, `REMOVE`; `404`/`409` |
| POST | `/api/mvp/queue/reorder` | 200 | `{candidateId, direction}` or `{order: [...]}` |
| POST | `/api/mvp/plan/draft` | 201 | requires a saved/queued candidate; `409` |
| POST | `/api/mvp/plan/custom` | 200 | stores `approaches.user_custom` with `origin: USER` |
| POST | `/api/mvp/plan` | 201 | requires `confirmImpact: true`; `400` otherwise |

The foundation routes are unchanged. `server.js` delegates only paths beginning `/api/mvp/` to [app/mvp/service.js](../../app/mvp/service.js#L1).

### 7.1 Import and Source Library routes

| Method | Route | Success | Notes |
|---|---|---|---|
| POST | `/api/mvp/import/preview` | 200 | parses in memory; **never writes state**; `400`/`413`/`415` on a bad file |
| POST | `/api/mvp/import/commit` | 201 (200 if the file is a duplicate) | needs `confirmMapping: true`, `account.label`, `date_range`; writes staging only |
| GET | `/api/mvp/staging` | 200 | staged imports and the staging file path |
| GET | `/api/mvp/staging/:id` | 200 | per-row status, report and dataset counts |
| POST | `/api/mvp/staging/:id/research` | 201 | promotes the staged import into Research; `409` if validation failed or the data expired |
| GET | `/api/mvp/research-report` | 200 | source → candidate → evidence trace |
| POST | `/api/mvp/sources/:id/archive` | 200 | archives a source; keeps evidence and candidates |
| POST | `/api/mvp/sources/:id/validate` | 200 | re-runs the source validation checks |

---

## 8. Boundaries and non-claims

- **Synthetic input.** The fixture is invented. Nothing here is Shopee market evidence, and the UI labels it `SYNTHETIC FIXTURE` on every screen.
- **Fixture state only.** `data/app/state.json`, the CWI schema, `data/mission1/*` and the Plan Version contract are untouched. The real repository state is checksummed before/after the acceptance run.
- **No downstream execution.** No experiment, CWI, script, storyboard, video, export, publication, scheduling, account access, credential, purchase or spend.
- **No gate.** G1 is not re-decided; G2–G5 are not requested. The plan is not Mission 1 progress.
- **No acceptance claim.** This slice does not establish AC-01, SCOPE-1 or Mission 1 completion. D5 remains not run, D9 remains not applicable as written, and `DEF-CWI-1` remains open.
- **Scores are heuristics.** `mvp-score-v1` is a transparent fixture-data ranking, not a performance model; conversion and payout stay `UNKNOWN`.

---

## 9. Verification

| Check | Result |
|---|---|
| [mvp-workflow-acceptance.js](../../verification/mvp-workflow-acceptance.js) on temp state | **56/56 assertions passed**, exit 0 — [log](../../verification/mvp-workflow-acceptance-2026-10-21.log) |
| [mvp-server-isolation-audit.js](../../verification/mvp-server-isolation-audit.js) | all checks passed — MVP is 4 lines of delegation; no Foundation state, route or namespace leakage; nothing staged |
| Foundation regression after the change | 19/19 passed — [log](../../.tmp/foundation-regression-after-mvp.log) |
| CWI contract enforcement | all passed |
| Claim-class validation | all passed |
| D1/D2 and D10 evidence tests | passed |
| CWI endpoint acceptance | 20 cases, 0 failures |
| `node --check` on service and client | exit 0 |
| Real `data/app/state.json` | byte-identical (`5d29cdbdace0a73580bc2e0633f2e8cb`) |
| Real `data/mvp` | absent before and after |
| Commits created | 0 |

The acceptance test runs on a copy of `app/`, `data/` and `docs/` in a temp directory with `ACE_MVP_STATE_FILE` inside that copy, so no repository state can be written.

---

## 10. How to run

```bash
node app/server.js
# classic view:   http://127.0.0.1:4173/
# MVP fixture:    http://127.0.0.1:4173/mvp.html
```

To keep even the fixture state out of the repository:

```bash
ACE_MVP_STATE_FILE=.tmp/mvp-preview/state.json PORT=4180 node app/server.js
```

`HOST` and `PORT` behave as before. There are no dependencies and no build step.

---

## 11. Limitations

- One fixture, one cycle, one process. The state lock serialises writes inside a single server process; it is not a cross-process or multi-user guarantee.
- The fixture import path is CSV. The real export path (see §12) additionally accepts TSV, XLSX and JSON.
- The analysis uses category medians and related-shop counts from the same fixture; it is not a marketplace survey.
- The plan is a fixture record with no version history beyond `v1`; versioning, submission and gate handling are out of scope for this slice.
- The UI was exercised manually (import → candidates → queue → plan → reload); it is not an accessibility audit.

---

## 12. Real export import (added 2026-10-21)

### 12.1 What was added

`app/mvp/importer.js` parses a **user-supplied** Shopee Affiliate export, and the Import step of the MVP page now runs a four-step flow:

```
choose file → preview (no writes) → confirm mapping + account + date range → stage → promote into Research
```

| Capability | Behaviour |
|---|---|
| Formats | CSV, TSV, XLSX (SpreadsheetML, stored or deflated ZIP) and JSON (array or `{data: [...]}`). Legacy `.xls` (BIFF) is rejected with `415` and a re-export instruction. |
| Encodings | UTF-8, UTF-8 with BOM, UTF-16LE, UTF-16BE and windows-874 (Thai). A UTF-16 BOM is detected before UTF-8. |
| Delimiter | `,`, `;` or tab, chosen from the header line. |
| Header mapping | Each header cell is matched against a canonical field and its aliases (`item_id`, `shop_id`, `price_thb`, `commission_rate`, `promo_label`, `affiliate_link`, `exported_at`, …). The mapping is editable in the preview and confirmed by the user. |
| Conflicts | A column mapped to two fields, or a required field left unmapped, is reported as a warning; unmapped columns are listed and ignored. |
| Row status | `VALID`, `DUPLICATE`, `INVALID` (a range/type error, with the field and the reason) or `UNKNOWN` (a required field is empty). |
| Preview | Computed in memory: format, encoding, delimiter, columns, mapping, per-row status, a 5-row sample, counts and the suggested date range. **A preview writes nothing to disk.** |
| Commit | Requires `confirmMapping: true`, `account.label` and `date_range.from`/`date_range.to`. A missing piece is a `400` and nothing is written. |
| Staging | A confirmed commit writes **only** the staging file (`data/mvp/staging-state.json` by default, `ACE_MVP_STAGING_FILE` to redirect). Research keeps serving the previous import until the staged record is promoted. |
| Promote | `POST /api/mvp/staging/:id/research` replaces the Research source and can generate the 5 candidates in the same call. The candidate set is generated *before* any write, so a guard failure leaves both files untouched. |
| Duplicates | Row identity is `file_hash` + `(item_id\|shop_id)`. A repeated file returns `200` with `duplicate_import: true` and writes nothing new. |
| Report | Valid / duplicate / invalid / unknown counts plus the first 50 rows of each with their reasons. |

### 12.2 Records

A staged import produces the same record shapes as the fixture (§3) with the extra fields the scope asked for:

| Field | Where |
|---|---|
| `source_id` | `SRC-EXPORT-<sha8>` and `SRC-SHOP-<shop_id>`; carried on Product, Offer and Evidence as `source_ids` |
| `product_id` | `PRD-<item_id>` |
| `shop_id` | on the Offer and the Product |
| `offer_id` | `OFR-<item_id>` |
| `affiliate_link` | on the Offer |
| `price` | `price_thb` / `list_price_thb` on the Offer |
| `commission` | `commission_rate` / `commission_per_order_thb` |
| `promotion` | `promo {type,label,depth_pct}` |
| `checked_at` | on every Source, Product, Offer and Evidence record |
| `file_hash` | sha256 of the uploaded bytes, on the Source, the Product, the Offer and the import |
| `row_number` | on the Product provenance and the Offer |
| `source_type` | `SHOPEE_AFFILIATE_EXPORT` or `SHOPEE_AFFILIATE_EXPORT_SYNTHETIC` |

### 12.3 The ranking contract did not change

`buildDataset` was generalised to accept staged rows, but the weights, the normalisation, the tie-break, the confidence formula, the `mvp-score-v1` formula version and the claim classes are **byte-for-byte the same**. The 56/56 fixture acceptance still passes unchanged, which is the evidence for that claim.

### 12.4 Real Shopee export: PENDING

**No real Shopee Affiliate export exists in this workspace.** Nothing was invented in its place. The import path is verified against SYNTHETIC-labelled fixtures only, and the real-file evidence is **not claimed**:

- [real-shopee-export-check.js](../../verification/real-shopee-export-check.js) searches `data/imports/`, `data/mvp/real/`, `$ACE_REAL_SHOPEE_EXPORT` and an explicit path.
- With no file it prints `REAL SHOPEE EXPORT PENDING` and exits **2** (pending — not a pass, not a failure).
- With a file it runs preview → commit → promote and prints the real status codes and bodies.

**Verified:** the parser contract (format, encoding, header mapping, row status) on synthetic files; the staging-only import; duplicate detection; promote; the Source Library; archive; validation and freshness guards.

**Not verified, not claimed:** that a real Shopee export parses with this mapping; the real status/body/exit code of a real-file import; that the detected mapping matches a real export header.

---

## 13. Source Library (added 2026-10-21)

The Research step now opens with a **Source Library** panel.

### 13.1 What it shows

| Item | Source |
|---|---|
| Every imported source | `state.sources` — the export source plus one shop reference source per shop |
| Source details | `source_id`, label, kind, `reference`, provenance method, provenance source, file, limitations and the per-check validation list |
| File hash | `file_hash` (sha256 of the uploaded bytes), shown in full |
| `checked_at` | the import timestamp, plus `data_as_of` and `expires_at` |
| Records created | `record_counts` — products, offers and evidence attributable to the source |
| Link to Candidate | `linked_candidates` — id, rank, title, status and ranking score; clicking one filters the Candidate workspace |
| Link to Research Report | the same `source_id` appears in `GET /api/mvp/research-report` with its evidence ids |
| Synthetic vs real | a `SYNTHETIC` badge for a fixture upload, a `USER FILE` badge for a user-supplied export; the sidebar chip and the Research header repeat it |

### 13.2 Guards

| Guard | Result |
|---|---|
| Archived source | `POST /api/mvp/sources/:id/archive` sets `status: ARCHIVED`. **Every evidence record and every existing candidate is kept.** New candidate generation is refused with `409` and `blocked_sources` until the source is active again. |
| Failed validation | `validateSourceRecord` checks existence, `checked_at`, provenance, the synthetic flag, evidence resolution, the file hash and the offer linkage. If any check fails, generation is refused with `409` and `blocked_sources`. |
| Expired data | A source older than 30 days is `EXPIRED`; 14–30 days is `AGING`. Expiry produces a warning in `freshness_warnings` and in the panel, and blocks generation with `409` until the request carries `acknowledgeExpired: true` — the user must confirm they accept the stale data. |
| Freshness | `data_as_of` is the end of the confirmed date range, so the age follows the export's own period rather than the file's modification time. |

### 13.3 Staging vs Research

`GET /api/mvp/staging` lists what is waiting. A staged import is not a source yet: it has no `source_id` in the Research state and cannot produce a candidate until it is promoted. The Source Library therefore only ever shows sources that Research is actually using.

---

## 14. Verification (import + Source Library)

| Check | Result |
|---|---|
| [import-source-acceptance.js](../../verification/import-source-acceptance.js) | **81/81 assertions passed**, exit 0 — [log](../../verification/import-source-acceptance-2026-10-21.log) |
| [mvp-workflow-acceptance.js](../../verification/mvp-workflow-acceptance.js) (unchanged baseline) | **56/56 assertions passed**, exit 0 |
| [mvp-server-isolation-audit.js](../../verification/mvp-server-isolation-audit.js) | all checks passed, including the new import/source isolation section — [log](../../verification/mvp-server-isolation-2026-10-21.log) |
| [real-shopee-export-check.js](../../verification/real-shopee-export-check.js) | **REAL SHOPEE EXPORT PENDING**, exit 2 — [log](../../verification/real-shopee-export-pending-2026-10-21.log) |
| Foundation regression | 19/19 passed |
| CWI contract enforcement | all passed |
| CWI endpoint acceptance | 20 cases, 0 failures |
| Real `data/app/state.json` | byte-identical (`5d29cdbdace0a73580bc2e0633f2e8cb`) |
| Commits created / files staged | 0 / none |

The synthetic upload fixtures live in [app/mvp/fixtures/](../../app/mvp/fixtures) and are generated by [make-synthetic-import-fixtures.js](../../verification/make-synthetic-import-fixtures.js). They are labelled `SYNTHETIC` in the filename, in the CSV comment header and in the JSON payload.
