// @ts-check
/**
 * ACE Status Board — Mini App Node service.
 *
 * Responsibilities
 *  - Serve the Client dashboard at the declared surface path.
 *  - Read live pipeline state from the ACE service (127.0.0.1:4173 by default)
 *    and supplement it with the repository governance files under data/mission1.
 *  - Supervise the ACE service: probe it, and start it when it is not running.
 *  - Keep the board's own snapshots and settings in the Host-owned dataDir.
 *    Nothing in the ACE repository is ever written by this service.
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const DEFAULT_ACE_PORT = 4173;
const DEFAULT_ACE_HOST = '127.0.0.1';
const MAX_SNAPSHOTS = 30;
const MAX_BODY_BYTES = 64 * 1024;

/** @typedef {import('./miniapp-api.js').MiniAppContext} MiniAppContext */
/** @typedef {import('./miniapp-api.js').MiniAppLifecycle} MiniAppLifecycle */

/**
 * @param {MiniAppContext} context
 * @returns {Promise<MiniAppLifecycle>}
 */
export async function start(context) {
  const clientEntry = await readFile(join(context.pluginRoot, 'miniapp/client/index.html'));
  const store = createStore(context.dataDir);

  /** @type {Map<string, import('node:child_process').ChildProcess>} */
  const children = new Map();
  /** @type {{ at: number, child: import('node:child_process').ChildProcess } | null} */
  let starting = null;

  const packaged = await readPackagedConfig(context.pluginRoot);
  const stored = await store.readSettings();

  /**
   * Effective configuration: the board's own stored settings win, then the
   * packaged defaults, then upward discovery from the runtime location.
   */
  const settings = {
    projectRoot: pickString(stored.projectRoot, packaged.projectRoot),
    aceHost: pickString(stored.aceHost, packaged.aceHost) ?? DEFAULT_ACE_HOST,
    acePort: pickPort(stored.acePort, packaged.acePort) ?? DEFAULT_ACE_PORT,
  };

  let projectRoot = settings.projectRoot ? resolve(settings.projectRoot) : discoverProjectRoot(context);
  if (projectRoot && !isAceProject(projectRoot)) {
    projectRoot = discoverProjectRoot(context) ?? projectRoot;
  }

  let acePort = settings.acePort;
  let aceHost = settings.aceHost;

  /**
   * Probe the ACE service and start it when it is down.
   * @returns {Promise<{ online: boolean, baseUrl: string, startedByBoard: boolean, detail: string }>}
   */
  async function ensureService() {
    const baseUrl = `http://${aceHost}:${acePort}`;
    const probe = await probeAce(baseUrl, 1500);
    if (probe.online) {
      return { online: true, baseUrl, startedByBoard: false, detail: probe.detail };
    }

    if (!projectRoot) {
      return {
        online: false,
        baseUrl,
        startedByBoard: false,
        detail: 'ACE project folder not found. Set the project path in Settings.',
      };
    }

    const now = Date.now();
    if (starting && now - starting.at < 15000) {
      return { online: false, baseUrl, startedByBoard: false, detail: 'ACE service is starting…' };
    }

    try {
      const child = spawn(process.execPath, ['app/server.js'], {
        cwd: projectRoot,
        env: { ...process.env, HOST: aceHost, PORT: String(acePort) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      children.set(String(child.pid), child);
      starting = { at: now, child };
      child.stdout?.resume();
      child.stderr?.resume();
      child.once('exit', () => {
        children.delete(String(child.pid));
        if (starting && starting.child === child) starting = null;
      });

      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        await delay(400);
        const retry = await probeAce(baseUrl, 1500);
        if (retry.online) {
          return { online: true, baseUrl, startedByBoard: true, detail: 'Started by this board.' };
        }
        if (child.exitCode !== null) {
          return {
            online: false,
            baseUrl,
            startedByBoard: false,
            detail: `ACE service exited with code ${child.exitCode}.`,
          };
        }
      }
      return { online: false, baseUrl, startedByBoard: false, detail: 'ACE service did not become reachable in time.' };
    } catch (error) {
      return {
        online: false,
        baseUrl,
        startedByBoard: false,
        detail: `Could not start the ACE service: ${describeError(error)}`,
      };
    }
  }

  const server = createServer((request, response) => {
    handle(request, response).catch((error) => {
      sendJson(response, 500, { error: 'internal_error', message: describeError(error) });
    });
  });

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   */
  async function handle(request, response) {
    const url = new URL(request.url ?? '/', 'http://miniapp.local');
    const pathname = url.pathname;

    if (request.method === 'GET' && (pathname === '/dashboard' || pathname === '/')) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(clientEntry);
      return;
    }

    if (request.method === 'GET' && pathname === '/api/status') {
      const service = await ensureService();
      const payload = await collectStatus({ service, projectRoot });
      sendJson(response, 200, payload);
      return;
    }

    if (request.method === 'GET' && pathname === '/api/snapshots') {
      sendJson(response, 200, { snapshots: await store.listSnapshots() });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/snapshots') {
      const body = await readJsonBody(request);
      const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 400) : '';
      const service = await ensureService();
      const status = await collectStatus({ service, projectRoot });
      try {
        const snapshot = await store.addSnapshot({ note, status });
        const snapshots = await store.listSnapshots();
        context.logger.info('miniapp.snapshot.stored', { count: snapshots.length, id: snapshot.id });
        sendJson(response, 201, { snapshot, snapshots });
      } catch (error) {
        context.logger.error('miniapp.snapshot.store_failed', { message: describeError(error) });
        sendJson(response, 500, { error: 'snapshot_store_failed', message: describeError(error) });
      }
      return;
    }

    if (request.method === 'DELETE' && pathname.startsWith('/api/snapshots/')) {
      const id = decodeURIComponent(pathname.slice('/api/snapshots/'.length));
      const removed = await store.removeSnapshot(id);
      if (!removed) {
        sendJson(response, 404, { error: 'not_found' });
        return;
      }
      sendJson(response, 200, { snapshots: await store.listSnapshots() });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/view-state') {
      sendJson(response, 200, { viewState: await store.readViewState() });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/view-state') {
      const body = await readJsonBody(request);
      const tab = typeof body?.tab === 'string' ? body.tab.trim() : '';
      const allowed = ['overview', 'candidates', 'contents', 'governance', 'snapshots', 'settings'];
      const themes = ['system', 'light', 'dark'];
      const current = await store.readViewState();
      const nextTab = allowed.includes(tab) ? tab : typeof current.tab === 'string' ? current.tab : 'overview';
      const nextTheme =
        typeof body?.theme === 'string' && themes.includes(body.theme)
          ? body.theme
          : typeof current.theme === 'string' && themes.includes(current.theme)
            ? current.theme
            : 'system';
      await store.writeViewState({ tab: nextTab, theme: nextTheme });
      sendJson(response, 200, { viewState: { tab: nextTab, theme: nextTheme } });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/settings') {
      sendJson(response, 200, {
        settings: {
          projectRoot: settings.projectRoot ?? '',
          aceHost,
          acePort,
        },
        projectRootDetected: projectRoot,
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/settings') {
      const body = await readJsonBody(request);
      const next = { ...(await store.readSettings()) };
      if (typeof body?.projectRoot === 'string') {
        const value = body.projectRoot.trim();
        next.projectRoot = value ? resolve(value) : '';
        projectRoot = next.projectRoot ? resolve(next.projectRoot) : discoverProjectRoot(context);
        settings.projectRoot = next.projectRoot;
      }
      if (Number.isInteger(body?.acePort) && body.acePort > 0 && body.acePort < 65536) {
        next.acePort = body.acePort;
        acePort = body.acePort;
      }
      if (typeof body?.aceHost === 'string' && body.aceHost.trim()) {
        next.aceHost = body.aceHost.trim();
        aceHost = next.aceHost;
      }
      await store.writeSettings(next);
      sendJson(response, 200, {
        settings: { projectRoot: settings.projectRoot ?? '', aceHost, acePort },
        projectRootDetected: projectRoot,
      });
      return;
    }

    sendJson(response, 404, { error: 'not_found' });
  }

  await new Promise((resolvePromise, reject) => {
    const onError = (error) => reject(error);
    server.once('error', onError);
    server.listen(context.listen.port, context.listen.host, () => {
      server.off('error', onError);
      resolvePromise(undefined);
    });
  });
  context.logger.info('miniapp.runtime.listening');

  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    context.signal.removeEventListener('abort', onAbort);
    for (const child of children.values()) {
      try {
        child.kill();
      } catch {
        /* the child is already gone */
      }
    }
    children.clear();
    await new Promise((resolvePromise) => {
      server.close(() => resolvePromise(undefined));
      server.closeAllConnections?.();
    });
  };
  const onAbort = () => {
    void dispose();
  };
  context.signal.addEventListener('abort', onAbort, { once: true });
  if (context.signal.aborted) await dispose();

  return { dispose };
}

/* ------------------------------------------------------------------ *
 * Status collection
 * ------------------------------------------------------------------ */

/**
 * @param {{ service: { online: boolean, baseUrl: string, startedByBoard: boolean, detail: string }, projectRoot: string | null }} input
 */
async function collectStatus({ service, projectRoot }) {
  const governance = await readGovernance(projectRoot);
  const pipeline = service.online ? await readPipeline(service.baseUrl) : null;

  const state = pipeline?.state ?? null;
  const meta = pipeline?.meta ?? null;

  return {
    generatedAt: new Date().toISOString(),
    projectRoot,
    service: {
      online: service.online,
      baseUrl: service.baseUrl,
      startedByBoard: service.startedByBoard,
      detail: service.detail,
    },
    pipeline: pipeline
      ? {
          available: true,
          meta: meta
            ? {
                synthetic: Boolean(meta.synthetic),
                dataMode: state?.data_mode ?? null,
                cycle: state?.cycle ?? null,
                pipeline: Array.isArray(meta.pipeline) ? meta.pipeline : [],
                realExport: meta.real_export ?? null,
                boundaries: Array.isArray(meta.boundaries) ? meta.boundaries : [],
                fixture: meta.fixture
                  ? {
                      label: meta.fixture.label ?? null,
                      file: meta.fixture.file ?? null,
                      rowCount: meta.fixture.row_count ?? null,
                      sha256: meta.fixture.sha256 ?? null,
                    }
                  : null,
              }
            : null,
          summary: state?.summary ?? null,
          stages: buildStages(state, meta),
          candidates: buildCandidates(state),
          contents: buildContents(state),
          freshness: Array.isArray(state?.freshness_warnings) ? state.freshness_warnings : [],
          import: state?.import ? compactImport(state.import) : null,
          aiResearch: state?.ai_research ? compactAiResearch(state.ai_research) : null,
          profile: state?.active_profile ?? null,
          platforms: Array.isArray(state?.platforms) ? state.platforms : [],
          errors: pipeline.errors ?? [],
        }
      : { available: false, errors: [{ source: 'service', message: service.detail }] },
    governance,
  };
}

/**
 * @param {any} state
 * @param {any} meta
 */
function buildStages(state, meta) {
  const order = Array.isArray(meta?.pipeline) ? meta.pipeline : ['import', 'research', 'candidates', 'workspace', 'plan', 'content'];
  const labels = {
    import: 'Import',
    research: 'Research',
    candidates: 'Candidates',
    workspace: 'Workspace',
    plan: 'Plan',
    content: 'Content',
  };
  const counts = state?.summary?.status_counts ?? {};

  return order.map((key, index) => {
    const label = labels[key] ?? key;
    if (!state) {
      return { key, label, order: index + 1, status: 'UNKNOWN', detail: 'No pipeline state available.', count: null };
    }
    if (key === 'import') {
      const validation = state.import?.source_validation?.status ?? 'UNKNOWN';
      return {
        key,
        label,
        order: index + 1,
        status: state.import ? 'DONE' : 'NOT_STARTED',
        detail: state.import
          ? `${state.import.row_count ?? 0} rows · source validation ${validation}`
          : 'No import record.',
        count: state.import?.row_count ?? 0,
      };
    }
    if (key === 'research') {
      const research = state.ai_research;
      const warnings = Array.isArray(state.freshness_warnings) ? state.freshness_warnings.length : 0;
      return {
        key,
        label,
        order: index + 1,
        status: research?.ran_at ? (warnings ? 'DONE' : 'DONE') : 'NOT_STARTED',
        detail: research?.ran_at
          ? `Ran ${String(research.ran_at).slice(0, 10)} · model ${research.model ?? 'n/a'} · ${warnings} freshness warning(s)`
          : 'No AI research run recorded.',
        count: research?.pool_size ?? null,
      };
    }
    if (key === 'candidates') {
      const total = state.candidates?.length ?? 0;
      const saved = counts.SAVED ?? 0;
      const queued = state.queue?.length ?? 0;
      return {
        key,
        label,
        order: index + 1,
        status: total ? 'DONE' : 'NOT_STARTED',
        detail: `${total} candidate(s) · ${saved} saved · ${queued} queued`,
        count: total,
      };
    }
    if (key === 'workspace') {
      const sources = state.summary?.sources ?? 0;
      const products = state.summary?.products ?? 0;
      const evidence = state.summary?.evidence ?? 0;
      return {
        key,
        label,
        order: index + 1,
        status: sources ? 'DONE' : 'NOT_STARTED',
        detail: `${sources} source(s) · ${products} product(s) · ${evidence} evidence item(s)`,
        count: sources,
      };
    }
    if (key === 'plan') {
      const plans = state.plans?.length ?? 0;
      const drafts = state.planDrafts?.length ?? 0;
      return {
        key,
        label,
        order: index + 1,
        status: plans ? 'DONE' : drafts ? 'IN_PROGRESS' : 'NOT_STARTED',
        detail: `${plans} approved plan(s) · ${drafts} draft(s)`,
        count: plans,
      };
    }
    const contents = state.contents?.length ?? 0;
    const ready = (state.contents ?? []).filter((item) => item.status === 'READY_TO_PUBLISH').length;
    return {
      key,
      label,
      order: index + 1,
      status: contents ? (ready ? 'DONE' : 'IN_PROGRESS') : 'NOT_STARTED',
      detail: `${contents} content project(s) · ${ready} ready to publish`,
      count: contents,
    };
  });
}

/**
 * @param {any} state
 */
function buildCandidates(state) {
  const offers = new Map((state?.offers ?? []).map((offer) => [offer.id, offer]));
  const queued = new Set(state?.queue ?? []);
  const candidates = state?.candidates ?? [];

  return candidates.map((candidate) => {
    const offer = offers.get(candidate.offer_id);
    const scores = candidate.scores ?? {};
    return {
      id: candidate.id,
      rank: candidate.rank ?? null,
      title: candidate.title ?? null,
      shop: candidate.shop?.name ?? offer?.shop_name ?? null,
      category: candidate.category ?? null,
      status: candidate.status ?? null,
      queued: queued.has(candidate.id),
      priceThb: offer?.price_thb ?? null,
      listPriceThb: offer?.list_price_thb ?? null,
      commissionThb: offer?.commission_per_order_thb ?? null,
      commissionRate: offer?.commission_rate ?? null,
      promoLabel: offer?.promo?.label ?? null,
      rating: offer?.reviews?.rating ?? null,
      ratingCount: offer?.reviews?.rating_count ?? null,
      unitsSold: offer?.reviews?.units_sold ?? null,
      rankingScore: scores.ranking_score ?? null,
      opportunityScore: scores.opportunity_score ?? null,
      confidence: scores.confidence?.level ?? null,
      confidenceBasis: scores.confidence?.basis ?? null,
      synthetic: Boolean(candidate.synthetic),
    };
  });
}

/**
 * @param {any} state
 */
function buildContents(state) {
  const contents = state?.contents ?? [];
  return contents.map((content) => {
    const exportInfo = content.export ?? null;
    const schedule = content.publish_schedule ?? null;
    const qa = content.qa ?? null;
    const scenes = content.storyboard?.scenes ?? content.scenes ?? null;
    return {
      id: content.id,
      status: content.status ?? null,
      approach: content.approach ?? null,
      language: content.language ?? null,
      scriptVersion: content.script_version ?? null,
      candidateId: content.candidate_id ?? null,
      productName: content.offer_snapshot?.product_name ?? null,
      shopName: content.offer_snapshot?.shop_name ?? null,
      priceThb: content.offer_snapshot?.price_thb ?? null,
      createdAt: content.created_at ?? null,
      updatedAt: content.updated_at ?? null,
      qaPassed: typeof qa?.passed === 'boolean' ? qa.passed : null,
      qaSummary: qa?.summary ?? null,
      sceneCount: Array.isArray(scenes) ? scenes.length : null,
      exportFile: exportInfo?.filename ?? null,
      exportBytes: exportInfo?.bytes ?? null,
      durationS: exportInfo?.duration_s ?? null,
      aspectRatio: exportInfo?.aspect_ratio ?? null,
      publishStatus: schedule?.status ?? null,
      publishChannel: schedule?.channel ?? null,
      scheduledAt: schedule?.scheduled_at ?? null,
      publishedAt: schedule?.published_at ?? null,
      approvedBy: schedule?.approved_by ?? null,
      simulated: schedule?.simulated ?? null,
      synthetic: Boolean(content.synthetic),
    };
  });
}

/**
 * @param {any} value
 */
function compactImport(value) {
  return {
    id: value.id ?? null,
    file: value.file ?? null,
    label: value.label ?? null,
    sourceType: value.source_type ?? null,
    rowCount: value.row_count ?? null,
    importedAt: value.imported_at ?? null,
    checkedAt: value.checked_at ?? null,
    dataAsOf: value.data_as_of ?? null,
    expiresAt: value.expires_at ?? null,
    synthetic: Boolean(value.synthetic),
    validationStatus: value.source_validation?.status ?? null,
  };
}

/**
 * @param {any} value
 */
function compactAiResearch(value) {
  return {
    ranAt: value.ran_at ?? null,
    model: value.model ?? null,
    latencyMs: value.latency_ms ?? null,
    poolSize: value.pool_size ?? null,
    provenance: value.provenance ?? null,
    summary: value.analysis?.summary ?? null,
    picks: Array.isArray(value.analysis?.picks)
      ? value.analysis.picks.slice(0, 8).map((pick) => ({
          candidateId: pick.candidate_id ?? null,
          title: pick.title ?? null,
          fitScore: pick.fit_score ?? null,
          hook: pick.hook ?? null,
          why: pick.why ?? null,
          risks: pick.risks ?? null,
        }))
      : [],
  };
}

/* ------------------------------------------------------------------ *
 * Repository governance files (read only)
 * ------------------------------------------------------------------ */

/**
 * @param {string | null} projectRoot
 */
async function readGovernance(projectRoot) {
  /** @type {any} */
  const result = {
    available: false,
    projectRoot,
    workflowState: null,
    budget: null,
    decisions: [],
    runHistory: [],
    evidence: null,
    contentLibrary: null,
    files: [],
  };
  if (!projectRoot) return result;

  const files = [
    { key: 'workflow-state.yaml', label: 'Workflow state' },
    { key: 'run-history.yaml', label: 'Run history' },
    { key: 'decision-log.md', label: 'Decision log' },
    { key: 'evidence-log.md', label: 'Evidence log' },
    { key: 'cost-budget.yaml', label: 'Cost budget' },
    { key: 'content-library.json', label: 'Content library' },
  ];

  for (const file of files) {
    const relative = join('data', 'mission1', file.key);
    const absolute = join(projectRoot, relative);
    try {
      const text = await readFile(absolute, 'utf8');
      result.files.push({ label: file.label, path: relative, status: 'read', bytes: Buffer.byteLength(text) });
      if (file.key === 'workflow-state.yaml') result.workflowState = parseSimpleYaml(text);
      if (file.key === 'cost-budget.yaml') result.budget = parseSimpleYaml(text);
      if (file.key === 'run-history.yaml') result.runHistory = parseRunHistory(text);
      if (file.key === 'decision-log.md') result.decisions = parseDecisionLog(text);
      if (file.key === 'evidence-log.md') result.evidence = parseEvidenceLog(text);
      if (file.key === 'content-library.json') result.contentLibrary = parseContentLibrary(text);
    } catch (error) {
      result.files.push({
        label: file.label,
        path: relative,
        status: 'missing',
        bytes: 0,
        detail: describeError(error),
      });
    }
  }

  result.available = result.files.some((file) => file.status === 'read');
  return result;
}

/**
 * Minimal top-level `key: value` YAML reader. The Mission 1 foundation files use
 * exactly this shape, so no YAML dependency is needed.
 * @param {string} text
 */
function parseSimpleYaml(text) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line || line.trimStart().startsWith('#')) continue;
    if (/^\s/.test(line)) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    out[match[1]] = coerceScalar(unquote(match[2]));
  }
  return out;
}

/**
 * Convert a plain YAML scalar into its natural JS type.
 * @param {string} value
 * @returns {string | number | boolean | unknown[]}
 */
function coerceScalar(value) {
  if (value === '') return '';
  if (value === '[]') return [];
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

/**
 * @param {string} text
 */
function parseRunHistory(text) {
  const entries = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    const listMatch = /^\s*-\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(rawLine);
    if (listMatch) {
      if (current) entries.push(current);
      current = { [listMatch[1]]: unquote(listMatch[2]) };
      continue;
    }
    const fieldMatch = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(rawLine);
    if (fieldMatch && current) {
      current[fieldMatch[1]] = unquote(fieldMatch[2]);
    }
  }
  if (current) entries.push(current);
  return entries
    .map((entry) => ({
      ts: entry.ts ?? null,
      actor: entry.actor ?? null,
      action: entry.action ?? null,
      result: entry.result ?? null,
    }))
    .reverse();
}

/**
 * @param {string} text
 */
function parseDecisionLog(text) {
  const decisions = [];
  const sections = text.split(/^##\s+/m).slice(1);
  for (const section of sections) {
    const heading = section.split(/\r?\n/, 1)[0]?.trim() ?? '';
    if (!/^DEC-/.test(heading)) continue;
    const id = heading.split(/\s+/)[0];
    /** @type {Record<string, string>} */
    const fields = {};
    for (const line of section.split(/\r?\n/)) {
      const row = /^\|\s*\*\*([a-z_]+)\*\*\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
      if (row) fields[row[1]] = stripMarkdown(row[2]);
    }
    decisions.push({
      id: fields.id ?? id,
      gate: fields.gate ?? null,
      decidedAt: fields.decided_at ?? null,
      result: fields.result ?? null,
      approver: fields.approver ?? null,
      title: heading.replace(/^\S+\s+/, ''),
      rationale: fields.rationale ?? null,
    });
  }
  return decisions;
}

/**
 * @param {string} text
 */
function parseEvidenceLog(text) {
  const headings = text.match(/^##\s+EV-[^\n]*$/gm) ?? [];
  const claimClasses = {};
  for (const match of text.matchAll(/claim_class:\*\*\s*([A-Z]+)/g)) {
    const key = match[1];
    claimClasses[key] = (claimClasses[key] ?? 0) + 1;
  }
  const entries = headings.map((heading) => {
    const id = heading.replace(/^##\s+/, '').trim();
    const start = text.indexOf(heading);
    const block = text.slice(start, start + 1400);
    const finding = /- \*\*finding:\*\*\s*(.*)/.exec(block)?.[1] ?? null;
    const claimClass = /- \*\*claim_class:\*\*\s*([A-Z]+)/.exec(block)?.[1] ?? null;
    const retrieved = /- \*\*retrieved_at:\*\*\s*(.*)/.exec(block)?.[1] ?? null;
    return {
      id,
      claimClass,
      retrievedAt: retrieved ? retrieved.trim() : null,
      finding: finding ? finding.trim() : null,
    };
  });
  return { count: headings.length, byClaimClass: claimClasses, entries };
}

/**
 * @param {string} text
 */
function parseContentLibrary(text) {
  try {
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return {
      count: items.length,
      items: items.map((item) => ({
        id: item.id ?? null,
        filename: item.filename ?? null,
        status: item.status ?? null,
        aspectRatio: item.aspect_ratio ?? null,
        durationS: item.duration_s ?? null,
        exportedAt: item.exported_at ?? null,
        publicationStatus: item.publication?.status ?? null,
        channel: item.publication?.channel ?? null,
        publishedAt: item.publication?.published_at ?? null,
        simulated: item.publication?.simulated ?? null,
      })),
    };
  } catch (error) {
    return { count: 0, items: [], error: describeError(error) };
  }
}

/* ------------------------------------------------------------------ *
 * Service probing
 * ------------------------------------------------------------------ */

/**
 * @param {string} baseUrl
 * @param {number} timeoutMs
 */
async function probeAce(baseUrl, timeoutMs) {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return { online: false, detail: `Health endpoint returned ${response.status}.` };
    }
    const body = await response.json();
    return { online: true, detail: `Service healthy · state file ${body?.stateFile ?? 'unknown'}` };
  } catch (error) {
    return { online: false, detail: describeError(error) };
  }
}

/**
 * @param {string} baseUrl
 */
async function readPipeline(baseUrl) {
  /** @type {any[]} */
  const errors = [];
  const [meta, state] = await Promise.all([
    fetchJson(`${baseUrl}/api/mvp/meta`, errors, 'meta'),
    fetchJson(`${baseUrl}/api/mvp/state`, errors, 'state'),
  ]);
  return { meta, state, errors };
}

/**
 * @param {string} url
 * @param {any[]} errors
 * @param {string} label
 */
async function fetchJson(url, errors, label) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      errors.push({ source: label, message: `HTTP ${response.status}` });
      return null;
    }
    return await response.json();
  } catch (error) {
    errors.push({ source: label, message: describeError(error) });
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Persistence (board-owned dataDir only)
 * ------------------------------------------------------------------ */

/**
 * @param {string} dataDir
 */
function createStore(dataDir) {
  const settingsPath = join(dataDir, 'settings.json');
  const snapshotsPath = join(dataDir, 'snapshots.json');
  const viewStatePath = join(dataDir, 'view-state.json');

  /**
   * @param {string} path
   * @param {unknown} value
   */
  const writeJsonAtomic = async (path, value) => {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
  };

  /**
   * @param {string} path
   * @returns {Promise<any>}
   */
  const readJson = async (path) => {
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw error;
    }
  };

  return {
    async readSettings() {
      try {
        const value = await readJson(settingsPath);
        return value && typeof value === 'object' ? value : {};
      } catch {
        return {};
      }
    },
    async writeSettings(value) {
      await writeJsonAtomic(settingsPath, value);
      return value;
    },
    async listSnapshots() {
      try {
        const value = await readJson(snapshotsPath);
        return Array.isArray(value?.snapshots) ? value.snapshots : [];
      } catch {
        return [];
      }
    },
    async addSnapshot({ note, status }) {
      const snapshots = await this.listSnapshots();
      const snapshot = {
        id: `SNP-${Date.now().toString(36).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        note,
        summary: summarise(status),
      };
      const next = [snapshot, ...snapshots].slice(0, MAX_SNAPSHOTS);
      await writeJsonAtomic(snapshotsPath, { snapshots: next });
      return snapshot;
    },
    async removeSnapshot(id) {
      const snapshots = await this.listSnapshots();
      const next = snapshots.filter((snapshot) => snapshot.id !== id);
      if (next.length === snapshots.length) return false;
      await writeJsonAtomic(snapshotsPath, { snapshots: next });
      return true;
    },
    async readViewState() {
      try {
        const value = await readJson(viewStatePath);
        return value && typeof value === 'object' ? value : {};
      } catch {
        return {};
      }
    },
    async writeViewState(value) {
      await writeJsonAtomic(viewStatePath, value);
      return value;
    },
  };
}

/**
 * @param {any} status
 */
function summarise(status) {
  const stages = status?.pipeline?.stages ?? [];
  return {
    serviceOnline: Boolean(status?.service?.online),
    dataMode: status?.pipeline?.meta?.dataMode ?? null,
    synthetic: Boolean(status?.pipeline?.meta?.synthetic),
    candidates: status?.pipeline?.candidates?.length ?? 0,
    contents: status?.pipeline?.contents?.length ?? 0,
    readyToPublish: (status?.pipeline?.contents ?? []).filter((item) => item.status === 'READY_TO_PUBLISH').length,
    freshnessWarnings: status?.pipeline?.freshness?.length ?? 0,
    stageStatus: stages.map((stage) => `${stage.key}:${stage.status}`).join(', '),
    currentStage: status?.governance?.workflowState?.current_stage ?? null,
    stageStatusLabel: status?.governance?.workflowState?.stage_status ?? null,
    budgetSpentThb: status?.governance?.budget?.spent_thb_actual ?? null,
    decisionCount: status?.governance?.decisions?.length ?? 0,
  };
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/**
 * @param {MiniAppContext} context
 */
function discoverProjectRoot(context) {
  const candidates = [];
  if (process.env.ACE_PROJECT_ROOT) candidates.push(process.env.ACE_PROJECT_ROOT);
  candidates.push(context.pluginRoot, process.cwd());

  for (const start of candidates) {
    let current = resolve(start);
    for (let depth = 0; depth < 8; depth += 1) {
      if (isAceProject(current)) return current;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

/**
 * Read the packaged default configuration. The published runtime lives outside
 * the workspace, so the ACE project path cannot be rediscovered from the
 * runtime location alone.
 * @param {string} pluginRoot
 */
async function readPackagedConfig(pluginRoot) {
  try {
    const text = await readFile(join(pluginRoot, 'miniapp/node/ace-config.json'), 'utf8');
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {unknown} preferred
 * @param {unknown} fallback
 * @returns {string | undefined}
 */
function pickString(preferred, fallback) {
  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim();
  return undefined;
}

/**
 * @param {unknown} preferred
 * @param {unknown} fallback
 * @returns {number | undefined}
 */
function pickPort(preferred, fallback) {
  if (Number.isInteger(preferred) && /** @type {number} */ (preferred) > 0) return /** @type {number} */ (preferred);
  if (Number.isInteger(fallback) && /** @type {number} */ (fallback) > 0) return /** @type {number} */ (fallback);
  return undefined;
}

/**
 * @param {string} directory
 */
function isAceProject(directory) {
  try {
    return (
      existsSync(join(directory, 'app', 'server.js')) &&
      existsSync(join(directory, 'data', 'mission1', 'workflow-state.yaml'))
    );
  } catch {
    return false;
  }
}

/**
 * @param {string} value
 */
function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * @param {string} value
 */
function stripMarkdown(value) {
  return value.replace(/`/g, '').replace(/\*\*/g, '').trim();
}

/**
 * @param {unknown} error
 */
function describeError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} status
 * @param {unknown} payload
 */
function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(body);
}

/**
 * @param {import('node:http').IncomingMessage} request
 */
async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}
