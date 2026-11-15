'use strict';

/**
 * ACE — OrcaRouter provider (OpenAI-compatible gateway).
 *
 * OrcaRouter (orcarouter.ai) is an OpenAI-compatible router: the wire format is
 * identical to OpenRouter's chat/completions, so this module mirrors
 * provider/openrouter.js with a different endpoint, credential variable and
 * default model. Same caller contract as every other provider: one result
 * object per call, the key never leaves this module, refusals are normal
 * results, and no egress without `allowNetwork: true`.
 *
 * Free-model note: slugs ending in `-free` (e.g. z-ai/glm-5.3-flash-free) bill
 * $0.00 per request on OrcaRouter; paid models bill the account balance.
 */

const PROVIDER = 'orcarouter';
const DEFAULT_ENDPOINT = 'https://api.orcarouter.ai/v1/chat/completions';
const ENDPOINT_VAR = 'ORCAROUTER_ENDPOINT';

const KEY_VAR = 'ORCAROUTER_API_KEY';
const MODEL_VAR = 'ORCAROUTER_MODEL';
const LIVE_INTERLOCK_VAR = 'ACE_LLM_LIVE_ENABLED';
const MAX_OUTPUT_TOKENS_VAR = 'ACE_LLM_MAX_OUTPUT_TOKENS';

/** The model the Owner already runs for free on OrcaRouter. */
const DEFAULT_MODEL = 'z-ai/glm-5.3-flash-free';

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
  invalid_configuration: 'provider configuration is not usable (check key/model/endpoint)',
  provider_disabled: 'network egress is disabled; no request was sent',
  auth_error: 'the provider rejected the credential',
  rate_limited: 'the provider rate-limited the request',
  provider_error: 'the provider returned an error response',
  timeout: 'the provider did not answer before the timeout',
  network_error: 'the request could not be completed',
  invalid_response: 'the provider response was not the expected JSON shape',
  empty_response: 'the provider returned no usable text',
};

const SYSTEM_PROMPT = [
  'คุณเป็นนักเขียนสคริปต์วิดีโอสั้นภาษาไทยสำหรับสินค้าออนไลน์',
  'เขียนบทพูดจากข้อมูลที่ให้เท่านั้น ห้ามเพิ่มราคา โปรโมชัน หรือตัวเลขที่ไม่มีในข้อมูล',
  'ห้ามใส่เครื่องหมายคำพูดครอบทั้งบท ห้ามใส่หัวข้อหรือคำอธิบาย',
  'ตอบเป็นภาษาไทยเท่านั้น และตอบเฉพาะบทพูดที่นำไปใช้ได้ทันที',
].join(' ');

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

function resolveEndpoint(env = process.env) {
  const override = env && typeof env[ENDPOINT_VAR] === 'string' ? env[ENDPOINT_VAR].trim() : '';
  return override || DEFAULT_ENDPOINT;
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

function textFromResponse(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const choices = Array.isArray(payload.choices) ? payload.choices : null;
  if (!choices || choices.length === 0) return null;
  const choice = choices[0];
  if (choice && choice.message && typeof choice.message.content === 'string') return choice.message.content;
  if (choice && typeof choice.text === 'string') return choice.text;
  return null;
}

function usageFromPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.usage) return null;
  const usage = payload.usage;
  const inputTokens = Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : undefined;
  const outputTokens = Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : undefined;
  if (inputTokens === undefined && outputTokens === undefined) return null;
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  };
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
  const endpoint = resolveEndpoint(env);

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
    : SYSTEM_PROMPT;

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

  const controller = new AbortController();
  const state = { timedOut: false };
  const deadline = Date.now() + timeoutMs;
  const startedAt = process.hrtime.bigint();

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: options.prompt },
    ],
    max_tokens: maxOutputTokens,
    temperature: 0,
    stream: false,
  };

  let networkAttempted = false;
  try {
    networkAttempted = true;
    const request = fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        // The credential is placed here and nowhere else.
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'ACE Affiliate Content Engine',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const response = await raceDeadline(request, deadline, controller, state);
    const httpStatus = response && Number.isInteger(response.status) ? response.status : null;
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    // The body is consumed but never echoed: errors can carry request details.
    let rawBody = '';
    try {
      const textResponse = response && typeof response.text === 'function'
        ? response.text()
        : Promise.resolve('');
      rawBody = await raceDeadline(textResponse, deadline, controller, state);
    } catch {
      rawBody = '';
    }

    if (httpStatus === 401 || httpStatus === 403) {
      return { ...fail('auth_error', { model }), model, httpStatus, latencyMs, networkAttempted };
    }
    if (httpStatus === 429) {
      return { ...fail('rate_limited', { model }), model, httpStatus, latencyMs, networkAttempted };
    }
    if (httpStatus === null || httpStatus < 200 || httpStatus >= 300) {
      return { ...fail('provider_error', { model }), model, httpStatus, latencyMs, networkAttempted };
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

    const text = textFromResponse(payload);
    if (typeof text !== 'string' || text.trim() === '') {
      return { ...fail('empty_response', { model }), model, httpStatus, latencyMs, networkAttempted };
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
    endpoint: resolveEndpoint(env),
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
  DEFAULT_ENDPOINT,
  ENDPOINT_VAR,
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
  resolveEndpoint,
  resolveModel,
  isLiveEnabled,
  maxOutputTokensFromEnv,
  textFromResponse,
  usageFromPayload,
  generateScriptDraft,
  describe,
};
