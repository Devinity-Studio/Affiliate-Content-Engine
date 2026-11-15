'use strict';

/**
 * ACE — provider gateway.
 *
 * One doorway for every LLM call in the app. Callers hand the same options
 * object to `generateScriptDraft` and the gateway routes it to the named
 * provider (openrouter | orcarouter | gemini). Per-step routing works by
 * simply passing `provider` at any call site; an unspecified provider falls
 * back to the caller's configured default, ultimately 'openrouter'.
 *
 * The gateway never touches credentials: each provider module reads its own
 * key variables from the env object it is given. `status()` composes a
 * per-provider summary (key presence, model, endpoint) for the Settings panel.
 */

const aiEnv = require('../env');
const openrouter = require('./openrouter');
const orcarouter = require('./orcarouter');
const gemini = require('./gemini');

const PROVIDERS = {
  openrouter: openrouter,
  orcarouter: orcarouter,
  gemini: gemini,
};

const DEFAULT_PROVIDER = 'openrouter';
const PROVIDER_NAMES = Object.keys(PROVIDERS);

/** Resolves a caller-supplied provider name; null when unknown. */
function resolveProviderName(name) {
  if (name === undefined || name === null || String(name).trim() === '') return DEFAULT_PROVIDER;
  const key = String(name).trim().toLowerCase();
  return PROVIDER_NAMES.includes(key) ? key : null;
}

/** Per-provider summary for the Settings panel. Never includes key values. */
function describeProvider(name, env = process.env) {
  const key = resolveProviderName(name);
  if (!key) return null;
  const impl = providersimpl(key);
  const { present } = impl.readApiKey(env);
  const model = impl.resolveModel(undefined, env);
  return {
    provider: impl.PROVIDER,
    endpoint: impl.ENDPOINT || (impl.ENDPOINT_BASE ? impl.ENDPOINT_BASE + '{model}:generateContent' : null),
    configured: present,
    key_present: present,
    key_var: impl.KEY_VAR,
    key_source: aiEnv.sourceOf(impl.KEY_VAR, env),
    model_var: impl.MODEL_VAR,
    model,
    model_source: model === impl.DEFAULT_MODEL ? 'default' : 'env',
    default_model: impl.DEFAULT_MODEL,
    max_output_tokens: impl.maxOutputTokensFromEnv ? impl.maxOutputTokensFromEnv(env) : null,
  };
}

function providersimpl(key) {
  return PROVIDERS[key];
}

function isLiveEnabled(env = process.env) {
  return openrouter.isLiveEnabled(env);
}

/** Composed status. Top-level fields describe the ACTIVE provider (legacy UI). */
function status(env = process.env, activeProvider) {
  const active = resolveProviderName(activeProvider);
  const providers = {};
  for (const key of PROVIDER_NAMES) {
    providers[key] = describeProvider(key, env);
  }
  const activeInfo = providers[active];
  const anyConfigured = PROVIDER_NAMES.some(function(key) { return providers[key].configured; });
  return {
    active_provider: active,
    providers,
    // Backward-compatible top-level fields (existing Settings UI reads these).
    provider: active,
    endpoint: activeInfo.endpoint,
    configured: activeInfo.configured,
    key_present: activeInfo.configured,
    key_var: activeInfo.key_var,
    model: activeInfo.model,
    model_source: activeInfo.model_source,
    model_var: activeInfo.model_var,
    ready: activeInfo.configured,
    any_configured: anyConfigured,
    live_interlock: isLiveEnabled(env),
  };
}

/**
 * Route one call. Unknown provider names return an invalid_configuration
 * result (same shape as every provider refusal) instead of throwing, so
 * callers keep their uniform error handling.
 */
function generateScriptDraft(options = {}) {
  const name = resolveProviderName(options && options.provider);
  if (!name) {
    return Promise.resolve({
      ok: false,
      status: 'invalid_configuration',
      provider: String(options && options.provider),
      model: null,
      text: null,
      usage: null,
      latencyMs: null,
      httpStatus: null,
      networkAttempted: false,
      message: 'unknown provider "' + String(options && options.provider) + '" — use one of ' + PROVIDER_NAMES.join(', '),
    });
  }
  return PROVIDERS[name].generateScriptDraft(options);
}

module.exports = {
  PROVIDERS,
  PROVIDER_NAMES,
  DEFAULT_PROVIDER,
  resolveProviderName,
  describeProvider,
  status,
  isLiveEnabled,
  generateScriptDraft,
};
