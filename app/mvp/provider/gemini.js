'use strict';

/**
 * ACE — Google Gemini provider (Google AI Studio API).
 *
 * Same caller contract as provider/openrouter.js: one result object per call,
 * the key never leaves this module, refusals are normal results (never thrown),
 * and no egress happens without `allowNetwork: true`. Only the wire format
 * differs (generateContent instead of chat/completions), so the gateway can
 * swap between providers freely.
 *
 * Boundaries kept, same as openrouter.js:
 *   - The key is read only from the env object it is given (GEMINI_API_KEY).
 *   - The key is never logged, returned, or included in an error message.
 *   - Nothing here decides provenance; provider/provenance.js does.
 */

const PROVIDER = 'gemini';
const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

const KEY_VAR = 'GEMINI_API_KEY';
const MODEL_VAR = 'GEMINI_MODEL';
const LIVE_INTERLOCK_VAR = 'ACE_LLM_LIVE_ENABLED';
const MAX_OUTPUT_TOKENS_VAR = 'ACE_LLM_MAX_OUTPUT_TOKENS';

/**
 * Current fast default. `gemini-flash-lite-latest` is a retirement-proof alias
 * that answers in seconds with zero thinking tokens. The bigger 3.x/4.x slugs
 * reject thinkingLevel/thinkingBudget on this API version and think
 * dynamically for a long time, which breaks short timeouts — keep the lite
 * alias as default and override only with that trade-off understood.
 */
const DEFAULT_MODEL = 'gemini-flash-lite-latest';
// Only the 2.5 family accepts thinkingBudget on this API version; 3.x/latest
// aliases reject it (INVALID_ARGUMENT) and cannot disable thinking.
const THINKING_CAPABLE = /^gemini-2\.5/;

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_TIMEOUT_MS = 60000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1200;
const MAX_OUTPUT_TOKENS = 4000;
const MAX_PROMPT_CHARS = 8000;

const SUCCESS = 'success';
const FAILURE_KINDS = [
  'missing_credential',
  'invalid_configuration',
  'provider_disabled',
  'auth_error',
  'rate_limited',
  'provider_error',
  'timeout',
  'network_error',
  'invalid_response',
  'empty_response',
];

const MESSAGES = {
  missing_credential: `${KEY_VAR} is not set`,
  invalid_configuration: 'provider configuration is not usable (check key/model)',
  provider_disabled: 'network egress is disabled; no request was sent',
  auth_error: 'the provider rejected the credential',
  rate_limited: 'the provider rate-limited the request',
  provider_error: 'the provider returned an error response',
  timeout: 'the provider did not answer before the timeout',
  network_error: 'the request could not be completed',
  invalid_response: 'the provider response was not the expected JSON shape',
  empty_response: 'the provider returned no usable text',
};

function fail(status, extra = {}) {
  return {
    ok: false,
    status,
    provider: PROVIDER,
    model: extra.model === undefined ? null : extra.model,
    text: null,
    usage: null,
    latencyMs: null,
    httpStatus: null,
    networkAttempted: false,
    message: MESSAGES[status] || MESSAGES.provider_error,
  };
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function readApiKey(env = process.env) {
  const raw = env && typeof env[KEY_VAR] === 'string' ? env[KEY_VAR] : '';
  const key = raw.trim();
  return { present: key !== '', key };
}

function isConfigured(env = process.env) {
  return readApiKey(env).present;
}

function resolveModel(model, env = process.env) {
  if (nonEmptyString(model)) return model.trim();
  const fromEnv = env && typeof env[MODEL_VAR] === 'string' ? env[MODEL_VAR].trim() : '';
  return fromEnv || DEFAULT_MODEL;
}

function isLiveEnabled(env = process.env) {
  return Boolean(env) && String(env[LIVE_INTERLOCK_VAR] || '').trim() === '1';
}

function maxOutputTokensFromEnv(env) {
  const raw = env && env[MAX_OUTPUT_TOKENS_VAR];
  if (typeof raw !== 'string' || raw.trim() === '') return DEFAULT_MAX_OUTPUT_TOKENS;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value <= 0 || value > MAX_OUTPUT_TOKENS) return DEFAULT_MAX_OUTPUT_TOKENS;
  return value;
}

/** Token counts from Gemini's usageMetadata; absent counts stay absent. */
function usageFromPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.usageMetadata) return null;
  const meta = payload.usageMetadata;
  const inputTokens = Number.isFinite(meta.promptTokenCount) ? meta.promptTokenCount : undefined;
  const outputTokens = Number.isFinite(meta.candidatesTokenCount) ? meta.candidatesTokenCount : undefined;
  if (inputTokens === undefined && outputTokens === undefined) return null;
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  };
}

/** Pull the answer text out of candidates[0].content.parts, skipping thoughts. */
function textFromResponse(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : null;
  if (!candidates || candidates.length === 0) return null;
  const candidate = candidates[0];
  const parts = candidate && candidate.content && Array.isArray(candidate.content.parts)
    ? candidate.content.parts
    : null;
  if (!parts) return null;
  let text = '';
  for (const part of parts) {
    if (part && typeof part.text === 'string' && part.thought !== true) text += part.text;
  }
  return text === '' ? null : text;
}

function timeoutError() {
  const err = new Error('provider timeout');
  err.name = 'AceProviderTimeout';
  return err;
}

function raceDeadline(promise, deadline, controller, state) {
  let timer = null;
  const guard = new Promise((_, reject) => {
    const remaining = deadline - Date.now();
    timer = setTimeout(() => {
      state.timedOut = true;
      try {
        controller.abort();
      } catch {
        /* aborting a finished request is not an error we care about */
      }
      reject(timeoutError());
    }, remaining > 0 ? remaining : 0);
  });
  promise.catch(() => {});
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

function classifyThrown(error, state) {
  if (state.timedOut) return 'timeout';
  if (error && (error.name === 'AceProviderTimeout' || error.name === 'AbortError')) return 'timeout';
  return 'network_error';
}

async function generateScriptDraft(options = {}) {
  const env = options.env || process.env;
  const model = resolveModel(options.model, env);

  if (!nonEmptyString(options.prompt)) {
    return { ...fail('invalid_configuration', { model }), networkAttempted: false };
  }
  if (options.prompt.length > MAX_PROMPT_CHARS) {
    return fail('invalid_configuration', { model });
  }

  const timeoutMs = options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    return fail('invalid_configuration', { model });
  }

  const maxOutputTokens = options.maxOutputTokens === undefined
    ? maxOutputTokensFromEnv(env)
    : options.maxOutputTokens;
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens <= 0 || maxOutputTokens > MAX_OUTPUT_TOKENS) {
    return fail('invalid_configuration', { model });
  }

  const systemPrompt = typeof options.systemPrompt === 'string'
    && options.systemPrompt.trim() !== ''
    && options.systemPrompt.length <= MAX_PROMPT_CHARS
    ? options.systemPrompt
    : null;
  if (systemPrompt === null && options.systemPrompt !== undefined) {
    // A caller-supplied system prompt that is empty or over budget is a
    // configuration problem, same policy as openrouter.js.
    return fail('invalid_configuration', { model });
  }

  const { present, key } = readApiKey(env);
  if (!present) return fail('missing_credential', { model });

  const usingInjectedFetch = typeof options.fetchImpl === 'function';
  if (!usingInjectedFetch && options.allowNetwork !== true) {
    return fail('provider_disabled', { model });
  }
  const fetchImpl = usingInjectedFetch
    ? options.fetchImpl
    : (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);
  if (typeof fetchImpl !== 'function') return fail('invalid_configuration', { model });

  const url = ENDPOINT_BASE + encodeURIComponent(model) + ':generateContent';
  const body = {
    contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: maxOutputTokens,
    },
  };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
  // 2.5/3-series models spend maxOutputTokens on internal thinking by default;
  // ACE prompts are short structured tasks, so thinking stays off when the
  // model family supports the switch.
  if (THINKING_CAPABLE.test(model)) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const controller = new AbortController();
  const state = { timedOut: false };
  const deadline = Date.now() + timeoutMs;
  const startedAt = process.hrtime.bigint();

  let networkAttempted = false;
  try {
    networkAttempted = true;
    const request = fetchImpl(url, {
      method: 'POST',
      headers: {
        // The credential is placed here and nowhere else.
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const response = await raceDeadline(request, deadline, controller, state);
    const httpStatus = response && Number.isInteger(response.status) ? response.status : null;
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    // The body is consumed but never echoed: errors can carry request details.
    let rawBody = '';
    let bodyError = false;
    let bodyErrorName = null;
    try {
      const textResponse = response && typeof response.text === 'function'
        ? response.text()
        : Promise.resolve('');
      rawBody = await raceDeadline(textResponse, deadline, controller, state);
    } catch (bodyThrown) {
      bodyError = true;
      bodyErrorName = bodyThrown && typeof bodyThrown.name === 'string' ? bodyThrown.name : 'unknown';
      rawBody = '';
    }

    if (httpStatus === 401 || httpStatus === 403) {
      return { ...fail('auth_error', { model }), model, httpStatus, latencyMs, networkAttempted };
    }
    if (httpStatus === 429) {
      return { ...fail('rate_limited', { model }), model, httpStatus, latencyMs, networkAttempted };
    }
    if (httpStatus === null || httpStatus < 200 || httpStatus >= 300) {
      // Gemini signals a bad key with 400 INVALID_ARGUMENT; a bad model slug or
      // malformed request also lands here. Never echo the body.
      const status = httpStatus === 400 ? 'invalid_configuration' : 'provider_error';
      return { ...fail(status, { model }), model, httpStatus, latencyMs, networkAttempted };
    }

    let payload = null;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = null;
    }
    if (!payload || typeof payload !== 'object') {
      return { ...fail('invalid_response', { model }), model, httpStatus, latencyMs, networkAttempted };
    }

    const finishReason = payload.candidates && payload.candidates[0]
      && typeof payload.candidates[0].finish_reason === 'string'
      ? payload.candidates[0].finish_reason
      : (payload.candidates && payload.candidates[0] && typeof payload.candidates[0].finishReason === 'string'
        ? payload.candidates[0].finishReason
        : null);
    const diagnostics = {
      parsed: true,
      finishReason,
      usage: usageFromPayload(payload),
      maxOutputTokens,
      bodyError,
      bodyErrorName,
    };

    const text = textFromResponse(payload);
    if (typeof text !== 'string' || text.trim() === '') {
      return { ...fail('empty_response', { model }), model, httpStatus, latencyMs, networkAttempted, diagnostics };
    }

    return {
      ok: true,
      status: SUCCESS,
      provider: PROVIDER,
      model,
      text,
      usage: usageFromPayload(payload),
      latencyMs,
      httpStatus,
      networkAttempted,
      diagnostics,
      message: null,
    };
  } catch (error) {
    const status = classifyThrown(error, state);
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    return { ...fail(status, { model }), model, latencyMs, networkAttempted };
  } finally {
    try {
      controller.abort();
    } catch {
      /* idempotent */
    }
  }
}

function describe(env = process.env) {
  const { present } = readApiKey(env);
  const model = resolveModel(undefined, env);
  return {
    provider: PROVIDER,
    endpoint: ENDPOINT_BASE + '{model}:generateContent',
    configured: present,
    key_present: present,
    key_var: KEY_VAR,
    key_source: undefined,
    model_var: MODEL_VAR,
    model,
    model_source: nonEmptyString(env && env[MODEL_VAR]) ? 'env' : (model === DEFAULT_MODEL ? 'default' : 'env'),
    default_model: DEFAULT_MODEL,
    max_output_tokens: maxOutputTokensFromEnv(env),
  };
}

module.exports = {
  PROVIDER,
  ENDPOINT_BASE,
  KEY_VAR,
  MODEL_VAR,
  LIVE_INTERLOCK_VAR,
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_OUTPUT_TOKENS,
  SUCCESS,
  FAILURE_KINDS,
  readApiKey,
  isConfigured,
  resolveModel,
  isLiveEnabled,
  maxOutputTokensFromEnv,
  textFromResponse,
  usageFromPayload,
  generateScriptDraft,
  describe,
};
