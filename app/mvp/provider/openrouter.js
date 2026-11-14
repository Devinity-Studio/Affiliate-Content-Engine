'use strict';

/**
 * ACE — OpenRouter provider (Gate 3, offline-verified only).
 *
 * One endpoint, one function, native `fetch`, no SDK and no new dependency.
 *
 * Boundaries this module keeps:
 *   - The key is read only from `process.env.OPENROUTER_API_KEY`. No `.env`
 *     file is read, because the application has no `.env` loader (see
 *     verification/ace-mission1-openrouter-final-gate3-readiness-2026-11-01.md
 *     §3.3). Adding a loader was explicitly not approved.
 *   - No network egress unless the caller passes `allowNetwork: true`. The
 *     default is `false`, which is what keeps Gate 4 unreachable from a Gate 3
 *     build even if a key happens to be present in the environment. An
 *     injected `fetchImpl` is a test double and is not egress.
 *   - The key is never logged, returned, or included in an error. Failure
 *     results carry a fixed, per-kind message plus an optional HTTP status —
 *     never the provider body, request headers, or a thrown error message.
 *   - Nothing here decides provenance. It returns facts; `provenance.js`
 *     decides which `source` those facts may be recorded under.
 *
 * Refusals are normal results, not exceptions: the caller always gets a result
 * object with `ok: false` and a `status` from FAILURE_KINDS.
 */

const PROVIDER = 'openrouter';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const KEY_VAR = 'OPENROUTER_API_KEY';
const MODEL_VAR = 'OPENROUTER_MODEL';
const LIVE_INTERLOCK_VAR = 'ACE_LLM_LIVE_ENABLED';

/**
 * Gate 4 diagnostic controls. They exist so one variable can be changed between
 * measured runs without editing code; they cannot widen the hard bounds.
 */
const MAX_OUTPUT_TOKENS_VAR = 'ACE_LLM_MAX_OUTPUT_TOKENS';

function maxOutputTokensFromEnv(env) {
  const raw = env && env[MAX_OUTPUT_TOKENS_VAR];
  if (typeof raw !== 'string' || raw.trim() === '') return DEFAULT_MAX_OUTPUT_TOKENS;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value <= 0 || value > MAX_OUTPUT_TOKENS) return DEFAULT_MAX_OUTPUT_TOKENS;
  return value;
}

/**
 * Model used when neither the caller nor `OPENROUTER_MODEL` names one.
 * Gate 4 requires the Owner to approve the exact model; this constant is a
 * placeholder for offline wiring, not a live-test selection.
 */
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning:free';

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_TIMEOUT_MS = 60000;
// Gate 4 request #1 returned no usable text at a 700-token ceiling. The Owner
// amended the package for the diagnostic re-run: a higher ceiling, and internal
// reasoning excluded from the billed completion so it cannot eat the budget.
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

// A model slug like `nvidia/nemotron-3.5-lightning:free` or `google/gemini-2.5-flash`.
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/;

// Fixed, non-echoing messages. Nothing derived from the response or from a
// thrown error is ever placed here.
const MESSAGES = {
  missing_credential: `${KEY_VAR} is not set`,
  invalid_configuration: 'provider configuration is not usable',
  provider_disabled: 'network egress is disabled (Gate 3); no request was sent',
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

/** `present` is a boolean; the value itself is returned only to the caller that sends it. */
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

/** Pull the model text out of an OpenAI-compatible chat completion. Invents nothing. */
function textFromResponse(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const choices = Array.isArray(payload.choices) ? payload.choices : null;
  if (!choices || choices.length === 0) return null;
  const choice = choices[0];
  if (choice && choice.message && typeof choice.message.content === 'string') return choice.message.content;
  if (choice && typeof choice.text === 'string') return choice.text;
  return null;
}

/** Token counts, only when the provider actually reported them. */
function usageFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const usage = payload.usage;
  if (!usage || typeof usage !== 'object') return null;
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

/**
 * Run `promise` against the remaining deadline. On expiry the controller is
 * aborted so a real `fetch` stops too; the losing promise is detached so it
 * cannot surface as an unhandled rejection.
 */
function raceDeadline(promise, deadline, controller, state) {
  let timer = null;
  const guard = new Promise((_, reject) => {
    const remaining = deadline - Date.now();
    timer = setTimeout(() => {
      state.timedOut = true;
      try {
        controller.abort();
      } catch {
        // aborting an already-finished request is not an error we care about
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

/**
 * Ask OpenRouter for one Thai script draft.
 *
 * Returns a result object. Never throws for provider or configuration
 * problems, and never carries the credential or the raw provider payload.
 *
 * @param {object} options
 * @param {string} options.prompt            Thai prompt text
 * @param {string} [options.model]           model slug; falls back to OPENROUTER_MODEL, then DEFAULT_MODEL
 * @param {number} [options.timeoutMs]       request deadline
 * @param {number} [options.maxOutputTokens] completion ceiling
 * @param {boolean} [options.allowNetwork]   must be true for any request to be sent
 * @param {Function} [options.fetchImpl]     injection seam for offline tests
 * @param {object}  [options.env]            environment to read (defaults to process.env)
 */
async function generateScriptDraft(options = {}) {
  const env = options.env || process.env;
  const model = resolveModel(options.model, env);

  if (!nonEmptyString(options.prompt)) {
    return { ...fail('invalid_configuration', { model }), networkAttempted: false };
  }
  if (options.prompt.length > MAX_PROMPT_CHARS) {
    return fail('invalid_configuration', { model });
  }
  if (!MODEL_PATTERN.test(model)) {
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

  // A caller may bring its own system prompt (the research module asks for a
  // JSON shortlist instead of a script). It is length-bounded like the prompt
  // and never assembled from response data.
  const systemPrompt = typeof options.systemPrompt === 'string'
    && options.systemPrompt.trim() !== ''
    && options.systemPrompt.length <= MAX_PROMPT_CHARS
    ? options.systemPrompt
    : SYSTEM_PROMPT;

  const reasoningDisabled = options.disableReasoning !== false;

  const { present, key } = readApiKey(env);
  if (!present) return fail('missing_credential', { model });

  // Gate 3 build: real egress needs explicit permission. The service layer
  // only grants it when ACE_LLM_LIVE_ENABLED=1, which is a Gate 4 decision
  // this build does not make.
  //
  // An injected `fetchImpl` is a test double, not egress, so offline tests can
  // exercise the response handling without a network call. Passing the real
  // global fetch as `fetchImpl` would be a deliberate act, and it is the only
  // way to bypass this interlock.
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

  // Measured in Gate 4 (2026-11-10): the configured model spends its whole
  // `max_tokens` budget on internal reasoning before writing any answer — at a
  // 700-token ceiling it returned finish_reason "length" with content null and
  // 2,187 reasoning characters. `reasoning.exclude` is NOT a fix: those tokens
  // are still billed and still count against `max_tokens`. `enabled: false`
  // turns reasoning off, and with it the model answers in ~258 tokens.
  // `max_tokens` covers reasoning plus visible output, so the two settings are
  // recorded together here rather than tuned separately.
  if (reasoningDisabled) {
    body.reasoning = { enabled: false };
  }

  let networkAttempted = false;
  try {
    networkAttempted = true;
    const request = fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        // The credential is placed here and nowhere else.
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // OpenRouter attribution headers; no secrets.
        'HTTP-Referer': 'https://local.ace.invalid',
        'X-Title': 'ACE Affiliate Content Engine',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const response = await raceDeadline(request, deadline, controller, state);
    const httpStatus = response && Number.isInteger(response.status) ? response.status : null;
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    // The body is consumed but never echoed: auth errors in particular can
    // contain a partial key, so it is read and discarded.
    let rawBody = '';
    let bodyError = false;
    let bodyErrorName = null;
    try {
      const textResponse = response && typeof response.text === 'function'
        ? response.text()
        : Promise.resolve('');
      rawBody = await raceDeadline(textResponse, deadline, controller, state);
    } catch (bodyThrown) {
      // An unreadable body and an empty body are different failures; record which.
      // Only the error's name is kept: a message can carry request details.
      bodyError = true;
      bodyErrorName = bodyThrown && typeof bodyThrown.name === 'string' ? bodyThrown.name : 'unknown';
      rawBody = '';
    }
    const headerValue = (name) => {
      try {
        const headers = response && response.headers;
        if (!headers || typeof headers.get !== 'function') return null;
        const value = headers.get(name);
        return typeof value === 'string' ? value.slice(0, 64) : null;
      } catch {
        return null;
      }
    };

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
      // Metadata about the unparseable body, never the body itself: a proxy or
      // an error page can be large and may echo request details.
      const trimmed = rawBody.trim();
      const unparsed = {
        parsed: false,
        maxOutputTokens,
        reasoningDisabled,
        bodyChars: rawBody.length,
        bodyError,
        bodyErrorName,
        timedOut: state.timedOut === true,
        contentType: headerValue('content-type'),
        contentLength: headerValue('content-length'),
        startsWithBrace: trimmed.startsWith('{'),
        finishReason: null,
        choiceCount: null,
        contentKind: null,
        contentParts: null,
        reasoningChars: null,
        usage: null,
      };
      return { ...fail('invalid_response', { model }), model, httpStatus, latencyMs, networkAttempted, diagnostics: unparsed };
    }

    const diagnostics = diagnosticsFromPayload(payload);
    if (diagnostics) {
      diagnostics.maxOutputTokens = maxOutputTokens;
      diagnostics.reasoningDisabled = reasoningDisabled;
      diagnostics.bodyError = bodyError;
      diagnostics.contentType = headerValue('content-type');
      diagnostics.contentLength = headerValue('content-length');
    }
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
      // idempotent
    }
  }
}

/**
 * Shape of `choices[0].message.content`, as metadata only.
 *
 * Gate 4 diagnostics: a model that used its whole budget on internal reasoning
 * returns an empty string, and some models return content parts instead of a
 * string. Both break `textFromResponse`, and without a shape fingerprint the
 * two cases are indistinguishable from the outside. No text is captured here —
 * only the type name and, for arrays, the number of parts.
 */
function describeContentShape(content) {
  if (content === undefined) return { contentKind: 'absent', contentParts: null };
  if (content === null) return { contentKind: 'null', contentParts: null };
  if (typeof content === 'string') return { contentKind: 'string', contentParts: null };
  if (Array.isArray(content)) return { contentKind: 'array', contentParts: content.length };
  return { contentKind: typeof content, contentParts: null };
}

/**
 * Non-text facts about a provider response: why it stopped, what it charged, and
 * the shape of the message. Deliberately excludes the completion text, the
 * prompt, the headers and the credential.
 */
function diagnosticsFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const choice = choices[0] && typeof choices[0] === 'object' ? choices[0] : null;
  const message = choice && choice.message && typeof choice.message === 'object' ? choice.message : null;
  const finishReason = choice && typeof choice.finish_reason === 'string' ? choice.finish_reason : null;
  const shape = describeContentShape(message ? message.content : undefined);
  const reasoningChars = message && typeof message.reasoning === 'string'
    ? message.reasoning.length
    : null;    return {
      parsed: true,
      bodyChars: null,
      bodyError: null,
      contentType: null,
      contentLength: null,
      startsWithBrace: null,
      finishReason,
      choiceCount: choices.length,
      contentKind: shape.contentKind,
      contentParts: shape.contentParts,
      reasoningChars,
      usage: usageFromPayload(payload),
    };
}

/**
 * One-line, allowlisted summary for a runtime log. Takes a provenance trace
 * record and prints only its allowlisted fields.
 */
function describeTraceForLog(trace) {
  if (!trace || typeof trace !== 'object') return 'trace: <none>';
  const parts = [
    `trace=${trace.traceId}`,
    `operation=${trace.operation}`,
    `source=${trace.source}`,
    `status=${trace.status}`,
    `executionMode=${trace.executionMode}`,
    `provider=${trace.provider || 'none'}`,
    `model=${trace.model || 'none'}`,
  ];
  if (trace.fallbackReason) parts.push(`fallbackReason=${trace.fallbackReason}`);
  return parts.join(' ');
}

module.exports = {
  PROVIDER,
  ENDPOINT,
  KEY_VAR,
  MODEL_VAR,
  LIVE_INTERLOCK_VAR,
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_OUTPUT_TOKENS,
  SUCCESS,
  FAILURE_KINDS,
  SYSTEM_PROMPT,
  readApiKey,
  isConfigured,
  isLiveEnabled,
  MAX_OUTPUT_TOKENS_VAR,
  resolveModel,
  maxOutputTokensFromEnv,
  textFromResponse,
  usageFromPayload,
  describeContentShape,
  diagnosticsFromPayload,
  generateScriptDraft,
  describeTraceForLog,
};
