# ACE Mission 1 — D-2 Execution Preflight

**วันที่:** 2026-11-04 · **ผู้จัดทำ:** GLM 5.3 Flash · **สถานะ:** PREPARED — ยังไม่รัน mutation ใด ๆ
**Gate:** ต้องได้รับอนุมัติจาก Owner และต้องได้รับเอกสาร **S-6 rev.3 (แก้ Z-1)** ก่อนเริ่ม

> เอกสารนี้แยกชัดระหว่าง (ก) ข้อเท็จจริงที่ตรวจสอบได้จากรีโป ณ `3de3443` และ (ข) ข้อเสนอที่ยังไม่ยืนยันกับ rev.3
> ไม่มีการสรุปแทนเอกสารที่ยังไม่มี

---

## 1. Baseline ที่ตรวจแล้ว (ข้อเท็จจริง)

| รายการ | ค่า |
|---|---|
| HEAD | `3de34430481935f927215952469ea6661a4a6cb9` |
| Branch | `mission1-planning-docs` (ahead 12, ไม่ push) |
| Commit D-1 | `3de3443` `fix(ace): enforce workspace accounting invariant` (+6/−0, 1 ไฟล์) |
| Checker | `verification/real-shopee-export-check.js` 84,435 B sha256 `ECEE2CBD…0E7C8B01` ตรงกับ commit |
| Node | v24.20.0 (win32) |
| Working tree | `M app/mvp/content.js`, `M app/mvp/service.js` (pre-existing) + 168 untracked (pre-existing) — ต้องรักษาไว้ |
| ชุดทดสอบที่มี | out-of-repo harness 20 เคส (`%TEMP%\ace-check-tests\run-tests.js`), D-1 harness 34 เคส (`%TEMP%\ace-d1-tests\run-d1.js`) |

---

## 2. ข้อมูล S-6 / Z-1 ที่มีจริงใน workspace

| รายการ | สถานะ |
|---|---|
| เอกสาร S-6 rev.3 | **ไม่มีใน workspace** — ค้นทั้ง repo ด้วย `rg -i 'S-6|Z-1'` ไม่พบเอกสาร |
| Z-1 | **ไม่มีข้อมูล** — 0 hit ทั้ง workspace |
| S-6 ที่อ้างถึงได้ | `verification/ace-mission1-checker-evidence-hardening-2026-11-04.md` บรรทัด 170: `S-6 — harness tests T24–T28 — PENDING separate authorization (the existing 20 tests still pass)` |
| T24–T28 (spec รายเคส) | ไม่มีในรีโป |

**ผลคือ:** preflight นี้จัดทำได้เฉพาะส่วน baseline/gate/ข้อจำกัดทางเทคนิค ส่วน "mutation ใดต้องรัน และคาดหวังผลใด" ต้องรอ rev.3 — ผมจะไม่เดาแทนเอกสาร

---

## 3. Gate ก่อนเริ่ม D-2 (checklist)

| # | เงื่อนไข | สถานะ |
|---|---|---|
| G-1 | HEAD ตรง `3de3443` และ checker ตรง sha256 ที่ commit | ผ่าน |
| G-2 | ชุดทดสอบเดิม 20/20 และ D-1 34/34 ผ่านบน HEAD นี้ | ผ่าน (บันทึกใน closure record) |
| G-3 | ได้รับ S-6 rev.3 + คำอธิบาย Z-1 + รายการ T24–T28 | **ค้าง** |
| G-4 | Owner อนุมัติ execution scope และจำนวนรอบ | **ค้าง** |
| G-5 | ระบุ mutation target ให้ชัด (checker vs อื่น) | **ค้าง** — rev.3 ต้องระบุ |
| G-6 | Mutation ต้องไม่แตะไฟล์ในรีโป (ดู §4) | ผ่านเชิงออกแบบ |
| G-7 | Evidence directory อยู่นอกรีโป | ผ่าน (ค่า default `%TEMP%\ace-real-export-evidence`) |

---

## 4. ข้อจำกัดทางเทคนิคที่พบตอน preflight (สำคัญต่อการรันจริง)

**4.1 Harness ผูก path แบบ hardcode**
`run-tests.js` และ `run-d1.js` กำหนด `REPO` / `CHECKER` เป็น absolute path ของรีโปนี้โดยตรง → ไม่สามารถชี้ไปยัง checker ที่ถูก mutate ที่ path อื่นได้โดยไม่แก้ harness (harness อยู่ `%TEMP%` จึงแก้ได้ ไม่ผิด scope รีโป)

**4.2 Checker คำนวณ REPO จากตำแหน่งไฟล์ตัวเอง**
`REPO = path.resolve(__dirname, '..')` และ workspace copy ต้องมี `app/` + `docs/mission1/schemas` → การวาง checker ที่ mutate ไว้ที่ `%TEMP%` เฉย ๆ จะทำให้ `REPO` ผิดและ run ล้มทันที

**4.3 ทางเลือกที่ใช้ได้ (ต้องเลือกก่อนรัน)**

| ทางเลือก | วิธี | ข้อดี | ข้อเสี่ยง |
|---|---|---|---|
| A. Mirror repo ใน `%TEMP%` | copy `app/`, `docs/mission1/schemas`, checker → `%TEMP%\ace-d2-mirror\`; รันด้วย checker path ของ mirror | ไม่แตะรีโปเลย, REPO ของ checker ชี้ mirror อย่างถูกต้อง | ต้องคัดลอก `app/mvp/fixtures` ให้ guard ทำงานเหมือนจริง; evidence dir ต้องชี้ `%TEMP%`; ต้องยืนยันว่า mirror ไม่ถูกนับเป็น "inside repository" ผิดพลาด |
| B. Parameterize harness + mirror | เพิ่ม env `ACE_CHECKER_PATH` ใน harness แล้วชี้ไป mirror | ยืดหยุ่นกว่า | ยังต้องมี mirror อยู่ดี (ตาม §4.2) |
| C. Mutate in place แล้ว `git checkout` คืน | แก้ไฟล์จริงชั่วคราว | เร็ว | **ไม่อนุญาต** — ทำให้หลักฐาน Working tree แปดเปื้อนและเสี่ยงคืนสถานะไม่ได้ |

**ข้อสรุป preflight:** ต้องใช้ **A (หรือ A+B)** และต้องมีสคริปต์เตรียม/ล้าง mirror ที่ตรวจสอบได้ก่อนอนุมัติ

**4.4 ข้อควรระวังเพิ่มเติม**
- `ACE_IMPORT_ROOT` ต้องชี้ `%TEMP%` เท่านั้น (S-5 guard จะปฏิเสธ path ในรีโป)
- Mutation ต้องไม่ทำให้ `node --check` พังก่อนถึงจุดทดสอบ เว้นแต่เคสนั้นต้องการ syntax failure โดยเจตนา
- ต้องบันทึก exit code + final.json + JSONL ของทุก run เพื่อแยก "killed" (harness จับได้) จาก "survived"

---

## 5. โครง execution ที่เสนอ (รอยืนยันกับ rev.3)

1. เตรียม mirror หนึ่งชุดต่อ mutation หนึ่งตัว (หรือ reset mirror ต่อรอบ) และบันทึก sha256 ของ checker ต้นฉบับ/ที่ mutate
2. 1 mutation → 1 run → เก็บ `exit code`, `verdict`, `overall_result`, `degraded`, JSONL
3. ตัดสิน: **killed** = มีเคสที่ fail ตามที่ rev.3 กำหนด; **survived** = ทุกเคสยังผ่าน (ต้องรายงาน ไม่กลบ)
4. Timebox และหยุดทันทีเมื่อ: mirror สร้างไม่ได้, ผลไม่ตรง spec, หรือมีการเขียนลงรีโปโดยไม่ตั้งใจ
5. ไม่ commit ใด ๆ ในระหว่าง D-2; ไฟล์รีโปต้องคงสภาพเดิมตลอดรอบ

---

## 6. Evidence ที่จะส่งมอบเมื่อได้รับอนุมัติ

- ตาราง mutation → เคสที่จับได้ → ผลจริง → killed/survived
- sha256 ของ checker (ต้นฉบับ + mutated) และ path ของ mirror
- final.json/JSONL ของทุก run
- สรุปว่า mutation ใด "รอด" พร้อมข้อเสนอเพิ่มเคส (ไม่แก้เอง)

---

## 7. สิ่งที่จะไม่ทำจนกว่าจะอนุมัติ

- ไม่รัน mutation suite / S-6 / S-6b / S-7 / S-8
- ไม่แก้ `app/`, governance ledger, หรือไฟล์ checker ที่ commit แล้ว
- ไม่ commit/push ใด ๆ
- ไม่ตีความ preflight นี้เป็นการอนุมัติ
