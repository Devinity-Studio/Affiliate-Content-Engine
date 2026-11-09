# ACE — Affiliate Content Engine

A local, dependency-free web app for one affiliate workflow:

> import a Shopee Affiliate export → research → 5 candidates → plan → storyboard / script / CTA → Thai QA → review → finalize → **render a real 9:16 MP4** → store it in the Content Library → find it again, verify its hash, and download it.

Nothing is published, no Shopee account or external API is touched, and the run costs THB 0.

- MVP workspace: <http://127.0.0.1:4173/mvp.html>
- Classic opportunity view: <http://127.0.0.1:4173/>

The full architecture and endpoint list live in [`app/README.md`](app/README.md).

---

## 1. Prerequisites

| Requirement | Version used here | Why |
|---|---|---|
| Node.js | v22.23.2 (any ≥ 18) | The app itself. No npm dependencies are required to run it. |
| **FFmpeg** | 4.1.5 with `libass`, `libx264`, `aac` | Only needed for video export. Built with `--enable-libass` so Thai text renders. |
| **FFprobe** | any recent build | Reads back the rendered file's codec, size and duration. Optional: the renderer falls back to `ffmpeg -i`. |
| A Thai font | Leelawadee UI (ships with Windows) | Burned-in Thai captions. |

Without FFmpeg the app still runs: every step works up to **Finalize**, and export fails with a clear `503 ffmpeg is not available on this machine` instead of pretending to succeed.

### Where the app looks for FFmpeg

`app/remotion/render.js` resolves the binary in this order, and stops at the first executable it finds:

1. `$ACE_FFMPEG` (or `$FFMPEG_PATH`) — explicit path
2. `.tmp/tools/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe` — repo-local install (git-ignored)
3. `ffmpeg` on `PATH`

`ffprobe` is looked up **in the same directory as the resolved `ffmpeg`**.

### Installing FFmpeg without touching the system

The repo-local route needs no administrator rights and keeps everything inside `.tmp/` (git-ignored):

```bash
npm install --prefix .tmp/tools --no-save @ffmpeg-installer/ffmpeg@1.1.0 @ffprobe-installer/ffprobe@2.1.2
cp .tmp/tools/node_modules/@ffprobe-installer/win32-x64/ffprobe.exe \
   .tmp/tools/node_modules/@ffmpeg-installer/win32-x64/ffprobe.exe
```

Verify:

```bash
node -e "const r=require('./app/remotion/render'); console.log(r.ffmpegAvailable(), r.resolveFfmpeg())"
# expect: true <absolute path to ffmpeg.exe>
```

If you prefer a system install, put `ffmpeg` on `PATH` or point `ACE_FFMPEG` at it — nothing else changes.

---

## 2. Start the app

Requires **no `npm install`** and no build step (FFmpeg above is the only external tool).

```bash
node app/server.js
```

Open <http://127.0.0.1:4173/mvp.html>. `HOST` and `PORT` are optional and default to `127.0.0.1` and `4173`.

---

## 3. Run the workflow

The left sidebar is the pipeline. Each step only enables once the previous one exists.

1. **Import** — press *Import the fixture* to load the synthetic Shopee Affiliate export. (Real CSV/TSV/XLSX/JSON uploads go through preview → mapping confirmation → staging → promote; see `app/README.md`.)
2. **Research** — inspect sources, products, offers and the evidence behind every claim.
3. **Candidates** — exactly 5 ranked candidates. *Save* or *Add to queue* the one you want.
4. **Plan** — pick an approach, review the impact preview, confirm, create the plan.
5. **Content** — create a project from the plan (or straight from a candidate). Then, in the content tabs:
   - *Storyboard / Script / CTA* — edit the visual, text and audio tracks per scene.
   - *Preview* — check each scene.
   - *Thai QA* — runs 7 checks. Finalize is blocked while any check is `FAIL`.
   - *Finalize* — `DRAFT → REVIEW → FINALIZED`, gated by an 11-item checklist.
   - *Export* — renders the MP4.
   - *Publish prep* — builds a hand-off caption payload. It requires a **VIDEO** export and never publishes anything.
6. **Library** — every stored export, with live hash verification and a download link.

### Export a video

Content tab → **Export** → *Export วิดีโอ 9:16*. The result is `1080×1920`, H.264 + AAC, 30 fps, ~21 s for the default 5-scene storyboard. A `-preview.png` still frame is written next to it.

### Retrieve a past export

Sidebar → **Library** (step 6). Each row shows the stored sha256 next to the hash of the bytes actually on disk:

| Badge | Meaning |
|---|---|
| `VERIFIED` | File exists and its sha256 matches the index — download enabled. |
| `MISMATCH` | The bytes changed on disk. Download is disabled. |
| `MISSING` | The index knows the file but it is gone. |
| `UNREADABLE` | The index record itself is unusable. |

Press *โหลดใหม่ / ตรวจสอบ hash* to re-verify at any time.

---

## 4. Where the data lives

All of it is git-ignored.

| What | Default path | Override |
|---|---|---|
| MVP workflow state (import, candidates, plans, content, exports) | `data/mvp/fixture-state.json` | `ACE_MVP_STATE_FILE` |
| Staged uploads | `data/mvp/staging-state.json` | `ACE_MVP_STAGING_FILE` |
| Uploaded images / narration audio | `data/mvp/assets/` | `ACE_MVP_ASSETS_DIR` |
| Rendered videos | `data/mvp/exports/<content_id>/` | `ACE_MVP_EXPORTS_DIR` |
| Content Library index | `data/mission1/content-library.json` | `ACE_CONTENT_LIBRARY_FILE` |
| Classic slice decisions | `data/app/state.json` | — |

The MVP never writes `data/app/state.json`. Deleting `data/mvp/` resets the MVP slice.

> The library index keeps the legacy `data/mission1/` location on purpose. It is a flat JSON array (leading `#` comment lines are tolerated) — **not** the unratified storage architecture described in `ACE_Content_Library_Storage_Checkpoint_After_v0.2.6.md`.

---

## 5. Verification

```bash
node verification/mvp-workflow-acceptance.js    # 86 checks, up to FINALIZED, no FFmpeg needed
node verification/check-content-library.js --e2e # export → store → retrieve → verify, needs FFmpeg
node verification/check-content-library.js       # audit the real index against the real files
```

Both suites build their own temporary workspace, so they do not touch the real state, exports or library. They also assert that those files are byte-identical afterwards.

---

## 6. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `503 ffmpeg is not available on this machine` | FFmpeg not found. Run the install above, or set `ACE_FFMPEG`. |
| Export returns 500 with a filter error mentioning `ass` | Your FFmpeg lacks `libass`. Use a build configured with `--enable-libass`. |
| Thai text shows as boxes or `□` | No Thai font found. Set `ACE_THAI_FONT` to a `.ttf` you are licensed to use. |
| Finalize refuses to run | It requires `status = REVIEW` and a QA run with `FAIL = 0`. Check the checklist in the Finalize tab. |
| Publish prep returns 409 | It requires a **VIDEO** export. A Markdown script artifact (`SCRIPT_ARTIFACT`) deliberately cannot satisfy it. |
| Library row shows `MISSING` | The video was deleted or moved. The index is not rewritten automatically. |
| Library row shows `MISMATCH` | The file's bytes changed after export. Re-export from the Content tab. |
| Library is empty but you exported earlier | You are running with a different `ACE_MVP_STATE_FILE` / `ACE_CONTENT_LIBRARY_FILE`, or the export went to a temp workspace. |

### Known limitations

- The import is verified against **synthetic fixtures only** — no real Shopee Affiliate export has been supplied.
- Narration is not synthesised: scenes are silent (silent AAC bed) unless you upload audio files.
- Rendering is local and synchronous; a longer storyboard means a longer request.
- `SCRIPT_ARTIFACT` (`POST /api/mvp/content/generate`) still exists for the ratified Content Artifact v1 contract. It writes Markdown, sets `EXPORTED`, and **cannot** reach publish prep.
- One export per content version; re-exporting the same version replaces its library record rather than duplicating it.

## Boundaries

No publication, no affiliate account, no credentials, no paid API, no analytics, no external calls. Mission 1 gates G2–G5 and the storage architecture are out of scope for this MVP.
