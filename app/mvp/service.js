'use strict';

/**
 * ACE Mission 1 — MVP affiliate workflow slice.
 *
 * Pipeline implemented here:
 *   Shopee Affiliate export (synthetic fixture or pasted CSV)
 *     -> Source / Product / Offer / Evidence records (checked_at + provenance)
 *     -> deterministic analysis (price, promotion, commission, reviews, shops)
 *     -> exactly 5 ranked Candidates with claim classes
 *     -> Save / Reject / Add to queue / Remove / reorder (persisted)
 *     -> plan draft with 4 approaches + impact preview
 *     -> fixture plan record
 *
 * Boundaries:
 *   - Fixture state only. This module never reads or writes data/app/state.json,
 *     never calls the Plan Version or CWI endpoints, and never contacts Shopee.
 *   - It does not create an Experiment, Script, Content Work Item or Publication,
 *     and it does not record a G1–G5 decision.
 *   - The fixture input is synthetic and labelled as such everywhere it surfaces.
 */

const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const importer = require('./importer');
const contentModule = require('./content');

const APP_DIR = path.join(__dirname, '..');
const REPO_DIR = path.join(APP_DIR, '..');
const FIXTURE_FILE = path.join(__dirname, 'fixtures', 'shopee-affiliate-export-2026-10-21.csv');
const FIXTURE_LABEL = 'SYNTHETIC Shopee Affiliate export fixture (hand-authored, no Shopee account contacted)';
const STATE_FILE = process.env.ACE_MVP_STATE_FILE
  ? path.resolve(process.cwd(), process.env.ACE_MVP_STATE_FILE)
  : path.join(REPO_DIR, 'data', 'mvp', 'fixture-state.json');
// Staging lives next to the MVP state file so an ACE_MVP_STATE_FILE override
// keeps every test artefact inside its temporary workspace.
const STAGING_FILE = process.env.ACE_MVP_STAGING_FILE
  ? path.resolve(process.cwd(), process.env.ACE_MVP_STAGING_FILE)
  : path.join(path.dirname(STATE_FILE), 'staging-state.json');
// Content artefacts (uploaded images, rendered videos) live next to the MVP
// state file so a state override keeps every artefact inside its workspace.
const ASSETS_DIR = process.env.ACE_MVP_ASSETS_DIR
  ? path.resolve(process.cwd(), process.env.ACE_MVP_ASSETS_DIR)
  : path.join(path.dirname(STATE_FILE), 'assets');
const EXPORTS_DIR = process.env.ACE_MVP_EXPORTS_DIR
  ? path.resolve(process.cwd(), process.env.ACE_MVP_EXPORTS_DIR)
  : path.join(path.dirname(STATE_FILE), 'exports');
const FRESHNESS_DAYS = 30;
const AGING_DAYS = 14;
const STAGING_LIMIT = 20;

const CLAIM_CLASSES = new Set(['FACT', 'INFERENCE', 'HYPOTHESIS', 'UNKNOWN']);
const ACTIONS = new Set(['SAVE', 'REJECT', 'QUEUE', 'REMOVE']);
const APPROACH_KEYS = ['personalized_a', 'personalized_b', 'exploration', 'user_custom'];
const GENERATED_APPROACH_KEYS = ['personalized_a', 'personalized_b', 'exploration'];
const REQUIRED_COLUMNS = [
  'item_id', 'shop_id', 'shop_name', 'product_name', 'category',
  'price_thb', 'list_price_thb', 'commission_rate', 'rating', 'rating_count',
  'units_sold', 'shop_rating', 'related_shop_count',
  'promo_type', 'promo_label', 'promo_depth_pct',
  'product_url', 'shop_url', 'exported_at',
];
const NUMERIC_COLUMNS = new Set([
  'price_thb', 'list_price_thb', 'commission_rate', 'rating', 'rating_count',
  'units_sold', 'shop_rating', 'related_shop_count', 'promo_depth_pct',
]);
const TEXT_LIMIT = 500;

const CATEGORY_AUDIENCE = {
  Beauty: 'skincare buyers comparing serum and sunscreen value',
  Home: 'home organisers buying practical storage or cookware',
  Electronics: 'budget audio buyers comparing specifications and price',
  Cat: 'cat owners buying staple food in repeat orders',
  Sports: 'home-workout beginners buying their first mat',
  Baby: 'parents buying repeat-purchase baby essentials',
};

const CATEGORY_NOUN = {
  Beauty: 'skincare',
  Home: 'home essentials',
  Electronics: 'audio gear',
  Cat: 'cat food',
  Sports: 'workout gear',
  Baby: 'baby essentials',
};

// Reads naturally for a price exactly at the median, instead of "0% vs".
function pricePositionText(offer) {
  const pct = offer.metrics.price_position_pct;
  const median = offer.metrics.category_median_price_thb.toFixed(2);
  if (Math.abs(pct) < 0.05) return `at the fixture category median (THB ${median})`;
  return `${pct > 0 ? '+' : ''}${pct}% vs the fixture category median (THB ${median})`;
}

function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function nowIso() {
  return new Date().toISOString();
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function normalize(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  if (max === min) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/* ------------------------------------------------------------------ */
/* Fixture state store                                                 */
/* ------------------------------------------------------------------ */

let stateQueue = Promise.resolve();

function withLock(fn) {
  const run = stateQueue.then(fn, fn);
  stateQueue = run.then(() => undefined, () => undefined);
  return run;
}

function baseState() {
  return {
    schemaVersion: 1,
    kind: 'MVP_FIXTURE_STATE',
    synthetic: true,
    data_mode: 'FIXTURE',
    cycle: 1,
    import: null,
    sources: {},
    products: {},
    offers: {},
    evidence: {},
    analysis: null,
    candidates: {},
    candidateOrder: [],
    snapshots: {},
    actions: [],
    queue: [],
    planDrafts: {},
    plans: {},
    planOrder: [],
    contents: {},
    contentOrder: [],
    sourceArchiveLog: [],
  };
}

function stateFilePath() {
  return STATE_FILE;
}

function stagingFilePath() {
  return STAGING_FILE;
}

async function ensureStateDir() {
  await fsp.mkdir(path.dirname(STATE_FILE), { recursive: true });
}

async function readState() {
  await ensureStateDir();
  try {
    const raw = await fsp.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.kind !== 'MVP_FIXTURE_STATE') {
      throw httpError(500, 'MVP fixture state file is not a valid fixture state');
    }
    return { ...baseState(), ...parsed };
  } catch (err) {
    if (err.code === 'ENOENT') {
      const empty = baseState();
      await writeState(empty);
      return empty;
    }
    throw err;
  }
}

async function writeState(state) {
  await ensureStateDir();
  const tmp = `${STATE_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fsp.rename(tmp, STATE_FILE);
}

/* ------------------------------------------------------------------ */
/* Staging store (uploaded exports)                                    */
/* ------------------------------------------------------------------ */

function baseStaging() {
  return { schemaVersion: 1, kind: 'MVP_STAGING_STATE', imports: {}, order: [] };
}

async function readStaging() {
  // Reading must never create the file: a preview that only inspects the
  // staging store has to leave the disk untouched.
  try {
    const raw = await fsp.readFile(STAGING_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.kind !== 'MVP_STAGING_STATE') {
      throw httpError(500, 'MVP staging state file is not a valid staging state');
    }
    return { ...baseStaging(), ...parsed };
  } catch (err) {
    if (err.code === 'ENOENT') return baseStaging();
    throw err;
  }
}

async function writeStaging(staging) {
  await fsp.mkdir(path.dirname(STAGING_FILE), { recursive: true });
  const tmp = `${STAGING_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(staging, null, 2)}\n`, 'utf8');
  await fsp.rename(tmp, STAGING_FILE);
}

function stagingSummary(imp) {
  if (!imp) return null;
  return {
    id: imp.id,
    file: imp.file,
    format: imp.format,
    encoding: imp.encoding,
    file_hash: imp.file_hash,
    synthetic: imp.synthetic,
    source_type: imp.source_type,
    account: imp.account,
    date_range: imp.date_range,
    checked_at: imp.checked_at,
    imported_at: imp.imported_at,
    counts: imp.counts,
    source_validation: imp.source_validation,
    promoted: imp.promoted,
    promoted_at: imp.promoted_at || null,
    warnings: imp.warnings,
  };
}

async function stagingIdentities() {
  const staging = await readStaging();
  const identities = new Map();
  for (const id of staging.order) {
    const imp = staging.imports[id];
    if (!imp) continue;
    for (const row of imp.rows || []) {
      if (row.identity && row.status === 'VALID') identities.set(row.identity, id);
    }
  }
  return identities;
}

/* ------------------------------------------------------------------ */
/* Source freshness, validation and archive                            */
/* ------------------------------------------------------------------ */

function sourceFreshness(source, nowMs = Date.now()) {
  const asOf = source.data_as_of || source.checked_at;
  const parsed = Date.parse(asOf);
  if (Number.isNaN(parsed)) {
    return { status: 'UNKNOWN', age_days: null, data_as_of: asOf || null, expires_at: null, warning: 'Source freshness cannot be determined: no valid data_as_of or checked_at.' };
  }
  if (parsed > nowMs) {
    return { status: 'UNKNOWN', age_days: 0, data_as_of: asOf, expires_at: null, warning: 'Source data_as_of is in the future; the date range is not credible.' };
  }
  const ageDays = Math.floor((nowMs - parsed) / 86400000);
  const expiresAt = new Date(parsed + FRESHNESS_DAYS * 86400000).toISOString();
  const expired = nowMs > Date.parse(expiresAt);
  const status = expired ? 'EXPIRED' : ageDays >= AGING_DAYS ? 'AGING' : 'FRESH';
  const warning = expired
    ? `Source ${source.id} is ${ageDays} days old (expired ${expiresAt.slice(0, 10)}). Generate candidates only after acknowledging the stale data.`
    : status === 'AGING'
      ? `Source ${source.id} is ${ageDays} days old and expires ${expiresAt.slice(0, 10)}.`
      : null;
  return { status, age_days: ageDays, data_as_of: asOf, expires_at: expiresAt, warning };
}

function validateSourceRecord(state, sourceId) {
  const source = state.sources[sourceId];
  const checkedAt = nowIso();
  if (!source) {
    return { source_id: sourceId, status: 'FAILED', validated_at: checkedAt, checks: [{ name: 'exists', ok: false, detail: 'source not found' }] };
  }
  const evidenceUsed = Object.values(state.evidence).filter((record) => (record.source_ids || []).includes(sourceId));
  const checks = [
    { name: 'exists', ok: true },
    { name: 'checked_at', ok: !Number.isNaN(Date.parse(source.checked_at)) },
    { name: 'provenance', ok: Boolean(source.provenance) },
    { name: 'synthetic_flag', ok: typeof source.synthetic === 'boolean' },
    { name: 'evidence_resolves', ok: evidenceUsed.every((record) => record.subject && state.offers[record.subject.id]) },
  ];
  if (source.kind === 'AFFILIATE_EXPORT') {
    checks.push({ name: 'file_hash', ok: /^[a-f0-9]{64}$/i.test(String(source.file_hash || source.provenance?.sha256 || '')) });
    checks.push({ name: 'offers_linked', ok: Object.values(state.offers).some((offer) => (offer.source_ids || []).includes(sourceId)) });
  }
  return {
    source_id: sourceId,
    status: checks.every((check) => check.ok) ? 'PASSED' : 'FAILED',
    validated_at: checkedAt,
    checks,
  };
}

function sourceRecordCounts(state, sourceId) {
  const count = (collection) => Object.values(collection)
    .filter((record) => (record.source_ids || []).includes(sourceId)).length;
  return {
    products: count(state.products),
    offers: count(state.offers),
    evidence: count(state.evidence),
  };
}

function sourceCandidateLinks(state, sourceId) {
  return state.candidateOrder
    .map((id) => state.candidates[id])
    .filter((candidate) => candidate && (candidate.source_ids || []).includes(sourceId))
    .map((candidate) => ({
      id: candidate.id,
      rank: candidate.rank,
      title: candidate.title,
      status: candidate.status,
      ranking_score: candidate.scores.ranking_score,
    }));
}

function sourceLibrary(state) {
  const now = Date.now();
  return Object.values(state.sources).map((source) => {
    const validation = source.kind === 'AFFILIATE_EXPORT' ? validateSourceRecord(state, source.id) : (source.validation || null);
    return {
      ...source,
      file_hash: source.file_hash || source.provenance?.sha256 || null,
      record_counts: sourceRecordCounts(state, source.id),
      linked_candidates: sourceCandidateLinks(state, source.id),
      freshness: sourceFreshness(source, now),
      validation,
      archived: source.status === 'ARCHIVED',
    };
  });
}

function freshnessWarnings(state) {
  return sourceLibrary(state)
    .filter((source) => source.kind === 'AFFILIATE_EXPORT' && source.freshness.warning)
    .map((source) => ({
      source_id: source.id,
      status: source.freshness.status,
      age_days: source.freshness.age_days,
      expires_at: source.freshness.expires_at,
      warning: source.freshness.warning,
    }));
}

function assertSourcesGeneratable(state, options = {}) {
  if (!state.import) throw httpError(409, 'import the export before generating candidates');
  const usedIds = [...new Set(Object.values(state.offers).flatMap((offer) => offer.source_ids || []))];
  const archived = usedIds.filter((id) => state.sources[id] && state.sources[id].status === 'ARCHIVED');
  if (archived.length) {
    throw httpError(409, 'Cannot generate candidates: an archived source is still linked to imported offers.', {
      blocked_sources: archived.map((id) => ({ id, reason: 'ARCHIVED' })),
    });
  }
  const failed = usedIds
    .map((id) => validateSourceRecord(state, id))
    .filter((result) => result.status !== 'PASSED');
  if (failed.length) {
    throw httpError(409, 'Cannot generate candidates: source validation failed.', {
      blocked_sources: failed.map((result) => ({
        id: result.source_id,
        reason: 'VALIDATION_FAILED',
        checks: result.checks.filter((check) => !check.ok),
      })),
    });
  }
  const expired = usedIds
    .filter((id) => state.sources[id].kind === 'AFFILIATE_EXPORT')
    .map((id) => ({ id, freshness: sourceFreshness(state.sources[id]) }))
    .filter((entry) => entry.freshness.status === 'EXPIRED');
  if (expired.length && options.acknowledgeExpired !== true) {
    throw httpError(409, 'Cannot generate candidates: the export data has expired. Acknowledge the stale data to continue.', {
      expired_sources: expired,
      acknowledge_with: 'POST /api/mvp/candidates/generate { acknowledgeExpired: true }',
    });
  }
  return { warnings: expired.map((entry) => entry.freshness.warning) };
}

/* ------------------------------------------------------------------ */
/* CSV import                                                          */
/* ------------------------------------------------------------------ */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (inQuotes) throw httpError(400, 'CSV has an unterminated quoted field');
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function stripComments(text) {
  return String(text)
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

function parseExportCsv(csvText) {
  const rows = parseCsv(stripComments(csvText)).filter((row) => row.some((cell) => String(cell).trim() !== ''));
  if (rows.length === 0) throw httpError(400, 'CSV is empty');
  const header = rows[0].map((cell) => String(cell).trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((col) => !header.includes(col));
  if (missing.length) {
    throw httpError(400, `CSV is missing required columns: ${missing.join(', ')}`, { missing_columns: missing });
  }

  const errors = [];
  const records = [];
  const seen = new Set();
  for (let r = 1; r < rows.length; r += 1) {
    const raw = rows[r];
    const at = `row ${r + 1}`;
    if (raw.length !== header.length) {
      errors.push({ row: r + 1, field: null, message: `expected ${header.length} columns, found ${raw.length}` });
      continue;
    }
    const record = {};
    header.forEach((col, index) => { record[col] = String(raw[index] ?? '').trim(); });
    for (const col of ['item_id', 'shop_id', 'shop_name', 'product_name', 'category', 'promo_type', 'promo_label', 'product_url', 'shop_url', 'exported_at']) {
      if (!record[col]) errors.push({ row: r + 1, field: col, message: 'must be a non-empty string' });
    }
    for (const col of NUMERIC_COLUMNS) {
      const value = Number(record[col]);
      if (!Number.isFinite(value)) {
        errors.push({ row: r + 1, field: col, message: 'must be numeric' });
      } else {
        record[col] = value;
      }
    }
    if (Number.isFinite(record.price_thb) && record.price_thb <= 0) errors.push({ row: r + 1, field: 'price_thb', message: 'must be > 0' });
    if (Number.isFinite(record.list_price_thb) && record.list_price_thb < record.price_thb) {
      errors.push({ row: r + 1, field: 'list_price_thb', message: 'must be >= price_thb' });
    }
    if (Number.isFinite(record.commission_rate) && (record.commission_rate < 0 || record.commission_rate > 1)) {
      errors.push({ row: r + 1, field: 'commission_rate', message: 'must be a fraction between 0 and 1' });
    }
    for (const col of ['rating', 'shop_rating']) {
      if (Number.isFinite(record[col]) && (record[col] < 0 || record[col] > 5)) {
        errors.push({ row: r + 1, field: col, message: 'must be between 0 and 5' });
      }
    }
    if (Number.isFinite(record.promo_depth_pct) && (record.promo_depth_pct < 0 || record.promo_depth_pct > 100)) {
      errors.push({ row: r + 1, field: 'promo_depth_pct', message: 'must be between 0 and 100' });
    }
    for (const col of ['rating_count', 'units_sold', 'related_shop_count']) {
      if (Number.isFinite(record[col]) && record[col] < 0) errors.push({ row: r + 1, field: col, message: 'must be >= 0' });
    }
    if (record.exported_at && Number.isNaN(Date.parse(record.exported_at))) {
      errors.push({ row: r + 1, field: 'exported_at', message: 'must be an ISO date-time' });
    }
    if (seen.has(record.item_id)) errors.push({ row: r + 1, field: 'item_id', message: `duplicate item_id ${record.item_id}` });
    seen.add(record.item_id);
    if (errors.some((e) => e.row === r + 1)) continue;
    record.row_number = r + 1;
    records.push(record);
    if (records.length > 50) {
      errors.push({ row: r + 1, field: null, message: 'fixture import is limited to 50 rows' });
      break;
    }
  }
  if (errors.length) {
    throw httpError(400, `CSV validation failed (${errors.length} problem${errors.length === 1 ? '' : 's'})`, errors.slice(0, 20));
  }
  if (!records.length) throw httpError(400, 'CSV has a header but no data rows');
  return records;
}

/* ------------------------------------------------------------------ */
/* Records: Source / Product / Offer / Evidence                        */
/* ------------------------------------------------------------------ */

function buildDataset(rows, meta) {
  const synthetic = meta.synthetic !== false;
  const checkedAt = meta.checkedAt;
  const exportDates = rows.map((row) => row.exported_at).filter(Boolean).sort();
  const dataAsOf = meta.dateRange?.to
    || (exportDates.length ? exportDates[exportDates.length - 1].slice(0, 10) : checkedAt);
  const expiresAt = new Date(Date.parse(dataAsOf) + FRESHNESS_DAYS * 86400000).toISOString();
  const exportSourceId = `SRC-EXPORT-${meta.sha256.slice(0, 8).toUpperCase()}`;
  const sourceType = meta.sourceType || 'SHOPEE_AFFILIATE_EXPORT';
  const sources = [];
  const products = [];
  const offers = [];
  const evidence = [];
  const sourceById = new Map();
  const shopSourceByShop = new Map();
  const sourceValidation = {
    status: 'PASSED',
    validated_at: checkedAt,
    checks: [
      { name: 'file_hash', ok: /^[a-f0-9]{64}$/i.test(String(meta.sha256)) },
      { name: 'checked_at', ok: !Number.isNaN(Date.parse(checkedAt)) },
      { name: 'row_count', ok: rows.length > 0 },
      { name: 'confirmed_mapping', ok: Boolean(meta.mappingHash) || meta.synthetic === true },
    ],
  };
  if (sourceValidation.checks.some((check) => !check.ok)) sourceValidation.status = 'FAILED';

  const exportSource = {
    id: exportSourceId,
    kind: 'AFFILIATE_EXPORT',
    label: meta.label,
    reference: meta.reference,
    checked_at: checkedAt,
    source_type: sourceType,
    file_hash: meta.sha256,
    data_as_of: dataAsOf,
    expires_at: expiresAt,
    status: 'ACTIVE',
    synthetic,
    verified_against_shopee: false,
    validation: sourceValidation,
    account: meta.account || null,
    date_range: meta.dateRange || null,
    mapping_hash: meta.mappingHash || null,
    provenance: {
      source: synthetic ? 'SHOPEE_AFFILIATE_EXPORT_FIXTURE' : 'USER_SUPPLIED_SHOPEE_AFFILIATE_EXPORT',
      method: meta.method || 'CSV_IMPORT',
      synthetic,
      file: meta.file,
      sha256: meta.sha256,
      row_count: rows.length,
      limitations: synthetic
        ? [
          'Synthetic fixture: every value is invented and must not be treated as Shopee market evidence.',
          'An export is a point-in-time snapshot; prices, promotions and commission can change after checked_at.',
        ]
        : [
          'User-supplied export: the app did not open Shopee and did not verify this file against the affiliate account.',
          'An export is a point-in-time snapshot; prices, promotions and commission can change after data_as_of.',
          'Rows are only as complete as the exported columns; see data_quality.unknown_fields on each offer.',
        ],
    },
  };
  sources.push(exportSource);
  sourceById.set(exportSourceId, exportSource);

  for (const row of rows) {
    if (!shopSourceByShop.has(row.shop_id)) {
      const shopSource = {
        id: `SRC-SHOP-${row.shop_id}`,
        kind: 'SHOP_REFERENCE',
        label: `${row.shop_name} (shop reference)`,
        reference: row.shop_url || '',
        checked_at: checkedAt,
        source_type: sourceType,
        file_hash: meta.sha256,
        data_as_of: dataAsOf,
        expires_at: expiresAt,
        status: 'ACTIVE',
        synthetic,
        verified_against_shopee: false,
        validation: {
          status: 'PASSED',
          validated_at: checkedAt,
          checks: [
            { name: 'shop_id', ok: Boolean(row.shop_id) },
            { name: 'checked_at', ok: !Number.isNaN(Date.parse(checkedAt)) },
            { name: 'export_row', ok: Number.isInteger(row.row_number) && row.row_number > 0 },
          ],
        },
        provenance: {
          source: synthetic ? 'SHOPEE_AFFILIATE_EXPORT_FIXTURE' : 'USER_SUPPLIED_SHOPEE_AFFILIATE_EXPORT',
          method: 'SHOP_ROW_IN_EXPORT',
          synthetic,
          file: meta.file,
          sha256: meta.sha256,
          shop_id: row.shop_id,
          limitations: [synthetic
            ? 'Shop reference comes from the same synthetic export; no shop page was visited or verified.'
            : 'Shop reference comes from the same user-supplied export; no shop page was visited or verified.'],
        },
      };
      shopSourceByShop.set(row.shop_id, shopSource);
      sources.push(shopSource);
      sourceById.set(shopSource.id, shopSource);
    }
  }

  const categoryPrices = new Map();
  for (const row of rows) {
    if (!categoryPrices.has(row.category)) categoryPrices.set(row.category, []);
    categoryPrices.get(row.category).push(row.price_thb);
  }
  const categoryStats = {};
  for (const [category, prices] of categoryPrices) {
    categoryStats[category] = {
      count: prices.length,
      median_price_thb: round(median(prices), 2),
      min_price_thb: Math.min(...prices),
      max_price_thb: Math.max(...prices),
    };
  }

  const metricsRaw = rows.map((row) => {
    const commissionPerOrder = row.price_thb * row.commission_rate;
    const priceDeltaPct = row.list_price_thb > 0
      ? ((row.price_thb - row.list_price_thb) / row.list_price_thb) * 100
      : 0;
    const medianPrice = categoryStats[row.category].median_price_thb;
    const pricePositionPct = medianPrice > 0 ? ((row.price_thb - medianPrice) / medianPrice) * 100 : 0;
    return {
      row,
      commissionPerOrder,
      priceDeltaPct,
      pricePositionPct,
      reviewVolume: Math.log10(1 + row.rating_count),
    };
  });

  const range = (values) => ({ min: Math.min(...values), max: Math.max(...values) });
  const commissionRange = range(metricsRaw.map((m) => m.commissionPerOrder));
  const promoRange = range(metricsRaw.map((m) => m.row.promo_depth_pct));
  const ratingRange = range(metricsRaw.map((m) => m.row.rating));
  const volumeRange = range(metricsRaw.map((m) => m.reviewVolume));
  const shopRange = range(metricsRaw.map((m) => m.row.shop_rating));
  const competitionRange = range(metricsRaw.map((m) => m.row.related_shop_count));

  const evidenceLimitation = (fixtureText, realText) => (synthetic ? fixtureText : realText);

  const buildEvidence = (offer, code, claimClass, statement, value, unit, method, limitations) => {
    const record = {
      id: `EV-${offer.item_id}-${code}`,
      subject: { type: 'OFFER', id: offer.id },
      claim_class: claimClass,
      statement,
      value,
      unit,
      method,
      source_ids: [...offer.source_ids],
      checked_at: checkedAt,
      synthetic,
      limitations: limitations || [evidenceLimitation(
        'Synthetic fixture value; not verified against Shopee.',
        'Read from a user-supplied export; not independently verified against Shopee.',
      )],
    };
    evidence.push(record);
    return record;
  };

  const crowding = (level) => `${level}${synthetic ? '_FIXTURE' : ''}_CROWDING`;

  for (const metric of metricsRaw) {
    const row = metric.row;
    const productId = `PRD-${row.item_id}`;
    const offerId = `OFR-${row.item_id}`;
    const sourceIds = [exportSourceId, shopSourceByShop.get(row.shop_id).id];

    const product = {
      id: productId,
      item_id: row.item_id,
      name: row.product_name,
      category: row.category,
      shop_id: row.shop_id,
      shop_name: row.shop_name,
      url: row.product_url,
      source_ids: sourceIds,
      checked_at: checkedAt,
      synthetic,
      provenance: {
        source: synthetic ? 'SHOPEE_AFFILIATE_EXPORT_FIXTURE' : 'USER_SUPPLIED_SHOPEE_AFFILIATE_EXPORT',
        method: meta.rowMethod || 'CSV_ROW',
        synthetic,
        row: row.row_number,
        file: meta.file,
        sha256: meta.sha256,
        limitations: [synthetic
          ? 'Name, category and URL are fixture values; the product page was not opened.'
          : 'Name, category and URL come from the user-supplied export; the product page was not opened.'],
      },
    };

    const reviewSignal = round(0.6 * normalize(row.rating, ratingRange.min, ratingRange.max)
      + 0.4 * normalize(metric.reviewVolume, volumeRange.min, volumeRange.max), 3);
    const competitionNormalized = normalize(row.related_shop_count, competitionRange.min, competitionRange.max);
    const competitionLevel = row.related_shop_count <= competitionRange.min + (competitionRange.max - competitionRange.min) / 3
      ? crowding('LOW')
      : row.related_shop_count >= competitionRange.min + 2 * (competitionRange.max - competitionRange.min) / 3
        ? crowding('HIGH')
        : crowding('MEDIUM');

    const offer = {
      id: offerId,
      product_id: productId,
      item_id: row.item_id,
      shop_id: row.shop_id,
      shop_name: row.shop_name,
      affiliate_link: row.affiliate_link || row.product_url,
      price_thb: round(row.price_thb, 2),
      list_price_thb: round(row.list_price_thb, 2),
      commission_rate: row.commission_rate,
      commission_per_order_thb: round(metric.commissionPerOrder, 2),
      promo: {
        type: row.promo_type,
        label: row.promo_label,
        depth_pct: round(row.promo_depth_pct, 2),
      },
      reviews: { rating: row.rating, rating_count: row.rating_count, units_sold: row.units_sold },
      shop: { id: row.shop_id, name: row.shop_name, rating: row.shop_rating, related_shop_count: row.related_shop_count },
      metrics: {
        category_median_price_thb: categoryStats[row.category].median_price_thb,
        price_position_pct: round(metric.pricePositionPct, 2),
        discount_vs_list_pct: round(Math.abs(metric.priceDeltaPct), 2),
        review_signal: reviewSignal,
        competition_level: competitionLevel,
        normalized: {
          commission: round(normalize(metric.commissionPerOrder, commissionRange.min, commissionRange.max), 3),
          promo: round(normalize(row.promo_depth_pct, promoRange.min, promoRange.max), 3),
          review: reviewSignal,
          shop: round(normalize(row.shop_rating, shopRange.min, shopRange.max), 3),
          competition: round(1 - competitionNormalized, 3),
        },
      },
      source_type: sourceType,
      file_hash: meta.sha256,
      row_number: row.row_number,
      data_quality: {
        complete: !(row.unknown_fields || []).length,
        unknown_fields: [...(row.unknown_fields || [])],
        derived_fields: row.derived_fields || [],
      },
      checked_at: checkedAt,
      source_ids: sourceIds,
      synthetic,
      provenance: {
        source: synthetic ? 'SHOPEE_AFFILIATE_EXPORT_FIXTURE' : 'USER_SUPPLIED_SHOPEE_AFFILIATE_EXPORT',
        method: meta.rowMethod || 'CSV_ROW',
        synthetic,
        row: row.row_number,
        file: meta.file,
        sha256: meta.sha256,
        limitations: [synthetic
          ? 'Price, promotion, commission, rating and shop values are fixture values, not a live Shopee quote.'
          : 'Price, promotion, commission, rating and shop values come from a user-supplied export, not a live Shopee quote.',
        'Conversion, click-through and payout approval are not in the export and remain UNKNOWN.'],
      },
    };

    buildEvidence(offer, 'PRICE', 'FACT',
      `Export row ${row.row_number} lists THB ${offer.price_thb.toFixed(2)} against a list price of THB ${offer.list_price_thb.toFixed(2)}.`,
      offer.price_thb, 'THB', 'Read directly from the export row.', ['A list price is a seller reference, not evidence of a real discount.']);
    buildEvidence(offer, 'COMMISSION', 'FACT',
      `Commission is ${round(row.commission_rate * 100, 2)}% of price, or THB ${offer.commission_per_order_thb.toFixed(2)} per order at the listed price.`,
      offer.commission_per_order_thb, 'THB/order', 'price_thb x commission_rate from the export row.', ['Commission is only earned on a completed, approved order.']);
    buildEvidence(offer, 'PROMO', 'FACT',
      `Promotion in the export: ${row.promo_type} — ${row.promo_label} (stated depth ${round(row.promo_depth_pct, 2)}%).`,
      round(row.promo_depth_pct, 2), '%', 'Read directly from the export row.', ['Promotion terms and stock are not verified outside the export.']);
    buildEvidence(offer, 'REVIEWS', 'FACT',
      `Rating ${row.rating}/5 from ${row.rating_count} ratings; ${row.units_sold} units sold in the export snapshot.`,
      row.rating, 'stars', 'Read directly from the export row.', [evidenceLimitation(
        'Ratings and units sold are fixture values and can include seller incentives.',
        'Ratings and units sold come from the export and can include seller incentives.',
      )]);
    buildEvidence(offer, 'SHOP', 'FACT',
      `Shop ${row.shop_name} (${row.shop_id}) has rating ${row.shop_rating}/5 and ${row.related_shop_count} related shops in the export.`,
      row.shop_rating, 'stars', 'Read directly from the export row.', [evidenceLimitation(
        'Shop rating is a fixture value; shop policy and payout history were not checked.',
        'Shop rating comes from the export; shop policy and payout history were not checked.',
      )]);
    buildEvidence(offer, 'PRICE_POSITION', 'INFERENCE',
      `At THB ${offer.price_thb.toFixed(2)} this offer is ${round(metric.pricePositionPct, 2)}% vs the ${row.category} median of THB ${categoryStats[row.category].median_price_thb.toFixed(2)} in this import.`,
      round(metric.pricePositionPct, 2), '%', 'Import category median compared with the offer price.', [evidenceLimitation(
        'The comparison uses fixture rows only; it is not a market price survey.',
        'The comparison uses only the rows in this import; it is not a market price survey.',
      )]);
    buildEvidence(offer, 'REVIEW_SIGNAL', 'INFERENCE',
      `Review signal ${reviewSignal} combines rating ${row.rating} and ${row.rating_count} ratings on a 0–1 scale.`,
      reviewSignal, 'index 0–1', '0.6 x normalised rating + 0.4 x normalised log10(1 + rating_count).', ['A high signal does not prove the product is good or that reviews are authentic.']);
    buildEvidence(offer, 'COMPETITION', 'INFERENCE',
      `${row.related_shop_count} related shops places this offer in ${competitionLevel} for this import.`,
      row.related_shop_count, 'shops', 'related_shop_count compared with the import range.', [evidenceLimitation(
        'Related-shop count is a fixture value, not a live marketplace count.',
        'Related-shop count comes from the export, not a live marketplace count.',
      )]);
    buildEvidence(offer, 'CONVERSION', 'UNKNOWN',
      'Click-through and order-conversion rates are not present in the export, so payout per viewer cannot be computed.',
      null, null, 'No measurement available before an approved experiment.', ['Requires an experiment and dashboard observations that this slice does not perform.']);

    const evidenceIds = evidence.filter((item) => item.subject.id === offerId).map((item) => item.id);
    offer.evidence_ids = evidenceIds;
    product.evidence_ids = evidenceIds;
    products.push(product);
    offers.push(offer);
  }

  return {
    sources,
    products,
    offers,
    evidence,
    analysis: {
      categoryStats,
      method: 'mvp-analysis-v1',
      synthetic,
      data_as_of: dataAsOf,
      expires_at: expiresAt,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Candidate generation                                                */
/* ------------------------------------------------------------------ */

const SCORE_WEIGHTS = { commission: 0.30, promo: 0.20, review: 0.20, shop: 0.15, competition: 0.15 };

function confidenceFor(offer) {
  // A missing export column must lower confidence instead of being counted as
  // a present zero. Complete rows (every fixture row) keep the original result.
  const unknown = new Set(offer.data_quality?.unknown_fields || []);
  const present = (field) => !unknown.has(field);
  const checks = [
    Number.isFinite(offer.commission_rate),
    present('rating') && Number.isFinite(offer.reviews.rating),
    present('rating_count') && offer.reviews.rating_count > 0,
    present('promo_depth_pct') && Number.isFinite(offer.promo.depth_pct),
    present('related_shop_count') && Number.isFinite(offer.shop.related_shop_count),
    present('shop_rating') && Number.isFinite(offer.shop.rating),
  ];
  const completeness = checks.filter(Boolean).length / checks.length;
  const volumeFactor = offer.reviews.rating_count >= 200 ? 1 : offer.reviews.rating_count >= 50 ? 0.75 : 0.5;
  const score = round(completeness * 0.7 + volumeFactor * 0.3, 3);
  const level = score >= 0.85 ? 'HIGH' : score >= 0.6 ? 'MEDIUM' : 'LOW';
  const missing = [...unknown].filter((field) => ['rating', 'rating_count', 'shop_rating', 'related_shop_count', 'promo_depth_pct'].includes(field));
  return {
    level,
    score,
    basis: `${Math.round(completeness * 100)}% of key export fields present; review volume factor ${volumeFactor} (rating_count ${offer.reviews.rating_count}).${missing.length ? ` Missing from the export: ${missing.join(', ')}.` : ''} Confidence is in the import data, not in future sales.`,
  };
}

function claim(text, claimClass, evidenceIds) {
  if (!CLAIM_CLASSES.has(claimClass)) throw new Error(`invalid claim class ${claimClass}`);
  return { text, claim_class: claimClass, evidence_ids: evidenceIds };
}

function buildCandidate(offer, product, rank, checkedAt, meta) {
  const n = offer.metrics.normalized;
  const weighted = SCORE_WEIGHTS.commission * n.commission
    + SCORE_WEIGHTS.promo * n.promo
    + SCORE_WEIGHTS.review * n.review
    + SCORE_WEIGHTS.shop * n.shop
    + SCORE_WEIGHTS.competition * n.competition;
  const opportunityScore = Math.round(100 * weighted);
  const confidence = confidenceFor(offer);
  const rankingScore = Math.round(0.85 * opportunityScore + 0.15 * confidence.score * 100);
  const ev = (code) => `EV-${offer.item_id}-${code}`;
  const audience = CATEGORY_AUDIENCE[product.category] || `buyers in the ${product.category} category`;
  const evidenceIds = [...offer.evidence_ids];
  const sourceIds = [...offer.source_ids];

  const claims = [
    claim(
      `Price THB ${offer.price_thb.toFixed(2)} (list THB ${offer.list_price_thb.toFixed(2)}), commission ${round(offer.commission_rate * 100, 2)}% = THB ${offer.commission_per_order_thb.toFixed(2)} per order, promo ${offer.promo.type} at ${offer.promo.depth_pct}%.`,
      'FACT',
      [ev('PRICE'), ev('COMMISSION'), ev('PROMO')],
    ),
    claim(
      `Rating ${offer.reviews.rating}/5 from ${offer.reviews.rating_count} ratings and ${offer.reviews.units_sold} units sold in the export snapshot.`,
      'FACT',
      [ev('REVIEWS'), ev('SHOP')],
    ),
    claim(
      `Price is ${pricePositionText(offer)}; review signal ${offer.metrics.review_signal} and ${offer.shop.related_shop_count} related shops put crowding at ${offer.metrics.competition_level}.`,
      'INFERENCE',
      [ev('PRICE_POSITION'), ev('REVIEW_SIGNAL'), ev('COMPETITION')],
    ),
    claim(
      `A problem-first demo for ${audience} could turn the observed demand into affiliate orders if the offer still holds at production time.`,
      'HYPOTHESIS',
      [ev('REVIEWS'), ev('PRICE_POSITION')],
    ),
    claim(
      'Click-through, conversion rate and payout approval are not in the export, so expected earnings per viewer are unknown.',
      'UNKNOWN',
      [ev('CONVERSION')],
    ),
  ];

  return {
    id: `CND-${offer.item_id}`,
    rank,
    title: product.name,
    product_id: product.id,
    offer_id: offer.id,
    shop: { id: offer.shop_id, name: offer.shop_name },
    category: product.category,
    scores: {
      formula_version: 'mvp-score-v1',
      ranking_score: rankingScore,
      opportunity_score: opportunityScore,
      confidence,
      components: {
        weights: { ...SCORE_WEIGHTS },
        normalized: { ...n },
      },
    },
    claims,
    reasons: [
      `Commission THB ${offer.commission_per_order_thb.toFixed(2)}/order at ${round(offer.commission_rate * 100, 2)}% (${ev('COMMISSION')}).`,
      `Promotion depth ${offer.promo.depth_pct}% (${ev('PROMO')}) and price ${pricePositionText(offer)} (${ev('PRICE_POSITION')}).`,
      `Review signal ${offer.metrics.review_signal} from ${offer.reviews.rating_count} ratings (${ev('REVIEW_SIGNAL')}); ${offer.shop.related_shop_count} related shops → ${offer.metrics.competition_level} (${ev('COMPETITION')}).`,
      `Final ranking blends opportunity ${opportunityScore}/100 with data confidence ${confidence.level} (${confidence.score}); sales are NOT predicted (${ev('CONVERSION')}).`,
    ],
    source_ids: sourceIds,
    evidence_ids: evidenceIds,
    status: 'NONE',
    status_history: [],
    synthetic: meta.synthetic !== false,
    created_at: checkedAt,
    provenance: {
      source: 'MVP_AFFILIATE_SLICE',
      method: 'DETERMINISTIC_SCORING',
      input_sha256: meta.sha256,
      formula_version: 'mvp-score-v1',
      data_quality: offer.data_quality || null,
      limitations: [
        'Ranking is an export-data heuristic, not a sales forecast or a recommendation to publish.',
        meta.synthetic === false
          ? 'All values originate from a user-supplied export; no external verification was performed.'
          : 'All values originate from the synthetic export; no external verification was performed.',
      ],
    },
  };
}

function scoreOffers(state, offers) {
  return offers.map((offer) => {
    const product = state.products[offer.product_id];
    const n = offer.metrics.normalized;
    const weighted = SCORE_WEIGHTS.commission * n.commission
      + SCORE_WEIGHTS.promo * n.promo
      + SCORE_WEIGHTS.review * n.review
      + SCORE_WEIGHTS.shop * n.shop
      + SCORE_WEIGHTS.competition * n.competition;
    const opportunity = Math.round(100 * weighted);
    const confidence = confidenceFor(offer);
    const ranking = Math.round(0.85 * opportunity + 0.15 * confidence.score * 100);
    const commissionPerOrder = offer.commission_per_order_thb;
    return { offer, product, opportunity, ranking, commissionPerOrder };
  });
}

function isRemovedCandidate(candidate) {
  return candidate.status === 'NONE'
    && Array.isArray(candidate.status_history)
    && candidate.status_history.length > 0
    && candidate.status_history.at(-1).action === 'REMOVE';
}

function isActiveCandidate(candidate) {
  if (candidate.status === 'REJECTED') return false;
  if (candidate.status === 'NONE') return !isRemovedCandidate(candidate);
  return candidate.status === 'SAVED' || candidate.status === 'QUEUED';
}

function rerankActiveSet(state) {
  const active = state.candidateOrder
    .map((id) => state.candidates[id])
    .filter((candidate) => candidate && isActiveCandidate(candidate));
  active.sort((a, b) => {
    const ao = state.offers[a.offer_id];
    const bo = state.offers[b.offer_id];
    const aComm = ao ? ao.commission_per_order_thb : 0;
    const bComm = bo ? bo.commission_per_order_thb : 0;
    return b.scores.ranking_score - a.scores.ranking_score
      || bComm - aComm
      || a.id.localeCompare(b.id);
  });
  active.forEach((candidate, index) => { candidate.rank = index + 1; });
  return active;
}

function generateCandidates(state, options = {}) {
  const guard = assertSourcesGeneratable(state, options);
  const offers = Object.values(state.offers);
  if (offers.length < 5) {
    throw httpError(422, `At least 5 offers are required to generate 5 candidates; the import has ${offers.length}.`);
  }
  const scored = scoreOffers(state, offers);
  scored.sort((a, b) => b.ranking - a.ranking
    || b.commissionPerOrder - a.commissionPerOrder
    || a.offer.item_id.localeCompare(b.offer.item_id));
  const selected = scored.slice(0, 5);

  const candidates = {};
  const order = [];
  const checkedAt = state.import.checked_at;
  const meta = {
    sha256: state.import.sha256,
    file: state.import.file,
    synthetic: state.import.synthetic !== false,
  };
  selected.forEach((entry, index) => {
    const candidate = buildCandidate(entry.offer, entry.product, index + 1, checkedAt, meta);
    candidates[candidate.id] = candidate;
    order.push(candidate.id);
  });
  state.lastGeneration = {
    at: nowIso(),
    data_mode: state.data_mode || 'FIXTURE',
    source_warnings: guard.warnings,
    acknowledge_expired: options.acknowledgeExpired === true,
  };

  // Keep actions/queue only for ids that survive regeneration.
  state.candidates = candidates;
  state.candidateOrder = order;
  state.queue = state.queue.filter((id) => candidates[id]);
  for (const candidate of Object.values(candidates)) {
    const previous = state.actions.filter((a) => a.candidate_id === candidate.id).at(-1);
    if (previous) candidate.status = previous.to;
    if (candidate.status === 'REJECTED') state.queue = state.queue.filter((id) => id !== candidate.id);
  }
  return { candidates: order.map((id) => candidates[id]), count: order.length };
}

/**
 * Generate deterministic Markdown content from a content project.
 * This produces a script/draft markdown file with claim_map, provenance,
 * and SHA-256 integrity verification.
 */
function generateMarkdownContent(project) {
  const { candidate, product, offer, approach, qa, storyboard, script } = project;
  const ev = (code) => `EV-${offer.item_id}-${code}`;
  const audience = CATEGORY_AUDIENCE[product.category] || `buyers in the ${product.category} category`;
  const price = offer.price_thb.toFixed(2);
  const listPrice = offer.list_price_thb.toFixed(2);
  const depth = offer.promo.depth_pct;
  const cta = approach.cta || 'คลิกลิงก์ด้านล่างเพื่อเช็กราคาปัจจุบัน';
  
  const claimLines = (candidate.claims || []).map((c) => {
    const evidence = (c.evidence_ids || []).map((e) => e.replace('EV-', '')).join(', ');
    return `- ${c.text} (${c.claim_class}, evidence: ${evidence})`;
  });
  
  const qaSummary = qa && qa.summary
    ? `QA: PASS ${qa.summary.PASS} · WARN ${qa.summary.WARN} · FAIL ${qa.summary.FAIL}`
    : 'QA not run';
  
  return `# Content Script/Draft

Generated from candidate: ${candidate.title} (${candidate.id})
Product: ${product.name} (${product.id})
Approach: ${approach.key}
Generated at: ${new Date().toISOString()}

## Product Details
- Name: ${product.name}
- Category: ${product.category}
- Price: THB ${price} (list: THB ${listPrice})
- Shop: ${offer.shop_name} (${offer.shop_id})

## Generated Content
${claimLines.length > 0 ? claimLines.join('\n') : '- No claims generated'}

## QA Summary
${qaSummary}

## Storyboard Overview
- Scenes: ${storyboard ? storyboard.scenes.length : 0}
- Aspect ratio: 9:16
- Language: th

## CTA
${cta}

---
`;
}

function buildApproaches(candidate, offer, product) {
  const ev = (code) => `EV-${offer.item_id}-${code}`;
  const audience = CATEGORY_AUDIENCE[product.category] || `buyers in the ${product.category} category`;
  const money = `THB ${offer.price_thb.toFixed(2)}`;
  return [
    {
      key: 'personalized_a',
      label: 'Personalized A',
      origin: 'AI_DRAFT',
      angle: 'Problem-first demo for ' + audience + ': show the everyday problem, then the product in use.',
      audience,
      hook: 'Product name: ' + product.name + ' — here is what ' + money + ' actually fixes.',
      format: '30–45s vertical UGC demo, one problem, one product, one CTA.',
      cta: 'Ask viewers to check the current price; do not promise a discount that the fixture cannot verify.',
      evidence_ids: [ev('PRICE'), ev('REVIEWS'), ev('PROMO')],
      claim_notes: 'Fixture facts used: ' + money + ', ' + offer.promo.label + ', rating ' + offer.reviews.rating + '. Claims about outcomes stay HYPOTHESIS.',
      tradeoffs: ['Needs a real demonstration to look credible.', 'Audience fit is inferred from the fixture category only.'],
    },
    {
      key: 'personalized_b',
      label: 'Personalized B',
      origin: 'AI_DRAFT',
      angle: 'Value/comparison framing for ' + audience + ': list price vs current price vs commission-backed offer.',
      audience,
      hook: `"List ${'THB ' + offer.list_price_thb.toFixed(2)} → now ${money}. Is it worth it?"`,
      format: '20–30s comparison table plus a short hands-on clip.',
      cta: 'Invite viewers to compare the current listing price themselves before buying.',
      evidence_ids: [ev('PRICE'), ev('PRICE_POSITION'), ev('COMMISSION')],
      claim_notes: 'Price is ' + pricePositionText(offer) + '. A list price is not proof of a real saving — say so on screen.',
      tradeoffs: ['Comparison content dates quickly.', 'A weak or expired promotion makes the hook misleading, so re-check at production time.'],
    },
    {
      key: 'exploration',
      label: 'Exploration',
      origin: 'AI_DRAFT',
      angle: 'Broad category hook to test whether ' + product.category + ' demand exists at all, without assuming the product wins.',
      audience: 'cold viewers in the ' + product.category + ' category',
      hook: 'Three things I check before buying ' + (CATEGORY_NOUN[product.category] || product.category.toLowerCase()) + ' under THB 1,000.',
      format: '15–20s listicle, product appears third.',
      cta: 'Ask which criterion matters most; treat replies as research, not sales.',
      evidence_ids: [ev('COMPETITION'), ev('REVIEW_SIGNAL')],
      claim_notes: 'Deliberately low product-prominence. Success criteria must be pre-registered before any G2 request; this draft makes no performance claim.',
      tradeoffs: ['Weak direct conversion intent.', 'Useful only if the goal is learning, not revenue.'],
    },
  ].map((approach) => ({
    ...approach,
    evidence_ids: approach.evidence_ids.filter(Boolean),
    gate_note: 'Draft only. No experiment is created and G2 is not requested.',
  }));
}

function planIdentityPreview(state) {
  const next = Object.keys(state.plans).length + 1;
  const planId = 'MVP-PLAN-' + state.cycle + '-' + next;
  return { plan_id: planId, id: planId + '-v1', version: 'v1' };
}

function buildImpactPreview(state, draft) {
  const candidate = state.candidates[draft.candidate_id];
  const identity = planIdentityPreview(state);
  return {
    generated_at: nowIso(),
    fixture_only: true,
    candidate: { id: candidate.id, title: candidate.title, status: candidate.status },
    plan_identity_preview: identity,
    changes: [
      {
        what: 'Create fixture plan ' + identity.plan_id + ' (' + identity.id + ') from ' + candidate.id + '. ',
        where: 'MVP fixture state only',
        effect: 'one MVP plan record, status FIXTURE_DRAFT',
      },
      {
        what: 'Persist the chosen approach and, if provided, the user-custom entry.',
        where: 'MVP fixture state only',
        effect: 'plan content and approach provenance',
      },
    ],
    not_done: [
      'No Experiment record (EXP-*) is created.',
      'No Content Work Item (CWI-*) is created.',
      'No script, storyboard, video, asset or export is produced by this step; the Content slice does that separately from a content draft.',
      'No publication, scheduling, account access, purchase or spend occurs.',
      'No G1–G5 or G-pay decision is recorded or changed.',
      'Nothing is written to data/app/state.json or to the Plan Version / CWI contracts.',
    ],
    gates: {
      G1: 'unchanged — pre-existing plan-level approval; this action does not re-open or re-decide it',
      G2: 'not requested',
      G3: 'not requested',
      G4: 'not requested',
      G5: 'not requested',
      G_pay: 'none — spend THB 0',
    },
    spend_thb: 0,
    external_calls: 0,
    confirmation_required: 'POST /api/mvp/plan with confirmImpact: true',
    limitations: [
      'Creating a fixture plan is not Mission 1 progress and does not establish AC-01, SCOPE-1 or slice completion.',
      'The plan references synthetic fixture values; refresh the export before any real work.',
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Serialisation for the client                                        */
/* ------------------------------------------------------------------ */

function candidateSummary(candidate) {
  return {
    id: candidate.id,
    rank: candidate.rank,
    title: candidate.title,
    status: candidate.status,
    ranking_score: candidate.scores.ranking_score,
    opportunity_score: candidate.scores.opportunity_score,
    confidence: candidate.scores.confidence.level,
  };
}

function candidateSummary(candidate, actions) {
  return {
    id: candidate.id,
    rank: candidate.rank,
    title: candidate.title,
    status: candidate.status,
    ranking_score: candidate.scores.ranking_score,
    opportunity_score: candidate.scores.opportunity_score,
    confidence: candidate.scores.confidence.level,
    consistency: candidateConsistency(candidate, actions),
  };
}

function candidateConsistency(candidate, actions) {
  const history = Array.isArray(candidate.status_history) ? candidate.status_history : null;
  if (!history) return 'INCONSISTENT';
  for (const entry of history) {
    if (!entry || typeof entry !== 'object' || typeof entry.at !== 'string'
      || typeof entry.action !== 'string'
      || (entry.from !== null && typeof entry.from !== 'string')
      || (entry.to !== null && typeof entry.to !== 'string')) {
      return 'INCONSISTENT';
    }
  }
  if (history.length > 0 && candidate.status !== history.at(-1).to) return 'INCONSISTENT';
  const expected = (actions || [])
    .filter((a) => a && a.candidate_id === candidate.id && a.action !== 'REORDER')
    .map((a) => ({ at: a.at, action: a.action, from: a.from, to: a.to, note: a.note || null }));
  for (let i = 0; i < Math.min(expected.length, history.length); i += 1) {
    const e = expected[i];
    const h = history[i];
    if (e.at !== h.at || e.action !== h.action || e.from !== h.from || e.to !== h.to || (e.note || null) !== (h.note || null)) {
      return 'ACTION_LOG_DIVERGENT';
    }
  }
  if (expected.length !== history.length) return 'ACTION_LOG_DIVERGENT';
  return 'OK';
}

function viewState(state) {
  const candidates = state.candidateOrder
    .map((id) => state.candidates[id])
    .filter(Boolean)
    .map((candidate) => ({ ...candidate, consistency: candidateConsistency(candidate, state.actions) }));
  const statusCounts = { NONE: 0, SAVED: 0, REJECTED: 0, QUEUED: 0 };
  for (const candidate of candidates) statusCounts[candidate.status] = (statusCounts[candidate.status] || 0) + 1;
  const sources = sourceLibrary(state);
  return {
    schemaVersion: state.schemaVersion,
    kind: state.kind,
    synthetic: state.synthetic !== false,
    data_mode: state.data_mode || (state.synthetic === false ? 'STAGED_IMPORT' : 'FIXTURE'),
    cycle: state.cycle,
    import: state.import,
    summary: {
      sources: sources.length,
      products: Object.keys(state.products).length,
      offers: Object.keys(state.offers).length,
      evidence: Object.keys(state.evidence).length,
      candidates: candidates.length,
      queued: state.queue.length,
      status_counts: statusCounts,
      plans: Object.keys(state.plans).length,
      archived_sources: sources.filter((source) => source.status === 'ARCHIVED').length,
    },
    sources,
    freshness_warnings: freshnessWarnings(state),
    last_generation: state.lastGeneration || null,
    products: Object.values(state.products),
    offers: Object.values(state.offers),
    evidence: Object.values(state.evidence),
    analysis: state.analysis,
    candidates,
    snapshots: Object.values(state.snapshots || {}),
    queue: state.queue,
    actions: state.actions,
    planDrafts: Object.values(state.planDrafts),
    plans: state.planOrder.map((id) => state.plans[id]),
    contents: state.contentOrder.map((id) => state.contents[id]).filter(Boolean),
  };
}

function fixtureMeta() {
  return {
    file: path.relative(REPO_DIR, FIXTURE_FILE).split(path.sep).join('/'),
    label: FIXTURE_LABEL,
    synthetic: true,
    columns: REQUIRED_COLUMNS,
  };
}

async function fixtureSha256() {
  const raw = await fsp.readFile(FIXTURE_FILE);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/* ------------------------------------------------------------------ */
/* Route handling                                                      */
/* ------------------------------------------------------------------ */

function requireString(value, field, { min = 1, max = TEXT_LIMIT } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) throw httpError(400, field + ' is required');
  if (text.length > max) throw httpError(400, `${field} must be ${max} characters or fewer`);
  return text;
}

function parseJsonBody(raw) {
  if (!raw || !raw.trim()) return {};
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw httpError(400, 'Body must be valid JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Body must be a JSON object');
  return body;
}

function findCandidate(state, id) {
  const candidate = state.candidates[id];
  if (!candidate) throw httpError(404, `candidate not found: ${id}`);
  return candidate;
}

function findDraft(state, id) {
  const draft = state.planDrafts[id];
  if (!draft) throw httpError(404, `plan draft not found: ${id}`);
  return draft;
}

function recordAction(state, candidate, action, from, to, note) {
  const rankBefore = from === 'SAVED' || from === 'QUEUED' || from === 'NONE' ? candidate.rank : null;
  const entry = {
    id: `ACT-${state.actions.length + 1}`,
    at: nowIso(),
    candidate_id: candidate.id,
    action,
    from,
    to,
    note: note || null,
    queue_after: [...state.queue],
    rank_before: rankBefore,
    rank_after: null,
    synthetic: true,
  };
  state.actions.push(entry);
  candidate.status_history.push({ at: entry.at, action, from, to, note: entry.note });
  return entry;
}

async function handleImport(req, res, ctx) {
  const raw = await ctx.readBody(req, 256 * 1024);
  const body = parseJsonBody(raw);
  let csv = typeof body.csv === 'string' && body.csv.trim() ? body.csv : null;
  let file = 'pasted CSV';
  if (!csv) {
    csv = await fsp.readFile(FIXTURE_FILE, 'utf8');
    file = fixtureMeta().file;
  }
  const sha256 = crypto.createHash('sha256').update(csv).digest('hex');
  const rows = parseExportCsv(csv);

  const result = await withLock(async () => {
    const state = await readState();
    if (state.import && state.import.sha256 === sha256) {
      return { status: 200, payload: { import: state.import, reused: true, reset: false, state: viewState(state) } };
    }
    const checkedAt = nowIso();
    const exportedDates = rows.map((row) => row.exported_at).filter(Boolean).sort();
    const dateRange = exportedDates.length
      ? { from: exportedDates[0].slice(0, 10), to: exportedDates[exportedDates.length - 1].slice(0, 10) }
      : null;
    const built = buildDataset(rows, {
      sha256,
      file,
      reference: file === fixtureMeta().file ? `fixture://${fixtureMeta().file}` : 'pasted://csv',
      label: FIXTURE_LABEL,
      checkedAt,
      synthetic: true,
      sourceType: 'SHOPEE_AFFILIATE_EXPORT_SYNTHETIC',
      method: 'CSV_IMPORT',
      dateRange,
    });
    const hadDownstream = Boolean(state.import);
    const fresh = baseState();
    fresh.cycle = state.cycle;
    fresh.data_mode = 'FIXTURE';
    fresh.import = {
      id: `IMP-${state.import ? Number(state.import.id.split('-')[1] || 0) + 1 : 1}`,
      file,
      label: FIXTURE_LABEL,
      sha256,
      file_hash: sha256,
      source_type: 'SHOPEE_AFFILIATE_EXPORT_SYNTHETIC',
      row_count: rows.length,
      checked_at: checkedAt,
      imported_at: checkedAt,
      data_as_of: built.analysis.data_as_of,
      expires_at: built.analysis.expires_at,
      date_range: dateRange,
      synthetic: true,
      source_validation: built.sources[0].validation,
      provenance: {
        method: 'CSV_IMPORT',
        source: 'SHOPEE_AFFILIATE_EXPORT_FIXTURE',
        limitations: ['Synthetic fixture input; not a live Shopee export.', 'Import is a snapshot; re-check before use.'],
      },
    };
    fresh.sources = Object.fromEntries(built.sources.map((item) => [item.id, item]));
    fresh.products = Object.fromEntries(built.products.map((item) => [item.id, item]));
    fresh.offers = Object.fromEntries(built.offers.map((item) => [item.id, item]));
    fresh.evidence = Object.fromEntries(built.evidence.map((item) => [item.id, item]));
    const categories = Object.entries(built.analysis.categoryStats).map(([category, stats]) => ({ category, ...stats }));
    fresh.analysis = {
      method: built.analysis.method,
      generated_at: checkedAt,
      fixture_only: true,
      data_as_of: built.analysis.data_as_of,
      expires_at: built.analysis.expires_at,
      categories,
      offer_metrics: built.offers.map((offer) => ({
        offer_id: offer.id,
        category: built.products.find((p) => p.id === offer.product_id)?.category,
        price_thb: offer.price_thb,
        commission_per_order_thb: offer.commission_per_order_thb,
        promo_depth_pct: offer.promo.depth_pct,
        review_signal: offer.metrics.review_signal,
        competition_level: offer.metrics.competition_level,
      })),
      dataset_unknowns: [
        'Click-through rate per listing',
        'Order conversion rate per listing',
        'Live price, stock and promotion validity',
        'Commission approval and payout timing',
        'Audience size and cost per view',
      ],
    };
    await writeState(fresh);
    return {
      status: 201,
      payload: {
        import: fresh.import,
        reused: false,
        reset: hadDownstream,
        reset_scope: hadDownstream ? 'candidates, actions, queue, plan drafts and plans for the previous import' : null,
        records: {
          sources: built.sources.length,
          products: built.products.length,
          offers: built.offers.length,
          evidence: built.evidence.length,
        },
        state: viewState(fresh),
      },
    };
  });
  ctx.sendJson(res, result.status, result.payload);
}

async function handleGenerate(req, res, ctx) {
  const raw = await ctx.readBody(req, 32 * 1024);
  const body = parseJsonBody(raw);
  const options = { acknowledgeExpired: body.acknowledgeExpired === true };
  const result = await withLock(async () => {
    const state = await readState();
    if (!state.import) throw httpError(409, 'import the export before generating candidates');
    const revBases = captureRevisionBases(state);
    const generated = generateCandidates(state, options);
    applyRevisionChangeSet(state, revBases);
    await writeState(state);
    return {
      candidates: generated.candidates,
      count: generated.count,
      source_warnings: state.lastGeneration ? state.lastGeneration.source_warnings : [],
      state: viewState(state),
    };
  });
  ctx.sendJson(res, 201, result);
}

async function handleCandidateAction(req, res, ctx, candidateId) {
  const raw = await ctx.readBody(req, 32 * 1024);
  const body = parseJsonBody(raw);
  const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : '';
  if (!ACTIONS.has(action)) throw httpError(400, 'action must be SAVE, REJECT, QUEUE or REMOVE');
  const note = body.note === undefined ? null : requireString(body.note, 'note', { max: 300 });

  const result = await withLock(async () => {
    const state = await readState();
    const candidate = findCandidate(state, candidateId);
    const from = candidate.status;
    const revBases = captureRevisionBases(state);

    if (action === 'SAVE') {
      if (from === 'REJECTED') throw httpError(409, 'a rejected candidate cannot be saved; remove the rejection first');
      candidate.status = 'SAVED';
      if (!state.queue.includes(candidate.id)) state.queue.push(candidate.id);
    } else if (action === 'REJECT') {
      candidate.status = 'REJECTED';
      state.queue = state.queue.filter((id) => id !== candidate.id);
    } else if (action === 'QUEUE') {
      if (from === 'REJECTED') throw httpError(409, 'a rejected candidate cannot be queued');
      candidate.status = 'QUEUED';
      if (!state.queue.includes(candidate.id)) state.queue.push(candidate.id);
    } else if (action === 'REMOVE') {
      const lastEntry = (candidate.status_history || []).at(-1);
      if (from === 'NONE' && (!lastEntry || lastEntry.action === 'REMOVE')) {
        throw httpError(409, 'candidate is not saved or queued');
      }
      candidate.status = 'NONE';
      state.queue = state.queue.filter((id) => id !== candidate.id);
    }

    const entry = recordAction(state, candidate, action, from, candidate.status, note);
    entry.rank_after = candidate.status === 'SAVED' || candidate.status === 'QUEUED' ? candidate.rank : null;
    applyRevisionChangeSet(state, revBases);
    await writeState(state);
    return { candidate, action: entry, queue: state.queue, state: viewState(state) };
  });
  ctx.sendJson(res, 200, result);
}

async function handleQueueReorder(req, res, ctx) {
  const raw = await ctx.readBody(req, 32 * 1024);
  const body = parseJsonBody(raw);
  const result = await withLock(async () => {
    const state = await readState();
    if (body.order !== undefined) {
      if (!Array.isArray(body.order) || body.order.some((id) => typeof id !== 'string')) {
        throw httpError(400, 'order must be an array of candidate ids');
      }
      if (body.order.length !== state.queue.length || new Set(body.order).size !== body.order.length) {
        throw httpError(400, 'order must contain every queued candidate exactly once');
      }
      const queued = new Set(state.queue);
      if (body.order.some((id) => !queued.has(id))) throw httpError(400, 'order contains a candidate that is not queued');
      state.queue = [...body.order];
    } else {
      const candidateId = requireString(body.candidateId, 'candidateId');
      const direction = typeof body.direction === 'string' ? body.direction.trim().toUpperCase() : '';
      if (!['UP', 'DOWN'].includes(direction)) throw httpError(400, 'direction must be UP or DOWN');
      const index = state.queue.indexOf(candidateId);
      if (index === -1) throw httpError(409, 'candidate is not in the queue');
      const target = direction === 'UP' ? index - 1 : index + 1;
      if (target < 0 || target >= state.queue.length) throw httpError(409, `candidate is already at the ${direction === 'UP' ? 'top' : 'bottom'} of the queue`);
      [state.queue[index], state.queue[target]] = [state.queue[target], state.queue[index]];
    }
    state.actions.push({
      id: `ACT-${state.actions.length + 1}`,
      at: nowIso(),
      candidate_id: null,
      action: 'REORDER',
      from: null,
      to: null,
      note: null,
      queue_after: [...state.queue],
      synthetic: true,
    });
    await writeState(state);
    return { queue: state.queue, state: viewState(state) };
  });
  ctx.sendJson(res, 200, result);
}

async function handleCandidatesSelect(req, res, ctx) {
  const raw = await ctx.readBody(req, 64 * 1024);
  const body = parseJsonBody(raw);
  const method = typeof body.method === 'string' ? body.method.trim().toLowerCase() : '';
  if (!['research', 'user'].includes(method)) throw httpError(400, "method must be 'research' or 'user'");
  const context = typeof body.context === 'string' ? body.context.trim().toLowerCase() : '';
  if (!['add', 'replace'].includes(context)) throw httpError(400, "context must be 'add' or 'replace'");
  let replaceCandidateId = null;
  if (context === 'replace') replaceCandidateId = requireString(body.replaceCandidateId, 'replaceCandidateId');
  let offerIds = null;
  if (method === 'user') {
    if (!Array.isArray(body.offerIds) || body.offerIds.length === 0) throw httpError(400, 'offerIds is required for user select');
    offerIds = body.offerIds.map((id) => (typeof id === 'string' ? id.trim() : ''));
    if (offerIds.some((id) => !id)) throw httpError(400, 'offerIds must be non-empty strings');
    if (new Set(offerIds).size !== offerIds.length) throw httpError(400, 'offerIds must not contain duplicates');
    if (context === 'replace' && offerIds.length !== 1) throw httpError(400, 'replace context selects exactly one offer');
  }
  let requested;
  if (method === 'research') {
    // SG-D6: omitted or invalid (zero, negative, fractional, string, null) → default 5 (documented);
    // an explicit integer above 5 is out of contract and is rejected.
    requested = Number.isInteger(body.count) && body.count > 0 ? body.count : 5;
    if (requested > 5) throw httpError(400, 'count must be an integer between 1 and 5 for research select');
  } else {
    requested = offerIds.length;
  }

  const result = await withLock(async () => {
    const state = await readState();
    if (!state.import) throw httpError(409, 'import the export before selecting candidates');
    const revBases = captureRevisionBases(state);

    // SG-Variant: an offer is eligible only when NO candidate exists for its item
    // (any status). Removed items return via RESTORE; this closes the same-CND overwrite defect.
    const existingByItem = new Map();
    for (const candidate of Object.values(state.candidates)) {
      const offer = state.offers[candidate.offer_id];
      if (offer) existingByItem.set(String(offer.item_id), candidate);
    }

    if (context === 'replace') {
      const target = state.candidates[replaceCandidateId];
      if (!target) throw httpError(404, `candidate not found: ${replaceCandidateId}`);
      if (!isRemovedCandidate(target)) throw httpError(409, `candidate ${replaceCandidateId} must be removed before replacing`);
    }

    let selected;
    if (method === 'research') {
      const eligible = scoreOffers(state, Object.values(state.offers))
        .filter((entry) => !existingByItem.has(String(entry.offer.item_id)))
        .sort((a, b) => b.ranking - a.ranking
          || b.commissionPerOrder - a.commissionPerOrder
          || a.offer.item_id.localeCompare(b.offer.item_id));
      selected = eligible.slice(0, requested);
    } else {
      selected = [];
      for (const offerId of offerIds) {
        const offer = state.offers[offerId];
        if (!offer) throw httpError(404, `offer not found: ${offerId}`);
        if (existingByItem.has(String(offer.item_id))) throw httpError(409, `offer ${offerId} already has a candidate (restore the removed candidate instead)`);
        selected.push({ offer, product: state.products[offer.product_id] });
      }
      selected.sort((a, b) => b.offer.commission_per_order_thb - a.offer.commission_per_order_thb
        || a.offer.item_id.localeCompare(b.offer.item_id));
    }
    if (selected.length === 0) {
      throw httpError(409, `no eligible offers to add; eligible count ${Object.values(state.offers).length - existingByItem.size}`);
    }

    const checkedAt = state.import.checked_at;
    const meta = {
      sha256: state.import.sha256,
      file: state.import.file,
      synthetic: state.import.synthetic !== false,
    };
    const added = [];
    const entries = [];
    for (const entry of selected) {
      const candidate = buildCandidate(entry.offer, entry.product, null, checkedAt, meta);
      state.candidates[candidate.id] = candidate;
      if (!state.candidateOrder.includes(candidate.id)) state.candidateOrder.push(candidate.id);
      added.push(candidate);
      entries.push(candidate);
    }
    rerankActiveSet(state);
    for (const candidate of added) {
      const actionType = context === 'replace' ? 'GENERATE_REPLACE' : 'GENERATE_ADD';
      const entry = recordAction(state, candidate, actionType, null, candidate.status, null);
      entry.rank_after = candidate.rank;
    }
    applyRevisionChangeSet(state, revBases);
    await writeState(state);
    return {
      added: added.map((candidate) => ({ id: candidate.id, item_id: state.offers[candidate.offer_id].item_id, rank: candidate.rank, title: candidate.title, status: candidate.status })),
      added_count: added.length,
      requested_count: requested,
      eligible_count: Object.values(state.offers).filter((offer) => !existingByItem.has(String(offer.item_id))).length,
      context,
      method,
      state: viewState(state),
    };
  });
  ctx.sendJson(res, 201, result);
}

async function handleCandidateRestore(req, res, ctx, candidateId) {
  const result = await withLock(async () => {
    const state = await readState();
    const candidate = findCandidate(state, candidateId);
    if (!isRemovedCandidate(candidate)) throw httpError(409, 'candidate is not removed');
    const revBases = captureRevisionBases(state);
    const from = candidate.status;
    const entry = recordAction(state, candidate, 'RESTORE', from, 'NONE', null);
    rerankActiveSet(state);
    entry.rank_after = candidate.rank;
    applyRevisionChangeSet(state, revBases);
    await writeState(state);
    return { candidate, state: viewState(state) };
  });
  ctx.sendJson(res, 200, result);
}

async function handleCandidateVariant(req, res, ctx, candidateId) {
  const result = await withLock(async () => {
    const state = await readState();
    const original = findCandidate(state, candidateId);
    const revBases = captureRevisionBases(state);
    if (original.variant_of) throw httpError(409, 'variants of variants are not supported; create a variant of the original candidate');
    // SG-Variant: sibling numbering is monotonic because no candidate deletion exists;
    // if deletion is ever introduced, this must become a persistent counter.
    const siblings = Object.values(state.candidates).filter((c) => c.variant_of === original.id);
    const variantIndex = siblings.length + 1;
    const variantId = `${original.id}-V${variantIndex}`;
    if (state.candidates[variantId]) throw httpError(409, `variant id collision: ${variantId}`);
    const variant = JSON.parse(JSON.stringify(original));
    variant.id = variantId;
    variant.variant_of = original.id;
    variant.variant_index = variantIndex;
    variant.status = 'NONE';
    variant.rank = null; // not a renumber point: the original stays byte-for-byte unchanged
    variant.created_at = nowIso();
    variant.status_history = [];
    variant.provenance = { ...variant.provenance, method: 'VARIANT_OF_ORIGINAL', variant_of: original.id, variant_index: variantIndex };
    state.candidates[variantId] = variant;
    if (!state.candidateOrder.includes(variantId)) state.candidateOrder.push(variantId);
    const entry = recordAction(state, variant, 'VARIANT_CREATE', null, variant.status, `variant ${variantIndex} of ${original.id}`);
    entry.rank_after = null;
    applyRevisionChangeSet(state, revBases);
    await writeState(state);
    return { variant, original_id: original.id, state: viewState(state) };
  });
  ctx.sendJson(res, 201, result);
}

/* ---- Vertical Slice 1: Decision Content canonicalization, revision change-set, snapshots (spec §3–§7) ---- */

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function canonicalize(value) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'string') return JSON.stringify(value);
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') {
    if (!Number.isFinite(value)) throw httpError(500, 'canonical payload contains a non-finite number');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (type === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  throw httpError(500, 'canonical payload contains a non-serializable value');
}

function candidateDecisionBody(candidate) {
  return {
    title: candidate.title,
    category: candidate.category,
    shop: { name: candidate.shop.name },
    scores: candidate.scores,
    claims: (candidate.claims || []).map((claim) => ({ text: claim.text, claim_class: claim.claim_class })),
    reasons: [...(candidate.reasons || [])],
  };
}

function candidateRevisionKey(candidate) {
  return JSON.stringify({ ...candidate, rev: undefined });
}

function captureRevisionBases(state) {
  const bases = {};
  for (const candidate of Object.values(state.candidates)) {
    bases[candidate.id] = {
      key: candidateRevisionKey(candidate),
      rev: typeof candidate.rev === 'number' ? candidate.rev : 0,
    };
  }
  return bases;
}

function applyRevisionChangeSet(state, bases) {
  for (const candidate of Object.values(state.candidates)) {
    const base = bases[candidate.id];
    if (base === undefined) { candidate.rev = 1; continue; }
    if (candidateRevisionKey(candidate) !== base.key) candidate.rev = base.rev + 1;
    else if (typeof candidate.rev === 'number') candidate.rev = base.rev;
  }
}

function buildEvidenceAnnex(state, candidate) {
  const annexBody = {
    annex_spec: 'ace-evidence-annex',
    version: 1,
    candidate_evidence_ids: [...(candidate.evidence_ids || [])],
    claims: (candidate.claims || []).map((claim, index) => ({ claim_index: index, evidence_ids: [...(claim.evidence_ids || [])] })),
    import_sha256: state.import ? state.import.sha256 : null,
  };
  return { ...annexBody, annex_hash: sha256Hex(canonicalize(annexBody)) };
}

function latestSnapshotIdFor(state, entityId) {
  const snapshots = Object.values(state.snapshots || {})
    .filter((snapshot) => snapshot.entity_id === entityId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  return snapshots.length ? snapshots[snapshots.length - 1].snapshot_id : null;
}

function buildCandidateSnapshot(state, candidate, trigger, previousSnapshotId) {
  const envelope = { spec: 'ace-candidate-payload', version: 1, body: candidateDecisionBody(candidate) };
  const canonicalJson = canonicalize(envelope);
  const snapshotId = `SNP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const record = {
    snapshot_id: snapshotId,
    entity_id: candidate.id,
    entity_kind: 'CANDIDATE_PAYLOAD',
    spec_version: 1,
    canonical_json: canonicalJson,
    payload_hash: sha256Hex(canonicalJson),
    evidence_annex: buildEvidenceAnnex(state, candidate),
    created_at: nowIso(),
    trigger,
    previous_snapshot_id: previousSnapshotId,
    source_revision: typeof candidate.rev === 'number' ? candidate.rev : 0,
  };
  state.snapshots[snapshotId] = record;
  return record;
}

async function handleCandidateSnapshot(req, res, ctx, candidateId) {
  const result = await withLock(async () => {
    const state = await readState();
    const candidate = findCandidate(state, candidateId);
    const previousSnapshotId = latestSnapshotIdFor(state, candidate.id);
    const record = buildCandidateSnapshot(state, candidate, 'manual', previousSnapshotId);
    await writeState(state);
    return { snapshot: record, state: viewState(state) };
  });
  ctx.sendJson(res, 201, result);
}

async function handleCandidateSnapshotRestore(req, res, ctx, candidateId, snapshotId) {
  const raw = await ctx.readBody(req, 32 * 1024);
  const body = parseJsonBody(raw);
  const expectedRevision = Number.isInteger(body.expected_revision) ? body.expected_revision : null;
  if (expectedRevision === null) throw httpError(400, 'expected_revision is required and must be an integer');
  const result = await withLock(async () => {
    const state = await readState();
    const candidate = findCandidate(state, candidateId);
    const snapshot = (state.snapshots || {})[snapshotId];
    if (!snapshot || snapshot.entity_id !== candidate.id) throw httpError(404, `snapshot not found: ${snapshotId}`);
    const currentRev = typeof candidate.rev === 'number' ? candidate.rev : 0;
    if (snapshot.spec_version !== 1) throw httpError(409, `unsupported snapshot spec_version: ${snapshot.spec_version}`);
    let parsed;
    try { parsed = JSON.parse(snapshot.canonical_json); } catch (err) { throw httpError(409, 'snapshot canonical_json is corrupt'); }
    if (!parsed || parsed.spec !== 'ace-candidate-payload' || parsed.version !== 1 || !parsed.body) throw httpError(409, 'unsupported snapshot payload envelope');
    if (sha256Hex(snapshot.canonical_json) !== snapshot.payload_hash) throw httpError(409, 'snapshot payload_hash mismatch — canonical content has drifted');
    const annex = snapshot.evidence_annex;
    if (!annex || typeof annex !== 'object') throw httpError(409, 'snapshot evidence annex is missing');
    const annexBody = { annex_spec: annex.annex_spec, version: annex.version, candidate_evidence_ids: annex.candidate_evidence_ids, claims: annex.claims, import_sha256: annex.import_sha256 };
    if (sha256Hex(canonicalize(annexBody)) !== annex.annex_hash) throw httpError(409, 'snapshot annex_hash mismatch — annex has drifted');
    if (!Array.isArray(annex.claims) || !Array.isArray(parsed.body.claims) || annex.claims.length !== parsed.body.claims.length) throw httpError(409, 'annex does not match the snapshot canonical claims');
    for (const entry of annex.claims) {
      if (!Number.isInteger(entry.claim_index) || entry.claim_index < 0 || entry.claim_index >= parsed.body.claims.length) throw httpError(409, 'annex claim_index out of range');
    }
    const unresolved = [];
    for (const entry of annex.claims) for (const ref of entry.evidence_ids) if (!state.evidence[ref]) unresolved.push(ref);
    for (const ref of annex.candidate_evidence_ids) if (!state.evidence[ref]) unresolved.push(ref);
    if (unresolved.length) throw httpError(409, `annex evidence references do not resolve: ${unresolved.join(', ')}`);
    if (!state.import || annex.import_sha256 !== state.import.sha256) throw httpError(409, 'snapshot belongs to a different import generation');
    const broken = [];
    const checked = new Set();
    const checkSubjectChain = (ref) => {
      if (checked.has(ref)) return;
      checked.add(ref);
      const record = state.evidence[ref];
      if (!record) { broken.push(`${ref}: evidence record missing`); return; }
      if (!record.subject || record.subject.type !== 'OFFER' || !state.offers[record.subject.id]) { broken.push(`${ref}: subject offer missing`); return; }
      const offer = state.offers[record.subject.id];
      if (!(offer.evidence_ids || []).includes(ref)) { broken.push(`${ref}: offer does not cite this evidence`); return; }
      const exportSourceId = `SRC-EXPORT-${state.import.sha256.slice(0, 8).toUpperCase()}`;
      if (!(record.source_ids || []).includes(exportSourceId)) { broken.push(`${ref}: source_ids not bound to the current import`); return; }
      if (record.checked_at !== state.import.checked_at) { broken.push(`${ref}: checked_at does not match the current import`); return; }
      if (record.synthetic !== state.import.synthetic) { broken.push(`${ref}: synthetic flag does not match the current import`); return; }
    };
    for (const entry of annex.claims) for (const ref of entry.evidence_ids) checkSubjectChain(ref);
    for (const ref of annex.candidate_evidence_ids) checkSubjectChain(ref);
    if (broken.length) throw httpError(409, `subject-chain validation failed: ${broken.join('; ')}`);
    if (!candidate.provenance || candidate.provenance.input_sha256 !== state.import.sha256) throw httpError(409, 'live entity source binding does not match the current import');
    if (currentRev !== expectedRevision) throw httpError(409, `revision mismatch: expected_revision ${expectedRevision}, current rev ${currentRev}`);
    // APPLY — Decision Content only; refs re-attached from the validated annex; provenance/lifecycle untouched.
    const restoredBody = parsed.body;
    candidate.title = restoredBody.title;
    candidate.category = restoredBody.category;
    candidate.shop = { ...candidate.shop, name: restoredBody.shop.name };
    candidate.scores = restoredBody.scores;
    candidate.claims = restoredBody.claims.map((claim, index) => ({
      text: claim.text,
      claim_class: claim.claim_class,
      evidence_ids: [...((annex.claims || []).find((entry) => entry.claim_index === index) || { evidence_ids: [] }).evidence_ids],
    }));
    candidate.reasons = [...restoredBody.reasons];
    candidate.payload_hash = snapshot.payload_hash;
    candidate.rev = currentRev + 1;
    const previousSnapshotId = latestSnapshotIdFor(state, candidate.id);
    const newRecord = buildCandidateSnapshot(state, candidate, 'restore', previousSnapshotId);
    await writeState(state);
    return {
      restored: { entity_id: candidate.id, rev: candidate.rev, payload_hash: candidate.payload_hash, previous_rev: currentRev },
      snapshot: newRecord,
      state: viewState(state),
    };
  });
  ctx.sendJson(res, 200, result);
}

async function handlePlanDraft(req, res, ctx) {
  const raw = await ctx.readBody(req, 32 * 1024);
  const body = parseJsonBody(raw);
  const candidateId = requireString(body.candidateId, 'candidateId');
  const result = await withLock(async () => {
    const state = await readState();
    const candidate = findCandidate(state, candidateId);
    if (candidate.status !== 'SAVED' && candidate.status !== 'QUEUED') {
      throw httpError(409, `save or queue the candidate before creating a plan draft (current status ${candidate.status})`);
    }
    const offer = state.offers[candidate.offer_id];
    const product = state.products[candidate.product_id];
    const draftId = `PD-${Object.keys(state.planDrafts).length + 1}`;
    const draft = {
      id: draftId,
      candidate_id: candidate.id,
      created_at: nowIso(),
      status: 'DRAFT',
      synthetic: true,
      plan_identity_preview: planIdentityPreview(state),
      basis: {
        ranking_score: candidate.scores.ranking_score,
        opportunity_score: candidate.scores.opportunity_score,
        confidence: candidate.scores.confidence,
        evidence_ids: candidate.evidence_ids,
        source_ids: candidate.source_ids,
        fixture_sha256: state.import.sha256,
      },
      approaches: {
        generated: buildApproaches(candidate, offer, product),
        user_custom: null,
      },
      impact_preview: null,
    };
    draft.impact_preview = buildImpactPreview(state, draft);
    state.planDrafts[draftId] = draft;
    await writeState(state);
    return { draft, state: viewState(state) };
  });
  ctx.sendJson(res, 201, result);
}

async function handlePlanCustom(req, res, ctx) {
  const raw = await ctx.readBody(req, 32 * 1024);
  const body = parseJsonBody(raw);
  const draftId = requireString(body.draftId, 'draftId');
  const result = await withLock(async () => {
    const state = await readState();
    const draft = findDraft(state, draftId);
    if (draft.status !== 'DRAFT') throw httpError(409, 'plan draft is already finalised');
    const custom = {
      key: 'user_custom',
      label: 'User Custom',
      origin: 'USER',
      angle: requireString(body.angle, 'angle', { min: 10, max: TEXT_LIMIT }),
      audience: body.audience === undefined || body.audience === null || body.audience === ''
        ? null
        : requireString(body.audience, 'audience', { max: TEXT_LIMIT }),
      hook: body.hook === undefined || body.hook === null || body.hook === ''
        ? null
        : requireString(body.hook, 'hook', { max: TEXT_LIMIT }),
      format: body.format === undefined || body.format === null || body.format === ''
        ? null
        : requireString(body.format, 'format', { max: TEXT_LIMIT }),
      rationale: body.rationale === undefined || body.rationale === null || body.rationale === ''
        ? null
        : requireString(body.rationale, 'rationale', { max: TEXT_LIMIT }),
      evidence_ids: [],
      claim_notes: 'User-authored entry. It is stored separately from the AI-generated approaches and carries no generated evidence mapping; verify any factual claim before use.',
      updated_at: nowIso(),
      gate_note: 'Draft only. No experiment is created and G2 is not requested.',
    };
    draft.approaches.user_custom = custom;
    draft.impact_preview = buildImpactPreview(state, draft);
    await writeState(state);
    return { draft, state: viewState(state) };
  });
  ctx.sendJson(res, 200, result);
}

async function handlePlanCreate(req, res, ctx) {
  const raw = await ctx.readBody(req, 32 * 1024);
  const body = parseJsonBody(raw);
  const draftId = requireString(body.draftId, 'draftId');
  const approachKey = typeof body.approach === 'string' ? body.approach.trim().toLowerCase() : '';
  if (!APPROACH_KEYS.includes(approachKey)) {
    throw httpError(400, `approach must be one of ${APPROACH_KEYS.join(', ')}`);
  }

  const result = await withLock(async () => {
    const state = await readState();
    const draft = findDraft(state, draftId);
    if (draft.status !== 'DRAFT') throw httpError(409, 'plan draft is already finalised');
    if (!draft.approaches.generated.some((a) => a.key === approachKey)
      && !(approachKey === 'user_custom' && draft.approaches.user_custom)) {
      throw httpError(409, `approach ${approachKey} has no content in this draft`);
    }
    const preview = buildImpactPreview(state, draft);
    if (body.confirmImpact !== true) {
      const err = httpError(400, 'impact preview must be confirmed (confirmImpact: true)');
      err.impact_preview = preview;
      throw err;
    }

    const identity = planIdentityPreview(state);
    const selected = approachKey === 'user_custom'
      ? draft.approaches.user_custom
      : draft.approaches.generated.find((a) => a.key === approachKey);
    const plan = {
      id: identity.id,
      plan_id: identity.plan_id,
      version: identity.version,
      kind: 'MVP_FIXTURE_PLAN',
      synthetic: true,
      status: 'FIXTURE_DRAFT',
      candidate_id: draft.candidate_id,
      draft_id: draft.id,
      approach: approachKey,
      selected_approach: selected,
      approaches: {
        generated: draft.approaches.generated,
        user_custom: draft.approaches.user_custom,
      },
      impact_preview: preview,
      basis: draft.basis,
      created_at: nowIso(),
      provenance: {
        source: 'MVP_AFFILIATE_SLICE',
        method: 'FIXTURE_PLAN_DRAFT',
        fixture_sha256: state.import.sha256,
        candidate_id: draft.candidate_id,
        limitations: [
          'Fixture plan only; it is not written to data/app/state.json and is not a Plan Version contract record.',
          'It references synthetic export values and creates no Experiment, CWI, asset or publication.',
        ],
      },
      foundation_handoff: {
        attempted: false,
        available: false,
        reason: 'The MVP slice keeps Plan work in fixture state. Submitting a real Plan Version requires the Foundation flow and a separate owner decision; nothing was posted to /api/plan-version.',
      },
    };
    state.plans[plan.id] = plan;
    state.planOrder.push(plan.id);
    draft.status = 'FINALISED';
    draft.plan_id = plan.plan_id;
    draft.plan_record_id = plan.id;
    draft.finalised_at = plan.created_at;
    await writeState(state);
    return {
      plan,
      boundary: {
        writes: 'MVP fixture state only',
        real_state_touched: false,
        gates_changed: false,
        spend_thb: 0,
      },
      state: viewState(state),
    };
  });
  ctx.sendJson(res, 201, result);
}

/* ------------------------------------------------------------------ */
/* Staged import: preview, confirm, promote                            */
/* ------------------------------------------------------------------ */

function readUpload(body) {
  const filename = requireString(body.filename, 'filename', { max: 200 });
  let buffer;
  if (typeof body.content_base64 === 'string') {
    const cleaned = body.content_base64.replace(/^data:[^;,]+;base64,/, '').replace(/\s+/g, '');
    if (cleaned && !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) throw httpError(400, 'content_base64 is not valid base64');
    buffer = Buffer.from(cleaned, 'base64');
  } else if (typeof body.content === 'string') {
    buffer = Buffer.from(body.content, 'utf8');
  } else {
    throw httpError(400, 'Provide the file as content_base64 (or content for text formats)');
  }
  if (!buffer.length) throw httpError(400, 'The uploaded file is empty');
  if (buffer.length > importer.MAX_FILE_BYTES) {
    throw httpError(413, `The file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB; the limit is ${importer.MAX_FILE_BYTES / 1024 / 1024} MB`);
  }
  return { filename, buffer };
}

function sanitizeMapping(input, columnCount, { requireComplete = true } = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const mapping = {};
  for (const field of importer.CANONICAL_FIELDS) {
    const raw = source[field.key];
    if (raw === null || raw === undefined || raw === '' || raw === -1) {
      mapping[field.key] = null;
      continue;
    }
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 0 || index >= columnCount) {
      throw httpError(400, `mapping.${field.key} must be a column index between 0 and ${columnCount - 1}`);
    }
    mapping[field.key] = index;
  }
  const seen = new Map();
  for (const [key, index] of Object.entries(mapping)) {
    if (index === null) continue;
    if (seen.has(index)) throw httpError(400, `Column ${index} is mapped to both ${seen.get(index)} and ${key}`);
    seen.set(index, key);
  }
  const missing = importer.missingRequiredFor(mapping);
  if (requireComplete && missing.length) {
    throw httpError(400, `The mapping is missing required fields: ${missing.join(', ')}`, { missing_required: missing });
  }
  return mapping;
}

function parseDateOnly(value, field) {
  const text = requireString(value, field, { max: 40 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw httpError(400, `${field} must be a YYYY-MM-DD date`);
  }
  return text;
}

async function handleImportPreview(req, res, ctx) {
  const raw = await ctx.readBody(req, 8 * 1024 * 1024);
  const body = parseJsonBody(raw);
  const upload = readUpload(body);
  const existing = await stagingIdentities();
  let mapping;
  if (body.mapping) {
    const table = importer.readTable({ filename: upload.filename, buffer: upload.buffer, format: body.format, encoding: body.encoding, sheet: body.sheet });
    mapping = sanitizeMapping(body.mapping, table.header.length, { requireComplete: false });
  }
  const preview = importer.buildPreview({
    filename: upload.filename,
    buffer: upload.buffer,
    format: body.format,
    encoding: body.encoding,
    sheet: body.sheet,
    mapping,
    existingIdentities: existing,
  });
  ctx.sendJson(res, 200, {
    preview,
    staging_file: path.relative(REPO_DIR, stagingFilePath()).split(path.sep).join('/'),
    next: 'POST /api/mvp/import/commit with the confirmed mapping, account and date_range',
  });
}

async function handleImportCommit(req, res, ctx) {
  const raw = await ctx.readBody(req, 8 * 1024 * 1024);
  const body = parseJsonBody(raw);
  if (body.confirmMapping !== true) {
    throw httpError(400, 'The column mapping must be confirmed (confirmMapping: true) before importing');
  }
  const upload = readUpload(body);
  const account = body.account && typeof body.account === 'object' ? body.account : {};
  const accountLabel = requireString(account.label, 'account.label', { max: 160 });
  const accountId = account.id === undefined || account.id === null || account.id === ''
    ? null
    : requireString(account.id, 'account.id', { max: 160 });
  const dateRangeInput = body.date_range && typeof body.date_range === 'object' ? body.date_range : {};
  const from = parseDateOnly(dateRangeInput.from, 'date_range.from');
  const to = parseDateOnly(dateRangeInput.to, 'date_range.to');
  if (from > to) throw httpError(400, 'date_range.from must be on or before date_range.to');

  const table = importer.readTable({
    filename: upload.filename,
    buffer: upload.buffer,
    format: body.format,
    encoding: body.encoding,
    sheet: body.sheet,
  });
  const detected = importer.detectMapping(table.header);
  const mapping = body.mapping ? sanitizeMapping(body.mapping, table.header.length) : detected.mapping;
  if (!body.mapping) {
    const missing = detected.missing_required;
    if (missing.length) throw httpError(400, `The detected mapping is missing: ${missing.join(', ')}`, { missing_required: missing });
  }
  const mappingHash = importer.hashMapping(mapping);
  const normalized = importer.normalizeRows(table, mapping);
  const fileHash = crypto.createHash('sha256').update(upload.buffer).digest('hex');
  const existing = await stagingIdentities();
  const classified = importer.classifyRows(normalized.rows, existing);
  const validRows = classified.rows.filter((row) => row.status === 'VALID');
  const synthetic = importer.sniffSynthetic(upload.filename, table.textSample ?? `${table.header.join(' ')}`);

  const report = {
    counts: classified.counts,
    invalid: classified.rows.filter((row) => row.status === 'INVALID').slice(0, 50).map((row) => ({
      row_number: row.row_number, reasons: row.reasons,
    })),
    unknown: classified.rows.filter((row) => row.status === 'UNKNOWN').slice(0, 50).map((row) => ({
      row_number: row.row_number, missing_required: row.missing_required, unknown_fields: row.unknown_fields, reasons: row.reasons,
    })),
    duplicate: classified.rows.filter((row) => row.status === 'DUPLICATE').slice(0, 50).map((row) => ({
      row_number: row.row_number, identity: row.identity, reasons: row.reasons,
    })),
  };

  const result = await withLock(async () => {
    const staging = await readStaging();
    const sameFile = staging.order
      .map((id) => staging.imports[id])
      .find((imp) => imp && imp.file_hash === fileHash);
    if (sameFile && validRows.length === 0) {
      return {
        status: 200,
        payload: {
          duplicate_import: true,
          existing_import_id: sameFile.id,
          import: stagingSummary(sameFile),
          counts: classified.counts,
          report,
          message: 'Every valid row in this file is already staged; nothing was written.',
        },
      };
    }
    if (validRows.length === 0) {
      throw httpError(422, 'No rows passed validation, so nothing was staged.', { counts: classified.counts, report });
    }

    const rowsForDataset = validRows.map((row) => ({
      ...row.values,
      row_number: row.row_number,
      unknown_fields: row.unknown_fields,
      source_type: synthetic ? 'SHOPEE_AFFILIATE_EXPORT_SYNTHETIC' : 'SHOPEE_AFFILIATE_EXPORT',
    }));
    const checkedAt = nowIso();
    const label = synthetic
      ? `SYNTHETIC fixture upload: ${upload.filename}`
      : `User-supplied Shopee Affiliate export: ${upload.filename}`;
    const built = buildDataset(rowsForDataset, {
      sha256: fileHash,
      file: upload.filename,
      reference: `upload://${upload.filename}`,
      label,
      checkedAt,
      synthetic,
      sourceType: synthetic ? 'SHOPEE_AFFILIATE_EXPORT_SYNTHETIC' : 'SHOPEE_AFFILIATE_EXPORT',
      method: `STAGED_${table.format.toUpperCase()}_IMPORT`,
      rowMethod: 'EXPORT_ROW',
      dateRange: { from, to },
      mappingHash,
      account: { id: accountId, label: accountLabel },
    });

    const id = `STG-${staging.order.length + 1}`;
    const record = {
      id,
      status: 'STAGED',
      file: upload.filename,
      format: table.format,
      encoding: table.encoding,
      sheet: table.sheet,
      size_bytes: upload.buffer.length,
      file_hash: fileHash,
      mapping,
      mapping_columns: Object.fromEntries(Object.entries(mapping)
        .filter(([, index]) => index !== null)
        .map(([key, index]) => [key, table.header[index]])),
      mapping_hash: mappingHash,
      mapping_source: body.mapping ? 'USER_CONFIRMED' : 'DETECTED_CONFIRMED',
      mapping_confirmed_at: checkedAt,
      account: { id: accountId, label: accountLabel },
      date_range: { from, to },
      source_type: synthetic ? 'SHOPEE_AFFILIATE_EXPORT_SYNTHETIC' : 'SHOPEE_AFFILIATE_EXPORT',
      synthetic,
      verified_against_shopee: false,
      checked_at: checkedAt,
      imported_at: checkedAt,
      data_as_of: built.analysis.data_as_of,
      expires_at: built.analysis.expires_at,
      counts: { ...classified.counts, imported: validRows.length },
      rows: classified.rows.map((row) => ({
        row_number: row.row_number,
        identity: row.identity,
        status: row.status,
        reasons: row.reasons,
        unknown_fields: row.unknown_fields,
        values: row.status === 'VALID' ? row.values : null,
      })),
      report,
      warnings: [
        'Staged only: the Research view and candidates still use the previous import until this staging record is promoted.',
        ...(synthetic ? ['This upload identifies itself as a SYNTHETIC fixture.'] : ['This upload is user-supplied; the app did not verify it against Shopee.']),
      ],
      source_validation: built.sources[0].validation,
      dataset: {
        sources: built.sources,
        products: built.products,
        offers: built.offers,
        evidence: built.evidence,
        analysis: built.analysis,
      },
      promoted: false,
      promoted_at: null,
    };
    staging.imports[id] = record;
    staging.order.push(id);
    await writeStaging(staging);
    return {
      status: 201,
      payload: {
        import: stagingSummary(record),
        counts: record.counts,
        report,
        mapping_columns: record.mapping_columns,
        source_validation: record.source_validation,
        records: {
          sources: built.sources.length,
          products: built.products.length,
          offers: built.offers.length,
          evidence: built.evidence.length,
        },
        writes: 'staging state only',
        research_state_unchanged: true,
        next: `POST /api/mvp/staging/${id}/research to send this import to Research`,
      },
    };
  });
  ctx.sendJson(res, result.status, result.payload);
}

async function handleStagingList(req, res, ctx) {
  const staging = await readStaging();
  ctx.sendJson(res, 200, {
    staging_file: path.relative(REPO_DIR, stagingFilePath()).split(path.sep).join('/'),
    imports: staging.order.map((id) => stagingSummary(staging.imports[id])).filter(Boolean),
  });
}

async function handleStagingDetail(req, res, ctx, id) {
  const staging = await readStaging();
  const imp = staging.imports[id];
  if (!imp) throw httpError(404, `staged import not found: ${id}`);
  ctx.sendJson(res, 200, {
    import: stagingSummary(imp),
    rows: imp.rows,
    report: imp.report,
    dataset_counts: {
      sources: imp.dataset.sources.length,
      products: imp.dataset.products.length,
      offers: imp.dataset.offers.length,
      evidence: imp.dataset.evidence.length,
    },
  });
}

async function handlePromoteStaging(req, res, ctx, id) {
  const raw = await ctx.readBody(req, 32 * 1024);
  const body = parseJsonBody(raw);
  const result = await withLock(async () => {
    const staging = await readStaging();
    const imp = staging.imports[id];
    if (!imp) throw httpError(404, `staged import not found: ${id}`);
    if (imp.source_validation.status !== 'PASSED') {
      throw httpError(409, 'This staged import failed source validation and cannot become the Research source.', {
        source_validation: imp.source_validation,
      });
    }
    if (imp.promoted) {
      const current = await readState();
      if (current.import && current.import.staging_id === id) {
        return { status: 200, payload: { promoted: true, reused: true, import: stagingSummary(imp), state: viewState(current) } };
      }
      throw httpError(409, `Staged import ${id} was already promoted; it cannot replace the current Research source again.`);
    }

    const built = imp.dataset;
    const fresh = baseState();
    fresh.cycle = 1;
    fresh.synthetic = imp.synthetic;
    fresh.data_mode = 'STAGED_IMPORT';
    fresh.import = {
      id: `IMP-${staging.order.length}`,
      staging_id: imp.id,
      file: imp.file,
      format: imp.format,
      label: imp.synthetic ? `SYNTHETIC fixture upload: ${imp.file}` : `User-supplied Shopee Affiliate export: ${imp.file}`,
      sha256: imp.file_hash,
      file_hash: imp.file_hash,
      source_type: imp.source_type,
      row_count: imp.counts.imported,
      checked_at: imp.checked_at,
      imported_at: nowIso(),
      data_as_of: imp.data_as_of,
      expires_at: imp.expires_at,
      date_range: imp.date_range,
      account: imp.account,
      mapping_hash: imp.mapping_hash,
      mapping_columns: imp.mapping_columns,
      synthetic: imp.synthetic,
      verified_against_shopee: false,
      source_validation: imp.source_validation,
      provenance: {
        method: imp.format === 'xlsx' ? 'XLSX_IMPORT' : imp.format === 'json' ? 'JSON_IMPORT' : 'CSV_IMPORT',
        source: imp.synthetic ? 'SHOPEE_AFFILIATE_EXPORT_FIXTURE' : 'USER_SUPPLIED_SHOPEE_AFFILIATE_EXPORT',
        limitations: [
          imp.synthetic ? 'Synthetic fixture input; not a live Shopee export.' : 'User-supplied export; not independently verified against Shopee.',
          'Import is a point-in-time snapshot; re-check before use.',
        ],
      },
    };
    fresh.sources = Object.fromEntries(built.sources.map((item) => [item.id, item]));
    fresh.products = Object.fromEntries(built.products.map((item) => [item.id, item]));
    fresh.offers = Object.fromEntries(built.offers.map((item) => [item.id, item]));
    fresh.evidence = Object.fromEntries(built.evidence.map((item) => [item.id, item]));
    fresh.analysis = {
      method: built.analysis.method,
      generated_at: nowIso(),
      fixture_only: imp.synthetic,
      synthetic_only: imp.synthetic,
      data_as_of: built.analysis.data_as_of,
      expires_at: built.analysis.expires_at,
      categories: Object.entries(built.analysis.categoryStats).map(([category, stats]) => ({ category, ...stats })),
      offer_metrics: built.offers.map((offer) => ({
        offer_id: offer.id,
        category: built.products.find((product) => product.id === offer.product_id)?.category,
        price_thb: offer.price_thb,
        commission_per_order_thb: offer.commission_per_order_thb,
        promo_depth_pct: offer.promo.depth_pct,
        review_signal: offer.metrics.review_signal,
        competition_level: offer.metrics.competition_level,
      })),
      dataset_unknowns: [
        'Click-through rate per listing',
        'Order conversion rate per listing',
        'Live price, stock and promotion validity',
        'Commission approval and payout timing',
        'Audience size and cost per view',
      ],
    };
    // Generate before any write so a guard failure (expired source, failed
    // validation) leaves both the staging record and Research state untouched.
    let generated = null;
    if (body.generateCandidates === true) {
      generated = generateCandidates(fresh, { acknowledgeExpired: body.acknowledgeExpired === true });
    }
    await writeState(fresh);

    imp.promoted = true;
    imp.promoted_at = nowIso();
    await writeStaging(staging);
    return {
      status: 201,
      payload: {
        promoted: true,
        import: stagingSummary(imp),
        records: {
          sources: built.sources.length,
          products: built.products.length,
          offers: built.offers.length,
          evidence: built.evidence.length,
        },
        candidates: generated ? generated.candidates : null,
        source_warnings: fresh.lastGeneration ? fresh.lastGeneration.source_warnings : [],
        writes: 'MVP research state only',
        state: viewState(fresh),
      },
    };
  });
  ctx.sendJson(res, result.status, result.payload);
}

/* ------------------------------------------------------------------ */
/* Source library                                                      */
/* ------------------------------------------------------------------ */

async function handleArchiveSource(req, res, ctx, sourceId) {
  const raw = await ctx.readBody(req, 32 * 1024);
  const body = parseJsonBody(raw);
  if (body.confirm !== true) throw httpError(400, 'Archiving a source requires confirm: true');
  const reason = body.reason === undefined || body.reason === null || body.reason === ''
    ? 'Archived by the user'
    : requireString(body.reason, 'reason', { max: 300 });

  const result = await withLock(async () => {
    const state = await readState();
    const source = state.sources[sourceId];
    if (!source) throw httpError(404, `source not found: ${sourceId}`);
    const evidenceUsed = Object.values(state.evidence).filter((record) => (record.source_ids || []).includes(sourceId));
    const linkedCandidates = sourceCandidateLinks(state, sourceId);
    if (source.status === 'ARCHIVED') {
      return {
        status: 200,
        payload: { source: sourceLibrary(state).find((entry) => entry.id === sourceId), reused: true, evidence_preserved: evidenceUsed.length, candidates_preserved: linkedCandidates },
      };
    }
    source.status = 'ARCHIVED';
    source.archived_at = nowIso();
    source.archive_reason = reason;
    const entry = {
      source_id: sourceId,
      at: source.archived_at,
      reason,
      evidence_preserved: evidenceUsed.length,
      candidates_preserved: linkedCandidates.map((candidate) => candidate.id),
    };
    state.sourceArchiveLog.push(entry);
    await writeState(state);
    return {
      status: 200,
      payload: {
        source: sourceLibrary(state).find((item) => item.id === sourceId),
        archive: entry,
        reused: false,
        evidence_preserved: evidenceUsed.length,
        candidates_preserved: linkedCandidates,
        generation_blocked: true,
        note: 'Evidence records and existing candidates were kept unchanged. New candidate generation is blocked while this source is archived.',
        state: viewState(state),
      },
    };
  });
  ctx.sendJson(res, result.status, result.payload);
}

async function handleValidateSource(req, res, ctx, sourceId) {
  const raw = await ctx.readBody(req, 16 * 1024);
  parseJsonBody(raw);
  const result = await withLock(async () => {
    const state = await readState();
    if (!state.sources[sourceId]) throw httpError(404, `source not found: ${sourceId}`);
    const validation = validateSourceRecord(state, sourceId);
    state.sources[sourceId].validation = validation;
    await writeState(state);
    return {
      status: 200,
      payload: {
        source: sourceLibrary(state).find((entry) => entry.id === sourceId),
        validation,
        generation_allowed: validation.status === 'PASSED' && state.sources[sourceId].status !== 'ARCHIVED',
        state: viewState(state),
      },
    };
  });
  ctx.sendJson(res, result.status, result.payload);
}

function researchReport(state) {
  const library = sourceLibrary(state);
  return {
    generated_at: nowIso(),
    data_mode: state.data_mode || 'FIXTURE',
    synthetic: state.synthetic !== false,
    import: state.import,
    summary: {
      sources: library.length,
      active: library.filter((source) => source.status !== 'ARCHIVED').length,
      archived: library.filter((source) => source.status === 'ARCHIVED').length,
      candidates: state.candidateOrder.length,
    },
    warnings: freshnessWarnings(state),
    sources: library.map((source) => ({
      id: source.id,
      kind: source.kind,
      label: source.label,
      status: source.status,
      synthetic: source.synthetic,
      source_type: source.source_type,
      checked_at: source.checked_at,
      file_hash: source.file_hash,
      data_as_of: source.data_as_of,
      freshness: source.freshness,
      validation: source.validation,
      record_counts: source.record_counts,
      linked_candidates: source.linked_candidates,
      evidence_ids: Object.values(state.evidence)
        .filter((record) => (record.source_ids || []).includes(source.id))
        .map((record) => record.id),
    })),
    boundaries: {
      writes: 'none — report is computed from the current research state',
      external_calls: 0,
      spend_thb: 0,
    },
  };
}

async function handleResearchReport(req, res, ctx) {
  const state = await readState();
  ctx.sendJson(res, 200, researchReport(state));
}

/* ------------------------------------------------------------------ */
/* Content creation                                                    */
/* ------------------------------------------------------------------ */

function findContent(state, id) {
  const project = state.contents[id];
  if (!project) throw httpError(404, `content project not found: ${id}`);
  return project;
}

function contentContext(state, project) {
  const candidate = state.candidates[project.candidate_id];
  const offer = state.offers[project.offer_id];
  const product = state.products[project.product_id];
  if (!candidate || !offer || !product) {
    throw httpError(409, 'the source records for this content project are missing');
  }
  const sourceId = (offer.source_ids || [])[0];
  const source = sourceId ? state.sources[sourceId] : null;
  const siblingProducts = Object.values(state.products)
    .filter((item) => (item.source_ids || []).some((id) => (offer.source_ids || []).includes(id)));
  return {
    candidate,
    offer,
    product,
    siblingProducts,
    sourceFreshness: source ? sourceFreshness(source) : null,
    dataAsOf: source ? (source.data_as_of || source.checked_at || null) : null,
  };
}

function contentView(state, project) {
  return {
    ...project,
    assets: Object.fromEntries((project.asset_order || []).map((id) => {
      const asset = project.assets[id];
      return [id, { ...asset, file: undefined }];
    })),
  };
}

async function handleContentDraft(req, res, ctx) {
  const raw = await ctx.readBody(req, 64 * 1024);
  const body = parseJsonBody(raw);
  const approachKey = typeof body.approach === 'string' ? body.approach.trim().toLowerCase() : '';
  const result = await withLock(async () => {
    const state = await readState();
    let plan = null;
    let candidate = null;
    if (body.planId) {
      const planId = requireString(body.planId, 'planId');
      plan = state.plans[planId]
        || Object.values(state.plans).find((item) => item.plan_id === planId)
        || null;
      if (!plan) throw httpError(404, `plan not found: ${planId}`);
      candidate = state.candidates[plan.candidate_id];
    } else if (body.candidateId) {
      const candidateId = requireString(body.candidateId, 'candidateId');
      candidate = state.candidates[candidateId];
      if (!candidate) throw httpError(404, `candidate not found: ${candidateId}`);
    } else {
      throw httpError(400, 'planId or candidateId is required');
    }
    if (!candidate) throw httpError(409, 'the plan does not point at a candidate');
    if (candidate.status !== 'SAVED' && candidate.status !== 'QUEUED' && !plan) {
      throw httpError(409, `save or queue the candidate before creating content (current status ${candidate.status})`);
    }

    const offer = state.offers[candidate.offer_id];
    const product = state.products[candidate.product_id];
    if (!offer || !product) throw httpError(409, 'the offer or product record is missing');

    const custom = body.custom ? contentModule.buildCustomApproach(body.custom) : null;
    const validKeys = ['problem_first', 'value_compare', 'evidence_first', 'user_custom'];
    if (approachKey && !validKeys.includes(approachKey)) {
      throw httpError(400, `approach must be one of ${validKeys.join(', ')}`);
    }
    if (approachKey === 'user_custom' && !custom) {
      throw httpError(400, 'the user_custom approach needs a custom description');
    }

    const context = contentContext(state, {
      candidate_id: candidate.id,
      offer_id: offer.id,
      product_id: product.id,
    });
    const project = contentModule.createContentProject({
      state,
      candidate,
      offer,
      product,
      plan,
      approachKey: approachKey || 'problem_first',
      custom,
      dataAsOf: context.dataAsOf,
    });
    state.contents[project.content_id] = project;
    state.contentOrder.push(project.content_id);
    await writeState(state);
    return {
      project: contentView(state, project),
      approaches: project.approaches,
      boundary: {
        writes: 'MVP fixture state only',
        real_state_touched: false,
        external_calls: 0,
        spend_thb: 0,
      },
      state: viewState(state),
    };
  });
  ctx.sendJson(res, 201, result);
}

async function handleContentApproach(req, res, ctx, contentId) {
  const raw = await ctx.readBody(req, 64 * 1024);
  const body = parseJsonBody(raw);
  const approachKey = requireString(body.approach, 'approach', { max: 40 }).toLowerCase();
  const result = await withLock(async () => {
    const state = await readState();
    const project = findContent(state, contentId);
    if (project.status !== 'DRAFT' && project.status !== 'REVIEW') {
      throw httpError(409, `the approach can only change while the project is DRAFT or REVIEW (current status ${project.status})`);
    }
    const context = contentContext(state, project);
    const generated = contentModule.buildContentApproaches(context.candidate, context.offer, context.product);
    let selected = generated.find((item) => item.key === approachKey);
    if (approachKey === 'user_custom') {
      if (body.custom) {
        project.approaches.user_custom = contentModule.buildCustomApproach(body.custom);
      }
      selected = project.approaches.user_custom;
      if (!selected) throw httpError(400, 'the user_custom approach needs a custom description first');
    }
    if (!selected) throw httpError(400, `unknown approach ${approachKey}`);

    project.approach = selected.key;
    project.approaches.generated = generated;
    project.storyboard = contentModule.buildStoryboard(selected, context.offer, context.product, context.candidate, {
      dataAsOf: context.dataAsOf,
    });
    project.cta.text = selected.cta || project.cta.text;
    project.script_version += 1;
    project.script = contentModule.buildScript(project);
    project.script_version_history.push({
      version: project.script_version,
      at: nowIso(),
      reason: `เปลี่ยนแนวทางเป็น ${selected.key}`,
      checksum: project.script.checksum,
    });
    project.preview = contentModule.buildPreview(project);
    project.qa = null;
    project.updated_at = nowIso();
    project.edit_log.push({ at: project.updated_at, track: null, scene_id: null, change: `เปลี่ยนแนวทางเป็น ${selected.key}` });
    await writeState(state);
    return { project: contentView(state, project), state: viewState(state) };
  });
  ctx.sendJson(res, 200, result);
}

async function handleContentTrack(req, res, ctx, contentId, track) {
  const raw = await ctx.readBody(req, 64 * 1024);
  const body = parseJsonBody(raw);
  const result = await withLock(async () => {
    const state = await readState();
    const project = findContent(state, contentId);
    if (project.status === 'EXPORTED' || project.status === 'READY_TO_PUBLISH') {
      throw httpError(409, `the content is already ${project.status} and can no longer be edited`);
    }
    const sceneId = requireString(body.sceneId, 'sceneId', { max: 40 });
    if (track === 'visual') contentModule.applyVisualEdit(project, body);
    else if (track === 'text') contentModule.applyTextEdit(project, body);
    else contentModule.applyAudioEdit(project, body);
    project.preview = contentModule.buildPreview(project);
    project.qa = null;
    await writeState(state);
    return { project: contentView(state, project), state: viewState(state) };
  });
  ctx.sendJson(res, 200, result);
}

async function handleContentScenes(req, res, ctx, contentId, action, sceneId) {
  const raw = action === 'reorder' || action === 'add' ? await ctx.readBody(req, 64 * 1024) : '';
  const body = action === 'reorder' || action === 'add' ? parseJsonBody(raw) : {};
  const result = await withLock(async () => {
    const state = await readState();
    const project = findContent(state, contentId);
    if (project.status === 'EXPORTED' || project.status === 'READY_TO_PUBLISH') {
      throw httpError(409, `the content is already ${project.status} and can no longer be edited`);
    }
    if (action === 'add') contentModule.addScene(project, body);
    else if (action === 'remove') contentModule.removeScene(project, sceneId);
    else contentModule.reorderScenes(project, body.order);
    project.preview = contentModule.buildPreview(project);
    project.qa = null;
    await writeState(state);
    return { project: contentView(state, project), state: viewState(state) };
  });
  ctx.sendJson(res, 200, result);
}

async function handleContentAssets(req, res, ctx, contentId) {
  const raw = await ctx.readBody(req, 32 * 1024 * 1024);
  const body = parseJsonBody(raw);
  const result = await withLock(async () => {
    const state = await readState();
    const project = findContent(state, contentId);
    if (project.status === 'EXPORTED' || project.status === 'READY_TO_PUBLISH') {
      throw httpError(409, `the content is already ${project.status} and can no longer be edited`);
    }
    const asset = await contentModule.addAsset(project, ASSETS_DIR, body);
    await writeState(state);
    return { asset, project: contentView(state, project), state: viewState(state) };
  });
  ctx.sendJson(res, 201, result);
}

async function handleContentQa(req, res, ctx, contentId) {
  const result = await withLock(async () => {
    const state = await readState();
    const project = findContent(state, contentId);
    const context = contentContext(state, project);
    const report = contentModule.runProjectQa(project, context);
    project.preview = contentModule.buildPreview(project);
    await writeState(state);
    return { qa: report, project: contentView(state, project), state: viewState(state) };
  });
  ctx.sendJson(res, 200, result);
}

async function handleContentReview(req, res, ctx, contentId) {
  const result = await withLock(async () => {
    const state = await readState();
    const project = findContent(state, contentId);
    contentModule.assertTransition(project.status, 'REVIEW');
    project.status = 'REVIEW';
    project.updated_at = nowIso();
    project.edit_log.push({ at: project.updated_at, track: null, scene_id: null, change: 'ส่งเข้าการตรวจ' });
    await writeState(state);
    return { project: contentView(state, project), state: viewState(state) };
  });
  ctx.sendJson(res, 200, result);
}

async function handleContentFinalize(req, res, ctx, contentId) {
  const result = await withLock(async () => {
    const state = await readState();
    const project = findContent(state, contentId);
    if (project.status !== 'REVIEW') {
      throw httpError(409, `finalize requires a REVIEW project (current status ${project.status})`);
    }
    const context = contentContext(state, project);
    const report = contentModule.runProjectQa(project, context);
    project.preview = contentModule.buildPreview(project);
    contentModule.finalizeProject(project, report);
    await writeState(state);
    return {
      project: contentView(state, project),
      checklist: project.finalize.checklist,
      state: viewState(state),
    };
  });
  ctx.sendJson(res, 200, result);
}

async function handleContentLibraryItem(req, res, ctx, libraryId) {
  // G-13 retrieval: the library record plus live integrity evidence for the
  // exported asset it refers to. A record is never reported as verified when
  // the file is missing or its actual bytes do not match the stored hash.
  const entry = await contentModule.getLibraryItem(libraryId);
  if (!entry) throw httpError(404, `content library item not found: ${libraryId}`);
  const exportsRoot = path.resolve(EXPORTS_DIR);
  const file = path.resolve(exportsRoot, entry.id, entry.filename);
  if (!file.startsWith(`${exportsRoot}${path.sep}`)) {
    throw httpError(403, 'refusing to serve a file outside the exports directory');
  }
  let exists = false;
  let bytes = null;
  let actualSha256 = null;
  try {
    const data = await fsp.readFile(file);
    exists = true;
    bytes = data.length;
    actualSha256 = crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    exists = false;
  }
  const sha256Match = exists ? actualSha256 === entry.sha256 : null;
  ctx.sendJson(res, 200, {
    id: entry.id,
    entry,
    file: {
      path: file,
      exists,
      bytes,
      sha256: actualSha256,
      sha256_match: sha256Match,
      integrity: exists ? (sha256Match ? 'VERIFIED' : 'MISMATCH') : 'MISSING',
    },
  });
}

async function handleContentExport(req, res, ctx, contentId) {
  const result = await withLock(async () => {
    const state = await readState();
    const project = findContent(state, contentId);
    if (project.status !== 'FINALIZED') {
      throw httpError(409, `export requires a FINALIZED project (current status ${project.status})`);
    }
    const exported = await contentModule.exportProject(project, { exportsDir: EXPORTS_DIR });
    await writeState(state);
    return {
      export: exported,
      project: contentView(state, project),
      state: viewState(state),
    };
  });
  ctx.sendJson(res, 200, result);
}

async function handleContentExportFile(req, res, ctx, contentId, kind) {
  const state = await readState();
  const project = findContent(state, contentId);
  const exported = project.export;
  if (!exported) throw httpError(409, 'this content has not been exported yet');
  let file = null;
  let mime = null;
  if (kind === 'still') {
    if (!exported.still) throw httpError(404, 'no still frame was recorded for this export');
    file = exported.still.file;
    mime = 'image/png';
  } else {
    file = exported.file;
    mime = 'video/mp4';
  }
  if (!file) throw httpError(404, 'export file not found');
  // Refuse to serve anything that does not live under the exports directory.
  const resolved = path.resolve(file);
  if (!resolved.startsWith(`${path.resolve(EXPORTS_DIR)}${path.sep}`)) {
    throw httpError(403, 'refusing to serve a file outside the exports directory');
  }
  const data = await fsp.readFile(resolved);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': data.length,
    'Content-Disposition': `inline; filename="${path.basename(resolved)}"`,
  });
  res.end(data);
}

async function handleContentPublishPrep(req, res, ctx, contentId) {
  const result = await withLock(async () => {
    const state = await readState();
    const project = findContent(state, contentId);
    const payload = contentModule.buildPublishPrep(project);
    await writeState(state);
    return {
      publish_prep: payload,
      project: contentView(state, project),
      state: viewState(state),
    };
  });
  ctx.sendJson(res, 200, result);
}

async function handleContentGenerate(req, res, ctx) {
  const result = await withLock(async () => {
    const state = await readState();
    const raw = await ctx.readBody(req, 32 * 1024);
    const body = parseJsonBody(raw);
    const { candidate_id, approach_key } = body;
    if (!candidate_id) {
      throw httpError(400, 'candidate_id is required');
    }
    if (!approach_key) {
      throw httpError(400, 'approach_key is required');
    }
    const candidate = state.candidates[candidate_id];
    if (!candidate) {
      throw httpError(404, `candidate not found: ${candidate_id}`);
    }
    const approachKeys = ['personalized_a', 'personalized_b', 'exploration', 'user_custom'];
    if (!approachKeys.includes(approach_key)) {
      throw httpError(400, `invalid approach_key: ${approach_key}`);
    }
    // T3.4: Plan Key → Content Key boundary mapping (owner-approved semantics:
    // personalized_a=problem-first, personalized_b=value-comparison, exploration=evidence-led).
    const planToContentKey = {
      personalized_a: 'problem_first',
      personalized_b: 'value_compare',
      exploration: 'evidence_first',
    };
    const contentApproachKey = planToContentKey[approach_key] || approach_key;
    const project = contentModule.createContentProject({
      state,
      candidate,
      offer: state.offers[candidate.offer_id],
      product: state.products[candidate.product_id],
      plan: state.plans[candidate.plan_id || ''], // may be empty for fixture-only
      approachKey: contentApproachKey,
      custom: approach_key === 'user_custom' ? null : undefined,
    });
    // Two-phase commit: write artifact file first, then persist state
    const artifactId = `ART-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const exportsDir = EXPORTS_DIR;
    // Ensure exports directory exists
    await fsp.mkdir(exportsDir, { recursive: true });
    // Generate deterministic markdown content from the project
    // T3.3: resolve the selected approach object for the generator contract.
    // If the requested key does not resolve, fail loudly — no invented content.
    const selectedApproach = contentApproachKey === 'user_custom'
      ? project.approaches.user_custom
      : (project.approaches.generated || []).find((a) => a.key === contentApproachKey);
    if (contentApproachKey === 'user_custom' && !selectedApproach) {
      throw httpError(400, 'the user_custom approach needs a custom description first');
    }
    if (!selectedApproach) {
      throw httpError(500, 'resolved approach not found for key: ' + contentApproachKey);
    }
    const markdownContent = generateMarkdownContent({
      candidate,
      product: state.products[candidate.product_id],
      offer: state.offers[candidate.offer_id],
      approach: selectedApproach,
      qa: project.qa,
      storyboard: project.storyboard,
    });
    // Write the artifact file with stable identity
    const fileName = `${artifactId}-script.md`;
    const filePath = path.join(exportsDir, fileName);
    // Two-phase commit: write file first
    try {
      await fsp.writeFile(filePath, markdownContent, 'utf8');
    } catch (writeErr) {
      // Rollback: remove the artifact file when the artifact write fails
      await fsp.unlink(filePath).catch(() => {});
      throw httpError(500, 'failed to write artifact file');
    }
    // Persist state with artifact reference
    project.artifact = {
      artifact_id: artifactId,
      file_path: filePath,
      version: 1,
      generated_at: new Date().toISOString(),
      content: markdownContent,
      product_id: project.product_id,
      provenance: project.provenance,
      claim_map: project.claim_map,
      sha256: crypto.createHash('sha256').update(markdownContent).digest('hex'),
    };
    project.status = 'EXPORTED';
    project.export = {
      filename: fileName,
      bytes: Buffer.from(markdownContent).length,
      sha256: crypto.createHash('sha256').update(markdownContent).digest('hex'),
    };
    // Update content order if new
    if (!state.contentOrder.includes(project.id)) {
      state.contentOrder.push(project.id);
    }
    state.contents[project.id] = project;
    try {
      await writeState(state);
    } catch (stateErr) {
      // T3.7 / Owner decision S(ข): attempt artifact-file cleanup on state-persist
      // failure and report the cleanup outcome honestly — never fake success.
      let cleanup = 'succeeded';
      try {
        await fsp.unlink(filePath);
      } catch (cleanupErr) {
        cleanup = 'failed: ' + cleanupErr.message;
      }
      throw httpError(500, 'failed to persist artifact state', { cleanup });
    }
    return {
      artifact_id: artifactId,
      file_path: filePath,
      version: 1,
      generated_at: project.artifact.generated_at,
      content: markdownContent,
      product_id: project.product_id,
      provenance: project.provenance,
      claim_map: project.claim_map,
      sha256: project.artifact.sha256,
    };
  });
  ctx.sendJson(res, 200, result);
}

async function handleContentExportFileByArtifactId(req, res, ctx) {
  const artifactId = req.params.artifact_id;
  const state = await readState();
  // Search through contents to find the artifact
  let foundProject = null;
  for (const id of state.contentOrder) {
    const project = state.contents[id];
    if (project && project.artifact && project.artifact.artifact_id === artifactId) {
      foundProject = project;
      break;
    }
  }
  if (!foundProject) {
    throw httpError(404, `artifact not found: ${artifactId}`);
  }
  // Read the file and return it
  const filePath = foundProject.artifact.file_path;
  const resolved = path.resolve(filePath);
  // Refuse to serve anything that does not live under the exports directory.
  if (!resolved.startsWith(`${path.resolve(EXPORTS_DIR)}${path.sep}`)) {
    throw httpError(403, 'refusing to serve a file outside the exports directory');
  }
  const data = await fsp.readFile(resolved);
  res.writeHead(200, {
    'Content-Type': 'text/markdown',
    'Content-Length': data.length,
    'Content-Disposition': `attachment; filename="${foundProject.artifact.artifact_id}-script.md"`,
  });
  res.end(data);
}

async function handleMvp(req, res, ctx) {
  const pathname = ctx.pathname;
  const method = req.method;
  try {
    if (pathname === '/api/mvp/meta' && method === 'GET') {
      const sha = await fixtureSha256();
      const raw = await fsp.readFile(FIXTURE_FILE, 'utf8');
      const dataRows = parseExportCsv(raw).length;
      ctx.sendJson(res, 200, {
        fixture: { ...fixtureMeta(), sha256: sha, row_count: dataRows },
        state_file: path.relative(REPO_DIR, stateFilePath()).split(path.sep).join('/'),
        staging_file: path.relative(REPO_DIR, stagingFilePath()).split(path.sep).join('/'),
        synthetic: true,
        pipeline: ['import', 'research', 'candidates', 'workspace', 'plan', 'content'],
        real_export: {
          status: 'PENDING',
          note: 'No real Shopee Affiliate export has been supplied. The parser contract is verified against SYNTHETIC fixtures only; real-file import evidence is not claimed.',
        },
        import_contract: {
          formats: ['csv', 'tsv', 'xlsx', 'json'],
          rejected_formats: [{ format: 'xls', reason: 'legacy BIFF is not supported; re-export as .xlsx or .csv' }],
          encodings: ['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be', 'windows-874'],
          max_file_bytes: importer.MAX_FILE_BYTES,
          max_rows: importer.MAX_ROWS,
          required_fields: [...importer.REQUIRED_FIELDS, 'commission_rate_or_commission_thb'],
          optional_fields: importer.CANONICAL_FIELDS.filter((field) => !field.required).map((field) => field.key),
          duplicate_key: 'file_hash + (item_id|shop_id)',
          staging_only: true,
          preview_writes: false,
          freshness: { aging_days: AGING_DAYS, expires_days: FRESHNESS_DAYS },
        },
        boundaries: [
          'No Shopee account, API or external service is contacted; uploads are parsed locally.',
          'Uploads are staged first and only become Research after an explicit promote step.',
          'Fixture/MVP state only; data/app/state.json is never read or written by this module.',
          'Content creation stops at a publish-preparation payload: nothing is published, scheduled or sent to a seller account.',
          'No external account is connected and spend stays THB 0.',
        ],
        content_slice: {
          statuses: contentModule.STATUSES,
          tracks: contentModule.TRACKS,
          qa_categories: ['spelling', 'price', 'promotion', 'product_name', 'cta', 'evidence', 'external'],
          export: 'local ffmpeg, 1080x1920 H.264 MP4 (9:16) with a libass/ASS Thai text track and a silent AAC bed',
          remotion: 'not required — the local pipeline produces the 9:16 file without a browser render',
        },
        acceptance: {
          AC_01: 'NOT CLAIMED — this slice does not produce Mission 1 evidence records',
          SCOPE_1: 'NOT CLAIMED — no pre-G1 boundary verdict is asserted',
          mission_1: 'NOT COMPLETE',
        },
        endpoints: [
          'GET /api/mvp/meta',
          'POST /api/mvp/import',
          'POST /api/mvp/import/preview',
          'POST /api/mvp/import/commit',
          'GET /api/mvp/staging',
          'GET /api/mvp/staging/:id',
          'POST /api/mvp/staging/:id/research',
          'GET /api/mvp/state',
          'GET /api/mvp/research-report',
          'POST /api/mvp/sources/:id/archive',
          'POST /api/mvp/sources/:id/validate',
          'POST /api/mvp/candidates/generate',
          'GET /api/mvp/candidates',
          'POST /api/mvp/candidates/:id/action',
          'POST /api/mvp/queue/reorder',
          'POST /api/mvp/plan/draft',
          'POST /api/mvp/plan/custom',
          'POST /api/mvp/plan',
          'GET /api/mvp/content',
          'GET /api/mvp/content/:id',
          'POST /api/mvp/content/draft',
          'POST /api/mvp/content/:id/approach',
          'POST /api/mvp/content/:id/track/visual',
          'POST /api/mvp/content/:id/track/text',
          'POST /api/mvp/content/:id/track/audio',
          'POST /api/mvp/content/:id/scenes',
          'POST /api/mvp/content/:id/scenes/reorder',
          'DELETE /api/mvp/content/:id/scenes/:sceneId',
          'POST /api/mvp/content/:id/assets',
          'POST /api/mvp/content/:id/qa',
          'POST /api/mvp/content/:id/review',
          'POST /api/mvp/content/:id/finalize',
          'POST /api/mvp/content/:id/export',
          'GET /api/mvp/content/:id/export/video',
          'GET /api/mvp/content/:id/export/still',
          'POST /api/mvp/content/generate',
          'GET /api/mvp/content/export/:artifact_id',          'POST /api/mvp/content/:id/publish-prep',
          'GET /api/mvp/library/:id',
        ],
      });
      return true;
    }

    if (pathname === '/api/mvp/import' && method === 'POST') {
      await handleImport(req, res, ctx);
      return true;
    }

    if (pathname === '/api/mvp/import/preview' && method === 'POST') {
      await handleImportPreview(req, res, ctx);
      return true;
    }

    if (pathname === '/api/mvp/import/commit' && method === 'POST') {
      await handleImportCommit(req, res, ctx);
      return true;
    }

    if (pathname === '/api/mvp/staging' && method === 'GET') {
      await handleStagingList(req, res, ctx);
      return true;
    }

    const stagingMatch = pathname.match(/^\/api\/mvp\/staging\/([^/]+)$/);
    if (stagingMatch && method === 'GET') {
      await handleStagingDetail(req, res, ctx, decodeURIComponent(stagingMatch[1]));
      return true;
    }

    const promoteMatch = pathname.match(/^\/api\/mvp\/staging\/([^/]+)\/research$/);
    if (promoteMatch && method === 'POST') {
      await handlePromoteStaging(req, res, ctx, decodeURIComponent(promoteMatch[1]));
      return true;
    }

    if (pathname === '/api/mvp/research-report' && method === 'GET') {
      await handleResearchReport(req, res, ctx);
      return true;
    }

    const archiveMatch = pathname.match(/^\/api\/mvp\/sources\/([^/]+)\/archive$/);
    if (archiveMatch && method === 'POST') {
      await handleArchiveSource(req, res, ctx, decodeURIComponent(archiveMatch[1]));
      return true;
    }

    const validateMatch = pathname.match(/^\/api\/mvp\/sources\/([^/]+)\/validate$/);
    if (validateMatch && method === 'POST') {
      await handleValidateSource(req, res, ctx, decodeURIComponent(validateMatch[1]));
      return true;
    }

    if (pathname === '/api/mvp/state' && method === 'GET') {
      const state = await readState();
      ctx.sendJson(res, 200, viewState(state));
      return true;
    }

    if (pathname === '/api/mvp/candidates' && method === 'GET') {
      const state = await readState();
      ctx.sendJson(res, 200, {
        candidates: state.candidateOrder.map((id) => state.candidates[id]).filter(Boolean),
        queue: state.queue,
      });
      return true;
    }

    if (pathname === '/api/mvp/candidates/generate' && method === 'POST') {
      await handleGenerate(req, res, ctx);
      return true;
    }

    if (pathname === '/api/mvp/candidates/select' && method === 'POST') {
      await handleCandidatesSelect(req, res, ctx);
      return true;
    }

    const snapshotMatch = pathname.match(/^\/api\/mvp\/candidates\/([^/]+)\/snapshot$/);
    if (snapshotMatch && method === 'POST') {
      await handleCandidateSnapshot(req, res, ctx, decodeURIComponent(snapshotMatch[1]));
      return true;
    }

    const snapshotRestoreMatch = pathname.match(/^\/api\/mvp\/candidates\/([^/]+)\/snapshots\/([^/]+)\/restore$/);
    if (snapshotRestoreMatch && method === 'POST') {
      await handleCandidateSnapshotRestore(req, res, ctx, decodeURIComponent(snapshotRestoreMatch[1]), decodeURIComponent(snapshotRestoreMatch[2]));
      return true;
    }

    const variantMatch = pathname.match(/^\/api\/mvp\/candidates\/([^/]+)\/variant$/);
    if (variantMatch && method === 'POST') {
      await handleCandidateVariant(req, res, ctx, decodeURIComponent(variantMatch[1]));
      return true;
    }

    const actionMatch = pathname.match(/^\/api\/mvp\/candidates\/([^/]+)\/action$/);
    if (actionMatch && method === 'POST') {
      await handleCandidateAction(req, res, ctx, decodeURIComponent(actionMatch[1]));
      return true;
    }

    const restoreMatch = pathname.match(/^\/api\/mvp\/candidates\/([^/]+)\/restore$/);
    if (restoreMatch && method === 'POST') {
      await handleCandidateRestore(req, res, ctx, decodeURIComponent(restoreMatch[1]));
      return true;
    }

    if (pathname === '/api/mvp/queue/reorder' && method === 'POST') {
      await handleQueueReorder(req, res, ctx);
      return true;
    }

    if (pathname === '/api/mvp/plan/draft' && method === 'POST') {
      await handlePlanDraft(req, res, ctx);
      return true;
    }

    if (pathname === '/api/mvp/plan/custom' && method === 'POST') {
      await handlePlanCustom(req, res, ctx);
      return true;
    }

    if (pathname === '/api/mvp/plan' && method === 'POST') {
      await handlePlanCreate(req, res, ctx);
      return true;
    }

    /* ---- Content creation ---- */

    if (pathname === '/api/mvp/content' && method === 'GET') {
      const state = await readState();
      ctx.sendJson(res, 200, {
        contents: state.contentOrder.map((id) => state.contents[id]).filter(Boolean),
        statuses: contentModule.STATUSES,
      });
      return true;
    }

    if (pathname === '/api/mvp/content/draft' && method === 'POST') {
      await handleContentDraft(req, res, ctx);
      return true;
    }

    const contentMatch = pathname.match(/^\/api\/mvp\/content\/([^/]+)$/);
    if (contentMatch && method === 'GET') {
      const state = await readState();
      const project = findContent(state, decodeURIComponent(contentMatch[1]));
      ctx.sendJson(res, 200, { project: contentView(state, project) });
      return true;
    }

    const contentApproachMatch = pathname.match(/^\/api\/mvp\/content\/([^/]+)\/approach$/);
    if (contentApproachMatch && method === 'POST') {
      await handleContentApproach(req, res, ctx, decodeURIComponent(contentApproachMatch[1]));
      return true;
    }

    const contentTrackMatch = pathname.match(/^\/api\/mvp\/content\/([^/]+)\/track\/(visual|text|audio)$/);
    if (contentTrackMatch && method === 'POST') {
      await handleContentTrack(req, res, ctx, decodeURIComponent(contentTrackMatch[1]), contentTrackMatch[2]);
      return true;
    }

    if (pathname.match(/^\/api\/mvp\/content\/[^/]+\/scenes$/) && method === 'POST') {
      const id = decodeURIComponent(pathname.split('/')[4]);
      await handleContentScenes(req, res, ctx, id, 'add', null);
      return true;
    }

    if (pathname.match(/^\/api\/mvp\/content\/[^/]+\/scenes\/reorder$/) && method === 'POST') {
      const id = decodeURIComponent(pathname.split('/')[4]);
      await handleContentScenes(req, res, ctx, id, 'reorder', null);
      return true;
    }

    const contentSceneMatch = pathname.match(/^\/api\/mvp\/content\/([^/]+)\/scenes\/([^/]+)$/);
    if (contentSceneMatch && method === 'DELETE') {
      await handleContentScenes(req, res, ctx, decodeURIComponent(contentSceneMatch[1]), 'remove', decodeURIComponent(contentSceneMatch[2]));
      return true;
    }

    if (pathname.match(/^\/api\/mvp\/content\/[^/]+\/assets$/) && method === 'POST') {
      const id = decodeURIComponent(pathname.split('/')[4]);
      await handleContentAssets(req, res, ctx, id);
      return true;
    }

    if (pathname.match(/^\/api\/mvp\/content\/[^/]+\/qa$/) && method === 'POST') {
      const id = decodeURIComponent(pathname.split('/')[4]);
      await handleContentQa(req, res, ctx, id);
      return true;
    }

    if (pathname.match(/^\/api\/mvp\/content\/[^/]+\/review$/) && method === 'POST') {
      const id = decodeURIComponent(pathname.split('/')[4]);
      await handleContentReview(req, res, ctx, id);
      return true;
    }

    if (pathname.match(/^\/api\/mvp\/content\/[^/]+\/finalize$/) && method === 'POST') {
      const id = decodeURIComponent(pathname.split('/')[4]);
      await handleContentFinalize(req, res, ctx, id);
      return true;
    }

    if (pathname.match(/^\/api\/mvp\/content\/[^/]+\/export$/) && method === 'POST') {
      const id = decodeURIComponent(pathname.split('/')[4]);
      await handleContentExport(req, res, ctx, id);
      return true;
    }

    if (pathname === '/api/mvp/content/generate' && method === 'POST') {
      await handleContentGenerate(req, res, ctx);
      return true;
    }

    const libraryItemMatch = pathname.match(/^\/api\/mvp\/library\/([^/]+)$/);
    if (libraryItemMatch && method === 'GET') {
      let libraryItemRef;
      try {
        libraryItemRef = decodeURIComponent(libraryItemMatch[1]);
      } catch (decodeErr) {
        if (!(decodeErr instanceof URIError)) throw decodeErr;
        throw httpError(400, 'invalid content library id encoding');
      }
      await handleContentLibraryItem(req, res, ctx, libraryItemRef);
      return true;
    }

    const artifactExportMatch = pathname.match(/^\/api\/mvp\/content\/export\/([^/]+)$/);
    if (artifactExportMatch && method === 'GET') {
      let artifactExportId;
      try {
        artifactExportId = decodeURIComponent(artifactExportMatch[1]);
      } catch (decodeErr) {
        if (!(decodeErr instanceof URIError)) throw decodeErr;
        throw httpError(400, 'invalid artifact id encoding');
      }
      req.params = { artifact_id: artifactExportId };
      await handleContentExportFileByArtifactId(req, res, ctx);
      return true;
    }

    if (pathname.match(/^\/api\/mvp\/content\/[^/]+\/publish-prep$/) && method === 'POST') {
      const id = decodeURIComponent(pathname.split('/')[4]);
      await handleContentPublishPrep(req, res, ctx, id);
      return true;
    }

    const contentExportFileMatch = pathname.match(/^\/api\/mvp\/content\/([^/]+)\/export\/(video|still)$/);
    if (contentExportFileMatch && method === 'GET') {
      await handleContentExportFile(req, res, ctx, decodeURIComponent(contentExportFileMatch[1]), contentExportFileMatch[2]);
      return true;
    }

    const known = new Set([
      '/api/mvp/meta', '/api/mvp/import', '/api/mvp/import/preview', '/api/mvp/import/commit',
      '/api/mvp/staging', '/api/mvp/research-report', '/api/mvp/state', '/api/mvp/candidates',
      '/api/mvp/candidates/generate', '/api/mvp/queue/reorder', '/api/mvp/plan/draft',
      '/api/mvp/plan/custom', '/api/mvp/plan', '/api/mvp/content', '/api/mvp/content/draft',
    ]);
    if (known.has(pathname) || actionMatch || stagingMatch || promoteMatch || archiveMatch
      || validateMatch || contentMatch || contentApproachMatch || contentTrackMatch
      || contentSceneMatch || contentExportFileMatch || libraryItemMatch) {
      ctx.sendJson(res, 405, { error: 'Method not allowed' });
      return true;
    }
    ctx.sendJson(res, 404, { error: 'Unknown MVP API route' });
    return true;
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    if (status >= 500) console.error('[ace-mvp] request failed:', err);
    if (!res.headersSent) {
      const payload = { error: status === 500 ? 'Internal error' : err.message };
      if (err.details) payload.details = err.details;
      if (err.impact_preview) payload.impact_preview = err.impact_preview;
      ctx.sendJson(res, status, payload);
    } else {
      res.end();
    }
    return true;
  }
}

module.exports = {
  handleMvp,
  stateFilePath,
  stagingFilePath,
  assetsDir: () => ASSETS_DIR,
  exportsDir: () => EXPORTS_DIR,
  FIXTURE_FILE,
  // exported for tests
  parseExportCsv,
  buildDataset,
  generateCandidates,
  validateSourceRecord,
  sourceFreshness,
  sourceLibrary,
  researchReport,
  SCORE_WEIGHTS,
};
