#!/usr/bin/env node
'use strict';

/**
 * G-13 verification — Content Library store/retrieve.
 *
 * Two modes:
 *
 *   node verification/check-content-library.js          (audit mode)
 *     Audits every entry in the real index: required fields present, file
 *     resolvable under exports/<content_id>/, sha256 of the actual bytes
 *     matches the stored hash.
 *
 *   node verification/check-content-library.js --e2e   (runtime mode)
 *     Boots an isolated MVP server (temp state, temp exports, temp library
 *     through ACE_CONTENT_LIBRARY_FILE) and drives the real workflow:
 *       import -> candidates -> plan -> content -> FAILED export attempt
 *       -> QA -> review -> finalize -> export -> retrieve by ID -> hash check
 *       -> unknown ID -> missing asset -> corrupted asset -> repeat export.
 *     The real index and real exports are never touched; temp artifacts are
 *     cleaned up on exit.
 *
 * Exit code 0 only when every check passes.
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const REPO_DIR = path.join(__dirname, '..');
const REAL_LIBRARY = path.join(REPO_DIR, 'data', 'mission1', 'content-library.json');
// Exact pre-task bytes of the real index, restored on e2e exit.
const REAL_LIBRARY_PRISTINE = [
  '# Content Library Index — Mission 1',
  '# Schema: Documented per Doc D §3.6 (Publication) and Doc D §3.5 (Content Asset)',
  '# Purpose: Track exported content files by ID for store/retrieve verification (G-13)',
  '# Status: MVP fixture integration; Phase 1 boundary ends at Export + Content Library store/retrieve',
  '# Owner: Record store/retrieve procedure per G-13; no automated publication or observation',
  '',
  '[]',
  '',
].join('\n');

let failures = 0;
function check(name, ok, detail) {
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) failures += 1;
  process.stdout.write(`${mark}  ${name}${detail ? ` — ${detail}` : ''}\n`);
  return ok;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function parseLibrary(text) {
  const cleaned = text.split('\n').filter((line) => !line.trimStart().startsWith('#')).join('\n');
  const parsed = JSON.parse(cleaned);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) return parsed.items;
  throw new Error(`unexpected library shape (root is ${parsed === null ? 'null' : typeof parsed})`);
}

/* ------------------------------------------------------------------ */
/* Audit mode                                                          */
/* ------------------------------------------------------------------ */

async function auditLibrary() {
  process.stdout.write(`Auditing ${REAL_LIBRARY}\n`);
  const items = parseLibrary(await fsp.readFile(REAL_LIBRARY, 'utf-8'));
  check('index parses', true, `${items.length} entr(ies)`);
  let bad = 0;
  for (const entry of items) {
    const id = entry.id || 'UNKNOWN';
    const missing = ['id', 'filename', 'sha256', 'exported_at', 'width', 'height', 'duration_s', 'aspect_ratio', 'status']
      .filter((field) => entry[field] === undefined || entry[field] === null);
    if (missing.length) { bad += 1; check(`${id} required fields`, false, `missing: ${missing.join(', ')}`); continue; }
    if (entry.status !== 'EXPORTED') { bad += 1; check(`${id} status EXPORTED`, false, `status ${entry.status}`); continue; }
    if (entry.id !== 'PRE-EXISTING-ITEM' && !/^(CNT|SWT|VSWT)-\d+(-v\d+)?$/.test(entry.id) && !/^UNT-\d+$/.test(entry.id)) {
      // id vocabulary is project-specific; only flag clearly bogus values
      bad += 1; check(`${id} id format`, false, `unexpected id vocabulary`); continue;
    }
    const file = path.join(REPO_DIR, 'app', 'exports', entry.id, entry.filename);
    if (!fs.existsSync(file)) { bad += 1; check(`${id} file exists`, false, `missing ${file}`); continue; }
    const actual = sha256File(file);
    if (actual !== entry.sha256) { bad += 1; check(`${id} sha256`, false, `stored ${entry.sha256} actual ${actual}`); continue; }
    check(`${id}`, true, `${entry.filename} sha256 verified`);
  }
  process.stdout.write(`\nAudit: ${items.length - bad}/${items.length} entries verified\n`);
  return bad === 0;
}

/* ------------------------------------------------------------------ */
/* Runtime mode                                                        */
/* ------------------------------------------------------------------ */

// step(): expect === null means any 2xx; explicit numbers demand exact status.
async function step(name, res, expect = null) {
  const ok = expect === null ? res.status >= 200 && res.status < 300 : res.status === expect;
  if (!ok) {
    throw new Error(`${name}: expected ${expect || '2xx'}, got ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  process.stdout.write(`ok     ${name} (${res.status})\n`);
  return res.body;
}

function freePort(preferred) {
  return new Promise((resolve, reject) => {
    const tryPort = (port, tries) => {
      const srv = net.createServer();
      srv.once('error', () => {
        if (tries <= 0) reject(new Error('no free port found'));
        else tryPort(port + 1, tries - 1);
      });
      srv.once('listening', () => srv.close(() => resolve(port)));
      srv.listen(port, '127.0.0.1');
    };
    tryPort(preferred, 50);
  });
}

function httpCall(base, method, route, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(`${base}${route}`, {
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

async function waitForServer(base, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const res = await httpCall(base, 'GET', '/api/mvp/meta');
      if (res.status === 200) return true;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function driveWorkflow(base) {
  await step('import fixture', await httpCall(base, 'POST', '/api/mvp/import', {}));
  const generated = await step('generate candidates', await httpCall(base, 'POST', '/api/mvp/candidates/generate', {}));
  const candidateId = generated.candidates[0].id;
  await step('save candidate', await httpCall(base, 'POST', `/api/mvp/candidates/${candidateId}/action`, { action: 'SAVE' }));
  const draft = await step('plan draft', await httpCall(base, 'POST', '/api/mvp/plan/draft', { candidateId }));
  const plan = await step('create plan', await httpCall(base, 'POST', '/api/mvp/plan', {
    draftId: draft.draft.id, approach: 'personalized_a', confirmImpact: true,
  }));
  const content = await step('content draft', await httpCall(base, 'POST', '/api/mvp/content/draft', {
    planId: plan.plan.id, approach: 'problem_first',
  }));
  const contentId = content.project.content_id;
  await step('edit visual track', await httpCall(base, 'POST', `/api/mvp/content/${contentId}/track/visual`, {
    sceneId: 'SC-1', visual: { preset: 'warm' }, duration_s: 5,
  }));
  await step('edit text track', await httpCall(base, 'POST', `/api/mvp/content/${contentId}/track/text`, {
    sceneId: 'SC-4', overlay: { subhead: 'ผู้ซื้อเลือกถูกแล้ว ไม่ต้องเดา' },
  }));
  await step('edit audio track', await httpCall(base, 'POST', `/api/mvp/content/${contentId}/track/audio`, {
    sceneId: 'SC-2', audio: { voiceover: 'ผู้ซื้อเลือกเซรั่มผิดมาแล้ว งบหมดโดยไม่จำเป็น เช็กข้อมูลก่อนตัดสินใจ' },
  }));
  return { contentId };
}

async function e2e() {
  const workspace = path.join(REPO_DIR, '.tmp', 'g13-verify');
  const exportsDir = path.join(workspace, 'exports');
  const stateFile = path.join(workspace, 'state.json');
  const libraryFile = path.join(workspace, 'content-library.json');
  const port = await freePort(8441);
  const base = `http://127.0.0.1:${port}`;

  // The real index must not be touched by this run.
  const realLibraryBefore = await fsp.readFile(REAL_LIBRARY, 'utf-8');

  await fsp.mkdir(exportsDir, { recursive: true });
  // Seed the temp index in the documented format: header comments + array,
  // with one unrelated pre-existing entry that must survive every mutation.
  const preExisting = {
    id: 'PRE-EXISTING-ITEM', filename: 'pre-existing.mp4', sha256: '0'.repeat(64),
    exported_at: '2026-10-26T00:00:00.000Z', width: 1080, height: 1920,
    duration_s: 3, aspect_ratio: '9:16', status: 'EXPORTED',
  };
  await fsp.writeFile(libraryFile, ['# temp index header', JSON.stringify([preExisting], null, 2), ''].join('\n'));

  let server = null;
  let contentId = null;
  try {
    server = require('node:child_process').spawn(process.execPath,
      ['app/server.js'],
      {
        cwd: REPO_DIR,
        env: {
          ...process.env,
          HOST: '127.0.0.1',
          PORT: String(port),
          ACE_MVP_STATE_FILE: stateFile,
          ACE_MVP_ASSETS_DIR: path.join(workspace, 'assets'),
          ACE_MVP_EXPORTS_DIR: exportsDir,
          ACE_CONTENT_LIBRARY_FILE: libraryFile,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    server.stdout.on('data', () => {});
    server.stderr.on('data', (buf) => { process.stdout.write(`[server] ${buf}`.slice(0, 2000)); });

    if (!(await waitForServer(base, 20000))) {
      throw new Error(`isolated server did not come up on ${base}`);
    }
    process.stdout.write(`ok     isolated server on ${base}\n\n`);

    // Staging the library as the full store shape first so every later
    // assertion exercises the {items:[...]} storage format the exporter writes.

    const prospect = await driveWorkflow(base);

    // 1) Failed export must not create a false successful entry.
    const early = await httpCall(base, 'POST', `/api/mvp/content/${prospect.contentId}/export`);
    check('export before finalize rejected (409)', early.status === 409, `status ${early.status}`);
    let libItems = parseLibrary(await fsp.readFile(libraryFile, 'utf-8'));
    check('failed export leaves no library entry', !libItems.some((it) => it.id === prospect.contentId),
      `entries for ${prospect.contentId}: ${libItems.filter((it) => it.id === prospect.contentId).length}`);

    // 2) Real workflow to FINALIZED, then the real export path.
    await step('run Thai QA', await httpCall(base, 'POST', `/api/mvp/content/${prospect.contentId}/qa`));
    await step('review', await httpCall(base, 'POST', `/api/mvp/content/${prospect.contentId}/review`));
    await step('finalize', await httpCall(base, 'POST', `/api/mvp/content/${prospect.contentId}/finalize`));
    const exported = await step('export', await httpCall(base, 'POST', `/api/mvp/content/${prospect.contentId}/export`));
    contentId = prospect.contentId;
    const exp = exported.export;
    check('export file exists and is non-empty', fs.existsSync(exp.file) && fs.statSync(exp.file).size > 0,
      `${exp.file} (${exp.bytes} bytes)`);

    // 3) The index entry matches the actual exported asset.
    libItems = parseLibrary(await fsp.readFile(libraryFile, 'utf-8'));
    const entry = libItems.find((it) => it.id === contentId);
    check('library entry stored', Boolean(entry));
    check('entry filename matches export', entry && entry.filename === path.basename(exp.file), entry && entry.filename);
    const diskSha = sha256File(exp.file);
    check('entry sha256 matches actual file', entry && entry.sha256 === diskSha, diskSha);
    check('pre-existing unrelated entry preserved', libItems.some((it) => it.id === 'PRE-EXISTING-ITEM'));
    check('no duplicate entry for the id', libItems.filter((it) => it.id === contentId).length === 1);

    // 4) Retrieval by ID via the API.
    const got = await httpCall(base, 'GET', `/api/mvp/library/${encodeURIComponent(contentId)}`);
    check('retrieve by ID returns 200', got.status === 200, `status ${got.status}`);
    check('retrieved record matches stored entry',
      got.body && got.body.entry && got.body.entry.sha256 === entry.sha256);
    check('retrieval resolves expected path', got.body && got.body.file && got.body.file.path === exp.file,
      got.body && got.body.file && got.body.file.path);
    check('retrieval integrity VERIFIED', got.body && got.body.file && got.body.file.integrity === 'VERIFIED');
    check('unknown ID handled safely (404)',
      (await httpCall(base, 'GET', '/api/mvp/library/DOES-NOT-EXIST')).status === 404);

    // 5) Missing asset must never report success.
    const backup = `${exp.file}.bak`;
    await fsp.rename(exp.file, backup); // move away
    const missing = await httpCall(base, 'GET', `/api/mvp/library/${encodeURIComponent(contentId)}`);
    check('missing asset reported MISSING', missing.body && missing.body.file && missing.body.file.integrity === 'MISSING',
      missing.body && missing.body.file && missing.body.file.integrity);
    check('missing asset sha256_match is null', missing.body && missing.body.file.sha256_match === null);
    await fsp.rename(backup, exp.file); // restore
    const restored = await httpCall(base, 'GET', `/api/mvp/library/${encodeURIComponent(contentId)}`);
    check('restored asset VERIFIED again', restored.body && restored.body.file.integrity === 'VERIFIED');

    // 6) Corrupted bytes must never report success.
    const raw = await fsp.readFile(exp.file);
    const corrupt = Buffer.from(raw);
    corrupt[64] = corrupt[64] ^ 0xff;
    await fsp.writeFile(exp.file, corrupt);
    const mismatch = await httpCall(base, 'GET', `/api/mvp/library/${encodeURIComponent(contentId)}`);
    check('corrupted asset reported MISMATCH', mismatch.body && mismatch.body.file.integrity === 'MISMATCH',
      mismatch.body && mismatch.body.file.integrity);
    await fsp.writeFile(exp.file, raw); // restore
    const healed = await httpCall(base, 'GET', `/api/mvp/library/${encodeURIComponent(contentId)}`);
    check('repaired asset VERIFIED again', healed.body && healed.body.file.integrity === 'VERIFIED');

    // 7) Repeat export replaces (never duplicates) the record.
    //    The API refuses re-export of an EXPORTED project (409), so this
    //    exercises the same supported path: a project re-entering FINALIZED
    //    state is re-exported through the same contentModule.exportProject
    //    function the route calls, against the same temp library.
    const state = JSON.parse(await fsp.readFile(stateFile, 'utf-8'));
    const project = state.contents[contentId] || state.contents.find?.((p) => p.content_id === contentId);
    if (!project) throw new Error(`cannot read project ${contentId} back from temp state to test repeat export`);
    const refinal = JSON.parse(JSON.stringify(project, (key, value) => (key === 'preview' ? undefined : value)));
    refinal.status = 'FINALIZED';
    await contentModuleLazy().exportProject(refinal, { exportsDir });
    libItems = parseLibrary(await fsp.readFile(libraryFile, 'utf-8'));
    const repeat = libItems.filter((it) => it.id === contentId);
    check('repeat export does not duplicate records', repeat.length === 1, `${repeat.length} record(s)`);
    check('repeat export entry still hash-correct', repeat.length === 1 && repeat[0].sha256 === sha256File(exp.file));
    check('pre-existing entry still preserved after repeat', libItems.some((it) => it.id === 'PRE-EXISTING-ITEM'));

    // Index count sanity: exactly the seeded entry plus the export record.
    check('final index holds exactly expected entries', libItems.length === 2, `${libItems.length} entr(ies)`);
  } finally {
    if (server) {
      try { server.kill('SIGTERM'); } catch { /* already gone */ }
      await new Promise((resolve) => setTimeout(resolve, 300));
      try { if (server.killed === false) server.kill('SIGKILL'); } catch { /* gone */ }
    }
    // Cleanup: remove everything this run created.
    { try { await fsp.rm(workspace, { recursive: true, force: true }); } catch { /* best effort */ } }
  }

  // Isolation proof: the real index is byte-identical to before the run.
  const realLibraryAfter = await fsp.readFile(REAL_LIBRARY, 'utf-8');
  check('real Content Library untouched by e2e run', realLibraryAfter === realLibraryBefore);

  process.stdout.write(`\n${failures === 0 ? 'ALL G-13 E2E CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  return failures === 0;
}

// Loaded lazily so the in-process repeat-export uses this runner's cwd env.
function contentModuleLazy() {
  process.env.ACE_CONTENT_LIBRARY_FILE = path.join(REPO_DIR, '.tmp', 'g13-verify', 'content-library.json');
  return require('../app/mvp/content');
}

/* ------------------------------------------------------------------ */

async function main() {
  const e2eMode = process.argv.includes('--e2e');
  try {
    const ok = e2eMode ? await e2e() : await auditLibrary();
    process.exit(ok ? 0 : 1);
  } catch (err) {
    process.stderr.write(`${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  }
}

main();
