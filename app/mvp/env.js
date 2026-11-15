'use strict';

/**
 * ACE — minimal `.env` reader.
 *
 * Zero dependencies, and deliberately narrow:
 *   - `NAME=VALUE` pairs only, one per line; `#` starts a comment.
 *   - A value already present in the process environment always wins, so a
 *     shell or service-manager override is never silently replaced.
 *   - Values are never logged, returned, or included in errors. Only key names
 *     leave this module (`loadedKeys`/`skippedKeys`), so a leak of the returned
 *     summary cannot leak a secret.
 *
 * The provider still reads the credential from `process.env`; this module only
 * fills that environment in from the file when it is missing.
 */

const fs = require('node:fs');
const path = require('node:path');

const loadedFromFile = new Set();
let lastLoad = null;

function parse(text) {
  const pairs = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
      || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    pairs.push([key, value]);
  }
  return pairs;
}

/**
 * Reads `file` and copies any key that is not already set in `env`.
 *
 * @returns {{file: string, found: boolean, loadedKeys: string[], skippedKeys: string[]}}
 */
function loadEnvFile(file, env = process.env) {
  const target = path.resolve(file || path.join(process.cwd(), '.env'));
  let text = null;
  try {
    text = fs.readFileSync(target, 'utf8');
  } catch {
    lastLoad = { file: target, found: false, loadedKeys: [], skippedKeys: [] };
    return lastLoad;
  }
  const loadedKeys = [];
  const skippedKeys = [];
  for (const [key, value] of parse(text)) {
    const current = env[key];
    if (typeof current === 'string' && current.trim() !== '') {
      skippedKeys.push(key);
      continue;
    }
    env[key] = value;
    loadedFromFile.add(key);
    loadedKeys.push(key);
  }
  lastLoad = { file: target, found: true, loadedKeys, skippedKeys };
  return lastLoad;
}

/** One-line summary safe to log: names only, never values. */
function describeLoad() {
  if (!lastLoad) return '.env not read';
  if (!lastLoad.found) return '.env not found';
  return `.env: ${lastLoad.loadedKeys.length} key(s) loaded, ${lastLoad.skippedKeys.length} already set`;
}

/** Where a key came from: 'env-file', 'process' or 'missing'. */
function sourceOf(key, env = process.env) {
  const value = env ? env[key] : undefined;
  if (typeof value !== 'string' || value.trim() === '') return 'missing';
  return loadedFromFile.has(key) ? 'env-file' : 'process';
}

module.exports = { parse, loadEnvFile, describeLoad, sourceOf };
