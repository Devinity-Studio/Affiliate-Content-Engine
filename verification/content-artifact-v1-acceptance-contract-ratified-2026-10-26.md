# Content Artifact v1 — Acceptance Contract (R1 Amended) & Ratified Status Ledger

**Date:** 2026-10-26 · **Scope:** Content Artifact v1 (`POST /api/mvp/content/generate` + `GET /api/mvp/content/export/:artifact_id`)
**Authority:** Owner approved the amended R1 contract (2026-10-26) · Peer verification ratified the evidence ledger from the T3.7 report (not re-run by the peer)
**Operating principle (Owner):** "ระบบที่น่าเชื่อถือไม่ใช่ระบบที่ไม่มีวันล้มเหลว แต่เป็นระบบที่รู้ว่าอะไรล้มเหลว รักษาสิ่งที่ควรรักษา และไม่กล่าวอ้างเกินหลักฐานที่มี"

---

## 1. Ratified Status Ledger (Owner + Peer verification, 2026-10-25/26)

| รายการ | สถานะ |
|---|---|
| CA-V1-01 (200 + payload + validation 400/404 + user_custom boundary) | **PASS** |
| CA-V1-02 (artifact persistence, byte-equal) | **PASS** |
| CA-V1-03 (rollback M/W/S + cleanup-failure honesty) | **PASS ตาม R1 ฉบับแก้ไข (§2)** |
| CA-V1-04 (sha256: response / record / on-disk file) | **PASS** |
| CA-V1-05 + D1 (uniqueness, version 1, no overwrite) | **PASS** |
| CA-V1-06 (download 200 / 404 unknown / 403 tamper-guard / traversal 404) | **PASS** |
| CA-V1-08 + D3/D4 (markdown sections, structural determinism, claim-map-in-body) | **PASS** |
| D5 (lifecycle → EXPORTED at generation) | **PASS** |
| Acceptance harness | **77/77, exit 0** (`verification/ace-mission1-acceptance.js` บนไฟล์ final) |
| Regression บนไฟล์ final | content-creation **62/62** · foundation **19/19** · mvp-workflow exit 0 |
| Real state / Git | `data/app/state.json` 117 B / md5 `5d29cdbd…` ไม่เปลี่ยน · `data\mvp` absent · HEAD `9749f38e…` · 29 entries · **0 commit/push** |

**หมายเหตุการตรวจรับ:** การรับรองทั้งหมดอ้างหลักฐานจากรายงาน T3.7 (owner/peer ไม่ได้รันซ้ำ) — คำสั่งรันจริงล่าสุดคือของ GLM ในรอบ T3.6/T3.7 (58→77 checks, exit 0)

## 2. R1 — Orphan Policy (Amended 2026-10-26)

**หลังการดำเนินการที่ล้มเหลว (M/W/S) ของเส้นทาง Content Artifact v1:**

### (ก) Cleanup สำเร็จ
- ห้ามมี orphan file หลงเหลือ
- *พิสูจน์แล้ว:* M (mkdir-blocked → ไม่มีไฟล์), W (write-fail → catch unlink → ไม่มี orphan), S (state-write-fail → rollback unlink artifact ออก → ไม่มี orphan และไม่มี `.tmp` ค้าง)

### (ข) Cleanup ล้มเหลว
- ระบบ**ต้องตรวจพบ**ความล้มเหลวของการลบ และ**รายงาน orphan ที่เหลืออย่างตรงไปตรงต้น**
- หลักฐาน: `details.cleanup = 'failed: INJECTED_UNLINK_FAILURE'` ไหลถึง client payload + server log
- กรณีนี้เป็น**รายงานความล้มเหลวอย่างซื่อสัตย์ — ไม่ใช่ rollback success** และห้ามนับเป็นการรักษา R1 แบบเต็ม

### เงื่อนไขความสมบูรณ์ของสัญญา
- การทดสอบทั้ง (ก) และ (ข) เป็นส่วนหนึ่งของ CA-V1-03 (Test 8 ของ harness)
- ห้ามถือว่า CA-V1-03 ผ่านแบบไม่มีเงื่อนไข หากมีกรณี cleanup ที่ยังไม่ได้ทดสอบ

## 3. R2–R5 (คงเกณฑ์เดิมตาม T3.7)

| ID | Invariant | พิสูจน์แล้วโดย |
|---|---|---|
| R2 | state ไม่ถูก mutate/persist จาก operation ที่ล้มเหลว (artifact record, status, contentOrder, contents) และไม่มี partial mutation | W/S injection: state ไฟล์ byte-identical + parsed assertions |
| R3 | HTTP status + error message ตามสัญญา (500s masked เป็น 'Internal error' ฝั่ง client — รายละเอียดจริงอยู่ใน server log ตามนโยบาย @2981–2987) | ทุก branch + log capture |
| R4 | lifecycle ไม่เปลี่ยนเมื่อบันทึกไม่สำเร็จ | injection assertions |
| R5 | real state / Git / ไม่ commit/push · repo `.tmp` ไม่เปลี่ยน (200 → 200 entries) | integrity checks |

## 4. พฤติกรรมที่พิสูจน์แล้ว (Implementation Map — ตำแหน่งบนไฟล์ final `473cf0d2…a3ede40`)

| พฤติกรรม | ตำแหน่ง | หมายเหตุ |
|---|---|---|
| Plan Key → Content Key mapping | `handleContentGenerate` (boundary) | personalized_a→problem_first · personalized_b→value_compare · exploration→evidence_first (owner-approved semantics) |
| user_custom ไม่มี custom → 400 | `throw httpError(400, 'the user_custom approach needs a custom description first')` | ไม่มี fabrication |
| Two-phase write + rollback (Branch W) | mkdir → writeFile (try/catch → unlink + specific 500) | state assignments ทั้งหมดอยู่หลัง try |
| State-persist rollback (Branch S — เพิ่มโดย R1 ฉบับแก้ไข) | `try { await writeState(state) } catch → unlink + httpError(500, 'failed to persist artifact state', { cleanup })` | cleanup-failure รายงานตรงไปตรงต้น |
| Download dispatch (regex + req.params) | `artifactExportMatch` + `decodeURIComponent` (URIError → 400 'invalid artifact id encoding') | เดิมเป็น literal ':artifact_id' เปรียบเทียบ — defect #7 |
| writeState | temp + rename (STATE_FILE แตะเฉพาะตอน rename) | orphan `.tmp` class ระบุใน R1 assertions |

## 5. Design Decisions ที่ถือ (D1–D5 + Owner decisions 2026-10-25)

| ID | การตัดสินใจ |
|---|---|
| D1 | version semantics = as-implemented (artifact ใหม่ต่อ generate, version 1, id unique) |
| D2 | download ไม่ตรวจ hash ใน v1 (stored sha256 ใช้ตรวจ offline ได้) — v2 candidate |
| D3 | determinism = structural เท่านั้น (`Generated at` ต่างได้) |
| D4 | claim map อยู่ใน markdown body; structured `claim_map` field ยังไม่รวมใน v1 |
| D5 | `status='EXPORTED'` ที่ markdown generation |
| S | (ข) rollback เมื่อ writeState ล้ม + รายงาน cleanup ตรงไปตรงต้น |
| W | in-process `fsp.writeFile` conditional patch สำหรับ injection |
| Malformed | URIError → 400 (จับเฉพาะ URIError ที่ dispatch) |

## 6. Deferred Items (ขอบเขตแยก — ห้ามรวมโดยไม่ได้รับอนุมัติ)

| รายการ | เงื่อนไขปลด |
|---|---|
| T4 — markdown footer | รอแหล่งต้นฉบับจาก Owner (ไม่มี .md ยุค intact) |
| Defect #4 — `user_custom` เต็มรูปแบบ | ต้องออกแบบกลไกส่ง custom data เข้า route (ปัจจุบัน 400 ตามสัญญา) |
| Docstring `deterministic` @1033 | รอ Owner อนุมัติ wording (D3 นิยาม structural) |
| CA-V1-03 write-failure injection บน HTTP child | ปัจจุบันพิสูจน์แบบ in-process (Test 8) — รูปแบบ HTTP-level ต้องการขอบเขตใหม่หากต้องการ |

## 7. Amendment History

| วันที่ | เหตุการณ์ |
|---|---|
| 2026-10-23 | Harness สร้าง (simulation era — server parse fail) |
| 2026-10-23 | T3: Node 24 wrap + Test 7 real-path → พบ defect ladder |
| 2026-10-23 | T3.1–T3.4: req.body fix → key mapping → user_custom 400 |
| 2026-10-23 | T3.5/T3.6: defect #6 approval → happy path 200 ครั้งแรก |
| 2026-10-25 | T3.7: M/W/S injections + R1–R5 ร่างแรก |
| 2026-10-26 | **Owner อนุมัติ R1 ฉบับแก้ไข + Peer รับรอง ledger (เอกสารนี้)** |

## 8. Integrity Statement (การสร้างเอกสารนี้)

- ไฟล์ที่สร้าง: **เอกสารนี้เป็นไฟล์เดียว** ที่เพิ่มเข้า repo ตามคำสั่ง Owner ("บันทึก R1 ฉบับแก้ไขลงในเอกสาร verification ของ repository")
- `app/mvp/service.js` (124,574 B / `473cf0d2…a3ede40`), `data/app/state.json` (117 B / `5d29cdbd…`), HEAD `9749f38e…`, 9 commits — ไม่มีอะไรถูกแตะในการสร้างเอกสารนี้
- ไม่มี commit/push · ไม่มี server/test run ในการสร้างเอกสารนี้
