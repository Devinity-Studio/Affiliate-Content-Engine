# ACE Mission 1 — Phase 2D.2: Full Syntax Damage Assessment (READ-ONLY)

**Date:** 2026-10-23 · **Target:** `app/mvp/service.js` · **Mode:** READ-ONLY (assessment only)
**Owner status:** PLANNING APPROVED — IMPLEMENTATION NOT AUTHORIZED.

**Compliance:** ไม่มีการ edit / overwrite / restore / delete / stage / commit / push / deploy ใด ๆ
`data/app/state.json` ไม่ถูกแตะ ไฟล์เดียวที่เพิ่มเข้า workspace โดยการประเมินนี้คือรายงานฉบับนี้เอง
ทุกการทดสอบ "ซ่อม" ทำใน memory เท่านั้น (string ในหน่วยความจำ + `vm.Script`) ไม่มีการเขียนไฟล์
ไม่มีการรัน server และไม่มีการรัน acceptance suite ใด ๆ

---

## 1. Verified baseline (Task 1)

| Item | Value | Match vs known baseline |
| --- | --- | --- |
| Branch | `mission1-planning-docs` | — |
| HEAD | `9749f38e7bdb1ec6ee56be0e2227473c3b973f2b` | ✅ = `9749f38` (HANDOFF) |
| `git status --porcelain` | ชุดเดิมทั้งหมด (M: docs/mission1/A–H; untracked: `.env.example`, `.gitignore`, `.vscode/`, zip, `HANDOFF.md`, `PR_SUMMARY.md`, `RTM_verification.md`, `WORKSPACE_VERIFICATION_REPORT.md`, `app/`, `data/`, docs/mission1 extras, `schemas/`, `oq8_gate_assessment.md`, `reference/`, `screenshots/`, `shopee-login-snapshot.png`, `verification/`) | ✅ ไม่มีรายการใหม่/หาย |
| `app/mvp/service.js` | 122,103 bytes · sha256 `a4dd61b986c8582316031c31a9ac546b9ba581db7a1311bee5b3421c95cd18ca` · mtime 2026-10-23 13:52:16 | ✅ ไม่ถูกแตะตลอดการประเมิน |
| `data/app/state.json` md5 | `5d29cdbdace0a73580bc2e0633f2e8cb` | ✅ = ค่าที่ HANDOFF.md บันทึกไว้ |
| Node | v24.20.0 | — |

→ Baseline ตรงกับที่รู้จักทุกรายการ **ไม่มีความเปลี่ยนแปลงที่ไม่คาดคิด → ดำเนินการต่อได้** (เงื่อนไข STOP ไม่ทริกเกอร์)

## 2. Exact syntax failure and source boundary map (Task 2)

### 2.1 อาการผิวพร้น (parser surface)

```
$ node --check app/mvp/service.js          → exit 1
service.js:1255
  if (text.length > max) throw httpError(400, `${field} must be ${max} characters or fewer`);
                                               ^
SyntaxError: Unexpected identifier '$'
```

### 2.2 กลไกที่แท้จริง (earliest provable structural error)

**Template literal ของ markdown ที่เปิดที่บรรทัด 1056 col 10 (`return \`# Content Script/Draft`)
ไม่มี backtick ปิดเลย** — มันกลืนทุกอย่างจนถึง backtick ตัวถัดไปของไฟล์ที่ 1255:47 (ของ
`` `${field} must be…` ``) แล้ว parser เจอ `$` ต่อทันที → error "Unexpected identifier '$'"

หลักฐาน: สแกน backtick ทั้งไฟล์ — ไม่มี backtick แม้แต่บรรทัดเดียวระหว่าง 1056 กับ 1255
และสแกน state-machine (template/quote/regex-aware) ให้ลำดับเหตุการณ์ตรงเป๊ะ:
`TPL_OPEN 1056:10 → (IOPEN/ICLOSE 1058–1081) → TPL_CLOSE 1255:47 → TPL_OPEN 1255:91`

**จุดเสียที่เก่าที่สุดที่พิสูจน์ได้ = splice ที่บรรทัด 1083 (`---)`)** — รอยเย็บผิดระหว่าง
ท้าย markdown template ของ `generateMarkdownContent()` กับในของ `buildApproaches()`
สิ่งที่หายไปจากจุดนี้ (5 รายการ):

1. backtick ปิด markdown template + `;`
2. `}` ปิดฟังก์ชัน `generateMarkdownContent()`
3. header ของฟังก์ชันถัดไป `function buildApproaches(candidate, offer, product) {`
   พร้อม derivation ของ `ev` / `audience` / `money`
4. `return [` + ปีกเปิด object แรก `{` + `key: 'personalized_a',` + `label: 'Personalized A',`
5. เศษ `)` ที่ติดมากับบรรทัด `---)` (เศษจากการตัด/แปะ)

### 2.3 ความเสียหายแฝงที่จะปรากฏ "หลัง" ซ่อม seam

- **บรรทัด 1085:** `angle: '…then the product in use.,` — **string ไม่ปิด** (หลุด `'` ก่อน `,`)
  เกิดจากรอบแก้ 13:52 ที่แปลง template → concatenation แล้วข้ามบรรทัดนี้ (1098 ถูกแก้ถูกต้องแล้ว)
- นอกจากนี้ **ไม่มีความเสียหายเชิงโครงสร้างอื่น**: ข้อความที่ซ่อมแล้ว compile ผ่านทั้งไฟล์
  (หมายเหตุ: MISMATCH ที่ 1332/1404/1406 จาก scanner ดิบเป็นเพียง cascade artifact ของ
  การจับคู่ backtick ที่เลื่อน — ไม่ใช่ความเสียหายจริง — พิสูจน์โดยหลังซ่อมแล้ว parse ผ่านหมด)

### 2.4 ตารางความจริงของทุกเวอร์ชัน (วัดด้วย `vm.Script` — ไม่ขึ้นกับนามสกุลไฟล์)

| เวอร์ชัน | sha256 (16 ตัวแรก) | bytes | parse | error แรก |
| --- | --- | --- | --- | --- |
| `service.js` (current, 13:52) | `a4dd61b9…` | 122,103 | **FAIL** | 1255 `$` |
| `service.js.stage-2c8-precheck…` (14:59) | `a4dd61b9…` (= current) | 122,103 | **FAIL** | 1255 |
| `service.js.ace-mission-2c-3…` (12:58) = `…phase-2c-5…` (13:36) | `ed8655a5…` | 122,024 | **FAIL** | 1085 `Problem` |
| `service.js.bak` (10:38) = `…phase2c5-backup-before-fixes` (13:50) | `c0ada7cd…` | 122,019 | **FAIL** | 1085 `Problem` |
| `service.js.repair-1792729963` (11:32) | `b4d58fc2…` | 122,056 | **FAIL** | 1104 `Price` |
| `service.js.pre-fix-1792734587` (12:49) | `7d7897ab…` | 122,238 | **FAIL** | 2459 `export` (cascade จาก splice เดียวกัน) |

**ทุกเวอร์ชันมีแผนที่โครงสร้างเหมือนกันเป๊ะ** (generateMarkdownContent@1037 · ##CTA@1080 ·
`---)`@1083 · planIdentityPreview@1127) → **splice เดียวกัน และเก่ากว่า backup ทุกไฟล์**
ไม่มีเวอร์ชันใดบนดิสก์ที่มี seam สมบูรณ์

### 2.5 กับดักการวัดที่ต้องระวัง (อธิบายผล "parse OK" ปลอม)

- `node --check` กับไฟล์ที่ชื่อไม่ลงท้าย `.js` (เช่น `.bak`, `.phase-*`, `.pre-fix-*`)
  ล้มด้วย `ERR_UNKNOWN_FILE_EXTENSION` **โดยไม่สนเนื้อไฟล์** — ผล FAIL ของ backup ทั้ง 7
  ที่รายงานก่อนหน้าในเซสชันนี้เป็น artifact แบบนี้ (จึงไม่มีบรรทัด "SyntaxError" ให้ grep เจอ)
- `node --check` กับสำเนาที่ลงท้าย `.js` ของ **bytes เสียเดิม** ผ่านได้โดยอุบัติเหตุ:
  Node 24 auto-detect แล้ว parse เป็น ES Module (template ที่ล้นทำให้ parse ไปคนละทางจน
  `require()` กลายเป็นแค่ identifier ที่ legal ใน ESM) ดังนั้น
  `.tmp/2c8/service.valid-snapshot.js` และ `.tmp/2c9…/service.prefix-snapshot.js`
  ที่ "PARSE-OK" **ไม่ใช่ไฟล์สมบูรณ์** — ทั้งคู่เป็นสำเนา byte-identical ของ
  `service.js.pre-fix-1792734587` (sha256 `7d7897ab…` ตรงกันทุกไบต์) ซึ่ง `vm.Script` ล้ม
- สรุป: **ไม่มีสำเนาที่สมบูรณ์หลงเหลืออยู่เลย** (zip มีแต่ docs 13 ไฟล์, `.tmp` ไม่มีสำเนา
  service.js ตรง ๆ, `app/` เป็น untracked จึงไม่มีประวัติใน git)

### 2.6 ไทม์ไลน์ความเสียหาย

- **2026-10-22 ~20:10** — `content-phase1-acceptance-2026-10-22.md`: รันผ่านจริง
  (mvp-workflow 56/56, foundation 19/19, export MP4 จริง) → ไฟล์ยัง parse ได้และทำงานได้
- **ช่วงหลัง 22 ต.ค. ~22:01 ถึงก่อน 23 ต.ค. 10:38** (backup เก่าสุดที่เหลือ) — เกิด splice
  ที่บรรทัด 1083 ต้นตอเดียว
- **23 ต.ค. 10:38–13:52** — รอบแก้หลายครั้ง: แปลงบล็อก approaches เป็น concatenation
  แก้ 1085 ได้เพียงบางส่วน (1085 ยังไม่ปิด) และยังไม่ได้สร้าง seam กลับ → ยัง parse ไม่ผ่าน

### 2.7 การเปรียบเทียบที่มีหลักฐาน (bak = ต้นฉบับความตั้งใจที่ใกล้ที่สุด)

`service.js.bak` (10:38) เก็บโค้ด object ทั้งสามในรูป **template literal ดั้งเดิม** เช่น

```js
angle: `Problem-first demo for ${audience}: show the everyday problem, then the product in use.`,
hook: `"${product.name} — here is what ${money} actually fixes."`,
hook: `"List ${'THB ' + offer.list_price_thb.toFixed(2)} → now ${money}. Is it worth it?"`,   // personalized_b
```

**Semantic regression ที่รอบแก้ 13:52 ทำเพิ่ม (ไม่ใช่ syntax — จึงไม่แตะใน diff ที่เสนอ):**
1. hook ของ `personalized_b` ถูกแทนที่ด้วย hook ของ `personalized_a`
   ("List THB X → now THB Y. Is it worth it?" หายไป)
2. เครื่องหมายคำพูด `"` ที่เคยครอบ hook เดิมถูกทิ้ง
3. angle/hook/claim_notes เปลี่ยนจาก template literal เป็น concatenation (เทียบเท่าได้ ยกเว้นข้อ 1–2)

Provenance ของ artifact ใน `.tmp`: `generateMarkdownContent.diff` ใช้เลขบรรทัดแบบ fragment-relative
(ไม่ใช่เลขบรรทัดจริงของไฟล์) — ใช้เป็นหลักฐาน "intent ของการแก้" ได้ แต่ห้ามใช้เลขบรรทัดอ้างอิง;
`probe-repaired.js` (+5 bytes) ยัง FAIL → ความพยายามซ่อมรอบก่อนไม่พอ; `bisect-*.js` /
`prefix-*.js` เป็น prefix ตัดของ pre-fix ผล "OK" ทั้งหมดเป็น ESM-detection artifact (§2.5)

### 2.8 หลักฐานประกอบการ reconstruct header ที่หาย

| ส่วนที่หาย | หลักฐาน | ความมั่นใจ |
| --- | --- | --- |
| `function buildApproaches(candidate, offer, product)` | caller จริง @1534 `generated: buildApproaches(candidate, offer, product),` | สูง (ชื่อ/ลายเซ็นตายตัว) |
| `const ev = (code) => \`EV-${offer.item_id}-${code}\`;` | mirror ตรงกับบรรทัด 1039 ที่ intact | สูง |
| `const audience = CATEGORY_AUDIENCE[product.category] \|\| \`buyers in the ${product.category} category\`;` | mirror ตรงกับบรรทัด 1040 ที่ intact | สูง |
| `const money = \`THB ${offer.price_thb.toFixed(2)}\`;` | bak ใช้ `${money}` เป็น string THB และ @1100 คู่กับ `'THB ' + offer.list_price_thb.toFixed(2)` | **สมมติฐาน** — รูปแบบตัวอักษรจริงพิสูจน์ไม่ได้ ต้องยืนยันด้วย acceptance |
| `key: 'personalized_a'` / `label: 'Personalized A'` | docs/mission1/M (ตาราง approaches) + pattern เดียวกับ 1095–1096 | สูง |
| footer หลัง `---` ใน markdown | **ไม่มีหลักฐานเหลืออยู่** | template จึงถูกปิดทันทีหลัง `---` — ถ้าเดิมมี footer ต้องเติมโดยเจตนาภายหลัง |

## 3. Proposed recovery — MINIMAL SYNTAX-ONLY DIFF (Task 3)

**ขอบเขต:** เฉพาะให้ไฟล์ parse ผ่าน — ไม่แตะ T2 (buildApproaches implementation), T6 (export
route), markdown schema/body, UI, lifecycle และไม่แก้ semantic regression (§2.7)
**ขนาด:** 1 hunk · บรรทัด 1083–1085 · +12/−2 บรรทัด · ผลลัพธ์ 2,984 บรรทัด / 122,451 bytes (+348)
**การตรวจสอบ:** ข้อความผลลัพธ์เฉพาะนี้ถูก compile ด้วย `vm.Script` ใน memory → **PARSE-OK**

```diff
--- a/app/mvp/service.js   (current: 2973 lines, 122,103 bytes, sha256 a4dd61b9…)
+++ b/app/mvp/service.js   (proposed — NOT APPLIED)
@@ -1080,7 +1080,18 @@
 ## CTA
 ${cta}
 
----)
+---
+`;
+}
+
+function buildApproaches(candidate, offer, product) {
+  const ev = (code) => `EV-${offer.item_id}-${code}`;
+  const audience = CATEGORY_AUDIENCE[product.category] || `buyers in the ${product.category} category`;
+  const money = `THB ${offer.price_thb.toFixed(2)}`;
+  return [
+    {
+      key: 'personalized_a',
+      label: 'Personalized A',
       origin: 'AI_DRAFT',
-      angle: 'Problem-first demo for ' + audience + ': show the everyday problem, then the product in use.,
+      angle: 'Problem-first demo for ' + audience + ': show the everyday problem, then the product in use.',
       audience,
```

**ความเชื่อมั่นในการ reconstruct:** syntax — มั่นใจสูง (compile ผ่านทั้งไฟล์) ·
byte-exact ของ header เดิม — **พิสูจน์ไม่ได้** (ไม่มีสำเนาสมบูรณ์) จึงระบุสมมติฐานไว้ใน §2.8
ไม่ถือว่า BLOCKED เพราะเจตนาของโค้ดตรงส่วนที่หายสร้างซ้ำได้จากหลักฐานภายในไฟล์เอง
แต่ผลลัพธ์ runtime ต้องผ่าน acceptance ก่อนจึงถือว่าฟื้นครบ

## 4. Regression risks และ acceptance criteria

**ความเสี่ยง**
1. `money` เป็นข้อความ reconstruct — ถ้าเดิม format ต่าง (เช่นไม่มี "THB " นำหน้า) ข้อความ
   hook/claim_notes ที่เรนเดอร์จะต่างจากเดิมเล็กน้อย
2. markdown ตอนนี้จบที่ `---` พอดี — ถ้าเดิมมี footer หลังเส้นนี้ ผลลัพธ์จะสั้นกว่าเดิม
3. semantic regression §2.7 (ข้อ 1–2) ยังอยู่ครบ — ต้องตัดสินใจเป็นงาน T2/owner แยก
4. ห้ามรัน acceptance กับ real state — ทุก suite ต้องใช้ temp state เท่านั้น
   (real `data/app/state.json` ต้องคง md5 `5d29cdbd…`)

**เกณฑ์ยอมรับหลังนำ diff ไปใช้ (เมื่อได้รับอนุมัติ)**
- `node --check app/mvp/service.js` → exit 0 (และ `vm.Script` ผ่าน)
- `node verification/mvp-workflow-acceptance.js` → 56/56
- `node verification/foundation-regression.js` → 19/19 และ HEAD ไม่เปลี่ยน
- `node verification/import-source-acceptance.js` → 81/81 · `cwi-contract-enforcement.js` → exit 0
- `node verification/content-creation-acceptance.js` → ผ่านตามเกณฑ์เดิม
- md5 `data/app/state.json` ก่อน/หลัง = `5d29cdbdace0a73580bc2e0633f2e8cb` · ไม่มี commit/stage

## 5. Commands actually executed (สรุป; ทั้งหมดอ่านอย่างเดียว)

| คำสั่ง (ย่อ) | ผล / exit |
| --- | --- |
| `git branch --show-current` · `git rev-parse HEAD` · `git status --porcelain` | ตาม §1 · exit 0 |
| `Get-FileHash` SHA256 service.js + ทุกเวอร์ชัน/สำเนา .tmp · MD5 state.json | ตาม §1/§2.4 · exit 0 |
| `node --check app/mvp/service.js` | exit 1 — `SyntaxError: Unexpected identifier '$'` @1255 |
| `node --check` × 8 เวอร์ชัน | exit 1 ทั้งหมด — **ภายหลังพิสูจน์ว่าเป็น artifact นามสกุลไฟล์** (§2.5) |
| `vm.Script` × 8 เวอร์ชัน (node stdin) | FAIL ทั้งหมด — ตาราง §2.4 |
| `rg -n '\`'` + scanner state-machine (node stdin, regex/quote/template-aware) | แผนที่ backtick/quote/XLINE ตาม §2.2 |
| ตรวจโครงสร้าง 8 เวอร์ชัน (`rg` structure map) | เหมือนกันเป๊ะทุกเวอร์ชัน (§2.4) |
| byte dump (JSON.stringify) บริเวณ 1080–1130 / 1245–1260 / pre-fix 2450–2466 / bak 1093–1126 | ตามที่อ้างใน §2 |
| สำรวจ `.tmp` (90 ไฟล์ใหญ่) + zip (13 entries, docs only) + `reference/` | ไม่พบสำเนาสมบูรณ์ (§2.5) |
| `rg` caller/module: `buildApproaches` @1534 · `contentModule.buildContentApproaches` @2313 · `module.exports` @2956 | ตาม §2.8 |
| ทดสอบซ่อม in-memory (seam + quote 1085) → `vm.Script` | **PARSE-OK** (2,984 บรรทัด / 122,451 bytes) |

## 6. Explicit NOT RUN list

- `node app/server.js` (ไม่รัน server เด็ดขาด)
- acceptance suite ทุกตัว: mvp-workflow / foundation-regression / import-source / cwi-* /
  content-creation / visual-verify-export / real-shopee-export-check
- การรัน/ทดสอบพฤติกรรมจริงของ `generateMarkdownContent()` และ `buildApproaches()`
- exporter / FFmpeg ทุกเส้นทาง
- git write ทุกชนิด (add/commit/stash) และการเขียน/แก้/ลบไฟล์ใด ๆ ใน repo
  (ไฟล์เดียวที่สร้าง = รายงานนี้)

## 7. ข้อสังเกตเสริมสำหรับเจ้าของงาน

- ควรพิจารณากำหนดมาตรฐานการตรวจ syntax ในเซสชันถัด ๆ ไป: ใช้ `node --check` กับ**สำเนาที่ลงท้าย `.js`**
  หรือ `node -e "new (require('vm').Script)(require('fs').readFileSync(<path>,'utf8'))"` เท่านั้น
  เพราะผลของ `node --check` บนนามสกุลอื่นและการ auto-detect ESM ของ Node ≥22 ทำให้เกิด
  ผลบวก/ผลลบปลอมได้ (เป็นสาเหตุที่ทำให้เซสชันก่อนหน้าสรุป `valid-snapshot` ผิด)
- ไม่มี backup ที่สมบูรณ์เหลืออยู่: ควรตั้งกติกา snapshot `.js`-parseable ก่อนแก้ทุกครั้ง
  (เช่น `service.ok-<timestamp>.js` เฉพาะไฟล์ที่ vm.Script ผ่านจริง)

---

IMPLEMENTATION REMAINS UNAUTHORIZED PENDING EXPLICIT OWNER APPROVAL.
