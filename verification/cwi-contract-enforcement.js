'use strict';

/**
 * Contract-enforcement test for POST /api/content-work-item.
 *
 * Runs against a THROWAWAY copy of app/ and data/ so the repository's real
 * data/app/state.json is never written to. It proves that the endpoint now
 * enforces docs/mission1/schemas/content-work-item.schema.json:
 *
 *   1. PRODUCT  + product_id        -> 201, type and product_id stored + returned
 *   2. PRODUCT  + product_id missing-> 400
 *   3. PRODUCT  + product_id null   -> 400
 *   4. REVIEW   + product_id        -> 201
 *   5. METHOD / WORKFLOW without product_id -> 201 (the contract's nullable base)
 *   6. type and product_id are persisted and returned by GET
 *   7. a client-supplied `cwi_id` is rejected (server generates the id)
 *
 * plus regression checks for the error strings that earlier acceptance
 * evidence already verified.
 *
 * Usage:  node verification/cwi-contract-enforcement.js
 * Exit:   0 = all assertions passed, 1 = a check failed.
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.CWI_ENFORCEMENT_PORT || 4273);
const BASE = `http://127.0.0.1:${PORT}`;

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

async function post(urlPath, body, raw) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

async function get(urlPath) {
  const res = await fetch(`${BASE}${urlPath}`);
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

(async () => {
  const realState = path.join(REPO, 'data', 'app', 'state.json');
  const before = md5(realState);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-cwi-enforce-'));
  fs.cpSync(path.join(REPO, 'app'), path.join(tmp, 'app'), { recursive: true });
  fs.cpSync(path.join(REPO, 'data'), path.join(tmp, 'data'), { recursive: true });
  // The server resolves the contract at app/../docs/mission1/schemas/..., so the
  // throwaway copy needs the same docs tree.
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
      console.error('FAIL: temporary server did not become healthy');
      console.error(log.join('\n'));
      cleanup();
      process.exit(1);
    }
    console.log(`temporary server: ${BASE} (isolated copy)\n`);

    // A Plan version the CWI can reference.
    const plan = await post('/api/plan-version', { operation: 'create', content: 'Enforcement probe plan' });
    const planId = plan.body.plan_id;
    const planVersion = plan.body.version;
    check('plan v1 created for the probe', plan.status === 201 && !!planId, `plan_id=${planId} version=${planVersion}`);

    const base = { plan_id: planId, plan_version: planVersion };

    console.log('\n=== 1. PRODUCT with a valid product_id ===');
    const productOk = await post('/api/content-work-item', { ...base, type: 'PRODUCT', product_id: 'P-1001' });
    check('201 Created', productOk.status === 201, `status=${productOk.status} body=${JSON.stringify(productOk.body)}`);
    check('response contains type', productOk.body.type === 'PRODUCT', `type=${productOk.body.type}`);
    check('response contains product_id', productOk.body.product_id === 'P-1001', `product_id=${productOk.body.product_id}`);

    console.log('\n=== 2. PRODUCT with product_id missing ===');
    const productMissing = await post('/api/content-work-item', { ...base, type: 'PRODUCT' });
    check('400 Bad Request', productMissing.status === 400, `status=${productMissing.status} body=${JSON.stringify(productMissing.body)}`);
    check('error names product_id', /product_id/.test(String(productMissing.body.error)), `error=${productMissing.body.error}`);

    console.log('\n=== 3. PRODUCT with product_id null ===');
    const productNull = await post('/api/content-work-item', { ...base, type: 'PRODUCT', product_id: null });
    check('400 Bad Request', productNull.status === 400, `status=${productNull.status} body=${JSON.stringify(productNull.body)}`);
    check('error names product_id', /product_id/.test(String(productNull.body.error)), `error=${productNull.body.error}`);

    console.log('\n=== 4. REVIEW with a valid product_id ===');
    const reviewOk = await post('/api/content-work-item', { ...base, type: 'REVIEW', product_id: 'P-2002' });
    check('201 Created', reviewOk.status === 201, `status=${reviewOk.status} body=${JSON.stringify(reviewOk.body)}`);
    check('response contains type and product_id',
      reviewOk.body.type === 'REVIEW' && reviewOk.body.product_id === 'P-2002',
      `type=${reviewOk.body.type} product_id=${reviewOk.body.product_id}`);

    console.log('\n=== 4b. REVIEW is product-bound too: null and missing are rejected ===');
    const reviewNull = await post('/api/content-work-item', { ...base, type: 'REVIEW', product_id: null });
    check('REVIEW + product_id null -> 400', reviewNull.status === 400, `status=${reviewNull.status} body=${JSON.stringify(reviewNull.body)}`);
    const reviewMissing = await post('/api/content-work-item', { ...base, type: 'REVIEW' });
    check('REVIEW without product_id -> 400', reviewMissing.status === 400, `status=${reviewMissing.status} body=${JSON.stringify(reviewMissing.body)}`);

    console.log('\n=== 5. METHOD / WORKFLOW without a product_id ===');
    const methodOk = await post('/api/content-work-item', { ...base, type: 'METHOD' });
    check('METHOD without product_id -> 201', methodOk.status === 201, `status=${methodOk.status} body=${JSON.stringify(methodOk.body)}`);
    check('METHOD record has no product_id', !('product_id' in (methodOk.body || {})), JSON.stringify(methodOk.body));
    const workflowNull = await post('/api/content-work-item', { ...base, type: 'WORKFLOW', product_id: null });
    check('WORKFLOW with product_id null -> 201', workflowNull.status === 201, `status=${workflowNull.status} body=${JSON.stringify(workflowNull.body)}`);
    check('WORKFLOW record keeps product_id null', workflowNull.body.product_id === null, JSON.stringify(workflowNull.body));

    console.log('\n=== 6. type and product_id are stored and returned by GET ===');
    const fetched = await get(`/api/content-work-item/${productOk.body.id}`);
    check('GET returns 200', fetched.status === 200, `status=${fetched.status}`);
    check('stored record keeps type', fetched.body.type === 'PRODUCT', `type=${fetched.body.type}`);
    check('stored record keeps product_id', fetched.body.product_id === 'P-1001', `product_id=${fetched.body.product_id}`);
    const stateBody = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'app', 'state.json'), 'utf8'));
    const stored = stateBody.cwis[productOk.body.id];
    check('state file stores type and product_id',
      stored && stored.type === 'PRODUCT' && stored.product_id === 'P-1001',
      JSON.stringify(stored));

    console.log('\n=== regression: error strings verified by earlier acceptance evidence ===');
    const malformed = await post('/api/content-work-item', null, '{not json');
    check('malformed JSON -> 400 "Body must be valid JSON"',
      malformed.status === 400 && malformed.body.error === 'Body must be valid JSON', JSON.stringify(malformed.body));
    const arrayBody = await post('/api/content-work-item', null, '[]');
    check('array body -> 400 "Body must be a JSON object"',
      arrayBody.status === 400 && arrayBody.body.error === 'Body must be a JSON object', JSON.stringify(arrayBody.body));
    const noPlan = await post('/api/content-work-item', { plan_version: planVersion });
    check('missing plan_id -> 400 "plan_id is required"',
      noPlan.status === 400 && noPlan.body.error === 'plan_id is required', JSON.stringify(noPlan.body));
    const noVersion = await post('/api/content-work-item', { plan_id: planId });
    check('missing plan_version -> 400 "plan_version is required"',
      noVersion.status === 400 && noVersion.body.error === 'plan_version is required', JSON.stringify(noVersion.body));
    const unknownPlan = await post('/api/content-work-item', { plan_id: 'PLAN-9-9', plan_version: 'v1', type: 'PRODUCT', product_id: 'P-1' });
    check('unknown plan version -> 404',
      unknownPlan.status === 404 && /not found/.test(String(unknownPlan.body.error)), JSON.stringify(unknownPlan.body));

    console.log('\n=== regression: contract rejections ===');
    const noType = await post('/api/content-work-item', { ...base, product_id: 'P-1' });
    check('missing type -> 400', noType.status === 400, JSON.stringify(noType.body));
    const badType = await post('/api/content-work-item', { ...base, type: 'PROMO', product_id: 'P-1' });
    check('unknown type -> 400', badType.status === 400, JSON.stringify(badType.body));
    const unknownField = await post('/api/content-work-item', { ...base, type: 'PRODUCT', product_id: 'P-1', prodcut_id: 'typo' });
    check('unknown field -> 400', unknownField.status === 400, JSON.stringify(unknownField.body));
    const emptyProduct = await post('/api/content-work-item', { ...base, type: 'PRODUCT', product_id: '   ' });
    check('blank product_id -> 400', emptyProduct.status === 400, JSON.stringify(emptyProduct.body));
    const numericProduct = await post('/api/content-work-item', { ...base, type: 'PRODUCT', product_id: 1001 });
    check('numeric product_id -> 400', numericProduct.status === 400, `status=${numericProduct.status} body=${JSON.stringify(numericProduct.body)}`);
    const numericReview = await post('/api/content-work-item', { ...base, type: 'REVIEW', product_id: 1001 });
    check('numeric product_id on REVIEW -> 400', numericReview.status === 400, `status=${numericReview.status} body=${JSON.stringify(numericReview.body)}`);
    console.log('\n=== cwi_id policy: server-generated, immutable, client-supplied rejected ===');
    const stateBeforeCwiId = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'app', 'state.json'), 'utf8'));
    const countBefore = Object.keys(stateBeforeCwiId.cwis || {}).length;
    const suppliedId = await post('/api/content-work-item', { ...base, cwi_id: 'CWI-999', type: 'PRODUCT', product_id: 'P-1' });
    check('client-supplied cwi_id -> 400', suppliedId.status === 400,
      `status=${suppliedId.status} body=${JSON.stringify(suppliedId.body)}`);
    check('error message is the policy message',
      suppliedId.body.error === 'client-supplied cwi_id is not allowed; server generates cwi_id',
      `error=${suppliedId.body.error}`);

    const suppliedMatchingId = await post('/api/content-work-item', {
      ...base, cwi_id: `CWI-${countBefore + 1}`, type: 'PRODUCT', product_id: 'P-1',
    });
    check('cwi_id equal to the next server id is still rejected -> 400', suppliedMatchingId.status === 400,
      `status=${suppliedMatchingId.status} body=${JSON.stringify(suppliedMatchingId.body)}`);

    const suppliedNullId = await post('/api/content-work-item', { ...base, cwi_id: null, type: 'PRODUCT', product_id: 'P-1' });
    check('cwi_id: null -> 400', suppliedNullId.status === 400,
      `status=${suppliedNullId.status} body=${JSON.stringify(suppliedNullId.body)}`);

    const stateAfterCwiId = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'app', 'state.json'), 'utf8'));
    const countAfter = Object.keys(stateAfterCwiId.cwis || {}).length;
    check('rejected cwi_id attempts created no record', countAfter === countBefore,
      `count ${countBefore} -> ${countAfter}`);
    check('the server still assigns its own sequential id',
      /^CWI-[0-9]+$/.test(String(productOk.body.id)) && productOk.body.id !== 'CWI-999',
      `id=${productOk.body.id}`);

    console.log('\n=== repository state must be untouched ===');
    const after = md5(realState);
    check('real data/app/state.json unchanged', before === after, `md5 ${before} -> ${after}`);
  } finally {
    cleanup();
  }

  console.log('');
  if (failures) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('all CWI contract-enforcement checks passed');
})();
