'use strict';

/**
 * ACE — PostHog AI Observability.
 *
 * Wraps a server-side LLM provider call so the generation is sent to PostHog as
 * an `$ai_generation` event: model, provider, prompt and response, wall-clock
 * latency, token usage and (PostHog-computed) cost.
 *
 * Usage — wrap the provider call, keep the result:
 *
 *   const { traceGeneration } = require('./observability/posthog-ai');
 *   const response = await traceGeneration({
 *     provider: 'google',
 *     model: 'gemini-2.5-flash',
 *     input: [{ role: 'user', content: prompt }],
 *     call: () => model.generateContent(prompt),
 *   });
 *
 * Rules this module keeps:
 *   - The key is read from POSTHOG_API_KEY (POSTHOG_HOST is optional). With no
 *     key every helper is a pass-through: the wrapped call still runs, nothing
 *     is sent, nothing is logged as a failure.
 *   - The wrapped call's behaviour never changes. The provider's response is
 *     returned untouched and an error is re-thrown as the same object.
 *   - Telemetry never throws: a PostHog problem is logged and swallowed.
 *   - posthog-node / @posthog/ai are loaded lazily, so `node app/server.js`
 *     keeps running with no `npm install` when the key is unset.
 *   - Token counts are reported only when the provider reported them. An absent
 *     count means "not reported", never zero.
 */

const KEY = String(process.env.POSTHOG_API_KEY || '').trim();
const HOST = String(process.env.POSTHOG_HOST || 'https://us.i.posthog.com').trim();
const HOST_IS_LOCAL = /127\.0\.0\.1|localhost/.test(HOST);

let client = null;
let loadError = null;

function isEnabled() {
  return Boolean(KEY) && loadError === null;
}

function getClient() {
  if (!KEY || loadError) return null;
  if (client) return client;
  try {
    // Optional dependencies: loaded only once a key exists.
    const { PostHog } = require('posthog-node');
    client = new PostHog(KEY, {
      host: HOST,
      // A local server keeps a long-lived process, so batch a little; a
      // serverless-style short run flushes through shutdown().
      flushAt: 20,
      flushInterval: 3000,
      ...(HOST_IS_LOCAL ? { disableGeoip: true } : {}),
    });
    client.on('error', (err) => {
      console.warn('[ace] posthog error:', err && err.message ? err.message : err);
    });
  } catch (err) {
    loadError = err;
    console.warn(
      '[ace] posthog disabled — @posthog/ai or posthog-node is not installed:',
      err && err.message ? err.message : err
    );
  }
  return client;
}

function secondsSince(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1e9;
}

function firstNumber(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

/**
 * Pull token usage out of the response shapes of the common providers.
 * Returns undefined when the provider reported no usage at all.
 */
function usageFromResponse(response) {
  if (!response || typeof response !== 'object') return undefined;

  // Google Gemini (generateContent): usageMetadata.promptTokenCount / candidatesTokenCount
  const meta = response.usageMetadata || (response.response && response.response.usageMetadata);
  if (meta && typeof meta === 'object') {
    const inputTokens = firstNumber(meta.promptTokenCount, meta.inputTokenCount);
    const outputTokens = firstNumber(meta.candidatesTokenCount, meta.outputTokenCount);
    const thoughtTokens = firstNumber(meta.thoughtsTokenCount);
    if (inputTokens === undefined && outputTokens === undefined) return undefined;
    return {
      inputTokens,
      outputTokens,
      ...(thoughtTokens === undefined ? {} : { reasoningTokens: thoughtTokens }),
      rawUsage: meta,
    };
  }

  // OpenAI-compatible chat/responses and Anthropic messages: usage.*
  const usage = response.usage;
  if (usage && typeof usage === 'object') {
    const inputTokens = firstNumber(
      usage.prompt_tokens,
      usage.input_tokens,
      usage.inputTokens,
      usage.promptTokens
    );
    const outputTokens = firstNumber(
      usage.completion_tokens,
      usage.output_tokens,
      usage.outputTokens,
      usage.completionTokens
    );
    if (inputTokens === undefined && outputTokens === undefined) return undefined;
    const details = usage.prompt_tokens_details || usage.input_tokens_details || {};
    const cacheReadInputTokens = firstNumber(
      details.cached_tokens,
      usage.cache_read_input_tokens
    );
    const cacheCreationInputTokens = firstNumber(usage.cache_creation_input_tokens);
    return {
      inputTokens,
      outputTokens,
      ...(cacheReadInputTokens === undefined ? {} : { cacheReadInputTokens }),
      ...(cacheCreationInputTokens === undefined ? {} : { cacheCreationInputTokens }),
      rawUsage: usage,
    };
  }

  return undefined;
}

/** Pull the model's text out of a provider response, without inventing any. */
function outputFromResponse(response) {
  if (response === null || response === undefined) return undefined;
  if (typeof response === 'string') return response;
  if (typeof response !== 'object') return response;

  // Google Gemini
  if (typeof response.text === 'string') return response.text;

  // OpenAI chat completions
  const choice = Array.isArray(response.choices) ? response.choices[0] : null;
  if (choice) {
    if (choice.message) return choice.message.content === undefined ? choice.message : choice.message.content;
    if (typeof choice.text === 'string') return choice.text;
  }

  // OpenAI Responses API
  if (typeof response.output_text === 'string') return response.output_text;

  // Anthropic messages
  if (Array.isArray(response.content)) return response.content;

  // Gemini raw candidate shape
  const candidates = Array.isArray(response.candidates) ? response.candidates : null;
  if (candidates && candidates[0] && candidates[0].content) return candidates[0].content;

  // Unknown shape: hand the response through so nothing is silently dropped.
  return response;
}

/**
 * Record one generation. Never throws; resolves even when PostHog is off or
 * the send fails.
 */
async function captureGeneration(options = {}) {
  const phClient = getClient();
  if (!phClient) return false;
  try {
    const { captureAiGeneration } = require('@posthog/ai');
    await captureAiGeneration(phClient, {
      distinctId: options.distinctId || 'ace-server',
      traceId: options.traceId,
      model: options.model,
      provider: options.provider || 'unknown',
      input: options.input,
      output: options.output,
      modelParameters: options.modelParameters,
      latency: options.latency,
      timeToFirstToken: options.timeToFirstToken,
      usage: options.usage,
      tools: options.tools,
      stopReason: options.stopReason,
      properties: options.properties,
      groups: options.groups,
      privacyMode: options.privacyMode,
      costOverride: options.costOverride,
      captureImmediate: options.captureImmediate,
      error: options.error,
      onError: (err) => {
        console.warn('[ace] posthog ai capture failed:', err && err.message ? err.message : err);
      },
    });
    return true;
  } catch (err) {
    console.warn('[ace] posthog ai capture failed:', err && err.message ? err.message : err);
    return false;
  }
}

/**
 * Run a provider call and send it to PostHog as one `$ai_generation`.
 *
 * The provider's return value is passed back unchanged, and an error is
 * re-thrown unchanged, so enabling telemetry cannot alter AI behaviour.
 */
async function traceGeneration(options = {}) {
  const { call, ...rest } = options;
  if (typeof call !== 'function') {
    throw new TypeError('traceGeneration requires a call() function');
  }

  const startedAt = process.hrtime.bigint();
  try {
    const response = await call();
    await captureGeneration({
      ...rest,
      output: rest.output === undefined ? outputFromResponse(response) : rest.output,
      usage: rest.usage === undefined ? usageFromResponse(response) : rest.usage,
      latency: rest.latency === undefined ? secondsSince(startedAt) : rest.latency,
    });
    return response;
  } catch (error) {
    await captureGeneration({
      ...rest,
      output: rest.output,
      latency: rest.latency === undefined ? secondsSince(startedAt) : rest.latency,
      error,
    });
    throw error;
  }
}

/** Flush queued events. Safe to call when telemetry is off. Never rejects. */
async function shutdown() {
  if (!client) return;
  const active = client;
  client = null;
  try {
    await active.shutdown();
  } catch (err) {
    console.warn('[ace] posthog shutdown failed:', err && err.message ? err.message : err);
  }
}

module.exports = {
  isEnabled,
  getClient,
  captureGeneration,
  traceGeneration,
  usageFromResponse,
  outputFromResponse,
  shutdown,
};
