# Real Shopee Export — Readiness Record

**Date:** 2026-10-21
**Scope:** verification tooling only. **No application code was changed in this round**, no gate decision, no publication, no spend, no commit.
**Verdict:** the import pipeline is **rehearsed against generated export shapes** and the real-file checker is **hardened and guard-railed**, so that the moment a real file is supplied the report is precise and cannot over-claim. **Real Shopee Import is still NOT verified** — no real Shopee Affiliate export exists in this workspace, so every number below was measured against machine-generated files.

> All numbers come from recorded runs, not from design intent. Raw runner output: [real-export-shape-rehearsal-2026-10-21.log](real-export-shape-rehearsal-2026-10-21.log).

---

## 1. What this round did, and why

The real-export evidence cannot be produced without a real file. What *can* be produced now is everything that does not depend on the file's actual content, so that the one remaining unknown is narrow:

| Question | Answerable now? | How |
|---|---|---|
| Does the pipeline handle a header we have not seen before? | **Yes** | alias catalogue + unmapped-column reporting, exercised on generated headers |
| Does the pipeline survive the encodings Thai Shopee exports use? | **Yes** | utf-8 / utf-8-bom / windows-874 exercised on generated files |
| Does it survive `,` and tab delimiters? | **Yes** | exercised |
| How are rows classified, and are bad rows visible? | **Yes** | valid / invalid / duplicate / unknown counts measured |
| Will a real file be mis-labelled as a fixture, or a fixture be sold as real? | **Yes** — guarded | synthetic guard + fixture-hash guard + rehearsal-marker guard |
| **Does a real Shopee export import?** | **NO — not answerable** | needs the real file |

---

## 2. Commands and results

| Command | Exit | Result |
|---|---|---|
| `node verification/real-export-shape-rehearsal.js` | **0** | **80 / 80 rehearsal expectations met** |
| `node verification/real-shopee-export-check.js` (no file) | **2** | `REAL SHOPEE EXPORT PENDING` — neither a pass nor a failure |
| `node verification/real-shopee-export-check.js app/mvp/fixtures/synthetic-shopee-export.csv` | **1** | refused: *repository fixture, not real-export evidence* |
| `node verification/real-shopee-export-check.js .tmp/real-export-rehearsal/shopee-export-shape-en.csv` | **1** | refused: *scratch file, not a supplied export* |
| `node verification/real-shopee-export-check.js /tmp/shopee-export-shape-en.csv` (copy outside the repo) | **1** | refused: *file carries the rehearsal marker* |

The rehearsal runs against a throwaway copy of the app: `app/`, `data/` and `docs/` are copied to a temp directory, the server is started there with `ACE_MVP_STATE_FILE` / `ACE_MVP_STAGING_FILE` pointing inside the temp directory, and the real `data/app/state.json` is never mounted. Its sha256 is identical before and after the run ([log L116](real-export-shape-rehearsal-2026-10-21.log#L116)).

---

## 3. What the rehearsal actually measured

The rehearsal generates files that imitate export **shapes** and runs them through the **real, non-synthetic** code path (`preview → commit → promote`). The files are deliberately not labelled synthetic, so the app treats them exactly as it will treat a user-supplied export.

| Case | Measured | Log |
|---|---|---|
| 1 · preview writes nothing | preview `200`; staging file not created; `preview_wrote_state: false` | [L13-L18](real-export-shape-rehearsal-2026-10-21.log#L13-L18) |
| 2 · header + alias | 19 canonical fields mapped from Shopee-shaped headers (`Item ID → item_id`, `Original Price → list_price_thb`, `Sales → units_sold`, `Related Shops → related_shop_count`, …); unmapped columns reported (`Seller Type`, `Campaign`), not silently dropped; no column mapped twice | [L19-L44](real-export-shape-rehearsal-2026-10-21.log#L19-L44) |
| 3 · encoding + delimiter | `csv`/`utf-8`/`,`; a UTF-8 BOM is detected as `utf-8-bom`; a windows-874 Thai file is detected as `windows-874` and its Thai headers map to the right fields; a tab-separated file is detected as `tsv` + `TAB` | [L45-L64](real-export-shape-rehearsal-2026-10-21.log#L45-L64) |
| 4 · row classification | 12 rows → **8 valid / 1 duplicate / 2 invalid / 1 unknown**; a row with missing optional metrics stays valid and *lists* the unknown fields; a row without any commission column is `UNKNOWN`, not silently accepted; a price of `n/a` is `INVALID` | [L65-L79](real-export-shape-rehearsal-2026-10-21.log#L65-L79) |
| 5 · required column missing from the file | preview names the missing column (`shop_id`); commit refuses with `400` and the same name | [L80-L85](real-export-shape-rehearsal-2026-10-21.log#L80-L85) |
| 6 · over the row limit | 520 rows → `413` *"this slice imports at most 500"* | [L86-L90](real-export-shape-rehearsal-2026-10-21.log#L86-L90) |
| 7 · commit + promote on the user-supplied path | commit `201`; `synthetic: false`; `source_type: SHOPEE_AFFILIATE_EXPORT`; 8 valid rows imported, 8 offers built; promote `201` with 5 candidates; research state `synthetic: false`, `data_mode: STAGED_IMPORT`; the source provenance is `USER_SUPPLIED_SHOPEE_AFFILIATE_EXPORT` and the source label is *"User-supplied Shopee Affiliate export: …"*, never *"SYNTHETIC"* | [L91-L108](real-export-shape-rehearsal-2026-10-21.log#L91-L108) |
| 8 · the same file twice | second import writes nothing (`200`, `duplicate_import: true`, points at the existing staged record) | [L109-L113](real-export-shape-rehearsal-2026-10-21.log#L109-L113) |
| 9 · isolation | real `data/app/state.json` byte-identical; rehearsal state stayed in the temp workspace | [L114-L118](real-export-shape-rehearsal-2026-10-21.log#L114-L118) |

**80 / 80** expectations met ([log L120](real-export-shape-rehearsal-2026-10-21.log#L120)).

---

## 4. The real-file checker is now guard-railed

[verification/real-shopee-export-check.js](real-shopee-export-check.js) is the tool that will produce the real evidence. It was rewritten this round so that its report answers the four real-file questions directly — **header, alias, encoding, row count** — and so that it cannot report a false success:

| Guard | Behaviour | Why |
|---|---|---|
| G1 · scratch file | a file under `.tmp/` is refused (exit 1) | scratch artefacts are not supplied exports |
| G2 · repository fixture | a file whose sha256 matches anything in `app/mvp/fixtures/` is refused (exit 1) | a fixture is not real-export evidence, whatever it is named |
| G3 · rehearsal marker | a file containing `REHEARSAL FILE` is refused (exit 1) | the rehearsal artefacts of this round can never be cited as a real import |
| G4 · synthetic self-identification | if the app reports the file as a synthetic fixture, the run stops with `FILE_IS_SYNTHETIC` (exit 1) | the importer's own sniff is the authority on fixture labels |
| G5 · staging label | if the staged record comes back marked synthetic, the run stops with `STAGED_AS_SYNTHETIC` (exit 1) | a fixture must not reach the "verified" line |

The report is now ordered: file identity → synthetic guard → **header and alias mapping** (every column, what it mapped to, what was unmapped, conflicts) → **format / encoding / delimiter** → **row counts** (valid / invalid / duplicate / unknown, rows without commission, suggested date range, per-row reasons) → commit → promote → the resulting source record and its freshness.

Two further corrections were folded in:

- **Promotion is no longer all-or-nothing.** If the source is older than the 30-day freshness window, the checker retries once with `acknowledgeExpired: true` and says so. If promotion still cannot complete (for example fewer than 5 valid rows), the run ends as `STAGED_BUT_NOT_PROMOTED` with **exit 3** — a *partial* result that says the import contract worked and the downstream step did not, instead of a blanket failure.
- **A confirmed mapping can be supplied.** `ACE_REAL_MAPPING_FILE` points at a JSON file `{field: columnIndex}` for the case where the real header does not match the alias catalogue and a human has to correct the mapping.

Exit codes: `0` verified · `1` failed · `2` pending · `3` partial (staged, not promoted).

---

## 5. What is NOT verified and NOT claimed

- **Real Shopee Import is NOT verified.** No real Shopee Affiliate export exists in this workspace. The real-file check remains `PENDING` (exit 2) — see [real-shopee-export-pending-2026-10-21.log](real-shopee-export-pending-2026-10-21.log). The rehearsal is **not** a substitute: it proves the pipeline handles *shapes*, never that Shopee's actual header, column names and value formats are covered.
- **The column alias catalogue is still a hypothesis.** It was exercised only against headers this round invented. A real file may use names that are not in the catalogue; the preview will list them as unmapped, and a human must confirm the mapping.
- **No Shopee account, API, or market truth** was involved. The app never opens Shopee and never verifies a file against an affiliate account; every source stays `verified_against_shopee: false`.
- **The rehearsal files are not Shopee data.** Their values are invented. They exist only to exercise the parser.
- **The limits surfaced by the rehearsal are real and will bite a real file:** more than **500 data rows** → `413`; more than **3 MB** → `413`; legacy `.xls` → `415`; a row without any commission column → `UNKNOWN` (excluded from the import); a duplicated `item_id|shop_id` → `DUPLICATE` (excluded); fewer than 5 valid rows → no candidates can be generated.
- **Freshness still bites.** A real export older than 30 days is `EXPIRED`; the checker will retry with `acknowledgeExpired: true` and report that it did so.
- **The browser upload path, the acceptance numbers, D5, D9 and `DEF-CWI-1` are unchanged** by this round — see [browser-upload-e2e-acceptance-2026-10-21.md](browser-upload-e2e-acceptance-2026-10-21.md).

---

## 6. How to unblock — the next step

1. Export the file from **Shopee Affiliate** and drop it in `data/imports/` (or anywhere, and pass the path). `data/imports/` is **git-ignored** so a real export, which carries account identifiers, can never be committed by accident.
2. Run `node verification/real-shopee-export-check.js` and read the report. Expected shape: the header block shows what each real column mapped to; the encoding block shows what was detected; the row-count block shows how many rows are usable.
3. If the alias catalogue did not match the real header, write the corrected mapping to a JSON file and re-run with `ACE_REAL_MAPPING_FILE=<path>`.
4. If the file is older than 30 days or has more than 500 rows, that is a product decision, not a test failure — decide before importing.
5. Only then is a real-file claim made, and only for the file that was actually imported (hash, byte count and timestamp are printed).

---

## 7. Files changed by this round

| Path | Change |
|---|---|
| [verification/real-shopee-export-check.js](real-shopee-export-check.js) | rewritten — guard rails G1–G5, header/alias/encoding/row-count report, freshness-aware promotion, exit codes `0/1/2/3` |
| [verification/real-export-shape-rehearsal.js](real-export-shape-rehearsal.js) | new — 80 shape expectations across 9 cases, run against the real (non-synthetic) path |
| [verification/real-export-shape-rehearsal-2026-10-21.log](real-export-shape-rehearsal-2026-10-21.log) | raw run log (80/80) |
| [.gitignore](../.gitignore) | `data/imports/` ignored — a real export must not be committed |
| [verification/real-export-readiness-2026-10-21.md](real-export-readiness-2026-10-21.md) | this record |

**No application file was modified.** Git HEAD is unchanged, nothing is staged, and no commit was made.

---

## 8. Deferred — not done in this round

**D2 · Strip the debug instrumentation from the browser suite.** Still open from the previous round, still deliberate: the debug blocks are the evidence for the UI-side claims in that record. See [browser-upload-e2e-acceptance-2026-10-21.md §8](browser-upload-e2e-acceptance-2026-10-21.md#L129-L138).
