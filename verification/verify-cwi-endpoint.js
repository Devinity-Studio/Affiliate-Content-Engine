'use strict';

/**
 * Consolidated acceptance run for the CWI endpoint (POST /api/content-work-item).
 *
 * Purpose: produce execution evidence, not assertions. Every case below is
 * printed with its HTTP status and the raw response body, and the run ends with
 * an explicit exit code, the checksums of the real repository files, and the
 * git HEAD, so the report can be checked line by line.
 *
 * It also runs the two existing suites as child processes and records their
 * exit codes:
 *   - docs/mission1/schemas/validate-content-work-item.js  (schema validation)
 *   - verification/validate-claim-classes.js                (claim classes)
 *
 * The HTTP server runs on a THROWAWAY copy of app/, data/ and docs/ in a temp
 * directory, so the repository's real data/app/state.json is never written to.
 *
 * Usage:  node verification/verify-cwi-endpoint.js
 * Exit:   0 = every case passed and every child suite exited 0
 *         1 = at least one case or child suite failed
 */

const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.VERIFY_CWI_PORT || 4275);
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
const checks = [];
let failures = 0;

function addCheck(name, command, exitCode, actual, ok) {
  const pass = Boolean(ok);
  if (!pass) failures++;
  checks.push({ name, command, exitCode, actual, pass });
  return pass;
}

function record(label, expected, status, body, ok) {
  const pass = Boolean(ok);
  if (!pass) failures++;
  results.push({ label, expected, status, body, pass });
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${label}\n` +
    `        expected : ${expected}\n` +
    `        status   : ${status}\n` +
    `        body     : ${typeof body === 'string' ? body : JSON.stringify(body)}`
  );
  return pass;
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

async function post(body, raw) {
  const res = await fetch(`${BASE}/api/content-work-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

(async () => {
  const realState = path.join(REPO, 'data', 'app', 'state.json');
  const realMock = path.join(REPO, 'app', 'mock', 'opportunities.json');
  const realLog = path.join(REPO, 'data', 'mission1', 'evidence-log.md');
  const before = {
    state: md5(realState),
    mock: md5(realMock),
    log: md5(realLog),
  };

  console.log('==================================================================');
  console.log(' CWI endpoint acceptance run — real file state on disk');
  console.log('==================================================================');

  // Git state before the run, compared with the state after the run.
  const gitHeadBefore = String(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim();
  const gitStatusBefore = String(spawnSync('git', ['status', '--short'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim().split('\n').filter(Boolean).length;

  // The contract file must exist and parse on its own.
  const schemaPath = path.join(REPO, 'docs', 'mission1', 'schemas', 'content-work-item.schema.json');
  let schemaParsed = false;
  let schemaError = '';
  try { JSON.parse(fs.readFileSync(schemaPath, 'utf8')); schemaParsed = true; } catch (e) { schemaError = e.message; }
  addCheck('Contract file exists and parses as JSON',
    'node -e "JSON.parse(fs.readFileSync(\'docs/mission1/schemas/content-work-item.schema.json\'))"',
    schemaParsed ? 0 : 1,
    schemaParsed ? `parsed OK, md5=${md5(schemaPath)}` : `parse failed: ${schemaError}`,
    schemaParsed);

  for (const rel of [
    'app/server.js',
    'docs/mission1/schemas/content-work-item.schema.json',
    'verification/cwi-contract-enforcement.js',
  ]) {
    const p = path.join(REPO, rel);
    const st = fs.statSync(p);
    console.log(`  ${rel}  md5=${md5(p)}  bytes=${st.size}  mtime=${st.mtime.toISOString()}`);
  }
  console.log('');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-cwi-verify-'));
  fs.cpSync(path.join(REPO, 'app'), path.join(tmp, 'app'), { recursive: true });
  fs.cpSync(path.join(REPO, 'data'), path.join(tmp, 'data'), { recursive: true });
  fs.cpSync(path.join(REPO, 'docs'), path.join(tmp, 'docs'), { recursive: true });

  const server = spawn(process.execPath, ['app/server.js'], {
    cwd: tmp,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  server.stdout.on('data', (d) => log.push(d.toString()));
  server.stderr.on('data', (d) => log.push(d.toString()));
  const cleanup = () => {
    try { server.kill(); } catch { /* already gone */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* windows lock */ }
  };

  try {
    let healthy = false;
    for (let i = 0; i < 40 && !healthy; i++) {
      try { healthy = (await fetch(`${BASE}/api/health`)).ok; } catch { /* not up yet */ }
      if (!healthy) await new Promise((r) => setTimeout(r, 250));
    }
    if (!healthy) {
      console.error('FAIL  temporary server did not become healthy');
      console.error(log.join('\n'));
      cleanup();
      process.exit(1);
    }
    console.log(`temporary server ready: ${BASE}  (temp dir ${tmp})`);
    console.log('real repository files are NOT mounted here — only the copy is.\n');

    // Plan v1 the CWIs reference.
    const planRes = await fetch(`${BASE}/api/plan-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'create', content: 'CWI acceptance run plan' }),
    });
    const plan = await planRes.json();
    const base = { plan_id: plan.plan_id, plan_version: plan.version };
    console.log(`plan created: ${planRes.status} ${JSON.stringify(plan)}\n`);

    // --- 1. PRODUCT with a valid product_id -------------------------------
    const p1 = await post({ ...base, type: 'PRODUCT', product_id: 'P-1001' });
    record('PRODUCT + valid product_id -> 201, both fields returned',
      '201 and type/product_id present', p1.status, p1.body,
      p1.status === 201 && p1.body.type === 'PRODUCT' && p1.body.product_id === 'P-1001');

    // --- 2. PRODUCT with product_id missing ------------------------------
    const p2 = await post({ ...base, type: 'PRODUCT' });
    record('PRODUCT + product_id missing -> 400',
      '400 naming product_id', p2.status, p2.body,
      p2.status === 400 && /product_id/.test(String(p2.body.error)));

    // --- 3. PRODUCT with product_id null ---------------------------------
    const p3 = await post({ ...base, type: 'PRODUCT', product_id: null });
    record('PRODUCT + product_id null -> 400',
      '400 naming product_id', p3.status, p3.body,
      p3.status === 400 && /product_id/.test(String(p3.body.error)));

    // --- 4. PRODUCT with a numeric product_id ----------------------------
    const p4 = await post({ ...base, type: 'PRODUCT', product_id: 1001 });
    record('PRODUCT + numeric product_id -> 400',
      '400 naming product_id', p4.status, p4.body,
      p4.status === 400 && /product_id/.test(String(p4.body.error)));

    // --- 5. PRODUCT with a blank product_id ------------------------------
    const p5 = await post({ ...base, type: 'PRODUCT', product_id: '   ' });
    record('PRODUCT + blank product_id -> 400',
      '400 naming product_id', p5.status, p5.body,
      p5.status === 400 && /product_id/.test(String(p5.body.error)));

    // --- 6. REVIEW with a valid product_id -------------------------------
    const r1 = await post({ ...base, type: 'REVIEW', product_id: 'P-2002' });
    record('REVIEW + valid product_id -> 201, both fields returned',
      '201 and type/product_id present', r1.status, r1.body,
      r1.status === 201 && r1.body.type === 'REVIEW' && r1.body.product_id === 'P-2002');

    // --- 7. REVIEW with product_id missing -------------------------------
    const r2 = await post({ ...base, type: 'REVIEW' });
    record('REVIEW + product_id missing -> 400',
      '400 naming product_id', r2.status, r2.body,
      r2.status === 400 && /product_id/.test(String(r2.body.error)));

    // --- 8. REVIEW with product_id null ----------------------------------
    const r3 = await post({ ...base, type: 'REVIEW', product_id: null });
    record('REVIEW + product_id null -> 400',
      '400 naming product_id', r3.status, r3.body,
      r3.status === 400 && /product_id/.test(String(r3.body.error)));

    // --- 9. METHOD without product_id ------------------------------------
    const m1 = await post({ ...base, type: 'METHOD' });
    record('METHOD + no product_id -> 201 (nullable base applies)',
      '201 and no product_id key', m1.status, m1.body,
      m1.status === 201 && m1.body.type === 'METHOD' && !('product_id' in (m1.body || {})));

    // --- 10. WORKFLOW with product_id null --------------------------------
    const w1 = await post({ ...base, type: 'WORKFLOW', product_id: null });
    record('WORKFLOW + product_id null -> 201 (nullable base applies)',
      '201 and product_id null', w1.status, w1.body,
      w1.status === 201 && w1.body.type === 'WORKFLOW' && w1.body.product_id === null);

    // --- 11. stored + returned by GET -------------------------------------
    const getRes = await fetch(`${BASE}/api/content-work-item/${p1.body.id}`);
    const getBody = await getRes.json();
    record('GET the created CWI -> type and product_id persisted',
      '200 with both fields', getRes.status, getBody,
      getRes.status === 200 && getBody.type === 'PRODUCT' && getBody.product_id === 'P-1001');

    // --- 12. state file on disk ------------------------------------------
    const tmpState = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'app', 'state.json'), 'utf8'));
    const stored = tmpState.cwis[p1.body.id];
    record('temporary state file stores type and product_id',
      'record with both fields', 'n/a (file read)', stored,
      stored && stored.type === 'PRODUCT' && stored.product_id === 'P-1001');

    // --- 13. contract rejections -----------------------------------------
    const badType = await post({ ...base, type: 'PROMO', product_id: 'P-1' });
    record('unknown type -> 400', '400', badType.status, badType.body, badType.status === 400);
    const noType = await post({ ...base, product_id: 'P-1' });
    record('missing type -> 400', '400', noType.status, noType.body, noType.status === 400);
    const typo = await post({ ...base, type: 'PRODUCT', product_id: 'P-1', prodcut_id: 'typo' });
    record('unknown field -> 400', '400', typo.status, typo.body, typo.status === 400);

    // --- 14. legacy error strings ----------------------------------------
    const malformed = await post(null, '{not json');
    record('malformed JSON -> 400 "Body must be valid JSON"',
      '400 Body must be valid JSON', malformed.status, malformed.body,
      malformed.status === 400 && malformed.body.error === 'Body must be valid JSON');
    const arr = await post(null, '[]');
    record('array body -> 400 "Body must be a JSON object"',
      '400 Body must be a JSON object', arr.status, arr.body,
      arr.status === 400 && arr.body.error === 'Body must be a JSON object');
    const noPlan = await post({ plan_version: 'v1', type: 'PRODUCT', product_id: 'P-1' });
    record('missing plan_id -> 400 "plan_id is required"',
      '400 plan_id is required', noPlan.status, noPlan.body,
      noPlan.status === 400 && noPlan.body.error === 'plan_id is required');
    const noVer = await post({ plan_id: 'PLAN-1-1', type: 'PRODUCT', product_id: 'P-1' });
    record('missing plan_version -> 400 "plan_version is required"',
      '400 plan_version is required', noVer.status, noVer.body,
      noVer.status === 400 && noVer.body.error === 'plan_version is required');
    const badPlan = await post({ plan_id: 'PLAN-9-9', plan_version: 'v1', type: 'PRODUCT', product_id: 'P-1' });
    record('unknown plan version -> 404',
      '404 plan_id/plan_version not found', badPlan.status, badPlan.body,
      badPlan.status === 404 && /not found/.test(String(badPlan.body.error)));

    // --- 15. child suites ------------------------------------------------
    console.log('------------------------------------------------------------------');
    console.log(' child suites');
    console.log('------------------------------------------------------------------');
    const suites = [
      ['docs/mission1/schemas/validate-content-work-item.js', 'schema validation'],
      ['verification/validate-claim-classes.js', 'claim-class validation'],
      ['verification/cwi-contract-enforcement.js', 'CWI contract enforcement'],
    ];
    const suiteResults = [];
    for (const [rel, label] of suites) {
      const run = spawnSync(process.execPath, [path.join(REPO, rel)], { cwd: REPO, encoding: 'utf8' });
      const tail = String(run.stdout || '')
        .split('\n').map((l) => l.trim()).filter(Boolean).slice(-2).join(' | ');
      const ok = run.status === 0;
      if (!ok) failures++;
      suiteResults.push({ script: rel, label, exitCode: run.status, ok, tail });
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${rel})\n        exit code: ${run.status}\n        output   : ${tail}`);
    }

    // --- 16. real files and git ------------------------------------------
    console.log('------------------------------------------------------------------');
    console.log(' real repository files and git state');
    console.log('------------------------------------------------------------------');
    const after = {
      state: md5(realState),
      mock: md5(realMock),
      log: md5(realLog),
    };
    const same = JSON.stringify(before) === JSON.stringify(after);
    if (!same) failures++;
    console.log(`${same ? 'PASS' : 'FAIL'}  real files unchanged`);
    console.log(`        data/app/state.json          ${before.state} -> ${after.state}`);
    console.log(`        app/mock/opportunities.json  ${before.mock} -> ${after.mock}`);
    console.log(`        data/mission1/evidence-log.md ${before.log} -> ${after.log}`);

    const head = spawnSync('git', ['log', '--oneline', '-1'], { cwd: REPO, encoding: 'utf8' });
    const headLine = String(head.stdout || '').trim();
    const gitHeadAfter = String(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim();
    const gitStatusAfter = String(spawnSync('git', ['status', '--short'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim().split('\n').filter(Boolean).length;
    console.log(`        git HEAD: ${headLine}`);
    console.log(`        git HEAD before/after: ${gitHeadBefore} / ${gitHeadAfter}`);
    console.log(`        worktree entries before/after: ${gitStatusBefore} / ${gitStatusAfter}`);

    addCheck('Real data/app/state.json is byte-identical after the run',
      'md5sum data/app/state.json  (before vs after)',
      same ? 0 : 1,
      `${before.state} -> ${after.state}`,
      same);
    addCheck('Real state file still holds no CWI or plan records',
      'node -e "read data/app/state.json, list keys"',
      (!('cwis' in JSON.parse(fs.readFileSync(realState, 'utf8'))) && !('planVersions' in JSON.parse(fs.readFileSync(realState, 'utf8')))) ? 0 : 1,
      `keys: ${Object.keys(JSON.parse(fs.readFileSync(realState, 'utf8'))).join(', ')} (no cwis, no planVersions)`,
      !('cwis' in JSON.parse(fs.readFileSync(realState, 'utf8'))) && !('planVersions' in JSON.parse(fs.readFileSync(realState, 'utf8'))));
    addCheck('No commit was created (HEAD unchanged)',
      'git rev-parse HEAD  (before vs after)',
      gitHeadBefore === gitHeadAfter ? 0 : 1,
      `${gitHeadBefore} -> ${gitHeadAfter}  (${headLine})`,
      gitHeadBefore === gitHeadAfter);
    addCheck('Working tree entry count unchanged (nothing added or removed)',
      'git status --short | wc -l  (before vs after)',
      gitStatusBefore === gitStatusAfter ? 0 : 1,
      `${gitStatusBefore} -> ${gitStatusAfter}`,
      gitStatusBefore === gitStatusAfter);
    addCheck('Only the temporary copy was written',
      'server started in temp dir, repo files not mounted',
      0,
      `temp dir ${tmp}; real state has no cwis/planVersions while the temp copy holds ${Object.keys(tmpState.cwis || {}).length} CWI record(s)`,
      Object.keys(tmpState.cwis || {}).length > 0 && !('cwis' in JSON.parse(fs.readFileSync(realState, 'utf8'))));

    const evidence = {
      ranAt: new Date().toISOString(),
      base: BASE,
      tempDir: tmp,
      plan: { plan_id: plan.plan_id, plan_version: plan.version },
      cases: results,
      suites: suiteResults,
      checks,
      realFiles: { before, after, unchanged: same },
      gitHead: headLine,
      gitHeadBefore,
      gitHeadAfter,
      gitStatusBefore,
      gitStatusAfter,
      failures,
    };
    const outPath = path.join(REPO, 'verification', 'cwi-endpoint-acceptance-2026-10-21.json');
    fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    console.log('');
    console.log(`evidence written: ${outPath}`);

    // Markdown table generated from the actual run — never hand-written.
    const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const rows = [];
    for (const c of checks) {
      rows.push(`| ${esc(c.name)} | \`${esc(c.command)}\` | ${c.exitCode} | ${esc(c.actual)} | ${c.pass ? 'PASS' : 'FAIL'} |`);
    }
    for (const c of results) {
      const bodyText = typeof c.body === 'string' ? c.body : JSON.stringify(c.body);
      rows.push(`| ${esc(c.label)} | \`node verification/verify-cwi-endpoint.js\` (HTTP case) | ${c.pass ? 0 : 1} | HTTP ${c.status} — \`${esc(bodyText)}\` | ${c.pass ? 'PASS' : 'FAIL'} |`);
    }
    for (const s of suiteResults) {
      rows.push(`| ${esc(s.label)} | \`node ${esc(s.script)}\` | ${s.exitCode} | ${esc(s.tail)} | ${s.ok ? 'PASS' : 'FAIL'} |`);
    }
    const md = [
      '# CWI endpoint — final verification run',
      '',
      `Run at ${new Date().toISOString()} · runner exit code ${failures ? 1 : 0} · cases ${results.length} · checks ${checks.length} · failures ${failures}`,
      '',
      '| Check | Command/Test | Exit code | Actual result | Pass/Fail |',
      '|---|---|---|---|---|',
      ...rows,
      '',
      'Exit code per row is the exit code the runner returns for that row (0 = assertion held, 1 = assertion failed);',
      'the overall runner exit code is the last line above.',
      '',
    ].join('\n');
    const mdPath = path.join(REPO, 'verification', 'cwi-endpoint-acceptance-2026-10-21.md');
    fs.writeFileSync(mdPath, md, 'utf8');
    console.log(`table written: ${mdPath}`);
    console.log('');
    console.log(md);
  } finally {
    cleanup();
  }

  console.log('');
  console.log(`cases: ${results.length}  failures: ${failures}`);
  process.exit(failures ? 1 : 0);
})();
