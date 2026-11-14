'use strict';

/**
 * ACE — runtime settings & key management.
 *
 * Precedence for the OpenRouter credential and model:
 *   1. Runtime override set from the Settings panel (this module, memory only)
 *   2. The value loaded from `.env` at boot (or the process environment)
 *   3. Built-in defaults
 *
 * The override deliberately lives in memory: it takes effect on the next request
 * without a restart, is never written to the fixture state file, never logged,
 * and disappears when the server stops. The browser never stores the key either;
 * the UI posts it once and only reads back a masked hint.
 */

const provider = require('./provider/openrouter');
const aiEnv = require('./env');

const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 256;
const MAX_MODEL_LENGTH = 120;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/;

const override = {
  api_key: null,
  model: null,
  live_drafting: false,
  updated_at: null,
};

function nowIso() {
  return new Date().toISOString();
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Last four characters only — enough to recognise a key, useless to steal it. */
function maskKey(key) {
  if (!key) return null;
  const tail = key.slice(-4);
  return `••••••••${tail}`;
}

function validateKey(value) {
  const key = clean(value);
  if (!key) throw httpError(400, 'api_key must not be empty (use clear_key to fall back to .env)');
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
    throw httpError(400, `api_key must be ${MIN_KEY_LENGTH}–${MAX_KEY_LENGTH} characters`);
  }
  if (/\s/.test(key)) throw httpError(400, 'api_key must not contain whitespace');
  return key;
}

function validateModel(value) {
  const model = clean(value);
  if (!model) throw httpError(400, 'model must not be empty (use clear_model to fall back to .env)');
  if (model.length > MAX_MODEL_LENGTH) throw httpError(400, `model must be at most ${MAX_MODEL_LENGTH} characters`);
  if (!MODEL_PATTERN.test(model)) throw httpError(400, 'model must look like vendor/model (letters, digits, . _ : @ / -)');
  return model;
}

/** The environment the provider should see right now. */
function effectiveEnv(baseEnv = process.env) {
  const env = { ...(baseEnv || {}) };
  if (override.api_key) env[provider.KEY_VAR] = override.api_key;
  if (override.model) env[provider.MODEL_VAR] = override.model;
  if (override.live_drafting) env[provider.LIVE_INTERLOCK_VAR || 'ACE_LLM_LIVE_ENABLED'] = '1';
  return env;
}

function keyPresent(env = process.env) {
  return Boolean(clean((env || {})[provider.KEY_VAR]));
}

/** Where the credential currently in force came from. */
function keySource(env = process.env) {
  if (override.api_key) return 'runtime';
  return keyPresent(env) ? aiEnv.sourceOf(provider.KEY_VAR, env) : 'missing';
}

function modelSource(env = process.env) {
  if (override.model) return 'runtime';
  const fromEnv = clean((env || {})[provider.MODEL_VAR]);
  return fromEnv ? 'env' : 'default';
}

function describe(env = process.env) {
  const effective = effectiveEnv(env);
  const { key } = provider.readApiKey(effective);
  return {
    key_present: Boolean(key),
    key_source: keySource(env),
    key_hint: maskKey(override.api_key || key),
    key_var: provider.KEY_VAR,
    model: provider.resolveModel(undefined, effective),
    model_source: modelSource(env),
    model_var: provider.MODEL_VAR,
    live_drafting: override.live_drafting,
    interlock: provider.isLiveEnabled(effective),
    updated_at: override.updated_at,
    persisted: false,
    storage: 'server-memory',
  };
}

/**
 * Applies one settings change. Every field is optional; the response is the
 * masked description, never the key itself.
 */
function apply(payload = {}) {
  const body = payload && typeof payload === 'object' ? payload : {};
  let changed = false;
  if (body.reset === true) {
    override.api_key = null;
    override.model = null;
    override.live_drafting = false;
    override.updated_at = nowIso();
    return describe();
  }
  if (body.clear_key === true) {
    override.api_key = null;
    changed = true;
  } else if (body.api_key !== undefined && body.api_key !== null && clean(body.api_key) !== '') {
    override.api_key = validateKey(body.api_key);
    changed = true;
  }
  if (body.clear_model === true) {
    override.model = null;
    changed = true;
  } else if (body.model !== undefined && body.model !== null && clean(body.model) !== '') {
    override.model = validateModel(body.model);
    changed = true;
  }
  if (body.live_drafting !== undefined) {
    override.live_drafting = body.live_drafting === true;
    changed = true;
  }
  if (changed) override.updated_at = nowIso();
  return describe();
}

module.exports = {
  MIN_KEY_LENGTH,
  MAX_KEY_LENGTH,
  MAX_MODEL_LENGTH,
  effectiveEnv,
  keySource,
  describe,
  apply,
  validateKey,
  validateModel,
  maskKey,
};
