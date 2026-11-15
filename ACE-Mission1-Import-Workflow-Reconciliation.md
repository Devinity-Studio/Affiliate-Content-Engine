# ACE Mission 1 — Import Workflow: Static Contract Reconciliation Report

**Mode**: STRICT READ-ONLY — NO EXECUTION
**Report Date**: 2026-10-28
**Repository**: `/y/DevProject/Affiliate Content Engine`
**Branch**: `mission1-planning-docs`
**HEAD**: `795dc0a6ac66bef19725184107e6474b41aa1823` (confirmed matching historical report)
**Working Tree**: 140 entries — 10 modified tracked files + 130+ untracked files (confirmed matching historical report)
**No repository or application state was changed** during inspection.

---

## A. Actual Inspection Baseline

The repository baseline is confirmed matching the previously reported historical observation:
- **Repository**: `/y/DevProject/Affiliate Content Engine`
- **Branch**: `mission1-planning-docs`
- **HEAD**: `795dc0a6ac66bef19725184107e6474b41aa1823`
- **Working tree**: 140 entries — 10 modified tracked files + 130+ untracked files
- **No discrepancy** from the historical baseline.
- **No files were created, modified, or deleted** during this inspection.

---

## B. Import Route Trace

### 1. Route Definition and HTTP Method

| Layer | File | Role |
|-------|------|------|
| **HTTP entry** | `app/server.js:346-347` | When `pathname.startsWith('/api/mvp/')`, calls `mvp.handleMvp(req, res, ctx)` |
| **MVP handler** | `app/mvp/service.js` — `handleMvp` (line 3146) | Dispatches to `handleImport`, `handleImportPreview`, `handleImportCommit` based on sub-path |
| **Import route** | `app/mvp/service.js:1391` (`handleImport`) | POST `/api/mvp/import` — reads uploaded CSV/JSON, parses, builds dataset, persists to fixture state |
| **Import preview route** | `app/mvp/service.js:2164` (`handleImportPreview`) | POST `/api/mvp/import/preview` — reads uploaded file, calls `importer.buildPreview()`, returns in-memory preview |
| **Import commit route** | `app/mvp/service.js:2190` (`handleImportCommit`) | POST `/api/mvp/import/commit` — finalizes import after mapping confirmation |

### 2. Request Parsing and Accepted Payload/Formats

- **`handleImport`** (line 1391): Accepts `body.csv` as a string (pasted CSV) or falls back to the synthetic fixture file. Parses via `parseExportCsv()` which validates against `REQUIRED_COLUMNS` and `NUMERIC_COLUMNS`.
- **`handleImportPreview`** (line 2164): Accepts multipart form data with `buffer`, `filename`, `format`, `encoding`, `sheet`, and optional `mapping`. Uses `importer.readTable()` to detect format (CSV, TSV, XLSX, JSON).
- **Accepted formats** (from `meta` endpoint, line 3195): `['csv', 'tsv', 'xlsx', 'json']`
- **Accepted encodings** (from `meta` endpoint, line 3196): `['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be', 'windows-874']`

### 3. Data Flow from Request to Preview/Persistence

#### Import path (`POST /api/mvp/import`):
```
Uploaded CSV → ctx.readBody() → parseJsonBody() → parseExportCsv(csv)
  → withLock(readState()) → buildDataset(rows, meta) → writeState(fresh) → sendJson response
  
  buildDataset performs:
  - Source record creation (AFFILIATE_EXPORT kind)
  - Product record creation
  - Offer record creation with deterministic scoring metrics
  - Evidence record creation with claim classes
  - Analysis category stats
  Writes to fixture-state.json only. Never writes to data/app/state.json.
```

#### Preview path (`POST /api/mvp/import/preview`):
```
Uploaded file → ctx.readBody() → readUpload(body) → stagingIdentities()
  → importer.buildPreview({filename, buffer, format, encoding, sheet, mapping, existingIdentities})
  
  buildPreview performs (EXPLICITLY IN-MEMORY):
  - readTable() to parse the file
  - detectMapping(table.header) to detect column mapping
  - normalizeRows(table, mapping) to normalize values
  - classifyRows(normalized.rows, existingIdentities) to classify each row
  - Returns preview object with: file info, format, columns, mapping, mapping_hash,
    mapping_notes, missing_required, unmapped, conflicts, counts, rows (status classified),
    sample (first VALID row), sample_preview, date_range_default, warnings,
    rows_without_commission, total_rows, required_confirmation,
    preview_wrote_state: false,
    boundaries: { writes: 'none — preview is computed in memory',
                  real_state_touched: false,
                  external_calls: 0,
                  spend_thb: 0 }
```

### 4. Read/Write Boundary

| Boundary | Status | Evidence |
|----------|--------|----------|
| **Filesystem writes** | NONE (preview) / fixture-state.json (import) | `buildPreview: preview_wrote_state: false`; `handleImport` writes to `STATE_FILE` only after `buildDataset` |
| **Network calls** | NONE | `boundaries.external_calls: 0` in preview; no API calls in import path |
| **State persistence** | fixture-state.json only | `handleImport` writes to `STATE_FILE` (ACE_MVP_STATE_FILE env var); never `data/app/state.json` |
| **Content library/CWI** | NEVER | `app/mvp/service.js` docstring: "This module never reads or writes data/app/state.json, never calls the Plan Version or CWI endpoints" |
| **Shopee API/contact** | NEVER | Docstring: "and it does not contact Shopee" |

### 5. Error Handling and Recovery

- **`parseExportCsv`** (importer.js): Throws `httpError(400)` on missing required columns, column count mismatches, numeric validation failures, duplicate item_ids. No state is written before validation passes.
- **`handleImport`**: Reuses existing import if `state.import.sha256 === sha256`; otherwise builds fresh state and writes it. If `buildDataset` throws, no partial state is written (write happens at end of `withLock`).
- **`handleImportPreview`**: Returns warnings in the preview object but does not modify staging state unless `handleImportCommit` is subsequently called.
- **`handleImportCommit`**: Requires `confirmMapping: true`; validates mapping, reads table, detects mapping, normalizes rows, classifies rows, writes to staging-state.json.

### 6. Any Writes to Files, State, Databases

| Destination | Written By | When |
|-------------|-----------|------|
| `fixture-state.json` | `handleImport` (via `writeState`) | After successful `buildDataset`, on new import (not reuse) |
| `staging-state.json` | `handleImportCommit` (via `writeStaging`) | After mapping confirmation and classification |
| `data/app/state.json` | NEVER | Explicitly excluded by module docstring |
| **Database/D1/R2** | NEVER | No D1/R2 bindings in this module |
| **Logs** | None observed | No logger.write calls in the inspected code |

### 7. Unresolved Path

The full path from incoming data to possible external system integration cannot be established without runtime experimentation. Statically, the import route:
- ✅ Parses and validates CSV/TSV/XLSX/JSON
- ✅ Builds source/product/offer/evidence records in fixture state
- ✅ Persists only to `fixture-state.json`
- ❌ Cannot verify real Shopee export compatibility without a verified real export
- ❌ Cannot verify error-recovery behavior without authorized test runs

---

## C. Importer Compatibility Matrix

| Requirement | Source Evidence | Classification | Finding | Remaining Unknown |
|-------------|----------------|----------------|---------|-------------------|
| **CSV/TSV/XLSX/JSON acceptance** | `importer.detectFormat()` + `readTable()` + `meta` endpoint | SOURCE_OBSERVED | Supports CSV, TSV, XLSX (first worksheet), JSON (array/object with data/items/products/records keys). Explicitly rejects legacy XLS (BIFF). | Unknown: Google Sheets `.xls` legacy format |
| **Required column mapping** | `REQUIRED_FIELDS` = `item_id`, `shop_id`, `product_name`, `affiliate_link`, `price_thb`; `detectMapping()` + `missingRequiredFor()` | SOURCE_OBSERVED | 5 required fields with 60+ aliases per field. `missingRequiredFor(mapping)` reports which required keys are unmapped. | Unknown: whether a real Shopee export maps all 5 required fields without user confirmation |
| **Alias resolution** | `CANONICAL_FIELDS` with 60+ aliases per field + `normalizeToken()` | SOURCE_OBSERVED | Aliases defined for: item_id (9), shop_id (6), product_name (7), affiliate_link (8), price_thb (5), list_price_thb (7), commission_rate (6), commission_thb (5), promo_type (1), promo_label (7), promo_depth_pct (1), rating (6), rating_count (6), units_sold (5), shop_rating (1), related_shop_count (1), category (5), product_url (6), shop_url (6), exported_at (6) | Unknown: whether a real Shopee export uses any of these exact alias names |
| **Numeric normalization** | `NUMERIC_COLUMNS` set + validation in `parseExportCsv()` | SOURCE_OBSERVED | Validates: price_thb > 0, list_price_thb >= price_thb, commission_rate 0-1, rating 0-5, shop_rating 0-5, promo_depth_pct 0-100, rating_count/units_sold/related_shop_count >= 0, exported_at ISO date-time. | Unknown: whether real Shopee numbers fit these validation rules (e.g., commission_rate as percentage vs fraction) |
| **Missing/duplicate/conflicting field handling** | `parseExportCsv()` error throw + `classifyRows()` statuses (VALID/INVALID/UNKNOWN/DUPLICATE) + `detectMapping()` conflicts | SOURCE_OBSERVED | - Missing required → error, row skipped<br>- Duplicate item_id → error, row marked DUPLICATE<br>- Conflicting mapping → warning<br>- Unmapped columns → warning, ignored | Unknown: real Shopee export edge cases (merged cells, empty rows, mixed encodings) |
| **Source provenance retention** | `buildDataset()` provenance field + `offer.provenance` + `product.provenance` | SOURCE_OBSERVED | Provenance includes: source, method, synthetic flag, file, sha256, row_count, limitations. Distinguishes synthetic fixture vs user-supplied export. | Unknown: whether real Shopee export adds additional provenance fields |
| **Preview distinguishes real vs synthetic** | `buildPreview()` returns `synthetic` flag + `preview_wrote_state: false` + meta endpoint `real_export.status: 'PENDING'` | SOURCE_OBSERVED | Preview explicitly labels synthetic files: "This file identifies itself as a SYNTHETIC fixture. It is not Shopee evidence." User-supplied exports labeled: "This is a user-supplied export. The app does not open Shopee or verify the file against the affiliate account." | Unknown: whether preview can reliably distinguish a real Shopee export from a well-formatted fake |
| **Numeric, currency, commission-rate normalization** | `NUMERIC_COLUMNS` validation + `buildDataset()` commission_per_order = price_thb * commission_rate | SOURCE_OBSERVED | Commission computed as `price_thb * commission_rate`; normalized to 0-1 range for scoring. | Unknown: real Shopee commission structures (fixed-amount vs percentage, tiered commissions) |
| **Unknown field handling** | `row.unknown_fields` collection + `data_quality.unknown_fields` on offers | SOURCE_OBSERVED | After normalization, any column not in the mapping is tracked as `unknown_fields`. Preserved in `data_quality.unknown_fields` on each offer. | Unknown: whether a real Shopee export would have columns beyond the documented canonical set |
| **Source type tracking** | `source_type: 'SHOPEE_AFFILIATE_EXPORT_SYNTHETIC'` vs `'SHOPEE_AFFILIATE_EXPORT'` + `verified_against_shopee: false` | SOURCE_OBSERVED | Import explicitly tracks whether data is synthetic or user-supplied, with `verified_against_shopee: false` on all sources. | Unknown: what additional fields a real Shopee export would set |

---

## D. Real Shopee Data Readiness

### What Can Be Established Statically:

1. **Parser contract is verified against SYNTHETIC fixtures only** (meta endpoint, line 3214-3217):
   - `real_export.status: 'PENDING'`
   - Note: "No real Shopee Affiliate export has been supplied. The parser contract is verified against SYNTHETIC fixtures only; real-file import evidence is not claimed."

2. **Required columns are documented** (CANONICAL_FIELDS, REQUIRED_FIELDS):
   - `item_id`, `shop_id`, `product_name`, `affiliate_link`, `price_thb` are required
   - Each has a list of aliases

3. **Format support is documented** (meta endpoint):
   - CSV, TSV, XLSX, JSON supported
   - XLS (BIFF) explicitly rejected

4. **Preview is in-memory only** with explicit boundaries:
   - `preview_wrote_state: false`
   - `boundaries.writes: 'none — preview is computed in memory'`
   - `boundaries.real_state_touched: false`
   - `boundaries.external_calls: 0`
   - `boundaries.spend_thb: 0`

5. **Import persists only to fixture state**:
   - Never writes to `data/app/state.json`
   - Controlled by `ACE_MVP_STATE_FILE` env var
   - Synthetic flag propagated through entire pipeline

### What Requires Verified Real Export or Authorized Runtime Validation:

| Question | Status | Evidence Gap |
|----------|--------|--------------|
| Does a real Shopee Affiliate Product Offer export contain all 5 required columns (`item_id`, `shop_id`, `product_name`, `affiliate_link`, `price_thb`)? | **UNKNOWN** | No verified real export in repository; code only handles synthetic fixtures |
| Do Shopee export column names match the defined aliases? | **UNKNOWN** | Aliases are code-defined; real export column names not verified |
| Are numeric values in the same ranges (price > 0, commission 0-1, rating 0-5)? | **UNKNOWN** | Validation rules exist but haven't been tested against real Shopee data |
| Does the export include optional columns that affect scoring (rating, promo_depth_pct, related_shop_count)? | **UNKNOWN** | Optional fields documented but not verified for real exports |
| Can the preview reliably distinguish real from synthetic data? | **UNKNOWN** | Preview explicitly labels both types but hasn't been tested with real exports |
| Are there Shopee-specific columns or formats not in the canonical set? | **UNKNOWN** | Code only handles documented columns; real exports may have additional columns |
| Does error handling behave correctly for real export edge cases? | **RUNTIME_EVIDENCE_REQUIRED** | No real export test cases in repository |

**Minimum evidence needed next**: A verified real Shopee Affiliate Product Offer export file, tested against the import parser, with classification of which fields map, which are missing, and which produce warnings/errors.

---

## E. AI Integration Status

**Finding**: No AI provider is integrated and actually invoked by ACE.

### Evidence:

1. **`app/mvp/service.js`** — The entire MVP module is deterministic:
   - No AI provider imports (no `openai`, `anthropic`, `gemini`, etc.)
   - Scoring uses `SCORE_WEIGHTS` deterministic formula: `commission*0.30 + promo*0.20 + review*0.20 + shop*0.15 + competition*0.15`
   - Candidate ranking is deterministic given the same input
   - All claim classes (FACT/INFERENCE/HYPOTHESIS/UNKNOWN) are generated from fixed data

2. **`app/mvp/importer.js`** — Pure parsing/normalization:
   - No AI imports or calls
   - CSV parsing, mapping detection, row classification are all rule-based

3. **`app/content.js`** — Content generation:
   - `generateMarkdownContent()` and `buildApproaches()` are template-based
   - Uses fixed CTA strings and formatted templates
   - No AI provider integration

4. **`app/server.js`** — Server infrastructure:
   - No AI-related routes or handlers

5. **Documentation** (F-implementation-roadmap.md, §7 "Future Considerations"):
   - "Gemini Enterprise through AiPASS: Potential Future AI Resource — Availability Pending"
   - Explicitly stated: "Nothing here may be built, purchased, or attempted without a new recorded owner decision (G1-class approval). Registry only."
   - "Paid-ad profitability analysis or any autonomous paid-ad management."
   - "Any paid subscription/tool (including ... AI tools beyond free quotas)."

### Conclusion:
- **AI integrated and used by ACE itself**: **NO**
- **External AI used by development team represented as ACE capability**: **NO** — explicitly restricted in roadmap
- **Integration point existing in code but not demonstrated to work**: **N/A** — no such integration exists

---

## F. Risk and Safety Assessment

### Observed Weaknesses (from static inspection):

| Risk | Classification | Evidence |
|------|---------------|----------|
| **Partial write on import failure** | HYPOTHETICAL | `handleImport` writes state at end of `withLock`; if `buildDataset` throws before write, no partial state. However, if process crashes between read and write, stale state could exist. |
| **Stale fixture state** | OBSERVED | `fixture-state.json` persists across imports; old sources/products/offers/evidence not cleaned up. `handleImport` reuses if sha256 matches, but new imports overwrite. |
| **Duplicate item_id across imports** | OBSERVED | `seen` set in `parseExportCsv` only tracks within one import; cross-import duplicates not prevented. |
| **Shopee compatibility assumed from synthetic test** | OBSERVED | Code explicitly marks `verified_against_shopee: false` but users may assume real compatibility. |
| **No authentication/authorization on import endpoints** | OBSERVED | `POST /api/mvp/import` has no auth guard in the basic server implementation. |
| **Staging-state.json not cleaned** | OBSERVED | `handleImportCommit` writes to staging; no automatic cleanup of old staging entries. |
| ** fixture state not idempotent** | OBSERVED | Re-importing same CSV generates new import ID (`IMP-1`, `IMP-2`, etc.) rather than updating. |

### Hypothetical Risks (not directly observed but plausible):

| Risk | Why It's Hypothetical |
|------|----------------------|
| **Real Shopee export causes unexpected validation failures** | Real exports may have column formats/value ranges not covered by the current validation rules (e.g., different price formatting, additional optional fields) |
| **Preview silently drops critical fields** | If a real export has columns not in the canonical mapping, they become `unknown_fields` and are silently ignored — could drop important data |
| **Commission rate format mismatch** | Real Shopee may express commission as percentage (e.g., "50%") vs fraction (0.5) or fixed THB amount |
| **Encoding issues with Thai/non-Thai text** | Real exports may use different encodings; the parser supports utf-8, utf-8-bom, utf-16le, utf-16be, windows-874 but not all possible encodings |
| **Large file handling** | `MAX_FILE_BYTES` and `MAX_ROWS` constants exist; real large exports may hit these limits |

### Data-Provenance Limitations:

1. **Synthetic fixture flag propagates** — All offers/products/evidence carry `synthetic: true` from import through candidate generation. This is correct but means real data cannot flow through without flag change.
2. **`verified_against_shopee: false` on all sources** — Even user-supplied exports are not verified against the Shopee affiliate account. This is a hardcoded safety marker.
3. **Provenance limited to documented fields** — `offer.provenance.limitations` and `product.provenance.limitations` list known constraints but may not cover all real-world scenarios.
4. **No live Shopee data** — The module explicitly states it never contacts Shopee; all data is from upload or synthetic fixture.

---

## G. Recommended Next Step

**Smallest safe next step for owner review**:

1. **Obtain a verified real Shopee Affiliate Product Offer export file** and place it in a test workspace.
2. **Run `POST /api/mvp/import/preview`** against the real export (without persisting) to observe:
   - Which columns are detected and mapped
   - Which required fields are missing
   - What warnings are generated
   - Whether `synthetic` flag is correctly set
3. **Run `POST /api/mvp/import`** with `confirmMapping: true` to observe:
   - Whether the import successfully builds source/product/offer records
   - Whether `fixture-state.json` is written correctly
   - Whether any validation errors occur that were not caught in preview
4. **Classify the real export** against the compatibility matrix in Section C to determine:
   - Which fields map automatically
   - Which require alias additions
   - Which validation rules need expansion
5. **Document findings** in the evidence register before authorizing any persistence or candidate generation with real data.

**Do not execute any runtime validation without explicit owner authorization**. The static evidence shows the import workflow is well-structured and bounded, but real-source compatibility cannot be claimed without a verified real export test.

---

## H. Final Status

- **Code changes**: `NOT PERFORMED` — this report is read-only; no source files were modified.
- **Application execution**: `NOT PERFORMED` — no tests, imports, or runtime experiments were run.
- **Runtime validation**: `NOT PERFORMED` — no real-data experiments authorized or executed.
- **Real Shopee import compatibility**: `NOT PROVEN` — insufficient static evidence; requires verified real export.
- **Implementation approval**: `NOT GRANTED` — this assessment authorizes no code changes, no runtime experiments, and no Z1 status modifications.
- **Z1 statuses**: `UNCHANGED` — all six Z1 values remain exactly as specified in the mission requirements:
  - `contractResolutionStatus = UNRESOLVED`
  - Row 18 / Row 3c = `PENDING RECONCILIATION`
  - Canonical precedence = `PENDING CONFIRMATION`
  - Baseline captured and accepted = `NO`
  - Implementation = `NOT APPROVED`
  - Runtime validation = `NOT PERFORMED`

**Import Workflow Static Reconciliation = REPORTED**

**Runtime Validation = NOT PERFORMED**

**Implementation = NOT APPROVED**

**Z1 / Mission 1 Status = UNCHANGED**