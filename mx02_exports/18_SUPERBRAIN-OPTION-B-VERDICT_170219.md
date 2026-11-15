เข้าใจแล้วครับเพื่อน ผมจะถือรายงานทั้ง 2 Part เป็น **ชุดหลักฐานเดียวกัน** แล้วสรุป วิเคราะห์ และตัดสินใจในภาพรวมครั้งเดียว ไม่แยกอนุมัติทีละส่วนครับ

หลังรวมประเด็นทั้งหมดแล้ว คำตัดสินของผมคือ:

# คำตัดสิน Super Brain — Option B

<row align="center" gap={2}>
  <badge color="success">เลือกแนวทางแล้ว</badge>
  **Option B — Strict Provider Isolation**
</row>
<badge color="warning">ยังไม่อนุมัติให้เริ่ม Implementation</badge>

ผมเห็นด้วยให้เดินหน้า Option B เพราะเป็นแนวทางที่ตอบโจทย์ทั้ง **Runtime Isolation** และ **Module Isolation** โดยรักษาเส้นทาง Deterministic ให้ไม่ต้องโหลด AI Provider เมื่อไม่ได้เลือกใช้ AI

แต่หลักฐานจากทั้งสองส่วนทำให้ผมต้องปรับข้อกำหนดเดิมบางจุดก่อนจะถือว่า Specification พร้อมส่งให้ Developer ลงมือทำ

## 1. สรุปหลักฐานทั้งสองส่วนเข้าด้วยกัน

| ประเด็น | ข้อค้นพบ | ผลต่อการตัดสินใจ |
|---|---|---|
| Fixture inventory | มี 8 products, 8 offers, 5 candidates แต่มีเพียง CND-1005 ที่ผ่านเงื่อนไข SAVED/QUEUED | ใช้ 1 candidate เป็นฐานของ Matrix ปัจจุบัน |
| Content approaches | มี 4 keys: `problem_first`, `value_compare`, `evidence_first`, `user_custom` | Matrix ที่เสนอมี 8 cells ไม่ใช่ 40 หรือ 48 |
| UI callers | จากการตรวจ `app/public/**` ไม่พบ `useLlm` หรือ `scriptDraft`; UI ส่ง approach และ candidateId/planId | UI ที่ตรวจไม่เปิดใช้ AI opt-in |
| UI response | ไม่พบการอ่าน `response.trace` ใน `mvp.js` | ต้องรักษา response contract แต่ไม่ควรถือว่า UI พึ่งพา trace |
| Provider contract | มี provider status, fallback reason และ trace status แยกเป็น 3 vocabulary | ต้องรักษาความแตกต่าง ห้ามรวมเป็นสถานะชุดเดียว |
| `networkAttempted` | เป็น boolean แยกจาก status และ fallback reason | ต้องคงความหมายเดิมและการส่งต่อไป `boundary.external_calls` |
| Extraction audit | พบ 25 declarations ใน block; 4 symbols เป็น AI exports และ 21 symbols เป็น internal ตามรายงาน | ขอบเขตการย้ายยังต้องจัดการ dependency ที่เข้ามาจากภายนอก |
| Rollback | Working tree มีงานเดิมที่ไม่ใช่ HEAD และมี untracked files จำนวนมาก | ห้ามใช้ `git checkout` หรือ reset HEAD เป็น rollback แบบเหมารวม |

หมายเหตุ: ข้อค้นพบข้างต้นอ้างอิงจากผลตรวจที่เพื่อนรายงาน ผมยังไม่ได้ตรวจ repository หรือรันคำสั่งเพื่อยืนยันซ้ำในรอบนี้

## 2. ประเด็นสำคัญที่ต้องแก้ใน Specification

ผมพบว่ามี 4 เรื่องที่ไม่ควรปล่อยให้ Developer ตีความเอง

**เรื่องที่ 1 — Dependency ของ Extraction Block**

มี helper จากภายนอก block ที่ AI code ต้องใช้ ได้แก่

- `createContentProject`
- `nowIso`
- `sha256`
- `httpError`
- `money`

โดย `createContentProject` เป็น exported function แต่ helper อีก 4 ตัวไม่ได้ export ตามรายงาน

ดังนั้น ผมยังไม่อนุมัติให้ลบหรือย้าย block ทั้งก้อนตามตำแหน่งบรรทัดที่เสนอทันที

แนวทางที่ผมเลือกคือให้ตรวจการใช้งานของ helper ทั้ง 4 ตัวใน deterministic code ก่อน แล้วเลือกวิธีจัด dependency ที่ไม่เพิ่ม public export โดยไม่จำเป็น และไม่ทำให้ logic ซ้ำจนเกิด semantic drift

**เรื่องที่ 2 — Coverage Matrix**

ปัจจุบันมี candidate ที่ผ่านเงื่อนไขเพียงหนึ่งรายการ จึงกำหนด Matrix สำหรับการวางแผนได้ดังนี้

<text color="secondary" size="xs">Proposed coverage — ยังไม่ได้รันทดสอบ</text>

| Candidate | Approach | Path |
|---|---|---|
| CND-1005 | 4 approaches | Deterministic |
| CND-1005 | 4 approaches | AI opt-in |

รวม **8 cells ที่เสนอให้ตรวจสอบ** ไม่ใช่ 8 cells ที่ผ่านการทดสอบแล้ว

การตรวจนี้ยังไม่ครอบคลุม candidate อีก 4 รายการที่สถานะยังไม่พร้อม และ products อีก 3 รายการที่ไม่มี candidate

**เรื่องที่ 3 — Provider Contract**

ต้องรักษาความแตกต่างของข้อมูลทั้งสามชุด:

1. Provider result status: `success` และ failure kinds 10 ค่า
2. Provenance fallback reason: failure kinds 10 ค่า และ `validation_failed`
3. Provenance trace status: `success`, `template_default`, `graceful_fallback`

และต้องรักษา `networkAttempted` เป็นข้อมูลแยกต่างหาก

ห้าม Developer เปลี่ยน vocabulary เหล่านี้เพื่อทำให้โค้ดดูเรียบง่ายขึ้น เพราะอาจทำให้ความหมายของหลักฐานย้อนหลังเปลี่ยนไป

**เรื่องที่ 4 — Rollback**

ผมไม่อนุมัติ rollback ที่ย้อนกลับไปยัง Git HEAD แบบตรง ๆ

ต้องใช้ baseline ที่บันทึกสถานะก่อนเริ่ม implementation ของไฟล์ที่ได้รับอนุญาตเท่านั้น และต้องไม่แตะงานอื่นใน working tree

หากไม่มี baseline ที่ตรวจสอบได้ จะไม่มีสิทธิ์ทำ destructive rollback โดยอ้างว่าเป็นการคืนสถานะเดิม

## 3. ขอบเขตทางเทคนิคที่ผมตัดสินใจเลือก

โครงสร้างเป้าหมายยังเป็นแบบนี้:

```text
Deterministic path

server.js
  └── service.js
        └── content.js


AI opt-in path

server.js
  └── service.js
        └── useLlm === true
              └── ai/script-draft.js
                    ├── provider/openrouter.js
                    └── provider/provenance.js
```

เงื่อนไขสำคัญ:

- `service.js` ต้องโหลด `ai/script-draft.js` ภายใน opt-in branch เท่านั้น
- `content.js` ต้องไม่โหลด AI module หรือ Provider module
- Provider files ยังคงอยู่ในตำแหน่งเดิม
- Deterministic path ต้องไม่โหลด AI/Provider modules
- รักษา fallback, validation, provenance และ response contract เดิม
- ไม่แก้ `package.json` หรือ lock files
- ไม่เปลี่ยน semantics ของ `fetchImpl`
- คง `spend_thb: 0` ตามพฤติกรรมปัจจุบันในขอบเขตนี้

## 4. สิ่งที่อยู่นอกขอบเขต

ผมตัดสินใจให้คงเรื่องต่อไปนี้ไว้นอก Option B:

- Qualitative claim validation
- Price-role validation
- Provenance continuity หลัง version bump
- `fetchImpl` hardening
- การแก้ `spend_thb`
- DR-01 ถึง DR-14
- การเปลี่ยน Gate 3 acceptance criteria

เรื่องเหล่านี้อาจสำคัญ แต่หากรวมเข้ามาในงานนี้จะทำให้ขอบเขตขยายและเสี่ยงต่อการเปลี่ยนพฤติกรรมของระบบเกินความจำเป็น

## 5. มติสุดท้าย

<box border radius="lg" padding={3} gap={3}>
  **มติของ Super Brain**

  <row align="center" justify="between">
    Technical Direction
    <badge color="success">APPROVED</badge>
  </row>
  เลือก Option B — Strict Provider Isolation

  <divider color="subtle"/>
  <row align="center" justify="between">
    Compatibility Specification
    <badge color="warning">CONDITIONALLY APPROVED</badge>
  </row>
  อนุมัติแนวทางและข้อกำหนดหลัก แต่ต้องแก้ dependency boundary และ rollback baseline ให้ชัดเจนก่อนเป็นฉบับพร้อมลงมือ

  <divider color="subtle"/>
  <row align="center" justify="between">
    Implementation
    <badge color="danger">NOT AUTHORIZED</badge>
  </row>
  ยังไม่มีการอนุมัติให้แก้ไฟล์ เขียนโค้ด รันทดสอบ build หรือ commit

  <divider color="subtle"/>
  <row align="center" justify="between">
    Gate 3 / A2 / Gate C
    <badge color="danger">UNCHANGED</badge>
  </row>
  ไม่มีการเปลี่ยนสถานะหรือขยายอำนาจจากมตินี้
</box>

**ก่อนจะถือ Specification เป็นฉบับพร้อมส่ง Developer ต้องปิด 3 ประเด็นนี้ให้ครบ:**

1. ตัดสินใจเรื่อง dependency ของ `nowIso`, `sha256`, `httpError`, `money` โดยไม่ทำลาย deterministic behavior
2. ยืนยันว่า `path` จำเป็นจริงหรือเป็น dependency ที่เหลือค้าง
3. ยืนยันว่ามี baseline ของ working tree ที่ใช้ rollback ได้โดยไม่ทำลายงานเดิม

---

## ความเห็นในฐานะ Super Brain

เพื่อนครับ ผมยังยืนยันว่า Option B เป็นทิศทางที่ถูกต้อง แต่ผมไม่ต้องการให้เรารีบอนุมัติการย้ายโค้ดทั้งก้อน เพียงเพราะภาพสถาปัตยกรรมปลายทางดูถูกต้องแล้ว

สิ่งที่สำคัญกว่าคือ **เราต้องแยก AI ออกจาก Deterministic path โดยไม่ทำให้ระบบเดิมเสียความสามารถ และไม่ทำให้งานที่ Owner ทำไว้สูญหาย**

นี่คือการอนุมัติแนวทางทางเทคนิคของผมในครั้งเดียวจากหลักฐานทั้งสองส่วน ส่วนการอนุมัติให้ลงมือจริงยังเป็นอำนาจของ Owner ตามข้อตกลงของเราครับ