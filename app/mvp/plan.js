'use strict';

/**
 * ACE — Plan & AI video generation view.
 *
 * The storyboard already carries five scenes; the plan stage reads them as the
 * four-beat structure the guide asks for (Hook, Action, Payoff, Call to Action),
 * adds timecodes and a frame preview, and never rewrites the storyboard.
 */

const BEATS = [
  {
    id: 'hook',
    label: 'Hook',
    roles: ['HOOK'],
    purpose: 'ดึงความสนใจใน 3 วินาทีแรก',
  },
  {
    id: 'action',
    label: 'Action',
    roles: ['PROBLEM', 'OFFER'],
    purpose: 'เล่าปัญหาและเสนอทางออกด้วยข้อมูลจริง',
  },
  {
    id: 'payoff',
    label: 'Payoff',
    roles: ['EVIDENCE'],
    purpose: 'ให้หลักฐานที่ทำให้เชื่อ (ราคา รีวิว โปร)',
  },
  {
    id: 'cta',
    label: 'Call to Action',
    roles: ['CTA'],
    purpose: 'บอกสิ่งที่ต้องทำต่อพร้อมลิงก์',
  },
];

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clean(value, limit = 400) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, limit);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Builds the plan view: four beats in order, each with its scene ids, timecodes
 * and spoken lines, plus one frame per scene for the preview strip.
 */
function buildPlan(project) {
  const scenes = (project.storyboard && project.storyboard.scenes) || [];
  const frames = [];
  let clock = 0;
  for (const scene of scenes) {
    const duration = num(scene.duration_s) || 0;
    const start = clock;
    clock = round(clock + duration);
    frames.push({
      scene_id: scene.id,
      role: scene.role || null,
      start_s: start,
      end_s: clock,
      duration_s: round(duration),
      timecode: `${start.toFixed(1)}s – ${clock.toFixed(1)}s`,
      headline: scene.overlay ? clean(scene.overlay.headline, 160) : '',
      subhead: scene.overlay ? clean(scene.overlay.subhead, 200) : '',
      fact: scene.overlay ? clean(scene.overlay.fact, 200) : '',
      badge: scene.overlay ? clean(scene.overlay.badge, 120) : '',
      preset: scene.visual ? scene.visual.preset : null,
      background: scene.visual ? scene.visual.background : null,
      voiceover: scene.audio ? clean(scene.audio.voiceover, 400) : '',
      audio_asset_id: scene.audio ? scene.audio.asset_ref || null : null,
      evidence_ids: scene.evidence_ids || [],
    });
  }

  const beats = BEATS.map((beat) => {
    const beatFrames = frames.filter((frame) => beat.roles.includes(frame.role));
    const start = beatFrames.length ? beatFrames[0].start_s : null;
    const end = beatFrames.length ? beatFrames[beatFrames.length - 1].end_s : null;
    return {
      id: beat.id,
      label: beat.label,
      purpose: beat.purpose,
      roles: beat.roles,
      scene_ids: beatFrames.map((frame) => frame.scene_id),
      start_s: start,
      end_s: end,
      duration_s: start === null ? null : round(end - start),
      timecode: start === null ? null : `${start.toFixed(1)}s – ${end.toFixed(1)}s`,
      lines: beatFrames.map((frame) => frame.voiceover).filter(Boolean),
      headlines: beatFrames.map((frame) => frame.headline).filter(Boolean),
      evidence_ids: [...new Set(beatFrames.flatMap((frame) => frame.evidence_ids))],
      filled: beatFrames.length > 0,
    };
  });

  const missing = beats.filter((beat) => !beat.filled && beat.id !== 'cta').map((beat) => beat.label);
  return {
    content_id: project.content_id,
    status: project.status,
    approach: project.approach,
    profile_id: project.profile_id || null,
    platform: project.platform || null,
    script_version: project.script_version,
    script_checksum: project.script ? project.script.checksum || null : null,
    total_duration_s: round(clock),
    scene_count: scenes.length,
    beats,
    frames,
    missing_beats: missing,
    hook: beats[0] && beats[0].headlines.length ? beats[0].headlines[0] : null,
    cta: project.cta || null,
    offer: project.offer_snapshot || null,
    boundaries: [
      'แผนนี้อ่านจาก Storyboard ปัจจุบัน ไม่ได้เขียนทับหรือสร้างสคริปต์ใหม่',
      'พรีวิวเฟรมเป็นข้อมูลภาพ/ข้อความเดียวกับที่เรนเดอร์ลงวิดีโอ',
    ],
  };
}

module.exports = {
  BEATS,
  buildPlan,
};
