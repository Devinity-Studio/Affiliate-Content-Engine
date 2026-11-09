'use strict';

/**
 * ACE A1 — media resolution for the article prototype.
 *
 * The MVP slice has no route that serves rendered artefacts, so A1 adds one for
 * article images. It is intentionally narrow:
 *
 *   · Only a bare basename is accepted (no separators, no "..", no drive letters).
 *   · Only extensions in the image allowlist are served.
 *   · Only files that the content record itself references are served, so the
 *     route cannot be used to read arbitrary files from the exports directory.
 *   · The resolved path must stay inside the exports directory.
 *
 * Access control (loopback + preview token) is enforced by the caller before
 * this module is reached.
 */

const fsp = require('node:fs/promises');
const path = require('node:path');
const publication = require('./publication');

const IMAGE_MIME = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
});

const SAFE_BASENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

function exportsDir() {
  const override = process.env.ACE_MVP_EXPORTS_DIR;
  return override
    ? path.resolve(process.cwd(), override)
    : path.join(path.dirname(publication.mvpStateFile()), 'exports');
}

function basenameOf(value) {
  return String(value === undefined || value === null ? '' : value)
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || '';
}

function referencedFiles(content) {
  const names = new Set();
  const still = content && content.export ? content.export.still : null;
  const stillName = basenameOf(still ? still.path || still.file : '');
  if (stillName) names.add(stillName);

  const assets = content ? content.assets : null;
  const list = Array.isArray(assets) ? assets : assets && typeof assets === 'object' ? Object.values(assets) : [];
  for (const asset of list) {
    if (!asset || typeof asset !== 'object') continue;
    const name = basenameOf(asset.path || asset.file || asset.filename || asset.name);
    if (name) names.add(name);
  }
  return names;
}

/**
 * @returns {{ok: true, file: string, mime: string} | {ok: false, status: number, reason: string}}
 */
function resolveMedia({ contentId, file, content }) {
  if (typeof contentId !== 'string' || !publication.CONTENT_ID_RE.test(contentId)) {
    return { ok: false, status: 400, reason: 'INVALID_CONTENT_ID' };
  }
  if (typeof file !== 'string' || !file) return { ok: false, status: 400, reason: 'MISSING_FILE' };
  if (file !== basenameOf(file) || file.includes('..')) return { ok: false, status: 400, reason: 'INVALID_FILE' };
  if (!SAFE_BASENAME_RE.test(file)) return { ok: false, status: 400, reason: 'INVALID_FILE' };

  const ext = path.extname(file).toLowerCase();
  const mime = IMAGE_MIME[ext];
  if (!mime) return { ok: false, status: 404, reason: 'UNSUPPORTED_TYPE' };

  const allowed = referencedFiles(content);
  if (allowed.size === 0 || !allowed.has(file)) return { ok: false, status: 404, reason: 'NOT_REFERENCED' };

  const root = exportsDir();
  const target = path.resolve(root, contentId, file);
  if (!target.startsWith(`${root}${path.sep}`)) return { ok: false, status: 400, reason: 'OUTSIDE_ROOT' };

  return { ok: true, file: target, mime };
}

async function readMedia({ contentId, file, content }) {
  const resolved = resolveMedia({ contentId, file, content });
  if (!resolved.ok) return resolved;
  try {
    const stat = await fsp.stat(resolved.file);
    if (!stat.isFile()) return { ok: false, status: 404, reason: 'NOT_A_FILE' };
    const buffer = await fsp.readFile(resolved.file);
    return { ok: true, buffer, mime: resolved.mime };
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      return { ok: false, status: 404, reason: 'NOT_FOUND' };
    }
    throw err;
  }
}

/**
 * Inline the hero image so the article is self-contained. A browser cannot send
 * an Authorization header for an <img> subresource, so the page must not depend
 * on the token-gated /media route to look right. The CSP already allows
 * `img-src 'self' data:`, so a data URI needs no policy change and no token in a
 * URL. Returns null when there is nothing referenced or readable.
 */
async function inlineHeroImage({ contentId, content }) {
  const still = content && content.export ? content.export.still : null;
  const file = basenameOf(still ? still.path || still.file : '');
  if (!file) return null;
  const media = await readMedia({ contentId, file, content });
  if (!media.ok) return null;
  return `data:${media.mime};base64,${media.buffer.toString('base64')}`;
}

module.exports = { IMAGE_MIME, exportsDir, referencedFiles, resolveMedia, readMedia, inlineHeroImage };
