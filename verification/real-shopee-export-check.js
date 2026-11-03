'use strict';

/**
 * Real Shopee Affiliate export — evidence checker.
 *
 * The import slice is only *proven* for a real file once a real Shopee
 * Affiliate export has been imported. This script looks for such a file in
 * the agreed drop locations and, when it finds one, runs the real import
 * through the API and reports the ACTUAL status codes and bodies.
 *
 * It never invents data and it never claims the real-file evidence on its
 * own. When no real export is present it reports the blocker:
 *
 *     REAL SHOPEE EXPORT PENDING
 *
 * and exits with code 2 (pending), which is deliberately different from
 * 0 (verified) and 1 (failed).
 *
 * The report is organised around the four things that can only be checked
 * against a real file:
 *
 *   1. HEADER      — the real header row, column by column.
 *   2. ALIAS       — which canonical field each real column was mapped to.
 *   3. ENCODING    — the real format/encoding/delimiter that was detected.
 *   4. ROW COUNT   — how many rows were valid / invalid / duplicate / unknown.
 *
 * Guard rail: a file that identifies itself as a synthetic fixture is
 * rejected with exit code 1. A fixture must never be reported as
 * real-export evidence, whatever it is named.
 *
 * ---------------------------------------------------------------------------
 * SIDE EFFECTS (disclosed, not denied)
 * ---------------------------------------------------------------------------
 * When an export candidate is found, one run does exactly this:
 *
 *   1. reads the input file and computes its sha256 (input is never written);
 *   2. creates a temporary workspace under the OS temp directory
 *      (<tmp>/ace-real-export-<random>) and copies `app/` plus
 *      `docs/mission1/schemas/` into it — the repository copy, not the repo;
 *   3. starts ONE local Node server (`app/server.js`) from that workspace,
 *      bound to 127.0.0.1 on a dynamically chosen free port;
 *   4. sends local HTTP requests to that server only (`/api/health`,
 *      `/api/mvp/import/preview`, `/api/mvp/import/commit`,
 *      `/api/mvp/staging/:id/research`, `/api/mvp/state`);
 *   5. writes run evidence (`.jsonl`, `.final.json`, `.log`) to the evidence
 *      directory (see below);
 *   6. stops the local server and deletes the temporary workspace.
 *
 * Inside the workspace the server creates and mutates
 * `<workspace>/data/app/state.json`, `<workspace>/mvp-runtime/*` and
 * `<workspace>/mvp-runtime/exports` — never the repository copies.
 *
 * It does NOT intentionally: contact any external network, read `.env`, use
 * API credentials, modify `data/app/state.json` or any tracked file, import a
 * real Shopee export into the repository's production state, or modify
 * unrelated repository files.
 *
 * Absence of side effects is NOT claimed: the child server is the real
 * application server and any side effect that server has inside the workspace
 * also occurs there. `--dry-run` performs none of steps 2-6.
 *
 * Evidence directory: `$ACE_IMPORT_ROOT/evidence` when ACE_IMPORT_ROOT is set
 * and writable, otherwise `<os.tmpdir()>/ace-real-export-evidence`.
 * Evidence filenames embed a run id (`<timestamp>-<pid>-<random>`), so runs
 * never overwrite each other. A `.jsonl` without a matching `.final.json`
 * means the run did not finish (interrupted, force-terminated, or crashed).
 *
 * ---------------------------------------------------------------------------
 * Usage
 * ---------------------------------------------------------------------------
 *   node verification/real-shopee-export-check.js [path] [options]
 *
 * Options:
 *   --dry-run      read-only plan: no workspace, no server, no evidence file.
 *                  Never returns 0 — nothing is verified, exit code is 2.
 *   --keep-temp    do not delete the temporary workspace; the retained path is
 *                  printed and recorded in the evidence.
 *   --help, -h     print usage, exit codes and disclosures; exit code 1
 *
 * Environment overrides (all optional):
 *   ACE_REAL_SHOPEE_EXPORT    path to the export file
 *   ACE_REAL_MAPPING_FILE     JSON file {field: columnIndex} confirmed by a human
 *   ACE_REAL_ACCOUNT_ID       account id recorded with the import
 *   ACE_REAL_ACCOUNT_LABEL    account label recorded with the import
 *   ACE_REAL_DATE_FROM        YYYY-MM-DD lower bound of the reported date range
 *   ACE_REAL_DATE_TO          YYYY-MM-DD upper bound of the reported date range
 *   REAL_EXPORT_PORT          fixed port for the throwaway server; if that port
 *                             is taken the run FAILS (it is never silently moved)
 *   ACE_IMPORT_ROOT           external data root (e.g. Y:\ACE Data\imports)
 *   ACE_CHECK_TIMEOUT_SCALE   test aid: multiplies every wait/timeout (default 1)
 *
 * Exit codes (contract preserved — no new codes):
 *   0  verified   — preview, commit and promote all succeeded, and the child
 *                   server was confirmed terminated
 *   1  failed     — the import contract failed, the file is a fixture, the
 *                   server could not start or stay up, the checker crashed
 *   2  pending    — no real export was found (also: --dry-run)
 *   3  partial    — the file was staged, but promotion could not complete
 *
 * Searched locations (first match wins):
 *   1. the path given on the command line
 *   2. $ACE_REAL_SHOPEE_EXPORT
 *   3. $ACE_IMPORT_ROOT\raw (if set)
 *   4. data/imports/ and data/mvp/real/ in this repository
 *
 * ---------------------------------------------------------------------------
 * Verification limitations (reported with every run, never hidden)
 * ---------------------------------------------------------------------------
 * - The child's "Mission 1 slice running at http://..." line is printed inside
 *   the `server.listen` callback in app/server.js, so it is only emitted after
 *   a successful bind. It carries no pid or nonce, so ownership rests on three
 *   facts together: a port freshly allocated for this run, that line observed
 *   on THIS child's stdout, and the child still being alive. A health check at
 *   the right port also passes if the child is alive but never listened; the
 *   startup line, not HTTP 200, is what gates every API call.
 * - Bind-then-close port allocation has a residual TOCTOU race: another local
 *   process can take the port between the probe and the child's bind. When that
 *   happens the child dies with EADDRINUSE and the run retries with a new port
 *   (ephemeral mode only) up to 3 times.
 * - On Windows `child.kill()` terminates the child unconditionally; the
 *   SIGTERM handlers in app/server.js are NOT relied on and this script does
 *   not describe the shutdown as graceful. Only the direct child is signalled:
 *   the child's own process tree is not enumerated or terminated.
 * - If this process is force-terminated (SIGKILL, `taskkill /F`, console window
 *   closed, machine reset) no cleanup runs and a leftover workspace and a
 *   still-running local server are possible. The `.jsonl` left behind is the
 *   only record of that run.
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const CHECKER_VERSION = 2;
const REPO = path.resolve(__dirname, '..');
const EXTENSIONS = new Set(['.csv', '.tsv', '.xlsx', '.json']);
const REUSABLE_ENCODINGS = new Set(['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be', 'windows-874']);

/** Frozen exit-code contract. No code 4 is introduced. */
const EXIT = Object.freeze({ VERIFIED: 0, FAILED: 1, PENDING: 2, PARTIAL: 3 });

const ACE_IMPORT_ROOT = process.env.ACE_IMPORT_ROOT ? path.resolve(process.env.ACE_IMPORT_ROOT) : null;

const searchDirs = [];
if (ACE_IMPORT_ROOT) {
  searchDirs.push(path.join(ACE_IMPORT_ROOT, 'raw'));
}
searchDirs.push(path.join(REPO, 'data', 'imports'));
searchDirs.push(path.join(REPO, 'data', 'mvp', 'real'));

const TIMEOUT_SCALE = (() => {
  const raw = Number(process.env.ACE_CHECK_TIMEOUT_SCALE);
  return Number.isFinite(raw) && raw > 0 && raw <= 60 ? raw : 1;
})();

const LIMITS = Object.freeze({
  readinessMs: Math.round(5000 * TIMEOUT_SCALE),
  healthPollMs: Math.round(3000 * TIMEOUT_SCALE),
  healthPollEveryMs: Math.round(200 * TIMEOUT_SCALE),
  apiCallMs: Math.round(15000 * TIMEOUT_SCALE),
  sigtermGraceMs: Math.round(3000 * TIMEOUT_SCALE),
  sigkillGraceMs: Math.round(2000 * TIMEOUT_SCALE),
  closeGraceMs: Math.round(1000 * TIMEOUT_SCALE),
  portRetries: 3,
  cleanupRetries: 3,
  stdioTailBytes: 64 * 1024,
  maxAttemptsRecorded: 40,
});

/** Characters of stdout retained in diagnostics.stdout_tail. Named so the cap and
 *  the evidence that records it cannot drift apart. */
const STDOUT_TAIL_LIMIT_CHARS = 2500;

const STARTUP_LINE_RE = /\[ace\] Mission 1 slice running at https?:\/\/[^\s/]+:(\d+)/;

/* ------------------------------------------------------------------ */
/* small utilities                                                     */
/* ------------------------------------------------------------------ */

function nowIso() {
  return new Date().toISOString();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeDeferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

/** Cancellation shared by every wait in a run (SIGINT / SIGTERM). */
const CANCEL = { interrupted: false, signal: null, at: null, deferred: makeDeferred() };

function onSignal(signal) {
  if (CANCEL.interrupted) {
    console.error(`[ace-check] already interrupting (${CANCEL.signal}); finishing the current finalization`);
    return;
  }
  CANCEL.interrupted = true;
  CANCEL.signal = signal;
  CANCEL.at = nowIso();
  console.error(`[ace-check] ${signal} received — stopping work and finalizing (evidence will be written)`);
  CANCEL.deferred.resolve({ aborted: true, signal });
}

/** Sleep that returns early when the run is interrupted. */
async function sleep(ms) {
  return Promise.race([delay(ms).then(() => ({ aborted: false })), CANCEL.deferred.promise]);
}

function makeRunId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
  return `${stamp}-${process.pid}-${crypto.randomBytes(2).toString('hex')}`;
}

function normCase(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isInside(parent, child) {
  const p = normCase(path.resolve(parent));
  const c = normCase(path.resolve(child));
  return c === p || c.startsWith(`${p}${path.sep}`);
}

function displayPath(file) {
  const abs = path.resolve(file);
  return isInside(REPO, abs) ? path.relative(REPO, abs) : abs;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Rolling text tail so a noisy child cannot exhaust memory. */
function createTail(limit = LIMITS.stdioTailBytes) {
  let text = '';
  let bytes = 0;
  return {
    push(chunk) {
      bytes += chunk.length;
      text += chunk.toString('utf8');
      if (text.length > limit) text = text.slice(text.length - limit);
    },
    get() { return text; },
    bytes() { return bytes; },
  };
}

const SECRET_NAME_RE = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH)/i;

/** Redact credential-shaped text before it reaches a log or the evidence. */
function redactText(input, limit = 4000) {
  if (typeof input !== 'string') return '';
  let out = input.length > limit ? `${input.slice(0, limit)}\n…[truncated ${input.length - limit} chars]` : input;
  out = out.replace(/([A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH)[A-Za-z0-9_]*)\s*[=:]\s*\S+/gi, '$1=***');
  out = out.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***');
  out = out.replace(/(Bearer\s+)[A-Za-z0-9._-]{8,}/gi, '$1***');
  return out;
}

/* ------------------------------------------------------------------ */
/* arguments                                                           */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const options = { path: null, dryRun: false, keepTemp: false, help: false, unknown: [], extra: [] };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--keep-temp') options.keepTemp = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--')) options.unknown.push(arg);
    else if (!options.path) options.path = arg;
    else options.extra.push(arg);
  }
  return options;
}

const OPTIONS = parseArgs(process.argv.slice(2));

function readPortOverride() {
  const raw = process.env.REAL_EXPORT_PORT;
  if (raw === undefined || raw === '') return { port: null };
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'INVALID_PORT_OVERRIDE', detail: `REAL_EXPORT_PORT must be an integer 1-65535 (got ${JSON.stringify(raw)})` };
  }
  return { port };
}

/* ------------------------------------------------------------------ */
/* evidence recorder                                                   */
/* ------------------------------------------------------------------ */

function resolveEvidenceDir() {
  // Evidence is a record of a user's export; it must never be written inside the
  // repository, where a later `git add` could carry it away. A misconfigured
  // ACE_IMPORT_ROOT is refused here and the run falls back to the OS temp directory.
  let rejected = null;
  if (ACE_IMPORT_ROOT) {
    const candidate = path.join(ACE_IMPORT_ROOT, 'evidence');
    if (isInside(REPO, candidate)) {
      rejected = {
        requested: displayPath(candidate),
        requested_abs: path.resolve(candidate),
        reason: 'EVIDENCE_DIR_INSIDE_REPOSITORY',
        detail: 'evidence is never written inside the repository; the OS temp directory is used instead',
      };
      console.error('');
      console.error(`WARN  ACE_IMPORT_ROOT resolves inside the repository (${rejected.requested}).`);
      console.error('      Refusing to write evidence there; nothing is created in the repository.');
      console.error('      Evidence goes to the OS temp directory instead.');
    } else {
      try {
        if (!fs.existsSync(candidate)) fs.mkdirSync(candidate, { recursive: true });
        return { dir: candidate, source: 'ACE_IMPORT_ROOT/evidence', rejected: null };
      } catch {
        /* fall through to temp */
      }
    }
  }
  const tmpEvidence = path.join(os.tmpdir(), 'ace-real-export-evidence');
  try {
    if (!fs.existsSync(tmpEvidence)) fs.mkdirSync(tmpEvidence, { recursive: true });
    return { dir: tmpEvidence, source: 'os.tmpdir()/ace-real-export-evidence', rejected };
  } catch (err) {
    return { dir: os.tmpdir(), source: 'os.tmpdir() (fallback)', rejected, error: err && err.message ? err.message : String(err) };
  }
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_key, val) => (typeof val === 'undefined' ? null : val)));
}

class RunRecorder {
  constructor({ dryRun = false } = {}) {
    this.runId = makeRunId();
    this.dryRun = dryRun;
    this.startedAt = nowIso();
    this.events = [];
    this.dir = null;
    this.dirSource = null;
    this.dirRejection = null;
    this.paths = {};
    this.appendFailures = 0;
    this.appendError = null;
    this.finalWritten = false;
    this.finalError = null;
  }

  ensureDir() {
    if (this.dir) return this.dir;
    const resolved = resolveEvidenceDir();
    this.dir = resolved.dir;
    this.dirSource = resolved.source;
    this.dirRejection = resolved.rejected || null;
    if (resolved.error) this.appendError = resolved.error;
    return this.dir;
  }

  step(name, data) {
    const record = { at: nowIso(), type: 'step', step: name, data: jsonSafe(data || {}) };
    this.events.push(record);
    if (this.dryRun) return record;
    try {
      const dir = this.ensureDir();
      const file = path.join(dir, `real-shopee-export-check-${this.runId}.jsonl`);
      fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
      this.paths.jsonl = file;
    } catch (err) {
      this.appendFailures += 1;
      this.appendError = err && err.code ? err.code : (err && err.message ? err.message : String(err));
    }
    return record;
  }

  begin(meta) {
    return this.step('run_start', { state: 'IN_PROGRESS', run_id: this.runId, checker_version: CHECKER_VERSION, ...meta });
  }

  get evidenceResult() {
    if (this.finalWritten) return 'WRITTEN';
    if (this.paths.jsonl) return 'APPEND_ONLY';
    return 'WRITE_FAILED';
  }

  /**
   * Derived fields (overall_result, evidence_result) can only be known after the
   * first write, so they are patched in with one more atomic write. A failed
   * first write leaves no file, and the negative result is reported on stderr.
   */
  patchFinal(fields) {
    if (!this.finalWritten || !this.paths.final) return false;
    try {
      const current = JSON.parse(fs.readFileSync(this.paths.final, 'utf8'));
      const merged = { ...current, ...fields };
      const tmp = `${this.paths.final}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
      fs.renameSync(tmp, this.paths.final);
      return true;
    } catch (err) {
      this.appendError = err && err.message ? err.message : String(err);
      return false;
    }
  }

  finish(payload) {
    if (this.dryRun) {
      this.paths = {};
      return { planned_dir: null, paths: {}, evidence_result: 'WRITE_FAILED', dry_run: true };
    }
    let dir;
    try {
      dir = this.ensureDir();
    } catch (err) {
      this.finalError = err && err.message ? err.message : String(err);
      return { planned_dir: null, paths: {}, evidence_result: 'WRITE_FAILED', error: this.finalError };
    }
    const base = path.join(dir, `real-shopee-export-check-${this.runId}`);
    const finalPayload = { ...payload, run_id: this.runId, checker_version: CHECKER_VERSION, events: this.events,
      evidence_write: { append_failures: this.appendFailures, append_error: this.appendError, dir_source: this.dirSource, dir_rejected: this.dirRejection } };
    try {
      const target = `${base}.final.json`;
      const tmp = `${target}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, `${JSON.stringify(jsonSafe(finalPayload), null, 2)}\n`, 'utf8');
      fs.renameSync(tmp, target);
      this.paths.final = target;
      this.finalWritten = true;
    } catch (err) {
      this.finalError = err && err.code ? err.code : (err && err.message ? err.message : String(err));
    }
    try {
      const logTarget = `${base}.log`;
      const lines = [`=== Real Shopee Affiliate export check ===`, `run_id: ${this.runId}`, `checked_at: ${nowIso()}`];
      for (const event of this.events) lines.push(`[${event.at}] ${event.step} ${JSON.stringify(event.data)}`);
      lines.push('', `FINAL ${JSON.stringify(jsonSafe(finalPayload.summary || {}))}`, '');
      fs.writeFileSync(logTarget, redactText(lines.join('\n'), 200000), 'utf8');
      this.paths.log = logTarget;
    } catch (err) {
      if (!this.finalError) this.finalError = err && err.message ? err.message : String(err);
    }
    return {
      planned_dir: dir,
      dir_source: this.dirSource,
      dir_rejected: this.dirRejection,
      paths: { ...this.paths },
      evidence_result: this.evidenceResult,
      append_failures: this.appendFailures,
      error: this.finalError,
    };
  }
}

/* ------------------------------------------------------------------ */
/* child environment (allowlist, never a spread of process.env)        */
/* ------------------------------------------------------------------ */

const CHILD_ENV_ALLOWLIST = Object.freeze([
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'TEMP',
  'TMP',
]);

const CHILD_ENV_DENYLIST_REASONS = Object.freeze({
  NODE_OPTIONS: 'code-injection vector for the child runtime',
  NODE_PATH: 'would change module resolution in the child',
  NODE_EXTRA_CA_CERTS: 'would change TLS trust',
  NODE_TLS_REJECT_UNAUTHORIZED: 'would change TLS trust',
  SSL_CERT_FILE: 'would change TLS trust',
  SSL_CERT_DIR: 'would change TLS trust',
  NODE_DEBUG: 'would flood stderr with internals used as evidence',
  NODE_DEBUG_NATIVE: 'would flood stderr with internals used as evidence',
  UV_THREADPOOL_SIZE: 'would change child concurrency',
  HTTP_PROXY: 'would reroute local traffic',
  HTTPS_PROXY: 'would reroute local traffic',
  ALL_PROXY: 'would reroute local traffic',
  NO_PROXY: 'would reroute local traffic',
  TZ: 'would change date interpretation used by the import',
  LANG: 'would change locale used by the import',
  LC_ALL: 'would change locale used by the import',
  LANGUAGE: 'would change locale used by the import',
  ACE_LLM_LIVE_ENABLED: 'would enable live external model calls',
  ACE_IMPORT_ROOT: 'checker-only setting; the child must not learn external paths',
  ACE_MVP_ASSETS_DIR: 'would redirect child writes outside the workspace',
  ACE_MVP_EXPORTS_DIR: 'would redirect child writes outside the workspace',
  ACE_CONTENT_LIBRARY_FILE: 'would redirect child writes outside the workspace',
  ACE_CHECK_TIMEOUT_SCALE: 'checker-only setting',
});

function denyReason(name) {
  const upper = name.toUpperCase();
  if (CHILD_ENV_DENYLIST_REASONS[upper]) return CHILD_ENV_DENYLIST_REASONS[upper];
  if (/^ACE_REAL_/.test(upper)) return 'checker-only setting';
  if (SECRET_NAME_RE.test(upper)) return 'credential or secret-shaped name';
  return 'not on the child allowlist';
}

/**
 * Deterministic, independently testable child environment builder.
 * Returns the env to pass plus the names that were withheld (names only,
 * never values).
 */
function buildChildEnv(parentEnv, { host, port, stateFile, stagingFile }) {
  const env = {};
  const excluded = [];
  for (const name of Object.keys(parentEnv || {}).sort()) {
    const upper = name.toUpperCase();
    if (upper === 'HOST' || upper === 'PORT' || upper === 'ACE_MVP_STATE_FILE' || upper === 'ACE_MVP_STAGING_FILE') {
      excluded.push({ name, reason: 'set explicitly by the checker' });
      continue;
    }
    if (CHILD_ENV_ALLOWLIST.includes(upper)) {
      env[name] = parentEnv[name];
      continue;
    }
    excluded.push({ name, reason: denyReason(name) });
  }
  env.HOST = host;
  env.PORT = String(port);
  env.ACE_MVP_STATE_FILE = stateFile;
  env.ACE_MVP_STAGING_FILE = stagingFile;
  return { env, excluded, allowlist: [...CHILD_ENV_ALLOWLIST] };
}

/* ------------------------------------------------------------------ */
/* port allocation                                                     */
/* ------------------------------------------------------------------ */

function probePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };
    server.once('error', (err) => done({ available: false, error: err && err.code ? err.code : String(err) }));
    server.listen({ host: '127.0.0.1', port }, () => {
      const address = server.address();
      const bound = address && typeof address === 'object' ? address.port : port;
      server.close(() => done({ available: true, port: bound }));
    });
  });
}

async function allocatePort({ requestedPort, attempt }) {
  if (requestedPort) {
    const probe = await probePort(requestedPort);
    if (!probe.available) {
      return { mode: 'explicit', requested: requestedPort, probe, error: 'PORT_COLLISION' };
    }
    return { mode: 'explicit', requested: requestedPort, port: requestedPort, probe, attempt };
  }
  const probe = await probePort(0);
  if (!probe.available) {
    return { mode: 'ephemeral', probe, error: 'PORT_ALLOCATION_FAILED' };
  }
  return { mode: 'ephemeral', port: probe.port, probe, attempt, toctou: 'bind-then-close: the port can be taken between probe and child bind' };
}

/* ------------------------------------------------------------------ */
/* temporary workspace                                                 */
/* ------------------------------------------------------------------ */

let WORKSPACE = null;

function directoryBytes(dir) {
  let total = 0;
  let entries = 0;
  const walk = (current) => {
    let items;
    try { items = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const item of items) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.isFile()) {
        try { total += fs.statSync(full).size; entries += 1; } catch { /* ignore */ }
      }
    }
  };
  walk(dir);
  return { bytes: total, files: entries };
}

function isSafeWorkspacePath(dir) {
  if (!dir) return false;
  const base = normCase(path.join(os.tmpdir(), 'ace-real-export-'));
  const target = normCase(path.resolve(dir));
  return target.startsWith(base) && path.basename(path.resolve(dir)).startsWith('ace-real-export-');
}

/*
 * Files that are never copied into the throwaway workspace. The server only
 * needs source that it can require and static assets it can serve, so backup
 * copies, agent scratch copies and locally rendered media are left behind: they
 * are stale, they are large, and no route reads them.
 */
const COPY_EXCLUDE = Object.freeze([
  { reason: 'source backup copy', match: (name) => /\.(bak\d*|backup\d*|orig|rej)$/i.test(name) },
  { reason: 'agent scratch copy of a source file', match: (name) => /\.js\.(ace-mission-|phase|pre-fix-|repair-|stage-)[^/]*$/i.test(name) },
  { reason: 'locally rendered media', match: (name, rel) => rel.split('/')[0] === 'exports' },
]);

function copySkipReason(src, copyRoot) {
  let stat;
  try { stat = fs.statSync(src); } catch { return null; }
  if (!stat.isFile()) return null; // directories are always traversed; every file is classified
  const rel = path.relative(copyRoot, src).split(path.sep).join('/');
  const name = path.basename(src);
  const hit = COPY_EXCLUDE.find((rule) => rule.match(name, rel));
  return hit ? { reason: hit.reason, bytes: stat.size } : null;
}

function createWorkspace(inputFile, evidenceDir) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-real-export-'));
  WORKSPACE = { dir, copied: [], skipped: [], inventory: null, accounting: null, input_inside: false, invariants: [] };
  const copy = (from, to, { exclude = false } = {}) => {
    const before = directoryBytes(from);
    fs.cpSync(from, to, {
      recursive: true,
      filter: (src) => {
        if (!exclude) return true;
        const skip = copySkipReason(src, from);
        if (!skip) return true;
        WORKSPACE.skipped.push({
          path: displayPath(src),
          relative: path.relative(REPO, src).split(path.sep).join('/'),
          reason: skip.reason,
          bytes: skip.bytes,
        });
        return false;
      },
    });
    const size = directoryBytes(to);
    WORKSPACE.copied.push({ from: displayPath(from), to: path.relative(dir, to).split(path.sep).join('/'), bytes: size.bytes, files: size.files, source_bytes: before.bytes, source_files: before.files });
    return { before, after: size };
  };
  const appSource = path.join(REPO, 'app');
  const appInventory = directoryBytes(appSource);
  const appCopy = copy(appSource, path.join(dir, 'app'), { exclude: true });
  const schemas = path.join(REPO, 'docs', 'mission1', 'schemas');
  if (fs.existsSync(schemas)) copy(schemas, path.join(dir, 'docs', 'mission1', 'schemas'));

  // Accounting is measured in this run from the source it just copied: the same
  // walk that records the inventory is what the reconciliation is checked against,
  // so nothing here can drift into a hardcoded expectation.
  const excludedBytes = WORKSPACE.skipped.reduce((total, entry) => total + entry.bytes, 0);
  const accounting = {
    root: displayPath(appSource),
    source_files: appInventory.files,
    source_bytes: appInventory.bytes,
    copied_files: appCopy.after.files,
    copied_bytes: appCopy.after.bytes,
    excluded_files: WORKSPACE.skipped.length,
    excluded_bytes: excludedBytes,
  };
  accounting.files_reconcile = accounting.copied_files + accounting.excluded_files === accounting.source_files;
  accounting.bytes_reconcile = accounting.copied_bytes + accounting.excluded_bytes === accounting.source_bytes;
  accounting.ok = accounting.files_reconcile && accounting.bytes_reconcile;
  WORKSPACE.inventory = { root: accounting.root, files: accounting.source_files, bytes: accounting.source_bytes };
  WORKSPACE.accounting = accounting;

  const runtimeDir = path.join(dir, 'mvp-runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });

  const invariants = [];
  invariants.push({ rule: 'workspace is inside the OS temp directory', ok: isSafeWorkspacePath(dir) });
  invariants.push({ rule: 'workspace is not inside the repository', ok: !isInside(REPO, dir) || isInside(os.tmpdir(), dir) });
  invariants.push({ rule: 'input file is not inside the workspace', ok: !isInside(dir, inputFile) });
  if (evidenceDir) invariants.push({ rule: 'evidence directory is not inside the workspace', ok: !isInside(dir, evidenceDir) });
  WORKSPACE.invariants = invariants;
  WORKSPACE.input_inside = isInside(dir, inputFile);

  return {
    dir,
    runtimeDir,
    stateFile: path.join(runtimeDir, 'fixture-state.json'),
    stagingFile: path.join(runtimeDir, 'staging-state.json'),
    copied: WORKSPACE.copied,
    skipped: WORKSPACE.skipped,
    inventory: WORKSPACE.inventory,
    accounting: WORKSPACE.accounting,
    invariants,
  };
}

async function disposeWorkspace(workspace, keep) {
  const outcome = { path: workspace ? workspace.dir : null, attempted: Boolean(workspace), removed: false, kept: false, retries: 0, error: null, at: nowIso() };
  if (!workspace) return outcome;
  if (keep) {
    outcome.kept = true;
    outcome.reason = '--keep-temp was requested; the workspace and everything the server wrote inside it are retained';
    return outcome;
  }
  if (!isSafeWorkspacePath(workspace.dir)) {
    outcome.error = 'refused: path is not a recognised checker workspace under the OS temp directory';
    return outcome;
  }
  for (let attempt = 1; attempt <= LIMITS.cleanupRetries; attempt += 1) {
    outcome.retries = attempt;
    try {
      fs.rmSync(workspace.dir, { recursive: true, force: true, maxRetries: 2 });
      if (!fs.existsSync(workspace.dir)) {
        outcome.removed = true;
        outcome.error = null;
        break;
      }
      outcome.error = 'directory still present after rmSync';
    } catch (err) {
      outcome.error = err && err.code ? err.code : (err && err.message ? err.message : String(err));
    }
    await delay(150);
  }
  return outcome;
}

/* ------------------------------------------------------------------ */
/* child server controller                                             */
/* ------------------------------------------------------------------ */

let ACTIVE_CHILD = null;

function startChildServer({ workspace, port, parentEnv }) {
  const built = buildChildEnv(parentEnv, {
    host: '127.0.0.1',
    port,
    stateFile: workspace.stateFile,
    stagingFile: workspace.stagingFile,
  });

  const lifecycle = {
    pid: null,
    spawned: false,
    spawn_error: null,
    exit: { seen: false, code: null, signal: null, at: null, elapsed_ms: null },
    close: { seen: false, at: null, lag_after_exit_ms: null },
    kill: [],
    final_status: 'NOT_STARTED',
    still_alive_at_finalize: null,
    stdio_closed: null,
    platform: process.platform,
    platform_note: process.platform === 'win32'
      ? 'win32: child.kill() terminates the child unconditionally; application signal handlers are not relied on'
      : 'posix: SIGTERM is delivered as a signal to the child',
  };

  const startedAt = Date.now();
  const child = spawn(process.execPath, ['app/server.js'], {
    cwd: workspace.dir,
    env: built.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  // child.pid is available synchronously; the 'spawn' event arrives later and
  // must not be the only source of the pid recorded in the evidence.
  lifecycle.pid = child.pid || null;

  const stdoutTail = createTail();
  const stderrTail = createTail();
  const startup = makeDeferred();
  const exited = makeDeferred();
  const closed = makeDeferred();
  const startupRecord = { seen: false, line: null, port: null, at: null, latency_ms: null, bytes_at_match: null, port_mismatch: [] };

  child.on('spawn', () => {
    lifecycle.spawned = true;
    lifecycle.pid = child.pid || null;
    lifecycle.final_status = 'RUNNING';
  });

  child.on('error', (err) => {
    lifecycle.spawn_error = err && err.code ? err.code : (err && err.message ? err.message : String(err));
    lifecycle.final_status = 'SPAWN_FAILED';
    startup.resolve({ ok: false, reason: 'spawn_error', error: lifecycle.spawn_error });
    exited.resolve({ reason: 'spawn_error' });
    closed.resolve({ reason: 'spawn_error' });
  });

  child.on('exit', (code, signal) => {
    lifecycle.exit = { seen: true, code, signal, at: nowIso(), elapsed_ms: Date.now() - startedAt };
    if (lifecycle.final_status !== 'SPAWN_FAILED') lifecycle.final_status = 'EXITED';
    exited.resolve({ reason: 'exit', code, signal });
  });

  child.on('close', (code, signal) => {
    lifecycle.close = {
      seen: true,
      at: nowIso(),
      lag_after_exit_ms: lifecycle.exit.seen && lifecycle.exit.at ? Date.now() - Date.parse(lifecycle.exit.at) : null,
    };
    if (lifecycle.exit.seen === false) {
      lifecycle.exit = { seen: true, code, signal, at: lifecycle.close.at, elapsed_ms: Date.now() - startedAt, note: 'close observed without exit' };
    }
    closed.resolve({ reason: 'close' });
  });

  child.stdout.on('data', (chunk) => {
    stdoutTail.push(chunk);
    if (startupRecord.seen) return;
    const text = stdoutTail.get();
    const match = text.match(STARTUP_LINE_RE);
    if (!match) return;
    const observedPort = Number(match[1]);
    if (observedPort !== port) {
      startupRecord.port_mismatch.push({ observed: observedPort, expected: port });
      return;
    }
    startupRecord.seen = true;
    startupRecord.line = match[0];
    startupRecord.port = observedPort;
    startupRecord.at = nowIso();
    startupRecord.latency_ms = Date.now() - startedAt;
    // Cumulative bytes received on this child's stdout at the instant the line
    // was matched - not the ring-buffer capacity and not the run's total output.
    startupRecord.bytes_at_match = stdoutTail.bytes();
    startup.resolve({ ok: true, ...startupRecord });
  });

  child.stderr.on('data', (chunk) => {
    stderrTail.push(chunk);
  });

  const controller = {
    child,
    base: `http://127.0.0.1:${port}`,
    port,
    lifecycle,
    env: { injected: ['HOST', 'PORT', 'ACE_MVP_STATE_FILE', 'ACE_MVP_STAGING_FILE', ...built.allowlist], excluded: built.excluded },
    startupRecord,
    isDead() { return lifecycle.exit.seen === true; },
    diagnostics() {
      return {
        stdout_tail: redactText(stdoutTail.get(), STDOUT_TAIL_LIMIT_CHARS),
        stderr_tail: redactText(stderrTail.get(), STDOUT_TAIL_LIMIT_CHARS),
        stdout_bytes: stdoutTail.bytes(),
        stderr_bytes: stderrTail.bytes(),
        // The tail above is capped for readability, so the recorded ownership
        // proof does not depend on the line surviving that cap.
        stdout_tail_limit_chars: STDOUT_TAIL_LIMIT_CHARS,
        stdio_buffer_limit_bytes: LIMITS.stdioTailBytes,
      };
    },
    /*
     * The startup line is the only proof that this child, on this port, is the
     * server that answered. It is captured while the child is alive and carried
     * into the final payload on its own, instead of living only inside a capped
     * tail of stdout.
     */
    startupEvidence() {
      return {
        seen: startupRecord.seen === true,
        line: startupRecord.seen ? redactText(startupRecord.line, 400) : null,
        port: startupRecord.port || null,
        observed_at: startupRecord.at || null,
        latency_ms: startupRecord.latency_ms || null,
        bytes_at_match: startupRecord.bytes_at_match,
        port_mismatch: startupRecord.port_mismatch || [],
        ownership: 'port freshly allocated for this run + startup line observed on this child\'s stdout + child alive',
      };
    },
    assertUsable(context) {
      if (lifecycle.spawn_error) throw new Error(`the child server failed to spawn before ${context} (${lifecycle.spawn_error})`);
      if (lifecycle.exit.seen) {
        throw new Error(`the child server exited before ${context} (code=${lifecycle.exit.code} signal=${lifecycle.exit.signal})`);
      }
      if (!startupRecord.seen) throw new Error(`the child server never reported readiness before ${context}`);
    },
    async awaitStartup(timeoutMs) {
      const timeout = makeDeferred();
      const timer = setTimeout(() => timeout.resolve({ ok: false, reason: 'readiness_timeout' }), timeoutMs);
      const winner = await Promise.race([
        startup.promise,
        exited.promise.then((info) => ({ ...info, ok: false, reason: 'child_exited' })),
        CANCEL.deferred.promise.then(() => ({ ok: false, reason: 'interrupted' })),
        timeout.promise,
      ]);
      clearTimeout(timer);
      if (winner && winner.ok) return winner;
      const stderrText = stderrTail.get();
      const portError = /EADDRINUSE/i.test(stderrText);
      return {
        ok: false,
        reason: (winner && winner.reason) || 'unknown',
        detail: winner,
        port_error: portError,
        retriable: portError && lifecycle.spawn_error === null,
        diagnostics: controller.diagnostics(),
      };
    },
    async waitHealth(timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      const attempts = [];
      const record = (entry) => { if (attempts.length < LIMITS.maxAttemptsRecorded) attempts.push(entry); };
      while (Date.now() < deadline) {
        if (lifecycle.exit.seen) {
          return { ok: false, reason: 'child_exited_during_health_check', attempts, exit: { ...lifecycle.exit } };
        }
        if (CANCEL.interrupted) return { ok: false, reason: 'interrupted', attempts };
        try {
          const res = await fetch(`${controller.base}/api/health`, { signal: AbortSignal.timeout(Math.max(1000, LIMITS.apiCallMs / 5)) });
          const text = await res.text();
          record({ at: nowIso(), status: res.status });
          if (res.ok) {
            let body = text;
            try { body = JSON.parse(text); } catch { /* keep text */ }
            return { ok: true, status: res.status, body, attempts, url: `${controller.base}/api/health` };
          }
        } catch (err) {
          record({ at: nowIso(), error: err && err.name ? err.name : String(err) });
        }
        const slept = await sleep(LIMITS.healthPollEveryMs);
        if (slept.aborted) return { ok: false, reason: 'interrupted', attempts };
      }
      return { ok: false, reason: 'health_timeout', attempts, url: `${controller.base}/api/health` };
    },
    async terminate() {
      const t0 = Date.now();
      const result = {
        attempted: false,
        confirmed: null,
        elapsed_ms: null,
        kill: lifecycle.kill,
        exit: null,
        close: null,
        final_status: null,
        still_alive_at_finalize: null,
        stdio_closed: null,
        platform_note: lifecycle.platform_note,
        direct_child_only: true,
      };
      if (lifecycle.final_status === 'SPAWN_FAILED') {
        result.attempted = false;
        result.confirmed = true;
        result.reason = `child never spawned (${lifecycle.spawn_error})`;
        result.elapsed_ms = Date.now() - t0;
        result.final_status = lifecycle.final_status;
        result.exit = { ...lifecycle.exit };
        result.close = { ...lifecycle.close };
        return result;
      }
      result.attempted = true;
      if (!lifecycle.exit.seen) {
        const recordKill = (request) => {
          let returned = null;
          let error = null;
          try { returned = child.kill(request); } catch (err) { error = err && err.message ? err.message : String(err); }
          lifecycle.kill.push({ request, at: nowIso(), returned, error, at_ms: Date.now() - t0 });
          return returned;
        };
        recordKill('SIGTERM');
        await Promise.race([exited.promise, delay(LIMITS.sigtermGraceMs)]);
        if (!lifecycle.exit.seen) {
          recordKill('SIGKILL');
          await Promise.race([exited.promise, delay(LIMITS.sigkillGraceMs)]);
        }
      }
      await Promise.race([closed.promise, delay(LIMITS.closeGraceMs)]);
      lifecycle.still_alive_at_finalize = lifecycle.exit.seen === false;
      lifecycle.stdio_closed = lifecycle.close.seen;
      lifecycle.final_status = lifecycle.exit.seen ? 'EXITED' : 'STILL_ALIVE';
      result.confirmed = lifecycle.exit.seen;
      result.elapsed_ms = Date.now() - t0;
      result.exit = { ...lifecycle.exit };
      result.close = { ...lifecycle.close };
      result.final_status = lifecycle.final_status;
      result.still_alive_at_finalize = lifecycle.still_alive_at_finalize;
      result.stdio_closed = lifecycle.stdio_closed;
      result.pid = lifecycle.pid;
      return result;
    },
  };

  ACTIVE_CHILD = controller;
  return controller;
}

async function callApi(method, urlPath, body) {
  if (!ACTIVE_CHILD) throw new Error(`internal: no child server is running (${method} ${urlPath})`);
  ACTIVE_CHILD.assertUsable(`${method} ${urlPath}`);
  const res = await fetch(`${ACTIVE_CHILD.base}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(LIMITS.apiCallMs),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

/* ------------------------------------------------------------------ */
/* reporting helpers (output preserved from the previous checker)       */
/* ------------------------------------------------------------------ */

function summarise(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return `${status} ${text.slice(0, 300)}`;
}

function field(body, name) {
  return body && typeof body === 'object' ? body[name] : undefined;
}

function line(title) {
  console.log('');
  console.log(title);
  console.log('-'.repeat(title.length));
}

function readMappingOverride() {
  const file = process.env.ACE_REAL_MAPPING_FILE;
  if (!file) return null;
  const full = path.resolve(REPO, file);
  const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
  console.log(`Human-confirmed mapping loaded from ${path.relative(REPO, full)}`);
  return parsed;
}

function defaultDateRange(preview, file) {
  if (process.env.ACE_REAL_DATE_FROM && process.env.ACE_REAL_DATE_TO) {
    return { from: process.env.ACE_REAL_DATE_FROM, to: process.env.ACE_REAL_DATE_TO };
  }
  if (preview.date_range_default) return preview.date_range_default;
  // No export timestamp column: fall back to the file's own modification date
  // so the freshness clock is anchored to something observable.
  const stamp = fs.statSync(file).mtime.toISOString().slice(0, 10);
  return { from: stamp, to: stamp };
}

function candidates(explicitPath) {
  const explicit = explicitPath || process.env.ACE_REAL_SHOPEE_EXPORT;
  if (explicit) {
    // Accept absolute or relative paths (including external paths)
    const resolved = path.isAbsolute(explicit) ? path.resolve(explicit) : path.resolve(REPO, explicit);
    return [resolved];
  }
  const found = [];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        try {
          if (!fs.statSync(full).isFile()) continue;
          if (!EXTENSIONS.has(path.extname(name).toLowerCase())) continue;
          found.push(full);
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* structured results                                                  */
/* ------------------------------------------------------------------ */

function result({ code, verdict, operation, message, summary, extra }) {
  return { code, verdict, operation, message: message || null, summary: summary || {}, ...(extra || {}) };
}

function fail(verdict, message, summary) {
  return result({ code: EXIT.FAILED, verdict, operation: 'FAILED', message, summary });
}

/* ------------------------------------------------------------------ */
/* dry run                                                             */
/* ------------------------------------------------------------------ */

function dryRun(found, recorder) {
  line('DRY RUN — nothing will be created, started or verified');
  console.log('This run only reports what the real run would do.');
  console.log('');
  console.log(`would start a local server:   yes (app/server.js from a temp copy, 127.0.0.1, dynamic port)`);
  console.log(`fixed port:                  ${readPortOverride().port || '(none — the OS picks a free port)'}`);
  console.log(`would create workspace:      ${path.join(os.tmpdir(), 'ace-real-export-<random>')}`);
  console.log(`would copy:                  app/ + docs/mission1/schemas/`);
  console.log(`would write evidence to:     ${ACE_IMPORT_ROOT ? path.join(ACE_IMPORT_ROOT, 'evidence') : path.join(os.tmpdir(), 'ace-real-export-evidence')}`);
  console.log(`would read the input file:   yes (read-only) and compute sha256`);
  console.log(`would delete the workspace:  yes (unless --keep-temp)`);

  if (found.length === 0) {
    console.log('');
    console.log('No candidate export was found, so a real run would exit 2 (pending).');
  } else {
    line('File identity (read-only)');
    for (const file of found) {
      let info = 'unreadable';
      try {
        const stat = fs.statSync(file);
        const buffer = fs.readFileSync(file);
        info = `${buffer.length} bytes, sha256 ${sha256(buffer).slice(0, 16)}…, mtime ${stat.mtime.toISOString()}`;
      } catch (err) {
        info = err && err.code ? err.code : String(err);
      }
      console.log(`  ${displayPath(file)}  —  ${info}`);
    }
    line('Guards (evaluated read-only)');
    for (const guard of evaluateGuards(found[0])) {
      console.log(`  ${guard.ok ? 'ok  ' : 'FAIL'} ${guard.name}${guard.detail ? `: ${guard.detail}` : ''}`);
    }
  }

  recorder.step('dry_run', {
    candidates: found.map(displayPath),
    port_override: readPortOverride().port || null,
    would_copy: ['app', 'docs/mission1/schemas'],
    would_write_evidence: true,
    would_keep_temp: OPTIONS.keepTemp,
    note: 'dry run creates no workspace, starts no server and writes no evidence file',
  });

  console.log('');
  console.log('DRY RUN — NOTHING VERIFIED');
  console.log('exit code 2 = PENDING (a dry run never reports a pass)');
  return result({ code: EXIT.PENDING, verdict: 'DRY_RUN', operation: 'NOT_RUN', summary: { dry_run: true, candidates: found.map(displayPath) } });
}

/* ------------------------------------------------------------------ */
/* guards                                                              */
/* ------------------------------------------------------------------ */

/** Read-only guard evaluation, shared by the dry run and the real run. */
function evaluateGuards(file) {
  const guards = [];
  let buffer;
  let hash;
  try {
    buffer = fs.readFileSync(file);
    hash = sha256(buffer);
  } catch (err) {
    return [{ name: 'readable', ok: false, detail: err && err.code ? err.code : String(err) }];
  }

  const relative = path.relative(REPO, file);
  const insideRepo = isInside(REPO, file);
  const scratch = insideRepo
    ? relative.split(path.sep).includes('.tmp')
    : file.split(path.sep).includes('.tmp');
  guards.push({
    name: 'not in .tmp/ scratch space',
    ok: !scratch,
    detail: scratch ? 'the file lives in .tmp/ scratch space and is not a supplied export' : null,
  });

  const fixtureDir = path.join(REPO, 'app', 'mvp', 'fixtures');
  let fixtureMatch = null;
  if (fs.existsSync(fixtureDir)) {
    for (const name of fs.readdirSync(fixtureDir)) {
      const fixturePath = path.join(fixtureDir, name);
      try {
        if (!fs.statSync(fixturePath).isFile()) continue;
        if (sha256(fs.readFileSync(fixturePath)) === hash) { fixtureMatch = name; break; }
      } catch { continue; }
    }
  }
  guards.push({
    name: 'not a repository fixture',
    ok: fixtureMatch === null,
    detail: fixtureMatch ? `this file is app/mvp/fixtures/${fixtureMatch}; a fixture is not real-export evidence` : null,
  });

  const rehearsal = buffer.subarray(0, 4096).toString('latin1').includes('REHEARSAL FILE');
  guards.push({
    name: 'not a rehearsal artefact',
    ok: !rehearsal,
    detail: rehearsal ? 'the file carries the rehearsal marker' : null,
  });

  return guards;
}

/* ------------------------------------------------------------------ */
/* the main flow                                                       */
/* ------------------------------------------------------------------ */

function disclose() {
  line('0. Side effects of this run');
  console.log('  creates  a temporary workspace under the OS temp directory');
  console.log('  copies   app/ and docs/mission1/schemas/ into that workspace');
  console.log('  starts   one local server (app/server.js) on 127.0.0.1, dynamic port');
  console.log('  sends    local HTTP requests to that server only');
  console.log('  reads    the input file (read-only) and computes its sha256');
  console.log('  writes   run evidence (.jsonl / .final.json / .log)');
  console.log('  stops    the server and deletes the workspace when done');
  console.log('');
  console.log('  not done: external network access, .env reading, API credentials,');
  console.log('            changes to data/app/state.json or any tracked file,');
  console.log('            real Shopee import into the repository state.');
  console.log('  Not claimed: absence of side effects. The child is the real server;');
  console.log('            everything it writes happens inside the workspace.');
}

async function execute(recorder, parentEnv) {
  console.log('=== Real Shopee Affiliate export check ===');
  console.log(`repository: ${REPO}`);
  console.log(`checked at: ${nowIso()}`);
  console.log(`checker:    v${CHECKER_VERSION} (safety remediation phase 1)`);

  disclose();
  recorder.step('disclosure', {
    workspace: 'OS temp directory, removed after the run',
    copy: ['app', 'docs/mission1/schemas'],
    child: 'one local app/server.js on 127.0.0.1',
    api: 'local only',
    input: 'read-only',
    evidence: 'jsonl + final.json + log',
    not_done: ['external network', '.env', 'credentials', 'repository state changes', 'real import into repo state'],
  });

  const found = candidates(OPTIONS.path);
  recorder.step('discovery', {
    candidates: found.map(displayPath),
    search_dirs: searchDirs.map(displayPath),
    explicit_path: OPTIONS.path || null,
    ace_import_root: ACE_IMPORT_ROOT,
  });

  if (CANCEL.interrupted) return result({ code: EXIT.FAILED, verdict: 'INTERRUPTED', operation: 'NOT_RUN' });

  if (OPTIONS.dryRun) return dryRun(found, recorder);

  if (found.length === 0) {
    line('No real export was found');
    console.log('Searched:');
    console.log(`  ${OPTIONS.path ? path.resolve(REPO, OPTIONS.path) : '(no explicit path given)'}`);
    if (process.env.ACE_REAL_SHOPEE_EXPORT) console.log(`  $ACE_REAL_SHOPEE_EXPORT = ${process.env.ACE_REAL_SHOPEE_EXPORT}`);
    for (const dir of searchDirs) console.log(`  ${dir}${fs.existsSync(dir) ? '' : ' (does not exist)'}`);
    console.log('');
    console.log('REAL SHOPEE EXPORT PENDING');
    console.log('');
    console.log('What is verified without it:');
    console.log('  - the parser contract (format, encoding, header mapping, row status)');
    console.log('    against SYNTHETIC-labelled fixtures only;');
    console.log('  - the staging-only import, duplicate detection, promote, Source');
    console.log('    Library, archive, validation and freshness guards.');
    console.log('');
    console.log('What is NOT verified and NOT claimed:');
    console.log('  - that a real Shopee Affiliate export parses with this mapping;');
    console.log('  - the real status/body/exit code of a real-file import;');
    console.log('  - that the detected column mapping matches a real export header.');
    console.log('');
    console.log('To unblock: export the file from Shopee Affiliate and either');
    console.log('  - drop it in data/imports/ (or data/mvp/real/), or');
    console.log('  - run: node verification/real-shopee-export-check.js <path>');
    console.log('');
    console.log('exit code 2 = PENDING (not a failure, not a pass)');
    recorder.step('pending', { reason: 'no candidate export was found', search_dirs: searchDirs.length });
    return result({ code: EXIT.PENDING, verdict: 'PENDING', operation: 'PENDING', summary: { verdict: 'PENDING', candidates: 0 } });
  }

  const file = found[0];
  // Ensure file exists and is readable (raw file is read-only input)
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) {
      console.error('FAIL  the specified path is not a file');
      return fail('NOT_A_FILE', 'the specified path is not a file');
    }
  } catch (err) {
    console.error(`FAIL  cannot access file: ${err && err.message ? err.message : err}`);
    return fail('FILE_NOT_READABLE', err && err.message ? err.message : String(err));
  }
  const buffer = fs.readFileSync(file);
  const hash = sha256(buffer);
  const stat = fs.statSync(file);

  line('1. File identity');
  if (found.length > 1) {
    console.log(`${found.length} candidate files were found; the first one is used:`);
    for (const candidate of found) {
      console.log(`  ${candidate === file ? '*' : ' '} ${displayPath(candidate)}`);
    }
    console.log('Run again with an explicit path to check a different file.');
    console.log('');
  }
  const relToRepo = isInside(REPO, file) ? path.relative(REPO, file) : null;
  console.log(`file (abs): ${path.resolve(file)}`);
  if (relToRepo) console.log(`file (repo rel): ${relToRepo}`);
  console.log(`bytes:      ${buffer.length}`);
  console.log(`sha256:     ${hash}`);
  console.log(`mtime:      ${stat.mtime.toISOString()}`);
  console.log(`ctime:      ${stat.ctime.toISOString()}`);
  console.log(`read-only:  raw file used as read-only input (no copy/write into repo)`);

  const summary = {
    file: displayPath(file),
    file_abs: path.resolve(file),
    bytes: buffer.length,
    sha256: hash,
    mtime: stat.mtime.toISOString(),
    ctime: stat.ctime.toISOString(),
    checked_at: nowIso(),
    ace_import_root: ACE_IMPORT_ROOT,
    checker_version: CHECKER_VERSION,
  };
  recorder.step('file_identity', { file: displayPath(file), bytes: buffer.length, sha256: hash, mtime: stat.mtime.toISOString(), read_only: true });

  /* ---------------- guards ---------------- */
  const guards = evaluateGuards(file);
  recorder.step('guards', { guards: guards.map((g) => ({ name: g.name, ok: g.ok, detail: g.detail })) });
  for (const guard of guards) {
    if (guard.ok) continue;
    console.error('');
    console.error(`FAIL  ${guard.name}${guard.detail ? `: ${guard.detail}` : ''}`);
    const verdict = guard.name === 'not a repository fixture'
      ? 'FILE_IS_FIXTURE'
      : (guard.name === 'not a rehearsal artefact' ? 'FILE_IS_REHEARSAL' : 'FILE_IN_SCRATCH_SPACE');
    return fail(verdict, guard.detail || guard.name, summary);
  }

  /* ---------------- port ---------------- */
  const divider = readPortOverride();
  if (divider.error) {
    console.error('');
    console.error(`FAIL  ${divider.detail}`);
    recorder.step('port_error', divider);
    return fail(divider.error, divider.detail, summary);
  }
  recorder.step('port_override', { requested: divider.port, source: 'REAL_EXPORT_PORT' });

  /* ---------------- workspace ---------------- */
  let workspace;
  try {
    workspace = createWorkspace(file, recorder.dir || null);
  } catch (err) {
    console.error('');
    console.error(`FAIL  the temporary workspace could not be prepared: ${err && err.message ? err.message : err}`);
    recorder.step('workspace_failed', { error: err && err.message ? err.message : String(err) });
    return fail('WORKSPACE_CREATE_FAILED', err && err.message ? err.message : String(err), summary);
  }
  for (const invariant of workspace.invariants) {
    if (!invariant.ok) {
      console.error('');
      console.error(`FAIL  workspace invariant violated: ${invariant.rule}`);
      recorder.step('workspace_invariant_violated', invariant);
      return fail('WORKSPACE_INVARIANT_VIOLATED', invariant.rule, summary);
    }
  }
  recorder.step('workspace', {
    path: workspace.dir,
    copied: workspace.copied,
    skipped: workspace.skipped,
    inventory: workspace.inventory,
    accounting: workspace.accounting,
    state_file: displayPath(workspace.stateFile),
    staging_file: displayPath(workspace.stagingFile),
  });
  line('1b. Temporary workspace');
  console.log(`  workspace: ${workspace.dir}`);
  for (const entry of workspace.copied) console.log(`  copied:    ${entry.from} -> ${entry.to} (${entry.files} files, ${entry.bytes} bytes)`);
  if (workspace.skipped.length) {
    console.log(`  excluded:  ${workspace.skipped.length} file(s), ${workspace.accounting.excluded_bytes} bytes`);
    for (const entry of workspace.skipped) console.log(`             ${entry.relative}  (${entry.reason}, ${entry.bytes} bytes)`);
  }
  console.log(`  accounting: ${workspace.accounting.copied_files} copied + ${workspace.accounting.excluded_files} excluded = ${workspace.accounting.source_files} source files; ${workspace.accounting.copied_bytes} + ${workspace.accounting.excluded_bytes} = ${workspace.accounting.source_bytes} bytes (${workspace.accounting.ok ? 'reconciled' : 'MISMATCH'})`);
  if (!workspace.accounting.ok) {
    console.error('WARN  the workspace copy does not reconcile with the source inventory; the evidence records both sides.');
  }
  console.log('  data/ is not copied; the server creates data/app/ inside the workspace.');

  /* ---------------- spawn + readiness (with port retries) ---------------- */
  let childController = null;
  let portInfo = null;
  let startupFailure = null;
  let attempt = 0;

  while (attempt < LIMITS.portRetries) {
    attempt += 1;
    if (CANCEL.interrupted) {
      return result({ code: EXIT.FAILED, verdict: 'INTERRUPTED', operation: 'NOT_RUN', summary });
    }
    portInfo = await allocatePort({ requestedPort: divider.port, attempt });
    recorder.step('port_alloc', {
      attempt,
      mode: portInfo.mode,
      port: portInfo.port || null,
      requested: portInfo.requested || null,
      probe: portInfo.probe,
      error: portInfo.error || null,
      toctou: portInfo.toctou || null,
    });
    if (portInfo.error) {
      console.error('');
      console.error(`FAIL  ${portInfo.error === 'PORT_COLLISION'
        ? `the requested port ${divider.port} is already in use; the checker will not move to another port silently`
        : 'no free local port could be allocated'}`);
      recorder.step('port_failed', { error: portInfo.error, probe: portInfo.probe });
      return fail(portInfo.error, portInfo.probe ? portInfo.probe.error : null, summary);
    }

    try {
      childController = startChildServer({ workspace, port: portInfo.port, parentEnv });
    } catch (err) {
      console.error('');
      console.error(`FAIL  the server could not be spawned: ${err && err.message ? err.message : err}`);
      recorder.step('spawn_failed', { error: err && err.message ? err.message : String(err), attempt });
      return fail('SERVER_SPAWN_FAILED', err && err.message ? err.message : String(err), summary);
    }

    recorder.step('spawn', {
      attempt,
      pid: childController.lifecycle.pid,
      cwd: workspace.dir,
      port: portInfo.port,
      env_injected: childController.env.injected,
      env_excluded_count: childController.env.excluded.length,
      env_excluded: childController.env.excluded.map((entry) => entry.name),
    });
    console.log(`  server:    pid ${childController.lifecycle.pid} on ${childController.base} (attempt ${attempt}/${LIMITS.portRetries})`);

    const readiness = await childController.awaitStartup(LIMITS.readinessMs);
    if (readiness.ok) {
      recorder.step('readiness', {
        ok: true,
        startup_line: readiness.line,
        port: readiness.port,
        latency_ms: readiness.latency_ms,
        ownership: 'port freshly allocated for this run + startup line observed on this child\'s stdout + child alive',
      });
      summary.startup_line = redactText(readiness.line, 400);
      summary.readiness = {
        latency_ms: readiness.latency_ms,
        port: readiness.port,
        bytes_at_match: readiness.bytes_at_match,
        ownership: 'port freshly allocated for this run + startup line observed on this child\'s stdout + child alive',
      };
      console.log(`  readiness: "${readiness.line}" after ${readiness.latency_ms} ms`);
      break;
    }

    const diagnostics = readiness.diagnostics || childController.diagnostics();
    recorder.step('startup_failed', {
      attempt,
      reason: readiness.reason,
      port_error: readiness.port_error === true,
      retriable: readiness.retriable === true,
      diagnostics,
    });
    console.error('');
    console.error(`FAIL  the server did not report readiness (${readiness.reason})`);
    if (diagnostics.stderr_tail) console.error(`      stderr: ${diagnostics.stderr_tail.split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 500)}`);

    const termination = await childController.terminate();
    recorder.step('shutdown', termination);
    childController = null;

    startupFailure = {
      reason: readiness.reason,
      port_error: readiness.port_error === true,
      diagnostics,
      attempt,
    };
    if (readiness.retriable && attempt < LIMITS.portRetries) {
      console.log('  retrying with a new port (EADDRINUSE before any API call)');
      continue;
    }
    break;
  }

  if (!childController) {
    const verdict = startupFailure && startupFailure.port_error ? 'PORT_COLLISION' : 'SERVER_START_FAILED';
    return fail(verdict, startupFailure ? startupFailure.reason : 'no child server', { ...summary, startup: startupFailure });
  }

  /* ---------------- health ---------------- */
  const health = await childController.waitHealth(LIMITS.healthPollMs);
  recorder.step('health', health);
  summary.health = { ok: health.ok, status: health.status || null, url: health.url || null, attempts: (health.attempts || []).length };
  summary.port = { port: childController.port, mode: portInfo.mode, requested: portInfo.requested || null, toctou: portInfo.toctou || null };
  summary.child_pid = childController.lifecycle.pid;
  if (!health.ok) {
    console.error('');
    console.error(`FAIL  the local server never answered ${childController.base}/api/health (${health.reason})`);
    return fail('SERVER_UNHEALTHY', health.reason, summary);
  }
  console.log(`  health:    ${childController.base}/api/health -> ${health.status} after ${(health.attempts || []).length} attempt(s)`);

  /* ---------------- preview ---------------- */
  const preview = await callApi('POST', '/api/mvp/import/preview', {
    filename: path.basename(file),
    content_base64: buffer.toString('base64'),
  });
  console.log(`preview  ${summarise(preview.status, preview.body)}`);
  recorder.step('preview', { status: preview.status, body: summarise(preview.status, preview.body) });
  if (preview.status !== 200) {
    console.error('FAIL  the real export could not be previewed');
    return fail('PREVIEW_FAILED', `preview returned ${preview.status}`, summary);
  }
  const pv = preview.body.preview;

  /* ---------------- fixture guard ---------------- */
  line('2. Synthetic-fixture guard');
  console.log(`file identifies itself as synthetic: ${pv.synthetic}`);
  summary.synthetic = pv.synthetic;
  recorder.step('synthetic_check', { synthetic: pv.synthetic });
  if (pv.synthetic) {
    console.error('FAIL  this file identifies itself as a SYNTHETIC fixture.');
    console.error('      A fixture is not real-export evidence, whatever it is named.');
    return fail('FILE_IS_SYNTHETIC', 'the file identifies itself as synthetic', summary);
  }
  console.log('ok  the file is treated as a user-supplied export');

  /* ---------------- header + alias ---------------- */
  line('3. Header and alias mapping');
  const columns = pv.columns || [];
  console.log(`detected ${columns.length} columns:`);
  for (const column of columns) {
    const fields = column.fields.length ? column.fields.join(', ') : '(unmapped)';
    const required = column.required ? 'required' : 'optional';
    console.log(`  [${String(column.index).padStart(2)}] ${column.header}  ->  ${fields} (${required})`);
  }
  console.log('');
  console.log(`mapping hash: ${pv.mapping_hash}`);
  console.log(`missing required: ${(pv.missing_required || []).join(', ') || '(none)'}`);
  console.log(`unmapped columns: ${(pv.unmapped || []).map((c) => c.name).join(', ') || '(none)'}`);
  console.log(`conflicting columns: ${(pv.conflicts || []).map((c) => c.header).join(', ') || '(none)'}`);
  if ((pv.mapping_notes || []).length) {
    console.log('alias hits:');
    for (const note of pv.mapping_notes) console.log(`  ${note}`);
  }
  summary.header = columns.map((c) => c.header);
  summary.mapping_columns = pv.mapping_columns;
  summary.missing_required = pv.missing_required;
  summary.unmapped = (pv.unmapped || []).map((c) => c.name);
  summary.conflicts = (pv.conflicts || []).map((c) => c.header);

  /* ---------------- encoding ---------------- */
  line('4. Format, encoding and delimiter');
  console.log(`format:  ${pv.format}`);
  console.log(`encoding: ${pv.encoding}`);
  console.log(`delimiter: ${pv.delimiter || '(n/a)'}`);
  console.log(`sheet:   ${pv.sheet || '(n/a)'}`);
  for (const warning of pv.warnings || []) console.log(`warning: ${warning}`);
  summary.format = pv.format;
  summary.encoding = pv.encoding;
  summary.delimiter = pv.delimiter;

  /* ---------------- row counts ---------------- */
  line('5. Row counts');
  const counts = pv.counts || {};
  console.log(`total rows read: ${pv.total_rows}`);
  console.log(`valid:     ${counts.valid}`);
  console.log(`invalid:   ${counts.invalid}`);
  console.log(`duplicate: ${counts.duplicate}`);
  console.log(`unknown:   ${counts.unknown}`);
  console.log(`rows without any commission column: ${pv.rows_without_commission}`);
  console.log(`date range suggested by the file: ${JSON.stringify(pv.date_range_default)}`);
  const invalidRows = (pv.rows || []).filter((r) => r.status === 'INVALID').slice(0, 10);
  const unknownRows = (pv.rows || []).filter((r) => r.status === 'UNKNOWN').slice(0, 10);
  for (const row of invalidRows) console.log(`  invalid row ${row.row_number}: ${(row.reasons || []).join('; ')}`);
  for (const row of unknownRows) console.log(`  unknown row ${row.row_number}: ${(row.reasons || []).join('; ')}`);
  summary.counts = counts;
  summary.total_rows = pv.total_rows;

  if ((pv.missing_required || []).length) {
    console.error('');
    console.error(`FAIL  required columns are not mapped: ${pv.missing_required.join(', ')}`);
    console.error('      Re-run with ACE_REAL_MAPPING_FILE pointing at a human-confirmed mapping.');
    return fail('MAPPING_INCOMPLETE', `missing required columns: ${pv.missing_required.join(', ')}`, summary);
  }

  /* ---------------- commit ---------------- */
  line('6. Commit (staging only)');
  const mappingOverride = readMappingOverride();
  const commitBody = {
    filename: path.basename(file),
    content_base64: buffer.toString('base64'),
    account: {
      id: process.env.ACE_REAL_ACCOUNT_ID || 'real-export',
      label: process.env.ACE_REAL_ACCOUNT_LABEL || 'Real Shopee Affiliate account (user supplied)',
    },
    date_range: defaultDateRange(pv, file),
    confirmMapping: true,
  };
  if (mappingOverride) commitBody.mapping = mappingOverride;
  if (REUSABLE_ENCODINGS.has(pv.encoding)) commitBody.encoding = pv.encoding;
  if (pv.format === 'xlsx' && pv.sheet) commitBody.sheet = pv.sheet;

  const commit = await callApi('POST', '/api/mvp/import/commit', commitBody);
  console.log(`commit   ${summarise(commit.status, commit.body)}`);
  recorder.step('commit', { status: commit.status, body: summarise(commit.status, commit.body) });
  if (commit.status !== 201 && commit.status !== 200) {
    console.error('FAIL  the real export could not be staged');
    return fail('COMMIT_FAILED', `commit returned ${commit.status}`, summary);
  }
  const importRecord = field(commit.body, 'import') || {};
  const stagedId = importRecord.id;
  console.log(`  staged id: ${stagedId}`);
  console.log(`  synthetic: ${importRecord.synthetic}`);
  console.log(`  source type: ${importRecord.source_type}`);
  for (const warning of importRecord.warnings || []) console.log(`  warning: ${warning}`);
  console.log(`  counts: ${JSON.stringify(field(commit.body, 'counts'))}`);
  console.log(`  records: ${JSON.stringify(field(commit.body, 'records'))}`);
  console.log(`  date range: ${JSON.stringify(importRecord.date_range)}`);
  summary.staged_id = stagedId;
  summary.commit_counts = field(commit.body, 'counts');
  summary.commit_records = field(commit.body, 'records');

  if (importRecord.synthetic) {
    console.error('');
    console.error('FAIL  the staged record is still marked synthetic; real-export evidence is not claimed.');
    return fail('STAGED_AS_SYNTHETIC', 'the staged record is still marked synthetic', summary);
  }

  /* ---------------- promote ---------------- */
  line('7. Promote to Research');
  const promote = await callApi('POST', `/api/mvp/staging/${stagedId}/research`, { generateCandidates: true });
  console.log(`promote  ${summarise(promote.status, promote.body)}`);
  summary.promote_status = promote.status;

  if (promote.status === 409 && /expired/i.test(JSON.stringify(promote.body || {}))) {
    console.log('');
    console.log('The source is older than the freshness window; retrying with acknowledgeExpired: true');
    const retry = await callApi('POST', `/api/mvp/staging/${stagedId}/research`, {
      generateCandidates: true,
      acknowledgeExpired: true,
    });
    console.log(`promote (acknowledged) ${summarise(retry.status, retry.body)}`);
    recorder.step('promote', { status: retry.status, acknowledged_expired: true, body: summarise(retry.status, retry.body) });
    summary.promote_status = retry.status;
    summary.promote_acknowledged_expired = true;
    if (retry.status !== 201) {
      console.error('PARTIAL  the export was staged, but it could not become the Research source.');
      console.error(`         ${field(retry.body, 'error')}`);
      return result({ code: EXIT.PARTIAL, verdict: 'STAGED_BUT_NOT_PROMOTED', operation: 'PARTIAL', summary });
    }
    console.log(`  candidates: ${(field(retry.body, 'candidates') || []).length}`);
    console.log(`  records: ${JSON.stringify(field(retry.body, 'records'))}`);
  } else if (promote.status !== 201) {
    recorder.step('promote', { status: promote.status, body: summarise(promote.status, promote.body) });
    console.error('PARTIAL  the export was staged, but it could not become the Research source.');
    console.error(`         ${field(promote.body, 'error')}`);
    return result({ code: EXIT.PARTIAL, verdict: 'STAGED_BUT_NOT_PROMOTED', operation: 'PARTIAL', summary });
  } else {
    recorder.step('promote', { status: promote.status, body: summarise(promote.status, promote.body) });
    console.log(`  candidates: ${(field(promote.body, 'candidates') || []).length}`);
    console.log(`  records: ${JSON.stringify(field(promote.body, 'records'))}`);
  }

  /* ---------------- resulting source ---------------- */
  line('8. Resulting source in Research');
  const state = await callApi('GET', '/api/mvp/state');
  const sources = field(state.body, 'sources') || [];
  for (const source of sources) {
    console.log(`  ${source.id}  ${source.kind}  synthetic=${source.synthetic}  verified_against_shopee=${source.verified_against_shopee}`);
    console.log(`    label: ${source.label}`);
    console.log(`    freshness: ${source.freshness?.status}  data_as_of=${source.freshness?.data_as_of}  expires_at=${source.freshness?.expires_at}`);
    console.log(`    record counts: ${JSON.stringify(source.record_counts)}`);
    console.log(`    validation: ${source.validation?.status}`);
  }
  console.log(`  state: data_mode=${field(state.body, 'data_mode')}  synthetic=${field(state.body, 'synthetic')}`);
  console.log(`  summary: ${JSON.stringify(field(state.body, 'summary'))}`);
  recorder.step('state', { status: state.status, sources: sources.length, data_mode: field(state.body, 'data_mode') });

  summary.verdict = 'VERIFIED';
  return result({ code: EXIT.VERIFIED, verdict: 'VERIFIED', operation: 'VERIFIED', summary });
}

/* ------------------------------------------------------------------ */
/* finalization (the single exit path)                                 */
/* ------------------------------------------------------------------ */

async function finalize(recorder, outcome) {
  // Snapshot what the child looked like while it was alive: diagnostics and the
  // exact environment it received are only available before termination.
  const liveDiagnostics = ACTIVE_CHILD ? ACTIVE_CHILD.diagnostics() : (outcome.diagnostics || null);
  const liveEnvironment = ACTIVE_CHILD ? ACTIVE_CHILD.env : null;
  const livePid = ACTIVE_CHILD ? ACTIVE_CHILD.lifecycle.pid : null;
  // The workspace record is captured before it is disposed, for the same reason.
  const liveStartup = ACTIVE_CHILD ? ACTIVE_CHILD.startupEvidence() : null;
  const liveWorkspace = WORKSPACE
    ? { copied: WORKSPACE.copied, skipped: WORKSPACE.skipped, inventory: WORKSPACE.inventory, accounting: WORKSPACE.accounting }
    : null;

  const shutdown = ACTIVE_CHILD
    ? await ACTIVE_CHILD.terminate()
    : { attempted: false, confirmed: true, reason: 'no child server was started in this run', direct_child_only: true };
  ACTIVE_CHILD = null;

  const cleanup = await disposeWorkspace(WORKSPACE, OPTIONS.keepTemp);
  WORKSPACE = null;

  const degraded = [];
  let code = outcome.code;
  let verdict = outcome.verdict;
  let operation = outcome.operation;

  if (verdict === 'VERIFIED') {
    if (shutdown.attempted && shutdown.confirmed !== true) {
      verdict = 'CHILD_TERMINATION_UNCONFIRMED';
      operation = 'FAILED';
      code = EXIT.FAILED;
      degraded.push('CHILD_TERMINATION_UNCONFIRMED');
      console.error('');
      console.error('FAIL  the local server could not be confirmed terminated; VERIFIED is withheld.');
      if (shutdown.pid || livePid) {
        console.error(`      a local Node process may still be running (pid ${shutdown.pid || livePid || 'unknown'}).`);
      }
    } else if (cleanup.attempted && !cleanup.removed && !cleanup.kept) {
      degraded.push('WORKSPACE_CLEANUP_FAILED');
      console.error('');
      console.error(`WARN  the temporary workspace could not be removed: ${cleanup.error}`);
      console.error(`      retained at: ${cleanup.path}`);
    }
  }

  if (CANCEL.interrupted) {
    verdict = 'INTERRUPTED';
    operation = 'NOT_RUN';
    code = EXIT.FAILED;
    degraded.push(`interrupted_by_${CANCEL.signal || 'signal'}`);
  }

  const summary = { ...(outcome.summary || {}) };
  if (verdict !== 'VERIFIED') delete summary.verdict;
  summary.verdict = verdict;

  const final = {
    started_at: recorder.startedAt,
    finished_at: nowIso(),
    duration_ms: Date.now() - Date.parse(recorder.startedAt),
    verdict,
    operation_result: operation || 'NOT_RUN',
    exit_code: code,
    summary,
    port: outcome.summary ? outcome.summary.port || null : null,
    child: {
      pid: shutdown.pid || livePid || (outcome.summary ? outcome.summary.child_pid || null : null),
      termination: shutdown,
      environment: liveEnvironment
        ? { injected: liveEnvironment.injected, excluded: liveEnvironment.excluded }
        : null,
    },
    workspace: {
      path: cleanup.path,
      kept: cleanup.kept,
      removed: cleanup.removed,
      copied: liveWorkspace ? liveWorkspace.copied : null,
      excluded_from_copy: liveWorkspace ? liveWorkspace.skipped : null,
      inventory: liveWorkspace ? liveWorkspace.inventory : null,
      accounting: liveWorkspace ? liveWorkspace.accounting : null,
    },
    cleanup,
    degraded,
    interrupted: CANCEL.interrupted ? { signal: CANCEL.signal, at: CANCEL.at } : null,
    platform: { platform: process.platform, arch: process.arch, node: process.version, release: os.release() },
    environment: {
      parent_var_count: Object.keys(process.env).length,
      child_policy: 'allowlist; parent environment is never spread into the child',
      child_injected: liveEnvironment ? liveEnvironment.injected : null,
      child_excluded: liveEnvironment ? liveEnvironment.excluded : null,
    },
    arguments: { path: OPTIONS.path || null, dry_run: OPTIONS.dryRun, keep_temp: OPTIONS.keepTemp },
    side_effects: {
      workspace_created: Boolean(cleanup.path),
      workspace_removed: cleanup.removed,
      workspace_kept: cleanup.kept,
      local_server_started: shutdown.attempted,
      evidence_planned: true,
    },
    limitations: [
      'the child startup line carries no pid or nonce; ownership rests on a fresh port, that line on this child\'s stdout, and child liveness',
      'bind-then-close port allocation has a residual TOCTOU race',
      'on win32 child.kill() terminates unconditionally; the shutdown is not graceful and only the direct child is signalled',
      'force-termination of this process runs no cleanup; a leftover workspace and a local server are possible',
      'HTTP 200 alone was never accepted as proof of ownership; the startup line gated every API call',
    ],
    startup: liveStartup,
    diagnostics: liveDiagnostics,
    overall_result: null,
    evidence_result: null,
  };

  const evidence = recorder.finish(final);
  if (evidence.evidence_result !== 'WRITTEN') {
    degraded.push('EVIDENCE_WRITE_FAILED');
    console.error('');
    console.error(`WARN  run evidence could not be fully written: ${evidence.error || recorder.appendError || 'unknown error'}`);
    console.error('      the test exit code is preserved; evidence is NOT reported as saved');
  }

  const overall = overallResult({ operation, degraded, verdict });
  final.overall_result = overall;
  final.evidence_result = evidence.evidence_result;
  final.evidence = evidence;
  recorder.patchFinal({
    overall_result: overall,
    evidence_result: evidence.evidence_result,
    degraded,
    exit_code: code,
    verdict,
    operation_result: final.operation_result,
    evidence,
  });

  console.log('');
  line('Run result');
  console.log(`  verdict:    ${verdict}`);
  console.log(`  operation:  ${final.operation_result}`);
  console.log(`  evidence:   ${evidence.evidence_result}${evidence.paths.final ? ` (${evidence.paths.final})` : ''}`);
  console.log(`  shutdown:   ${shutdown.attempted ? (shutdown.confirmed ? 'terminated' : 'NOT confirmed terminated') : 'no child started'}${shutdown.elapsed_ms !== null && shutdown.elapsed_ms !== undefined ? ` in ${shutdown.elapsed_ms} ms` : ''}`);
  console.log(`  workspace:  ${!cleanup.attempted ? 'none created' : (cleanup.kept ? `kept at ${cleanup.path}` : (cleanup.removed ? 'removed' : `NOT removed (${cleanup.error})`))}`);
  console.log(`  overall:    ${overall}${degraded.length ? ` (${degraded.join(', ')})` : ''}`);
  console.log(`  exit code:  ${code}`);

  if (verdict === 'VERIFIED' && code === EXIT.VERIFIED) {
    console.log('');
    console.log('REAL SHOPEE EXPORT IMPORTED AND VERIFIED');
    console.log('The export was parsed locally. Shopee was never contacted, and the');
    console.log('file was not checked against the affiliate account.');
  }

  return { code, verdict, overall, evidence, shutdown, cleanup, summary };
}

function overallResult({ operation, degraded, verdict }) {
  if (verdict === 'INTERRUPTED') return 'INTERRUPTED';
  if (operation === 'PENDING') return 'PENDING';
  if (operation === 'PARTIAL') return 'PARTIAL';
  if (operation === 'FAILED') return 'FAILED';
  if (operation === 'NOT_RUN') return 'FAILED';
  if (operation === 'VERIFIED') return degraded.length ? 'DEGRADED' : 'COMPLETE_SUCCESS';
  return 'FAILED';
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

function printHelp() {
  const doc = require('node:fs').readFileSync(__filename, 'utf8');
  const start = doc.indexOf('/**');
  const end = doc.indexOf('*/', start);
  console.log(doc.slice(start, end + 2));
}

async function main() {
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  if (OPTIONS.help) {
    printHelp();
    return { code: EXIT.FAILED, verdict: 'HELP', overall: 'HELP' };
  }
  if (OPTIONS.unknown.length) {
    console.error(`FAIL  unknown option(s): ${OPTIONS.unknown.join(', ')}`);
    console.error('      run with --help for usage');
    process.exitCode = EXIT.FAILED;
    return { code: EXIT.FAILED, verdict: 'UNKNOWN_ARGUMENT', overall: 'FAILED' };
  }
  if (OPTIONS.extra.length) {
    console.error(`FAIL  unexpected extra argument(s): ${OPTIONS.extra.join(', ')} (only one export path is accepted)`);
    process.exitCode = EXIT.FAILED;
    return { code: EXIT.FAILED, verdict: 'UNKNOWN_ARGUMENT', overall: 'FAILED' };
  }

  const recorder = new RunRecorder({ dryRun: OPTIONS.dryRun });
  recorder.begin({
    state: 'IN_PROGRESS',
    platform: process.platform,
    node: process.version,
    repository: REPO,
    argv: process.argv.slice(2),
    ace_import_root: ACE_IMPORT_ROOT,
    options: { dry_run: OPTIONS.dryRun, keep_temp: OPTIONS.keepTemp },
  });

  let outcome;
  try {
    outcome = await execute(recorder, process.env);
  } catch (err) {
    console.error(`FAIL  the checker itself failed: ${err && err.message ? err.message : err}`);
    recorder.step('checker_error', { message: err && err.message ? err.message : String(err), stack: err && err.stack ? redactText(err.stack, 2000) : null });
    outcome = result({
      code: EXIT.FAILED,
      verdict: 'CHECKER_ERROR',
      operation: 'FAILED',
      message: err && err.message ? err.message : String(err),
      summary: { verdict: 'CHECKER_ERROR' },
      diagnostics: ACTIVE_CHILD ? ACTIVE_CHILD.diagnostics() : null,
    });
  }

  const finalized = await finalize(recorder, outcome);
  process.exitCode = finalized.code;
  return finalized;
}

if (require.main === module) {
  main().then(() => {
    // Nothing else runs after finalization: the exit code is process.exitCode.
  }, (err) => {
    console.error(`FAIL  unrecoverable checker error during finalization: ${err && err.message ? err.message : err}`);
    process.exitCode = EXIT.FAILED;
  });
}

module.exports = {
  CHECKER_VERSION,
  EXIT,
  LIMITS,
  STARTUP_LINE_RE,
  buildChildEnv,
  CHILD_ENV_ALLOWLIST,
  allocatePort,
  probePort,
  parseArgs,
  evaluateGuards,
  isSafeWorkspacePath,
  redactText,
  overallResult,
  // exposed so an out-of-repo harness can exercise the child lifecycle
  startChildServer,
  createWorkspace,
  disposeWorkspace,
};
