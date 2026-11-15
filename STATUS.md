# ACE — สถานะล่าสุด (บันทึกไว้ 15 พ.ย. 2026)

## วิธีเปิดใช้งาน
```bash
cd "Y:/DevProject/Affiliate Content Engine"
node app/server.js
```
- เปิด `http://127.0.0.1:4173/` → เด้งไป `/mvp.html` (แอปหลัก)
- หน้าเดิม (Mission 1) ยังอยู่ที่ `http://127.0.0.1:4173/mission.html`
- เซิร์ฟเวอร์รันล่าสุด: PID **40044** (พอร์ต 4173)

## ไฟล์สำคัญ
| ไฟล์ | หน้าที่ |
|---|---|
| `app/public/mvp.html` | UI ทั้งหมด (CSS ฝังใน `<style>`) — 8 stage shell |
| `app/public/mvp.js` | logic ฝั่ง client ~3,500 บรรทัด (pool, plan, storyboard, actor, capture, source, library) |
| `app/mvp/offers.js` | ตัวแยกข้อความหน้า Product Offer (rule-based, ไม่ใช้ AI) |
| `app/mvp/actors.js` | สร้าง casting sheet นักแสดงด้วย AI |
| `app/mvp/snap.js` | AI อ่านข้อมูลสินค้า + ร่างคอนเทนต์ |
| `app/mvp/service.js` | router `/api/mvp/*` |
| `app/public/index.html` | หน้า redirect → `/mvp.html` |

## ฟีเจอร์ที่พร้อมใช้
**Research**
- วางข้อความจาก `affiliate.shopee.co.th/offer/product_offer` → แยกเป็นสินค้ารายตัว (100 รายการ/ครั้ง), พรีวิว + ติ๊กเลือก + เพิ่มเข้าคลัง, ค่าคอมเป็นบาทคำนวณให้
- **Capture bookmarklet** เก็บสินค้า+รูปจากหน้า Shopee ที่ล็อกอิน (ไม่ต้องใช้ Open API)
- ค้นหาทั่วคลัง + โหลดเพิ่มทีละ 30
- **Candidate Pool เริ่มจากศูนย์** — ไม่มีข้อมูลปลอมแล้ว; นำเข้าจาก Product Offer (rule-based) หรือ **✨ อ่านด้วย AI** (AI ลอง 2 ครั้งอัตโนมัติถ้าครั้งแรกไม่พบ) หรือ Capture bookmarklet
- Source Library: เพิ่ม/ลบแหล่งข้อมูลได้, การ์ดที่มี URL มีปุ่ม ↗ เปิด, กันเพิ่มซ้ำ, มีปุ่มลัด 4 เมนู Shopee

**Plan**
- เรื่องย่อ / รูปแบบฉาก / แสง / องค์ประกอบ / 4 beats (timecode ระดับเฟรม 30fps)
- รูปแบบคอนเทนต์: Live action / Motion Graphic / ภาพนิ่ง (นักแสดงไม่บังคับ)
- เลือกนักแสดงจาก Actor Studio หรือ **✨ สร้างด้วย AI**
- ปุ่ม "แยกย่อยเป็น Breakdown" → 8 ช็อต

**Storyboard / Production**
- ตารางช็อต (timecode, มุมกล้อง, แสง, องค์ประกอบ, การกระทำ, beat)
- Production สรุปงานต่อจาก Storyboard

**Actor Studio 1.0** (overlay เต็มจอ)
- 5 หมวดหมู่: มนุษย์ / การ์ตูน 2D / การ์ตูน 3D / มาสคอต / สินค้า-วัตถุ
- ฟิลด์: ชื่อ บทบาท สถานะ ภาษา เสียง รูปร่างหน้าตา ชุด แท็ก รูป (URL หรืออัปโหลด ≤900KB) หมายเหตุ
- Generate ด้วย AI (casting sheet) 1–3 คน, ทำสำเนา, ลบ, นับ "ใช้แล้ว N งาน"
- เก็บถาวรใน `localStorage` key `ace.actors.v1`

**Finalize / Schedule**
- Finalize แสดง Content Library (5 รายการ seed จาก pool) อนุมัติ/ปฏิเสธได้
- Schedule แสดงฟอร์มตั้งเวลา + ตารางคลัง

## API ที่ใช้
| Endpoint | งาน |
|---|---|
| `POST /api/mvp/offers/parse` | แยกข้อความ Product Offer (rule-based) |
| `POST /api/mvp/snap/offers` | แยกด้วย AI (fallback) |
| `POST /api/mvp/snap/extract` | AI อ่านข้อมูลสินค้าเดี่ยว |
| `POST /api/mvp/snap/content` | AI ร่างคอนเทนต์ |
| `POST /api/mvp/actors/generate` | AI สร้าง casting sheet นักแสดง |

## ทดสอบเร็ว ๆ (3 นาที)
1. เปิด `/` → เห็นหน้า Research (5 การ์ด EXAMPLE, โดนัทคุณภาพ 5 รายการ)
2. วางข้อความ offer 2–3 สินค้าในช่อง "ข้อเสนอผลิตภัณฑ์" → "อ่านข้อเสนอทั้งหมด" → "เพิ่มเข้าคลัง"
3. คลิกการ์ดสินค้า → hero + ลิงก์/ช่องทาง; ไป stage **Plan** → ใส่เรื่องย่อ → เลือกนักแสดง (หรือ ✨ สร้างด้วย AI) → "แยกย่อยเป็น Breakdown"
4. ตรวจ Storyboard (8 ช็อต) → Production → Finalize (คลัง 5 แถว)
5. Source Library: กด "+ เพิ่มแหล่งข้อมูล" ใส่ชื่อ+URL → กด ↗ เปิด, กด × ลบ

## ข้อจำกัดที่รู้อยู่
- ข้อมูล candidate / plan / storyboard อยู่ใน memory — **refresh แล้วหาย** (ยกเว้น Actor Studio ที่เก็บใน localStorage)
- ไม่มี OCR/vision, ไม่มี image/video generation — AI ที่มีคือ text model (`nvidia/nemotron-3.5-lightning:free` ผ่าน OpenRouter)
- เรียก Shopee API ไม่ได้ (ยังไม่ให้สิทธิ์) → ใช้ capture/วางข้อความแทน; ACE เปิดเมนู Shopee ให้เองไม่ได้
- Figma ของใบงานนี้ยังไม่ได้ทำ: pipeline อนุมัติ → Publish Queue (เวลา+ช่องทาง) → เผยแพร่จริง, Mini Loop ↔ Quality Check จอเต็ม + Active Lineage, Dashboard/Report (ยังเป็นข้อมูลตัวอย่าง)

## งานถัดไป (ยังไม่เริ่ม)
1. Publish pipeline: Content Library → อนุมัติ (ยืนยันเวลา + ติ๊กช่องทาง) → Publish Queue → ปรับเวลา/ช่องทางได้
2. Quality Check จอเต็ม + timeline ระดับเฟรม + Mini Loop (แก้เฉพาะช่วง) + Active Lineage
3. Actor Studio 2.0 (schema v2 + ปรับแต่งละเอียด + reference หลายมุม + voice profile)
4. Import CSV รายงานจาก Shopee เพื่อผูกผลจริง (คลิก/ยอดขาย/ค่าคอม) กับ candidate
5. ตัวเก็บข้อมูลเฉพาะหน้าแคมเปญ/feed (ต้องดู DOM จริงก่อน)
