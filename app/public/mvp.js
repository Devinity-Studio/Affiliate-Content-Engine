'use strict';

/**
 * ACE — MVP affiliate workflow slice client.
 *
 * Talks only to /api/mvp/*, which owns fixture state. It never posts to the
 * Plan Version or CWI endpoints, so a demo cannot change data/app/state.json.
 */

// The dashboard follows the order the work actually happens in. Import is gone:
// the pool is the system's own data, not an upload step.
// One core workflow, six isolated stages. Each stage shows only its own tools.
const SECTIONS = [
  { key: 'profile', label: 'Profile & Channels', hint: 'แพลตฟอร์ม · ช่องทาง · สถานะ AI' },
  { key: 'research', label: 'Research & Candidate Pool', hint: 'วิเคราะห์ · คัด 5 รายการ' },
  { key: 'plan', label: 'Plan & AI Video', hint: 'Hook · Action · Payoff · CTA' },
  { key: 'production', label: 'Production & Finalize', hint: 'สตอรี่บอร์ด · เสียง · QC · Export' },
  { key: 'schedule', label: 'Schedule & Task', hint: 'ปฏิทิน · คิว · Library' },
  { key: 'analytics', label: 'Analytics', hint: 'รายได้ · อันดับคอนเทนต์' },
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
  section: 'profile',
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
  draftReviewConfirmed: false,
  draftReviewBy: 'Owner',
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
  trace: { candidateId: null, data: null, loading: false, error: null },
  plan: null,
  analytics: { data: null, loading: false, error: null, profileFilter: null },
  analyticsForm: null,
  profileForm: null,
  scheduleProfileId: null,
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
  const contents = state.contents || [];
  if (key === 'profile') {
    const active = state.active_profile;
    if (!active) return 'ยังไม่มีโปรไฟล์';
    return `${active.platform_label || active.platform} · ${active.counts ? active.counts.contents : 0} งาน`;
  }
  if (key === 'research') {
    const offers = state.summary ? state.summary.offers : 0;
    const pool = state.summary ? state.summary.candidates : 0;
    if (!offers) return 'ยังไม่มีข้อมูล';
    return pool ? `${offers} offers · ${pool} candidates` : `${offers} offers`;
  }
  if (key === 'production') {
    if (ui.contentId) {
      const open = contents.find((c) => c.content_id === ui.contentId);
      if (open) return `${open.content_id} · ${open.status}`;
    }
    return contents.length ? `${contents.length} project(s)` : 'ยังไม่มีคอนเทนต์';
  }
  if (key === 'plan') {
    return contents.length ? `${contents.length} คอนเทนต์ · 4 ช่วง` : 'ยังไม่มีคอนเทนต์';
  }
  if (key === 'schedule') {
    const scheduled = contents.filter((c) => c.publish_schedule);
    const queued = scheduled.filter((c) => c.publish_schedule.status === 'QUEUED');
    if (!scheduled.length) return 'ยังไม่มีกำหนดการ';
    return queued.length ? `${queued.length} รออนุมัติ` : `${scheduled.length} ในคิว`;
  }
  const published = contents.filter((c) => c.publish_schedule && c.publish_schedule.status === 'PUBLISHED');
  return published.length ? `${published.length} เผยแพร่แล้ว` : 'ยังไม่มีผลลัพธ์';
}

// Next step in the pipeline: where the work actually is right now.
function nextSection() {
  const state = ui.state;
  const contents = (state && state.contents) || [];
  if (!state || !state.summary || !state.summary.candidates) return 'research';
  if (!contents.length) return 'production';
  if (!contents.some((c) => c.publish_schedule)) return 'schedule';
  return 'analytics';
}

function go(section) {
  ui.section = section;
  ui.error = null;
  if (section !== 'research' && ui.trace.candidateId) {
    ui.trace = { candidateId: null, data: null, loading: false, error: null };
  }
  if (SECTION_CONTENT_TAB[section]) ui.contentTab = SECTION_CONTENT_TAB[section];
  render();
  if (section === 'schedule' && ui.library.items === null && !ui.library.loading) loadLibrary();
  // The Plan stage fetches its own view model once, so there is a single load
  // path (and no duplicate request) whether it was opened from the nav or after
  // creating a content item inside it.
  if (section === 'analytics' && !(ui.analytics && ui.analytics.data) && !(ui.analytics && ui.analytics.loading)) loadAnalytics(null);
  if ((section === 'profile' || section === 'research') && !(ui.ai && ui.ai.status) && !(ui.ai && ui.ai.loading)) loadAiStatus();
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
  const contents = (ui.state && ui.state.contents) || [];
  const done = [
    Boolean(ui.state && ui.state.active_profile),
    Boolean(ui.state && ui.state.summary && ui.state.summary.candidates),
    contents.length > 0,
    contents.some((c) => ['FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH'].includes(c.status)),
    contents.some((c) => c.publish_schedule && c.publish_schedule.status !== 'CANCELLED'),
    contents.some((c) => c.publish_schedule && c.publish_schedule.status === 'PUBLISHED'),
  ].filter(Boolean).length;
  els.progress.textContent = `${done} / ${SECTIONS.length}`;
}

async function generateFromResearch(acknowledgeExpired = false) {
  ui.expiredContext = 'generate';
  const res = await api('/api/mvp/candidates/generate', 'POST', { acknowledgeExpired });
  applyState(res.state);
  ui.section = 'research';
  ui.selectedCandidateId = res.candidates[0] ? res.candidates[0].id : null;
}

async function synthesizeThaiVoiceover(contentId, force) {
  const res = await api(`/api/mvp/content/${contentId}/voiceover`, 'POST', force ? { force: true } : {});
  applyState(res.state);
  const failed = res.failures || [];
  if (failed.length) {
    throw new Error(`สร้างเสียงได้ ${(res.scenes || []).length} ฉาก แต่ล้มเหลว ${failed.length} ฉาก `
      + `(${failed[0].scene_id}) — กดอีกครั้งเพื่อลองเฉพาะฉากที่เหลือ`);
  }
  return res;
}

async function retryExpired() {
  const context = ui.expiredContext;
  ui.expiredWarning = null;
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
  go('research');
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
      h('div', { class: 'notice-head' }, h('h2', { text: 'ยังไม่มีข้อมูลพูลสินค้า' })),
      h('p', null, 'ข้อมูลพูลยังว่าง — ', h('button', { type: 'button', class: 'link-btn', on: { click: () => go('research') } }, 'ไปที่ Research →')),
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
        click: () => run(() => generateFromResearch(false), 'สร้าง 5 แคนดิเดตจากข้อมูลพูลแล้ว'),
      },
    }, state.summary.candidates ? 'Regenerate 5 candidates' : 'Generate 5 candidates'),
    h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => go('research') } }, 'Open candidates →'),
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
        class: 'btn',
        on: { click: () => openTrace(candidate.id) },
        title: 'ดูเส้นทางชีวิตของรายการนี้ตั้งแต่ Research ถึงไฟล์ที่ export',
      }, 'ไทม์ไลน์ →'),
      h('button', {
        type: 'button',
        class: 'btn btn-ghost',
        disabled: candidate.status !== 'SAVED' && candidate.status !== 'QUEUED',
        title: candidate.status === 'SAVED' || candidate.status === 'QUEUED' ? 'Create a plan draft from this candidate' : 'Save or queue the candidate first',
        on: {
          click: () => {
            ui.selectedCandidateId = candidate.id;
            ui.createdPlan = null;
            ui.contentNew = true;
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
      h('div', { class: 'notice-head' }, h('h2', { text: 'ยังไม่มีข้อมูลพูลสินค้า' })),
      h('p', null, h('button', { type: 'button', class: 'link-btn', on: { click: () => go('research') } }, 'ไปที่ Research →')),
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
            go('production');
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
      h('div', { class: 'notice-head' }, h('h2', { text: 'ยังไม่มีแคนดิเดตในพูล' })),
      h('p', null, h('button', { type: 'button', class: 'link-btn', on: { click: () => go('research') } }, 'ไปที่ Research →')),
    ));
    return wrap;
  }

  const eligible = eligibleCandidates();
  if (ui.createdPlan) wrap.append(renderCreatedPlan(ui.createdPlan));

  if (!eligible.length) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'No selected candidate' })),
      h('p', { text: 'Save a candidate or add it to the queue first — a plan is only created from a selected candidate.' }),
      h('p', null, h('button', { type: 'button', class: 'link-btn', on: { click: () => go('research') } }, 'Open candidates →')),
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
        on: { click: () => go('research') },
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
  const scriptText = project.script && typeof project.script.text === 'string' ? project.script.text : '';
  const scriptChecksum = project.script && typeof project.script.checksum === 'string' ? project.script.checksum : null;
  const scriptSource = project.script && typeof project.script.source === 'string' ? project.script.source : null;
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
    project.status === 'REVIEW' ? h('div', null,
      h('div', { class: 'mvp-card' },
        h('div', { class: 'card-head' },
          h('div', null,
            h('p', { class: 'eyebrow', text: 'Human-in-the-loop' }),
            h('h2', { text: 'อ่านบทพูดภาษาไทยด้วยตาก่อนยืนยัน' }),
          ),
          badge(scriptSource === 'LIVE_LLM' ? 'LIVE_LLM' : 'TEMPLATE', scriptSource === 'LIVE_LLM' ? 'badge-fact' : 'badge-neutral'),
        ),
        h('p', { class: 'lead', text: 'ระบบจะไม่ยอมเปลี่ยนสถานะเป็น FINALIZED จนกว่าจะยืนยันว่าอ่านบทนี้ด้วยตาแล้ว และการยืนยันผูกกับ checksum ของบท ถ้าบทเปลี่ยนหลังจากนี้ต้องยืนยันใหม่' }),
        h('p', { class: 'mono small', text: scriptText || '(ไม่มีบทพูด)' }),
        h('p', { class: 'note', text: `checksum: ${scriptChecksum || '-'}` }),
        h('label', { class: 'check-row' },
          h('input', {
            id: 'draft-review-confirm', type: 'checkbox', checked: ui.draftReviewConfirmed,
            on: { change: (event) => { ui.draftReviewConfirmed = event.target.checked; } },
          }),
          h('span', { text: 'ข้าพเจ้าได้อ่านบทพูดภาษาไทยข้างต้นด้วยตาทั้งหมดแล้ว' }),
        ),
        h('div', { class: 'field-grid' },
          h('label', { class: 'field' },
            h('span', { class: 'field-label', text: 'ผู้ตรวจรับ' }),
            h('input', {
              id: 'draft-review-by', type: 'text', value: ui.draftReviewBy || '',
              on: { input: (event) => { ui.draftReviewBy = event.target.value; } },
            }),
          ),
        ),
        h('div', { class: 'toolbar' },
          h('button', {
            type: 'button', class: 'btn btn-primary',
            disabled: ui.busy || !ui.draftReviewConfirmed || String(ui.draftReviewBy || '').trim() === '',
            on: {
              click: () => run(async () => {
                const res = await api(`/api/mvp/content/${project.content_id}/finalize`, 'POST', {
                  draft_review: {
                    confirmed: true,
                    reviewed_by: String(ui.draftReviewBy || '').trim(),
                    script_checksum: scriptChecksum,
                  },
                });
                ui.error = null;
                ui.draftReviewConfirmed = false;
                applyState(res.state);
              }, 'Finalize ผ่าน — พร้อม export'),
            },
          }, 'ยืนยันตรวจรับแล้ว Finalize (REVIEW → FINALIZED)'),
        ),
      ),
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
  // Each pipeline step shows only the tools it owns, so the screen matches the
  // stage instead of repeating every tab everywhere.
  const allowed = SECTION_CONTENT_TABS[ui.section] || CONTENT_TABS.map((tab) => tab.key);
  const tabs = CONTENT_TABS.filter((tab) => allowed.includes(tab.key));
  const activeTab = tabs.some((tab) => tab.key === ui.contentTab) ? ui.contentTab : tabs[0].key;
  wrap.append(renderContentIdentity(project));
  if (ui.section === 'production') wrap.append(renderVoiceoverPanel(project));
  if (ui.section === 'production') wrap.append(renderRevisePanel(project));
  if (ui.section === 'schedule') wrap.append(renderPublishPanel(project));
  wrap.append(h('nav', { class: 'content-tabs', 'aria-label': 'Content tabs' },
    tabs.map((tab) => h('button', {
      type: 'button',
      class: `content-tab${activeTab === tab.key ? ' is-active' : ''}`,
      disabled: ui.busy,
      on: { click: () => { ui.contentTab = tab.key; render(); } },
    }, tab.label)),
  ));
  const section = renderers[activeTab] || renderStoryboardTab;
  wrap.append(section(project));
  return wrap;
}

/* ---------- Mini loop: targeted revision ---------- */

const REVISE_TARGET_LABEL = {
  HOOK: 'Hook (ฉากแรก)',
  SCENE_TEXT: 'บท/ตัวหนังสือของฉาก',
  SCENE_VISUAL: 'ภาพ/จังหวะของฉาก',
};

// The form is read synchronously: run() re-renders the panel to show the busy
// state, which rebuilds these inputs and would otherwise discard what the human
// just typed.
function collectRevisionPayload() {
  const target = document.getElementById('revise-target').value;
  const sceneId = document.getElementById('revise-scene').value;
  const payload = { target };
  if (target !== 'HOOK') payload.scene_id = sceneId;
  if (target === 'HOOK') {
    payload.text = document.getElementById('revise-text').value;
    payload.speak = document.getElementById('revise-speak').checked;
  } else if (target === 'SCENE_TEXT') {
    const headline = document.getElementById('revise-text').value.trim();
    const voice = document.getElementById('revise-voice').value.trim();
    if (headline) payload.headline = headline;
    if (voice) payload.voiceover = voice;
    if (!headline && !voice) throw new Error('ใส่ข้อความหรือบทพูดของฉากที่จะแก้ก่อน');
  } else {
    const preset = document.getElementById('revise-preset').value;
    const duration = document.getElementById('revise-duration').value.trim();
    if (preset) payload.preset = preset;
    if (duration) payload.duration_s = Number(duration);
    if (!preset && !duration) throw new Error('เลือกภาพหรือใส่ความยาวฉากใหม่ก่อน');
  }
  return payload;
}

async function applyRevision(project, payload) {
  const res = await api(`/api/mvp/content/${project.content_id}/revise`, 'POST', payload);
  ui.lastRevision = res;
  applyState(res.state);
  return res;
}

function renderRevisePanel(project) {
  const scenes = (project.storyboard && project.storyboard.scenes) || [];
  const locked = project.status === 'READY_TO_PUBLISH'
    || (project.publish_schedule && project.publish_schedule.status === 'PUBLISHED');
  const wrap = h('div', { class: 'stack' });

  const form = h('div', { class: 'toolbar' },
    h('label', { class: 'small' }, 'แก้เฉพาะ ',
      h('select', { id: 'revise-target' },
        h('option', { value: 'HOOK' }, REVISE_TARGET_LABEL.HOOK),
        h('option', { value: 'SCENE_TEXT' }, REVISE_TARGET_LABEL.SCENE_TEXT),
        h('option', { value: 'SCENE_VISUAL' }, REVISE_TARGET_LABEL.SCENE_VISUAL))),
    h('label', { class: 'small' }, ' ฉาก ',
      h('select', { id: 'revise-scene' }, scenes.map((scene, index) =>
        h('option', { value: scene.id }, `#${index + 1} ${scene.id}`)))),
  );
  const fields = h('div', { class: 'stack' },
    h('label', { class: 'small' }, 'Hook / ตัวหนังสือฉากใหม่',
      h('input', { type: 'text', id: 'revise-text', placeholder: 'เช่น 3 อย่างที่ต้องดู ก่อนซื้อกระเป๋าใบนี้' })),
    h('label', { class: 'small' },
      h('input', { type: 'checkbox', id: 'revise-speak', checked: true }),
      ' ให้พากย์เสียงตามข้อความใหม่ (เฉพาะฉากนี้)'),
    h('label', { class: 'small' }, 'บทพากย์ของฉาก (เว้นว่าง = ไม่แตะเสียง)',
      h('textarea', { id: 'revise-voice', rows: 2, placeholder: 'แก้เฉพาะประโยคที่ต้องการ' })),
    h('div', { class: 'toolbar' },
      h('label', { class: 'small' }, 'ภาพ/โทนฉาก ',
        h('select', { id: 'revise-preset' },
          h('option', { value: '' }, '(ไม่เปลี่ยน)'),
          h('option', { value: 'dark' }, 'dark'),
          h('option', { value: 'warm' }, 'warm'),
          h('option', { value: 'cool' }, 'cool'),
          h('option', { value: 'light' }, 'light'))),
      h('label', { class: 'small' }, ' ความยาวฉาก (วินาที) ',
        h('input', { type: 'number', id: 'revise-duration', min: '1.5', max: '12', step: '0.5' })),
    ),
    h('button', {
      type: 'button', class: 'btn btn-primary', disabled: ui.busy || locked,
      on: {
        click: () => {
          let payload = null;
          try {
            payload = collectRevisionPayload();
          } catch (err) {
            ui.error = { message: err.message };
            render();
            return;
          }
          run(() => applyRevision(project, payload), 'แก้เฉพาะจุดแล้ว — เรนเดอร์ใหม่เฉพาะฉากที่แก้');
        },
      },
    }, 'Revise (แก้ไขเฉพาะจุด)'),
    h('p', { class: 'note' }, 'ระบบจะเขียนทับเฉพาะเลเยอร์ที่เลือก ฉากอื่นยังใช้เสียงและภาพเดิม '
      + 'และบังคับให้ finalize ใหม่เพราะการอนุมัติผูกกับ checksum ของสคริปต์'),
  );

  const last = ui.lastRevision && ui.lastRevision.project && ui.lastRevision.project.content_id === project.content_id
    ? ui.lastRevision
    : null;
  let resultBlock = null;
  if (last) {
    const clip = last.clip && last.clip.file
      ? h('div', null,
        h('p', { class: 'note', text: `เรนเดอร์ใหม่: ${last.clip.scene_ids.join(', ')} · `
          + `${Number(last.clip.duration_s || 0).toFixed(1)}s · ${last.clip.width}x${last.clip.height} · v${last.clip.script_version}` }),
        h('a', {
          class: 'btn btn-primary',
          href: `/api/mvp/content/${project.content_id}/revise/file?name=${encodeURIComponent(last.clip.file_name || '')}`,
          target: '_blank', rel: 'noreferrer',
        }, 'เปิดวิดีโอที่เรนเดอร์ใหม่ (เต็มจอ)'))
      : h('p', { class: 'note', text: `เรนเดอร์ใหม่ไม่สำเร็จ: ${(last.clip && last.clip.error) || 'unknown error'}` });
    const voiceNote = !last.voice
      ? null
      : last.voice.error
        ? h('p', { class: 'note', text: `เสียง: ${last.voice.error}` })
        : h('p', { class: 'note', text: `เสียงที่สังเคราะห์ใหม่: ${(last.voice.scenes || []).map((scene) => scene.scene_id || scene.id).join(', ') || 'ไม่มี'}` });
    resultBlock = h('section', { class: 'mvp-card' },
      h('div', { class: 'card-head' },
        h('div', null,
          h('p', { class: 'eyebrow', text: 'Mini Loop · ผลลัพธ์' }),
          h('h2', { text: `${REVISE_TARGET_LABEL[last.revision.target] || last.revision.target}${last.revision.scene_id ? ` · ${last.revision.scene_id}` : ''}` }),
        ),
        badge(last.revision.reopened_finalize ? 'กลับไป REVIEW' : `v${last.revision.script_version_after}`,
          last.revision.reopened_finalize ? 'badge-reject' : 'badge-neutral'),
      ),
      last.revision.reopened_finalize
        ? h('p', { class: 'note' }, 'งานนี้เคย finalize แล้ว — การแก้ทำให้ approval เดิมถูกแทนที่ '
          + 'ต้องตรวจแล้วกด Finalize ใหม่ (ประวัติเดิมยังอยู่ใน revisions)')
        : null,
      clip, voiceNote,
    );
  }

  const history = (project.revisions || []).slice(-4).reverse();
  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Mini Loop · Targeted Revision' }),
        h('h2', { text: 'แก้เฉพาะจุด แล้วเรนเดอร์เฉพาะซีนที่แก้' }),
      ),
      h('div', { class: 'head-meta' },
        badge(`${(project.revisions || []).length} revisions`, 'badge-neutral'),
        badge(`script v${project.script_version}`, 'badge-neutral'),
      ),
    ),
    locked
      ? h('p', { class: 'note' }, 'คอนเทนต์นี้ถูกจัดคิว/เผยแพร่แล้ว — Revision ปิด เพื่อไม่ให้ artifact ที่เผยแพร่แล้วเพี้ยน')
      : null,
    locked ? null : h('div', { class: 'stack' }, form, fields),
    history.length === 0
      ? h('p', { class: 'note' }, 'ยังไม่มี Revision — ทุกอย่างยังเป็นเวอร์ชันแรก')
      : h('ul', { class: 'list' }, history.map((revision) => h('li', { class: 'cell' },
        h('div', null,
          h('p', { class: 'cell-title', text: `${REVISE_TARGET_LABEL[revision.target] || revision.target}${revision.scene_id ? ` · ${revision.scene_id}` : ''}` }),
          h('p', { class: 'cell-sub', text: `${new Date(revision.at).toLocaleString('th-TH')} · v${revision.script_version_before}→v${revision.script_version_after}`
            + (revision.reopened_finalize ? ' · ต้อง finalize ใหม่' : '') }),
        ),
      ))),
  ));
  if (resultBlock) wrap.append(resultBlock);
  return wrap;
}

const PUBLISH_STATUS_TEXT = {
  SCHEDULED: 'ตั้งเวลาไว้',
  QUEUED: 'อยู่ใน Publish Queue',
  PUBLISHED: 'เผยแพร่แล้ว',
  CANCELLED: 'ยกเลิก',
};

async function schedulePublish(contentId) {
  const at = document.getElementById('publish-at');
  const channel = (document.getElementById('publish-channel') || {}).value || 'SHOPEE';
  if (!at || !at.value) throw new Error('เลือกวันและเวลาที่จะเผยแพร่ก่อน');
  const res = await api(`/api/mvp/content/${contentId}/schedule`, 'POST', {
    channel,
    scheduled_at: new Date(at.value).toISOString(),
  });
  applyState(res.state);
  return res;
}

async function approvePublish(contentId) {
  const by = String(((document.getElementById('publish-approver') || {}).value || 'Owner')).trim();
  const res = await api(`/api/mvp/content/${contentId}/schedule/approve`, 'POST', { approved_by: by });
  applyState(res.state);
  return res;
}

async function publishNow(contentId, force) {
  const res = await api(`/api/mvp/content/${contentId}/publish`, 'POST', force ? { force: true } : {});
  applyState(res.state);
  return res;
}

async function cancelPublishSchedule(contentId) {
  const res = await api(`/api/mvp/content/${contentId}/schedule/cancel`, 'POST', {});
  applyState(res.state);
  return res;
}

function renderPublishPanel(project) {
  const schedule = project.publish_schedule || null;
  const ready = project.status === 'READY_TO_PUBLISH';
  const wrap = h('div', { class: 'stack' });

  const controls = h('div', { class: 'toolbar' });
  if (!schedule) {
    controls.append(
      h('label', { class: 'small' }, 'ช่องทาง ',
        h('select', { id: 'publish-channel' },
          h('option', { value: 'SHOPEE' }, 'Shopee'))),
      h('label', { class: 'small' }, ' เวลา ',
        h('input', { type: 'datetime-local', id: 'publish-at' })),
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy || !ready,
        on: { click: () => run(() => schedulePublish(project.content_id), 'ตั้งเวลาเผยแพร่แล้ว') },
      }, 'ตั้งเวลเผยแพร่'),
    );
  } else {
    controls.append(
      h('label', { class: 'small' }, 'ผู้อนุมัติ ',
        h('input', { type: 'text', id: 'publish-approver', value: schedule.approved_by || 'Owner', size: 10 })),
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy || schedule.status === 'PUBLISHED' || schedule.status === 'CANCELLED',
        on: { click: () => run(() => approvePublish(project.content_id), 'อนุมัติเผยแพร่แล้ว') },
      }, schedule.approved ? 'อนุมัติซ้ำ (อัปเดตชื่อ)' : 'อนุมัติเผยแพร่'),
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy || schedule.status === 'PUBLISHED' || schedule.status === 'CANCELLED',
        on: { click: () => run(() => publishNow(project.content_id, false), 'เผยแพร่แล้ว (จำลอง) — Library อัปเดตแล้ว') },
      }, 'ยืนยันเผยแพร่ตอนนี้ (จำลอง)'),
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy || schedule.status === 'PUBLISHED' || schedule.status === 'CANCELLED',
        on: { click: () => run(() => cancelPublishSchedule(project.content_id), 'ยกเลิกกำหนดการแล้ว') },
      }, 'ยกเลิกกำหนดการ'),
    );
  }

  const summary = schedule
    ? h('p', { class: 'note' },
      `${PUBLISH_STATUS_TEXT[schedule.status] || schedule.status} · ${schedule.channel} · ${new Date(schedule.scheduled_at).toLocaleString('th-TH')}`
      + (schedule.approved ? ` · อนุมัติโดย ${schedule.approved_by}` : ' · ยังไม่อนุมัติ')
      + (schedule.fallback ? ` · เข้าคิวเมื่อ ${new Date(schedule.fallback.at).toLocaleString('th-TH')} (เลยกำหนดโดยยังไม่อนุมัติ)` : '')
      + (schedule.published_at ? ` · เผยแพร่ ${new Date(schedule.published_at).toLocaleString('th-TH')} โดย ${schedule.published_by}` : ''))
    : h('p', { class: 'note' }, ready
      ? 'ยังไม่มีกำหนดการ — เลือกช่องทางและเวลาที่จะเผยแพร่'
      : 'ต้อง Export วิดีโอและทำ Publish prep ให้ถึง READY_TO_PUBLISH ก่อนจึงจะตั้งเวลาได้');

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Publish · Queue & Scheduling' }),
        h('h2', { text: `${project.content_id} · กำหนดการเผยแพร่` }),
      ),
      schedule ? badge(schedule.status, schedule.status === 'PUBLISHED' ? 'badge-select' : schedule.status === 'QUEUED' ? 'badge-reject' : 'badge-neutral') : null,
    ),
    summary,
    controls,
    h('p', { class: 'note' }, 'ถ้าถึงเวลาที่ตั้งไว้แล้วยังไม่มีใครอนุมัติ ระบบจะย้ายรายการเข้า Publish Queue '
      + 'โดยไม่ทิ้งงาน และยังอนุมัติ/เผยแพร่ย้อนหลังได้'),
  ));

  const queue = (ui.state && ui.state.contents ? ui.state.contents : [])
    .filter((item) => item.publish_schedule)
    .sort((a, b) => String(a.publish_schedule.scheduled_at).localeCompare(String(b.publish_schedule.scheduled_at)));
  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Publish Queue' }),
        h('h2', { text: `${queue.length} รายการในคิว` }),
      ),
      h('div', { class: 'head-meta' },
        badge(`${queue.filter((i) => i.publish_schedule.status === 'QUEUED').length} รออนุมัติ`, 'badge-reject'),
        badge(`${queue.filter((i) => i.publish_schedule.status === 'PUBLISHED').length} เผยแพร่แล้ว`, 'badge-select'),
      ),
    ),
    queue.length === 0
      ? h('p', { class: 'note' }, 'ยังไม่มีรายการที่ตั้งเวลาไว้')
      : h('ul', { class: 'list' }, queue.map((item) => h('li', { class: 'cell' },
        h('div', null,
          h('p', { class: 'cell-title', text: `${item.content_id} · ${(item.offer_snapshot || {}).product_name || ''}` }),
          h('p', { class: 'cell-sub', text: `${PUBLISH_STATUS_TEXT[item.publish_schedule.status] || item.publish_schedule.status} · `
            + `${item.publish_schedule.channel} · ${new Date(item.publish_schedule.scheduled_at).toLocaleString('th-TH')}`
            + (item.publish_schedule.approved ? ` · อนุมัติ: ${item.publish_schedule.approved_by}` : '') }),
        ),
      ))),
  ));
  return wrap;
}

function renderVoiceoverPanel(project) {
  const scenes = (project.storyboard && project.storyboard.scenes) || [];
  const voiced = scenes.filter((scene) => scene.audio && scene.audio.asset_ref && project.assets[scene.audio.asset_ref]);
  const audio = project.audio || {};
  const statusText = audio.status === 'AUDIO_ATTACHED'
    ? `มีเสียงครบ ${voiced.length}/${scenes.length} ฉาก`
    : audio.status === 'AUDIO_DURATION_MISMATCH'
      ? `เสียงกับความยาวฉากไม่ตรงกัน ${(audio.mismatches || []).length} ฉาก`
      : `ยังไม่มีเสียงบรรยาย (${voiced.length}/${scenes.length} ฉาก)`;
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Production · Thai voice-over' }),
        h('h2', { text: 'เสียงบรรยายไทย' }),
      ),
      badge(audio.status || 'AUDIO_PENDING', audio.status === 'AUDIO_ATTACHED' ? 'badge-select' : 'badge-neutral'),
    ),
    h('p', { class: 'lead' }, 'สร้างเสียงบรรยายจากบทพูดของทุกฉากด้วยเสียงไทย แล้วผูกเข้าไทม์ไลน์ — '
      + 'ความยาวฉากจะถูกปรับตามเสียงจริงเพื่อให้เสียงไม่ถูกตัด'),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy || project.status !== 'DRAFT',
        on: { click: () => run(() => synthesizeThaiVoiceover(project.content_id, false), 'เสียงบรรยายพร้อมแล้ว') },
      }, voiced.length ? 'สร้างเสียงเฉพาะฉากที่ยังไม่มี' : 'สร้างเสียงบรรยายไทย'),
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy || project.status !== 'DRAFT',
        on: { click: () => run(() => synthesizeThaiVoiceover(project.content_id, true), 'สร้างเสียงบรรยายใหม่ครบทุกฉาก') },
      }, 'สร้างใหม่ทั้งหมด'),
    ),
    h('p', { class: 'note', text: statusText }),
  );
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
    h('label', { class: 'small settings-live' },
      h('input', { id: 'content-use-llm', type: 'checkbox' }),
      ' ให้ AI ร่างสคริปต์ด้วยคีย์เดียวกัน (ต้องเปิด Live drafting ใน Settings ก่อน)'),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => run(async () => {
            const [kind, id] = ui.contentSource.split(':');
            const body = { approach: ui.contentApproach };
            const llmNode = document.getElementById('content-use-llm');
            if (llmNode && llmNode.checked) body.useLlm = true;
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
      h('div', { class: 'notice-head' }, h('h2', { text: 'ยังไม่มีแคนดิเดตในพูล' })),
      h('p', null, h('button', { type: 'button', class: 'link-btn', on: { click: () => go('research') } }, 'ไปที่ Research →')),
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
  if (ui.section === 'schedule') render();
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
    if (ui.section === 'schedule') render();
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
            go('production');
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
        type: 'button', class: 'link-btn', on: { click: () => go('production') },
      }, 'ไปที่ Content →')),
    ));
    return wrap;
  }
  for (const item of lib.items) wrap.append(renderLibraryItem(item));
  return wrap;
}

/* ---------- Pipeline views (Profile / Research pool / Publish) ---------- */

// Which content tab belongs to which pipeline step.
const SECTION_CONTENT_TAB = { production: 'storyboard', schedule: 'publish' };
const SECTION_CONTENT_TABS = {
  // Production owns the edit, the Thai voice and the whole QC/finalize/export
  // run; scheduling sees only the publish payload it is allowed to act on.
  production: ['storyboard', 'preview', 'qa', 'finalize', 'export'],
  schedule: ['publish'],
};

async function loadAiStatus() {
  ui.ai = ui.ai || {};
  if (ui.ai.loading) return;
  ui.ai.loading = true;
  try {
    ui.ai.status = await api('/api/mvp/ai/status');
    ui.ai.error = null;
  } catch (err) {
    ui.ai.error = err.message;
  } finally {
    ui.ai.loading = false;
    if (ui.section === 'profile' || ui.section === 'research') render();
  }
}

async function pingAiConnection() {
  const res = await api('/api/mvp/ai/ping', 'POST', {});
  ui.ai = ui.ai || {};
  ui.ai.ping = res.ping;
  if (res.ai) ui.ai.status = { ai: res.ai };
  return res.ping;
}

async function runAiResearch() {
  const res = await api('/api/mvp/ai/research', 'POST', {});
  ui.aiResearch = res;
  if (res.ai) ui.ai = { ...(ui.ai || {}), status: { ai: res.ai } };
  applyState(res.state);
}

async function createContentFromAiPick(candidateId) {
  const res = await api('/api/mvp/content/draft', 'POST', { candidateId });
  ui.contentId = res.project.content_id;
  ui.contentNew = false;
  ui.section = 'production';
  ui.contentTab = 'storyboard';
  applyState(res.state);
}

function aiStatusBadge(configured) {
  return badge(configured ? 'เชื่อมต่อแล้ว' : 'ยังไม่ตั้งค่า', configured ? 'badge-fact' : 'badge-reject');
}

/* ---------- Settings · OpenRouter key & model ---------- */

async function applyAiSettings(payload) {
  const res = await api('/api/mvp/settings/ai', 'POST', payload);
  ui.ai = { ...(ui.ai || {}), status: { ai: res.ai, settings: res.settings, env: res.env }, error: null, ping: null };
  return res;
}

async function clearAiKey() {
  return applyAiSettings({ clear_key: true });
}

async function resetAiSettings() {
  return applyAiSettings({ reset: true });
}

const AI_KEY_SOURCE_TEXT = {
  runtime: 'ตั้งค่าในหน้านี้ (ใช้ทันที)',
  'env-file': 'อ่านจาก .env',
  process: 'มาจาก environment',
  missing: 'ยังไม่พบคีย์',
};

function renderAiStatusCard() {
  const payload = ui.ai && ui.ai.status;
  const ai = payload ? payload.ai : null;
  const settings = payload ? payload.settings : null;
  const envNote = payload ? payload.env : null;
  const ping = ui.ai && ui.ai.ping;
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Back office · Settings' }),
        h('h2', { text: 'API Key & Model (ใช้ร่วมทั้ง pipeline)' }),
      ),
      ai ? aiStatusBadge(ai.configured) : badge('loading', 'badge-neutral'),
    ),
    ui.ai && ui.ai.error ? h('p', { class: 'note', text: `อ่านสถานะไม่ได้: ${ui.ai.error}` }) : null,
    ai && settings
      ? h('div', { class: 'table-scroll' },
        h('table', { class: 'mvp-table compact' },
          h('tbody', null,
            h('tr', null, h('th', { text: 'Endpoint' }), h('td', { class: 'mono', text: ai.endpoint })),
            h('tr', null, h('th', { text: 'คีย์ที่ใช้อยู่' }), h('td', { text: `${settings.key_hint || '—'} · ${settings.key_var} · ${AI_KEY_SOURCE_TEXT[settings.key_source] || settings.key_source}` })),
            h('tr', null, h('th', { text: 'โมเดล' }), h('td', { class: 'mono', text: `${settings.model} (${settings.model_source})` })),
            h('tr', null, h('th', { text: 'AI ร่างสคริปต์ (Live drafting)' }), h('td', { text: settings.live_drafting ? 'เปิด — สร้างสคริปต์ผ่าน OpenRouter ได้' : 'ปิด — บทพูดยังสร้างจากแม่แบบเดิม' })),
            h('tr', null, h('th', { text: 'เพดานคำตอบ' }), h('td', { text: `${ai.max_output_tokens} tokens` })),
            h('tr', null, h('th', { text: 'เก็บค่าไว้ที่' }), h('td', { text: 'หน่วยความจำเซิร์ฟเวอร์เท่านั้น (ไม่เขียนดิสก์ ไม่เก็บในเบราว์เซอร์)' })),
            settings.updated_at ? h('tr', null, h('th', { text: 'แก้ไขล่าสุด' }), h('td', { text: fmtDate(settings.updated_at) })) : null,
            envNote ? h('tr', null, h('th', { text: '.env' }), h('td', { text: envNote })) : null,
          ),
        ),
      )
      : h('p', { class: 'note', text: 'กำลังอ่านสถานะ…' }),
    h('div', { class: 'settings-form' },
      h('p', { class: 'sub-head', text: 'ตั้งค่า / สลับคีย์และโมเดล' }),
      h('div', { class: 'field inline' },
        h('label', { class: 'field' },
          h('span', { class: 'field-label', text: 'OpenRouter API Key ใหม่' }),
          h('input', {
            id: 'settings-key', type: 'password', autocomplete: 'off', spellcheck: 'false',
            placeholder: 'เว้นว่าง = ใช้คีย์เดิม (ค่าที่กรอกจะไม่ถูกเก็บถาวร)',
          }),
        ),
        h('label', { class: 'field' },
          h('span', { class: 'field-label', text: 'Model' }),
          h('input', {
            id: 'settings-model', type: 'text',
            value: settings ? settings.model : '',
            placeholder: 'vendor/model',
          }),
        ),
      ),
      h('label', { class: 'small settings-live' },
        h('input', {
          id: 'settings-live', type: 'checkbox',
          checked: Boolean(settings && settings.live_drafting),
        }),
        ' อนุญาตให้ AI ร่างสคริปต์/คอนเทนต์ด้วยคีย์นี้ (Live drafting) — เปิดแล้วทุกครั้งที่สร้างคอนเทนต์ระบบจะเรียกโมเดลจริง',
      ),
      h('div', { class: 'toolbar' },
        h('button', {
          type: 'button', class: 'btn btn-primary', disabled: ui.busy,
          on: {
            click: () => {
              const keyNode = document.getElementById('settings-key');
              const modelNode = document.getElementById('settings-model');
              const liveNode = document.getElementById('settings-live');
              const payload = { live_drafting: Boolean(liveNode && liveNode.checked) };
              const key = keyNode ? keyNode.value.trim() : '';
              const model = modelNode ? modelNode.value.trim() : '';
              if (key) payload.api_key = key;
              if (model) payload.model = model;
              run(async () => { await applyAiSettings(payload); }, 'บันทึกแล้ว — ใช้ค่าทันทีโดยไม่ต้องรีสตาร์ท');
            },
          },
        }, 'บันทึก & ใช้ทันที'),
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
          on: { click: () => run(clearAiKey, 'ล้างคีย์ในหน่วยความจำแล้ว — กลับไปใช้ .env') },
        }, 'ล้างคีย์ (กลับไปใช้ .env)'),
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
          on: { click: () => run(resetAiSettings, 'รีเซ็ตการตั้งค่าทั้งหมดแล้ว') },
        }, 'รีเซ็ตทั้งหมด'),
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy || !(ai && ai.configured),
          on: { click: () => run(() => pingAiConnection(), 'ทดสอบการเชื่อมต่อแล้ว') },
        }, 'ทดสอบการเชื่อมต่อ'),
      ),
      ping
        ? h('p', { class: 'note', text: ping.ok
          ? `เชื่อมต่อสำเร็จ · ${ping.model} · ${ping.latency_ms} ms`
          : `เชื่อมต่อไม่สำเร็จ · ${ping.status}${ping.message ? ` · ${ping.message}` : ''}` })
        : null,
    ),
    h('p', { class: 'note' }, 'ลำดับความสำคัญของค่า: ตั้งค่าในหน้านี้ → .env (โหลดตอนเปิดเซิร์ฟเวอร์) → ค่าเริ่มต้น · '
      + 'คีย์เดียวกันถูกใช้ทั้ง Research & Candidate, การร่างสคริปต์/คอนเทนต์ และการทดสอบการเชื่อมต่อ · '
      + 'ค่าในหน่วยความจำหายเมื่อรีสตาร์ทเซิร์ฟเวอร์ และไม่มี background call ใด ๆ'),
  );
}

function renderAiPanel() {
  const analysis = (ui.aiResearch && ui.aiResearch.result && ui.aiResearch.result.analysis)
    || (ui.state && ui.state.ai_research && ui.state.ai_research.analysis)
    || null;
  const result = ui.aiResearch && ui.aiResearch.result;
  const ai = (ui.ai && ui.ai.status && ui.ai.status.ai) || null;
  const meta = ui.state && ui.state.ai_research;
  return h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'AI Research · OpenRouter' }),
        h('h2', { text: analysis ? `คัด ${analysis.picks.length} รายการ + Hook/สคริปต์แล้ว` : 'วิเคราะห์และคัด 5 รายการด้วย AI' }),
      ),
      ai ? aiStatusBadge(ai.configured) : null,
    ),
    h('p', { class: 'note' }, 'โมเดลอ่านข้อมูลสินค้าที่นำเข้าแล้วเสนอ 5 รายการพร้อมเหตุผล ความเสี่ยง Hook และสคริปต์ย่อ · '
      + 'ระบบไม่แก้ลำดับหรือ claim ให้เอง — คนยังเป็นผู้เลือก'),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy || !(ai && ai.configured),
        on: { click: () => run(() => runAiResearch(), 'AI วิเคราะห์เสร็จแล้ว') },
      }, 'วิเคราะห์ด้วย AI (5 รายการ)'),
      !(ai && ai.configured)
        ? h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => go('profile') } }, 'ไปตั้งค่าการเชื่อมต่อ →')
        : null,
    ),
    result && !result.ok
      ? h('p', { class: 'note', text: `เรียกไม่สำเร็จ · ${result.status}${result.message ? ` · ${result.message}` : ''}` })
      : null,
    meta && !result ? h('p', { class: 'note', text: `ผลล่าสุด ${fmtDate(meta.ran_at)} · ${meta.model}` }) : null,
    analysis
      ? h('div', { class: 'stack' },
        analysis.summary ? h('p', { class: 'lead', text: analysis.summary }) : null,
        h('ul', { class: 'list' }, analysis.picks.map((pick) => h('li', { class: 'cell' },
          h('div', null,
            h('p', { class: 'cell-title', text: `${pick.candidate_id} · ${pick.title}${pick.fit_score === null ? '' : ` · ${pick.fit_score}/100`}` }),
            pick.why ? h('p', { class: 'cell-sub', text: `ทำไม: ${pick.why}` }) : null,
            pick.risks ? h('p', { class: 'cell-sub', text: `ความเสี่ยง: ${pick.risks}` }) : null,
            pick.hook ? h('p', { class: 'cell-title', text: `Hook: ${pick.hook}` }) : null,
            pick.script.length ? h('ol', { class: 'plain-list tight' }, pick.script.map((line) => h('li', { text: line }))) : null,
            h('button', {
              type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
              on: { click: () => run(() => createContentFromAiPick(pick.candidate_id), `สร้างคอนเทนต์ ${pick.candidate_id} แล้ว — ไปต่อที่ Production`) },
            }, 'สร้างคอนเทนต์จากรายการนี้ →'),
          ),
        ))),
        analysis.notes && analysis.notes.length
          ? h('ul', { class: 'plain-list tight' }, analysis.notes.map((note) => h('li', { text: note })))
          : null,
      )
      : h('p', { class: 'note' }, 'ยังไม่มีผลวิเคราะห์ — กด "วิเคราะห์ด้วย AI" เพื่อเริ่ม'),
  );
}

/* ---------- End-to-End Traceability View ---------- */

const TRACE_STATUS = {
  DONE: ['ผ่านแล้ว', 'badge-fact'],
  ACTIVE: ['กำลังทำ', 'badge-defer'],
  PENDING: ['ยังไม่เริ่ม', 'badge-neutral'],
  BLOCKED: ['ติดปัญหา', 'badge-reject'],
  STALE: ['ต้องทำใหม่', 'badge-reject'],
};

function traceStatusBadge(status) {
  const entry = TRACE_STATUS[status] || [status || 'ไม่ทราบ', 'badge-neutral'];
  return badge(entry[0], entry[1]);
}

function renderTraceFacts(facts) {
  const list = (facts || []).filter(Boolean);
  if (!list.length) return null;
  return h('dl', { class: 'kv compact' }, list.map((item) => h('div', null,
    h('dt', { text: item.label }),
    h('dd', { class: item.mono ? 'mono small' : '', text: item.value }),
  )));
}

function renderTraceChecks(checks) {
  const list = (checks || []).filter(Boolean);
  if (!list.length) return null;
  return h('ul', { class: 'trace-checks' }, list.map((item) => h('li', { class: `trace-check${item.ok ? ' is-ok' : ' is-bad'}` },
    h('span', { class: 'trace-mark', 'aria-hidden': 'true', text: item.ok ? '✓' : '✕' }),
    h('div', { class: 'trace-check-body' },
      h('p', { class: 'trace-check-label', text: item.label }),
      item.detail ? h('p', { class: 'cell-sub', text: item.detail }) : null,
    ),
  )));
}

function renderTraceScenes(step) {
  if (!step.scenes || !step.scenes.length) return null;
  return h('div', { class: 'table-scroll' },
    h('table', { class: 'mvp-table compact' },
      h('thead', null, h('tr', null,
        h('th', { text: 'ฉาก' }),
        h('th', { text: 'บทพูดไทย' }),
        h('th', { text: 'เสียงที่ผูก' }),
        h('th', { text: 'หลักฐาน' }),
      )),
      h('tbody', null, step.scenes.map((scene) => h('tr', null,
        h('td', null,
          h('p', { class: 'cell-title', text: `${scene.id}${scene.role ? ` · ${scene.role}` : ''}` }),
          h('p', { class: 'cell-sub', text: `${scene.duration_s === null ? '—' : scene.duration_s}s` }),
        ),
        h('td', null,
          h('p', { class: 'cell-sub', text: scene.headline || '—' }),
          h('p', { class: 'small', text: scene.voiceover || '—' }),
        ),
        h('td', null, scene.audio
          ? h('div', null,
            h('p', { class: 'mono small', text: `${scene.audio.asset_id} · ${scene.audio.duration_s === null ? '—' : scene.audio.duration_s}s` }),
            h('p', { class: 'cell-sub', text: scene.audio.provider || '—' }),
            h('p', { class: 'cell-sub mono small', text: scene.audio.file || '' }),
          )
          : h('span', { class: 'warn', text: 'ยังไม่มีไฟล์เสียง' })),
        h('td', null, h('p', { class: 'mono small', text: (scene.evidence_ids || []).join(' · ') || '—' })),
      ))),
    ),
  );
}

function renderTraceStep(step, number) {
  const body = h('div', { class: 'trace-step-body' });
  body.append(h('div', { class: 'trace-step-head' },
    h('div', null,
      h('p', { class: 'eyebrow', text: `Step ${number}` }),
      h('h3', { class: 'trace-step-title', text: step.label }),
    ),
    traceStatusBadge(step.status),
  ));
  mount(body, step.at ? h('p', { class: 'trace-time mono small', text: fmtDate(step.at) }) : null);
  mount(body, step.summary ? h('p', { class: 'lead', text: step.summary }) : null);
  mount(body, renderTraceFacts(step.facts));
  mount(body, renderTraceChecks(step.checks));
  if (step.notes && step.notes.length) {
    body.append(h('ul', { class: 'limits' }, step.notes.map((note) => h('li', { text: note }))));
  }
  mount(body, renderTraceScenes(step));
  const pick = step.payload && step.payload.ai_pick;
  if (pick) {
    body.append(h('div', { class: 'trace-ai' },
      h('p', { class: 'eyebrow', text: 'AI shortlist evidence' }),
      pick.fit_score === null ? null : h('p', { class: 'cell-sub', text: `Fit score ${pick.fit_score}/100${pick.model ? ` · ${pick.model}` : ''}` }),
      pick.why ? h('p', { class: 'cell-sub', text: `ทำไม: ${pick.why}` }) : null,
      pick.hook ? h('p', { class: 'cell-title', text: `Hook: ${pick.hook}` }) : null,
      pick.script && pick.script.length
        ? h('ol', { class: 'plain-list tight' }, pick.script.map((line) => h('li', { text: line })))
        : null,
    ));
  }
  if (step.payload && step.payload.reasons && step.payload.reasons.length) {
    body.append(h('details', { class: 'trace-raw-block' },
      h('summary', { text: 'เหตุผลการคัดเลือก (raw)' }),
      h('ul', { class: 'plain-list' }, step.payload.reasons.map((text) => h('li', { text }))),
    ));
  }
  return h('article', { class: `trace-step is-${String(step.status || 'pending').toLowerCase()}` },
    h('div', { class: 'trace-step-rail' },
      h('span', { class: 'trace-step-num', text: String(number) }),
      h('span', { class: 'trace-dot', 'aria-hidden': 'true' }),
    ),
    body,
  );
}

function renderTraceMedia(run) {
  const media = run.media || {};
  if (!media.video_url) {
    return h('p', { class: 'note', text: 'ยังไม่มีไฟล์ MP4 ให้พรีวิว — ขั้น Export ยังไม่เกิดขึ้น' });
  }
  return h('div', { class: 'trace-media' },
    h('div', { class: 'trace-video-wrap' },
      h('video', {
        class: 'trace-video', controls: true, playsinline: true, preload: 'metadata', src: media.video_url,
      }, 'เบราว์เซอร์นี้เล่นวิดีโอไม่ได้'),
    ),
    h('div', { class: 'trace-media-side' },
      h('div', { class: 'head-meta' },
        badge(media.integrity || 'UNKNOWN', media.integrity === 'VERIFIED' ? 'badge-fact' : 'badge-reject'),
        media.width && media.height ? badge(`${media.width}×${media.height}`, 'badge-neutral') : null,
        media.duration_s === null || media.duration_s === undefined ? null : badge(`${media.duration_s}s`, 'badge-neutral'),
      ),
      h('p', { class: 'cell-sub', text: 'พรีวิวไฟล์ MP4 9:16 ตัวจริงจาก Content Library — sha256 ถูกตรวจกับไฟล์บนดิสก์แล้ว' }),
      run.payload && run.payload.caption ? h('pre', { class: 'trace-caption', text: run.payload.caption }) : null,
      run.payload && run.payload.hashtags && run.payload.hashtags.length
        ? h('p', { class: 'small', text: run.payload.hashtags.join(' ') })
        : null,
      run.payload && run.payload.affiliate_link
        ? (/^https?:\/\//i.test(run.payload.affiliate_link)
          ? h('p', { class: 'mono small' }, h('a', { href: run.payload.affiliate_link, target: '_blank', rel: 'noopener' }, run.payload.affiliate_link))
          : h('p', { class: 'mono small', text: run.payload.affiliate_link }))
        : null,
      h('div', { class: 'toolbar' },
        h('a', { class: 'btn btn-ghost', href: media.video_url, target: '_blank', rel: 'noopener' }, 'เปิดวิดีโอเต็มจอ'),
        media.download_url ? h('a', { class: 'btn btn-primary', href: media.download_url, download: true }, 'ดาวน์โหลด MP4') : null,
      ),
    ),
  );
}

function renderTraceRun(run, index) {
  return h('section', { class: 'mvp-card trace-run' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: index === 0 ? 'Production run' : `Production run ${index + 1}` }),
        h('h2', { text: `${run.content_id} · ${run.status}` }),
      ),
      h('div', { class: 'head-meta' },
        badge(`${run.done_steps}/${run.total_steps} ขั้นผ่าน`, run.done_steps === run.total_steps ? 'badge-fact' : 'badge-neutral'),
        badge(run.approach || '—', 'badge-neutral'),
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
          on: {
            click: () => {
              ui.contentId = run.content_id;
              ui.contentNew = false;
              ui.contentTab = 'storyboard';
              go('production');
            },
          },
        }, 'เปิดใน Production'),
      ),
    ),
    renderTraceMedia(run),
    h('div', { class: 'trace-timeline' }, run.steps.map((step, stepIndex) => renderTraceStep(step, stepIndex + 2))),
    h('details', { class: 'trace-raw-block' },
      h('summary', { text: `ข้อมูลดิบของ ${run.content_id} (JSON)` }),
      h('pre', { class: 'trace-pre', text: JSON.stringify(run.raw, null, 2) }),
    ),
  );
}

async function openTrace(candidateId) {
  ui.trace = { candidateId, data: null, loading: true, error: null };
  render();
  try {
    const data = await api(`/api/mvp/candidates/${encodeURIComponent(candidateId)}/trace`);
    if (ui.trace.candidateId !== candidateId) return;
    ui.trace.data = data;
  } catch (err) {
    if (ui.trace.candidateId !== candidateId) return;
    ui.trace.error = err.message;
  } finally {
    if (ui.trace.candidateId === candidateId) {
      ui.trace.loading = false;
      render();
    }
  }
}

function closeTrace() {
  ui.trace = { candidateId: null, data: null, loading: false, error: null };
  render();
}

function renderTraceView() {
  const view = ui.trace;
  const trace = view.data;
  const wrap = h('div', { class: 'stack' });
  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'End-to-End Traceability · read-only' }),
        h('h2', { text: trace ? `ไทม์ไลน์: ${trace.title}` : `ไทม์ไลน์: ${view.candidateId}` }),
        h('p', { class: 'cell-sub mono', text: view.candidateId }),
      ),
      h('div', { class: 'toolbar' },
        h('button', { type: 'button', class: 'btn btn-ghost', on: { click: closeTrace } }, '← กลับไปที่ Candidate Pool'),
      ),
    ),
    trace
      ? h('p', { class: 'note', text: `ประกอบจาก state และ Content Library เท่านั้น · สร้างเมื่อ ${fmtDate(trace.generated_at)} · ไม่มีการเขียนข้อมูลหรือเรียกบริการภายนอก` })
      : null,
  ));

  if (view.error) {
    wrap.append(h('section', { class: 'notice notice-error' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'อ่านไทม์ไลน์ไม่ได้' })),
      h('p', { class: 'error-text', text: view.error }),
    ));
    return wrap;
  }
  if (view.loading || !trace) {
    wrap.append(h('section', { class: 'notice' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'กำลังประกอบไทม์ไลน์…' })),
      h('p', { text: 'ตรวจไฟล์ export และ sha256 บนดิสก์ก่อนแสดงผล' }),
    ));
    return wrap;
  }

  wrap.append(renderTraceStep(trace.steps[0], 1));

  if (trace.has_runs) {
    trace.runs.forEach((run, index) => wrap.append(renderTraceRun(run, index)));
  } else {
    const status = trace.raw && trace.raw.candidate ? trace.raw.candidate.status : null;
    const canCreate = status === 'SAVED' || status === 'QUEUED';
    wrap.append(h('section', { class: 'mvp-card' },
      h('div', { class: 'card-head' },
        h('div', null,
          h('p', { class: 'eyebrow', text: 'No production run' }),
          h('h2', { text: 'ยังไม่มีคอนเทนต์ที่ผลิตจากรายการนี้' }),
        ),
      ),
      h('p', { class: 'note' }, 'ไทม์ไลน์จะเริ่มมีข้อมูล Production / Finalize / Export หลังจากสร้างคอนเทนต์จาก candidate รายการนี้'),
      h('div', { class: 'toolbar' },
        canCreate
          ? h('button', {
            type: 'button', class: 'btn btn-primary', disabled: ui.busy,
            on: {
              click: () => run(async () => {
                await createContentFromAiPick(trace.candidate_id);
                closeTrace();
              }, 'สร้างคอนเทนต์แล้ว — ไปต่อที่ Production'),
            },
          }, 'สร้างคอนเทนต์จากรายการนี้ →')
          : h('p', { class: 'note', text: 'ต้อง Save หรือ Add to queue รายการนี้ก่อน จึงจะสร้างคอนเทนต์ได้' }),
        h('button', { type: 'button', class: 'btn btn-ghost', on: { click: closeTrace } }, '← กลับไปที่ Candidate Pool'),
      ),
    ));
    wrap.append(h('section', { class: 'mvp-card' },
      h('div', { class: 'trace-timeline' }, trace.steps.slice(1).map((step, index) => renderTraceStep(step, index + 2))),
    ));
  }

  wrap.append(h('section', { class: 'mvp-card' },
    h('details', { class: 'trace-raw-block' },
      h('summary', { text: 'ข้อมูลดิบของ candidate (JSON)' }),
      h('pre', { class: 'trace-pre', text: JSON.stringify(trace.raw, null, 2) }),
    ),
  ));
  return wrap;
}

function renderProfileSchedule() {
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });
  const offers = state && state.offers ? Object.values(state.offers) : [];
  const shops = [...new Set(offers.map((offer) => offer.shop_name).filter(Boolean))];
  const importInfo = state ? state.import : null;
  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Profile' }),
        h('h2', { text: 'ช่องทางและข้อมูลต้นทาง' }),
      ),
      badge(state && state.synthetic ? 'SYNTHETIC' : 'STAGED', state && state.synthetic ? 'badge-neutral' : 'badge-fact'),
    ),
    h('div', { class: 'table-scroll' },
      h('table', { class: 'mvp-table compact' },
        h('tbody', null,
          h('tr', null, h('th', { text: 'ช่องทางเผยแพร่' }), h('td', { text: 'Shopee Affiliate' })),
          h('tr', null, h('th', { text: 'ชุดข้อมูล' }), h('td', { text: importInfo ? importInfo.id : 'ยังไม่มีข้อมูล' })),
          h('tr', null, h('th', { text: 'ร้านค้าในพูล' }), h('td', { text: shops.length ? `${shops.length} ร้าน · ${shops.slice(0, 3).join(', ')}` : '—' })),
          h('tr', null, h('th', { text: 'สินค้า / ข้อเสนอ' }), h('td', { text: state ? `${state.summary.products} / ${state.summary.offers}` : '—' })),
        ),
      ),
    ),
    h('p', { class: 'note' }, 'ข้อมูลพูลมาจากชุดข้อมูลที่โหลดไว้ในระบบแล้ว (fixture) — หน้านี้แสดงโปรไฟล์และตารางเผยแพร่เท่านั้น'),
  ));

  const contents = (state && state.contents) || [];
  const scheduled = contents.filter((c) => c.publish_schedule)
    .sort((a, b) => String(a.publish_schedule.scheduled_at).localeCompare(String(b.publish_schedule.scheduled_at)));
  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Schedule' }),
        h('h2', { text: 'ตารางเผยแพร่' }),
      ),
      h('div', { class: 'head-meta' },
        badge(`${scheduled.filter((c) => c.publish_schedule.status === 'SCHEDULED').length} ตั้งเวลาไว้`, 'badge-neutral'),
        badge(`${scheduled.filter((c) => c.publish_schedule.status === 'QUEUED').length} รออนุมัติ`, 'badge-reject'),
        badge(`${scheduled.filter((c) => c.publish_schedule.status === 'PUBLISHED').length} เผยแพร่แล้ว`, 'badge-select'),
      ),
    ),
    scheduled.length
      ? h('ul', { class: 'list' }, scheduled.map((item) => h('li', { class: 'cell' },
        h('div', null,
          h('p', { class: 'cell-title', text: `${item.content_id} · ${(item.offer_snapshot || {}).product_name || ''}` }),
          h('p', { class: 'cell-sub', text: `${PUBLISH_STATUS_TEXT[item.publish_schedule.status] || item.publish_schedule.status} · `
            + `${item.publish_schedule.channel} · ${fmtDate(item.publish_schedule.scheduled_at)}` }),
        ),
      )))
      : h('p', { class: 'note' }, 'ยังไม่มีกำหนดการ — ไปที่ Publish Queue เพื่อตั้งเวลาให้คอนเทนต์ที่พร้อมแล้ว'),
    h('div', { class: 'toolbar' },
      h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => go('schedule') } }, 'ไปที่ Publish Queue →'),
    ),
  ));
  wrap.append(renderAiStatusCard());
  return wrap;
}

function renderResearchPool() {
  const wrap = h('div', { class: 'stack' });
  if (ui.trace.candidateId) {
    wrap.append(renderTraceView());
    return wrap;
  }
  wrap.append(renderAiPanel());
  wrap.append(renderResearch());
  wrap.append(renderCandidates());
  return wrap;
}

function renderPublishSection() {
  const wrap = h('div', { class: 'stack' });
  wrap.append(renderContent());
  wrap.append(renderLibrary());
  return wrap;
}

/* ---------- Render ---------- */

function renderDataChip() {
  if (!els.dataChip) return;
  const state = ui.state;
  const synthetic = state ? state.synthetic !== false : true;
  let text;
  if (!state || !state.import) {
    text = 'SYNTHETIC FIXTURE — not Shopee data';
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
  const currentSection = SECTIONS.find((s) => s.key === ui.section) || SECTIONS[0];
  els.eyebrow.textContent = `MVP slice · ${currentSection.label}`;
  els.title.textContent = {
    profile: 'Profile & Channels',
    research: 'Research & Candidate Pool',
    plan: 'Plan & AI Video Generation',
    production: 'Production & Finalize',
    schedule: 'Schedule & Task',
    analytics: 'Analytics Dashboard',
  }[ui.section];
  els.save.textContent = ui.busy
    ? 'Working…'
    : ui.state
      ? `${ui.state.data_mode === 'STAGED_IMPORT' ? 'staged' : 'fixture'} ${ui.state.import ? ui.state.import.id : 'not imported'}`
      : 'Loading…';
  clear(els.body);
  const section = ui.section;
  if (section === 'profile') els.body.append(renderProfileChannels());
  else if (section === 'research') els.body.append(renderResearchPool());
  else if (section === 'plan') els.body.append(renderPlanStage());
  else if (section === 'production') els.body.append(renderProductionStage());
  else if (section === 'schedule') els.body.append(renderScheduleStage());
  else if (section === 'analytics') els.body.append(renderAnalyticsStage());
  else els.body.append(renderProfileChannels());
}

/* ---------- Shell actions (static sidebar) ---------- */

function bindShellActions() {
  const quick = document.getElementById('quick-start');
  if (quick) {
    quick.addEventListener('click', () => run(async () => {
      if (!ui.state || !ui.state.import) {
        throw new Error('ยังไม่มีข้อมูลพูลสินค้าในระบบ');
      }
      if (!ui.state.summary || !ui.state.summary.candidates) {
        await generateFromResearch(false);
      } else {
        ui.section = 'research';
      }
      ui.error = null;
    }, 'Candidate Pool พร้อมแล้ว — เลือก 1 รายการเพื่อไปต่อ'));
  }

  const offers = document.getElementById('open-offers');
  if (offers) {
    offers.addEventListener('click', () => {
      if (!ui.state || !ui.state.import) {
        toast('ยังไม่มีข้อมูลนำเข้า — กด "สร้าง Candidate Pool 5 รายการ" ก่อน แล้วจึงเพิ่มข้อเสนอได้', true);
        return;
      }
      openSelectModal('add', null);
    });
  }
}

bindShellActions();

/* ---------- Boot ---------- */

(async () => {
  try {
    const [meta, state] = await Promise.all([api('/api/mvp/meta'), api('/api/mvp/state')]);
    ui.meta = meta;
    applyState(state);
    ui.section = 'profile';
    render();
    loadAiStatus();
  } catch (err) {
    ui.error = { message: err.message, details: null };
    render();
    toast(err.message, true);
  }
})();
