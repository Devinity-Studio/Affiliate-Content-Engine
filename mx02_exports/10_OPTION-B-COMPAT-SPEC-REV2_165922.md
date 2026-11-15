เพื่อน รอบนี้เราได้ข้อมูลสำคัญที่สุดของ Option B แล้วครับ โดยเฉพาะผล per-symbol dependency audit ซึ่งทำให้พบว่า **ขอบเขตการย้าย AI block ยังไม่สะอาดพอที่จะล็อกเป็น deletion boundary** และมี dependency ภายใน `content.js` ที่ต้องตัดสินใจก่อนเริ่ม implementation

ผมจะยึดผลตรวจที่คุณรายงานเป็นหลักฐานของรอบนี้ แต่ขอแยกสถานะให้ชัด: เป็น **ผลตรวจที่ Owner รายงานจากการตรวจ source** ไม่ใช่ผลที่ผมเปิด repository ตรวจซ้ำด้วยตัวเองในรอบนี้

ข้อสรุปทางเทคนิคของผม:

- Fixture matrix เปลี่ยนจาก 40 เป็น **8 proposed cells** เพราะมี candidate ที่ผ่าน status gate เพียง 1 รายการ
- U-1 เรื่อง approach keys ปิดได้แล้ว
- UI caller ตรวจแล้ว ไม่พบการส่ง `useLlm` หรือ `scriptDraft`
- Provider status, fallback reason และ trace status เป็นคนละ vocabulary ต้องแยก contract
- การย้าย AI block ยังต้องแก้ inbound dependencies ได้แก่ `nowIso`, `sha256`, `httpError`, `money` และ dependency อื่นที่เกี่ยวข้อง
- Rollback ต้องอิง baseline ที่เก็บรักษาไว้ ไม่ใช่ `HEAD` เพราะการคืนไฟล์จาก `HEAD` อาจทำลายงาน AI ที่มีอยู่ก่อน Option B

ด้านล่างคือ specification ฉบับปรับแก้ที่ผมเสนอให้ใช้แทนฉบับก่อนหน้า

---

# OPTION B — STRICT PROVIDER ISOLATION COMPATIBILITY SPECIFICATION

**Project:** Affiliate Content Engine — Mission 1  
**Scope:** E1 / AI Provider Separation  
**Document status:** RECONCILED SPECIFICATION PROPOSAL — PENDING OWNER APPROVAL  
**Mode:** Read-only design and evidence reconciliation  
**Execution authority:** NOT GRANTED

## Evidence classification

| Label | Meaning |
|---|---|
| **[REPORTED]** | ผลตรวจ source ที่ Owner รายงานในรอบนี้ |
| **[VERIFIED]** | ข้อมูลที่ยืนยันจาก source โดยตรงในหลักฐานที่ระบุ |
| **[INFERENCE]** | ข้อสรุปจากโครงสร้าง source โดยยังไม่ได้ทดสอบ runtime |
| **[PROPOSED]** | ข้อกำหนดหรือแนวทางที่เสนอ |
| **[UNVERIFIED]** | ยังไม่มีหลักฐานเพียงพอ |
| **[OWNER]** | ต้องได้รับการตัดสินใจหรืออนุมัติจาก Owner |

> ในเอกสารนี้ ผลตรวจที่มาจากการตรวจของ Owner จะระบุเป็น [REPORTED] แม้ว่าจะมี path และ line reference ประกอบ เพื่อไม่ให้เข้าใจผิดว่า Super Brain ได้ตรวจ repository ซ้ำแล้ว

## 1. Executive decision

เลือกแนวทาง **Option B — Strict Provider Isolation** โดยกำหนดให้มีการแยกสองระดับ:

1. Runtime Isolation — deterministic E1 ต้องไม่เรียก AI Provider
2. Module Isolation — deterministic E1 ต้องไม่โหลด AI module หรือ Provider module เข้ามาใน module graph

เป้าหมาย architecture:

```text
DETERMINISTIC E1

server.js
  └── service.js
        └── content.js


AI OPT-IN

server.js
  └── service.js
        └── if (useLlm === true)
              └── ai/script-draft.js
                    ├── provider/openrouter.js
                    └── provider/provenance.js
```

การแยก AI module เพียงอย่างเดียวไม่เพียงพอ หาก `service.js` ยังคง require AI module ตั้งแต่เริ่มต้น

**ข้อกำหนดหลัก:** `require('./ai/script-draft')` ต้องอยู่ภายใน opt-in branch เท่านั้น

Provider files คงอยู่ในตำแหน่งเดิม ไม่ย้าย directory

## 2. Evidence findings

### 2.1 Fixture-state inventory

[REPORTED] จาก `data/mvp/fixture-state.json`:

| Entity | Count |
|---|---:|
| Products | 8 |
| Offers | 8 |
| Candidates | 5 |
| Plans | 0 |
| Contents | 0 |

Candidate-to-product mapping ที่รายงาน:

| Candidate | Product | Status |
|---|---|---|
| CND-1001 | PRD-1001 | NONE |
| CND-1002 | PRD-1002 | NONE |
| CND-1003 | PRD-1003 | NONE |
| CND-1005 | PRD-1005 | SAVED |
| CND-1006 | PRD-1006 | NONE |

[REPORTED] Handler กำหนดให้ candidate ต้องมีสถานะ `SAVED` หรือ `QUEUED` เว้นแต่มี plan ที่เข้าเงื่อนไข

เนื่องจากมี 0 plans และมี candidate ที่ผ่านเงื่อนไขเพียง 1 รายการ จึงมี candidate ที่ใช้ทดสอบผ่าน handler ได้เพียงหนึ่งรายการตาม state ปัจจุบัน

### 2.2 Content approach keys

[REPORTED] จาก `content.js`:

- `problem_first`
- `value_compare`
- `evidence_first`
- `user_custom`

U-1 จึงถือว่า **RESOLVED ตามผลตรวจ source ที่ Owner รายงาน**

`APPROACH_KEYS` ใน `service.js` เป็นอีก vocabulary สำหรับงานคนละส่วน ไม่ควรนำมาปะปนกับ content-draft approach keys

### 2.3 Proposed behavioral matrix

คำนวณจาก:

\[
1\ candidate \times 4\ approaches \times 2\ execution\ paths = 8\ cells
\]

<badge color="warning">8 cells — proposed coverage, not executed</badge>

| Execution path | Approaches | Cells |
|---|---|---:|
| Deterministic | 4 approaches | 4 |
| AI opt-in / offline | 4 approaches | 4 |
| **Total** | | **8** |

นี่เป็น coverage ที่ทำได้จาก fixture state ปัจจุบัน ไม่ใช่จำนวน fixture ทั้งหมดของระบบ

Products ที่ยังไม่ครอบคลุมต้องรายงานเป็น uncovered ไม่ควรสร้าง candidate หรือ plan เพิ่มเพื่อให้ตัวเลข coverage ดูครบ โดยไม่ได้รับอนุมัติ

**ข้อกำหนด:** ก่อนเริ่ม equivalence verification ต้องตรวจ candidate mapping และ state อีกครั้งจาก baseline ที่จะใช้จริง

## 3. Per-symbol dependency audit

### 3.1 Audit scope

[REPORTED] ตรวจ proposed extraction block:

`app/mvp/content.js:1098–1546`

พบ declaration 25 รายการ โดยผลตรวจแบ่งเป็น:

- 4 AI symbols ที่มี external references หรือ export references
- 21 symbols ที่ไม่พบการใช้งานนอก block ตามวิธีตรวจที่รายงาน

ผลนี้สนับสนุนการแยก AI code แต่ยังไม่เพียงพอที่จะสรุปว่า block สามารถย้ายออกได้ทันที เพราะยังมี inbound dependencies จากส่วนอื่นของ `content.js`

### 3.2 Inbound dependencies

[REPORTED] AI block อ้างถึง symbols ที่ประกาศอยู่นอก block ดังนี้:

| Dependency | Existing location / source | Assessment |
|---|---|---|
| `createContentProject` | `content.js:424` | เป็น exported function |
| `nowIso` | `content.js:132` | ไม่อยู่ใน export list |
| `sha256` | `content.js:136` | ไม่อยู่ใน export list |
| `httpError` | `content.js:140` | ไม่อยู่ใน export list |
| `money` | `content.js:147` | ไม่อยู่ใน export list |
| `crypto` | Node.js module | ต้องคง dependency |
| `path` | Node.js module | ตรวจว่าจำเป็นจริงหรือไม่ |
| `thaiQa` | `thai-qa` module | ต้องคง dependency หากยังใช้งาน |
| `providerModule` | `provider/openrouter.js` | Provider dependency |
| `provenance` | `provider/provenance.js` | Provenance dependency |

### 3.3 Critical finding

<badge color="danger">Extraction boundary not finalized</badge>

ปัญหาสำคัญคือ AI block ใช้ private helpers จาก `content.js` ที่ไม่ได้ export ออกมา

ดังนั้น ข้อกำหนดเดิมที่ระบุว่า:

- ลบ AI block
- ลบ Provider imports
- ลบ AI exports
- ไม่เปลี่ยนส่วนอื่น

ยังไม่สามารถล็อกเป็น final change budget ได้จนกว่าจะกำหนดวิธีจัดการ private helpers เหล่านี้

### 3.4 Resolution options

| Option | วิธี | ข้อดี | ความเสี่ยง |
|---|---|---|---|
| A | Export helpers จาก `content.js` | ลดการทำซ้ำ | เพิ่ม public/module export surface |
| B | ย้าย helper definitions ไปยัง AI module | AI module เป็นอิสระ | อาจเกิด semantic drift หาก helper มีผู้ใช้งานอื่น |
| C | สร้าง shared utility module | แยก ownership ชัดเจน | เพิ่มไฟล์และขยาย allowlist |

**คำแนะนำของ Super Brain:** ยังไม่เลือก implementation strategy จนกว่าจะตรวจว่า `nowIso`, `sha256`, `httpError`, `money` มี deterministic callers นอก AI block หรือไม่

หาก helper ใดใช้เฉพาะ AI block จริง การย้าย helper นั้นไปพร้อม AI module อาจเป็นวิธีที่เล็กที่สุด

หากมี deterministic callers ต้องเลือก shared ownership ที่ไม่ทำให้ deterministic path ต้องโหลด Provider

### 3.5 Extraction boundary status

สถานะปัจจุบัน:

- AI block identification: [REPORTED]
- 25 declarations identified: [REPORTED]
- External references identified: [REPORTED]
- Inbound dependency list identified: [REPORTED]
- Helper ownership resolution: [UNVERIFIED]
- Exact deletion budget: **NOT FINALIZED**

ห้ามใช้ §4.1 ของฉบับก่อนหน้าเป็นคำสั่งลบแบบตายตัวจนกว่าจะปิดประเด็นนี้

## 4. Provider result and provenance contracts

ประเด็นนี้ต้องแยกสาม vocabulary ออกจากกันอย่างชัดเจน

### 4.1 Provider result status

[REPORTED] จาก `openrouter.js`:

| Category | Status |
|---|---|
| Success | `success` |
| Failure | `missing_credential` |
| Failure | `invalid_configuration` |
| Failure | `provider_disabled` |
| Failure | `auth_error` |
| Failure | `rate_limited` |
| Failure | `provider_error` |
| Failure | `timeout` |
| Failure | `network_error` |
| Failure | `invalid_response` |
| Failure | `empty_response` |

Provider result ใช้ `ok` แยกจาก `status`

Failure result มีโครงสร้างโดยสรุป:

- `ok: false`
- `status`
- `provider`
- `model`
- `text: null`
- `usage: null`
- `latencyMs: null`
- `httpStatus: null`
- `networkAttempted: false`
- `message`

Success result มีข้อมูล text, usage, latency และ network status ตามที่ Provider ส่งกลับ

### 4.2 Provenance fallback reason

[REPORTED] จาก `provenance.js`:

Fallback reasons มี 11 ค่า:

- `validation_failed`
- `missing_credential`
- `invalid_configuration`
- `provider_disabled`
- `auth_error`
- `rate_limited`
- `provider_error`
- `timeout`
- `network_error`
- `invalid_response`
- `empty_response`

**ข้อแตกต่างสำคัญ:** `validation_failed` ไม่ใช่ Provider result status แต่เป็นเหตุผลที่ content layer ปฏิเสธผลลัพธ์แล้วเลือก fallback

### 4.3 Provenance trace status

Trace status เป็นอีกชุดหนึ่ง:

- `success`
- `template_default`
- `graceful_fallback`

ห้ามนำชุดนี้ไปปะปนกับ Provider result status หรือ fallback reason

### 4.4 networkAttempted contract

[REPORTED]

- Pre-network failures มี `networkAttempted: false`
- เมื่อเริ่มส่ง request จริง จึงระบุ `networkAttempted: true`
- Content layer ส่งค่าต่อโดยตรวจ `result.networkAttempted === true`
- Service layer คำนวณ `boundary.external_calls` จากค่านี้

ข้อกำหนด:

```text
boundary.external_calls =
  networkAttempted ? 1 : 0
```

การย้าย module ต้องไม่เปลี่ยน semantics นี้

### 4.5 Trace and fallback preservation

[REPORTED] `provenance.js` กำหนด allowlisted trace fields และ allowed combinations อยู่แล้ว

Option B ต้องรักษา:

- trace field names
- trace status
- fallback reason
- execution mode
- provider/model metadata
- networkAttempted
- response shape
- existing allowed provenance combinations

ห้ามเพิ่ม status หรือ provenance combinations ใหม่ในงาน extraction นี้

## 5. UI caller compatibility

[REPORTED] ตรวจ `app/public/**` แล้วไม่พบ references สำหรับ:

- `useLlm`
- `scriptDraft`

UI เรียก content-draft endpoint และส่งข้อมูลหลัก เช่น:

- `approach`
- `planId` หรือ `candidateId`

ไม่พบหลักฐานว่า public UI เปิด AI opt-in ด้วย request fields เหล่านี้

นอกจากนี้ไม่พบการอ่าน `.trace` ใน UI code ที่ตรวจ

**ข้อสรุป:** ไม่พบ UI caller ที่ส่ง AI opt-in fields ใน scope ที่ตรวจ

อย่างไรก็ตาม API contract ต้องยังคงรองรับ request fields เดิมสำหรับ callers อื่นที่อาจไม่ได้อยู่ใน `app/public/**`

UI compatibility finding ไม่ใช่หลักฐานว่าไม่มี external API consumers

## 6. Target architecture

[PROPOSED]

```text
app/mvp/
├── service.js
├── content.js
├── ai/
│   └── script-draft.js
└── provider/
    ├── openrouter.js
    └── provenance.js
```

ข้อกำหนด:

1. `content.js` ไม่มี Provider imports
2. `content.js` ไม่มี AI-specific exports
3. `service.js` ไม่ require AI module ที่ top level
4. AI module ถูก require ภายใน `useLlm === true` branch
5. Provider files อยู่ที่เดิม
6. AI module สามารถใช้ `createContentProject` ได้ โดยต้องเลือก dependency strategy ที่ไม่สร้าง cycle หรือทำให้ deterministic path โหลด AI module

**ประเด็นสุดท้ายยังเป็น design decision ที่ต้องปิดก่อน implementation**

## 7. File allowlist

[PROPOSED — pending dependency resolution]

**New file**

- `app/mvp/ai/script-draft.js`

**Potentially modified files**

- `app/mvp/content.js`
- `app/mvp/service.js`
- `verification/openrouter-gate3-offline-check.js`
- `verification/openrouter-gate3-script-validation-check.js`

รวม 5 paths

หากการแก้ inbound dependencies ต้องสร้าง shared utility module เพิ่ม จะถือว่าเป็นการเปลี่ยน allowlist และต้องเสนอ Owner อนุมัติก่อน

ไม่มีการอนุญาตให้แก้:

- `provider/openrouter.js`
- `provider/provenance.js`
- `package.json`
- `package-lock.json`
- `app/server.js`
- `app/public/**`
- governance documents
- new test files

Allowlist นี้ยังไม่ใช่ execution authorization

## 8. Verification plan

ยังไม่มีการรัน verification ในรอบนี้

### 8.1 Module Isolation

| ID | Verification | Pass condition |
|---|---|---|
| MI-1 | Static dependency scan | `content.js` ไม่มี AI/Provider imports |
| MI-2 | Fresh-process require-cache probe | Require เฉพาะ `content.js` แล้วไม่มี AI/Provider modules ใน cache |
| MI-3 | Directory-absence test | ใน isolated copy สามารถทดสอบ deterministic server path ได้โดยไม่มี Provider directory |
| MI-4 | Regression canary | การเพิ่ม AI/Provider dependency กลับเข้ามาต้องทำให้ canary fail |

Canary ให้เพิ่มใน existing verification script ตาม allowlist ไม่สร้าง test file ใหม่

### 8.2 Runtime Isolation

| ID | Verification | Pass condition |
|---|---|---|
| RI-1 | `useLlm` absent | ไม่มี Provider execution |
| RI-2 | `useLlm: false` | ไม่มี Provider execution |
| RI-3 | AI opt-in offline | พฤติกรรมเดิมและ fallback contract คงอยู่ |
| RI-4 | Network interlock | semantics เดิมไม่เปลี่ยน |

ข้อสรุปที่อนุญาตให้รายงานได้มีเพียง:

> The AI Provider execution path is not loaded through the tested deterministic E1 module graph.

ห้ามสรุปว่า entire application has zero network egress

### 8.3 Behavioral equivalence

[PROPOSED]

ใช้ 8 cells จาก candidate ที่ผ่าน status gate ใน fixture baseline ปัจจุบัน

- 4 deterministic cases
- 4 AI opt-in offline cases

ก่อนเริ่มต้อง:

1. ตรวจ candidate mapping อีกครั้ง
2. ยืนยัน approach keys อีกครั้ง
3. ใช้ isolated fixture-state copy
4. reset state ระหว่างแต่ละ cell
5. เปรียบเทียบ baseline กับ post-change
6. ตัด volatile fields ออกจาก comparison เฉพาะที่มีหลักฐานรองรับ

Fields ที่ต้องพิจารณาเป็น volatile ได้แก่ trace IDs, timestamps, latency และ usage counters แต่ต้องตรวจ baseline จริงก่อน finalize exclusion list

Pass criterion: ทุก non-volatile field ใน 8 cells ต้องเทียบเท่า baseline

## 9. Rollback and preservation protection

<badge color="warning">Baseline-based rollback required</badge>

การ rollback ต้องอิง **pre-implementation baseline ที่เก็บรักษาไว้** ไม่ใช่ Git HEAD โดยอัตโนมัติ

เหตุผล:

- AI block มีอยู่ใน working tree ก่อน Option B
- Git HEAD อาจไม่มี AI block ดังกล่าว
- การคืน `content.js` จาก HEAD อาจทำลายงานที่ต้องรักษาไว้

ข้อกำหนด:

1. ใช้ isolated working copy หรือ baseline ที่ตรวจสอบได้
2. เก็บสำเนาของไฟล์ใน allowlist ก่อนเริ่ม
3. rollback เฉพาะไฟล์ที่ Option B เปลี่ยน
4. ห้าม overwrite unrelated Owner work
5. ห้ามใช้ destructive Git operation โดยไม่ตรวจสถานะ working tree และได้รับอนุมัติ

Preservation status:

- Preservation Action: COMPLETED AS REPORTED BY OWNER
- Independent Verification by Super Brain: NOT PERFORMED
- Source working tree after snapshot: MAY HAVE CHANGED

## 10. Out-of-scope fence

งานต่อไปนี้ไม่รวมใน Option B:

- Qualitative claim validation
- Price-role validation
- Provenance continuity after version bump
- `fetchImpl` interlock hardening
- `spend_thb` correction
- DR-01 through DR-14
- Gate 3 acceptance work
- Gate 4 authorization
- A2 execution
- Gate C execution
- Remove operations

`spend_thb` คงพฤติกรรมเดิมใน scope นี้ แม้จะมี `external_calls: 1`

## 11. Remaining unresolved items

| ID | Issue | Status |
|---|---|---|
| U-1 | Content approach keys | **RESOLVED** ตามผลตรวจ Owner |
| U-2 | Ownership ของ `nowIso`, `sha256`, `httpError`, `money` | **OPEN** |
| U-3 | Strategy สำหรับ lazy require และ dependency injection | **OWNER DECISION** |
| U-4 | Export surface ของ AI-only symbols | **OPEN** |
| U-5 | UI caller ที่ส่ง AI opt-in fields | **RESOLVED** ตามผลตรวจ Owner ใน `app/public/**` |
| U-6 | DR-05 claim: 5 of 6 products | **OPEN — RECONCILIATION REQUIRED** |
| U-7 | Exact deterministic trace behavior | **OPEN — BASELINE CAPTURE REQUIRED** |
| U-8 | Baseline availability and rollback integrity | **OPEN — MUST CONFIRM BEFORE IMPLEMENTATION** |
| U-9 | Whether `path` is actually required by the extracted block | **OPEN — VERIFY BEFORE EXTRACTION** |

## 12. Owner approval checklist

- [ ] A-1 Approve Option B — Strict Provider Isolation as the target architecture.
- [ ] A-2 Approve Runtime Isolation and Module Isolation as acceptance targets.
- [ ] A-3 Decide the helper ownership strategy in §3.4.
- [ ] A-4 Approve the final extraction boundary after helper dependency resolution.
- [ ] A-5 Approve the 5-path allowlist, or any revised allowlist if a shared utility module is required.
- [ ] A-6 Approve the proposed 8-cell coverage, subject to baseline revalidation.
- [ ] A-7 Approve the verification plan as a separate execution grant.
- [ ] A-8 Approve the baseline-based rollback protection.
- [ ] A-9 Confirm the out-of-scope fence.

Approval of this specification does not itself authorize code changes or test execution.

## 13. Authorization boundary

The following remain unauthorized:

- Source code edits
- Verification script edits
- Test execution
- Application execution
- Build operations
- Git mutations
- Commits and pushes
- Sandbox operations
- Dependency installation
- Gate 3 acceptance
- Gate 4 authorization
- A2 execution
- Gate C execution
- Remove operations

**No implementation or execution occurred during this reconciliation. No repository files were created, modified, or deleted.**

---

## Change log — compared with previous draft

| Previous draft | Corrected specification |
|---|---|
| 40-cell matrix | 8 proposed cells based on one eligible candidate |
| Approach vocabulary unresolved | U-1 resolved using content-draft keys |
| Provider status and fallback reason grouped | Three separate vocabularies: provider status, fallback reason, trace status |
| Extraction block treated as clean deletion | Inbound helper dependencies exposed; deletion boundary provisional |
| UI caller compatibility pending | No `useLlm`/`scriptDraft` references found in inspected `app/public/**` |
| Rollback described as restoring files | Baseline-based rollback; Git HEAD must not overwrite preserved work |
| 48-cell assumption | Retracted; 40-cell estimate also replaced |

## Remaining blockers before implementation

มี 4 ประเด็นที่ผมมองว่าสำคัญที่สุด:

1. **Helper ownership:** จะจัดการ private helpers โดยไม่สร้าง dependency ที่ไม่เหมาะสมอย่างไร
2. **Final extraction boundary:** ต้องรู้ว่า helper แต่ละตัวมี deterministic callers หรือไม่
3. **Baseline:** ต้องระบุ baseline ที่จะใช้ rollback ได้จริง โดยไม่ทำลายงานเดิม
4. **Owner authorization:** ต้องอนุมัติ specification และ execution แยกกัน

## คำตัดสินสุดท้ายของ Super Brain

ผมยังเลือก **Option B — Strict Provider Isolation** เหมือนเดิมครับ แต่ตอนนี้มีข้อค้นพบใหม่ที่ทำให้ผมไม่แนะนำให้รีบสั่ง DeepSeek implement

สิ่งที่ต้องทำต่อไม่ใช่เริ่มเขียน `ai/script-draft.js` ทันที แต่คือปิด **Helper Ownership Decision** ก่อน เพราะนี่เป็นจุดที่กำหนดว่าเราจะแยก AI ออกจาก deterministic core ได้จริง โดยไม่สร้าง coupling รูปแบบใหม่ขึ้นมาแทนของเดิมหรือไม่

และผมขอยืนยันขอบเขตให้ชัด: **เอกสารฉบับนี้เป็นข้อเสนอสำหรับ Owner review เท่านั้น ไม่ใช่คำอนุญาตให้ DeepSeek เริ่มแก้โค้ดครับ**