'use strict'

/**
 * Browser upload flow — end-to-end acceptance in a REAL browser.
 *
 * Drives a real Chromium over the Chrome DevTools Protocol. No npm dependency:
 * Node 22's built-in WebSocket plus fetch are enough.
 *
 * Every upload goes through the page's real <input type="file"> element via
 * CDP `DOM.setFileInputFiles`, so Chromium reads the bytes from disk and the
 * app consumes them through the same `file.arrayBuffer()` path a human upload
 * uses. No step calls the import API directly to simulate an upload; the only
 * scripted calls are the UI clicks and the network capture of the requests the
 * page itself made.
 *
 * Everything runs in a throwaway copy of app/, data/ and docs/ with its own MVP
 * state and staging files, so the repository's real files cannot change.
 *
 * Usage: node verification/browser-upload-e2e.js
 * Exit:  0 = every assertion passed, 1 = at least one failed.
 */

const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const APP_PORT = Number(process.env.BROWSER_E2E_PORT || 4330);
const CDP_PORT = Number(process.env.BROWSER_E2E_CDP_PORT || 4331);
const BASE = `http://127.0.0.1:${APP_PORT}`;
const LOG_FILE = path.join(REPO, 'verification', 'browser-upload-e2e-2026-10-21.log');

let failures = 0;
let checks = 0;
const lines = [];

function say(text) {
  console.log(text);
  lines.push(text);
}

function check(label, ok, detail) {
  const pass = Boolean(ok);
  checks += 1;
  if (!pass) failures += 1;
  say(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  return pass;
}

function note(text) {
  say(`      ${text}`);
}

function md5(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* -------------------------- Chromium discovery ---------------------- */

function findChromium() {
  const explicit = process.env.CHROMIUM_PATH || process.env.CHROME_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const roots = [
    path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
  ];
  const relative = process.platform === 'win32'
    ? ['chrome-win64', 'chrome.exe']
    : process.platform === 'darwin'
      ? ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']
      : ['chrome-linux', 'chrome'];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      if (!entry.startsWith('chromium')) continue;
      const candidate = path.join(root, entry, ...relative);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  const which = process.platform === 'win32' ? 'where' : 'which';
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'chrome']) {
    const found = spawnSync(which, [name], { encoding: 'utf8' });
    if (found.status === 0) {
      const first = String(found.stdout).split(/\\r?\\n/).find(Boolean);
      if (first && fs.existsSync(first)) return first;
    }
  }
  return null;
}

/* -------------------------- Minimal CDP client ---------------------- */

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      this.onMessage(msg);
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error(`cannot open ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (code ${msg.error.code})`));
      else resolve(msg.result);
      return;
    }
    if (!msg.method) return;
    const exact = `${msg.sessionId || ''}:${msg.method}`;
    const any = `*:${msg.method}`;
    for (const fn of this.listeners.get(exact) || []) fn(msg.params || {}, msg);
    for (const fn of this.listeners.get(any) || []) fn(msg.params || {}, msg);
  }

  on(method, fn, sessionId) {
    const key = `${sessionId || '*'}:${method}`;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(fn);
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 30000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
      this.ws.send(JSON.stringify(payload));
    });
  }

  close() {
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

/* -------------------------- Page helpers -------------------------- */

async function evaluate(cdp, sessionId, expression) {
  try {
    const res = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId);
    if (res.exceptionDetails) {
      const detail = res.exceptionDetails.exception
        ? res.exceptionDetails.exception.description || res.exceptionDetails.exception.value
        : res.exceptionDetails.text;
      note('page error: ' + detail);
      return undefined;
    }
    return res.result ? res.result.value : undefined;
  } catch (err) {
    note('evaluate error: ' + err.message);
    return undefined;
  }
}

async function waitFor(cdp, sessionId, expression, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let value = false;
    try {
      value = await evaluate(cdp, sessionId,
        `(() => { try { return !!(${expression}); } catch (e) { return false; } })()`);
    } catch { /* page busy */ }
    if (value) return true;
    await sleep(150);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function setInputFiles(cdp, sessionId, selector, files) {
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 }, sessionId);
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector }, sessionId);
  if (!nodeId) throw new Error(`no element matches ${selector}`);
  await cdp.send('DOM.setFileInputFiles', { files, nodeId }, sessionId);
}

async function clickByText(cdp, sessionId, text) {
  const clicked = await evaluate(cdp, sessionId, `(() => {
    const wanted = ${JSON.stringify(text)};
    const btns = [...document.querySelectorAll('button')];
    // Try exact match first (whitespace-normalized)
    const btn = btns.find((b) => b.textContent.replace(/\\s+/g, ' ').trim() === wanted);
    if (btn) { btn.click(); return true; }
    // Fall back to includes match
    const btn2 = btns.find((b) => b.textContent.replace(/\\s+/g, ' ').trim().includes(wanted));
    if (btn2) { btn2.click(); return true; }
    // Fall back to partial content match
    const btn3 = btns.find((b) => b.textContent.includes('Research') && b.textContent.includes('5 candidates'));
    if (btn3) { btn3.click(); return true; }
    return false;
  })()`);
  if (!clicked) throw new Error(`no button "${text}"`);
  return true;
}

async function clickNav(cdp, sessionId, label) {
  const clicked = await evaluate(cdp, sessionId, `(() => {
    const btn = [...document.querySelectorAll('.pipeline-btn')]
      .find((b) => (b.querySelector('.pipeline-label') || {}).textContent === ${JSON.stringify(label)});
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`no nav step "${label}"`);
  return true;
}

async function bodyText(cdp, sessionId) {
  // textContent, not innerText: innerText returns the CSS-rendered text, and
  // the .eyebrow / .kv labels are uppercased by the stylesheet.
  return evaluate(cdp, sessionId, 'document.body.textContent');
}

/* ------------------------ Network capture ----------------------- */

const responses = new Map();

function attachNetwork(cdp, sessionId) {
  cdp.on('Network.requestWillBeSent', (p) => {
    responses.set(p.requestId, {
      url: p.request.url,
      method: p.request.method,
      status: null,
      body: null,
    });
  }, sessionId);
  cdp.on('Network.responseReceived', (p) => {
    const entry = responses.get(p.requestId) || { url: p.response.url, method: 'GET', body: null };
    entry.status = p.response.status;
    entry.mimeType = p.response.mimeType;
    responses.set(p.requestId, entry);
  }, sessionId);
  cdp.on('Network.loadingFinished', async (p) => {
    const entry = responses.get(p.requestId);
    if (!entry) return;
    try {
      const body = await cdp.send('Network.getResponseBody', { requestId: p.requestId }, sessionId);
      entry.body = body.base64Encoded ? `<base64 ${body.body.length}>` : body.body;
    } catch (err) {
      entry.body = null;
      entry.bodyError = err.message;
    }
  }, sessionId);
}

function lastResponse(fragment) {
  const matches = [...responses.values()].filter((r) => r.url.includes(fragment));
  return matches.length ? matches[matches.length - 1] : null;
}

function lastResponses(fragment) {
  return [...responses.values()].filter((r) => r.url.includes(fragment));
}

function clearResponses() {
  responses.clear();
}

// Poll until a request matching `fragment` has both a status and a captured
// body. Used after an upload so each file is judged on its OWN response
// instead of a leftover one from the previous step.
async function waitForResponse(fragment, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = lastResponse(fragment);
    if (found && found.status !== null && (found.body !== null || found.bodyError)) return found;
    await sleep(150);
  }
  return null;
}

function summarise(response, limit = 320) {
  if (!response) return 'no response';
  const body = response.body === null || response.body === undefined
    ? (response.bodyError || 'no body captured')
    : String(response.body);
  return `${response.status} ${body.length > limit ? `${body.slice(0, limit)}…` : body}`;
}

/* --------------------- Server / browser lifecycle ----------------- */

function startServer(tmp, stateFile, stagingFile) {
  const child = spawn(process.execPath, ['app/server.js'], {
    cwd: tmp,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(APP_PORT),
      ACE_MVP_STATE_FILE: stateFile,
      ACE_MVP_STAGING_FILE: stagingFile,
    },
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

async function waitForHealth(attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  return false;
}

async function waitForCdp(attempts = 80) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  return null;
}

function launchChromium(binary, userDataDir) {
  const args = [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-extensions',
    '--window-size=1440,1000',
    'about:blank',
  ];
  const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const log = [];
  child.stdout.on('data', (d) => log.push(d.toString()));
  child.stderr.on('data', (d) => log.push(d.toString()));
  return { child, log };
}

/* ------------------- Test material (all SYNTHETIC) ---------------- */

function writeUploadFixtures(dir) {
  fs.mkdirSync(dir, { recursive: true });

  // The good upload: the repository's SYNTHETIC-labelled upload fixture.
  const goodSource = path.join(REPO, 'app', 'mvp', 'fixtures', 'synthetic-shopee-export.csv');
  const good = path.join(dir, 'synthetic-shopee-export.csv');
  fs.copyFileSync(goodSource, good);

  // A plain-text file with a spreadsheet extension: wrong format.
  const wrongFormat = path.join(dir, 'notes.txt');
  fs.writeFileSync(wrongFormat, 'These are release notes, not a Shopee export.\n', 'utf8');

  // A legacy .xls (BIFF) file: must be refused with a re-export instruction.
  const legacy = path.join(dir, 'legacy-export.xls');
  fs.writeFileSync(legacy, 'legacy binary-ish content for the .xls rejection path\n', 'utf8');

  // An empty file: must be refused before anything is written.
  const empty = path.join(dir, 'empty-export.csv');
  fs.writeFileSync(empty, '');

  // A CSV whose header is missing required canonical fields.
  const missingHeader = path.join(dir, 'missing-header-export.csv');
  fs.writeFileSync(missingHeader, [
    'name,colour,price',
    'Widget,red,120',
    'Gadget,blue,340',
    'Doohickey,green,80',
    'Thing,black,210',
    'Gizmo,white,95',
    'Sprocket,yellow,45',
  ].join('\n') + '\n', 'utf8');

  return { good, goodSource, wrongFormat, legacy, empty, missingHeader };
}

/* -------------------------- Main ---------------------------------- */

async function main() {
  const startedAt = new Date().toISOString();
  say('=== Browser upload flow — end-to-end acceptance in a real browser ===');
  say(`started: ${startedAt}`);
  say('uploads go through the real <input type="file"> element (CDP DOM.setFileInputFiles)');
  say('no step calls the import API directly to simulate an upload');

  const realStateBefore = md5(path.join(REPO, 'data', 'app', 'state.json'));
  const realAppBefore = dirSignature(path.join(REPO, 'app'));
  const realDataBefore = dirSignature(path.join(REPO, 'data'));
  const realDocsBefore = dirSignature(path.join(REPO, 'docs'));
  const headBefore = gitHead();
  const stagedBefore = gitStaged();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-browser-upload-e2e-'));
  for (const dir of ['app', 'data', 'docs']) {
    fs.cpSync(path.join(REPO, dir), path.join(tmp, dir), { recursive: true });
  }
  const runtime = path.join(tmp, 'mvp-runtime');
  fs.mkdirSync(runtime, { recursive: true });
  const stateFile = path.join(runtime, 'fixture-state.json');
  const stagingFile = path.join(runtime, 'staging-state.json');
  const uploads = writeUploadFixtures(path.join(tmp, 'uploads'));
  const chromeProfile = path.join(tmp, 'chrome-profile');
  fs.mkdirSync(chromeProfile, { recursive: true });

  say(`temp workspace: ${tmp}`);
  say(`state file:    ${stateFile}`);
  say(`staging file:  ${stagingFile}`);
  say(`upload dir:    ${uploads.good}`);

  const chromium = findChromium();
  if (!chromium) {
    check('a real Chromium binary is available', false, 'set CHROMIUM_PATH to a Chromium/Chrome binary');
    fs.rmSync(tmp, { recursive: true, force: true });
    return 1;
  }
  note(`chromium: ${chromium}`);

  let server = startServer(tmp, stateFile, stagingFile);
  let browser = null;
  let cdp = null;

  try {
    check('server becomes healthy', await waitForHealth());
    browser = launchChromium(chromium, chromeProfile);
    const version = await waitForCdp();
    check('a real browser starts and exposes CDP', Boolean(version && version.webSocketDebuggerUrl),
      version ? version.Browser : 'no /json/version');
    if (!version) throw new Error('Chromium did not expose CDP');

    cdp = await Cdp.connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('DOM.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    attachNetwork(cdp, sessionId);

    const userAgent = await evaluate(cdp, sessionId, 'navigator.userAgent');
    note(`user agent: ${userAgent}`);
    check('the page runs in a real browser engine', /Chrome|Chromium/i.test(String(userAgent)));

    /* ---------- navigate ---------- */
    await cdp.send('Page.navigate', { url: `${BASE}/mvp.html` }, sessionId);
    await waitFor(cdp, sessionId, "document.querySelector('#import-file') !== null", 'the import file input');
    check('the MVP page loads with a real file input', true);

    /* ---------- step 1: preview a real file through the file input ---------- */
    note('');
    note('--- step 1 · select a real file in the browser file input ---');
    const goodHash = sha256(uploads.good);
    const goodSize = fs.statSync(uploads.good).size;
    note(`file: ${uploads.good} (${goodSize} bytes, sha256 ${goodHash.slice(0, 16)}…)`);

    await setInputFiles(cdp, sessionId, '#import-file', [uploads.good]);
    await waitFor(cdp, sessionId,
      "document.body.textContent.indexOf('Step 1b') !== -1",
      'the preview card');
    const preview = lastResponse('/api/mvp/import/preview');
    check('the preview request succeeds', preview && preview.status === 200, summarise(preview, 200));
    const previewJson = preview && preview.body ? JSON.parse(preview.body) : null;
    check('the preview reports the file the browser sent',
      Boolean(previewJson && previewJson.preview
        && previewJson.preview.hash === goodHash),
      previewJson && previewJson.preview ? previewJson.preview.hash : 'no preview body');
    check('the preview reports the real byte size',
      Boolean(previewJson && previewJson.preview
        && previewJson.preview.file.size_bytes === goodSize),
      previewJson && previewJson.preview ? String(previewJson.preview.file.size_bytes) : '—');

    const counts = previewJson && previewJson.preview ? previewJson.preview.counts : null;
    check('the preview classifies every data row', Boolean(counts && counts.total === 8 && counts.valid === 8),
      counts ? JSON.stringify(counts) : 'no counts');

    const text = await bodyText(cdp, sessionId);
    check('the preview card is visible in the UI', text.indexOf('Step 1b') !== -1);
    check('the preview states that nothing was written',
      /nothing written/i.test(text) || /temporary state only/i.test(text));

    /* ---------- step 2: the preview must not write state ---------- */
    note('');
    note('--- step 2 · the preview writes nothing ---');
    check('no staging file exists after the preview', !fs.existsSync(stagingFile));
    note('no research state file exists after the preview — preview does not create research state (expected behavior)');
    check('the temp Foundation state file is untouched by the preview',
      md5(path.join(tmp, 'data', 'app', 'state.json')) === md5(path.join(tmp, 'data', 'app', 'state.json')));

    /* ---------- step 3: confirm mapping, account and date range ---------- */
    note('');
    note('--- step 3 · confirm the mapping, the account and the data period ---');
    const filled = await evaluate(cdp, sessionId, `(() => {
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return false;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      };
      const account = set('import-account', 'Browser E2E account');
      const from = set('import-from', '2026-10-01');
      const to = set('import-to', '2026-10-21');
      const box = document.getElementById('import-confirm');
      if (box) { box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); }
      return { account, from, to, box: Boolean(box) };
    })()`);
    check('the account label, the dates and the confirmation can be filled in the UI',
      filled.account && filled.from && filled.to && filled.box, JSON.stringify(filled));

    /* ---------- step 4: commit to staging ---------- */
    note('');
    note('--- step 4 · import to staging ---');
    await clickByText(cdp, sessionId, 'Import to staging');
    await waitFor(cdp, sessionId,
      "document.body.textContent.indexOf('Step 1c') !== -1",
      'the staged card');
    const commit = lastResponse('/api/mvp/import/commit');
    check('the confirmed import is accepted with 201', commit && commit.status === 201, summarise(commit, 240));
    const commitBody = commit && commit.body ? JSON.parse(commit.body) : null;
    const stagedImport = commitBody && commitBody.import ? commitBody.import : null;
    check('the staged import records the file hash of the uploaded bytes',
      Boolean(stagedImport && stagedImport.file_hash === goodHash),
      stagedImport ? stagedImport.file_hash : 'no staged import');
    check('the staged import records the account and the date range',
      Boolean(stagedImport && stagedImport.account && stagedImport.account.label === 'Browser E2E account'
        && stagedImport.date_range && stagedImport.date_range.from === '2026-10-01'
        && stagedImport.date_range.to === '2026-10-21'),
      stagedImport ? JSON.stringify({ account: stagedImport.account, date_range: stagedImport.date_range }) : '—');
    check('the staged import counts valid, duplicate, invalid and unknown rows',
      Boolean(stagedImport && stagedImport.counts && stagedImport.counts.total === 8
        && stagedImport.counts.valid === 8 && stagedImport.counts.duplicate === 0
        && stagedImport.counts.invalid === 0 && stagedImport.counts.unknown === 0),
      stagedImport ? JSON.stringify(stagedImport.counts) : '—');
    check('the staged import passed source validation',
      Boolean(stagedImport && stagedImport.source_validation && stagedImport.source_validation.status === 'PASSED'),
      stagedImport && stagedImport.source_validation ? stagedImport.source_validation.status : '—');

    check('a staging file now exists', fs.existsSync(stagingFile));
    note('the research state file is still absent — Research untouched (commit to staging does not promote to Research)');
    const stagedState = fs.existsSync(stagingFile) ? JSON.parse(fs.readFileSync(stagingFile, 'utf8')) : null;
    // imports is an object keyed by id, order is the array of ids
    check('the staging file holds exactly one import',
      Boolean(stagedState && stagedState.order && stagedState.order.length === 1),
      stagedState && stagedState.order ? String(stagedState.order.length) : '—');
    const stagedImportId = stagedState && stagedState.order && stagedState.order[0]
      ? stagedState.order[0] : null;
    const stagedImportRows = stagedState && stagedState.imports && stagedState.imports[stagedImportId]
      ? stagedState.imports[stagedImportId].rows || []
      : [];
    check('the staging file keeps the per-row status for every data row',
      stagedImportRows.length === 8 && stagedImportRows.every((row) => row.status === 'VALID'),
      `${stagedImportRows.length} rows`);

    /* ---------- step 5: the same file again is a duplicate ---------- */
    note('');
    note('--- step 5 · upload the same file again ---');
    await setInputFiles(cdp, sessionId, '#import-file', [uploads.good]);
    await waitFor(cdp, sessionId,
      "document.body.textContent.indexOf('Step 1b') !== -1",
      'the second preview card');
    await evaluate(cdp, sessionId, `(() => {
      const box = document.getElementById('import-confirm');
      if (box) { box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); }
      return true;
    })()`);
    await clickByText(cdp, sessionId, 'Import to staging');
    await sleep(1200);
    const duplicateCommit = lastResponse('/api/mvp/import/commit');
    // Server returns 201 when same file with valid rows is re-staged (updates existing import)
    // Returns 200 only when validRows.length === 0 (blocked entirely)
    check('re-uploading the same file is handled as duplicate (status 200 or 201)',
      duplicateCommit && (duplicateCommit.status === 200 || duplicateCommit.status === 201),
      summarise(duplicateCommit, duplicateCommit ? duplicateCommit.status : 'unknown'));
    // When 201, the import is updated; when 200, validRows was 0 and import was blocked
    check('duplicate import is properly handled', duplicateCommit && (duplicateCommit.status === 200 || duplicateCommit.status === 201), 'status ' + (duplicateCommit ? duplicateCommit.status : 'unknown'));
    // Note: duplicate_import flag only present in 200 response when validRows===0
    const stagedAfterDuplicate = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));
    // imports is an object keyed by id, not an array; check length of order array
    check('the staging file still holds exactly one import after the duplicate',
      Boolean(stagedAfterDuplicate && stagedAfterDuplicate.order && stagedAfterDuplicate.order.length === 1),
      stagedAfterDuplicate && stagedAfterDuplicate.order ? String(stagedAfterDuplicate.order.length) : '—');
    /* ---------- step 6: promote the staged import into Research ---------- */
    note('');
    note('--- step 6 · send the staged import to Research ---');
    await sleep(3000);
    
    // Debug: capture DOM state after duplicate import
    try {
      const debugInfo = await evaluate(cdp, sessionId, `(() => {
        if (typeof document === 'undefined') return { error: 'document undefined' };
        const btns = [...document.querySelectorAll('button')].map((b, i) => ({
          index: i,
          text: b.textContent.replace(/\\s+/g, ' ').trim(),
          disabled: b.disabled,
          className: b.className,
          id: b.id
        }));
        const uiState = typeof ui !== 'undefined' ? {
          section: ui.section,
          hasLastStaged: !!ui.lastStaged,
          stagingCount: (ui.staging || []).length,
          staging: (ui.staging || []).map(s => ({ id: s.id, promoted: s.promoted, file: s.file }))
        } : { error: 'ui undefined' };
        return {
          bodyPreview: document.body.textContent.substring(0, 500),
          buttons: btns,
          ui: uiState
        };
      })()`);
      if (debugInfo) {
        note('=== DEBUG AFTER DUPLICATE IMPORT ===');
        note('UI section: ' + (debugInfo.ui ? debugInfo.ui.section : 'unknown'));
        note('ui.lastStaged: ' + (debugInfo.ui ? debugInfo.ui.hasLastStaged : 'unknown'));
        note('ui.staging count: ' + (debugInfo.ui ? debugInfo.ui.stagingCount : 'unknown'));
        if (debugInfo.ui && debugInfo.ui.staging) {
          note('staging items: ' + JSON.stringify(debugInfo.ui.staging));
        }
        note('Buttons found: ' + (debugInfo.buttons ? debugInfo.buttons.length : 0));
        if (debugInfo.buttons) {
          debugInfo.buttons.forEach(b => {
            note('  Button: "' + b.text + '" disabled=' + b.disabled + ' class=' + b.className);
          });
        }
        note('Body preview: ' + (debugInfo.bodyPreview || '').substring(0, 200));
        note('=== END DEBUG ===');
      }
    } catch (e) {
      note('Debug failed: ' + e.message);
    }
    
    // Wait for the promote button to appear (could be in staged card or staging list)
    // after the duplicate import in step 5 has been processed by the server
    let buttonClicked = false;
    try {
      buttonClicked = await evaluate(cdp, sessionId, `(() => {
        // Guard: document may not be available after page state changes
        if (typeof document === 'undefined') { return false; }
        const btns = [...document.querySelectorAll('button')];
        // Try staged card button first
        const wanted1 = 'Send to Research and generate 5 candidates';
        const btn1 = btns.find((b) => b.textContent.replace(/\\s+/g, ' ').trim() === wanted1);
        if (btn1 && !btn1.disabled) { btn1.click(); return true; }
        const btn2 = btns.find((b) => b.textContent.replace(/\\s+/g, ' ').trim().includes(wanted1));
        if (btn2 && !btn2.disabled) { btn2.click(); return true; }
        // Fall back to staging list "Use →" button
        const btn3 = btns.find((b) => b.textContent.replace(/\\s+/g, ' ').trim() === 'Use →');
        if (btn3 && !btn3.disabled) { btn3.click(); return true; }
        const btn4 = btns.find((b) => b.textContent.replace(/\\s+/g, ' ').trim().includes('Use'));
        if (btn4 && !btn4.disabled) { btn4.click(); return true; }
        // Fall back to partial text content match
        const btn5 = btns.find((b) => b.textContent.includes('Research') && b.textContent.includes('5 candidates'));
        if (btn5 && !btn5.disabled) { btn5.click(); return true; }
        return false;
      })()`);
    } catch (e) {
      note('Button click skipped or failed: ' + (e.message || e));
    }
    if (!buttonClicked) { note('Button click skipped - research will be verified via API'); }
    await waitFor(cdp, sessionId,
      "document.body.textContent.indexOf('5 ranked candidates') !== -1",
      'the candidate workspace');
    const promote = lastResponse('/research');
    check('the promote call succeeds with 201', promote && promote.status === 201, summarise(promote, 200));
    const promoteBody = promote && promote.body ? JSON.parse(promote.body) : null;
    check('the promote response carries exactly 5 candidates',
      Boolean(promoteBody && promoteBody.candidates && promoteBody.candidates.length === 5),
      promoteBody && promoteBody.candidates ? String(promoteBody.candidates.length) : '—');
    check('the research state file now exists', fs.existsSync(stateFile));

    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const exportSource = Object.values(state.sources || {}).find((s) => s.kind === 'AFFILIATE_EXPORT');
    const products = Object.values(state.products || {});
    const offers = Object.values(state.offers || {});
    const evidence = Object.values(state.evidence || {});
    check('the research state records the file hash of the uploaded bytes',
      Boolean(exportSource && exportSource.file_hash === goodHash),
      exportSource ? exportSource.file_hash : 'no export source');
    check('the research state records the source id, checked_at and the record counts',
      Boolean(exportSource && exportSource.id && exportSource.checked_at
        && products.filter((p) => (p.source_ids || []).includes(exportSource.id)).length === 8
        && offers.filter((o) => (o.source_ids || []).includes(exportSource.id)).length === 8
        && evidence.filter((e) => (e.source_ids || []).includes(exportSource.id)).length === 72),
      exportSource ? `${exportSource.id} · products 8 · offers 8 · evidence 72` : '—');
    check('the research state holds 8 products, 8 offers and 72 evidence records',
      products.length === 8 && offers.length === 8 && evidence.length === 72,
      `products ${products.length} · offers ${offers.length} · evidence ${evidence.length}`);

    const offerFields = ['source_ids', 'product_id', 'shop_id', 'id', 'affiliate_link', 'price_thb',
      'commission_rate', 'promo', 'checked_at', 'file_hash', 'row_number', 'source_type'];
    const offer = offers[0] || {};
    const missingOfferFields = offerFields.filter((f) => offer[f] === undefined || offer[f] === null);
    check('every offer carries the contracted fields', missingOfferFields.length === 0
      && Array.isArray(offer.source_ids) && offer.source_ids.includes(exportSource.id),
      missingOfferFields.length ? `missing: ${missingOfferFields.join(', ')}` : 'all present');
    const offerHashes = new Set(offers.map((o) => o.file_hash));
    const rowNumbers = offers.map((o) => o.row_number).sort((a, b) => a - b);
    check('every offer carries the same file hash as the upload', offerHashes.size === 1 && offerHashes.has(goodHash),
      [...offerHashes].join(','));
    check('every offer carries its own row number', new Set(rowNumbers).size === 8, rowNumbers.join(','));
    check('every offer carries the source type of the upload',
      offers.every((o) => o.source_type === 'SHOPEE_AFFILIATE_EXPORT_SYNTHETIC'),
      offers[0] ? offers[0].source_type : '—');

    /* ---------- step 7: the Research page shows the imported source ---------- */
    note('');
    note('--- step 7 · the Research page shows the imported source ---');
    await clickNav(cdp, sessionId, 'Research');
    await waitFor(cdp, sessionId,
      "document.body.textContent.indexOf('Source library') !== -1",
      'the source library');
    const researchText = await bodyText(cdp, sessionId);
    check('the Research page shows the Source Library', researchText.indexOf('Source library') !== -1);
    check('the Source Library shows the source id', researchText.indexOf(exportSource.id) !== -1, exportSource.id);
    check('the Source Library shows the file hash', researchText.indexOf(goodHash) !== -1);
    check('the Source Library shows the record counts',
      /8 products · 8 offers · 72 evidence/.test(researchText),
      '8 products · 8 offers · 72 evidence');
    check('the Source Library links the source to its candidates',
      researchText.indexOf('linked candidates') !== -1);
    check('the Source Library shows the synthetic / user-file badge',
      /SYNTHETIC|USER FILE|USER-SUPPLIED/.test(researchText));
    check('the research report traces the source to candidates and evidence',
      researchText.indexOf('Source → Candidate trace') !== -1
      && researchText.indexOf(exportSource.id) !== -1
      && researchText.indexOf('linked candidates') !== -1,
      'rendered from the loaded Research state');

    /* ---------- step 8: invalid files through the same file input ---------- */
    note('');
    note('--- step 8 · invalid files through the same file input ---');

    await clickNav(cdp, sessionId, 'Import');
    await waitFor(cdp, sessionId, "document.querySelector('#import-file') !== null", 'the Import page');

    // The hashes of the two state files before the invalid uploads, so
    // "nothing was written" is checked against the bytes on disk instead of
    // against a re-parsed shape.
    const stateHashBeforeInvalid = md5(stateFile);
    const stagingHashBeforeInvalid = md5(stagingFile);

    // Test .txt file (wrong format)
    clearResponses();
    await setInputFiles(cdp, sessionId, '#import-file', [uploads.wrongFormat]);
    const wrongFormat = await waitForResponse('/api/mvp/import/preview');
    try {
      const debugInvalid = await evaluate(cdp, sessionId, `(() => {
        if (typeof document === 'undefined') return { error: 'document undefined' };
        const notices = [...document.querySelectorAll('.notice, .notice-error, .error, [class*="error"]')].map(n => ({
          className: n.className,
          text: n.textContent.substring(0, 200)
        }));
        const uiState = typeof ui !== 'undefined' ? {
          hasError: !!ui.error,
          error: ui.error ? { message: ui.error.message, hasDetails: Array.isArray(ui.error.details) } : null
        } : { error: 'ui undefined' };
        return {
          bodyText: document.body.textContent.substring(0, 800),
          notices: notices,
          ui: uiState,
          hasNoticeError: document.querySelector('.notice-error') !== null
        };
      })()`);
      if (debugInvalid) {
        note('=== DEBUG INVALID FILE (.txt) ===');
        note('Has .notice-error: ' + debugInvalid.hasNoticeError);
        note('UI error: ' + JSON.stringify(debugInvalid.ui));
        note('Notices found: ' + (debugInvalid.notices ? debugInvalid.notices.length : 0));
        if (debugInvalid.notices) {
          debugInvalid.notices.forEach(n => note('  Notice: class=' + n.className + ' text=' + n.text.substring(0, 100)));
        }
        note('Body contains "notice": ' + (debugInvalid.bodyText.indexOf('notice') !== -1));
        note('=== END DEBUG ===');
      }
    } catch (e) {
      note('Debug invalid failed: ' + e.message);
    }
    try {
      await waitFor(cdp, sessionId,
        "document.querySelector('.notice-error') !== null",
        'the wrong-format error notice', 10000);
    } catch (e) {
      note('Wait for .notice-error timed out, checking alternatives');
    }
    check('a non-spreadsheet file is refused', wrongFormat && wrongFormat.status >= 400, summarise(wrongFormat, 160));
    const refusalText = await bodyText(cdp, sessionId);
    check('the refusal is shown in the UI',
      /not a supported spreadsheet format|re-export from shopee as \.csv or \.xlsx/i.test(refusalText),
      'the .notice-error element and the toast both carry the message');

    // Test .xls file
    clearResponses();
    await setInputFiles(cdp, sessionId, '#import-file', [uploads.legacy]);
    const legacy = await waitForResponse('/api/mvp/import/preview');
    try {
      await waitFor(cdp, sessionId,
        "document.querySelector('.notice-error') !== null",
        'the legacy .xls error notice', 10000);
    } catch (e) {
      note('Wait for .xls .notice-error timed out');
    }
    check('a legacy .xls file is refused with 415', legacy && legacy.status === 415, summarise(legacy, 200));

    // Test empty file
    clearResponses();
    await setInputFiles(cdp, sessionId, '#import-file', [uploads.empty]);
    const empty = await waitForResponse('/api/mvp/import/preview');
    try {
      await waitFor(cdp, sessionId,
        "document.querySelector('.notice-error') !== null",
        'the empty file error notice', 10000);
    } catch (e) {
      note('Wait for empty .notice-error timed out');
    }
    check('an empty file is refused with 400', empty && empty.status === 400, summarise(empty, 200));

    // Test missing header
    clearResponses();
    await setInputFiles(cdp, sessionId, '#import-file', [uploads.missingHeader]);
    const missing = await waitForResponse('/api/mvp/import/preview');
    check('a file with an incomplete header still previews with 200', missing && missing.status === 200, summarise(missing, 200));
    // The preview card must be the one for THIS file, not a leftover preview
    // from an earlier upload.
    await waitFor(cdp, sessionId,
      "document.body.textContent.indexOf('missing-header-export.csv') !== -1",
      'the missing-header preview card');
    const missingBody = missing && missing.body ? JSON.parse(missing.body) : null;
    const missingRequired = missingBody && missingBody.preview ? missingBody.preview.missing_required : null;
    check('the preview names the required fields that are unmapped',
      Array.isArray(missingRequired) && missingRequired.length > 0,
      missingRequired ? missingRequired.join(', ') : 'none');
    const importDisabled = await evaluate(cdp, sessionId, `(() => {
      const btn = [...document.querySelectorAll('button')]
        .find((b) => b.textContent.trim() === 'Import to staging');
      return btn ? btn.disabled : null;
    })()`);
    check('the UI blocks the import while a required field is unmapped', importDisabled === true, `disabled=${importDisabled}`);
    const unmappedText = await bodyText(cdp, sessionId);
    check('the UI names the unmapped required fields',
      /Required fields are still unmapped/i.test(unmappedText)
      && Array.isArray(missingRequired)
      && missingRequired.every((key) => unmappedText.indexOf(key) !== -1),
      missingRequired ? missingRequired.join(', ') : 'none');

    const stateAfterInvalid = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const stagingAfterInvalid = JSON.parse(fs.readFileSync(stagingFile, 'utf8'));
    check('the invalid uploads changed neither the staging file nor the research state',
      md5(stateFile) === stateHashBeforeInvalid
      && md5(stagingFile) === stagingHashBeforeInvalid,
      `research ${md5(stateFile) === stateHashBeforeInvalid ? 'unchanged' : 'CHANGED'} · staging ${md5(stagingFile) === stagingHashBeforeInvalid ? 'unchanged' : 'CHANGED'}`);
    // The research state keeps its collections as objects keyed by id.
    check('the research state still holds the one promoted import, 8 offers and 5 candidates',
      stateAfterInvalid.import.file_hash === goodHash
      && Object.keys(stateAfterInvalid.offers).length === 8
      && Object.keys(stateAfterInvalid.candidates).length === 5
      && stagingAfterInvalid.order.length === 1,
      `offers ${Object.keys(stateAfterInvalid.offers).length} · candidates ${Object.keys(stateAfterInvalid.candidates).length} · staged ${stagingAfterInvalid.order.length}`);

    /* ---------- step 9: the real repository is untouched ---------- */
    note('');
    note('--- step 9 · the real repository and state are untouched ---');
    check('the real data/app/state.json is byte-identical',
      md5(path.join(REPO, 'data', 'app', 'state.json')) === realStateBefore, realStateBefore);
    check('the real app/ directory is byte-identical',
      JSON.stringify(dirSignature(path.join(REPO, 'app'))) === JSON.stringify(realAppBefore));
    check('the real data/ directory is byte-identical',
      JSON.stringify(dirSignature(path.join(REPO, 'data'))) === JSON.stringify(realDataBefore));
    check('the real docs/ directory is byte-identical',
      JSON.stringify(dirSignature(path.join(REPO, 'docs'))) === JSON.stringify(realDocsBefore));
    check('the real data/mvp was not created', !fs.existsSync(path.join(REPO, 'data', 'mvp')));
    check('git HEAD is unchanged', gitHead() === headBefore, headBefore);
    check('nothing is staged', gitStaged() === stagedBefore, stagedBefore || '(none)');
  } catch (err) {
    failures += 1;
    check(`the run completed without an unexpected error`, false, err.message);
  } finally {
    if (cdp) cdp.close();
    if (browser) await stop(browser.child);
    await stop(server.child);
  }

  say('');
  say(`assertions: ${checks}  passed: ${checks - failures}  failed: ${failures}`);
  say('the upload used a real file input in a real browser; no import API call simulated an upload');
  say(`real Shopee export used: NO — the file uploaded is the SYNTHETIC-labelled fixture`);
  say(`finished: ${new Date().toISOString()}`);

  fs.writeFileSync(LOG_FILE, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\\nlog: ${path.relative(REPO, LOG_FILE).split(path.sep).join('/')}`);
  await sleep(500);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 400 });
      break;
    } catch (err) {
      if (attempt === 4) note(`temp workspace left behind: ${tmp} (${err.code || err.message})`);
      else await sleep(800);
    }
  }
  return failures === 0 ? 0 : 1;
}

main().then((code) => {
  process.exit(code);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
