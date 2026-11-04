'use strict';

/**
 * ACE Mission 1 — Shopee Affiliate export importer.
 *
 * Pure functions only: this module never touches the filesystem, network or
 * state. The service decides whether to persist anything. That is what lets
 * the preview endpoint prove "preview writes nothing".
 *
 * Supported input:
 *   - CSV / TSV / delimited text (UTF-8, UTF-16 with BOM, or windows-874/CP874)
 *   - XLSX (first worksheet, read with a minimal ZIP + SpreadsheetML reader)
 *   - JSON (array of objects, or { data | items | products | records: [...] })
 *
 * Unsupported: legacy .xls (BIFF). It is rejected with an actionable message
 * rather than guessed at.
 *
 * The column alias catalogue is provisional: no real Shopee Affiliate export
 * has been supplied yet, so aliases are hypotheses that the user must confirm
 * in the preview step before anything is imported.
 */

const zlib = require('node:zlib');

const MAX_ROWS = 500;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 400;
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

const UNKNOWN_SCORING_FIELDS = [
  'rating', 'rating_count', 'shop_rating', 'related_shop_count',
  'units_sold', 'promo_depth_pct', 'category',
];

const CANONICAL_FIELDS = [
  {
    key: 'item_id',
    label: 'Item ID',
    required: true,
    group: 'identity',
    aliases: ['item_id', 'itemid', 'item id', 'product_id', 'product id', 'สินค้าไอดี', 'รหัสสินค้า', 'ไอดีสินค้า'],
  },
  {
    key: 'shop_id',
    label: 'Shop ID',
    required: true,
    group: 'identity',
    aliases: ['shop_id', 'shopid', 'shop id', 'seller_id', 'seller id', 'รหัสร้านค้า', 'ไอดีร้านค้า'],
  },
  {
    key: 'shop_name',
    label: 'Shop name',
    required: false,
    group: 'identity',
    aliases: ['shop_name', 'shop name', 'shop', 'ชื่อร้านค้า', 'ชื่อร้าน'],
  },
  {
    key: 'product_name',
    label: 'Product name',
    required: true,
    group: 'identity',
    aliases: ['product_name', 'product name', 'item_name', 'item name', 'name', 'ชื่อสินค้า', 'ชื่อผลิตภัณฑ์'],
  },
  {
    key: 'affiliate_link',
    label: 'Affiliate link',
    required: true,
    group: 'identity',
    aliases: ['affiliate_link', 'affiliate link', 'affiliate_url', 'affiliate url', 'offer_link', 'offer link',
      'short_link', 'short link', 'ลิงก์ affiliate', 'ลิงค์ affiliate', 'ลิงก์สินค้า affiliate'],
  },
  {
    key: 'price_thb',
    label: 'Price (THB)',
    required: true,
    group: 'offer',
    aliases: ['price_thb', 'price', 'sale_price', 'sale price', 'ราคา', 'ราคาขาย', 'ราคาปัจจุบัน'],
  },
  {
    key: 'list_price_thb',
    label: 'List price (THB)',
    required: false,
    group: 'offer',
    aliases: ['list_price_thb', 'list_price', 'list price', 'original_price', 'original price', 'ราคาเดิม', 'ราคาปกติ'],
  },
  {
    key: 'commission_rate',
    label: 'Commission rate',
    required: false,
    group: 'offer',
    aliases: ['commission_rate', 'commission rate', 'commission_pct', 'commission %', 'commission_percent',
      'อัตราค่าคอมมิชชั่น', 'เปอร์เซ็นต์ค่าคอมมิชชั่น'],
  },
  {
    key: 'commission_thb',
    label: 'Commission (THB)',
    required: false,
    group: 'offer',
    aliases: ['commission_thb', 'commission', 'commission_amount', 'commission amount', 'ค่าคอมมิชชั่น', 'ค่าคอม'],
  },
  {
    key: 'promo_type',
    label: 'Promotion type',
    required: false,
    group: 'offer',
    aliases: ['promo_type', 'promo type', 'promotion_type', 'promotion type', 'ประเภทโปรโมชั่น'],
  },
  {
    key: 'promo_label',
    label: 'Promotion label',
    required: false,
    group: 'offer',
    aliases: ['promo_label', 'promo label', 'promotion', 'promo', 'promotion_name', 'โปรโมชั่น', 'ชื่อโปรโมชั่น'],
  },
  {
    key: 'promo_depth_pct',
    label: 'Promotion depth (%)',
    required: false,
    group: 'offer',
    aliases: ['promo_depth_pct', 'promo depth', 'discount', 'discount_pct', 'discount %', 'ส่วนลด', 'ส่วนลด (%)'],
  },
  {
    key: 'rating',
    label: 'Product rating',
    required: false,
    group: 'signal',
    aliases: ['rating', 'product_rating', 'product rating', 'item_rating', 'คะแนนสินค้า', 'คะแนน'],
  },
  {
    key: 'rating_count',
    label: 'Rating count',
    required: false,
    group: 'signal',
    aliases: ['rating_count', 'rating count', 'review_count', 'review count', 'reviews', 'จำนวนรีวิว', 'จำนวนคะแนน'],
  },
  {
    key: 'units_sold',
    label: 'Units sold',
    required: false,
    group: 'signal',
    aliases: ['units_sold', 'units sold', 'sold', 'sales', 'ยอดขาย', 'ขายแล้ว'],
  },
  {
    key: 'shop_rating',
    label: 'Shop rating',
    required: false,
    group: 'signal',
    aliases: ['shop_rating', 'shop rating', 'seller_rating', 'คะแนนร้านค้า'],
  },
  {
    key: 'related_shop_count',
    label: 'Related shop count',
    required: false,
    group: 'signal',
    aliases: ['related_shop_count', 'related shops', 'shop_count', 'shop count', 'จำนวนร้านค้าที่เกี่ยวข้อง'],
  },
  {
    key: 'category',
    label: 'Category',
    required: false,
    group: 'context',
    aliases: ['category', 'category_name', 'category name', 'หมวดหมู่', 'หมวดหมู่สินค้า'],
  },
  {
    key: 'product_url',
    label: 'Product URL',
    required: false,
    group: 'context',
    aliases: ['product_url', 'product url', 'item_url', 'item url', 'ลิงก์สินค้า', 'url สินค้า'],
  },
  {
    key: 'shop_url',
    label: 'Shop URL',
    required: false,
    group: 'context',
    aliases: ['shop_url', 'shop url', 'seller_url', 'ลิงก์ร้านค้า', 'url ร้านค้า'],
  },
  {
    key: 'exported_at',
    label: 'Exported at',
    required: false,
    group: 'context',
    aliases: ['exported_at', 'exported at', 'export_date', 'export date', 'export_time', 'วันที่ export', 'วันที่ส่งออก'],
  },
];

const FIELD_BY_KEY = Object.fromEntries(CANONICAL_FIELDS.map((field) => [field.key, field]));
const REQUIRED_FIELDS = CANONICAL_FIELDS.filter((field) => field.required).map((field) => field.key);

function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function normalizeToken(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^0-9a-z\u0E00-\u0E7F]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/* ------------------------------------------------------------------ */
/* ZIP + XLSX                                                          */
/* ------------------------------------------------------------------ */

function readZip(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw httpError(415, 'The .xlsx file is too small to be a valid workbook');
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw httpError(415, 'The .xlsx file is not a valid ZIP container');
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0 || entryCount > MAX_ZIP_ENTRIES) throw httpError(415, `The .xlsx file has ${entryCount} entries, which is outside the supported range`);
  if (cdOffset <= 0 || cdOffset >= buffer.length) throw httpError(415, 'The .xlsx central directory is corrupt');

  const files = new Map();
  let offset = cdOffset;
  let totalUncompressed = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw httpError(415, 'The .xlsx central directory entry is corrupt');
    }
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + nameLength).toString('utf8');
    offset += 46 + nameLength + extraLength + commentLength;

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw httpError(415, 'The .xlsx workbook expands beyond the supported size');

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) continue;
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw httpError(415, `The .xlsx entry ${name} is truncated`);
    let data;
    if (compression === 0) data = buffer.slice(dataStart, dataEnd);
    else if (compression === 8) {
      try {
        data = zlib.inflateRawSync(buffer.slice(dataStart, dataEnd), { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
      } catch {
        throw httpError(415, `The .xlsx entry ${name} could not be decompressed`);
      }
    } else {
      throw httpError(415, `The .xlsx entry ${name} uses unsupported compression ${compression}`);
    }
    files.set(name, data);
  }
  return files;
}

function decodeXml(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function columnIndex(ref) {
  const letters = String(ref || '').replace(/\d+/g, '').toUpperCase();
  let value = 0;
  for (const letter of letters) value = value * 26 + (letter.charCodeAt(0) - 64);
  return value - 1;
}

function readSharedStrings(files) {
  const entry = files.get('xl/sharedStrings.xml');
  if (!entry) return [];
  const xml = entry.toString('utf8');
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => (
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join('')
  ));
}

function workbookSheets(files) {
  const workbook = files.get('xl/workbook.xml');
  const rels = files.get('xl/_rels/workbook.xml.rels');
  const sheets = [];
  if (workbook) {
    const relMap = new Map();
    if (rels) {
      for (const rel of rels.toString('utf8').matchAll(/<Relationship\b[^>]*>/g)) {
        const id = /Id="([^"]+)"/.exec(rel[0]);
        const target = /Target="([^"]+)"/.exec(rel[0]);
        if (id && target) relMap.set(id[1], target[1]);
      }
    }
    for (const sheet of workbook.toString('utf8').matchAll(/<sheet\b[^>]*>/g)) {
      const name = /name="([^"]*)"/.exec(sheet[0]);
      const rid = /r:id="([^"]+)"/.exec(sheet[0]);
      const target = rid ? relMap.get(rid[1]) : null;
      let resolved = target || '';
      resolved = resolved.replace(/^\//, '').replace(/^xl\//, '');
      if (resolved && !resolved.startsWith('xl/')) resolved = `xl/${resolved}`;
      sheets.push({ name: name ? decodeXml(name[1]) : `Sheet${sheets.length + 1}`, path: resolved });
    }
  }
  if (!sheets.length) {
    const paths = [...files.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
    paths.forEach((path, index) => sheets.push({ name: `Sheet${index + 1}`, path }));
  }
  return sheets.filter((sheet) => files.has(sheet.path));
}

function readWorksheet(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1] || cellMatch[2] || '';
      const body = cellMatch[3] || '';
      const ref = /r="([A-Z]+\d+)"/i.exec(attrs);
      const type = /t="([^"]+)"/.exec(attrs);
      const index = ref ? columnIndex(ref[1]) : cells.length;
      let value = '';
      if (type && type[1] === 's') {
        const shared = /<v>([\s\S]*?)<\/v>/.exec(body);
        value = shared ? (sharedStrings[Number(shared[1])] ?? '') : '';
      } else if (type && type[1] === 'inlineStr') {
        value = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body);
        value = raw ? decodeXml(raw[1]) : '';
      }
      while (cells.length < index) cells.push('');
      cells[index] = String(value);
    }
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    rows.push(cells);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Encoding + tabular readers                                          */
/* ------------------------------------------------------------------ */

const ENCODING_ALIASES = {
  'utf8': 'utf-8',
  'utf-8': 'utf-8',
  'cp874': 'windows-874',
  'tis-620': 'windows-874',
  'tis620': 'windows-874',
  'windows-874': 'windows-874',
  'utf16le': 'utf-16le',
  'utf-16le': 'utf-16le',
  'utf-16be': 'utf-16be',
  'ascii': 'utf-8',
};

function decodeText(buffer, requestedEncoding) {
  if (requestedEncoding) {
    const label = ENCODING_ALIASES[String(requestedEncoding).toLowerCase()];
    if (!label) throw httpError(400, `Unsupported encoding override: ${requestedEncoding}`);
    try {
      return { text: new TextDecoder(label).decode(buffer), encoding: label, warnings: [] };
    } catch (err) {
      throw httpError(400, `Could not decode the file as ${label}: ${err.message}`);
    }
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(buffer.slice(3)), encoding: 'utf-8-bom', warnings: [] };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(buffer.slice(2)), encoding: 'utf-16le', warnings: [] };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(buffer.slice(2)), encoding: 'utf-16be', warnings: [] };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffer), encoding: 'utf-8', warnings: [] };
  } catch {
    try {
      return {
        text: new TextDecoder('windows-874').decode(buffer),
        encoding: 'windows-874',
        warnings: ['The file is not valid UTF-8; it was decoded as windows-874 (Thai). Confirm the preview text before importing.'],
      };
    } catch {
      return {
        text: new TextDecoder('utf-8').decode(buffer),
        encoding: 'utf-8-lossy',
        warnings: ['The file encoding could not be detected; invalid bytes were replaced. Confirm the preview text before importing.'],
      };
    }
  }
}

function detectDelimiter(headerLine) {
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestCount = -1;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < headerLine.length; i += 1) {
      const ch = headerLine[i];
      if (ch === '"') quoted = !quoted;
      else if (ch === delimiter && !quoted) count += 1;
    }
    if (count > bestCount) { best = delimiter; bestCount = count; }
  }
  return bestCount <= 0 ? ',' : best;
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (quoted) throw httpError(400, 'The delimited file has an unterminated quoted field');
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function trimTrailingEmptyRows(rows) {
  return rows.filter((row) => row.some((cell) => String(cell).trim() !== ''));
}

function normalizeHeaderRow(row) {
  return row.map((cell) => String(cell ?? '').replace(/^\uFEFF/, '').trim());
}

function readDelimited(buffer, encoding, warnings) {
  const decoded = decodeText(buffer, encoding);
  warnings.push(...decoded.warnings);
  let text = decoded.text;
  const lines = text.split(/\r?\n/);
  let start = 0;
  while (start < lines.length && (/^\s*$/.test(lines[start]) || /^\s*#/.test(lines[start]))) start += 1;
  const headerLine = lines[start] || '';
  const delimiter = detectDelimiter(headerLine);
  text = text.replace(/^\uFEFF/, '');
  const rows = trimTrailingEmptyRows(parseDelimited(lines.slice(start).join('\n'), delimiter));
  if (!rows.length) throw httpError(400, 'The file is empty');
  return {
    format: delimiter === '\t' ? 'tsv' : 'csv',
    encoding: decoded.encoding,
    header: normalizeHeaderRow(rows[0]),
    rows: rows.slice(1).map((row) => row.map((cell) => String(cell ?? ''))),
    textSample: rows.slice(0, 4).flat().join(' ').slice(0, 4000),
    sheets: null,
    sheet: null,
    delimiter: delimiter === '\t' ? 'TAB' : delimiter,
    warnings,
    encodingConfidence: decoded.encoding.startsWith('utf-8') ? 'HIGH' : 'MEDIUM',
  };
}

function readXlsx(buffer, sheetName, warnings) {
  const files = readZip(buffer);
  const sheets = workbookSheets(files);
  if (!sheets.length) throw httpError(415, 'The .xlsx workbook has no readable worksheet');
  const wanted = sheetName ? sheets.find((sheet) => sheet.name === sheetName) : sheets[0];
  if (!wanted) {
    throw httpError(400, `Worksheet "${sheetName}" was not found`, { sheets: sheets.map((sheet) => sheet.name) });
  }
  if (sheets.length > 1) warnings.push(`Workbook has ${sheets.length} worksheets; reading "${wanted.name}". Confirm this is the offer export.`);
  const sharedStrings = readSharedStrings(files);
  const rows = trimTrailingEmptyRows(readWorksheet(files.get(wanted.path).toString('utf8'), sharedStrings));
  if (!rows.length) throw httpError(400, `Worksheet "${wanted.name}" is empty`);
  const header = normalizeHeaderRow(rows[0]);
  return {
    format: 'xlsx',
    encoding: 'xlsx (SpreadsheetML)',
    header,
    rows: rows.slice(1).map((row) => {
      const cells = new Array(header.length).fill('');
      row.forEach((cell, index) => { if (index < header.length) cells[index] = String(cell ?? ''); });
      return cells;
    }),
    textSample: sharedStrings.join(' ').slice(0, 4000),
    sheets: sheets.map((sheet) => sheet.name),
    sheet: wanted.name,
    warnings,
    encodingConfidence: 'HIGH',
  };
}

function readJson(buffer, warnings) {
  const decoded = decodeText(buffer);
  warnings.push(...decoded.warnings);
  let parsed;
  try {
    parsed = JSON.parse(decoded.text);
  } catch (err) {
    throw httpError(400, `The JSON file is not valid JSON: ${err.message}`);
  }
  let list = null;
  if (Array.isArray(parsed)) list = parsed;
  else if (parsed && typeof parsed === 'object') {
    for (const key of ['data', 'items', 'products', 'records', 'offers']) {
      if (Array.isArray(parsed[key])) { list = parsed[key]; break; }
    }
  }
  if (!list) throw httpError(400, 'The JSON file must be an array of objects, or an object with a data/items/products/records array');
  if (!list.length) throw httpError(400, 'The JSON array is empty');
  if (list.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    throw httpError(400, 'Every JSON row must be an object');
  }
  const header = [];
  for (const entry of list) {
    for (const key of Object.keys(entry)) if (!header.includes(key)) header.push(key);
  }
  const rows = list.map((entry) => header.map((key) => {
    const value = entry[key];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }));
  return {
    format: 'json',
    encoding: decoded.encoding,
    header,
    rows,
    textSample: decoded.text.slice(0, 4000),
    sheets: null,
    sheet: null,
    warnings,
    encodingConfidence: 'HIGH',
  };
}

function detectFormat(filename, buffer) {
  const extension = String(filename || '').toLowerCase().split('.').pop();
  if (extension === 'xlsx') return 'xlsx';
  if (extension === 'xls') return 'xls';
  if (extension === 'json') return 'json';
  if (['csv', 'tsv'].includes(extension)) return extension === 'tsv' ? 'tsv' : 'csv';
  if (buffer && buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) return 'xlsx';
  if (buffer && buffer.length && buffer[0] === 0x7b) return 'json';
  if (extension === 'txt') throw httpError(415, 'The .txt file is not a supported spreadsheet format. Re-export from Shopee as .csv or .xlsx.');
  return 'csv';
}

function readTable({ filename, buffer, format, encoding, sheet }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw httpError(400, 'The uploaded file is empty');
  if (buffer.length > MAX_FILE_BYTES) {
    throw httpError(413, `The file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_FILE_BYTES / 1024 / 1024} MB`);
  }
  const resolved = (format || detectFormat(filename, buffer)).toLowerCase();
  const warnings = [];
  if (resolved === 'xls') {
    throw httpError(415, 'Legacy .xls (BIFF) is not supported. Re-export from Shopee as .xlsx or .csv.');
  }
  if (resolved === 'xlsx') return readXlsx(buffer, sheet, warnings);
  if (resolved === 'json') return readJson(buffer, warnings);
  return readDelimited(buffer, encoding, warnings);
}

/* ------------------------------------------------------------------ */
/* Header mapping                                                      */
/* ------------------------------------------------------------------ */

function missingRequiredFor(mapping) {
  const missing = REQUIRED_FIELDS.filter((key) => mapping[key] === null || mapping[key] === undefined);
  if (mapping.commission_rate === null || mapping.commission_rate === undefined) {
    if (mapping.commission_thb === null || mapping.commission_thb === undefined) missing.push('commission_rate_or_commission_thb');
  }
  return [...new Set(missing)];
}

function detectMapping(header) {
  const used = new Set();
  const mapping = {};
  const notes = [];
  for (const field of CANONICAL_FIELDS) {
    const aliases = new Set(field.aliases.map(normalizeToken));
    aliases.add(normalizeToken(field.key));
    let index = header.findIndex((name, i) => !used.has(i) && aliases.has(normalizeToken(name)));
    if (index === -1) {
      index = header.findIndex((name, i) => !used.has(i) && normalizeToken(name) === normalizeToken(field.label));
    }
    if (index === -1) {
      mapping[field.key] = null;
    } else {
      used.add(index);
      mapping[field.key] = index;
      if (normalizeToken(header[index]) !== normalizeToken(field.key)) {
        notes.push(`${field.label} ← "${header[index]}"`);
      }
    }
  }

  const missingRequired = missingRequiredFor(mapping);

  const unmapped = header
    .map((name, index) => ({ index, name }))
    .filter(({ index }) => !used.has(index));

  const assigned = Object.entries(mapping).filter(([, index]) => index !== null);
  const conflicts = [];
  for (const [key, index] of assigned) {
    const clash = assigned.filter(([otherKey, otherIndex]) => otherKey !== key && otherIndex === index);
    if (clash.length) conflicts.push({ index, header: header[index], fields: [key, ...clash.map(([k]) => k)] });
  }

  return {
    mapping,
    missing_required: [...new Set(missingRequired)],
    unmapped,
    notes,
    conflicts,
    mapping_hash: hashMapping(mapping),
  };
}

function hashMapping(mapping) {
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(JSON.stringify(mapping)).digest('hex');
}

function describeColumns(header, mapping) {
  const reverse = new Map();
  for (const [key, index] of Object.entries(mapping)) {
    if (index === null || index === undefined) continue;
    if (!reverse.has(index)) reverse.set(index, []);
    reverse.get(index).push(key);
  }
  return header.map((name, index) => ({
    index,
    header: name,
    fields: reverse.get(index) || [],
    required: (reverse.get(index) || []).some((key) => FIELD_BY_KEY[key]?.required),
    unmapped: !reverse.has(index),
  }));
}

/* ------------------------------------------------------------------ */
/* Value normalisation                                                 */
/* ------------------------------------------------------------------ */

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  let text = String(value).trim();
  if (!text || text === '-' || text === '—') return null;
  text = text
    .replace(/฿/g, '')
    .replace(/THB/gi, '')
    .replace(/,/g, '')
    .replace(/%/g, '')
    .replace(/\s/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseDateValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^\d{5,6}(\.\d+)?$/.test(text)) {
    // Excel serial date (1900 date system).
    const serial = Number(text);
    const ms = (serial - 25569) * 86400 * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const iso = Date.parse(text);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString();
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (dmy) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = dmy;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function isUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value || '').trim());
}

function normalizeRow(raw, mapping, rowNumber) {
  const cell = (key) => {
    const index = mapping[key];
    if (index === null || index === undefined) return '';
    return String(raw[index] ?? '').trim();
  };
  const errors = [];
  const unknownFields = [];

  const itemId = cell('item_id');
  const shopId = cell('shop_id');
  const productName = cell('product_name');
  const affiliateLink = cell('affiliate_link');
  if (!itemId) errors.push({ field: 'item_id', message: 'is required' });
  if (!shopId) errors.push({ field: 'shop_id', message: 'is required' });
  if (!productName) errors.push({ field: 'product_name', message: 'is required' });
  if (!affiliateLink) unknownFields.push('affiliate_link');
  else if (!isUrl(affiliateLink)) errors.push({ field: 'affiliate_link', message: 'must start with http:// or https://' });

  const price = parseNumber(cell('price_thb'));
  if (price === null) errors.push({ field: 'price_thb', message: 'must be numeric' });
  else if (price <= 0) errors.push({ field: 'price_thb', message: 'must be > 0' });

  let listPrice = parseNumber(cell('list_price_thb'));
  if (listPrice === null) {
    listPrice = price;
    unknownFields.push('list_price_thb');
  }
  if (price !== null && listPrice !== null && listPrice < price) {
    errors.push({ field: 'list_price_thb', message: 'must be >= price_thb' });
  }

  let commissionRate = parseNumber(cell('commission_rate'));
  const commissionAmount = parseNumber(cell('commission_thb'));
  if (commissionRate === null && commissionAmount !== null && price) commissionRate = commissionAmount / price;
  if (commissionRate !== null) {
    if (commissionRate > 1 && commissionRate <= 100) commissionRate /= 100;
    if (commissionRate < 0 || commissionRate > 1) {
      errors.push({ field: 'commission_rate', message: 'must be a fraction (0–1) or a percentage (0–100)' });
    }
  }

  let promoDepth = parseNumber(cell('promo_depth_pct'));
  if (promoDepth === null) {
    promoDepth = 0;
    if (!cell('promo_label') && !cell('promo_type')) unknownFields.push('promo_depth_pct');
  } else if (promoDepth > 0 && promoDepth <= 1) {
    promoDepth *= 100;
  }
  if (promoDepth !== null && (promoDepth < 0 || promoDepth > 100)) {
    errors.push({ field: 'promo_depth_pct', message: 'must be between 0 and 100' });
  }

  const rating = parseNumber(cell('rating'));
  if (rating === null) unknownFields.push('rating');
  else if (rating < 0 || rating > 5) errors.push({ field: 'rating', message: 'must be between 0 and 5' });

  const ratingCount = parseNumber(cell('rating_count'));
  if (ratingCount === null) unknownFields.push('rating_count');
  else if (ratingCount < 0) errors.push({ field: 'rating_count', message: 'must be >= 0' });

  const unitsSold = parseNumber(cell('units_sold'));
  if (unitsSold === null) unknownFields.push('units_sold');
  else if (unitsSold < 0) errors.push({ field: 'units_sold', message: 'must be >= 0' });

  const shopRating = parseNumber(cell('shop_rating'));
  if (shopRating === null) unknownFields.push('shop_rating');
  else if (shopRating < 0 || shopRating > 5) errors.push({ field: 'shop_rating', message: 'must be between 0 and 5' });

  const relatedShopCount = parseNumber(cell('related_shop_count'));
  if (relatedShopCount === null) unknownFields.push('related_shop_count');
  else if (relatedShopCount < 0) errors.push({ field: 'related_shop_count', message: 'must be >= 0' });

  const category = cell('category') || 'Uncategorised';
  if (!cell('category')) unknownFields.push('category');
  const exportedAt = parseDateValue(cell('exported_at'));
  if (!cell('exported_at')) unknownFields.push('exported_at');
  else if (!exportedAt) errors.push({ field: 'exported_at', message: 'must be a date (ISO, DD/MM/YYYY, or Excel date)' });

  const identity = itemId && shopId ? `${itemId}|${shopId}` : null;
  const missingRequired = [];
  if (!itemId) missingRequired.push('item_id');
  if (!shopId) missingRequired.push('shop_id');
  if (!productName) missingRequired.push('product_name');
  if (!affiliateLink) missingRequired.push('affiliate_link');
  if (price === null || price <= 0) missingRequired.push('price_thb');
  if (commissionRate === null && commissionAmount === null) missingRequired.push('commission_rate_or_commission_thb');

  return {
    row_number: rowNumber,
    item_id: itemId,
    shop_id: shopId,
    identity,
    missing_required: missingRequired,
    unknown_fields: [...new Set(unknownFields)],
    errors,
    values: {
      item_id: itemId,
      shop_id: shopId,
      shop_name: cell('shop_name') || (shopId ? `Shop ${shopId}` : ''),
      product_name: productName,
      affiliate_link: affiliateLink,
      category,
      price_thb: price,
      list_price_thb: listPrice,
      commission_rate: commissionRate,
      rating: rating === null ? 0 : rating,
      rating_count: ratingCount === null ? 0 : ratingCount,
      units_sold: unitsSold === null ? 0 : unitsSold,
      shop_rating: shopRating === null ? 0 : shopRating,
      related_shop_count: relatedShopCount === null ? 0 : relatedShopCount,
      promo_type: cell('promo_type') || (cell('promo_label') ? 'PROMOTION' : 'NONE'),
      promo_label: cell('promo_label') || 'No promotion listed',
      promo_depth_pct: promoDepth === null ? 0 : promoDepth,
      product_url: cell('product_url') || affiliateLink,
      shop_url: cell('shop_url') || '',
      exported_at: exportedAt,
      unknown_fields: [...new Set(unknownFields)],
    },
  };
}

function normalizeRows(table, mapping) {
  const rows = table.rows.map((raw, index) => normalizeRow(raw, mapping, index + 2));
  const rowsWithoutCommission = rows.filter((row) => row.missing_required.includes('commission_rate_or_commission_thb'));
  return { rows, rowsWithoutCommission: rowsWithoutCommission.map((row) => row.row_number) };
}

function classifyRows(rows, existingIdentities) {
  const seen = new Set();
  const existing = existingIdentities instanceof Map ? existingIdentities : new Map();
  const classified = rows.map((row) => {
    let status;
    const reasons = [];
    if (row.errors.length) {
      status = 'INVALID';
      reasons.push(...row.errors.map((error) => `${error.field}: ${error.message}`));
    } else if (row.missing_required.length) {
      status = 'UNKNOWN';
      reasons.push(`missing required: ${row.missing_required.join(', ')}`);
    } else if (existing.has(row.identity)) {
      status = 'DUPLICATE';
      reasons.push(`already staged in ${existing.get(row.identity)}`);
    } else if (seen.has(row.identity)) {
      status = 'DUPLICATE';
      reasons.push('repeated in this file');
    } else {
      status = 'VALID';
    }
    if (status !== 'INVALID' && row.unknown_fields.length) {
      reasons.push(`unknown fields: ${row.unknown_fields.join(', ')}`);
    }
    if (status === 'VALID') seen.add(row.identity);
    return { ...row, status, reasons: [...new Set(reasons)] };
  });
  const counts = { total: classified.length, valid: 0, duplicate: 0, invalid: 0, unknown: 0 };
  for (const row of classified) counts[row.status.toLowerCase()] += 1;
  return { rows: classified, counts };
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

function sniffSynthetic(filename, textSample) {
  return /synthetic|fixture/i.test(String(filename || ''))
    || /SYNTHETIC FIXTURE|synthetic fixture|NOT REAL SHOPEE DATA/i.test(String(textSample || ''));
}

function buildPreview({ filename, buffer, format, encoding, sheet, mapping: mappingOverride, existingIdentities, maxRows = MAX_ROWS }) {
  const table = readTable({ filename, buffer, format, encoding, sheet });
  if (!table.header.length) throw httpError(400, 'The file has no header row');
  if (table.header.length > 80) throw httpError(400, `The file has ${table.header.length} columns; the limit is 80`);
  if (table.rows.length > maxRows) {
    throw httpError(413, `The file has ${table.rows.length} data rows; this slice imports at most ${maxRows}`);
  }
  const detection = detectMapping(table.header);
  const mapping = mappingOverride || detection.mapping;
  const missingRequired = missingRequiredFor(mapping);
  const normalized = normalizeRows(table, mapping);
  const classified = classifyRows(normalized.rows, existingIdentities);
  const firstValues = classified.rows.find((row) => row.status === 'VALID')?.values;
  const dateCandidates = classified.rows
    .map((row) => row.values.exported_at)
    .filter(Boolean)
    .sort();
  const sample = classified.rows.slice(0, 5).map((row) => ({
    row_number: row.row_number,
    status: row.status,
    identity: row.identity,
    item_id: row.values.item_id,
    product_name: row.values.product_name,
    price_thb: row.values.price_thb,
    commission_rate: row.values.commission_rate,
    affiliate_link: row.values.affiliate_link,
    reasons: row.reasons,
  }));
  const synthetic = sniffSynthetic(filename, table.textSample);
  const warnings = [...table.warnings];
  if (missingRequired.length) {
    warnings.push(`Required columns not mapped: ${missingRequired.join(', ')}. Confirm the mapping before importing.`);
  }
  if (detection.conflicts.length) {
    warnings.push(`One column is mapped to several fields: ${detection.conflicts.map((c) => c.header).join(', ')}.`);
  }
  if (detection.unmapped.length) {
    warnings.push(`${detection.unmapped.length} column(s) are unmapped and will be ignored.`);
  }
  if (synthetic) warnings.push('This file identifies itself as a SYNTHETIC fixture. It is not Shopee evidence.');
  if (!synthetic) {
    warnings.push('This is a user-supplied export. The app does not open Shopee or verify the file against the affiliate account.');
  }

  return {
    file: { name: filename, size_bytes: buffer.length },
    format: table.format,
    encoding: table.encoding,
    sheet: table.sheet,
    sheets: table.sheets,
    delimiter: table.delimiter || null,
    hash: require('node:crypto').createHash('sha256').update(buffer).digest('hex'),
    synthetic,
    source_type: synthetic ? 'SHOPEE_AFFILIATE_EXPORT_SYNTHETIC' : 'SHOPEE_AFFILIATE_EXPORT',
    columns: describeColumns(table.header, mapping),
    mapping,
    mapping_columns: Object.fromEntries(Object.entries(mapping)
      .filter(([, index]) => index !== null && index !== undefined)
      .map(([key, index]) => [key, table.header[index]])),
    mapping_hash: hashMapping(mapping),
    mapping_notes: detection.notes,
    missing_required: missingRequired,
    unmapped: detection.unmapped,
    conflicts: detection.conflicts,
    counts: classified.counts,
    rows: classified.rows.map((row) => ({
      row_number: row.row_number,
      status: row.status,
      identity: row.identity,
      reasons: row.reasons,
      unknown_fields: row.unknown_fields,
    })),
    sample,
    sample_preview: firstValues ? {
      item_id: firstValues.item_id,
      product_name: firstValues.product_name,
      price_thb: firstValues.price_thb,
      list_price_thb: firstValues.list_price_thb,
      commission_rate: firstValues.commission_rate,
      promo_label: firstValues.promo_label,
      affiliate_link: firstValues.affiliate_link,
    } : null,
    date_range_default: dateCandidates.length
      ? { from: dateCandidates[0].slice(0, 10), to: dateCandidates[dateCandidates.length - 1].slice(0, 10) }
      : null,
    warnings,
    rows_without_commission: normalized.rowsWithoutCommission.length,
    total_rows: table.rows.length,
    required_confirmation: ['mapping', 'account', 'date_range'],
    preview_wrote_state: false,
    boundaries: {
      writes: 'none — preview is computed in memory',
      real_state_touched: false,
      external_calls: 0,
      spend_thb: 0,
    },
  };
}

module.exports = {
  CANONICAL_FIELDS,
  REQUIRED_FIELDS,
  UNKNOWN_SCORING_FIELDS,
  MAX_ROWS,
  MAX_FILE_BYTES,
  detectFormat,
  readTable,
  detectMapping,
  missingRequiredFor,
  describeColumns,
  normalizeRows,
  classifyRows,
  parseNumber,
  parseDateValue,
  buildPreview,
  sniffSynthetic,
  hashMapping,
  httpError,
};
