'use strict';

/**
 * ACE — OpenRouter provenance / trace records.
 *
 * One trace schema for offline tests and live execution. This module is the
 * single writer of `source`, `status` and `executionMode`, so a template path
 * cannot describe itself as a live inference and a mock cannot describe itself
 * as live evidence.
 *
 * Allowed combinations (enforced, not documented-and-hoped):
 *
 *   LIVE_LLM  + success             + LIVE           provider inference produced the accepted output
 *   MOCK      + success             + OFFLINE_TEST   an injected/stubbed provider call in a test
 *   TEMPLATE  + template_default    + any            deterministic output, no provider involved
 *   TEMPLATE  + graceful_fallback   + any            a provider attempt failed; deterministic output stands
 *
 * Anything else throws. In particular `LIVE_LLM` outside `executionMode: LIVE`
 * is impossible, which is what stops an offline test from manufacturing live
 * provider evidence.
 *
 * The record never carries an API key, an Authorization header, an environment
 * value, or a raw provider request/response body. Fields outside the allowlist
 * below are rejected rather than silently dropped, so a well-meaning caller
 * cannot smuggle a payload into evidence.
 */

const SOURCES = ['LIVE_LLM', 'TEMPLATE', 'MOCK'];
const EXECUTION_MODES = ['OFFLINE_TEST', 'LIVE'];

const STATUSES = [
  'success',
  'template_default',
  'graceful_fallback',
];

// Provider-level outcomes that may be recorded in `fallbackReason`.
const FALLBACK_REASONS = [
  'validation_failed',
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

const TRACE_FIELDS = [
  'traceId',
  'timestamp',
  'operation',
  'provider',
  'model',
  'source',
  'status',
  'latencyMs',
  'usage',
  'validation',
  'fallbackReason',
  'executionMode',
];

const USAGE_FIELDS = ['inputTokens', 'outputTokens'];

// The matrix in the header comment, expressed once.
const ALLOWED = [
  { source: 'LIVE_LLM', status: 'success', modes: ['LIVE'] },
  { source: 'MOCK', status: 'success', modes: ['OFFLINE_TEST'] },
  { source: 'TEMPLATE', status: 'template_default', modes: EXECUTION_MODES },
  { source: 'TEMPLATE', status: 'graceful_fallback', modes: EXECUTION_MODES },
];

function invalid(message) {
  const err = new Error(`invalid trace record: ${message}`);
  err.code = 'INVALID_TRACE_RECORD';
  return err;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Build a usage block. A count the provider did not report is omitted, never
 * written as zero — an absent number and "used no tokens" are different claims.
 */
function buildUsage(usage) {
  if (usage === null || usage === undefined) return undefined;
  if (typeof usage !== 'object') throw invalid('usage must be an object');
  const out = {};
  for (const field of Object.keys(usage)) {
    if (!USAGE_FIELDS.includes(field)) throw invalid(`usage.${field} is not allowed`);
  }
  for (const field of USAGE_FIELDS) {
    if (usage[field] === undefined || usage[field] === null) continue;
    if (!isFiniteNumber(usage[field]) || usage[field] < 0) throw invalid(`usage.${field} must be a non-negative number`);
    out[field] = usage[field];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Build a validation block: ACE's own checks, not the provider's claims.
 * `{ ok: boolean, failed: string[] }`
 */
function buildValidation(validation) {
  if (validation === undefined) return undefined;
  if (validation === null || typeof validation !== 'object') throw invalid('validation must be an object');
  const { ok, failed } = validation;
  if (typeof ok !== 'boolean') throw invalid('validation.ok must be a boolean');
  if (failed !== undefined) {
    if (!Array.isArray(failed) || failed.some((item) => typeof item !== 'string')) {
      throw invalid('validation.failed must be an array of strings');
    }
  }
  return { ok, failed: failed ? [...failed] : [] };
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw invalid(`${field} is required`);
  return value;
}

/**
 * Build one trace record. Throws on anything outside the allowlist or outside
 * the source/status/executionMode matrix.
 */
function buildTraceRecord(input = {}) {
  if (input === null || typeof input !== 'object') throw invalid('input must be an object');

  for (const field of Object.keys(input)) {
    if (!TRACE_FIELDS.includes(field)) throw invalid(`${field} is not an allowed trace field`);
  }

  const traceId = requireNonEmptyString(input.traceId, 'traceId');
  const timestamp = requireNonEmptyString(input.timestamp, 'timestamp');
  const operation = requireNonEmptyString(input.operation, 'operation');

  const source = requireNonEmptyString(input.source, 'source');
  if (!SOURCES.includes(source)) throw invalid(`source must be one of ${SOURCES.join(', ')}`);

  const status = requireNonEmptyString(input.status, 'status');
  if (!STATUSES.includes(status)) throw invalid(`status must be one of ${STATUSES.join(', ')}`);

  const executionMode = requireNonEmptyString(input.executionMode, 'executionMode');
  if (!EXECUTION_MODES.includes(executionMode)) {
    throw invalid(`executionMode must be one of ${EXECUTION_MODES.join(', ')}`);
  }

  const rule = ALLOWED.find((item) => item.source === source && item.status === status);
  if (!rule) throw invalid(`${source} cannot carry status ${status}`);
  if (!rule.modes.includes(executionMode)) {
    throw invalid(`${source} is not allowed with executionMode ${executionMode}`);
  }

  const provider = source === 'TEMPLATE' ? (input.provider === undefined ? null : input.provider) : input.provider;
  if (source !== 'TEMPLATE') requireNonEmptyString(provider, 'provider');
  if (provider !== null && provider !== undefined && typeof provider !== 'string') {
    throw invalid('provider must be a string or null');
  }

  const model = source === 'TEMPLATE' ? (input.model === undefined ? null : input.model) : input.model;
  if (source !== 'TEMPLATE') requireNonEmptyString(model, 'model');
  if (model !== null && model !== undefined && typeof model !== 'string') {
    throw invalid('model must be a string or null');
  }

  const latencyMs = input.latencyMs === undefined || input.latencyMs === null ? undefined : input.latencyMs;
  if (latencyMs !== undefined && (!isFiniteNumber(latencyMs) || latencyMs < 0)) {
    throw invalid('latencyMs must be a non-negative number');
  }

  const fallbackReason = input.fallbackReason === undefined || input.fallbackReason === null
    ? null
    : input.fallbackReason;
  if (fallbackReason !== null) {
    if (typeof fallbackReason !== 'string' || !FALLBACK_REASONS.includes(fallbackReason)) {
      throw invalid(`fallbackReason must be null or one of ${FALLBACK_REASONS.join(', ')}`);
    }
    if (status !== 'graceful_fallback') throw invalid('fallbackReason is only allowed with graceful_fallback');
  }
  if (status === 'graceful_fallback' && fallbackReason === null) {
    throw invalid('graceful_fallback requires a fallbackReason');
  }

  const record = {
    traceId,
    timestamp,
    operation,
    provider: provider === undefined ? null : provider,
    model: model === undefined ? null : model,
    source,
    status,
    executionMode,
    latencyMs: latencyMs === undefined ? null : latencyMs,
    validation: buildValidation(input.validation) || null,
    fallbackReason,
  };

  const usage = buildUsage(input.usage);
  if (usage) record.usage = usage;

  return record;
}

/** A successful provider inference that contributed to the accepted output. */
function liveTrace(input) {
  return buildTraceRecord({ ...input, source: 'LIVE_LLM', status: 'success', executionMode: 'LIVE' });
}

/** A deterministic result where no provider was involved at all. */
function templateTrace(input) {
  return buildTraceRecord({
    ...input,
    source: 'TEMPLATE',
    status: 'template_default',
    executionMode: input.executionMode || 'LIVE',
  });
}

/** A provider attempt failed; the deterministic output stands. */
function fallbackTrace(input) {
  return buildTraceRecord({
    ...input,
    source: 'TEMPLATE',
    status: 'graceful_fallback',
    executionMode: input.executionMode || 'LIVE',
  });
}

/** A stubbed provider call inside an offline test. Never evidence of a live call. */
function mockTrace(input) {
  return buildTraceRecord({ ...input, source: 'MOCK', status: 'success', executionMode: 'OFFLINE_TEST' });
}

module.exports = {
  SOURCES,
  STATUSES,
  EXECUTION_MODES,
  FALLBACK_REASONS,
  TRACE_FIELDS,
  buildTraceRecord,
  buildUsage,
  buildValidation,
  liveTrace,
  templateTrace,
  fallbackTrace,
  mockTrace,
};
