'use strict';

/**
 * Probe for POST /api/content-work-item (the CWI endpoint).
 *
 * Runs against a THROWAWAY copy of app/, data/ and docs/ in a temp directory, so
 * the repository's real data/app/state.json is never written to. The probe
 * records what the current code does with the fields the CWI contract defines
 * (type, product_id).
 *
 * HISTORY: the log of 2026-10-21 08:07 was taken BEFORE the contract was
 * enforced and is kept as the counter-proof (PRODUCT + product_id null returned
 * 201). A later log of the same date is taken AFTER enforcement; the two logs
 * together show the behaviour change.
 *
 * Usage:  node verification/probe-cwi-endpoint.js
 * Exit:   0 = probe completed, 1 = probe or setup failure.
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.PROBE_PORT || 4271);
const BASE = `http://127.0.0.1:${PORT}`;

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
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

(async () => {
  const realState = path.join(REPO, 'data', 'app', 'state.json');
  const before = md5(realState);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-cwi-probe-'));
  fs.cpSync(path.join(REPO, 'app'), path.join(tmp, 'app'), { recursive: true });
  fs.cpSync(path.join(REPO, 'data'), path.join(tmp, 'data'), { recursive: true });
  // The server resolves the CWI contract at app/../docs/mission1/schemas/...
  fs.cpSync(path.join(REPO, 'docs'), path.join(tmp, 'docs'), { recursive: true });

  const server = spawn(process.execPath, ['app/server.js'], {
    cwd: tmp,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const serverLog = [];
  server.stdout.on('data', (d) => serverLog.push(d.toString().trim()));
  server.stderr.on('data', (d) => serverLog.push(d.toString().trim()));

  const cleanup = () => {
    try { server.kill(); } catch { /* already gone */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* windows lock */ }
  };

  try {
    console.log(`temp workspace : ${tmp}`);
    console.log(`server         : ${BASE} (isolated copy)`);
    console.log('');

    if (!(await waitForHealth())) {
      console.error('FAIL: temporary server did not become healthy');
      console.error(serverLog.join('\n'));
      cleanup();
      process.exit(1);
    }

    const steps = [];
    const step = (name, method, urlPath, body, note) =>
      steps.push({ name, method, urlPath, body, note });

    step('health', 'GET', '/api/health', null, 'liveness + mock flag');
    step('create plan v1', 'POST', '/api/plan-version', { operation: 'create', content: 'Probe plan v1' }, 'needed before a CWI can reference it');
    step('CWI minimal (no type)', 'POST', '/api/content-work-item', { plan_id: 'PLAN-1-1', plan_version: 'v1' }, 'contract requires type -> expect 400');
    step('CWI with type + product_id', 'POST', '/api/content-work-item', { plan_id: 'PLAN-1-1', plan_version: 'v1', type: 'PRODUCT', product_id: 'P-1001' }, 'expect 201 and both fields stored');
    step('CWI PRODUCT + product_id null', 'POST', '/api/content-work-item', { plan_id: 'PLAN-1-1', plan_version: 'v1', type: 'PRODUCT', product_id: null }, 'contract says this MUST be rejected');
    step('CWI PRODUCT + product_id missing', 'POST', '/api/content-work-item', { plan_id: 'PLAN-1-1', plan_version: 'v1', type: 'PRODUCT' }, 'contract says this MUST be rejected');
    step('CWI unknown plan version', 'POST', '/api/content-work-item', { plan_id: 'PLAN-9-9', plan_version: 'v1' }, 'expect 404');
    step('CWI missing plan_id', 'POST', '/api/content-work-item', { plan_version: 'v1' }, 'expect 400');
    step('CWI GET by id', 'GET', '/api/content-work-item/CWI-1', null, 'stored record shape (CWI-1 is the first PRODUCT record)');

    let planId = 'PLAN-1-1';
    let planVersion = 'v1';

    for (const s of steps) {
      let body = s.body;
      if (s.name === 'create plan v1') {
        const res = await call(s.method, s.urlPath, body);
        const created = res.body && res.body.id ? res.body.id : '';
        const m = created.match(/PLAN-(\d+)-(\d+)-v(\d+)/);
        if (m) { planId = `PLAN-${m[1]}-${m[2]}`; planVersion = `v${m[3]}`; }
        body = null;
        console.log(`--- ${s.name} (${s.method} ${s.urlPath})`);
        console.log(`    note : ${s.note}`);
        console.log(`    -> ${res.status} ${JSON.stringify(res.body)}`);
        continue;
      }
      if (s.body && typeof s.body === 'object' && 'plan_id' in s.body) {
        body = { ...s.body };
        if (body.plan_id !== 'PLAN-9-9') { body.plan_id = planId; body.plan_version = planVersion; }
        else { body.plan_version = planVersion; }
      }
      const res = await call(s.method, s.urlPath, body);
      console.log(`--- ${s.name} (${s.method} ${s.urlPath})`);
      console.log(`    sent  : ${body ? JSON.stringify(body) : '(no body)'}`);
      console.log(`    note  : ${s.note}`);
      console.log(`    -> ${res.status} ${JSON.stringify(res.body)}`);
    }

    console.log('');
    console.log('=== state file written by the isolated server ===');
    const tmpState = path.join(tmp, 'data', 'app', 'state.json');
    const tmpStateBody = JSON.parse(fs.readFileSync(tmpState, 'utf8'));
    console.log(`cwis stored: ${JSON.stringify(tmpStateBody.cwis || null)}`);

    const after = md5(realState);
    console.log('');
    console.log(`real data/app/state.json md5 before: ${before}`);
    console.log(`real data/app/state.json md5 after : ${after}`);
    console.log(before === after ? 'real state UNCHANGED' : 'REAL STATE CHANGED (unexpected)');
    if (before !== after) {
      cleanup();
      process.exit(1);
    }
  } finally {
    cleanup();
  }
})();
