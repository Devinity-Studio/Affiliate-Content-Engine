'use strict';

/**
 * ACE — stage views.
 *
 * Each pipeline stage renders only the records and tools that belong to it:
 *   Profile & Channels  → who we publish as, and on which platform
 *   Plan & AI Video     → the four beats, timecodes and frame preview
 *   Production & Finalize → storyboard, Thai voice, QC, finalize, export
 *   Schedule & Task     → calendar per profile, publish queue, library
 *   Analytics           → recorded results, revenue totals and ranking
 *
 * Everything reads from the same state the server returns, so a number shown
 * here is the number the API produced — no client-side rewriting.
 */

const PLATFORM_STATUS_TEXT = {
  LIVE: 'พร้อมใช้',
  PLANNED: 'รองรับในอนาคต',
};

const BEAT_TONE = {
  hook: 'is-hook',
  action: 'is-action',
  payoff: 'is-payoff',
  cta: 'is-cta',
};

/* ---------- shared ---------- */

function stageNotice(title, body, action) {
  return h('section', { class: 'notice' },
    h('div', { class: 'notice-head' }, h('h2', { text: title })),
    body ? h('p', { text: body }) : null,
    action || null,
  );
}

function stageLink(label, section) {
  return h('button', { type: 'button', class: 'link-btn', on: { click: () => go(section) } }, label);
}

function profileOptions(state) {
  return (state.profiles || []).map((profile) => ({ id: profile.id, label: `${profile.name} · ${profile.platform_label || profile.platform}` }));
}

/* ---------- Profile & Channels ---------- */

function profileFormState() {
  if (!ui.profileForm) {
    ui.profileForm = { name: '', platform: 'SHOPEE', handle: '', status: 'ACTIVE' };
  }
  return ui.profileForm;
}

async function createProfile() {
  const form = profileFormState();
  const res = await api('/api/mvp/profiles', 'POST', {
    name: form.name,
    platform: form.platform,
    handle: form.handle,
    status: form.status,
  });
  applyState(res.state);
  ui.profileForm = { name: '', platform: 'SHOPEE', handle: '', status: 'ACTIVE' };
  return res.profile;
}

async function activateProfile(id) {
  const res = await api(`/api/mvp/profiles/${encodeURIComponent(id)}/activate`, 'POST', {});
  applyState(res.state);
  return res.profile;
}

async function setProfileStatus(id, status) {
  const res = await api(`/api/mvp/profiles/${encodeURIComponent(id)}`, 'PATCH', { status });
  applyState(res.state);
  return res.profile;
}

function renderProfileChannels() {
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });
  if (!state) return wrap;
  const active = state.active_profile || null;
  const profiles = state.profiles || [];
  const platforms = state.platforms || [];
  const form = profileFormState();

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Profile & Channels · active' }),
        h('h2', { text: active ? `${active.name}` : 'ยังไม่มีโปรไฟล์' }),
      ),
      h('div', { class: 'head-meta' },
        active ? badge(active.platform_label || active.platform, 'badge-fact') : null,
        active ? badge(active.status, active.status === 'ACTIVE' ? 'badge-select' : 'badge-neutral') : null,
      ),
    ),
    active
      ? h('dl', { class: 'kv compact' },
        h('div', null, h('dt', { text: 'profile_id' }), h('dd', { class: 'mono', text: active.id })),
        h('div', null, h('dt', { text: 'แพลตฟอร์ม' }), h('dd', { text: `${active.platform_label} (${active.platform_status})` })),
        h('div', null, h('dt', { text: 'ช่องทางเผยแพร่' }), h('dd', { class: 'mono', text: active.channel })),
        h('div', null, h('dt', { text: 'บัญชี / handle' }), h('dd', { text: active.handle || '—' })),
        h('div', null, h('dt', { text: 'ภาษา / สัดส่วน' }), h('dd', { text: `${active.language} · ${active.aspect_ratio}` })),
        h('div', null, h('dt', { text: 'เวลาลงโพสต์' }), h('dd', { text: `${active.posting.time} · ${(active.posting.weekdays || []).join(', ')}` })),
        h('div', null, h('dt', { text: 'คอนเทนต์ในช่องทาง' }), h('dd', { text: `${active.counts.contents} งาน · ${active.counts.scheduled} ตั้งเวลา · ${active.counts.published} เผยแพร่` })),
      )
      : null,
    h('p', { class: 'note' }, 'ทุกขั้นตอนของ pipeline ผูกกับโปรไฟล์ที่ active อยู่ — เปลี่ยนโปรไฟล์แล้วงานใหม่จะถูกสร้างใต้ช่องทางนั้นทันที โดยใช้ core workflow ชุดเดียวกัน'),
  ));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Platforms' }),
        h('h2', { text: `${platforms.length} แพลตฟอร์ม · core workflow เดียวกัน` }),
      ),
      badge('multi-platform architecture', 'badge-neutral'),
    ),
    h('div', { class: 'table-scroll' },
      h('table', { class: 'mvp-table compact' },
        h('thead', null, h('tr', null,
          h('th', { text: 'แพลตฟอร์ม' }),
          h('th', { text: 'สถานะ' }),
          h('th', { text: 'ลิงก์' }),
          h('th', { text: 'สัดส่วน / ความยาว' }),
          h('th', { text: 'ความสามารถ' }),
        )),
        h('tbody', null, platforms.map((platform) => h('tr', null,
          h('td', null,
            h('p', { class: 'cell-title', text: platform.label }),
            h('p', { class: 'cell-sub mono', text: platform.key }),
          ),
          h('td', null, badge(PLATFORM_STATUS_TEXT[platform.status] || platform.status, platform.status === 'LIVE' ? 'badge-fact' : 'badge-neutral')),
          h('td', { class: 'mono small', text: platform.link_kind }),
          h('td', { class: 'small', text: `${platform.aspect_ratio} · ≤${platform.max_duration_s}s` }),
          h('td', { class: 'small', text: Object.entries(platform.capabilities || {})
            .filter(([, on]) => on).map(([key]) => key).join(' · ') || '—' }),
        ))),
      ),
    ),
  ));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Profiles' }),
        h('h2', { text: `${profiles.length} โปรไฟล์` }),
      ),
    ),
    h('ul', { class: 'list' }, profiles.map((profile) => h('li', { class: 'cell' },
      h('div', null,
        h('p', { class: 'cell-title', text: `${profile.name}${profile.active ? ' · ใช้งานอยู่' : ''}` }),
        h('p', { class: 'cell-sub', text: `${profile.id} · ${profile.platform_label} · ${profile.handle || 'ไม่มี handle'} · ${profile.counts.contents} คอนเทนต์` }),
      ),
      h('div', { class: 'toolbar' },
        profile.active
          ? badge('ACTIVE', 'badge-select')
          : h('button', {
            type: 'button', class: 'btn btn-ghost', disabled: ui.busy || profile.status !== 'ACTIVE',
            on: { click: () => run(() => activateProfile(profile.id), `สลับไปใช้ ${profile.name}`) },
          }, 'ใช้โปรไฟล์นี้'),
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
          on: {
            click: () => run(
              () => setProfileStatus(profile.id, profile.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'),
              profile.status === 'ACTIVE' ? 'พักโปรไฟล์แล้ว' : 'เปิดโปรไฟล์แล้ว',
            ),
          },
        }, profile.status === 'ACTIVE' ? 'พัก' : 'เปิด'),
      ),
    ))),
    h('div', { class: 'profile-form' },
      h('p', { class: 'sub-head', text: 'เพิ่มโปรไฟล์ช่องทางใหม่' }),
      h('div', { class: 'field inline' },
        h('label', { class: 'field' },
          h('span', { class: 'field-label', text: 'ชื่อโปรไฟล์' }),
          h('input', {
            type: 'text', value: form.name, placeholder: 'เช่น TikTok Affiliate สายของใช้',
            on: { input: (event) => { form.name = event.target.value; } },
          }),
        ),
        h('label', { class: 'field' },
          h('span', { class: 'field-label', text: 'แพลตฟอร์ม' }),
          h('select', {
            on: { change: (event) => { form.platform = event.target.value; } },
          }, platforms.map((platform) => h('option', {
            value: platform.key, text: platform.label, selected: platform.key === form.platform,
          }))),
        ),
        h('label', { class: 'field' },
          h('span', { class: 'field-label', text: 'Handle' }),
          h('input', {
            type: 'text', value: form.handle, placeholder: '@channel',
            on: { input: (event) => { form.handle = event.target.value; } },
          }),
        ),
      ),
      h('div', { class: 'toolbar' },
        h('button', {
          type: 'button', class: 'btn btn-primary', disabled: ui.busy,
          on: { click: () => run(createProfile, 'เพิ่มโปรไฟล์แล้ว — กด "ใช้โปรไฟล์นี้" เพื่อสลับ') },
        }, 'เพิ่มโปรไฟล์'),
        h('p', { class: 'note' }, 'โปรไฟล์ใหม่ใช้ core workflow เดิมทั้งชุด (Research → Plan → Production → Schedule → Analytics)'),
      ),
    ),
  ));

  const unassigned = (state.contents || []).filter((project) => !project.profile_id);
  if (unassigned.length) {
    wrap.append(h('section', { class: 'mvp-card' },
      h('div', { class: 'card-head' },
        h('div', null,
          h('p', { class: 'eyebrow', text: 'Legacy records' }),
          h('h2', { text: `${unassigned.length} คอนเทนต์ที่สร้างก่อนมีโปรไฟล์` }),
        ),
        badge('ยังไม่ผูกโปรไฟล์', 'badge-neutral'),
      ),
      h('p', { class: 'note' }, 'รายการเหล่านี้ยังไม่ถูกใส่ชื่อช่องทาง — ระบบไม่เดาให้ คอนเทนต์ที่สร้างใหม่จะผูกกับโปรไฟล์ที่ active อัตโนมัติ'),
      h('ul', { class: 'list' }, unassigned.map((project) => h('li', { class: 'cell' },
        h('div', null,
          h('p', { class: 'cell-title', text: project.content_id }),
          h('p', { class: 'cell-sub', text: `${project.status} · ${(project.offer_snapshot || {}).product_name || ''}` }),
        ),
      ))),
    ));
  }

  wrap.append(renderAiStatusCard());
  return wrap;
}

/* ---------- Plan & AI Video ---------- */

async function loadPlan(contentId) {
  ui.plan = { contentId, data: null, project: null, loading: true, error: null };
  render();
  try {
    const res = await api(`/api/mvp/content/${encodeURIComponent(contentId)}/plan`);
    if (!ui.plan || ui.plan.contentId !== contentId) return;
    ui.plan = { contentId, data: res.plan, project: res.project, loading: false, error: null };
  } catch (err) {
    if (!ui.plan || ui.plan.contentId !== contentId) return;
    ui.plan = { contentId, data: null, project: null, loading: false, error: err.message };
  }
  render();
}

function renderPlanBeats(plan) {
  return h('div', { class: 'beat-grid' }, plan.beats.map((beat, index) => h('article', {
    class: `beat-card ${BEAT_TONE[beat.id] || ''}${beat.filled ? '' : ' is-empty'}`,
  },
  h('div', { class: 'beat-head' },
    h('div', null,
      h('p', { class: 'eyebrow', text: `ช่วง ${index + 1}` }),
      h('h3', { class: 'beat-title', text: beat.label }),
    ),
    badge(beat.filled ? (beat.timecode || 'มีข้อมูล') : 'ยังไม่มีฉาก', beat.filled ? 'badge-neutral' : 'badge-reject'),
  ),
  h('p', { class: 'cell-sub', text: beat.purpose }),
  beat.scene_ids.length
    ? h('p', { class: 'trace mono small', text: `scenes: ${beat.scene_ids.join(' · ')} · ${beat.duration_s}s` })
    : h('p', { class: 'note', text: 'ยังไม่มีฉากในส่วนนี้ของสตอรี่บอร์ด' }),
  beat.headlines.length
    ? h('ul', { class: 'plain-list tight' }, beat.headlines.map((line) => h('li', { class: 'cell-title', text: line })))
    : null,
  beat.lines.length
    ? h('ul', { class: 'plain-list tight' }, beat.lines.map((line) => h('li', { class: 'small', text: line })))
    : null,
  beat.evidence_ids.length ? h('p', { class: 'trace mono small', text: `evidence: ${beat.evidence_ids.join(' · ')}` }) : null,
  )));
}

function renderPlanFrames(plan) {
  if (!plan.frames.length) return null;
  return h('div', { class: 'frame-strip' }, plan.frames.map((frame) => h('figure', { class: 'frame-card' },
    h('div', { class: `frame-visual preset-${frame.preset || 'dark'}` },
      h('p', { class: 'frame-badge', text: frame.badge || '' }),
      h('p', { class: 'frame-headline', text: frame.headline || '—' }),
      h('p', { class: 'frame-subhead', text: frame.subhead || '' }),
      frame.fact ? h('p', { class: 'frame-fact', text: frame.fact }) : null,
    ),
    h('figcaption', null,
      h('p', { class: 'mono small', text: `${frame.scene_id} · ${frame.timecode}` }),
      h('p', { class: 'cell-sub', text: frame.role || '—' }),
    ),
  )));
}

function renderPlanStage() {
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });
  if (!state || !state.import) {
    wrap.append(stageNotice('ยังไม่มีข้อมูลพูลสินค้า', 'เริ่มจาก Research & Candidate Pool ก่อน', stageLink('ไปที่ Research →', 'research')));
    return wrap;
  }
  const contents = state.contents || [];
  if (!contents.length || ui.contentNew) {
    wrap.append(h('section', { class: 'mvp-card' },
      h('div', { class: 'card-head' },
        h('div', null,
          h('p', { class: 'eyebrow', text: 'Plan & AI Video Generation' }),
          h('h2', { text: 'เลือกแนวทางและสร้างสคริปต์ 4 ช่วง' }),
        ),
      ),
      h('p', { class: 'note' }, 'เลือก Candidate หรือ Plan ที่บันทึกไว้ แล้วระบบจะสร้าง Storyboard 5 ฉากที่อ่านเป็น 4 ช่วง (Hook → Action → Payoff → CTA) พร้อมไทม์โค้ด'),
      contents.length ? h('div', { class: 'toolbar' },
        h('button', {
          type: 'button', class: 'btn btn-ghost',
          on: { click: () => { ui.contentNew = false; render(); } },
        }, '← กลับไปดูแผนของคอนเทนต์เดิม'),
      ) : null,
    ));
    if (!contents.length && !eligibleCandidates().length) {
      wrap.append(stageNotice('ยังไม่มี Candidate ที่พร้อมผลิต', 'Save หรือ Add to queue รายการใน Research ก่อน แล้วกลับมาที่ Plan stage',
        stageLink('ไปที่ Research →', 'research')));
      return wrap;
    }
    const create = renderContentCreate();
    if (create) wrap.append(create);
    return wrap;
  }
  const project = contents.find((item) => item.content_id === ui.contentId) || contents[contents.length - 1];
  const planState = ui.plan && ui.plan.contentId === project.content_id ? ui.plan : null;

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Plan & AI Video Generation' }),
        h('h2', { text: `${project.content_id} · ${project.offer_snapshot ? project.offer_snapshot.product_name : ''}` }),
      ),
      h('div', { class: 'head-meta' },
        badge(project.profile_id || 'ไม่มีโปรไฟล์', 'badge-neutral'),
        badge(`script v${project.script_version}`, 'badge-neutral'),
        badge(project.status, CONTENT_STATUS_BADGE[project.status] || 'badge-neutral'),
      ),
    ),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
        on: { click: () => { ui.contentNew = true; render(); } },
      }, '+ สร้างคอนเทนต์ใหม่จาก Candidate'),
    ),
    contents.length > 1
      ? h('div', { class: 'toolbar' },
        h('label', { class: 'small' }, 'คอนเทนต์ ',
          h('select', {
            on: {
              change: (event) => {
                ui.contentId = event.target.value;
                loadPlan(ui.contentId);
              },
            },
          }, contents.map((item) => h('option', {
            value: item.content_id,
            text: `${item.content_id} · ${item.status}`,
            selected: item.content_id === project.content_id,
          })))),
      )
      : null,
    h('p', { class: 'note' }, 'สคริปต์ถูกอ่านเป็น 4 ช่วง (Hook → Action → Payoff → Call to Action) พร้อมไทม์โค้ดและพรีวิวเฟรม — การเปิดหน้านี้ไม่แก้สตอรี่บอร์ด'),
  ));

  if (!planState || planState.loading || !planState.data) {
    // A content item created from this stage arrives without a cached plan, so
    // the stage fetches it once instead of showing an empty timeline.
    if (!(ui.plan && ui.plan.loading)) {
      setTimeout(() => loadPlan(project.content_id), 0);
    }
    wrap.append(stageNotice('กำลังโหลดแผน…', 'อ่านโครง 4 ช่วงและไทม์โค้ดจากสตอรี่บอร์ดปัจจุบัน'));
    return wrap;
  }
  if (planState.error) {
    wrap.append(h('section', { class: 'notice notice-error' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'อ่านแผนไม่ได้' })),
      h('p', { class: 'error-text', text: planState.error }),
    ));
    return wrap;
  }
  const plan = planState.data;
  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Hook & structure' }),
        h('h2', { text: plan.hook || 'ยังไม่มี Hook' }),
      ),
      h('div', { class: 'head-meta' },
        badge(`${plan.total_duration_s}s · ${plan.scene_count} ฉาก`, 'badge-neutral'),
        badge(`checksum ${String(plan.script_checksum || '').slice(0, 12) || '—'}`, 'badge-neutral'),
      ),
    ),
    plan.missing_beats.length
      ? h('p', { class: 'warn', text: `ยังขาดช่วง: ${plan.missing_beats.join(' · ')}` })
      : h('p', { class: 'note', text: 'ครบทั้ง 4 ช่วงตามโครง Hook → Action → Payoff → CTA' }),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => {
            ui.contentTab = 'storyboard';
            go('production');
          },
        },
      }, 'ไปตัดต่อ / ผลิตต่อ →'),
      h('button', {
        type: 'button', class: 'btn btn-ghost',
        on: { click: () => openTrace(project.candidate_id) },
      }, 'ดูไทม์ไลน์ candidate'),
    ),
  ));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: '4 beats' }),
        h('h2', { text: 'โครงสคริปต์ 4 ช่วง' }),
      ),
    ),
    renderPlanBeats(plan),
  ));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Frame preview' }),
        h('h2', { text: `${plan.frames.length} เฟรมตามไทม์โค้ด` }),
      ),
      badge('9:16', 'badge-neutral'),
    ),
    renderPlanFrames(plan),
  ));
  return wrap;
}

/* ---------- Production & Finalize ---------- */

function renderProductionStage() {
  const wrap = h('div', { class: 'stack' });
  wrap.append(renderContent());
  return wrap;
}

/* ---------- Schedule & Task ---------- */

function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function renderScheduleCalendar() {
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });
  const profiles = state.profiles || [];
  const active = state.active_profile || null;
  if (!ui.scheduleProfileId) ui.scheduleProfileId = active ? active.id : null;
  const profileId = ui.scheduleProfileId;
  const profile = profiles.find((item) => item.id === profileId) || active;

  const scheduled = (state.contents || [])
    .filter((project) => project && project.publish_schedule)
    .filter((project) => !profileId || project.profile_id === profileId || !project.profile_id);
  const byDay = new Map();
  for (const project of scheduled) {
    const date = new Date(project.publish_schedule.scheduled_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = localDayKey(date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(project);
  }

  const days = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    days.push(day);
  }

  const unscheduled = (state.contents || [])
    .filter((project) => !project.publish_schedule)
    .filter((project) => ['FINALIZED', 'EXPORTED', 'READY_TO_PUBLISH'].includes(project.status));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Schedule & Task · 7 วัน' }),
        h('h2', { text: profile ? `${profile.name} · ${profile.channel}` : 'ทุกช่องทาง' }),
      ),
      h('div', { class: 'head-meta' },
        badge(`${scheduled.filter((project) => project.publish_schedule.status === 'SCHEDULED').length} ตั้งเวลา`, 'badge-neutral'),
        badge(`${scheduled.filter((project) => project.publish_schedule.status === 'QUEUED').length} รออนุมัติ`, 'badge-reject'),
        badge(`${scheduled.filter((project) => project.publish_schedule.status === 'PUBLISHED').length} เผยแพร่แล้ว`, 'badge-select'),
      ),
    ),
    h('div', { class: 'toolbar' },
      h('label', { class: 'small' }, 'โปรไฟล์ ',
        h('select', {
          on: {
            change: (event) => {
              ui.scheduleProfileId = event.target.value || null;
              render();
            },
          },
        }, h('option', { value: '', text: 'ทุกช่องทาง', selected: !profileId },
          profiles.map((item) => h('option', {
            value: item.id, text: item.name, selected: item.id === profileId,
          })))),
      ),
      h('p', { class: 'note' }, 'ปฏิทินนี้รวมกำหนดเผยแพร่ของโปรไฟล์ที่เลือก พร้อมสถานะคิวและการอนุมัติ'),
    ),
    h('div', { class: 'calendar' }, days.map((day) => {
      const key = localDayKey(day);
      const items = (byDay.get(key) || []).sort((a, b) => String(a.publish_schedule.scheduled_at).localeCompare(String(b.publish_schedule.scheduled_at)));
      return h('div', { class: 'calendar-day' },
        h('p', { class: 'calendar-date', text: day.toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit', month: 'short' }) }),
        items.length
          ? h('div', { class: 'calendar-items' }, items.map((project) => h('div', {
            class: `calendar-item is-${String(project.publish_schedule.status).toLowerCase()}`,
          },
          h('p', { class: 'mono small', text: new Date(project.publish_schedule.scheduled_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }),
          h('p', { class: 'cell-title', text: project.content_id }),
          h('p', { class: 'cell-sub', text: (project.offer_snapshot || {}).product_name || '' }),
          h('p', { class: 'small', text: PUBLISH_STATUS_TEXT[project.publish_schedule.status] || project.publish_schedule.status }),
          )))
          : h('p', { class: 'calendar-empty', text: 'ว่าง' }),
      );
    })),
  ));

  if (unscheduled.length) {
    wrap.append(h('section', { class: 'mvp-card' },
      h('div', { class: 'card-head' },
        h('div', null,
          h('p', { class: 'eyebrow', text: 'Tasks' }),
          h('h2', { text: `${unscheduled.length} งานที่ยังไม่ตั้งเวลา` }),
        ),
      ),
      h('ul', { class: 'list' }, unscheduled.map((project) => h('li', { class: 'cell' },
        h('div', null,
          h('p', { class: 'cell-title', text: `${project.content_id} · ${(project.offer_snapshot || {}).product_name || ''}` }),
          h('p', { class: 'cell-sub', text: `${project.status} · ${project.profile_id || 'ไม่ระบุโปรไฟล์'}` }),
        ),
        h('button', {
          type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
          on: { click: () => { ui.contentId = project.content_id; ui.contentTab = 'publish'; render(); } },
        }, 'ตั้งเวลา →'),
      ))),
    ));
  }
  return wrap;
}

function renderScheduleStage() {
  const wrap = h('div', { class: 'stack' });
  wrap.append(renderScheduleCalendar());
  wrap.append(renderContent());
  wrap.append(renderLibrary());
  return wrap;
}

/* ---------- Analytics ---------- */

async function loadAnalytics(profileId) {
  ui.analytics = { ...(ui.analytics || {}), loading: true, error: null, profileFilter: profileId || null };
  render();
  try {
    const query = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : '';
    const data = await api(`/api/mvp/analytics${query}`);
    ui.analytics = { data, loading: false, error: null, profileFilter: profileId || null };
  } catch (err) {
    ui.analytics = { data: null, loading: false, error: err.message, profileFilter: profileId || null };
  }
  render();
}

function analyticsFormState() {
  if (!ui.analyticsForm) ui.analyticsForm = { content_id: '', clicks: '', orders: '', commission_thb: '', note: '' };
  return ui.analyticsForm;
}

function collectResultForm() {
  const read = (id) => {
    const node = document.getElementById(id);
    return node ? node.value : '';
  };
  const contentId = read('result-content');
  if (!contentId) throw new Error('เลือกคอนเทนต์ที่เผยแพร่แล้วก่อน');
  return {
    content_id: contentId,
    clicks: read('result-clicks') === '' ? 0 : Number(read('result-clicks')),
    orders: read('result-orders') === '' ? 0 : Number(read('result-orders')),
    commission_thb: read('result-commission') === '' ? 0 : Number(read('result-commission')),
    note: read('result-note'),
  };
}

// The payload is collected before run() re-renders the form; reading the inputs
// again inside the async body would read the rebuilt (empty) fields.
async function submitResult(payload) {
  const res = await api('/api/mvp/results', 'POST', payload);
  applyState(res.state);
  ui.analyticsForm = { content_id: '', clicks: '', orders: '', commission_thb: '', note: '' };
  ui.analytics = { data: res.analytics, loading: false, error: null, profileFilter: ui.analytics ? ui.analytics.profileFilter : null };
}

function renderAnalyticsTotals(totals) {
  const cell = (label, value, note) => h('div', { class: 'score' },
    h('span', { class: 'score-val', text: value }),
    h('span', { class: 'score-label', text: label }),
    note ? h('span', { class: 'cell-sub', text: note }) : null,
  );
  return h('div', { class: 'analytics-grid' },
    cell('รายได้รวม (THB)', totals.commission_thb.toFixed(2), `${totals.published} คอนเทนต์ที่เผยแพร่`),
    cell('ออเดอร์', String(totals.orders), `${totals.clicks} คลิก`),
    cell('Conversion', totals.conversion_rate === null ? '—' : `${totals.conversion_rate}%`, 'orders ÷ clicks'),
    cell('เฉลี่ยต่อออเดอร์', totals.commission_per_order === null ? '—' : `${totals.commission_per_order.toFixed(2)}`, 'THB'),
    cell('ยังไม่บันทึกผล', String(totals.missing_results), 'ต้องกรอกจากรายงาน Affiliate'),
  );
}

function renderAnalyticsStage() {
  const state = ui.state;
  const wrap = h('div', { class: 'stack' });
  if (!state) return wrap;
  const analytics = ui.analytics || {};
  const data = analytics.data;

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Analytics Dashboard' }),
        h('h2', { text: 'ผลลัพธ์รายได้และอันดับคอนเทนต์' }),
      ),
      h('div', { class: 'head-meta' },
        badge('THB', 'badge-neutral'),
        badge('manual results', 'badge-neutral'),
      ),
    ),
    h('div', { class: 'toolbar' },
      h('label', { class: 'small' }, 'โปรไฟล์ ',
        h('select', {
          on: {
            change: (event) => loadAnalytics(event.target.value || null),
          },
        }, h('option', { value: '', text: 'ทุกโปรไฟล์', selected: !analytics.profileFilter },
          (state.profiles || []).map((profile) => h('option', {
            value: profile.id, text: profile.name, selected: profile.id === analytics.profileFilter,
          })))),
      ),
      h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: ui.busy || analytics.loading,
        on: { click: () => loadAnalytics(analytics.profileFilter || null) },
      }, analytics.loading ? 'กำลังโหลด…' : 'โหลดใหม่'),
    ),
    h('p', { class: 'note' }, 'ตัวเลขทั้งหมดมาจากการบันทึกผลด้วยมือจากรายงาน Affiliate — ระบบไม่ดึงยอดจากแพลตฟอร์มเอง และไม่เดารายได้'),
  ));

  if (analytics.error) {
    wrap.append(h('section', { class: 'notice notice-error' },
      h('div', { class: 'notice-head' }, h('h2', { text: 'อ่าน Analytics ไม่ได้' })),
      h('p', { class: 'error-text', text: analytics.error }),
    ));
    return wrap;
  }
  if (!data) {
    wrap.append(stageNotice(analytics.loading ? 'กำลังโหลด Analytics…' : 'ยังไม่ได้โหลด Analytics', null));
    return wrap;
  }

  wrap.append(renderAnalyticsTotals(data.totals));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Ranking' }),
        h('h2', { text: `${data.by_content.length} คอนเทนต์ที่เผยแพร่` }),
      ),
    ),
    data.by_content.length
      ? h('div', { class: 'table-scroll' },
        h('table', { class: 'mvp-table compact' },
          h('thead', null, h('tr', null,
            h('th', { text: '#' }),
            h('th', { text: 'คอนเทนต์' }),
            h('th', { text: 'โปรไฟล์ / แพลตฟอร์ม' }),
            h('th', { text: 'คลิก' }),
            h('th', { text: 'ออเดอร์' }),
            h('th', { text: 'รายได้ (THB)' }),
            h('th', { text: 'Conversion' }),
            h('th', { text: 'ไทม์ไลน์' }),
          )),
          h('tbody', null, data.by_content.map((row, index) => h('tr', null,
            h('td', { class: 'mono small', text: String(index + 1) }),
            h('td', null,
              h('p', { class: 'cell-title', text: `${row.content_id} · ${row.title}` }),
              h('p', { class: 'cell-sub text-muted', text: row.published_at ? fmtDate(row.published_at) : '—' }),
            ),
            h('td', null,
              h('p', { class: 'small', text: row.profile_name }),
              h('p', { class: 'cell-sub mono small', text: row.platform || row.channel }),
            ),
            h('td', { class: 'mono small', text: String(row.clicks) }),
            h('td', { class: 'mono small', text: String(row.orders) }),
            h('td', { class: 'mono small', text: row.commission_thb.toFixed(2) }),
            h('td', { class: 'mono small', text: row.conversion_rate === null ? '—' : `${row.conversion_rate}%` }),
            h('td', null,
              h('button', {
                type: 'button', class: 'btn btn-ghost', disabled: ui.busy,
                on: { click: () => openTraceFromContent(row.content_id) },
              }, 'ไทม์ไลน์'),
            ),
          ))),
        ),
      )
      : h('p', { class: 'note' }, 'ยังไม่มีคอนเทนต์ที่เผยแพร่ — ตั้งเวลาและกดเผยแพร่ในขั้น Schedule ก่อน'),
  ));

  wrap.append(h('section', { class: 'mvp-card' },
    h('div', { class: 'card-head' },
      h('div', null,
        h('p', { class: 'eyebrow', text: 'Result entry' }),
        h('h2', { text: 'บันทึกผลจากรายงาน Affiliate' }),
      ),
    ),
    h('p', { class: 'note' }, 'กรอกยอดจริงจากรายงาน (คลิก / ออเดอร์ / ค่าคอมมิชชัน) ผูกกับ content_id ที่เผยแพร่แล้ว — ใช้เป็นข้อมูลตั้งต้นของ Dashboard'),
    renderResultForm(state),
  ));

  if (data.by_profile.length) {
    wrap.append(h('section', { class: 'mvp-card' },
      h('div', { class: 'card-head' },
        h('div', null,
          h('p', { class: 'eyebrow', text: 'By profile' }),
          h('h2', { text: 'รายได้แยกตามโปรไฟล์' }),
        ),
      ),
      h('div', { class: 'table-scroll' },
        h('table', { class: 'mvp-table compact' },
          h('thead', null, h('tr', null,
            h('th', { text: 'โปรไฟล์' }),
            h('th', { text: 'คอนเทนต์' }),
            h('th', { text: 'ออเดอร์' }),
            h('th', { text: 'รายได้ (THB)' }),
          )),
          h('tbody', null, data.by_profile.map((entry) => h('tr', null,
            h('td', { text: entry.label }),
            h('td', { class: 'mono small', text: String(entry.contents) }),
            h('td', { class: 'mono small', text: String(entry.orders) }),
            h('td', { class: 'mono small', text: entry.commission_thb.toFixed(2) }),
          ))),
        ),
      ),
    ));
  }
  return wrap;
}

function renderResultForm(state) {
  const published = (state.contents || []).filter((project) => project.publish_schedule
    && project.publish_schedule.status === 'PUBLISHED');
  const form = analyticsFormState();
  if (!published.length) {
    return h('p', { class: 'note' }, 'ยังไม่มีคอนเทนต์ที่เผยแพร่แล้วให้บันทึกผล');
  }
  if (!form.content_id || !published.some((project) => project.content_id === form.content_id)) {
    form.content_id = published[0].content_id;
  }
  const field = (id, label, props) => h('label', { class: 'field' },
    h('span', { class: 'field-label', text: label }),
    h('input', {
      id, type: 'number', min: '0', step: props && props.step ? props.step : '1',
      placeholder: props && props.placeholder ? props.placeholder : '',
    }),
  );
  return h('div', { class: 'stack' },
    h('div', { class: 'field inline' },
      h('label', { class: 'field' },
        h('span', { class: 'field-label', text: 'คอนเทนต์ที่เผยแพร่แล้ว' }),
        h('select', {
          id: 'result-content',
          on: { change: (event) => { form.content_id = event.target.value; } },
        }, published.map((project) => h('option', {
          value: project.content_id,
          text: `${project.content_id} · ${(project.offer_snapshot || {}).product_name || ''}`,
          selected: project.content_id === form.content_id,
        }))),
      ),
      field('result-clicks', 'คลิก'),
      field('result-orders', 'ออเดอร์'),
      field('result-commission', 'ค่าคอมมิชชัน (THB)', { step: '0.01' }),
    ),
    h('label', { class: 'field' },
      h('span', { class: 'field-label', text: 'หมายเหตุ (ไม่บังคับ)' }),
      h('input', { id: 'result-note', type: 'text', placeholder: 'เช่น ข้อมูลจากรายงานวันที่ …' }),
    ),
    h('div', { class: 'toolbar' },
      h('button', {
        type: 'button', class: 'btn btn-primary', disabled: ui.busy,
        on: {
          click: () => {
            let payload = null;
            try {
              payload = collectResultForm();
            } catch (err) {
              ui.error = { message: err.message };
              render();
              return;
            }
            run(async () => {
              await submitResult(payload);
            }, 'บันทึกผลแล้ว — Dashboard อัปเดตทันที');
          },
        },
      }, 'บันทึกผลลัพธ์'),
    ),
  );
}

async function openTraceFromContent(contentId) {
  const project = (ui.state.contents || []).find((item) => item.content_id === contentId);
  if (!project) return;
  ui.section = 'research';
  render();
  await openTrace(project.candidate_id);
}
