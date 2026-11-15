'use strict';

/**
 * Real-export SHAPE rehearsal.
 *
 * WHY THIS EXISTS
 * ---------------
 * The real Shopee Affiliate import is still NOT verified: no real export has
 * been supplied. What can be proved without one is that the import pipeline
 * handles the *shapes* a real export takes — different header spellings,
 * different encodings, different delimiters, formatted numbers, missing
 * optional columns, duplicate rows and over-sized files.
 *
 * This script builds machine-generated files that imitate those shapes and
 * runs them through the REAL (non-synthetic) code path:
 *
 *   POST /api/mvp/import/preview
 *   POST /api/mvp/import/commit
 *   POST /api/mvp/staging/:id/research
 *
 * The files are deliberately NOT labelled synthetic, so the app treats them
 * exactly as it will treat a user-supplied export (synthetic: false,
 * source_type SHOPEE_AFFILIATE_EXPORT, verified_against_shopee: false).
 *
 * WHAT IT DOES NOT PROVE
 * ----------------------
 * It does NOT prove that a real Shopee Affiliate export imports successfully.
 * The header names below are hypotheses. A real file may use other names; in
 * that case the preview reports them as unmapped and a human confirms a
 * different mapping. Nothing produced here may be cited as real-export
 * evidence. The real-file check is verification/real-shopee-export-check.js.
 *
 * Usage: node verification/real-export-shape-rehearsal.js
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PORT = Number(process.env.REHEARSAL_PORT || 4326);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.join(REPO, '.tmp', 'real-export-rehearsal');

let checks = 0;
let failures = 0;

function check(label, ok, detail) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
}

function note(message) {
  console.log(`      ${message}`);
}

function section(title) {
  console.log('');
  console.log(title);
  console.log('-'.repeat(title.length));
}

/* Every generated file carries this marker. It is an ASCII comment line, so
   the importer skips it exactly as it skips any other comment, and the
   real-export checker refuses to treat the file as a supplied export. */
const MARKER = '# REHEARSAL FILE - machine generated imitation of an export shape. Not a Shopee export.';

/* ------------------------------------------------------------------ */
/* File builders                                                       */
/* ------------------------------------------------------------------ */

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toDelimited(header, rows, delimiter) {
  const line = (cells) => cells
    .map((cell) => (delimiter === ',' ? csvCell(cell) : String(cell ?? '')))
    .join(delimiter);
  return [header, ...rows].map(line).join('\n') + '\n';
}

function encodeCp874(text) {
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code >= 0x0e01 && code <= 0x0e3a) bytes.push(0xa0 + (code - 0x0e00));
    else if (code === 0x0e3f) bytes.push(0xdf);
    else if (code >= 0x0e40 && code <= 0x0e5b) bytes.push(0xdf + (code - 0x0e3f));
    else bytes.push(0x3f);
  }
  return Buffer.from(bytes);
}

/* Shopee-shaped English headers (hypotheses, not verified against Shopee). */
const EN_HEADER = [
  'Item ID', 'Shop ID', 'Shop Name', 'Product Name', 'Category',
  'Price', 'Original Price', 'Commission Rate', 'Promotion', 'Discount',
  'Rating', 'Review Count', 'Sales', 'Shop Rating', 'Related Shops',
  'Product URL', 'Shop URL', 'Export Date', 'Affiliate Link',
  'Seller Type', 'Campaign',
];

/* Thai headers a Thai Shopee export plausibly uses. */
const TH_HEADER = [
  'รหัสสินค้า', 'รหัสร้านค้า', 'ชื่อร้านค้า', 'ชื่อสินค้า', 'หมวดหมู่',
  'ราคา', 'ราคาเดิม', 'อัตราค่าคอมมิชชั่น', 'โปรโมชั่น', 'ส่วนลด',
  'คะแนนสินค้า', 'จำนวนรีวิว', 'ยอดขาย', 'คะแนนร้านค้า', 'จำนวนร้านค้าที่เกี่ยวข้อง',
  'ลิงก์สินค้า', 'ลิงก์ร้านค้า', 'วันที่ export', 'ลิงก์ affiliate',
];

const TH_FIELDS = [
  'item_id', 'shop_id', 'shop_name', 'product_name', 'category',
  'price_thb', 'list_price_thb', 'commission_rate', 'promo_label', 'promo_depth_pct',
  'rating', 'rating_count', 'units_sold', 'shop_rating', 'related_shop_count',
  'product_url', 'shop_url', 'exported_at', 'affiliate_link',
];

/* Which English column each Thai column stands for. */
const TH_TO_EN = {
  item_id: 'Item ID',
  shop_id: 'Shop ID',
  shop_name: 'Shop Name',
  product_name: 'Product Name',
  category: 'Category',
  price_thb: 'Price',
  list_price_thb: 'Original Price',
  commission_rate: 'Commission Rate',
  promo_label: 'Promotion',
  promo_depth_pct: 'Discount',
  rating: 'Rating',
  rating_count: 'Review Count',
  units_sold: 'Sales',
  shop_rating: 'Shop Rating',
  related_shop_count: 'Related Shops',
  product_url: 'Product URL',
  shop_url: 'Shop URL',
  exported_at: 'Export Date',
  affiliate_link: 'Affiliate Link',
};

const PRODUCTS = [
  ['Vitamin C Serum 30ml', 'ซีรั่มวิตามินซี 30 มล.'],
  ['Sunscreen SPF50 50ml', 'ครีมกันแดดเอสพีเอฟ50 50 มล.'],
  ['Ceramide Barrier Cream', 'ครีมเซรามิดซ่อมผิว'],
  ['Matte Setting Powder', 'พัฟเดอร์เซ็ตติ้งแมทท์'],
  ['Niacinamide Serum 10%', 'เซรัมไนอาซินาไมด์ 10%'],
  ['Gentle Foaming Cleanser', 'ครีมล้างหน้าฟองนุ่ม'],
  ['Hair Growth Serum', 'เซรั่มบำรุงผม'],
  ['Lip Tint Long Last', 'ลิปทินต์แมทท์'],
  ['Cushion Foundation SPF50', 'คัชชั่นฟาว์นเดชั่น'],
  ['Hair Mask Repair', 'มาสก์ซ่อมผม'],
  ['Body Lotion Urea 10%', 'โลชันบอดียูเรีย'],
  ['Anti-Acne Gel 5%', 'เจลสิวแก้สันดู 5%'],
];

const SHOPS = [
  ['Bangkok Beauty Lab', 'ร้านบิวตี้เบลล่า'],
  ['Siam Skin Studio', 'ร้านสยามสกินสตูดิโอ'],
  ['Mae Nakorn Beauty', 'ร้านแม่นาครองบิวตี้'],
  ['Chao Phraya Care', 'ร้านเจ้าพระยาแคร์'],
  ['Thong Dee Beauty', 'ร้านทองดีบิวตี้'],
  ['Ratchada Daily', 'ร้านราชดำเนินเดลี'],
  ['Nimman Skin', 'ร้านนิมมานสกิน'],
  ['Ari Beauty Lab', 'ร้านอริบิวตี้แล็บ'],
];

function buildRows(prefix, { thai = false } = {}) {
  const rows = [];
  const row = (overrides = {}) => {
    const index = rows.length;
    const product = PRODUCTS[index % PRODUCTS.length];
    const shop = SHOPS[index % SHOPS.length];
    const base = {
      'Item ID': `${prefix}${1000 + index}`,
      'Shop ID': `SHOP${String(index % 4).padStart(2, '0')}`,
      'Shop Name': thai ? shop[1] : shop[0],
      'Product Name': thai ? product[1] : product[0],
      'Category': ['Beauty', 'Home', 'Electronics', 'Cat'][index % 4],
      'Price': '฿1,299.00',
      'Original Price': '฿1,599.00',
      'Commission Rate': '8.50%',
      'Promotion': 'Flash Sale',
      'Discount': '18.80',
      'Rating': '4.8',
      'Review Count': '1,204',
      'Sales': '3,450',
      'Shop Rating': '4.9',
      'Related Shops': '1,210',
      'Product URL': `https://shopee.co.th/product/${prefix}${1000 + index}`,
      'Shop URL': `https://shopee.co.th/shop/SHOP${String(index % 4).padStart(2, '0')}`,
      'Export Date': '20/10/2026 08:15',
      'Affiliate Link': `https://s.shopee.co.th/${prefix}affiliate${index}`,
      'Seller Type': 'Mall',
      'Campaign': 'Oct 2026',
    };
    return { ...base, ...overrides };
  };

  rows.push(row());                                                  // 1 plain
  rows.push(row({ 'Price': '฿599.00', 'Original Price': '฿799.00', 'Commission Rate': '6%' })); // 2 plain
  rows.push(row({ 'Price': '฿249.00', 'Original Price': '฿249.00', 'Commission Rate': '10.00%', 'Discount': '0' })); // 3 plain
  rows.push(row({ 'Price': '฿1,050.00', 'Original Price': '฿1,500.00', 'Commission Rate': '4.5%', 'Discount': '30' })); // 4 plain
  rows.push(row({                                                          // 5 optional metrics missing
    'Rating': '', 'Review Count': '', 'Sales': '', 'Shop Rating': '', 'Related Shops': '',
  }));
  rows.push(row({                                                          // 6 duplicate of row 1
    'Item ID': `${prefix}1000`, 'Shop ID': 'SHOP00', 'Product Name': 'Duplicate Of Row One',
  }));
  rows.push(row({ 'Price': 'n/a' }));                                     // 7 invalid price
  rows.push(row({ 'Product Name': '' }));                                 // 8 invalid product name
  rows.push(row({ 'Commission Rate': '' }));                              // 9 unknown: no commission
  rows.push(row());                                                       // 10 plain
  rows.push(row());                                                       // 11 plain
  rows.push(row());                                                       // 12 plain
  return rows;
}

function toCells(header, rows) {
  return rows.map((row) => header.map((column) => row[column] ?? ''));
}

function toThaiCells(rows) {
  return rows.map((row) => TH_FIELDS.map((field) => row[TH_TO_EN[field]] ?? ''));
}

/* ------------------------------------------------------------------ */
/* Server helpers                                                      */
/* ------------------------------------------------------------------ */

async function call(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

function startServer(tmp, stateFile, stagingFile) {
  const child = spawn(process.execPath, ['app/server.js'], {
    cwd: tmp,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(PORT),
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

async function waitForHealth(attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function stop(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill();
    setTimeout(resolve, 2000);
  });
}

function uploadBody(filename, buffer) {
  return { filename, content_base64: buffer.toString('base64') };
}

(async () => {
  console.log('=== Real-export shape rehearsal ===');
  console.log('REHEARSAL ONLY. These files are machine-generated imitations of export');
  console.log('SHAPES. They do NOT prove that a real Shopee export imports.');
  console.log(`checked at: ${new Date().toISOString()}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  /* ---------------- build the variants ---------------- */
  const enRows = buildRows('A');
  const enCsv = toDelimited(EN_HEADER, toCells(EN_HEADER, enRows), ',');
  const enTsv = toDelimited(EN_HEADER, toCells(EN_HEADER, enRows), '\t');
  const thRows = buildRows('B', { thai: true });
  const thCsv = toDelimited(TH_HEADER, toThaiCells(thRows), ',');

  const files = {
    'shopee-export-shape-en.csv': Buffer.from(`${MARKER}\n${enCsv}`, 'utf8'),
    'shopee-export-shape-en-bom.csv': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`${MARKER}\n${enCsv}`, 'utf8')]),
    'shopee-export-shape-en.tsv': Buffer.from(`${MARKER}\n${enTsv}`, 'utf8'),
    'shopee-export-shape-th-874.csv': encodeCp874(`${MARKER}\n${thCsv}`),
  };

  // A file with a required column removed entirely.
  const missingShopIndex = EN_HEADER.indexOf('Shop ID');
  const shortHeader = EN_HEADER.filter((_, index) => index !== missingShopIndex);
  const shortRows = toCells(EN_HEADER, enRows).map((cells) => cells.filter((_, index) => index !== missingShopIndex));
  files['shopee-export-shape-missing-shop-id.csv'] = Buffer.from(`${MARKER}\n${toDelimited(shortHeader, shortRows, ',')}`, 'utf8');

  // A file that is larger than the row limit.
  const manyRows = [];
  for (let i = 0; i < 520; i += 1) {
    manyRows.push(toCells(EN_HEADER, [buildRows('C')[0]])[0].map((value, index) => (
      index === 0 ? `C${100000 + i}` : value
    )));
  }
  files['shopee-export-shape-520-rows.csv'] = Buffer.from(`${MARKER}\n${toDelimited(EN_HEADER, manyRows, ',')}`, 'utf8');

  for (const [name, buffer] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT_DIR, name), buffer);
    note(`${name}  ${buffer.length} bytes`);
  }
  note(`written to ${path.relative(REPO, OUT_DIR)} (git-ignored scratch)`);

  const repoStateFile = path.join(REPO, 'data', 'app', 'state.json');
  const repoStateBefore = fs.existsSync(repoStateFile) ? crypto.createHash('sha256').update(fs.readFileSync(repoStateFile)).digest('hex') : null;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-rehearsal-'));
  for (const dir of ['app', 'data', 'docs']) fs.cpSync(path.join(REPO, dir), path.join(tmp, dir), { recursive: true });
  const stateFile = path.join(tmp, 'mvp-runtime', 'fixture-state.json');
  const stagingFile = path.join(tmp, 'mvp-runtime', 'staging-state.json');

  let child = null;
  try {
    const started = startServer(tmp, stateFile, stagingFile);
    child = started.child;
    if (!await waitForHealth()) {
      console.error('FAIL  the server did not become healthy');
      console.error(started.log.join(''));
      process.exit(1);
    }

    /* =========== case 1: preview writes nothing =========== */
    section('Case 1 — preview writes nothing');
    const first = await call('POST', '/api/mvp/import/preview', uploadBody('shopee-export-shape-en.csv', files['shopee-export-shape-en.csv']));
    check('preview returns 200', first.status === 200, `status ${first.status}`);
    check('preview did not create the staging file', !fs.existsSync(stagingFile));
    const pv = first.body.preview;
    check('preview reports preview_wrote_state: false', pv.preview_wrote_state === false);

    /* =========== case 2: header + alias mapping =========== */
    section('Case 2 — header and alias mapping (English Shopee-shaped headers)');
    const header = pv.columns.map((c) => c.header);
    check('the header row is read as-is', header.join('|') === EN_HEADER.join('|'));
    const expectedMapping = {
      item_id: 'Item ID',
      shop_id: 'Shop ID',
      shop_name: 'Shop Name',
      product_name: 'Product Name',
      category: 'Category',
      price_thb: 'Price',
      list_price_thb: 'Original Price',
      commission_rate: 'Commission Rate',
      promo_label: 'Promotion',
      promo_depth_pct: 'Discount',
      rating: 'Rating',
      rating_count: 'Review Count',
      units_sold: 'Sales',
      shop_rating: 'Shop Rating',
      related_shop_count: 'Related Shops',
      product_url: 'Product URL',
      shop_url: 'Shop URL',
      exported_at: 'Export Date',
      affiliate_link: 'Affiliate Link',
    };
    for (const [field, expectedHeader] of Object.entries(expectedMapping)) {
      check(`alias: ${field} <- "${expectedHeader}"`, pv.mapping_columns[field] === expectedHeader, `got "${pv.mapping_columns[field]}"`);
    }
    check('no required column is missing', (pv.missing_required || []).length === 0, JSON.stringify(pv.missing_required));
    check('unmapped columns are reported, not ignored silently',
      JSON.stringify((pv.unmapped || []).map((c) => c.name).sort()) === JSON.stringify(['Campaign', 'Seller Type']),
      JSON.stringify((pv.unmapped || []).map((c) => c.name)));
    check('no column is mapped to two fields', (pv.conflicts || []).length === 0);

    /* =========== case 3: encoding + delimiter =========== */
    section('Case 3 — format, encoding and delimiter');
    check('format is csv', pv.format === 'csv', pv.format);
    check('encoding is utf-8', pv.encoding === 'utf-8', pv.encoding);
    check('delimiter is ","', pv.delimiter === ',', String(pv.delimiter));

    const bom = await call('POST', '/api/mvp/import/preview', uploadBody('shopee-export-shape-en-bom.csv', files['shopee-export-shape-en-bom.csv']));
    check('a UTF-8 BOM is detected as utf-8-bom', bom.body.preview.encoding === 'utf-8-bom', bom.body.preview.encoding);
    check('a UTF-8 BOM file still maps every required column', (bom.body.preview.missing_required || []).length === 0);

    const cp874 = await call('POST', '/api/mvp/import/preview', uploadBody('shopee-export-shape-th-874.csv', files['shopee-export-shape-th-874.csv']));
    check('a windows-874 file is detected as windows-874', cp874.body.preview.encoding === 'windows-874', cp874.body.preview.encoding);
    check('the Thai header row is read correctly', cp874.body.preview.columns[0].header === TH_HEADER[0], cp874.body.preview.columns[0].header);
    for (const [field, expectedHeader] of Object.entries({
      item_id: 'รหัสสินค้า',
      shop_id: 'รหัสร้านค้า',
      product_name: 'ชื่อสินค้า',
      price_thb: 'ราคา',
      commission_rate: 'อัตราค่าคอมมิชชั่น',
      affiliate_link: 'ลิงก์ affiliate',
    })) {
      check(`thai alias: ${field} <- "${expectedHeader}"`, cp874.body.preview.mapping_columns[field] === expectedHeader, `got "${cp874.body.preview.mapping_columns[field]}"`);
    }
    check('the Thai file decodes to readable Thai text',
      String(cp874.body.preview.sample?.[0]?.product_name || '').length > 0,
      String(cp874.body.preview.sample?.[0]?.product_name || ''));

    const tsv = await call('POST', '/api/mvp/import/preview', uploadBody('shopee-export-shape-en.tsv', files['shopee-export-shape-en.tsv']));
    check('a tab-separated file is detected as tsv', tsv.body.preview.format === 'tsv', tsv.body.preview.format);
    check('a tab-separated file is detected as TAB delimited', tsv.body.preview.delimiter === 'TAB', String(tsv.body.preview.delimiter));
    check('a tab-separated file maps every required column', (tsv.body.preview.missing_required || []).length === 0);

    /* =========== case 4: row counts =========== */
    section('Case 4 — row classification');
    const counts = pv.counts;
    check('12 rows are read', pv.total_rows === 12, String(pv.total_rows));
    check('8 rows are valid', counts.valid === 8, String(counts.valid));
    check('1 row is a duplicate', counts.duplicate === 1, String(counts.duplicate));
    check('2 rows are invalid', counts.invalid === 2, String(counts.invalid));
    check('1 row is unknown (no commission)', counts.unknown === 1, String(counts.unknown));
    check('the row without commission is named', pv.rows_without_commission === 1, String(pv.rows_without_commission));
    const rowStatuses = (pv.rows || []).map((r) => r.status);
    check('the duplicate row is reported as such', rowStatuses.filter((s) => s === 'DUPLICATE').length === 1);
    const invalidRows = (pv.rows || []).filter((r) => r.status === 'INVALID');
    check('invalid rows carry a reason', invalidRows.length === 2 && invalidRows.every((r) => (r.reasons || []).length > 0));
    const optionalRow = (pv.rows || []).find((r) => r.row_number === 6);
    check('a row with missing optional metrics is still valid', optionalRow && optionalRow.status === 'VALID', optionalRow && optionalRow.status);
    check('a row with missing optional metrics lists the unknown fields',
      !!optionalRow && (optionalRow.reasons || []).join(' ').includes('unknown fields'),
      optionalRow && (optionalRow.reasons || []).join(' '));
    const unknownRow = (pv.rows || []).find((r) => r.row_number === 10);
    check('a row without commission is UNKNOWN, not silently accepted', unknownRow && unknownRow.status === 'UNKNOWN', unknownRow && unknownRow.status);
    check('a price of "n/a" is INVALID',
      (pv.rows || []).find((r) => r.row_number === 8)?.status === 'INVALID');

    /* =========== case 5: missing required column =========== */
    section('Case 5 — a required column is missing from the file');
    const missing = await call('POST', '/api/mvp/import/preview', uploadBody('shopee-export-shape-missing-shop-id.csv', files['shopee-export-shape-missing-shop-id.csv']));
    check('preview reports the missing required column', (missing.body.preview.missing_required || []).includes('shop_id'), JSON.stringify(missing.body.preview.missing_required));
    const missingCommit = await call('POST', '/api/mvp/import/commit', {
      ...uploadBody('shopee-export-shape-missing-shop-id.csv', files['shopee-export-shape-missing-shop-id.csv']),
      account: { id: 'rehearsal', label: 'Rehearsal' },
      date_range: { from: '2026-10-01', to: '2026-10-21' },
      confirmMapping: true,
    });
    check('commit refuses a file with a missing required column', missingCommit.status === 400, `status ${missingCommit.status}`);
    check('the refusal names the missing column', /shop_id/.test(String(missingCommit.body.error || '')), String(missingCommit.body.error));

    /* =========== case 6: row limit =========== */
    section('Case 6 — more rows than the slice accepts');
    const tooMany = await call('POST', '/api/mvp/import/preview', uploadBody('shopee-export-shape-520-rows.csv', files['shopee-export-shape-520-rows.csv']));
    check('a 520-row file is rejected with 413', tooMany.status === 413, `status ${tooMany.status}`);
    check('the rejection states the 500-row limit', /500/.test(String(tooMany.body.error || '')), String(tooMany.body.error));

    /* =========== case 7: commit + promote on the real path =========== */
    section('Case 7 — commit and promote on the user-supplied path');
    const commit = await call('POST', '/api/mvp/import/commit', {
      ...uploadBody('shopee-export-shape-en.csv', files['shopee-export-shape-en.csv']),
      account: { id: 'rehearsal', label: 'Rehearsal account' },
      date_range: { from: '2026-10-20', to: '2026-10-20' },
      confirmMapping: true,
    });
    check('commit returns 201', commit.status === 201, `status ${commit.status}`);
    const record = commit.body.import || {};
    check('the import is NOT marked synthetic', record.synthetic === false, String(record.synthetic));
    check('the source type is SHOPEE_AFFILIATE_EXPORT', record.source_type === 'SHOPEE_AFFILIATE_EXPORT', String(record.source_type));
    check('the staged import warns that it is unverified against Shopee',
      (record.warnings || []).some((w) => /did not verify it against Shopee/i.test(String(w))),
      JSON.stringify(record.warnings));
    check('8 valid rows were imported', commit.body.counts && commit.body.counts.imported === 8, JSON.stringify(commit.body.counts));
    check('8 offers were built', commit.body.records && commit.body.records.offers === 8, JSON.stringify(commit.body.records));

    const stagedId = record.id;
    const promote = await call('POST', `/api/mvp/staging/${stagedId}/research`, { generateCandidates: true });
    check('promote returns 201', promote.status === 201, `status ${promote.status}`);
    check('promote produced 5 candidates', (promote.body.candidates || []).length === 5, String((promote.body.candidates || []).length));

    const state = await call('GET', '/api/mvp/state');
    check('the research state is not synthetic', state.body.synthetic === false, String(state.body.synthetic));
    check('the research state is in STAGED_IMPORT mode', state.body.data_mode === 'STAGED_IMPORT', String(state.body.data_mode));
    check('the research state holds 8 offers', state.body.summary && state.body.summary.offers === 8, JSON.stringify(state.body.summary));
    const source = (state.body.sources || []).find((s) => s.kind === 'AFFILIATE_EXPORT');
    check('the export source is not marked verified against Shopee', source && source.verified_against_shopee === false);
    check('the export source provenance is USER_SUPPLIED', source && source.provenance && source.provenance.source === 'USER_SUPPLIED_SHOPEE_AFFILIATE_EXPORT', source && source.provenance && source.provenance.source);
    check('the source label says the export is user supplied', source && String(source.label || '').startsWith('User-supplied Shopee Affiliate export'), source && String(source.label || ''));
    check('the source label does not say SYNTHETIC', source && !/SYNTHETIC/i.test(String(source.label || '')), source && String(source.label || ''));

    /* =========== case 8: duplicate file =========== */
    section('Case 8 — the same file imported twice');
    const again = await call('POST', '/api/mvp/import/commit', {
      ...uploadBody('shopee-export-shape-en.csv', files['shopee-export-shape-en.csv']),
      account: { id: 'rehearsal', label: 'Rehearsal account' },
      date_range: { from: '2026-10-20', to: '2026-10-20' },
      confirmMapping: true,
    });
    check('a second import of the same file writes nothing', again.status === 200 && again.body.duplicate_import === true, `status ${again.status}`);
    check('the second import points at the existing staged record', again.body.existing_import_id === stagedId, String(again.body.existing_import_id));

    /* =========== case 9: isolation =========== */
    section('Case 9 — isolation');
    const repoStateAfter = fs.existsSync(repoStateFile) ? crypto.createHash('sha256').update(fs.readFileSync(repoStateFile)).digest('hex') : null;
    check('data/app/state.json was not touched', repoStateBefore === repoStateAfter, `${repoStateBefore} -> ${repoStateAfter}`);
    check('the rehearsal state was written inside the temporary workspace', fs.existsSync(stateFile));
    check('the rehearsal staging file was written inside the temporary workspace', fs.existsSync(stagingFile));
  } catch (err) {
    check('the rehearsal ran without an internal error', false, err && err.message ? err.message : String(err));
  } finally {
    await stop(child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log('');
  console.log(`${failures === 0 ? 'PASS' : 'FAIL'}  ${checks - failures}/${checks} rehearsal expectations met`);
  console.log('REHEARSAL ONLY — real Shopee import is still NOT verified.');
  process.exit(failures === 0 ? 0 : 1);
})();
