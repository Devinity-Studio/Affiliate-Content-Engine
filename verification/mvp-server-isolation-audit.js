'use strict';

/**
 * Isolation audit for the MVP slice.
 *
 * Answers two questions with evidence:
 *   1. Is the /api/mvp delegation in app/server.js separate from the Foundation
 *      routes (Plan Version, CWI, state, decisions, mock opportunities)?
 *   2. Did this round stage, commit or accidentally merge any pre-existing
 *      uncommitted work from another person or earlier round?
 *
 * Static checks read app/server.js and app/mvp/service.js; behavioural checks
 * run a throwaway copy of app/, data/ and docs/ and exercise both API families.
 *
 * Usage: node verification/mvp-server-isolation-audit.js
 * Exit:  0 = every assertion passed, 1 = at least one failed.
 */

const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.MVP_ISOLATION_PORT || 4315);
const BASE = `http://127.0.0.1:${PORT}`;
const SERVER = path.join(REPO, 'app', 'server.js');
const SERVICE = path.join(REPO, 'app', 'mvp', 'service.js');

let failures = 0;
function check(label, ok, detail) {
  const pass = Boolean(ok);
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  return pass;
}
function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}
function sh(args) {
  return String(spawnSync('git', args, { cwd: REPO, encoding: 'utf8' }).stdout || '').trim();
}
function lineOf(text, needle) {
  return text.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

// Removes comments and string/template literals so documentation text cannot be
// mistaken for a code dependency (e.g. "never writes data/app/state.json").
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
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
  console.log(`  ${method} ${urlPath} -> ${res.status}  ${JSON.stringify(parsed).slice(0, 200)}`);
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

async function waitForHealth() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

(async () => {
  console.log('=== MVP server isolation audit — temporary workspace ===');
  console.log(`repository: ${REPO}`);
  console.log('');

  const serverText = fs.readFileSync(SERVER, 'utf8');
  const serviceText = fs.readFileSync(SERVICE, 'utf8');
  const serverLines = serverText.split('\n');

  /* ---------- 1. Static footprint ---------- */
  console.log('--- 1. app/server.js footprint ---');
  const mvpLines = serverLines
    .map((line, index) => ({ n: index + 1, line }))
    .filter(({ line }) => /mvp|MVP/.test(line));
  for (const { n, line } of mvpLines) console.log(`  L${n}: ${line.trim()}`);
  check('MVP is referenced on only the require + delegation lines (4 lines)',
    mvpLines.length === 4, `${mvpLines.length} matching lines`);
  check('exactly one /api/mvp/ dispatch exists in server.js',
    (serverText.match(/\/api\/mvp\//g) || []).length === 1);
  check('exactly one require of the MVP module exists',
    (serverText.match(/require\('\.\/mvp\/service'\)/g) || []).length === 1);
  check('the require is a top-level constant named mvp',
    serverLines.some((line) => line.trim() === "const mvp = require('./mvp/service');"));

  const dispatchLine = lineOf(serverText, "pathname.startsWith('/api/mvp/')");
  const firstFoundationRoute = Math.min(
    lineOf(serverText, "pathname === '/api/opportunities'"),
    lineOf(serverText, "pathname === '/api/plan-version'"),
    lineOf(serverText, "pathname === '/api/state'"),
    lineOf(serverText, "pathname === '/api/content-work-item'"),
    lineOf(serverText, "pathname === '/api/decision'"),
  );
  check('delegation runs before every Foundation route', dispatchLine > 0 && dispatchLine < firstFoundationRoute,
    `delegation L${dispatchLine} < first Foundation L${firstFoundationRoute}`);
  const dispatchBlock = serverLines.slice(dispatchLine - 2, dispatchLine + 2).join('\n');
  check('delegation always returns (cannot fall through to Foundation routes)',
    /await mvp\.handleMvp\([\s\S]*?\);\s*\n\s*return;/.test(dispatchBlock), dispatchBlock.replace(/\n/g, ' | '));

  const foundationSentinels = [
    "const STATE_FILE = path.join(STATE_DIR, 'state.json');",
    'async function readState()',
    'async function writeState(state)',
    "if (pathname === '/api/state' && req.method === 'GET')",
    "if (pathname === '/api/plan-version' && req.method === 'POST')",
    "if (pathname === '/api/content-work-item' && req.method === 'POST')",
    "if (pathname === '/api/decision' && req.method === 'POST')",
  ];
  const missingSentinels = foundationSentinels.filter((needle) => !serverText.includes(needle));
  check('all Foundation handler anchors are present unchanged', missingSentinels.length === 0,
    missingSentinels.length ? missingSentinels.join(' | ') : `${foundationSentinels.length} anchors`);

  /* ---------- 2. Module independence ---------- */
  console.log('');
  console.log('--- 2. app/mvp/service.js independence ---');
  const requires = [...serviceText.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
  check('MVP module requires node builtins and local modules only',
    requires.every((name) => name.startsWith('node:') || name.startsWith('.')),
    requires.join(', '));
  check('MVP module does not import the server or Foundation modules',
    !requires.some((name) => name.includes('server') || name.includes('foundation') || name.includes('cwi')));
  check('MVP module has its own state file constant',
    /const STATE_FILE = process\.env\.ACE_MVP_STATE_FILE/.test(serviceText));
  const serviceCode = codeOnly(serviceText);
  const riskyIdentifiers = ['planVersions', 'cwis', 'readMock', 'ensureState', 'withStateLock'];
  const foundRisky = riskyIdentifiers.filter((token) => new RegExp(`\\b${token}\\b`).test(serviceCode));
  if (serviceCode.includes('data/app/state.json')) foundRisky.push('data/app/state.json');
  check('MVP module never references Foundation state, mock or lock symbols',
    foundRisky.length === 0, foundRisky.length ? foundRisky.join(', ') : 'none');
  check('MVP module contains no HTTP call to Foundation routes',
    !/\bfetch\s*\(|\bhttps?\.request\b|require\('node:http'\)/.test(serviceCode));
  check('MVP module has its own staging file constant',
    /const STAGING_FILE = process\.env\.ACE_MVP_STAGING_FILE/.test(serviceText));
  const importerPath = path.join(REPO, 'app', 'mvp', 'importer.js');
  const importerText = fs.readFileSync(importerPath, 'utf8');
  const importerCode = codeOnly(importerText);
  const importerRequires = [...importerText.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
  check('importer module requires node builtins only',
    importerRequires.every((name) => name.startsWith('node:')),
    importerRequires.join(', ') || 'none');
  check('importer module makes no network call and opens no socket',
    !/\bfetch\s*\(|\bhttps?\.request\b|node:http|node:net|node:dgram/.test(importerCode));
  check('importer module never reads the Foundation state file',
    !importerCode.includes('data/app/state.json') && !importerCode.includes('data/app'));
  check('importer module has no file-write calls (preview stays in memory)',
    !/\bfsp\.writeFile|\bfs\.writeFile|\bfsp\.mkdir|\bfs\.mkdir/.test(importerCode));

  /* ---------- 3. Runtime separation ---------- */
  console.log('');
  console.log('--- 3. runtime separation on a temp copy ---');
  const realTracked = {
    state: path.join(REPO, 'data', 'app', 'state.json'),
    server: SERVER,
    schema: path.join(REPO, 'docs', 'mission1', 'schemas', 'content-work-item.schema.json'),
  };
  const realBefore = Object.fromEntries(Object.entries(realTracked).map(([key, file]) => [key, md5(file)]));
  const headBefore = sh(['rev-parse', 'HEAD']);
  const commitCountBefore = sh(['rev-list', '--count', 'HEAD']);
  const stagedBefore = sh(['diff', '--cached', '--name-only']);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-mvp-isolation-'));
  for (const dir of ['app', 'data', 'docs']) fs.cpSync(path.join(REPO, dir), path.join(tmp, dir), { recursive: true });
  const mvpStateFile = path.join(tmp, 'mvp-runtime', 'fixture-state.json');
  const tempFoundationState = path.join(tmp, 'data', 'app', 'state.json');
  const foundationBefore = fs.readFileSync(tempFoundationState, 'utf8');
  const foundationMd5Before = md5(tempFoundationState);

  const { child, log } = startServer(tmp, mvpStateFile);
  try {
    check('server becomes healthy with both API families', await waitForHealth());

    const health = await call('GET', '/api/health');
    check('Foundation health response is unchanged', health.status === 200
      && health.body.ok === true && health.body.mock === true
      && health.body.stateFile === 'data/app/state.json');

    const meta = await call('GET', '/api/mvp/meta');
    check('MVP meta points at its own state file, not data/app/state.json',
      meta.status === 200
      && meta.body.state_file.endsWith('mvp-runtime/fixture-state.json')
      && !meta.body.state_file.includes('data/app'),
      meta.body.state_file);

    // Exercise the whole MVP pipeline.
    const imported = await call('POST', '/api/mvp/import', {});
    const generated = await call('POST', '/api/mvp/candidates/generate', {});
    const candidateId = generated.body.candidates[0].id;
    const saved = await call('POST', `/api/mvp/candidates/${candidateId}/action`, { action: 'SAVE' });
    const queued = await call('POST', `/api/mvp/candidates/${generated.body.candidates[1].id}/action`, { action: 'QUEUE' });
    const reorder = await call('POST', '/api/mvp/queue/reorder', {
      candidateId: generated.body.candidates[1].id, direction: 'UP',
    });
    const draft = await call('POST', '/api/mvp/plan/draft', { candidateId });
    await call('POST', '/api/mvp/plan/custom', {
      draftId: draft.body.draft.id,
      angle: 'Isolation audit custom angle for cat owners with a portion demo.',
    });
    const plan = await call('POST', '/api/mvp/plan', {
      draftId: draft.body.draft.id, approach: 'user_custom', confirmImpact: true,
    });

    const mvpOk = imported.status === 201 && generated.status === 201
      && saved.status === 200 && queued.status === 200 && reorder.status === 200
      && draft.status === 201 && plan.status === 201;
    check('MVP pipeline runs end to end (import → plan)', mvpOk);

    const foundationAfterMvp = await call('GET', '/api/state');
    const foundationMd5AfterMvp = md5(tempFoundationState);
    const foundationResponseKeys = Object.keys(foundationAfterMvp.body).sort();
    const foundationOwnedKeys = ['schemaVersion', 'cycle', 'selectedOpportunityId', 'lastDecisionAt', 'decisions', 'planVersions', 'cwis'];
    check('Foundation /api/state contains no MVP fields',
      foundationResponseKeys.every((key) => foundationOwnedKeys.includes(key))
      && !foundationResponseKeys.some((key) => /^mvp|fixture|candidate|queue|planDraft/i.test(key)),
      foundationResponseKeys.join(','));
    check('Foundation state values are still empty/default',
      (foundationAfterMvp.body.decisions || []).length === 0
      && Object.keys(foundationAfterMvp.body.planVersions || {}).length === 0
      && Object.keys(foundationAfterMvp.body.cwis || {}).length === 0
      && foundationAfterMvp.body.selectedOpportunityId === null);
    check('Foundation decisions/plans/CWIs were not written by MVP traffic',
      foundationMd5AfterMvp === foundationMd5Before
      && (foundationAfterMvp.body.decisions || []).length === 0
      && Object.keys(foundationAfterMvp.body.planVersions || {}).length === 0
      && Object.keys(foundationAfterMvp.body.cwis || {}).length === 0,
      `${foundationMd5Before} -> ${foundationMd5AfterMvp}`);

    // Now use Foundation endpoints and prove the MVP state is unaffected.
    const mvpStateBeforeFoundation = await call('GET', '/api/mvp/state');
    const foundationPlan = await call('POST', '/api/plan-version', {
      operation: 'create', content: 'Isolation audit foundation plan',
    });
    const cwi = await call('POST', '/api/content-work-item', {
      plan_id: 'PLAN-1-1', plan_version: 'v1', type: 'PRODUCT', product_id: 'P-AUDIT',
    });
    const foundationState = await call('GET', '/api/state');
    check('Foundation Plan Version and CWI still work normally',
      foundationPlan.status === 201 && foundationPlan.body.id === 'PLAN-1-1-v1'
      && cwi.status === 201 && cwi.body.id === 'CWI-1'
      && Object.keys(foundationState.body.planVersions).length === 1
      && Object.keys(foundationState.body.cwis).length === 1);
    check('MVP plan did not enter the Foundation plan store',
      !Object.keys(foundationState.body.planVersions).some((id) => id.startsWith('MVP-')),
      Object.keys(foundationState.body.planVersions).join(','));
    const foundationLookupOfMvp = await call('GET', '/api/plan-version/MVP-PLAN-1-1-v1');
    check('Foundation rejects the MVP plan id (namespaces do not overlap)',
      foundationLookupOfMvp.status === 400, `status ${foundationLookupOfMvp.status}`);

    const mvpStateAfterFoundation = await call('GET', '/api/mvp/state');
    check('Foundation traffic did not change MVP candidates, queue or plans',
      mvpStateAfterFoundation.body.summary.candidates === mvpStateBeforeFoundation.body.summary.candidates
      && mvpStateAfterFoundation.body.summary.plans === mvpStateBeforeFoundation.body.summary.plans
      && JSON.stringify(mvpStateAfterFoundation.body.queue) === JSON.stringify(mvpStateBeforeFoundation.body.queue));

    const page = await fetch(`${BASE}/mvp.html`);
    const classic = await fetch(`${BASE}/`);
    check('both pages are served from the same static root', page.status === 200 && classic.status === 200,
      `/mvp.html ${page.status} · / ${classic.status}`);

    /* ---------- 3b. Import / Source Library isolation ---------- */
    console.log('');
    console.log('--- 3b. import + source library isolation ---');
    const stagingFile = path.join(tmp, 'mvp-runtime', 'staging-state.json');
    const uploadFixture = fs.readFileSync(path.join(REPO, 'app', 'mvp', 'fixtures', 'synthetic-shopee-export.csv'));
    const upload = {
      filename: 'synthetic-shopee-export.csv',
      content_base64: uploadFixture.toString('base64'),
    };
    const foundationMd5BeforeImport = md5(tempFoundationState);
    const mvpStateMd5BeforePreview = md5(mvpStateFile);

    const previewCall = await call('POST', '/api/mvp/import/preview', upload);
    check('import preview returns 200', previewCall.status === 200, `status ${previewCall.status}`);
    check('import preview writes no staging file and does not change the research state',
      !fs.existsSync(stagingFile) && md5(mvpStateFile) === mvpStateMd5BeforePreview,
      `staging ${fs.existsSync(stagingFile)} state ${md5(mvpStateFile)}`);
    check('import preview leaves the Foundation state file byte-identical',
      md5(tempFoundationState) === foundationMd5BeforeImport);

    const commitCall = await call('POST', '/api/mvp/import/commit', {
      ...upload,
      mapping: previewCall.body.preview.mapping,
      account: { label: 'Isolation audit account' },
      date_range: { from: '2026-10-01', to: '2026-10-21' },
      confirmMapping: true,
    });
    check('import commit returns 201 and writes only the staging file',
      commitCall.status === 201
      && fs.existsSync(stagingFile)
      && md5(mvpStateFile) === mvpStateMd5BeforePreview,
      `status ${commitCall.status} staging ${fs.existsSync(stagingFile)}`);
    check('import commit leaves the Foundation state file byte-identical',
      md5(tempFoundationState) === foundationMd5BeforeImport);

    const stagingList = await call('GET', '/api/mvp/staging');
    check('the staging list is served from the MVP staging file',
      stagingList.status === 200
      && stagingList.body.staging_file.includes('mvp-runtime/staging-state.json')
      && !stagingList.body.staging_file.includes('data/app'),
      stagingList.body.staging_file);

    const promoteCall = await call('POST', `/api/mvp/staging/${commitCall.body.import.id}/research`, {
      generateCandidates: true,
    });
    check('promote writes the MVP research state only',
      promoteCall.status === 201
      && fs.existsSync(mvpStateFile)
      && md5(tempFoundationState) === foundationMd5BeforeImport,
      `status ${promoteCall.status}`);

    const sourceLibrary = await call('GET', '/api/mvp/state');
    const exportSource = (sourceLibrary.body.sources || []).find((source) => source.kind === 'AFFILIATE_EXPORT');
    check('the Source Library lists the staged export with its hash, checked_at and record counts',
      Boolean(exportSource)
      && /^[a-f0-9]{64}$/.test(exportSource.file_hash || '')
      && !Number.isNaN(Date.parse(exportSource.checked_at))
      && exportSource.record_counts.products === 8
      && exportSource.record_counts.offers === 8
      && exportSource.record_counts.evidence > 0,
      JSON.stringify(exportSource && exportSource.record_counts));
    check('the Source Library links the source_id to the candidates',
      Array.isArray(exportSource.linked_candidates) && exportSource.linked_candidates.length === 5,
      String((exportSource.linked_candidates || []).length));
    check('the source library marks the data as synthetic',
      exportSource.synthetic === true && exportSource.source_type === 'SHOPEE_AFFILIATE_EXPORT_SYNTHETIC');

    const researchReport = await call('GET', '/api/mvp/research-report');
    check('the research report traces the source and spends nothing',
      researchReport.status === 200
      && researchReport.body.sources.some((source) => source.id === exportSource.id && source.linked_candidates.length === 5)
      && researchReport.body.boundaries.spend_thb === 0
      && researchReport.body.boundaries.external_calls === 0);

    const archiveCall = await call('POST', `/api/mvp/sources/${exportSource.id}/archive`, {
      confirm: true, reason: 'Isolation audit',
    });
    check('archiving a source keeps the evidence and blocks generation',
      archiveCall.status === 200
      && archiveCall.body.evidence_preserved > 0
      && archiveCall.body.candidates_preserved.length === 5
      && archiveCall.body.generation_blocked === true);
    const blockedGenerate = await call('POST', '/api/mvp/candidates/generate', {});
    check('candidate generation is refused while the source is archived',
      blockedGenerate.status === 409, `status ${blockedGenerate.status}`);

    check('the Foundation state file is still byte-identical after the whole import flow',
      md5(tempFoundationState) === foundationMd5BeforeImport,
      `${foundationMd5BeforeImport} -> ${md5(tempFoundationState)}`);
    const foundationAfterImport = await call('GET', '/api/state');
    check('the Foundation state has no import, staging or source fields',
      !('import' in foundationAfterImport.body)
      && !('staging' in foundationAfterImport.body)
      && !('sources' in foundationAfterImport.body),
      Object.keys(foundationAfterImport.body).join(','));

    const serverErrors = log.join('').split('\n').filter((line) => /\[ace-mvp\].*failed|Internal error/.test(line));
    check('no 500s or MVP request failures in the server log', serverErrors.length === 0,
      serverErrors.join(' | ') || 'clean');
  } finally {
    await stop(child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  /* ---------- 4. Repository hygiene ---------- */
  console.log('');
  console.log('--- 4. repository hygiene ---');
  const realAfter = Object.fromEntries(Object.entries(realTracked).map(([key, file]) => [key, md5(file)]));
  check('real Foundation state and server are byte-identical after the audit',
    realBefore.state === realAfter.state && realBefore.server === realAfter.server && realBefore.schema === realAfter.schema,
    `state ${realAfter.state}`);

  const headAfter = sh(['rev-parse', 'HEAD']);
  const commitCountAfter = sh(['rev-list', '--count', 'HEAD']);
  const stagedAfter = sh(['diff', '--cached', '--name-only']);
  check('no commit created and no commit count change',
    headBefore === headAfter && commitCountBefore === commitCountAfter,
    `${headBefore} (${commitCountBefore})`);
  check('nothing is staged', stagedBefore === stagedAfter && stagedAfter === '', stagedAfter || '(empty)');

  const trackedModified = sh(['diff', '--name-only']).split('\n').filter(Boolean);
  const preExistingDocs = [
    'docs/mission1/A-product-specification.md',
    'docs/mission1/B-workflow-specification.md',
    'docs/mission1/C-system-architecture.md',
    'docs/mission1/D-data-model.md',
    'docs/mission1/E-vertical-slice-acceptance.md',
    'docs/mission1/F-implementation-roadmap.md',
    'docs/mission1/G-open-questions-decision-log.md',
    'docs/mission1/H-evidence-register.md',
  ];
  check('only pre-existing tracked doc edits remain in the working tree',
    trackedModified.length === preExistingDocs.length
    && preExistingDocs.every((file) => trackedModified.includes(file)),
    trackedModified.join(', '));

  const ourFiles = [
    'app/server.js', 'app/README.md', '.gitignore', 'app/mvp/service.js',
    'app/mvp/importer.js',
    'app/mvp/fixtures/shopee-affiliate-export-2026-10-21.csv',
    'app/mvp/fixtures/synthetic-shopee-export.csv',
    'app/mvp/fixtures/synthetic-shopee-export.json',
    'app/mvp/fixtures/synthetic-shopee-export.xlsx',
    'app/mvp/fixtures/synthetic-shopee-export-th.csv',
    'app/public/mvp.html', 'app/public/mvp.js', 'app/public/mvp.css',
    'docs/mission1/M-mvp-affiliate-workflow-slice.md',
    'verification/mvp-workflow-acceptance.js', 'verification/mvp-server-isolation-audit.js',
    'verification/import-source-acceptance.js', 'verification/real-shopee-export-check.js',
    'verification/make-synthetic-import-fixtures.js',
  ];
  const trackedOurFiles = sh(['ls-files', ...ourFiles]).split('\n').filter(Boolean);
  check('none of this round\'s files is tracked or staged', trackedOurFiles.length === 0,
    trackedOurFiles.join(', ') || 'all untracked');

  const mtime = (file) => fs.statSync(path.join(REPO, file)).mtimeMs;
  const earliestOurFile = Math.min(...ourFiles.map(mtime));
  const newestPreExistingDoc = Math.max(...preExistingDocs.map(mtime));
  check('every pre-existing doc was last modified before this round\'s files',
    newestPreExistingDoc < earliestOurFile,
    `docs newest ${new Date(newestPreExistingDoc).toISOString()} < our earliest ${new Date(earliestOurFile).toISOString()}`);

  const statusShort = sh(['status', '--short']);
  console.log('');
  console.log('  git status --short (first 25 lines):');
  for (const line of statusShort.split('\n').slice(0, 25)) console.log(`    ${line}`);

  console.log('');
  console.log(`assertions failed: ${failures}`);
  if (failures) {
    console.error('MVP server isolation audit FAILED');
    process.exit(1);
  }
  console.log('MVP server isolation audit passed (temporary workspace, no commit)');
})();
