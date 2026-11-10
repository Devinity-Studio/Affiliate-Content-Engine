'use strict';

/**
 * ACE — OpenRouter Gate 3 offline verification.
 *
 * Proves the provider seam, the provenance matrix, the deterministic fallback,
 * and secret hygiene WITHOUT network access and WITHOUT an OpenRouter key.
 * Every provider interaction goes through an injected `fetchImpl`; nothing here
 * can reach the internet, and nothing here is evidence of a live call.
 *
 * Usage:
 *   node verification/openrouter-gate3-offline-check.js
 *
 * Exit codes:
 *   0  all offline checks passed
 *   1  at least one check failed
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const contentModule = require(path.join(REPO, 'app', 'mvp', 'content.js'));
const provider = require(path.join(REPO, 'app', 'mvp', 'provider', 'openrouter.js'));
const provenance = require(path.join(REPO, 'app', 'mvp', 'provider', 'provenance.js'));

const LOG_FILE = path.join(__dirname, 'openrouter-gate3-offline-2026-11-01.log');
const CANARY = 'sk-or-v1-CANARY-DO-NOT-LEAK-0000';

const results = [];
const lines = [];
const queue = [];

function say(text = '') {
  lines.push(text);
  console.log(text);
}

// Checks are queued and run in order so async ones are actually awaited.
function check(id, name, fn) {
  queue.push({ id, name, fn });
}

async function runChecks() {
  for (const item of queue) {
    try {
      const note = await item.fn();
      results.push({ id: item.id, name: item.name, ok: true, note: note || '' });
      say(`ok   ${item.id}  ${item.name}${note ? ` — ${note}` : ''}`);
    } catch (error) {
      results.push({ id: item.id, name: item.name, ok: false, note: error && error.message ? error.message : String(error) });
      say(`FAIL ${item.id}  ${item.name}\n     ${error && error.message ? error.message : error}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures — synthetic records only, no Shopee or user data           */
/* ------------------------------------------------------------------ */

function fixtureProjectInput() {
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
  return {
    state: { contents: {} },
    candidate,
    offer,
    product,
    plan: null,
    approachKey: 'problem_first',
    custom: null,
    dataAsOf: '2026-10-21',
  };
}

function deterministicProject() {
  return contentModule.createContentProject(fixtureProjectInput());
}

const THAI_OK_TEXT = 'วันนี้ขอเสนอ กระเป๋าผ้าราคาประหยัด ราคา 299 บาท จากปกติ 599 บาท '
  + 'คะแนนรีวิว 4.6 จาก 5 และมีโปรโมชันลด 50% คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน';

/* ------------------------------------------------------------------ */
/* Injected fetch doubles                                              */
/* ------------------------------------------------------------------ */

function jsonResponse(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(payload),
  };
}

function textResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, text: async () => body };
}

function completion(content, usage) {
  return {
    id: 'gen-test',
    model: provider.DEFAULT_MODEL,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    ...(usage ? { usage } : {}),
  };
}

function recordingFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  impl.calls = calls;
  return impl;
}

const liveEnv = () => ({ OPENROUTER_API_KEY: CANARY });

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

say('ACE — OpenRouter Gate 3 offline verification');
say(`repo: ${REPO}`);
say(`node: ${process.version}`);
say(`executionMode: OFFLINE_TEST — no network, no real key, no live evidence`);
say('');

// 1. Missing API key
check('01', 'missing API key is a normal refusal, not a network attempt', async () => {
  const fetchImpl = recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT)));
  const result = await provider.generateScriptDraft({
    prompt: 'ทดสอบ',
    allowNetwork: true,
    fetchImpl,
    env: {},
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 'missing_credential');
  assert.strictEqual(fetchImpl.calls.length, 0, 'no request may be made without a key');
  assert.strictEqual(result.networkAttempted, false);
  return 'status=missing_credential, fetch calls=0';
});

// 2. Invalid or malformed configuration
check('02', 'malformed configuration is rejected before any request', async () => {
  const fetchImpl = recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT)));

  const emptyKey = await provider.generateScriptDraft({
    prompt: 'ทดสอบ', allowNetwork: true, fetchImpl, env: { OPENROUTER_API_KEY: '   ' },
  });
  assert.strictEqual(emptyKey.status, 'missing_credential');

  const badModel = await provider.generateScriptDraft({
    prompt: 'ทดสอบ', model: 'not a model slug', allowNetwork: true, fetchImpl, env: liveEnv(),
  });
  assert.strictEqual(badModel.status, 'invalid_configuration');

  const badTimeout = await provider.generateScriptDraft({
    prompt: 'ทดสอบ', timeoutMs: -5, allowNetwork: true, fetchImpl, env: liveEnv(),
  });
  assert.strictEqual(badTimeout.status, 'invalid_configuration');

  const emptyPrompt = await provider.generateScriptDraft({
    prompt: '', allowNetwork: true, fetchImpl, env: liveEnv(),
  });
  assert.strictEqual(emptyPrompt.status, 'invalid_configuration');

  assert.strictEqual(fetchImpl.calls.length, 0, 'malformed configuration must not send a request');
  return '4 configuration refusals, 0 requests';
});

check('02b', 'Gate 3 interlock blocks real egress even with a key present', async () => {
  // No injected fetch: the module would fall through to the real global fetch.
  // Temporarily replace it with a recorder so a broken guard cannot reach the
  // network during verification.
  const recorder = recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT)));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recorder;
  try {
    const result = await provider.generateScriptDraft({ prompt: 'ทดสอบ', env: liveEnv() });
    assert.strictEqual(result.status, 'provider_disabled');
    assert.strictEqual(result.networkAttempted, false);
    assert.strictEqual(recorder.calls.length, 0, 'no request may leave without allowNetwork');

    const explicit = await provider.generateScriptDraft({
      prompt: 'ทดสอบ', allowNetwork: false, env: liveEnv(),
    });
    assert.strictEqual(explicit.status, 'provider_disabled');
    assert.strictEqual(recorder.calls.length, 0);
    return 'allowNetwork unset/false → provider_disabled, 0 requests';
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// 3. Provider error responses
check('03', 'provider error responses are classified without echoing the body', async () => {
  const cases = [
    [401, 'auth_error'],
    [403, 'auth_error'],
    [429, 'rate_limited'],
    [500, 'provider_error'],
    [502, 'provider_error'],
  ];
  const observed = [];
  for (const [status, expected] of cases) {
    const fetchImpl = recordingFetch(() => textResponse(status, `{"error":"leak ${CANARY}"}`));
    const result = await provider.generateScriptDraft({
      prompt: 'ทดสอบ', allowNetwork: true, fetchImpl, env: liveEnv(),
    });
    assert.strictEqual(result.status, expected, `HTTP ${status} should classify as ${expected}`);
    assert.strictEqual(result.httpStatus, status);
    assert.ok(!JSON.stringify(result).includes(CANARY), `HTTP ${status} result must not echo the body`);
    observed.push(`${status}->${expected}`);
  }
  return observed.join(', ');
});

// 4. Timeout
check('04', 'a hanging provider hits the timeout and does not hang the caller', async () => {
  const hangingFetch = () => new Promise(() => {});
  const started = Date.now();
  const result = await provider.generateScriptDraft({
    prompt: 'ทดสอบ', timeoutMs: 60, allowNetwork: true, fetchImpl: hangingFetch, env: liveEnv(),
  });
  const elapsed = Date.now() - started;
  assert.strictEqual(result.status, 'timeout');
  assert.ok(elapsed < 3000, `timeout should return promptly (took ${elapsed}ms)`);
  return `status=timeout in ${elapsed}ms`;
});

check('04b', 'a network failure is classified as network_error', async () => {
  const throwingFetch = async () => { throw new Error(`boom ${CANARY}`); };
  const result = await provider.generateScriptDraft({
    prompt: 'ทดสอบ', allowNetwork: true, fetchImpl: throwingFetch, env: liveEnv(),
  });
  assert.strictEqual(result.status, 'network_error');
  assert.ok(!JSON.stringify(result).includes(CANARY), 'thrown error message must not be echoed');
  return 'status=network_error';
});

// 5. Malformed response
check('05', 'a non-JSON body is invalid_response', async () => {
  const fetchImpl = recordingFetch(() => textResponse(200, '<html>not json</html>'));
  const result = await provider.generateScriptDraft({
    prompt: 'ทดสอบ', allowNetwork: true, fetchImpl, env: liveEnv(),
  });
  assert.strictEqual(result.status, 'invalid_response');
  return 'status=invalid_response';
});

// 6. Empty output
check('06', 'an empty completion is empty_response', async () => {
  const bodies = [
    completion(''),
    completion('   \n  '),
    { choices: [] },
    { choices: [{ index: 0, message: { role: 'assistant' } }] },
  ];
  for (const payload of bodies) {
    const fetchImpl = recordingFetch(() => jsonResponse(200, payload));
    const result = await provider.generateScriptDraft({
      prompt: 'ทดสอบ', allowNetwork: true, fetchImpl, env: liveEnv(),
    });
    assert.strictEqual(result.status, 'empty_response');
  }
  return `${bodies.length} empty shapes -> empty_response`;
});

// 7. Validation failure
check('07', 'a non-Thai draft fails ACE validation and falls back to TEMPLATE', async () => {
  const fetchImpl = recordingFetch(() => jsonResponse(200, completion(
    'Buy this bag today because the price is great and the reviews are good. Click the link below now.'
  )));
  const draft = await contentModule.createScriptDraftWithProvider({
    projectInput: fixtureProjectInput(),
    traceId: 'trace-validation-0001',
    fetchImpl,
    env: liveEnv(),
    executionMode: 'OFFLINE_TEST',
    allowNetwork: false,
  });
  assert.strictEqual(draft.trace.source, 'TEMPLATE');
  assert.strictEqual(draft.trace.status, 'graceful_fallback');
  assert.strictEqual(draft.trace.fallbackReason, 'validation_failed');
  assert.strictEqual(draft.trace.validation.ok, false);
  assert.ok(draft.trace.validation.failed.includes('not_thai'), 'not_thai must be recorded');

  const expected = deterministicProject();
  assert.strictEqual(draft.project.script.text, expected.script.text, 'fallback keeps deterministic text');
  assert.strictEqual(draft.project.script.checksum, expected.script.checksum, 'fallback keeps deterministic checksum');
  return `validation.failed=[${draft.trace.validation.failed.join(',')}]`;
});

check('07b', 'placeholder and markup leaks are rejected by validation', () => {
  const project = deterministicProject();
  const bad = [
    'สวัสดีค่ะ {{product_name}} ราคา 299 บาท คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน',
    'สวัสดีค่ะ [insert price here] ราคา 299 บาท คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน',
    'สวัสดีค่ะ <b>ราคา 299 บาท</b> คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน',
    'สั้น',
  ];
  const observed = [];
  for (const text of bad) {
    const verdict = contentModule.validateScriptDraft(text, project);
    assert.strictEqual(verdict.ok, false, `should reject: ${text}`);
    observed.push(verdict.failed.join('+'));
  }
  const good = contentModule.validateScriptDraft(THAI_OK_TEXT, project);
  assert.strictEqual(good.ok, true, `a clean Thai draft must pass — failed: ${good.failed.join(',')}`);
  return `${observed.join(' | ')}`;
});

// 8. Explicit deterministic fallback
check('08', 'explicit provider failure produces TEMPLATE + graceful_fallback', async () => {
  const fetchImpl = recordingFetch(() => textResponse(500, 'server exploded'));
  const draft = await contentModule.createScriptDraftWithProvider({
    projectInput: fixtureProjectInput(),
    traceId: 'trace-fallback-0001',
    fetchImpl,
    env: liveEnv(),
    executionMode: 'OFFLINE_TEST',
    allowNetwork: false,
  });
  assert.strictEqual(draft.trace.source, 'TEMPLATE');
  assert.strictEqual(draft.trace.status, 'graceful_fallback');
  assert.strictEqual(draft.trace.fallbackReason, 'provider_error');
  assert.notStrictEqual(draft.trace.source, 'LIVE_LLM');

  const expected = deterministicProject();
  assert.strictEqual(draft.project.script.text, expected.script.text);
  assert.strictEqual(draft.project.script.checksum, expected.script.checksum);
  assert.strictEqual(draft.project.script.fallback_reason, 'provider_error');
  return 'source=TEMPLATE, status=graceful_fallback, deterministic text intact';
});

check('08b', 'missing key through the content operation also falls back honestly', async () => {
  const draft = await contentModule.createScriptDraftWithProvider({
    projectInput: fixtureProjectInput(),
    traceId: 'trace-nokey-0001',
    env: {},
    executionMode: 'LIVE',
    allowNetwork: true,
    fetchImpl: () => { throw new Error('must not be called'); },
  });
  assert.strictEqual(draft.trace.source, 'TEMPLATE');
  assert.strictEqual(draft.trace.fallbackReason, 'missing_credential');
  assert.strictEqual(draft.trace.executionMode, 'LIVE');
  return 'source=TEMPLATE, fallbackReason=missing_credential, executionMode=LIVE';
});

// 9. Mock provenance
check('09', 'a stubbed provider success is MOCK, never LIVE_LLM', async () => {
  const fetchImpl = recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT, {
    prompt_tokens: 120, completion_tokens: 40,
  })));
  const draft = await contentModule.createScriptDraftWithProvider({
    projectInput: fixtureProjectInput(),
    traceId: 'trace-mock-0001',
    fetchImpl,
    env: liveEnv(),
    executionMode: 'OFFLINE_TEST',
    allowNetwork: false,
  });
  assert.strictEqual(draft.trace.source, 'MOCK');
  assert.strictEqual(draft.trace.status, 'success');
  assert.strictEqual(draft.trace.executionMode, 'OFFLINE_TEST');
  assert.notStrictEqual(draft.trace.source, 'LIVE_LLM');
  assert.strictEqual(draft.project.script.source, 'MOCK');
  assert.strictEqual(draft.project.script.text, THAI_OK_TEXT);
  assert.strictEqual(
    draft.project.script.checksum,
    crypto.createHash('sha256').update(THAI_OK_TEXT).digest('hex'),
    'accepted text checksum must be recomputed'
  );
  assert.strictEqual(draft.project.script.lines_source, 'TEMPLATE', 'scene lines stay deterministic');
  return 'source=MOCK, executionMode=OFFLINE_TEST, checksum recomputed';
});

check('09b', 'provenance refuses to record LIVE_LLM in an offline test', () => {
  assert.throws(() => provenance.buildTraceRecord({
    traceId: 't', timestamp: new Date().toISOString(), operation: 'script_draft.create',
    provider: 'openrouter', model: provider.DEFAULT_MODEL,
    source: 'LIVE_LLM', status: 'success', executionMode: 'OFFLINE_TEST',
  }), /not allowed with executionMode/);

  assert.throws(() => provenance.buildTraceRecord({
    traceId: 't', timestamp: new Date().toISOString(), operation: 'script_draft.create',
    provider: 'openrouter', model: provider.DEFAULT_MODEL,
    source: 'MOCK', status: 'success', executionMode: 'LIVE',
  }), /not allowed with executionMode/);

  assert.throws(() => provenance.buildTraceRecord({
    traceId: 't', timestamp: new Date().toISOString(), operation: 'script_draft.create',
    provider: 'openrouter', model: provider.DEFAULT_MODEL,
    source: 'TEMPLATE', status: 'success', executionMode: 'OFFLINE_TEST',
  }), /cannot carry status/);

  assert.throws(() => provenance.buildTraceRecord({
    traceId: 't', timestamp: new Date().toISOString(), operation: 'script_draft.create',
    source: 'TEMPLATE', status: 'graceful_fallback', executionMode: 'LIVE',
  }), /requires a fallbackReason/);
  return '4 impossible combinations rejected';
});

check('09c', 'provenance rejects fields outside the allowlist', () => {
  assert.throws(() => provenance.buildTraceRecord({
    traceId: 't', timestamp: new Date().toISOString(), operation: 'script_draft.create',
    source: 'TEMPLATE', status: 'template_default', executionMode: 'LIVE',
    requestBody: '{"prompt":"..."}',
  }), /not an allowed trace field/);

  assert.throws(() => provenance.buildTraceRecord({
    traceId: 't', timestamp: new Date().toISOString(), operation: 'script_draft.create',
    source: 'TEMPLATE', status: 'template_default', executionMode: 'LIVE',
    usage: { inputTokens: 1, totalTokens: 2 },
  }), /usage.totalTokens is not allowed/);
  return 'raw payload field and unknown usage field rejected';
});

// 10. Trace schema consistency
check('10', 'one trace schema for mock success, template default, and fallback', () => {
  const base = {
    traceId: 'trace-schema-0001',
    timestamp: '2026-11-01T00:00:00.000Z',
    operation: 'script_draft.create',
    provider: 'openrouter',
    model: provider.DEFAULT_MODEL,
  };
  const mock = provenance.mockTrace({ ...base, usage: { inputTokens: 10, outputTokens: 20 }, validation: { ok: true, failed: [] } });
  const templateDefault = provenance.templateTrace({ ...base, provider: undefined, model: undefined, executionMode: 'LIVE' });
  const fallback = provenance.fallbackTrace({ ...base, executionMode: 'OFFLINE_TEST', fallbackReason: 'timeout' });

  const allowed = new Set(provenance.TRACE_FIELDS);
  for (const record of [mock, templateDefault, fallback]) {
    for (const key of Object.keys(record)) {
      assert.ok(allowed.has(key), `${key} is outside the allowlist`);
    }
    for (const required of ['traceId', 'timestamp', 'operation', 'provider', 'model', 'source', 'status', 'executionMode']) {
      assert.ok(Object.prototype.hasOwnProperty.call(record, required), `${required} must always be present`);
    }
  }

  // usage is omitted when unreported, never zero-filled
  assert.deepStrictEqual(mock.usage, { inputTokens: 10, outputTokens: 20 });
  assert.ok(!('usage' in fallback), 'an unreported usage must be absent');
  assert.strictEqual(mock.provider, 'openrouter');
  assert.strictEqual(templateDefault.provider, null, 'template records carry no provider claim');
  assert.strictEqual(templateDefault.source, 'TEMPLATE');
  return `fields=${Object.keys(mock).length}/${provenance.TRACE_FIELDS.length}, usage absent when unreported`;
});

check('10b', 'provider reports usage only when the provider sent it', async () => {
  const withUsage = recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT, {
    prompt_tokens: 77, completion_tokens: 33,
  })));
  const a = await provider.generateScriptDraft({ prompt: 'ทดสอบ', allowNetwork: true, fetchImpl: withUsage, env: liveEnv() });
  assert.deepStrictEqual(a.usage, { inputTokens: 77, outputTokens: 33 });

  const withoutUsage = recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT)));
  const b = await provider.generateScriptDraft({ prompt: 'ทดสอบ', allowNetwork: true, fetchImpl: withoutUsage, env: liveEnv() });
  assert.strictEqual(b.usage, null, 'absent usage must stay null, not become zero');
  return 'usage present=77/33, absent=null';
});

// 11. Secret redaction
check('11', 'the key never appears in any result, trace, or log line', async () => {
  const surfaces = [];

  const scenarios = [
    recordingFetch(() => textResponse(401, `{"error":"invalid key ${CANARY}"}`)),
    recordingFetch(() => textResponse(500, `{"error":"boom ${CANARY}"}`)),
    async () => { throw new Error(`network said ${CANARY}`); },
    recordingFetch(() => textResponse(200, `<html>${CANARY}</html>`)),
    recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT, { prompt_tokens: 1, completion_tokens: 2 }))),
  ];

  for (const fetchImpl of scenarios) {
    const result = await provider.generateScriptDraft({
      prompt: 'ทดสอบ', allowNetwork: true, fetchImpl, env: liveEnv(),
    });
    surfaces.push(JSON.stringify(result));
    if (result.ok) {
      const draft = await contentModule.createScriptDraftWithProvider({
        projectInput: fixtureProjectInput(),
        fetchImpl: recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT))),
        env: liveEnv(),
      });
      surfaces.push(JSON.stringify(draft.trace));
      surfaces.push(provider.describeTraceForLog(draft.trace));
    }
  }

  const fallbackDraft = await contentModule.createScriptDraftWithProvider({
    projectInput: fixtureProjectInput(),
    env: liveEnv(),
    executionMode: 'OFFLINE_TEST',
    allowNetwork: false,
  });
  surfaces.push(JSON.stringify(fallbackDraft.trace));
  surfaces.push(provider.describeTraceForLog(fallbackDraft.trace));

  for (const surface of surfaces) {
    assert.ok(!surface.includes(CANARY), 'a credential value appeared in an output surface');
    assert.ok(!/authorization/i.test(surface), 'an authorization header appeared in an output surface');
  }

  // The header is used for the request, and only there.
  const sent = recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT)));
  await provider.generateScriptDraft({ prompt: 'ทดสอบ', allowNetwork: true, fetchImpl: sent, env: liveEnv() });
  assert.strictEqual(sent.calls.length, 1);
  assert.strictEqual(sent.calls[0].init.headers.Authorization, `Bearer ${CANARY}`);

  // No console output of a key anywhere in the provider source.
  const source = fs.readFileSync(path.join(REPO, 'app', 'mvp', 'provider', 'openrouter.js'), 'utf8');
  assert.ok(!/console\.(log|warn|error|debug)/.test(source), 'the provider module must not log');
  return `${surfaces.length} output surfaces checked, header sent exactly once`;
});

check('11b', 'the request body carries the model and prompt, never the key', async () => {
  const sent = recordingFetch(() => jsonResponse(200, completion(THAI_OK_TEXT)));
  await provider.generateScriptDraft({
    prompt: 'ทดสอบ prompt ภาษาไทย', allowNetwork: true, fetchImpl: sent, env: liveEnv(),
  });
  const body = JSON.parse(sent.calls[0].init.body);
  assert.strictEqual(body.model, provider.DEFAULT_MODEL);
  assert.strictEqual(body.stream, false);
  assert.ok(Array.isArray(body.messages) && body.messages.length === 2);
  assert.ok(!JSON.stringify(body).includes(CANARY), 'the key must not be in the body');
  assert.strictEqual(sent.calls[0].url, provider.ENDPOINT);
  return `url=${provider.ENDPOINT}, model=${body.model}`;
});

// 12. Default deterministic behaviour unchanged
check('12', 'createContentProject is untouched: no provider fields, stable checksum', () => {
  const a = deterministicProject();
  const b = deterministicProject();

  assert.deepStrictEqual(a.script, b.script, 'deterministic script must be stable');
  assert.ok(!('source' in a.script), 'deterministic script must not gain a provenance source');
  assert.ok(!('trace' in a.script), 'deterministic script must not gain a trace');
  assert.ok(!('lines_source' in a.script), 'deterministic script must not gain provider fields');
  assert.strictEqual(a.script.language, 'th');

  const joined = a.script.lines.map((line) => line.voiceover).join(' ');
  assert.strictEqual(a.script.text, joined, 'text is still the joined scene voiceovers');
  assert.strictEqual(a.script.checksum, crypto.createHash('sha256').update(joined).digest('hex'));
  assert.strictEqual(a.provenance.method, 'DETERMINISTIC_TEMPLATE_FROM_EXPORT');
  return `script keys=${Object.keys(a.script).join(',')}`;
});

check('12b', 'the opt-in path composes with the deterministic builder without mutating it', async () => {
  const before = deterministicProject();
  await contentModule.createScriptDraftWithProvider({
    projectInput: fixtureProjectInput(),
    env: {},
    executionMode: 'OFFLINE_TEST',
    allowNetwork: false,
  });
  const after = deterministicProject();
  assert.deepStrictEqual(before.script, after.script, 'a provider run must not change the deterministic result');
  assert.strictEqual(after.provenance.method, 'DETERMINISTIC_TEMPLATE_FROM_EXPORT');
  return 'deterministic output identical after a provider attempt';
});

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

async function summarise() {
  const passed = results.filter((item) => item.ok).length;
  const failed = results.length - passed;

  say('');
  say(`checks: ${results.length}  passed: ${passed}  failed: ${failed}`);
  say('network calls made to OpenRouter: 0');
  say('real API key used: no');
  say(`executionMode: OFFLINE_TEST`);

  if (failed > 0) {
    say('');
    say('failed checks:');
    for (const item of results.filter((r) => !r.ok)) say(`  - ${item.id} ${item.name}: ${item.note}`);
  }

  if (results.some((r) => r.note && r.note.includes(CANARY))) {
    say('');
    say('SECRET LEAK DETECTED IN CHECK OUTPUT');
  }

  try {
    fs.writeFileSync(LOG_FILE, `${lines.join('\n')}\n`, 'utf8');
    console.log(`\nlog: ${path.relative(REPO, LOG_FILE)}`);
  } catch (error) {
    console.error('could not write log file:', error.message);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runChecks().then(summarise).catch((error) => {
  console.error('offline check crashed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
