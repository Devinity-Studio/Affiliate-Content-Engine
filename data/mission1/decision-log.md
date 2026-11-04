# Mission 1 — Decision Log (append-only)

Location approved by the owner on 2026-10-19. Path: `data/mission1/decision-log.md`.

Rules:
- Append only: a prior record is never edited, reclassified, or deleted. A correction is a new record that references the earlier id.
- Schema: `docs/mission1/D-data-model.md` §3.8 — `id`, `gate`, `decided_at`, `result`, `rationale`, `related_ids`, `approver`.
- `gate`: G1 / G2 / G3 / G4 / G5 / G_PAY. `result`: APPROVED / REJECTED / APPROVED_WITH_NOTES.
- `approver`: `owner` only. The engine may record a decision but never make one.

---

## DEC-1-G1 — G1 plan approval

| Field | Value |
|---|---|
| **id** | `DEC-1-G1` |
| **gate** | `G1` |
| **decided_at** | `2026-10-19` |
| **result** | `APPROVED_WITH_NOTES` |
| **rationale** | Approved the Mission 1 plan and Phase 1 (Foundation & Access) with notes, for Cycle 1 only, under a THB 0 budget. Scope is the Foundation Slice; public-source research and read-only channel eligibility checks may be planned but were not performed while recording this decision. Affiliate applications, account changes, content production, publication, purchases, paid services, paid APIs, advertising, and automation are not authorized. G2, G3, G4, G5 and G-pay remain separate gates and are not approved by this record. OQ-8 continues to block any claim that net income is measurable until program-specific commission semantics are verified from real evidence. |
| **related_ids** | Plan documents A–K; Cycle 1 (no EXP/SCR/PUB/asset exists yet) |
| **approver** | `owner` |

### Recording metadata (not additional Decision schema fields)

| Item | Value |
|---|---|
| Cycle | 1 |
| Scope | Foundation Slice only |
| Budget | THB 0 — this decision does not authorize spending; any amount > 0 requires a G-pay record before the action |

### Owner notes (verbatim, Thai)

1. เริ่มจากการสร้างและตรวจสอบไฟล์ Foundation ตาม Roadmap และ Data Model ที่มีอยู่ โดยไม่เขียนทับการเปลี่ยนแปลงเดิมของผู้ใช้
2. อนุญาตให้ตรวจสอบข้อมูลสาธารณะและตรวจสอบสิทธิ์ของช่องทางแบบ read-only
3. อนุญาตให้ยื่นใบสมัคร Affiliate Program เฉพาะเมื่อไม่มีค่าใช้จ่ายหรือข้อผูกพันที่ยังไม่ได้ตรวจสอบ หากพบเงื่อนไขดังกล่าว ให้หยุดและขออนุมัติก่อน
4. ไม่อนุญาตให้ผลิตหรือเผยแพร่เนื้อหาจริง ซื้อบริการ ลงโฆษณา เชื่อมต่อ Paid API หรือทำ Automation
5. G2, G3, G4, G5 และ G-pay ยังคงเป็น Gate แยกจากกัน การอนุมัตินี้ไม่ถือเป็นการอนุมัติ Gate เหล่านั้น
6. สถานะของหลักฐานทุกชิ้นต้องตรงกับสิ่งที่ตรวจสอบจริง พร้อมแหล่งที่มาและวันที่ตรวจสอบ ห้ามอนุมานว่าได้รับอนุมัติเพียงเพราะส่งใบสมัครแล้ว
7. ก่อนขอ G2 ต้องมีหลักฐานว่าโปรแกรมที่เลือกเข้าร่วมได้หรือมีสถานะที่ชัดเจน ช่องทางรองรับรูปแบบลิงก์ที่ต้องการ มี Opportunity Brief ที่ผ่านการคัดเลือกพร้อมหลักฐานอย่างน้อย 2 รายการ และมีข้อมูลเงื่อนไขค่าคอมมิชชันกับ Channel Policy Checklist
8. OQ-8 ยังคงบล็อกการคำนวณรายได้สุทธิที่อ้างว่าวัดผลได้ จนกว่าจะยืนยันความหมายของข้อมูลจากแหล่งจริง
9. หากพบค่าใช้จ่าย ความเสี่ยงที่ไม่ได้รับอนุมัติ หรือข้อกำหนดที่ไม่ชัดเจน ให้หยุดและรายงานก่อนดำเนินการต่อ

การอนุมัตินี้ครอบคลุม Phase 1 เท่านั้น และต้องทบทวนใหม่หากแผนเปลี่ยนแปลงอย่างมีนัยสำคัญ

### English gloss (non-authoritative; the Thai text above governs)

1. Begin by creating and verifying the Foundation files per the Roadmap and Data Model, without overwriting the user's existing changes.
2. Public-source research and read-only channel eligibility checks are permitted.
3. Affiliate-program applications are permitted only where there is no cost or unchecked obligation; stop and request approval if one appears.
4. No real content production or publication, no paid services, no advertising, no paid API, no automation.
5. G2, G3, G4, G5 and G-pay remain separate gates; this approval does not approve them.
6. Every evidence status must reflect what was actually inspected, with source and retrieval date; submission is never treated as approval.
7. Before requesting G2: evidence that the chosen program is joined or clearly joinable, a channel that supports the required link form, a selected Opportunity Brief with ≥2 evidence references, commission terms, and the Channel Policy Checklist.
8. OQ-8 continues to block any net-income figure claimed as measurable until field meanings are verified at source.
9. On any cost, unapproved risk, or unclear requirement: stop and report before continuing.

### Recording note

Recorded on 2026-10-19 at the path confirmed by the owner. `decided_at` is date-precision, as supplied by the owner. This record documents the owner's decision only; it is not a commit, a deployment, or an external approval, and it authorizes no action beyond the Foundation Slice.
