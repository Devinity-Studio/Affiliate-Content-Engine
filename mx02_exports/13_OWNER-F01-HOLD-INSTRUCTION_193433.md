รับทราบครับ — F-01 HOLD และจะไม่แตะ §10, RA-1/D-1 หรือประกาศ supersede จนกว่าจะได้ต้นฉบับ ACE-ODR-TR11-001 ที่ Owner ยืนยัน

ด้านล่างคือ แนวทางแก้ไขที่เตรียมไว้ (ยังไม่ถูกนำไปใช้กับเอกสาร และไม่มีการจัดทำ v1.2)

F-02 — แยก Git recovery ออกจาก byte recovery

ตำแหน่ง: §4 B-6 ข้อ 3
วิธีแก้: แทนข้อ 3 ด้วยสองฟิลด์

3a. Git recovery availability (path exists in Git): AVAILABLE / NOT AVAILABLE / UNVERIFIED
3b. Recovery yields captured bytes: YES / NO / UNVERIFIED
YES ใช้ได้เฉพาะเมื่อการกู้คืนจาก Git ให้ไบต์ตรงกับ B-2 ทุกประการ
ไฟล์ tracked-modified ทั้งสองต้องบันทึก NO เว้นแต่พิสูจน์ได้ว่า captured bytes มีอยู่ใน Git

F-03 — ระบุสถานะของ Gate 3 scripts แบบอิงหลักฐาน

ตำแหน่ง: §4 B-6 ต่อจากรายการข้อมูล
ข้อความที่เสนอ:

verification/openrouter-gate3-offline-check.js — untracked ใน branch ที่ตรวจ; ไม่พบเส้นทางกู้คืนจาก Git ภายในหลักฐานการตรวจที่บันทึกไว้; การมีหรือไม่มีในตำแหน่งอื่นยังไม่ได้รับการตรวจสอบ
verification/openrouter-gate3-script-validation-check.js — เช่นเดียวกัน
Preservation Package coverage คงเป็น UNVERIFIED (Owner) โดยไม่ปรับเป็น COVERED/NOT COVERED

F-04 — เพิ่ม Rollback Authorization ใน §2

ตำแหน่ง: §2 Decision separation หลังข้อ 5 (Implementation Authorization) หรือก่อนข้อ 7
ข้อความ:

Rollback Authorization — อนุญาตให้ดำเนิน File-Level Rollback ตาม §6 เมื่อมีเหตุจำเป็น

(ปรับลำดับข้อถัดไปตามความเหมาะสม โดยไม่เปลี่ยนความหมาย)

F-05 — ปิดช่อง git checkout

ตำแหน่ง: §6.1 ข้อ 1
ข้อความเพิ่ม:

ห้ามใช้ git checkout -- <path> หรือคำสั่ง Restore แบบกว้างแทน File-Level Rollback เช่นเดียวกัน

F-06 — เกณฑ์ยืนยัน "Option B-created"

ตำแหน่ง: §4 B-4 (หลัง bullet การลบ directory) และ §6 ตาราง
ข้อความ:

เกณฑ์ยืนยันว่าสร้างโดย Option B: (a) B-1 บันทึก ABSENT; (b) เวลาสร้างหลัง implementation start; (c) เนื้อหาตรงกับชุดไฟล์ที่ Option B สร้าง; หากข้อใดยืนยันไม่ได้ → หยุดและขอ Owner review

F-07 — ผูก AC-09 กับ Phase D

ตำแหน่ง: §5 Phase D รายการผลลัพธ์
ข้อความเพิ่ม:

AC-09 verification: B-4 เป็น path-specific และครบถ้วน

F-10 — Phase D ต้องมี destination และการยืนยันของ Owner

ตำแหน่ง: §5 Phase D
ข้อความเพิ่ม:

Baseline destination (absolute path)
Owner destination confirmation record (วันที่/ผู้อนุมัติ/ข้อความยืนยัน)

F-08 / F-09 — คงเป็นข้อเสนอ (non-blocking)

F-08: manifest hash ของ Baseline Package (ไม่บังคับ)
F-09: ระบุ semantics ของการนับรายการใน git status --porcelain=v1 เมื่อมี rename (สอง path ต่อหนึ่ง entry)

เงื่อนไขก่อนจัดทำ v1.2

ได้รับต้นฉบับ ACE-ODR-TR11-001 ที่ Owner ยืนยัน → ใช้แก้ F-01 ตามต้นฉบับเท่านั้น
ได้คำสั่ง Owner ให้จัดทำ v1.2
จึงรวม F-02–F-07, F-10 (และ F-08/F-09 หากต้องการ) เข้าเป็นฉบับเดียว

สถานะ

รายการ	สถานะ
v1.1	DRAFT — PROPOSED — NOT APPROVED (ไม่ถูกแก้)
F-01	HOLD — รอต้นฉบับ Owner Decision Record
F-02/F-03/F-04–F-07/F-10	แนวทางพร้อม — ยังไม่นำไปใช้
Baseline Capture	NOT AUTHORIZED
Option B Implementation	NOT AUTHORIZED
Review Stage	CLOSED
Gate 3 / A2 / Gate C	UNCHANGED

ไม่มีการตรวจหรือแก้ Repository, ไม่มีการ Capture/คำนวณ Hash, ไม่มี Execute/Test/Restore/Rollback และไม่มีการเปลี่ยน Gate หรือ Authorization ในเทิร์นนี้ครับ