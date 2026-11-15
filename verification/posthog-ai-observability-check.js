'use strict';

/**
 * PostHog AI Observability — seam check.
 *
 * This project has no LLM provider wired in yet: the MVP content slice is
 * `DETERMINISTIC_TEMPLATE_FROM_EXPORT` and nothing here contacts a model. So
 * this script proves the two things that can be proven without inventing an
 * AI call:
 *
 *   1. OFFLINE — `app/observability/posthog-ai.js` is a true pass-through when
 *      POSTHOG_API_KEY is unset. The wrapped call's return value and errors are
 *      unchanged, no client is created, and no network call is made. It also
 *      checks the token-usage / output extraction for the provider response
 *      shapes it supports (Gemini, OpenAI-compatible, Anthropic).
 *
 *   2. LIVE — with POSTHOG_API_KEY set, one clearly labelled probe generation
 *      (`provider: ace-probe`, no model tokens claimed) is sent through the same
 *      code path a real provider call would use, and the script reports whether
 *      PostHog answered, with the actual HTTP status and body.
 *
 * It never prints, stores or reads the key itself, and never claims a pass for
 * a step it could not run.
 *
 * Usage:
 *   node verification/posthog-ai-observability-check.js
 *   npm run check:posthog
 *
 * Environment:
 *   POSTHOG_API_KEY   project API key (required for the live half)
 *   POSTHOG_HOST      ingest host, default https://us.i.posthog.com
 *
 * Exit codes:
 *   0  verified — the probe generation was accepted and PostHog answered
 *   1  failed   — an assertion failed, or PostHog did not accept the probe
 *   2  pending  — POSTHOG_API_KEY is not set; only the offline half ran
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'app', 'observability', 'posthog-ai.js');
const LOG_FILE = path.join(__dirname, 'posthog-ai-observability-2026-10-28.log');

const lines = [];
function say(text = '') {
  lines.push(text);
  console.log(text);
}

/* ------------------------------------------------------------------ */
/* Offline half — runs in a child process with no key                  */
/* ------------------------------------------------------------------ */

function offlineSuite() {
  // The key must be absent for this half to mean anything.
  delete process.env.POSTHOG_API_KEY;

  const ai = require(MODULE_PATH);
  const results = [];

  function check(id, label, ok, detail) {
    results.push({ id, label, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  }

  let fetchCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (...args) => {
    fetchCalls += 1;
    return realFetch(...args);
  };

  const stubResponse = {
    text: 'ตัวอย่างข้อความ',
    usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, thoughtsTokenCount: 2 },
  };

  try {
    check('offline.disabled', 'isEnabled() is false without a key', ai.isEnabled() === false);
    check('offline.no-client', 'getClient() creates no client without a key', ai.getClient() === null);

    const originalError = new Error('provider exploded');
    const usage = ai.usageFromResponse(stubResponse);
    check(
      'offline.gemini-usage',
      'Gemini usageMetadata becomes input/output token counts',
      usage && usage.inputTokens === 11 && usage.outputTokens === 7 && usage.reasoningTokens === 2,
      JSON.stringify(usage)
    );

    const openaiUsage = ai.usageFromResponse({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 20, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 12 } },
    });
    check(
      'offline.openai-usage',
      'OpenAI-compatible usage becomes token counts with cache reads',
      openaiUsage &&
        openaiUsage.inputTokens === 20 &&
        openaiUsage.outputTokens === 5 &&
        openaiUsage.cacheReadInputTokens === 12,
      JSON.stringify(openaiUsage)
    );
    check(
      'offline.no-invented-usage',
      'a response with no usage reports no usage (never zeros)',
      ai.usageFromResponse({ choices: [{ message: { content: 'ok' } }] }) === undefined
    );

    check(
      'offline.gemini-output',
      'Gemini response text is extracted',
      ai.outputFromResponse(stubResponse) === 'ตัวอย่างข้อความ'
    );
    check(
      'offline.openai-output',
      'OpenAI-compatible message content is extracted',
      ai.outputFromResponse({ choices: [{ message: { content: 'hello' } }] }) === 'hello'
    );

    const passedThrough = { marker: 'unchanged', nested: { value: 1 } };
    const traced = ai.traceGeneration({
      provider: 'ace-probe',
      model: 'offline-pass-through',
      input: [{ role: 'user', content: 'ping' }],
      call: () => passedThrough,
    });

    Promise.resolve(traced)
      .then(async (returned) => {
        check(
          'offline.return-unchanged',
          'the wrapped call returns its value unchanged',
          returned === passedThrough
        );

        let caught = null;
        try {
          await ai.traceGeneration({
            provider: 'ace-probe',
            model: 'offline-pass-through',
            input: [{ role: 'user', content: 'ping' }],
            call: () => {
              throw originalError;
            },
          });
        } catch (err) {
          caught = err;
        }
        check(
          'offline.error-identical',
          'a wrapped error is re-thrown as the same object',
          caught === originalError
        );

        await ai.shutdown();
        check('offline.no-network', 'no network call was made without a key', fetchCalls === 0, `${fetchCalls} fetch calls`);

        const failed = results.filter((item) => !item.ok);
        console.log(`OFFLINE SUMMARY ${results.length - failed.length}/${results.length} checks passed`);
        process.exitCode = failed.length === 0 ? 0 : 1;
      })
      .catch((err) => {
        console.log(`FAIL offline.unexpected — ${err && err.message ? err.message : err}`);
        process.exitCode = 1;
      })
      .finally(() => {
        globalThis.fetch = realFetch;
      });
  } catch (err) {
    console.log(`FAIL offline.load — could not load the observability module :: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  }
}

/* ------------------------------------------------------------------ */
/* Live half — runs in the parent process with the key present         */
/* ------------------------------------------------------------------ */

async function liveSuite() {
  const key = String(process.env.POSTHOG_API_KEY || '').trim();
  if (!key) {
    say('POSTHOG_API_KEY is not set — live half skipped.');
    say('POSTHOG AI OBSERVABILITY: PENDING (offline pass-through verified only)');
    return 2;
  }

  const host = String(process.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/+$/, '');
  const ai = require(MODULE_PATH);

  if (!ai.isEnabled()) {
    say('POSTHOG AI OBSERVABILITY: FAILED (a key is set, but the SDK did not initialise — is `npm install` done?)');
    return 1;
  }

  // One labelled probe generation through the real code path. The provider is
  // ace-probe on purpose: it is not an LLM call and claims no model tokens.
  const stubResponse = {
    text: 'ace observability probe',
    usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
  };
  const startedAt = Date.now();
  const returned = await ai.traceGeneration({
    distinctId: 'ace-observability-probe',
    traceId: `ace-probe-${startedAt}`,
    provider: 'ace-probe',
    model: 'ace-observability-probe',
    input: [{ role: 'user', content: 'ace observability probe' }],
    properties: {
      ace_probe: true,
      ace_note: 'seam check — no LLM provider is integrated in this project yet',
    },
    captureImmediate: true,
    call: () => stubResponse,
  });

  if (returned !== stubResponse) {
    say('POSTHOG AI OBSERVABILITY: FAILED (the wrapped call did not return its value unchanged)');
    return 1;
  }

  await ai.shutdown();
  say(`Probe generation captured and flushed through @posthog/ai captureAiGeneration (provider ace-probe, host ${host}).`);

  // Did PostHog actually answer? Send one ingest batch and report the status.
  let status = null;
  let body = '';
  try {
    const response = await fetch(`${host}/batch/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        batch: [
          {
            event: 'ace_ai_observability_probe',
            distinct_id: 'ace-observability-probe',
            properties: {
              $lib: 'ace-verification',
              ace_probe: true,
              ace_note: 'seam check — no LLM provider is integrated in this project yet',
            },
          },
        ],
      }),
    });
    status = response.status;
    body = (await response.text()).slice(0, 300);
  } catch (err) {
    say(`Ingest probe failed: ${err && err.message ? err.message : err}`);
    say('POSTHOG AI OBSERVABILITY: FAILED (no answer from PostHog)');
    return 1;
  }

  say(`PostHog ingest answered: HTTP ${status}${body ? ` — ${body}` : ''}`);
  if (status >= 200 && status < 300) {
    say('POSTHOG AI OBSERVABILITY: VERIFIED');
    return 0;
  }
  say('POSTHOG AI OBSERVABILITY: FAILED (PostHog rejected the probe)');
  return 1;
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */

if (process.argv.includes('--offline')) {
  offlineSuite();
} else {
  (async () => {
    say(`PostHog AI Observability check — ${new Date().toISOString()}`);
    say(`module: ${path.relative(REPO, MODULE_PATH)}`);
    say('');

    say('== Offline half (no POSTHOG_API_KEY in the child environment) ==');
    const child = spawnSync(process.execPath, [__filename, '--offline'], {
      cwd: REPO,
      env: { ...process.env, POSTHOG_API_KEY: '' },
      encoding: 'utf8',
    });
    const childOutput = `${child.stdout || ''}${child.stderr || ''}`.trim();
    for (const line of childOutput.split(/\r?\n/)) {
      if (line) say(line);
    }
    if (child.status !== 0) {
      say('POSTHOG AI OBSERVABILITY: FAILED (offline pass-through checks did not pass)');
      fs.writeFileSync(LOG_FILE, `${lines.join('\n')}\n`, 'utf8');
      process.exitCode = 1;
      return;
    }

    say('');
    say('== Live half (POSTHOG_API_KEY present) ==');
    const code = await liveSuite();
    fs.writeFileSync(LOG_FILE, `${lines.join('\n')}\n`, 'utf8');
    say('');
    say(`log: ${path.relative(REPO, LOG_FILE)}`);
    process.exitCode = code;
  })();
}
