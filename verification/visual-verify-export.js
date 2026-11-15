'use strict';

/**
 * Visual verification driver for the content export slice.
 *
 * Attaches to a running MVP app server (started detached by the shell) and runs
 * the whole workflow against a persistent workspace (default .tmp/visual-verify/)
 * so the produced MP4 and still frame can be opened by a human afterwards via
 *   GET /api/mvp/content/:id/export/video
 *   GET /api/mvp/content/:id/export/still
 *
 * Usage:
 *   node verification/visual-verify-export.js
 *   PORT=8428 node verification/visual-verify-export.js
 *
 * Writes stdout as a step list plus export facts: file, checksums, dimensions.
 * Exit code 0 only when the export succeeds.
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');

const REPO_DIR = path.join(__dirname, '..');

// The operator (or the shell) starts the detached server first:
//   mkdir -p .tmp/visual-verify && ACE_MVP_STATE_FILE=... ACE_MVP_EXPORTS_DIR=... \
//     PORT=8427 node app/server.js > .tmp/visual-verify/server.log 2>&1 &
// and this driver attaches to it.
const workspace = path.join(REPO_DIR, '.tmp', 'visual-verify');
const port = Number(process.env.PORT || 8427);
const BASE = `http://127.0.0.1:${port}`;

function httpCall(method, route, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(`${BASE}${route}`, {
      method,
      headers: {
        ...(payload ? { 'content-type': 'application/json' } : {}),
        ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function probeReady() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE}/api/mvp/meta`, { timeout: 2000 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  const stateFile = path.join(workspace, 'fixture-state.json');
  const stagingFile = path.join(workspace, 'staging-state.json');
  const assetsDir = path.join(workspace, 'assets');
  const exportsDir = path.join(workspace, 'exports');
  await fsp.mkdir(workspace, { recursive: true });
  await fsp.mkdir(assetsDir, { recursive: true });
  await fsp.mkdir(exportsDir, { recursive: true });

  const deadline = Date.now() + 15000;
  let up = false;
  while (Date.now() < deadline) {
    if (await probeReady()) { up = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!up) {
    process.stderr.write(`server not reachable on ${BASE}\n`);
    process.exit(1);
  }

  const call = httpCall;

  const step = async (name, promise) => {
    const res = await promise;
    if (res.status >= 400) {
      process.stderr.write(`FAIL ${name}: status ${res.status}\n${JSON.stringify(res.body)}\n`);
      process.exit(1);
    }
    process.stdout.write(`OK ${name} (${res.status})\n`);
    return res.body;
  };

  await step('import fixture', call('POST', '/api/mvp/import', {}));
  const generated = await step('generate candidates', call('POST', '/api/mvp/candidates/generate', {}));
  const candidateId = generated.candidates[0].id;
  await step(`save candidate ${candidateId}`, call('POST', `/api/mvp/candidates/${candidateId}/action`, { action: 'SAVE' }));
  const draft = await step('plan draft', call('POST', '/api/mvp/plan/draft', { candidateId }));
  const plan = await step('create plan', call('POST', '/api/mvp/plan', {
    draftId: draft.draft.id, approach: 'personalized_a', confirmImpact: true,
  }));
  const content = await step('content draft', call('POST', '/api/mvp/content/draft', {
    planId: plan.plan.id, approach: 'problem_first',
  }));
  const contentId = content.project.content_id;

  // One edit per track: visual, text, audio (each its own endpoint).
  await step('edit visual track', call('POST', `/api/mvp/content/${contentId}/track/visual`, {
    sceneId: 'SC-1', visual: { preset: 'warm' }, duration_s: 5,
  }));
  await step('edit text track', call('POST', `/api/mvp/content/${contentId}/track/text`, {
    sceneId: 'SC-4', overlay: { subhead: 'ผู้ซื้อเลือกถูกแล้ว ไม่ต้องเดา' },
  }));
  await step('edit audio track (script v bump)', call('POST', `/api/mvp/content/${contentId}/track/audio`, {
    sceneId: 'SC-2', audio: { voiceover: 'ผู้ซื้อเลือกเซรั่มผิดมาแล้ว งบหมดโดยไม่จำเป็น เช็กข้อมูลก่อนตัดสินใจ' },
  }));

  const qa = await step('run Thai QA', call('POST', `/api/mvp/content/${contentId}/qa`));
  process.stdout.write(`   QA: PASS ${qa.qa.summary.PASS} WARN ${qa.qa.summary.WARN} FAIL ${qa.qa.summary.FAIL}\n`);
  await step('review', call('POST', `/api/mvp/content/${contentId}/review`));
  await step('finalize', call('POST', `/api/mvp/content/${contentId}/finalize`));
  const exported = await step('export video', call('POST', `/api/mvp/content/${contentId}/export`));
  const prep = await step('publish preparation', call('POST', `/api/mvp/content/${contentId}/publish-prep`));

  // Prove the serving endpoints respond as the human would open them.
  await step('GET export/still serves an image', call('GET', `/api/mvp/content/${contentId}/export/still`));
  await step('GET export/video serves the file', call('GET', `/api/mvp/content/${contentId}/export/video`));

  const exp = exported.export;
  const digest = crypto.createHash('sha256').update(fs.readFileSync(exp.file)).digest('hex');
  const stillFile = exp.still && exp.still.file;
  const stillDigest = stillFile
    ? crypto.createHash('sha256').update(fs.readFileSync(stillFile)).digest('hex')
    : null;
  const stillIsPng = stillFile
    ? fs.readFileSync(stillFile).subarray(0, 4).toString('hex') === '89504e47'
    : false;
  const videoIsMp4 = fs.readFileSync(exp.file).subarray(4, 8).toString('latin1') === 'ftyp';

  process.stdout.write('\n--- export facts ---\n');
  process.stdout.write(`content_id    : ${contentId}\n`);
  process.stdout.write(`status        : ${exported.project.status} -> ${prep.project.status}\n`);
  process.stdout.write(`video file    : ${exp.file}\n`);
  process.stdout.write(`video bytes   : ${exp.bytes}\n`);
  process.stdout.write(`video sha256  : ${digest}\n`);
  process.stdout.write(`video header  : ${videoIsMp4 ? 'ftyp MP4' : 'unexpected'}\n`);
  process.stdout.write(`video shape   : ${exp.width}x${exp.height} @${exp.fps}fps, ${exp.duration_s}s, ${exp.codec}\n`);
  process.stdout.write(`still file    : ${stillFile || '(none)'}\n`);
  process.stdout.write(`still sha256  : ${stillDigest}\n`);
  process.stdout.write(`still is png  : ${stillIsPng ? 'yes (correct PNG signature)' : 'no'}\n`);
  process.stdout.write(`script version: v${exp.script_version} checksum ${String(exp.script_checksum).slice(0, 16)}…\n`);
  process.stdout.write(`published?    : ${prep.publish_prep.publish.status} (executed=${prep.publish_prep.publish.executed}, external_calls=${prep.publish_prep.publish.external_calls})\n`);
  process.stdout.write(`inspect video : ${BASE}/api/mvp/content/${contentId}/export/video\n`);
  process.stdout.write(`inspect still : ${BASE}/api/mvp/content/${contentId}/export/still\n`);
  process.stdout.write(`ui            : ${BASE}/mvp.html\n`);
  process.stdout.write(`state file    : ${stateFile}\n`);

  process.stdout.write(`server        : running at ${BASE}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
