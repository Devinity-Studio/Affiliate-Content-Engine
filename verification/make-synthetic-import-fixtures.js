'use strict';

/**
 * Builds SYNTHETIC upload fixtures for the import parser contract.
 *
 * No real Shopee export exists in this workspace, so these files are derived
 * from the existing hand-authored synthetic fixture and are labelled as
 * synthetic in the filename, the CSV comment header and (for XLSX/JSON) the
 * `synthetic` source label computed by the importer.
 *
 * Outputs (all under app/mvp/fixtures/):
 *   synthetic-shopee-export.csv        UTF-8, with affiliate_link
 *   synthetic-shopee-export.json       array of objects
 *   synthetic-shopee-export.xlsx       stored-ZIP SpreadsheetML, shared strings
 *   synthetic-shopee-export-th.csv     windows-874 (CP874), Thai headers
 *
 * Usage: node verification/make-synthetic-import-fixtures.js
 */

const fs = require('node:fs');
const path = require('node:path');
const importer = require('../app/mvp/importer');

const REPO = path.resolve(__dirname, '..');
const BASE = path.join(REPO, 'app', 'mvp', 'fixtures', 'shopee-affiliate-export-2026-10-21.csv');
const OUT_DIR = path.join(REPO, 'app', 'mvp', 'fixtures');

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header, rows) {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

/* ---------- CP874 encoder (headers and Thai names only) ---------- */

function encodeCp874(text) {
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code >= 0x0e01 && code <= 0x0e3a) bytes.push(0xa0 + (code - 0x0e00));
    else if (code === 0x0e3f) bytes.push(0xdf);
    else if (code >= 0x0e40 && code <= 0x0e5b) bytes.push(0xdf + (code - 0x0e3f));
    else bytes.push(0x3f); // '?'
  }
  return Buffer.from(bytes);
}

/* ---------- Minimal stored-ZIP writer ---------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = (1 << 5) | 1; // 1980-01-01
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuffer, eocd]);
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function columnLetter(index) {
  let value = index + 1;
  let letters = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function buildXlsx(header, rows) {
  const shared = [];
  const sharedIndex = new Map();
  const sharedFor = (value) => {
    if (!sharedIndex.has(value)) {
      sharedIndex.set(value, shared.length);
      shared.push(value);
    }
    return sharedIndex.get(value);
  };

  const sheetRows = [];
  const writeRow = (cells, rowNumber) => {
    const parts = cells.map((cell, index) => {
      const ref = `${columnLetter(index)}${rowNumber}`;
      const numeric = typeof cell === 'number' && Number.isFinite(cell);
      if (numeric) return `<c r="${ref}"><v>${cell}</v></c>`;
      return `<c r="${ref}" t="s"><v>${sharedFor(String(cell ?? ''))}</v></c>`;
    });
    sheetRows.push(`<row r="${rowNumber}">${parts.join('')}</row>`);
  };
  writeRow(header, 1);
  rows.forEach((row, index) => writeRow(row, index + 2));

  const files = [
    {
      name: '[Content_Types].xml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        + '</Types>'),
    },
    {
      name: '_rels/.rels',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>'),
    },
    {
      name: 'xl/workbook.xml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + '<sheets><sheet name="Offers" sheetId="1" r:id="rId1"/></sheets>'
        + '</workbook>'),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
        + '</Relationships>'),
    },
    {
      name: 'xl/sharedStrings.xml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">`
        + shared.map((value) => `<si><t>${xmlEscape(value)}</t></si>`).join('')
        + '</sst>'),
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + `<sheetData>${sheetRows.join('')}</sheetData>`
        + '</worksheet>'),
    },
  ];
  return zipStore(files);
}

/* ---------- Build ---------- */

const table = importer.readTable({
  filename: 'shopee-affiliate-export-2026-10-21.csv',
  buffer: fs.readFileSync(BASE),
});
const header = [...table.header];
if (!header.includes('affiliate_link')) header.splice(header.indexOf('product_url'), 0, 'affiliate_link');
const rows = table.rows.map((row) => {
  const record = Object.fromEntries(table.header.map((key, index) => [key, row[index] ?? '']));
  record.affiliate_link = `https://s.shopee.co.th/SYNTHETIC-${record.item_id}`;
  return header.map((key) => record[key] ?? '');
});

const syntheticHeader = header;
const syntheticRows = rows;

const csv = `# SYNTHETIC FIXTURE — NOT REAL SHOPEE DATA\n# Derived from the hand-authored MVP fixture. affiliate_link values are invented.\n${toCsv(syntheticHeader, syntheticRows)}`;
fs.writeFileSync(path.join(OUT_DIR, 'synthetic-shopee-export.csv'), csv, 'utf8');

const json = JSON.stringify({
  synthetic: true,
  note: 'SYNTHETIC FIXTURE — NOT REAL SHOPEE DATA',
  data: syntheticRows.map((row) => Object.fromEntries(syntheticHeader.map((key, index) => [
    key,
    ['item_id', 'shop_id', 'shop_name', 'product_name', 'category', 'promo_type', 'promo_label', 'product_url', 'shop_url', 'exported_at', 'affiliate_link'].includes(key)
      ? row[index]
      : Number(row[index]),
  ]))),
}, null, 2);
fs.writeFileSync(path.join(OUT_DIR, 'synthetic-shopee-export.json'), json, 'utf8');

const xlsx = buildXlsx(syntheticHeader, syntheticRows.map((row) => row.map((value, index) => (
  ['item_id', 'shop_id', 'shop_name', 'product_name', 'category', 'promo_type', 'promo_label', 'product_url', 'shop_url', 'exported_at', 'affiliate_link'].includes(syntheticHeader[index])
    ? value
    : Number(value)
))));
fs.writeFileSync(path.join(OUT_DIR, 'synthetic-shopee-export.xlsx'), xlsx);

const THAI_HEADERS = {
  item_id: 'รหัสสินค้า',
  shop_id: 'รหัสร้านค้า',
  shop_name: 'ชื่อร้านค้า',
  product_name: 'ชื่อสินค้า',
  affiliate_link: 'ลิงก์ affiliate',
  price_thb: 'ราคา',
  list_price_thb: 'ราคาเดิม',
  commission_rate: 'อัตราค่าคอมมิชชั่น',
  promo_type: 'ประเภทโปรโมชั่น',
  promo_label: 'โปรโมชั่น',
  promo_depth_pct: 'ส่วนลด',
  rating: 'คะแนนสินค้า',
  rating_count: 'จำนวนรีวิว',
  units_sold: 'ยอดขาย',
  shop_rating: 'คะแนนร้านค้า',
  related_shop_count: 'จำนวนร้านค้าที่เกี่ยวข้อง',
  category: 'หมวดหมู่',
  product_url: 'url สินค้า',
  shop_url: 'url ร้านค้า',
  exported_at: 'วันที่ export',
};
const thaiHeader = syntheticHeader.map((key) => THAI_HEADERS[key] || key);
const thaiText = `# SYNTHETIC FIXTURE — NOT REAL SHOPEE DATA (CP874)\n${toCsv(thaiHeader, syntheticRows)}`;
fs.writeFileSync(path.join(OUT_DIR, 'synthetic-shopee-export-th.csv'), encodeCp874(thaiText));

for (const name of ['synthetic-shopee-export.csv', 'synthetic-shopee-export.json', 'synthetic-shopee-export.xlsx', 'synthetic-shopee-export-th.csv']) {
  const stat = fs.statSync(path.join(OUT_DIR, name));
  console.log(`${name}  ${stat.size} bytes`);
}
