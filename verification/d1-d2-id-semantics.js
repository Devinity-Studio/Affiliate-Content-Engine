'use strict';

/**
 * D1/D2 evidence test — Plan identity vs immutable snapshot identity.
 *
 * Clarified semantics (owner decision 2026-10-21):
 *   plan_id  = Plan identity           -> PLAN-<cycle>-<n>
 *   id       = immutable snapshot id   -> PLAN-<cycle>-<n>-v<n>
 *   version  = version label           -> v<n>
 *
 * Steps:
 *   1. create the first Plan  (content "Plan A") -> id PLAN-1-1-v1, plan_id PLAN-1-1
 *   2. resolve that snapshot id through GET
 *   3. create the second Plan (content "Plan B") -> id PLAN-1-2-v1, plan_id PLAN-1-2
 *   4. resolve the second snapshot id through GET
 *   5. inspect the temp state file: two entries, keyed by snapshot id, Plan ids distinct
 *   6. temporary state only — real files are never mounted
 *   7. print status/body of every request and exit non-zero on any failure
 *
 * Usage:  node verification/d1-d2-id-semantics.js
 * Exit:   0 = every assertion passed, 1 = at least one failed.
 */

const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.D12_PORT || 4299);
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
function check(label, ok, detail) {
  const pass = Boolean(ok);
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  return pass;
}
function md5File(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}
function gitHead() {
  return String(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim();
}

async function call(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

function bodyOf(text) {
  return text === undefined ? '<absent>' : JSON.stringify(text);
}

(async () => {
  const tracked = {
    server: path.join(REPO, 'app', 'server.js'),
    schema: path.join(REPO, 'docs', 'mission1', 'schemas', 'content-work-item.schema.json'),
    state: path.join(REPO, 'data', 'app', 'state.json'),
  };
  const realBefore = Object.fromEntries(Object.entries(tracked).map(([k, f]) => [k, md5File(f)]));
  const headBefore = gitHead();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-d1d2-'));
  for (const dir of ['app', 'data', 'docs']) {
    fs.cpSync(path.join(REPO, dir), path.join(tmp, dir), { recursive: true });
  }
  console.log(`temp workspace: ${tmp}`);
  console.log('real repository files are NOT mounted here — only the copy is.\n');

  const server = spawn(process.execPath, ['app/server.js'], {
    cwd: tmp,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  server.stdout.on('data', (d) => log.push(d.toString()));
  server.stderr.on('data', (d) => log.push(d.toString()));

  const stop = () => new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once('exit', () => resolve());
    server.kill();
    setTimeout(resolve, 2000);
  });

  try {
    let healthy = false;
    for (let i = 0; i < 40 && !healthy; i++) {
      try { healthy = (await fetch(`${BASE}/api/health`)).ok; } catch { /* not up yet */ }
      if (!healthy) await new Promise((r) => setTimeout(r, 250));
    }
    if (!healthy) throw new Error(`temporary server did not start: ${log.join(' ').slice(0, 300)}`);

    // 1. D1 — first Plan in cycle 1
    const d1 = await call('POST', '/api/plan-version', { operation: 'create', content: 'Plan A', schemaVersion: 1 });
    console.log(`1. POST create (Plan A)     status=${d1.status} body=${bodyOf(d1.body)}`);
    check('D1 create returns 201', d1.status === 201, `status=${d1.status}`);
    check('D1 id is the immutable snapshot id', d1.body.id === 'PLAN-1-1-v1', `id=${bodyOf(d1.body.id)}`);
    check('D1 plan_id is the Plan identity', d1.body.plan_id === 'PLAN-1-1', `plan_id=${bodyOf(d1.body.plan_id)}`);
    check('D1 version is v1', d1.body.version === 'v1', `version=${bodyOf(d1.body.version)}`);
    check('D1 content is preserved', d1.body.content === 'Plan A', `content=${bodyOf(d1.body.content)}`);
    check('D1 schemaVersion is 1', d1.body.schemaVersion === 1, `schemaVersion=${bodyOf(d1.body.schemaVersion)}`);
    check('D1 createdAt is a parseable ISO timestamp', Number.isFinite(Date.parse(d1.body.createdAt)), `createdAt=${bodyOf(d1.body.createdAt)}`);
    check('D1 id is NOT the plan_id', d1.body.id !== d1.body.plan_id, 'the two identifiers are distinct');
    check('D1 id equals plan_id + "-" + version', d1.body.id === `${d1.body.plan_id}-${d1.body.version}`,
      `${d1.body.plan_id} + ${d1.body.version} -> ${d1.body.id}`);

    // 2. the snapshot id must resolve through the GET route
    const d1Get = await call('GET', `/api/plan-version/${d1.body.id}`);
    console.log(`2. GET /api/plan-version/${d1.body.id}  status=${d1Get.status} body=${bodyOf(d1Get.body)}`);
    check('D1 snapshot id resolves through GET', d1Get.status === 200 && d1Get.body.id === d1.body.id, `status=${d1Get.status}`);
    check('D1 GET returns the same record as create',
      JSON.stringify(d1Get.body) === JSON.stringify(d1.body), 'create body == GET body');

    // 3. D2 — second Plan in cycle 1
    const d2 = await call('POST', '/api/plan-version', { operation: 'create', content: 'Plan B' });
    console.log(`3. POST create (Plan B)     status=${d2.status} body=${bodyOf(d2.body)}`);
    check('D2 create returns 201', d2.status === 201, `status=${d2.status}`);
    check('D2 id is the immutable snapshot id', d2.body.id === 'PLAN-1-2-v1', `id=${bodyOf(d2.body.id)}`);
    check('D2 plan_id is the Plan identity', d2.body.plan_id === 'PLAN-1-2', `plan_id=${bodyOf(d2.body.plan_id)}`);
    check('D2 version is v1', d2.body.version === 'v1', `version=${bodyOf(d2.body.version)}`);
    check('D2 content is preserved', d2.body.content === 'Plan B', `content=${bodyOf(d2.body.content)}`);
    check('D2 id is NOT the plan_id', d2.body.id !== d2.body.plan_id, 'the two identifiers are distinct');
    check('D2 is a different Plan from D1', d2.body.plan_id !== d1.body.plan_id, `${d1.body.plan_id} vs ${d2.body.plan_id}`);

    // 4. second snapshot id resolves
    const d2Get = await call('GET', `/api/plan-version/${d2.body.id}`);
    console.log(`4. GET /api/plan-version/${d2.body.id}  status=${d2Get.status} body=${bodyOf(d2Get.body)}`);
    check('D2 snapshot id resolves through GET', d2Get.status === 200 && d2Get.body.id === d2.body.id, `status=${d2Get.status}`);

    // 5. state file shape
    const state = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'app', 'state.json'), 'utf8'));
    const keys = Object.keys(state.planVersions || {});
    console.log(`5. state planVersions keys  ${JSON.stringify(keys)}`);
    console.log('   mapping: ' + [d1.body, d2.body]
      .map((b) => `plan_id=${b.plan_id} id=${b.id} version=${b.version}`)
      .join(' | '));
    check('state stores exactly the two snapshot ids', keys.length === 2 && keys.includes('PLAN-1-1-v1') && keys.includes('PLAN-1-2-v1'),
      `keys=${JSON.stringify(keys)}`);
    check('state entries are keyed by their own id',
      keys.every((key) => state.planVersions[key].id === key), 'key == record.id');
    check('state entries carry the Plan identity in plan_id',
      state.planVersions['PLAN-1-1-v1'].plan_id === 'PLAN-1-1' && state.planVersions['PLAN-1-2-v1'].plan_id === 'PLAN-1-2',
      'plan_id separates the two Plans');
    check('no Plan is stored under its bare plan_id', !keys.includes('PLAN-1-1') && !keys.includes('PLAN-1-2'),
      'the plan_id alone is not a stored snapshot key');
  } finally {
    await stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const realAfter = Object.fromEntries(Object.entries(tracked).map(([k, f]) => [k, md5File(f)]));
  const headAfter = gitHead();
  console.log('');
  check('real app/server.js, schema, and state.json unchanged',
    Object.keys(realBefore).every((k) => realBefore[k] === realAfter[k]),
    `server ${realBefore.server === realAfter.server ? 'same' : 'CHANGED'}, ` +
    `schema ${realBefore.schema === realAfter.schema ? 'same' : 'CHANGED'}, ` +
    `state ${realBefore.state === realAfter.state ? 'same' : 'CHANGED'}`);
  check('no commit created', headBefore === headAfter, `HEAD ${headBefore} -> ${headAfter}`);

  console.log('');
  console.log(failures === 0 ? 'D1/D2 evidence test passed' : `${failures} check(s) failed`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
