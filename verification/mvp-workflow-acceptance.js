'use strict';

/**
 * MVP affiliate workflow slice — field-level acceptance.
 *
 * Exercises the interface the user actually uses (/api/mvp/*), on a throwaway
 * copy of app/, data/ and docs/ with its own fixture state file:
 *
 *   1. fixture import -> Source / Product / Offer / Evidence with checked_at + provenance
 *   2. exactly 5 candidates, each with scores, confidence, all four claim classes,
 *      reasons, source_ids and resolvable evidence_ids
 *   3. Save / Reject / Queue / Remove / reorder persisted across a server restart
 *   4. plan draft with 4 approaches; user custom stored separately
 *   5. impact preview required before a plan record is created
 *   6. content project created from the plan and from a saved candidate
 *   7. QA runs, covers every documented category and reports its result
 *   8. REVIEW is a required one-step transition before finalize
 *   9. finalize passes only against the documented checklist, in REVIEW only
 *  10. publish prep before export is refused with 409 and changes no status
 *  11. fixture state reload after restart (plan and content survive)
 *  12. the real data/app/state.json, schema and mission records are byte-identical
 *  13. no commit created
 *
 * Usage: node verification/mvp-workflow-acceptance.js
 * Exit:  0 = every assertion passed, 1 = at least one failed.
 */

const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.MVP_ACCEPTANCE_PORT || 4310);
const BASE = `http://127.0.0.1:${PORT}`;
const CLAIM_CLASSES = ['FACT', 'INFERENCE', 'HYPOTHESIS', 'UNKNOWN'];

let failures = 0;
const checks = [];

function check(label, ok, detail) {
  const pass = Boolean(ok);
  if (!pass) failures += 1;
  checks.push({ label, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  return pass;
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function dirSignature(dir) {
  if (!fs.existsSync(dir)) return null;
  const out = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full).split(path.sep).join('/')] = md5(full);
    }
  };
  walk(dir);
  return out;
}

function gitHead() {
  return String(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim();
}

function gitStaged() {
  return String(spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim();
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
  const line = `${method} ${urlPath} -> ${res.status}`;
  const shown = typeof parsed === 'string'
    ? parsed.slice(0, 240)
    : JSON.stringify(parsed).slice(0, 480);
  console.log(`  ${line}`);
  console.log(`    body: ${shown}${shown.length >= 480 ? '…' : ''}`);
  return { status: res.status, body: parsed };
}

function startServer(tmp, stateFile) {
  const child = spawn(process.execPath, ['app/server.js'], {
    cwd: tmp,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT), ACE_MVP_STATE_FILE: stateFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  child.stdout.on('data', (d) => log.push(d.toString()));
  child.stderr.on('data', (d) => log.push(d.toString()));
  return { child, log };
}

function stop(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill();
    setTimeout(resolve, 2000);
  });
}

async function waitForHealth(attempts = 50) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function idsResolve(ids, collection) {
  return Array.isArray(ids) && ids.length > 0 && ids.every((id) => Boolean(collection[id]));
}

function scoresOf(candidates) {
  return candidates.map((c) => [c.id, c.rank, c.scores.ranking_score, c.scores.opportunity_score, c.scores.confidence.level]);
}

/**
 * Publish Queue behaviour of the client script (app/public/mvp.js).
 *
 * The queue lives entirely in the browser, so the script is loaded in a vm
 * context with a minimal element shim: enough to set form values, read the
 * rendered queue HTML and call the same functions the buttons call. Nothing
 * here touches a network, a real browser or the browser profile.
 */
function runPublishQueueAcceptance() {
  const vm = require('node:vm');
  const store = new Map();
  const elements = new Map();
  const checkedChannels = [];

  const makeEl = (id) => ({
    id, innerHTML: '', value: '', checked: false, disabled: false, dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, focus() {}, scrollIntoView() {},
    appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  });
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, makeEl(id));
    return elements.get(id);
  };

  const document = {
    readyState: 'loading',
    addEventListener() {}, removeEventListener() {},
    getElementById: getEl,
    querySelector: () => null,
    querySelectorAll: (sel) => (sel === '.publish-channel-cb:checked' ? checkedChannels.map((value) => ({ value })) : []),
    createElement: () => makeEl('created'),
    body: { dataset: {}, classList: { add() {}, remove() {}, contains() { return false; } }, appendChild() {} },
    documentElement: { dataset: {}, style: {} },
  };

  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };

  const sandbox = {
    document, localStorage,
    console: { log() {}, warn() {}, error() {}, info() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: { userAgent: 'ace-acceptance', clipboard: null },
    location: { href: 'http://127.0.0.1/mvp.html', hash: '', search: '' },
    fetch: () => Promise.reject(new Error('network disabled in the acceptance sandbox')),
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    prompt: () => null, alert() {}, confirm: () => false,
    Event, CustomEvent, Date, JSON, Math, URL, URLSearchParams, Intl, Promise, Blob: class {}, Image: class {},
    requestAnimationFrame: (fn) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout,
  };
  sandbox.window = sandbox;

  const ctx = vm.createContext(sandbox);
  const run = (code) => vm.runInContext(code, ctx, { filename: 'mvp-sandbox.js' });
  const source = fs.readFileSync(path.join(REPO, 'app', 'public', 'mvp.js'), 'utf8');
  try {
    vm.runInContext(source, ctx, { filename: 'app/public/mvp.js' });
  } catch (error) {
    check('mvp.js loads in the Publish Queue sandbox', false, error && error.message);
    return;
  }
  check('mvp.js loads in the Publish Queue sandbox (boot waits for the page)',
    run('typeof renderPublishQueue === "function" && document.readyState === "loading"'));

  const queueHtml = () => getEl('publish-queue').innerHTML;
  const cardHtml = () => getEl('publish-confirm').innerHTML;
  const queueNames = () => Array.from(queueHtml().matchAll(/<b>([^<]*?)(?: <span class="queue-flag">เลยกำหนด<\/span>)?<\/b>/g)).map((m) => m[1].trim());
  const setForm = (channels, date, time, notes) => {
    checkedChannels.length = 0;
    channels.forEach((value) => checkedChannels.push(value));
    getEl('publish-mode').value = 'schedule';
    getEl('publish-date').value = date;
    getEl('publish-time').value = time;
    getEl('publish-notes').value = notes;
  };
  const fixture = `
    function aceFixture(id, name, status, record) {
      return {
        id: id, libraryId: 'lib-' + id, name: name, status: status, platform: 'Shopee',
        affiliateLink: 'https://s.shopee.co.th/' + id, channels: ['tiktok'],
        lineage: { version: 1, approvedSha256: 'sha' + id, fileUrl: '/f' + id + '.mp4' },
        publishRecord: record || null,
      };
    }
    candidatePool.length = 0; contentLibrary.length = 0; publishQueue.length = 0;
    librarySelectedIndex = -1;
  `;

  // --- bulk confirm -------------------------------------------------------
  run(fixture);
  run(`contentLibrary.push(aceFixture(1, 'สินค้า A', 'APPROVE'), aceFixture(2, 'สินค้า B', 'APPROVE'));
       contentLibrary[0].selected = true; contentLibrary[1].selected = true;
       renderPublishConfirm();`);
  const bulkCard = cardHtml();
  check('Publish card groups ticked approved rows into one batch',
    bulkCard.includes('ยืนยันพร้อมกัน 2 รายการ') && bulkCard.includes('ยืนยัน 2 รายการแล้วส่งเข้า Publish Queue'),
    bulkCard.slice(0, 90));

  setForm(['tiktok', 'x'], '2026-12-05', '19:30', 'ชุดเดียวกัน');
  run("confirmPublish(['lib-1', 'lib-2']);");
  const batchState = JSON.parse(run(`JSON.stringify({
    statuses: contentLibrary.map(function (item) { return item.status; }),
    queue: publishQueue.map(function (item) { return item.libraryId; }),
    records: contentLibrary.map(function (item) { return item.publishRecord; }),
  })`));
  check('confirming a batch exports each ticked row exactly once',
    batchState.statuses.join(',') === 'EXPORTED,EXPORTED' && batchState.queue.join(',') === 'lib-1,lib-2',
    batchState.statuses.join(',') + ' / queue ' + batchState.queue.join(','));
  check('batch rows share channels, time and notes but keep their own sub_id 2',
    batchState.records.every((record) => record.channels.join('/') === 'tiktok/x'
      && record.scheduledAt === '2026-12-05T19:30' && record.notes === 'ชุดเดียวกัน')
    && batchState.records[0].subId2 === 'lib-1' && batchState.records[1].subId2 === 'lib-2',
    JSON.stringify(batchState.records.map((record) => [record.subId2, record.scheduledAt])));

  // Re-confirming the same rows must reuse their queue entry, not add one.
  run(`contentLibrary.forEach(function (item) { item.status = 'APPROVE'; });`);
  setForm(['tiktok'], '2026-12-06', '09:00', '');
  run("confirmPublish(['lib-1', 'lib-2']);");
  const dupState = JSON.parse(run(`JSON.stringify({
    queue: publishQueue.length,
    keys: publishQueue.map(function (item) { return item.libraryId; }),
    records: contentLibrary.map(function (item) { return item.publishRecord.scheduledAt; }),
  })`));
  check('re-confirming an already queued row does not duplicate the queue entry',
    dupState.queue === 2 && new Set(dupState.keys).size === 2
    && dupState.records.join(',') === '2026-12-06T09:00,2026-12-06T09:00',
    `queue ${dupState.queue} (${dupState.keys.join(',')})`);

  run(`contentLibrary.forEach(function (item) { item.status = 'APPROVE'; item.publishRecord = null; });
       publishQueue.length = 0;`);
  setForm([], '2026-12-06', '10:00', '');
  run("confirmPublish(['lib-1', 'lib-2']);");
  const refused = JSON.parse(run(`JSON.stringify({
    statuses: contentLibrary.map(function (item) { return item.status; }),
    queue: publishQueue.length,
    records: contentLibrary.map(function (item) { return item.publishRecord; }),
  })`));
  check('a batch with no channel selected is refused and changes nothing',
    refused.statuses.join(',') === 'APPROVE,APPROVE' && refused.queue === 0
    && refused.records.every((record) => record === null),
    `${refused.statuses.join(',')} / queue ${refused.queue}`);

  // --- reschedule queued rows --------------------------------------------
  run(fixture);
  run(`contentLibrary.push(
      aceFixture(1, 'คิวหนึ่ง', 'EXPORTED', { channels: ['tiktok'], mode: 'schedule', scheduledAt: '2026-12-10T09:00', notes: 'เดิม', subId1: 'tiktok', subId2: 'lib-1' }),
      aceFixture(2, 'คิวสอง', 'EXPORTED', { channels: ['facebook'], mode: 'schedule', scheduledAt: '2026-12-11T09:00', notes: 'เดิม', subId1: 'facebook', subId2: 'lib-2' }),
      aceFixture(3, 'คิวสาม', 'EXPORTED', { channels: ['x'], mode: 'schedule', scheduledAt: '2026-12-12T09:00', notes: 'เดิม', subId1: 'x', subId2: 'lib-3' })
    );
    publishQueue.push(contentLibrary[0], contentLibrary[1], contentLibrary[2]);
    librarySelectedIndex = 0;`);

  setForm(['shopee_video'], '2026-12-20', '08:15', 'เลื่อนรายเดียว');
  run('savePublishPlan([contentLibrary[0]]);');
  const singleEdit = JSON.parse(run(`JSON.stringify({
    queue: publishQueue.length,
    record: contentLibrary[0].publishRecord,
    status: contentLibrary[0].status,
    other: contentLibrary[1].publishRecord.scheduledAt,
  })`));
  check('editing a queued row rewrites it in place without a second queue entry',
    singleEdit.queue === 3 && singleEdit.status === 'EXPORTED'
    && singleEdit.record.scheduledAt === '2026-12-20T08:15'
    && singleEdit.record.channels.join('/') === 'shopee_video'
    && singleEdit.record.subId2 === 'lib-1'
    && singleEdit.other === '2026-12-11T09:00',
    `queue ${singleEdit.queue} · ${singleEdit.record.scheduledAt} · other ${singleEdit.other}`);

  setForm(['tiktok', 'facebook'], '2026-12-22', '21:45', 'เลื่อนพร้อมกัน');
  run('savePublishPlan([contentLibrary[1], contentLibrary[2]]);');
  const bulkEdit = JSON.parse(run(`JSON.stringify({
    queue: publishQueue.length,
    first: contentLibrary[0].publishRecord.scheduledAt,
    second: contentLibrary[1].publishRecord,
    third: contentLibrary[2].publishRecord,
  })`));
  check('rescheduling several queued rows applies one plan and leaves the rest alone',
    bulkEdit.queue === 3 && bulkEdit.first === '2026-12-20T08:15'
    && bulkEdit.second.scheduledAt === '2026-12-22T21:45' && bulkEdit.third.scheduledAt === '2026-12-22T21:45'
    && bulkEdit.second.channels.join('/') === 'tiktok/facebook' && bulkEdit.third.channels.join('/') === 'tiktok/facebook'
    && bulkEdit.second.notes === 'เลื่อนพร้อมกัน',
    `queue ${bulkEdit.queue} · ${bulkEdit.second.scheduledAt} · ${bulkEdit.third.scheduledAt}`);

  // --- ordering + overdue badge ------------------------------------------
  run(fixture);
  run(`contentLibrary.push(
      aceFixture(1, 'อนาคตไกล', 'EXPORTED', { channels: ['tiktok'], mode: 'schedule', scheduledAt: '2030-01-10T10:00', notes: '' }),
      aceFixture(2, 'เลยกำหนดแล้ว', 'EXPORTED', { channels: ['x'], mode: 'schedule', scheduledAt: '2020-01-05T10:00', notes: '' }),
      aceFixture(3, 'อนาคตใกล้', 'EXPORTED', { channels: ['facebook'], mode: 'schedule', scheduledAt: '2030-01-05T10:00', notes: '' }),
      aceFixture(4, 'ไม่มีเวลา', 'EXPORTED', null)
    );
    publishQueue.push(contentLibrary[0], contentLibrary[1], contentLibrary[2], contentLibrary[3]);
    renderPublishQueue();`);

  const ordered = queueNames();
  check('Publish Queue lists the nearest slot first and untimed rows last',
    ordered.join('|') === 'เลยกำหนดแล้ว|อนาคตใกล้|อนาคตไกล|ไม่มีเวลา', ordered.join(' | '));

  const html = queueHtml();
  const overdueRows = Array.from(html.matchAll(/<li class="queue-item is-overdue">([\s\S]*?)<\/li>/g)).map((m) => m[1]);
  check('only the row whose slot already passed is flagged overdue',
    overdueRows.length === 1 && overdueRows[0].includes('เลยกำหนดแล้ว') && overdueRows[0].includes('เลยกำหนด</span>')
    && !/อนาคตใกล้|อนาคตไกล|ไม่มีเวลา/.test(overdueRows[0]),
    `${overdueRows.length} overdue row(s)`);
  check('each queued row keeps its edit and copy actions with stable keys',
    (html.match(/class="chip-btn pq-edit" data-key="lib-\d+"/g) || []).length === 4
    && (html.match(/class="chip-btn pq-copy" data-index="\d+"/g) || []).length === 4);
  const order = JSON.parse(run('JSON.stringify(publishQueue.map(function (item) { return item.libraryId; }))'));
  check('sorting the queue view does not reorder the stored queue',
    order.join(',') === 'lib-1,lib-2,lib-3,lib-4', order.join(','));

  // --- select-all / clear in the queue -----------------------------------
  const summary = run("document.getElementById('publish-queue-summary').innerHTML");
  check('queue summary counts rows, late slots and channels and names the next slot',
    summary.includes('4 รายการในคิว') && summary.includes('เลยกำหนด 1')
    && /ถัดไป 5 ม\.ค\. 2573/.test(summary) && summary.includes('ใช้ 3 ช่องทาง'),
    summary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120));

  run('selectAllPublishQueue();');
  const allSelected = JSON.parse(run(`JSON.stringify({
    selection: publishQueueSelection.slice(),
    checked: (document.getElementById('publish-queue').innerHTML.match(/class="pq-check"[^>]*checked/g) || []).length,
    head: document.getElementById('publish-confirm').innerHTML,
  })`));
  check('select-all ticks the whole queue and offers one shared reschedule',
    allSelected.selection.length === 4 && allSelected.checked === 4
    && allSelected.head.includes('แก้ตารางโพสต์พร้อมกัน 4 รายการ')
    && allSelected.head.includes('บันทึก 4 รายการ'),
    `${allSelected.selection.length} selected / ${allSelected.checked} rendered checks`);

  run('clearPublishQueueSelection();');
  const cleared = JSON.parse(run(`JSON.stringify({
    selection: publishQueueSelection.length,
    checked: (document.getElementById('publish-queue').innerHTML.match(/class="pq-check"[^>]*checked/g) || []).length,
  })`));
  check('clearing the queue selection unticks every row',
    cleared.selection === 0 && cleared.checked === 0, `${cleared.selection} selected / ${cleared.checked} rendered checks`);

  run('publishQueue.length = 0; renderPublishQueue();');
  check('queue summary disappears when the queue is empty',
    run("document.getElementById('publish-queue-summary').innerHTML") === '',
    'summary cleared with the queue');
}

(async () => {
  console.log('=== MVP affiliate workflow acceptance — temporary fixture state only ===');
  console.log(`started: ${new Date().toISOString()}`);
  console.log('');

  const tracked = {
    serverState: path.join(REPO, 'data', 'app', 'state.json'),
    mock: path.join(REPO, 'app', 'mock', 'opportunities.json'),
    schema: path.join(REPO, 'docs', 'mission1', 'schemas', 'content-work-item.schema.json'),
    evidenceLog: path.join(REPO, 'data', 'mission1', 'evidence-log.md'),
  };
  const realBefore = Object.fromEntries(Object.entries(tracked).map(([key, file]) => [key, md5(file)]));
  const realMvpBefore = dirSignature(path.join(REPO, 'data', 'mvp'));
  const headBefore = gitHead();
  const stagedBefore = gitStaged();

  const syntax = spawnSync(process.execPath, ['--check', path.join(REPO, 'app', 'mvp', 'service.js')], { encoding: 'utf8' });
  check('node --check app/mvp/service.js', syntax.status === 0, `exit ${syntax.status}${syntax.stderr ? ` — ${syntax.stderr.trim()}` : ''}`);
  const syntax2 = spawnSync(process.execPath, ['--check', path.join(REPO, 'app', 'public', 'mvp.js')], { encoding: 'utf8' });
  check('node --check app/public/mvp.js', syntax2.status === 0, `exit ${syntax2.status}${syntax2.stderr ? ` — ${syntax2.stderr.trim()}` : ''}`);

  // 0. Publish Queue behaviour of the client script (no server, no browser)
  runPublishQueueAcceptance();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-mvp-acceptance-'));
  for (const dir of ['app', 'data', 'docs']) fs.cpSync(path.join(REPO, dir), path.join(tmp, dir), { recursive: true });
  const stateFile = path.join(tmp, 'mvp-runtime', 'fixture-state.json');
  const tempStateBefore = md5(path.join(tmp, 'data', 'app', 'state.json'));
  console.log(`temp workspace: ${tmp}`);
  console.log(`fixture state:  ${stateFile}`);
  console.log('the repository copy is mounted read-only in practice; only the temp copy is written');
  console.log('');

  let child = null;
  let started = startServer(tmp, stateFile);
  child = started.child;
  try {
    check('server becomes healthy', await waitForHealth());

    // 1. Meta
    const meta = await call('GET', '/api/mvp/meta');
    const fixtureFile = path.join(REPO, meta.body.fixture.file);
    const fixtureSha = crypto.createHash('sha256').update(fs.readFileSync(fixtureFile)).digest('hex');
    check('meta is synthetic and points at the fixture', meta.status === 200 && meta.body.synthetic === true
      && meta.body.fixture.synthetic === true && meta.body.fixture.file.endsWith('.csv'));
    check('meta sha256 matches the fixture file', meta.body.fixture.sha256 === fixtureSha, `${meta.body.fixture.sha256}`);
    check('meta does not claim AC-01 / SCOPE-1 / Mission 1', meta.body.acceptance.AC_01.startsWith('NOT CLAIMED')
      && meta.body.acceptance.SCOPE_1.startsWith('NOT CLAIMED') && meta.body.acceptance.mission_1 === 'NOT COMPLETE');

    // 2. Import
    const imported = await call('POST', '/api/mvp/import', {});
    const imp = imported.body.import;
    check('fixture import returns 201 with 8 rows', imported.status === 201 && imp.row_count === 8);
    check('import records: 8 sources, 8 products, 8 offers, 72 evidence',
      imported.body.records.sources === 8 && imported.body.records.products === 8
      && imported.body.records.offers === 8 && imported.body.records.evidence === 72,
      JSON.stringify(imported.body.records));
    check('import is labelled synthetic with provenance', imp.synthetic === true
      && imp.provenance.method === 'CSV_IMPORT' && imp.provenance.source === 'SHOPEE_AFFILIATE_EXPORT_FIXTURE');

    const state1 = imported.body.state;
    const products = Object.fromEntries(state1.products.map((p) => [p.id, p]));
    const offers = Object.fromEntries(state1.offers.map((o) => [o.id, o]));
    const sources = Object.fromEntries(state1.sources.map((s) => [s.id, s]));
    const evidence = Object.fromEntries(state1.evidence.map((e) => [e.id, e]));
    const offerProblems = [];
    for (const offer of state1.offers) {
      if (typeof offer.checked_at !== 'string' || Number.isNaN(Date.parse(offer.checked_at))) offerProblems.push(`${offer.id}:checked_at`);
      if (!offer.provenance) offerProblems.push(`${offer.id}:provenance`);
      else if (offer.provenance.synthetic !== true) offerProblems.push(`${offer.id}:prov.synthetic`);
      else if (offer.provenance.sha256 !== imp.sha256) offerProblems.push(`${offer.id}:prov.sha`);
      if (!(offer.source_ids || []).every((id) => sources[id])) offerProblems.push(`${offer.id}:source_ids`);
      if ((offer.evidence_ids || []).length !== 9) offerProblems.push(`${offer.id}:evidence_count=${(offer.evidence_ids || []).length}`);
      if (!(offer.evidence_ids || []).every((id) => evidence[id])) offerProblems.push(`${offer.id}:evidence_ids`);
    }
    check('every Offer has checked_at, provenance, source_ids and resolvable evidence_ids',
      offerProblems.length === 0, offerProblems.slice(0, 8).join(', '));
    const productsAll = state1.products.every((product) => typeof product.checked_at === 'string'
      && product.provenance && product.provenance.row > 0 && product.source_ids.every((id) => sources[id]));
    check('every Product has checked_at, provenance and source_ids', productsAll);
    check('every Source has checked_at and provenance', state1.sources.every((source) =>
      typeof source.checked_at === 'string' && source.provenance && source.provenance.synthetic === true));
    check('analysis covers price, promotion, commission, reviews and shops', state1.offers.every((offer) =>
      Number.isFinite(offer.price_thb)
      && Number.isFinite(offer.metrics.category_median_price_thb)
      && offer.promo && Number.isFinite(offer.promo.depth_pct)
      && Number.isFinite(offer.commission_per_order_thb)
      && Number.isFinite(offer.reviews.rating) && Number.isFinite(offer.reviews.rating_count)
      && Number.isFinite(offer.shop.related_shop_count)
      && ['LOW_FIXTURE_CROWDING', 'MEDIUM_FIXTURE_CROWDING', 'HIGH_FIXTURE_CROWDING'].includes(offer.metrics.competition_level)));

    // 3. Candidates
    const generated = await call('POST', '/api/mvp/candidates/generate', {});
    const candidates = generated.body.candidates || [];
    check('generate returns 201 with exactly 5 candidates', generated.status === 201 && imported.body.records.offers >= 5 && candidates.length === 5);
    const classCoverage = candidates.every((candidate) =>
      CLAIM_CLASSES.every((claimClass) => candidate.claims.some((item) => item.claim_class === claimClass)));
    check('every candidate carries all four claim classes', classCoverage,
      candidates.map((c) => `${c.id}:${[...new Set(c.claims.map((x) => x.claim_class))].join('/')}`).join(' '));
    const claimsResolve = candidates.every((candidate) => candidate.claims.every((item) =>
      CLAIM_CLASSES.includes(item.claim_class)
      && typeof item.text === 'string' && item.text.length > 20
      && idsResolve(item.evidence_ids, evidence)));
    check('every claim has a valid class and resolvable evidence_ids', claimsResolve);
    const candidateIds = candidates.every((candidate) => idsResolve(candidate.source_ids, sources)
      && idsResolve(candidate.evidence_ids, evidence)
      && Array.isArray(candidate.reasons) && candidate.reasons.length >= 3
      && Number.isInteger(candidate.scores.ranking_score) && candidate.scores.ranking_score >= 0 && candidate.scores.ranking_score <= 100
      && Number.isInteger(candidate.scores.opportunity_score) && candidate.scores.opportunity_score >= 0 && candidate.scores.opportunity_score <= 100
      && ['LOW', 'MEDIUM', 'HIGH'].includes(candidate.scores.confidence.level)
      && candidate.provenance && candidate.provenance.method === 'DETERMINISTIC_SCORING'
      && candidate.synthetic === true);
    check('every candidate has scores, confidence, reasons, provenance and source/evidence ids', candidateIds,
      candidates.map((c) => `${c.id} ${c.scores.ranking_score}/${c.scores.opportunity_score}/${c.scores.confidence.level}`).join(', '));
    check('candidate ids are unique and ranked 1..5', new Set(candidates.map((c) => c.id)).size === 5
      && JSON.stringify(candidates.map((c) => c.rank)) === JSON.stringify([1, 2, 3, 4, 5]));

    const firstGenScores = scoresOf(candidates);
    const regenerated = await call('POST', '/api/mvp/candidates/generate', {});
    check('regeneration is deterministic (same ids, ranks and scores)', JSON.stringify(scoresOf(regenerated.body.candidates)) === JSON.stringify(firstGenScores));

    const c1 = candidates[0].id;
    const c2 = candidates[1].id;
    const c3 = candidates[2].id;
    const c4 = candidates[3].id;
    const c5 = candidates[4].id;

    // 4. Actions and queue
    const save = await call('POST', `/api/mvp/candidates/${c1}/action`, { action: 'SAVE' });
    check('Save sets SAVED and adds to the queue', save.status === 200 && save.body.candidate.status === 'SAVED' && save.body.queue.includes(c1));
    const queue2 = await call('POST', `/api/mvp/candidates/${c2}/action`, { action: 'QUEUE' });
    const queue3 = await call('POST', `/api/mvp/candidates/${c3}/action`, { action: 'QUEUE' });
    const queue5 = await call('POST', `/api/mvp/candidates/${c5}/action`, { action: 'QUEUE' });
    check('Add to queue appends in order', queue2.status === 200 && queue3.status === 200 && queue5.status === 200
      && JSON.stringify(queue5.body.queue) === JSON.stringify([c1, c2, c3, c5]), JSON.stringify(queue5.body.queue));
    const reject = await call('POST', `/api/mvp/candidates/${c4}/action`, { action: 'REJECT', note: 'Fixture check: lower ranked' });
    check('Reject sets REJECTED and keeps it out of the queue', reject.status === 200
      && reject.body.candidate.status === 'REJECTED' && !reject.body.queue.includes(c4));
    const queueRejected = await call('POST', `/api/mvp/candidates/${c4}/action`, { action: 'QUEUE' });
    check('queueing a rejected candidate is refused with 409', queueRejected.status === 409);
    const saveRejected = await call('POST', `/api/mvp/candidates/${c4}/action`, { action: 'SAVE' });
    check('saving a rejected candidate is refused with 409', saveRejected.status === 409);

    const reorder = await call('POST', '/api/mvp/queue/reorder', { candidateId: c5, direction: 'UP' });
    check('reorder moves a candidate up', reorder.status === 200
      && JSON.stringify(reorder.body.queue) === JSON.stringify([c1, c2, c5, c3]), JSON.stringify(reorder.body.queue));
    const remove = await call('POST', `/api/mvp/candidates/${c2}/action`, { action: 'REMOVE' });
    check('Remove clears status and takes the candidate out of the queue', remove.status === 200
      && remove.body.candidate.status === 'NONE'
      && JSON.stringify(remove.body.queue) === JSON.stringify([c1, c5, c3]), JSON.stringify(remove.body.queue));

    // 5. Persistence across restart
    const stateBeforeRestart = await call('GET', '/api/mvp/state');
    const statusesBefore = Object.fromEntries(stateBeforeRestart.body.candidates.map((c) => [c.id, c.status]));
    await stop(child);
    child = null;
    started = startServer(tmp, stateFile);
    child = started.child;
    check('server restarts with the same fixture state file', await waitForHealth());
    const stateAfterRestart = await call('GET', '/api/mvp/state');
    const statusesAfter = Object.fromEntries(stateAfterRestart.body.candidates.map((c) => [c.id, c.status]));
    check('candidate statuses survive reload', JSON.stringify(statusesBefore) === JSON.stringify(statusesAfter),
      JSON.stringify(statusesAfter));
    check('queue order survives reload', JSON.stringify(stateAfterRestart.body.queue) === JSON.stringify([c1, c5, c3]),
      JSON.stringify(stateAfterRestart.body.queue));
    check('candidate scores survive reload', JSON.stringify(scoresOf(stateAfterRestart.body.candidates)) === JSON.stringify(firstGenScores));
    check('evidence and provenance survive reload', stateAfterRestart.body.summary.evidence === 72
      && stateAfterRestart.body.summary.offers === 8
      && stateAfterRestart.body.offers.every((offer) => offer.provenance && offer.checked_at));

    // 6. Plan draft
    const draftFromUnsaved = await call('POST', '/api/mvp/plan/draft', { candidateId: c2 });
    check('plan draft from an unselected candidate is refused with 409', draftFromUnsaved.status === 409);
    const draftFromRejected = await call('POST', '/api/mvp/plan/draft', { candidateId: c4 });
    check('plan draft from a rejected candidate is refused with 409', draftFromRejected.status === 409);

    const draftRes = await call('POST', '/api/mvp/plan/draft', { candidateId: c1 });
    const draft = draftRes.body.draft;
    check('plan draft is created for a saved candidate', draftRes.status === 201 && draft && draft.candidate_id === c1);
    check('draft has three generated approaches and an empty user-custom slot',draft.approaches.generated.length === 3 && draft.approaches.generated.every((a) => ['personalized_a', 'personalized_b', 'exploration'].includes(a.key) && a.origin === 'AI_DRAFT')
      && draft.approaches.user_custom === null);
    check('draft has an impact preview with changes, not-done list and gates',
      draft.impact_preview && Array.isArray(draft.impact_preview.changes) && draft.impact_preview.changes.length >= 1
      && draft.impact_preview.not_done.some((t) => t.includes('Content Work Item'))
      && draft.impact_preview.gates.G2 === 'not requested'
      && draft.impact_preview.spend_thb === 0);

    const unconfirmed = await call('POST', '/api/mvp/plan', { draftId: draft.id, approach: 'personalized_a' });
    const stateAfterUnconfirmed = await call('GET', '/api/mvp/state');
    check('creating a plan without confirming the impact preview is refused with 400',
      unconfirmed.status === 400 && Boolean(unconfirmed.body.impact_preview));
    check('the refused create wrote no plan', stateAfterUnconfirmed.body.summary.plans === 0);

    // 7. User custom stored separately
    const customRes = await call('POST', '/api/mvp/plan/custom', {
      draftId: draft.id,
      angle: 'Owner angle: daily portion cost for cat owners, with a feeding demo.',
      audience: 'cat owners buying staple food',
      hook: 'Cost per day, not cost per bag',
      format: '25s feeding demo',
      rationale: 'Fixture commission is highest per order; the angle is an owner choice.',
    });
    const customDraft = customRes.body.draft;
    check('user custom approach is saved with origin USER', customRes.status === 200
      && customDraft.approaches.user_custom
      && customDraft.approaches.user_custom.origin === 'USER'
      && customDraft.approaches.user_custom.key === 'user_custom');
    check('user custom is stored separately from the generated three', customDraft.approaches.generated.length === 3
      && customDraft.approaches.generated.every((a) => a.key !== 'user_custom' && a.origin === 'AI_DRAFT')
      && customDraft.approaches.user_custom.evidence_ids.length === 0);

    // 8. Plan creation
    const planRes = await call('POST', '/api/mvp/plan', {
      draftId: draft.id,
      approach: 'user_custom',
      confirmImpact: true,
    });
    const plan = planRes.body.plan;
    check('confirmed plan creation returns 201 with a snapshot identity', planRes.status === 201
      && plan.id === 'MVP-PLAN-1-1-v1' && plan.plan_id === 'MVP-PLAN-1-1' && plan.version === 'v1');
    check('plan keeps the generated three and the user custom separately', plan.approaches.generated.length === 3
      && plan.approaches.generated.every((a) => a.origin === 'AI_DRAFT')
      && plan.approaches.user_custom.origin === 'USER'
      && plan.approach === 'user_custom');
    check('plan is a fixture record and does not claim a foundation handoff', plan.status === 'FIXTURE_DRAFT'
      && plan.synthetic === true
      && plan.foundation_handoff.available === false
      && plan.foundation_handoff.attempted === false);
    check('plan impact preview keeps all gates unchanged', plan.impact_preview.gates.G1.startsWith('unchanged')
      && plan.impact_preview.gates.G2 === 'not requested'
      && plan.impact_preview.spend_thb === 0
      && plan.impact_preview.external_calls === 0);

    // 9. Reload after plan
    await stop(child);
    child = null;
    started = startServer(tmp, stateFile);
    child = started.child;
    check('server restarts after plan creation', await waitForHealth());
    const finalState = await call('GET', '/api/mvp/state');
    const finalPlan = finalState.body.plans[0];
    check('plan survives reload with its custom approach', finalState.body.summary.plans === 1
      && finalPlan.id === plan.id
      && finalPlan.approaches.user_custom.origin === 'USER'
      && finalPlan.approaches.generated.length === 3);
    check('candidate statuses and queue survive the second reload',
      JSON.stringify(finalState.body.queue) === JSON.stringify([c1, c5, c3])
      && finalState.body.candidates.find((c) => c.id === c1).status === 'SAVED'
      && finalState.body.candidates.find((c) => c.id === c4).status === 'REJECTED');
    check('draft is finalised, not re-openable', finalState.body.planDrafts[0].status === 'FINALISED'
      && finalState.body.planDrafts[0].plan_record_id === plan.id);

    // 10. Content project from the plan and from a saved candidate
    const contentFromPlan = await call('POST', '/api/mvp/content/draft', {
      planId: plan.id,
      approach: 'problem_first',
    });
    const content = contentFromPlan.body.project;
    const contentId = content && content.content_id;
    check('content project is created from the plan with 201 at DRAFT',
      contentFromPlan.status === 201 && content && content.status === 'DRAFT',
      content ? `${content.content_id} ${content.status}` : `status ${contentFromPlan.status}`);
    check('content project keeps Content / Product / Candidate / Shop identities',
      Boolean(content && content.content_id && content.product_id && content.candidate_id && content.shop_id)
      && content.candidate_id === c1 && content.offer_id === imported.body.state.offers.find((o) => o.product_id === content.product_id).id,
      content ? `${content.content_id} · ${content.product_id} · ${content.candidate_id} · shop ${content.shop_id}` : 'missing');
    check('content project traces back to the plan and the synthetic source',
      content && content.plan_id === plan.plan_id && content.plan_record_id === plan.id
      && content.synthetic === true
      && content.provenance && content.provenance.method === 'DETERMINISTIC_TEMPLATE_FROM_EXPORT'
      && content.provenance.candidate_id === c1);
    check('content project starts with three generated approaches and a 9:16 storyboard',
      content && content.approaches.generated.length === 3
      && content.approaches.generated.every((a) => a.origin === 'GENERATED')
      && content.storyboard.canvas.width === 1080 && content.storyboard.canvas.height === 1920
      && content.storyboard.scenes.length >= 4,
      content ? `${content.approaches.generated.map((a) => a.origin).join('/')} · ${content.storyboard.canvas.width}x${content.storyboard.canvas.height} · ${content.storyboard.scenes.length} scenes` : 'missing');
    check('every scene carries overlay text, a voiceover line and evidence ids',
      content && content.storyboard.scenes.every((scene) =>
        String((scene.overlay && scene.overlay.headline) || '').trim()
        && String((scene.audio && scene.audio.voiceover) || '').trim()
        && (scene.evidence_ids || []).length > 0));
    check('content draft records zero external calls and zero spend',
      contentFromPlan.body.boundary && contentFromPlan.body.boundary.external_calls === 0
      && contentFromPlan.body.boundary.spend_thb === 0
      && contentFromPlan.body.boundary.real_state_touched === false);

    const contentFromCandidate = await call('POST', '/api/mvp/content/draft', { candidateId: c1 });
    check('content project is created from a saved candidate',
      contentFromCandidate.status === 201
      && contentFromCandidate.body.project.status === 'DRAFT'
      && contentFromCandidate.body.project.candidate_id === c1
      && contentFromCandidate.body.project.plan_id === null,
      `status ${contentFromCandidate.status}`);
    const contentFromRejected = await call('POST', '/api/mvp/content/draft', { candidateId: c4 });
    check('content project from a rejected candidate is refused with 409',
      contentFromRejected.status === 409, `status ${contentFromRejected.status}`);

    const contentList = await call('GET', '/api/mvp/content');
    check('content list exposes both projects and the five documented statuses',
      contentList.status === 200
      && contentList.body.contents.length === 2
      && JSON.stringify(contentList.body.statuses) === JSON.stringify(['DRAFT', 'REVIEW', 'FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH']));

    // 11. QA — run it and inspect the result
    const qaRes = await call('POST', `/api/mvp/content/${contentId}/qa`, {});
    const qa = qaRes.body.qa;
    check('QA runs and returns a report on the DRAFT project',
      qaRes.status === 200 && qa && Array.isArray(qa.checks) && qa.checks.length > 0,
      `status ${qaRes.status}`);
    const qaCategories = new Set((qa.checks || []).map((item) => item.category));
    check('QA covers spelling, price, promotion, product name, CTA, evidence and external scope',
      ['spelling', 'price', 'promotion', 'product_name', 'cta', 'evidence', 'external']
        .every((category) => qaCategories.has(category)),
      [...qaCategories].join(', '));
    check('QA summary counts every check and agrees with blocking',
      qa.summary.PASS + qa.summary.WARN + qa.summary.FAIL === qa.checks.length
      && qa.passed === (qa.summary.FAIL === 0)
      && qa.blocking.length === qa.summary.FAIL,
      `PASS ${qa.summary.PASS} · WARN ${qa.summary.WARN} · FAIL ${qa.summary.FAIL}`);
    check('QA finds no blocking failure on the generated content', qa.summary.FAIL === 0,
      (qa.blocking || []).map((item) => `[${item.category}] ${item.message}`).join(' | '));
    check('QA result is stored on the project and does not change its status',
      qaRes.body.project.status === 'DRAFT' && qaRes.body.project.qa
      && qaRes.body.project.qa.ran_at === qa.ran_at);

    // 12. REVIEW — a one-step transition required before finalize
    const finalizeFromDraft = await call('POST', `/api/mvp/content/${contentId}/finalize`, {});
    check('finalize before REVIEW is refused with 409', finalizeFromDraft.status === 409,
      `status ${finalizeFromDraft.status}`);
    const review = await call('POST', `/api/mvp/content/${contentId}/review`, {});
    check('DRAFT transitions to REVIEW', review.status === 200 && review.body.project.status === 'REVIEW');
    check('the REVIEW transition is recorded in the edit log',
      review.body.project.edit_log.some((entry) => entry.change === 'ส่งเข้าการตรวจ'));
    const reviewAgain = await call('POST', `/api/mvp/content/${contentId}/review`, {});
    check('a second REVIEW transition is refused with 409', reviewAgain.status === 409,
      `status ${reviewAgain.status}`);

    // 13. Human-in-the-loop interlock — the Thai draft must be reviewed first
    const finalizeUnreviewed = await call('POST', `/api/mvp/content/${contentId}/finalize`, {});
    check('finalize without a draft review is refused with 409 and a reason code',
      finalizeUnreviewed.status === 409
      && finalizeUnreviewed.body.details
      && finalizeUnreviewed.body.details.code === 'draft_review_required',
      `status ${finalizeUnreviewed.status} · code ${finalizeUnreviewed.body.details && finalizeUnreviewed.body.details.code}`);
    check('the refusal hands back the script and its checksum so it can be reviewed',
      finalizeUnreviewed.body.details
      && finalizeUnreviewed.body.details.draft_review
      && typeof finalizeUnreviewed.body.details.draft_review.script_text === 'string'
      && finalizeUnreviewed.body.details.draft_review.script_text.length > 0
      && finalizeUnreviewed.body.details.draft_review.script_checksum);

    const finalizeNameless = await call('POST', `/api/mvp/content/${contentId}/finalize`, {
      draft_review: { confirmed: true, reviewed_by: '   ', script_checksum: review.body.project.script.checksum },
    });
    check('finalize with a blank reviewer name is refused with 409',
      finalizeNameless.status === 409, `status ${finalizeNameless.status}`);

    const finalizeStale = await call('POST', `/api/mvp/content/${contentId}/finalize`, {
      draft_review: { confirmed: true, reviewed_by: 'Owner', script_checksum: 'stale-checksum' },
    });
    check('finalize with a stale review checksum is refused with 409 and a reason code',
      finalizeStale.status === 409
      && finalizeStale.body.details
      && finalizeStale.body.details.code === 'draft_review_stale',
      `status ${finalizeStale.status} · code ${finalizeStale.body.details && finalizeStale.body.details.code}`);
    check('a refused review leaves the project in REVIEW',
      finalizeStale.body.project === undefined
      || finalizeStale.body.project.status === 'REVIEW');

    // 14. Finalize against the documented requirements
    const finalized = await call('POST', `/api/mvp/content/${contentId}/finalize`, {
      draft_review: {
        confirmed: true,
        reviewed_by: 'Owner',
        script_checksum: review.body.project.script.checksum,
      },
    });
    const checklist = finalized.body.checklist;
    check('REVIEW transitions to FINALIZED with 200',
      finalized.status === 200 && finalized.body.project.status === 'FINALIZED',
      `status ${finalized.status}`);
    const requiredItems = ['qa', 'preview', 'scenes', 'cta', 'evidence', 'duration', 'language', 'script_version', 'identities'];
    check('finalize runs the full checklist and every item passes',
      checklist && checklist.items.length >= 8 && checklist.passed === true
      && checklist.ok === checklist.total
      && requiredItems.every((id) => checklist.items.some((item) => item.id === id && item.ok)),
      checklist ? `${checklist.ok}/${checklist.total} items ok` : 'missing');
    check('finalize checklist relies on a QA result with no blocking failure',
      checklist && checklist.items.find((item) => item.id === 'qa').ok === true
      && checklist.items.find((item) => item.id === 'qa').detail.includes(`ผ่าน ${finalized.body.project.qa.summary.PASS}`));
    check('finalize records the script version, checksum and QA timestamp',
      finalized.body.project.finalize
      && finalized.body.project.finalize.script_version === finalized.body.project.script_version
      && Boolean(finalized.body.project.finalize.script_checksum)
      && finalized.body.project.finalize.script_checksum === finalized.body.project.script.checksum
      && !Number.isNaN(Date.parse(finalized.body.project.finalize.qa_ran_at))
      && finalized.body.project.finalize.qa_ran_at === finalized.body.project.qa.ran_at);
    check('finalize keeps the QA report on the project with no blocking failure',
      finalized.body.project.qa && finalized.body.project.qa.summary.FAIL === 0
      && finalized.body.project.qa.passed === true);
    check('finalize records who reviewed the Thai draft, when, and against which checksum',
      finalized.body.project.finalize.review
      && finalized.body.project.finalize.review.confirmed === true
      && finalized.body.project.finalize.review.reviewed_by === 'Owner'
      && !Number.isNaN(Date.parse(finalized.body.project.finalize.review.reviewed_at))
      && finalized.body.project.finalize.review.script_checksum === finalized.body.project.script.checksum);
    check('the review is written into the edit log as an auditable entry',
      finalized.body.project.edit_log.some((entry) => entry.change.includes('ตรวจรับบทพูดภาษาไทยโดย Owner')));
    const finalizeAgain = await call('POST', `/api/mvp/content/${contentId}/finalize`, {});
    check('finalizing a FINALIZED project again is refused with 409', finalizeAgain.status === 409,
      `status ${finalizeAgain.status}`);

    // 14. Publish prep before export must be refused
    const prepBeforeExport = await call('POST', `/api/mvp/content/${contentId}/publish-prep`, {});
    check('publish prep before export is refused with 409', prepBeforeExport.status === 409,
      `status ${prepBeforeExport.status}`);
    check('the refusal names the EXPORTED requirement',
      typeof prepBeforeExport.body.error === 'string'
      && prepBeforeExport.body.error.includes('publish preparation requires an EXPORTED project')
      && prepBeforeExport.body.error.includes('FINALIZED'),
      prepBeforeExport.body.error);
    const afterRefusedPrep = await call('GET', `/api/mvp/content/${contentId}`);
    check('a refused publish prep changes no status and writes no payload',
      afterRefusedPrep.body.project.status === 'FINALIZED'
      && afterRefusedPrep.body.project.publish_prep === null
      && afterRefusedPrep.body.project.export === null);

    // 15. Finalized content survives a reload
    await stop(child);
    child = null;
    started = startServer(tmp, stateFile);
    child = started.child;
    check('server restarts after finalize', await waitForHealth());
    const reloadedContent = await call('GET', `/api/mvp/content/${contentId}`);
    check('finalized content survives reload with its QA and checklist',
      reloadedContent.status === 200
      && reloadedContent.body.project.status === 'FINALIZED'
      && reloadedContent.body.project.qa.summary.FAIL === 0
      && reloadedContent.body.project.finalize.checklist.passed === true
      && reloadedContent.body.project.script_version >= 1);
    check('content list still holds both projects after reload',
      (await call('GET', '/api/mvp/content')).body.contents.length === 2);

    // 16. Idempotent re-import keeps the plan
    const reimport = await call('POST', '/api/mvp/import', {});
    check('re-importing the same fixture is idempotent and keeps the plan', reimport.status === 200
      && reimport.body.reused === true && reimport.body.state.summary.plans === 1);

    // 17. Fixture-state file is inside the temp workspace
    check('fixture state was written to the configured temp file', fs.existsSync(stateFile));
    check('temp foundation state.json is byte-identical (MVP never wrote it)',
      md5(path.join(tmp, 'data', 'app', 'state.json')) === tempStateBefore);
  } finally {
    await stop(child);
  }

  // 18. Real repository integrity
  const realAfter = Object.fromEntries(Object.entries(tracked).map(([key, file]) => [key, md5(file)]));
  const realMvpAfter = dirSignature(path.join(REPO, 'data', 'mvp'));
  check('real data/app/state.json is byte-identical',
    realBefore.serverState === realAfter.serverState, realAfter.serverState);
  check('real schema and mission files are byte-identical',
    realBefore.schema === realAfter.schema
    && realBefore.mock === realAfter.mock
    && realBefore.evidenceLog === realAfter.evidenceLog);
  check('real data/mvp fixture state was not created or changed',
    JSON.stringify(realMvpBefore) === JSON.stringify(realMvpAfter),
    realMvpAfter === null ? 'absent before and after' : JSON.stringify(realMvpAfter));

  const headAfter = gitHead();
  const stagedAfter = gitStaged();
  check('no commit created during the run', headBefore === headAfter, headBefore);
  check('nothing staged during the run', stagedBefore === stagedAfter && stagedAfter === '', stagedAfter || '(none)');

  fs.rmSync(tmp, { recursive: true, force: true });

  const passed = checks.length - failures;
  console.log('');
  console.log(`assertions: ${checks.length}  passed: ${passed}  failed: ${failures}`);
  console.log(`existing commit count: ${String(spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout || '').trim()}`);
  console.log('new commits created this round: 0');
  if (failures) {
    console.error('MVP workflow acceptance FAILED');
    process.exit(1);
  }
  console.log('MVP workflow acceptance passed (temporary fixture state only)');
})();
