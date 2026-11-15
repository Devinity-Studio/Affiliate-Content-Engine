# UX/UI Gap Analysis: Current Code vs UX Behavior Guide & Blueprint

**Date:** 2026-11-14
**Project:** Affiliate Content Engine (ACE MVP)
**Reference:** `Y:/DevProject/Affiliate Content Engine/reference/UX Behavior Guide/`

---
## 1. Reference Materials Overview

### 1.1 UX Behavior Guide (9 images)
| File | Phase | Description |
|------|-------|-------------|
| `1.Research.png` | Research | Market research, competitor analysis, keyword planning |
| `2.Plan.png` | Plan | Strategy selection, approach determination, resource planning |
| `3.2 Storyboard-Breakdown&Script.png` | Plan/Storyboard | Visual breakdown, script writing, scene mapping |
| `3.Storyboard.png` | Plan/Storyboard | Storyboard visualization, scene sequencing |
| `4.Production.png` | Production | Recording, voiceover, video assembly, editing |
| `5.Finalize.png` | Finalize | QC, Thai QA, review, export preparation |
| `Dashboard.png` | Overview | Dashboard overview, metrics, status |
| `Schedule.png` | Schedule | Calendar, task queue, timeline management |
| `Work Plan.png` | Planning | Work breakdown, milestones, resource allocation |

### 1.2 New Workflow Prototype (10-step)
From `Affiliate Content Engine UX_UI new workflow.html`:
1. Overview / Daily Brief
2. Research
3. Plan / Storyboard
4. Production
5. Schedule & Task
6. Publish & Export (NEW)
7. Profile & Channels
8. Candidate Pool
9. AI Video
10. Analytics

### 1.3 Current MVP Pipeline (6 stages from `mvp.js`)
| Key | Label | Hint |
|-----|-------|------|
| `profile` | Profile & Channels | `แพลตฟอร์ม · ช่องทาง · สถานะ AI` |
| `research` | Research & Candidate Pool | `วิเคราะห์ · คัด 5 รายการ` |
| `plan` | Plan & AI Video | `Hook · Action · Payoff · CTA` |
| `production` | Production & Finalize | `สตอรี่บอร์ด · เสียง · QC · Export` |
| `schedule` | Schedule & Task | `ปฏิทิน · คิว · Library` |
| `analytics` | Analytics | `รายได้ · อันดับคอนเทนต์` |
## 2. Gap Analysis: Current vs UX Behavior Guide

### 2.1 Phase Mapping Discrepancies

| UX Behavior Guide Phase | Current MVP Stage | Gap | Severity |
|------------------------|-------------------|-----|----------|
| **1. Research** (market/research) | `research` | ✅ Aligned | None |
| **2. Plan** (strategy/approach) | `plan` | ✅ Aligned | None |
| **3. Storyboard / Script** | `plan` (partial) | ⚠️ Script/CTA in plan stage, but no separate storyboard step | Medium |
| **4. Production** (recording/editing) | `production` | ✅ Aligned | None |
| **5. Finalize** (QC/review/export prep) | `production` (partial) | ⚠️ Finalize/QC merged into production | Medium |
| **6. Schedule & Task** | `schedule` | ✅ Aligned | None |
| **7. Publish & Export** (NEW) | ❌ Not in current MVP | 🔴 **Major Gap** - No publish/export workflow | Critical |
| **8. Analytics** | `analytics` | ✅ Aligned | None |

### 2.2 Missing Features from UX Behavior Guide

| Missing Feature | Current Status | Required Action |
|----------------|----------------|-----------------|
| **Publish to Social Platforms** (TikTok, Shopee) | Not implemented | Add publish step with platform selection |
| **Local Media Export** (MP4, Stems, Subtitles) | Not implemented | Add export dialog with format options |
| **Asset Library** (save for reuse) | Not implemented | Add library save/restore functionality |
| **Step 7: Execute All Selected Actions** | Not implemented | Add bulk action execution |
| **Granular Edit Mode** | Not implemented | Add point-specific editing per step |
| **10-Step Workflow Navigation** | 6-stage pipeline | Expand to cover full workflow |

### 2.3 UI/UX Inconsistencies

| Area | Current Code | UX Guide Expectation | Gap |
|------|--------------|---------------------|-----|
| **Step Count** | `0 / 6` in header | Should match actual phase count | ⚠️ Update to reflect phases |
| **Pipeline Navigation** | `pipeline` ol with step buttons | 10-step workflow navigation | 🔴 Needs expansion |
| **Publish/Export Section** | Not in UI | Subpanels for Option A (Social), Option B (Local), Option C (Library) | 🔴 Critical |
| **Dashboard Step Badge** | `Overview / Daily Brief` | Should show current phase from guide | ✅ Already present |
| **Workflow Steps Label** | Profile, Research, Plan, Production, Schedule, Analytics | Add: Research, Plan/Storyboard, Production, Finalize, Schedule, Publish/Export | 🔴 Missing steps |

### 2.4 Color/Style Consistency

| Element | Current CSS Tokens | UX Guide Colors | Status |
|---------|-------------------|-----------------|--------|
| Primary action (btn-primary) | `--violet: #a78bfa` | `--violet: #a78bfa` | ✅ Match |
| Success/positive (btn-lime) | `--lime: #c8f36a` | `--lime: #c8f36a` | ✅ Match |
| Background | `--bg: #101114` | `--bg: #101114` | ✅ Match |
| Surface | `--surface: #1b1c21` | `--surface: #1b1c21` | ✅ Match |
| Muted text | `--muted: #a4a3b0` | `--muted: #a4a3b0` | ✅ Match |

✅ **All color tokens match the UX Design Guide exactly.**
---
## 3. Action Plan: Step-by-Step Implementation

### Phase 1: Foundation & Pipeline Expansion (Week 1)

#### Step 1: Update Pipeline Step Count and Navigation
**File:** `app/public/mvp.html`
- Change `0 / 6` to reflect 5 main phases (or 10 steps if full workflow)
- Update pipeline navigation to include all UX Behavior Guide phases

**File:** `app/public/mvp.js`
- Update `SECTIONS` array to include all 10 workflow steps from the new prototype
- Add missing steps: `publish`, `export`, `storyboard_granular`

#### Step 2: Add Publish & Export Workflow
**File:** `app/public/mvp.html`
- Add new section for Publish & Export after Schedule
- Include three options:
  - Option A: Social & Affiliate Platforms (TikTok, Shopee)
  - Option B: Local Media Export (MP4, Stems, Subtitles)
  - Option C: Save to Asset Library

**File:** `app/public/mvp.js`
- Add publish logic similar to the new workflow HTML (lines 190-224)
- Add export button handlers for MP4, Stems, Subtitles
- Add library save handler

### Phase 2: Storyboard & Script Refinement (Week 2)

#### Step 3: Separate Storyboard Stage from Plan
**Rationale:** UX Behavior Guide has separate `3.Storyboard.png` and `3.2 Storyboard-Breakdown&Script.png` phases

**File:** `app/public/mvp.js`
- Split `plan` section into `plan` (Hook/Action/Payoff/CTA selection) and `storyboard` (visual breakdown, script writing)
- Add storyboard-specific controls: scene visual/text/audio tabs

**File:** `app/public/mvp.html`
- Add storyboard view panel with scene tabs (visual/text/audio)
- Add script editor area with approach selection (problem_first, value_compare, evidence_first, user_custom)

#### Step 4: Separate Finalize/QC from Production
**Rationale:** UX Behavior Guide has distinct `4.Production.png` and `5.Finalize.png` phases

**File:** `app/public/mvp.js`
- Add finalize/QC sub-stage within production section
- Include Thai QA review, checksum validation, and finalize button
- Ensure `finalize` requires draft review confirmation (interlock check)

**File:** `app/public/mvp.html`
- Add QC panel with Thai QA, checksum display, finalize button
- Add finalize confirmation dialog

### Phase 3: Publish/Export Implementation (Week 3)

#### Step 5: Implement Publish Options (Option A)
**From new workflow prototype:**
- TikTok Affiliate (บัญชีหลัก A)
- Shopee Video Affiliate

**Code:**
```javascript
// Add to mvp.js publish handler
function publishToSocial(platform) {
  // Validation: check if content is finalized
  // POST to /api/mvp/content/{id}/publish with platform
  // Show success/failure status
}
```

#### Step 6: Implement Local Media Export (Option B)
**From new workflow prototype:**
- Download Master Video (MP4)
- Download Stems (ภาพ, เสียงพากย์ WAV, ซับไตเติล SRT)

**Code:**
```javascript
// Add export handlers
document.getElementById('download-master').onclick = () => {
  // Trigger download of master MP4 file
  alert('ดาวน์โหลด Master Video (MP4) ลงเครื่องเรียบร้อย')
}

document.getElementById('download-stems').onclick = () => {
  // Trigger download of stems (separate files)
  alert('ดาวน์โหลดแยกชิ้นส่วน (Stems) เรียบร้อย')
}
```

#### Step 7: Implement Asset Library Save (Option C)
**From new workflow prototype:**
- Save to Asset Library with label ⭐

**Code:**
```javascript
// Library save handler
document.getElementById('save-library').onclick = async () => {
  // POST to library endpoint
  // Show confirmation
  alert('บันทึกเข้าสู่ Asset Library กลางเรียบร้อย')
}
```

### Phase 4: Dashboard & Schedule Enhancement (Week 4)

#### Step 8: Enhance Dashboard with Phase Badge
**File:** `app/public/mvp.js`
- Update step badge to show current phase name from UX Behavior Guide
- Add phase color coding (violet for research, lime for production, etc.)

**File:** `app/public/mvp.html`
- Add badge display: `<span id="mvp-phase-badge" class="badge badge-mock">Research</span>`

#### Step 9: Enhance Schedule Calendar
**File:** `app/public/mvp.css`
- Ensure calendar matches Dashboard.png specification
- Add proper day cells, event indicators, queue markers

**File:** `app/public/mvp.js`
- Integrate task queue with calendar visualization
- Add scheduled content markers (published/queued/published indicators)

### Phase 5: Final QA & Polish (Week 5)

#### Step 10: Cross-Platform Responsive Design
**File:** `app/public/mvp.css`
- Test all views on mobile (≤860px) and desktop (≥900px)
- Ensure pipeline navigation adapts properly
- Calendar adjusts from 7-day to 2-day layout

**File:** `app/public/mvp.js`
- Fix any broken navigation between steps
- Ensure state preservation across step transitions

#### Step 11: Analytics Integration
**File:** `app/public/mvp.js`
- Ensure analytics stage shows proper metrics
- Connect to any available API endpoints
- Display content ranking, earnings estimates

#### Step 12: Complete Gap Closure Verification
**Verification checklist:**
- [ ] All 9 UX Behavior Guide phases represented in UI
- [ ] Publish & Export workflow fully functional
- [ ] Storyboard and Finalize stages separated from Plan/Production
- [ ] All color tokens match UX Design Guide
- [ ] Responsive design works on mobile and desktop
- [ ] No console errors in any view
- [ ] Navigation between all steps works smoothly
- [ ] Stage badges display correctly

---
*Analysis complete. Ready to implement step-by-step per the action plan above.*