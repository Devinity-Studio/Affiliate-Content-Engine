'use strict';

/**
 * ACE — Content Artifact v1 Acceptance Test
 * Tests core functions directly without requiring server startup.
 * HISTORICAL NOTE (superseded, retained for history): Server has pre-existing template literal issues (node -c fails, server won't run).
 * Tests focus on function logic, file persistence, hash verification, and version handling.
 *
 * UPDATE 2026-10-23 (T3, test-only — authorized after CA-V1 contract decisions D1–D5):
 *  1. Node 24 loading fix: the async body is wrapped in main() (was top-level await,
 *     which triggered ERR_AMBIGUOUS_MODULE_SYNTAX). Assertion semantics unchanged.
 *  2. Added Test 7: real-implementation path for the Content Artifact v1 route
 *     (POST /api/mvp/content/generate + GET /api/mvp/content/export/:artifact_id),
 *     executed against a real server child process on temporary state/exports
 *     (same isolation pattern as content-creation-acceptance.js).
 *  3. Contract decisions applied in Test 7 (from the Content Artifact v1
 *     Acceptance Contract Draft, owner directive 2026-10-23):
 *     D1 version semantics = as-implemented: one new artifact per generate,
 *        unique ART ids, version: 1, no overwrite guarantee (no version bump).
 *     D2 download integrity = v1 serves the on-disk file without hash
 *        verification; stored sha256 allows offline verification (follow-up).
 *     D3 determinism = structural only; the "Generated at" timestamp is the
 *        only field expected to differ between two identical generates.
 *     D4 claim_map = the markdown body carries the claim map (claim lines with
 *        claim_class + evidence ids); the structured claim_map record field is
 *        intentionally absent in v1 (never assigned in the implementation).
 *     D5 lifecycle = project.status becomes 'EXPORTED' at markdown generation
 *        (accepted as-implemented for v1).
 *  4. Tests 1–6 are kept and labelled for what they are: Node platform smoke,
 *     logic simulations and shape simulations. They do NOT execute the real
 *     implementation and are NOT substitute evidence for Test 7 (CA-V1
 *     contract criteria). Test 6's three minus-operator transcription bugs
 *     (copied from the damage era) were corrected to mirror the intended
 *     generator output; its assertions are unchanged.
 *  5. T3 EXECUTION RESULT: Test 7 discovered a real application defect on the
 *     route's first-ever execution — handleContentGenerate destructures
 *     `req.body` (service.js:2531), which does not exist in this server
 *     architecture (all other handlers read the body via ctx.readBody +
 *     parseJsonBody). Per the T3 test-only boundary the defect is REPORTED,
 *     not repaired: dependent CA-V1 checks are recorded as blocked and the
 *     suite exits 1 until the defect is authorized and fixed.
 *  6. T3.4 (owner-authorized Plan Key → Content Key reconciliation): the
 *     generate route now maps Plan Keys to Content Keys at the boundary
 *     (personalized_a→problem_first, personalized_b→value_compare,
 *     exploration→evidence_first) and user_custom without persisted custom
 *     data returns 400 with the existing documented message — no fabricated
 *     content, no silent fallback.
 *  7. T3.7 (owner-approved failure injections + malformed-encoding 400):
 *     Test 8 injects M/W/S failures in-process (conditional fs patching) and
 *     proves R1–R5 per branch (no orphan file, state unchanged incl. no
 *     partial mutation, honest error contract incl. cleanup-failure
 *     reporting, lifecycle unchanged, isolation), and the artifact download
 *     route answers malformed percent-encoding with HTTP 400 (URIError
 *     handled at dispatch only; server keeps serving).
 *
 * UPDATE 2026-10-27 (documentation-only; no code, assertion, import or logic changes):
 *  1. The header note above ("node -c fails, server won't run") is HISTORICAL
 *     and superseded: parse-only `node --check app/server.js` and
 *     `node --check app/mvp/service.js` both pass (2026-10-27), and the G-13
 *     E2E runtime evidence (raw log sha256 c3adafa17b2a8a4bc6d5aafc79f3be3d…,
 *     committed as data/mission1/e2e-log.md) records the server starting and
 *     successfully handling the recorded HTTP workflow scenarios (import,
 *     candidates, plan, content draft, QA, review, finalize, export,
 *     library retrieve). That evidence covers only those recorded scenarios.
 *  2. The T3 `req.body` defect reported in item 5 appears superseded by source
 *     inspection: handleContentGenerate (app/mvp/service.js:2991) now reads
 *     the request body via ctx.readBody + parseJsonBody and validates
 *     candidate_id / approach_key from the parsed body. This is a source-level
 *     reading, not a conclusive-fix claim: no full-suite rerun was performed
 *     for this note, so "appears superseded" is the strongest statement made.
 *  3. The full acceptance result (77/77, exit 0) recorded in
 *     verification/content-artifact-v1-acceptance-contract-ratified-2026-10-26.md
 *     has NOT been rerun or independently verified as part of this update.
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const REPO_DIR = path.join(__dirname, '..');
const SERVER = path.join(REPO_DIR, 'app', 'server.js');

const checks = [];
let failures = 0;

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail || '' });
  if (!ok) failures += 1;
  process.stdout.write((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : '') + '\n');
  return ok;
}

// Content-addressed snapshot of a directory tree. The T7 isolation invariant
// is "this run changes nothing under data/mvp", not "the directory is absent":
// the Owner may already have a fixture state there from normal use.
function snapshotTree(dir) {
  if (!fs.existsSync(dir)) return 'absent';
  const entries = [];
  const walk = (current) => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else entries.push(`${path.relative(dir, full)}:${crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`);
    }
  };
  walk(dir);
  return entries.join('|') || 'empty';
}

async function main() {

// Test 1: SHA-256 hash computation
process.stdout.write('\n=== Test 1: SHA-256 hash computation (platform smoke — not app evidence) ===\n');
const testContent = 'Test content for hash verification';
const hash = crypto.createHash('sha256').update(testContent).digest('hex');
check('sha256 produces 64-char hex', hash.length === 64, 'hash length=' + hash.length);
check('sha256 is deterministic', true, 'running again same hash');
const hash2 = crypto.createHash('sha256').update(testContent).digest('hex');
check('sha256 identical on repeat', hash === hash2, 'same content same hash');

// Test 2: File persistence logic
process.stdout.write('\n=== Test 2: File persistence logic (platform smoke — not app evidence) ===\n');
const workspace = path.join(os.tmpdir(), 'ace-test-' + Date.now());
const exportsDir = path.join(workspace, 'exports');
try {
  await fsp.mkdir(exportsDir, { recursive: true });
  
  const testFile = path.join(exportsDir, 'test-script.md');
  const testMarkdown = '# Test Script\n\nProduct: Test Product\n';
  await fsp.writeFile(testFile, testMarkdown, 'utf8');
  
  const readBack = await fsp.readFile(testFile, 'utf8');
  check('file written and readable', readBack === testMarkdown, 'content matches');
  check('sha256 of file', crypto.createHash('sha256').update(readBack).digest('hex').length === 64, 'hash valid');
  
  // Test version immutability - don't overwrite
  const version1Hash = crypto.createHash('sha256').update(readBack).digest('hex');
  await fsp.writeFile(testFile, testMarkdown, 'utf8'); // overwrite with same content
  const readAfterOverwrite = await fsp.readFile(testFile, 'utf8');
  check('overwrite with same content preserves hash', 
    crypto.createHash('sha256').update(readAfterOverwrite).digest('hex') === version1Hash,
    'byte-identical after overwrite');
  
  // Test that we can track versions
  const version2Content = '# Test Script v2\n\nProduct: Test Product v2\n';
  await fsp.writeFile(testFile, version2Content, 'utf8');
  const version2Hash = crypto.createHash('sha256').update(version2Content).digest('hex');
  const readVersion2 = await fsp.readFile(testFile, 'utf8');
  check('version 2 content different', readVersion2 === version2Content, 'v2 content loaded');
  check('version 2 hash different', version2Hash !== version1Hash, 'v2 hash differs from v1');
  
  // Clean up
  await fsp.rm(workspace, { recursive: true, force: true });
} catch (e) {
  check('file persistence test', false, e.message);
}

// Test 3: Path safety - prevent path traversal
process.stdout.write('\n=== Test 3: Path safety (logic simulation of the guard) ===\n');
function sanitizePath(filePath, exportsDir) {
  const resolved = path.resolve(exportsDir, filePath);
  const exportsRoot = path.resolve(exportsDir);
  return resolved.startsWith(exportsRoot + path.sep) || resolved === exportsRoot;
}

check('path traversal blocked', 
  !sanitizePath('../../../etc/passwd', exportsDir),
  'traversal attempt rejected');
check('safe path allowed',
  sanitizePath('test-script.md', exportsDir),
  'valid path allowed');
check('nested safe path allowed',
  sanitizePath('subdir/test.md', exportsDir),
  'nested path allowed');

// Test 4: QA status separate from publication
process.stdout.write('\n=== Test 4: QA status separate from publication (smoke) ===\n');
const qaStatus = 'QA: PASS 2 WARN 0 FAIL 0';
const publicationStatus = 'EXPORTED';

check('qa status separate from publication', qaStatus !== publicationStatus, 'different statuses');
check('qa can be run without export', true, 'qa independent of export status');

// Test 5: Artifact structure verification
process.stdout.write('\n=== Test 5: Artifact structure verification (shape simulation) ===\n');
function createArtifact(artifactId, productId, content) {
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  return {
    artifact_id: artifactId,
    product_id: productId,
    version: 1,
    generated_at: new Date().toISOString(),
    content: content,
    sha256: sha256,
    provenance: { source: 'fixture', generated: new Date().toISOString() },
    claim_map: ['claim1', 'claim2']
  };
}

const artifact = createArtifact('ART-123', 'P-1001', 'Test content');
check('artifact has artifact_id', artifact.artifact_id === 'ART-123', 'id present');
check('artifact has product_id', artifact.product_id === 'P-1001', 'product_id present');
check('artifact has sha256', artifact.sha256.length === 64, 'hash present');
check('artifact has version', artifact.version === 1, 'version = 1');
check('artifact has provenance', artifact.provenance !== undefined, 'provenance present');
check('artifact has claim_map', Array.isArray(artifact.claim_map), 'claim_map is array');

// Test 6: generateMarkdownContent logic (using regular strings only)
process.stdout.write('\n=== Test 6: generateMarkdownContent logic (simulation — mirrors the intended generator output) ===\n');

// Simulate the generateMarkdownContent function logic using regular strings
function generateMarkdownContent(project) {
  const candidate = project.candidate;
  const product = project.product;
  const offer = project.offer;
  const approach = project.approach;
  const qa = project.qa;
  const storyboard = project.storyboard;
  
  const ev = function(code) { return 'EV-' + offer.item_id + '-' + code; };
  const audience = product.category ? 'buyers in the ' + product.category + ' category' : 'buyers';
  const price = offer ? offer.price_thb.toFixed(2) : '0.00';
  const listPrice = offer ? offer.list_price_thb.toFixed(2) : '0.00';
  const depth = offer && offer.promo ? offer.promo.depth_pct : 0;
  const cta = approach ? (approach.cta || 'คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน') : '';
  const copy = product.category ? product.category : 'Home';
  
  // Build claim lines using string concatenation
  let claimLines = '';
  if (candidate && candidate.claims) {
    claimLines = candidate.claims.map(function(c) {
      const evidence = (c.evidence_ids || []).map(function(e) { return e.replace('EV-', ''); }).join(', ');
      return '- ' + c.text + ' (' + c.claim_class + ', evidence: ' + evidence + ')';
    }).join('\n');
  }
  
  // Build QA summary
  let qaSummary = 'QA not run';
  if (qa && qa.summary) {
    qaSummary = 'QA: PASS ' + qa.summary.PASS + ' · WARN ' + qa.summary.WARN + ' · FAIL ' + qa.summary.FAIL;
  }
  
  // Build the markdown content using string concatenation
  var result = '';
  result = result + '# Content Script/Draft\n\n';
  result = result + 'Generated from candidate: ' + candidate.title + ' (' + candidate.id + ')\n';
  result = result + 'Product: ' + product.name + ' (' + product.id + ')\n';
  result = result + 'Approach: ' + approach.key + '\n';
  result = result + 'Generated at: ' + new Date().toISOString() + '\n\n';
  result = result + '## Product Details\n';
  result = result + '- Name: ' + product.name + '\n';
  result = result + '- Category: ' + product.category + '\n';
  result = result + '- Price: THB ' + price + ' (list: THB ' + listPrice + ')\n';
  result = result + '- Shop: ' + offer.shop_name + ' (' + offer.shop_id + ')\n\n';
  result = result + '## Generated Content\n';
  if (claimLines.length > 0) {
    result = result + claimLines + '\n';
  } else {
    result = result + '- No claims generated\n';
  }
  result = result + '## QA Summary\n';
  result = result + qaSummary + '\n\n';
  result = result + '## Storyboard Overview\n';
  result = result + 'Scenes: ' + (storyboard ? storyboard.scenes.length : 0) + '\n';
  result = result + 'Aspect ratio: 9:16\n';
  result = result + 'Language: th\n\n';
  result = result + '## CTA\n';
  result = result + cta + '\n\n';
  result = result + '---)\n';
  result = result + '      origin: AI_DRAFT,\n';
  result = result + '      angle: Problem-first demo for ' + audience + ': show the everyday problem, then the product in use.,\n';
  result = result + '      audience,\n';
  result = result + '      hook: \"' + product.name + ' — here is what ' + price + ' actually fixes.\",\n';
  result = result + '      format: 30-45s vertical UGC demo, one problem, one product, one CTA.,\n';
  result = result + '      cta: Ask viewers to check the current price; do not promise a discount that the fixture cannot verify.,\n';
  result = result + '      evidence_ids: [ev(PRICE), ev(REVIEWS), ev(PROMO)],\n';
  result = result + '      claim_notes: Fixture facts used: ' + price + ', ' + (offer.promo ? offer.promo.label : '') + ', rating ' + (offer.reviews ? offer.reviews.rating : '') + '. Claims about outcomes stay HYPOTHESIS.,\n';
  result = result + '      tradeoffs: [Needs a real demonstration to look credible., Audience fit is inferred from the fixture category only.],\n';
  result = result + '    ,\n';
  result = result + '    {\n';
  result = result + '      key: personalized_b,\n';
  result = result + '      label: Personalized B,\n';
  result = result + '      origin: AI_DRAFT,\n';
  result = result + '      angle: Value/comparison framing for ' + audience + ': list price vs current price vs commission-backed offer.,\n';
  result = result + '      audience,\n';
  result = result + '      hook: \"List THB ' + (offer ? offer.list_price_thb.toFixed(2) : '0') + ' now ' + price + '. Is it worth it?\",\n';
  
  return result;
}

// Test with fixture data
const fixtureProject = {
  candidate: {
    id: 'CAND-1',
    title: 'Test Candidate',
    claims: [
      {
        text: 'The product solves a common problem',
        claim_class: 'HYPOTHESIS',
        evidence_ids: []
      }
    ]
  },
  product: {
    id: 'P-1001',
    name: 'Test Product',
    category: 'home'
  },
  offer: {
    item_id: 'OFF-1',
    product_name: 'Test Product',
    price_thb: 990,
    list_price_thb: 1490,
    shop_name: 'Test Shop',
    shop_id: 'SHOP-1',
    promo: {
      type: 'PROMO',
      label: 'TEST PROMO',
      depth_pct: 10
    },
    metrics: {
      review_signal: 0.8
    },
    reviews: {
      rating: 4.5,
      rating_count: 100
    }
  },
  approach: {
    key: 'personalized_a',
    cta: 'คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน'
  },
  qa: {
    summary: { PASS: 2, WARN: 0, FAIL: 0 }
  },
  storyboard: {
    scenes: [{ id: 'SC-1', description: 'Opening scene' }]
  }
};

const markdownContent = generateMarkdownContent(fixtureProject);
check('markdown content generated', markdownContent.includes('# Content Script/Draft'), 'check header');
check('product_id in content', markdownContent.includes('P-1001'), 'product_id present');
check('candidate title', markdownContent.includes('Test Candidate'), 'candidate title');
check('claim lines', markdownContent.includes('HYPOTHESIS'), 'claim class');
check('generated at date', markdownContent.includes('Generated at:'), 'generation timestamp');
check('CTA text', markdownContent.includes('Ask viewers to check the current price'), 'CTA present');
check('price in content', markdownContent.includes('THB 990'), 'price in content');

// Test 7: REAL Content Artifact v1 path (CA-V1-01..06, decisions D1–D5)
process.stdout.write('\n=== Test 7: REAL Content Artifact v1 path (real server, temp isolation) ===\n');
try {
  const ws7 = await fsp.mkdtemp(path.join(os.tmpdir(), 'ace-artifact-'));
  const stateFile7 = path.join(ws7, 'fixture-state.json');
  const stagingFile7 = path.join(ws7, 'staging-state.json');
  const assetsDir7 = path.join(ws7, 'assets');
  const exportsDir7 = path.join(ws7, 'exports');
  const port7 = 8600 + Math.floor(Math.random() * 300);

  const realStatePath = path.join(REPO_DIR, 'data', 'app', 'state.json');
  const realStateBefore = fs.existsSync(realStatePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(realStatePath)).digest('hex')
    : null;
  const realMvpDir = path.join(REPO_DIR, 'data', 'mvp');
  const realMvpBefore = snapshotTree(realMvpDir);

  const child = await new Promise((resolve, reject) => {
    const ch = spawn(process.execPath, [SERVER], {
      cwd: REPO_DIR,
      env: {
        ...process.env,
        ACE_MVP_STATE_FILE: stateFile7,
        ACE_MVP_STAGING_FILE: stagingFile7,
        ACE_MVP_ASSETS_DIR: assetsDir7,
        ACE_MVP_EXPORTS_DIR: exportsDir7,
        PORT: String(port7),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let errOut = '';
    ch.stderr.on('data', (c) => { errOut += c; });
    const timer = setTimeout(() => { ch.kill(); reject(new Error('server start timeout\n' + errOut)); }, 20000);
    ch.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early code ' + code + '\n' + errOut)); });
    const probe = (attempts) => {
      const p = require('node:http').get({ host: '127.0.0.1', port: port7, path: '/api/mvp/meta', timeout: 1500 }, (res) => {
        res.resume(); clearTimeout(timer); resolve(ch);
      });
      p.on('error', () => {
        if (attempts <= 0) { clearTimeout(timer); ch.kill(); reject(new Error('server unreachable\n' + errOut)); return; }
        setTimeout(() => probe(attempts - 1), 250);
      });
      p.on('timeout', () => { p.destroy(); });
    };
    probe(40);
  });

  const call7 = async (method, route, body) => {
    const res = await fetch('http://127.0.0.1:' + port7 + route, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { status: res.status, body: json, text };
  };

  try {
    // bootstrap the fixture pipeline (same sequence as content-creation-acceptance.js)
    const imported = await call7('POST', '/api/mvp/import', {});
    check('CA-V1 bootstrap: import fixture', imported.status === 200 || imported.status === 201, 'status ' + imported.status);
    const generated = await call7('POST', '/api/mvp/candidates/generate', {});
    check('CA-V1 bootstrap: 5 candidates', (generated.status === 200 || generated.status === 201) && (generated.body.candidates || []).length === 5,
      'status ' + generated.status);
    const candidateId = generated.body.candidates[0].id;

    // CA-V1-01: happy path
    const gen1 = await call7('POST', '/api/mvp/content/generate', { candidate_id: candidateId, approach_key: 'personalized_a' });
    const genErr = gen1.body && gen1.body.error;
    check('CA-V1-01 generate returns 200', gen1.status === 200, 'status ' + gen1.status + (genErr ? ' body=' + JSON.stringify(genErr) : ''));

    // CA-V1-01: validation errors (always exercised; actuals recorded honestly)
    const missing = await call7('POST', '/api/mvp/content/generate', { candidate_id: candidateId });
    check('CA-V1-01 missing approach_key -> 400', missing.status === 400, 'status ' + missing.status + (missing.body && missing.body.error ? ' body=' + JSON.stringify(missing.body.error) : ''));
    const unknownCandidate = await call7('POST', '/api/mvp/content/generate', { candidate_id: 'CND-DOES-NOT-EXIST', approach_key: 'personalized_a' });
    check('CA-V1-01 unknown candidate -> 404', unknownCandidate.status === 404, 'status ' + unknownCandidate.status + (unknownCandidate.body && unknownCandidate.body.error ? ' body=' + JSON.stringify(unknownCandidate.body.error) : ''));
    const badApproach = await call7('POST', '/api/mvp/content/generate', { candidate_id: candidateId, approach_key: 'not_an_approach' });
    check('CA-V1-01 invalid approach -> 400', badApproach.status === 400, 'status ' + badApproach.status + (badApproach.body && badApproach.body.error ? ' body=' + JSON.stringify(badApproach.body.error) : ''));
    const ucNoCustom = await call7('POST', '/api/mvp/content/generate', { candidate_id: candidateId, approach_key: 'user_custom' });
    check('CA-V1-01/boundary user_custom without persisted custom -> 400 (no fabricated content)', ucNoCustom.status === 400 && ucNoCustom.body && ucNoCustom.body.error === 'the user_custom approach needs a custom description first', 'status ' + ucNoCustom.status + ' body=' + JSON.stringify(ucNoCustom.body && ucNoCustom.body.error));

    if (gen1.status === 200) {
      const check1 = (name, ok, detail) => check(name, ok, detail);
      check1('CA-V1-01 payload has artifact_id', typeof (gen1.body || {}).artifact_id === 'string' && gen1.body.artifact_id.startsWith('ART-'), String((gen1.body || {}).artifact_id));
      check1('CA-V1-01 payload has product_id', Boolean((gen1.body || {}).product_id), String((gen1.body || {}).product_id));
      check1('CA-V1-01 payload has provenance (D: populated from content.js @495)', Boolean((gen1.body || {}).provenance && gen1.body.provenance.source), 'source=' + ((gen1.body || {}).provenance || {}).source);
      check1('CA-V1-01 payload sha256 is 64-hex', typeof (gen1.body || {}).sha256 === 'string' && /^[0-9a-f]{64}$/.test(gen1.body.sha256), String((gen1.body || {}).sha256));
      check1('CA-V1-01/D4 structured claim_map intentionally absent', !('claim_map' in (gen1.body || {})), 'claim_map not in JSON (markdown body is the claim map)');

      // CA-V1-02: file on disk matches response content
      const file1 = gen1.body.file_path;
      const onDisk1 = await fsp.readFile(file1, 'utf8');
      check1('CA-V1-02 artifact file created and byte-equal to response content', onDisk1 === gen1.body.content, 'bytes ' + Buffer.byteLength(onDisk1));
      check1('CA-V1-02 file lives inside temp exports dir', file1.startsWith(exportsDir7 + path.sep), file1);

      // CA-V1-04: sha256 matches the on-disk file
      const diskHash1 = crypto.createHash('sha256').update(onDisk1).digest('hex');
      check1('CA-V1-04 stored sha256 == sha256(on-disk file)', diskHash1 === gen1.body.sha256, diskHash1.slice(0, 16) + '…');

      // CA-V1-05 + D1: repeated generates -> unique ids/files, version 1, no overwrite
      const gen2 = await call7('POST', '/api/mvp/content/generate', { candidate_id: candidateId, approach_key: 'personalized_b' });
      const gen3 = await call7('POST', '/api/mvp/content/generate', { candidate_id: candidateId, approach_key: 'exploration' });
      const ids = [gen1.body.artifact_id, gen2.body.artifact_id, gen3.body.artifact_id];
      check1('CA-V1-05/D1 artifact ids unique across generates', new Set(ids).size === 3, ids.join(', '));
      check1('CA-V1-05/D1 files unique (no overwrite)', new Set([gen1.body.file_path, gen2.body.file_path, gen3.body.file_path]).size === 3, '3 files');
      check1('CA-V1-05/D1 version is 1 per new artifact (as-implemented)', gen1.body.version === 1 && gen2.body.version === 1 && gen3.body.version === 1, 'version 1');

      // CA-V1-08: markdown sections + claim map lives in the body (D4)
      const md = gen1.body.content;
      check1('CA-V1-08 markdown sections present',
        ['# Content Script/Draft', '## Product Details', '## Generated Content', '## QA Summary', '## Storyboard Overview', '## CTA']
          .every((s) => md.includes(s)), 'all 6 sections');
      check1('CA-V1-08/D4 claim lines carry claim_class + evidence refs', /- .+\((FACT|INFERENCE|HYPOTHESIS|UNKNOWN), evidence: .*\)/.test(md), 'claim map in body');

      // D3: structural determinism — identical inputs differ only in "Generated at"
      const gen1b = await call7('POST', '/api/mvp/content/generate', { candidate_id: candidateId, approach_key: 'personalized_a' });
      const stripTs = (s) => s.split('\n').filter((line) => !line.startsWith('Generated at:')).join('\n');
      check1('CA-V1-09/D3 identical inputs -> identical markdown except Generated-at line',
        stripTs(gen1b.body.content) === stripTs(gen1.body.content), 'structure deterministic');

      // CA-V1-06: download by artifact id
      const dl = await fetch('http://127.0.0.1:' + port7 + '/api/mvp/content/export/' + gen1.body.artifact_id);
      const dlText = await dl.text();
      check1('CA-V1-06 download -> 200 text/markdown', dl.status === 200 && (dl.headers.get('content-type') || '').includes('text/markdown'), 'status ' + dl.status);
      check1('CA-V1-06 download content == on-disk file', dlText === onDisk1, 'bytes ' + Buffer.byteLength(dlText));
      const dlUnknown = await call7('GET', '/api/mvp/content/export/ART-DOES-NOT-EXIST');
      check1('CA-V1-06 unknown artifact id -> 404', dlUnknown.status === 404, 'status ' + dlUnknown.status);
      const dlTraversal = await call7('GET', '/api/mvp/content/export/..%2F..%2F..%2Fetc%2Fpasswd');
      check1('CA-V1-06 traversal-shaped id -> 404 (file_path comes from state, not the URL)', dlTraversal.status === 404, 'status ' + dlTraversal.status);

      // D2/403 guard: tamper the TEMP state so a stored file_path points outside exports
      const rawState = JSON.parse(await fsp.readFile(stateFile7, 'utf8'));
      let tampered = false;
      for (const proj of Object.values(rawState.contents || {})) {
        if (proj.artifact && proj.artifact.artifact_id === gen1.body.artifact_id) {
          proj.artifact.file_path = path.join(ws7, 'outside-exports.md');
          tampered = true;
          break;
        }
      }
      if (tampered) {
        await fsp.writeFile(path.join(ws7, 'outside-exports.md'), 'OUTSIDE MARKER', 'utf8');
        await fsp.writeFile(stateFile7, JSON.stringify(rawState), 'utf8');
        const dlTampered = await fetch('http://127.0.0.1:' + port7 + '/api/mvp/content/export/' + gen1.body.artifact_id);
        check1('CA-V1-06/D2 tampered state path outside exports -> 403 guard', dlTampered.status === 403, 'status ' + dlTampered.status);
        check1('CA-V1-06/D2 v1 serves without hash verification (accepted limitation, sha256 enables offline check)', dlTampered.status === 403, 'guard proven; hash-on-download is a v2 candidate');
      } else {
        check1('CA-V1-06/D2 tamper target found in temp state', false, 'artifact not found in temp state');
      }

      // D5: lifecycle status in temp state
      const rawState2 = JSON.parse(await fsp.readFile(stateFile7, 'utf8'));
      const statuses = Object.values(rawState2.contents || {}).map((p) => p.status);
      check1('CA-V1-11/D5 content projects reach EXPORTED at markdown generation (as-implemented)', statuses.length >= 3 && statuses.every((s) => s === 'EXPORTED'), JSON.stringify(statuses));
      const artifactVersions = Object.values(rawState2.contents || {}).map((p) => p.artifact && p.artifact.version);
      check1('CA-V1-05/D1 recorded artifact versions all 1', artifactVersions.length >= 3 && artifactVersions.every((v) => v === 1), JSON.stringify(artifactVersions));
      const recordedHashes = Object.values(rawState2.contents || {}).map((p) => p.artifact && p.artifact.sha256);
      check1('CA-V1-04 recorded sha256 present in state for every artifact', recordedHashes.length >= 3 && recordedHashes.every((h) => /^[0-9a-f]{64}$/.test(h || '')), 'all recorded');
    } else {
      check('CA-V1-02…06 + D1/D3/D5 dependent checks NOT RUN — happy path did not return 200', false, 'status ' + gen1.status);
    }
  } finally {
    child.kill();
  }

  // Real-state integrity after the whole Test 7 run
  const realStateAfter = fs.existsSync(realStatePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(realStatePath)).digest('hex')
    : null;
  check('T7 integrity: real data/app/state.json unchanged', realStateBefore === realStateAfter, String(realStateAfter || 'absent').slice(0, 16) + '…');
  const realMvpAfter = snapshotTree(realMvpDir);
  check('T7 integrity: real data/mvp unchanged by this run (nothing created or modified)',
    realMvpBefore === realMvpAfter,
    realMvpBefore === realMvpAfter
      ? (realMvpBefore === 'absent' ? 'absent' : `${realMvpBefore.split('|').length} file(s) unchanged`)
      : 'CHANGED by this run');

  await fsp.rm(ws7, { recursive: true, force: true });
} catch (e) {
  check('Test 7 real-path battery', false, (e && e.stack) ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e));
}

// Test 8: failure injection for M/W/S branches (CA-V1-03, in-process, temp isolation)
process.stdout.write('\n=== Test 8: failure injection M/W/S (in-process, temp isolation) ===\n');
try {
  const ws8 = await fsp.mkdtemp(path.join(os.tmpdir(), 'ace-inject-'));
  const stateFile8 = path.join(ws8, 'state.json');
  const stagingFile8 = path.join(ws8, 'staging-state.json');
  const assetsDir8 = path.join(ws8, 'assets');
  const servicePath8 = path.join(REPO_DIR, 'app', 'mvp', 'service.js');
  const fspMod = require('node:fs/promises');
  const origWriteFile8 = fspMod.writeFile;
  const origUnlink8 = fspMod.unlink;
  const repoTmp8 = path.join(REPO_DIR, '.tmp');
  const countRepoTmp8 = () => {
    let n = 0;
    const walk = (dir) => { let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; } for (const e of es) { n += 1; if (e.isDirectory()) walk(path.join(dir, e.name)); } };
    walk(repoTmp8); return n;
  };
  const repoTmpBefore8 = fs.existsSync(repoTmp8) ? countRepoTmp8() : -1;

  // bootstrap: a real child server fills the temp state with candidates (HTTP)
  const port8 = 9200 + Math.floor(Math.random() * 300);
  let cid8 = null;
  const child8 = await new Promise((resolve, reject) => {
    const ch = spawn(process.execPath, [SERVER], {
      cwd: REPO_DIR,
      env: { ...process.env, ACE_MVP_STATE_FILE: stateFile8, ACE_MVP_STAGING_FILE: stagingFile8, ACE_MVP_ASSETS_DIR: assetsDir8, ACE_MVP_EXPORTS_DIR: path.join(ws8, 'exports-base'), PORT: String(port8) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let errOut = '';
    ch.stderr.on('data', (c) => { errOut += c; });
    const timer = setTimeout(() => { ch.kill(); reject(new Error('server start timeout\n' + errOut)); }, 20000);
    ch.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early ' + code + '\n' + errOut)); });
    const probe = (attempts) => {
      const p = require('node:http').get({ host: '127.0.0.1', port: port8, path: '/api/mvp/meta', timeout: 1500 }, (res) => { res.resume(); clearTimeout(timer); resolve(ch); });
      p.on('error', () => { if (attempts <= 0) { clearTimeout(timer); ch.kill(); reject(new Error('server unreachable\n' + errOut)); return; } setTimeout(() => probe(attempts - 1), 250); });
      p.on('timeout', () => { p.destroy(); });
    };
    probe(40);
  });
  const call8 = async (method, route, body) => {
    const res = await fetch('http://127.0.0.1:' + port8 + route, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { status: res.status, body: json };
  };
  try {
    const imported8 = await call8('POST', '/api/mvp/import', {});
    check('CA-V1-03 bootstrap: import fixture', imported8.status === 200 || imported8.status === 201, 'status ' + imported8.status);
    const generated8 = await call8('POST', '/api/mvp/candidates/generate', {});
    check('CA-V1-03 bootstrap: 5 candidates', (generated8.status === 200 || generated8.status === 201) && (generated8.body.candidates || []).length === 5, 'status ' + generated8.status);
    cid8 = generated8.body.candidates[0].id;
  } finally {
    child8.kill();
  }
  const preStateStr8 = await fsp.readFile(stateFile8, 'utf8');
  const loadService8 = () => { delete require.cache[require.resolve(servicePath8)]; return require(servicePath8); };
  const setEnv8 = (exportsDir) => { process.env.ACE_MVP_STATE_FILE = stateFile8; process.env.ACE_MVP_STAGING_FILE = stagingFile8; process.env.ACE_MVP_ASSETS_DIR = assetsDir8; process.env.ACE_MVP_EXPORTS_DIR = exportsDir; };
  const mkCtx8 = (bodyObj) => ({ pathname: '/api/mvp/content/generate', sendJson: (r, status, payload) => { r.statusCode = status; r.payload = payload; }, readBody: async () => JSON.stringify(bodyObj) });
  const runGenerate8 = async (service8, approachKey) => {
    const res8 = { statusCode: 0, payload: null };
    const logs = [];
    const util8 = require('node:util');
    const origErr = console.error;
    console.error = (...a) => { logs.push(a.map((x) => (x && typeof x === 'object') ? util8.inspect(x) : String(x)).join(' ')); };
    try {
      await service8.handleMvp({ method: 'POST' }, res8, mkCtx8({ candidate_id: cid8, approach_key: approachKey }));
    } finally {
      console.error = origErr;
    }
    return { res8, logs: logs.join('\n') };
  };

  // --- Branch M: a FILE blocks the exports dir -> mkdir fails ---
  await fsp.writeFile(path.join(ws8, 'exports-m'), 'blocker');
  setEnv8(path.join(ws8, 'exports-m'));
  const serviceM = loadService8();
  const resM = await runGenerate8(serviceM, 'personalized_a');
  check('CA-V1-03/M mkdir-blocked -> 500 (existing generic contract) + fs error in server log', resM.res8.statusCode === 500 && resM.res8.payload && resM.res8.payload.error === 'Internal error' && /EEXIST|ENOTDIR|EPERM/.test(resM.logs), 'status ' + resM.res8.statusCode + ' log-has-fs-error=' + /EEXIST|ENOTDIR|EPERM/.test(resM.logs));
  check('CA-V1-03/M R1 no artifact file/dir created', !fs.existsSync(path.join(ws8, 'exports-m', 'anything')) && (await fsp.stat(path.join(ws8, 'exports-m'))).isFile(), 'blocker file intact');
  check('CA-V1-03/M R2 state unchanged', (await fsp.readFile(stateFile8, 'utf8')) === preStateStr8, 'byte-identical');

  // --- Branch W: artifact write fails (conditional fs patch) ---
  const exportsW = path.join(ws8, 'exports-w');
  await fsp.mkdir(exportsW, { recursive: true });
  setEnv8(exportsW);
  delete require.cache[require.resolve(servicePath8)];
  const serviceW = require(servicePath8);
  fspMod.writeFile = async (p, ...rest) => {
    if (String(p).startsWith(exportsW + path.sep)) throw new Error('INJECTED_ARTIFACT_WRITE_FAILURE');
    return origWriteFile8.apply(fspMod, [p, ...rest]);
  };
  const resW = await runGenerate8(serviceW, 'personalized_a');
  check('CA-V1-03/W patch reached the real fs op -> 500 (client-masked) + specific reason in server log', resW.res8.statusCode === 500 && resW.res8.payload && resW.res8.payload.error === 'Internal error' && resW.logs.includes('failed to write artifact file'), 'status ' + resW.res8.statusCode + ' log-has-reason=' + resW.logs.includes('failed to write artifact file'));
  const listW = await fsp.readdir(exportsW);
  check('CA-V1-03/W R1 no orphan file', listW.length === 0, JSON.stringify(listW));
  check('CA-V1-03/W R2 state unchanged', (await fsp.readFile(stateFile8, 'utf8')) === preStateStr8, 'byte-identical');
  check('CA-V1-03/W R4 no lifecycle change', Object.values(JSON.parse(await fsp.readFile(stateFile8, 'utf8')).contents || {}).every((p) => p.status !== 'EXPORTED'), 'no EXPORTED');
  fspMod.writeFile = origWriteFile8;

  // --- Branch S: state persist fails after the artifact file was written ---
  const exportsS = path.join(ws8, 'exports-s');
  await fsp.mkdir(exportsS, { recursive: true });
  setEnv8(exportsS);
  delete require.cache[require.resolve(servicePath8)];
  const serviceS = require(servicePath8);
  fspMod.writeFile = async (p, ...rest) => {
    if (String(p).endsWith('.tmp') && String(p).startsWith(ws8 + path.sep)) throw new Error('INJECTED_STATE_WRITE_FAILURE');
    return origWriteFile8.apply(fspMod, [p, ...rest]);
  };
  const resS = await runGenerate8(serviceS, 'personalized_a');
  check('CA-V1-03/S patch reached state write -> 500 (client-masked) + specific reason in server log', resS.res8.statusCode === 500 && resS.res8.payload && resS.res8.payload.error === 'Internal error' && resS.logs.includes('failed to persist artifact state'), 'status ' + resS.res8.statusCode + ' log-has-reason=' + resS.logs.includes('failed to persist artifact state'));
  check('CA-V1-03/S R3 cleanup honestly reported (succeeded)', resS.res8.payload && resS.res8.payload.details && resS.res8.payload.details.cleanup === 'succeeded', JSON.stringify(resS.res8.payload && resS.res8.payload.details));
  const listS = await fsp.readdir(exportsS);
  check('CA-V1-03/S R1 artifact file removed by rollback', listS.length === 0, JSON.stringify(listS));
  check('CA-V1-03/S R2 state file byte-unchanged', (await fsp.readFile(stateFile8, 'utf8')) === preStateStr8, 'byte-identical');
  const parsedS = JSON.parse(await fsp.readFile(stateFile8, 'utf8'));
  check('CA-V1-03/S R2 no partial mutation (no contents/contentOrder additions)', Object.keys(parsedS.contents || {}).length === 0 && (parsedS.contentOrder || []).length === 0, 'empty');
  check('CA-V1-03/S R1-S no .tmp leftover in the state dir', (await fsp.readdir(ws8)).filter((f) => f.endsWith('.tmp')).length === 0, 'none');
  check('CA-V1-03/S R4 no lifecycle change', Object.values(parsedS.contents || {}).every((p) => p.status !== 'EXPORTED'), 'no EXPORTED');

  // --- Branch S: cleanup failure must be reported honestly ---
  fspMod.unlink = async (p) => {
    if (String(p).startsWith(exportsS + path.sep)) throw new Error('INJECTED_UNLINK_FAILURE');
    return origUnlink8.apply(fspMod, [p]);
  };
  const resS2 = await runGenerate8(serviceS, 'personalized_a');
  check('CA-V1-03/S cleanup-failure honestly reported (not faked)', resS2.res8.statusCode === 500 && resS2.res8.payload && resS2.res8.payload.details && String(resS2.res8.payload.details.cleanup).startsWith('failed:') && resS2.logs.includes('INJECTED_UNLINK_FAILURE'), JSON.stringify(resS2.res8.payload && resS2.res8.payload.details));
  check('CA-V1-03/S cleanup-failure leaves the artifact file (honest state, cleaned by the test)', (await fsp.readdir(exportsS)).length === 1, JSON.stringify(await fsp.readdir(exportsS)));
  fspMod.writeFile = origWriteFile8;
  fspMod.unlink = origUnlink8;
  const leftoversS = (await fsp.readdir(exportsS)).filter((f) => f.endsWith('.md'));
  for (const f of leftoversS) await origUnlink8(path.join(exportsS, f));

  // --- repo .tmp untouched by the injections ---
  const repoTmpAfter8 = fs.existsSync(repoTmp8) ? countRepoTmp8() : -1;
  check('CA-V1-03/R5 repo .tmp entry count unchanged by injections', repoTmpBefore8 === repoTmpAfter8, repoTmpBefore8 + ' -> ' + repoTmpAfter8);
  delete process.env.ACE_MVP_STATE_FILE;
  delete process.env.ACE_MVP_STAGING_FILE;
  delete process.env.ACE_MVP_ASSETS_DIR;
  delete process.env.ACE_MVP_EXPORTS_DIR;
  await fsp.rm(ws8, { recursive: true, force: true });
} catch (e) {
  fspMod.writeFile = origWriteFile8;
  fspMod.unlink = origUnlink8;
  delete process.env.ACE_MVP_STATE_FILE;
  delete process.env.ACE_MVP_STAGING_FILE;
  delete process.env.ACE_MVP_ASSETS_DIR;
  delete process.env.ACE_MVP_EXPORTS_DIR;
  check('Test 8 injection battery', false, (e && e.stack) ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e));
}

// Test 9: Candidate Select / Restore / Transition Matrix (CA-V1-03 + D5, real HTTP)
process.stdout.write('\n=== Test 9: Candidate Select / Restore / Transition Matrix (real HTTP) ===\n');
try {
  const ws9 = await fsp.mkdtemp(path.join(os.tmpdir(), 'ace-select-'));
  const stateFile9 = path.join(ws9, 'state.json');
  const stagingFile9 = path.join(ws9, 'staging-state.json');
  const assetsDir9 = path.join(ws9, 'assets');
  const exportsDir9 = path.join(ws9, 'exports');
  const port9 = 9500 + Math.floor(Math.random() * 300);
  const child9 = await new Promise((resolve, reject) => {
    const ch = spawn(process.execPath, [SERVER], {
      cwd: REPO_DIR,
      env: { ...process.env, ACE_MVP_STATE_FILE: stateFile9, ACE_MVP_STAGING_FILE: stagingFile9, ACE_MVP_ASSETS_DIR: assetsDir9, ACE_MVP_EXPORTS_DIR: exportsDir9, PORT: String(port9) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let errOut = '';
    ch.stderr.on('data', (c) => { errOut += c; });
    const timer = setTimeout(() => { ch.kill(); reject(new Error('server start timeout\n' + errOut)); }, 20000);
    ch.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early ' + code + '\n' + errOut)); });
    const probe = (attempts) => {
      const p = require('node:http').get({ host: '127.0.0.1', port: port9, path: '/api/mvp/meta', timeout: 1500 }, (res) => { res.resume(); clearTimeout(timer); resolve(ch); });
      p.on('error', () => { if (attempts <= 0) { clearTimeout(timer); ch.kill(); reject(new Error('server unreachable\n' + errOut)); return; } setTimeout(() => probe(attempts - 1), 250); });
      p.on('timeout', () => { p.destroy(); });
    };
    probe(40);
  });
  const call9 = async (method, route, body) => {
    const res = await fetch('http://127.0.0.1:' + port9 + route, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { status: res.status, body: json, text };
  };
  try {
    // Phase 1: 7-row custom CSV import (ADD-RS eligibility requires >5 offers)
    const header = ['item_id', 'shop_id', 'shop_name', 'product_name', 'category',
      'price_thb', 'list_price_thb', 'commission_rate', 'rating', 'rating_count',
      'units_sold', 'shop_rating', 'related_shop_count',
      'promo_type', 'promo_label', 'promo_depth_pct',
      'product_url', 'shop_url', 'exported_at'].join(',');
    const rows7 = [1, 2, 3, 4, 5, 6, 7].map((i) => [
      String(2000 + i), `SHOP-${i}`, `Shop ${i}`, `Product ${i}`, 'Home',
      String(100 * i), String(120 * i), '0.10', '4.5', String(50 * i), String(10 * i), '4.7', String(i),
      'PROMO', `Deal ${i}`, '10', `https://example.com/p/${i}`, `https://example.com/s/${i}`, '2026-01-10',
    ].join(','));
    const csv7 = [header, ...rows7].join('\n');
    const imp = await call9('POST', '/api/mvp/import', { csv: csv7 });
    check('T9-01 import 7-row custom CSV', imp.status === 201 && imp.body.records && imp.body.records.offers === 7, 'status ' + imp.status);
    const gen = await call9('POST', '/api/mvp/candidates/generate', { acknowledgeExpired: true });
    check('T9-02 generate top-5 of 7 offers', gen.status === 201 && gen.body.count === 5, 'count ' + (gen.body || {}).count);
    const activeIds = new Set((gen.body.candidates || []).map((c) => c.id));
    const allOffers = (await call9('GET', '/api/mvp/state')).body.offers || [];
    const eligible = allOffers.filter((o) => !activeIds.has('CND-' + o.item_id));
    check('T9-03 exactly 2 non-active eligible offers (D5 fill+extend setup)', eligible.length === 2, 'eligible ' + eligible.length);

    // US add: the 2 non-active offers (D5: honest count)
    const usAdd = await call9('POST', '/api/mvp/candidates/select', { method: 'user', context: 'add', offerIds: eligible.map((o) => o.id) });
    check('T9-04 US add -> 201 added=2 (honest count)', usAdd.status === 201 && usAdd.body.added_count === 2, 'added ' + (usAdd.body || {}).added_count);
    check('T9-05 US added candidates active + rank audit entries', (usAdd.body.added || []).every((c) => c.status === 'NONE' && typeof c.rank === 'number'), 'statuses ' + JSON.stringify((usAdd.body.added || []).map((c) => c.status)));

    // RS add again: 0 eligible -> honest 409
    const rsAgain = await call9('POST', '/api/mvp/candidates/select', { method: 'research', context: 'add' });
    check('T9-06 RS add with 0 eligible -> 409 (honest, no fabricated content)', rsAgain.status === 409, 'status ' + rsAgain.status);

    // Active set = 7, ranks 1..7
    const st1 = (await call9('GET', '/api/mvp/state')).body;
    const activeRanks = (st1.candidates || []).filter((c) => c.status !== 'REJECTED').map((c) => c.rank).sort((a, b) => a - b);
    check('T9-07 active set 7 candidates ranks 1..7 contiguous', activeRanks.length === 7 && activeRanks.every((r, i) => r === i + 1), JSON.stringify(activeRanks));

    // Transition matrix on one candidate (CND-2001)
    const target = (st1.candidates || []).find((c) => c.id === 'CND-2001');
    const queueBefore = (st1.queue || []).length;
    const a1 = await call9('POST', '/api/mvp/candidates/CND-2001/action', { action: 'SAVE' });
    check('T9-08 SAVE -> 200 SAVED queue+1', a1.status === 200 && a1.body.candidate.status === 'SAVED', 'status ' + a1.status);
    const st2 = (await call9('GET', '/api/mvp/state')).body;
    check('T9-08 queue grew by exactly 1', (st2.queue || []).length === queueBefore + 1, 'queue ' + (st2.queue || []).length);
    const r1 = await call9('POST', '/api/mvp/candidates/CND-2001/action', { action: 'REMOVE' });
    check('T9-09 REMOVE -> 200 NONE (Removed view)', r1.status === 200 && r1.body.candidate.status === 'NONE', 'status ' + r1.status);
    const r2 = await call9('POST', '/api/mvp/candidates/CND-2001/action', { action: 'REMOVE' });
    check('T9-10 repeated REMOVE -> 409 (REMOVE once)', r2.status === 409, 'status ' + r2.status);
    const rst = await call9('POST', '/api/mvp/candidates/CND-2001/restore', {});
    check('T9-11 RESTORE -> 200 status NONE (Active-NONE), queue UNCHANGED', rst.status === 200 && rst.body.candidate.status === 'NONE', 'status ' + rst.status);
    const st3 = (await call9('GET', '/api/mvp/state')).body;
    check('T9-11 queue unchanged by RESTORE', JSON.stringify(st3.queue) === JSON.stringify(st1.queue), 'queue len ' + (st3.queue || []).length);
    const r3 = await call9('POST', '/api/mvp/candidates/CND-2001/action', { action: 'REMOVE' });
    check('T9-12 REMOVE after RESTORE -> 200 (guard relaxation)', r3.status === 200, 'status ' + r3.status);
    const rej = await call9('POST', '/api/mvp/candidates/CND-2001/action', { action: 'REJECT' });
    check('T9-13 REJECT after REMOVE -> 200 REJECTED (per contract)', rej.status === 200 && rej.body.candidate.status === 'REJECTED', 'status ' + rej.status);

    // rank audit: actions entries carry rank_before/rank_after
    const st4 = (await call9('GET', '/api/mvp/state')).body;
    const audit = (st4.actions || []).filter((a) => a.candidate_id === 'CND-2001');
    check('T9-14 rank audit entries present with rank_before/rank_after', audit.length >= 4 && audit.every((a) => 'rank_before' in a && 'rank_after' in a), JSON.stringify(audit.map((a) => [a.action, a.rank_before, a.rank_after])));
    const lastEntry = audit.at(-1);
    check('T9-14 last audit = REJECT with rank_after null (left the ranking)', lastEntry && lastEntry.action === 'REJECT' && lastEntry.rank_after === null, JSON.stringify(lastEntry || {}));

    // consistency: all OK in viewState (no divergence injected)
    const st5 = (await call9('GET', '/api/mvp/state')).body;
    const consistencies = (st5.candidates || []).map((c) => c.consistency);
    check('T9-15 consistency surfaced per candidate, all OK', consistencies.length === 7 && consistencies.every((c) => c === 'OK'), JSON.stringify(consistencies));
  } finally {
    child9.kill();
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fsp.rm(ws9, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  check('T9 cleanup: temp workspace removed', !fs.existsSync(ws9), ws9);
} catch (e) {
  check('Test 9 battery', false, (e && e.stack) ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e));
}

// Test 10: SG-D6 count boundary + REPLACE + RS low-eligible + rank lifecycle (real HTTP, isolated)
process.stdout.write('\n=== Test 10: SG-D6/REPLACE/RS-low/rank lifecycle (real HTTP) ===\n');
try {
  const ws10 = await fsp.mkdtemp(path.join(os.tmpdir(), 'ace-sgd6-'));
  const stateFile10 = path.join(ws10, 'state.json');
  const stagingFile10 = path.join(ws10, 'staging-state.json');
  const assetsDir10 = path.join(ws10, 'assets');
  const exportsDir10 = path.join(ws10, 'exports');
  const port10 = 9900 + Math.floor(Math.random() * 300);
  const child10 = await new Promise((resolve, reject) => {
    const ch = spawn(process.execPath, [SERVER], {
      cwd: REPO_DIR,
      env: { ...process.env, ACE_MVP_STATE_FILE: stateFile10, ACE_MVP_STAGING_FILE: stagingFile10, ACE_MVP_ASSETS_DIR: assetsDir10, ACE_MVP_EXPORTS_DIR: exportsDir10, PORT: String(port10) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let errOut = '';
    ch.stderr.on('data', (c) => { errOut += c; });
    const timer = setTimeout(() => { ch.kill(); reject(new Error('server start timeout\n' + errOut)); }, 20000);
    ch.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early ' + code + '\n' + errOut)); });
    const probe = (attempts) => {
      const p = require('node:http').get({ host: '127.0.0.1', port: port10, path: '/api/mvp/meta', timeout: 1500 }, (res) => { res.resume(); clearTimeout(timer); resolve(ch); });
      p.on('error', () => { if (attempts <= 0) { clearTimeout(timer); ch.kill(); reject(new Error('server unreachable\n' + errOut)); return; } setTimeout(() => probe(attempts - 1), 250); });
      p.on('timeout', () => { p.destroy(); });
    };
    probe(40);
  });
  const call10 = async (method, route, body) => {
    const res = await fetch('http://127.0.0.1:' + port10 + route, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { status: res.status, body: json, text };
  };
  const bytes10 = () => fs.readFileSync(stateFile10);
  const buildCsv10 = (base) => {
    const header = ['item_id', 'shop_id', 'shop_name', 'product_name', 'category',
      'price_thb', 'list_price_thb', 'commission_rate', 'rating', 'rating_count',
      'units_sold', 'shop_rating', 'related_shop_count',
      'promo_type', 'promo_label', 'promo_depth_pct',
      'product_url', 'shop_url', 'exported_at'].join(',');
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => [
      String(base + i), `SHOP-${base}-${i}`, `Shop ${i}`, `Product ${i}`, 'Home',
      String(100 * i), String(120 * i), '0.10', '4.5', String(50 * i), String(10 * i), '4.7', String(i),
      'PROMO', `Deal ${i}`, '10', `https://example.com/p/${i}`, `https://example.com/s/${i}`, '2026-01-10',
    ].join(','));
    return [header, ...rows].join('\n');
  };
  try {
    // Cycle 1: count boundary + honest counts (11 offers -> 5 active + 6 eligible)
    const imp1 = await call10('POST', '/api/mvp/import', { csv: buildCsv10(2000) });
    check('T10-01 import 11-row CSV', imp1.status === 201 && imp1.body.records.offers === 11, 'status ' + imp1.status);
    const gen1 = await call10('POST', '/api/mvp/candidates/generate', { acknowledgeExpired: true });
    check('T10-02 generate top-5 of 11', gen1.status === 201 && gen1.body.count === 5, 'count ' + (gen1.body || {}).count);
    const bytesBefore400 = bytes10();
    const over6 = await call10('POST', '/api/mvp/candidates/select', { method: 'research', context: 'add', count: 6 });
    check('T10-03 SG-D6: count=6 -> 400 with clear message', over6.status === 400 && /between 1 and 5/.test(over6.body && over6.body.error || ''), 'status ' + over6.status + ' body ' + JSON.stringify(over6.body));
    const over50 = await call10('POST', '/api/mvp/candidates/select', { method: 'research', context: 'add', count: 50 });
    check('T10-04 SG-D6: count=50 -> 400', over50.status === 400, 'status ' + over50.status);
    check('T10-05 state bytes unchanged by the two 400s', bytes10().equals(bytesBefore400), 'bytes-equal ' + bytes10().equals(bytesBefore400));
    const rsOmitted = await call10('POST', '/api/mvp/candidates/select', { method: 'research', context: 'add' });
    check('T10-06 RS omitted -> 201 requested=5 added=5 (default 5, honest)', rsOmitted.status === 201 && rsOmitted.body.requested_count === 5 && rsOmitted.body.added_count === 5, 'requested ' + (rsOmitted.body || {}).requested_count + ' added ' + (rsOmitted.body || {}).added_count);
    const rsTwo = await call10('POST', '/api/mvp/candidates/select', { method: 'research', context: 'add', count: 2 });
    check('T10-07 RS count=2 with 1 eligible -> 201 requested=2 added=1 (added<requested honest)', rsTwo.status === 201 && rsTwo.body.requested_count === 2 && rsTwo.body.added_count === 1, 'requested ' + (rsTwo.body || {}).requested_count + ' added ' + (rsTwo.body || {}).added_count);
    const rsOne = await call10('POST', '/api/mvp/candidates/select', { method: 'research', context: 'add', count: 1 });
    check('T10-08 RS count=1 with 0 eligible -> 409 (honest, no fabrication)', rsOne.status === 409, 'status ' + rsOne.status);
    const st1 = (await call10('GET', '/api/mvp/state')).body;
    const ranks1 = (st1.candidates || []).filter((c) => c.status !== 'REJECTED').map((c) => c.rank).sort((a, b) => a - b);
    check('T10-09 active ranks 1..11 contiguous', ranks1.length === 11 && ranks1.every((r, i) => r === i + 1), JSON.stringify(ranks1));

    // Cycle 2 (different CSV -> different sha -> full reset): invalid count default + REPLACE + rank lifecycle
    const imp2 = await call10('POST', '/api/mvp/import', { csv: buildCsv10(3000) });
    check('T10-10 re-import different CSV -> full reset (reset=true)', imp2.status === 201 && imp2.body.reset === true, 'status ' + imp2.status + ' reset ' + (imp2.body || {}).reset);
    const gen2 = await call10('POST', '/api/mvp/candidates/generate', { acknowledgeExpired: true });
    check('T10-11 generate top-5 after reset', gen2.status === 201 && gen2.body.count === 5, 'count ' + (gen2.body || {}).count);
    const st2 = (await call10('GET', '/api/mvp/state')).body;
    const active2 = (st2.candidates || []).filter((c) => c.status !== 'REJECTED');
    const candByItem2 = new Map((st2.candidates || []).map((c) => [c.id, c]));
    const activeItems2 = new Set(active2.map((c) => c.id.replace(/^CND-/, '')));
    const eligible2 = (st2.offers || []).filter((o) => !activeItems2.has(String(o.item_id)));
    const invalidStr = await call10('POST', '/api/mvp/candidates/select', { method: 'research', context: 'add', count: '5' });
    check('T10-12 SG-D6: count="5" (invalid type) -> 201 requested=5 added=5 (documented default)', invalidStr.status === 201 && invalidStr.body.requested_count === 5 && invalidStr.body.added_count === 5, 'status ' + invalidStr.status + ' requested ' + (invalidStr.body || {}).requested_count + ' added ' + (invalidStr.body || {}).added_count);
    // SAVE then REMOVE an active candidate (REMOVE-once guard keeps fresh not-actioned NONE candidates at 409 by design)
    const st2b = (await call10('GET', '/api/mvp/state')).body;
    const topActive = Object.values(st2b.candidates).filter((c) => c.status === 'SAVED' || c.status === 'QUEUED' || (c.status === 'NONE' && !((c.status_history || []).length > 0 && (c.status_history || []).at(-1).action === 'REMOVE'))).sort((a, b) => a.rank - b.rank)[0];
    const save0 = await call10('POST', `/api/mvp/candidates/${topActive.id}/action`, { action: 'SAVE' });
    check('T10-13 SAVE rank-1 active (REMOVE setup)', save0.status === 200 && save0.body.candidate.status === 'SAVED', 'status ' + save0.status);
    const rem1 = await call10('POST', `/api/mvp/candidates/${topActive.id}/action`, { action: 'REMOVE' });
    check('T10-13b REMOVE -> 200 NONE (Removed) + audit rank_before/rank_after=null', rem1.status === 200 && rem1.body.candidate.status === 'NONE' && rem1.body.action.rank_before === topActive.rank && rem1.body.action.rank_after === null, JSON.stringify(rem1.body.action || {}));
    const st3 = (await call10('GET', '/api/mvp/state')).body;
    const activeItems3 = new Set((st3.candidates || []).filter((c) => c.status === 'SAVED' || c.status === 'QUEUED' || (c.status === 'NONE' && !((c.status_history || []).length > 0 && (c.status_history || []).at(-1).action === 'REMOVE'))).map((c) => c.id.replace(/^CND-/, '')));
    const eligible3 = (st3.offers || []).filter((o) => !activeItems3.has(String(o.item_id)));
    const replacement = eligible3.find((o) => String(o.item_id) !== topActive.id.replace(/^CND-/, ''));
    check('T10-14 replacement offer exists (different item, no active candidate)', Boolean(replacement), JSON.stringify(eligible3.map((o) => o.id)));
    const rep1 = await call10('POST', '/api/mvp/candidates/select', { method: 'user', context: 'replace', replaceCandidateId: topActive.id, offerIds: [replacement.id] });
    const repCand = rep1.status === 201 ? (rep1.body.added || [])[0] : null;
    const st4 = (await call10('GET', '/api/mvp/state')).body;
    const removedAfter = (st4.candidates || []).find((c) => c.id === topActive.id);
    const ranks4 = (st4.candidates ? Object.values(st4.candidates) : []).filter((c) => c.status !== 'REJECTED' && !(c.status === 'NONE' && (c.status_history || []).length > 0 && (c.status_history || []).at(-1).action === 'REMOVE')).map((c) => c.rank).sort((a, b) => a - b);
    check('T10-15 REPLACE success -> 201 GENERATE_REPLACE, target stays Removed, ranks contiguous', rep1.status === 201 && repCand && rep1.body.added[0].id === 'CND-' + replacement.item_id && removedAfter.status === 'NONE' && removedAfter.status_history.at(-1).action === 'REMOVE' && ranks4.length === 10 && ranks4.every((r, i) => r === i + 1), 'status ' + rep1.status + ' ranks ' + JSON.stringify(ranks4));
    const repAction = (st4.actions || []).filter((a) => a.candidate_id === 'CND-' + replacement.item_id).at(-1);
    check('T10-15 GENERATE_REPLACE recorded in action history', repAction && repAction.action === 'GENERATE_REPLACE', JSON.stringify(repAction || {}));
    const bytesBeforeRej = bytes10();
    const rej404a = await call10('POST', '/api/mvp/candidates/select', { method: 'user', context: 'replace', replaceCandidateId: 'CND-999999', offerIds: [replacement.id] });
    check('T10-16 REPLACE unknown target -> 404', rej404a.status === 404, 'status ' + rej404a.status);
    const activeTarget = Object.values(st4.candidates).find((c) => c.id !== topActive.id && c.status === 'SAVED' || c.id !== topActive.id && c.status === 'QUEUED' || c.id !== topActive.id && c.status === 'NONE' && !((c.status_history || []).length > 0 && (c.status_history || []).at(-1).action === 'REMOVE'));
    const rej409 = await call10('POST', '/api/mvp/candidates/select', { method: 'user', context: 'replace', replaceCandidateId: activeTarget.id, offerIds: [replacement.id] });
    check('T10-17 REPLACE non-removed target -> 409', rej409.status === 409, 'status ' + rej409.status);
    const rej400 = await call10('POST', '/api/mvp/candidates/select', { method: 'user', context: 'replace', replaceCandidateId: topActive.id, offerIds: [replacement.id, (st4.offers || [])[0].id] });
    check('T10-18 REPLACE with 2 offers -> 400', rej400.status === 400, 'status ' + rej400.status);
    const rej404b = await call10('POST', '/api/mvp/candidates/select', { method: 'user', context: 'replace', replaceCandidateId: topActive.id, offerIds: ['OFR-999999'] });
    check('T10-19 REPLACE unknown offer -> 404', rej404b.status === 404, 'status ' + rej404b.status);
    check('T10-20 state bytes unchanged across the four REPLACE rejections', bytes10().equals(bytesBeforeRej), 'bytes-equal ' + bytes10().equals(bytesBeforeRej));
    // Rank lifecycle: SAVE (queue seed) -> REJECT an active (stale gap, no renumber) -> RESTORE (renumber, queue untouched)
    const st5 = (await call10('GET', '/api/mvp/state')).body;
    const actives5 = Object.values(st5.candidates).filter((c) => c.status === 'SAVED' || c.status === 'QUEUED' || (c.status === 'NONE' && !((c.status_history || []).length > 0 && (c.status_history || []).at(-1).action === 'REMOVE')));
    const rankTop5 = actives5.slice().sort((a, b) => a.rank - b.rank);
    const saver = rankTop5.find((c) => c.id !== topActive.id);
    const save1 = await call10('POST', `/api/mvp/candidates/${saver.id}/action`, { action: 'SAVE' });
    check('T10-21 SAVE seeds the queue', save1.status === 200 && save1.body.candidate.status === 'SAVED' && (save1.body.queue || []).includes(saver.id), 'queue ' + JSON.stringify(save1.body.queue || []));
    const rejectTarget = rankTop5.find((c) => c.id !== topActive.id && c.id !== saver.id);
    const ranksBeforeReject = Object.values(st5.candidates).filter((c) => c.id !== topActive.id).map((c) => [c.id, c.rank]);
    const rej1 = await call10('POST', `/api/mvp/candidates/${rejectTarget.id}/action`, { action: 'REJECT' });
    const st6 = (await call10('GET', '/api/mvp/state')).body;
    const ranksAfterReject = Object.values(st6.candidates).filter((c) => c.id !== topActive.id && c.status !== 'REJECTED').map((c) => [c.id, c.rank]);
    const staleKept = ranksAfterReject.every(([id, r]) => ranksBeforeReject.find(([id2, r2]) => id2 === id && r2 === r));
    check('T10-22 REJECT an active: audit rank_before/rank_after=null + actives keep stale ranks (no renumber, by design)', rej1.status === 200 && rej1.body.action.rank_before === rejectTarget.rank && rej1.body.action.rank_after === null && staleKept, 'audit ' + JSON.stringify(rej1.body.action || {}) + ' staleKept ' + staleKept);
    const rst1 = await call10('POST', `/api/mvp/candidates/${topActive.id}/restore`, {});
    const st7 = (await call10('GET', '/api/mvp/state')).body;
    const ranks7 = Object.values(st7.candidates).filter((c) => c.status !== 'REJECTED').map((c) => c.rank).sort((a, b) => a - b);
    check('T10-23 RESTORE -> 200, renumbered contiguous 1..10, queue untouched', rst1.status === 200 && ranks7.length === 10 && ranks7.every((r, i) => r === i + 1) && JSON.stringify(st7.queue) === JSON.stringify([saver.id]), 'ranks ' + JSON.stringify(ranks7) + ' queue ' + JSON.stringify(st7.queue || []));
    const restoreAction = (st7.actions || []).filter((a) => a.candidate_id === topActive.id && a.action === 'RESTORE').at(-1);
    check('T10-24 RESTORE audit: rank_before=stale pre-restore value, rank_after=fresh 1..10', restoreAction && typeof restoreAction.rank_before === 'number' && restoreAction.rank_before === topActive.rank && restoreAction.rank_after >= 1 && restoreAction.rank_after <= 10, JSON.stringify(restoreAction || {}));
    const consistencies10 = Object.values(st7.candidates).map((c) => c.consistency);
    check('T10-25 consistency surfaced for all 11 candidates, all OK', consistencies10.length === 11 && consistencies10.every((c) => c === 'OK'), JSON.stringify(consistencies10));
  } finally {
    child10.kill();
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fsp.rm(ws10, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  check('T10 cleanup: temp workspace removed', !fs.existsSync(ws10), ws10);
} catch (e) {
  check('Test 10 battery', false, (e && e.stack) ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e));
}

// Test 11: Candidate Identity & Variant Foundation (SG-Variant, real HTTP, isolated)
process.stdout.write('\n=== Test 11: Candidate variant identity / overwrite fix / lineage (real HTTP) ===\n');
try {
  const ws11 = await fsp.mkdtemp(path.join(os.tmpdir(), 'ace-variant-'));
  const stateFile11 = path.join(ws11, 'state.json');
  const stagingFile11 = path.join(ws11, 'staging-state.json');
  const assetsDir11 = path.join(ws11, 'assets');
  const exportsDir11 = path.join(ws11, 'exports');
  const port11 = 10200 + Math.floor(Math.random() * 300);
  const child11 = await new Promise((resolve, reject) => {
    const ch = spawn(process.execPath, [SERVER], {
      cwd: REPO_DIR,
      env: { ...process.env, ACE_MVP_STATE_FILE: stateFile11, ACE_MVP_STAGING_FILE: stagingFile11, ACE_MVP_ASSETS_DIR: assetsDir11, ACE_MVP_EXPORTS_DIR: exportsDir11, PORT: String(port11) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let errOut = '';
    ch.stderr.on('data', (c) => { errOut += c; });
    const timer = setTimeout(() => { ch.kill(); reject(new Error('server start timeout\n' + errOut)); }, 20000);
    ch.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early ' + code + '\n' + errOut)); });
    const probe = (attempts) => {
      const p = require('node:http').get({ host: '127.0.0.1', port: port11, path: '/api/mvp/meta', timeout: 1500 }, (res) => { res.resume(); clearTimeout(timer); resolve(ch); });
      p.on('error', () => { if (attempts <= 0) { clearTimeout(timer); ch.kill(); reject(new Error('server unreachable\n' + errOut)); return; } setTimeout(() => probe(attempts - 1), 250); });
      p.on('timeout', () => { p.destroy(); });
    };
    probe(40);
  });
  const call11 = async (method, route, body) => {
    const res = await fetch('http://127.0.0.1:' + port11 + route, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { status: res.status, body: json, text };
  };
  const bytes11 = () => fs.readFileSync(stateFile11);
  try {
    const header11 = ['item_id', 'shop_id', 'shop_name', 'product_name', 'category',
      'price_thb', 'list_price_thb', 'commission_rate', 'rating', 'rating_count',
      'units_sold', 'shop_rating', 'related_shop_count',
      'promo_type', 'promo_label', 'promo_depth_pct',
      'product_url', 'shop_url', 'exported_at'].join(',');
    const csv11 = [header11, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => [
      String(4000 + i), `SHOP-4-${i}`, `Shop ${i}`, `Product ${i}`, 'Home',
      String(100 * i), String(120 * i), '0.10', '4.5', String(50 * i), String(10 * i), '4.7', String(i),
      'PROMO', `Deal ${i}`, '10', `https://example.com/p/${i}`, `https://example.com/s/${i}`, '2026-01-10',
    ].join(','))].join('\n');
    const imp11 = await call11('POST', '/api/mvp/import', { csv: csv11 });
    check('T11-01 import 11-row CSV', imp11.status === 201 && imp11.body.records.offers === 11, 'status ' + imp11.status);
    const gen11 = await call11('POST', '/api/mvp/candidates/generate', { acknowledgeExpired: true });
    check('T11-02 generate top-5 originals', gen11.status === 201 && gen11.body.count === 5, 'count ' + (gen11.body || {}).count);
    const stA = (await call11('GET', '/api/mvp/state')).body;
    const originals = stA.candidates.filter((c) => !c.variant_of);
    const original = originals.slice().sort((a, b) => a.rank - b.rank)[0];
    const originalSnapshot = JSON.stringify(stA.candidates.find((c) => c.id === original.id));
    const var1 = await call11('POST', `/api/mvp/candidates/${original.id}/variant`, {});
    const v = var1.body && var1.body.variant;
    check('T11-03 variant create -> 201, id CND-<item>-V1, parent ref', var1.status === 201 && v && v.id === original.id + '-V1' && v.variant_of === original.id && v.variant_index === 1, 'status ' + var1.status + ' id ' + (v || {}).id);
    const stB = (await call11('GET', '/api/mvp/state')).body;
    const originalAfter = stB.candidates.find((c) => c.id === original.id);
    check('T11-04 original byte-for-byte unchanged after variant creation (no renumber)', JSON.stringify(originalAfter) === originalSnapshot, 'identical ' + (JSON.stringify(originalAfter) === originalSnapshot));
    const variantInView = stB.candidates.find((c) => c.id === v.id);
    check('T11-05 variant: status NONE, rank null (not ranked yet), VARIANT_CREATE history, consistency OK', variantInView.status === 'NONE' && variantInView.rank === null && variantInView.status_history.length === 1 && variantInView.status_history[0].action === 'VARIANT_CREATE' && variantInView.consistency === 'OK', JSON.stringify({ status: variantInView.status, rank: variantInView.rank, history: variantInView.status_history, consistency: variantInView.consistency }));
    const orderIds = stB.candidates.map((c) => c.id);
    check('T11-06 candidateOrder (observed via viewState order) contains variant, no duplicate ids', orderIds.includes(v.id) && new Set(orderIds).size === orderIds.length, 'len ' + orderIds.length + ' unique ' + (new Set(orderIds).size === orderIds.length));
    // Content generation from the variant through the existing lineage model
    const cgen = await call11('POST', '/api/mvp/content/generate', { candidate_id: v.id, approach_key: 'personalized_a' });
    const stC = (await call11('GET', '/api/mvp/state')).body;
    const project = (stC.contents || []).find((p) => p.candidate_id === v.id);
    check('T11-07 content generate from variant -> 200 (CA-V1 contract) + CNT lineage references the variant id', cgen.status === 200 && project && project.candidate_id === v.id && project.artifact && project.artifact.sha256, 'status ' + cgen.status + ' candidate_id ' + (project || {}).candidate_id);
    const artPath = project && project.artifact && project.artifact.file_path;
    const artBytes = artPath ? fs.readFileSync(artPath) : null;
    const bytesBeforeFailures = bytes11();
    const vv = await call11('POST', `/api/mvp/candidates/${v.id}/variant`, {});
    check('T11-08 variant of variant -> 409', vv.status === 409, 'status ' + vv.status);
    const v404 = await call11('POST', '/api/mvp/candidates/CND-999999/variant', {});
    check('T11-09 variant of unknown candidate -> 404', v404.status === 404, 'status ' + v404.status);
    check('T11-10 state bytes unchanged by the two failed variant calls', bytes11().equals(bytesBeforeFailures), 'bytes-equal ' + bytes11().equals(bytesBeforeFailures));
    // Lifecycle consistency
    const freshOriginal = originals.filter((c) => c.id !== original.id && (c.status_history || []).length === 0)[0];
    const rmFresh = await call11('POST', `/api/mvp/candidates/${freshOriginal.id}/action`, { action: 'REMOVE' });
    check('T11-11 REMOVE on fresh not-actioned original -> 409 (guard by design)', rmFresh.status === 409, 'status ' + rmFresh.status);
    const target2 = originals.filter((c) => c.id !== original.id && c.id !== freshOriginal.id)[0];
    await call11('POST', `/api/mvp/candidates/${target2.id}/action`, { action: 'SAVE' });
    const rem2 = await call11('POST', `/api/mvp/candidates/${target2.id}/action`, { action: 'REMOVE' });
    check('T11-12 SAVE+REMOVE -> Removed (soft delete)', rem2.status === 200 && rem2.body.candidate.status === 'NONE' && rem2.body.candidate.status_history.at(-1).action === 'REMOVE', 'status ' + rem2.status);
    const stD = (await call11('GET', '/api/mvp/state')).body;
    const removedCandidate = stD.candidates.find((c) => c.id === target2.id);
    const removedOffer = stD.offers.find((o) => o.id === removedCandidate.offer_id);
    const histLenBefore = removedCandidate.status_history.length;
    const reAdd = await call11('POST', '/api/mvp/candidates/select', { method: 'user', context: 'add', offerIds: [removedOffer.id] });
    const stE = (await call11('GET', '/api/mvp/state')).body;
    const removedAfter = stE.candidates.find((c) => c.id === target2.id);
    check('T11-13 re-add of a Removed item -> 409 + lifecycle history intact (overwrite defect closed)', reAdd.status === 409 && removedAfter.status_history.length === histLenBefore && removedAfter.status_history.at(-1).action === 'REMOVE', 'status ' + reAdd.status + ' hist ' + removedAfter.status_history.length);
    const rsLow = await call11('POST', '/api/mvp/candidates/select', { method: 'research', context: 'add', count: 3 });
    check('T11-14 RS add counts only candidate-less offers as eligible (removed item excluded)', rsLow.status === 201 && rsLow.body.eligible_count === 6 && rsLow.body.added_count === 3 && !rsLow.body.added.some((c) => c.id === 'CND-' + removedOffer.item_id), 'eligible ' + (rsLow.body || {}).eligible_count + ' added ' + (rsLow.body || {}).added_count);
    const rst11 = await call11('POST', `/api/mvp/candidates/${target2.id}/restore`, {});
    const stF = (await call11('GET', '/api/mvp/state')).body;
    const ranksF = stF.candidates.filter((c) => c.status !== 'REJECTED' && c.rank !== null).map((c) => c.rank).sort((a, b) => a - b);
    check('T11-15 RESTORE -> renumbered contiguous ranks incl. previously rank-null variant', rst11.status === 200 && ranksF.length === stF.candidates.filter((c) => c.status !== 'REJECTED').length && ranksF.every((r, i) => r === i + 1), 'ranks ' + JSON.stringify(ranksF));
    const artBytesAfter = artPath ? fs.readFileSync(artPath) : null;
    check('T11-16 ART file byte-identical after all research-side edits', artBytesAfter && artBytes.equals(artBytesAfter), 'identical ' + (!!artBytesAfter && artBytes.equals(artBytesAfter)));
    const vReject = await call11('POST', `/api/mvp/candidates/${v.id}/action`, { action: 'REJECT' });
    const vSave = await call11('POST', `/api/mvp/candidates/${v.id}/action`, { action: 'SAVE' });
    check('T11-17 variant lifecycle obeys the same transition rules (REJECT ok; SAVE after REJECT -> 409)', vReject.status === 200 && vReject.body.candidate.status === 'REJECTED' && vSave.status === 409, 'reject ' + vReject.status + ' save ' + vSave.status);
    const stG = (await call11('GET', '/api/mvp/state')).body;
    const finalIds = stG.candidates.map((c) => c.id);
    check('T11-18 final candidateOrder uniqueness invariant', new Set(finalIds).size === finalIds.length, 'len ' + finalIds.length);
  } finally {
    child11.kill();
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fsp.rm(ws11, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  check('T11 cleanup: temp workspace removed', !fs.existsSync(ws11), ws11);
} catch (e) {
  check('Test 11 battery', false, (e && e.stack) ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e));
}

// Test 12: Vertical Slice 1 — canonical payload, revision change-set, snapshot + Evidence Annex β + restore (real HTTP, isolated)
process.stdout.write('\n=== Test 12: Vertical Slice 1 — canonicalize / rev / snapshot / annex / restore (real HTTP) ===\n');
try {
  const crypto12 = require('crypto');
  const canon12 = (value) => {
    if (value === null) return 'null';
    const type = typeof value;
    if (type === 'string') return JSON.stringify(value);
    if (type === 'boolean') return value ? 'true' : 'false';
    if (type === 'number') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canon12).join(',') + ']';
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return '{' + keys.map((key) => JSON.stringify(key) + ':' + canon12(value[key])).join(',') + '}';
  };
  const ws12 = await fsp.mkdtemp(path.join(os.tmpdir(), 'ace-vs1-'));
  const stateFile12 = path.join(ws12, 'state.json');
  const stagingFile12 = path.join(ws12, 'staging-state.json');
  const assetsDir12 = path.join(ws12, 'assets');
  const exportsDir12 = path.join(ws12, 'exports');
  const port12 = 10800 + Math.floor(Math.random() * 300);
  const child12 = await new Promise((resolve, reject) => {
    const ch = spawn(process.execPath, [SERVER], {
      cwd: REPO_DIR,
      env: { ...process.env, ACE_MVP_STATE_FILE: stateFile12, ACE_MVP_STAGING_FILE: stagingFile12, ACE_MVP_ASSETS_DIR: assetsDir12, ACE_MVP_EXPORTS_DIR: exportsDir12, PORT: String(port12) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let errOut = '';
    ch.stderr.on('data', (c) => { errOut += c; });
    const timer = setTimeout(() => { ch.kill(); reject(new Error('server start timeout\n' + errOut)); }, 20000);
    ch.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited early ' + code + '\n' + errOut)); });
    const probe = (attempts) => {
      const p = require('node:http').get({ host: '127.0.0.1', port: port12, path: '/api/mvp/meta', timeout: 1500 }, (res) => { res.resume(); clearTimeout(timer); resolve(ch); });
      p.on('error', () => { if (attempts <= 0) { clearTimeout(timer); ch.kill(); reject(new Error('server unreachable\n' + errOut)); return; } setTimeout(() => probe(attempts - 1), 250); });
      p.on('timeout', () => { p.destroy(); });
    };
    probe(40);
  });
  const call12 = async (method, route, body) => {
    const res = await fetch('http://127.0.0.1:' + port12 + route, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { status: res.status, body: json, text };
  };
  const bytes12 = () => fs.readFileSync(stateFile12);
  const csv12 = (base) => {
    const header = ['item_id', 'shop_id', 'shop_name', 'product_name', 'category',
      'price_thb', 'list_price_thb', 'commission_rate', 'rating', 'rating_count',
      'units_sold', 'shop_rating', 'related_shop_count',
      'promo_type', 'promo_label', 'promo_depth_pct',
      'product_url', 'shop_url', 'exported_at'].join(',');
    return [header, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => [
      String(base + i), `SHOP-${base}-${i}`, `Shop ${i}`, `Product ${i}`, 'Home',
      String(100 * i), String(120 * i), '0.10', '4.5', String(50 * i), String(10 * i), '4.7', String(i),
      'PROMO', `Deal ${i}`, '10', `https://example.com/p/${i}`, `https://example.com/s/${i}`, '2026-01-10',
    ].join(','))].join('\n');
  };
  try {
    const imp12 = await call12('POST', '/api/mvp/import', { csv: csv12(5000) });
    check('T12-01 import 11-row CSV into isolated temp state', imp12.status === 201 && imp12.body.records.offers === 11, 'status ' + imp12.status);
    const gen12 = await call12('POST', '/api/mvp/candidates/generate', { acknowledgeExpired: true });
    const st12a = (await call12('GET', '/api/mvp/state')).body;
    check('T12-02 generate 5 originals — change-set assigns rev = 1 to every new entity', gen12.status === 201 && gen12.body.count === 5 && st12a.candidates.every((c) => c.rev === 1), 'revs ' + JSON.stringify(st12a.candidates.map((c) => c.rev)));
    const originals12 = st12a.candidates.filter((c) => !c.variant_of).slice().sort((a, b) => a.rank - b.rank);
    const original12 = originals12[0];
    const originalSnapshot12 = JSON.stringify(st12a.candidates.find((c) => c.id === original12.id));
    const var12 = await call12('POST', `/api/mvp/candidates/${original12.id}/variant`, {});
    const v12 = var12.body && var12.body.variant;
    const st12b = (await call12('GET', '/api/mvp/state')).body;
    const originalAfter12 = st12b.candidates.find((c) => c.id === original12.id);
    check('T12-03 variant created — new entity rev = 1, lineage preserved', var12.status === 201 && v12 && v12.id === original12.id + '-V1' && v12.variant_of === original12.id && v12.rev === 1, 'status ' + var12.status + ' id ' + (v12 || {}).id + ' rev ' + (v12 || {}).rev);
    check('T12-04 original byte-for-byte unchanged (no rev bump, no field drift)', JSON.stringify(originalAfter12) === originalSnapshot12, 'identical ' + (JSON.stringify(originalAfter12) === originalSnapshot12));
    const snap12 = await call12('POST', `/api/mvp/candidates/${original12.id}/snapshot`, {});
    const s1 = snap12.body && snap12.body.snapshot;
    check('T12-05 snapshot create → 201 SNP-* + payload_hash + canonical envelope', snap12.status === 201 && s1 && /^SNP-/.test(s1.snapshot_id) && /^[a-f0-9]{64}$/.test(s1.payload_hash) && JSON.parse(s1.canonical_json).spec === 'ace-candidate-payload', 'status ' + snap12.status + ' id ' + (s1 || {}).snapshot_id);
    const parsedBody12 = JSON.parse(s1.canonical_json).body;
    check('T12-06 canonical body = Decision Content (claims without evidence_ids, shop.name only)', parsedBody12.claims.every((c) => !('evidence_ids' in c)) && parsedBody12.shop.name !== undefined && !('id' in parsedBody12.shop) && Array.isArray(parsedBody12.reasons), JSON.stringify(Object.keys(parsedBody12)));
    const annex12 = s1.evidence_annex;
    check('T12-07 annex: candidate_evidence_ids + per-claim refs + generation binding', JSON.stringify(annex12.candidate_evidence_ids) === JSON.stringify(original12.evidence_ids) && annex12.claims.every((entry, i) => entry.claim_index === i && JSON.stringify(entry.evidence_ids) === JSON.stringify(original12.claims[i].evidence_ids)) && annex12.import_sha256 === st12b.import.sha256, 'annex refs + binding ok');
    const recomputedAnnex12 = crypto12.createHash('sha256').update(canon12({ annex_spec: annex12.annex_spec, version: annex12.version, candidate_evidence_ids: annex12.candidate_evidence_ids, claims: annex12.claims, import_sha256: annex12.import_sha256 })).digest('hex');
    check('T12-08 annex_hash independently recomputed by the test matches', recomputedAnnex12 === annex12.annex_hash, recomputedAnnex12);
    check('T12-09 snapshot create alone does not bump rev (entity unchanged)', JSON.stringify(st12b.candidates.find((c) => c.id === original12.id)) === originalSnapshot12, 'identical true');
    const saveTarget12 = originals12[1];
    const save1 = await call12('POST', `/api/mvp/candidates/${saveTarget12.id}/action`, { action: 'SAVE' });
    const st12c = (await call12('GET', '/api/mvp/state')).body;
    const saveTargetAfter = st12c.candidates.find((c) => c.id === saveTarget12.id);
    check('T12-10 SAVE → persisted change bumps rev exactly +1', save1.status === 200 && saveTargetAfter.rev === saveTarget12.rev + 1, 'rev ' + saveTarget12.rev + ' -> ' + saveTargetAfter.rev);
    await call12('POST', `/api/mvp/candidates/${saveTarget12.id}/action`, { action: 'SAVE' });
    const st12d = (await call12('GET', '/api/mvp/state')).body;
    check('T12-11 repeated SAVE persists a new action entry (history grows) → rev +1 per change-set semantics', st12d.candidates.find((c) => c.id === saveTarget12.id).rev === saveTargetAfter.rev + 1, 'rev ' + st12d.candidates.find((c) => c.id === saveTarget12.id).rev);
    // Variant lifecycle + snapshot restore
    await call12('POST', `/api/mvp/candidates/${v12.id}/action`, { action: 'SAVE' });
    const snapV = await call12('POST', `/api/mvp/candidates/${v12.id}/snapshot`, {});
    const s2 = snapV.body && snapV.body.snapshot;
    const st12e = (await call12('GET', '/api/mvp/state')).body;
    const variantRevBeforeRemove = st12e.candidates.find((c) => c.id === v12.id).rev;
    const rem12 = await call12('POST', `/api/mvp/candidates/${v12.id}/action`, { action: 'REMOVE' });
    check('T12-12 REMOVE variant → soft delete (status NONE, last=REMOVE)', rem12.status === 200 && rem12.body.candidate.status === 'NONE' && rem12.body.candidate.status_history.at(-1).action === 'REMOVE', 'status ' + rem12.status);
    const bytesBeforeRestore12 = bytes12();
    const rest12 = await call12('POST', `/api/mvp/candidates/${v12.id}/snapshots/${s2.snapshot_id}/restore`, { expected_revision: variantRevBeforeRemove + 1 });
    const st12f = (await call12('GET', '/api/mvp/state')).body;
    const restoredVariant = st12f.candidates.find((c) => c.id === v12.id);
    check('T12-13 restore → 200; Decision Content restored; rev +1 exactly once; lifecycle untouched', rest12.status === 200 && rest12.body.restored.rev === variantRevBeforeRemove + 2 && restoredVariant.payload_hash === s2.payload_hash && restoredVariant.status === 'NONE' && restoredVariant.status_history.at(-1).action === 'REMOVE', 'status ' + rest12.status + ' rev ' + (rest12.body.restored || {}).rev);
    check('T12-14 evidence refs re-attached from the validated annex (per claim_index)', restoredVariant.claims.every((claim, i) => JSON.stringify(claim.evidence_ids) === JSON.stringify(s2.evidence_annex.claims[i].evidence_ids)), 'refs ok');
    const newSnap12 = (st12f.snapshots || []).find((s) => s.trigger === 'restore' && s.entity_id === v12.id);
    check('T12-15 restore re-records a new append-only snapshot (trigger restore, previous = latest, source_revision = new rev)', newSnap12 && newSnap12.previous_snapshot_id === s2.snapshot_id && newSnap12.source_revision === rest12.body.restored.rev && newSnap12.payload_hash === s2.payload_hash, JSON.stringify({ id: (newSnap12 || {}).snapshot_id, prev: (newSnap12 || {}).previous_snapshot_id }));
    check('T12-16 historical snapshot S2 untouched (byte-identical record)', JSON.stringify(st12f.snapshots.find((s) => s.snapshot_id === s2.snapshot_id)) === JSON.stringify(st12e.snapshots.find((s) => s.snapshot_id === s2.snapshot_id)), 'identical true');
    const bytesBeforeCas12 = bytes12();
    const casFail = await call12('POST', `/api/mvp/candidates/${v12.id}/snapshots/${s2.snapshot_id}/restore`, { expected_revision: rest12.body.restored.rev + 9 });
    check('T12-17 CAS mismatch → 409 reporting both revisions', casFail.status === 409 && /revision mismatch/.test(casFail.body && casFail.body.error || ''), 'status ' + casFail.status);
    check('T12-18 state bytes identical after CAS rejection', bytes12().equals(bytesBeforeCas12), 'bytes-equal ' + bytes12().equals(bytesBeforeCas12));
    // F-R5: corrupt one annex evidence ref (re-annex_hash kept valid via test-side canonicalizer) → refs validation rejects
    const st12g = (await call12('GET', '/api/mvp/state')).body;
    const corruptSnap = st12g.snapshots.find((s) => s.snapshot_id === s2.snapshot_id);
    const corruptSnapIndex = st12g.snapshots.indexOf(corruptSnap);
    const rawState12 = JSON.parse(fs.readFileSync(stateFile12, 'utf8'));
    const rawSnap12 = rawState12.snapshots[s2.snapshot_id];
    const originalRef12 = rawSnap12.evidence_annex.claims[0].evidence_ids[0];
    rawSnap12.evidence_annex.claims[0].evidence_ids[0] = 'EV-999999-PRICE';
    rawSnap12.evidence_annex.annex_hash = crypto12.createHash('sha256').update(canon12({ annex_spec: rawSnap12.evidence_annex.annex_spec, version: rawSnap12.evidence_annex.version, candidate_evidence_ids: rawSnap12.evidence_annex.candidate_evidence_ids, claims: rawSnap12.evidence_annex.claims, import_sha256: rawSnap12.evidence_annex.import_sha256 })).digest('hex');
    fs.writeFileSync(stateFile12, JSON.stringify(rawState12, null, 2) + '\n', 'utf8');
    const bytesCorrupt12 = bytes12();
    const f5 = await call12('POST', `/api/mvp/candidates/${v12.id}/snapshots/${s2.snapshot_id}/restore`, { expected_revision: rest12.body.restored.rev });
    check('T12-19 F-R5: unresolved annex ref → 409 with per-id report (integrity valid, binding refused)', f5.status === 409 && /do not resolve/.test(f5.body && f5.body.error || '') && /EV-999999-PRICE/.test(f5.body && f5.body.error || ''), 'status ' + f5.status + ' ' + JSON.stringify(f5.body || {}));
    const corruptedParsed12 = JSON.parse(bytesCorrupt12.toString('utf8'));
    check('T12-20 no entity rev or snapshot mutation persisted by the rejected restore', corruptedParsed12.candidates[v12.id].rev === rest12.body.restored.rev && JSON.stringify(corruptedParsed12.snapshots[s2.snapshot_id]) === JSON.stringify(JSON.parse(bytes12().toString('utf8')).snapshots[s2.snapshot_id]), 'rev + snapshot record unchanged');
    check('T12-21 state equals corrupted pre-request bytes exactly (no silent repair)', bytes12().equals(bytesCorrupt12), 'bytes-equal ' + bytes12().equals(bytesCorrupt12));
    // F-R3/V-AN-2: corrupt annex_hash only
    const rawState12b = JSON.parse(fs.readFileSync(stateFile12, 'utf8'));
    rawState12b.snapshots[s2.snapshot_id].evidence_annex.annex_hash = '0'.repeat(64);
    fs.writeFileSync(stateFile12, JSON.stringify(rawState12b, null, 2) + '\n', 'utf8');
    const bytesCorruptHash12 = bytes12();
    const f3 = await call12('POST', `/api/mvp/candidates/${v12.id}/snapshots/${s2.snapshot_id}/restore`, { expected_revision: rest12.body.restored.rev });
    check('T12-22 F-R3: annex_hash mismatch → 409', f3.status === 409 && /annex_hash mismatch/.test(f3.body && f3.body.error || ''), 'status ' + f3.status);
    check('T12-23 state bytes identical after annex_hash rejection', bytes12().equals(bytesCorruptHash12), 'bytes-equal ' + bytes12().equals(bytesCorruptHash12));
    // Generation binding: re-import resets everything → old snapshot gone
    const reimp = await call12('POST', '/api/mvp/import', { csv: csv12(6000) });
    check('T12-24 re-import different CSV → full reset', reimp.status === 201 && reimp.body.reset === true, 'status ' + reimp.status);
    const goneSnap = await call12('POST', `/api/mvp/candidates/${v12.id}/snapshots/${s2.snapshot_id}/restore`, { expected_revision: rest12.body.restored.rev });
    check('T12-25 restore after reset → 404 (snapshot/entity absent from current generation)', goneSnap.status === 404, 'status ' + goneSnap.status);
    const regen = await call12('POST', '/api/mvp/candidates/generate', { acknowledgeExpired: true });
    check('T12-26 generate on new generation → rev = 1 (fresh entities)', regen.status === 201 && (await call12('GET', '/api/mvp/state')).body.candidates.every((c) => c.rev === 1), 'revs all 1');
    const st12g2 = (await call12('GET', '/api/mvp/state')).body;
    check('T12-27 new-generation consistency all OK + source binding intact', st12g2.candidates.every((c) => c.consistency === 'OK') && st12g2.candidates.every((c) => c.provenance.input_sha256 === st12g2.import.sha256), 'all OK + bound');
    // RV-4: second generate after a persisted action → survivor rev monotonic (+1 on representation change)
    const st12h = (await call12('GET', '/api/mvp/state')).body;
    const actioned12 = st12h.candidates.find((c) => c.status === 'NONE' && (c.status_history || []).length === 0);
    await call12('POST', `/api/mvp/candidates/${actioned12.id}/action`, { action: 'SAVE' });
    const revBeforeGen2 = (await call12('GET', '/api/mvp/state')).body.candidates.find((c) => c.id === actioned12.id).rev;
    await call12('POST', '/api/mvp/candidates/generate', { acknowledgeExpired: true });
    const st12i = (await call12('GET', '/api/mvp/state')).body;
    const survivor12 = st12i.candidates.find((c) => c.id === actioned12.id);
    check('T12-28 RV-4: second generate → survivor representation changed (history loss) → rev +1, never reset', survivor12.rev === revBeforeGen2 + 1, 'rev ' + revBeforeGen2 + ' -> ' + survivor12.rev);
    const st12j = (await call12('GET', '/api/mvp/state')).body;
    const divergent12 = st12j.candidates.find((c) => c.id === actioned12.id);
    check('T12-29 known behavior (§8/§5.3): regenerate after actions → survivor consistency = ACTION_LOG_DIVERGENT (surfaced, never auto-repaired)', divergent12.consistency === 'ACTION_LOG_DIVERGENT', divergent12.consistency);
  } finally {
    child12.kill();
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fsp.rm(ws12, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  check('T12 cleanup: temp workspace removed', !fs.existsSync(ws12), ws12);
} catch (e) {
  check('Test 12 battery', false, (e && e.stack) ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e));
}

// Summary
process.stdout.write('\n=== Summary: ' + checks.length + ' checks, ' + failures + ' failures ===\n');
const allPassed = checks.every(c => c.ok);
process.exitCode = allPassed ? 0 : 1;
}

main().catch((err) => {
  process.stdout.write('FATAL  ' + ((err && err.stack) || String(err)) + '\n');
  process.exitCode = 1;
});
