# ACE Mission 1 — D-1 Accounting Enforcement: บันทึกปิดงาน

**วันที่:** 2026-11-04 · **ผู้ปฏิบัติ:** GLM 5.3 Flash (Implementation Engineer) · **ผู้อนุมัติ:** Owner
**สถานะ:** ACCEPTED — 34/34 regression ผ่าน, commit แล้ว 1 commit, ยังไม่ push
**ขอบเขตที่ได้รับอนุญาต:** `verification/real-shopee-export-check.js` ไฟล์เดียว

---

## 1. Commit

| รายการ | ค่า |
|---|---|
| Commit | `3de34430481935f927215952469ea6661a4a6cb9` |
| ข้อความ | `fix(ace): enforce workspace accounting invariant` |
| Parent | `73034bb` (HEAD เดิมก่อนเริ่มงาน) |
| ไฟล์ที่เปลี่ยน | `verification/real-shopee-export-check.js` (1 ไฟล์) |
| Stat | +6 / −0 |
| Staged ตอน commit | 1 ไฟล์ (ตรวจด้วย `git diff --cached --name-only` ก่อน commit) |
| Push | **ไม่มี** — branch `mission1-planning-docs` ahead 12 |

### Diff ที่ commit

```diff
   if (!workspace.accounting.ok) {
+    summary.workspace_accounting_ok = false;
     console.error('WARN  the workspace copy does not reconcile with the source inventory; the evidence records both sides.');
   }
@@ finalize()
   const degraded = [];
+  // Recorded for every operation, so a mismatch is visible in PARTIAL/PENDING/
+  // FAILED runs too; overallResult() only consults `degraded` for VERIFIED.
+  if (outcome.summary && outcome.summary.workspace_accounting_ok === false) {
+    degraded.push('WORKSPACE_ACCOUNTING_MISMATCH');
+  }
   let code = outcome.code;
```

`overallResult()` ไม่ถูกแก้ · ไฟล์หลัง commit 84,435 B · sha256 `ECEE2CBDA69183E890554AD9A58D2E0182236427C82FDE58EA248D6B0E7C8B01` · `git diff HEAD` ว่าง (blob ที่ commit = ไฟล์ใน working tree)

---

## 2. Data flow ที่ตรวจสอบก่อนแก้

`main()`/`execute()` สร้าง `summary` ก่อนถึงขั้น workspace และส่งต่อไปยัง `finalize()` ด้วย **reference เดียวกัน** ผ่าน `result()` / `fail()` (`summary: summary || {}` ไม่ได้ copy) จากนั้น `finalize()` คัดลอก `outcome.summary` ลงบันทึกสุดท้าย — จึงเป็นช่องทางที่ถูกต้องสำหรับ `workspace_accounting_ok`

**ขอบเขตเชิงโครงสร้างที่ยืนยันแล้ว:** `PENDING` return ที่บรรทัด 1261 แต่ `createWorkspace()` ถูกเรียกครั้งแรกที่บรรทัด 1337 → เส้นทาง PENDING ไม่มี workspace/accounting เลย จึงไม่มี mismatch ให้บันทึกได้ (owner รับทราบและแก้เกณฑ์ R-2 เป็น negative case)

---

## 3. Regression — 34/34 PASS

Mismatch ที่ใช้ทดสอบเป็นของจริง: preload ทำ `fs.cpSync` สูญเสียไฟล์ 1 ไฟล์ (`app/README.md`, 9,475 B) ระหว่าง copy โดยไม่มีการบันทึก exclusion → checker คำนวณ inventory/copy/accounting เองแล้วได้ `ok:false` (ไม่ใช่ object ที่สร้างมือ)

| Case | สถานการณ์ | Exit | overall_result | degraded |
|---|---|---:|---|---|
| R-1 | mismatch + PARTIAL (promote 422: 3 offers < 5) | 3 | PARTIAL | token ×1 |
| R-2 | PENDING ก่อนสร้าง workspace (negative) | 2 | PENDING | `[]` ไม่มี key ไม่มี workspace |
| R-3 | mismatch + FAILED (`COMMIT_FAILED`, 4xx จริงหลังสร้าง workspace) | 1 | FAILED | token ×1 |
| R-4 | mismatch + VERIFIED | 0 | **DEGRADED** | token ×1 |
| R-5 | VERIFIED ปกติ accounting ตรง | 0 | COMPLETE_SUCCESS | `[]` |
| P-1 | ไม่มี key → ไม่สร้าง entry | — | — | PENDING + clean VERIFIED |
| P-2 | `false` → สร้าง entry เดียว | — | — | PARTIAL=1, FAILED=1, VERIFIED=1 |
| P-3 | พิสูจน์ accounting → summary → finalize ของจริง | — | — | `accounting.ok===false` + flag `false` ใน record เดียวกัน |

R-2 ยังยืนยัน lifecycle เดิม: JSONL 4 steps `run_start → disclosure → discovery → pending` (ไม่มี `workspace`, ไม่มี `spawn`) และ preload ถูกโหลดในทุก run → การไม่ปรากฏ token เป็นเรื่องโครงสร้าง ไม่ใช่เงื่อนไขทดสอบขาด

หลักฐาน: `%TEMP%\ace-d1-tests\run-d1.js` → `TOTAL 34 PASS 34 FAIL 0`, exit 0
Final JSON: `%TEMP%\ace-real-export-evidence\` (`…20261104T004751-17884-b6ac` = R-1, `…004754-24004-a27b` = R-3, `…004758-21176-6be5` = R-4, `…004801-11600-9bd4` = R-5) และ `%TEMP%\ace-d1-tests\empty-root\evidence\…004754-18628-4216` = R-2

---

## 4. ชุดทดสอบเดิม (บนไบต์ที่ commit)

| การตรวจ | ผล |
|---|---|
| CLI matrix: VERIFIED / PARTIAL / PENDING / FILE_IS_FIXTURE / FILE_IS_REHEARSAL | **0 / 3 / 2 / 1 / 1** |
| Out-of-repo harness (`%TEMP%\ace-check-tests\run-tests.js`) | **20 / 20 PASS** |
| JSONL frozen sequence | **16 steps** ตามลำดับเดิม |
| `node --check verification/real-shopee-export-check.js` | exit 0 |
| Repository scope | เฉพาะไฟล์ที่ได้รับอนุญาต; ไม่มี `app/`, `data/`, `docs/`, governance ledger; ไม่มีไฟล์ใหม่ในรีโป |

---

## 5. ข้อจำกัด / หนี้ที่รับรู้

1. **ถ้อยคำใน comment (deferred):** comment ที่อนุมัติยังระบุ "PARTIAL/PENDING/FAILED" แต่ PENDING ไม่สามารถมี accounting ได้ — R-2 พิสูจน์แล้วว่าเป็น negative case คงข้อความเดิมไว้ตาม scope เดิม; หากต้องการแก้ถ้อยคำต้องอนุมัติแยก
2. Mismatch ถูก induce ที่ขอบเขต filesystem (silent copy loss) — path ที่ถูกทดสอบเป็น production code จริง แต่ตัวการสูญเสียเป็น fault injection
3. R-1 ไปถึง PARTIAL ผ่าน guard จำนวน offer (422) และ R-3 ผ่าน `COMMIT_FAILED` ไม่ได้ใช้ `SERVER_START_FAILED`
4. การบังคับใช้เห็นได้เฉพาะ path ที่มี workspace (PARTIAL / FAILED / VERIFIED); PENDING, `--dry-run`, argument error และ guard failure ไม่มี accounting โดยการออกแบบ

---

## 6. Reproduce

```powershell
cd "Y:\DevProject\Affiliate Content Engine"
node --check verification/real-shopee-export-check.js
node "$env:TEMP\ace-d1-tests\run-d1.js"          # TOTAL 34 PASS 34 FAIL 0
node "$env:TEMP\ace-check-tests\run-tests.js"   # TOTAL 20 PASS 20 FAIL 0
```

---

## 7. สถานะ git ณ เวลาปิดรอบ

- HEAD `3de34430481935f927215952469ea6661a4a6cb9` · branch `mission1-planning-docs` · ahead 12 · ไม่ push
- Working tree: `M app/mvp/content.js`, `M app/mvp/service.js` (pre-existing, ไม่แตะ) + 168 untracked เดิม (ณ เวลาปิดรอบ; บวกบันทึกฉบับนี้และ preflight อีก 1 ไฟล์)
- ไฟล์ checker: สะอาดตรงกับ commit
