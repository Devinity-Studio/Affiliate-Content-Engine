'use strict';

/**
 * Scoped Foundation regression, re-run on a TEMPORARY state file.
 *
 * The original Foundation runner (`.final-acceptance-run.js`) was a temporary
 * dotfile and is no longer in the repository, so this script re-executes the
 * same 18 assertions recorded in
 * `verification/foundation-runtime-api-acceptance-2026-10-21.log` against the
 * current `app/server.js`, on a throwaway copy of app/, data/ and docs/ in a
 * temp directory. The repository's real `data/app/state.json`,
 * `app/mock/opportunities.json` and `data/mission1/evidence-log.md` are
 * checksummed before and after and must be byte-identical; the git HEAD is
 * compared before and after to prove no commit was created.
 *
 * One assertion is new and explicit: case 5b sends the LEGACY CWI body that
 * the old Foundation log used (no `type`) and records the status the enforced
 * contract now returns. The contract makes `type` required, so the legacy body
 * is rejected with 400 — that is the expected contract change, not a defect.
 * Case 5 therefore sends a contract-conformant body.
 *
 * Usage:  node verification/foundation-regression.js
 * Exit:   0 = every assertion passed, 1 = at least one assertion failed.
 */

const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.FOUNDATION_REGRESSION_PORT || 4274);
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
let failures = 0;

function record(name, expected, status, body, ok, detail) {
  const pass = Boolean(ok);
  if (!pass) failures++;
  results.push({ name, expected, status, body, pass, detail: detail || '' });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`        expected : ${expected}`);
  console.log(`        status   : ${status}`);
  console.log(`        body     : ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  if (detail) console.log(`        detail   : ${detail}`);
  return pass;
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
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

function startServer(tmp) {
  const server = spawn(process.execPath, ['app/server.js'], {
    cwd: tmp,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  server.stdout.on('data', (d) => log.push(d.toString()));
  server.stderr.on('data', (d) => log.push(d.toString()));
  return { server, log };
}

function stop(server) {
  return new Promise((resolve) => {
    if (!server || server.exitCode !== null) return resolve();
    server.once('exit', () => resolve());
    server.kill();
    setTimeout(resolve, 2000);
  });
}

/** Returns the measured {status, body} of a 2xx health response, or null. */
async function waitForHealth(attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      if (res.ok) return { status: res.status, body };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

(async () => {
  const tracked = {
    state: path.join(REPO, 'data', 'app', 'state.json'),
    mock: path.join(REPO, 'app', 'mock', 'opportunities.json'),
    evidenceLog: path.join(REPO, 'data', 'mission1', 'evidence-log.md'),
  };
  const before = Object.fromEntries(Object.entries(tracked).map(([k, f]) => [k, md5(f)]));
  const headBefore = String(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim();

  console.log('=== Foundation regression on a temporary state ===');

  // 1. syntax check
  const syntax = spawnSync(process.execPath, ['--check', path.join(REPO, 'app', 'server.js')], { encoding: 'utf8' });
  record('1. node --check app/server.js', 'exit 0, no syntax error', syntax.status,
    { stdout: syntax.stdout, stderr: syntax.stderr }, syntax.status === 0);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-foundation-regression-'));
  fs.cpSync(path.join(REPO, 'app'), path.join(tmp, 'app'), { recursive: true });
  fs.cpSync(path.join(REPO, 'data'), path.join(tmp, 'data'), { recursive: true });
  fs.cpSync(path.join(REPO, 'docs'), path.join(tmp, 'docs'), { recursive: true });
  console.log(`        temp workspace: ${tmp}`);
  console.log(`        real repository files are NOT mounted here — only the copy is.\n`);

  let child = null;
  let cwiId = null;
  try {
    let started = startServer(tmp);
    child = started.server;
    const healthy = await waitForHealth();
    record('2. server startup / health', '200 with ok/mock/stateFile',
      healthy ? healthy.status : null,
      healthy ? healthy.body : started.log.join('').trim(),
      Boolean(healthy) && healthy.status === 200 && healthy.body.ok === true
        && healthy.body.mock === true && healthy.body.stateFile === 'data/app/state.json');
    if (!healthy) throw new Error('temporary server did not become healthy');

    // 3. Plan create v1
    const plan1 = await call('POST', '/api/plan-version', { operation: 'create', content: 'Acceptance plan v1' });
    record('3. Plan create v1', '201 with id PLAN-1-1-v1 / plan_id PLAN-1-1 / version v1',
      plan1.status, plan1.body,
      plan1.status === 201 && plan1.body.id === 'PLAN-1-1-v1' && plan1.body.plan_id === 'PLAN-1-1' && plan1.body.version === 'v1');

    // 4. GET Plan v1
    const getPlan1 = await call('GET', '/api/plan-version/PLAN-1-1-v1');
    record('4. GET Plan v1', '200 with the same v1 snapshot', getPlan1.status, getPlan1.body,
      getPlan1.status === 200 && getPlan1.body.id === 'PLAN-1-1-v1' && getPlan1.body.content === 'Acceptance plan v1');

    // 5. CWI create linked to v1 — contract-conformant body (type + product_id)
    const cwi = await call('POST', '/api/content-work-item', {
      plan_id: 'PLAN-1-1', plan_version: 'v1', type: 'PRODUCT', product_id: 'P-1001',
    });
    cwiId = cwi.body && cwi.body.id;
    record('5. CWI create linked to v1 (type + product_id)', '201 with type and product_id',
      cwi.status, cwi.body,
      cwi.status === 201 && cwi.body.type === 'PRODUCT' && cwi.body.product_id === 'P-1001' && cwi.body.plan_version === 'v1');

    // 5b. the LEGACY body the old Foundation log used — now rejected by contract
    const legacy = await call('POST', '/api/content-work-item', { plan_id: 'PLAN-1-1', plan_version: 'v1' });
    record('5b. legacy CWI body without type (old Foundation log case 5)', '400 "type is required"',
      legacy.status, legacy.body,
      legacy.status === 400 && legacy.body.error === 'type is required',
      'the enforced contract makes type required, so the legacy body the old log recorded as 201 is now rejected');

    // 6. CWI GET-by-ID
    const getCwi = await call('GET', `/api/content-work-item/${cwiId}`);
    record('6. CWI GET-by-ID', '200 with the stored record', getCwi.status, getCwi.body,
      getCwi.status === 200 && getCwi.body.id === cwiId && getCwi.body.type === 'PRODUCT' && getCwi.body.product_id === 'P-1001');

    // 7. Create Plan v2
    const plan2 = await call('POST', '/api/plan-version', {
      operation: 'new_version', plan_id: 'PLAN-1-1', content: 'Acceptance plan v2',
    });
    record('7. Create Plan v2', '201 with id PLAN-1-1-v2', plan2.status, plan2.body,
      plan2.status === 201 && plan2.body.id === 'PLAN-1-1-v2' && plan2.body.version === 'v2');

    // 8. v1 snapshot immutability after v2
    const getPlan1b = await call('GET', '/api/plan-version/PLAN-1-1-v1');
    record('8. v1 snapshot immutability after v2', '200 and the v1 content is unchanged',
      getPlan1b.status, getPlan1b.body,
      getPlan1b.status === 200 && getPlan1b.body.content === 'Acceptance plan v1' && getPlan1b.body.version === 'v1');

    // 9. Existing CWI remains linked to v1
    const getCwi2 = await call('GET', `/api/content-work-item/${cwiId}`);
    record('9. Existing CWI remains linked to v1', '200 and still on v1', getCwi2.status, getCwi2.body,
      getCwi2.status === 200 && getCwi2.body.plan_id === 'PLAN-1-1' && getCwi2.body.plan_version === 'v1');

    // 10. Separate base Plan for the concurrency test
    const planBase = await call('POST', '/api/plan-version', { operation: 'create', content: 'Concurrent version test base' });
    record('10. Create separate base Plan for concurrency test', '201 with id PLAN-1-2-v1',
      planBase.status, planBase.body,
      planBase.status === 201 && planBase.body.id === 'PLAN-1-2-v1');

    // 11. Five concurrent new_version requests
    const concurrent = await Promise.all([1, 2, 3, 4, 5].map((n) =>
      call('POST', '/api/plan-version', {
        operation: 'new_version', plan_id: 'PLAN-1-2', content: `Concurrent acceptance version ${n}`,
      })));
    const versions = concurrent.map((r) => r.body && r.body.version).sort();
    record('11. Five concurrent new_version requests', '5x 201, versions v2-v6, no lost update',
      concurrent.map((r) => r.status), concurrent.map((r) => r.body),
      concurrent.every((r) => r.status === 201) && JSON.stringify(versions) === JSON.stringify(['v2', 'v3', 'v4', 'v5', 'v6']),
      `versions: ${JSON.stringify(versions)}`);

    // 12. State GET before restart
    const stateBefore = await call('GET', '/api/state');
    const planVersionCount = Object.keys((stateBefore.body && stateBefore.body.planVersions) || {}).length;
    record('12. State GET before restart', '200 with the plan versions and the CWI',
      stateBefore.status, stateBefore.body,
      stateBefore.status === 200 && planVersionCount === 8 && !!(stateBefore.body.cwis || {})[cwiId]);

    // 13. Restart with the same temporary state file
    await stop(child);
    child = null;
    started = startServer(tmp);
    child = started.server;
    const healthy2 = await waitForHealth();
    record('13. Restart with same temporary state file', '200 with ok/mock/stateFile',
      healthy2 ? healthy2.status : null,
      healthy2 ? healthy2.body : started.log.join('').trim(),
      Boolean(healthy2) && healthy2.status === 200 && healthy2.body.ok === true
        && healthy2.body.mock === true && healthy2.body.stateFile === 'data/app/state.json');

    // 14. State recovery after restart
    const stateAfter = await call('GET', '/api/state');
    const planVersionCount2 = Object.keys((stateAfter.body && stateAfter.body.planVersions) || {}).length;
    record('14. State recovery after restart', '200 with the same 8 plan versions and the CWI',
      stateAfter.status, stateAfter.body,
      stateAfter.status === 200 && planVersionCount2 === 8 && !!(stateAfter.body.cwis || {})[cwiId]);

    // 15. Plan v1 GET after restart
    const getPlan1c = await call('GET', '/api/plan-version/PLAN-1-1-v1');
    record('15. Plan v1 GET after restart', '200 with the original v1 snapshot', getPlan1c.status, getPlan1c.body,
      getPlan1c.status === 200 && getPlan1c.body.id === 'PLAN-1-1-v1' && getPlan1c.body.content === 'Acceptance plan v1');

    // 16. CWI GET after restart
    const getCwi3 = await call('GET', `/api/content-work-item/${cwiId}`);
    record('16. CWI GET after restart', '200 with the stored record', getCwi3.status, getCwi3.body,
      getCwi3.status === 200 && getCwi3.body.id === cwiId && getCwi3.body.type === 'PRODUCT' && getCwi3.body.product_id === 'P-1001');
  } finally {
    await stop(child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // 17. the real repository files are untouched
  const after = Object.fromEntries(Object.entries(tracked).map(([k, f]) => [k, md5(f)]));
  const unchanged = before.state === after.state && before.mock === after.mock && before.evidenceLog === after.evidenceLog;
  record('17. Real repository files unchanged', 'state.json, opportunities.json and evidence-log.md byte-identical',
    null, { before, after, unchanged },
    unchanged);

  // 18. no commit created during the run
  const headAfter = String(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim();
  record('18. No commit created during run', 'git HEAD unchanged', null, { headBefore, headAfter },
    headBefore === headAfter);

  const passed = results.filter((r) => r.pass).length;
  console.log('');
  console.log(`assertions: ${results.length}  passed: ${passed}  failed: ${failures}`);
  if (failures) {
    console.error('Foundation regression FAILED');
    process.exit(1);
  }
  console.log('Foundation regression passed (temporary state only)');
})();
