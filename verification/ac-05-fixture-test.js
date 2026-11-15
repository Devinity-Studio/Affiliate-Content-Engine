// AC-05 Fixture Test — G3 Approval Before Publication
// Scope: isolated fixture, simulated gate only, no production endpoint, no real publish
// Tag: FIXTURE ONLY · ไม่ต้องเผยแพร่จริง

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const REPO = process.cwd();
const SERVER_JS = path.join(REPO, 'app', 'server.js');
const SERVICE_JS = path.join(REPO, 'app', 'mvp', 'service.js');
const STATE_JSON = path.join(REPO, 'data', 'app', 'state.json');
const MVP_DIR = path.join(REPO, 'data', 'mvp');

// ---------- 1. Route availability ----------
function inspectRoutes() {
  const server = fs.existsSync(SERVER_JS) ? fs.readFileSync(SERVER_JS, 'utf8') : '';
  const service = fs.existsSync(SERVICE_JS) ? fs.readFileSync(SERVICE_JS, 'utf8') : '';
  const combined = server + '\n' + service;
  const delegates = /pathname\.startsWith\('\/api\/mvp\/'\)/.test(server);
  const has = (route) => combined.includes("'" + route + "'") || combined.includes('"' + route + '"');
  return {
    delegates,
    import: has('/api/mvp/import'),
    planDraft: has('/api/mvp/plan/draft'),
    impactPreview: has('/api/mvp/impact-preview'),
    pub: has('/api/mvp/pub'),
    postedAtField: combined.includes('posted_at'),
  };
}

// ---------- 2. Baseline / integrity ----------
function detectFileType(buf) {
  const c = buf.toString('utf8');
  if (c.includes('{') && c.includes('}')) return 'json';
  if (c.includes('import') || c.includes('require')) return 'module';
  if (c.includes('<') || c.includes('>')) return 'html';
  return 'text';
}

function getRecursiveFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full); else out.push(full);
    }
  })(dir);
  return out;
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function dirSignature(dir) {
  if (!fs.existsSync(dir)) return { _absent: true };
  const sig = {};
  for (const f of getRecursiveFiles(dir)) {
    const rel = path.relative(dir, f).split(path.sep).join('/');
    const buf = fs.readFileSync(f);
    sig[rel] = { size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), type: detectFileType(buf) };
  }
  return sig;
}

function recordBaseline() {
  let head = 'unavailable';
  try { head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim(); } catch (e) {}
  return {
    head,
    stateHash: fs.existsSync(STATE_JSON) ? sha256File(STATE_JSON) : 'absent',
    mvpSignature: dirSignature(MVP_DIR),
  };
}

function compareSignatures(before, after) {
  const kb = Object.keys(before).filter(k => k !== '_absent');
  const ka = Object.keys(after).filter(k => k !== '_absent');
  if (before._absent && after._absent) return { changed: false, detail: 'both absent' };
  if (kb.length !== ka.length) return { changed: true, detail: 'file count differs' };
  for (const k of kb) {
    if (!after[k]) return { changed: true, detail: 'missing after: ' + k };
    if (after[k].sha256 !== before[k].sha256) return { changed: true, detail: 'hash differs: ' + k };
  }
  for (const k of ka) if (!before[k]) return { changed: true, detail: 'added: ' + k };
  return { changed: false, detail: 'identical' };
}

// ---------- 3. Isolated fixture state ----------
function makeIsolatedState() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac05-fixture-'));
  const stateFile = path.join(dir, 'fixture-state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ run_history: [] }, null, 2));
  return { dir, stateFile };
}

function readStateFile(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function appendEntry(file, entry) {
  const state = readStateFile(file);
  state.run_history = state.run_history || [];
  state.run_history.push(entry);
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

// ---------- 4. Gate: evaluate + simulated request (persist + reload) ----------
function recordG3Approval(stateFile) {
  const ts = new Date().toISOString();
  appendEntry(stateFile, {
    kind: 'G3_DECISION', status: 'APPROVED', ts,
    actor: 'OWNER_OPERATOR', action: 'G3 DEC APPROVED (fixture)', result: 'APPROVED',
  });
  return ts;
}

function evaluateGate(state) {
  const h = Array.isArray(state.run_history) ? state.run_history : [];
  const g3 = h.filter(r => r.kind === 'G3_DECISION' && r.status === 'APPROVED' && r.ts);
  const pub = h.filter(r => r.kind === 'PUB' && r.result === 'OK' && r.posted_at);
  if (g3.length === 0) return { allowed: false, decision: 'BLOCKED_BY_GATE', reason: 'G3 decision not found' };
  if (pub.length > 0) return { allowed: false, decision: 'ALREADY_PUBLISHED', reason: 'PUB record already exists' };
  return { allowed: true, decision: 'ALLOWED', reason: 'G3 APPROVED precedes PUB' };
}

// Accepts an explicit simulated publication request, evaluates the gate, applies
// the outcome to isolated state, persists, then reloads from disk and reports
// only observed values (never a predicted boolean).
function simulatePubRequest(stateFile, request) {
  const before = readStateFile(stateFile);
  const decision = evaluateGate(before);
  const ts = new Date().toISOString();
  if (decision.allowed) {
    appendEntry(stateFile, {
      kind: 'PUB', request_id: request.request_id, ts, posted_at: ts,
      actor: 'OWNER_OPERATOR', action: 'PUB request (simulated)', result: 'OK',
    });
  } else {
    appendEntry(stateFile, {
      kind: 'PUB_ATTEMPT', request_id: request.request_id, ts,
      actor: 'OWNER_OPERATOR', action: 'PUB attempt (simulated)', result: 'BLOCKED_BY_GATE',
      error_detail: decision.reason, recovery: 'Record G3 decision then retry',
    });
  }
  const after = readStateFile(stateFile);
  const h = Array.isArray(after.run_history) ? after.run_history : [];
  const pubs = h.filter(r => r.kind === 'PUB' && r.result === 'OK');
  const blocked = h.filter(r => r.kind === 'PUB_ATTEMPT' && r.result === 'BLOCKED_BY_GATE');
  const last = pubs.length ? pubs[pubs.length - 1] : null;
  return {
    httpStatus: decision.allowed ? 201 : 409,
    decision: decision.decision,
    allowed: decision.allowed,
    pubRecordCount: pubs.length,
    blockedRecordCount: blocked.length,
    postedAt: last ? last.posted_at : null,
    reloadedHistory: h,
  };
}

// ---------- 5. Timestamps ----------
function parseTs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const d = new Date(v); if (!isNaN(d.getTime())) return d.getTime(); }
  return null;
}

function extractTimestamps(state) {
  const h = Array.isArray(state.run_history) ? state.run_history : [];
  const g3e = h.filter(r => r.kind === 'G3_DECISION' && r.status === 'APPROVED');
  const pube = h.filter(r => r.kind === 'PUB' && r.result === 'OK');
  const g3Times = g3e.map(e => parseTs(e.ts)).filter(t => t !== null);
  const pubTimes = pube.map(e => parseTs(e.posted_at !== undefined ? e.posted_at : e.ts)).filter(t => t !== null);
  return {
    g3Times, pubTimes,
    g3Entries: g3e.length, pubEntries: pube.length,
    ambiguous: g3e.length > 1 || pube.length > 1,
    complete: g3e.length === 1 && pube.length === 1 && g3Times.length === 1 && pubTimes.length === 1,
  };
}

// ---------- 6. Tests ----------
function test5A() {
  console.log('\n=== Test 5A: No G3 Approval -> Publication Rejected ===');
  const { dir, stateFile } = makeIsolatedState();
  const assertions = {};
  let result = { cleanupFailed: false };
  try {
    const observed = simulatePubRequest(stateFile, { request_id: 'REQ-5A-1' });
    const reloaded = readStateFile(stateFile);
    result = Object.assign(result, {
      httpStatus: observed.httpStatus,
      decision: observed.decision,
      pubRecordCount: observed.pubRecordCount,
      blockedRecordCount: observed.blockedRecordCount,
      postedAt: observed.postedAt,
    });
    assertions['simulated request rejected with 409'] = observed.httpStatus === 409;
    assertions['decision is BLOCKED_BY_GATE'] = observed.decision === 'BLOCKED_BY_GATE';
    assertions['no PUB record in reloaded fixture state'] = observed.pubRecordCount === 0;
    assertions['no posted_at in reloaded fixture state'] = observed.postedAt === null;
    assertions['BLOCKED_BY_GATE attempt recorded with detail'] = observed.blockedRecordCount === 1 &&
      reloaded.run_history.some(r => r.result === 'BLOCKED_BY_GATE' && r.error_detail);
    assertions['reloaded state has no PUB kind entry'] = !reloaded.run_history.some(r => r.kind === 'PUB');
  } catch (err) {
    console.error('Test 5A error: ' + err.message);
    result.contractGap = true;
    assertions['test 5A executed'] = false;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { result.cleanupFailed = true; }
  }
  const passed = Object.keys(assertions).length > 0 && Object.values(assertions).every(v => v === true);
  console.log('Test 5A ' + (passed ? 'PASS' : 'FAIL'));
  Object.keys(assertions).forEach(k => console.log('  - ' + k + ': ' + assertions[k]));
  console.log('  - reloaded posted_at: ' + String(result.postedAt));
  return {
    test: '5A', assertions, passed, evidence: 'FIXTURE ONLY',
    tag: 'FIXTURE ONLY - no G3 -> publication rejected', details: result,
  };
}

function test5BAnd5C() {
  console.log('\n=== Test 5B: G3 Approval -> Publication Accepted ===');
  const { dir, stateFile } = makeIsolatedState();
  const b = { cleanupFailed: false };
  const c = { cleanupFailed: false };
  const a5b = {};
  const a5c = {};
  let tG3 = null, tPub = null;
  try {
    const g3RecordedAt = recordG3Approval(stateFile);
    const observed = simulatePubRequest(stateFile, { request_id: 'REQ-5B-1' });
    const reloaded = readStateFile(stateFile);
    const reloadedPub = reloaded.run_history.filter(r => r.kind === 'PUB' && r.result === 'OK');
    Object.assign(b, {
      httpStatus: observed.httpStatus,
      decision: observed.decision,
      g3RecordedAt,
      pubRecordCount: observed.pubRecordCount,
      postedAt: observed.postedAt,
      pubPersistedOnDisk: reloadedPub.length === 1 && Boolean(reloadedPub[0].posted_at),
      contractGap: false,
    });
    a5b['simulated request accepted with 201'] = observed.httpStatus === 201;
    a5b['decision is ALLOWED'] = observed.decision === 'ALLOWED';
    a5b['PUB record persisted and reloaded from disk'] = b.pubPersistedOnDisk;
    a5b['PUB record carries posted_at'] = typeof observed.postedAt === 'string' && observed.postedAt.length > 0;
    a5b['exactly one PUB record'] = observed.pubRecordCount === 1;

    console.log('\n=== Test 5C: Timestamp Ordering Verification ===');
    const ts = extractTimestamps(reloaded);
    const again = readStateFile(stateFile);
    const g3e = again.run_history.filter(r => r.kind === 'G3_DECISION' && r.status === 'APPROVED');
    const pube = again.run_history.filter(r => r.kind === 'PUB' && r.result === 'OK');
    tG3 = ts.g3Times.length ? ts.g3Times[0] : null;
    tPub = ts.pubTimes.length ? ts.pubTimes[0] : null;
    const diff = (tG3 !== null && tPub !== null) ? tPub - tG3 : null;
    Object.assign(c, {
      g3Count: g3e.length, pubCount: pube.length, ambiguous: ts.ambiguous,
      tG3Iso: tG3 !== null ? new Date(tG3).toISOString() : null,
      tPubIso: tPub !== null ? new Date(tPub).toISOString() : null,
      diffMs: diff, timestampsValid: ts.complete && !ts.ambiguous,
    });
    a5c['exactly one G3 APPROVED record'] = g3e.length === 1;
    a5c['exactly one PUB record'] = pube.length === 1;
    a5c['timestamps parse to valid instants'] = tG3 !== null && tPub !== null;
    a5c['evidence is unambiguous'] = ts.ambiguous === false;
    a5c['T_G3 < T_PUB'] = diff !== null ? diff > 0 : false;
    a5c['T_PUB - T_G3 > 0'] = diff !== null ? diff > 0 : false;
  } catch (err) {
    console.error('Test 5B/5C error: ' + err.message);
    b.contractGap = true; c.contractGap = true;
    a5b['test 5B executed'] = false; a5c['test 5C executed'] = false;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); }
    catch (e) { b.cleanupFailed = true; c.cleanupFailed = true; }
  }
  const passedB = Object.keys(a5b).length > 0 && Object.values(a5b).every(v => v === true) && !b.contractGap;
  const passedC = Object.keys(a5c).length > 0 && Object.values(a5c).every(v => v === true) && !c.contractGap;
  console.log('Test 5B ' + (passedB ? 'PASS' : 'FAIL'));
  Object.keys(a5b).forEach(k => console.log('  - ' + k + ': ' + a5b[k]));
  console.log('  - reloaded posted_at: ' + String(b.postedAt));
  console.log('\nTest 5C ' + (passedC ? 'PASS' : 'FAIL'));
  Object.keys(a5c).forEach(k => console.log('  - ' + k + ': ' + a5c[k]));
  console.log('  - T_G3: ' + c.tG3Iso + ', T_PUB: ' + c.tPubIso + ', diff: ' + c.diffMs + ' ms');
  return [
    { test: '5B', assertions: a5b, passed: passedB, evidence: 'FIXTURE ONLY',
      tag: 'FIXTURE ONLY - G3 approved -> PUB allowed', details: b },
    { test: '5C', assertions: a5c, passed: passedC, evidence: 'FIXTURE ONLY',
      tag: 'FIXTURE ONLY - G3 -> PUB ordering', details: c },
  ];
}

// ---------- 7. Main ----------
function main() {
  console.log('AC-05 Fixture Test - G3 Approval Before Publication');
  console.log('Tag: FIXTURE ONLY');
  console.log('');
  if (!fs.existsSync(SERVER_JS)) { console.error('FATAL: ' + SERVER_JS + ' not found'); process.exit(1); }

  const routes = inspectRoutes();
  console.log('=== Route availability (source dispatch) ===');
  console.log('  server.js delegates /api/mvp/* : ' + routes.delegates);
  console.log('  /api/mvp/import          : ' + routes.import);
  console.log('  /api/mvp/plan/draft      : ' + routes.planDraft);
  console.log('  /api/mvp/impact-preview  : ' + routes.impactPreview);
  console.log('  /api/mvp/pub             : ' + routes.pub);
  console.log('  posted_at field present  : ' + routes.postedAtField);
  const apiContractGap = !routes.pub || !routes.postedAtField;
  console.log('  API-path contract gap    : ' + apiContractGap +
    (apiContractGap ? ' (no production publication route - fixture results are NOT API validation)' : ''));

  const baseline = recordBaseline();
  console.log('\n=== Baseline recorded ===');
  console.log('  Git HEAD: ' + baseline.head);
  console.log('  data/app/state.json SHA-256: ' + baseline.stateHash);
  console.log('  data/mvp/ signature: ' + (baseline.mvpSignature._absent ? 'absent' : Object.keys(baseline.mvpSignature).length + ' files'));

  const results = [test5A()].concat(test5BAnd5C());

  console.log('\n=== Integrity Checks After Test Run ===');
  let headChanged = false;
  if (baseline.head !== 'unavailable') {
    try {
      const after = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
      headChanged = after !== baseline.head;
      console.log('Git HEAD ' + (headChanged ? 'CHANGED' : 'unchanged') + ' (before: ' + baseline.head + ', after: ' + after + ')');
    } catch (e) { console.warn('Git HEAD check unavailable after tests'); }
  }
  const stateAfter = fs.existsSync(STATE_JSON) ? sha256File(STATE_JSON) : 'absent';
  const stateChanged = stateAfter !== baseline.stateHash;
  console.log('data/app/state.json ' + (stateChanged ? 'CHANGED' : 'unchanged') + ' (before: ' + baseline.stateHash + ', after: ' + stateAfter + ')');
  const sigCmp = compareSignatures(baseline.mvpSignature, dirSignature(MVP_DIR));
  console.log('data/mvp/ signature ' + (sigCmp.changed ? 'CHANGED' : 'unchanged') + ' (' + sigCmp.detail + ')');
  const anyCleanupFailed = results.some(r => r.details && r.details.cleanupFailed === true);

  console.log('\n=== Results Summary ===');
  results.forEach(r => console.log('[' + r.test + '] ' + (r.passed ? 'PASS' : 'FAIL') + ' - ' + r.tag));
  console.log('Fixture assertions: ' + results.filter(r => r.passed).length + '/' + results.length + ' tests');
  console.log('API-path contract gap: ' + apiContractGap);
  console.log('Cleanup failures: ' + anyCleanupFailed);

  const integrityOk = !headChanged && !stateChanged && !sigCmp.changed;
  const fixtureAllPass = results.every(r => r.passed && !(r.details && r.details.contractGap));
  const exitCode = (integrityOk && fixtureAllPass && !anyCleanupFailed && !apiContractGap) ? 0 : 1;

  console.log('\n--- Output Tags ---');
  console.log('FIXTURE ONLY - simulated gate tests fixture logic only; production enforcement unverified');
  console.log('\nOverall: ' + (exitCode === 0 ? 'PASS' : (apiContractGap ? 'FAILED_CONTRACT_GAP' : 'FAILED_TESTS')));
  console.log('Exit code: ' + exitCode);
  process.exit(exitCode);
}

main();
