'use strict';

/**
 * D10 evidence test — "existing v1 unchanged" proven by a real run.
 *
 * The clause is asserted, not inferred: a Plan version is snapshotted before a new
 * version is created, then read back and compared field by field, and the state
 * file is inspected to prove the new version is a separate entry.
 *
 * Steps (per the review request):
 *   1. create a Plan that has v1
 *   2. snapshot v1 before creating anything else
 *   3. create a new version (new_version)
 *   4. read v1 back
 *   5. compare every field before/after
 *   6. confirm v1 is unchanged AND the new version is a separate entry
 *   7. temporary state only — the real repository state is never mounted
 *   8. print status/body of every request, the field diff, and exit non-zero on failure
 *
 * Usage:  node verification/d10-v1-immutability.js
 * Exit:   0 = every assertion passed, 1 = at least one failed.
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.D10_PORT || 4298);
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
function check(label, ok, detail) {
  const pass = Boolean(ok);
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  return pass;
}
function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
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

/** Field-by-field diff; prints every field so "unchanged" is visible, not asserted. */
function diffFields(before, after) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort();
  const rows = [];
  for (const key of keys) {
    const a = JSON.stringify(before?.[key]);
    const b = JSON.stringify(after?.[key]);
    rows.push({ key, before: a, after: b, same: a === b });
  }
  return rows;
}

(async () => {
  const tracked = {
    state: path.join(REPO, 'data', 'app', 'state.json'),
    mock: path.join(REPO, 'app', 'mock', 'opportunities.json'),
  };
  const realBefore = Object.fromEntries(Object.entries(tracked).map(([k, f]) => [k, md5(fs.readFileSync(f))]));
  const headBefore = String(spawnSyncGit(['rev-parse', 'HEAD'])).trim();

  function spawnSyncGit(args) {
    const { spawnSync } = require('node:child_process');
    return spawnSync('git', args, { cwd: REPO, encoding: 'utf8' }).stdout || '';
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-d10-'));
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
      try { healthy = (await fetch(`${BASE}/api/health`)).ok; } catch { /* not up */ }
      if (!healthy) await new Promise((r) => setTimeout(r, 250));
    }
    if (!healthy) throw new Error(`temporary server did not start: ${log.join(' ').slice(0, 300)}`);

    // 1. create a Plan that has v1
    const created = await call('POST', '/api/plan-version', { operation: 'create', content: 'D10 plan A' });
    console.log(`1. POST create            status=${created.status} body=${JSON.stringify(created.body)}`);
    check('step 1: Plan created with v1', created.status === 201 && created.body.version === 'v1', `status=${created.status}`);
    const v1Id = created.body.id;

    // 2. snapshot v1 before creating anything else
    const beforeGet = await call('GET', `/api/plan-version/${v1Id}`);
    const beforeState = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'app', 'state.json'), 'utf8'));
    const beforeEntry = beforeState.planVersions[v1Id];
    console.log(`2. GET v1 (before)        status=${beforeGet.status} body=${JSON.stringify(beforeGet.body)}`);
    console.log(`   state entry (before)   md5=${md5(JSON.stringify(beforeEntry))}`);
    check('step 2: v1 snapshot captured from both the route and the state file',
      beforeGet.status === 200 && !!beforeEntry);

    // 3. create a new version
    const next = await call('POST', '/api/plan-version', { operation: 'new_version', plan_id: created.body.plan_id, content: 'D10 plan A v2' });
    console.log(`3. POST new_version       status=${next.status} body=${JSON.stringify(next.body)}`);
    check('step 3: new version created', next.status === 201 && next.body.version === 'v2', `status=${next.status}`);

    // 4. read v1 back
    const afterGet = await call('GET', `/api/plan-version/${v1Id}`);
    console.log(`4. GET v1 (after)         status=${afterGet.status} body=${JSON.stringify(afterGet.body)}`);

    // 5. compare every field before/after
    console.log('\n5. field-by-field comparison (route response)');
    const rows = diffFields(beforeGet.body, afterGet.body);
    for (const row of rows) {
      console.log(`   ${row.same ? 'same' : 'DIFF'}  ${row.key}: ${row.before} -> ${row.after}`);
    }
    const routeUnchanged = rows.every((row) => row.same);
    check('step 5a: every field of v1 is identical before/after', routeUnchanged,
      routeUnchanged ? `${rows.length} fields compared, 0 differences` : 'differences printed above');

    // 6. state-file level: v1 entry unchanged, new version is a separate entry
    const afterState = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'app', 'state.json'), 'utf8'));
    const afterEntry = afterState.planVersions[v1Id];
    console.log('\n6. state file after new_version');
    console.log(`   v1 entry md5 (after)   md5=${md5(JSON.stringify(afterEntry))}`);
    const stateRows = diffFields(beforeEntry, afterEntry);
    for (const row of stateRows) {
      console.log(`   ${row.same ? 'same' : 'DIFF'}  ${row.key}: ${row.before} -> ${row.after}`);
    }
    check('step 6a: stored v1 entry is byte-identical in state', stateRows.every((r) => r.same),
      `${stateRows.length} fields compared`);
    const v2Id = next.body.id;
    check('step 6b: new version exists as a separate entry',
      !!afterState.planVersions[v2Id] && v2Id !== v1Id,
      `v1=${v1Id} v2=${v2Id}`);
    check('step 6c: v1 and v2 are distinct records',
      JSON.stringify(afterState.planVersions[v1Id]) !== JSON.stringify(afterState.planVersions[v2Id]));
    check('step 6d: v2 entry matches the create response',
      JSON.stringify(afterState.planVersions[v2Id]) === JSON.stringify(next.body));
    check('step 6e: the Plan still has exactly two versions',
      Object.keys(afterState.planVersions).length === 2,
      `ids=${JSON.stringify(Object.keys(afterState.planVersions))}`);
    check('step 6f: v1 content is still the v1 content', afterEntry.content === 'D10 plan A',
      `content=${JSON.stringify(afterEntry.content)}`);
  } finally {
    await stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // 7/8. real state and git untouched; exit status reflects the assertions
  const realAfter = Object.fromEntries(Object.entries(tracked).map(([k, f]) => [k, md5(fs.readFileSync(f))]));
  const headAfter = String(spawnSyncGit(['rev-parse', 'HEAD'])).trim();
  console.log('');
  check('step 7: real state.json and mock unchanged',
    realBefore.state === realAfter.state && realBefore.mock === realAfter.mock,
    `state ${realBefore.state} -> ${realAfter.state}`);
  check('step 8: no commit created', headBefore === headAfter, `HEAD ${headBefore} -> ${headAfter}`);

  console.log('');
  console.log(failures === 0 ? 'D10 evidence test passed' : `${failures} check(s) failed`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
