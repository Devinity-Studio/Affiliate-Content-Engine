'use strict';

/**
 * Thai voice-over (production step)
 *
 * The production step speaks the Thai script that was already reviewed. This
 * module is the only place that turns text into audio, so the rest of the app
 * never has to know which engine produced it.
 *
 * Engine: edge-tts (Microsoft Edge neural voices) — free, no API key, but it
 * needs a network connection at synthesis time. It runs from a project-local
 * Python venv under .tmp/ (git-ignored) so nothing is installed system-wide.
 *
 * Why not Piper (fully offline)? The Thai Piper voice (th_TH-tsync2-medium)
 * needs a phonemizer newer than the last Windows Piper binary, so it fails with
 * "aɪ is not a single codepoint". When a working offline engine exists it can be
 * dropped in behind the same synthesize() contract.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const renderer = require('../remotion/render');

const REPO_DIR = path.join(__dirname, '..', '..');
const DEFAULT_PYTHON = path.join(REPO_DIR, '.tmp', 'tools', 'tts-venv', 'Scripts', 'python.exe');
const DEFAULT_VOICE = 'th-TH-PremwadeeNeural'; // Thai female, general
const FALLBACK_VOICE = 'th-TH-NiwatNeural';    // Thai male, used when the first voice refuses a request
const MAX_TEXT_CHARS = 700;

function pythonPath() {
  const explicit = process.env.ACE_TTS_PYTHON;
  return explicit ? path.resolve(process.cwd(), explicit) : DEFAULT_PYTHON;
}

function voiceName() {
  return process.env.ACE_TTS_VOICE || DEFAULT_VOICE;
}

/** Tried in order; a voice may refuse a single request while the endpoint works. */
function voiceCandidates() {
  const preferred = voiceName();
  return preferred === FALLBACK_VOICE ? [preferred] : [preferred, FALLBACK_VOICE];
}

/** True when the local TTS runtime is present (synthesis still needs network). */
function available() {
  try {
    return fs.existsSync(pythonPath());
  } catch {
    return false;
  }
}

function setupHint() {
  return `Thai TTS is not installed on this machine. Expected ${pythonPath()} — `
    + 'install it with: python -m venv .tmp/tools/tts-venv && '
    + '.tmp/tools/tts-venv/Scripts/python.exe -m pip install edge-tts '
    + '(or point ACE_TTS_PYTHON at another interpreter that has edge-tts).';
}

function run(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Thai TTS timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`could not run the TTS runtime: ${err.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Thai TTS failed (exit ${code}): ${stderr.trim().slice(-300)}`));
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MIN_GAP_MS = 1500;
const RETRY_DELAYS_MS = [0, 3000, 7000, 12000, 18000, 25000, 30000, 30000];
let lastCallAt = 0;

/**
 * Speaks `text` into `outFile` (mp3) and returns the measured audio facts.
 *
 * The Edge endpoint starts answering an empty stream when it is called in quick
 * succession, so calls are spaced out and retried with a growing delay. A real
 * failure (bad voice, no runtime) still surfaces after the last attempt.
 */
async function synthesize(text, outFile, options = {}) {
  const spoken = String(text || '').trim();
  if (!spoken) throw new Error('no text to speak');
  if (spoken.length > MAX_TEXT_CHARS) throw new Error(`voice-over text is longer than ${MAX_TEXT_CHARS} characters`);

  let lastError = null;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const gap = Math.max(RETRY_DELAYS_MS[attempt - 1], MIN_GAP_MS - (Date.now() - lastCallAt));
    if (gap > 0) await sleep(gap);
    lastCallAt = Date.now();
    // One video, one voice: never swap voices between scenes, retry the same one.
    const voice = options.voice || voiceName();
    try {
      await run(['-m', 'edge_tts', '--voice', voice, '--text', spoken, '--write-media', outFile], 120000);
      const stat = fs.statSync(outFile);
      if (!stat.size) throw new Error('the TTS engine returned no audio');
      const probe = renderer.probeAudio(outFile) || {};
      if (!Number.isFinite(Number(probe.duration_s))) throw new Error('the produced audio has no readable duration');
      return {
        file: outFile,
        bytes: stat.size,
        duration_s: Number(probe.duration_s),
        voice,
        attempts: attempt,
      };
    } catch (err) {
      lastError = err;
      if (fs.existsSync(outFile)) {
        try { fs.unlinkSync(outFile); } catch { /* best effort */ }
      }
    }
  }
  throw lastError;
}

module.exports = {
  available,
  setupHint,
  synthesize,
  voiceName,
  pythonPath,
  MAX_TEXT_CHARS,
  voiceCandidates,
};
