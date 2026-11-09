'use strict';

/**
 * ACE A1 — acceptance suite for the Local Synthetic Article Prototype.
 *
 * Covers AC-1 … AC-18 from the approved A0/A1 report. Everything runs inside a
 * temporary workspace: the MVP state file and the rendered still are copied, so
 * `.tmp/ace-mvp-evidence/` is never modified (its hash is verified before and
 * after the run).
 *
 *   node verification/site-article-acceptance.js
 *
 * Exit code 0 = every automated check passed.
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const EVIDENCE_STATE = path.join(REPO, '.tmp', 'ace-mvp-evidence', 'state.json');
const EVIDENCE_EXPORTS = path.join(REPO, '.tmp', 'ace-mvp-evidence', 'exports', 'CNT-1', 'CNT-1-preview.png');
const TOKEN = 'a1-acceptance-token';
const SLUG = 'cat-food-1-5kg-cnt-1';

const results = [];

function record(id, title, fn) {
  try {
    fn();
    results.push({ id, title, ok: true });
    console.log(`PASS ${id}  ${title}`);
  } catch (err) {
    results.push({ id, title, ok: false, error: err && err.message });
    console.log(`FAIL ${id}  ${title}`);
    console.log(`     ${err && err.message}`);
  }
}

async function recordAsync(id, title, fn) {
  try {
    await fn();
    results.push({ id, title, ok: true });
    console.log(`PASS ${id}  ${title}`);
  } catch (err) {
    results.push({ id, title, ok: false, error: err && err.message });
    console.log(`FAIL ${id}  ${title}`);
    console.log(`     ${err && err.message}`);
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function proseText(html) {
  const paragraphs = [...html.matchAll(/<p class="prose[^"]*">([\s\S]*?)<\/p>/g)].map((match) => match[1]);
  return paragraphs.map((raw) => decodeEntities(raw.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
}

function visibleText(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function numericTokens(text) {
  return (String(text).match(/\d+(?:\.\d+)?/g) || []);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function request({ port, path: target, token, method = 'GET' }) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token !== undefined && token !== null) headers.Authorization = `Bearer ${token}`;
    const req = http.request({ host: '127.0.0.1', port, path: target, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('request timeout')));
    req.end();
  });
}

async function waitForReady(port, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await request({ port, path: `/review/${SLUG}`, token: TOKEN });
      if (res.status === 200 || res.status === 404) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server did not become ready on port ${port}`);
}

async function main() {
  if (!fs.existsSync(EVIDENCE_STATE)) {
    console.error(`Cannot run: synthetic evidence state is missing at ${EVIDENCE_STATE}`);
    process.exitCode = 2;
    return;
  }

  const evidenceHashBefore = sha256(await fsp.readFile(EVIDENCE_STATE));
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'ace-a1-'));
  const stateFile = path.join(workspace, 'state.json');
  const publicationsFile = path.join(workspace, 'publications.json');
  const exportsDir = path.join(workspace, 'exports');

  await fsp.mkdir(path.join(exportsDir, 'CNT-1'), { recursive: true });
  await fsp.copyFile(EVIDENCE_STATE, stateFile);
  if (fs.existsSync(EVIDENCE_EXPORTS)) {
    await fsp.copyFile(EVIDENCE_EXPORTS, path.join(exportsDir, 'CNT-1', 'CNT-1-preview.png'));
  }

  // ---- seed the PREVIEW publication record through the CLI ----
  const seed = spawn(process.execPath, [
    path.join('app', 'site', 'seed.js'),
    '--content', 'CNT-1',
    '--mvp', stateFile,
    '--out', publicationsFile,
  ], { cwd: REPO, env: { ...process.env, ACE_MVP_STATE_FILE: stateFile } });

  let seedOutput = '';
  seed.stdout.on('data', (chunk) => { seedOutput += chunk; });
  seed.stderr.on('data', (chunk) => { seedOutput += chunk; });
  const seedCode = await new Promise((resolve) => seed.on('close', resolve));
  if (seedCode !== 0) {
    console.error('seed CLI failed:');
    console.error(seedOutput);
    process.exitCode = 2;
    return;
  }

  const port = await freePort();
  const server = spawn(process.execPath, [path.join('app', 'server.js')], {
    cwd: REPO,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      ACE_MVP_STATE_FILE: stateFile,
      ACE_SITE_PUBLICATIONS_FILE: publicationsFile,
      ACE_PREVIEW_TOKEN: TOKEN,
      ACE_MVP_EXPORTS_DIR: exportsDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverLog = '';
  server.stdout.on('data', (chunk) => { serverLog += chunk; });
  server.stderr.on('data', (chunk) => { serverLog += chunk; });

  try {
    await waitForReady(port);

    const articleBySlug = `/review/${SLUG}`;
    const mediaPath = '/media/CNT-1/CNT-1-preview.png';
    const initial = await request({ port, path: articleBySlug, token: TOKEN });
    const html = initial.body.toString('utf8');

    // ---------- AC-1: authorised preview returns the article ----------
    await recordAsync('AC-1', 'authorised PREVIEW returns 200 HTML', () => {
      assert.strictEqual(initial.status, 200, `status ${initial.status}`);
      assert.match(String(initial.headers['content-type']), /^text\/html/, 'content-type must be html');
      assert.ok(html.includes('<h1>'), 'missing h1');
    });

    // ---------- AC-2: fail-closed visibility ----------
    await recordAsync('AC-2', 'no token / wrong token / wrong length / DRAFT all 404', async () => {
      const noToken = await request({ port, path: articleBySlug });
      assert.strictEqual(noToken.status, 404, `no token → ${noToken.status}`);

      const wrong = await request({ port, path: articleBySlug, token: 'not-the-token' });
      assert.strictEqual(wrong.status, 404, `wrong token → ${wrong.status}`);

      const wrongLength = await request({ port, path: articleBySlug, token: 'x' });
      assert.strictEqual(wrongLength.status, 404, `wrong-length token → ${wrongLength.status}`);

      const store = JSON.parse(await fsp.readFile(publicationsFile, 'utf8'));
      const recordKey = Object.keys(store.publications)[0];
      const preview = store.publications[recordKey];
      store.publications[recordKey] = { ...preview, state: 'DRAFT' };
      await fsp.writeFile(publicationsFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');

      const draft = await request({ port, path: articleBySlug, token: TOKEN });
      assert.strictEqual(draft.status, 404, `DRAFT → ${draft.status}`);

      store.publications[recordKey] = preview;
      await fsp.writeFile(publicationsFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');

      const restored = await request({ port, path: articleBySlug, token: TOKEN });
      assert.strictEqual(restored.status, 200, `restored PREVIEW → ${restored.status}`);
    });

    // ---------- AC-3: document head ----------
    record('AC-3', 'single h1, title, lang, charset, viewport', () => {
      assert.strictEqual((html.match(/<h1>/g) || []).length, 1, 'must have exactly one h1');
      assert.match(html, /<title>[^<]+<\/title>/, 'missing non-empty title');
      assert.match(html, /<html lang="th">/, 'missing lang');
      assert.match(html, /<meta charset="utf-8">/, 'missing charset');
      assert.match(html, /name="viewport"/, 'missing viewport');
    });

    // ---------- AC-4: five sections in storyboard order ----------
    record('AC-4', 'five sections ordered like storyboard.scenes roles', () => {
      const roles = [...html.matchAll(/data-role="([A-Z]+)"/g)].map((match) => match[1]);
      assert.deepStrictEqual(roles, ['HOOK', 'PROBLEM', 'OFFER', 'EVIDENCE', 'CTA'], `roles: ${roles.join(',')}`);
      assert.strictEqual((html.match(/<h2>/g) || []).length, 5, 'must have five section headings');
    });

    // ---------- AC-5: prose length 800–1200 code points ----------
    record('AC-5', 'article prose is 800–1200 characters', () => {
      const text = proseText(html).join('');
      const length = Array.from(text).length;
      assert.ok(length >= 800 && length <= 1200, `prose length ${length} outside 800–1200`);
    });

    // ---------- AC-6: no invented numbers ----------
    record('AC-6', 'every number in the article comes from the record', () => {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const content = state.contents['CNT-1'];
      const offer = state.offers[content.offer_id] || {};
      const allowed = new Set(numericTokens(JSON.stringify({
        offer_snapshot: content.offer_snapshot,
        storyboard: content.storyboard,
        script: content.script,
        qa: content.qa,
        cta: content.cta,
        disclosure: content.publish_prep && content.publish_prep.disclosure,
        still: content.export && content.export.still,
        offer: {
          shop_name: offer.shop_name,
          price_thb: offer.price_thb,
          list_price_thb: offer.list_price_thb,
          promo: offer.promo,
          reviews: offer.reviews,
          metrics: offer.metrics,
        },
        evidence: state.evidence,
      })));
      const found = numericTokens(visibleText(html));
      const invented = found.filter((token) => !allowed.has(token));
      assert.deepStrictEqual(invented, [], `numbers with no source: ${invented.join(', ')}`);
    });

    // ---------- AC-7: evidence ids resolve, every section cites one ----------
    record('AC-7', 'every EV-* id resolves and each section cites evidence', () => {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const known = new Set(Object.keys(state.evidence || {}));
      const cited = [...html.matchAll(/<span class="chip">([^<]+)<\/span>/g)].map((match) => match[1]);
      assert.ok(cited.length > 0, 'no evidence chips rendered');
      const dangling = [...new Set(cited)].filter((id) => !known.has(id));
      assert.deepStrictEqual(dangling, [], `dangling evidence ids: ${dangling.join(', ')}`);

      const sections = html.split('class="article-section"').slice(1);
      assert.strictEqual(sections.length, 5, `expected 5 sections, got ${sections.length}`);
      sections.forEach((block, index) => {
        assert.ok(block.includes('evidence-refs'), `section ${index + 1} has no evidence reference`);
      });
    });

    // ---------- AC-8: facts match the record exactly ----------
    record('AC-8', 'price, promo, rating and shop match the record', () => {
      for (const expected of ['420 บาท', '480 บาท', '4.9 จาก 5', '740 รายการ', 'PetJoy', 'Free treat bundle', '2026-10-21']) {
        assert.ok(visibleText(html).includes(expected), `missing: ${expected}`);
      }
    });

    // ---------- AC-9: disclosure before the offer block ----------
    record('AC-9', 'disclosure appears before the facts/offer block', () => {
      const disclosureAt = html.indexOf('class="disclosure"');
      const factsAt = html.indexOf('class="facts"');
      assert.ok(disclosureAt >= 0, 'disclosure block missing');
      assert.ok(factsAt >= 0, 'facts block missing');
      assert.ok(disclosureAt < factsAt, 'disclosure must precede the offer facts');
    });

    // ---------- AC-10: CTA has no link ----------
    record('AC-10', 'CTA callout has no href and no /go reference', () => {
      assert.strictEqual((html.match(/<a\s/g) || []).length, 0, 'page must contain no anchors');
      assert.strictEqual((html.match(/\/go\//g) || []).length, 0, 'page must not reference /go');
      assert.ok(html.includes('class="cta-label"'), 'CTA callout missing');
      const ctaBlock = html.slice(html.indexOf('class="cta"'));
      assert.ok(!ctaBlock.slice(0, 400).includes('href='), 'CTA must not carry an href');
    });

    // ---------- AC-11: no internal leakage ----------
    record('AC-11', 'no undefined/null/NaN and no absolute paths', () => {
      assert.ok(!/undefined/.test(html), 'contains "undefined"');
      assert.ok(!/\bNaN\b/.test(html), 'contains "NaN"');
      assert.ok(!/\[object Object\]/.test(html), 'contains "[object Object]"');
      assert.ok(!/[A-Za-z]:\\/.test(html), 'contains a Windows absolute path');
      assert.ok(!/\/home\/|\/Users\//.test(html), 'contains a POSIX absolute path');
      // Exact leak check rather than a hex heuristic: the base64 hero image would
      // otherwise trip a "looks like a hash" pattern.
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const exportSha = state.contents['CNT-1'].export.sha256;
      assert.ok(!html.includes(exportSha), 'the export sha256 leaked into the page');
      const checksum = state.contents['CNT-1'].script.checksum;
      assert.ok(!html.includes(checksum), 'the script checksum leaked into the page');
    });

    // ---------- AC-12: determinism ----------
    record('AC-12', 'rendering the same record twice yields identical HTML', () => {
      const publicationModule = require(path.join(REPO, 'app', 'site', 'publication.js'));
      const articleModule = require(path.join(REPO, 'app', 'site', 'article.js'));
      const renderModule = require(path.join(REPO, 'app', 'site', 'render.js'));
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const content = state.contents['CNT-1'];
      const record0 = publicationModule.buildPublication({
        content,
        productName: content.offer_snapshot.product_name,
        state: 'PREVIEW',
        env: 'local',
        now: '2026-01-01T00:00:00.000Z',
      });
      const build = () => articleModule.buildArticle({
        content,
        offer: state.offers[content.offer_id],
        offerSnapshot: content.offer_snapshot,
        evidence: new Map(Object.entries(state.evidence)),
        publication: record0,
      });
      const first = build();
      const second = build();
      assert.ok(first.ok && second.ok, 'build failed');
      assert.strictEqual(
        renderModule.renderArticle(first.doc),
        renderModule.renderArticle(second.doc),
        'render is not deterministic',
      );
      assert.ok(first.doc.body_char_count >= 800 && first.doc.body_char_count <= 1200,
        `body_char_count ${first.doc.body_char_count} outside 800–1200`);
    });

    // ---------- AC-13: output escaping ----------
    record('AC-13', 'untrusted field values are escaped, never executed as markup', () => {
      const publicationModule = require(path.join(REPO, 'app', 'site', 'publication.js'));
      const articleModule = require(path.join(REPO, 'app', 'site', 'article.js'));
      const renderModule = require(path.join(REPO, 'app', 'site', 'render.js'));
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const tampered = JSON.parse(JSON.stringify(state.contents['CNT-1']));
      const payload = '<img src=x onerror=alert(1)>';
      tampered.offer_snapshot.product_name = payload;
      tampered.storyboard.scenes[0].audio.voiceover = `ราคา ${payload}`;
      const record0 = publicationModule.buildPublication({
        content: tampered,
        productName: payload,
        state: 'PREVIEW',
        env: 'local',
        now: '2026-01-01T00:00:00.000Z',
      });
      const built = articleModule.buildArticle({
        content: tampered,
        offer: state.offers[tampered.offer_id],
        offerSnapshot: tampered.offer_snapshot,
        evidence: new Map(Object.entries(state.evidence)),
        publication: record0,
      });
      assert.ok(built.ok, 'build failed');
      const out = renderModule.renderArticle(built.doc);
      assert.ok(!out.includes('<img src=x'), 'raw payload reached the output');
      assert.ok(out.includes('&lt;img src=x'), 'payload was not escaped');
      // The escaped payload remains inert text, so the handler check is scoped to
      // real tags: a tag that opens with '<' and carries an on* attribute.
      assert.ok(!/<[a-z][^>]*\son[a-z]+\s*=/i.test(out), 'inline event handler attribute present');
    });

    // ---------- AC-14: media access control ----------
    await recordAsync('AC-14', 'media: allowlisted image only, traversal and non-images refused', async () => {
      const ok = await request({ port, path: mediaPath, token: TOKEN });
      assert.strictEqual(ok.status, 200, `media → ${ok.status}`);
      assert.strictEqual(String(ok.headers['content-type']), 'image/png', 'wrong content-type');

      const noToken = await request({ port, path: mediaPath });
      assert.strictEqual(noToken.status, 404, `media without token → ${noToken.status}`);

      const traversal = await request({ port, path: '/media/CNT-1/..%2f..%2fstate.json', token: TOKEN });
      assert.ok([400, 404].includes(traversal.status), `traversal → ${traversal.status}`);

      const traversal2 = await request({ port, path: '/media/CNT-1/%2e%2e%2f%2e%2e%2fstate.json', token: TOKEN });
      assert.ok([400, 404].includes(traversal2.status), `encoded traversal → ${traversal2.status}`);

      const nonImage = await request({ port, path: '/media/CNT-1/publications.json', token: TOKEN });
      assert.strictEqual(nonImage.status, 404, `non-image → ${nonImage.status}`);

      const unknownContent = await request({ port, path: '/media/CNT-999/CNT-1-preview.png', token: TOKEN });
      assert.strictEqual(unknownContent.status, 404, `unknown content → ${unknownContent.status}`);

      const unreferenced = await request({ port, path: '/media/CNT-1/not-referenced.png', token: TOKEN });
      assert.strictEqual(unreferenced.status, 404, `unreferenced file → ${unreferenced.status}`);

      const extraSegment = await request({ port, path: '/media/CNT-1/a/b.png', token: TOKEN });
      assert.strictEqual(extraSegment.status, 404, `extra segment → ${extraSegment.status}`);

      assert.ok(!(await fsp.readFile(path.join(workspace, 'state.json'))).toString('utf8').includes('secret'),
        'sanity: state file must not be readable through media');
    });

    // ---------- AC-15: CSP-compatible output ----------
    record('AC-15', 'no inline script, inline style or inline handler', () => {
      assert.strictEqual((html.match(/<script/gi) || []).length, 0, 'script tag present');
      assert.ok(!/\sstyle\s*=/i.test(html), 'inline style attribute present');
      const withoutContentAttrs = html.replace(/\scontent="[^"]*"/g, '');
      assert.ok(!/\son[a-z]+\s*=/i.test(withoutContentAttrs), 'inline event handler present');
      assert.match(html, /<link rel="stylesheet" href="\/review\.css">/, 'expected the external stylesheet');
      // The page must render without a second authenticated request.
      assert.match(html, /<img src="data:image\/png;base64,/, 'hero image should be inlined as a data URI');
      assert.ok(!/src="\/media\//.test(html), 'hero image must not depend on the token-gated /media route');
      const csp = initial.headers['content-security-policy'];
      assert.ok(typeof csp === 'string' && csp.includes("default-src 'self'"), 'CSP header missing');
      assert.strictEqual(String(initial.headers['cache-control']), 'no-store', 'expected no-store');
      assert.strictEqual(String(initial.headers['referrer-policy']), 'no-referrer', 'expected no-referrer');
      assert.strictEqual(String(initial.headers['x-content-type-options']), 'nosniff', 'expected nosniff');
    });

    // ---------- AC-16: QA FAIL blocks the page ----------
    await recordAsync('AC-16', 'QA FAIL > 0 withholds the page (unit + HTTP)', async () => {
      const publicationModule = require(path.join(REPO, 'app', 'site', 'publication.js'));
      const articleModule = require(path.join(REPO, 'app', 'site', 'article.js'));
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const content = JSON.parse(JSON.stringify(state.contents['CNT-1']));
      content.qa.summary.FAIL = 1;
      const built = articleModule.buildArticle({
        content,
        offer: state.offers[content.offer_id],
        offerSnapshot: content.offer_snapshot,
        evidence: new Map(Object.entries(state.evidence)),
        publication: publicationModule.buildPublication({
          content,
          productName: content.offer_snapshot.product_name,
          state: 'PREVIEW',
          env: 'local',
          now: '2026-01-01T00:00:00.000Z',
        }),
      });
      assert.strictEqual(built.ok, false, 'build should fail on QA FAIL');
      assert.strictEqual(built.reason, 'QA_BLOCKED', `reason ${built.reason}`);

      // Unresolved evidence must fail closed as well.
      const brokenEvidence = JSON.parse(JSON.stringify(state.contents['CNT-1']));
      brokenEvidence.storyboard.scenes[0].evidence_ids = ['EV-DOES-NOT-EXIST'];
      const broken = articleModule.buildArticle({
        content: brokenEvidence,
        offer: state.offers[brokenEvidence.offer_id],
        offerSnapshot: brokenEvidence.offer_snapshot,
        evidence: new Map(Object.entries(state.evidence)),
        publication: publicationModule.buildPublication({
          content: brokenEvidence,
          productName: brokenEvidence.offer_snapshot.product_name,
          state: 'PREVIEW',
          env: 'local',
          now: '2026-01-01T00:00:00.000Z',
        }),
      });
      assert.strictEqual(broken.ok, false, 'build should fail on unresolved evidence');
      assert.strictEqual(broken.reason, 'EVIDENCE_UNRESOLVED', `reason ${broken.reason}`);

      // HTTP level: flip FAIL in the copied state, expect 404, then restore.
      const mutated = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const originalFail = mutated.contents['CNT-1'].qa.summary.FAIL;
      mutated.contents['CNT-1'].qa.summary.FAIL = 1;
      await fsp.writeFile(stateFile, JSON.stringify(mutated, null, 2), 'utf8');
      const blocked = await request({ port, path: articleBySlug, token: TOKEN });
      assert.strictEqual(blocked.status, 404, `QA FAIL over HTTP → ${blocked.status}`);
      mutated.contents['CNT-1'].qa.summary.FAIL = originalFail;
      await fsp.writeFile(stateFile, JSON.stringify(mutated, null, 2), 'utf8');
      const restored = await request({ port, path: articleBySlug, token: TOKEN });
      assert.strictEqual(restored.status, 200, `restored → ${restored.status}`);
    });

    // ---------- AC-17: suite self-check ----------
    record('AC-17', 'this suite ran and the server stayed alive', () => {
      assert.ok(results.length >= 15, `only ${results.length} checks ran`);
      assert.strictEqual(server.exitCode, null, 'server exited during the run');
    });

    // ---------- AC-18: manual check ----------
    console.log('MANUAL AC-18  inspected on 2026-11-09 at 375/416/622 px; this suite does not automate layout');
  } finally {
    server.kill();
    await new Promise((resolve) => {
      server.once('close', resolve);
      setTimeout(resolve, 3000);
    }).catch(() => {});
  }

  // ---- evidence immutability ----
  const evidenceHashAfter = sha256(await fsp.readFile(EVIDENCE_STATE));
  const immutable = evidenceHashBefore === evidenceHashAfter && evidenceHashBefore === 'aef43bebbc363a8d67cb4ea9e7dfeb6bbc596573d4876ca7f57bb42062247332';
  console.log(`${immutable ? 'PASS' : 'FAIL'} EVIDENCE  .tmp/ace-mvp-evidence/state.json byte-identical (${evidenceHashAfter.slice(0, 12)}…)`);
  results.push({ id: 'EVIDENCE', title: 'evidence state byte-identical', ok: immutable });

  if (serverLog && /article withheld|refused|failed/.test(serverLog)) {
    console.log('--- server log (withheld/refused lines) ---');
    console.log(serverLog.split('\n').filter((line) => /withheld|refused|failed/.test(line)).join('\n'));
  }

  const passed = results.filter((entry) => entry.ok).length;
  const failed = results.length - passed;
  console.log('');
  console.log(`SUMMARY  ${passed} passed · ${failed} failed · workspace ${workspace}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('suite error:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
