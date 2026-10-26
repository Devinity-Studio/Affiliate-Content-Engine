'use strict';

/**
 * ACE — Mission 1 vertical slice client.
 *
 * Renders mock opportunity records, separates FACT / INFERENCE / UNKNOWN
 * (the runtime claim-class set; the spec's fourth class HYPOTHESIS is
 * not accepted by the server yet — see OQ-C in HANDOFF.md),
 * shows illustrative (never forecast) arithmetic, and records an
 * opportunity-level human decision through the local API.
 */

const STEPS = [
  {
    n: 1,
    name: 'Research',
    purpose: 'Gather sourced market evidence and shortlist candidate opportunities.',
    gate: 'No gate',
  },
  {
    n: 2,
    name: 'Work Plan',
    purpose: 'Turn the selected opportunity into a hypothesis with explicit arithmetic.',
    gate: 'G1',
  },
  {
    n: 3,
    name: 'Experiment Plan',
    purpose: 'Choose one offer and pre-register the smallest experiment that can test it.',
    gate: 'G2',
  },
  {
    n: 4,
    name: 'Storyboard & Script',
    purpose: 'Draft the script with claim-to-evidence mapping and disclosures.',
    gate: 'No gate',
  },
  {
    n: 5,
    name: 'Production',
    purpose: 'Produce the single content asset within the free-quota budget.',
    gate: 'No gate',
  },
  {
    n: 6,
    name: 'Review & Approve',
    purpose: 'Check the asset against the G3 checklist before anything is published.',
    gate: 'G3',
  },
  {
    n: 7,
    name: 'Publish & Confirm',
    purpose: 'Publish with the approved link form and record live evidence.',
    gate: 'G4',
  },
  {
    n: 8,
    name: 'Monitor',
    purpose: 'Capture dashboard observations at the scheduled points.',
    gate: 'No gate',
  },
  {
    n: 9,
    name: 'Analyze & Report',
    purpose: 'Report results with every number traced to an observation.',
    gate: 'G5',
  },
  {
    n: 10,
    name: 'Carry Forward',
    purpose: 'Record learnings and seed the next cycle.',
    gate: 'No gate',
  },
];

const STEP_STATUS = {
  1: 'IN_PROGRESS',
};

const DECISION_LABEL = { SELECT: 'Select', REJECT: 'Reject', DEFER: 'Defer' };
const DECISION_CLASS = { SELECT: 'badge-select', REJECT: 'badge-reject', DEFER: 'badge-defer' };
const SUGGESTION_LABEL = {
  SELECT_FOR_G2_DRAFT: 'Select for G2 drafting',
  DO_NOT_PROCEED: 'Do not proceed',
};

const ui = {
  mock: null,
  state: null,
  viewId: null,
  step: 1,
  submitting: false,
  loadError: null,
  formError: null,
  draft: null, // { opportunityId, decision, reason }
  toastTimer: null,
};

const els = {
  stepList: document.getElementById('step-list'),
  stepCount: document.getElementById('step-count'),
  crumb: document.getElementById('crumb'),
  title: document.getElementById('workspace-title'),
  body: document.getElementById('workspace-body'),
  saveState: document.getElementById('save-state'),
  toast: document.getElementById('toast'),
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

function badge(text, kind) {
  return h('span', { class: `badge ${kind || 'badge-neutral'}`, text });
}

function classBadge(claimClass) {
  return badge(claimClass, `badge-${String(claimClass).toLowerCase()}`);
}

function decisionBadge(decision) {
  return badge(DECISION_LABEL[decision] || decision, DECISION_CLASS[decision] || 'badge-neutral');
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return dateFmt.format(date);
}

function stepByNumber(n) {
  return STEPS.find((s) => s.n === n) || STEPS[0];
}

function opportunityById(id) {
  return ui.mock?.opportunities?.find((o) => o.id === id) || null;
}

function latestDecisionFor(opportunityId) {
  const list = ui.state?.decisions || [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].opportunityId === opportunityId) return list[i];
  }
  return null;
}

function toast(message, isError) {
  els.toast.textContent = message;
  els.toast.className = `toast is-visible${isError ? ' is-error' : ''}`;
  window.clearTimeout(ui.toastTimer);
  ui.toastTimer = window.setTimeout(() => {
    els.toast.className = 'toast';
  }, 4200);
}

/* ---------- API ---------- */

async function getJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (payload?.error) detail = payload.error;
    } catch {
      /* keep the status line */
    }
    throw new Error(detail);
  }
  return response.json();
}

/* ---------- Sidebar ---------- */

function renderSidebar() {
  clear(els.stepList);
  for (const step of STEPS) {
    const status = STEP_STATUS[step.n] || 'NOT_STARTED';
    const active = ui.step === step.n;
    const meta = step.n === 1 ? `${status} · no gate` : `${status} · ${step.gate}`;
    const button = h(
      'button',
      {
        class: 'step',
        type: 'button',
        'aria-current': active ? 'step' : null,
        title: `Step ${step.n} — ${step.name}\n${step.purpose}\nGate at exit: ${step.gate}`,
        on: {
          click: () => {
            if (ui.step === step.n) return;
            ui.step = step.n;
            ui.formError = null;
            render();
          },
        },
      },
      h('span', { class: 'step-num', text: String(step.n).padStart(2, '0') }),
      h(
        'span',
        { class: 'step-text' },
        h('span', { class: 'step-name', text: step.name }),
        h('span', { class: 'step-meta', text: meta })
      ),
      h('span', {
        class: `step-dot${status === 'IN_PROGRESS' ? ' is-active' : ''}${status === 'COMPLETED' ? ' is-done' : ''}`,
        'aria-hidden': 'true',
      })
    );
    els.stepList.append(h('li', null, button));
  }
  els.stepCount.textContent = `step ${ui.step} / 10`;

  const decisions = ui.state?.decisions?.length ?? 0;
  if (!ui.state) els.saveState.textContent = 'Loading state…';
  else {
    els.saveState.textContent = decisions
      ? `Persisted · ${decisions} decision${decisions === 1 ? '' : 's'}`
      : 'Persisted · no decisions yet';
    els.saveState.classList.add('is-saved');
  }
}

/* ---------- Workspace header ---------- */

function renderHeader() {
  const step = stepByNumber(ui.step);
  els.crumb.textContent = `S${step.n} · ${step.name}`;
  els.title.textContent = step.n === 1 ? 'Market opportunity review' : step.name;
}

/* ---------- Step 1 workspace ---------- */

function renderWorkspace() {
  renderHeader();
  clear(els.body);

  if (ui.loadError) {
    els.body.append(
      h(
        'div',
        { class: 'error-card' },
        h('strong', { text: 'Could not load the slice state.' }),
        h('span', { text: ui.loadError }),
        h('button', {
          class: 'btn btn-ghost',
          type: 'button',
          text: 'Retry',
          on: { click: () => load() },
        })
      )
    );
    return;
  }

  if (!ui.mock || !ui.state) {
    els.body.append(h('p', { class: 'loading', text: 'Loading mock opportunities and persisted decisions…' }));
    return;
  }

  if (ui.step !== 1) {
    els.body.append(renderStepPlaceholder(stepByNumber(ui.step)));
    els.body.append(renderControls());
    return;
  }

  const opportunity = opportunityById(ui.viewId) || ui.mock.opportunities[0];
  ui.viewId = opportunity.id;

  els.body.append(renderMockBanner());
  els.body.append(renderMeasurementStrip());
  els.body.append(renderCandidates(opportunity));
  els.body.append(renderDetailHead(opportunity));

  const left = h(
    'div',
    { class: 'col' },
    renderEvidence(opportunity),
    renderAnalysis(opportunity)
  );
  const right = h(
    'div',
    { class: 'col' },
    renderBrief(opportunity),
    renderDecisionPanel(opportunity),
    renderHistory(opportunity)
  );

  els.body.append(h('div', { class: 'detail-grid' }, left, right));
  els.body.append(renderControls());
}

function renderMockBanner() {
  return h(
    'section',
    { class: 'notice notice-mock', 'aria-label': 'Mock data disclaimer' },
    h(
      'div',
      { class: 'notice-head' },
      badge('Mock data — not verified', 'badge-mock'),
      h('h2', { text: 'Synthetic demonstration dataset' })
    ),
    h('p', { text: ui.mock.meta.disclaimer }),
    h('p', {
      class: 'muted',
      style: 'margin-top:6px',
      text: 'Sources are mock:// references. No Shopee, TikTok or Facebook page was read for this slice.',
    })
  );
}

function renderMeasurementStrip() {
  return h(
    'section',
    { class: 'measure-strip', 'aria-label': 'Measurement status' },
    h('span', { class: 'measure-icon', text: 'OQ-8' }),
    h(
      'div',
      { class: 'measure-body' },
      h('p', { class: 'measure-title', text: 'Commission and net income: not yet measurable' }),
      h('p', { class: 'measure-text', text: ui.mock.meta.measurementPolicy }),
      h('p', {
        class: 'measure-text',
        text: 'Illustrative arithmetic below shows the shape of the calculation only. It is not a forecast, a target, or recorded earnings.',
      })
    )
  );
}

function renderCandidates(selected) {
  const cards = ui.mock.opportunities.map((opp) => {
    const latest = latestDecisionFor(opp.id);
    const active = opp.id === selected.id;
    return h(
      'button',
      {
        class: 'candidate',
        type: 'button',
        'aria-pressed': active ? 'true' : 'false',
        on: {
          click: () => {
            if (ui.viewId === opp.id) return;
            ui.viewId = opp.id;
            ui.formError = null;
            ui.draft = null;
            render();
          },
        },
      },
      h(
        'div',
        { class: 'candidate-top' },
        h('span', { class: 'candidate-id', text: opp.id }),
        latest ? decisionBadge(latest.decision) : badge('No decision', 'badge-neutral')
      ),
      h('span', { class: 'candidate-title', text: opp.title }),
      h('span', { class: 'candidate-niche', text: opp.niche }),
      h(
        'span',
        { class: 'candidate-foot' },
        h(
          'span',
          { class: `conf conf-${opp.confidence.level}` },
          h('span', { class: 'conf-dot', 'aria-hidden': 'true' }),
          `${opp.confidence.level} confidence`
        ),
        h('span', { text: `${opp.evidence.length} evidence` })
      )
    );
  });

  return h(
    'section',
    { 'aria-label': 'Candidate opportunities' },
    h(
      'div',
      { class: 'section-head' },
      h('h2', { text: 'Candidates' }),
      h('span', { class: 'section-note', text: `${ui.mock.opportunities.length} synthetic records · no real marketplace data` })
    ),
    h('div', { class: 'candidates' }, cards)
  );
}

function renderDetailHead(opp) {
  const latest = latestDecisionFor(opp.id);
  return h(
    'section',
    { class: 'detail-head' },
    h(
      'div',
      { class: 'detail-title-row' },
      h(
        'div',
        null,
        h('p', { class: 'detail-sub', text: `${opp.id} · ${opp.niche}` }),
        h('h2', { class: 'detail-title', text: opp.title })
      ),
      h(
        'div',
        { style: 'display:flex;gap:6px;flex-wrap:wrap' },
        badge('Synthetic', 'badge-mock'),
        h(
          'span',
          { class: `conf conf-${opp.confidence.level}` },
          h('span', { class: 'conf-dot', 'aria-hidden': 'true' }),
          `${opp.confidence.level} confidence`
        ),
        latest ? decisionBadge(latest.decision) : null
      )
    ),
    h('p', { class: 'muted', text: opp.confidence.reason }),
    h(
      'div',
      { class: 'fact-grid' },
      fact('Audience', opp.audience),
      fact('Problem', opp.problem),
      fact('Why now', opp.whyNow)
    )
  );
}

function fact(label, value) {
  return h(
    'div',
    null,
    h('p', { class: 'fact-label', text: label }),
    h('p', { class: 'fact-value', text: value })
  );
}

/* ---------- Evidence ---------- */

function renderEvidence(opp) {
  const counts = opp.evidence.reduce((acc, item) => {
    acc[item.claimClass] = (acc[item.claimClass] || 0) + 1;
    return acc;
  }, {});

  const summary = h(
    'div',
    { class: 'evidence-summary' },
    ['FACT', 'INFERENCE', 'UNKNOWN'].map((kind) =>
      badge(`${counts[kind] || 0} ${kind}`, `badge-${kind.toLowerCase()}`)
    )
  );

  const items = opp.evidence.map((item) =>
    h(
      'article',
      { class: 'evidence' },
      h(
        'div',
        { class: 'evidence-top' },
        h('span', { class: 'evidence-id', text: item.id }),
        classBadge(item.claimClass),
        badge('Mock', 'badge-mock'),
        h('span', { class: 'evidence-source', text: item.source })
      ),
      h('p', { class: 'evidence-finding', text: item.finding }),
      h(
        'div',
        { class: 'evidence-meta' },
        h(
          'span',
          null,
          h('strong', { text: 'Reference' }),
          h('code', { class: 'ref', text: item.urlOrReference })
        ),
        h(
          'span',
          null,
          h('strong', { text: 'Retrieved' }),
          `${item.retrievedAt} (synthetic)`
        ),
        h(
          'span',
          null,
          h('strong', { text: 'Relevance' }),
          item.relevance
        ),
        h(
          'span',
          null,
          h('strong', { text: 'Limitations' }),
          item.limitations
        )
      )
    )
  );

  return h(
    'section',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel-head' },
      h('h2', { text: 'Evidence' }),
      summary
    ),
    h(
      'div',
      { class: 'panel-body' },
      h('p', {
        class: 'muted',
        text: 'Every finding is tagged by claim class. UNKNOWN entries are assumptions or unchecked facts and must not drive a decision without verification.',
      }),
      h('div', { class: 'evidence-list' }, items)
    )
  );
}

/* ---------- Analysis ---------- */

function renderAnalysis(opp) {
  const analysis = opp.analysis;
  const rows = analysis.terms.map((term) =>
    h(
      'tr',
      null,
      h('td', { text: term.label }),
      h(
        'td',
        null,
        term.ref ? h('code', { class: 'ref', text: term.ref }) : h('span', { class: 'muted', text: '—' })
      ),
      h('td', { text: term.value }),
      h('td', null, h('span', { class: `basis basis-${term.basis}`, text: term.basis.replace('_', ' ') }))
    )
  );

  return h(
    'section',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel-head' },
      h('h2', { text: 'Analysis & forecast' }),
      badge('Illustrative only', 'badge-mock')
    ),
    h(
      'div',
      { class: 'panel-body' },
      h('div', null, h('p', { class: 'sub-label', text: 'Hypothesis to test' }), h('p', { class: 'hypothesis', text: analysis.hypothesis })),
      h(
        'div',
        null,
        h('p', { class: 'sub-label', text: 'Arithmetic terms' }),
        h(
          'table',
          { class: 'terms' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', { text: 'Term' }),
              h('th', { text: 'Evidence' }),
              h('th', { text: 'Value' }),
              h('th', { text: 'Basis' })
            )
          ),
          h('tbody', null, rows)
        )
      ),
      h(
        'div',
        { class: 'calc' },
        h('p', { class: 'calc-label', text: 'Illustrative arithmetic' }),
        h('p', { class: 'calc-expression', text: analysis.expression }),
        h(
          'p',
          { class: 'calc-result' },
          `THB ${new Intl.NumberFormat('en-US').format(analysis.illustrativeResultThb)}`,
          h('small', { text: 'illustrative' })
        ),
        h('p', { class: 'calc-note', text: analysis.resultNote })
      ),
      h(
        'div',
        { class: 'measure-strip', style: 'border-left-color:#8a5a04' },
        h('span', { class: 'measure-icon', text: 'MEASURE' }),
        h(
          'div',
          { class: 'measure-body' },
          h('p', { class: 'measure-title', text: opp.measurement.status.replaceAll('_', ' ') }),
          h('p', { class: 'measure-text', text: opp.measurement.reason })
        )
      ),
      h(
        'div',
        null,
        h('p', { class: 'sub-label', text: 'Risks' }),
        h('ul', { class: 'risk-list' }, analysis.risks.map((risk) => h('li', { text: risk })))
      )
    )
  );
}

/* ---------- Brief ---------- */

function renderBrief(opp) {
  const brief = opp.brief;
  const experiment = brief.proposedExperiment;

  return h(
    'section',
    { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h2', { text: 'Opportunity brief' }), badge('Draft', 'badge-neutral')),
    h(
      'div',
      { class: 'panel-body' },
      h('p', { class: 'brief-rationale', text: brief.rationale }),
      h(
        'div',
        { class: 'uncertainties' },
        h('p', { class: 'sub-label', text: 'Uncertainties that remain' }),
        h(
          'ul',
          { class: 'plain-list' },
          brief.uncertainties.map((item) => h('li', { text: item }))
        )
      ),
      h(
        'div',
        null,
        h('p', { class: 'sub-label', text: 'Proposed experiment (not approved)' }),
        h(
          'dl',
          { class: 'kv' },
          h('dt', { text: 'Offer' }),
          h('dd', { text: experiment.offer }),
          h('dt', { text: 'Channel' }),
          h('dd', { text: experiment.channel }),
          h('dt', { text: 'Link form' }),
          h('dd', null, h('code', { class: 'ref', text: experiment.linkForm })),
          h('dt', { text: 'Duration' }),
          h('dd', { text: `${experiment.durationDays} days` }),
          h('dt', { text: 'Budget' }),
          h('dd', { text: `THB ${experiment.budgetThb} (no G-pay record)` }),
          h('dt', { text: 'Observations' }),
          h('dd', {
            text: experiment.observationSchedule.length ? experiment.observationSchedule.join(' · ') : 'None — experiment not proposed',
          }),
          h('dt', { text: 'Success criteria' }),
          h('dd', { text: experiment.successCriteria })
        )
      ),
      h(
        'div',
        { class: 'suggested' },
        h('span', { class: 'muted', text: 'Slice suggestion, not a gate decision' }),
        badge(SUGGESTION_LABEL[brief.suggestedAction] || brief.suggestedAction, brief.suggestedAction === 'DO_NOT_PROCEED' ? 'badge-reject' : 'badge-neutral')
      )
    )
  );
}

/* ---------- Decision ---------- */

function renderDecisionPanel(opp) {
  const latest = latestDecisionFor(opp.id);
  const draft =
    ui.draft && ui.draft.opportunityId === opp.id
      ? ui.draft
      : { decision: latest?.decision || 'SELECT', reason: '' };
  const disabled = ui.submitting;

  const form = h(
    'form',
    {
      class: 'decision-form',
      novalidate: true,
      on: {
        submit: (event) => {
          event.preventDefault();
          submitDecision(opp.id);
        },
      },
    },
    h('p', { class: 'field-label', text: 'Your decision' }),
    h(
      'div',
      { class: 'choice-row', role: 'radiogroup', 'aria-label': 'Opportunity decision' },
      ['SELECT', 'REJECT', 'DEFER'].map((decision) =>
        h(
          'label',
          { class: 'choice' },
          h('input', {
            type: 'radio',
            name: 'decision',
            value: decision,
            checked: draft.decision === decision,
            disabled,
            on: {
              change: () => {
                ui.draft = { opportunityId: opp.id, decision, reason: form.querySelector('textarea').value };
                ui.formError = null;
              },
            },
          }),
          h('span', { class: 'choice-key', text: DECISION_LABEL[decision] }),
          h('span', {
            class: 'choice-hint',
            text:
              decision === 'SELECT'
                ? 'Take forward for G2 drafting'
                : decision === 'REJECT'
                  ? 'Drop this candidate'
                  : 'Hold for more evidence',
          })
        )
      )
    ),
    h(
      'div',
      null,
      h('label', { class: 'field-label', for: `reason-${opp.id}`, text: 'Reason (required)' }),
      h('textarea', {
        id: `reason-${opp.id}`,
        name: 'reason',
        maxlength: 1000,
        placeholder: 'What evidence or gap drives this decision?',
        disabled,
        value: draft.reason,
        on: {
          input: (event) => {
            ui.draft = {
              opportunityId: opp.id,
              decision: form.querySelector('input[name="decision"]:checked')?.value || 'SELECT',
              reason: event.target.value,
            };
          },
        },
      })
    ),
    ui.formError ? h('p', { class: 'form-error', tabindex: -1, text: ui.formError }) : null,
    h(
      'div',
      { class: 'form-foot' },
      h('button', {
        class: 'btn btn-primary',
        type: 'submit',
        text: ui.submitting ? 'Recording…' : 'Record decision',
        disabled,
      }),
      h('span', { class: 'form-note', text: 'Appends to local history. No gate, spend, or external action.' })
    ),
    h('p', {
      class: 'form-note',
      text: 'This is an opportunity decision only. G1 remains plan-level approval; G2–G5 stay unapproved, and nothing is published or purchased.',
    })
  );

  return h(
    'section',
    { class: 'panel', id: 'decision-panel', tabindex: -1 },
    h('div', { class: 'panel-head' }, h('h2', { text: 'Human decision' }), latest ? badge('Recorded', 'badge-select') : badge('Required', 'badge-neutral')),
    h(
      'div',
      { class: 'panel-body' },
      latest
        ? h(
            'div',
            { class: 'latest-decision' },
            decisionBadge(latest.decision),
            h(
              'div',
              null,
              h('p', { text: latest.reason || 'No reason recorded.' }),
              h('p', {
                class: 'muted',
                text: `${latest.id} · ${formatDate(latest.at)} · ${latest.actor}`,
              })
            )
          )
        : h('p', { class: 'muted', text: 'No decision recorded yet for this candidate.' }),
      form
    )
  );
}

async function submitDecision(opportunityId) {
  if (ui.submitting) return;
  const form = els.body.querySelector('#decision-panel form');
  if (!form) return;

  const decision = form.querySelector('input[name="decision"]:checked')?.value || '';
  const reason = form.querySelector('textarea').value.trim();

  if (!decision) {
    ui.formError = 'Choose select, reject or defer.';
    renderWorkspace();
    focusFormError();
    return;
  }
  if (reason.length < 3) {
    ui.formError = 'A reason of at least 3 characters is required to record a decision.';
    renderWorkspace();
    focusFormError();
    return;
  }
  if (reason.length > 1000) {
    ui.formError = 'The reason must be 1000 characters or fewer.';
    renderWorkspace();
    focusFormError();
    return;
  }

  ui.submitting = true;
  ui.formError = null;
  renderWorkspace();

  try {
    const response = await fetch('/api/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ opportunityId, decision, reason }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const details = Array.isArray(payload.details) ? ` ${payload.details.join('; ')}` : '';
      throw new Error(`${payload.error || `Request failed (${response.status})`}${details}`);
    }

    ui.state = payload.state;
    ui.draft = null;
    ui.submitting = false;
    renderSidebar();
    renderWorkspace();
    document.getElementById('decision-panel')?.focus({ preventScroll: true });
    toast(`${payload.recorded.id} recorded: ${DECISION_LABEL[payload.recorded.decision] || payload.recorded.decision}.`);
  } catch (error) {
    ui.submitting = false;
    ui.formError = `Could not record the decision. ${error.message}`;
    renderWorkspace();
    toast('Decision was not recorded.', true);
  }
}

function focusFormError() {
  const error = els.body.querySelector('.form-error');
  if (error) error.focus({ preventScroll: false });
}

/* ---------- History ---------- */

function renderHistory(opp) {
  const all = ui.state?.decisions || [];
  const items = [...all].reverse();

  return h(
    'section',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel-head' },
      h('h2', { text: 'Decision history' }),
      h('span', { class: 'section-note', text: `${all.length} total` })
    ),
    h(
      'div',
      { class: 'panel-body' },
      items.length === 0
        ? h('p', { class: 'empty', text: 'No decisions recorded. History survives a restart because it is written to data/app/state.json.' })
        : h(
            'ol',
            { class: 'history' },
            items.map((item) => {
              const target = opportunityById(item.opportunityId);
              return h(
                'li',
                null,
                h(
                  'div',
                  { class: 'history-top' },
                  decisionBadge(item.decision),
                  h('span', { class: 'history-opp', text: target ? target.title : item.opportunityId }),
                  h('span', { class: 'history-id', text: item.id })
                ),
                h('p', { class: 'history-time', text: formatDate(item.at) }),
                h('p', { class: 'history-reason', text: item.reason || 'No reason recorded.' }),
                item.opportunityId === opp.id ? h('p', { class: 'history-opp', text: 'Current candidate' }) : null
              );
            })
          )
    )
  );
}

/* ---------- Placeholder steps ---------- */

function renderStepPlaceholder(step) {
  return h(
    'section',
    { class: 'step-placeholder' },
    h('div', { class: 'placeholder-meta' }, badge(`Step ${step.n} of 10`, 'badge-neutral'), badge('Not implemented in this slice', 'badge-mock')),
    h('h2', { text: step.name }),
    h('p', { text: step.purpose }),
    h('p', {
      class: 'muted',
      text:
        'This vertical slice implements Step 1 review only. Step 2 material appears read-only inside the Step 1 review, and Steps 2–10 have no edits, records, or gates here.',
    }),
    h(
      'div',
      null,
      h('p', { class: 'sub-label', text: 'Gate at exit' }),
      h('p', {
        text:
          step.gate === 'No gate'
            ? 'No gate at this step.'
            : `${step.gate} is not requested by this slice. An approved G1 does not imply approval of ${step.gate}.`,
      })
    ),
    h('button', {
      class: 'btn btn-ghost',
      type: 'button',
      text: 'Back to Step 1 review',
      on: {
        click: () => {
          ui.step = 1;
          render();
        },
      },
    })
  );
}

/* ---------- Controls ---------- */

function renderControls() {
  const prev = stepByNumber(Math.max(1, ui.step - 1));
  return h(
    'div',
    { class: 'controls' },
    h(
      'div',
      { class: 'controls-buttons' },
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: '← Prev',
        disabled: ui.step === 1,
        title: ui.step === 1 ? 'Step 1 is the first step' : `Review Step ${prev.n} — ${prev.name}`,
        on: {
          click: () => {
            if (ui.step === 1) return;
            ui.step -= 1;
            ui.formError = null;
            render();
          },
        },
      }),
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'Edit',
        disabled: true,
        title: 'Editing step outputs is outside this vertical slice',
      }),
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        text: 'Next →',
        disabled: true,
        title: 'Workflow advancement needs gate decisions and is outside this slice',
      })
    ),
    h('p', {
      class: 'controls-note',
      text:
        'Read-only controls. Next stays disabled: this slice records opportunity decisions only and never advances the workflow or approves a gate.',
    })
  );
}

/* ---------- Boot ---------- */

function render() {
  renderSidebar();
  renderWorkspace();
}

async function load() {
  ui.loadError = null;
  render();
  try {
    const [mock, state] = await Promise.all([getJson('/api/opportunities'), getJson('/api/state')]);
    ui.mock = mock;
    ui.state = state;
    if (!ui.viewId || !mock.opportunities.some((o) => o.id === ui.viewId)) {
      ui.viewId = state.selectedOpportunityId || mock.opportunities[0]?.id || null;
    }
    render();
  } catch (error) {
    ui.loadError = error.message;
    render();
  }
}

load();
