'use strict';

/**
 * Validation test for the four claim classes (Doc D §3.1):
 *   FACT / INFERENCE / HYPOTHESIS / UNKNOWN
 *
 * The runtime allowlist lives in app/server.js (CLAIM_CLASSES) and is enforced by
 * validateMock() when the server loads the mock dataset. This test proves, on a
 * throwaway copy of app/ and data/:
 *
 *   1. the server starts and serves a dataset that uses all four classes;
 *   2. the API returns every claimClass value verbatim (no rewrite, no loss);
 *   3. a class outside the four is rejected (the server refuses to start);
 *   4. the repository's own dataset, evidence log and state file are untouched
 *      (no record is migrated or re-classified by the runtime change).
 *
 * Usage:  node verification/validate-claim-classes.js
 * Exit:   0 = all assertions passed, 1 = a check failed.
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.CLAIM_CLASS_PORT || 4272);
const BASE = `http://127.0.0.1:${PORT}`;
const FOUR_CLASSES = ['FACT', 'INFERENCE', 'HYPOTHESIS', 'UNKNOWN'];

let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function makeWorkspace() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-claim-classes-'));
  fs.cpSync(path.join(REPO, 'app'), path.join(tmp, 'app'), { recursive: true });
  fs.cpSync(path.join(REPO, 'data'), path.join(tmp, 'data'), { recursive: true });
  return tmp;
}

/** Rewrite the copied mock so one opportunity carries the given claim classes. */
function setEvidenceClasses(tmp, classes) {
  const mockPath = path.join(tmp, 'app', 'mock', 'opportunities.json');
  const mock = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
  const evidence = classes.map((claimClass, i) => ({
    id: `EV-CLASS-${i + 1}`,
    source: 'mock://claim-class-validation',
    finding: `Synthetic finding tagged ${claimClass}`,
    limitations: 'Synthetic record; exists only to exercise the claim-class allowlist.',
    claimClass,
    mock: true,
  }));
  mock.opportunities[0].evidence = evidence;
  fs.writeFileSync(mockPath, `${JSON.stringify(mock, null, 2)}\n`);
  return mock;
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

async function waitForHealth(attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function stop(server) {
  return new Promise((resolve) => {
    if (!server || server.exitCode !== null) return resolve();
    server.once('exit', () => resolve());
    server.kill();
    setTimeout(resolve, 2000);
  });
}

(async () => {
  const tracked = {
    mock: path.join(REPO, 'app', 'mock', 'opportunities.json'),
    evidenceLog: path.join(REPO, 'data', 'mission1', 'evidence-log.md'),
    state: path.join(REPO, 'data', 'app', 'state.json'),
  };
  const before = Object.fromEntries(Object.entries(tracked).map(([k, f]) => [k, md5(f)]));

  console.log('=== 1. server starts with all four claim classes ===');
  const tmpOk = makeWorkspace();
  let child = null;
  try {
    setEvidenceClasses(tmpOk, FOUR_CLASSES);
    const started = startServer(tmpOk);
    child = started.server;
    const healthy = await waitForHealth();
    check('server starts with FACT/INFERENCE/HYPOTHESIS/UNKNOWN', healthy,
      healthy ? '' : started.log.join(' ').trim());

    if (healthy) {
      console.log('');
      console.log('=== 2. API returns every claimClass verbatim ===');
      const res = await fetch(`${BASE}/api/opportunities`);
      const payload = await res.json();
      const returned = (payload.opportunities?.[0]?.evidence || []).map((e) => e.claimClass);
      check('all four classes come back in the API response',
        JSON.stringify(returned) === JSON.stringify(FOUR_CLASSES),
        `returned: ${JSON.stringify(returned)}`);
      check('no class was rewritten or re-ordered',
        returned.every((c) => FOUR_CLASSES.includes(c)),
        `returned: ${JSON.stringify(returned)}`);
      check('response stays labelled as mock data', payload.meta?.mock === true);
    }
  } finally {
    await stop(child);
    fs.rmSync(tmpOk, { recursive: true, force: true });
  }

  console.log('');
  console.log('=== 3. a class outside the four is rejected ===');
  const tmpBad = makeWorkspace();
  let childBad = null;
  try {
    setEvidenceClasses(tmpBad, ['SPECULATION']);
    const started = startServer(tmpBad);
    childBad = started.server;
    const healthy = await waitForHealth(8);
    const exited = await new Promise((resolve) => {
      if (childBad.exitCode !== null) return resolve(true);
      const timer = setTimeout(() => resolve(childBad.exitCode !== null), 3000);
      childBad.once('exit', () => { clearTimeout(timer); resolve(true); });
    });
    check('server refuses a dataset with an invalid claim class',
      !healthy && exited && /claimClass is invalid/.test(started.log.join(' ')),
      started.log.join(' ').trim().slice(0, 200));
  } finally {
    await stop(childBad);
    fs.rmSync(tmpBad, { recursive: true, force: true });
  }

  console.log('');
  console.log('=== 3b. the previous three-class allowlist would have rejected it ===');
  const tmpOld = makeWorkspace();
  let childOld = null;
  try {
    setEvidenceClasses(tmpOld, FOUR_CLASSES);
    // Recreate the pre-change allowlist inside the throwaway copy only.
    const serverPath = path.join(tmpOld, 'app', 'server.js');
    const source = fs.readFileSync(serverPath, 'utf8');
    const patched = source.replace(
      "const CLAIM_CLASSES = new Set(['FACT', 'INFERENCE', 'HYPOTHESIS', 'UNKNOWN']);",
      "const CLAIM_CLASSES = new Set(['FACT', 'INFERENCE', 'UNKNOWN']);",
    );
    if (patched === source) throw new Error('could not patch the CLAIM_CLASSES line in the copy');
    fs.writeFileSync(serverPath, patched);
    const started = startServer(tmpOld);
    childOld = started.server;
    const healthy = await waitForHealth(8);
    check('the old three-class allowlist rejects a HYPOTHESIS record',
      !healthy && /claimClass is invalid/.test(started.log.join(' ')),
      started.log.join(' ').trim().slice(0, 160));
  } finally {
    await stop(childOld);
    fs.rmSync(tmpOld, { recursive: true, force: true });
  }

  console.log('');
  console.log('=== 4. existing records are not migrated or rewritten ===');
  const after = Object.fromEntries(Object.entries(tracked).map(([k, f]) => [k, md5(f)]));
  check('app/mock/opportunities.json unchanged', before.mock === after.mock);
  check('data/mission1/evidence-log.md unchanged', before.evidenceLog === after.evidenceLog);
  check('data/app/state.json unchanged', before.state === after.state);

  const logText = fs.readFileSync(tracked.evidenceLog, 'utf8');
  const logClasses = [...logText.matchAll(/\*\*claim_class:\*\*\s*([A-Z]+)/g)].map((m) => m[1]);
  const allValid = logClasses.every((c) => FOUR_CLASSES.includes(c));
  check('every evidence-log claim_class is one of the four', allValid,
    `values: ${JSON.stringify([...new Set(logClasses)])}`);
  check('evidence-log entries were not re-classified', logClasses.length === 10,
    `entries: ${logClasses.length}`);

  console.log('');
  if (failures) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('all claim-class checks passed');
})();
