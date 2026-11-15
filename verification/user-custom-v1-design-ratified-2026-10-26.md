# Defect #4 — `user_custom` v1 Design (Ratified)

**Date:** 2026-10-26
**Design status:** `FINALIZED — v1`
**Implementation status:** `NOT AUTHORIZED`
**Approval scope:** Design และ Acceptance Criteria เท่านั้น — เอกสารนี้**ไม่อนุมัติ** implementation, code changes, test changes, runtime state changes, commit หรือ push
**Evidence source:** Reconciliation report แบบ read-only ที่ตรวจโดย GLM ต่อ baseline `service.js` 124,574 B / `473cf0d2…a3ede40` (หลักฐานบรรทัดจริง: `content.js` @215–230, `service.js` @1557–1593, @2271–2331, @2543–2576) + การยืนยัน code-level alignment โดย Owner (2026-10-25/26)
**Verification limitation:** สถานะ PASS ทั้งหมดในเอกสารนี้เป็น**สถานะตาม Reconciliation report ที่ Owner ส่งมาและรับรอง** — ไม่ใช่การรันทดสอบซ้ำโดยผู้เขียนเอกสารในรอบนี้ ห้ามขยายความเกินหลักฐานที่ระบุ

**เอกสารอ้างอิงหลัก:** `verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md` (sha256 `0d4bca3a39e450b793eab9e05ab2c32e9a595404c3523fa3155e10b8236ec4e0` — 9,616 bytes) · Baseline freeze directive (owner, 2026-10-26)

---

## 1. วัตถุประสงค์ของ Design

กำหนดพฤติกรรม `user_custom` ให้ตรงกับพฤติกรรมที่มีหลักฐานรองรับ โดย:

- ผู้ใช้กำหนดวิธีนำเสนอเองได้ — ระบบ**ไม่แต่ง**ข้อมูลหรือข้อเท็จจริงที่ไม่มีหลักฐาน
- ตรวจความครบถ้วนของคำขอก่อนใช้งาน (validation ตามสัญญาเดิม)
- รักษาความเชื่อมโยงโครงสร้าง `Source → Evidence → Plan → Content Artifact` — หมายถึง **โครงสร้างที่ตั้งใจและการอ้างอิงที่มีอยู่** ไม่ใช่หลักฐานว่า v1 ทำ Evidence resolution/mapping ครบถ้วนหรืออัตโนมัติ (v1: `evidence_ids: []` + honest notes ตาม D1)
- แจ้งปัญหาชัดเจนเมื่อคำขอไม่ครบ (HTTP 400 ตาม variants ที่มีอยู่)
- **หลักการ:** ผู้ใช้มีอิสระในการกำหนดวิธีนำเสนอ แต่ไม่มีการลดมาตรฐานด้าน Evidence เพียงเพราะเป็นคำสั่งกำหนดเอง — และเนื่องจากข้อความของผู้ใช้**ไม่ใช่หลักฐาน** ระบบจึง**ไม่สร้าง evidence mapping ให้** (สอดคล้องหลัก "ไม่มีข้อมูลที่พิสูจน์ไม่ได้")

## 2. Design Decisions ที่ Owner รับรอง (D1–D4)

### D1 — Evidence integrity
- คง `evidence_ids: []` ตาม `buildCustomApproach` (`content.js` @215–230) — **ห้าม fabricate evidence IDs**
- คง `gate_note: 'ผู้ใช้เขียนเอง — ต้องตรวจข้อเท็จจริงก่อนใช้ทุกครั้ง'` (content route) และ `claim_notes: 'User-authored entry. …carries no generated evidence mapping; verify any factual claim before use.'` (plan route @1583)
- **การไม่มี Evidence mapping ≠ ข้อเท็จจริงได้รับการพิสูจน์** · การผ่าน Workflow ≠ ทุก Claim ถูกต้อง
- การตรวจสอบข้อเท็จจริงยังต้องอาศัย QA และการตรวจของมนุษย์ตามขั้นตอนที่ระบบรองรับจริง — **ห้ามกล่าวอ้างว่า Gate ตรวจได้ครบทุกประเภทของ Claim**

### D2 — ขอบเขต Markdown artifact
- v1: `user_custom` ใช้ได้ใน**สาย Content** ตามพฤติกรรมที่พิสูจน์แล้ว (62/62 — switch → storyboard → QA → finalize → export v5)
- **Generate route ปฏิเสธ `user_custom` ด้วย HTTP 400** (`custom: null` เสมอ → guard @2575–2577) — บันทึกเป็น **documented limitation**
- การเพิ่ม input ให้ Generate route = **งานใหม่** ต้องมี Design + Tests + อนุมัติ implementation แยก

### D3 — Ambiguity detection
- **นอกขอบเขต v1** — ไม่มีความสามารถตรวจจับ/แก้ความกำกวมอัตโนมัติ · ห้ามอ้างว่ารองรับ
- ผู้ใช้พิจารณาความเหมาะสมด้วยตนเองผ่าน gate_note/claim_notes และกระบวนการตรวจที่มี

### D4 — Error wording
- คง variants เดิมทั้ง 3 ตาม implementation: `content/draft` → `…needs a custom description` · `approach-switch` และ `generate` → `…needs a custom description first` · `plan/custom` → `angle is required` (requireString) — **ไม่ unify ในงานนี้**

## 3. Proposed Behavior (5 ขั้น) ↔ เส้นทางจริง

| ขั้น | Design | Implementation จริง | สถานะ |
|---|---|---|---|
| 01 Capture | รับคำขอผู้ใช้ + อ้างอิง Source | `POST /api/mvp/plan/custom` (angle บังคับ) · `content/draft`+`/approach` (body.custom) | ✓ มีอยู่ |
| 02 Validate | ตรวจความครบ/ชัดเจน | requireString (angle min 10/max 500 ฯลฯ) · draft ต้อง DRAFT (409) | ✓ มีอยู่ |
| 03 Resolve Evidence | **Workflow concept — v1 ยังไม่ได้ implement** การแยก fact/hypothesis อัตโนมัติ; ของจริง = `evidence_ids: []` + honest notes (D1) | **OWNER DECISION: v1 as-is** |
| 04 Generate | สร้างเมื่อผ่านเงื่อนไข | content route พิสูจน์แล้ว (62/62) · **generate route ปฏิเสธ user_custom (400 — D2)** | ✓ ตามขอบเขต |
| 05 Verify | ตรวจผลก่อนขั้นถัดไป | QA/Finalize + status lock หลัง EXPORTED | ✓ มีอยู่ |

**ข้อสังเกตตามสัญญา:** `user_custom` ไม่ใช่ช่องข้าม Validation/Evidence requirements — ใน v1 มันเป็นแนวทางที่**ประกาศอย่างตรงไปตรงต้นว่าไม่มี evidence mapping** และต้องผ่าน QA/การตรวจมนุษย์ก่อนใช้เช่นเดียวกับแนวทางอื่น

## 4. Decision Table (7 สถานการณ์) — ตรวจแล้ว

| สถานการณ์ | พฤติกรรมจริง | สถานะ (ตามรายงาน) |
|---|---|---|
| คำขอครบ + ต้นทางพร้อม | ดำเนินการได้ในสาย Content — pipeline user_custom ครบถึง export v5 ตามหลักฐานที่รายงาน (62/62); Generate route ไม่รองรับ user_custom ใน v1 และปฏิเสธด้วย HTTP 400 ตาม D2 | PASS (62/62) |
| ไม่มีคำอธิบายที่จำเป็น | 400 — แจ้งสิ่งที่ขาด (3 variants คงเดิม) | PASS |
| คำขอกำกวม | v1 ไม่ตรวจอัตโนมัติ — manual gate | ตาม D3 |
| ข้อเท็จจริงไม่มี Evidence | ห้ามเติม — `evidence_ids: []` + notes | PASS |
| Generate ล้มเหลว | รายงานล้มเหลว — rollback M/W/S — หลักฐานของ **Content Artifact v1 workflow ภายใต้สัญญา ratified** (T3.7); ไม่ครอบคลุม Generate+user_custom (D2) | PASS (T3.7) |
| บันทึกล้มเหลว | Branch S rollback + R1 ฉบับแก้ไข — หลักฐานชุดเดียวกัน (ไม่ครอบคลุม Generate+user_custom) | PASS |
| แก้คำขอหลัง Generate | generate ซ้ำ = artifact ใหม่ (ไม่ overwrite) · switch ล็อกหลัง EXPORTED | PASS |

## 5. Acceptance Criteria (สถานะตาม Reconciliation report — ไม่ใช่ผลรันใหม่)

| ID | เกณฑ์ | สถานะตามรายงาน |
|---|---|---|
| AC-01 | รับและเก็บ `user_custom` ที่ถูกต้องใน Plan/Content ตาม Contract | **PASS** (plan/custom 56/56 · content switch 62/62) |
| AC-02 | ปฏิเสธคำขอที่ขาดข้อมูลจำเป็น (HTTP 400 ตาม variants เดิม) | **PASS** |
| AC-03 | ไม่สร้าง `evidence_ids` ปลอม + แจ้งข้อจำกัด | **PASS** (สำหรับการไม่ fabricate — ไม่ได้พิสูจน์ว่าทุก Claim ถูกตรวจ) |
| AC-04 | ไม่อ้างว่ามี Ambiguity detection อัตโนมัติ | **OUT OF SCOPE — v1** |
| AC-05 | Generate ซ้ำสร้าง artifact ใหม่ ไม่เขียนทับ + status lock — **พฤติกรรมทั่วไปของ Content Artifact v1; ไม่สถาปนา** Generate+user_custom (**BLOCKED** ตาม D2 — BLOCKED ≠ PASS ≠ ระบบเสีย) | **PASS** |
| AC-06 | Failure/Rollback ตามสัญญา Content Artifact v1 (R1 ฉบับแก้ไข) | **PASS** (M/W/S + cleanup-failure honesty — T3.7) |
| AC-07 | แยก user_custom จาก Workflow ปกติ + ไม่ข้าม Gate | **PASS** |
| AC-08 | Runtime ผ่าน HTTP สำหรับเส้นทางที่รองรับ | **PASS** (Plan/Content) · **Generate + user_custom = BLOCKED ตาม D2** — BLOCKED ≠ PASS ≠ ระบบเสีย: คือ route ไม่มี input สำหรับ custom และปฏิเสธตามสัญญา |

## 6. Test Gaps and Limitations (บันทึกชัดเจน)

- **Generate + custom-input artifact** — ไม่รองรับใน v1 (D2) · ไม่มีหลักฐาน
- **Ambiguity detection** — นอกขอบเขต v1 (D3) · ไม่มีหลักฐาน
- **การยืนยันว่าทุก factual claim ใน user_custom artifact ผ่านการตรวจโดยมนุษย์** — ยังไม่มีหลักฐานเพียงพอให้อ้างแบบครอบคลุม
- **Error wording variants 3 แบบ** — จงใจคงไว้ (D4)
- ผล PASS ทั้งหมดอ้างรายงานเดิม — **ไม่ใช่การรันซ้ำรอบออกแบบ**

## 7. Change Control

1. เอกสารนี้**ไม่อนุมัติ implementation**
2. ห้ามแก้ source code, tests, runtime state, existing contract หรือไฟล์อื่นใดภายใต้การอนุมัตินี้
3. ห้าม commit/push
4. การเปลี่ยน `service.js` ในอนาคต → diff-review เทียบ baseline `473cf0d2…` + ประเมินผลกระทบต่อสัญญา**ก่อน**ข้อความ PASS สำหรับเวอร์ชันใหม่
5. Implementation ของรายการ deferred ใด ๆ ต้องได้รับอนุมัติแยกชัดเจน

## 8. ข้อเท็จจริงอ้างอิง ณ วันตรวจ (2026-10-26)

- Branch `mission1-planning-docs` · HEAD `9749f38e7bdb1ec6ee56be0e2227473c3b973f2b` · 29 entries
- `service.js` 124,574 B / sha256 `473cf0d2587a001de9783f2a07b09111be9c122d5eb34153971e4ae02a3ede40`
- `data/app/state.json` 117 B / md5 `5d29cdbdace0a73580bc2e0633f2e8cb`
- สัญญาอ้างอิง: `content-artifact-v1-acceptance-contract-ratified-2026-10-26.md` (9,616 B / `0d4bca3a…c4e0`)
- ไม่มีเอกสาร design ของ user_custom อยู่ก่อน (ตรวจ `verification/*user*custom*` = ว่าง)
- หลักฐาน runtime เดิม: harness 77/77 · content-creation 62/62 · mvp-workflow 56/56 · foundation 19/19 (บน baseline `473cf0d2…` ยกเว้น harness บน `4b4a2a30…→473cf0d2…` ตามลำดับเหตุการณ์ T3.4–T3.7)

## 9. หลักการอ้างอิง

"ระบบที่น่าเชื่อถือไม่ใช่ระบบที่ไม่มีวันล้มเหลว แต่เป็นระบบที่รู้ว่าอะไรล้มเหลว รักษาสิ่งที่ควรรักษา และไม่กล่าวอ้างเกินหลักฐานที่มี"
