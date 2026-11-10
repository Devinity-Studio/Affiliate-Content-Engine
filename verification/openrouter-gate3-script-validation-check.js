'use strict';

/**
 * ACE — Gate 3 evidence-based Script Draft validation check (offline).
 *
 * Proves that a provider draft is checked against `offer_snapshot` and cannot
 * be accepted when it invents, conflicts with, or asserts something the
 * snapshot cannot support. No network, no key, no live evidence.
 *
 * Usage:
 *   node verification/openrouter-gate3-script-validation-check.js
 *
 * Exit codes:
 *   0  all checks passed
 *   1  at least one check failed
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const contentModule = require(path.join(REPO, 'app', 'mvp', 'content.js'));
const provider = require(path.join(REPO, 'app', 'mvp', 'provider', 'openrouter.js'));

const LOG_FILE = path.join(__dirname, 'openrouter-gate3-script-validation-2026-11-01.log');
const PRODUCT = 'กระเป๋าผ้าราคาประหยัด';

const lines = [];
const queue = [];
const results = [];

function say(text = '') {
  lines.push(text);
  console.log(text);
}

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
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function offerRecord(overrides = {}) {
  return {
    id: 'OFF-1',
    item_id: 'SKU-1',
    shop_id: 'SHOP-1',
    shop_name: 'ร้านทดสอบ',
    price_thb: 299,
    list_price_thb: 599,
    promo: { type: 'PERCENT', label: 'ลด 50%', depth_pct: 50 },
    reviews: { rating: 4.6, rating_count: 128 },
    shop: { rating: 4.7, related_shop_count: 3 },
    affiliate_link: 'https://example.invalid/aff',
    checked_at: '2026-10-21T00:00:00.000Z',
    synthetic: true,
    file_hash: 'fixture-hash',
    evidence_ids: ['PRICE', 'PROMO', 'REVIEWS', 'SHOP', 'CONVERSION', 'PRICE_POSITION', 'COMMISSION']
      .map((code) => `EV-SKU-1-${code}`),
    ...overrides,
  };
}

function projectInput(offerOverrides = {}) {
  const offer = offerRecord(offerOverrides);
  const product = {
    id: 'PRD-1',
    name: PRODUCT,
    category: 'Home',
    url: 'https://example.invalid/product',
  };
  const candidate = {
    id: 'CND-1',
    offer_id: offer.id,
    product_id: product.id,
    status: 'SAVED',
    source_ids: ['SRC-1'],
    evidence_ids: offer.evidence_ids,
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

function project(offerOverrides) {
  return contentModule.createContentProject(projectInput(offerOverrides));
}

function jsonResponse(status, payload) {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(payload) };
}

function completion(content) {
  return {
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  };
}

/** A draft whose every claim is backed by the fixture snapshot. */
const GROUNDED_TEXT = `วันนี้ขอเสนอ ${PRODUCT} ราคา 299 บาท จากปกติ 599 บาท `
  + 'คะแนนรีวิว 4.6 จาก 5 และมีโปรโมชันลด 50% คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน';

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

say('ACE — Gate 3 evidence-based script draft validation (offline)');
say(`node: ${process.version}`);
say('no network, no key, executionMode: OFFLINE_TEST');
say('');

// 1. Supported claims pass
check('01', 'claims fully supported by offer_snapshot pass', () => {
  const verdict = contentModule.validateScriptDraft(GROUNDED_TEXT, project());
  assert.strictEqual(verdict.ok, true, `unexpected rejections: ${verdict.failed.join(',')}`);
  assert.deepStrictEqual(verdict.findings, []);
  assert.strictEqual(verdict.failed.length, 0);
  return 'price, list price, rating, rating count, discount all matched';
});

check('01b', 'Thai digits in a claim are normalised before comparison', () => {
  const text = GROUNDED_TEXT.replace('299', '๒๙๙');
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, true, `Thai numerals should not fail: ${verdict.failed.join(',')}`);
  return '๒๙๙ accepted as 299';
});

// 2. Unsupported price claims fail
check('02', 'an invented price fails validation', () => {
  const text = GROUNDED_TEXT.replace('ราคา 299', 'ราคา 199');
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('conflicting_price'), `got ${verdict.failed.join(',')}`);
  const finding = verdict.findings.find((item) => item.code === 'conflicting_price');
  assert.strictEqual(finding.field, 'offer_snapshot.price_thb');
  assert.strictEqual(finding.expected, 299);
  assert.strictEqual(finding.claim, '199');
  return `field=${finding.field}, expected=${finding.expected}, claim=${finding.claim}`;
});

check('02b', 'an extra invented amount anywhere in the draft fails', () => {
  const text = `${GROUNDED_TEXT} และมีของรางวัลมูลค่า 1,299 บาท`;
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('unsupported_price'), `got ${verdict.failed.join(',')}`);
  return 'unsupported_price for 1,299';
});

// 3. Conflicting price claims fail (right number, wrong role)
check('03', 'the list price stated as the current price fails', () => {
  const text = GROUNDED_TEXT.replace('ราคา 299', 'ราคา 599');
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('conflicting_price'), `got ${verdict.failed.join(',')}`);
  const finding = verdict.findings.find((item) => item.code === 'conflicting_price');
  assert.strictEqual(finding.field, 'offer_snapshot.price_thb');
  assert.strictEqual(finding.expected, 299);
  return '599 rejected in the current-price slot';
});

check('03b', 'the current price stated as the original price fails', () => {
  const text = GROUNDED_TEXT.replace('จากปกติ 599', 'จากปกติ 299');
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, false);
  const finding = verdict.findings.find((item) => item.code === 'conflicting_price');
  assert.ok(finding, `got ${verdict.failed.join(',')}`);
  assert.strictEqual(finding.field, 'offer_snapshot.list_price_thb');
  return '299 rejected in the list-price slot';
});

// 4. Unsupported discount / commission claims
check('04', 'a discount the snapshot does not support fails', () => {
  const text = GROUNDED_TEXT.replace('ลด 50%', 'ลด 70%');
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('unsupported_discount'), `got ${verdict.failed.join(',')}`);
  const finding = verdict.findings.find((item) => item.code === 'unsupported_discount');
  assert.strictEqual(finding.field, 'offer_snapshot.promo.depth_pct');
  assert.strictEqual(finding.expected, 50);
  return '70% rejected against promo.depth_pct=50';
});

check('04b', 'a commission claim fails because the snapshot carries no commission', () => {
  const text = `${GROUNDED_TEXT} และคุณจะได้รับค่าคอมมิชชันจากการแนะนำ`;
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, false);
  assert.ok(
    verdict.failed.includes('unsupported_claim:commission'),
    `got ${verdict.failed.join(',')}`
  );
  return 'unsupported_claim:commission';
});

check('04c', 'a discount stated with no promotion in the snapshot fails', () => {
  const noPromo = project({ promo: { type: 'NONE', label: 'ไม่มีโปรโมชัน', depth_pct: 0 } });
  const text = GROUNDED_TEXT.replace('ลด 50%', 'ลด 10%');
  const verdict = contentModule.validateScriptDraft(text, noPromo);
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('unsupported_discount'), `got ${verdict.failed.join(',')}`);
  return 'depth_pct=0 → 10% rejected';
});

// 5. Unsupported numeric claims
check('05', 'an invented review count fails', () => {
  const text = GROUNDED_TEXT.replace('4.6 จาก 5', '4.6 จาก 5 และมีรีวิว 500 รายการ');
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('unsupported_number'), `got ${verdict.failed.join(',')}`);
  const finding = verdict.findings.find((item) => item.code === 'unsupported_number');
  assert.strictEqual(finding.claim, '500');
  return '500 rejected against rating_count=128';
});

check('05b', 'invented quantities, durations and shipping promises fail', () => {
  const cases = [
    ['และมีสินค้าคงเหลือ 3 ชิ้น', 'unsupported_claim:stock'],
    ['และจัดส่งฟรีทุกออเดอร์', 'unsupported_claim:shipping'],
    ['และรับประกันนานา 2 ปี', 'unsupported_claim:guarantee'],
  ];
  const seen = [];
  for (const [suffix, expected] of cases) {
    const verdict = contentModule.validateScriptDraft(`${GROUNDED_TEXT} ${suffix}`, project());
    assert.strictEqual(verdict.ok, false, `should reject: ${suffix}`);
    assert.ok(verdict.failed.includes(expected), `${suffix} → ${verdict.failed.join(',')}`);
    seen.push(expected);
  }
  return seen.join(', ');
});

check('05c', 'a personal-experience claim fails because ACE has no such evidence', () => {
  const text = `${GROUNDED_TEXT} ฉันทดลองใช้เองแล้ว`;
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('unsupported_claim:personal_experience'), `got ${verdict.failed.join(',')}`);
  return 'unsupported_claim:personal_experience';
});

check('05d', 'an unsupported date fails', () => {
  const text = `${GROUNDED_TEXT} โปรโมชันนี้ถึงวันที่ 2027-01-15`;
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('unsupported_date'), `got ${verdict.failed.join(',')}`);
  return 'unsupported_date';
});

// 6. Missing snapshot fields do not permit invented claims
check('06', 'a snapshot with no price does not permit any price claim', () => {
  const snapshot = {
    item_id: 'SKU-1',
    shop_id: 'SHOP-1',
    product_name: PRODUCT,
    shop_name: 'ร้านทดสอบ',
    price_thb: null,
    list_price_thb: null,
    promo: {},
    rating: 4.6,
    rating_count: 128,
    checked_at: '2026-10-21T00:00:00.000Z',
  };
  const verdict = contentModule.validateScriptDraft(`${PRODUCT} ราคา 299 บาท`, snapshot);
  assert.strictEqual(verdict.ok, false, 'an absent price must not accept a price claim');
  const priceFinding = verdict.findings.find((item) => item.code === 'unsupported_price' || item.code === 'conflicting_price');
  assert.ok(priceFinding, `got ${verdict.failed.join(',')}`);
  assert.strictEqual(priceFinding.expected, 'absent');
  return 'missing price → claim rejected as absent';
});

check('06b', 'no snapshot at all is rejected rather than passed', () => {
  const verdict = contentModule.validateScriptDraft(GROUNDED_TEXT, undefined);
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('missing_snapshot_evidence'), `got ${verdict.failed.join(',')}`);
  return 'missing_snapshot_evidence';
});

check('06c', 'a generic draft that never names the product is rejected', () => {
  const verdict = contentModule.validateScriptDraft(
    'สินค้าชิ้นนี้ราคา 299 บาท จากปกติ 599 บาท คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน',
    project()
  );
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.failed.includes('missing_product_identity'), `got ${verdict.failed.join(',')}`);
  return 'missing_product_identity';
});

// 7. Creative text without unsupported claims stays eligible
check('07', 'creative copy with no unsupported claim remains eligible', () => {
  const text = `${PRODUCT} — ตัวเลือกที่คุ้มค่าที่สุดในงบประมาณนี้ `
    + 'ก่อนตัดสินใจ ลองเช็กราคา 299 บาท และคะแนนรีวิว 4.6 จาก 5 ในลิงก์ด้านล่างนี้ก่อน';
  const verdict = contentModule.validateScriptDraft(text, project());
  assert.strictEqual(verdict.ok, true, `creative copy should pass: ${verdict.failed.join(',')}`);
  return 'tone and storytelling preserved';
});

// 8. An invalid draft cannot be accepted as a successful provider result
check('08', 'a fabricated draft cannot become an accepted LIVE_LLM result', async () => {
  const stub = async () => jsonResponse(200, completion(`${PRODUCT} ราคา 199 บาท จากปกติ 1,999 บาท ลด 90%`));
  const draft = await contentModule.createScriptDraftWithProvider({
    projectInput: projectInput(),
    traceId: 'trace-validation-reject-0001',
    fetchImpl: stub,
    env: { OPENROUTER_API_KEY: 'sk-or-v1-validation-canary' },
    executionMode: 'OFFLINE_TEST',
    allowNetwork: false,
  });

  assert.notStrictEqual(draft.trace.source, 'LIVE_LLM');
  assert.strictEqual(draft.trace.source, 'TEMPLATE');
  assert.strictEqual(draft.trace.status, 'graceful_fallback');
  assert.strictEqual(draft.trace.fallbackReason, 'validation_failed');
  assert.strictEqual(draft.trace.validation.ok, false);
  assert.ok(draft.trace.validation.failed.includes('conflicting_price'), `got ${draft.trace.validation.failed.join(',')}`);

  const deterministic = contentModule.createContentProject(projectInput());
  assert.strictEqual(draft.project.script.text, deterministic.script.text, 'the fabricated text must not be kept');
  assert.notStrictEqual(draft.project.script.text, '199');
  assert.ok(!draft.project.script.text.includes('199 บาท'), 'fabricated price must not survive');
  return `validation.failed=[${draft.trace.validation.failed.join(',')}]`;
});

// 9. Fallback provenance stays correct
check('09', 'fallback provenance is TEMPLATE regardless of the provider success', async () => {
  const stub = async () => jsonResponse(200, completion('ข้อความสั้น'));
  const draft = await contentModule.createScriptDraftWithProvider({
    projectInput: projectInput(),
    traceId: 'trace-validation-short-0001',
    fetchImpl: stub,
    env: { OPENROUTER_API_KEY: 'sk-or-v1-validation-canary' },
    executionMode: 'OFFLINE_TEST',
    allowNetwork: false,
  });
  assert.strictEqual(draft.trace.source, 'TEMPLATE');
  assert.strictEqual(draft.project.script.source, 'TEMPLATE');
  assert.strictEqual(draft.project.script.fallback_reason, 'validation_failed');
  assert.strictEqual(draft.project.script.lines_source, 'TEMPLATE');
  return 'source=TEMPLATE, fallback_reason=validation_failed';
});

// 10. Safety interlock unchanged: default OFF, no egress
check('10', 'the safety interlock still defaults OFF and blocks real egress', async () => {
  assert.notStrictEqual(process.env.ACE_LLM_LIVE_ENABLED, '1', 'the interlock must not be set in the test environment');

  const calls = [];
  const recorder = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(200, completion(GROUNDED_TEXT));
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = recorder;
  try {
    const result = await provider.generateScriptDraft({
      prompt: 'ทดสอบ',
      env: { OPENROUTER_API_KEY: 'sk-or-v1-validation-canary' },
    });
    assert.strictEqual(result.status, 'provider_disabled');
    assert.strictEqual(result.networkAttempted, false);
    assert.strictEqual(calls.length, 0, 'no request may leave the process');

    const live = await provider.generateScriptDraft({
      prompt: 'ทดสอบ',
      allowNetwork: false,
      env: { OPENROUTER_API_KEY: 'sk-or-v1-validation-canary' },
    });
    assert.strictEqual(live.status, 'provider_disabled');
    assert.strictEqual(calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
  return 'ACE_LLM_LIVE_ENABLED unset → provider_disabled, 0 requests';
});

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

async function summarise() {
  const passed = results.filter((item) => item.ok).length;
  const failed = results.length - passed;

  say('');
  say(`checks: ${results.length}  passed: ${passed}  failed: ${failed}`);
  say('network calls made: 0');
  say('real API key used: no');
  say('safety interlock: default OFF, unchanged');

  if (failed > 0) {
    say('');
    for (const item of results.filter((r) => !r.ok)) say(`  - ${item.id} ${item.name}: ${item.note}`);
  }

  fs.writeFileSync(LOG_FILE, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\nlog: ${path.relative(REPO, LOG_FILE)}`);
  process.exit(failed > 0 ? 1 : 0);
}

runChecks().then(summarise).catch((error) => {
  console.error('validation check crashed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
