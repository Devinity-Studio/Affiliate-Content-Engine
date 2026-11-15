งาน: จัดเก็บเอกสารอ้างอิง “ACE — UX/UI Design Intent & Concept”

วัตถุประสงค์
เก็บรักษาแนวคิดและเจตนาการออกแบบ UX/UI ที่เจ้าของโครงการให้ไว้ เพื่อใช้อ้างอิงเมื่อถึงขั้น Reconcile UX Behavior Concept โดยไม่ต้องเริ่มต้นความเข้าใจใหม่

ตำแหน่งและชื่อไฟล์
1. ตรวจดูโครงสร้างและรูปแบบเอกสารใน Project Documentation ก่อน
2. จัดเก็บในตำแหน่งเอกสารที่เหมาะสมของโครงการ ไม่จัดเก็บเป็น Content Library item
3. ใช้ชื่อไฟล์:
   ACE-UX-UI-Design-Intent-and-Concept.md
4. หากมีข้อจำกัดด้านสิทธิ์หรือไม่สามารถบันทึกในตำแหน่งดังกล่าวได้ ห้ามรายงานว่าจัดเก็บสำเร็จ ให้ระบุข้อจำกัดและตำแหน่งที่ลองดำเนินการอย่างชัดเจน

ขอบเขต
- ดำเนินการเฉพาะจัดเก็บเอกสารอ้างอิงนี้
- ห้ามแก้ไข Runtime, Source Code, Dependencies หรือข้อมูลใน Content Library
- ห้ามเริ่มออกแบบหรือ Implement UX/UI
- ห้ามเปลี่ยน Main Workflow หรือแทรกงานนี้เข้าไปในงาน ACE ที่กำลังดำเนินอยู่
- ห้ามเปลี่ยนแปลงหรือขัดจังหวะงานหลักที่ Nemotron ดำเนินการตามขอบเขตและสถานะเดิม
- ห้ามตีความแนวคิดในเอกสารเป็นข้อกำหนดที่อนุมัติแล้ว
- ห้ามอนุมานว่าความสามารถใดมีอยู่จริงในระบบปัจจุบัน
- หากต้องแก้รูปแบบเพื่อให้เข้ากับเอกสารของโครงการ ให้รักษาความหมายและเนื้อหาทั้งหมดไว้

การจัดประเภทสถานะ
- สถานะเอกสารต้องเป็น:
  CONCEPT CAPTURED — NOT APPROVED FOR IMPLEMENTATION
- เอกสารนี้เป็นบันทึกเจตนาและแนวคิดที่เจ้าของให้ไว้ ไม่ใช่ UX Behavior ที่ผ่านการ Reconcile
- ถ้อยคำเชิงหลักการและพฤติกรรมให้ถือเป็นแนวคิด/เจตนาที่เสนอสำหรับการพิจารณาในอนาคต ไม่ใช่ข้อกำหนด Implementation ที่อนุมัติแล้ว
- อย่าเพิ่มข้อสรุปหรือการตัดสินใจแทน Owner
- ประเด็นที่ยังไม่มีคำตัดสิน ให้คงสถานะรอการพิจารณาเมื่อถึงขั้น Reconcile และเชื่อมโยงกับหลักฐาน ข้อกำหนด และสถานะจริงของ ACE ณ เวลานั้น

เนื้อหาที่ต้องจัดเก็บ
ใช้เนื้อหาเอกสารด้านล่างให้ครบถ้วน หลังจัดเก็บให้ตรวจยืนยันว่าไฟล์มีอยู่ เปิดอ่านได้ และมีส่วนสำคัญครบ ได้แก่ Core Design Intent, Creative Inputs ทั้ง 6 ส่วน, Prompt Template/Prompt Config/Generated Prompt, Dynamic Skill & Personalization, UX Behavior Principles, Creative Diversity, FrontEnd Handoff Intent และ Scope & Governance

รายงานผลหลังดำเนินการ
ระบุ:
- ชื่อเอกสาร
- ตำแหน่งจัดเก็บจริง
- สถานะเอกสาร
- หลักฐานการตรวจยืนยันไฟล์
- การเปลี่ยนแปลงอื่นที่เกิดขึ้น (ถ้าไม่มี ให้ระบุว่าไม่มี)
ห้ามกล่าวว่าจัดเก็บสำเร็จ หากยังไม่ได้ตรวจยืนยันผลจริง

--- เนื้อหาเอกสาร ---

# ACE — UX/UI Design Intent & Concept

**Document Type:** Design Intent & Concept Reference
**Status:** `CONCEPT CAPTURED — NOT APPROVED FOR IMPLEMENTATION`
**Purpose:** เก็บรักษาเจตนาการออกแบบ UX/UI สำหรับนำไปใช้ในขั้นตอน Reconcile UX Behavior Concept ในอนาคต

## สถานะและการตีความ

เอกสารนี้รวบรวมเจตนาและแนวคิดที่เจ้าของโครงการส่งมาเพื่อใช้อ้างอิงในอนาคต เนื้อหาไม่ได้ยืนยันว่า UX Behavior ได้รับการ Reconcile แล้ว ไม่ได้อนุมัติการออกแบบรายละเอียดหรือ Implementation และไม่ได้ยืนยันว่าความสามารถที่กล่าวถึงมีอยู่ใน ACE ปัจจุบัน

ข้อความด้านล่างให้คงไว้ในฐานะแนวคิด/เจตนาสำหรับการพิจารณาในอนาคต ห้ามเปลี่ยนเป็นข้อกำหนดที่อนุมัติแล้ว หรือตัดสินใจแทน Owner

## 1. Core Design Intent

ACE ต้องเป็นมากกว่าระบบที่ใช้ AI สร้างคอนเทนต์โดยอัตโนมัติ

ACE ต้องเป็น **Creative Production Environment** ที่ช่วยให้ผู้ใช้สามารถควบคุม ปรับแต่ง และถ่ายทอดความเป็นตัวเองลงในผลงานได้อย่างง่ายดาย แม้ผู้ใช้จะไม่มีประสบการณ์ใช้ AI หรือไม่รู้วิธีเขียน Prompt ก็ตาม

หลักการสำคัญ:

- Easy to Start, Deep to Customize
- User Identity & Creative Freedom
- Evidence-driven Learning
- Context-aware Production
- Progressive Disclosure
- Preserve Versions, History & Lineage
- Human Control at Critical Gates

## 2. Six Creative Inputs

แนวคิดระบุว่าการสร้างคอนเทนต์ควรพิจารณาองค์ประกอบที่สัมพันธ์กัน 6 ส่วน:

1. **User** — ความชอบ ประสบการณ์ รสนิยม มุมมอง และเอกลักษณ์ของผู้สร้าง
2. **AI** — ความสามารถ จุดเด่น ข้อจำกัด และแนวทางการทำงานของ AI แต่ละตัว
3. **Actor** — บุคลิก นิสัย ไลฟ์สไตล์ วิธีพูด และความต่อเนื่องของตัวละครจาก Actor Studio
4. **Script** — โครงเรื่อง มุมมอง น้ำเสียง จังหวะ และวิธีการสื่อสาร
5. **Customer Target** — กลุ่มผู้ชม ความต้องการ ปัญหา แรงจูงใจ และบริบทของผู้ชม
6. **Product Target** — สินค้า คุณสมบัติ ประโยชน์ ข้อจำกัด จุดขาย และเป้าหมายการนำเสนอ

แนวคิดคือ ACE ควรนำองค์ประกอบเหล่านี้มาประกอบกันตามบริบทของงาน ไม่ใช้สูตรเดียวสร้างคอนเทนต์ทุกชิ้น

## 3. Prompt Config — User-facing Production Toolkit

Prompt Config เป็นแนวคิดของชั้นเครื่องมือที่ช่วยให้ผู้ใช้ปรับรายละเอียดการผลิตผ่านตัวเลือกที่เข้าใจง่าย โดยไม่จำเป็นต้องเขียน Prompt เอง

ตัวอย่างการกำหนด Scene Story:

- Scene / Location
- Props & Decoration
- Scene Elements
- Lighting
- Mood & Atmosphere
- Color Palette
- Composition & Camera
- Actor Placement & Action
- Visual Style
- Additional Constraints

แนวคิดระบุว่าตัวเลือกควรมีค่าเริ่มต้นที่เหมาะสม มี Preset สำเร็จรูป และเปิดให้ปรับแต่งรายละเอียดเชิงลึกได้ตามความต้องการ ทั้งนี้ยังไม่ใช่การอนุมัติรายละเอียด UI หรือพฤติกรรมของระบบ

ควรแยกแนวคิดทั้งสามส่วนนี้ออกจากกัน:

- **Prompt Template:** โครงสร้างคำสั่งหลัก
- **Prompt Config:** ค่าที่ผู้ใช้หรือระบบกำหนด
- **Generated Prompt:** คำสั่งที่ประกอบขึ้นจาก Template, Config, Context และ Skill ที่เกี่ยวข้อง

เจตนาที่บันทึกไว้คือ การเปลี่ยน Config ไม่ควรทำให้ผู้ใช้จำเป็นต้องเริ่มงานใหม่ทั้งหมดโดยไม่มีเหตุผล รายละเอียดการตัดสินใจและผลกระทบยังต้องพิจารณาในขั้น Reconcile

## 4. Dynamic Skill & Personalization

แนวคิดเสนอให้ ACE เรียนรู้ความชอบของผู้ใช้และรูปแบบการทำงานที่เหมาะสมกับผู้ใช้แต่ละคน พร้อมพิจารณาความสามารถเฉพาะของ AI แต่ละตัวให้เหมาะกับงาน

ขอบเขตการเรียนรู้ที่เสนอ:

- ความชอบที่ผู้ใช้ระบุโดยตรง
- รูปแบบที่อนุมานจากการเลือกและแก้ไข โดยแยกจากความชอบที่ผู้ใช้ยืนยันแล้ว
- ความเหมาะสมตามประเภทสินค้า กลุ่มเป้าหมาย และช่องทาง
- หลักฐานจากผลลัพธ์จริง
- สมมติฐานและแนวทางใหม่ที่ยังต้องทดลอง

เจตนาคือ Dynamic Skill ควรช่วยเสนอทางเลือกและพัฒนาวิธีทำงาน ไม่บังคับให้ผลงานทั้งหมดเหมือนรูปแบบที่เคยประสบความสำเร็จ

แนวคิดยังระบุว่า การเปลี่ยน Skill หรือพฤติกรรมที่ใช้งานจริงควรอยู่ภายใต้การตรวจสอบ การอนุมัติ การจัดการเวอร์ชัน และความสามารถในการย้อนกลับตามกติกาที่ต้องกำหนดภายหลัง

## 5. UX Behavior Principles

หลักการพฤติกรรม UX ที่เสนอไว้:

1. มือใหม่สามารถเริ่มต้นจากตัวเลือกสำเร็จรูปได้
2. ผู้ใช้ที่ต้องการควบคุมมากขึ้นสามารถเปิดเครื่องมือปรับแต่งเชิงลึกได้
3. ระบบใช้ภาษาที่เข้าใจง่ายและอธิบายผลของตัวเลือกได้
4. ผู้ใช้สามารถสร้างและรักษาเอกลักษณ์ของตนเองได้
5. ACE สามารถเสนอคำแนะนำได้ แต่ไม่ควรเปลี่ยนค่าที่ผู้ใช้ตั้งใจเลือกไว้โดยไม่แจ้งให้ทราบ
6. Preview ต้องแยกจาก Artifact ที่สร้างจริงอย่างชัดเจน
7. ผู้ใช้ควรเปรียบเทียบตัวเลือก ย้อนกลับ และทำงานต่อจากเวอร์ชันเดิมได้
8. การแก้ไขควรประเมินผลกระทบจริง เพื่อเลือก Reuse, Recheck หรือ Rebuild ตามความเหมาะสม
9. การอนุมัติและเผยแพร่ควรผ่าน Workflow Gates ที่กำหนด

รายการนี้เป็นแนวคิดอ้างอิง ไม่ใช่ข้อยืนยันว่า Workflow Gates หรือพฤติกรรมเหล่านี้มีอยู่แล้วหรือได้รับอนุมัติให้ Implement แล้ว

## 6. Creative Diversity

เจตนาคือ ACE ไม่ควรมุ่งเพิ่มเพียงความเร็วในการผลิต แต่ควรช่วยสร้างความแตกต่างที่มีความหมายระหว่างคอนเทนต์

ปัจจัยที่แนวคิดเสนอให้พิจารณา:

- เอกลักษณ์ของผู้ใช้
- บุคลิกของ Actor
- วิธีเล่าเรื่องของ Script
- ความต้องการของ Customer Target
- คุณสมบัติและเป้าหมายของ Product Target
- ความสามารถของ AI ที่เลือกใช้
- ผลการทดลองและหลักฐานจากการเผยแพร่จริง

แนวคิดเสนอให้ระบบเปิดพื้นที่ทดลองแนวทางใหม่ ไม่ยึดติดกับสูตรสำเร็จเดิม และไม่ถือว่าผลลัพธ์ที่ดีเพียงครั้งเดียวเป็นกฎถาวร

## 7. FrontEnd Handoff Intent

เมื่อถึงขั้นตอน Reconcile UX Behavior Concept แนวคิดนี้ควรถูกนำไปสื่อสารกับ FrontEnd อย่างชัดเจน

สิ่งที่ FrontEnd ควรเข้าใจเมื่อมีการทำ Handoff ในอนาคต:

- ผู้ใช้ทำอะไรได้ในแต่ละขั้นตอน
- ตัวเลือกแต่ละชนิดมีความหมายอย่างไร
- การปรับแต่งส่งผลต่อข้อมูลและผลงานส่วนใด
- ผู้ใช้ดู Preview เปรียบเทียบ และย้อนกลับอย่างไร
- ค่าใดมาจากผู้ใช้ ค่าใดเป็นข้อเสนอของระบบ และค่าใดเป็นข้อจำกัด
- ระบบเก็บ Config, Prompt, Skill Version และ Artifact Lineage อย่างไร
- พฤติกรรมใดต้องผ่านการยืนยันหรืออนุมัติ

รายการนี้เป็นเจตนาสำหรับ Handoff ในอนาคต ไม่ใช่ข้อกำหนด FrontEnd ที่ผ่านการ Reconcile แล้ว

## 8. Scope & Governance

เอกสารนี้เป็นการรวบรวมเจตนาและแนวคิดเพื่อใช้อ้างอิงในอนาคตเท่านั้น

- ไม่เปลี่ยน Workflow หลักที่กำลังดำเนินการ
- ไม่ถือว่า UX Behavior ได้รับการ Reconcile แล้ว
- ไม่อนุมัติการออกแบบรายละเอียดหรือ Implementation
- ไม่อนุญาตให้แก้ไข Repository หรือเปลี่ยน Runtime Behavior โดยอาศัยเอกสารนี้
- ไม่ถือว่าความสามารถที่กล่าวถึงมีอยู่แล้วในระบบปัจจุบัน
- ไม่เปลี่ยนขอบเขตหรือสถานะของงานหลักที่ Nemotron ดำเนินการ

**Next Intended Use:** นำเอกสารนี้กลับมาพิจารณาเมื่อถึงขั้นตอน Reconcile UX Behavior Concept โดยเชื่อมโยงกับหลักฐาน ข้อกำหนด และสถานะจริงของ ACE ในเวลานั้น

--- จบเนื้อหาเอกสาร ---# ACE — Design Closure Review: Export History & Content Lineage

## 1. Executive Summary

This report resolves specification ambiguities between DDR v1.3 requirements and the current ACE source implementation, presenting explicit Owner decisions required before DDR v1.3 can be considered internally consistent.

**What is clear from source evidence:**
- The `exportProject` function (`content.js:1100-1278`) renders video, writes SHA-256 hashes, and updates the Content Library index at `data/mission1/content-library.json`
- The library index format records: `id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status`
- SHA-256 is computed for rendered video files and individual assets using `crypto.createHash('sha256')`
- Export requires `FINALIZED` project status; on success, status changes to `EXPORTED`
- The library filter before push checks `content_id + filename` match to avoid duplicate entries

**What remains ambiguous:**
- No `export_event`, `export_request_id`, `request_fingerprint`, or `event_seq` fields exist anywhere in the codebase
- No `artifact_id` field exists; SHA-256 is used as integrity verification but not as a stable logical identity
- No durable Event persistence mechanism; each export overwrites/replaces prior library entries based on `content_id + filename`
- No `PROVEN-CLEAN`, `UNKNOWN`, or orphan detection state machine
- Library is a latest-entry catalog, not a historical index; integrity verification covers current file only

**What requires Owner decisions:**
1. Implement Export Event mechanism or adjust DDR scope
2. Decide on `artifact_id` and content-addressed storage model
3. Choose: overwrite-versus-history-preservation for Library
4. Implement or document retry/recovery state machine
5. Decide on variant differentiation strategy

---

## 2. Requirement Semantics

### 2.1 Request, Attempt, Event, and Artifact Definitions

| Term | DDR v1.3 Requirement | Current Source Behavior | Classification |
|---|---|---|---|
| **New export request** | One durable Event per export request | `handleContentExport` → `exportProject` → renders video → writes library entry → status → EXPORTED | SOURCE_VERIFIED |
| **Retry of same request after loss** | Should return existing outcome or create new Event | No retry mechanism exists; `withLock` only prevents concurrent requests | NOT_FOUND_IN_INSPECTED_SCOPE |
| **New export producing identical bytes** | Should reuse existing Artifact; Event should be recorded | Same `content_id + filename` match filters old entry; new entry pushed regardless of SHA-256 equality | NOT_FOUND_IN_INSPECTED_SCOPE |
| **Failed attempt with incomplete file** | Should be represented as UNKNOWN or orphan | No failure representation; errors throw 409 or 503 | NOT_FOUND_IN_INSPECTED_SCOPE |
| **Undeterminable outcome** | Should be UNKNOWN | No mechanism; outcome always assumed EXPORTED or error thrown | NOT_FOUND_IN_INSPECTED_SCOPE |

### 2.2 Key Semantics Clarifications

1. **One Event per request vs. record every export occurrence**: Currently, there is NO Event mechanism. The design must explicitly choose: (a) one Event per export request, or (b) record every export occurrence with a new Event each time. The ambiguity must be resolved before DDR v1.3 compliance can be assessed.

2. **`request_fingerprint` binding**: No `request_fingerprint` field exists. If required, it must bind an ID to its inputs (project state, script version, renderer configuration, etc.).

3. **`artifact_id` vs. SHA-256**: No `artifact_id` exists. The design must decide whether `artifact_id` is derived from SHA-256 or remains a separate stable identifier. If derived from SHA-256, content-addressed storage becomes possible. If separate, `artifact_id` provides logical stability independent of file content changes.

4. **PROVEN-CLEAN evidence**: No evidence currently supports PROVEN-CLEAN classification. Required positive evidence includes: durable Event lookup, Artifact record + physical-file verification, in-progress operation/latch state, Event sequence integrity, and storage/filesystem consistency. Merely finding no Event or Artifact is insufficient.

5. **Library as derived index**: The Content Library is a derived search index, not an authoritative record. Artifact and Event records (when implemented) are authoritative; the Library can be rebuilt from them.

---

## 3. Five-Area Design Closure Matrix

### A. Artifact Identity and Immutable Storage

| Question | Proposed Rule | Rationale | Edge Cases | Unresolved Decision | Dependency |
|---|---|---|---|---|---|
| Can multiple Events refer to the same Artifact? | Yes. An Artifact is immutable bytes; Events are export occurrences. | Multiple exports may produce identical bytes; the Artifact represents the file, the Event records the occurrence. | If bytes differ, a new Artifact should be created. | Owner must decide: same `artifact_id` for identical bytes, or new `artifact_id` each time? | Event persistence, Artifact storage model |
| When bytes are identical, may existing Artifact be reused? | Yes, if SHA-256 matches AND physical file exists AND verification succeeds. | SHA-256 is computed for rendered video; could compare against existing Artifact's hash. | If physical file is missing or mismatched, new Artifact must be written. | Owner must confirm: SHA-256 equality alone sufficient, or additional path/lock check required? | SHA-256 computation, file existence check, verification procedure |
| What verification must succeed before reuse? | 1. SHA-256 of physical file matches Artifact's hash<br>2. File path is accessible and readable<br>3. File was written by trusted export process (same `content_id`, `script_version`) | Ensures integrity and provenance. | Malicious or corrupted files could have matching SHA-256 by extreme coincidence; verification of source is preferred. | Owner must decide granularity of verification. | Artifact record, physical-file access, source trust model |
| Missing/mismatched/unreadable file? | Treat as orphan; create new Artifact; flag in Library reconciliation. | No current mechanism. | If file existed previously but was deleted, system must reconstruct or mark gap. | Owner must decide: rebuild from Events, or accept gap? | Event records, Library rebuild logic |
| Immutable storage guarantee? | Content-addressed: Artifact identified by SHA-256; write to path that includes or maps to hash; never overwrite based on filename alone. | Currently, files written to `exportsDir/content_id/v{version}.mp4`; overwrite possible if same `content_id + script_version`. | Filename-based write risks overwrite when `content_id` and `script_version` repeat. | Owner must choose: content-addressed paths, or separate Artifact identity with overwrite guard? | Path design, Artifact ID scheme |
| `artifact_id` derived from SHA-256 or separate? | **Proposed default**: `artifact_id` remains a separate stable identifier; SHA-256 is the integrity verification field. Implications: (a) `artifact_id` survives file rotations/renames; (b) SHA-256 can change if file is regenerated while `artifact_id` stays; (c) content-addressed storage requires mapping from `artifact_id` → SHA-256 → path. | Deriving `artifact_id` from SHA-256 couples identity to content; separate `artifact_id` provides logical stability. | If SHA-256 is used as `artifact_id`, any file regeneration changes the ID, breaking references. | Owner must decide: separate `artifact_id` (recommended) or SHA-256-derived ID. | Artifact schema, migration from existing data |

### B. Export Event Persistence and Commit Boundary

| Question | Proposed Rule | Rationale | Edge Cases | Unresolved Decision | Dependency |
|---|---|---|---|---|---|
| One Event per request? | **Yes**. Each accepted export operation creates exactly one durable Event. | DDR v1.3 requires persistent Event records for audit and recovery. | Retry case must be explicitly defined (see below). | Owner must confirm: is "one Event per request" the design rule? | Event schema, persistence mechanism |
| Retry of same `export_request_id` returns existing outcome? | Yes. Retry of identical `export_request_id` returns the prior Event; no new Event created. | Ensures idempotency; prevents duplicate Event accumulation. | If fingerprint changes, treat as new request, new Event. | Owner must define fingerprint composition and change-handling. | `request_fingerprint` design, Event lookup |
| How `request_fingerprint` binds ID to inputs? | `request_fingerprint` = SHA-256(project_state + script_version + renderer_config + timestamp). Binds request to its exact inputs. | No current field; must be designed. | Same request ID with different fingerprint → new Event, prior Event remains. | Owner must approve fingerprint algorithm. | Project state, script version, renderer config |
| Same request ID reused with different fingerprint? | Treated as new export request; new Event created; prior Event retained. | Prevents silent corruption of audit trail. | Requires fingerprint change detection at Event creation. | Owner must define policy. | Fingerprint algorithm, Event creation logic |
| When Event becomes durable relative to Artifact and request binding? | Event becomes durable after: (a) Artifact file is written to disk, (b) Library index is updated, (c) Project status transitions to EXPORTED. All three must complete successfully. | Ensures commit atomicity: Event, Artifact, and status are consistent. | If crash occurs after Artifact write but before Library update, inconsistency results. | Owner must decide: two-phase commit, or eventual consistency with reconciliation? | Artifact persistence, Library update, status transition |
| Partially completed operation representation? | Represent as UNKNOWN until full commit; then EXPORTED. If crash mid-export, recovery procedure determines outcome. | No current mechanism; requires design. | Orphan files (written but not indexed) must be detected and handled. | Owner must define recovery procedure. | Crash recovery, orphan detection |
| Event sequence allocation and persistence atomicity? | Event sequence must be allocated and persisted atomically with Artifact write and status transition. | Prevents gaps in sequence where Event exists but Artifact is missing. | In distributed systems, true atomicity requires two-phase commit or idempotent sequence assignment. | Owner must decide: single-process sequence, or distributed-safe allocation? | Sequence mechanism, concurrency model |

### C. Retry, Recovery, PROVEN-CLEAN, and UNKNOWN

| Classification | Required Evidence | Sufficient? | Necessary? | Current Source Status |
|---|---|---|---|---|
| **Successfully committed** | Durable Event lookup succeeds AND Artifact record exists AND physical file is readable AND project status = EXPORTED | Yes, if all four conditions met. | No single condition sufficient alone. | Not implemented; no Event, Artifact verification only checks current file. |
| **Safely retryable (PROVEN-CLEAN)** | 1. Request binding + fingerprint verified<br>2. Durable Event lookup: no Event found for this request<br>3. Artifact record: no Artifact found with matching SHA-256 AND path<br>4. In-progress operation: no lock held, no render in progress<br>5. Temporary/orphan files: none detected matching this request<br>6. Authoritative state: readable and consistent across persistence layers<br>7. Storage/filesystem: no errors reported<br>8. Event sequence: integrity verified (no gaps) | Yes, if ALL eight conditions positively verified. | No—missing one condition does NOT make it PROVEN-CLEAN; must positively establish no commit occurred. | Not implemented. No Event, no fingerprint, no artifact-sha256 comparison, no orphan detection. |
| **Indeterminate (UNKNOWN)** | Evidence insufficient to classify as committed or PROVEN-CLEAN. | Yes, by definition. | — | Not implemented; outcome always assumed EXPORTED or error thrown. |
| **Failed but requiring reconciliation** | Artifact file present but Library index missing/changed; OR Library entry exists but physical file missing; OR Event record partially written. | Yes, if any of these conditions met. | — | Not implemented; no reconciliation procedure exists. |

**Key principle**: Do NOT classify an operation as `PROVEN-CLEAN` solely because an Event or Artifact was not found. Positive evidence is required to prove no commit occurred. If the system cannot obtain the required positive evidence, the outcome must be UNKNOWN, and a recovery procedure should be initiated.

### D. Content Library Reconstruction

| Question | Proposed Rule | Rationale | Edge Cases | Unresolved Decision |
|---|---|---|---|---|
| Artifact and Event records authoritative; Library is derived index? | Yes. Artifact + Event records are authoritative; Library is a searchable derived index rebuilt from authoritative records. | Supports historical retention and reconstruction after corruption/deletion. | — | Owner must confirm design direction. |
| Which fields reconstructed from Artifacts vs. which require Events? | From Artifact: `sha256, filename, path, bytes, provenance`. From Event: `export_request_id, event_seq, timestamp, outcome, fingerprint`. | Artifact provides file integrity; Event provides occurrence history. | If Event missing but Artifact present, Library can still list file but cannot show export occurrence details. | Owner must decide minimum viable Library fields. |
| Library rebuild after corruption/deletion without losing history? | Rebuild from Artifact + Event records; each Artifact-Event pair becomes a Library entry; missing physical files flagged as orphan. | Enables recovery; preserves export occurrence history. | If both Artifact and Event records lost, history is irrecoverable. | Owner must decide: accept data loss, or implement redundant persistence. |
| Missing physical files, missing Artifact records, inconsistent Events, orphaned files in reconciliation output? | Report as: `MISSING_FILE`, `MISSING_ARTIFACT`, `INCONSISTENT_EVENT`, `ORPHAN_FILE`. Each appears in reconciliation table with request ID and last known state. | Provides visibility into data gaps for Owner decision. | — | Owner must approve reconciliation output format. |
| Retrieval distinguishes current content, historical versions, production variants, repeated exports? | Library query supports: `content_id` (current), `content_id + script_version` (historical), `content_id + production_variant` (variants), `content_id + event_seq` (repeated exports). | Enables precise retrieval by use case. | `content_id` alone returns only latest entry; historical versions require explicit `script_version` filter. | Owner must decide: is `content_id` sufficient, or must query always include version filter? |
| `content_id` sufficient retrieval key? | No. `content_id` alone returns only the latest EXPORTED entry. Historical versions, repeated exports, and variants require additional filters (`script_version`, `event_seq`, etc.). | Prevents accidental overwrites or loss of history. | — | Owner must decide retrieval API design. |

### E. Content Lineage and Entity Responsibilities

| Entity | Responsibility | Relationships |
|---|---|---|
| **Content Project** | Owns `content_id, script_version, script_version_history, status, assets, provenance`. | Source of truth for content identity and versioning. |
| **Content Version (`script_version` + version history)** | Tracks script edits; each bump creates new version with checksum. | Project owns version history; exports reference `script_version`. |
| **Production Variant** | Defined by renderer configuration (width, height, fps, codec, container, encoder, font, pipeline). Changes when rendering parameters change. | Exported file includes variant metadata; same `content_id` can have different variants. |
| **Export Request / `REQUEST_BINDING`** | Binds `export_request_id` to project + script version + renderer config. Enables idempotent retries. | Project owns request binding; Event references request binding. |
| **Export Event** | Records individual export occurrence: `event_seq, request_fingerprint, outcome, timestamp, origin`. | Event references Project, Request Binding, Artifact. Multiple Events per Project possible. |
| **Artifact** | Records immutable file: `artifact_id, sha256, filename, path, duration, codec, provider, source`. | Artifact referenced by Event; may be shared across Events (identical bytes). |
| **Content Library Index Entry** | Derived: `id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status`. | Library entry filtered by `content_id + filename`; does not own history. |
| **Publication Record (future scope)** | To be designed; separates export preparation from external publication. | Not in current scope; future design item. |

**Scenarios**:

1. **Script edited and exported again**: `bumpScript` increments `script_version`; new export creates new Artifact (different SHA-256 likely), new Event, new Library entry. Prior Artifact/Event retained.

2. **Production settings change without script-version change**: Same `content_id + script_version`; if bytes differ, new Artifact should be created (content-addressed). If bytes same, existing Artifact can be reused (per content-addressed policy). Event always recorded for the occurrence.

3. **Same bytes reused across channels**: Single Artifact with shared `artifact_id`; multiple Events each reference the same `artifact_id`. Channel-specific metadata stored in Event, not Artifact.

4. **Derivative created from existing content project**: New Project with derived `content_id`; inherits `approach, product, offer` but new `script_version_history`. Exports from derivative are independent Events.

5. **Artifact exported repeatedly**: Same `artifact_id` reused; new Event each time. Library entries filtered by `content_id + filename`; may need content-addressed filter to avoid duplicates.

6. **Export prepared for publication but never published**: Event and Artifact are fully created and persisted; Library entry written; project status may advance to READY_TO_PUBLISH but no external publication occurs. Export ≠ Publication.

**Conflation warning**: Export, Export Preparation, and actual external Publication must remain separate. The current `buildPublishPrep` builds a payload and explicitly does not publish. This boundary must be preserved.

---

## 4. State Transition Tables

### 4.1 Request State Transition

| Current State | Event | New State | Transition Conditions |
|---|---|---|---|
| DRAFT | — | blocked | `export requires FINALIZED` guard |
| FINALIZED | Event created; Artifact written; Library updated | EXPORTED | All three: Event durable, Artifact on disk, Library index updated |
| EXPORTED | Retry of same `export_request_id` → existing Event returned | EXPORTED (no change) | Idempotent retry; no new Event |
| EXPORTED | New export request (different `export_request_id`) | EXPORTED | New Event created; prior Event retained |
| EXPORTED | Failed attempt (error thrown) | EXPORTED (unchanged) OR error state | Error does not revert status; manual recovery needed |

### 4.2 Artifact State Transition

| Current State | Event | New State | Transition Conditions |
|---|---|---|---|
| Artifact does not exist | New export writes file → new Artifact | ARTIFACT_EXISTS | File written to disk, SHA-256 computed |
| Artifact exists, SHA-256 matches | Reuse existing Artifact; Event records occurrence | ARTIFACT_REUSED | Verification: SHA-256 match + file readable |
| Artifact exists, SHA-256 mismatches | New Artifact written; old file orphaned | ARTIFACT_REPLACED | Physical file overwritten only if content-addressed policy allows; otherwise new path |
| Artifact file missing but record exists | Orphan detected; new Artifact written | ARTIFACT_REBUILT | Reconciliation procedure required |

### 4.3 Event State Transition

| Current State | Event | New State | Transition Conditions |
|---|---|---|---|
| No Event for this request | New export creates Event | COMMITTED | After: Artifact written, Library updated, status → EXPORTED |
| Event exists for same `export_request_id` | Retry returns existing Event | COMMITTED (no change) | Idempotent; no duplicate |
| Event partially written (crash) | Recovery procedure | UNKNOWN | Until positive evidence establishes commit or PROVEN-CLEAN |
| Event not found, no positive evidence | Classify as UNKNOWN | UNKNOWN | Recovery procedure initiates; outcome undetermined |

### 4.4 Recovery State Transition

| Trigger | Classification | Action |
|---|---|---|
| Crash after Artifact write, before Library update | UNKNOWN | Re-read: if Artifact file exists + Library has entry → EXPORTED; if Artifact exists but Library missing → rebuild Library; if neither → UNKNOWN, initiate recovery |
| Crash after Library update, before status → EXPORTED | UNKNOWN | Re-read: if status still FINALIZED → re-export permitted; if status → EXPORTED → Event + Artifact already durable |
| Orphan file detected (file on disk but no Library entry) | ORPHAN_FILE | Reconciliation: add Library entry if Artifact SHA-256 matches, or delete orphan file |
| Library entry exists but physical file missing | MISSING_FILE | Reconciliation: delete Library entry, or regenerate file if source available |
| Event record missing but Artifact present | UNKNOWN | Cannot prove commit status; initiate recovery; assume UNKNOWN until positive evidence obtained |

---

## 5. Commit and Recovery Invariants

The following properties must always hold, independent of implementation technology:

1. **Event-Artifact Consistency**: Every committed Export Event has a corresponding Artifact record with matching SHA-256, and the physical file at the Artifact's path is readable and its SHA-256 matches the record.

2. **Status-Event-Artifact Alignment**: Project status = EXPORTED if and only if a durable Event exists AND an Artifact record with matching SHA-256 AND a readable physical file all exist for the same `content_id` + `script_version`.

3. **Idempotent Retry**: Retry of the same `export_request_id` with the same `request_fingerprint` returns the existing outcome (Event + Artifact), without creating new Event or Artifact records.

4. **No Silent Overwrite**: An export operation must not silently overwrite an existing Artifact without recording the occurrence. If bytes are identical and content-addressed storage is used, the existing Artifact is reused and an Event is still recorded. If bytes differ, a new Artifact is created.

5. **Library as Derived Index**: The Content Library is always rebuildable from Artifact + Event records. No information is lost if the Library is corrupted, provided Artifact and Event records are intact.

6. **Orphan Detection**: Any physical file in the exports directory that has no corresponding Artifact record, or any Artifact record with no corresponding physical file, must be flagged as an orphan in reconciliation output.

7. **Event Sequence Integrity**: Event sequences must not have gaps when viewed per `content_id`. If a gap is detected, it indicates a lost or failed Event creation that requires reconciliation.

8. **Fingerprint-Bound Outcomes**: An `export_request_id` always maps to a well-defined outcome (Event + Artifact combination). Changing the `request_fingerprint` for the same ID creates a new outcome; the prior outcome is retained.

---

## 6. Entity Relationship Model (Conceptual, Proposed, Not Approved)

```
Content Project
  1 ──── 1..n  Content Version (script_version, script_version_history)
  1 ──── 1..n  Export Request (export_request_id, request_fingerprint)
  1 ──── 1..n  Export Event (event_seq, outcome, timestamp, request_fingerprint)
          n ──── 1     Artifact (artifact_id, sha256, filename, path, provenance)
          1 ──── n     Content Library Index Entry (id, filename, sha256, exported_at, ...)

Content Version
  1 ──── 1..n  Script edit entries (version, at, reason, checksum)

Export Request
  1 ──── 1      Request Binding (binds ID to project + script_version + renderer config)

Export Event
  n ──── 1     Artifact (may share artifact_id if bytes identical)
  1 ──── 1     Content Project (originating project)
  1 ──── 1     Export Request (request binding)

Artifact
  1 ──── 1     Physical file (bytes, path, sha256)
  │            n ──── Export Event (may share across identical-byte exports)
  │            1 ──── Content Library Index Entry (via sha256 match)

Content Library Index Entry
  n ──── 1     Artifact (derived; may have multiple entries per artifact_id if different content_id)
  │            n ──── Export Event (derived; may have multiple entries per event_seq)
```

**All relationships marked as proposed and not approved.** The Owner must ratify this model before DDR v1.3 compliance can be assessed.

---

## 7. Owner Decision Register

| # | Decision Required | Options | Consequences | Recommended Default | Blocks Design? |
|---|---|---|---|---|---|
| 1 | Implement Export Event mechanism? | A. Implement full Event persistence (recommended)<br>B. Adjust DDR v1.3 scope to remove Event requirement | A: Enables audit, retry, recovery, historical retention. Requires new schema, persistence, and code changes. B: DDR v1.3 remains unfulfilled in this area; may require formal DDR amendment. | **A** (implement Event) | Blocks: retry, recovery, PROVEN-CLEAN, Library reconstruction |
| 2 | `artifact_id` derived from SHA-256 or separate? | A. `artifact_id` = SHA-256 (content-addressed identity)<br>B. `artifact_id` separate stable identifier (recommended) | A: Identity couples to content; any regeneration changes ID. B: Identity survives file rotations/renames; content-addressed storage requires mapping. | **B** (separate `artifact_id`) | Blocks: Artifact identity model, content-addressed storage design |
| 3 | Library overwrite-versus-history-preservation? | A. Library always pushes new entry (current behavior)<br>B. Library filters by `content_id + artifact_id + sha256`; reuses entry if identical (history-preserving) | A: Library grows unbounded; may have duplicate entries per `content_id`. B: Library stays compact; historical entries retained via Event records; Library is derived index only. | **B** (history-preserving, Library as derived index) | Blocks: Library design, retrieval API |
| 4 | Retry / Recovery state machine? | A. Implement full PROVEN-CLEAN/UNKNOWN/orphan machinery (recommended)<br>B. Document design-only; defer to future Vertical Slice | A: Enables safe retries, crash recovery, deterministic outcomes. B: No runtime guarantees; outcomes may be non-deterministic. | **A** (implement state machine) | Blocks: DDR v1.3 compliance, safe export operations |
| 5 | Variant differentiation strategy? | A. Production Variant as separate Artifact + Event (each render config gets own)<br>B. Variant metadata stored in Event only; Artifact shared if bytes identical | A: Each variant gets own Artifact; higher storage. B: Artifact shared; Variant described in Event; retrieval requires Event query. | **B** (variant in Event, Artifact shared if bytes identical) | Blocks: variant retrieval, export scenario design |

**Decisions blocking DDR v1.3 internal consistency**: 1, 2, 3, 4. All five are recommended for implementation, but 1-4 are required before DDR v1.3 can be considered internally consistent.

---

## 8. DDR v1.3 Contradiction Log

The following DDR v1.3 requirements conflict with the current source implementation, or have ambiguous wording requiring Owner clarification:

| DDR v1.3 Statement | Conflict/Ambiguity | Proposed Wording |
|---|---|---|
| "Each export request must create one durable Event record." | No Event mechanism exists in source. `exportProject` writes Library entry but no Event. | "Each export request creates one durable Event record, persisted alongside the Artifact and Library index entry. Event includes `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, and `timestamp`." |
| "Artifacts must be content-addressed; SHA-256 identifies the stored file." | No `artifact_id` field; SHA-256 computed but not used as storage key. File path is `content_id/v{version}.mp4`, not content-addressed. | "Each Artifact record contains `artifact_id` (stable logical identity) and `sha256` (integrity verification). Storage path may be content-addressed or mapped from `artifact_id`. SHA-256 alone does not determine path." |
| "Repeated exports of identical bytes must reuse the existing Artifact." | Current code filters by `content_id + filename`; new entry pushed regardless of SHA-256. No content-addressed reuse logic. | "When an export produces bytes with SHA-256 matching an existing Artifact (same `content_id`, same `script_version`), the existing Artifact is reused. A new Event is still recorded for the occurrence. If bytes differ, a new Artifact is created." |
| "PROVEN-CLEAN classification requires positive evidence of no commit." | No such classification exists; code always assumes success or throws error. | "An operation is PROVEN-CLEAN when all eight pieces of positive evidence are verified: request binding + fingerprint, durable Event lookup (no Event for this request), Artifact record (no matching SHA-256 + path), in-progress operation (no lock/render), temporary/orphan files (none), authoritative state (readable/consistent), storage/filesystem (no errors), Event sequence (no gaps)." |
| "Library must support retrieval of historical export versions." | Library is latest-entry only; `content_id` returns only newest EXPORTED entry. No historical version retrieval without explicit `script_version` filter. | "Library retrieval supports: `content_id` (current/latest), `content_id + script_version` (historical version), `content_id + event_seq` (repeated export occurrence). `content_id` alone is not sufficient for historical queries." |
| "Orphan files must be detected and reconciled." | No orphan detection or reconciliation procedure exists. | "Reconciliation output flags: `MISSING_FILE`, `MISSING_ARTIFACT`, `INCONSISTENT_EVENT`, `ORPHAN_FILE`. Each includes request ID and last known state. Orphan remediation is a separate operator procedure." |

---

## 9. Vertical Slice Proposal (Smallest Future Validation Slice)

**Scope**: Demonstrate Artifact preservation, Event persistence, safe retries, and Library reconstruction for a single content project.

**Evidence criteria only** (not executed):

1. **Artifact preservation**: After single export, verify Artifact record exists in a structured format (not just Library JSON); verify SHA-256 of physical file matches Artifact's hash.

2. **Event persistence**: After single export, verify Event record exists with `event_seq`, `export_request_id`, `request_fingerprint`, `outcome`, `timestamp`. Verify Event is durable (not in-memory only).

3. **Safe retry**: After first export, retry same `export_request_id`; verify existing Event returned, no new Event created, Artifact unchanged.

4. **Library reconstruction**: After Artifact + Event records are in place, simulate Library corruption (delete `content-library.json`); verify Library can be rebuilt from Artifact + Event records without losing history.

**Dependencies on Owner decisions**: This slice cannot be executed until Owner decisions in Section 7 are ratified, particularly:
- Event mechanism implementation (Decision 1)
- `artifact_id` scheme (Decision 2)
- Library overwrite policy (Decision 3)
- Retry/recovery state machine (Decision 4)

**No repository changes, no runtime validation, no implementation approval** are performed in this report. The Vertical Slice Proposal describes scope and evidence criteria only.

---

## 10. Unverified Assumptions and Limitations

| Item | Status |
|---|---|
| DDR v1.3 text availability | The exact DDR v1.3 specification was not provided in this workspace; contradictions and ambiguities are inferred from the design discussion context and prior reports. |
| Source code completeness | Inspection covered `app/mvp/content.js` and `app/mvp/service.js` working tree at HEAD `795dc0a6ac66bef19725184107e6474b41aa1823` on branch `mission1-planning-docs`. Other files or directories may contain relevant code not inspected. |
| Git baseline accuracy | Reported baseline `795dc0a6ac66bef19725184107e6474b41aa1823` on `mission1-planning-docs` was verified against working tree; no discrepancy found. |
| No runtime operations performed | Application was not started, no HTTP requests issued, no tests executed, no state changes made. All findings based on static code analysis. |
| Event mechanism not inferred | The complete absence of `export_event`, `export_request_id`, `request_fingerprint`, `event_seq`, `PROVEN-CLEAN`, `UNKNOWN`, and orphan detection was confirmed via grep across inspected scope. |
| SHA-256 computation verified | `crypto.createHash('sha256').update(value).digest('hex')` is used in multiple places (content.js:sha256 helper, rendered.sha256, library entry sha256, asset sha256). Behavior verified from source. |
| Library index format verified | `data/mission1/content-library.json` format: `{ items: [{id, filename, sha256, exported_at, width, height, duration_s, aspect_ratio, status}] }`. Verified from file content. |
| `withLock` usage verified | `handleContentExport` uses `withLock` for concurrent request prevention; scope limited to in-process queue, not distributed crash recovery. |
| `ACE_CONTENT_LIBRARY_FILE` env var convention | Override convention for library path verified from `content.js:1135-1145` and `README.md`. |
| No external services contacted | All inspection was local; no HTTP requests, no database queries, no Cloudflare or Sites integration. |
| Design recommendations not approved | All proposed rules, defaults, and model relationships are explicitly marked as proposed and not approved. Owner ratification required. |

---

## Appendices

### A. Confirmed Overwrite and History-Retention Behavior

| Scenario | Current Behavior | Classification |
|---|---|---|
| Same `content_id + same script_version` re-export | Library filter removes old entry by `content_id + filename`; new entry pushed. Physical file `content_id-v{version}.mp4` overwritten. SHA-256 of new render may differ from old. | **Overwrite** (not history-preserving) |
| Same `content_id + different script_version` | New file `content_id-v{newVersion}.mp4` created; old file retained on disk but Library entry filtered/overwritten by `content_id + filename` match. | **Partial** (new file, old Library entry lost) |
| Production settings change, script_version unchanged | Same output filename; new render may produce different bytes. Library entry overwritten if `content_id + filename` match. Physical file overwritten. | **Overwrite risk** (settings change not captured) |
| Two exports produce identical bytes | Library filter only checks `content_id + filename`; new entry pushed regardless of SHA-256. Both entries exist in Library; physical file overwritten. | **No deduplication** (Library grows; bytes may be identical) |

**Key finding**: The current Library is **not** content-addressed and does not guarantee historical retention. It is a latest-entry catalog. Any design for immutable storage and history retention must add content-addressed Artifact identity and explicit overwrite-versus-history-preservation logic.

### B. Confirmed Export Scenario Trace (Single Export, No Retry)

```
1. Project status = FINALIZED → guard passes
2. renderer.ffmpegAvailable() → must be true; else 503 error
3. outDir = path.resolve(exportsDir, content_id) → created if missing
4. outFile = path.join(outDir, `${content_id}-v{script_version}.mp4`)
5. Assets gathered from project.asset_order; bound to scenes
6. renderer.renderVideo({scenes, outFile, workDir, assets}) → renders MP4
7. renderer.probeVideo(outFile) → codec/container metadata
8. Still frame extracted via ffmpeg → ${content_id}-preview.png (optional)
9. Library index read from content-library.json
10. Old entry filtered: items where item.id === content_id && item.filename === basename(outFile)
11. New library entry pushed: {id: content_id, filename: basename(outFile), sha256: rendered.sha256, exported_at: now, width, height, duration_s, aspect_ratio: '9:16', status: 'EXPORTED'}
12. Library index written back to content-library.json
13. project.status → EXPORTED
14. project.export = { exported_at, file, filename, bytes, sha256, width, height, fps, duration_s, aspect_ratio, codec, container, encoder, font, pipeline, audio, still, script_version, script_checksum, asset_refs, limitations }
15. project.updated_at → nowIso()
16. project.edit_log.push({change: 'export wideo'})
17. Return project.export
```

### C. Full List of Inspected Files

- `app/mvp/content.js` — full inspection (STATUSES, createContentProject, buildPublishPrep, exportProject, getLibraryItem, readContentLibrary, contentLibraryFile, STATUSES, assertTransition, buildFinalizeChecklist, finalizeProject, and all export/asset/QA functions)
- `app/mvp/service.js` — route registration and handler functions: handleContentExport, handleContentPublishPrep, handleContentLibraryItem, main route dispatcher
- `data/mission1/content-library.json` — library index format and existing entries
- `data/app/state.json` — app persistence state (git-ignored)
- `.gitignore` — confirms data/app/state.json is git-ignored
- `README.md` — project boundaries, run instructions, ACE_MVP_* env var conventions
- `package.json` — project dependencies, engines
- `app/observability/posthog-ai.js` — AI observability pass-through (no core export Event)

### D. Confirmed Status Invariants (Preserved)

```text
Runtime Validation = NOT PERFORMED
Implementation = NOT APPROVED
Z1 / Mission 1 Status = UNCHANGED
contractResolutionStatus = UNRESOLVED
Row 18 / Row 3c = PENDING RECONCILIATION
Canonical precedence = PENDING CONFIRMATION
Baseline captured and accepted = NO
ACS Seed Consolidation = PENDING OWNER REVIEW
ACS Implementation = NOT APPROVED
```