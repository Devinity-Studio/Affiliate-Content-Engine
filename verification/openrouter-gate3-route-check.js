'use strict';

/**
 * ACE — Gate 3 route wiring check (offline).
 *
 * Drives `handleMvp()` in-process for `POST /api/mvp/content/draft` so the
 * service-layer wiring is exercised, not just the content module. Any real
 * network egress is blocked by replacing `globalThis.fetch` with a recorder
 * for the duration of the run.
 *
 * This is still OFFLINE_TEST: no key leaves the process, no request is sent.
 *
 * Usage:
 *   node verification/openrouter-gate3-route-check.js
 *
 * Exit codes:
 *   0  all checks passed
 *   1  at least one check failed
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TMP_DIR = path.join(REPO, '.tmp', 'gate3-route-check');
const STATE_FILE = path.join(TMP_DIR, 'state.json');
const LOG_FILE = path.join(__dirname, 'openrouter-gate3-route-2026-11-01.log');
const CANARY = 'sk-or-v1-ROUTE-CANARY-0000';

const lines = [];
function say(text = '') {
  lines.push(text);
  console.log(text);
}

/* ------------------------------------------------------------------ */
/* Isolated fixture state                                              */
/* ------------------------------------------------------------------ */

function seedState() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const evidenceIds = ['PRICE', 'PROMO', 'REVIEWS', 'SHOP', 'CONVERSION', 'PRICE_POSITION', 'COMMISSION']
    .map((code) => `EV-SKU-1-${code}`);

  const offer = {
    id: 'OFF-1',
    item_id: 'SKU-1',
    shop_id: 'SHOP-1',
    shop_name: 'ร้านทดสอบ',
    price_thb: 299,
    list_price_thb: 599,
    promo: { label: 'ลด 50%', depth_pct: 50 },
    reviews: { rating: 4.6, rating_count: 128 },
    shop: { rating: 4.7, related_shop_count: 3 },
    affiliate_link: 'https://example.invalid/aff',
    checked_at: '2026-10-21T00:00:00.000Z',
    synthetic: true,
    file_hash: 'fixture-hash',
    evidence_ids: evidenceIds,
  };

  const product = {
    id: 'PRD-1',
    name: 'กระเป๋าผ้าราคาประหยัด',
    category: 'Home',
    url: 'https://example.invalid/product',
  };

  const candidate = {
    id: 'CND-1',
    offer_id: offer.id,
    product_id: product.id,
    status: 'SAVED',
    source_ids: ['SRC-1'],
    evidence_ids: evidenceIds,
  };

  const state = {
    schemaVersion: 1,
    kind: 'MVP_FIXTURE_STATE',
    synthetic: true,
    data_mode: 'FIXTURE',
    cycle: 1,
    sources: {},
    products: { [product.id]: product },
    offers: { [offer.id]: offer },
    evidence: {},
    candidates: { [candidate.id]: candidate },
    candidateOrder: [candidate.id],
    contents: {},
    contentOrder: [],
    plans: {},
    planOrder: [],
  };

  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

seedState();
// Must be set before the service module is required: it resolves the state
// path at load time, the same way every other ACE path override works.
process.env.ACE_MVP_STATE_FILE = STATE_FILE;

const mvp = require(path.join(REPO, 'app', 'mvp', 'service.js'));

/* ------------------------------------------------------------------ */
/* Request harness                                                     */
/* ------------------------------------------------------------------ */

function recorder() {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    throw new Error('the route check must never reach the network');
  };
  impl.calls = calls;
  return impl;
}

async function callDraft(body, fetchRecorder) {
  const captured = { status: null, payload: null };
  const originalFetch = globalThis.fetch;
  if (fetchRecorder) globalThis.fetch = fetchRecorder;

  try {
    const req = { method: 'POST', url: '/api/mvp/content/draft', headers: {} };
    const res = { writeHead() {}, end() {}, setHeader() {} };
    const ctx = {
      pathname: '/api/mvp/content/draft',
      // The real server's readBody resolves to a string, so match that.
      readBody: async () => JSON.stringify(body),
      sendJson: (_res, status, payload) => {
        captured.status = status;
        captured.payload = payload;
      },
    };
    await mvp.handleMvp(req, res, ctx);
    return captured;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

async function main() {
  const results = [];

  function record(id, name, fn) {
    try {
      const note = fn();
      results.push({ id, name, ok: true, note: note || '' });
      say(`ok   ${id}  ${name}${note ? ` — ${note}` : ''}`);
    } catch (error) {
      results.push({ id, name, ok: false, note: error && error.message ? error.message : String(error) });
      say(`FAIL ${id}  ${name}\n     ${error && error.message ? error.message : error}`);
    }
  }

  say('ACE — OpenRouter Gate 3 route wiring check (offline)');
  say(`state file: ${path.relative(REPO, STATE_FILE).split(path.sep).join('/')}`);
  say('executionMode: OFFLINE_TEST — global fetch is replaced by a recorder');
  say('');

  // A. Default behaviour: no opt-in, so the deterministic path runs untouched.
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ACE_LLM_LIVE_ENABLED;
  const plainFetch = recorder();
  const plain = await callDraft({ candidateId: 'CND-1' }, plainFetch);

  record('A1', 'a default draft returns 201 with no trace and no provider fields', () => {
    assert.strictEqual(plain.status, 201);
    assert.strictEqual(plain.payload.trace, null, 'no trace without opt-in');
    assert.ok(!('source' in plain.payload.project.script), 'script must not gain a provider source');
    assert.ok(!('trace' in plain.payload.project.script));
    assert.strictEqual(plain.payload.boundary.external_calls, 0);
    assert.strictEqual(plainFetch.calls.length, 0);
    return 'trace=null, external_calls=0';
  });

  // B. Opt-in with a key present but live execution not enabled.
  process.env.OPENROUTER_API_KEY = CANARY;
  const guardedFetch = recorder();
  const guarded = await callDraft(
    { candidateId: 'CND-1', scriptDraft: { useLlm: true } },
    guardedFetch
  );

  record('B1', 'opt-in without the live interlock refuses egress and falls back', () => {
    assert.strictEqual(guarded.status, 201);
    assert.strictEqual(guarded.payload.trace.source, 'TEMPLATE');
    assert.strictEqual(guarded.payload.trace.status, 'graceful_fallback');
    assert.strictEqual(guarded.payload.trace.fallbackReason, 'provider_disabled');
    assert.strictEqual(guarded.payload.trace.executionMode, 'OFFLINE_TEST');
    assert.strictEqual(guarded.payload.boundary.external_calls, 0);
    assert.strictEqual(guardedFetch.calls.length, 0, 'no request may leave the process');
    assert.ok(!JSON.stringify(guarded.payload).includes(CANARY), 'the key must not appear in the response');
    return 'source=TEMPLATE, fallbackReason=provider_disabled, 0 requests';
  });

  record('B2', 'the fallback draft still carries the deterministic script', () => {
    const script = guarded.payload.project.script;
    assert.strictEqual(script.language, 'th');
    assert.strictEqual(script.fallback_reason, 'provider_disabled');
    assert.strictEqual(script.source, 'TEMPLATE');
    assert.strictEqual(script.lines_source, 'TEMPLATE');
    assert.ok(script.text.length > 0, 'the deterministic text must still be usable');
    assert.strictEqual(script.checksum, require('node:crypto').createHash('sha256').update(script.text).digest('hex'));
    return `text=${script.text.length} chars, checksum consistent`;
  });

  // C. Live interlock enabled but no key: still no egress, honest refusal.
  process.env.ACE_LLM_LIVE_ENABLED = '1';
  delete process.env.OPENROUTER_API_KEY;
  const noKeyFetch = recorder();
  const noKey = await callDraft(
    { candidateId: 'CND-1', useLlm: true },
    noKeyFetch
  );

  record('C1', 'live mode without a key refuses before any request', () => {
    assert.strictEqual(noKey.payload.trace.source, 'TEMPLATE');
    assert.strictEqual(noKey.payload.trace.fallbackReason, 'missing_credential');
    assert.strictEqual(noKey.payload.trace.executionMode, 'LIVE');
    assert.strictEqual(noKey.payload.boundary.external_calls, 0);
    assert.strictEqual(noKeyFetch.calls.length, 0);
    return 'executionMode=LIVE, fallbackReason=missing_credential, 0 requests';
  });

  record('C2', 'the top-level useLlm flag is accepted as well as scriptDraft.useLlm', () => {
    assert.strictEqual(noKey.payload.trace.operation, 'script_draft.create');
    assert.ok(noKey.payload.trace.traceId, 'a trace id must be present');
    assert.match(noKey.payload.trace.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    return `traceId=${noKey.payload.trace.traceId.slice(0, 8)}…`;
  });

  // D. The state written by the route is a fixture state, not real data.
  record('D1', 'the route writes only fixture state', () => {
    const written = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    assert.strictEqual(written.kind, 'MVP_FIXTURE_STATE');
    assert.strictEqual(written.synthetic, true);
    assert.strictEqual(written.contentOrder.length, 3, 'three projects were created');
    for (const id of written.contentOrder) {
      assert.strictEqual(written.contents[id].synthetic, true);
      assert.strictEqual(written.contents[id].provenance.method, 'DETERMINISTIC_TEMPLATE_FROM_EXPORT');
    }
    return `contents=${written.contentOrder.length}, all synthetic`;
  });

  delete process.env.ACE_LLM_LIVE_ENABLED;
  delete process.env.OPENROUTER_API_KEY;

  const passed = results.filter((item) => item.ok).length;
  const failed = results.length - passed;
  say('');
  say(`checks: ${results.length}  passed: ${passed}  failed: ${failed}`);
  say('network calls made: 0');
  say('real API key used: no');

  if (failed > 0) {
    say('');
    for (const item of results.filter((r) => !r.ok)) say(`  - ${item.id} ${item.name}: ${item.note}`);
  }

  fs.writeFileSync(LOG_FILE, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\nlog: ${path.relative(REPO, LOG_FILE)}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('route check crashed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
