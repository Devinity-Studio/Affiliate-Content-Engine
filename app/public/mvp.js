'use strict';

/**
 * ACE — MVP affiliate workflow slice client.
 *
 * Talks only to /api/mvp/*, which owns fixture state. It never posts to the
 * Plan Version or CWI endpoints, so a demo cannot change data/app/state.json.
 */

const SECTIONS = [
  { key: 'import', label: 'Import', hint: 'Shopee Affiliate export' },
  { key: 'research', label: 'Research', hint: 'Source / Product / Offer / Evidence' },
  { key: 'candidates', label: 'Candidates', hint: '5 ranked + workspace + queue' },
  { key: 'plan', label: 'Plan', hint: '4 approaches + impact preview' },
  { key: 'content', label: 'Content', hint: 'Storyboard → export' },
  { key: 'library', label: 'Library', hint: 'Content Library' },
];

const LIBRARY_INTEGRITY = {
  VERIFIED: { label: 'VERIFIED', kind: 'badge-fact' },
  MISMATCH: { label: 'MISMATCH', kind: 'badge-reject' },
  MISSING: { label: 'MISSING', kind: 'badge-defer' },
  UNREADABLE: { label: 'UNREADABLE', kind: 'badge-neutral' },
};

const CONTENT_STATUSES = ['DRAFT', 'REVIEW', 'FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH'];
const CONTENT_TABS = [
  { key: 'storyboard', label: 'Storyboard / Script / CTA' },
  { key: 'preview', label: 'Preview' },
  { key: 'qa', label: 'Thai QA' },
  { key: 'finalize', label: 'Finalize' },
  { key: 'export', label: 'Export' },
  { key: 'publish', label: 'Publish prep' },
];
const SCENE_TABS = [
  { key: 'visual', label: 'ภาพ / Scene' },
  { key: 'text', label: 'ตัวหนังสือ' },
  { key: 'audio', label: 'เสียง / Script' },
];
const CONTENT_APPROACHES = [
  { key: 'problem_first', label: 'แนวทาง 1 · เริ่มจากปัญหา' },
  { key: 'value_compare', label: 'แนวทาง 2 · เทียบราคา' },
  { key: 'evidence_first', label: 'แนวทาง 3 · เน้นหลักฐาน' },
  { key: 'user_custom', label: 'แนวทาง 4 · กำหนดเอง' },
];
const VISUAL_PRESET_KEYS = ['dark', 'warm', 'cool', 'light'];

const CLAIM_ORDER = ['FACT', 'INFERENCE', 'HYPOTHESIS', 'UNKNOWN'];
const APPROACH_LABEL = {
  personalized_a: 'Personalized A',
  personalized_b: 'Personalized B',
  exploration: 'Exploration',
  user_custom: 'User Custom',
};

const ui = {
  meta: null,
  state: null,
  section: 'import',
  busy: false,
  error: null,
  draft: null,
  createdPlan: null,
  selectedCandidateId: null,
  approach: 'personalized_a',
  custom: { angle: '', audience: '', hook: '', format: '', rationale: '' },
  confirmImpact: false,
  toastTimer: null,
  preview: null,
  filePayload: null,
  mappingDraft: {},
  account: '',
  dateRange: { from: '', to: '' },
  mappingConfirmed: false,
  lastStaged: null,
  staging: [],
  sourceFilter: null,
  expiredWarning: null,
  expiredContext: null,
  contentId: null,
  contentTab: 'storyboard',
  sceneTab: 'visual',
  sceneId: null,
  contentApproach: 'problem_first',
  contentCustom: { angle: '', audience: '', hook: '', format: '', cta: '' },
  contentSource: null,
  contentNew: false,
  contentQa: null,
  contentExport: null,
  contentPrep: null,
  library: { items: null, counts: null, meta: null, loading: false, error: null },
};

const els = {
  nav: document.getElementById('mvp-nav'),
  progress: document.getElementById('mvp-progress'),
  eyebrow: document.getElementById('mvp-eyebrow'),
  title: document.getElementById('mvp-title'),
  body: document.getElementById('mvp-body'),
  save: document.getElementById('mvp-save'),
  toast: document.getElementById('mvp-toast'),
  dataChip: document.getElementById('mvp-data-chip'),
};

/* ---------- DOM helpers ---------- */

function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'for') node.htmlFor = value;
    else if (key === 'on') {
      for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    } else if (key.startsWith('aria-') || key.startsWith('data-') || key === 'role') {
      node.setAttribute(key, value === true ? 'true' : String(value));
    } else if (key in node) {
      node[key] = value;
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Element.append(null) inserts the string "null" as a text node, so every
// optional child goes through here instead of being appended directly.
function mount(parent, child) {
  if (child === null || child === undefined || child === false) return null;
  parent.append(child);
  return child;
}

function badge(text, kind) {
  return h('span', { class: `badge ${kind || 'badge-neutral'}`, text });
}

function claimBadge(claimClass) {
  return badge(claimClass, `badge-${String(claimClass).toLowerCase()}`);
}

function statusBadge(status) {
  const map = {
    NONE: ['Not actioned', 'badge-neutral'],
    SAVED: ['Saved', 'badge-select'],
    REJECTED: ['Rejected', 'badge-reject'],
    QUEUED: ['Queued', 'badge-defer'],
  };
  const [text, kind] = map[status] || [status, 'badge-neutral'];
  return badge(text, kind);
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

function fmtDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : dateFmt.format(date);
}

function thb(value) {
  return `THB ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toast(message, isError) {
  els.toast.textContent = message;
  els.toast.className = `toast is-visible${isError ? ' is-error' : ''}`;
  window.clearTimeout(ui.toastTimer);
  ui.toastTimer = window.setTimeout(() => { els.toast.className = 'toast'; }, 4200);
}

/* ---------- API ---------- */

async function api(pathname, method = 'GET', body) {
  const response = await fetch(pathname, {
    method,
    headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { error: text || response.statusText }; }
  if (!response.ok) {
    const err = new Error(payload.error || `${response.status} ${response.statusText}`);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

function applyState(state) {
  ui.state = state;
  const drafts = (state.planDrafts || []).filter((d) => d.status === 'DRAFT');
  if (ui.draft) {
    const current = (state.planDrafts || []).find((d) => d.id === ui.draft.id && d.status === 'DRAFT');
    ui.draft = current || null;
  }
  if (!ui.draft) ui.draft = drafts.length ? drafts[drafts.length - 1] : null;
  if (!ui.createdPlan && (state.plans || []).length) ui.createdPlan = state.plans[state.plans.length - 1];
  const contents = state.contents || [];
  if (ui.contentId && !contents.some((c) => c.content_id === ui.contentId)) ui.contentId = null;
  if (!ui.contentId && contents.length) ui.contentId = contents[contents.length - 1].content_id;
  const open = contents.find((c) => c.content_id === ui.contentId);
  if (open && !open.storyboard.scenes.some((s) => s.id === ui.sceneId)) {
    ui.sceneId = open.storyboard.scenes.length ? open.storyboard.scenes[0].id : null;
  }
  if (open && CONTENT_APPROACHES.some((a) => a.key === open.approach)) {
    ui.contentApproach = open.approach;
  }
}

async function run(fn, successMessage) {
  if (ui.busy) return;
  ui.busy = true;
  ui.error = null;
  render();
  try {
    await fn();
    if (successMessage) toast(successMessage);
  } catch (err) {
    const details = err.payload && (err.payload.details || err.payload.impact_preview);
    ui.error = { message: err.message, details };
    ui.expiredWarning = details && details.expired_sources ? details : null;
    toast(err.message, true);
  } finally {
    ui.busy = false;
    render();
  }
}

/* ---------- Navigation ---------- */

function sectionStatus(key) {
  const state = ui.state;
  if (!state) return 'loading';
  if (key === 'import') return state.import ? state.import.id : 'not imported';
  if (key === 'research') return state.summary.offers ? `${state.summary.offers} offers` : 'awaiting import';
  if (key === 'candidates') return state.summary.candidates ? `${state.summary.candidates} candidates` : 'not generated';
  if (key === 'plan') return state.summary.plans ? `${state.summary.plans} plan(s)` : ui.draft ? 'draft open' : 'no plan';
  if (key === 'library') {
    if (ui.library.error) return 'unavailable';
    if (ui.library.items === null) return 'not loaded';
    return ui.library.items.length ? `${ui.library.items.length} export(s)` : 'empty';
  }
  if (key === 'content') {
    const open = (state.contents || []).find((c) => c.content_id === ui.contentId);
    if (open) return `${open.content_id} · ${open.status}`;
    return (state.contents || []).length ? `${state.contents.length} project(s)` : 'not created';
  }
  return '';
}

function nextSection() {
  const state = ui.state;
  if (!state || !state.import) return 'import';
  if (!state.summary.candidates) return 'research';
  if (!state.summary.plans && !ui.draft) return 'candidates';
  if (!(state.contents || []).length) return 'plan';
  return 'content';
}

function go(section) {
  ui.section = section;
  ui.error = null;
  render();
  if (section === 'library' && ui.library.items === null && !ui.library.loading) loadLibrary();
}

function renderNav() {
  clear(els.nav);
  for (const [index, section] of SECTIONS.entries()) {
    const active = ui.section === section.key;
    els.nav.append(h('li', { class: `pipeline-step${active ? ' is-active' : ''}` },
      h('button', {
        type: 'button',
        class: 'pipeline-btn',
        'aria-current': active ? 'step' : null,
        on: { click: () => go(section.key) },
      },
      h('span', { class: 'pipeline-num', text: String(index + 1) }),
      h('span', { class: 'pipeline-text' },
        h('span', { class: 'pipeline-label', text: section.label }),
        h('span', { class: 'pipeline-hint', text: sectionStatus(section.key) }),
      )),
    ));
  }
  const done = ['import', 'research', 'candidates', 'plan', 'content'].filter((key) => {
    if (key === 'import') return Boolean(ui.state && ui.state.import);
    if (key === 'research') return Boolean(ui.state && ui.state.import);
    if (key === 'candidates') return Boolean(ui.state && ui.state.summary.candidates);
    if (key === 'plan') return Boolean(ui.state && (ui.state.summary.plans || ui.draft));
    return Boolean(ui.state && (ui.state.contents || []).length);
  }).length;
  els.progress.textContent = `${done} / 5`;
}

/* ---------- Import ---------- */

/* ---------- Import: upload, preview, confirm, stage ---------- */

function fieldLabel(key) {
  return key.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function isRequiredField(key) {
  const required = (ui.meta && ui.meta.import_contract && ui.meta.import_contract.required_fields) || [];
  return required.includes(key);
}

function byteSize(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function fileToBase64(file) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < buffer.length; offset += chunk) {
    binary += String.fromCharCode(...buffer.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function previewIsBlocked() {
  return Boolean(ui.preview && ui.preview.missing_required.length);
}

async function refreshStaging() {
  const res = await api('/api/mvp/staging');
  ui.staging = res.imports;
}

async function loadFilePreview(file) {
  if (!file) throw new Error('Choose a CSV, XLSX or JSON file first');
  if (file.size > 3 * 1024 * 1024) throw new Error('The file is larger than 3 MB');
  const base64 = await fileToBase64(file);
  ui.filePayload = { filename: file.name, size: file.size, base64 };
  const res = await api('/api/mvp/import/preview', 'POST', {
    filename: file.name,
    content_base64: base64,
  });
  ui.preview = res.preview;
  ui.mappingDraft = { ...res.preview.mapping };
  ui.account = ui.account || '';
  ui.dateRange = res.preview.date_range_default || { from: '', to: '' };
  ui.mappingConfirmed = false;
  ui.lastStaged = null;
  ui.expiredWarning = null;
}

async function rePreviewWithMapping() {
  if (!ui.filePayload) throw new Error('Choose a file first');
  const res = await api('/api/mvp/import/preview', 'POST', {
    filename: ui.filePayload.filename,
    content_base64: ui.filePayload.base64,
    mapping: ui.mappingDraft,
  });
  ui.preview = res.preview;
  ui.mappingDraft = { ...res.preview.mapping };
  ui.mappingConfirmed = false;
  ui.error = null;
  return res;
}

async function commitStagedImport() {
  if (!ui.filePayload || !ui.preview) throw new Error('Preview a file first');
  // The values are read from ui, not from the DOM: run() re-renders the panel
  // before this runs, which would otherwise wipe whatever the user typed.
  const account = (ui.account || '').trim();
  const from = ui.dateRange.from || '';
  const to = ui.dateRange.to || '';
  if (!account) throw new Error('Account label is required');
  if (!from || !to) throw new Error('Date range is required');
  if (!ui.mappingConfirmed) throw new Error('Confirm the column mapping before importing');
  const res = await api('/api/mvp/import/commit', 'POST', {
    filename: ui.filePayload.filename,
    content_base64: ui.filePayload.base64,
    mapping: ui.mappingDraft,
    account: { label: account },
    date_range: { from, to },
    confirmMapping: true,
  });
  ui.lastStaged = res;
  ui.expiredWarning = null;
  await refreshStaging();
  return res;
}

async function promoteStaged(id, acknowledgeExpired = false) {
  ui.expiredContext = 'promote';
  const res = await api(`/api/mvp/staging/${encodeURIComponent(id)}/research`, 'POST', {
    generateCandidates: true,
    acknowledgeExpired,
  });
  ui.lastStaged = null;
  ui.sourceFilter = null;
  await refreshStaging();
  applyState(res.state);
  ui.selectedCandidateId = res.candidates && res.candidates[0] ? res.candidates[0].id : null;
  ui.section = 'candidates';
  return res;
}

async function generateFromResearch(acknowledgeExpired = false) {
  ui.expiredContext = 'generate';
  const res = await api('/api/mvp/candidates/generate', 'POST', { acknowledgeExpired });
  applyState(res.state);
  ui.section = 'candidates';
  ui.selectedCandidateId = res.candidates[0] ? res.candidates[0].id : null;
}

async function retryExpired() {
  const context = ui.expiredContext;
  ui.expiredWarning = null;
  if (context === 'promote' && ui.staging && ui.staging.length) {
    const staged = ui.staging.find((imp) => !imp.promoted);
    if (staged) { await promoteStaged(staged.id, true); return; }
  }
  const res = await api('/api/mvp/candidates/generate', 'POST', { acknowledgeExpired: true });
  applyState(res.state);
  ui.selectedCandidateId = res.candidates && res.candidates[0] ? res.candidates[0].id : null;
}

function countChips(counts) {
  return h('div', { class: 'counts' },
    [['Total', counts.total], ['Valid', counts.valid], ['Duplicate', counts.duplicate], ['Invalid', counts.invalid], ['Unknown', counts.unknown]]
      .map(([label, value]) => h('div', { class: 'count' },
        h('span', { class: 'count-val', text: String(value) }),
        h('span', { class: 'count-label', text: label }),
      )),
  );
}

function issueList(title, items, render) {
  if (!items || !items.length) return null;
  return h('details', { class: 'issue-block' },
    h('summary', { text: `${title} (${items.length})` }),
    h('ul', { class: 'plain-list tight' }, items.map((item) => h('li', { text: render(item) }))),
  );
}

function renderMappingTable(preview) {
  const keys = Object.keys(preview.mapping);
  const columns = preview.columns || [];
  return h('div', { class: 'table-scroll' },
    h('table', { class: 'mvp-table mapping-table' },
      h('thead', null, h('tr', null,
        h('th', { scope: 'col', text: 'Canonical field' }),
        h('th', { scope: 'col', text: 'Required' }),
        h('th', { scope: 'col', text: 'Export column' }),
      )),
      h('tbody', null, keys.map((key) => h('tr', null,
        h('td', null,
          h('p', { class: 'cell-title', text: fieldLabel(key) }),
          h('p', { class: 'cell-sub mono', text: key }),
        ),
        h('td', null, isRequiredField(key)
          ? badge('Required', 'badge-reject')
          : badge('Optional', 'badge-neutral')),
        h('td', null, h('select', {
          'aria-label': `${fieldLabel(key)} column`,
          on: {
            change: (event) => {
              ui.mappingDraft[key] = event.target.value === '' ? null : Number(event.target.value);
            },
          },
        },
        h('option', { value: '', text: '— not mapped —', selected: ui.mappingDraft[key] === null }),
        columns.map((column) => h('option', {
          value: String(column.index),
          text: `${column.header || `(column ${column.index + 1})`}`,
          selected: ui.mappingDraft[key] === column.index,
        })))),
      ))),
    ),
  );
}

function renderImportPreviewCard() {
  const preview = ui.preview;
  const blocked = previewIsBlocked();
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Step 1b · Preview (nothing written)' }),
        h('h2', { text: `${preview.file.name} · ${preview.format.toUpperCase()}` }),
      ),
      h('div', { class: 'head-meta' },
        preview.synthetic ? badge('SYNTHETIC', 'badge-mock') : badge('USER FILE', 'badge-defer'),
        badge(preview.encoding, 'badge-neutral'),
      ),
    ),
    h('dl', { class: 'kv' },
      h('div', null, h('dt', { text: 'File hash' }), h('dd', { class: 'mono small', text: preview.hash })),
      h('div', null, h('dt', { text: 'Size' }), h('dd', { text: byteSize(preview.file.size_bytes) })),
      h('div', null, h('dt', { text: 'Sheet' }), h('dd', { text: preview.sheet || '—' })),
      h('div', null, h('dt', { text: 'Staging' }), h('dd', { class: 'mono small', text: 'temporary state only — Research is unchanged until promote' })),
    ),
    countChips(preview.counts),
    preview.warnings.length ? h('ul', { class: 'limits' }, preview.warnings.map((text) => h('li', { text }))) : null,
    h('h3', { class: 'sub-head', text: 'Confirm the column mapping' }),
    h('p', { class: 'muted', text: 'The alias catalogue is provisional until a real export is supplied. Check every required field, then re-run the preview before importing.' }),
    renderMappingTable(preview),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn', disabled: ui.busy,
        on: { click: () => run(() => rePreviewWithMapping(), 'Preview recomputed with the chosen mapping') },
      }, 'Re-check mapping'),
    ),
    blocked
      ? h('p', { class: 'warn', text: `Required fields are still unmapped: ${preview.missing_required.join(', ')}. Import is blocked until they are mapped.` })
      : null,
    h('h3', { class: 'sub-head', text: 'Confirm the account and data period' }),
    h('div', { class: 'field-grid' },
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'Affiliate account label' }),
        h('input', {
          id: 'import-account', type: 'text', value: ui.account || '', placeholder: 'e.g. ACE test account',
          on: { input: (event) => { ui.account = event.target.value; } },
        }),
      ),
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'Data from' }),
        h('input', {
          id: 'import-from', type: 'date', value: ui.dateRange.from || '',
          on: { input: (event) => { ui.dateRange.from = event.target.value; } },
        }),
      ),
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'Data to' }),
        h('input', {
          id: 'import-to', type: 'date', value: ui.dateRange.to || '',
          on: { input: (event) => { ui.dateRange.to = event.target.value; } },
        }),
      ),
    ),
    h('label', { class: 'check-row' },
      h('input', {
        id: 'import-confirm', type: 'checkbox', checked: ui.mappingConfirmed,
        on: { change: (event) => { ui.mappingConfirmed = event.target.checked; } },
      }),
      h('span', { text: 'I checked the mapping, account and date range, and understand the rows are staged first.' }),
    ),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy || blocked,
        on: { click: () => run(() => commitStagedImport(), 'Import staged — Research is still unchanged') },
      }, 'Import to staging'),
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
        on: { click: () => { ui.preview = null; ui.filePayload = null; ui.error = null; render(); } },
      }, 'Discard preview'),
    ),
    issueList('Invalid rows', preview.counts.invalid ? preview.rows.filter((row) => row.status === 'INVALID') : [], (row) => `row ${row.row_number}: ${row.reasons.join('; ')}`),
    issueList('Unknown rows (not importable)', preview.counts.unknown ? preview.rows.filter((row) => row.status === 'UNKNOWN') : [], (row) => `row ${row.row_number}: ${row.reasons.join('; ')}`),
    issueList('Duplicate rows', preview.counts.duplicate ? preview.rows.filter((row) => row.status === 'DUPLICATE') : [], (row) => `row ${row.row_number}: ${row.reasons.join('; ')}`),
    h('details', { class: 'issue-block' },
      h('summary', { text: 'Sample of parsed rows' }),
      h('div', { class: 'table-scroll' },
        h('table', { class: 'mvp-table' },
          h('thead', null, h('tr', null, ['Row', 'Status', 'Item', 'Product', 'Price', 'Commission'].map((label) => h('th', { scope: 'col', text: label })))),
          h('tbody', null, preview.sample.map((row) => h('tr', null,
            h('td', { class: 'mono', text: String(row.row_number) }),
            h('td', null, badge(row.status, row.status === 'VALID' ? 'badge-select' : row.status === 'INVALID' ? 'badge-reject' : 'badge-defer')),
            h('td', { class: 'mono', text: row.item_id || '—' }),
            h('td', { text: row.product_name || '—' }),
            h('td', { text: row.price_thb === null ? '—' : thb(row.price_thb) }),
            h('td', { text: row.commission_rate === null ? '—' : `${Math.round(row.commission_rate * 10000) / 100}%` }),
          ))),
        ),
      ),
    ),
  );
}

function renderStagedCard() {
  const staged = ui.lastStaged;
  if (!staged || !staged.import) return null;
  const imp = staged.import;
  return h('section', { class: 'mvp-card staged-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Step 1c · Staged import' }),
        h('h2', { text: `${imp.id} · ${imp.file}` }),
      ),
      h('div', { class: 'head-meta' },
        imp.synthetic ? badge('SYNTHETIC', 'badge-mock') : badge('USER FILE', 'badge-defer'),
        badge('staging only', 'badge-neutral'),
      ),
    ),
    h('p', { class: 'lead' }, 'Nothing in Research has changed yet. Promote this staged import to build Source / Product / Offer / Evidence records and the five candidates.'),
    countChips(staged.counts),
    h('dl', { class: 'kv' },
      h('div', null, h('dt', { text: 'File hash' }), h('dd', { class: 'mono small', text: imp.file_hash })),
      h('div', null, h('dt', { text: 'Account' }), h('dd', { text: imp.account.label })),
      h('div', null, h('dt', { text: 'Data period' }), h('dd', { text: `${imp.date_range.from} → ${imp.date_range.to}` })),
      h('div', null, h('dt', { text: 'Source validation' }), h('dd', null, badge(imp.source_validation.status, imp.source_validation.status === 'PASSED' ? 'badge-select' : 'badge-reject'))),
    ),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy || imp.source_validation.status !== 'PASSED',
        on: { click: () => run(() => promoteStaged(imp.id), 'Staged import promoted to Research and candidates generated') },
      }, 'Send to Research and generate 5 candidates'),
      h('button', { type: 'button', class: 'btn btn-ghost', disabled: ui.busy, on: { click: () => go('research') } }, 'Open Research (current source) →'),
    ),
    h('ul', { class: 'limits' }, (imp.warnings || []).map((text) => h('li', { text }))),
  );
}

function renderStagingList() {
  const list = ui.staging || [];
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null, h('p', { class: 'eyebrow', text: 'Staging store' }), h('h2', { text: `${list.length} staged import${list.length === 1 ? '' : 's'}` })),
      badge('separate from Research state', 'badge-neutral'),
    ),
    list.length === 0
      ? h('p', { class: 'muted', text: 'No staged imports yet. Preview a file above; preview does not write state.' })
      : h('div', { class: 'table-scroll' },
        h('table', { class: 'mvp-table' },
          h('thead', null, h('tr', null, ['Import', 'File', 'Rows', 'Valid', 'Duplicate', 'Invalid', 'Unknown', 'Status'].map((label) => h('th', { scope: 'col', text: label })))),
          h('tbody', null, list.map((imp) => h('tr', null,
            h('td', { class: 'mono', text: imp.id }),
            h('td', null, h('p', { class: 'cell-title', text: imp.file }), h('p', { class: 'cell-sub mono', text: imp.file_hash.slice(0, 16) })),
            h('td', { text: String(imp.counts.total) }),
            h('td', { text: String(imp.counts.valid) }),
            h('td', { text: String(imp.counts.duplicate) }),
            h('td', { text: String(imp.counts.invalid) }),
            h('td', { text: String(imp.counts.unknown) }),
            h('td', null,
              badge(imp.promoted ? 'PROMOTED' : 'STAGED', imp.promoted ? 'badge-select' : 'badge-defer'),
              !imp.promoted ? h('button', {
                type: 'button', class: 'link-btn', disabled: ui.busy,
                on: { click: () => run(() => promoteStaged(imp.id), 'Staged import promoted to Research') },
              }, 'Use →') : null,
            ),
          ))),
        ),
      ),
  );
}

function renderImport() {
  const meta = ui.meta;
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });
  const realPending = meta && meta.real_export && meta.real_export.status === 'PENDING';

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Step 1 · Input' }),
        h('h2', { text: 'Import a Shopee Affiliate export' }),
      ),
      h('div', { class: 'head-meta' },
        realPending ? badge('REAL EXPORT PENDING', 'badge-mock') : badge('REAL EXPORT AVAILABLE', 'badge-select'),
        badge('staging first', 'badge-neutral'),
      ),
    ),
    h('p', { class: 'lead' },
      'Upload the file you exported from Shopee Affiliate (CSV, XLSX or JSON). The app parses it locally, shows a preview with a proposed column mapping, and writes nothing until you confirm the mapping, account and data period.'),
    realPending ? h('p', { class: 'warn' },
      'No real Shopee export has been supplied yet, so every test so far uses SYNTHETIC fixtures. Real-file behaviour is unverified until you import one.') : null,
    h('div', { class: 'upload-row' },
      h('input', {
        id: 'import-file',
        type: 'file',
        accept: '.csv,.tsv,.xlsx,.json',
        disabled: ui.busy,
        on: {
          change: (event) => {
            const file = event.target.files && event.target.files[0];
            if (file) run(() => loadFilePreview(file), 'Preview ready — nothing was written');
          },
        },
      }),
      h('span', { class: 'muted small' }, 'Max 3 MB · 500 rows · .xls not supported'),
    ),
    h('ul', { class: 'limits' },
      h('li', { text: 'Accepted: CSV, TSV, XLSX, JSON. UTF-8, UTF-16 and windows-874 (Thai) are detected automatically.' }),
      h('li', { text: 'Preview is computed in memory: no staging file, no Research record and no candidate is created.' }),
      h('li', { text: 'Duplicates are keyed by file hash + (item_id|shop_id); duplicates are reported and never imported twice.' }),
    ),
  ));

  if (ui.preview) wrap.append(renderImportPreviewCard());
  if (ui.error) {
    wrap.append(h('section', { class: 'notice notice-error' },
      h('div', { class: 'notice-head' }, h('h2', { text: ui.error.message })),
      Array.isArray(ui.error.details) ? h('ul', null, ui.error.details.map((item) => h('li', { text: `${item.row ? `row ${item.row} · ` : ''}${item.field ? `${item.field}: ` : ''}${item.message}` }))) : null,
      ui.error.details && ui.error.details.missing_required ? h('p', { class: 'mono small', text: `missing: ${ui.error.details.missing_required.join(', ')}` }) : null,
      ui.expiredWarning ? h('div', { class: 'toolbar' },
        h('button', { type: 'button', class: 'btn', disabled: ui.busy, on: { click: () => run(retryExpired, 'Continued with expired data acknowledged') } }, 'Acknowledge expired data and continue'),
      ) : null,
    ));
  }
  if (ui.lastStaged) mount(wrap, renderStagedCard());
  wrap.append(renderStagingList());

  wrap.append(h('details', { class: 'mvp-card fixture-card' },
    h('summary', null, h('span', { text: 'Bundled SYNTHETIC fixture (no upload)' })),
    h('p', { class: 'muted' },
      'The original hand-authored fixture has no affiliate_link column, so it is only usable through the legacy fixture loader below. It keeps the 56-check workflow acceptance working.'),
    h('dl', { class: 'kv' },
      h('div', null, h('dt', { text: 'Fixture file' }), h('dd', { class: 'mono', text: meta ? meta.fixture.file : '—' })),
      h('div', null, h('dt', { text: 'Rows' }), h('dd', { text: meta ? String(meta.fixture.row_count) : '—' })),
      h('div', null, h('dt', { text: 'SHA-256' }), h('dd', { class: 'mono small', text: meta ? meta.fixture.sha256 : '—' })),
      h('div', null, h('dt', { text: 'Fixture state' }), h('dd', { class: 'mono small', text: meta ? meta.state_file : '—' })),
    ),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const res = await api('/api/mvp/import', 'POST', {});
            applyState(res.state);
            ui.section = 'research';
            ui.error = null;
          }, 'Synthetic fixture loaded into Research state'),
        },
      }, state && state.import ? 'Re-load the synthetic fixture' : 'Load the synthetic fixture'),
      h('button', { type: 'button', class: 'btn btn-ghost', disabled: ui.busy || !state || !state.import, on: { click: () => go('research') } }, 'Open research →'),
    ),
    state && state.import && state.data_mode === 'FIXTURE'
      ? h('p', { class: 'note', text: `Current Research source: ${state.import.id} · ${state.import.label}` })
      : null,
  ));

  return wrap;
}


/* ---------- Source library ---------- */

function sourceSyntheticBadge(source) {
  return source.synthetic ? badge('SYNTHETIC', 'badge-mock') : badge('USER FILE', 'badge-defer');
}

function freshnessBadge(freshness) {
  const kind = freshness.status === 'EXPIRED' ? 'badge-reject'
    : freshness.status === 'AGING' ? 'badge-defer'
      : freshness.status === 'FRESH' ? 'badge-select' : 'badge-neutral';
  return badge(freshness.status, kind);
}

function filterBySource(sourceId) {
  ui.sourceFilter = sourceId;
  go('candidates');
}

async function archiveSource(source) {
  const confirmed = window.confirm(
    `Archive ${source.id}?\n\nEvidence records stay, and existing candidates keep working. New candidate generation will be blocked while this source is archived.`,
  );
  if (!confirmed) return;
  const res = await api(`/api/mvp/sources/${encodeURIComponent(source.id)}/archive`, 'POST', {
    confirm: true,
    reason: 'Archived from the Source Library',
  });
  applyState(res.state);
}

async function validateSource(source) {
  const res = await api(`/api/mvp/sources/${encodeURIComponent(source.id)}/validate`, 'POST', {});
  applyState(res.state);
}

function renderSourceCard(source) {
  const counts = source.record_counts || { products: 0, offers: 0, evidence: 0 };
  return h('article', { class: `source-card${source.status === 'ARCHIVED' ? ' is-archived' : ''}` },
    h('div', { class: 'cand-head' },
      h('div', { class: 'cand-title-wrap' },
        h('h3', { class: 'cand-title', text: source.label }),
        h('p', { class: 'cell-sub mono', text: `${source.id} · ${source.kind} · ${source.source_type || '—'}` }),
      ),
      h('div', { class: 'head-meta' },
        sourceSyntheticBadge(source),
        badge(source.status || 'ACTIVE', source.status === 'ARCHIVED' ? 'badge-neutral' : 'badge-select'),
        source.validation ? badge(source.validation.status, source.validation.status === 'PASSED' ? 'badge-select' : 'badge-reject') : null,
      ),
    ),
    h('dl', { class: 'kv compact' },
      h('div', null, h('dt', { text: 'checked_at' }), h('dd', { text: fmtDate(source.checked_at) })),
      h('div', null, h('dt', { text: 'File hash' }), h('dd', { class: 'mono small', text: source.file_hash || '—' })),
      h('div', null, h('dt', { text: 'Records created' }), h('dd', { text: `${counts.products} products · ${counts.offers} offers · ${counts.evidence} evidence` })),
      h('div', null, h('dt', { text: 'Data as of' }), h('dd', { text: source.data_as_of || '—' })),
      h('div', null, h('dt', { text: 'Freshness' }), h('dd', null, freshnessBadge(source.freshness), h('span', { class: 'cell-sub', text: ` ${source.freshness.age_days === null ? 'age unknown' : `${source.freshness.age_days}d old`}` }))),
      source.expires_at ? h('div', null, h('dt', { text: 'Expires' }), h('dd', { text: fmtDate(source.expires_at) })) : null,
    ),
    source.freshness.warning ? h('p', { class: 'warn', text: source.freshness.warning }) : null,
    h('p', { class: 'trace mono small', text: `linked candidates: ${(source.linked_candidates || []).length ? source.linked_candidates.map((candidate) => candidate.id).join(' · ') : 'none yet'}` }),
    (source.linked_candidates || []).length
      ? h('div', { class: 'toolbar' }, source.linked_candidates.map((candidate) => h('button', {
        type: 'button', class: 'link-btn mono small',
        on: { click: () => filterBySource(source.id) },
      }, `${candidate.id} #${candidate.rank}`)))
      : null,
    h('details', { class: 'reasons' },
      h('summary', { text: 'Source details' }),
      h('dl', { class: 'kv compact' },
        h('div', null, h('dt', { text: 'source_id' }), h('dd', { class: 'mono', text: source.id })),
        h('div', null, h('dt', { text: 'Reference' }), h('dd', { class: 'mono small', text: source.reference || '—' })),
        h('div', null, h('dt', { text: 'Method' }), h('dd', { text: source.provenance ? source.provenance.method : '—' })),
        h('div', null, h('dt', { text: 'Provenance source' }), h('dd', { text: source.provenance ? source.provenance.source : '—' })),
        h('div', null, h('dt', { text: 'File' }), h('dd', { class: 'mono small', text: source.provenance ? source.provenance.file : '—' })),
        source.archive_reason ? h('div', null, h('dt', { text: 'Archive reason' }), h('dd', { text: source.archive_reason })) : null,
      ),
      h('ul', { class: 'limits' }, ((source.provenance && source.provenance.limitations) || []).map((text) => h('li', { text }))),
      source.validation ? h('ul', { class: 'plain-list tight' }, source.validation.checks.map((check) => h('li', { text: `${check.ok ? '✓' : '✗'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}` }))) : null,
    ),
    h('div', { class: 'toolbar' },
      source.linked_candidates && source.linked_candidates.length
        ? h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => filterBySource(source.id) } }, 'View linked candidates →')
        : null,
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
        on: { click: () => run(() => validateSource(source), `Source ${source.id} revalidated`) },
      }, 'Revalidate'),
      source.status !== 'ARCHIVED'
        ? h('button', {
          type: 'button', class: 'btn btn-ghost danger', disabled: ui.busy,
          on: { click: () => run(() => archiveSource(source), `Source ${source.id} archived — evidence kept`) },
        }, 'Archive source')
        : h('span', { class: 'cell-sub', text: 'Archived: evidence kept, new candidates blocked.' }),
    ),
  );
}

function renderSourceLibrary() {
  const state = ui.state;
  const sources = (state && state.sources) || [];
  const warnings = (state && state.freshness_warnings) || [];
  return h('section', { class: 'mvp-card source-library' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Source library' }),
        h('h2', { text: `${sources.length} imported source${sources.length === 1 ? '' : 's'}` }),
      ),
      h('div', { class: 'head-meta' },
        state && state.synthetic ? badge('SYNTHETIC DATA', 'badge-mock') : badge('USER-SUPPLIED DATA — UNVERIFIED', 'badge-defer'),
        badge(`${sources.filter((source) => source.status === 'ARCHIVED').length} archived`, 'badge-neutral'),
      ),
    ),
    h('p', { class: 'lead' },
      'Every source link below is the same source_id used by candidates and the research report. Archiving keeps evidence and existing candidates; it only blocks new generation.'),
    warnings.length
      ? h('div', { class: 'notice notice-warn' },
        h('div', { class: 'notice-head' }, h('h2', { text: `${warnings.length} freshness warning${warnings.length === 1 ? '' : 's'}` })),
        h('ul', { class: 'plain-list tight' }, warnings.map((warning) => h('li', { text: `${warning.source_id} · ${warning.status} · ${warning.warning}` }))),
      )
      : null,
    h('div', { class: 'source-grid' }, sources.map(renderSourceCard)),
  );
}

function renderResearchReport() {
  const state = ui.state;
  if (!state) return null;
  const sources = state.sources || [];
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null, h('p', { class: 'eyebrow', text: 'Research report' }), h('h2', { text: 'Source → Candidate trace' })),
      badge('GET /api/mvp/research-report', 'badge-neutral'),
    ),
    h('p', { class: 'muted' },
      'Trace from each source_id to the candidates and evidence built from it. Nothing is inferred across imports.'),
    h('div', { class: 'table-scroll' },
      h('table', { class: 'mvp-table' },
        h('thead', null, h('tr', null,
          ['Source', 'Synthetic', 'Records', 'Evidence', 'Candidates'].map((label) => h('th', { scope: 'col', text: label })),
        )),
        h('tbody', null, sources.map((source) => {
          const evidence = state.evidence.filter((record) => (record.source_ids || []).includes(source.id));
          return h('tr', null,
            h('td', null,
              h('p', { class: 'cell-title mono small', text: source.id }),
              h('p', { class: 'cell-sub', text: source.kind }),
            ),
            h('td', null, source.synthetic ? badge('SYNTHETIC', 'badge-mock') : badge('USER', 'badge-defer')),
            h('td', { text: `${source.record_counts.products} / ${source.record_counts.offers}` }),
            h('td', { class: 'mono', text: String(evidence.length) }),
            h('td', null, (source.linked_candidates || []).length
              ? h('div', { class: 'toolbar' }, source.linked_candidates.map((candidate) => h('button', {
                type: 'button', class: 'link-btn mono small',
                on: { click: () => filterBySource(source.id) },
              }, `${candidate.id} #${candidate.rank}`)))
              : h('span', { class: 'muted small', text: 'none yet' })),
          );
        })),
      ),
    ),
  );
}

function renderExpiredNotice() {
  if (!ui.expiredWarning) return null;
  const expired = ui.expiredWarning.expired_sources || [];
  return h('section', { class: 'notice notice-warn' },
    h('div', { class: 'notice-head' }, h('h2', { text: 'Expired source data — acknowledgement required' })),
    h('ul', { class: 'plain-list tight' }, expired.map((entry) => h('li', { text: `${entry.id}: ${entry.freshness.warning}` }))),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn', disabled: ui.busy,
        on: { click: () => run(retryExpired, 'Continued with expired data acknowledged') },
      }, 'Acknowledge and continue'),
    ),
  );
}


/* ---------- Research ---------- */

function offerRows() {
  const state = ui.state;
  if (!state) return [];
  const productById = Object.fromEntries(state.products.map((p) => [p.id, p]));
  return state.offers.map((offer) => ({ offer, product: productById[offer.product_id] }));
}

function renderResearch() {
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });

  if (!state || !state.import) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'Nothing imported yet' })),
      h('p', null, 'Import an export first. ', h('button', { type: 'button', class: 'link-btn', on: { click: () => go('import') } }, 'Go to import →')),
    ));
    return wrap;
  }

  mount(wrap, renderSourceLibrary());
  mount(wrap, renderExpiredNotice());

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Step 2 · Research' }),
        h('h2', { text: 'Price, promotion, commission, reviews and shops' }),
      ),
      state.synthetic ? badge('from synthetic rows', 'badge-mock') : badge('from user export — unverified', 'badge-defer'),
    ),
    h('p', { class: 'lead' },
      'Every number below is read from the current import or computed from it. Derived comparisons are INFERENCE; conversion, click-through and live validity stay UNKNOWN.'),
    h('div', { class: 'table-scroll' },
      h('table', { class: 'mvp-table' },
        h('thead', null, h('tr', null,
          ['Product', 'Price', 'Category median', 'Δ vs median', 'Promotion', 'Commission', 'Reviews', 'Shop', 'Related shops', 'Crowding']
            .map((label) => h('th', { scope: 'col', text: label })),
        )),
        h('tbody', null, offerRows().map(({ offer, product }) => h('tr', null,
          h('td', null,
            h('p', { class: 'cell-title', text: product ? product.name : offer.item_id }),
            h('p', { class: 'cell-sub mono', text: `${offer.id} · ${offer.shop_name}` }),
          ),
          h('td', { text: thb(offer.price_thb) }),
          h('td', { text: thb(offer.metrics.category_median_price_thb) }),
          h('td', null, h('span', { class: `delta ${offer.metrics.price_position_pct <= 0 ? 'is-low' : 'is-high'}`, text: `${offer.metrics.price_position_pct > 0 ? '+' : ''}${offer.metrics.price_position_pct}%` })),
          h('td', null,
            h('span', { class: 'tag', text: offer.promo.type }),
            h('span', { class: 'cell-sub', text: `${offer.promo.label} · ${offer.promo.depth_pct}%` }),
          ),
          h('td', null,
            h('span', { class: 'mono', text: `${Math.round(offer.commission_rate * 10000) / 100}%` }),
            h('span', { class: 'cell-sub', text: `${thb(offer.commission_per_order_thb)}/order` }),
          ),
          h('td', null,
            h('span', { class: 'mono', text: `${offer.reviews.rating}/5` }),
            h('span', { class: 'cell-sub', text: `${offer.reviews.rating_count} ratings · ${offer.reviews.units_sold} sold` }),
          ),
          h('td', null,
            h('span', { class: 'mono', text: `${offer.shop.rating}/5` }),
            h('span', { class: 'cell-sub', text: offer.shop_name }),
          ),
          h('td', { class: 'mono', text: String(offer.shop.related_shop_count) }),
          h('td', null, h('span', { class: 'tag', text: offer.metrics.competition_level.replace('_FIXTURE_CROWDING', '') })),
        ))),
      ),
    ),
    h('p', { class: 'note' },
      'Δ vs median is the offer price compared with the median of the same fixture category. It is not a market price survey.'),
  ));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' }, h('div', null, h('p', { class: 'eyebrow', text: 'Analysis method' }), h('h2', { text: 'What the slice knows and does not know' }))),
    h('div', { class: 'two-col' },
      h('div', null,
        h('h3', { text: 'Known from the fixture' }),
        h('ul', { class: 'plain-list' },
          h('li', { text: `Price and list price · ${state.summary.offers} offers` }),
          h('li', { text: 'Promotion type, label and stated depth' }),
          h('li', { text: 'Commission rate and per-order value at the listed price' }),
          h('li', { text: 'Rating, rating count, units sold, shop rating and related-shop count' }),
        ),
      ),
      h('div', null,
        h('h3', { text: 'Explicitly unknown' }),
        h('ul', { class: 'plain-list' }, (state.analysis.dataset_unknowns || []).map((text) => h('li', { text }))),
      ),
    ),
  ));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null, h('p', { class: 'eyebrow', text: 'Evidence register' }), h('h2', { text: `${state.summary.evidence} evidence records` })),
      badge('FACT / INFERENCE / UNKNOWN', 'badge-neutral'),
    ),
    h('p', { class: 'muted' }, 'Each record carries checked_at, source_ids and its own limitations. Open an offer to inspect the claims.'),
    h('div', { class: 'evidence-list' },
      offerRows().map(({ offer, product }, index) => {
        const items = state.evidence.filter((item) => item.subject.id === offer.id);
        return h('details', { class: 'evidence-group', open: index === 0 },
          h('summary', null,
            h('span', { class: 'evidence-summary-title', text: product ? product.name : offer.item_id }),
            h('span', { class: 'evidence-summary-meta' },
              items.map((item) => claimBadge(item.claim_class)),
              h('span', { class: 'muted small', text: `${items.length} records · checked ${fmtDate(offer.checked_at)}` }),
            ),
          ),
          h('ul', { class: 'claim-list' },
            items.map((item) => h('li', { class: 'claim' },
              claimBadge(item.claim_class),
              h('div', null,
                h('p', { class: 'claim-text', text: item.statement }),
                h('p', { class: 'claim-meta mono' }, `${item.id} · ${item.value === null ? 'value: null' : `${item.value}${item.unit ? ` ${item.unit}` : ''}`}`),
                h('p', { class: 'claim-meta' }, item.limitations.join(' ')),
              ),
            )),
          ),
        );
      }),
    ),
  ));

  mount(wrap, renderResearchReport());

  wrap.append(h('div', { class: 'toolbar sticky-actions' },
    h('button', {
      type: 'button',
      class: 'btn btn-primary',
      disabled: ui.busy,
      on: {
        click: () => run(() => generateFromResearch(false), 'Generated 5 ranked candidates from the current import'),
      },
    }, state.summary.candidates ? 'Regenerate 5 candidates' : 'Generate 5 candidates'),
    h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => go('candidates') } }, 'Open candidates →'),
  ));

  return wrap;
}

/* ---------- Candidates ---------- */

function statusCounts() {
  const state = ui.state;
  return (state && state.summary.status_counts) || { NONE: 0, SAVED: 0, REJECTED: 0, QUEUED: 0 };
}

function candidateById(id) {
  return ui.state ? ui.state.candidates.find((c) => c.id === id) : null;
}

function renderCandidateCard(candidate) {
  const claimGroups = CLAIM_ORDER.map((claimClass) => ({
    claimClass,
    items: candidate.claims.filter((item) => item.claim_class === claimClass),
  }));

  const actionButton = (label, action, disabled, primary) => h('button', {
    type: 'button',
    class: `btn ${primary ? 'btn-primary' : ''}`,
    disabled: disabled || ui.busy,
    on: {
      click: () => run(async () => {
        const res = await api(`/api/mvp/candidates/${candidate.id}/action`, 'POST', { action });
        applyState(res.state);
      }, `${label} · ${candidate.id}`),
    },
  }, label);

  return h('article', { class: `cand-card${candidate.status === 'REJECTED' ? ' is-rejected' : ''}` },
    h('div', { class: 'cand-head' },
      h('div', { class: 'cand-rank', text: candidate.consistency && candidate.consistency !== 'OK' ? `#${candidate.rank} ⚠` : `#${candidate.rank}` }),
      h('div', { class: 'cand-title-wrap' },
        h('h3', { class: 'cand-title', text: candidate.title }),
        h('p', { class: 'cell-sub', text: `${candidate.id} · ${candidate.shop.name} · ${candidate.category}` }),
      ),
      candidate.consistency && candidate.consistency !== 'OK'
        ? badge(`⚠ ${candidate.consistency}`, 'badge-defer')
        : statusBadge(candidate.status),
    ),
    h('div', { class: 'score-row' },
      h('div', { class: 'score' }, h('span', { class: 'score-val', text: String(candidate.scores.ranking_score) }), h('span', { class: 'score-label', text: 'Ranking /100' })),
      h('div', { class: 'score' }, h('span', { class: 'score-val', text: String(candidate.scores.opportunity_score) }), h('span', { class: 'score-label', text: 'Opportunity /100' })),
      h('div', { class: 'score' }, h('span', { class: 'score-val', text: candidate.scores.confidence.level }), h('span', { class: 'score-label', text: 'Confidence' })),
    ),
    h('p', { class: 'note' },
      `Ranking = 0.85 × opportunity + 0.15 × data confidence (${candidate.scores.confidence.score}). Not a sales forecast.`),
    h('div', { class: 'claim-grid' },
      claimGroups.map((group) => h('div', { class: 'claim-group' },
        h('p', { class: 'claim-group-head' }, claimBadge(group.claimClass), h('span', { class: 'muted small', text: `${group.items.length}` })),
        h('ul', { class: 'claim-list tight' }, group.items.map((item) => h('li', { class: 'claim' },
          h('p', { class: 'claim-text', text: item.text }),
          h('p', { class: 'claim-meta mono', text: item.evidence_ids.join(' · ') }),
        ))),
      )),
    ),
    h('details', { class: 'reasons' },
      h('summary', { text: 'Why this candidate' }),
      h('ul', { class: 'plain-list' }, candidate.reasons.map((text) => h('li', { text }))),
    ),
    h('div', { class: 'trace' },
      h('span', { class: 'mono small', text: 'sources: ' }),
      candidate.source_ids.map((id) => h('button', {
        type: 'button', class: 'link-btn mono small', title: `Show every candidate built from ${id}`,
        on: { click: () => filterBySource(id) },
      }, id)),
    ),
    h('p', { class: 'trace mono small' }, `evidence: ${candidate.evidence_ids.length} records`),
    h('div', { class: 'toolbar cand-actions' },
      actionButton('Save', 'SAVE', candidate.status === 'SAVED' || candidate.status === 'REJECTED', true),
      actionButton('Reject', 'REJECT', candidate.status === 'REJECTED', false),
      actionButton('Add to queue', 'QUEUE', candidate.status === 'QUEUED' || candidate.status === 'REJECTED', false),
      h('button', {
        type: 'button',
        class: 'btn',
        disabled: candidate.status === 'NONE' && (candidate.status_history || []).length > 0
          && (candidate.status_history || []).at(-1).action === 'REMOVE',
        title: candidate.status === 'NONE' && (candidate.status_history || []).length > 0
          && (candidate.status_history || []).at(-1).action === 'REMOVE'
          ? 'Already removed — restore จาก Removed list ก่อน'
          : 'นำออกจากชุด active (soft delete) แล้วเลือกวิธีสร้างรายการทดแทน',
        on: {
          click: () => {
            if (!window.confirm(`นำ "${candidate.title}" ออกจากชุด candidates? (soft delete — restore ได้จากประวัติ แล้วระบบจะเปิด modal เลือกรายการทดแทน)`)) return;
            run(async () => {
              const res = await api(`/api/mvp/candidates/${candidate.id}/action`, 'POST', { action: 'REMOVE' });
              applyState(res.state);
              openSelectModal('replace', candidate.id);
            }, `Remove + replace flow · ${candidate.id}`);
          },
        },
      }, '✕ นำออก/แทนที่'),
      h('button', {
        type: 'button',
        class: 'btn btn-ghost',
        disabled: candidate.status !== 'SAVED' && candidate.status !== 'QUEUED',
        title: candidate.status === 'SAVED' || candidate.status === 'QUEUED' ? 'Create a plan draft from this candidate' : 'Save or queue the candidate first',
        on: {
          click: () => {
            ui.selectedCandidateId = candidate.id;
            ui.createdPlan = null;
            go('plan');
          },
        },
      }, 'Plan →'),
    ),
  );
}

function renderQueue() {
  const state = ui.state;
  const queue = state.queue.map((id) => candidateById(id)).filter(Boolean);
  return h('section', { class: 'mvp-card queue-card' },
    h('div', { class: 'card-head' },
      h('div', null, h('p', { class: 'eyebrow', text: 'Queue' }), h('h2', { text: `${queue.length} candidate${queue.length === 1 ? '' : 's'} in order` })),
      badge('persisted in fixture state', 'badge-neutral'),
    ),
    queue.length === 0
      ? h('p', { class: 'muted' }, 'Nothing queued. Use “Add to queue” on a candidate card; reordering happens here.')
      : h('ol', { class: 'queue-list' }, queue.map((candidate, index) => h('li', { class: 'queue-item' },
        h('span', { class: 'queue-index', text: String(index + 1) }),
        h('div', { class: 'queue-title' },
          h('p', { class: 'cell-title', text: candidate.title }),
          h('p', { class: 'cell-sub mono', text: `${candidate.id} · rank #${candidate.rank} · ${candidate.scores.ranking_score}/100` }),
        ),
        h('div', { class: 'queue-controls' },
          h('button', {
            type: 'button', class: 'icon-btn', 'aria-label': `Move ${candidate.title} up`, disabled: ui.busy || index === 0,
            on: {
              click: () => run(async () => {
                const res = await api('/api/mvp/queue/reorder', 'POST', { candidateId: candidate.id, direction: 'UP' });
                applyState(res.state);
              }, 'Queue reordered'),
            },
          }, '↑'),
          h('button', {
            type: 'button', class: 'icon-btn', 'aria-label': `Move ${candidate.title} down`, disabled: ui.busy || index === queue.length - 1,
            on: {
              click: () => run(async () => {
                const res = await api('/api/mvp/queue/reorder', 'POST', { candidateId: candidate.id, direction: 'DOWN' });
                applyState(res.state);
              }, 'Queue reordered'),
            },
          }, '↓'),
          h('button', {
            type: 'button', class: 'icon-btn danger', 'aria-label': `Remove ${candidate.title} from the queue`, disabled: ui.busy,
            on: {
              click: () => run(async () => {
                const res = await api(`/api/mvp/candidates/${candidate.id}/action`, 'POST', { action: 'REMOVE' });
                applyState(res.state);
              }, 'Removed from queue'),
            },
          }, '✕'),
        ),
      ))),
  );
}

/* ---------- Shared select modal (ADD/REPLACE — User Select Integration) ---------- */

function removedCandidates(state) {
  return (state.candidates || []).filter((candidate) => candidate.status === 'NONE'
    && (candidate.status_history || []).length > 0
    && (candidate.status_history || []).at(-1).action === 'REMOVE');
}

function openSelectModal(context, replaceCandidateId) {
  closeSelectModal();
  const state = ui.state;
  const removedCount = removedCandidates(state).length;
  const overlay = h('div', { class: 'modal-overlay', style: 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:60;' },
    h('div', { class: 'modal-card', style: 'background:var(--bg,#141414);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:12px;max-width:560px;width:92%;max-height:82vh;overflow:auto;padding:18px;' },
      h('div', { class: 'modal-head', style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;' },
        h('h3', { text: context === 'replace' ? 'แทนที่ candidate ที่นำออก' : 'เพิ่มข้อเสนอใหม่' }),
        h('button', { type: 'button', class: 'link-btn', on: { click: closeSelectModal } }, 'ปิด ✕'),
      ),
      h('p', { class: 'note', text: context === 'replace'
        ? `Candidate ถูกนำออกแบบ soft delete แล้ว (ปัจจุบันมี removed ${removedCount} รายการ — restore ได้จากประวัติ) เลือกวิธีสร้างรายการทดแทน 1 รายการ`
        : 'เลือกวิธีค้นคว้ารายการใหม่ — ผลลัพธ์จะแสดงเพื่อรีวิวก่อนส่งเข้า Queue เสมอ (ระบบจะไม่ยิง Queue เอง)' }),
      h('div', { class: 'stack', style: 'display:flex;flex-direction:column;gap:10px;margin:12px 0;' },
        h('button', { type: 'button', class: 'btn btn-primary', disabled: ui.busy,
          on: { click: () => runSelect(context, replaceCandidateId, { method: 'research' }) } },
          'Research Select — ให้ระบบค้นคว้าและจัดอันดับให้'),
        h('button', { type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
          on: { click: () => renderUserShortlist(context, replaceCandidateId) } },
          'User Select — เลือกเองจาก shortlist'),
      ),
      h('div', { id: 'select-modal-body' }),
    ),
  );
  document.body.append(overlay);
}

function closeSelectModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

function existingOfferItems(state) {
  const byId = new Map((state.offers || []).map((offer) => [offer.id, offer]));
  const items = new Set();
  for (const candidate of state.candidates || []) {
    const offer = byId.get(candidate.offer_id);
    if (offer) items.add(String(offer.item_id));
  }
  return items;
}

function renderUserShortlist(context, replaceCandidateId) {
  const body = document.getElementById('select-modal-body');
  if (!body) return;
  const state = ui.state;
  const existingItems = existingOfferItems(state);
  const shortlist = (state.offers || [])
    .filter((offer) => !existingItems.has(String(offer.item_id)))
    .slice(0, 50);
  body.innerHTML = '';
  body.append(h('p', { class: 'note', text: `Shortlist ${shortlist.length} รายการ (สูงสุด 50 ต่อหน้า — จัดอันดับตาม mvp-score-v1) — ติ๊กเลือกแล้วกดยืนยัน` }));
  const checkboxes = shortlist.map((offer) => h('label', { class: 'shortlist-row', style: 'display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08);' },
    h('input', { type: 'checkbox', value: offer.id }),
    h('span', { class: 'mono small', text: `${offer.item_id} · ${offer.product_name || ''} · THB ${offer.price_thb} (list ${offer.list_price_thb})` }),
  ));
  const confirmBtn = h('button', {
    type: 'button', class: 'btn btn-primary', disabled: ui.busy,
    on: {
      click: () => {
        const checked = [...body.querySelectorAll('input[type=checkbox]:checked')].map((el) => el.value);
        if (!checked.length) { toast('เลือกอย่างน้อย 1 รายการก่อนยืนยัน', true); return; }
        runSelect(context, replaceCandidateId, { method: 'user', offerIds: checked });
      },
    },
  }, 'ยืนยันการเลือก (สร้าง candidate เพื่อรีวิว — ไม่เข้า Queue เอง)');
  body.append(h('div', { class: 'stack', style: 'display:flex;flex-direction:column;' }, checkboxes), h('div', { style: 'margin-top:12px;' }, confirmBtn));
}

async function runSelect(context, replaceCandidateId, payload) {
  await run(async () => {
    const body = { ...payload, context };
    if (replaceCandidateId) body.replaceCandidateId = replaceCandidateId;
    const res = await api('/api/mvp/candidates/select', 'POST', body);
    applyState(res.state);
    closeSelectModal();
    toast(`เพิ่ม ${res.added_count} candidate เพื่อรีวิว (ยังไม่เข้า Queue — กด Send To Queue ต่อรายการเอง)`);
  }, 'Select candidates');
}

function renderRemovedHistory() {
  const state = ui.state;
  const removed = removedCandidates(state);
  if (!removed.length) return null;
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Removed candidates (soft delete — restore available)' }),
        h('h2', { text: `${removed.length} removed` }),
      ),
    ),
    h('p', { class: 'note' }, 'รายการเหล่านี้ถูกนำออกจากชุด active ด้วย REMOVE — กด Restore เพื่อกลับเข้า Active-NONE (ระบบจะ re-rank ให้ และไม่เข้า Queue เอง)'),
    h('div', { class: 'stack' }, removed.map((candidate) => h('div', { class: 'removed-row', style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);' },
      h('div', null,
        h('p', { class: 'mono small', text: `${candidate.id} · ${candidate.title}` }),
        h('p', { class: 'muted small', text: `removed เมื่อ ${(candidate.status_history || []).at(-1)?.at || '—'} · evidence ${candidate.evidence_ids.length} records` }),
      ),
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const res = await api(`/api/mvp/candidates/${candidate.id}/restore`, 'POST', {});
            applyState(res.state);
          }, `Restore · ${candidate.id}`),
        },
      }, 'Restore'),
    ))),
  );
}

function renderCandidates() {
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });

  if (!state || !state.import) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'Import the fixture first' })),
      h('p', null, h('button', { type: 'button', class: 'link-btn', on: { click: () => go('import') } }, 'Go to import →')),
    ));
    return wrap;
  }

  const counts = statusCounts();
  const visible = ui.sourceFilter
    ? state.candidates.filter((candidate) => candidate.source_ids.includes(ui.sourceFilter))
    : state.candidates;
  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Step 3 · Candidate workspace' }),
        h('h2', { text: state.summary.candidates ? `${state.summary.candidates} ranked candidates` : 'No candidates yet' }),
      ),
      h('div', { class: 'head-meta' },
        badge(`${counts.SAVED} saved`, 'badge-select'),
        badge(`${counts.QUEUED} queued`, 'badge-defer'),
        badge(`${counts.REJECTED} rejected`, 'badge-reject'),
      ),
    ),
    h('p', { class: 'lead' },
      'The five candidates are generated deterministically from the current import. Save, reject, queue and remove are written to research state and survive a reload; nothing here advances a gate.'),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(() => generateFromResearch(false), 'Regenerated 5 candidates (actions kept for surviving ids)'),
        },
      }, state.summary.candidates ? 'Regenerate candidates' : 'Generate 5 candidates'),
      h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => openSelectModal('add', null) }, disabled: ui.busy }, '+ ข้อเสนอใหม่ (Research/User Select)'),
      h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => go('plan') }, disabled: !(counts.SAVED + counts.QUEUED) }, 'Go to plan →'),
    ),
    h('p', { class: 'note' }, 'Status counts are shown above. “Remove” clears the candidate back to not-actioned and takes it out of the queue.'),
  ));

  if (ui.sourceFilter) {
    const source = (state.sources || []).find((entry) => entry.id === ui.sourceFilter);
    wrap.append(h('section', { class: 'notice notice-filter' },
      h('div', { class: 'notice-head' },
        h('h2', { text: `Filtered by ${source ? source.label : ui.sourceFilter}` }),
        h('button', { type: 'button', class: 'link-btn', on: { click: () => { ui.sourceFilter = null; render(); } } }, 'Clear filter ✕'),
      ),
      h('p', { class: 'cell-sub mono', text: `${ui.sourceFilter} · ${visible.length} of ${state.candidates.length} candidates` }),
    ));
  }

  mount(wrap, renderExpiredNotice());

  if (ui.error) {
    wrap.append(h('section', { class: 'notice notice-error' },
      h('div', { class: 'notice-head' }, h('h2', { text: ui.error.message })),
    ));
  }

  if (!state.summary.candidates) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'Candidates are generated, not auto-created' })),
      h('p', { text: 'Press “Generate 5 candidates” after reviewing the research records.' }),
    ));
    return wrap;
  }

  wrap.append(h('div', { class: 'cand-grid' }, visible.map(renderCandidateCard)));
  if (!visible.length) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'No candidate uses this source' })),
      h('p', { text: 'The source is linked to research records, but none of the five ranked candidates came from it.' }),
    ));
  }
  wrap.append(renderQueue());
  return wrap;
}

/* ---------- Plan ---------- */

function eligibleCandidates() {
  return ui.state ? ui.state.candidates.filter((c) => c.status === 'SAVED' || c.status === 'QUEUED') : [];
}

function approachCard(approach, key, label) {
  const selected = ui.approach === key;
  return h('label', { class: `approach${selected ? ' is-selected' : ''}` },
    h('div', { class: 'approach-head' },
      h('input', {
        type: 'radio', name: 'approach', value: key, checked: selected,
        on: { change: () => { ui.approach = key; render(); } },
      }),
      h('div', null,
        h('p', { class: 'approach-label', text: label }),
        h('p', { class: 'cell-sub', text: approach.origin === 'USER' ? 'User-authored · stored separately' : 'AI draft · from fixture evidence' }),
      ),
    ),
    h('p', { class: 'approach-angle', text: approach.angle }),
    h('dl', { class: 'kv compact' },
      approach.audience ? h('div', null, h('dt', { text: 'Audience' }), h('dd', { text: approach.audience })) : null,
      approach.hook ? h('div', null, h('dt', { text: 'Hook' }), h('dd', { text: approach.hook })) : null,
      approach.format ? h('div', null, h('dt', { text: 'Format' }), h('dd', { text: approach.format })) : null,
      approach.cta ? h('div', null, h('dt', { text: 'CTA' }), h('dd', { text: approach.cta })) : null,
      approach.rationale ? h('div', null, h('dt', { text: 'Rationale' }), h('dd', { text: approach.rationale })) : null,
    ),
    approach.claim_notes ? h('p', { class: 'note', text: approach.claim_notes }) : null,
    approach.tradeoffs ? h('ul', { class: 'plain-list tight' }, approach.tradeoffs.map((text) => h('li', { text }))) : null,
    approach.evidence_ids && approach.evidence_ids.length
      ? h('p', { class: 'trace mono small', text: `evidence: ${approach.evidence_ids.join(' · ')}` })
      : h('p', { class: 'trace small', text: 'No generated evidence mapping — verify claims manually.' }),
    h('p', { class: 'gate-note', text: approach.gate_note }),
  );
}

function renderCustomForm(draft) {
  const saved = draft.approaches.user_custom;
  if (saved) {
    return h('div', null,
      approachCard(saved, 'user_custom', 'User Custom'),
      h('div', { class: 'toolbar' },
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
          on: {
            click: () => run(async () => {
              const res = await api('/api/mvp/plan/custom', 'POST', {
                draftId: draft.id,
                angle: `${saved.angle} (revised)`,
                audience: saved.audience || '',
                hook: saved.hook || '',
                format: saved.format || '',
                rationale: saved.rationale || '',
              });
              ui.draft = res.draft;
              applyState(res.state);
            }, 'User custom approach updated'),
          },
        }, 'Edit (appends “revised”)'),
      ),
    );
  }

  const field = (name, label, rows) => h('label', { class: 'field' },
    h('span', { class: 'field-label', text: label }),
    rows
      ? h('textarea', {
        rows,
        value: ui.custom[name],
        on: { input: (event) => { ui.custom[name] = event.target.value; } },
      })
      : h('input', {
        type: 'text',
        value: ui.custom[name],
        on: { input: (event) => { ui.custom[name] = event.target.value; } },
      }),
  );

  return h('div', { class: 'custom-form' },
    h('p', { class: 'approach-label', text: 'User Custom' }),
    h('p', { class: 'cell-sub', text: 'Stored under approaches.user_custom — never merged into Personalized A/B or Exploration.' }),
    field('angle', 'Angle (required, 10+ characters)', 3),
    field('audience', 'Audience', 0),
    field('hook', 'Hook', 0),
    field('format', 'Format', 0),
    field('rationale', 'Rationale', 2),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const res = await api('/api/mvp/plan/custom', 'POST', {
              draftId: draft.id,
              angle: ui.custom.angle,
              audience: ui.custom.audience,
              hook: ui.custom.hook,
              format: ui.custom.format,
              rationale: ui.custom.rationale,
            });
            ui.draft = res.draft;
            ui.approach = 'user_custom';
            applyState(res.state);
          }, 'User custom approach saved separately'),
        },
      }, 'Save custom approach'),
    ),
  );
}

function renderImpactPreview(draft) {
  const preview = draft.impact_preview;
  return h('section', { class: 'mvp-card impact' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Impact preview · required before the next step' }),
        h('h2', { text: 'What creating this plan changes' }),
      ),
      badge('THB 0 · no external calls', 'badge-neutral'),
    ),
    h('dl', { class: 'kv' },
      h('div', null, h('dt', { text: 'Candidate' }), h('dd', { text: `${preview.candidate.id} · ${preview.candidate.title} · ${preview.candidate.status}` })),
      h('div', null, h('dt', { text: 'Plan identity' }), h('dd', { class: 'mono', text: `${preview.plan_identity_preview.plan_id} → ${preview.plan_identity_preview.id}` })),
      h('div', null, h('dt', { text: 'Spend' }), h('dd', { text: thb(preview.spend_thb) })),
      h('div', null, h('dt', { text: 'External calls' }), h('dd', { text: String(preview.external_calls) })),
    ),
    h('div', { class: 'two-col' },
      h('div', null,
        h('h3', { text: 'Will happen' }),
        h('ul', { class: 'plain-list' }, preview.changes.map((change) => h('li', null,
          h('strong', { text: change.what }),
          h('span', { class: 'cell-sub', text: ` → ${change.where} · ${change.effect}` }),
        ))),
      ),
      h('div', null,
        h('h3', { text: 'Will NOT happen' }),
        h('ul', { class: 'plain-list' }, preview.not_done.map((text) => h('li', { text }))),
      ),
    ),
    h('div', { class: 'table-scroll' },
      h('table', { class: 'mvp-table compact' },
        h('thead', null, h('tr', null, h('th', { text: 'Gate' }), h('th', { text: 'State after this action' }))),
        h('tbody', null, Object.entries(preview.gates).map(([gate, status]) => h('tr', null,
          h('td', { class: 'mono', text: gate }),
          h('td', { text: status }),
        ))),
      ),
    ),
    h('ul', { class: 'limits' }, preview.limitations.map((text) => h('li', { text }))),
    h('label', { class: 'confirm-row' },
      h('input', {
        type: 'checkbox', checked: ui.confirmImpact,
        on: { change: (event) => { ui.confirmImpact = event.target.checked; render(); } },
      }),
      h('span', { text: 'I reviewed the impact preview. Create the fixture plan record only.' }),
    ),
  );
}

function renderCreatedPlan(plan) {
  return h('section', { class: 'mvp-card plan-record' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Fixture plan record' }),
        h('h2', { text: `${plan.plan_id} · ${APPROACH_LABEL[plan.approach] || plan.approach}` }),
      ),
      badge(plan.status, 'badge-mock'),
    ),
    h('dl', { class: 'kv' },
      h('div', null, h('dt', { text: 'plan_id' }), h('dd', { class: 'mono', text: plan.plan_id })),
      h('div', null, h('dt', { text: 'snapshot id' }), h('dd', { class: 'mono', text: plan.id })),
      h('div', null, h('dt', { text: 'version' }), h('dd', { class: 'mono', text: plan.version })),
      h('div', null, h('dt', { text: 'candidate' }), h('dd', { class: 'mono', text: plan.candidate_id })),
      h('div', null, h('dt', { text: 'created' }), h('dd', { text: fmtDate(plan.created_at) })),
    ),
    h('p', { class: 'note' }, plan.selected_approach ? plan.selected_approach.angle : ''),
    h('div', { class: 'boundary-box' },
      h('p', { class: 'boundary-title', text: 'Boundary' }),
      h('ul', { class: 'plain-list' },
        h('li', { text: 'Written to MVP fixture state only; data/app/state.json was not touched.' }),
        h('li', { text: 'Not a Plan Version contract record; nothing was posted to /api/plan-version.' }),
        h('li', { text: 'No Experiment, CWI, script, video, publication or gate decision was created.' }),
        h('li', { text: plan.foundation_handoff.reason }),
      ),
    ),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const res = await api('/api/mvp/content/draft', 'POST', {
              planId: plan.plan_id,
              approach: 'problem_first',
            });
            ui.contentId = res.project.content_id;
            ui.sceneId = res.project.storyboard.scenes[0].id;
            ui.contentTab = 'storyboard';
            ui.contentApproach = 'problem_first';
            applyState(res.state);
            toast(`Content ${res.project.content_id} created from ${plan.plan_id}`);
            go('content');
          }, 'Content draft created from the plan'),
        },
      }, 'สร้าง Content จากแผนนี้ →'),
    ),
  );
}

function renderPlan() {
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });

  if (!state || !state.import) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'Import and generate candidates first' })),
      h('p', null, h('button', { type: 'button', class: 'link-btn', on: { click: () => go('import') } }, 'Go to import →')),
    ));
    return wrap;
  }

  const eligible = eligibleCandidates();
  if (ui.createdPlan) wrap.append(renderCreatedPlan(ui.createdPlan));

  if (!eligible.length) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'No selected candidate' })),
      h('p', { text: 'Save a candidate or add it to the queue first — a plan is only created from a selected candidate.' }),
      h('p', null, h('button', { type: 'button', class: 'link-btn', on: { click: () => go('candidates') } }, 'Open candidates →')),
    ));
    return wrap;
  }

  const selected = eligible.some((c) => c.id === ui.selectedCandidateId) ? ui.selectedCandidateId : eligible[0].id;
  ui.selectedCandidateId = selected;

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Step 4 · Plan' }),
        h('h2', { text: ui.draft ? `Draft ${ui.draft.id} · 4 approaches` : 'Create a plan from a selected candidate' }),
      ),
      badge('fixture plan only', 'badge-neutral'),
    ),
    h('p', { class: 'lead' },
      'The plan compares Personalized A, Personalized B, Exploration and User Custom. The user-custom approach is stored separately and is never merged into the generated three.'),
    h('div', { class: 'toolbar' },
      h('label', { class: 'field inline' },
        h('span', { class: 'field-label', text: 'Candidate' }),
        h('select', {
          value: selected,
          disabled: ui.busy,
          on: { change: (event) => { ui.selectedCandidateId = event.target.value; } },
        }, eligible.map((candidate) => h('option', {
          value: candidate.id,
          selected: candidate.id === selected,
          text: `${candidate.id} · ${candidate.title} · ${candidate.status} · ${candidate.scores.ranking_score}/100`,
        }))),
      ),
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const res = await api('/api/mvp/plan/draft', 'POST', { candidateId: ui.selectedCandidateId });
            ui.draft = res.draft;
            ui.approach = 'personalized_a';
            ui.confirmImpact = false;
            applyState(res.state);
          }, 'Plan draft created with 4 approach slots'),
        },
      }, ui.draft ? 'Replace draft with a new one' : 'Generate plan draft'),
    ),
    ui.error ? h('p', { class: 'error-text', text: ui.error.message }) : null,
  ));

  if (!ui.draft) {
    if ((state.plans || []).length > 1) {
      wrap.append(h('div', { class: 'stack' }, [...state.plans].reverse().slice(1).map(renderCreatedPlan)));
    }
    return wrap;
  }

  const draft = ui.draft;
  const candidate = candidateById(draft.candidate_id);

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Draft basis' }),
        h('h2', { text: candidate ? candidate.title : draft.candidate_id }),
      ),
      badge(draft.plan_identity_preview.plan_id, 'badge-neutral'),
    ),
    h('div', { class: 'score-row' },
      h('div', { class: 'score' }, h('span', { class: 'score-val', text: String(draft.basis.ranking_score) }), h('span', { class: 'score-label', text: 'Ranking' })),
      h('div', { class: 'score' }, h('span', { class: 'score-val', text: String(draft.basis.opportunity_score) }), h('span', { class: 'score-label', text: 'Opportunity' })),
      h('div', { class: 'score' }, h('span', { class: 'score-val', text: draft.basis.confidence.level }), h('span', { class: 'score-label', text: 'Confidence' })),
    ),
    h('p', { class: 'note', text: draft.basis.confidence.basis }),
  ));

  wrap.append(h('div', { class: 'approach-grid' },
    draft.approaches.generated.map((approach) => approachCard(approach, approach.key, approach.label)),
  ));

  wrap.append(h('section', { class: 'mvp-card custom-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Fourth approach' }),
        h('h2', { text: 'User Custom' }),
      ),
      badge('separate field', 'badge-neutral'),
    ),
    renderCustomForm(draft),
  ));

  wrap.append(renderImpactPreview(draft));

  const selectedApproach = ui.approach;
  const customReady = selectedApproach !== 'user_custom' || Boolean(draft.approaches.user_custom);
  const canCreate = ui.confirmImpact && customReady && !ui.busy;

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Commit the draft' }),
        h('h2', { text: `Selected: ${APPROACH_LABEL[selectedApproach]}` }),
      ),
      badge(`→ ${draft.plan_identity_preview.plan_id}`, 'badge-mock'),
    ),
    h('p', { class: 'muted' },
      'The create action is blocked until the impact preview is confirmed. It writes one fixture plan record and nothing else.'),
    ui.approach === 'user_custom' && !draft.approaches.user_custom
      ? h('p', { class: 'warn', text: 'Save your custom approach first, or choose one of the generated approaches.' })
      : null,
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: !canCreate,
        on: {
          click: () => run(async () => {
            const res = await api('/api/mvp/plan', 'POST', {
              draftId: draft.id,
              approach: ui.approach,
              confirmImpact: true,
            });
            ui.createdPlan = res.plan;
            ui.draft = null;
            ui.confirmImpact = false;
            applyState(res.state);
          }, 'Plan created in fixture state — no gate advanced'),
        },
      }, 'Create fixture plan'),
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
        on: { click: () => go('candidates') },
      }, 'Back to candidates'),
    ),
    !ui.confirmImpact ? h('p', { class: 'note', text: 'Confirm the impact preview above to enable this button.' }) : null,
  ));

  return wrap;
}

/* ---------- Content ---------- */

const CONTENT_STATUS_BADGE = {
  DRAFT: 'badge-neutral',
  REVIEW: 'badge-defer',
  FINALIZED: 'badge-select',
  EXPORTED: 'badge-fact',
  READY_TO_PUBLISH: 'badge-mock',
};
const CONTENT_STATUS_TEXT = {
  DRAFT: 'ร่าง — แก้ไขได้อิสระ',
  REVIEW: 'ส่งตรวจ — รอผลตรวจภาษาไทยและตรวจสอบ',
  FINALIZED: 'ตรวจผ่าน — พร้อม export',
  EXPORTED: 'ส่งออกแล้ว — มีไฟล์วิดีโอจริง',
  READY_TO_PUBLISH: 'พร้อมเผยแพร่ — ยังไม่ได้กดเผยแพร่',
};
let contentDrafts = {};

function allContents() {
  return (ui.state && ui.state.contents) || [];
}

function contentById(id) {
  return allContents().find((c) => c.content_id === id) || null;
}

function openContent() {
  return ui.contentId ? contentById(ui.contentId) : null;
}

function contentEditable(project) {
  return project && (project.status === 'DRAFT' || project.status === 'REVIEW');
}

function sceneDraft(scene, track) {
  const key = `${scene.id}:${track}`;
  if (!contentDrafts[key]) {
    if (track === 'visual') {
      contentDrafts[key] = {
        preset: scene.visual.preset,
        from: (scene.visual.background && scene.visual.background.from) || '#12151C',
        accent: (scene.visual.background && scene.visual.background.accent) || '#2E7DF6',
        asset_ref: scene.visual.asset_ref || '',
        position: scene.visual.position,
        duration_s: scene.duration_s,
      };
    } else if (track === 'text') {
      contentDrafts[key] = {
        badge: scene.overlay.badge || '',
        headline: scene.overlay.headline || '',
        subhead: scene.overlay.subhead || '',
        fact: scene.overlay.fact || '',
        cta: scene.overlay.cta || '',
        position: scene.overlay.position,
      };
    } else {
      contentDrafts[key] = {
        voiceover: scene.audio.voiceover || '',
        music: scene.audio.music || 'none',
        sfx: scene.audio.sfx || 'none',
      };
    }
  }
  return contentDrafts[key];
}

function contentField(draft, key, label, opts = {}) {
  const { rows, type, options, placeholder } = opts;
  let input;
  if (options) {
    const current = String(draft[key] == null ? '' : draft[key]);
    input = h('select', { on: { change: (event) => { draft[key] = event.target.value; } } },
      options.map((option) => h('option', {
        value: option.value,
        text: option.label,
        selected: String(option.value) === current,
      })));
  } else if (rows) {
    input = h('textarea', {
      rows,
      placeholder: placeholder || null,
      on: { input: (event) => { draft[key] = event.target.value; } },
      text: String(draft[key] == null ? '' : draft[key]),
    });
  } else {
    input = h('input', {
      type: type || 'text',
      placeholder: placeholder || null,
      value: String(draft[key] == null ? '' : draft[key]),
      on: { input: (event) => { draft[key] = event.target.value; } },
    });
  }
  return h('label', { class: 'field' },
    h('span', { class: 'field-label', text: label }),
    input);
}

function saveTrackBody(project, scene, track) {
  const draft = sceneDraft(scene, track);
  if (track === 'visual') {
    return {
      sceneId: scene.id,
      visual: {
        preset: draft.preset,
        background: { from: draft.from, accent: draft.accent },
        asset_ref: draft.asset_ref || null,
        position: draft.position,
      },
      duration_s: Number(draft.duration_s),
    };
  }
  if (track === 'text') {
    return {
      sceneId: scene.id,
      overlay: {
        badge: draft.badge,
        headline: draft.headline,
        subhead: draft.subhead,
        fact: draft.fact,
        cta: draft.cta,
        position: draft.position,
      },
    };
  }
  return {
    sceneId: scene.id,
    audio: { voiceover: draft.voiceover, music: draft.music, sfx: draft.sfx },
  };
}

function saveTrack(project, scene, track) {
  return run(async () => {
    const res = await api(`/api/mvp/content/${project.content_id}/track/${track}`, 'POST', saveTrackBody(project, scene, track));
    delete contentDrafts[`${scene.id}:${track}`];
    applyState(res.state);
    toast(`บันทึก${track === 'visual' ? 'ภาพ' : track === 'text' ? 'ตัวหนังสือ' : 'เสียง'}ฉาก ${scene.id} แล้ว (Script v${res.project.script_version})`);
  });
}

function renderSceneEditor(project, scene) {
  const track = ui.sceneTab;
  const draft = sceneDraft(scene, track);
  const assetOptions = [
    { value: '', label: '— ไม่ใช้ภาพ (ใช้สีพื้น) —' },
    ...(project.asset_order || []).map((id) => ({ value: id, label: `${id} · ${project.assets[id].filename}` })),
  ];
  let fields;
  if (track === 'visual') {
    fields = [
      contentField(draft, 'preset', 'โทนฉาก (preset)', {
        options: VISUAL_PRESET_KEYS.map((key) => ({ value: key, label: key })),
      }),
      contentField(draft, 'from', 'สีพื้นจาก (from, hex)'),
      contentField(draft, 'accent', 'สีเน้น (accent, hex)'),
      contentField(draft, 'asset_ref', 'ภาพที่ใช้ (asset_ref)', { options: assetOptions }),
      contentField(draft, 'position', 'ตำแหน่งข้อความ', {
        options: [
          { value: 'center', label: 'กลางจอ' },
          { value: 'bottom', label: 'ล่างจอ' },
        ],
      }),
      contentField(draft, 'duration_s', `ความยาว (วินาที 0.5–30, ปัจจุบัน ${scene.duration_s})`, { type: 'number' }),
    ];
  } else if (track === 'text') {
    fields = [
      contentField(draft, 'badge', 'แถบหัวฉาก (badge)', { rows: 2 }),
      contentField(draft, 'headline', 'หัวข้อใหญ่ (headline)'),
      contentField(draft, 'subhead', 'หัวข้อรอง (subhead)'),
      contentField(draft, 'fact', 'ข้อเท็จจริงบนจอ (fact)', { rows: 2 }),
      contentField(draft, 'cta', 'CTA ของฉากนี้ (ว่าง = ไม่มี)'),
      contentField(draft, 'position', 'ตำแหน่งข้อความ', {
        options: [
          { value: 'center', label: 'กลางจอ' },
          { value: 'bottom', label: 'ล่างจอ' },
        ],
      }),
    ];
  } else {
    fields = [
      contentField(draft, 'voiceover', 'บทพูด (voiceover / script)', { rows: 4 }),
      contentField(draft, 'music', 'เพลง (music)'),
      contentField(draft, 'sfx', 'เสียงเอฟเฟกต์ (sfx)'),
    ];
  }

  return h('div', { class: 'scene-editor' },
    h('div', { class: 'track-tabs' }, SCENE_TABS.map((tab) => h('button', {
      type: 'button',
      class: `track-tab${ui.sceneTab === tab.key ? ' is-active' : ''}`,
      disabled: ui.busy,
      on: { click: () => { ui.sceneTab = tab.key; render(); } },
    }, tab.label))),
    fields,
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: { click: () => saveTrack(project, scene, track) },
      }, `บันทึก${SCENE_TABS.find((t) => t.key === track).label}`),
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
        on: {
          click: () => {
            delete contentDrafts[`${scene.id}:${track}`];
            render();
          },
        },
      }, 'ยกเลิกการแก้ไข'),
    ),
    h('p', { class: 'note small', text: 'การแก้ไขเสียงจะเพิ่ม Script version ใหม่ทุกครั้ง; แก้ไขตัวหนังสือในฉากสุดท้ายจะซิงก์ CTA ของโปรเจกต์ด้วย' }),
  );
}

function renderStoryboardTab(project) {
  const scenes = project.storyboard.scenes || [];
  const wrap = h('div', { class: 'stack' });

  wrap.append(renderApproachPicker(project));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Script / CTA' }),
        h('h2', { text: `บทพูดและ CTA · Script v${project.script_version}` }),
      ),
      badge(`checksum ${String((project.script && project.script.checksum) || '').slice(0, 8)}…`, 'badge-neutral'),
    ),
    h('div', { class: 'table-scroll' },
      h('table', { class: 'mvp-table compact' },
        h('thead', null, h('tr', null,
          h('th', { text: '#' }), h('th', { text: 'ฉาก' }),
          h('th', { text: 'วินาที' }), h('th', { text: 'บทพูด (บนจอ)' }),
        )),
        h('tbody', null, (project.script && project.script.lines || []).map((line) => h('tr', null,
          h('td', { class: 'mono', text: String(line.order) }),
          h('td', { class: 'mono', text: `${line.scene_id} · ${line.role}` }),
          h('td', { text: String(line.duration_s) }),
          h('td', null,
            h('div', { class: 'cell-title', text: line.voiceover }),
            h('div', { class: 'cell-sub', text: (line.on_screen || []).join(' · ') }),
          ),
        ))),
      ),
    ),
    h('p', { class: 'note' }, project.cta && project.cta.text ? `CTA: ${project.cta.text}` : 'ยังไม่มี CTA'),
    h('p', { class: 'trace mono small', text: `script versions: ${(project.script_version_history || []).map((v) => `v${v.version}`).join(' → ')}` }),
  ));

  for (const scene of scenes) {
    const selected = ui.sceneId === scene.id;
    wrap.append(h('section', { class: `mvp-card scene-card${selected ? ' is-selected' : ''}` },
      h('div', { class: 'card-head' },
        h('button', {
          type: 'button', class: 'link-btn',
          on: { click: () => { ui.sceneId = scene.id; ui.sceneTab = 'visual'; render(); } },
        }, `${scene.id} · ${scene.role} · ${scene.duration_s}s`),
        h('span', { class: 'trace mono small', text: `evidence: ${(scene.evidence_ids || []).length ? scene.evidence_ids.join(' · ') : '—'}` }),
      ),
      h('p', { class: 'cell-sub', text: `ภาพ: ${scene.visual.preset}${scene.visual.asset_ref ? ` · asset ${scene.visual.asset_ref}` : ''} | หัวข้อ: ${scene.overlay.headline || '—'} | บทพูด: ${scene.audio.voiceover || '—'}` }),
      selected ? renderSceneEditor(project, scene) : null,
    ));
  }

  if (contentEditable(project)) {
    const order = scenes.map((s) => s.id);
    wrap.append(h('section', { class: 'mvp-card' },
      h('div', { class: 'card-head' },
        h('div', null,
          h('p', { class: 'eyebrow', text: 'จัดการฉาก' }),
          h('h2', { text: `${scenes.length} ฉาก` }),
        ),
        badge(`${project.preview ? project.preview.total_duration_s : '—'}s`, 'badge-neutral'),
      ),
      h('div', { class: 'toolbar' },
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
          on: {
            click: () => run(async () => {
              const res = await api(`/api/mvp/content/${project.content_id}/scenes`, 'POST', { role: 'BODY', duration_s: 4 });
              applyState(res.state);
              ui.sceneId = res.project.storyboard.scenes[res.project.storyboard.scenes.length - 1].id;
            }, 'เพิ่มฉากใหม่แล้ว'),
          },
        }, 'เพิ่มฉากท้าย'),
      ),
      scenes.map((scene, index) => h('div', { class: 'toolbar' },
        h('span', { class: 'mono small', text: `${index + 1}. ${scene.id} · ${scene.role}` }),
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy || index === 0,
          on: { click: () => run(async () => {
            const next = [...scenes.map((s) => s.id)];
            const [moved] = next.splice(index, 1);
            next.splice(index - 1, 0, moved);
            const res = await api(`/api/mvp/content/${project.content_id}/scenes/reorder`, 'POST', { order: next });
            applyState(res.state);
          }) },
        }, '↑'),
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy || index === scenes.length - 1,
          on: { click: () => run(async () => {
            const next = [...scenes.map((s) => s.id)];
            const [moved] = next.splice(index, 1);
            next.splice(index + 1, 0, moved);
            const res = await api(`/api/mvp/content/${project.content_id}/scenes/reorder`, 'POST', { order: next });
            applyState(res.state);
          }) },
        }, '↓'),
        h('button', {
          type: 'button', class: 'btn btn-ghost danger', disabled: ui.busy || scenes.length <= 2,
          on: { click: () => run(async () => {
            const res = await api(`/api/mvp/content/${project.content_id}/scenes/${scene.id}`, 'DELETE');
            applyState(res.state);
          }, `ลบฉาก ${scene.id} แล้ว`) },
        }, 'ลบ'),
      )),
    ));
  }

  return wrap;
}

function renderApproachPicker(project) {
  const generated = (project.approaches && project.approaches.generated) || [];
  const custom = project.approaches && project.approaches.user_custom;
  const editableState = contentEditable(project);
  if (!editableState) {
    return h('section', { class: 'mvp-card' },
      h('p', { class: 'note small', text: `โปรเจกต์นี้อยู่ที่สถานะ ${project.status} — เปลี่ยนแนวทางได้เฉพาะช่วง DRAFT / REVIEW` }));
  }
  if (ui.contentApproach === 'user_custom') {
    const draft = ui.contentCustom;
    return h('section', { class: 'mvp-card custom-card' },
      h('div', { class: 'card-head' },
        h('div', null,
          h('p', { class: 'eyebrow', text: 'แนวทาง 4' }),
          h('h2', { text: 'User Custom — เขียนเอง' }),
        ),
        badge('USER', 'badge-neutral'),
      ),
      h('p', { class: 'cell-sub', text: custom ? `บันทึกไว้: ${custom.angle}` : 'ยังไม่มีแนวทางที่ผู้ใช้บันทึกไว้ในโปรเจกต์นี้' }),
      contentField(draft, 'angle', 'มุมมองเนื้อหา (angle) — ต้องมี 10+ ตัวอักษร', { rows: 3 }),
      contentField(draft, 'audience', 'กลุ่มเป้าหมาย (audience)'),
      contentField(draft, 'hook', 'Hook'),
      contentField(draft, 'format', 'รูปแบบ (format)'),
      contentField(draft, 'cta', 'CTA'),
      h('div', { class: 'toolbar' },
        h('button', {
          type: 'button', class: 'btn btn-primary', disabled: ui.busy,
          on: {
            click: () => run(async () => {
              const res = await api(`/api/mvp/content/${project.content_id}/approach`, 'POST', {
                approach: 'user_custom',
                custom: {
                  angle: draft.angle,
                  audience: draft.audience || undefined,
                  hook: draft.hook || undefined,
                  format: draft.format || undefined,
                  cta: draft.cta || undefined,
                },
              });
              contentDrafts = {};
              applyState(res.state);
            }, 'เปลี่ยนเป็นแนวทาง User Custom แล้ว'),
          },
        }, 'สร้าง Storyboard จากแนวทางนี้'),
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
          on: { click: () => { ui.contentApproach = project.approach; render(); } },
        }, 'ย้อนกลับ'),
      ),
    );
  }
  const rows = generated.filter(Boolean).concat(custom ? [custom] : []);
  return h('section', { class: 'mvp-card approach-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'แนวทางเนื้อหา' }),
        h('h2', { text: `เลือกได้ ${generated.length} แบบ + แบบกำหนดเอง (ปัจจุบัน: ${project.approach})` }),
      ),
      badge('3 GENERATATED + 1 USER', 'badge-neutral'),
    ),
    h('div', { class: 'approach-grid' }, rows.map((approach) =>
      h('label', { class: `approach${project.approach === approach.key ? ' is-selected' : ''}` },
        h('div', { class: 'approach-head' },
          h('input', {
            type: 'radio', name: 'content-approach', value: approach.key,
            checked: ui.contentApproach === approach.key,
            on: { change: () => { ui.contentApproach = approach.key; render(); } },
          }),
          h('div', null,
            h('p', { class: 'approach-label', text: approach.label }),
            h('p', { class: 'cell-sub', text: approach.origin === 'USER' ? 'ผู้ใช้เขียนเอง' : 'สร้างจากหลักฐานในไฟล์ส่งออก' }),
          ),
        ),
        h('p', { class: 'approach-angle', text: approach.angle }),
        h('dl', { class: 'kv compact' },
          approach.audience ? h('div', null, h('dt', { text: 'กลุ่มเป้าหมาย' }), h('dd', { text: approach.audience })) : null,
          approach.hook ? h('div', null, h('dt', { text: 'Hook' }), h('dd', { text: approach.hook })) : null,
          approach.format ? h('div', null, h('dt', { text: 'รูปแบบ' }), h('dd', { text: approach.format })) : null,
          approach.cta ? h('div', null, h('dt', { text: 'CTA' }), h('dd', { text: approach.cta })) : null,
        ),
        (approach.tradeoffs || []).length ? h('ul', { class: 'plain-list tight' }, approach.tradeoffs.map((text) => h('li', { text }))) : null,
        (approach.evidence_ids || []).length
          ? h('p', { class: 'trace mono small', text: `evidence: ${approach.evidence_ids.join(' · ')}` })
          : h('p', { class: 'trace small', text: 'ไม่มีการอ้าง evidence อัตโนมัติ — ตรวจข้อเท็จจริงเองก่อนใช้' }),
        h('p', { class: 'gate-note', text: approach.gate_note }),
      ))),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button',
        class: 'btn btn-primary',
        disabled: ui.busy || ui.contentApproach === project.approach,
        on: {
          click: () => run(async () => {
            const res = await api(`/api/mvp/content/${project.content_id}/approach`, 'POST', { approach: ui.contentApproach });
            contentDrafts = {};
            applyState(res.state);
          }, 'เปลี่ยนแนวทางแล้ว — Storyboard / Script สร้างใหม่'),
        },
      }, 'สร้าง Storyboard ใหม่จากแนวทางนี้'),
    ),
  );
}

function renderPreviewTab(project) {
  const preview = project.preview;
  const scenes = project.storyboard.scenes || [];
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'ตัวอย่างก่อน export' }),
        h('h2', { text: `Preview · ${scenes.length} ฉาก` }),
      ),
      badge(preview ? `${preview.total_duration_s}s` : 'ยังไม่มี', 'badge-neutral'),
    ),
    h('p', { class: 'lead' },
      'คือภาพจำลองตามลำดับเวลาของแต่ละฉาก (9:16, 1080×1920) ใช้ตรวจก่อนกด export ไฟล์จริง'),
    scenes.map((scene) => h('div', { class: 'frame-row' },
      h('div', { class: `frame-frame preset-${scene.visual.preset}` },
        h('span', { class: 'frame-badge', text: scene.overlay.badge || '' }),
        h('span', { class: 'frame-headline', text: scene.overlay.headline || '' }),
        h('span', { class: 'frame-sub', text: scene.overlay.subhead || '' }),
        h('span', { class: 'frame-fact', text: scene.overlay.fact || '' }),
        scene.overlay.cta ? h('span', { class: 'frame-cta', text: scene.overlay.cta }) : null,
      ),
      h('div', { class: 'frame-meta' },
        h('p', { class: 'mono small', text: `${scene.id} · ${scene.role} · ${scene.duration_s}s` }),
        h('p', { class: 'cell-sub', text: `ภาพ: ${scene.visual.preset} · เสียง: ${scene.audio.voiceover || '—'}` }),
        (scene.evidence_ids || []).length
          ? h('p', { class: 'trace mono small', text: `evidence: ${scene.evidence_ids.join(' · ')}` })
          : null,
      ),
    )),
  );
}

function qaList(title, items) {
  if (!items || !items.length) return null;
  const badgeFor = { PASS: 'badge-fact', WARN: 'badge-defer', FAIL: 'badge-reject' };
  return h('details', { class: 'issue-block' },
    h('summary', null,
      h('span', { class: 'evidence-summary-title', text: `${title} (${items.length})` }),
    ),
    h('ul', { class: 'claim-list' }, items.map((item) => h('li', { class: 'claim' },
      badge(item.status, badgeFor[item.status] || 'badge-neutral'),
      h('div', null,
        h('p', { class: 'claim-text', text: item.label }),
        h('p', { class: 'claim-meta', text: `${item.id} · ${item.message}` }),
      ),
    ))),
  );
}

function renderQaTab(project) {
  const report = project.qa;
  const canRun = contentEditable(project);
  const summary = report ? report.summary : { PASS: 0, WARN: 0, FAIL: 0 };
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'ตรวจภาษาไทยและข้อมูลสำคัญ' }),
        h('h2', { text: report ? `ผลตรวจล่าสุด ${fmtDate(report.ran_at)}` : 'ยังไม่ได้รันการตรวจ' }),
      ),
      badge(report ? (report.passed ? 'PASS' : 'BLOCKED') : 'not run', report ? (report.passed ? 'badge-fact' : 'badge-reject') : 'badge-neutral'),
    ),
    h('p', { class: 'lead' },
      'ตรวจการสะกด (คลังคำที่กำหนดไว้), ราคา, โปรโมชัน, ชื่อสินค้า, CTA และขอบเขตเฟสนี้'),
    h('div', { class: 'counts' },
      h('div', { class: 'count' }, h('span', { class: 'count-val', text: String(summary.PASS) }), h('span', { class: 'count-label', text: 'PASS' })),
      h('div', { class: 'count' }, h('span', { class: 'count-val', text: String(summary.WARN) }), h('span', { class: 'count-label', text: 'WARN' })),
      h('div', { class: 'count' }, h('span', { class: 'count-val', text: String(summary.FAIL) }), h('span', { class: 'count-label', text: 'FAIL' })),
    ),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy || !canRun,
        on: {
          click: () => run(async () => {
            const res = await api(`/api/mvp/content/${project.content_id}/qa`, 'POST');
            applyState(res.state);
            toast(`ตรวจแล้ว: PASS ${res.qa.summary.PASS} · WARN ${res.qa.summary.WARN} · FAIL ${res.qa.summary.FAIL}`); 
          }),
        },
      }, canRun ? 'รันตรวจภาษาไทย' : 'รันตรวจได้เฉพาะช่วง DRAFT / REVIEW'),
    ),
    report ? h('div', null,
      qaList('ข้อผิดพลาดที่ต้องแก้ (FAIL)', report.blocking),
      qaList('ข้อควรระวัง (WARN)', report.warnings),
      h('div', { class: 'table-scroll' },
        h('table', { class: 'mvp-table compact' },
          h('thead', null, h('tr', null, h('th', { text: 'หมวด' }), h('th', { text: 'PASS' }), h('th', { text: 'WARN' }), h('th', { text: 'FAIL' }))),
          h('tbody', null, Object.entries(report.by_category).map(([category, counts]) => h('tr', null,
            h('td', { class: 'mono', text: category }),
            h('td', { text: String(counts.PASS) }),
            h('td', { text: String(counts.WARN) }),
            h('td', { text: String(counts.FAIL) }),
          ))),
        ),
      ),
      h('p', { class: 'note', text: report.scope_note }),
    ) : null,
  );
}

function checklistTable(items) {
  return h('div', { class: 'table-scroll' },
    h('table', { class: 'mvp-table compact' },
      h('thead', null, h('tr', null, h('th', { text: 'รายการตรวจ' }), h('th', { text: 'ผล' }), h('th', { text: 'รายละเอียด' }))),
      h('tbody', null, items.map((item) => h('tr', null,
        h('td', { text: item.label }),
        h('td', null, badge(item.ok ? 'PASS' : 'ไม่ผ่าน', item.ok ? 'badge-fact' : 'badge-reject')),
        h('td', { class: 'cell-sub', text: item.detail }),
      ))),
    ),
  );
}

function renderFinalizeTab(project) {
  const checklist = project.finalize && project.finalize.checklist;
  const blockedChecklist = ui.error && ui.error.details && ui.error.details.checklist;
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'ตรวจก่อน export' }),
        h('h2', { text: checklist ? `Finalized · ${checklist.ok}/${checklist.total} ผ่าน` : 'รายการตรวจก่อนถึง FINALIZED' }),
      ),
      badge(project.status, CONTENT_STATUS_BADGE[project.status] || 'badge-neutral'),
    ),
    h('p', { class: 'lead' },
      'Finalize ต้องมี Preview ครบทุกฉาก และผ่านรายการตรวจทั้งหมด: ตรวจภาษาไทย, CTA, หลักฐาน, ความยาว, Script version และ IDs'),
    project.status === 'DRAFT' ? h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const res = await api(`/api/mvp/content/${project.content_id}/review`, 'POST');
            ui.error = null;
            applyState(res.state);
          }, 'ส่งเข้าการตรวจแล้ว (REVIEW) — รันตรวจภาษาไทยก่อน Finalize'),
        },
      }, 'ส่งตรวจ (DRAFT → REVIEW)'),
    ) : null,
    project.status === 'REVIEW' ? h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            await api(`/api/mvp/content/${project.content_id}/finalize`, 'POST');
            ui.error = null;
            toast('Finalize ผ่าน — พร้อม export');
          }),
        },
      }, 'Finalize (REVIEW → FINALIZED)'),
    ) : null,
    blockedChecklist ? h('div', null,
      h('p', { class: 'error-text', text: `ยัง finalize ไม่ได้: ${ui.error.message.replace(/^finalize blocked: /, '')}` }),
      checklistTable(blockedChecklist.items || []),
    ) : null,
    checklist ? checklistTable(checklist.items) : null,
  );
}

function renderExportTab(project) {
  const exp = project.export;
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'ไฟล์วิดีโอ' }),
        h('h2', { text: exp ? `${exp.filename} · v${exp.script_version}` : 'ยังไม่ได้ export' }),
      ),
      exp ? badge('9:16 · 1080×1920', 'badge-fact') : badge('BLOCKED', 'badge-neutral'),
    ),
    h('p', { class: 'lead' },
      'export ไฟล์ MP4 (H.264) แนวตั้ง 9:16 ด้วย ffmpeg ในเครื่องเท่านั้น — บทพูดไปอยู่ในคำบรรยายใต้ภาพ, เสียงเป็นฐานเงียบ'),
    project.status === 'FINALIZED' ? h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const res = await api(`/api/mvp/content/${project.content_id}/export`, 'POST');
            applyState(res.state);
            toast(`export สำเร็จ: ${res.export.filename} (${Math.round(res.export.bytes / 1024)} KB)`);
          }),
        },
      }, 'Export วิดีโอ 9:16'),
    ) : null,
    project.status !== 'FINALIZED' && !exp
      ? h('p', { class: 'warn', text: `ต้องผ่าน FINALIZED ก่อน (ปัจจุบัน ${project.status})` })
      : null,
    exp ? h('div', null,
      h('div', { class: 'content-media' },
        exp.still ? h('img', { src: `/api/mvp/content/${project.content_id}/export/still`, alt: 'ภาพตัวแทนเฟรมแรกของวิดีโอ' }) : null,
        h('video', {
          controls: true, preload: 'metadata',
          src: `/api/mvp/content/${project.content_id}/export/video`,
        }),
      ),
      h('dl', { class: 'kv' },
        h('div', null, h('dt', { text: 'ไฟล์' }), h('dd', { class: 'mono', text: exp.file })),
        h('div', null, h('dt', { text: 'ขนาด' }), h('dd', { text: `${Math.round(exp.bytes / 1024)} KB (${exp.width}×${exp.height} @ ${exp.fps}fps)` })),
        h('div', null, h('dt', { text: 'ความยาว' }), h('dd', { text: `${exp.duration_s}s` })),
        h('div', null, h('dt', { text: 'checksum' }), h('dd', { class: 'mono small', text: exp.sha256 })),
        h('div', null, h('dt', { text: 'pipeline' }), h('dd', { text: `${exp.pipeline} · font ${exp.font}` })),
        h('div', null, h('dt', { text: 'script' }), h('dd', { class: 'mono', text: `v${exp.script_version} · ${String(exp.script_checksum || '').slice(0, 12)}…` })),
      ),
      (exp.asset_refs || []).length ? h('p', { class: 'trace mono small', text: `assets: ${exp.asset_refs.map((a) => `${a.id}(${a.sha256.slice(0, 8)}…)`).join(', ')}` }) : null,
      h('ul', { class: 'limits' }, (exp.limitations || []).map((text) => h('li', { text }))),
    ) : null,
  );
}

function renderPublishTab(project) {
  const prep = project.publish_prep;
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'ข้อมูลพร้อมส่งต่อ (ไม่เผยแพร่จริง)' }),
        h('h2', { text: prep ? `พร้อมเผยแพร่ · ${prep.generated_at.slice(0, 16)}Z` : 'สร้างข้อมูลพร้อมเผยแพร่' }),
      ),
      badge('NOT_PUBLISHED', 'badge-mock'),
    ),
    h('p', { class: 'lead' },
      'สร้างแคปชัน แฮชแท็ก ข้อมูลสินค้า ไฟล์และรายการตรวจให้พร้อมส่งต่อ — ยังไม่มีการกดเผยแพร่ ไม่ได้เข้าสู่ระบบผู้ขาย ไม่มี external calls'),
    project.status === 'EXPORTED' ? h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const res = await api(`/api/mvp/content/${project.content_id}/publish-prep`, 'POST');
            applyState(res.state);
            toast('สร้างข้อมูลพร้อมเผยแพร่แล้ว — READY_TO_PUBLISH (ยังไม่ได้เผยแพร่จริง)');
          }),
        },
      }, 'สร้าง Publish Preparation'),
    ) : null,
    project.status !== 'EXPORTED' && !prep
      ? h('p', { class: 'warn', text: `ต้อง export สำเร็จก่อน (ปัจจุบัน ${project.status})` })
      : null,
    prep ? h('div', null,
      h('dl', { class: 'kv' },
        h('div', null, h('dt', { text: 'content_id' }), h('dd', { class: 'mono', text: prep.content_id })),
        h('div', null, h('dt', { text: 'product_id' }), h('dd', { class: 'mono', text: prep.product_id })),
        h('div', null, h('dt', { text: 'candidate_id' }), h('dd', { class: 'mono', text: prep.candidate_id })),
        h('div', null, h('dt', { text: 'shop_id' }), h('dd', { class: 'mono', text: prep.shop_id })),
        h('div', null, h('dt', { text: 'plan_id' }), h('dd', { class: 'mono', text: prep.plan_id || 'ไม่มีแผน' })),
        h('div', null, h('dt', { text: 'script' }), h('dd', { class: 'mono', text: `v${prep.script_version} · ${String(prep.script_checksum || '').slice(0, 12)}…` })),
      ),
      h('p', { class: 'sub-head' }, 'Caption draft'),
      h('pre', { class: 'caption-pre' }, prep.caption_draft),
      h('p', { class: 'trace mono small', text: (prep.hashtags || []).join(' ') }),
      h('p', { class: 'note', text: prep.disclosure }),
      prep.publish ? h('div', { class: 'boundary-box' },
        h('p', { class: 'boundary-title', text: 'Publish boundary' }),
        h('ul', { class: 'plain-list' },
          h('li', { text: `status: ${prep.publish.status}` }),
          h('li', { text: `executed: ${prep.publish.executed} · external_calls: ${prep.publish.external_calls} · spend: THB ${prep.publish.spend_thb}` }),
          h('li', { text: prep.publish.note }),
        ),
      ) : null,
      checklistTable((prep.checklist || []).map((item) => ({ ...item, ok: item.ok }))),
      h('p', { class: 'sub-head' }, 'ขั้นตอนต่อไปสำหรับคน'),
      h('ul', { class: 'plain-list' }, (prep.next_steps_for_a_human || []).map((text) => h('li', { text }))),
    ) : null,
  );
}

function renderContentIdentity(project) {
  const snap = project.offer_snapshot || {};
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'ข้อมูลอ้างอิงและ IDs' }),
        h('h2', { text: snap.product_name || project.content_id }),
      ),
      badge(snap.synthetic === false ? 'ผู้ใช้กรอก' : 'SYNTHETIC', 'badge-mock'),
    ),
    h('dl', { class: 'kv compact' },
      h('div', null, h('dt', { text: 'content_id' }), h('dd', { class: 'mono', text: project.content_id })),
      h('div', null, h('dt', { text: 'product_id' }), h('dd', { class: 'mono', text: project.product_id })),
      h('div', null, h('dt', { text: 'candidate_id' }), h('dd', { class: 'mono', text: project.candidate_id })),
      h('div', null, h('dt', { text: 'offer_id' }), h('dd', { class: 'mono', text: project.offer_id })),
      h('div', null, h('dt', { text: 'shop_id' }), h('dd', { class: 'mono', text: project.shop_id })),
      h('div', null, h('dt', { text: 'plan_id' }), h('dd', { class: 'mono', text: project.plan_id || '—' })),
      h('div', null, h('dt', { text: 'item/shop' }), h('dd', { class: 'mono', text: `${snap.item_id} · ${snap.shop_name || ''}` })),
      h('div', null, h('dt', { text: 'ราคา' }), h('dd', { text: `THB ${snap.price_thb} (ปกติ THB ${snap.list_price_thb})` })),
      h('div', null, h('dt', { text: 'โปรโมชัน' }), h('dd', { text: snap.promo ? snap.promo.label : '—' })),
      h('div', null, h('dt', { text: 'รีวิว' }), h('dd', { text: `${snap.rating}/5 · ${snap.rating_count} รีวิว` })),
      h('div', null, h('dt', { text: 'script' }), h('dd', { class: 'mono', text: `v${project.script_version}` })),
      h('div', null, h('dt', { text: 'อัปเดต' }), h('dd', { text: fmtDate(project.updated_at) })),
    ),
  );
}

function renderContentProject(project) {
  const wrap = h('div', { class: 'stack' });
  wrap.append(h('section', { class: 'mvp-card plan-record' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Content project' }),
        h('h2', { text: `${project.content_id} · ${CONTENT_STATUS_TEXT[project.status] || project.status}` }),
      ),
      badge(project.status, CONTENT_STATUS_BADGE[project.status] || 'badge-neutral'),
    ),
    h('div', { class: 'status-rail' }, CONTENT_STATUSES.map((status) => h('div', {
      class: `status-step${status === project.status ? ' is-current' : CONTENT_STATUSES.indexOf(status) < CONTENT_STATUSES.indexOf(project.status) ? ' is-done' : ''}`,
    }, h('span', { class: 'status-dot' }), h('span', { class: 'status-label', text: status })))),
  ));
  wrap.append(renderContentIdentity(project));
  wrap.append(h('nav', { class: 'content-tabs', 'aria-label': 'Content tabs' },
    CONTENT_TABS.map((tab) => h('button', {
      type: 'button',
      class: `content-tab${ui.contentTab === tab.key ? ' is-active' : ''}`,
      disabled: ui.busy,
      on: { click: () => { ui.contentTab = tab.key; render(); } },
    }, tab.label)),
  ));
  const section = renderers[ui.contentTab] || renderStoryboardTab;
  wrap.append(section(project));
  return wrap;
}

function renderContentCreate() {
  const state = ui.state;
  const plans = (state.plans || []);
  const eligible = eligibleCandidates();
  const sources = [
    ...plans.map((plan) => ({
      value: `plan:${plan.plan_id}`,
      label: `PLAN ${plan.plan_id} · ${APPROACH_LABEL[plan.approach] || plan.approach} · ${plan.candidate_id}`,
    })),
    ...eligible.map((candidate) => ({
      value: `cand:${candidate.id}`,
      label: `CAND ${candidate.id} · ${candidate.title} · ${candidate.status}`,
    })),
  ];
  if (!sources.length) return null;
  if (!ui.contentSource || !sources.some((option) => option.value === ui.contentSource)) {
    ui.contentSource = sources[0].value;
  }
  const approach = ui.contentApproach;
  const isCustom = approach === 'user_custom';
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'สร้าง Content ใหม่' }),
        h('h2', { text: 'เริ่มจากแผนหรือผู้สมัครที่เลือกไว้' }),
      ),
      badge('fixture state only', 'badge-neutral'),
    ),
    h('p', { class: 'lead' },
      'ระบบจะสร้าง Storyboard 5 ฉาก บทพูดภาษาไทย และ CTA จากข้อมูลสินค้าและหลักฐานที่เลือกไว้'),
    h('div', { class: 'field inline' },
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'ต้นทาง' }),
        h('select', {
          on: { change: (event) => { ui.contentSource = event.target.value; } },
        }, sources.map((option) => h('option', {
          value: option.value,
          text: option.label,
          selected: option.value === ui.contentSource,
        }))),
      ),
    ),
    h('div', { class: 'approach-grid' }, CONTENT_APPROACHES.map((option) =>
      h('label', { class: `approach${approach === option.key ? ' is-selected' : ''}` },
        h('div', { class: 'approach-head' },
          h('input', {
            type: 'radio', name: 'new-content-approach', value: option.key,
            checked: approach === option.key,
            on: { change: () => { ui.contentApproach = option.key; render(); } },
          }),
          h('p', { class: 'approach-label', text: option.label }),
        ),
        isCustom && option.key === 'user_custom'
          ? h('p', { class: 'cell-sub', text: 'จะเปิดฟอร์มให้กรอกมุมมองเองหลังสร้าง' })
          : h('p', { class: 'cell-sub', text: 'สร้างจากหลักฐานในไฟล์ส่งออก' }),
      ))),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const [kind, id] = ui.contentSource.split(':');
            const body = { approach: ui.contentApproach };
            if (kind === 'plan') body.planId = id;
            else body.candidateId = id;
            const res = await api('/api/mvp/content/draft', 'POST', body);
            ui.contentId = res.project.content_id;
            ui.sceneId = res.project.storyboard.scenes[0].id;
            ui.contentTab = 'storyboard';
            ui.contentNew = false;
            contentDrafts = {};
            applyState(res.state);
          }, 'สร้าง Content แล้ว'),
        },
      }, 'สร้าง Content'),
    ),
    ui.error ? h('p', { class: 'error-text', text: ui.error.message }) : null,
  );
}

const renderers = {
  storyboard: renderStoryboardTab,
  preview: renderPreviewTab,
  qa: renderQaTab,
  finalize: renderFinalizeTab,
  export: renderExportTab,
  publish: renderPublishTab,
};

function renderContent() {
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });
  if (!state || !state.import) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'Import and generate candidates first' })),
      h('p', null, h('button', { type: 'button', class: 'link-btn', on: { click: () => go('import') } }, 'Go to import →')),
    ));
    return wrap;
  }
  const existing = allContents();
  if (ui.contentNew || !existing.length) {
    const create = renderContentCreate();
    if (create) wrap.append(create);
  }
  if (existing.length) {
    const project = openContent();
    if (project) wrap.append(renderContentProject(project));
    wrap.append(h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
        on: { click: () => { ui.contentNew = true; contentDrafts = {}; render(); } },
      }, 'สร้าง Content อีกรายการ'),
      existing.length > 1 ? h('select', {
        on: { change: (event) => { ui.contentId = event.target.value; ui.contentNew = false; contentDrafts = {}; applyState(ui.state); } },
      }, existing.map((item) => h('option', {
        value: item.content_id,
        text: `${item.content_id} · ${item.status} · ${item.offer_snapshot ? item.offer_snapshot.product_name : ''}`,
        selected: item.content_id === ui.contentId,
      }))) : null,
    ));
  }
  return wrap;
}

/* ---------- Content Library ---------- */

async function loadLibrary() {
  if (ui.library.loading) return;
  ui.library.loading = true;
  ui.library.error = null;
  if (ui.section === 'library') render();
  try {
    const res = await api('/api/mvp/library');
    ui.library.items = res.items || [];
    ui.library.counts = res.counts || null;
    ui.library.meta = res;
  } catch (err) {
    ui.library.error = err.message;
    ui.library.items = [];
  } finally {
    ui.library.loading = false;
    if (ui.section === 'library') render();
  }
}

function libraryEntryTitle(item) {
  const entry = item.entry || {};
  return entry.filename || entry.id || '(record without an id)';
}

function renderLibraryItem(item) {
  const entry = item.entry || {};
  const file = item.file || {};
  const integrity = LIBRARY_INTEGRITY[file.integrity]
    || { label: file.integrity || 'UNKNOWN', kind: 'badge-neutral' };
  const known = new Set(((ui.state && ui.state.contents) || []).map((c) => c.content_id));
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: `export · ${entry.kind || 'VIDEO'}` }),
        h('h2', { text: libraryEntryTitle(item) }),
      ),
      badge(integrity.label, integrity.kind),
    ),
    h('dl', { class: 'kv compact' },
      h('div', null, h('dt', { text: 'content_id' }), h('dd', { class: 'mono', text: entry.id || '—' })),
      h('div', null, h('dt', { text: 'เวลา export' }), h('dd', { text: entry.exported_at ? fmtDate(entry.exported_at) : '—' })),
      h('div', null, h('dt', { text: 'ขนาดบนดิสก์' }), h('dd', { text: file.bytes === null || file.bytes === undefined ? 'ไม่มีไฟล์' : `${Math.round(file.bytes / 1024)} KB` })),
      h('div', null, h('dt', { text: 'รูปแบบ' }), h('dd', { text: entry.width && entry.height ? `${entry.width}×${entry.height} · ${entry.aspect_ratio || '9:16'} · ${entry.duration_s || '—'}s` : '—' })),
      h('div', null, h('dt', { text: 'sha256 ที่บันทึก' }), h('dd', { class: 'mono small', text: entry.sha256 || '—' })),
      h('div', null, h('dt', { text: 'sha256 บนดิสก์' }), h('dd', { class: 'mono small', text: file.sha256 || '—' })),
    ),
    h('div', { class: 'toolbar' },
      file.integrity === 'VERIFIED'
        ? h('a', {
          class: 'btn btn-primary',
          href: `/api/mvp/library/${encodeURIComponent(entry.id)}/file`,
          download: entry.filename,
        }, 'ดาวน์โหลด MP4')
        : h('span', { class: 'warn', text: 'ไฟล์ไม่ผ่านการตรวจ — ปิดการดาวน์โหลดจนกว่าจะแก้ไข' }),
      known.has(entry.id) ? h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
        on: {
          click: () => {
            ui.contentId = entry.id;
            ui.contentNew = false;
            ui.contentTab = 'export';
            go('content');
          },
        },
      }, 'เปิดใน Content') : h('span', { class: 'mono small', text: 'project ไม่ได้อยู่ใน state ปัจจุบัน' }),
    ),
  );
}

function renderLibrary() {
  const lib = ui.library;
  const wrap = h('div', { class: 'stack' });
  const clean = lib.counts && lib.counts.VERIFIED > 0
    && !lib.counts.MISMATCH && !lib.counts.MISSING && !lib.counts.UNREADABLE;
  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Content Library · store & retrieve' }),
        h('h2', { text: 'ไฟล์ที่ export แล้วทั้งหมด' }),
      ),
      lib.counts
        ? badge(`${lib.counts.VERIFIED} VERIFIED · ${lib.counts.MISMATCH} MISMATCH · ${lib.counts.MISSING} MISSING`, clean ? 'badge-fact' : 'badge-neutral')
        : null,
    ),
    h('p', { class: 'lead' },
      'ดัชนีกลางของไฟล์ที่ export แล้ว — ทุกครั้งที่เปิดหน้านี้ ระบบจะเทียบ sha256 กับไฟล์จริงบนดิสก์ จึงเห็น MISSING หรือ MISMATCH ได้ทันที'),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy || lib.loading,
        on: { click: () => loadLibrary() },
      }, lib.loading ? 'กำลังโหลด…' : 'โหลดใหม่ / ตรวจสอบ hash'),
    ),
    lib.meta
      ? h('p', { class: 'trace mono small', text: `index: ${lib.meta.library_file} · exports: ${lib.meta.exports_root}` })
      : null,
  ));
  if (lib.error) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'อ่าน Content Library ไม่ได้' })),
      h('p', { class: 'error-text', text: lib.error }),
    ));
    return wrap;
  }
  if (lib.items === null) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: lib.loading ? 'กำลังโหลดรายการ…' : 'ยังไม่ได้โหลดรายการ' })),
      lib.loading ? null : h('p', null, h('button', {
        type: 'button', class: 'link-btn', on: { click: () => loadLibrary() },
      }, 'โหลด Content Library →')),
    ));
    return wrap;
  }
  if (!lib.items.length) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'ยังไม่มีไฟล์ใน Content Library' })),
      h('p', null, 'export วิดีโอจากแท็บ Export ของ Content project แล้วรายการจะปรากฏที่นี่'),
      h('p', null, h('button', {
        type: 'button', class: 'link-btn', on: { click: () => go('content') },
      }, 'ไปที่ Content →')),
    ));
    return wrap;
  }
  for (const item of lib.items) wrap.append(renderLibraryItem(item));
  return wrap;
}

/* ---------- Render ---------- */

function renderDataChip() {
  if (!els.dataChip) return;
  const state = ui.state;
  const staged = ui.staging || [];
  const synthetic = state ? state.synthetic !== false : true;
  let text;
  if (!state || !state.import) {
    text = staged.length
      ? `${staged.length} STAGED FILE${staged.length === 1 ? '' : 'S'} — not yet in Research`
      : 'SYNTHETIC FIXTURE — not Shopee data';
  } else if (synthetic) {
    text = 'SYNTHETIC FIXTURE — not Shopee data';
  } else {
    text = 'USER-SUPPLIED EXPORT — not verified against Shopee';
  }
  els.dataChip.textContent = `● ${text}`;
  els.dataChip.classList.toggle('is-real', Boolean(state && state.import && state.synthetic === false));
}

function render() {
  renderNav();
  renderDataChip();
  els.eyebrow.textContent = ui.section === 'import'
    ? 'MVP slice · export staging'
    : `MVP slice · ${SECTIONS.find((s) => s.key === ui.section).label}`;
  els.title.textContent = {
    import: 'Import the affiliate export',
    research: 'Research records and evidence',
    candidates: 'Candidate workspace',
    plan: 'Plan and impact preview',
    content: 'Content creation and export',
    library: 'Content Library',
  }[ui.section];
  els.save.textContent = ui.busy
    ? 'Working…'
    : ui.state
      ? `${ui.state.data_mode === 'STAGED_IMPORT' ? 'staged' : 'fixture'} ${ui.state.import ? ui.state.import.id : 'not imported'}`
      : 'Loading…';
  clear(els.body);
  const section = ui.section;
  if (section === 'import') els.body.append(renderImport());
  else if (section === 'research') els.body.append(renderResearch());
  else if (section === 'candidates') els.body.append(renderCandidates());
  else if (section === 'content') els.body.append(renderContent());
  else if (section === 'library') els.body.append(renderLibrary());
  else els.body.append(renderPlan());
}

/* ---------- Boot ---------- */

(async () => {
  try {
    const [meta, state] = await Promise.all([api('/api/mvp/meta'), api('/api/mvp/state')]);
    ui.meta = meta;
    applyState(state);
    await refreshStaging().catch(() => { ui.staging = []; });
    ui.section = state.import
      ? (state.summary.candidates ? 'candidates' : 'research')
      : 'import';
    render();
  } catch (err) {
    ui.error = { message: err.message, details: null };
    render();
    toast(err.message, true);
  }
})();
