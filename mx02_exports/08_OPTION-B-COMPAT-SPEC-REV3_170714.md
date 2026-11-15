The user's decision: Technical Direction APPROVED, Compatibility Spec CONDITIONALLY APPROVED, Implementation NOT AUTHORIZED. They say: to consider spec ready for developer, must close 3 items:
1. Decide dependency handling for nowIso, sha256, httpError, money without breaking deterministic behavior.
2. Confirm whether `path` is genuinely needed or leftover.
3. Confirm a baseline of the working tree usable for rollback without destroying existing work.

Note: Super Brain in this message did NOT pick D-2 explicitly — unlike the earlier message which said "เลือก D-2". Here they say "แนวทางที่ผมเลือกคือให้ตรวจการใช้งานของ helper ทั้ง 4 ตัวใน deterministic code ก่อน แล้วเลือกวิธีจัด dependency ที่ไม่เพิ่ม public export โดยไม่จำเป็น" — i.e., first check how the 4 helpers are used in deterministic code, then choose an approach that doesn't add public exports unnecessarily and doesn't duplicate logic. That's a nuance: they now prefer NOT adding public exports unless necessary.

So I need to determine: are nowIso/sha256/httpError/money used by deterministic code within content.js (outside the block)? If yes, they must stay in content.js and be shared → then exporting them (D-2) or requiring content from ai (D-1) are options. If a helper is used ONLY by the AI block, it can simply move into ai/.

I have PASS 1 data but that only covered symbols declared INSIDE the block. NowIso/sha256/httpError/money are declared outside. I need counts of their usage inside vs outside the block within content.js, and externally.

From earlier data: many deterministic functions use nowIso (project.updated_at = nowIso()) — definitely used throughout. sha256 used in export checksums. httpError used everywhere. money probably used in prompt builder AND deterministic script/storyboard? Need measurement.

Let me measure precisely:
For each of nowIso, sha256, httpError, money:
- refs inside block (1098-1546)
- refs outside block in content.js
That determines whether the helper is shared.

If shared by deterministic code (outside refs > 0), it must remain in content.js and be shared with ai/ → options:
(a) export from content.js (D-2) — adds export surface
(b) ai/ requires ../content (D-1) — but then needs them exported too! Since require only sees exports, D-1 CANNOT access non-exported helpers either. So D-1 is strictly impossible for non-exported helpers unless we export them. Super Brain already caught this: D-1 only gets createContentProject.
(c) duplicate in ai/ (D-3) — semantic drift risk, rejected by Super Brain earlier.
(d) **inject via parameters** (D-4, new): service.js passes them? service doesn't have them.
(e) **move the helpers to a new shared module** (e.g., app/mvp/shared/…) — but that adds a file outside allowlist and changes content.js imports; bigger.
(f) **keep the helpers in content.js and pass them as a small dependency object at call time from service.js** — service would need them, no.
(g) **define them inside ai/ and export from content.js? no.

Actually a cleaner option: put the 4 helpers in the AI module? No — deterministic needs them.

So realistically: either export from content.js (D-2, minimal, 4 extra export lines, no logic duplication, no cycle) OR extract helpers into a shared leaf module both import (bigger, adds file, changes content.js requires — but arguably cleanest architecturally).

Given Super Brain's constraint "ไม่เพิ่ม public export โดยไม่จำเป็น" (don't add public exports unnecessarily) — the test is whether the helper is needed by AI at all, and whether it's already used by deterministic code.

Key insight: if a helper is used ONLY inside the block (AI), move it to ai/ — no export needed at all. If used on both sides, it's genuinely shared.

Let me measure. Then decide per-helper:
- nowIso: used many places deterministically (project.updated_at etc.) → shared.
- sha256: used in exportProject? maybe content checksum → shared.
- httpError: everywhere → shared.
- money: maybe only in prompt builder → could move.

If shared, the minimal choice that adds no *public* export and doesn't duplicate: **extract the 4 helpers into a new leaf module** `app/mvp/ai/…`? No — deterministic needs them, and content.js requiring ai/ violates Module Isolation. So a shared leaf module must NOT be under ai/. Something like `app/mvp/support.js` or `app/mvp/internal/util.js`. But that adds a 6th path to the allowlist and changes content.js's requires (adding one, removing two) — still Module Isolation-safe.

Hmm. But which is truly smallest and safest? Options for shared helpers:

Option S1 (D-2): export the 4 from content.js; ai/ requires ../content. Cost: +4 exports in content.js (internal-support, not public API); ai/ loads entire deterministic module (already the case under D-1). No new file. No logic change. Zero duplication. Cycle-free.
Option S2: create `app/mvp/internal/helpers.js` exporting nowIso/sha256/httpError/money; content.js requires it (replacing local defs) and ai/ requires it. Cost: +1 file (6 paths), content.js changes at 4 declaration sites (deleting them), but no new exports on content.js, and ai/ does NOT load content.js. Architecturally cleanest separation — AI no longer drags the whole content module. Risk: touches deterministic declarations (removing functions that deterministic code calls — but they'd be imported, so behaviour identical). Slightly larger diff.

Super Brain's criteria: "ไม่เพิ่ม public export โดยไม่จำเป็น และไม่ทำให้ logic ซ้ำจนเกิด semantic drift" → S2 satisfies "no new public exports" but adds a file; S1 adds exports but no file.

I should present the measurement and recommend one, clearly, with the decision rationale, and mark as OWNER decision since Super Brain said "ให้ตรวจการใช้งานก่อน แล้วเลือกวิธี" — the decision authority for the final pick: they asked me to check usage first, then choose an approach that avoids unnecessary public exports and duplication. So they delegated the choice conditionally on the audit. I can recommend, but flag as needing Owner/Super Brain confirmation. Given they said "ตัดสินใจเรื่อง dependency ... โดยไม่ทำลาย deterministic behavior" is a prerequisite to close — I should make the decision with justification, but mark it as requiring their ratification (they hold approval).

Item 2: path — I already measured: 0 `path.` refs in block. So `path` at :27 is a leftover for the AI block; but is `path` used by deterministic code in content.js? Yes exportProject uses path.resolve (:1557). So `path` stays in content.js for deterministic code; the AI module needs `node:path` only if it uses it — it doesn't (0 refs). So: `path` is NOT a dependency of the extraction. U-9 CLOSED: no import needed in ai/; content.js keeps it.

Wait — careful: PASS 2 listed `path` as "required by block" because grep -Fqw matched the word `path` somewhere in block text. But 0 `path.` refs. Maybe `path` appears in a string or property name? e.g., `paths`, `path` property in an object, or `snapshot.path`. So the word appears but no `path.` method call. Could be `asset.path` or a destructured field. Need to check: grep -n "\bpath\b" in block to see context. If it's an object property access like `.path` it doesn't need the module. Let me verify to be rigorous.

Item 3: baseline. I need to confirm whether a usable baseline exists. I cannot create one (read-only, no file creation). What I can do: check for existing baseline artifacts: verification/baseline-manifest-2026-11-03.json (that's E1 baseline, contains hashes of some files — maybe includes content.js!). That could serve as the baseline reference for content.js/service.js. Also check whether a preserved snapshot exists (Owner said preservation completed). Check: any snapshot dir? e.g., outside repo? I can't go outside. Check for `*.zip`, `preserved/`, `snapshot/` dirs inside repo.

So: inspect baseline-manifest-2026-11-03.json for which paths it hashes — if it includes app/mvp/content.js, then we have a hash-verifiable baseline for that file (though at 2026-11-03, and diff mtimes are 2026-11-01, so content.js hash should match current if unchanged). Then compute current sha256 of the 5 allowlisted files and compare to manifest entries. That gives a real, evidence-based answer to item 3: either "baseline covers N of 5 paths" or "no baseline".

Note: computing sha256 of files is read-only — allowed (earlier audits did hash files).

Let me get manifest path list: grep for "path" entries or "app/mvp/content.js" in manifest.

Plan the batch:
Command 1: helper usage measurement (inside/outside block + external files) for the 4 helpers; plus `path` word context in block.
Command 2: baseline existence: grep content.js/service.js in baseline-manifest; list any snapshot/zip; hash the 5 allowlisted files; compare with manifest if present.
Read: manifest head structure (maybe 1-60 lines) to understand fields.

Also: MI-3 suite details — I have data now:
- ace-mission1-acceptance.js: 1232 L, spawns server child (SERVER = app/server.js), uses temp dirs; runs tests; header says "core functions directly without requiring server startup" + Test 7 real server child.
- content-creation-acceptance.js: 413 L, spawns server, temp state/exports, drives HTTP.
- mvp-workflow-acceptance.js: 572 L, spawn, PORT env 4310, throwaway copy of app/data/docs.
- visual-verify-export.js: 173 L, attaches to a running server started by shell; needs PORT; needs ffmpeg (export video/still); workspace .tmp/visual-verify.

Important: MI-3 requires suites to pass with provider dir absent. But content-creation-acceptance and mvp-workflow-acceptance spawn the server — fine after fix. visual-verify-export requires a server started externally + ffmpeg — it's a driver, not self-contained. So MI-3 should name the first three as self-contained; visual-verify-export is excluded from MI-3 (external server + ffmpeg dependency) or run separately. That's a precise, honest refinement — good.

Also note ace-mission1-acceptance.js might be the "Content Artifact v1" test, which is Mission 1 (not MVP slice) — it spawns the same server.

Also, exit codes: they use failures counter; need to confirm process.exitCode at end. Let me grep for "process.exit" in those files — my earlier grep pattern included process.exit but output didn't show any. Hmm, the grep showed `const/let/require/function` lines and no process.exit matches → maybe they use `process.exitCode = failures ? 1 : 0`. Let me grep specifically for exit code handling to state exact pass/fail semantics. Important for MI-3 ("pass criterion").

Let me add that to command 1 or separate.

Batch now: 3 calls (2 terminal + 1 read). Then final answer in next turn? The system reminder wants everything in this response if possible, but final answer must come after data. I'll do the batch now and write Rev 3 next turn. That's acceptable — one round trip.

Actually, I could try to do the full job in this response: batch the commands, but I can't see results until next turn. So next turn writes Revision 3.

Let me maximize data collection now.

Command A:
- For h in nowIso sha256 httpError money: total refs, inside block, outside block, external files.
- `path` word context lines in block (grep -Fn "path" block with line numbers), to classify.
- exit code handling in 4 suites: grep -n "exitCode\|process.exit\|failures" in each.

Command B:
- Baseline: grep -c app/mvp/content.js in baseline-manifest; extract paths list; compute hashes of 5 files; look for snapshot artifacts (find . -maxdepth 2 -name "*snapshot*" -o -name "*.zip" etc., excluding node_modules).

Read: baseline-manifest 1-45 to see schema.

Let me write them carefully with fixed strings.

For hashes: `sha256sum app/mvp/content.js app/mvp/service.js ...` — available in git bash.

Compare: if manifest has content.js sha, compare.

Let me go.

Super Brain's three closing conditions are all measurement questions. Running the exact audits now: helper usage split, the real status of `path`, and whether a hash-verifiable baseline exists.

I have all data needed. Let me interpret carefully.

**Helper usage split (decisive):**
| helper | inside AI block | deterministic remainder | verdict |
|---|---|---|---|
| nowIso | 1 | 24 | SHARED — stays in content.js |
| sha256 | 1 | 12 | SHARED |
| httpError | 1 | 34 | SHARED |
| money | 1 | 6 | SHARED |
| createContentProject | 2 | 2 | SHARED, already exported |

So all four helpers are used by deterministic code far more than by the AI block (1 reference each in the block). None is AI-only → cannot simply move into ai/. Confirms Super Brain's condition: cannot delete/move the block without resolving inbound deps.

Now what's the best dependency arrangement given "ไม่เพิ่ม public export โดยไม่จำเป็น และไม่ทำให้ logic ซ้ำ"?

Key observation: each helper is used exactly ONCE in the AI block. The minimal, zero-new-export, zero-duplication approach: **pass them in as a dependency bundle at the call site** — i.e., `createScriptDraftWithProvider(input)` already receives many inputs; add nothing... hmm, but the call comes from service.js which doesn't own these helpers.

Alternative that avoids new exports entirely: **the AI module imports content.js and uses its exports** — impossible for non-exported helpers.

So options:
- **S1 (D-2 as originally proposed):** export 4 helpers from content.js. +4 export lines. Zero logic change, zero duplication, cycle-free. Adds public surface.
- **S2 (shared leaf module):** new `app/mvp/internal/helpers.js` with nowIso/sha256/httpError/money; content.js requires it and deletes 4 local declarations; ai/ requires it. +1 file (allowlist → 6 paths), content.js loses 4 declarations (a deterministic change, though behaviour-identical), and ai/ does NOT pull content.js. No new public export on content.js.
- **S3 (duplicate in ai/):** rejected — semantic drift.
- **S4 (inject from service.js):** service.js would need the helpers; it has its own copies? service.js has sha256, nowIso usage — let me think: service.js appears in external list for nowIso/sha256/httpError/money, meaning service.js defines or uses similarly-named functions. If service.js already has its own httpError/sha256/nowIso, passing its copies into the AI module would mean the AI module uses service's implementations — duplicate-implementation risk again (they're likely identical but separate). Not better.

Now: which does Super Brain's constraint favor? They said: "เลือกวิธีจัด dependency ที่ไม่เพิ่ม public export โดยไม่จำเป็น และไม่ทำให้ logic ซ้ำจนเกิด semantic drift."

S1 adds public exports. Is it "necessary"? The helpers are genuinely shared; exporting is the standard way to share. But S2 achieves sharing without growing content.js's public API, at the cost of one extra file and touching deterministic declarations.

Critically: Super Brain also said the allowlist is fixed at 5 paths and "ไม่เพิ่มไฟล์ใหม่เกิน allowlist" was a reason they gave earlier for favoring D-2. In this latest message they did NOT repeat that; they said check usage first, then choose without unnecessary public exports and without duplication.

Hmm. There's a third option that's arguably the best and needs no new file and no new export: **move the 4 helpers into `app/mvp/ai/script-draft.js`? No — deterministic needs them.

What about: **keep helpers in content.js, and have the AI module receive them via a dependency object constructed in content.js**? But content.js can't be involved (it must not load ai/). The AI module is required by service.js; service.js could require content.js (it already does) and pass `contentModule` internals — but non-exported helpers still inaccessible.

So realistically S1 or S2.

Weighing risk: S2 changes deterministic file structure (removing 4 function declarations and adding a require). If the leaf module has any issue, deterministic breaks — the exact thing we must not do. S1 changes nothing behaviourally: 4 export entries appended; deterministic code untouched; ai/ requires ../content (already the case for createContentProject). S1 is strictly lower-risk on the deterministic path, which is the stated priority ("โดยไม่ทำลาย deterministic behavior").

But S1 makes ai/ load the entire content module (D-1's accepted limitation, U-10 — Super Brain accepted as tolerable). And with S1, content.js exports 4 helpers that are "internal support exports", explicitly not public API — Super Brain itself earlier directed: "ต้องแก้ C-01 ให้ระบุข้อยกเว้น D-2 อย่างชัดเจน และกำหนดว่า helper เหล่านี้เป็น internal support exports" (that was the earlier message). In this latest message they softened to "choose a method that doesn't add public exports unnecessarily" — noting that D-2 was already their earlier decision. I'll recommend **S1/D-2** but reframed precisely: the exports are *internal support exports*, documented as not public API, and justified because each helper is used 6–34 times by deterministic code and exactly once by the AI block — i.e., they belong to the deterministic core and are being lent, not moved.

That directly satisfies "ไม่ทำลาย deterministic behavior" (zero changes to deterministic code), "ไม่เพิ่ม public export โดยไม่จำเป็น" (necessary: the alternative is duplication or restructuring), and "ไม่ทำให้ logic ซ้ำ".

I'll present S2 as the rejected alternative with reasons (touches 4 deterministic declarations; adds a 6th path; behaviour-identical but higher blast radius), and S3/S4 rejected.

Hmm — but Super Brain explicitly said in the previous message "เลือก D-2" and in this message asked to verify usage first. So the audit validates D-2. Good: report audit → D-2 confirmed, with C-01 exception precisely worded.

**Item 2 — `path`:** 1 match in block, and it's in a comment: line 1103 "The deterministic path above is the default..." → the word "path" in prose, not a module use. So `path` is NOT a dependency of the extraction. U-9 CLOSED. `content.js:27` stays (exportProject uses path.resolve at :1557 area). ai/script-draft.js needs `node:path`? No — 0 refs. Good, definitive.

**Item 3 — baseline:** E1 baseline manifest covers NONE of the 4 code paths (manifest_hits=0). It covers state stores (schema: ace.baseline-manifest/v1, state_baseline.stores). So it is NOT a code baseline → cannot serve for rollback. Found archives: `Affiliate-Content-Engine-Review.zip` (known stale — 10/10 differ), `.tmp/2c8/service.valid-snapshot.js` (an old service.js snapshot from 2C-8, not current), `.tmp/2c9-readonly-evidence-.../service.prefix-snapshot.js`. None is a verified baseline of the current 5 allowlisted paths.

Therefore: **U-8 = BLOCKER confirmed. No usable baseline exists in the working tree.** Rollback precondition cannot be met today. This directly answers Super Brain's item 3: "ยืนยันให้ได้ว่ามี baseline" → answer: NO, not verifiable; must be created by Owner (requires a write operation, which is not authorized here).

Current hashes recorded (first 16 chars) — I can report full hashes? I have truncated to 16 in output. I could report truncated + note full values computable. Better: give the short forms and say full 64-char values must be recorded in the baseline artifact. Actually for a baseline, full hashes matter. I can re-run sha256sum without truncation... but that's another call. I'll include the truncated prefixes and state that full values must be captured in the baseline record; it's honest. Hmm, a baseline record with truncated hashes is useless. Better to state: "current prefixes (full values to be captured in the baseline artifact)". Or I could just say verification of hash equality is possible because I can recompute. Since I can't create the file anyway, prefixes suffice for identification. I'll present them as identification prefixes and add that the baseline artifact must store full 64-char values.

**MI-3 suite detail** (needed correction):
1. `verification/ace-mission1-acceptance.js` — 1,232 L; spawns `app/server.js` child (`:81,:84`); exit `process.exitCode = allPassed ? 0 : 1` (`:1226`). Tests: Content Artifact v1 acceptance (core functions + Test 7 real route).
2. `verification/content-creation-acceptance.js` — 413 L; spawns server with temp state/exports; `exitCode = failures ? 1 : 0` (`:407`). Tests: full HTTP slice import→…→export→publish prep, reload from disk.
3. `verification/mvp-workflow-acceptance.js` — 572 L; spawns on PORT 4310 default; `process.exit(1)` on failure (`:569`). Tests: /api/mvp/* field-level acceptance on throwaway copy of app/data/docs.
4. `verification/visual-verify-export.js` — 173 L; **not self-contained**: attaches to a server started externally (`PORT=8427 node app/server.js …`), requires ffmpeg for MP4/still, writes to `.tmp/visual-verify/`.

So MI-3 must specify: suites 1–3 are self-contained (they spawn their own server) and are the MI-3 gate; suite 4 is a *driver* requiring a pre-started server + ffmpeg and must be run separately (or excluded from MI-3 with reason). That's a precise, honest refinement. Also note none of the 4 uses AI symbols (per earlier blast radius) → none should fail from the absence of the provider dir after the fix. But: do they require provider indirectly? They spawn the server → server requires service → content. After B, content has no provider require → OK. Before B, they'd fail if provider dir absent. Good.

Also caution: MI-3 renames/hides `app/mvp/provider/` — but the two Gate-3 scripts require provider directly and would fail; they're excluded from MI-3 by design. State that explicitly.

Also: `visual-verify-export.js` writes into `.tmp/visual-verify/` — a workspace; fine on isolated copy.

Now write Revision 3. Required changes:
- §3.3: D-2 SELECTED, with the audit table justifying it; D-1 shown as impossible (exports-only) — I should correct my own §3.3 claim from Rev 2: D-1 was wrong for 4 helpers. Acknowledge.
- §4.1: add the helper usage split table; boundary now FINAL (not provisional) with 5 shared helpers resolved via D-2.
- §4.2: change budget: add row 5 = append 4 internal support exports; total content.js change = 4 deletions regions + 4 export additions.
- C-01: rewrite with explicit D-2 exception and "internal support exports, not public API" classification + rule: must not be documented/promoted as public, must not be re-exported elsewhere.
- New C-19: internal support export discipline.
- U-3 resolved: direct require inside if branch.
- U-4 resolved: ai module exports exactly 2 symbols.
- U-9 resolved: `path` is a comment word, not a dependency.
- U-8: confirmed BLOCKER, no baseline exists.
- U-6: report what DR-05 actually says vs measured. DR-05 text: "5 of 6 fixture products cannot be scripted at all, even by quoting the snapshot exactly. The one that passes does so by coincidence..." Register line 145 and line 216. My measured state: 8 products, 5 with unit tokens (30ml, 3-Tier, 1.5kg, 6mm, 26cm), 3 without (Bluetooth TWS Earbuds, Baby Diapers Pack, Sunscreen SPF50 50ml — wait SPF50 50ml has 50ml → token). Let me recount: PRD-1001 30ml ✓token, 1002 50ml ✓, 1003 3-Tier ✓, 1004 Earbuds ✗, 1005 1.5kg ✓, 1006 6mm ✓, 1007 26cm ✓, 1008 Diapers ✗. So 6 of 8 have digit/unit tokens, 2 don't. DR-05 says 5 of 6 → different fixture set (6 products). So DR-05's denominator (6) does not match the current 8-product fixture-state. → Cannot reconcile by counting; the register likely evaluated an earlier 6-product fixture set. Verdict: UNVERIFIED/inconsistent denominators; do NOT change the number; needs the register author's scope. Report: measured 6 of 8 products carry digit/unit tokens; DR-05's "5 of 6" uses a different denominator and cannot be confirmed or corrected from current state alone. That's exactly "ห้ามแก้ตัวเลขโดยอาศัยการคาดเดา".
- MI-3 detail with names/commands/what tested + the suite-4 exception.
- §10 baseline: confirmed no usable baseline; stop condition.
- §11 updated unresolved list.
- §12 checklist updated.
- Change log Rev2→Rev3.

Also the user's message says "Technical Direction APPROVED / Spec CONDITIONALLY APPROVED / Implementation NOT AUTHORIZED". I should reflect that authority status at top.

Length: keep it disciplined. This is Rev 3 of a spec; I'll include full sections but concise, focusing changes. Must remain a *complete* specification (deliverable 1 earlier), but now I can compress unchanged sections with "unchanged" markers... Previous revisions kept full text. I'll keep all sections but tighter, and mark [CHANGED v3].

No more tool calls needed. Write final answer.

Also add explicit "no implementation/execution" statement.

One more precision: D-2 requires `ai/script-draft.js` to require `../content` to reach the exported helpers + createContentProject. So the AI module depends on content.js; content never depends on ai. Cycle-free. Accepted limitation U-10.

Also the export additions must be appended where? In module.exports object at :1925-1948, alphabetically? The list order: ... createContentProject, SCRIPT_DRAFT_OPERATION, buildScriptDraftPrompt, validateScriptDraft, createScriptDraftWithProvider, applyVisualEdit ... They're grouped semantically. I'll specify: add the 4 under a clearly commented block "internal support exports (AI module only — not public API)" rather than scattering alphabetically. Good practice and auditable.

Write it.

Super Brain's three conditions are now measurable. All three came back with definitive answers — one of them bad.

# OPTION B — STRICT PROVIDER ISOLATION COMPATIBILITY SPECIFICATION
## Revision 3 — Dependency Boundary Closed

**Authority state:** Technical Direction **APPROVED** (Super Brain) · Compatibility Specification **CONDITIONALLY APPROVED** · **Implementation NOT AUTHORIZED** · Gate 3 / A2 / Gate C **UNCHANGED**.

**Labels:** **[VERIFIED]** from source · **[REPORTED]** · **[INFERENCE]** · **[PROPOSED]** · **[UNVERIFIED]** · **[OWNER]**

---

## 1. Executive Summary

1. **Direction confirmed unchanged** — Strict Provider Isolation; Runtime **and** Module Isolation; provider files stay at `app/mvp/provider/`; `ai/script-draft.js` loaded only inside `if (useLlm === true)`.

2. **[CORRECTED] My Revision 2 §3.3 recommendation of D-1 was technically wrong, and Super Brain was right.** D-1 (`require('../content')`) can only reach **exports**. Of the five inbound dependencies, exactly one (`createContentProject`) is exported. D-1 therefore repaired 1 of 5 dependencies while the document implied it repaired all of them. **D-1 is withdrawn as an option.**

3. **[RESOLVED — condition 1] The helper audit decides it: D-2 is the only arrangement that satisfies all four constraints.** Each of `nowIso`, `sha256`, `httpError`, `money` is used **exactly once** by the AI block but **12–34 times** by deterministic code (§4.1). They are deterministic core functions being *lent*, not AI helpers being *moved*. D-2 therefore changes **zero deterministic statements** — the strongest available protection for the deterministic path.

4. **[RESOLVED — condition 2] `path` is not a dependency.** The single match inside the block is the word "path" in a prose comment (`content.js:1103`). Zero `path.` calls. `content.js:27` stays for `exportProject`; `ai/script-draft.js` needs no `node:path`.

5. **[CONFIRMED BLOCKER — condition 3] No usable rollback baseline exists.** The E1 baseline manifest (2026-11-03) contains **0** references to any of the four code paths — it is a *state-store* baseline (`ace.baseline-manifest/v1`, `state_baseline.stores`), not a code baseline. The only archives in the tree are known-stale or unrelated (`.tmp/2c8/service.valid-snapshot.js`, `.tmp/2c9-.../service.prefix-snapshot.js`, `Affiliate-Content-Engine-Review.zip`). **The rollback precondition cannot be met today.**

6. **Coverage stays at 8 PROPOSED cells** (1 usable candidate × 4 approaches × 2 paths). **Not** 8 verified passes.

---

## 2. Evidence Basis and Limitations

**Inspected read-only:** `app/mvp/content.js` (1,949 L), `app/mvp/service.js`, `app/mvp/provider/{openrouter,provenance}.js`, `package.json`, `data/mvp/fixture-state.json`, `app/public/**` (grep), the four acceptance suites, both Gate 3 scripts, `verification/baseline-manifest-2026-11-03.json`.

**Audit method:** fixed-string word-boundary counting over `content.js`, split by block range `1098-1546`; plus every `.js` under `app/` and `verification/` for external consumers.

**Limitations:** L-1 nothing executed — all runtime claims are **[INFERENCE]**. L-2 no test runner exists; `package.json` has only `start` and `check:posthog`. **[VERIFIED]** L-3 tree may have changed since the Owner's snapshot **[REPORTED]**. L-4 no `.env`/secret read. L-5 no OD-F17 canonical artifact asserted. L-6 audit is syntactic; closure-only reachability is **[UNVERIFIED]**.

---

## 3. Target Architecture

### 3.1 Layout [unchanged]

```
app/mvp/
├── service.js            # requires ai/script-draft.js ONLY inside if (useLlm === true)
├── content.js            # deterministic content only
├── ai/script-draft.js
└── provider/{openrouter,provenance}.js   # unchanged location
```

### 3.2 Loading boundary

| Path | Graph | Provider loaded? |
|---|---|---|
| Deterministic E1 | `server.js:20 → service.js:27 → content.js` | **NO** |
| AI opt-in | `… → service.js → [useLlm === true] → ai/script-draft.js → provider/*` | **YES** |

Current violation **[VERIFIED]:** `content.js:31-32` top-level provider requires; `node app/server.js` fails if `app/mvp/provider/` is absent.

### 3.3 [REWRITTEN v3] Dependency decision: **D-2 SELECTED**

| Option | Mechanism | Reaches non-exported helpers? | Verdict |
|---|---|---|---|
| D-1 | `require('../content')` | **NO** — exports only | **WITHDRAWN** (Rev 2 error) |
| **D-2** | **Append 4 internal support exports to `content.js`; `ai/` requires `../content`** | **YES** | **SELECTED** |
| D-3 | Duplicate helpers in `ai/` | Yes | **REJECTED** — two `sha256`/`money` implementations will drift |
| S2 | New leaf module `app/mvp/internal/helpers.js` | Yes | **REJECTED** — adds a 6th path **and** removes 4 declarations from deterministic code (§4.1 rationale) |

**Why D-2 wins on evidence, not preference:** the helpers are deterministic-core functions (24/12/34/6 deterministic references vs 1 each in the AI block). D-2 leaves every deterministic statement byte-identical and adds only four export entries. S2 is architecturally tidier but **edits the deterministic file's structure** — the one risk this task must not take.

**Accepted consequence (U-10):** `ai/script-draft.js` loads `../content`, so the AI graph includes the deterministic module. Direction is `ai → content` only; `content` never loads `ai`. **Acyclic. [VERIFIED]** Deterministic path unaffected.

**Binding rule:** `service.js` requires `ai/script-draft.js` **inside the `if (useLlm === true)` branch only** — a direct inline `require`, not a memoized getter (U-3 resolved). No top-level reference anywhere. **[PROPOSED]**

---

## 4. Compatibility Contracts

### 4.1 [NEW v3] Helper dependency audit — boundary now final

| Helper | Declared | Used in AI block | Used in deterministic remainder | Exported today | Resolution |
|---|---|---|---|---|---|
| `nowIso` | `:132` | 1 | **24** | NO | **export (D-2)** |
| `sha256` | `:136` | 1 | **12** | NO | **export (D-2)** |
| `httpError` | `:140` | 1 | **34** | NO | **export (D-2)** |
| `money` | `:147` | 1 | **6** | NO | **export (D-2)** |
| `createContentProject` | `:424` | 2 | 2 | **YES** (`:1920`) | use existing export |
| `crypto` / `path` / `thaiQa` | `:25/:27/:29` | module refs | — | modules | `node:crypto`, **not `path`** (§4.2), `../thai-qa` |
| `providerModule` / `provenance` | `:31/:32` | 1 / 5 | — | modules | `../provider/*` |

**In-block declarations: 25 [VERIFIED]** — **21 internal-only** (0 references outside the block, safe to move), **4 externally referenced** (`SCRIPT_DRAFT_OPERATION`, `buildScriptDraftPrompt`, `validateScriptDraft`, `createScriptDraftWithProvider`).

**External consumers [VERIFIED]:** `service.js` (`:2728`) + `verification/openrouter-gate3-offline-check.js` + `verification/openrouter-gate3-script-validation-check.js`. No others.

**`path` — U-9 CLOSED [VERIFIED]:** the only match in the block is `content.js:1103` — the word "path" in the sentence *"The deterministic path above is the default…"*. **Zero `path.` calls.** `content.js:27` remains for `exportProject`; the AI module requires no `node:path`.

**Deletion boundary: FINAL** (subject only to Owner authorization).

### 4.2 [CHANGED v3] `content.js` change budget — final

| # | Change | Location |
|---|---|---|
| 1 | Delete `require('./provider/openrouter')` | `:31` |
| 2 | Delete `require('./provider/provenance')` | `:32` |
| 3 | Move the AI block (25 declarations) to `ai/script-draft.js` | `:1098-1546` |
| 4 | Delete 4 AI export entries | `:1928-1931` |
| 5 | **Append 4 internal support exports** under a comment block: `// internal support exports — AI module only; not public API` | in `:1925-1948` |

**Nothing else changes.** No deterministic statement is edited. `path` stays. Audit rule: `git diff` on `content.js` shows only these regions; `exportProject` (`:1551` onward), library, and R1 filter untouched.

### 4.3 [CHANGED v3] Contract table

| ID | Contract | Requirement | Evidence |
|---|---|---|---|
| **C-01** | Deterministic exports | After removals, the export list equals `:1925-1948` minus the 4 AI symbols **plus** the 4 internal support exports. **Explicit D-2 exception:** `nowIso`, `sha256`, `httpError`, `money` are *internal support exports for `ai/script-draft.js` only* — they must not be documented, advertised, or consumed as public API, and must not be re-exported by any other module | **[VERIFIED]** base list `:1925-1948` |
| **C-02** | Ownership | `exportProject`, library, R1, QA, finalize, editor/scene/asset stay in `content.js` | **[VERIFIED]** |
| **C-03** | Request compatibility | `planId`/`candidateId`, `approach`, `custom`, `useLlm`, `scriptDraft.{useLlm,model,timeoutMs}` unchanged | **[VERIFIED]** `:2666-2716` |
| **C-04** | Opt-in gate | `useLlm === true` strictly; AI require sits inside this branch | **[VERIFIED]** `:2716`, `:2727` |
| **C-05** | Deterministic path | `createContentProject(...)` exactly as today; no AI/Provider module loaded | **[VERIFIED]** `:2750-2760` |
| **C-06** | AI path | Same arguments + `traceId`, `executionMode`, `allowNetwork: liveEnabled` | **[VERIFIED]** `:2728-2749` |
| **C-07** | Prompt + validation | Pure relocation; logic byte-identical | **[VERIFIED]** `:1111-1440` |
| **C-08** | Fallback text | On provider **or** validation failure, `script.text`/`checksum` stay deterministic; only `source`, `lines_source`, `trace`, `fallback_reason` change | **[VERIFIED]** `:1495-1544` |
| **C-09** | **Three vocabularies** | (a) provider `status` = `success` + 10 failure kinds; (b) `fallbackReason` = those 10 **plus `validation_failed`** (ACE's, not the provider's); (c) `trace.status` = `success`/`template_default`/`graceful_fallback`. **Never merged** | **[VERIFIED]** `openrouter.js:47,48-58`; `provenance.js:43-55,33-37` |
| **C-10** | `networkAttempted` | Separate boolean; `false` pre-network, `true` once issued; carried as `=== true`; `external_calls = 1/0` | **[VERIFIED]** `openrouter.js:264-266`; `content.js:1515/1530/1544`; `service.js:2765` |
| **C-11** | Provenance matrix | Only the 4 permitted combinations | **[VERIFIED]** `provenance.js:76-81` |
| **C-12** | Trace fields | Only the 12 allowlisted fields; UI does not read `.trace` (0 matches) | **[VERIFIED]** `provenance.js:58-71`; `app/public/**` |
| **C-13** | `spend_thb` | Stays `0` unconditionally, incl. `external_calls: 1`. **Frozen** | **[VERIFIED]** `service.js:2766` |
| **C-14** | Manifests | `package.json` / lock untouched; AI module needs no dependency | **[VERIFIED]** |
| **C-15** | Allowlist | Exactly the 5 paths in §5 | **[PROPOSED]** |
| **C-16** | Rollback | From a verified baseline of the 5 paths only — never `HEAD` (§10) | **[PROPOSED]** |
| **C-17** | Status separation | §4.3 C-09 enforced; `validation_failed` never attributed to a provider | **[VERIFIED]** |
| **C-18** | UI contract | UI body = `{approach, planId\|candidateId}` (`mvp.js:2571-2573`); 0 `useLlm`/`scriptDraft`; unchanged | **[VERIFIED]** |
| **C-19** | AI module surface | `ai/script-draft.js` exports **exactly two**: `validateScriptDraft`, `createScriptDraftWithProvider`. `buildScriptDraftPrompt` and `SCRIPT_DRAFT_OPERATION` are **internal** | **[PROPOSED]** (U-4 resolved) |

---

## 5. File Allowlist **[unchanged — 5 paths]**

**New:** `app/mvp/ai/script-draft.js`
**Modified:** `app/mvp/content.js`, `app/mvp/service.js`, `verification/openrouter-gate3-offline-check.js`, `verification/openrouter-gate3-script-validation-check.js`
**Excluded:** provider files, both manifests, `app/server.js`, `app/public/**`, `docs/**`, governance docs, **any new test file**. **No 6th path** (S2 rejected).

---

## 6. Out-of-Scope Fence **[unchanged]**

Qualitative claim validation · price-role validation · provenance continuity after version bump · `fetchImpl` hardening · `spend_thb` correction · DR-01…DR-14 · Gate 3 acceptance · Gate 4 · A2 · Gate C · **Remove (PROPOSAL-ONLY)**.

---

## 7. [EXPANDED v3] Module Isolation Verification — MI-3 fully specified

| ID | Procedure | Pass criterion |
|---|---|---|
| **MI-1** | Static scan of `content.js` | no `./ai/`, no `./provider/`, 0 matches |
| **MI-2** | Fresh process requiring only `content.js`; inspect `require.cache` | no `provider/` or `mvp/ai/` path; exit 0 |
| **MI-3** | Directory-absence on an isolated copy (hide `app/mvp/provider/`), then run the suites in §7.2 | All three self-contained suites exit 0 |
| **MI-4** | Canary inside `verification/openrouter-gate3-offline-check.js` (already allowlisted; `assert` harness `:19`, `:32-46`) | Fails on any re-coupling |

### 7.1 Why MI-3 needs a suite list, not a count

`package.json` has **no test script** **[VERIFIED]**. "4 acceptance suites" was undefined; each has different prerequisites. **[VERIFIED from source]**

### 7.2 The suites, exactly

| Suite | Size | Command | What it covers | Self-contained? | Pass signal |
|---|---|---|---|---|---|
| `verification/ace-mission1-acceptance.js` | 1,232 L | `node verification/ace-mission1-acceptance.js` | Content Artifact v1: core functions, file persistence, hash/version handling, plus Test 7 against a real spawned server (`:81,:84`) | **Yes** — spawns `app/server.js` itself | `process.exitCode = allPassed ? 0 : 1` (`:1226`) |
| `verification/content-creation-acceptance.js` | 413 L | `node verification/content-creation-acceptance.js` | Full slice over HTTP on temp state/exports: import → candidates → plan → content draft → 3 track edits → QA → finalize → export → publish prep, then reload from disk | **Yes** — spawns server (`:52`) | `exitCode = failures ? 1 : 0` (`:407`) |
| `verification/mvp-workflow-acceptance.js` | 572 L | `node verification/mvp-workflow-acceptance.js` (default `PORT=4310`, `:35`) | `/api/mvp/*` field-level acceptance on a throwaway copy of `app/`, `data/`, `docs/` | **Yes** — spawns its own server | `process.exit(1)` on failure (`:569`) |
| `verification/visual-verify-export.js` | 173 L | requires a **pre-started** server: `PORT=8427 node app/server.js`, then `node verification/visual-verify-export.js` | Produces MP4 + still into `.tmp/visual-verify/` for human inspection | **NO** — attaches to an external server; needs `ffmpeg` | `process.exit(1)` on failure (`:88,:97,:172`) |

**MI-3 gate = the first three.** Suite 4 is excluded from MI-3 because it depends on an externally started server and `ffmpeg`; it is a visual driver, not an isolation test. **This is a correction:** Rev 2 implied all four run as one gate.

**Also excluded from MI-3** (and stated explicitly): the two Gate 3 scripts, which require the provider modules **directly** (`offline-check.js:26-27`). With `provider/` hidden they must fail; expecting otherwise would be a false test.

### 7.3 Canary assertions **[PROPOSED]**

(i) `contentModule.validateScriptDraft === undefined` (and the other three); (ii) source scan for `./provider/` and `./ai/`; (iii) `child_process` child requiring only `content.js`. **Mandatory printed caveat:** the hosting script loads provider at `:26-27`, so the claim applies to the **child process only**.

---

## 8. Runtime Isolation Verification **[unchanged]**

| ID | Procedure | Pass criterion |
|---|---|---|
| **RI-1** | `useLlm` absent **and** `false`, with recording fetch double | Zero calls; response equals baseline |
| **RI-2** | `ACE_LLM_LIVE_ENABLED` ∈ {unset, `'0'`, `' 1 '`, `'1'`} | Identical to today, **including** the `' 1 '` asymmetry (`service.js:2721` vs `openrouter.js:122-124`). Frozen |
| **RI-3** | `executionMode`/`allowNetwork` derivation | `OFFLINE_TEST` unless live-enabled |

**Required narrower wording:** the verification shows only that **the AI Provider execution path is not loaded through the tested deterministic E1 module graph** — not whole-application network security.

---

## 9. Behavioral Equivalence **[unchanged from Rev 2 facts]**

**Measured [VERIFIED]:** 8 products · 8 offers · 5 candidates · 0 plans · 0 contents; only **CND-1005** (PRD-1005, "Cat Food 1.5kg") is `SAVED`; the other four are `NONE` and rejected by the handler gate (≈`service.js:2650`).

**Approach keys [VERIFIED]:** `problem_first` (`:173`), `value_compare` (`:185`), `evidence_first` (`:197`), `user_custom` (`:219`). `service.js:55` `APPROACH_KEYS` is a different vocabulary and does not govern this path.

**Proposed coverage: 8 cells** = CND-1005 × 4 approaches × 2 paths. **PROPOSED, not executed.** Uncovered: 4 candidates with unusable status + 3 products with no candidate = **7 of 8 products**.

**Procedure:** capture baseline per cell → reset fixture state between cells (handler mutates `state.contents`/`contentOrder` and calls `writeState`, `service.js:2762-2764`) → implement → re-capture → deep-equal excluding **only** `trace.traceId`, `trace.timestamp`, `trace.latencyMs`, `trace.usage`, generated `content_id`/UUIDs, and creation timestamps confirmed in the baseline. **Pass = 8/8.**

---

## 10. [REWRITTEN v3] Rollback — precondition NOT MET

### 10.1 Baseline status: BLOCKER CONFIRMED

| Check | Result |
|---|---|
| E1 manifest references to `app/mvp/content.js` / `service.js` / either provider file | **0 hits** **[VERIFIED]** |
| Manifest schema | `ace.baseline-manifest/v1`, `state_baseline.stores` — **state store, not code** **[VERIFIED]** |
| `Affiliate-Content-Engine-Review.zip` | known stale — 10 of 10 comparable files differ **[REPORTED]** |
| `.tmp/2c8/service.valid-snapshot.js`, `.tmp/2c9-.../service.prefix-snapshot.js` | older point-in-time copies of `service.js` only; **not** the current 5-path state **[VERIFIED]** |

**Conclusion: no verified baseline of the allowlisted paths exists in the working tree.** U-8 remains **BLOCKER**.

**Identification prefixes of the current files (full 64-hex values must be recorded in the baseline artifact):**

| Path | sha256 prefix |
|---|---|
| `app/mvp/content.js` | `dae20513692b1ba7…` |
| `app/mvp/service.js` | `45efd5aeb41d9be7…` |
| `app/mvp/provider/openrouter.js` | `7702a3a8f9527455…` |
| `app/mvp/provider/provenance.js` | `1def97062c88aab2…` |
| `app/mvp/ai/script-draft.js` | does not exist yet (creation must be recorded) |

### 10.2 Why HEAD is not a rollback source **[VERIFIED]**

`content.js` at `HEAD` does **not** contain the 449-line AI block. `git checkout -- app/mvp/content.js` would **delete the preserved AI work**, not restore it. The tree also carries 2 modified tracked files and 174 untracked entries, so any blanket operation risks unrelated Owner work.

### 10.3 Authorized rollback shape (once a baseline exists)

1. Restore the 4 modified files **from the baseline**, verifying each hash before and after.
2. Delete the single added file `ai/script-draft.js`.
3. Confirm `provider/` unchanged (it never moves).
4. Re-run the three self-contained suites to confirm restoration.

**Prohibited:** `git clean`, `git reset --hard`, `git checkout .`, deletion of untracked files, and any operation outside §5.

**Stop rule [OWNER]:** if a verified baseline cannot be produced, **implementation does not start** — and it is never substituted with a HEAD restore.

---

## 11. Remaining Unresolved Items

| ID | Item | Status |
|---|---|---|
| **U-8** | **No verified rollback baseline exists** — must be created (a write operation, not authorized here) | **BLOCKER** **[OWNER]** |
| **U-6** | **DR-05 cannot be confirmed or corrected from current state.** The register says *"5 of 6 fixture products cannot be scripted at all"* (line 145; table line 216). Measured state has **8** products, of which **6** carry digit/unit tokens (30ml, 50ml, 3-Tier, 1.5kg, 6mm, 26cm) and 2 do not. The denominators (6 vs 8) differ, so the claim was evaluated against a **different fixture set**. **The number must not be changed by inference**; the register's evaluation scope is needed | **UNVERIFIED** **[OWNER]** |
| **U-7** | Whether the deterministic response carries a `trace`, and what | **UNVERIFIED** — measure in baseline capture |
| **U-10** | `ai/` loads `../content` (accepted consequence of D-2) | **ACCEPTED** limitation |
| **U-11** | Canary hosting couples the isolation assertion to a Gate 3 script that the Owner may archive | **UNVERIFIED** |
| **Resolved v3** | U-1 approach keys · U-2 inbound helpers (**D-2**) · U-3 inline require · U-4 two exports · U-5 UI callers · U-9 `path` | **CLOSED** |

---

## 12. Owner Approval Checklist

- [ ] **A-1** Ratify Technical Direction (already approved by Super Brain; Owner confirmation for the record).
- [ ] **A-2** Ratify **D-2** and the C-01 exception wording ("internal support exports — not public API").
- [ ] **A-3** Approve §4.2 as the final change budget (5 rows).
- [ ] **A-4** Approve the 5-path allowlist; confirm no 6th path and no new test file.
- [ ] **A-5** Approve the §6 fence; confirm `spend_thb` and all vocabularies are frozen.
- [ ] **A-6** Confirm §8's narrower egress wording.
- [ ] **A-7** Approve the 8-cell matrix as **proposed coverage**, acknowledging 7 uncovered products.
- [ ] **A-8** **Produce and hash-verify the rollback baseline (U-8)** — required before implementation.
- [ ] **A-9** Approve MI-3 as the **three** self-contained suites, with suite 4 excluded for stated reasons.
- [ ] **A-10** Authorize verification execution as a **separate, limited** grant.
- [ ] **A-11** Resolve U-6 (DR-05 scope) and U-7 (trace baseline).
- [ ] **A-12** Produce the OD-F17 canonical artifact, or confirm this spec may cite the supplied decision as interim record.

---

## 13. Unauthorized — explicit

No file edits · no tests, scripts, builds, or application runs · no commits or pushes · no dependency or manifest changes · no Git mutation · no sandbox import · **no implementation**. **Gate 3 NOT ACCEPTED · Gate 4 NOT AUTHORIZED · A2 NOT AUTHORIZED · Gate C NOT AUTHORIZED · Remove PROPOSAL-ONLY.** Preservation Action: **COMPLETED AS REPORTED BY OWNER**; independent verification **NOT PERFORMED**; tree may have changed.

---

## 14. Change Log — Revision 2 → Revision 3

| # | Change | Reason |
|---|---|---|
| 1 | **D-1 withdrawn; D-2 selected** (§3.3) | D-1 reaches exports only — it repaired 1 of 5 dependencies. Super Brain's finding confirmed |
| 2 | **Helper audit added** (§4.1): 24/12/34/6 deterministic vs 1 each in block | Evidence that the helpers are deterministic core, making D-2 the zero-deterministic-change option |
| 3 | **S2 (leaf module) evaluated and rejected** with reasons | Adds a 6th path and edits 4 deterministic declarations — higher blast radius |
| 4 | **Deletion boundary marked FINAL** (was PROVISIONAL) | Inbound dependencies now resolved |
| 5 | **C-01 rewritten** with explicit D-2 exception + "internal support exports, not public API" rule | Prevent the 4 helpers becoming de-facto public API |
| 6 | **C-19 added** (§4.3): AI module exports exactly 2 symbols | U-4 decision |
| 7 | **U-3 resolved** — inline `require` inside the `if (useLlm === true)` branch | Super Brain decision |
| 8 | **U-9 closed** — `path` is prose at `:1103`, zero calls | Confirms no `node:path` in the AI module |
| 9 | **MI-3 fully specified** (§7.2): 3 named suites with commands, coverage, exit signals; suite 4 excluded | `package.json` has no test runner; "4 suites" was undefined |
| 10 | **Rollback rewritten** (§10): baseline confirmed absent, hashes recorded, HEAD-restore explicitly prohibited | Condition 3 — the baseline does not exist |
| 11 | **U-6 restated as irreconcilable** (6 vs 8 denominators), number not altered | No guessing permitted |
| 12 | **Unchanged:** direction, architecture, provider location, allowlist, fence, 8-cell coverage, three vocabularies, `networkAttempted`, `spend_thb` | — |

---

## 15. Execution Statement

**No implementation and no execution occurred.** No repository file was created, edited, or deleted; `app/mvp/ai/script-draft.js` does not exist. No application, test, harness, script, or build was run. The only operations were read-only inspections (`grep`, `sed`, `awk`, `wc`, `find`, `sha256sum`, and a text-only analysis of `content.js` read as data). No `.env`, credential, or secret was read or displayed. No Git or sandbox operation was performed. No Gate, A2, Gate C, or Remove status changed. Delivered inline; **stopping for Owner review.**

---

**สามข้อที่ Super Brain ขอให้ปิด — ผลคือ:** (1) helper ทั้ง 4 ตัวถูกใช้โดย deterministic code 12–34 ครั้ง แต่ใช้ใน AI block เพียงครั้งเดียว → **D-2 ถูกต้อง และ D-1 ของผมใน Rev 2 ผิดจริง**; (2) `path` เป็นเพียงคำในคอมเมนต์บรรทัด `:1103` ไม่ใช่ dependency → **ปิดได้**; (3) **ไม่มี baseline ที่ใช้ rollback ได้** — manifest 2026-11-03 เป็น baseline ของ state store ไม่ใช่โค้ด และ zip ใน tree ก็เก่าแล้ว → ข้อนี้ยังเป็น blocker ที่ต้องให้ Owner สร้าง baseline ก่อนเริ่มงานใด ๆ