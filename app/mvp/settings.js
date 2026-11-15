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
const gateway = require('./provider/gateway');
const aiEnv = require('./env');

const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 256;
const MAX_MODEL_LENGTH = 120;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/;

const PROVIDER_KEYS = gateway.PROVIDER_NAMES;

const override = {
  // Runtime key/model overrides are per provider, so both credentials can be
  // bound at once and the active provider switches without rebinding.
  api_keys: { openrouter: null, orcarouter: null, gemini: null },
  models: { openrouter: null, orcarouter: null, gemini: null },
  provider: null,
  live_drafting: false,
  updated_at: null,
};

/**
 * The provider every AI step uses when the caller does not name one:
 * runtime override first, then ACE_LLM_PROVIDER from the environment (.env),
 * then the gateway default (openrouter).
 */
function activeProvider(env = process.env) {
  const fromEnv = env && typeof env.ACE_LLM_PROVIDER === 'string' && env.ACE_LLM_PROVIDER.trim() !== ''
    ? env.ACE_LLM_PROVIDER.trim()
    : null;
  return gateway.resolveProviderName(override.provider || fromEnv);
}

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
  for (const name of PROVIDER_KEYS) {
    const impl = gateway.PROVIDERS[name];
    if (override.api_keys[name]) env[impl.KEY_VAR] = override.api_keys[name];
    if (override.models[name]) env[impl.MODEL_VAR] = override.models[name];
  }
  if (override.live_drafting) env[provider.LIVE_INTERLOCK_VAR || 'ACE_LLM_LIVE_ENABLED'] = '1';
  return env;
}

function providerKeyPresent(name, env = process.env) {
  const impl = gateway.PROVIDERS[name];
  return Boolean(override.api_keys[name] || impl.readApiKey(env).present);
}

/** Where the credential currently in force came from. */
function providerKeySource(name, env = process.env) {
  const impl = gateway.PROVIDERS[name];
  if (override.api_keys[name]) return 'runtime';
  return impl.readApiKey(env).present ? aiEnv.sourceOf(impl.KEY_VAR, env) : 'missing';
}

function providerModel(name, env = process.env) {
  const impl = gateway.PROVIDERS[name];
  return override.models[name] || impl.resolveModel(undefined, env);
}

function describe(env = process.env) {
  const effective = effectiveEnv(env);
  const active = activeProvider(env);
  const activeImpl = gateway.PROVIDERS[active];
  const providers = {};
  for (const name of PROVIDER_KEYS) {
    const impl = gateway.PROVIDERS[name];
    const { present } = impl.readApiKey(effective);
    const keyStr = override.api_keys[name] || impl.readApiKey(effective).key;
    providers[name] = {
      provider: impl.PROVIDER,
      configured: present,
      key_present: present,
      key_source: providerKeySource(name, effective),
      key_hint: present ? maskKey(keyStr) : null,
      key_var: impl.KEY_VAR,
      model: providerModel(name, effective),
      model_source: override.models[name] ? 'runtime' : (impl.resolveModel(undefined, effective) === impl.DEFAULT_MODEL ? 'default' : 'env'),
      default_model: impl.DEFAULT_MODEL,
      endpoint: impl.ENDPOINT || (impl.ENDPOINT_BASE ? impl.ENDPOINT_BASE + '{model}:generateContent' : null),
    };
  }
  const activeKeyStr = override.api_keys[active] || activeImpl.readApiKey(effective).key;
  return {
    provider: active,
    provider_source: override.provider ? 'runtime' : (env && typeof env.ACE_LLM_PROVIDER === 'string' && env.ACE_LLM_PROVIDER.trim() !== '' ? 'env' : 'default'),
    providers,
    // Legacy single-provider fields describe the ACTIVE provider so the
    // existing Settings UI keeps working unchanged.
    key_present: Boolean(activeKeyStr),
    key_source: providerKeySource(active, effective),
    key_hint: activeKeyStr ? maskKey(activeKeyStr) : null,
    key_var: activeImpl.KEY_VAR,
    model: providers[active].model,
    model_source: providers[active].model_source,
    model_var: activeImpl.MODEL_VAR,
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
    for (const name of PROVIDER_KEYS) {
      override.api_keys[name] = null;
      override.models[name] = null;
    }
    override.provider = null;
    override.live_drafting = false;
    override.updated_at = nowIso();
    return describe();
  }
  // The provider named in the same payload is the binding target for key and
  // model changes, so one Save switches provider AND binds its key together.
  let target = activeProvider();
  if (body.provider !== undefined && body.provider !== null && clean(body.provider) !== '') {
    const resolved = gateway.resolveProviderName(body.provider);
    if (!resolved) throw httpError(400, 'provider must be one of ' + PROVIDER_KEYS.join(', '));
    target = resolved;
    if (override.provider !== resolved) {
      override.provider = resolved;
      changed = true;
    }
  }
  if (body.clear_key === true) {
    override.api_keys[target] = null;
    changed = true;
  } else if (body.api_key !== undefined && body.api_key !== null && clean(body.api_key) !== '') {
    override.api_keys[target] = validateKey(body.api_key);
    changed = true;
  }
  if (body.clear_model === true) {
    override.models[target] = null;
    changed = true;
  } else if (body.model !== undefined && body.model !== null && clean(body.model) !== '') {
    override.models[target] = validateModel(body.model);
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
  activeProvider,
  describe,
  apply,
  validateKey,
  validateModel,
  maskKey,
};
