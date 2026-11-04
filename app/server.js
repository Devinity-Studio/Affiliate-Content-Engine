'use strict';

/**
 * ACE — Mission 1 vertical slice server.
 *
 * Zero dependencies. Serves app/public, exposes read-only mock opportunities,
 * and persists human opportunity decisions to data/app/state.json.
 *
 * This server deliberately knows nothing about G2..G5: it records an
 * OPPORTUNITY decision only, and never a gate approval.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

// MVP affiliate workflow slice. It owns its own fixture state and never touches
// data/app/state.json or the Plan Version / CWI contracts.
const mvp = require('./mvp/service');

const HOST = process.env.HOST || '127.0.0.1';
const requestedPort = Number(process.env.PORT);
// PORT=0 means "any free port" to some shells; this slice wants a stable local URL.
const PORT = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4173;

const APP_DIR = __dirname;
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const MOCK_FILE = path.join(APP_DIR, 'mock', 'opportunities.json');
const STATE_DIR = path.join(APP_DIR, '..', 'data', 'app');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const DECISIONS = new Set(['SELECT', 'REJECT', 'DEFER']);
// The four claim classes of Doc D §3.1: FACT / INFERENCE / HYPOTHESIS / UNKNOWN.
// HYPOTHESIS marks a proposal that still has to be tested; UNKNOWN marks a claim
// that cannot yet be classified or lacks sufficient evidence.
const CLAIM_CLASSES = new Set(['FACT', 'INFERENCE', 'HYPOTHESIS', 'UNKNOWN']);

// Serialises read-modify-write cycles on state.json so two rapid decisions
// cannot both read the same history length and reuse a decision id.
let stateQueue = Promise.resolve();
function withStateLock(fn) {
  const run = stateQueue.then(fn, fn);
  stateQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function baseState() {
  return {
    schemaVersion: 1,
    cycle: 1,
    selectedOpportunityId: null,
    lastDecisionAt: null,
    decisions: [],
    planVersions: {},
    cwis: {},
  };
};

async function ensureState() {
  await fsp.mkdir(STATE_DIR, { recursive: true });
  try {
    await fsp.access(STATE_FILE);
  } catch {
    await writeState(baseState());
  }
}

async function readState() {
  await ensureState();
  const raw = await fsp.readFile(STATE_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.decisions)) {
    throw new Error('state.json is not a valid ACE state file');
  }
  // Ensure planVersions and cwis exist for plan/CWI operations
  if (parsed.planVersions === undefined) parsed.planVersions = {};
  if (parsed.cwis === undefined) parsed.cwis = {};
  return parsed;
}

async function writeState(state) {
  await fsp.mkdir(STATE_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fsp.rename(tmp, STATE_FILE);
}

function validateMock(mock) {
  const errors = [];
  if (!mock || typeof mock !== 'object') return ['mock file must be a JSON object'];
  if (mock.meta?.mock !== true) errors.push('meta.mock must be true: the dataset must stay labelled synthetic');
  if (!Array.isArray(mock.opportunities) || mock.opportunities.length === 0) {
    errors.push('opportunities must be a non-empty array');
  }
  for (const [index, opp] of (mock.opportunities || []).entries()) {
    const at = `opportunities[${index}]`;
    if (!opp || typeof opp !== 'object') {
      errors.push(`${at} must be an object`);
      continue;
    }
    for (const field of ['id', 'title', 'niche', 'audience', 'problem', 'whyNow']) {
      if (typeof opp[field] !== 'string' || opp[field].trim() === '') errors.push(`${at}.${field} must be a non-empty string`);
    }
    if (opp.mock !== true) errors.push(`${at}.mock must be true`);
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(opp.confidence?.level)) errors.push(`${at}.confidence.level is invalid`);
    if (opp.measurement?.status !== 'NOT_YET_MEASURABLE') {
      errors.push(`${at}.measurement.status must be NOT_YET_MEASURABLE while OQ-8 is unresolved`);
    }
    if (!Array.isArray(opp.evidence) || opp.evidence.length === 0) errors.push(`${at}.evidence must be a non-empty array`);
    for (const [i, item] of (opp.evidence || []).entries()) {
      if (!CLAIM_CLASSES.has(item?.claimClass)) errors.push(`${at}.evidence[${i}].claimClass is invalid`);
      if (item?.mock !== true) errors.push(`${at}.evidence[${i}].mock must be true`);
      for (const field of ['id', 'source', 'finding', 'limitations']) {
        if (typeof item?.[field] !== 'string' || item[field].trim() === '') {
          errors.push(`${at}.evidence[${i}].${field} must be a non-empty string`);
        }
      }
    }
    if (!opp.analysis || !Array.isArray(opp.analysis.terms) || opp.analysis.terms.length === 0) {
      errors.push(`${at}.analysis.terms must be a non-empty array`);
    }
    if (typeof opp.brief?.rationale !== 'string' || !Array.isArray(opp.brief?.uncertainties)) {
      errors.push(`${at}.brief must include rationale and uncertainties`);
    }
  }
  return errors;
}

async function readMock() {
  const raw = await fsp.readFile(MOCK_FILE, 'utf8');
  const mock = JSON.parse(raw);
  const errors = validateMock(mock);
  if (errors.length > 0) {
    throw Object.assign(new Error(`Mock dataset is invalid: ${errors.join('; ')}`), { status: 500 });
  }
  return mock;
}

// --- CWI contract ---------------------------------------------------------
// The Content Work Item record contract lives in
// docs/mission1/schemas/content-work-item.schema.json and is the single source
// of truth. The server evaluates that file instead of re-implementing the rules,
// so the API cannot drift away from the contract. The evaluator covers the JSON
// Schema subset the contract uses: type, required, properties,
// additionalProperties, enum, pattern, minLength and if/then. `format` is
// annotation-only and is not enforced.
const CWI_SCHEMA_PATH = path.join(APP_DIR, '..', 'docs', 'mission1', 'schemas', 'content-work-item.schema.json');
const CWI_BODY_FIELDS = new Set(['plan_id', 'plan_version', 'type', 'product_id', 'decision']);
let cwiSchema = null;

function loadCwiSchema() {
  if (!cwiSchema) cwiSchema = JSON.parse(fs.readFileSync(CWI_SCHEMA_PATH, 'utf8'));
  return cwiSchema;
}

function typeMatches(value, type) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => {
    switch (t) {
      case 'string': return typeof value === 'string';
      case 'null': return value === null;
      case 'number': return typeof value === 'number' && Number.isFinite(value);
      case 'integer': return Number.isInteger(value);
      case 'boolean': return typeof value === 'boolean';
      case 'array': return Array.isArray(value);
      case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
      default: return false;
    }
  });
}

function describeType(type) {
  const types = Array.isArray(type) ? type : [type];
  const words = types.map((t) => (t === 'string' ? 'a string' : t === 'null' ? 'null' : `a ${t}`));
  return words.length === 1 ? words[0] : words.join(' or ');
}

function checkSchema(schema, data, at, errors) {
  if (!schema) return;
  if (schema.type && !typeMatches(data, schema.type)) {
    errors.push(`${at} must be ${describeType(schema.type)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${at} must be one of ${schema.enum.join(', ')}`);
  }
  if (typeof data === 'string') {
    if (typeof schema.minLength === 'number' && data.length < schema.minLength) {
      errors.push(`${at} must not be empty`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${at} has an invalid format`);
    }
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    for (const key of schema.required || []) {
      if (!(key in data)) errors.push(`${key} is required`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in data) checkSchema(sub, data[key], key, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in (schema.properties || {}))) errors.push(`${key} is not a recognised field`);
      }
    }
  }
}

// Human-readable contract errors for one CWI record. The if/then branch is
// applied in addition to the base schema, so a PRODUCT or REVIEW record must
// satisfy both — the branch is what rejects a null or missing product_id.
function cwiContractErrors(record) {
  const schema = loadCwiSchema();
  const errors = [];
  checkSchema(schema, record, 'record', errors);
  if (schema.if) {
    const ifErrors = [];
    checkSchema(schema.if, record, 'record', ifErrors);
    if (ifErrors.length === 0) {
      const branchErrors = [];
      checkSchema(schema.then, record, 'record', branchErrors);
      for (const err of branchErrors) errors.push(`${err} for type ${record.type}`);
    }
  }
  return errors;
}

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

async function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.removeAllListeners('data');
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function validateDecision(body, opportunities) {
  const errors = [];
  const id = typeof body.opportunityId === 'string' ? body.opportunityId.trim() : '';
  const decision = typeof body.decision === 'string' ? body.decision.trim().toUpperCase() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!opportunities.some((o) => o.id === id)) errors.push('opportunityId must match a mock opportunity');
  if (!DECISIONS.has(decision)) errors.push('decision must be SELECT, REJECT or DEFER');
  if (reason.length > 1000) errors.push('reason must be 1000 characters or fewer');
  // Doc J Step 1 acceptance requires a recorded reason for the selected candidate,
  // so every decision carries one; this also prevents accidental blank submissions.
  if (reason.length < 3) errors.push('reason is required for every decision');

  return { errors, id, decision, reason };
}

async function serveStatic(req, res, pathname, headOnly = false) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, relative);
  if (!resolved.startsWith(`${PUBLIC_DIR}${path.sep}`) && resolved !== path.join(PUBLIC_DIR, 'index.html')) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  let target = resolved;
  try {
    const stat = await fsp.stat(target);
    if (stat.isDirectory()) target = path.join(target, 'index.html');
  } catch {
    sendText(res, 404, 'Not found');
    return;
  }

  try {
    const data = await fsp.readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
    });
    res.end(headOnly ? undefined : data);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      if (pathname.startsWith('/api/mvp/')) {
        await mvp.handleMvp(req, res, { pathname, sendJson, readBody });
        return;
      }

      if (pathname === '/api/opportunities' && req.method === 'GET') {
        sendJson(res, 200, await readMock());
        return;
      }

      if (pathname === '/api/health' && req.method === 'GET') {
        sendJson(res, 200, { ok: true, mock: true, stateFile: 'data/app/state.json' });
        return;
      }

      if (pathname === '/api/plan-version' && req.method === 'POST') {
        const raw = await readBody(req);
        let body;
        try {
          body = JSON.parse(raw || '{}');
        } catch {
          sendJson(res, 400, { error: 'Body must be valid JSON' });
          return;
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          sendJson(res, 400, { error: 'Body must be a JSON object' });
          return;
        }

        const planOperation = typeof body.operation === 'string' ? body.operation.trim() : '';
        const content = typeof body.content === 'string' ? body.content.trim() : '';

        // Validate required fields
        if (!content) {
          sendJson(res, 400, { error: 'content is required' });
          return;
        }

        if (!planOperation) {
          sendJson(res, 400, { error: 'unsupported operation: <value>' });
          return;
        }

        await withStateLock(async () => {
          // Read state once at the start of this handler
          const state = await readState();

          // Handle 'create' operation: create a new Plan with initial version v1
          if (planOperation === 'create') {
            // Server generates plan_id from cycle context; client omits plan_id
            const cycle = Number(state.cycle) || 1;
            // Extract plan_number by finding the max existing plan_number from plan_ids
            // (plan_id format: PLAN-<cycle>-<plan_number>)
            const existingPlanIds = Object.values(state.planVersions || {}).map((v) => v.plan_id).filter((id) => id && id.startsWith(`PLAN-${cycle}-`));
            const maxPlanNumber = existingPlanIds.length > 0
              ? Math.max(...existingPlanIds.map((id) => Number(id.split('-')[2])))
              : 0;
            const planNumber = maxPlanNumber + 1;
            const planId = `PLAN-${cycle}-${planNumber}`;
            const versionId = `${planId}-v1`;

            // Check for collision: if this (planId, v1) already exists
            if (state.planVersions[versionId]) {
              sendJson(res, 409, { error: `plan_id/plan_version already exists: ${planId}/v1` });
              return;
            }

            // Create new Plan with initial version
            const createdAt = new Date().toISOString();
            state.planVersions[versionId] = {
              id: versionId,
              plan_id: planId,
              version: 'v1',
              content,
              schemaVersion: 1,
              createdAt,
            };

            // Persist updated state
            await writeState(state);

            sendJson(res, 201, {
              id: versionId,
              plan_id: planId,
              version: 'v1',
              content,
              schemaVersion: 1,
              createdAt,
            });
            return;
          }

          // Handle 'new_version' operation: create a new Version under existing Plan
          if (planOperation === 'new_version') {
            const planId = body.plan_id;
            const requestedVersion = body.version ? body.version.trim() : '';

            // Validate that plan_id is provided
            if (!planId) {
              sendJson(res, 400, { error: 'plan_id is required for new_version operation' });
              return;
            }

            // Validate that the Plan exists
            if (!state.planVersions || !Object.values(state.planVersions).some((v) => v.plan_id === planId)) {
              sendJson(res, 400, { error: `plan_id not found: ${planId}` });
              return;
            }

            // Check for duplicate (plan_id, version) pair
            if (requestedVersion && state.planVersions[`${planId}-${requestedVersion}`]) {
              sendJson(res, 409, { error: `plan_id/plan_version already exists: ${planId}/${requestedVersion}` });
              return;
            }

            // Determine next version number
            const existingVersions = Object.values(state.planVersions)
              .filter((v) => v.plan_id === planId)
              .map((v) => {
                const match = v.version.match(/^v(\d+)$/);
                return match ? Number(match[1]) : 0;
              });
            const maxVersion = existingVersions.length > 0 ? Math.max(...existingVersions) : 0;
            const nextVersionNumber = maxVersion + 1;
            const nextVersion = `v${nextVersionNumber}`;
            const versionId = `${planId}-${nextVersion}`;

            // Check for collision: if this (planId, nextVersion) pair already exists
            if (state.planVersions[versionId]) {
              sendJson(res, 409, { error: `plan_id/plan_version already exists: ${planId}/${nextVersion}` });
              return;
            }

            // Create new Version under existing Plan
            const createdAt = new Date().toISOString();
            state.planVersions[versionId] = {
              id: versionId,
              plan_id: planId,
              version: nextVersion,
              content,
              schemaVersion: 1,
              createdAt,
            };

            // Persist updated state
            await writeState(state);

            sendJson(res, 201, {
              id: versionId,
              plan_id: planId,
              version: nextVersion,
              content,
              schemaVersion: 1,
              createdAt,
            });
            return;
          }

          // Unsupported operation
          sendJson(res, 400, { error: `unsupported operation: ${planOperation}` });
          return;
        });
        return;
      }

      if (pathname === '/api/state' && req.method === 'GET') {
        sendJson(res, 200, await readState());
        return;
      }

      if (pathname === '/api/content-work-item' && req.method === 'POST') {
        const raw = await readBody(req);
        let body;
        try {
          body = JSON.parse(raw || '{}');
        } catch {
          sendJson(res, 400, { error: 'Body must be valid JSON' });
          return;
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          sendJson(res, 400, { error: 'Body must be a JSON object' });
          return;
        }

        // `cwi_id` is server-generated and immutable: a client may omit it, but
        // sending one is a contract violation, not a value to ignore. Checked
        // before the unknown-field loop so it keeps its own message.
        if (Object.prototype.hasOwnProperty.call(body, 'cwi_id')) {
          sendJson(res, 400, { error: 'client-supplied cwi_id is not allowed; server generates cwi_id' });
          return;
        }

        // Reject fields the contract does not know (catches typos such as
        // "prodcut_id").
        for (const key of Object.keys(body)) {
          if (!CWI_BODY_FIELDS.has(key)) {
            sendJson(res, 400, { error: `${key} is not a recognised field` });
            return;
          }
        }

        // Read state once at the start of this handler
        const state = await readState();

        const planId = typeof body.plan_id === 'string' ? body.plan_id.trim() : '';
        const planVersion = typeof body.plan_version === 'string' ? body.plan_version.trim() : '';
        const decision = typeof body.decision === 'string' ? body.decision.trim() : '';
        const hasType = Object.prototype.hasOwnProperty.call(body, 'type');
        const hasProductId = Object.prototype.hasOwnProperty.call(body, 'product_id');

        // Validate required fields
        if (!planId) {
          sendJson(res, 400, { error: 'plan_id is required' });
          return;
        }
        if (!planVersion) {
          sendJson(res, 400, { error: 'plan_version is required' });
          return;
        }

        // Validate that the referenced Plan Version exists
        if (!state.planVersions || !Object.values(state.planVersions).some((v) => v.plan_id === planId && v.version === planVersion)) {
          sendJson(res, 404, { error: `plan_id/plan_version not found: ${planId}/${planVersion}` });
          return;
        }

        // Generate a unique CWI ID
        const cwiIds = Object.keys(state.cwis || {});
        const lastCwiNum = cwiIds.length > 0 ? Math.max(...cwiIds.map(id => parseInt(id.replace('CWI-', '')))) : 0;
        const newCwiNum = lastCwiNum + 1;
        const newCwiId = 'CWI-' + newCwiNum;
        const createdAt = new Date().toISOString();

        // Build the candidate record and validate it against the CWI contract
        // before anything is written.
        const record = {
          id: newCwiId,
          plan_id: planId,
          plan_version: planVersion,
          decision: decision || 'PENDING',
          createdAt,
        };
        if (hasType) record.type = typeof body.type === 'string' ? body.type.trim() : body.type;
        if (hasProductId) {
          record.product_id = typeof body.product_id === 'string' ? body.product_id.trim() : body.product_id;
        }

        let contractErrors;
        try {
          contractErrors = cwiContractErrors(record);
        } catch (err) {
          sendJson(res, 500, { error: `CWI contract is unavailable: ${err.message}` });
          return;
        }
        if (contractErrors.length > 0) {
          sendJson(res, 400, { error: contractErrors.join('; ') });
          return;
        }

        // Create the CWI record
        if (!state.cwis) state.cwis = {};
        state.cwis[newCwiId] = record;

        // Persist updated state
        await writeState(state);

        sendJson(res, 201, record);
        return;
      }


      if (
        (pathname === '/api/content-work-item' || pathname.startsWith('/api/content-work-item/')) &&
        req.method === 'GET'
      ) {
        // Match both /api/content-work-item and /api/content-work-item/CWI-<number>
        if (pathname !== '/api/content-work-item' && !pathname.startsWith("/api/content-work-item/")) {
          sendJson(res, 404, { error: 'Unknown API route' });
          return;
        }

        let cwiId;
        if (pathname === '/api/content-work-item') {
          sendJson(res, 400, { error: 'CWI ID is required. Use /api/content-work-item/CWI-<number>' });
          return;
        } else {
          cwiId = pathname.replace("/api/content-work-item/", "");
        }

        // Read state for CWI retrieval
        const state = await readState();

        // Validate the CWI ID format: CWI-<number>
        const match = cwiId.match(/^CWI-(\d+)$/);
        if (!match) {
          sendJson(res, 400, { error: 'Invalid CWI ID format. Expected format: CWI-<number>' });
          return;
        }

		const cwiNum = match[1];

		if (!state.cwis || !state.cwis["CWI-" + cwiNum]) {
		  sendJson(res, 404, { error: `CWI not found: ${cwiId}` });
		  return;
		}

		  sendJson(res, 200, state.cwis["CWI-" + cwiNum]);
		  return;
		}
	

		if (
		  (pathname === '/api/plan-version' || pathname.startsWith('/api/plan-version/')) &&
		  req.method === 'GET'
		) {
		  // Match /api/plan-version and /api/plan-version/PLAN-<cycle>-<plan_number>-v<version>
		  if (pathname !== '/api/plan-version' && !pathname.startsWith('/api/plan-version/')) {
			sendJson(res, 404, { error: 'Unknown API route' });
			return;
		  }

		  const state = await readState();

		  let versionId;
		  if (pathname === '/api/plan-version') {
			sendJson(res, 400, {
			  error: 'Version ID is required. Use /api/plan-version/PLAN-<cycle>-<plan_number>-v<version>',
			});
			return;
		  }

		  versionId = pathname.replace('/api/plan-version/', '');

          // Validate the version ID format: PLAN-<cycle>-<plan_number>-v<version>
          const vidMatch = versionId.match(/^PLAN-(\d+)-(\d+)-v(\d+)$/);
          if (!vidMatch) {
            sendJson(res, 400, { error: 'Invalid version ID format. Expected format: PLAN-<cycle>-<plan_number>-v<version>' });
            return;
          }

          const [, cycle, planNumber, version] = vidMatch;
          const idToFind = `PLAN-${vidMatch[1]}-${vidMatch[2]}-v${vidMatch[3]}`;

          // Look up the version in state.planVersions
          const versionRecord = Object.values(state.planVersions || {}).find(
            (v) => v.id === idToFind
          );

          if (!versionRecord) {
            sendJson(res, 404, { error: `plan_version not found: ${versionId}` });
            return;
          }

          sendJson(res, 200, versionRecord);
          return;
        }
        
      if (pathname === '/api/decision' && req.method === 'POST') {
        const raw = await readBody(req);
        let body;
        try {
          body = JSON.parse(raw || '{}');
        } catch {
          sendJson(res, 400, { error: 'Body must be valid JSON' });
          return;
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          sendJson(res, 400, { error: 'Body must be a JSON object' });
          return;
        }

        const mock = await readMock();
        const { errors, id, decision, reason } = validateDecision(body, mock.opportunities || []);
        if (errors.length > 0) {
          sendJson(res, 400, { error: 'Invalid decision', details: errors });
          return;
        }

        const result = await withStateLock(async () => {
          const state = await readState();
          const entry = {
            id: `DEC-APP-${state.decisions.length + 1}`,
            at: new Date().toISOString(),
            opportunityId: id,
            decision,
            reason,
            actor: 'owner',
            kind: 'OPPORTUNITY_DECISION',
            gate: 'NONE',
            mock: true,
            note: 'Recorded by the app. This is not a gate approval; G1 stays plan-level and G2 remains unapproved.',
          };
          state.decisions.push(entry);
          // The current selection is the most recent decision, not a sticky flag.
          state.selectedOpportunityId = decision === 'SELECT' ? id : null;
          state.lastDecisionAt = entry.at;
          await writeState(state);
          return { recorded: entry, state };
        });
        sendJson(res, 201, result);
        return;
      }

      if (['/api/opportunities', '/api/state', '/api/decision', '/api/health'].includes(pathname)) {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      sendJson(res, 404, { error: 'Unknown API route' });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(res, 405, 'Method not allowed');
      return;
    }

    if (req.method === 'HEAD') {
      await serveStatic(req, res, pathname, true);
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    if (status >= 500) console.error('[ace] request failed:', err);
    if (!res.headersSent) sendJson(res, status, { error: status === 413 ? 'Request too large' : 'Internal error' });
    else res.end();
  }
});

ensureState()
  .then(readMock)
  .then(() => {
    server.listen(PORT, HOST, () => {
      const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
      console.log(`[ace] Mission 1 slice running at http://${shown}:${PORT}`);
      console.log(`[ace] state file: ${path.relative(process.cwd(), STATE_FILE)}`);
    });
  })
  .catch((err) => {
    console.error('[ace] failed to initialise:', err);
    process.exitCode = 1;
  });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
