'use strict';

/**
 * ACE — End-to-End Traceability View.
 *
 * One job: given a candidate, rebuild the whole life of that item from what is
 * already stored — why it entered the pool, what script/storyboard/narration it
 * got, whether the QC checksum was verified, and which MP4 / caption / affiliate
 * link actually left the system.
 *
 * Everything here is derived. Nothing is written, nothing is re-rendered, and no
 * external service is called; the view can only show what the state and the
 * Content Library already contain. When a step has not happened, the step says
 * so instead of guessing.
 */

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');
const analytics = require('./analytics');
const profiles = require('./profiles');

const STEPS = [
  { id: 'research', label: 'Research & Selection' },
  { id: 'production', label: 'Production' },
  { id: 'finalize', label: 'Finalize / QC' },
  { id: 'export', label: 'Export & Publish Payload' },
];

const AUDIO_STATUS_TEXT = {
  AUDIO_PENDING: 'ยังไม่มีเสียงบรรยาย',
  AUDIO_ATTACHED: 'ผูกเสียงครบแล้ว',
  AUDIO_DURATION_MISMATCH: 'ความยาวเสียงไม่ตรงกับฉาก',
  AUDIO_APPROVED: 'เสียงผ่านการตรวจรับแล้ว',
};

const APPROACH_TEXT = {
  problem_first: 'เริ่มจากปัญหา',
  value_compare: 'เทียบราคา',
  evidence_first: 'เน้นหลักฐาน',
  user_custom: 'กำหนดเอง',
};

const PUBLISH_STATUS_TEXT = {
  SCHEDULED: 'ตั้งเวลาไว้ รอเวลาถึง',
  QUEUED: 'เลยเวลาแล้ว — รออนุมัติ (Fallback Queue)',
  PUBLISHED: 'เผยแพร่แล้ว (จำลอง)',
  CANCELLED: 'ยกเลิกกำหนดการ',
};

function clean(value, limit = 400) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, limit);
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stepMeta(id) {
  return STEPS.find((step) => step.id === id) || { id, label: id };
}

function makeStep(id, status, fields = {}) {
  return {
    id,
    label: stepMeta(id).label,
    status,
    at: fields.at || null,
    summary: fields.summary || '',
    facts: fields.facts || [],
    checks: fields.checks || [],
    notes: fields.notes || [],
    scenes: fields.scenes || null,
    payload: fields.payload || null,
  };
}

function fact(label, value, mono = false) {
  if (value === null || value === undefined || value === '') return null;
  return { label, value: String(value), mono };
}

function check(label, ok, detail) {
  return { label, ok: ok === true, detail: detail ? String(detail) : '' };
}

/** sha256 of the file on disk, so the view can say VERIFIED from evidence. */
async function integrityOf(file, expectedSha256) {
  const result = { exists: false, bytes: null, sha256: null, integrity: 'MISSING' };
  if (typeof file !== 'string' || !file) return result;
  try {
    const data = await fsp.readFile(file);
    result.exists = true;
    result.bytes = data.length;
    result.sha256 = crypto.createHash('sha256').update(data).digest('hex');
    result.integrity = expectedSha256 && result.sha256 === expectedSha256 ? 'VERIFIED' : 'MISMATCH';
  } catch {
    result.integrity = 'MISSING';
  }
  return result;
}

/** Copy without absolute disk paths, so the raw panel shows records, not a machine. */
function sanitizeProject(project) {
  const assets = {};
  for (const [id, asset] of Object.entries(project.assets || {})) {
    const next = { ...asset };
    delete next.file;
    assets[id] = next;
  }
  const copy = { ...project, assets };
  if (copy.export) {
    const exp = { ...copy.export };
    delete exp.file;
    copy.export = exp;
  }
  return copy;
}

function findAiPick(state, candidateId) {
  const analysis = state.ai_research && state.ai_research.analysis;
  if (!analysis || !Array.isArray(analysis.picks)) return null;
  const pick = analysis.picks.find((item) => item && item.candidate_id === candidateId);
  if (!pick) return null;
  return {
    ran_at: state.ai_research.ran_at || null,
    model: state.ai_research.model || null,
    fit_score: num(pick.fit_score),
    why: clean(pick.why, 600),
    risks: clean(pick.risks, 600),
    hook: clean(pick.hook, 300),
    script: Array.isArray(pick.script) ? pick.script.slice(0, 6) : [],
    summary: clean(analysis.summary, 600),
  };
}

function researchStep(state, candidate, evidence, aiPick) {
  const sources = (candidate.source_ids || []).map((id) => {
    const source = state.sources && state.sources[id];
    return { id, label: source ? (source.label || id) : id, status: source ? source.status : null };
  });
  const actions = (state.actions || [])
    .filter((entry) => entry && entry.candidate_id === candidate.id)
    .slice(-8)
    .map((entry) => ({
      at: entry.at,
      action: entry.action,
      from: entry.from,
      to: entry.to,
      note: entry.note || null,
    }));
  const history = Array.isArray(candidate.status_history)
    ? candidate.status_history.slice(-8).map((entry) => ({
      at: entry.at, action: entry.action, from: entry.from, to: entry.to,
    }))
    : [];
  const scores = candidate.scores || {};
  return makeStep('research', 'DONE', {
    at: candidate.created_at || null,
    summary: `ติดอันดับ #${candidate.rank} ของพูล จาก ${sources.length} แหล่งข้อมูล · `
      + `${(candidate.evidence_ids || []).length} หลักฐานอ้างอิง`,
    facts: [
      fact('Candidate ID', candidate.id, true),
      fact('สินค้า', candidate.title || (candidate.offer_snapshot && candidate.offer_snapshot.product_name)),
      fact('ร้านค้า', candidate.shop ? candidate.shop.name : null),
      fact('หมวดหมู่', candidate.category),
      fact('Ranking score', scores.ranking_score === undefined ? null : `${scores.ranking_score}/100`, true),
      fact('Opportunity score', scores.opportunity_score === undefined ? null : `${scores.opportunity_score}/100`, true),
      fact('Data confidence', scores.confidence ? `${scores.confidence.level} (${scores.confidence.score})` : null),
      fact('สถานะในพูล', candidate.status, true),
      fact('แหล่งข้อมูล', sources.map((source) => source.label || source.id).join(' · '), true),
      fact('หลักฐาน (evidence)', `${evidence.length} records`, true),
    ],
    checks: [
      check('บันทึก Candidate / Product / Offer ID ครบ', Boolean(candidate.id && candidate.product_id && candidate.offer_id),
        [candidate.id, candidate.product_id, candidate.offer_id].filter(Boolean).join(' · ')),
      check('มีหลักฐานอ้างอิงประกอบการจัดอันดับ', evidence.length > 0, evidence.map((item) => item.id).join(' · ')),
      check('ระบุแหล่งข้อมูลต้นทาง', sources.length > 0, sources.map((source) => source.id).join(' · ')),
      check('มีเหตุผลการคัดเลือก', Array.isArray(candidate.reasons) && candidate.reasons.length > 0,
        `${(candidate.reasons || []).length} ข้อ`),
    ],
    notes: aiPick && aiPick.risks ? [`ความเสี่ยงที่ AI ระบุ: ${aiPick.risks}`] : [],
    scenes: null,
    payload: {
      reasons: candidate.reasons || [],
      claims: candidate.claims || [],
      evidence: evidence.map((item) => ({
        id: item.id,
        code: item.code || null,
        claim_class: item.claim_class || null,
        text: item.text || item.value || null,
        source_ids: item.source_ids || [],
        checked_at: item.checked_at || null,
      })),
      sources,
      actions,
      history,
      ai_pick: aiPick,
    },
  });
}

function runSteps(project, integrity, libraryEntry, results) {
  const scenes = (project.storyboard && project.storyboard.scenes) || [];
  const assets = project.assets || {};
  const audioState = project.audio || {};
  const withVoice = scenes.filter((scene) => scene.audio && clean(scene.audio.voiceover));
  const withAudioFile = scenes.filter((scene) => scene.audio && scene.audio.asset_ref);
  const totalDuration = scenes.reduce((sum, scene) => sum + (num(scene.duration_s) || 0), 0);

  const productionStatus = !project.script || !scenes.length
    ? 'PENDING'
    : project.status === 'DRAFT' || project.status === 'REVIEW' ? 'ACTIVE' : 'DONE';

  const production = makeStep('production', productionStatus, {
    at: project.created_at || null,
    summary: `${scenes.length} ฉาก · ${(project.script && project.script.checksum) ? `script v${project.script_version}` : 'ยังไม่มีสคริปต์'}`
      + ` · ${AUDIO_STATUS_TEXT[audioState.status] || audioState.status || 'ไม่ทราบสถานะเสียง'}`,
    facts: [
      fact('Content ID', project.content_id, true),
      fact('แนวทาง', APPROACH_TEXT[project.approach] || project.approach),
      fact('สถานะโปรเจกต์', project.status, true),
      fact('Script version', project.script_version, true),
      fact('Script checksum', project.script && project.script.checksum ? project.script.checksum : null, true),
      fact('จำนวนฉาก', scenes.length, true),
      fact('ความยาวรวม', scenes.length ? `${Math.round(totalDuration * 10) / 10}s` : null, true),
      fact('ไฟล์เสียงที่ผูกแล้ว', `${withAudioFile.length}/${scenes.length}`, true),
      fact('สถานะเสียง', AUDIO_STATUS_TEXT[audioState.status] || audioState.status, true),
      fact('สร้างเมื่อ', project.created_at),
      fact('แก้ไขล่าสุด', project.updated_at),
    ],
    checks: [
      check('มีสคริปต์พร้อม checksum', Boolean(project.script && project.script.checksum),
        project.script ? `v${project.script_version}` : 'ยังไม่มี'),
      check('ทุกฉากมีบทพูดภาษาไทย', scenes.length > 0 && withVoice.length === scenes.length,
        `${withVoice.length}/${scenes.length} ฉาก`),
      check('ทุกฉากมีไฟล์เสียงบรรยาย', scenes.length > 0 && withAudioFile.length === scenes.length,
        `${withAudioFile.length}/${scenes.length} ฉาก`),
      check('ไม่มีความยาวเสียงคลาดเคลื่อน', (audioState.mismatches || []).length === 0,
        (audioState.mismatches || []).length ? `${audioState.mismatches.length} ฉากไม่ตรง` : 'ตรงทุกฉาก'),
    ],
    scenes: scenes.map((scene) => {
      const asset = scene.audio && scene.audio.asset_ref ? assets[scene.audio.asset_ref] : null;
      return {
        id: scene.id,
        role: scene.role || null,
        duration_s: num(scene.duration_s),
        headline: scene.overlay ? clean(scene.overlay.headline, 160) : '',
        voiceover: scene.audio ? clean(scene.audio.voiceover, 400) : '',
        evidence_ids: scene.evidence_ids || [],
        audio: asset ? {
          asset_id: asset.id,
          file: asset.path || asset.filename || null,
          bytes: num(asset.bytes),
          duration_s: num(asset.duration_s),
          provider: asset.provider || asset.source || null,
          sha256: asset.sha256 || null,
        } : null,
      };
    }),
    payload: {
      script: project.script ? {
        version: project.script_version,
        checksum: project.script.checksum || null,
        lines: project.script.lines || null,
        version_history: project.script_version_history || [],
      } : null,
      approach: project.approach,
      cta: project.cta || null,
      storyboard_version: project.storyboard ? project.storyboard.version : null,
      audio: {
        required: audioState.required === true,
        approved: audioState.approved === true,
        status: audioState.status || null,
        mismatches: audioState.mismatches || [],
      },
      revisions: project.revisions || [],
      edit_log: project.edit_log || [],
    },
  });

  const fin = project.finalize || null;
  const qa = project.qa || null;
  const superseded = Boolean(fin && fin.superseded_at);
  const finalizeStatus = superseded ? 'STALE' : fin ? 'DONE' : qa ? 'ACTIVE' : 'PENDING';
  const checklist = fin && fin.checklist ? fin.checklist : null;
  const finalize = makeStep('finalize', finalizeStatus, {
    at: fin ? fin.finalized_at : qa ? qa.ran_at : null,
    summary: superseded
      ? 'เคย finalize แล้ว แต่ถูกแก้ไขภายหลัง — ต้องตรวจและ finalize ใหม่'
      : fin
        ? `VERIFIED · ผ่าน ${(checklist ? (checklist.ok || 0) : 0)}/${(checklist ? (checklist.total || 0) : 0)} ข้อ · ตรวจรับโดย ${fin.review ? fin.review.reviewed_by : '—'}`
        : qa
          ? `ตรวจภาษาไทยแล้ว (${qa.summary ? `${qa.summary.PASS} ผ่าน · ${qa.summary.WARN} เตือน · ${qa.summary.FAIL} ผิดพลาด` : 'มีผลตรวจ'}) แต่ยังไม่ finalize`
          : 'ยังไม่ได้ตรวจหรือ finalize',
    facts: [
      fact('สถานะการตรวจ', superseded ? 'ต้อง finalize ใหม่' : fin ? 'VERIFIED' : qa ? 'ตรวจแล้ว ยังไม่ finalize' : 'ยังไม่เริ่ม', true),
      fact('Finalized at', fin ? fin.finalized_at : null),
      fact('ผู้ตรวจรับ', fin && fin.review ? fin.review.reviewed_by : null),
      fact('เวลาตรวจรับ', fin && fin.review ? fin.review.reviewed_at : null),
      fact('Script checksum ที่ตรวจรับ', fin && fin.review ? fin.review.script_checksum : null, true),
      fact('Checklist', checklist ? `${checklist.ok}/${checklist.total} ผ่าน` : null, true),
      fact('Thai QA', qa && qa.summary ? `${qa.summary.PASS} ผ่าน · ${qa.summary.WARN} เตือน · ${qa.summary.FAIL} ผิดพลาด` : null),
      fact('เสียงที่ตรวจรับ', fin && fin.audio ? `${AUDIO_STATUS_TEXT[fin.audio.status] || fin.audio.status}${fin.audio.approved ? ' · อนุมัติแล้ว' : ''}` : null),
      fact('ถูกแทนที่เมื่อ', superseded ? fin.superseded_at : null),
    ],
    checks: checklist && Array.isArray(checklist.items)
      ? checklist.items.map((item) => check(item.label, item.ok === true, item.detail))
      : [
        check('มีผลตรวจภาษาไทย', Boolean(qa), qa ? `รันเมื่อ ${qa.ran_at}` : 'ยังไม่ได้รัน'),
        check('ผ่านการ finalize', Boolean(fin), fin ? fin.finalized_at : 'ยังไม่ finalize'),
      ],
    notes: superseded
      ? [`มีการแก้ไขเมื่อ ${fin.superseded_at} หลัง finalize — สถานะ VERIFIED เดิมใช้กับบทพูดปัจจุบันไม่ได้แล้ว`]
      : [],
    scenes: null,
    payload: {
      finalize: fin,
      qa: qa ? {
        ran_at: qa.ran_at,
        summary: qa.summary,
        items: (qa.items || qa.results || []).slice(0, 40),
      } : null,
      draft_review: fin ? fin.review || null : null,
    },
  });

  const exp = project.export || null;
  const prep = project.publish_prep || null;
  const schedule = project.publish_schedule || null;
  const publication = (libraryEntry && libraryEntry.publication) || null;
  const exportStatus = !exp ? 'PENDING' : integrity.integrity === 'VERIFIED' ? 'DONE' : 'BLOCKED';
  const payloadFile = exp ? {
    content_id: project.content_id,
    filename: exp.filename || null,
    bytes: num(exp.bytes),
    width: num(exp.width),
    height: num(exp.height),
    duration_s: num(exp.duration_s),
    aspect_ratio: exp.aspect_ratio || '9:16',
    sha256: exp.sha256 || null,
    exported_at: exp.exported_at || null,
    pipeline: exp.pipeline || null,
    encoder: exp.encoder || null,
  } : null;

  const exportStep = makeStep('export', exportStatus, {
    at: exp ? exp.exported_at : null,
    summary: exp
      ? `${exp.filename} · ${exp.width}×${exp.height} · ${exp.duration_s}s · sha256 ${integrity.integrity}`
      : 'ยังไม่มีไฟล์ MP4 ที่ export',
    facts: [
      fact('ไฟล์ MP4', exp ? exp.filename : null, true),
      fact('ขนาด', exp && num(exp.bytes) !== null ? `${Math.round(exp.bytes / 1024)} KB` : null),
      fact('ความละเอียด', exp && exp.width && exp.height ? `${exp.width}×${exp.height} (${exp.aspect_ratio || '9:16'})` : null, true),
      fact('ความยาว', exp && num(exp.duration_s) !== null ? `${exp.duration_s}s` : null, true),
      fact('sha256 ที่บันทึก', exp ? exp.sha256 : null, true),
      fact('sha256 บนดิสก์', integrity.sha256, true),
      fact('ผลตรวจไฟล์', exp ? integrity.integrity : null, true),
      fact('Library entry', libraryEntry ? libraryEntry.id : null, true),
      fact('Caption', prep ? 'มี caption_draft พร้อมส่งออก' : null),
      fact('Affiliate link', prep && prep.product_reference ? prep.product_reference.affiliate_link : null, true),
      fact('กำหนดเผยแพร่', schedule ? `${PUBLISH_STATUS_TEXT[schedule.status] || schedule.status} · ${schedule.channel}` : null),
      fact('โปรไฟล์ / แพลตฟอร์ม', project.profile_id ? `${project.profile_id} · ${project.platform || schedule && schedule.platform || '—'}` : null),
      fact('เผยแพร่เมื่อ', schedule && schedule.published_at ? schedule.published_at : null),
      fact('รายได้ที่บันทึก', results.length
        ? `${results.reduce((sum, record) => sum + (num(record.commission_thb) || 0), 0).toFixed(2)} THB จาก ${results.length} ครั้ง`
        : null),
    ],
    checks: [
      check('มีไฟล์วิดีโอที่ export แล้ว', Boolean(exp && exp.filename), exp ? exp.filename : 'ยังไม่มี'),
      check('ไฟล์บนดิสก์ตรงกับ sha256 ที่บันทึก', integrity.integrity === 'VERIFIED',
        integrity.integrity === 'VERIFIED' ? 'VERIFIED' : integrity.integrity),
      check('ไฟล์เป็นแนวตั้ง 9:16', Boolean(exp && exp.width === 1080 && exp.height === 1920),
        exp ? `${exp.width}×${exp.height}` : '—'),
      check('มี Publish Payload (caption + ลิงก์)', Boolean(prep && prep.caption_draft),
        prep ? `ready: ${prep.ready === true}` : 'ยังไม่ได้สร้าง payload'),
    ],
    notes: prep && prep.ready === false
      ? ['Publish payload ยังไม่ผ่านทุกข้อ — ดู checklist ด้านใน']
      : [],
    scenes: null,
    payload: {
      export: payloadFile,
      file: {
        integrity: integrity.integrity,
        exists: integrity.exists,
        bytes: integrity.bytes,
        sha256: integrity.sha256,
      },
      library_entry: libraryEntry || null,
      publish_prep: prep ? {
        caption_draft: prep.caption_draft || null,
        hashtags: prep.hashtags || [],
        disclosure: prep.disclosure || null,
        product_reference: prep.product_reference || null,
        checklist: prep.checklist || [],
        ready: prep.ready === true,
      } : null,
      publish_schedule: schedule,
      publication,
      results: results.map((record) => ({
        id: record.id,
        recorded_at: record.recorded_at,
        clicks: record.clicks,
        orders: record.orders,
        commission_thb: record.commission_thb,
        note: record.note,
      })),
    },
  });

  const steps = [production, finalize, exportStep];
  const done = steps.filter((step) => step.status === 'DONE').length;
  return {
    content_id: project.content_id,
    status: project.status,
    approach: project.approach,
    created_at: project.created_at,
    updated_at: project.updated_at,
    done_steps: done,
    total_steps: steps.length,
    steps,
    media: {
      video_url: exp ? `/api/mvp/content/${encodeURIComponent(project.content_id)}/export/video` : null,
      still_url: exp && exp.still ? `/api/mvp/content/${encodeURIComponent(project.content_id)}/export/still` : null,
      download_url: libraryEntry ? `/api/mvp/library/${encodeURIComponent(libraryEntry.id)}/file` : null,
      integrity: integrity.integrity,
      duration_s: exp ? num(exp.duration_s) : null,
      width: exp ? num(exp.width) : null,
      height: exp ? num(exp.height) : null,
    },
    payload: {
      caption: prep ? prep.caption_draft || null : null,
      hashtags: prep ? prep.hashtags || [] : [],
      affiliate_link: prep && prep.product_reference ? prep.product_reference.affiliate_link || null : null,
      product_url: prep && prep.product_reference ? prep.product_reference.product_url || null : null,
    },
    revenue: {
      clicks: results.reduce((sum, record) => sum + (num(record.clicks) || 0), 0),
      orders: results.reduce((sum, record) => sum + (num(record.orders) || 0), 0),
      commission_thb: Math.round(results.reduce((sum, record) => sum + (num(record.commission_thb) || 0), 0) * 100) / 100,
      results_count: results.length,
      last_recorded_at: results.length
        ? results.map((record) => record.recorded_at).sort().at(-1)
        : null,
    },
    raw: sanitizeProject(project),
  };
}

/**
 * Builds the whole view. `libraryItems` is the parsed Content Library index;
 * when absent, export integrity is reported from the recorded sha256 only.
 */
async function buildTrace(state, candidateId, options = {}) {
  const candidate = state && state.candidates ? state.candidates[candidateId] : null;
  if (!candidate) return null;
  const libraryItems = Array.isArray(options.libraryItems) ? options.libraryItems : [];
  const offer = (state.offers && state.offers[candidate.offer_id]) || null;
  const product = (state.products && state.products[candidate.product_id]) || null;
  const evidence = (candidate.evidence_ids || [])
    .map((id) => (state.evidence ? state.evidence[id] : null))
    .filter(Boolean);
  const aiPick = findAiPick(state, candidateId);
  const projects = (state.contentOrder || [])
    .map((id) => (state.contents ? state.contents[id] : null))
    .filter((project) => project && project.candidate_id === candidateId);

  const runs = [];
  for (const project of projects) {
    const entry = libraryItems.find((item) => item && item.id === project.content_id) || null;
    const exportRecord = project.export || null;
    const integrity = exportRecord
      ? await integrityOf(exportRecord.file, exportRecord.sha256)
      : { exists: false, bytes: null, sha256: null, integrity: 'MISSING' };
    runs.push(await runSteps(project, integrity, entry, analytics.recordsFor(state, project.content_id)));
  }

  const research = researchStep(state, candidate, evidence, aiPick);
  const steps = [research, ...(runs[0] ? runs[0].steps : [
    makeStep('production', 'PENDING', { summary: 'ยังไม่มี Production run สำหรับรายการนี้' }),
    makeStep('finalize', 'PENDING', { summary: 'ยังไม่มีอะไรให้ตรวจ' }),
    makeStep('export', 'PENDING', { summary: 'ยังไม่มีไฟล์ MP4 ที่ export' }),
  ])];

  // Legacy content created before profiles existed has no profile; it is shown
  // as unassigned instead of being silently attributed to the active channel.
  const profile = profiles.resolveProfile(state, runs[0] ? runs[0].raw.profile_id : null);
  return {
    generated_at: new Date().toISOString(),
    candidate_id: candidateId,
    title: candidate.title || (product ? product.name : candidateId),
    candidate_status: candidate.status,
    profile: profile ? {
      id: profile.id,
      name: profile.name,
      platform: profile.platform,
      channel: profile.channel,
    } : null,
    revenue: {
      commission_thb: Math.round(runs.reduce((sum, run) => sum + run.revenue.commission_thb, 0) * 100) / 100,
      orders: runs.reduce((sum, run) => sum + run.revenue.orders, 0),
      clicks: runs.reduce((sum, run) => sum + run.revenue.clicks, 0),
      results_count: runs.reduce((sum, run) => sum + run.revenue.results_count, 0),
    },
    steps,
    runs,
    has_runs: runs.length > 0,
    raw: {
      candidate,
      offer: offer ? { ...offer, file: undefined } : null,
      product: product || null,
      evidence,
      ai_pick: aiPick,
      contents: runs.map((run) => run.raw),
    },
  };
}

module.exports = {
  STEPS,
  AUDIO_STATUS_TEXT,
  PUBLISH_STATUS_TEXT,
  buildTrace,
  integrityOf,
};
