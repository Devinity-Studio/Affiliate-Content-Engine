'use strict';

/**
 * ACE — clip preview renderer.
 *
 * Turns a finished draft (hook/script lines + optional product images) into a
 * real 9:16 H.264 MP4 through the repo-local ffmpeg pipeline, so the operator
 * can watch the clip BEFORE publishing anything.
 *
 * Boundaries:
 *   - Input is text lines and image URLs/data URLs only; nothing else is read.
 *   - Remote images must be public https hosts (no localhost / private ranges)
 *     and at most 2 MB each; at most 5 images per clip.
 *   - Rendering is local: no network is used by ffmpeg, no account is touched.
 *   - Output goes to app/exports/preview and is served by the preview route.
 */

const fsp = require('node:fs/promises');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const renderer = require('../remotion/render');
const voiceover = require('./voiceover');

const PREVIEW_DIR = path.join(__dirname, '..', 'exports', 'preview');
const WORK_ROOT = path.join(__dirname, '..', '..', '.tmp', 'preview-work');

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_LINES = 10;
const MAX_LINE_CHARS = 110;
const SECONDS_PER_LINE = 3;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Visual style for the clip (badge + background colours), strictly validated. */
function cleanStyle(style) {
  const source = style && typeof style === 'object' ? style : {};
  const hex = (value, fallback) => (/^#[0-9A-Fa-f]{6}$/.test(String(value || '')) ? String(value) : fallback);
  const badge = typeof source.badge === 'string'
    ? source.badge.replace(/[{}<>\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24)
    : '';
  return {
    badge: badge || 'พรีวิวคลิป',
    from: hex(source.from, '#12151C'),
    accent: hex(source.accent, '#2E7DF6'),
  };
}

function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

async function fetchImage(url, index) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw httpError(400, `images[${index}] is not a valid URL`);
  }
  if (parsed.protocol !== 'https:') throw httpError(400, `images[${index}] must use https`);
  if (isPrivateHost(parsed.hostname)) throw httpError(400, `images[${index}] must be a public host`);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw httpError(400, `images[${index}] could not be downloaded (HTTP ${response.status})`);
  const type = String(response.headers.get('content-type') || '');
  if (type && !/^image\//i.test(type)) throw httpError(400, `images[${index}] is not an image (${type})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw httpError(400, `images[${index}] is larger than 2 MB`);
  return { buffer, ext: /png/i.test(type) ? '.png' : /webp/i.test(type) ? '.webp' : '.jpg' };
}

function decodeDataImage(value, index) {
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(String(value || ''));
  if (!match) throw httpError(400, `images[${index}] data URL must be base64 png/jpeg/webp`);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) throw httpError(400, `images[${index}] is larger than 2 MB`);
  return { buffer, ext: match[1].toLowerCase().includes('png') ? '.png' : match[1].toLowerCase().includes('webp') ? '.webp' : '.jpg' };
}

function cleanLines(lines) {
  const input = Array.isArray(lines) ? lines : [];
  return input
    .map((line) => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, MAX_LINES)
    .map((line) => line.slice(0, MAX_LINE_CHARS));
}

/**
 * Speaks each caption line into workDir and returns per-line audio facts.
 * A line that fails stays silent (the clip still renders) and the reason is
 * reported back so the operator knows why the clip has no voice.
 */
async function narrateLines(lines, workDir, requested) {
  const narration = { requested, ok: false, lines: 0, total: lines.length, voice: null, error: null };
  if (!requested) return { narration, lineAudio: [] };
  if (!voiceover.available()) {
    narration.error = voiceover.setupHint();
    return { narration, lineAudio: [] };
  }
  const lineAudio = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const out = path.join(workDir, `line${i}.mp3`);
      const audio = await voiceover.synthesize(lines[i], out);
      lineAudio.push({ file: out, duration_s: audio.duration_s, voice: audio.voice });
      narration.voice = audio.voice;
    } catch (error) {
      lineAudio.push(null);
      narration.error = narration.error || String((error && error.message) || error).slice(0, 240);
    }
  }
  narration.ok = lineAudio.some(Boolean);
  narration.lines = lineAudio.filter(Boolean).length;
  return { narration, lineAudio };
}

/**
 * Renders the clip and returns its metadata. Throws httpError(status) on bad
 * input or when ffmpeg/fonts are unavailable.
 */
async function prepareAndRender(body) {
  const lines = cleanLines(body && body.lines);
  if (!lines.length) throw httpError(400, 'lines must include at least one caption line');

  const images = Array.isArray(body && body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  const cta = typeof (body && body.cta) === 'string' ? body.cta.trim().slice(0, 80) : '';

  const id = 'PV-' + crypto.randomBytes(4).toString('hex');
  const workDir = path.join(WORK_ROOT, id);
  await fsp.mkdir(workDir, { recursive: true });
  await fsp.mkdir(PREVIEW_DIR, { recursive: true });

  const assets = {};
  for (let i = 0; i < images.length; i++) {
    const value = String(images[i] || '').trim();
    if (!value) continue;
    const downloaded = value.startsWith('data:')
      ? decodeDataImage(value, i)
      : await fetchImage(value, i);
    const file = path.join(workDir, `img${i}${downloaded.ext}`);
    await fsp.writeFile(file, downloaded.buffer);
    assets[`img${i}`] = file;
  }
  const imageKeys = Object.keys(assets);

  // Thai narration (edge-tts) per caption line; a failed line stays silent.
  const narrate = Boolean(body && body.narrate === true);
  const { narration, lineAudio } = await narrateLines(lines, workDir, narrate);

  const style = cleanStyle(body && body.style);
  const scenes = lines.map((line, index) => {
    const audio = lineAudio[index] || null;
    return {
      duration_s: audio ? Math.max(3, Math.round((audio.duration_s + 0.5) * 10) / 10) : SECONDS_PER_LINE,
      visual: {
        asset_ref: imageKeys.length ? imageKeys[index % imageKeys.length] : null,
        background: { from: style.from, accent: index === lines.length - 1 ? '#B4462E' : style.accent },
      },
      overlay: {
        position: 'center',
        badge: index === 0 ? style.badge : undefined,
        headline: line,
        headline_max_chars: 20,
        cta: index === lines.length - 1 ? (cta || 'กดลิงก์ในโปรไฟล์') : undefined,
      },
      audio: audio ? { voiceover: line } : {},
      audio_asset_file: audio ? audio.file : null,
    };
  });

  const fileName = id + '.mp4';
  const outFile = path.join(PREVIEW_DIR, fileName);
  const result = renderer.renderVideo({ scenes, outFile, workDir, assets });

  return {
    id,
    fileName,
    url: '/api/mvp/preview/file/' + fileName,
    duration_s: result.duration_s,
    bytes: result.bytes,
    sha256: result.sha256,
    width: result.width,
    height: result.height,
    fps: result.fps,
    font: result.font,
    encoder: result.encoder,
    lines: lines.length,
    images: imageKeys.length,
    narration,
    style,
  };
}

/** Resolves a served preview file name with a strict pattern (no traversal). */
function resolvePreviewFile(name) {
  const safe = String(name || '');
  if (!/^PV-[a-f0-9]{8}\.mp4$/i.test(safe)) return null;
  const file = path.join(PREVIEW_DIR, safe);
  return fs.existsSync(file) ? file : null;
}

module.exports = {
  PREVIEW_DIR,
  MAX_IMAGES,
  MAX_LINES,
  MAX_LINE_CHARS,
  prepareAndRender,
  resolvePreviewFile,
};
