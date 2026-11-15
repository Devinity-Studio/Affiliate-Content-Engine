# AC-05 Fixture Test Contract — G3 Approval Before Publication

**Purpose**: Define fixture-level test contract for G3→PUB invariant, scoped to temporary workspace only. Does not test production server endpoints.

---

## 1. Test Scope and Isolation Boundary

| Aspect | Specification |
|--------|---------------|
| **Test environment** | Isolated temp workspace (fs.mkdtemp), server started with `ACE_MVP_STATE_FILE=<tmp>/mvp-runtime/fixture-state.json` |
| **Real repository impact** | None — `data/app/state.json`, `data/mvp/`, Git HEAD, and all tracked files remain byte-identical before and after |
| **What this tests** | Fixture-level gate logic: impact-preview confirmation requirement and G3-approval-before-PUB temporal invariant |
| **What this does NOT test** | Production server endpoint behavior, real publication, real affiliate accounts, real dashboard data |
| **Tagging** | All test outputs must include: `FIXTURE ONLY · ไม่ต้องเผยแพร่จริง` |

---

## 2. Preconditions

| Item | Requirement |
|------|-------------|
| Server state | Fresh fixture-state.json copied from `app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv` |
| Plan creation | Plan draft created via `POST /api/mvp/plan/draft` with valid candidate_id |
| Impact preview | `confirmImpact: true` confirmed (gate enforced: 400 without it) |
| G3 decision | **Absent** in run-history at test start (this is the variable under test) |
| Run-history | Empty or contains only pre-import/candidate actions (baseline) |

---

## 3. Test Cases

### Test 5A: No G3 Approval → Publication Rejected

| Field | Value |
|-------|-------|
| **Pre-condition** | Plan exists (MVP-PLAN-1-1-v1), no G3 DEC record in run-history |
| **Input** | Attempt publication attempt via mocked gate: `POST /api/mvp/pub` (fixture mock) without G3 approval |
| **Gate decision** | System rejects: status 403 or 409 with `BLOCKED_BY_GATE` |
| **Expected outcome** | - No PUB record created in fixture state<br>- `BLOCKED_BY_GATE` entry in run-history<br>- `posted_at` field absent from any PUB record |
| **Run-history entry** | `{ts: <ISO>, actor: OWNER_OPERATOR, action: "PUB attempt without G3", result: BLOCKED_BY_GATE, error_detail: "G3 decision not found", recovery: "Record G3 decision then retry"}` |
| **Isolation tag** | `FIXTURE ONLY · ไม่มี G3 approval → ปฏิเสธการเผยแพร่` |
| **What it proves** | The fixture gate logic prevents publication without G3 approval — **not** that production server enforces this gate |

---

### Test 5B: G3 Approval → Publication Accepted (Prerequisite)

| Field | Value |
|-------|-------|
| **Pre-condition** | Plan exists, G3 DEC record APPROVED recorded in run-history **before** publication attempt (timestamp T_G3) |
| **Input** | Publication attempt via mocked gate: `POST /api/mvp/pub` (fixture mock) with valid G3 approval |
| **Gate decision** | System accepts: status 201; PUB record created |
| **Expected outcome** | - PUB record created with `posted_at` timestamp (T_PUB)<br>- T_G3 < T_PUB (G3 precedes PUB in run-history)<br>- PUB record contains minimal required fields (per fixture contract) |
| **Run-history entries** | 1. G3 DEC APPROVED (ts: T_G3)<br>2. PUB attempt (ts: T_PUB, result: OK)<br>3. (Optional) caption-comparison note |
| **Isolation tag** | `FIXTURE ONLY · มี G3 approval ที่ตรวจสอบได้ → อนุญาตให้เข้าสู่ขั้นตอน PUB` |
| **What it proves** | When G3 is present in fixture run-history, publication gate allows progression — **not** that real deployment’s PUB route exists |

---

### Test 5C: Timestamp Ordering Verification

| Field | Value |
|-------|-------|
| **Pre-condition** | Both G3 DEC and PUB attempt executed in sequence |
| **Input** | Verify run-history ordering |
| **Expected outcome** | - G3 DEC record appears earlier in run-history than PUB entry<br>- Difference T_PUB − T_G3 logged and verified > 0 |
| **Isolation tag** | `FIXTURE ONLY · ตรวจลำดับเวลา G3 → PUB จาก run-history` |
| **What it proves** | Fixture records temporal ordering — **not** production server clock behavior |

---

## 4. Prohibited Conditions (PUB record creation forbidden)

| Condition | Reason | Fixture Response |
|-----------|--------|-----------------|
| No G3 DEC record in run-history | Gate not met | PUB rejected 403/409; no PUB record written |
| G3 DEC record exists but status ≠ APPROVED | Gate not met | PUB rejected 403/409; no PUB record written |
| G3 DEC record older than another conflicting gate (e.g., G2 not approved) | Workflow boundary | PUB rejected; run-history logs BLOCKED_BY_GATE with detail |
| Plan impact preview not confirmed (`confirmImpact: false`) | Pre-condition failure | Plan creation refused 400; publication never reached in this workflow |

**Important**: When any prohibited condition is met, the test asserts that **no PUB record exists** in the fixture state file. This is the critical evidence point.

---

## 5. Test Execution and Verification

```bash
# Pseudo-command (not executed in real repo)
node verification/ac-05-fixture-test.js \
  --precondition "plan_created" \
  --test-case "5A" \
  --expected "blocked_no_pub" \
  --tag "FIXTURE ONLY"
```

**Verification steps after test run**:
1. Check `data/app/state.json` MD5 unchanged (before = after)
2. Check `data/mvp/` directory absent (confirmed by `dirSignature`)
3. Check Git HEAD unchanged
4. Inspect run-history for `BLOCKED_BY_GATE` entry
5. Confirm no `PUB-*` records in fixture state
6. Record exit code: 0 = all assertions passed

---

## 6. Design Principles (Do Not Cross)

| Principle | Specification |
|-----------|---------------|
| **No production endpoint assumption** | Test uses fixture mock, not real `/api/mvp/pub` route |
| **Run-history as source of truth** | G3/PUB temporal ordering verified from run-history, not from in-memory state |
| **Repository integrity preserved** | All original files unchanged; temp workspace cleaned up after |
| **Isolation boundary explicit** | Every test output includes `FIXTURE ONLY` tag |
| **Status separation** | AC-05 fixture results do not change AC-01–AC-08 status without independent deployment evidence |

---

## 7. When to Escalate to Deployment-Level Test

This fixture test contract is **insufficient** for the following, which require separate deployment-level testing:

- Actual `/api/mvp/pub` HTTP endpoint behavior on real server
- D1/R2 PUB record persistence in Sites environment
- Live URL generation and screenshot capture
- Affiliate commission tracking and payout
- Real dashboard OBS integration

**Escalation path**: After fixture tests pass and are documented, create separate test contract for Sites deployment with real publication infrastructure (if/when owner authorizes).

---