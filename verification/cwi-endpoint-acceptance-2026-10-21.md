# CWI endpoint — final verification run

Run at 2026-10-21T09:32:19.997Z · runner exit code 0 · cases 20 · checks 6 · failures 0

| Check | Command/Test | Exit code | Actual result | Pass/Fail |
|---|---|---|---|---|
| Contract file exists and parses as JSON | `node -e "JSON.parse(fs.readFileSync('docs/mission1/schemas/content-work-item.schema.json'))"` | 0 | parsed OK, md5=dc27941bf7c3ff03e52f67dc91b8b1ce | PASS |
| Real data/app/state.json is byte-identical after the run | `md5sum data/app/state.json  (before vs after)` | 0 | 5d29cdbdace0a73580bc2e0633f2e8cb -> 5d29cdbdace0a73580bc2e0633f2e8cb | PASS |
| Real state file still holds no CWI or plan records | `node -e "read data/app/state.json, list keys"` | 0 | keys: schemaVersion, cycle, selectedOpportunityId, lastDecisionAt, decisions (no cwis, no planVersions) | PASS |
| No commit was created (HEAD unchanged) | `git rev-parse HEAD  (before vs after)` | 0 | 9749f38e7bdb1ec6ee56be0e2227473c3b973f2b -> 9749f38e7bdb1ec6ee56be0e2227473c3b973f2b  (9749f38 Record Owner approval of Measurement Formula in Doc G §2b) | PASS |
| Working tree entry count unchanged (nothing added or removed) | `git status --short \| wc -l  (before vs after)` | 0 | 27 -> 27 | PASS |
| Only the temporary copy was written | `server started in temp dir, repo files not mounted` | 0 | temp dir C:\Users\bomb_\AppData\Local\Temp\ace-cwi-verify-U9BCoi; real state has no cwis/planVersions while the temp copy holds 4 CWI record(s) | PASS |
| PRODUCT + valid product_id -> 201, both fields returned | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 201 — `{"id":"CWI-1","plan_id":"PLAN-1-1","plan_version":"v1","decision":"PENDING","createdAt":"2026-10-21T09:32:14.106Z","type":"PRODUCT","product_id":"P-1001"}` | PASS |
| PRODUCT + product_id missing -> 400 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"product_id is required for type PRODUCT"}` | PASS |
| PRODUCT + product_id null -> 400 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"product_id must be a string for type PRODUCT"}` | PASS |
| PRODUCT + numeric product_id -> 400 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"product_id must be a string or null; product_id must be a string for type PRODUCT"}` | PASS |
| PRODUCT + blank product_id -> 400 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"product_id must not be empty; product_id must not be empty for type PRODUCT"}` | PASS |
| REVIEW + valid product_id -> 201, both fields returned | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 201 — `{"id":"CWI-2","plan_id":"PLAN-1-1","plan_version":"v1","decision":"PENDING","createdAt":"2026-10-21T09:32:14.168Z","type":"REVIEW","product_id":"P-2002"}` | PASS |
| REVIEW + product_id missing -> 400 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"product_id is required for type REVIEW"}` | PASS |
| REVIEW + product_id null -> 400 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"product_id must be a string for type REVIEW"}` | PASS |
| METHOD + no product_id -> 201 (nullable base applies) | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 201 — `{"id":"CWI-3","plan_id":"PLAN-1-1","plan_version":"v1","decision":"PENDING","createdAt":"2026-10-21T09:32:14.200Z","type":"METHOD"}` | PASS |
| WORKFLOW + product_id null -> 201 (nullable base applies) | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 201 — `{"id":"CWI-4","plan_id":"PLAN-1-1","plan_version":"v1","decision":"PENDING","createdAt":"2026-10-21T09:32:14.216Z","type":"WORKFLOW","product_id":null}` | PASS |
| GET the created CWI -> type and product_id persisted | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 200 — `{"id":"CWI-1","plan_id":"PLAN-1-1","plan_version":"v1","decision":"PENDING","createdAt":"2026-10-21T09:32:14.106Z","type":"PRODUCT","product_id":"P-1001"}` | PASS |
| temporary state file stores type and product_id | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP n/a (file read) — `{"id":"CWI-1","plan_id":"PLAN-1-1","plan_version":"v1","decision":"PENDING","createdAt":"2026-10-21T09:32:14.106Z","type":"PRODUCT","product_id":"P-1001"}` | PASS |
| unknown type -> 400 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"type must be one of PRODUCT, REVIEW, METHOD, WORKFLOW"}` | PASS |
| missing type -> 400 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"type is required"}` | PASS |
| unknown field -> 400 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"prodcut_id is not a recognised field"}` | PASS |
| malformed JSON -> 400 "Body must be valid JSON" | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"Body must be valid JSON"}` | PASS |
| array body -> 400 "Body must be a JSON object" | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"Body must be a JSON object"}` | PASS |
| missing plan_id -> 400 "plan_id is required" | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"plan_id is required"}` | PASS |
| missing plan_version -> 400 "plan_version is required" | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 400 — `{"error":"plan_version is required"}` | PASS |
| unknown plan version -> 404 | `node verification/verify-cwi-endpoint.js` (HTTP case) | 0 | HTTP 404 — `{"error":"plan_id/plan_version not found: PLAN-9-9/v1"}` | PASS |
| schema validation | `node docs/mission1/schemas/validate-content-work-item.js` | 0 | 11/11 behavioural cases passed \| all checks passed | PASS |
| claim-class validation | `node verification/validate-claim-classes.js` | 0 | PASS  evidence-log entries were not re-classified — entries: 10 \| all claim-class checks passed | PASS |
| CWI contract enforcement | `node verification/cwi-contract-enforcement.js` | 0 | PASS  real data/app/state.json unchanged — md5 5d29cdbdace0a73580bc2e0633f2e8cb -> 5d29cdbdace0a73580bc2e0633f2e8cb \| all CWI contract-enforcement checks passed | PASS |

Exit code per row is the exit code the runner returns for that row (0 = assertion held, 1 = assertion failed);
the overall runner exit code is the last line above.
