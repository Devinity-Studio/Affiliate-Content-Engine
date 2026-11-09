'use strict';

/**
 * ACE A1 — publication store and preview access gate.
 *
 * This module owns a small store that is deliberately separate from the MVP
 * content lifecycle in app/mvp/service.js. A content record moves through
 * DRAFT → REVIEW → FINALIZED → EXPORTED → READY_TO_PUBLISH; none of those states
 * means "published". A publication record is a separate, explicit decision with
 * only two states in A1:
 *
 *   DRAFT   — created, not viewable
 *   PREVIEW — viewable on loopback with the preview token
 *
 * There is no PUBLISHED state in A1, so no code path here can make an article
 * publicly reachable. This module never writes to the MVP state file; it only
 * reads it.
 */

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');

const SCHEMA_VERSION = 1;
const STATES = Object.freeze(['DRAFT', 'PREVIEW']);
const SITE_ENVS = Object.freeze(['local']);

const CONTENT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const REPO_DIR = path.join(__dirname, '..', '..');

function fromCwd(value) {
  return path.resolve(process.cwd(), value);
}

function mvpStateFile() {
  const override = process.env.ACE_MVP_STATE_FILE;
  return override ? fromCwd(override) : path.join(REPO_DIR, 'data', 'mvp', 'fixture-state.json');
}

function publicationsFile() {
  const override = process.env.ACE_SITE_PUBLICATIONS_FILE;
  return override ? fromCwd(override) : path.join(REPO_DIR, 'data', 'site', 'publications.json');
}

function storeError(message) {
  const err = new Error(message);
  err.code = 'SITE_STORE_INVALID';
  return err;
}

function emptyStore() {
  return { schemaVersion: SCHEMA_VERSION, publications: {} };
}

async function readJsonFile(file, label) {
  let raw;
  try {
    raw = await fsp.readFile(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A malformed store is refused, never overwritten.
    throw storeError(`${label} is not valid JSON: ${file}`);
  }
  return parsed;
}

async function loadStore(file = publicationsFile()) {
  const parsed = await readJsonFile(file, 'publications store');
  if (!parsed) return emptyStore();
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw storeError(`publications store has an unexpected shape: ${file}`);
  }
  if (!parsed.publications || typeof parsed.publications !== 'object' || Array.isArray(parsed.publications)) {
    throw storeError(`publications store is missing its "publications" map: ${file}`);
  }
  return { schemaVersion: parsed.schemaVersion || SCHEMA_VERSION, publications: parsed.publications };
}

async function saveStore(store, file = publicationsFile()) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    publications: store.publications || {},
  };
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fsp.rename(tmp, file);
}

function slugifySegment(value) {
  return String(value === undefined || value === null ? '' : value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Deterministic slug: "<product>-<content id>", e.g. "cat-food-1-5kg-cnt-1".
 * ASCII only, so the URL never depends on transliteration.
 */
function buildSlug(productName, contentId) {
  const base = slugifySegment(productName).slice(0, 60) || 'review';
  const suffix = slugifySegment(contentId);
  const slug = suffix ? `${base}-${suffix}` : base;
  if (!SLUG_RE.test(slug)) throw storeError(`cannot build a valid slug from "${productName}" / "${contentId}"`);
  return slug;
}

function validatePublication(record) {
  const errors = [];
  if (!record || typeof record !== 'object') return ['publication must be an object'];
  if (typeof record.pub_id !== 'string' || !record.pub_id) errors.push('pub_id is required');
  if (typeof record.content_id !== 'string' || !CONTENT_ID_RE.test(record.content_id)) {
    errors.push('content_id must be a simple identifier');
  }
  if (typeof record.slug !== 'string' || !SLUG_RE.test(record.slug)) errors.push('slug must be a lowercase kebab-case slug');
  if (!STATES.includes(record.state)) errors.push(`state must be one of ${STATES.join(', ')}`);
  if (!SITE_ENVS.includes(record.env)) errors.push(`env must be one of ${SITE_ENVS.join(', ')}`);
  if (!record.meta || typeof record.meta.title !== 'string' || !record.meta.title.trim()) {
    errors.push('meta.title is required');
  }
  return errors;
}

function buildPublication({ content, productName, state = 'PREVIEW', env = 'local', now = new Date().toISOString() }) {
  const contentId = content && (content.content_id || content.id);
  if (!contentId || !CONTENT_ID_RE.test(contentId)) {
    throw storeError('content record has no usable content_id');
  }
  const slug = buildSlug(productName, contentId);
  const record = {
    pub_id: `PUB-${contentId}`,
    content_id: contentId,
    slug,
    state,
    env,
    created_at: now,
    updated_at: now,
    meta: { title: `รีวิว ${String(productName || '').trim()}`.trim() },
  };
  const errors = validatePublication(record);
  if (errors.length) throw storeError(`publication record is invalid: ${errors.join('; ')}`);
  return record;
}

function listPublications(store) {
  return Object.values((store && store.publications) || {});
}

function findBySlug(store, slug) {
  if (typeof slug !== 'string' || !slug) return null;
  return listPublications(store).find((record) => record && record.slug === slug) || null;
}

function findByContentId(store, contentId) {
  if (typeof contentId !== 'string' || !contentId) return null;
  return listPublications(store).find((record) => record && record.content_id === contentId) || null;
}

/** A1 visibility rule: loopback preview only. DRAFT is never served. */
function isViewable(record) {
  return Boolean(record) && record.state === 'PREVIEW' && record.env === 'local';
}

function isLoopbackRequest(req) {
  const address = req && req.socket ? req.socket.remoteAddress : '';
  return LOOPBACK_ADDRESSES.has(String(address || ''));
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

/**
 * Constant-time comparison over fixed-length digests, so a wrong-length token
 * cannot throw and the comparison time does not depend on the secret.
 */
function tokensMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (!provided || !expected) return false;
  return crypto.timingSafeEqual(digest(provided), digest(expected));
}

function bearerToken(req) {
  const header = req && req.headers ? req.headers.authorization : '';
  if (typeof header !== 'string') return '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : '';
}

/**
 * Fail closed: off-loopback is 403, but any token problem is indistinguishable
 * from "no such article" (404) so the response never confirms a record exists.
 */
function checkPreviewAccess(req) {
  if (!isLoopbackRequest(req)) return { ok: false, status: 403, reason: 'LOOPBACK_ONLY' };
  const expected = process.env.ACE_PREVIEW_TOKEN;
  if (!expected) return { ok: false, status: 404, reason: 'PREVIEW_TOKEN_UNSET' };
  if (!tokensMatch(bearerToken(req), expected)) return { ok: false, status: 404, reason: 'PREVIEW_TOKEN_INVALID' };
  return { ok: true };
}

function coerceContents(state) {
  const contents = state ? state.contents : null;
  if (!contents) return new Map();
  if (Array.isArray(contents)) {
    return new Map(contents.filter(Boolean).map((record) => [record.content_id || record.id, record]));
  }
  if (typeof contents === 'object') return new Map(Object.entries(contents));
  return new Map();
}

function resolveOffer(state, offerId) {
  const offers = state ? state.offers : null;
  if (!offers || !offerId) return null;
  if (Array.isArray(offers)) {
    return offers.find((offer) => offer && (offer.offer_id === offerId || offer.id === offerId)) || null;
  }
  if (typeof offers === 'object') {
    if (offers[offerId]) return offers[offerId];
    return Object.values(offers).find((offer) => offer && (offer.offer_id === offerId || offer.id === offerId)) || null;
  }
  return null;
}

function resolveEvidenceMap(state) {
  const evidence = state ? state.evidence : null;
  if (!evidence) return new Map();
  if (Array.isArray(evidence)) {
    return new Map(evidence.filter(Boolean).map((entry) => [entry.id || entry.evidence_id, entry]));
  }
  if (typeof evidence === 'object') return new Map(Object.entries(evidence));
  return new Map();
}

async function loadMvpState(file = mvpStateFile()) {
  const parsed = await readJsonFile(file, 'MVP state file');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw storeError(`MVP state file has an unexpected shape: ${file}`);
  }
  return parsed;
}

/**
 * Read-only load of everything the article needs. Never mutates the MVP state.
 */
async function loadArticleSource(contentId, file = mvpStateFile()) {
  if (typeof contentId !== 'string' || !CONTENT_ID_RE.test(contentId)) {
    return { ok: false, reason: 'INVALID_CONTENT_ID' };
  }
  const state = await loadMvpState(file);
  const content = coerceContents(state).get(contentId);
  if (!content) return { ok: false, reason: 'CONTENT_NOT_FOUND' };
  const offer = resolveOffer(state, content.offer_id || content.offerId);
  return {
    ok: true,
    state,
    content,
    offer,
    evidence: resolveEvidenceMap(state),
    offerSnapshot: content.offer_snapshot || {},
  };
}

module.exports = {
  SCHEMA_VERSION,
  STATES,
  SITE_ENVS,
  CONTENT_ID_RE,
  SLUG_RE,
  mvpStateFile,
  publicationsFile,
  emptyStore,
  loadStore,
  saveStore,
  buildSlug,
  validatePublication,
  buildPublication,
  listPublications,
  findBySlug,
  findByContentId,
  isViewable,
  isLoopbackRequest,
  tokensMatch,
  bearerToken,
  checkPreviewAccess,
  loadMvpState,
  loadArticleSource,
};
